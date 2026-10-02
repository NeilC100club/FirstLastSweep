import { jsPDF } from "jspdf";
import { createServiceClient } from "@/lib/supabase/server";
import { buildBoardPdf, boardPdfFileName } from "@/lib/boardPdf";
import { sendBoardPdf } from "@/lib/email";
import type { Club, Minute, Sweep } from "@/lib/types";

// Server-only. Locks every open board whose kick-off has passed, then emails the
// board PDF for every locked board that hasn't had it sent yet.
export async function runKickoffJob(): Promise<{ locked: string[]; emailed: string[] }> {
  const supabase = createServiceClient();

  const { data: lockedRows, error } = await supabase.rpc("lock_due_sweeps");
  if (error) console.error("Kickoff: lock_due_sweeps failed", error);
  const locked = ((lockedRows as string[] | null) || []).map(String);

  // Any locked board still waiting for its email — covers boards just locked above,
  // boards locked by hand with the button, and retries if a previous run crashed.
  const { data: pending } = await supabase
    .from("sweeps")
    .select("id")
    .eq("status", "locked")
    .is("board_emailed_at", null)
    .is("archived_at", null);

  const emailed: string[] = [];
  for (const row of pending || []) {
    if (await emailBoardToBuyers(row.id)) emailed.push(row.id);
  }
  return { locked, emailed };
}

// Locks one board right now (the organiser's "Lock board" button) and sends the PDF.
export async function lockBoardNow(sweepId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("sweeps").update({ status: "locked" }).eq("id", sweepId).eq("status", "open");
  await emailBoardToBuyers(sweepId);
}

// Emails the board PDF to every distinct buyer email on the board, at most once per board.
export async function emailBoardToBuyers(sweepId: string): Promise<boolean> {
  const supabase = createServiceClient();

  // Claim the job first, so two runs at the same moment can never both send it.
  const { data: claimed } = await supabase
    .from("sweeps")
    .update({ board_emailed_at: new Date().toISOString() })
    .eq("id", sweepId)
    .is("board_emailed_at", null)
    .select("*, club:clubs(*)")
    .maybeSingle();
  if (!claimed) return false;

  const sweep = claimed as Sweep & { club: Club | null };
  try {
    const { data: minuteRows } = await supabase
      .from("minutes")
      .select("minute, owner_name, buyer_email")
      .eq("sweep_id", sweepId)
      .order("minute", { ascending: true });
    const minutes = (minuteRows || []) as Pick<Minute, "minute" | "owner_name" | "buyer_email">[];

    const { data: organizer } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", sweep.organizer_id)
      .maybeSingle();

    const recipients = Array.from(
      new Set(
        minutes
          .map((m) => m.buyer_email?.trim().toLowerCase())
          .filter((e): e is string => !!e && e.includes("@"))
      )
    );

    const fundraiserName = sweep.club?.fundraiser_name || "club fund";
    const doc = buildBoardPdf(jsPDF, {
      sweep,
      minutes,
      fundraiserName,
      organizerName: organizer?.name,
    });
    const pdf = Buffer.from(doc.output("arraybuffer"));

    const result = await sendBoardPdf({
      to: recipients,
      sweepName: sweep.name,
      eventDate: sweep.event_date,
      kickoffTime: sweep.kickoff_time,
      pdf,
      fileName: boardPdfFileName(sweep.name),
      sweepUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/sweeps/${sweepId}`,
      clubName: sweep.club?.short_name,
      fundraiserName,
      accentColor: sweep.club?.primary_color,
      textOnAccent: sweep.club?.text_on_primary,
    });

    // If email isn't set up at all, release the claim so it's retried once it is.
    if (!result.configured) {
      await supabase.from("sweeps").update({ board_emailed_at: null }).eq("id", sweepId);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Kickoff: failed to build or send board PDF", sweepId, err);
    await supabase.from("sweeps").update({ board_emailed_at: null }).eq("id", sweepId);
    return false;
  }
}
