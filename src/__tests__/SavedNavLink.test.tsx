import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SavedNavLink from '../components/SavedNavLink';
import { REALTIME_IN_FILTER_LIMIT } from '../hooks/useSavedPriceDrops';
import Saved from '../pages/Saved';
import { acknowledgePriceChange, countPriceDrops, toggleSaved } from '../utils/saved';

let rows: any[] = [];
const inCalls: string[][] = [];
type FakeChannel = { name: string; filter: any; handler: (p: any) => void; removed: boolean };
const channels: FakeChannel[] = [];
const liveChannels = () => channels.filter((c) => !c.removed);
const pushUpdate = (row: any) => act(() => { liveChannels().forEach((c) => c.handler({ new: row })); });

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: (name: string) => {
      const ch = { name, removed: false } as FakeChannel;
      const api = {
        on: (_type: string, filter: any, handler: (p: any) => void) => {
          Object.assign(ch, { filter, handler });
          return api;
        },
        subscribe: () => {
          channels.push(ch);
          return ch;
        },
      };
      return api;
    },
    removeChannel: (ch: FakeChannel) => { ch.removed = true; },
    from: () => ({
      select: () => ({
        in: (_col: string, ids: string[]) => {
          inCalls.push(ids);
          const result = Promise.resolve({ data: rows.filter((r) => ids.includes(r.id)), error: null });
          // Saved page chains .order(); the nav hook awaits .in() directly.
          return Object.assign(result, { order: () => result });
        },
      }),
    }),
  },
}));

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => { data.delete(k); },
    setItem: (k, v) => { data.set(k, String(v)); },
  };
}

const row = (id: string, rent: number, title = id) => ({
  id, title, rent, neighborhood: 'Fremont', points: 1, username: 'x', created_at: '2026-09-01T00:00:00Z',
});

const navLink = () => screen.getByRole('link', { name: /^saved/ });

