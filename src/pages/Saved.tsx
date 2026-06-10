import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { getSavedIds, toggleSaved } from "../utils/saved";

export default function Saved() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = getSavedIds();
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
        if (!error) setListings(data || []);
        setLoading(false);
      });
  }, []);

  const handleUnsave = (id: string) => {
    toggleSaved(id);
    setListings((prev) => prev.filter((l) => l.id !== id));
  };

  if (loading) {
    return <div className="text-[#828282] text-[10pt] p-2">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10pt] text-[#828282] mb-2 border-b border-[#e8e8e8] pb-1">
        saved listings —{" "}
        <span className="text-black font-medium">{listings.length}</span>{" "}
        {listings.length === 1 ? "listing" : "listings"}
      </div>

      {listings.length === 0 && (
        <div className="pl-2 text-[#828282]">
          No saved listings yet. Click ☆ on any listing to save it here.
        </div>
      )}

      <ol className="list-decimal pl-6 text-[#828282] m-0">
        {listings.map((listing) => (
          <li key={listing.id} className="mb-1 text-[10pt] marker:text-[#828282]">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <button
                  onClick={() => handleUnsave(listing.id)}
                  className="text-[#ff6600] hover:text-[#828282] mr-1 text-[9pt]"
                  title="Remove from saved"
                >
                  ★
                </button>
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
              </div>
              <div className="text-[8pt] text-[#828282]">
                {listing.points} points by {listing.username} ·{" "}
                {formatDistanceToNow(new Date(listing.created_at))} ago
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
