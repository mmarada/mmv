import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDistanceToNow } from "date-fns";

export default function Home({ username }: { username: string }) {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const isNewRoute = location.pathname === '/new';

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      let query = supabase.from("listings").select("*");
      
      if (isNewRoute) {
        query = query.order("created_at", { ascending: false });
      } else {
        query = query.order("points", { ascending: false }).order("created_at", { ascending: false });
      }

      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching listings:", error);
      } else {
        setListings(data || []);
      }
      setLoading(false);
    };

    fetchListings();
  }, [isNewRoute]);

  if (loading) {
    return <div className="p-4 text-[#828282]">Loading listings...</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      <ol className="list-decimal pl-6 text-[#828282] m-0">
        {listings.map((listing) => (
          <li key={listing.id} className="mb-1 text-[10pt] marker:text-[#828282]">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <a
                  href={listing.url || "#"}
                  className="text-black hover:underline"
                >
                  {listing.title}
                </a>
                {listing.domain && (
                  <span className="text-[#828282] text-[8pt]">
                    (<a href={`#`} className="hover:underline">{listing.domain}</a>)
                  </span>
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
      <div className="mt-4 pl-6">
        <Link to="/new" className="text-[#828282] hover:underline text-[10pt]">
          More
        </Link>
      </div>
    </div>
  );
}
