import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Saved from '../pages/Saved';

const db: Record<string, any> = {
  a: { id: 'a', title: 'Sunny 1BR', rent: 1800, neighborhood: 'Fremont', points: 3, username: 'x', created_at: '2026-09-01T00:00:00Z' },
  b: { id: 'b', title: 'Quiet studio', rent: 1500, neighborhood: 'Ballard', points: 1, username: 'y', created_at: '2026-09-02T00:00:00Z' },
  c: { id: 'c', title: 'Big 2BR', rent: 2600, neighborhood: 'Capitol Hill', points: 5, username: 'z', created_at: '2026-09-03T00:00:00Z' },
};

// Every .in() call is recorded; `hold` parks responses until released.
const calls: string[][] = [];
let hold = false;
const parked: (() => void)[] = [];

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: (_col: string, ids: string[]) => {
          calls.push([...ids]);
          const result = () => ({ data: ids.filter((id) => db[id]).map((id) => db[id]), error: null });
          const p = hold
            ? new Promise((resolve) => parked.push(() => resolve(result())))
            : Promise.resolve(result());
          return Object.assign(p, { order: () => p });
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

// What another tab does: write localStorage, then this tab gets a storage event.
function otherTab(key: string, value: unknown) {
  act(() => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new StorageEvent('storage', { key }));
  });
}

const titles = () => screen.queryAllByRole('listitem').map((li) => li.querySelector('a')!.textContent);

describe('Saved page follows other tabs', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    calls.length = 0;
    hold = false;
    parked.length = 0;
    localStorage.setItem('nd_saved_listings', JSON.stringify(['a', 'b']));
    localStorage.setItem('nd_saved_rent_snapshots', JSON.stringify({ a: 1800, b: 1500 }));
  });

  it('adds a listing saved elsewhere by fetching only that id, newest first', async () => {
    render(<MemoryRouter initialEntries={['/saved']}><Saved /></MemoryRouter>);
    await screen.findByText('Sunny 1BR');
    expect(calls).toEqual([['a', 'b']]);

    otherTab('nd_saved_listings', ['a', 'b', 'c']);
    expect(await screen.findByText('Big 2BR')).toBeInTheDocument();
    expect(calls).toEqual([['a', 'b'], ['c']]);
    expect(titles()).toEqual(['Big 2BR', 'Quiet studio', 'Sunny 1BR']);
    expect(screen.getByText('3')).toBeInTheDocument();
    // A save without a snapshot gets its baseline from the fetched rent.
    expect(JSON.parse(localStorage.getItem('nd_saved_rent_snapshots')!).c).toBe(2600);
  });

  it('removes a listing unsaved elsewhere without a request', async () => {
    render(<MemoryRouter initialEntries={['/saved']}><Saved /></MemoryRouter>);
    await screen.findByText('Sunny 1BR');
    otherTab('nd_saved_listings', ['b']);
    expect(screen.queryByText('Sunny 1BR')).toBeNull();
    expect(titles()).toEqual(['Quiet studio']);
    expect(calls).toHaveLength(1);
  });

  it('fills an empty list when the first listing is saved elsewhere', async () => {
    localStorage.setItem('nd_saved_listings', '[]');
    render(<MemoryRouter initialEntries={['/saved']}><Saved /></MemoryRouter>);
    expect(await screen.findByText(/No saved listings yet/)).toBeInTheDocument();
    otherTab('nd_saved_listings', ['c']);
    expect(await screen.findByText('Big 2BR')).toBeInTheDocument();
    expect(screen.queryByText(/No saved listings yet/)).toBeNull();
  });

  it('drops a fetched listing that was unsaved again while the request was in flight', async () => {
    render(<MemoryRouter initialEntries={['/saved']}><Saved /></MemoryRouter>);
    await screen.findByText('Sunny 1BR');
    hold = true;
    otherTab('nd_saved_listings', ['a', 'b', 'c']);
    // A second event for the same pending id must not issue a duplicate request.
    otherTab('nd_saved_rent_snapshots', { a: 1800, b: 1500 });
    expect(calls).toEqual([['a', 'b'], ['c']]);
    otherTab('nd_saved_listings', ['a', 'b']);
    await act(async () => { parked.forEach((r) => r()); });
    expect(screen.queryByText('Big 2BR')).toBeNull();
    expect(titles()).toEqual(['Quiet studio', 'Sunny 1BR']);
  });

  it('shows a price badge when another tab changes the baseline, and ignores unrelated keys', async () => {
    render(<MemoryRouter initialEntries={['/saved']}><Saved /></MemoryRouter>);
    await screen.findByText('Sunny 1BR');
    expect(screen.queryByText(/since saved/)).toBeNull();
    otherTab('theme', 'dark');
    expect(calls).toHaveLength(1);
    otherTab('nd_saved_rent_snapshots', { a: 2000, b: 1500 });
    const row = screen.getByText('Sunny 1BR').closest('li')!;
    expect(within(row).getByText(/↓ \$200 \(-10%\) since saved/)).toBeInTheDocument();
  });

  it('leaves a shared list alone when the viewer saves elsewhere', async () => {
    render(<MemoryRouter initialEntries={['/saved?ids=a']}><Saved /></MemoryRouter>);
    await screen.findByText('Sunny 1BR');
    otherTab('nd_saved_listings', ['a', 'b', 'c']);
    expect(titles()).toEqual(['Sunny 1BR']);
    expect(calls).toEqual([['a']]);
  });
});
