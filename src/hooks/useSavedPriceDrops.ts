import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { SAVED_CHANGED_EVENT, SAVED_STORAGE_KEYS, countPriceDrops, getSavedIds } from "../utils/saved";

type PriceRow = { id: string; rent?: number | string | null; budget?: number | string | null };

// Number of saved listings whose rent dropped since it was saved and hasn't
// been acknowledged with [ok] on the Saved page.
//
// Rents are fetched on load, when a listing not yet fetched is saved, and when
// the tab becomes visible again (rents change server-side). Saving, unsaving, [ok] and
// snapshot backfills all fire SAVED_CHANGED_EVENT; when the rows already in
// memory cover every saved id the count is recomputed without a request.
export function useSavedPriceDrops(): number {
  const [count, setCount] = useState(0);
  const rows = useRef<PriceRow[]>([]);
  const fetchedKey = useRef<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const recount = () => {
      const saved = new Set(getSavedIds());
      setCount(countPriceDrops(rows.current.filter((r) => saved.has(r.id))));
    };

    const fetchRents = async (ids: string[], key: string) => {
      fetchedKey.current = key;
      const request = ++requestId.current;
      if (ids.length === 0) {
        rows.current = [];
        setCount(0);
        return;
      }
      const { data, error } = await supabase.from("listings").select("id, rent, budget").in("id", ids);
      // A newer fetch started while this one was in flight; let it win.
      if (request !== requestId.current) return;
      if (error) {
        fetchedKey.current = null;
        return;
      }
      rows.current = data || [];
      recount();
    };

    const sync = (force = false) => {
      const ids = getSavedIds();
      const key = [...ids].sort().join(",");
      // Unsaving only shrinks the set, so the rows in memory still cover it.
      const known = new Set(rows.current.map((r) => r.id));
      const covered = fetchedKey.current !== null && ids.every((id) => known.has(id));
      if (force || (key !== fetchedKey.current && !covered)) fetchRents(ids, key);
      else recount();
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
      window.removeEventListener(SAVED_CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return count;
}
