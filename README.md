# First and Last Goal Sweep

A real, deployable version of the Newport County 100 Club sweepstake app — accounts,
a real database, and real Stripe payments that pay organisers directly.

## How it works

- Anyone can sign up and create a sweep.
- Each **organiser** connects their own bank account via Stripe (Stripe Connect Express) —
  money from their sweeps lands with them directly. They're responsible for manually
  paying the winner and forwarding the 100 Club's share afterwards, same as before.
- Buyers pick minutes and pay with a card via Stripe Checkout. A minute is only ever
  marked as sold once Stripe confirms the payment actually went through (via webhook) —
  never just because someone clicked "buy".
- The board updates live for everyone watching, using Supabase's realtime feature.

---

## 1. Create accounts (all free to start)

1. **Supabase** — [supabase.com](https://supabase.com) → New project. Pick any name/region,
   set a database password (save it somewhere).
2. **Stripe** — [stripe.com](https://stripe.com) → sign up. Stay in **test mode** while
   you're setting this up (there's a toggle top-right of the dashboard).
3. **Vercel** — [vercel.com](https://vercel.com) → sign up (for hosting). You can connect
   it to a GitHub account, or deploy straight from your computer — either works.

## 2. Set up the database

1. In your Supabase project, go to **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this project, copy all of it, paste it in, and click
   **Run**. This creates all the tables and security rules in one go.
3. Go to **Authentication → Providers** and make sure **Email** is enabled (it is by
   default). Optionally turn off "Confirm email" under **Authentication → Settings** while
   you're testing, so new accounts don't need an email click to activate.

## 3. Set up Stripe

1. In the Stripe dashboard (test mode), go to **Developers → API keys**. Copy the
   **Secret key** — you'll need it below.
2. Go to **Connect → Settings** and make sure **Express accounts** are enabled (they are
   by default for new Stripe accounts).
3. You'll set up the webhook (step 5) after your first deploy, since it needs your live URL.

## 4. Fill in your environment variables

1. Copy `.env.local.example` to a new file called `.env.local`.
2. From Supabase: **Project Settings → API** →
   - `NEXT_PUBLIC_SUPABASE_URL` = "Project URL"
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = "anon public" key
   - `SUPABASE_SERVICE_ROLE_KEY` = "service_role" key (keep this one secret — never put it
     in any client-side code)
3. From Stripe: **Developers → API keys** →
   - `STRIPE_SECRET_KEY` = your Secret key (starts `sk_test_...` while in test mode)
4. Leave `STRIPE_WEBHOOK_SECRET` blank for now — you'll get this in step 5.
5. Leave `NEXT_PUBLIC_SITE_URL` as `http://localhost:3000` for local testing.

## 5. Run it locally to check everything works

```
npm install
npm run dev
```

Open `http://localhost:3000` — you should see the login page. Sign up, create a sweep,
and connect a test Stripe account via the banner on the dashboard (Stripe gives you fake
test details to fill in — use card number `4242 4242 4242 4242`, any future expiry, any CVC).

To receive webhooks locally, install the [Stripe CLI](https://stripe.com/docs/stripe-cli),
then run:

```
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

It'll print a webhook signing secret starting `whsec_...` — put that in `.env.local` as
`STRIPE_WEBHOOK_SECRET` and restart `npm run dev`.

## 6. Deploy it for real

1. Push this project to a GitHub repo, then in Vercel: **New Project → Import** it.
2. Add all the same environment variables from `.env.local` into Vercel's project settings
   (**Settings → Environment Variables**) — except set `NEXT_PUBLIC_SITE_URL` to your real
   Vercel URL (e.g. `https://your-app.vercel.app`).
3. Deploy.
4. Back in Stripe: **Developers → Webhooks → Add endpoint**. URL =
   `https://your-app.vercel.app/api/stripe/webhook`. Select events: `checkout.session.completed`
   and `account.updated`. Copy the new **Signing secret** and update `STRIPE_WEBHOOK_SECRET`
   in Vercel, then redeploy.

## 7. Go live with real money

Everything above uses Stripe **test mode** — no real card is ever charged. When you're
ready for real payments:

1. In Stripe, flip to **Live mode** (top-right toggle) and complete Stripe's business
   verification questions.
2. Get your **live** Secret key and update `STRIPE_SECRET_KEY` in Vercel.
3. Set up a **live mode** webhook (same steps as above) and update `STRIPE_WEBHOOK_SECRET`.
4. Each organiser will need to redo the "Set up payouts" step in live mode too.

---

## Project structure

```
app/
  login/, signup/          — auth pages
  dashboard/                — list of sweeps
  sweeps/new/                — create a sweep
  sweeps/[id]/                — the live board (buy minutes, organiser controls)
  api/stripe/connect/         — starts organiser payout onboarding
  api/stripe/checkout/        — starts a buyer's payment
  api/stripe/webhook/         — confirms payment, marks minutes sold
lib/
  supabase/                   — database client helpers
  stripe.ts                   — Stripe client
  types.ts                    — shared types + the standard terms text
supabase/schema.sql            — run this once in Supabase's SQL editor
```

## Notes

- The standard terms (100 Club split rules) live in `lib/types.ts` — edit them there if
  they ever need to change, and they'll update everywhere they're shown.
- Prices are stored in pence in the database (avoids floating-point rounding issues) and
  converted to pounds for display.
- A minute can never be double-sold: the database has a hard uniqueness rule on
  (sweep, minute), on top of the webhook only writing when nobody already owns it.
