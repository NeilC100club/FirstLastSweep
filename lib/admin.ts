import type { SupabaseClient } from "@supabase/supabase-js";

// True if the signed-in user is a super user (has a row in the `admins` table).
// RLS only lets a user see their own row, so this can't leak who else is an admin.
export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

// The clubs this user has been appointed to organise.
export async function organisedClubIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase.from("club_organisers").select("club_id").eq("user_id", userId);
  return (data || []).map((r: { club_id: string }) => r.club_id);
}

export type Role = { admin: boolean; clubIds: string[]; isOrganiser: boolean };

export async function getRole(supabase: SupabaseClient, userId: string): Promise<Role> {
  const [admin, clubIds] = await Promise.all([isAdmin(supabase, userId), organisedClubIds(supabase, userId)]);
  return { admin, clubIds, isOrganiser: admin || clubIds.length > 0 };
}

// Can this user run this sweep? A super user, an organiser of the sweep's club,
// or whoever created it.
export async function canManageSweep(
  supabase: SupabaseClient,
  userId: string,
  sweep: { organizer_id: string; club_id: string | null }
): Promise<{ allowed: boolean; admin: boolean }> {
  const role = await getRole(supabase, userId);
  const allowed =
    role.admin || sweep.organizer_id === userId || (!!sweep.club_id && role.clubIds.includes(sweep.club_id));
  return { allowed, admin: role.admin };
}
