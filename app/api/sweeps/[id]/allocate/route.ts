import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canManageSweep } from "@/lib/admin";
import { sendPurchaseConfirmation } from "@/lib/email";

async function authorise(sweepId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };

  const { data: sweep } = await supabase
    .from("sweeps")
    .select("*, club:clubs(name, short_name, fundraiser_name, primary_color, text_on_primary)")
    .eq("id", sweepId)
    .single();
  if (!sweep) return { error: NextResponse.json({ error: "Sweep not found." }, { status: 404 }) };

  const { allowed } = await canManageSweep(supabase, user.id, sweep);
  if (!allowed) {
    return { error: NextResponse.json({ error: "Only the organiser can allocate minutes." }, { status: 403 }) };
  }
  if (sweep.status === "finished") {
    return { error: NextResponse.json({ error: "This sweep has finished — the board can't change now." }, { status: 400 }) };
  }
  return { sweep, user };
}

// Write a name onto one or more minutes for someone who paid cash — no Stripe.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorise(params.id);
  if ("error" in auth) return auth.error;
  const { sweep, user } = auth;

  const body = (await request.json()) as { minutes?: number[]; name?: string; email?: string };
  const name = (body.name || "").trim().slice(0, 60);
  const email = (body.email || "").trim().toLowerCase() || null;
  const minutes = (body.minutes || []).map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= sweep.total_minutes);

  if (!name) return NextResponse.json({ error: "Enter the person's name." }, { status: 400 });
  if (minutes.length === 0) return NextResponse.json({ error: "Pick at least one minute." }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  // Service client: buyers can never write to `minutes` themselves, only trusted server code.
  const service = createServiceClient();
  const { data: claimed, error } = await service
    .from("minutes")
    .update({
      owner_name: name,
      owner_id: null,
      buyer_email: email,
      payment_method: "cash",
      allocated_by: user.id,
      purchased_at: new Date().toISOString(),
    })
    .eq("sweep_id", sweep.id)
    .in("minute", minutes)
    .is("owner_name", null)
    .select("minute");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const got = (claimed || []).map((m) => m.minute as number);
  const missed = minutes.filter((m) => !got.includes(m));

  if (email && got.length > 0) {
    const club = (sweep as unknown as {
      club: { short_name: string; fundraiser_name: string; primary_color: string; text_on_primary: string } | null;
    }).club;
    await sendPurchaseConfirmation({
      to: email,
      buyerName: name,
      sweepName: sweep.name,
      minutes: got,
      pricePerMinute: sweep.price_per_minute,
      eventDate: sweep.event_date,
      kickoffTime: sweep.kickoff_time,
      sweepUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/sweeps/${sweep.id}`,
      clubName: club?.short_name,
      fundraiserName: club?.fundraiser_name,
      accentColor: club?.primary_color,
      textOnAccent: club?.text_on_primary,
      paidCash: true,
    });
  }

  return NextResponse.json({
    allocated: got,
    alreadyTaken: missed,
    error: missed.length ? `Minute ${missed.join(", ")} had already been taken.` : undefined,
  });
}

// Undo a cash allocation (typo in the name, wrong minute). Card purchases can't be removed here.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorise(params.id);
  if ("error" in auth) return auth.error;

  const { minute } = (await request.json()) as { minute?: number };
  const service = createServiceClient();
  const { data, error } = await service
    .from("minutes")
    .update({
      owner_name: null,
      owner_id: null,
      buyer_email: null,
      payment_method: null,
      allocated_by: null,
      purchased_at: null,
    })
    .eq("sweep_id", auth.sweep.id)
    .eq("minute", Number(minute))
    .eq("payment_method", "cash")
    .select("minute");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Only cash minutes can be removed — card payments stay put." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
