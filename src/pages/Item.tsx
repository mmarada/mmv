import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Item() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyStatus, setApplyStatus] = useState<"idle" | "success" | "duplicate">("idle");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUsername(user.user_metadata.username || user.email?.split("@")[0] || "");
      }
    });
  }, []);

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

  const handleApply = async () => {
    if (!listing || !currentUsername) return;
    setApplying(true);

    // Check for duplicate
    const { data: existing } = await supabase
      .from("applications")
      .select("id")
      .eq("listing_id", listing.id)
      .eq("applicant_username", currentUsername)
      .maybeSingle();

    if (existing) {
      setApplyStatus("duplicate");
      setApplying(false);
      return;
    }

    const { error } = await supabase.from("applications").insert({
      listing_id: listing.id,
      listing_title: listing.title,
      applicant_username: currentUsername,
      landlord_username: listing.username,
      message: applyMessage.trim() || null,
    });

    if (!error) {
      setApplyStatus("success");
      setApplyMessage("");
    }
    setApplying(false);
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!listing) return <div className="p-4">Listing not found.</div>;

  const canApply =
    currentUsername &&
    currentUsername !== listing.username &&
    listing.type === "property";

  return (
    <div className="p-4 bg-[#f6f6ef] min-h-[calc(100vh-30px)]">
      <div className="bg-white p-6 border border-[#828282] max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 text-black">{listing.title}</h1>
        <div className="text-[10pt] text-[#828282] mb-6">
          {listing.points} points by {listing.username} |{" "}
          {new Date(listing.created_at).toLocaleString()}
        </div>

        {listing.url && (
          <div className="mb-6">
            <a
              href={listing.url}
              className="text-blue-600 hover:underline break-all"
              target="_blank"
              rel="noopener noreferrer"
            >
              {listing.url}
            </a>
          </div>
        )}

        <div className="mb-6">
          <h2 className="font-bold text-[#828282] mb-1">Description</h2>
          <p className="text-[10pt] text-black whitespace-pre-wrap">
            {listing.description || "No description provided."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-[10pt] border-t border-[#828282] pt-4">
          <div>
            <span className="font-bold text-[#828282]">Price:</span> $
            {listing.rent || listing.budget}/mo
          </div>
          <div>
            <span className="font-bold text-[#828282]">Neighborhood:</span>{" "}
            {listing.neighborhood}
          </div>
          <div>
            <span className="font-bold text-[#828282]">Type:</span> {listing.type}
          </div>
          <div>
            <span className="font-bold text-[#828282]">Role:</span> {listing.role}
          </div>
        </div>

        {canApply && (
          <div className="mt-6 border-t border-[#e8e8e8] pt-4">
            {applyStatus === "success" ? (
              <div className="text-green-600 text-[10pt]">
                Application sent! Track it under{" "}
                <Link to="/applications" className="underline">
                  applications
                </Link>
                .
              </div>
            ) : applyStatus === "duplicate" ? (
              <div className="text-[#828282] text-[10pt]">
                You already applied to this listing.{" "}
                <Link to="/applications" className="underline">
                  View your applications
                </Link>
                .
              </div>
            ) : showApplyModal ? (
              <div className="flex flex-col gap-2 max-w-md">
                <label className="text-[9pt] text-[#828282] font-bold">
                  Message to landlord (optional)
                </label>
                <textarea
                  className="border border-[#828282] p-1 text-[10pt] resize-none"
                  rows={4}
                  placeholder="Introduce yourself, mention move-in date, pets, etc."
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleApply}
                    disabled={applying}
                    className="bg-[#d4d4d4] border border-[#828282] px-2 py-0.5 text-[10pt] text-black hover:bg-[#c4c4c4] disabled:opacity-50"
                  >
                    {applying ? "Sending..." : "Send application"}
                  </button>
                  <button
                    onClick={() => setShowApplyModal(false)}
                    className="text-[#828282] text-[10pt] hover:underline"
                  >
                    cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowApplyModal(true)}
                className="bg-[#6a0dad] text-white border border-[#6a0dad] px-3 py-1 text-[10pt] hover:bg-[#5a0b9d]"
              >
                Apply for this listing
              </button>
            )}
          </div>
        )}

        <div className="mt-8">
          <Link to="/" className="text-[#828282] hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
