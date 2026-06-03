import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDistanceToNow } from "date-fns";

type Application = {
  id: string;
  listing_id: string;
  listing_title: string;
  applicant_username: string;
  landlord_username: string;
  status: "pending" | "reviewing" | "accepted" | "rejected";
  message: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-[#828282] border-[#828282]",
  reviewing: "text-[#ff6600] border-[#ff6600]",
  accepted: "text-green-600 border-green-600",
  rejected: "text-red-500 border-red-500",
};

export default function Applications({ username }: { username: string }) {
  const [tab, setTab] = useState<"sent" | "received">("sent");
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    setLoading(true);

    const column = tab === "sent" ? "applicant_username" : "landlord_username";
    supabase
      .from("applications")
      .select("*")
      .eq(column, username)
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setApplications((data as Application[]) || []);
        setLoading(false);
      });
  }, [tab, username]);

  const updateStatus = async (id: string, status: Application["status"]) => {
    setUpdatingId(id);
    const { error } = await supabase
      .from("applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    }
    setUpdatingId(null);
  };

  return (
    <div className="p-2">
      <div className="text-[10pt] text-[#828282] mb-3 flex gap-3 border-b border-[#e8e8e8] pb-1">
        <button
          onClick={() => setTab("sent")}
          className={`hover:underline ${tab === "sent" ? "text-black font-bold" : ""}`}
        >
          my applications
        </button>
        <span>|</span>
        <button
          onClick={() => setTab("received")}
          className={`hover:underline ${tab === "received" ? "text-black font-bold" : ""}`}
        >
          received applications
        </button>
      </div>

      {loading && (
        <div className="text-[#828282] text-[10pt]">Loading...</div>
      )}

      {!loading && applications.length === 0 && (
        <div className="text-[#828282] text-[10pt]">
          {tab === "sent"
            ? "You haven't applied to any listings yet."
            : "No one has applied to your listings yet."}
        </div>
      )}

      <ol className="list-decimal pl-6 m-0 flex flex-col gap-2">
        {applications.map((app) => (
          <li key={app.id} className="text-[10pt] marker:text-[#828282]">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2">
                <Link
                  to={`/item?id=${app.listing_id}`}
                  className="text-black hover:underline font-medium"
                >
                  {app.listing_title}
                </Link>
                <span
                  className={`text-[7pt] border px-1 py-[1px] rounded-[2px] uppercase font-bold leading-none ${STATUS_COLORS[app.status]}`}
                >
                  {app.status}
                </span>
              </div>

              <div className="text-[8pt] text-[#828282]">
                {tab === "sent" ? (
                  <>applied to {app.landlord_username}'s listing</>
                ) : (
                  <>
                    from{" "}
                    <span className="text-[#333] font-medium">
                      {app.applicant_username}
                    </span>
                  </>
                )}{" "}
                · {formatDistanceToNow(new Date(app.created_at))} ago
                {app.updated_at !== app.created_at && (
                  <> · updated {formatDistanceToNow(new Date(app.updated_at))} ago</>
                )}
              </div>

              {app.message && (
                <div className="text-[9pt] text-black bg-[#f6f6ef] border border-[#e8e8e8] p-2 mt-1 max-w-lg">
                  {app.message}
                </div>
              )}

              {tab === "received" && (
                <div className="flex gap-2 mt-1 flex-wrap">
                  {(["pending", "reviewing", "accepted", "rejected"] as const).map(
                    (s) => (
                      <button
                        key={s}
                        disabled={app.status === s || updatingId === app.id}
                        onClick={() => updateStatus(app.id, s)}
                        className={`text-[8pt] px-1.5 py-[1px] border rounded-[2px] cursor-pointer transition-colors
                          ${app.status === s ? "bg-[#d4d4d4] text-black border-[#828282] font-bold" : "hover:bg-[#e8e8e8] text-[#828282] border-[#c0c0c0]"}
                          disabled:opacity-50 disabled:cursor-default`}
                      >
                        {s}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