describe('saved nav price-drop badge', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    inCalls.length = 0;
    channels.length = 0;
    // a and d dropped, b rose, c is a legacy save with no baseline.
    rows = [row('a', 1800, 'Sunny 1BR'), row('b', 1500), row('c', 2600), row('d', 900, 'Tiny studio'), row('e', 1200)];
    localStorage.setItem('nd_saved_listings', JSON.stringify(['a', 'b', 'c', 'd']));
    localStorage.setItem('nd_saved_rent_snapshots', JSON.stringify({ a: 2000, b: 1400, d: 1000 }));
  });

  it('counts only drops against an existing baseline', () => {
    expect(countPriceDrops(rows)).toBe(2);
    expect(countPriceDrops([row('c', 1)])).toBe(0);
  });

  it('shows the drop count on load with one narrow fetch', async () => {
    render(<MemoryRouter><SavedNavLink /></MemoryRouter>);
    await waitFor(() => expect(navLink()).toHaveTextContent('saved (2↓)'));
    expect(navLink()).toHaveAttribute('title', '2 saved listings dropped in price since you saved');
    expect(navLink()).toHaveClass('font-bold');
    expect(inCalls).toEqual([['a', 'b', 'c', 'd']]);
  });

  it('recounts on [ok] and unsave without refetching, refetches when a new id is saved', async () => {
    render(<MemoryRouter><SavedNavLink /></MemoryRouter>);
    await waitFor(() => expect(navLink()).toHaveTextContent('saved (2↓)'));

    act(() => acknowledgePriceChange('a', 1800));
    expect(navLink()).toHaveTextContent('saved (1↓)');
    expect(navLink()).toHaveAttribute('title', '1 saved listing dropped in price since you saved');

    act(() => { toggleSaved('d'); });
    expect(navLink()).toHaveTextContent(/^saved\s*$/);
    expect(navLink()).not.toHaveClass('font-bold');
    expect(navLink()).not.toHaveAttribute('title');
    expect(inCalls).toHaveLength(1);

    // Saved at 1400, then the landlord drops it to 1200 before the next load.
    act(() => { toggleSaved('e', 1400); });
    await waitFor(() => expect(navLink()).toHaveTextContent('saved (1↓)'));
    expect(inCalls).toHaveLength(2);
    expect(inCalls[1]).toEqual(['a', 'b', 'c', 'e']);
  });

  it('follows changes made in another tab', async () => {
    render(<MemoryRouter><SavedNavLink /></MemoryRouter>);
    await waitFor(() => expect(navLink()).toHaveTextContent('saved (2↓)'));

    localStorage.setItem('nd_saved_rent_snapshots', JSON.stringify({ a: 1800, b: 1400, d: 900 }));
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'nd_saved_rent_snapshots' })); });
    expect(navLink()).toHaveTextContent(/^saved\s*$/);

    // Unrelated keys are ignored.
    localStorage.setItem('nd_saved_rent_snapshots', JSON.stringify({ a: 2000 }));
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'theme' })); });
    expect(navLink()).toHaveTextContent(/^saved\s*$/);
  });

  it('refetches rents when the tab becomes visible again', async () => {
    render(<MemoryRouter><SavedNavLink /></MemoryRouter>);
    await waitFor(() => expect(navLink()).toHaveTextContent('saved (2↓)'));

    rows = rows.map((r) => (r.id === 'b' ? { ...r, rent: 1300 } : r));
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(navLink()).toHaveTextContent('saved (3↓)'));
    expect(inCalls).toHaveLength(2);
  });

  it('skips the request entirely with nothing saved', async () => {
    localStorage.clear();
    render(<MemoryRouter><SavedNavLink /></MemoryRouter>);
    await act(async () => {});
    expect(navLink()).toHaveTextContent(/^saved\s*$/);
    expect(inCalls).toEqual([]);
  });

  it('clears the badge when [ok] is clicked on the Saved page', async () => {
    render(
      <MemoryRouter initialEntries={['/saved']}>
        <SavedNavLink />
        <Saved />
      </MemoryRouter>,
    );
    await waitFor(() => expect(navLink()).toHaveTextContent('saved (2↓)'));
    for (const title of ['Sunny 1BR', 'Tiny studio']) {
      const li = (await screen.findByText(title)).closest('li')!;
      fireEvent.click(within(li).getByText('[ok]'));
    }
    expect(navLink()).toHaveTextContent(/^saved\s*$/);
  });

  it('applies a pushed rent cut without refetching', async () => {
    render(<MemoryRouter><SavedNavLink /></MemoryRouter>);
    await waitFor(() => expect(navLink()).toHaveTextContent('saved (2↓)'));
    expect(liveChannels()).toHaveLength(1);
    expect(liveChannels()[0].filter).toEqual({
      event: 'UPDATE', schema: 'public', table: 'listings', filter: 'id=in.(a,b,c,d)',
    });

    // b was saved at 1400 and now drops; a goes back up to its baseline.
    pushUpdate({ ...row('b', 1350), points: 7 });
    expect(navLink()).toHaveTextContent('saved (3↓)');
    pushUpdate(row('a', 2000));
    expect(navLink()).toHaveTextContent('saved (2↓)');
    // Updates to listings that aren't saved (e.g. an upvote on e) change nothing.
    pushUpdate(row('e', 1));
    expect(navLink()).toHaveTextContent('saved (2↓)');
    expect(inCalls).toHaveLength(1);
  });

  it('resubscribes only when a new id is saved, and unsubscribes on unmount', async () => {
    const { unmount } = render(<MemoryRouter><SavedNavLink /></MemoryRouter>);
    await waitFor(() => expect(navLink()).toHaveTextContent('saved (2↓)'));

    act(() => { toggleSaved('d'); });
    act(() => acknowledgePriceChange('a', 1800));
    expect(channels).toHaveLength(1);
    // d is still on the channel but no longer saved, so its update is ignored.
    pushUpdate(row('d', 500));
    expect(navLink()).toHaveTextContent(/^saved\s*$/);

    act(() => { toggleSaved('e', 1400); });
    await waitFor(() => expect(navLink()).toHaveTextContent('saved (1↓)'));
    expect(channels).toHaveLength(2);
    expect(channels[0].removed).toBe(true);
    expect(liveChannels()[0].filter.filter).toBe('id=in.(a,b,c,e)');
    pushUpdate(row('e', 1500));
    expect(navLink()).toHaveTextContent(/^saved\s*$/);

    unmount();
    expect(liveChannels()).toHaveLength(0);
  });

  it('keeps an update pushed while a fetch was in flight', async () => {
    render(<MemoryRouter><SavedNavLink /></MemoryRouter>);
    await waitFor(() => expect(navLink()).toHaveTextContent('saved (2↓)'));

    // The refetch reads b at 1500, but b drops to 1300 before the response lands.
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    pushUpdate(row('b', 1300));
    await waitFor(() => expect(inCalls).toHaveLength(2));
    await act(async () => {});
    expect(navLink()).toHaveTextContent('saved (3↓)');
  });

  it('drops the id filter past the realtime limit and filters client-side', async () => {
    const ids = Array.from({ length: REALTIME_IN_FILTER_LIMIT + 1 }, (_, i) => `id${i}`);
    rows = ids.map((id) => row(id, 1000));
    localStorage.setItem('nd_saved_listings', JSON.stringify(ids));
    localStorage.setItem('nd_saved_rent_snapshots', JSON.stringify(Object.fromEntries(ids.map((id) => [id, 1000]))));
    render(<MemoryRouter><SavedNavLink /></MemoryRouter>);
    await waitFor(() => expect(liveChannels()).toHaveLength(1));
    expect(liveChannels()[0].filter).not.toHaveProperty('filter');

    pushUpdate(row('id100', 900));
    expect(navLink()).toHaveTextContent('saved (1↓)');
    pushUpdate(row('not-saved', 1));
    expect(navLink()).toHaveTextContent('saved (1↓)');
  });

  it('opens no channel with nothing saved', async () => {
    localStorage.clear();
    render(<MemoryRouter><SavedNavLink /></MemoryRouter>);
    await act(async () => {});
    expect(channels).toEqual([]);
  });
});
