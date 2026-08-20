import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STANDARD_TERMS } from "@/lib/types";
import MinuteBoard from "./MinuteBoard";
import OrganizerControls from "./OrganizerControls";

export default async function SweepPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sweep } = await supabase.from("sweeps").select("*").eq("id", params.id).single();
  if (!sweep) notFound();

  const { data: minutes } = await supabase
    .from("minutes")
    .select("*")
    .eq("sweep_id", sweep.id)
    .order("minute", { ascending: true });

  const { data: organizerProfile } = await supabase
    .from("profiles")
    .select("name, stripe_onboarded")
    .eq("id", sweep.organizer_id)
    .single();

  const claimedCount = (minutes || []).filter((m) => m.owner_name).length;
  const prizePool = (claimedCount * sweep.price_per_minute) / 100;
  const isOrganizer = user.id === sweep.organizer_id;

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-5 py-6 pb-20">
        <a href="/dashboard" className="text-sm text-white/60 mb-4 inline-block">
          ← All sweeps
        </a>

        <div className="flex justify-between items-start flex-wrap gap-5 mb-5">
          <div>
            <h1 className="font-display text-2xl mb-1">{sweep.name}</h1>
            <div className="text-sm text-white/60">
              {sweep.event_date} {sweep.kickoff_time ? `· ${sweep.kickoff_time.slice(0, 5)} kickoff` : ""} ·
              Organised by {organizerProfile?.name} · £{(sweep.price_per_minute / 100).toFixed(2)} per
              minute
            </div>
          </div>
          <div className="text-right bg-gold/10 border border-gold/30 rounded-xl px-5 py-3 min-w-[140px]">
            <div className="font-mono text-[11px] text-white/60 tracking-wide">Prize pool</div>
            <div className="font-display text-3xl text-gold">£{prizePool.toFixed(2)}</div>
            <div className="text-xs text-white/50">
              {claimedCount} / {sweep.total_minutes} claimed
            </div>
          </div>
        </div>

        {sweep.cause && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
            <div className="font-mono text-[11px] text-gold tracking-wide mb-2">THE CAUSE</div>
            <p className="text-sm text-white/80">{sweep.cause}</p>
          </div>
        )}

        <div className="bg-red/5 border border-red/20 rounded-xl p-4 mb-5">
          <div className="font-mono text-[11px] text-gold tracking-wide mb-2">STANDARD TERMS</div>
          <ul className="list-disc pl-4 space-y-1 text-xs text-white/75">
            {STANDARD_TERMS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        {sweep.status === "finished" && (sweep.goal_minute_first || sweep.goal_minute_last) && (
          <div className="bg-red/10 border border-red/30 rounded-xl p-4 mb-5 space-y-2">
            {sweep.goal_minute_first && (
              <ResultRow
                label="First goal"
                minute={sweep.goal_minute_first}
                owner={minutes?.find((m) => m.minute === sweep.goal_minute_first)?.owner_name}
              />
            )}
            {sweep.goal_minute_last && (
              <ResultRow
                label="Last goal"
                minute={sweep.goal_minute_last}
                owner={minutes?.find((m) => m.minute === sweep.goal_minute_last)?.owner_name}
              />
            )}
          </div>
        )}

        <MinuteBoard
          sweep={sweep}
          minutes={minutes || []}
          currentUserId={user.id}
          organizerStripeOnboarded={!!organizerProfile?.stripe_onboarded}
        />

        {isOrganizer && <OrganizerControls sweep={sweep} />}
      </div>
    </div>
  );
}

function ResultRow({ label, minute, owner }: { label: string; minute: number; owner?: string | null }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-white/70">
        {label} — minute {minute}
      </span>
      <span className="font-bold text-red-300">{owner ? `${owner} wins` : "Unclaimed — goes to the 100 CLUB"}</span>
    </div>
  );
}
