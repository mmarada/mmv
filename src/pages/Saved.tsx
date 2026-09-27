import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDistanceToNow } from "date-fns";
import {
  acknowledgePriceChange,
  backfillSnapshots,
  getPriceChange,
  getSavedIds,
  listingPrice,
  toggleSaved,
  type PriceChange,
} from "../utils/saved";

type SortOrder = "saved" | "rent_asc" | "rent_desc" | "price_change";

export default function Saved() {
  const [searchParams] = useSearchParams();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [imported, setImported] = useState(false);
  const [sort, setSort] = useState<SortOrder>("saved");
  // Snapshots live in localStorage, so bump this to re-render after one changes.
  const [, setSnapshotVersion] = useState(0);

  const sharedIds = searchParams.get("ids")?.split(",").filter(Boolean) || [];
  const isSharedView = sharedIds.length > 0;

  useEffect(() => {
    const ids = isSharedView ? sharedIds : getSavedIds();
    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    supabase
      .from("listings")
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) {
          if (!isSharedView) backfillSnapshots(data || []);
          setListings(data || []);
        }
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleUnsave = (id: string) => {
    toggleSaved(id);
    setListings((prev) => prev.filter((l) => l.id !== id));
  };

  const handleShare = async () => {
    const ids = getSavedIds();
    const url = `${window.location.origin}/saved?ids=${ids.join(",")}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImportAll = () => {
    const existing = getSavedIds();
    sharedIds.forEach((id) => {
      if (existing.includes(id)) return;
      const listing = listings.find((l) => l.id === id);
      toggleSaved(id, listing ? listingPrice(listing) : null);
    });
    setImported(true);
  };

  const handleAcknowledge = (id: string, price: number) => {
    acknowledgePriceChange(id, price);
    setSnapshotVersion((v) => v + 1);
  };

  if (loading) {
    return <div className="text-[#828282] text-[10pt] p-2">Loading...</div>;
  }

  // "saved" order ranks by position in the id list (localStorage push order for
  // the viewer's own list, URL order for a shared list) so the most recently
  // saved listing shows first without needing a stored timestamp.
  const orderIds = isSharedView ? sharedIds : getSavedIds();
  const orderIndex = new Map(orderIds.map((id, i) => [id, i]));
  // Price changes are measured against the viewer's own save-time snapshot, so
  // they only make sense on the viewer's own list, not someone else's share.
  const changes = new Map<string, PriceChange | null>(
    isSharedView ? [] : listings.map((l) => [l.id, getPriceChange(l.id, listingPrice(l))]),
  );
  const dropCount = [...changes.values()].filter((c) => c && c.delta < 0).length;
  const sortedListings = [...listings].sort((a, b) => {
    if (sort === "price_change") {
      // Biggest drop first, then unchanged, then increases.
      const diff = (changes.get(a.id)?.delta ?? 0) - (changes.get(b.id)?.delta ?? 0);
      if (diff !== 0) return diff;
    }
    if (sort === "rent_asc") return (a.rent ?? a.budget ?? 0) - (b.rent ?? b.budget ?? 0);
    if (sort === "rent_desc") return (b.rent ?? b.budget ?? 0) - (a.rent ?? a.budget ?? 0);
    return (orderIndex.get(b.id) ?? 0) - (orderIndex.get(a.id) ?? 0);
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10pt] text-[#828282] mb-2 border-b border-[#e8e8e8] pb-1 flex items-center justify-between flex-wrap gap-1">
        <span>
          {isSharedView ? "shared listings" : "saved listings"} —{" "}
          <span className="text-black font-medium">{listings.length}</span>{" "}
          {listings.length === 1 ? "listing" : "listings"}
          {dropCount > 0 && (
            <span className="ml-2 text-[#2e7d32] text-[9pt]">
              · {dropCount} price {dropCount === 1 ? "drop" : "drops"} since you saved
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {listings.length > 1 && (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOrder)}
              className="border border-[#c8c8c8] px-1 py-0.5 text-[9pt]"
            >
              <option value="saved">sort: {isSharedView ? "list order" : "recently saved"}</option>
              <option value="rent_asc">sort: rent ↑</option>
              <option value="rent_desc">sort: rent ↓</option>
              {!isSharedView && <option value="price_change">sort: biggest price drop</option>}
            </select>
          )}
          {isSharedView ? (
            listings.length > 0 && (
              <button
                onClick={handleImportAll}
                disabled={imported}
                className="text-[#ff6600] hover:underline text-[9pt] disabled:text-[#c8c8c8] disabled:no-underline cursor-pointer disabled:cursor-default"
              >
                {imported ? "added to my list ✓" : "+ add all to my list"}
              </button>
            )
          ) : (
            listings.length > 0 && (
              <button onClick={handleShare} className="text-[#ff6600] hover:underline text-[9pt] cursor-pointer">
                {copied ? "copied!" : "share this list"}
              </button>
            )
          )}
        </div>
      </div>

      {isSharedView && (
        <div className="pl-2 text-[8pt] text-[#828282] -mt-1 mb-1">
          Someone shared this list with you — it's read-only until you add it to your own.
        </div>
      )}

      {listings.length === 0 && !isSharedView && (
        <div className="pl-2 text-[#828282]">
          No saved listings yet. Click ☆ on any listing to save it here.
        </div>
      )}

      <ol className="list-decimal pl-6 text-[#828282] m-0">
        {sortedListings.map((listing) => {
          const change = changes.get(listing.id);
          return (
            <li key={listing.id} className="mb-1 text-[10pt] marker:text-[#828282]">
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1">
                  {!isSharedView && (
                    <button
                      onClick={() => handleUnsave(listing.id)}
                      className="text-[#ff6600] hover:text-[#828282] mr-1 text-[9pt]"
                      title="Remove from saved"
                    >
                      ★
                    </button>
                  )}
                  <Link
                    to={`/item?id=${listing.id}`}
                    className="text-black hover:underline"
                  >
                    {listing.title}
                  </Link>
                  {listing.url && (
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#828282] text-[8pt] hover:underline"
                    >
                      ({listing.domain || "link"})
                    </a>
                  )}
                  <span className="text-[#ff6600] text-[8pt] font-bold ml-1">
                    ${listing.rent || listing.budget}/mo
                  </span>
                  <span className="text-[#828282] text-[8pt] ml-1">
                    in {listing.neighborhood}
                  </span>
                  {change && (
                    <span
                      className={`text-[8pt] ml-1 ${change.delta < 0 ? "text-[#2e7d32]" : "text-[#c62828]"}`}
                      title={`$${change.from}/mo when you saved it`}
                    >
                      {change.delta < 0 ? "↓" : "↑"} ${Math.abs(change.delta)} ({change.delta < 0 ? "" : "+"}
                      {change.pct.toFixed(0)}%) since saved
                      <button
                        onClick={() => handleAcknowledge(listing.id, change.to)}
                        className="text-[#828282] hover:underline ml-1 cursor-pointer"
                        title="Use the current rent as the new baseline"
                      >
                        [ok]
                      </button>
                    </span>
                  )}
                </div>
                <div className="text-[8pt] text-[#828282]">
                  {listing.points} points by {listing.username} ·{" "}
                  {formatDistanceToNow(new Date(listing.created_at))} ago
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
