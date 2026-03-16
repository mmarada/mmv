import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { logger } from "../utils/logger";

export default function Submit({ username }: { username: string }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    url: "",
    type: "property",
    role: "owner",
    rent: "",
    budget: "",
    neighborhood: "",
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in to submit.");
      return;
    }

    const newListing = {
      title: formData.title,
      url: formData.url || null,
      domain: formData.url ? new URL(formData.url).hostname.replace('www.', '') : null,
      user_id: user.id,
      username: username,
      role: formData.role,
      type: formData.type,
      rent: formData.type === "property" ? Number(formData.rent) : null,
      budget: formData.type === "requirement" ? Number(formData.budget) : null,
      neighborhood: formData.neighborhood,
    };

    const { error: insertError } = await supabase.from("listings").insert([newListing]);

    if (insertError) {
      logger.error("Error submitting listing:", insertError);
      setError(insertError.message);
    } else {
      logger.info("Listing submitted successfully:", newListing.title);
      navigate("/");
    }
  };

  return (
    <div className="p-4 bg-[#f6f6ef] min-h-[calc(100vh-30px)]">
      {error && <div className="text-red-500 mb-4 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg">
        <div className="flex gap-2">
          <label className="w-24 text-right text-[#828282] text-[10pt] font-bold">title</label>
          <input
            type="text"
            className="border border-[#828282] p-1 flex-1 text-[10pt]"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
        </div>
        <div className="flex gap-2">
          <label className="w-24 text-right text-[#828282] text-[10pt] font-bold">url</label>
          <input
            type="url"
            className="border border-[#828282] p-1 flex-1 text-[10pt]"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <label className="w-24 text-right text-[#828282] text-[10pt] font-bold">type</label>
          <select
            className="border border-[#828282] p-1 flex-1 text-[10pt]"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          >
            <option value="property">Property Listing</option>
            <option value="requirement">Tenant Requirement</option>
          </select>
        </div>
        <div className="flex gap-2">
          <label className="w-24 text-right text-[#828282] text-[10pt] font-bold">role</label>
          <select
            className="border border-[#828282] p-1 flex-1 text-[10pt]"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          >
            <option value="owner">Owner</option>
            <option value="tenant">Tenant</option>
            <option value="broker">Broker</option>
          </select>
        </div>
        {formData.type === "property" ? (
          <div className="flex gap-2">
            <label className="w-24 text-right text-[#828282] text-[10pt] font-bold">rent ($)</label>
            <input
              type="number"
              className="border border-[#828282] p-1 flex-1 text-[10pt]"
              value={formData.rent}
              onChange={(e) => setFormData({ ...formData, rent: e.target.value })}
              required
            />
          </div>
        ) : (
          <div className="flex gap-2">
            <label className="w-24 text-right text-[#828282] text-[10pt] font-bold">budget ($)</label>
            <input
              type="number"
              className="border border-[#828282] p-1 flex-1 text-[10pt]"
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              required
            />
          </div>
        )}
        <div className="flex gap-2">
          <label className="w-24 text-right text-[#828282] text-[10pt] font-bold">neighborhood</label>
          <input
            type="text"
            className="border border-[#828282] p-1 flex-1 text-[10pt]"
            value={formData.neighborhood}
            onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
            required
          />
        </div>
        <div className="flex gap-2 mt-2">
          <div className="w-24"></div>
          <button
            type="submit"
            className="bg-[#d4d4d4] border border-[#828282] px-2 py-0.5 text-[10pt] text-black hover:bg-[#c4c4c4]"
          >
            submit
          </button>
        </div>
      </form>
      <div className="mt-8 text-[10pt] text-[#828282]">
        <p>Leave url blank to submit a question for discussion. If there is no url, the text (if any) will appear at the top of the thread.</p>
      </div>
    </div>
  );
}
