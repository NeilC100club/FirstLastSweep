import type { SupabaseClient } from "@supabase/supabase-js";
import type { Club, Sweep } from "@/lib/types";

export type SweepWithClub = Sweep & { club: Club | null };

// Minutes claimed per sweep, for the progress bars.
export async function claimedCounts(supabase: SupabaseClient, sweepIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (sweepIds.length === 0) return counts;
  const { data } = await supabase
    .from("minutes")
    .select("sweep_id")
    .not("owner_name", "is", null)
    .in("sweep_id", sweepIds);
  (data || []).forEach((row: { sweep_id: string }) => {
    counts[row.sweep_id] = (counts[row.sweep_id] || 0) + 1;
  });
  return counts;
}

// Open boards first, then locked, then finished; soonest match first within each.
export function sortForDisplay<T extends Pick<Sweep, "status" | "event_date" | "created_at">>(sweeps: T[]): T[] {
  const rank: Record<string, number> = { open: 0, locked: 1, finished: 2 };
  return sweeps.slice().sort((a, b) => {
    const r = (rank[a.status] ?? 3) - (rank[b.status] ?? 3);
    if (r !== 0) return r;
    const da = a.event_date || "9999-12-31";
    const db = b.event_date || "9999-12-31";
    if (a.status === "finished") return db.localeCompare(da); // most recent result first
    return da.localeCompare(db) || b.created_at.localeCompare(a.created_at);
  });
}
