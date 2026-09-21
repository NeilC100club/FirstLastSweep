import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { standardTerms, type Sweep, type Club } from "@/lib/types";
import SignOutButton from "./SignOutButton";

type SweepWithClub = Sweep & { club: Club | null };

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sweeps } = await supabase
    .from("sweeps")
    .select("*, club:clubs(short_name, primary_color, text_on_primary)")
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
        sweeps.map((s: SweepWithClub) => s.id)
      );
    (minuteRows || []).forEach((row: { sweep_id: string }) => {
      claimedCounts[row.sweep_id] = (claimedCounts[row.sweep_id] || 0) + 1;
    });
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between px-5 py-4 border-b border-chalk/10 bg-pitch">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="First and Last" className="h-8 w-auto" />
          <div className="leading-tight">
            <div className="font-mono text-xs tracking-widest font-bold">FIRST AND LAST GOAL SWEEP</div>
          </div>
        </div>
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

        <div className="bg-pitch border border-chalk/10 rounded-2xl p-5 mb-7">
          <div className="font-mono text-xs tracking-widest text-chalk/50 mb-2">HOW IT WORKS</div>
          <p className="text-sm text-black leading-relaxed mb-3">
            Each sweep splits a match into its 90 minutes. Buy the minute you fancy — if the first
            or last match goal goes in during that minute, you're in the money. Half of everything
            collected forms the prize pot, split between whoever holds the first goal's minute and
            whoever holds the last goal's minute; the other half goes straight to that sweep's
            club fund.
          </p>
          <p className="text-sm text-black leading-relaxed mb-3">
            For example: if 84 minutes are sold, the person holding the first goal's minute gets
            £42 and the person holding the last goal's minute gets £42 — the other £84 goes to the
            club fundraiser. If the score finishes 1-0, that same minute is both the first and last
            goal, so that lucky winner takes the full £84.
          </p>
          <ul className="list-disc pl-4 space-y-1 text-xs text-chalk/70">
            {standardTerms().map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
          <div>
            <div className="font-mono text-xs tracking-widest text-chalk/50 mb-1">YOUR SWEEPS</div>
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
          {(sweeps || []).map((s: SweepWithClub) => {
            const claimed = claimedCounts[s.id] || 0;
            const pct = Math.round((claimed / s.total_minutes) * 100);
            const isFinished = s.status === "finished";
            const clubColor = s.club?.primary_color || "#F2A900";
            return (
              <Link
                key={s.id}
                href={`/sweeps/${s.id}`}
                className="relative block bg-pitch border border-chalk/10 rounded-2xl p-5 overflow-hidden"
              >
                {isFinished && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-chalk/70">
                    <span className="text-white text-6xl font-black leading-none" aria-hidden="true">
                      ✕
                    </span>
                    <span className="font-mono text-base sm:text-lg font-extrabold tracking-widest text-white">
                      FINISHED
                    </span>
                  </div>
                )}
                <div className={isFinished ? "opacity-30 grayscale" : ""}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-mono text-[10px] tracking-wide px-2 py-1 rounded-full"
                        style={{ backgroundColor: `${clubColor}26`, color: clubColor }}
                      >
                        {s.status.toUpperCase()}
                      </span>
                      {s.club?.short_name && (
                        <span className="font-mono text-[10px] tracking-wide px-2 py-1 rounded-full bg-chalk/10 text-chalk/60">
                          {s.club.short_name}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs" style={{ color: clubColor }}>
                      £{(s.price_per_minute / 100).toFixed(2)}/min
                    </span>
                  </div>
                  <h3 className="font-display text-lg mb-1">{s.name}</h3>
                  <div className="text-xs text-chalk/60 mb-3">
                    {s.event_date} {s.kickoff_time ? `· ${s.kickoff_time.slice(0, 5)} kickoff` : ""}
                  </div>
                  <div className="h-1.5 rounded bg-chalk/10 overflow-hidden mb-2">
                    <div className="h-full" style={{ width: `${pct}%`, backgroundColor: clubColor }} />
                  </div>
                  <div className="text-xs text-chalk/60">
                    {claimed} / {s.total_minutes} minutes claimed
                  </div>
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
