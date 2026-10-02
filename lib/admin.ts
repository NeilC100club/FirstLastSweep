import type { SupabaseClient } from "@supabase/supabase-js";

// True if the signed-in user is a super user (has a row in the `admins` table).
// RLS only lets a user see their own row, so this can't leak who else is an admin.
export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

// Can this user run this sweep? The organiser who created it, or any super user.
export async function canManageSweep(
  supabase: SupabaseClient,
  userId: string,
  sweep: { organizer_id: string }
): Promise<{ allowed: boolean; admin: boolean }> {
  const admin = await isAdmin(supabase, userId);
  return { allowed: admin || sweep.organizer_id === userId, admin };
}
