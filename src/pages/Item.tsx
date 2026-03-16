import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Item() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListing = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) {
        console.error("Error fetching listing:", error);
      } else {
        setListing(data);
      }
      setLoading(false);
    };

    fetchListing();
  }, [id]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (!listing) return <div className="p-4">Listing not found.</div>;

  return (
    <div className="p-4 bg-[#f6f6ef] min-h-[calc(100vh-30px)]">
      <div className="bg-white p-6 border border-[#828282] max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 text-black">{listing.title}</h1>
        <div className="text-[10pt] text-[#828282] mb-6">
          {listing.points} points by {listing.username} | {new Date(listing.created_at).toLocaleString()}
        </div>
        
        {listing.url && (
          <div className="mb-6">
            <a href={listing.url} className="text-blue-600 hover:underline break-all" target="_blank" rel="noopener noreferrer">
              {listing.url}
            </a>
          </div>
        )}
        
        <div className="mb-6">
          <h2 className="font-bold text-[#828282] mb-1">Description</h2>
          <p className="text-[10pt] text-black whitespace-pre-wrap">{listing.description || "No description provided."}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-[10pt] border-t border-[#828282] pt-4">
          <div>
            <span className="font-bold text-[#828282]">Price:</span> ${listing.rent || listing.budget}/mo
          </div>
          <div>
            <span className="font-bold text-[#828282]">Neighborhood:</span> {listing.neighborhood}
          </div>
          <div>
            <span className="font-bold text-[#828282]">Type:</span> {listing.type}
          </div>
          <div>
            <span className="font-bold text-[#828282]">Role:</span> {listing.role}
          </div>
        </div>
        
        <div className="mt-8">
          <Link to="/" className="text-[#828282] hover:underline">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
