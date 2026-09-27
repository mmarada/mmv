import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Saved from '../pages/Saved';

const rows = [
  { id: 'a', title: 'Sunny 1BR', rent: 1800, neighborhood: 'Fremont', points: 3, username: 'x', created_at: '2026-09-01T00:00:00Z' },
  { id: 'b', title: 'Quiet studio', rent: 1500, neighborhood: 'Ballard', points: 1, username: 'y', created_at: '2026-09-02T00:00:00Z' },
  { id: 'c', title: 'Big 2BR', rent: 2600, neighborhood: 'Capitol Hill', points: 5, username: 'z', created_at: '2026-09-03T00:00:00Z' },
];

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }),
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

describe('Saved page price changes', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    // a dropped $200 since save, b rose $100, c is a legacy save with no baseline.
    localStorage.setItem('nd_saved_listings', JSON.stringify(['a', 'b', 'c']));
    localStorage.setItem('nd_saved_rent_snapshots', JSON.stringify({ a: 2000, b: 1400 }));
  });

  it('flags drops and increases, counts drops, and backfills legacy saves', async () => {
    render(<MemoryRouter initialEntries={['/saved']}><Saved /></MemoryRouter>);

    expect(await screen.findByText(/1 price drop since you saved/)).toBeInTheDocument();
    const drop = screen.getByText('Sunny 1BR').closest('li')!;
    expect(within(drop).getByText(/↓ \$200 \(-10%\) since saved/)).toBeInTheDocument();
    const rise = screen.getByText('Quiet studio').closest('li')!;
    expect(within(rise).getByText(/↑ \$100 \(\+7%\) since saved/)).toBeInTheDocument();
    const legacy = screen.getByText('Big 2BR').closest('li')!;
    expect(within(legacy).queryByText(/since saved/)).toBeNull();
    expect(JSON.parse(localStorage.getItem('nd_saved_rent_snapshots')!).c).toBe(2600);
  });

  it('sorts biggest drop first and clears a badge on [ok]', async () => {
    render(<MemoryRouter initialEntries={['/saved']}><Saved /></MemoryRouter>);
    await screen.findByText('Sunny 1BR');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'price_change' } });
    const titles = screen.getAllByRole('listitem').map((li) => li.querySelector('a')!.textContent);
    expect(titles).toEqual(['Sunny 1BR', 'Big 2BR', 'Quiet studio']);

    const drop = screen.getByText('Sunny 1BR').closest('li')!;
    fireEvent.click(within(drop).getByText('[ok]'));
    expect(within(drop).queryByText(/since saved/)).toBeNull();
    expect(screen.queryByText(/since you saved/)).toBeNull();
  });

  it('hides price tracking on a shared list', async () => {
    render(<MemoryRouter initialEntries={['/saved?ids=a,b']}><Saved /></MemoryRouter>);
    await screen.findByText('Sunny 1BR');
    expect(screen.queryByText(/since saved/)).toBeNull();
    expect(screen.queryByRole('option', { name: /biggest price drop/ })).toBeNull();
  });
});
