import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDistanceToNow } from "date-fns";

export default function Home({ username }: { username: string }) {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const location = useLocation();
  const isNewRoute = location.pathname === '/new';

  useEffect(() => {
    setPage(0);
    setListings([]);
    setHasMore(false);
  }, [isNewRoute]);

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      let query = supabase.from("listings").select("*");
      
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
  }, [isNewRoute, page]);

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

  return (
    <div className="flex flex-col gap-2">
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
              </div>
            </div>
          </li>
        ))}
      </ol>
      {listings.length === 0 && (
        <div className="pl-6 text-[#828282]">No listings found. Be the first to submit one!</div>
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
