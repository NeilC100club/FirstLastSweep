import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import type { SupabaseClient } from "@supabase/supabase-js";

async function findUserIdByEmail(service: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((u: { email?: string }) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

// Appoint someone as an organiser for a club. They must have signed up already.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { clubId, email } = (await request.json()) as { clubId?: string; email?: string };
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!clubId || !cleanEmail) return NextResponse.json({ error: "Enter their email address." }, { status: 400 });

  const userId = await findUserIdByEmail(auth.service, cleanEmail);
  if (!userId) {
    return NextResponse.json(
      {
        error: `No account for ${cleanEmail} yet. Ask them to sign up at ${process.env.NEXT_PUBLIC_SITE_URL}/signup first, then add them here.`,
      },
      { status: 404 }
    );
  }
  const { error } = await auth.service
    .from("club_organisers")
    .upsert({ club_id: clubId, user_id: userId }, { onConflict: "club_id,user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Remove someone as an organiser. Their past sweeps stay as they are.
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { clubId, userId } = (await request.json()) as { clubId?: string; userId?: string };
  if (!clubId || !userId) return NextResponse.json({ error: "Which organiser?" }, { status: 400 });
  const { error } = await auth.service.from("club_organisers").delete().eq("club_id", clubId).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
