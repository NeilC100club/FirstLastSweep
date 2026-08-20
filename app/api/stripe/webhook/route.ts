import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

// Stripe calls this URL directly (not the browser), so it uses the service-role
// Supabase client which bypasses Row Level Security — this is the ONLY place
// minutes get marked as sold, and only after Stripe confirms the card was charged.
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { sweepId, minutes, ownerName, ownerId } = session.metadata || {};
    if (sweepId && minutes) {
      const minuteNumbers = minutes.split(",").map(Number);
      // Only claims minutes that are still unowned — if two people somehow both got this
      // far, the unique constraint plus this guard means only the first write wins.
      await supabase
        .from("minutes")
        .update({
          owner_name: ownerName,
          owner_id: ownerId || null,
          stripe_checkout_session_id: session.id,
          purchased_at: new Date().toISOString(),
        })
        .eq("sweep_id", sweepId)
        .in("minute", minuteNumbers)
        .is("owner_name", null);
    }
  }

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    if (account.charges_enabled) {
      await supabase
        .from("profiles")
        .update({ stripe_onboarded: true })
        .eq("stripe_account_id", account.id);
    }
  }

  return NextResponse.json({ received: true });
}
