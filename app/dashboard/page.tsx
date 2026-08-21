import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Sweep } from "@/lib/types";
import SignOutButton from "./SignOutButton";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sweeps } = await supabase
    .from("sweeps")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, stripe_onboarded")
    .eq("id", user.id)
    .single();

  // Claimed-count per sweep, for the progress bar.
  const claimedCounts: Record<string, number> = {};
  if (sweeps && sweeps.length > 0) {
    const { data: minuteRows } = await supabase
      .from("minutes")
      .select("sweep_id")
      .not("owner_name", "is", null)
      .in(
        "sweep_id",
        sweeps.map((s: Sweep) => s.id)
      );
    (minuteRows || []).forEach((row: { sweep_id: string }) => {
      claimedCounts[row.sweep_id] = (claimedCounts[row.sweep_id] || 0) + 1;
    });
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between px-5 py-4 border-b border-chalk/10 bg-pitch">
        <span className="font-mono text-xs tracking-widest font-bold">FIRST AND LAST GOAL SWEEP</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs px-3 py-1.5 rounded-full bg-chalk/10">{profile?.name}</span>
          <SignOutButton />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-6 pb-20">
        {!profile?.stripe_onboarded && (
          <Link
            href="/api/stripe/connect"
            className="block mb-6 rounded-xl border border-gold/30 bg-gold/10 px-5 py-4 text-sm"
          >
            <strong className="text-gold">Set up payouts</strong> — connect a bank account so you
            can collect money for any sweep you organise. Takes a couple of minutes via Stripe.
          </Link>
        )}

        <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
          <div>
            <div className="font-mono text-xs tracking-widest text-gold mb-1">YOUR SWEEPS</div>
            <h1 className="font-display text-2xl">Kick off a new one, or jump back in.</h1>
          </div>
          <Link
            href="/sweeps/new"
            className="px-5 py-3 rounded-lg bg-gold text-[#241C00] font-bold text-sm"
          >
            + New sweep
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {(sweeps || []).map((s: Sweep) => {
            const claimed = claimedCounts[s.id] || 0;
            const pct = Math.round((claimed / s.total_minutes) * 100);
            return (
              <Link
                key={s.id}
                href={`/sweeps/${s.id}`}
                className="block bg-pitch border border-chalk/10 rounded-2xl p-5"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-[10px] tracking-wide px-2 py-1 rounded-full bg-gold/15 text-gold">
                    {s.status.toUpperCase()}
                  </span>
                  <span className="font-mono text-xs text-gold">
                    £{(s.price_per_minute / 100).toFixed(2)}/min
                  </span>
                </div>
                <h3 className="font-display text-lg mb-1">{s.name}</h3>
                <div className="text-xs text-chalk/60 mb-3">
                  {s.event_date} {s.kickoff_time ? `· ${s.kickoff_time.slice(0, 5)} kickoff` : ""}
                </div>
                <div className="h-1.5 rounded bg-chalk/10 overflow-hidden mb-2">
                  <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-chalk/60">
                  {claimed} / {s.total_minutes} minutes claimed
                </div>
              </Link>
            );
          })}
          {(!sweeps || sweeps.length === 0) && (
            <p className="text-chalk/60 text-sm col-span-2">
              No sweeps yet — create your first one above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
