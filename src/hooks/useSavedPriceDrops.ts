import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { SAVED_CHANGED_EVENT, SAVED_STORAGE_KEYS, countPriceDrops, getSavedIds } from "../utils/saved";

type PriceRow = { id: string; rent?: number | string | null; budget?: number | string | null };

// Realtime rejects `in` filters longer than this; past it we listen to every
// listing update and drop the ones that aren't saved.
export const REALTIME_IN_FILTER_LIMIT = 100;

// The latest rent the app has observed for a saved listing. `seq` orders
// observations across the hook and the Saved page's own fetch: a fetched row
// takes the seq of the moment its request was issued (the read can't be newer
// than that), a pushed row the seq of the moment it arrived.
export type LiveRent = { rent?: number | string | null; budget?: number | string | null; seq: number };

export type SavedRents = {
  drops: number;
  rents: ReadonlyMap<string, LiveRent>;
};

let rentSeq = 0;
// Call when issuing a read of listing rents. Rents in the hook with a higher
// seq were observed after that read started, so they're at least as fresh.
export function nextRentSeq(): number {
  return ++rentSeq;
}

// Latest known rents of the saved listings, plus the number whose rent dropped
// since it was saved and hasn't been acknowledged with [ok] on the Saved page.
// Mount it once (SavedRentsProvider) and read it with useSavedRents(), so the
// nav badge and the Saved page share one fetch and one Realtime channel.
//
// Rents are fetched on load, when a listing not yet fetched is saved, and when
// the tab becomes visible again. Between fetches, a Realtime subscription to
// UPDATEs on the saved listings applies a landlord's price change as it
// happens, so the badge doesn't wait for a re-focus. Saving, unsaving, [ok] and
// snapshot backfills all fire SAVED_CHANGED_EVENT; when the rows already in
// memory cover every saved id the count is recomputed without a request.
export function useSavedRentsState(): SavedRents {
  const [state, setState] = useState<SavedRents>({ drops: 0, rents: new Map() });
  const rows = useRef<(PriceRow & { seq: number })[]>([]);
  const fetchedKey = useRef<string | null>(null);
  const requestId = useRef(0);
  // Updates pushed while a fetch is in flight; the fetch may have read the row
  // before the update committed, so these are re-applied over its result.
  const pushedDuringFetch = useRef(new Map<string, PriceRow & { seq: number }>());
  const channel = useRef<RealtimeChannel | null>(null);
  const subscribedIds = useRef(new Set<string>());
  const channelSeq = useRef(0);

  useEffect(() => {
    const recount = () => {
      const saved = new Set(getSavedIds());
      const current = rows.current.filter((r) => saved.has(r.id));
      setState({
        drops: countPriceDrops(current),
        rents: new Map(current.map((r) => [r.id, { rent: r.rent, budget: r.budget, seq: r.seq }])),
      });
    };

    const fetchRents = async (ids: string[], key: string) => {
      fetchedKey.current = key;
      const request = ++requestId.current;
      pushedDuringFetch.current.clear();
      if (ids.length === 0) {
        rows.current = [];
        recount();
        return;
      }
      const seq = nextRentSeq();
      const { data, error } = await supabase.from("listings").select("id, rent, budget").in("id", ids);
      // A newer fetch started while this one was in flight; let it win.
      if (request !== requestId.current) return;
      if (error) {
        fetchedKey.current = null;
        return;
      }
      const pushed = pushedDuringFetch.current;
      rows.current = (data || []).map((r: PriceRow) => ({ ...r, seq, ...pushed.get(r.id) }));
      recount();
    };

    const onRentUpdate = (row: PriceRow) => {
      if (!getSavedIds().includes(row.id)) return;
      const patch = { id: row.id, rent: row.rent, budget: row.budget, seq: nextRentSeq() };
      pushedDuringFetch.current.set(row.id, patch);
      let found = false;
      rows.current = rows.current.map((r) => {
        if (r.id !== row.id) return r;
        found = true;
        return { ...r, ...patch };
      });
      // Not fetched yet: the pending fetch picks the patch up when it lands.
      if (found) recount();
    };

    const unsubscribe = () => {
      if (channel.current) supabase.removeChannel(channel.current);
      channel.current = null;
      subscribedIds.current = new Set();
    };

    // Like fetching, unsaving never resubscribes: extra ids on the channel are
    // ignored by onRentUpdate. Only a newly saved id needs a new filter.
    const subscribe = (ids: string[]) => {
      if (ids.length === 0) return unsubscribe();
      if (ids.every((id) => subscribedIds.current.has(id))) return;
      unsubscribe();
      const filter = ids.length <= REALTIME_IN_FILTER_LIMIT ? `id=in.(${ids.join(",")})` : undefined;
      channel.current = supabase
        .channel(`saved_rents_${++channelSeq.current}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "listings", ...(filter && { filter }) },
          (payload: { new: PriceRow }) => onRentUpdate(payload.new),
        )
        .subscribe();
      subscribedIds.current = new Set(ids);
    };

    const sync = (force = false) => {
      const ids = getSavedIds();
      const key = [...ids].sort().join(",");
      // Unsaving only shrinks the set, so the rows in memory still cover it.
      const known = new Set(rows.current.map((r) => r.id));
      const covered = fetchedKey.current !== null && ids.every((id) => known.has(id));
      if (force || (key !== fetchedKey.current && !covered)) fetchRents(ids, key);
      else recount();
      subscribe(ids);
    };

    const onChanged = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || SAVED_STORAGE_KEYS.includes(e.key)) sync();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") sync(true);
    };

    sync(true);
    window.addEventListener(SAVED_CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      requestId.current++;
      unsubscribe();
      window.removeEventListener(SAVED_CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return state;
}
