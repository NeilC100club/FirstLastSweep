import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { sweepId, minutes } = (await request.json()) as { sweepId: string; minutes: number[] };
  if (!sweepId || !Array.isArray(minutes) || minutes.length === 0) {
    return NextResponse.json({ error: "Pick at least one minute first." }, { status: 400 });
  }

  const { data: sweep } = await supabase.from("sweeps").select("*").eq("id", sweepId).single();
  if (!sweep || sweep.status !== "open") {
    return NextResponse.json({ error: "This sweep isn't open for purchases." }, { status: 400 });
  }

  // Re-check nobody else has taken these minutes in the meantime — the unique constraint
  // on (sweep_id, minute) is the real backstop, but this gives a friendlier error up front.
  const { data: existing } = await supabase
    .from("minutes")
    .select("minute, owner_name")
    .eq("sweep_id", sweepId)
    .in("minute", minutes);
  const alreadyTaken = (existing || []).filter((m) => m.owner_name);
  if (alreadyTaken.length > 0) {
    return NextResponse.json(
      { error: `Minute ${alreadyTaken.map((m) => m.minute).join(", ")} just got taken — refresh and try again.` },
      { status: 409 }
    );
  }

  const { data: organizerProfile } = await supabase
    .from("profiles")
    .select("stripe_account_id, stripe_onboarded")
    .eq("id", sweep.organizer_id)
    .single();

  if (!organizerProfile?.stripe_account_id || !organizerProfile.stripe_onboarded) {
    return NextResponse.json(
      { error: "This sweep's organiser hasn't finished setting up payouts yet." },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
  // @ts-expect-error - managed_payments isn't in this Stripe SDK version's types yet
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    managed_payments: { enabled: false },
    line_items: [
      {
        price_data: {
          currency: "gbp",
          unit_amount: sweep.price_per_minute,
          product_data: {
            name: `${sweep.name} — minute${minutes.length > 1 ? "s" : ""} ${minutes.join(", ")}`,
          },
        },
        quantity: minutes.length,
      },
    ],
    payment_intent_data: {
      transfer_data: { destination: organizerProfile.stripe_account_id },
    },
    metadata: {
      sweepId,
      minutes: minutes.join(","),
      ownerName: profile?.name || user.email || "Unknown",
      ownerId: user.id,
    },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/sweeps/${sweepId}?purchased=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/sweeps/${sweepId}`,
  });

  return NextResponse.json({ url: session.url });
}
