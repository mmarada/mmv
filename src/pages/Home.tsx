import React, { useState, useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { getSavedIds, toggleSaved } from "../utils/saved";

type Filters = {
  keyword: string;
  neighborhood: string;
  minRent: string;
  maxRent: string;
  type: string;
};

const EMPTY_FILTERS: Filters = { keyword: "", neighborhood: "", minRent: "", maxRent: "", type: "" };

function filtersFromParams(params: URLSearchParams): Filters {
  return {
    keyword: params.get("q") || "",
    neighborhood: params.get("neighborhood") || "",
    minRent: params.get("minRent") || "",
    maxRent: params.get("maxRent") || "",
    type: params.get("type") || "",
  };
}

function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.keyword) p.set("q", f.keyword);
  if (f.neighborhood) p.set("neighborhood", f.neighborhood);
  if (f.minRent) p.set("minRent", f.minRent);
  if (f.maxRent) p.set("maxRent", f.maxRent);
  if (f.type) p.set("type", f.type);
  return p;
}

export default function Home({ username }: { username: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>(() => getSavedIds());
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(searchParams));
  const [activeFilters, setActiveFilters] = useState<Filters>(() => filtersFromParams(searchParams));
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const location = useLocation();
  const isNewRoute = location.pathname === '/new';

  useEffect(() => {
    setPage(0);
    setListings([]);
    setHasMore(false);
  }, [isNewRoute]);

  useEffect(() => {
    supabase
      .from("listings")
      .select("neighborhood")
      .not("neighborhood", "is", null)
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((r: any) => (r.neighborhood as string).trim()).filter(Boolean))].sort() as string[];
          setNeighborhoods(unique);
        }
      });
  }, []);

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      let query = supabase.from("listings").select("*");

      if (activeFilters.keyword) {
        query = query.ilike("title", `%${activeFilters.keyword}%`);
      }
      if (activeFilters.neighborhood) {
        query = query.eq("neighborhood", activeFilters.neighborhood);
      }
      if (activeFilters.type) {
        query = query.eq("type", activeFilters.type);
      }
      if (activeFilters.minRent) {
        query = query.gte("rent", Number(activeFilters.minRent));
      }
      if (activeFilters.maxRent) {
        query = query.lte("rent", Number(activeFilters.maxRent));
      }

      if (isNewRoute) {
        query = query.order("created_at", { ascending: false });
      } else {
        query = query.order("points", { ascending: false }).order("created_at", { ascending: false });
      }

      query = query.range(page * 12, (page + 1) * 12);

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching listings:", error);
      } else {
        const fetchedListings = data || [];
        setHasMore(fetchedListings.length > 12);
        setListings(fetchedListings.slice(0, 12));
      }
      setLoading(false);
    };

    fetchListings();
  }, [isNewRoute, page, activeFilters]);

  const handleUpvote = async (listingId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existingVote } = await supabase
      .from("upvotes")
      .select("*")
      .eq("user_id", user.id)
      .eq("listing_id", listingId)
      .single();

    if (existingVote) return;

    await supabase.from("upvotes").insert({ user_id: user.id, listing_id: listingId });
    await supabase.rpc("increment_points", { listing_id: listingId });
    setListings(prev => prev.map(l => l.id === listingId ? { ...l, points: l.points + 1 } : l));
  };

  const handleToggleSave = (listingId: string) => {
    toggleSaved(listingId);
    setSavedIds(getSavedIds());
  };

  const applyFilters = () => {
    setPage(0);
    setListings([]);
    setActiveFilters({ ...filters });
    setSearchParams(filtersToParams(filters), { replace: true });
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(0);
    setListings([]);
    setActiveFilters(EMPTY_FILTERS);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const hasActiveFilters = Object.values(activeFilters).some(Boolean);

  return (
    <div className="flex flex-col gap-2">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-1 pl-1 py-1 border-b border-[#e8e8e8] text-[9pt] text-[#828282]">
        <input
          type="text"
          placeholder="search title…"
          value={filters.keyword}
          onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          className="border border-[#c8c8c8] px-1 py-0.5 text-[9pt] w-36"
        />
        <select
          value={filters.neighborhood}
          onChange={(e) => setFilters((f) => ({ ...f, neighborhood: e.target.value }))}
          className="border border-[#c8c8c8] px-1 py-0.5 text-[9pt]"
        >
          <option value="">any neighborhood</option>
          {neighborhoods.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          className="border border-[#c8c8c8] px-1 py-0.5 text-[9pt]"
        >
          <option value="">any type</option>
          <option value="property">property</option>
          <option value="requirement">requirement</option>
        </select>
        <span className="text-[#c8c8c8]">$</span>
        <input
          type="number"
          placeholder="min rent"
          value={filters.minRent}
          onChange={(e) => setFilters((f) => ({ ...f, minRent: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          className="border border-[#c8c8c8] px-1 py-0.5 text-[9pt] w-20"
        />
        <span className="text-[#c8c8c8]">–</span>
        <input
          type="number"
          placeholder="max rent"
          value={filters.maxRent}
          onChange={(e) => setFilters((f) => ({ ...f, maxRent: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          className="border border-[#c8c8c8] px-1 py-0.5 text-[9pt] w-20"
        />
        <button
          onClick={applyFilters}
          className="border border-[#828282] bg-[#d4d4d4] px-2 py-0.5 text-[9pt] text-black hover:bg-[#c4c4c4] cursor-pointer"
        >
          filter
        </button>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-[#ff6600] hover:underline text-[9pt] cursor-pointer">
            clear
          </button>
        )}
      </div>

      <ol className="list-decimal pl-6 text-[#828282] m-0" start={page * 12 + 1}>
        {listings.map((listing) => (
          <li key={listing.id} className="mb-1 text-[10pt] marker:text-[#828282]">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <button onClick={() => handleUpvote(listing.id)} className="text-[#828282] hover:text-black mr-1">▲</button>
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
                    ({listing.domain || 'link'})
                  </a>
                )}
                <span className="text-[#ff6600] text-[8pt] font-bold ml-1">
                  ${listing.rent || listing.budget}/mo
                </span>
                <span className="text-[#828282] text-[8pt] ml-1">
                  in {listing.neighborhood}
                </span>
              </div>
              <div className="text-[8pt] text-[#828282] flex items-center flex-wrap gap-1">
                {listing.points} points by{" "}
                <Link to={`/user?id=${listing.username}`} className="hover:underline text-[#333] font-medium">
                  {listing.username}
                </Link>
                {listing.role && (
                  <span className="px-1 border border-[#a5a5a5] text-[#a5a5a5] text-[6pt] uppercase rounded-[2px] leading-none py-[1px]">
                    {listing.role}
                  </span>
                )}
                {" "}{formatDistanceToNow(new Date(listing.created_at))} ago |{" "}
                <Link to={`/item?id=${listing.id}`} className="hover:underline">
                  {listing.comments_count} comments
                </Link>
                {listing.username !== username && (
                  <>
                    {" | "}
                    <Link to={`/chat?with=${listing.username}&listing=${listing.id}`} className="hover:underline text-[#ff6600]">
                      chat
                    </Link>
                  </>
                )}
                {" | "}
                <button
                  onClick={() => handleToggleSave(listing.id)}
                  className={`hover:underline ${savedIds.includes(listing.id) ? "text-[#ff6600]" : "text-[#828282]"}`}
                  title={savedIds.includes(listing.id) ? "Remove from saved" : "Save listing"}
                >
                  {savedIds.includes(listing.id) ? "★ saved" : "☆ save"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {listings.length === 0 && !loading && (
        <div className="pl-6 text-[#828282]">
          {hasActiveFilters ? "No listings match those filters." : "No listings found. Be the first to submit one!"}
        </div>
      )}
      {hasMore && (
        <div className="mt-4 pl-6 flex gap-4">
          <button
            onClick={() => setPage(p => p + 1)}
            className="text-[#828282] hover:underline text-[10pt]"
          >
            More
          </button>
        </div>
      )}
    </div>
  );
}
