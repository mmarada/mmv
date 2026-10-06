const SAVED_KEY = "nd_saved_listings";
// Rent observed at save time, keyed by listing id. Kept separate from the id
// array so existing saved lists (and the push-order "recently saved" sort)
// keep working unchanged.
const SNAPSHOT_KEY = "nd_saved_rent_snapshots";

// Fired on window whenever the saved ids or rent snapshots change in this tab,
// so the nav badge can recount without polling. Other tabs get the native
// "storage" event for the same keys.
export const SAVED_CHANGED_EVENT = "nd:saved-changed";
export const SAVED_STORAGE_KEYS = [SAVED_KEY, SNAPSHOT_KEY];

type Snapshots = Record<string, number>;

export type PriceChange = {
  from: number;
  to: number;
  delta: number; // to - from; negative means the rent dropped
  pct: number;
};

export function getSavedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
}

function getSnapshots(): Snapshots {
  try {
    const parsed = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function notifyChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SAVED_CHANGED_EVENT));
}

function setSnapshots(snapshots: Snapshots) {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
  notifyChanged();
}

type Priced = { rent?: number | string | null; budget?: number | string | null };

// Listings carry either a rent (offering a place) or a budget (looking for one).
// Both are NUMERIC columns, which can come back from PostgREST as strings.
export function listingPrice(listing: Priced): number | null {
  const price = Number(listing.rent ?? listing.budget);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function toggleSaved(id: string, price?: number | null): boolean {
  const saved = getSavedIds();
  const snapshots = getSnapshots();
  const idx = saved.indexOf(id);
  if (idx === -1) {
    saved.push(id);
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    if (price != null) {
      snapshots[id] = price;
      setSnapshots(snapshots);
    } else {
      notifyChanged();
    }
    return true;
  }
  saved.splice(idx, 1);
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  if (id in snapshots) {
    delete snapshots[id];
    setSnapshots(snapshots);
  } else {
    notifyChanged();
  }
  return false;
}

// Lists saved before snapshots existed have no baseline. The first time the
// Saved page sees one of those listings, its current rent becomes the
// baseline, so changes are tracked from then on instead of never.
export function backfillSnapshots(listings: (Priced & { id: string })[]) {
  const saved = new Set(getSavedIds());
  const snapshots = getSnapshots();
  let changed = false;
  for (const listing of listings) {
    const price = listingPrice(listing);
    if (saved.has(listing.id) && !(listing.id in snapshots) && price != null) {
      snapshots[listing.id] = price;
      changed = true;
    }
  }
  if (changed) setSnapshots(snapshots);
}

export function getPriceChange(id: string, currentPrice: number | null): PriceChange | null {
  const from = getSnapshots()[id];
  if (from == null || currentPrice == null || from === currentPrice) return null;
  const delta = currentPrice - from;
  return { from, to: currentPrice, delta, pct: (delta / from) * 100 };
}

// "Got it" on a price change: the current rent becomes the new baseline.
export function acknowledgePriceChange(id: string, currentPrice: number) {
  if (!getSavedIds().includes(id)) return;
  const snapshots = getSnapshots();
  snapshots[id] = currentPrice;
  setSnapshots(snapshots);
}

// Saved listings whose rent is below the save-time (or last acknowledged)
// baseline. Legacy saves without a baseline don't count, matching the Saved
// page, which only shows a badge once a baseline exists.
export function countPriceDrops(listings: (Priced & { id: string })[]): number {
  return listings.filter((l) => {
    const change = getPriceChange(l.id, listingPrice(l));
    return change != null && change.delta < 0;
  }).length;
}
