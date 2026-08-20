import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

// Visiting /api/stripe/connect kicks off (or resumes) an organiser's Stripe onboarding.
// Each organiser gets their own Stripe Express account, linked to their own bank account —
// this matches the "each organiser settles manually" money-flow decision.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL));

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", user.id)
    .single();

  let accountId = profile?.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    accountId = account.id;
    await supabase.from("profiles").update({ stripe_account_id: accountId }).eq("id", user.id);
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/stripe/connect`,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?onboarded=1`,
    type: "account_onboarding",
  });

  return NextResponse.redirect(accountLink.url);
}
