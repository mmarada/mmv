import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acknowledgePriceChange,
  backfillSnapshots,
  getPriceChange,
  getSavedIds,
  listingPrice,
  toggleSaved,
} from '../utils/saved';

// Newer Node versions shadow jsdom's localStorage with their own global, which
// is undefined without --localstorage-file, so give each test a fresh store.
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

describe('saved listing price tracking', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));

  it('reads rent, falls back to budget, and rejects missing or zero prices', () => {
    expect(listingPrice({ rent: 2000, budget: 1500 })).toBe(2000);
    expect(listingPrice({ rent: null, budget: 1500 })).toBe(1500);
    expect(listingPrice({ rent: '1850' })).toBe(1850);
    expect(listingPrice({ rent: 0 })).toBeNull();
    expect(listingPrice({})).toBeNull();
  });

  it('reports a drop against the rent seen at save time', () => {
    toggleSaved('a', 2000);
    expect(getPriceChange('a', 2000)).toBeNull();
    expect(getPriceChange('a', 1800)).toEqual({ from: 2000, to: 1800, delta: -200, pct: -10 });
    expect(getPriceChange('a', 2100)?.delta).toBe(100);
  });

  it('drops the snapshot on unsave so a re-save starts a fresh baseline', () => {
    toggleSaved('a', 2000);
    toggleSaved('a');
    expect(getSavedIds()).toEqual([]);
    expect(getPriceChange('a', 1500)).toBeNull();
    toggleSaved('a', 1500);
    expect(getPriceChange('a', 1500)).toBeNull();
  });

  it('keeps the legacy id array format so existing saved lists still load', () => {
    localStorage.setItem('nd_saved_listings', JSON.stringify(['old']));
    toggleSaved('new', 900);
    expect(getSavedIds()).toEqual(['old', 'new']);
  });

  it('backfills a baseline for listings saved before snapshots existed', () => {
    localStorage.setItem('nd_saved_listings', JSON.stringify(['old']));
    toggleSaved('tracked', 3000);
    backfillSnapshots([
      { id: 'old', rent: 1200 },
      { id: 'tracked', rent: 2500 },
      { id: 'not-saved', rent: 999 },
    ]);
    // Legacy entry gets today's rent as its baseline, so no change yet...
    expect(getPriceChange('old', 1200)).toBeNull();
    expect(getPriceChange('old', 1100)?.delta).toBe(-100);
    // ...but an existing baseline is never overwritten by a backfill.
    expect(getPriceChange('tracked', 2500)?.delta).toBe(-500);
    // And listings the viewer never saved don't get tracked.
    expect(getPriceChange('not-saved', 1)).toBeNull();
  });

  it('acknowledging a change moves the baseline to the current rent', () => {
    toggleSaved('a', 2000);
    acknowledgePriceChange('a', 1800);
    expect(getPriceChange('a', 1800)).toBeNull();
    expect(getPriceChange('a', 1700)?.delta).toBe(-100);
  });

  it('ignores acknowledgements for listings that are not saved', () => {
    acknowledgePriceChange('ghost', 1000);
    toggleSaved('ghost');
    expect(getPriceChange('ghost', 900)).toBeNull();
  });

  it('survives a corrupted snapshot store', () => {
    localStorage.setItem('nd_saved_rent_snapshots', '[1,2');
    expect(getPriceChange('a', 100)).toBeNull();
    expect(toggleSaved('a', 100)).toBe(true);
    expect(getPriceChange('a', 80)?.delta).toBe(-20);
  });
});
