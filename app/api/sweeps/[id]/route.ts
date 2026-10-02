import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canManageSweep } from "@/lib/admin";
import { kickoffPassed } from "@/lib/types";

async function loadForManager(sweepId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };

  const { data: sweep } = await supabase.from("sweeps").select("*").eq("id", sweepId).single();
  if (!sweep) return { error: NextResponse.json({ error: "Sweep not found." }, { status: 404 }) };

  const { allowed, admin } = await canManageSweep(supabase, user.id, sweep);
  if (!allowed) {
    return { error: NextResponse.json({ error: "Only the organiser can change this sweep." }, { status: 403 }) };
  }
  return { sweep, admin, user };
}

// Edit a board's details after it's been created (fix a typo, wrong date or kick-off),
// or — for a super user — bring back an archived board.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const loaded = await loadForManager(params.id);
  if ("error" in loaded) return loaded.error;
  const { sweep, admin } = loaded;

  const body = (await request.json()) as {
    name?: string;
    event_date?: string | null;
    kickoff_time?: string | null;
    cause?: string | null;
    restore?: boolean;
  };

  const service = createServiceClient();

  if (body.restore) {
    if (!admin) return NextResponse.json({ error: "Only a super user can restore boards." }, { status: 403 });
    await service.from("sweeps").update({ archived_at: null }).eq("id", sweep.id);
    return NextResponse.json({ ok: true });
  }

  const name = (body.name ?? sweep.name).trim();
  if (!name) return NextResponse.json({ error: "The board needs a name." }, { status: 400 });

  const update: Record<string, unknown> = {
    name,
    event_date: body.event_date === undefined ? sweep.event_date : body.event_date || null,
    kickoff_time: body.kickoff_time === undefined ? sweep.kickoff_time : body.kickoff_time || null,
    cause: body.cause === undefined ? sweep.cause : body.cause?.trim() || null,
  };

  // If a board closed because the kick-off time was wrong, and it's been moved to
  // later, open it again so people can keep buying (the PDF will go out again at
  // the new kick-off).
  const newKickoff = { event_date: update.event_date as string | null, kickoff_time: update.kickoff_time as string | null };
  let reopened = false;
  if (sweep.status === "locked" && newKickoff.event_date && newKickoff.kickoff_time && !kickoffPassed(newKickoff)) {
    update.status = "open";
    update.board_emailed_at = null;
    reopened = true;
  }

  const { error } = await service.from("sweeps").update(update).eq("id", sweep.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, reopened });
}

// Super user only: archive a board so it no longer shows on the dashboard.
// Nothing is deleted — the minutes and buyer records are all kept.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const loaded = await loadForManager(params.id);
  if ("error" in loaded) return loaded.error;
  if (!loaded.admin) return NextResponse.json({ error: "Only a super user can remove boards." }, { status: 403 });

  const service = createServiceClient();
  const { error } = await service
    .from("sweeps")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", loaded.sweep.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
