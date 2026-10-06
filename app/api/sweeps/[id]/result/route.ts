import { NextResponse } from "next/server";
import { SimplePdf } from "@/lib/simplePdf";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canManageSweep } from "@/lib/admin";
import { buildBoardPdf, boardPdfFileName } from "@/lib/boardPdf";
import { calculateResult } from "@/lib/results";
import { sendResults } from "@/lib/email";
import type { Club, Minute, Sweep } from "@/lib/types";

export const maxDuration = 60;

// Organiser enters the result: saves it, finishes the sweep, and emails everyone
// who bought with an email address the result and the final board PDF.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: existing } = await supabase.from("sweeps").select("*").eq("id", params.id).single();
  if (!existing) return NextResponse.json({ error: "Sweep not found." }, { status: 404 });
  if (!(await canManageSweep(supabase, user.id, existing)).allowed) {
    return NextResponse.json({ error: "Only the organiser can enter the result." }, { status: 403 });
  }

  const body = (await request.json()) as { first?: number | null; last?: number | null };
  const valid = (m: unknown) =>
    m === null || m === undefined || (Number.isInteger(m) && (m as number) >= 1 && (m as number) <= existing.total_minutes);
  if (!valid(body.first) || !valid(body.last)) {
    return NextResponse.json({ error: `Goal minutes must be between 1 and ${existing.total_minutes}.` }, { status: 400 });
  }

  // Only moves a locked board to finished — so pressing the button twice can never
  // send the results email twice.
  const service = createServiceClient();
  const { data: finished, error } = await service
    .from("sweeps")
    .update({ goal_minute_first: body.first ?? null, goal_minute_last: body.last ?? null, status: "finished" })
    .eq("id", existing.id)
    .eq("status", "locked")
    .select("*, club:clubs(*)")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!finished) return NextResponse.json({ error: "The result has already been entered." }, { status: 409 });

  const sweep = finished as Sweep & { club: Club | null };
  let emailed = 0;
  try {
    const [{ data: minuteRows }, { data: organizer }] = await Promise.all([
      service.from("minutes").select("minute, owner_name, buyer_email").eq("sweep_id", sweep.id).order("minute"),
      service.from("profiles").select("name").eq("id", sweep.organizer_id).maybeSingle(),
    ]);
    const minutes = (minuteRows || []) as Pick<Minute, "minute" | "owner_name" | "buyer_email">[];
    const recipients = Array.from(
      new Set(
        minutes
          .map((m) => m.buyer_email?.trim().toLowerCase())
          .filter((e): e is string => !!e && e.includes("@"))
      )
    );
    const fundraiserName = sweep.club?.fundraiser_name || "club fund";
    const doc = new SimplePdf();
    buildBoardPdf(doc, { sweep, minutes, fundraiserName, organizerName: organizer?.name });
    const pdf = Buffer.from(doc.output("arraybuffer"));
    const sent = await sendResults({
      to: recipients,
      sweepName: sweep.name,
      eventDate: sweep.event_date,
      result: calculateResult(sweep, minutes),
      pdf,
      fileName: boardPdfFileName(`${sweep.name}-result`),
      sweepUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/sweeps/${sweep.id}`,
      clubName: sweep.club?.short_name,
      fundraiserName,
      accentColor: sweep.club?.primary_color,
      textOnAccent: sweep.club?.text_on_primary,
    });
    emailed = sent.sent;
  } catch (err) {
    // The result is saved regardless — an email problem must never undo it.
    console.error("Result: failed to send results email", sweep.id, err);
  }

  return NextResponse.json({ ok: true, emailed });
}
