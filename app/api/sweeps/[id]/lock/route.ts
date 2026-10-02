import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManageSweep } from "@/lib/admin";
import { lockBoardNow } from "@/lib/closeBoards";

export const maxDuration = 60;

// The "Lock board & kick off" button — locks now and emails the PDF to buyers.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: sweep } = await supabase.from("sweeps").select("*").eq("id", params.id).single();
  if (!sweep) return NextResponse.json({ error: "Sweep not found." }, { status: 404 });

  const { allowed } = await canManageSweep(supabase, user.id, sweep);
  if (!allowed) return NextResponse.json({ error: "Only the organiser can lock this board." }, { status: 403 });

  await lockBoardNow(sweep.id);
  return NextResponse.json({ ok: true });
}
