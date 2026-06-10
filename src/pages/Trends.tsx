import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

type NeighborhoodStats = {
  neighborhood: string;
  avg: number;
  min: number;
  max: number;
  count: number;
};

export default function Trends() {
  const [stats, setStats] = useState<NeighborhoodStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("neighborhood, rent")
        .eq("type", "property")
        .not("rent", "is", null);

      if (error || !data) {
        setLoading(false);
        return;
      }

      const byNeighborhood: Record<string, number[]> = {};
      for (const row of data) {
        const n = (row.neighborhood ?? "").trim();
        if (!n) continue;
        if (!byNeighborhood[n]) byNeighborhood[n] = [];
        byNeighborhood[n].push(Number(row.rent));
      }

      const result: NeighborhoodStats[] = Object.entries(byNeighborhood)
        .map(([neighborhood, rents]) => ({
          neighborhood,
          avg: Math.round(rents.reduce((a, b) => a + b, 0) / rents.length),
          min: Math.min(...rents),
          max: Math.max(...rents),
          count: rents.length,
        }))
        .sort((a, b) => b.avg - a.avg);

      setStats(result);
      setLoading(false);
    };

    fetchTrends();
  }, []);

  const maxAvg = stats.length > 0 ? Math.max(...stats.map((s) => s.avg)) : 1;
  const totalListings = stats.reduce((a, s) => a + s.count, 0);

  if (loading) {
    return <div className="p-4 text-[#828282] text-[10pt]">Loading...</div>;
  }

  if (stats.length === 0) {
    return (
      <div className="p-4 text-[#828282] text-[10pt]">
        No rental data yet. Be the first to{" "}
        <a href="/submit" className="underline hover:text-black">
          submit a listing
        </a>
        .
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="text-[10pt] text-[#828282] mb-4 border-b border-[#e8e8e8] pb-1">
        average rent by neighborhood —{" "}
        <span className="text-black font-medium">{totalListings}</span> property{" "}
        {totalListings === 1 ? "listing" : "listings"} across{" "}
        <span className="text-black font-medium">{stats.length}</span>{" "}
        {stats.length === 1 ? "neighborhood" : "neighborhoods"}
      </div>

      <div className="flex flex-col gap-4 max-w-2xl">
        {stats.map((s) => (
          <div key={s.neighborhood} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[10pt] text-black font-medium">
                {s.neighborhood}
              </span>
              <span className="text-[8pt] text-[#828282] whitespace-nowrap">
                {s.count} {s.count === 1 ? "listing" : "listings"} · $
                {s.min.toLocaleString()}–${s.max.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-[10px] bg-[#e8e8e8]">
                <div
                  className="h-[10px] bg-[#6a0dad]"
                  style={{ width: `${(s.avg / maxAvg) * 100}%` }}
                />
              </div>
              <span className="text-[9pt] text-black w-28 text-right font-mono">
                ${s.avg.toLocaleString()}/mo
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-[8pt] text-[#828282]">
        averages computed from active property listings · excludes tenant
        requirement posts
      </div>
    </div>
  );
}
