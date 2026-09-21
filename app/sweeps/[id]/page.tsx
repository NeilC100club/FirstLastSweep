import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { standardTerms, clubThemeStyle, DEFAULT_CLUB, type Club } from "@/lib/types";
import MinuteBoard from "./MinuteBoard";
import OrganizerControls from "./OrganizerControls";

export default async function SweepPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sweep } = await supabase
    .from("sweeps")
    .select("*, club:clubs(*)")
    .eq("id", params.id)
    .single();
  if (!sweep) notFound();
  const club: Club = (sweep as unknown as { club: Club | null }).club || DEFAULT_CLUB;

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
    <div className="min-h-screen" style={clubThemeStyle(club)}>
      <div className="max-w-4xl mx-auto px-5 py-6 pb-20">
        <a href="/dashboard" className="text-sm text-chalk/60 mb-4 inline-block">
          ← All sweeps
        </a>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-4 mb-5">
          <div className="min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={club.logo_url || "/logo.png"} alt={club.short_name} className="h-12 w-auto mb-1" />
            <div className="font-mono text-[10px] tracking-widest text-[var(--club-primary)] font-bold mb-2">
              {club.short_name.toUpperCase()} {club.fundraiser_name.toUpperCase()}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl mb-2 leading-tight">{sweep.name}</h1>
            <div className="text-sm text-chalk/60 leading-relaxed">
              {sweep.event_date}
              {sweep.kickoff_time ? ` · ${sweep.kickoff_time.slice(0, 5)} kickoff` : ""}
              <br className="sm:hidden" />
              <span className="hidden sm:inline"> · </span>
              Organised by {organizerProfile?.name} · £{(sweep.price_per_minute / 100).toFixed(2)} per
              minute
            </div>
          </div>
          <div className="w-full sm:w-auto text-left sm:text-right bg-[rgb(var(--club-primary-rgb)/10%)] border border-[rgb(var(--club-primary-rgb)/30%)] rounded-xl px-5 py-3.5 sm:min-w-[150px] flex sm:block justify-between items-center">
            <div>
              <div className="font-mono text-[11px] text-chalk/60 tracking-wide">Prize pool</div>
              <div className="font-display text-3xl text-[var(--club-primary)] leading-tight">
                £{prizePool.toFixed(2)}
              </div>
            </div>
            <div className="text-xs text-chalk/50">
              {claimedCount} / {sweep.total_minutes} claimed
            </div>
          </div>
        </div>

        {sweep.cause && (
          <div className="bg-chalk/5 border border-chalk/10 rounded-xl p-4 mb-4">
            <div className="font-mono text-[11px] text-chalk/50 tracking-wide mb-2">THE CAUSE</div>
            <p className="text-sm text-chalk/80">{sweep.cause}</p>
          </div>
        )}

        <div className="bg-chalk/5 border border-chalk/10 rounded-xl p-4 mb-5">
          <div className="font-mono text-[11px] text-chalk/50 tracking-wide mb-2">STANDARD TERMS</div>
          <ul className="list-disc pl-4 space-y-1 text-xs text-chalk/75">
            {standardTerms(club.fundraiser_name).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        {sweep.status === "finished" && (sweep.goal_minute_first || sweep.goal_minute_last) && (
          <div className="bg-[rgb(var(--club-primary-rgb)/10%)] border border-[rgb(var(--club-primary-rgb)/30%)] rounded-xl p-4 mb-5 space-y-2">
            {sweep.goal_minute_first && (
              <ResultRow
                label="First goal"
                minute={sweep.goal_minute_first}
                owner={minutes?.find((m) => m.minute === sweep.goal_minute_first)?.owner_name}
                fundraiserName={club.fundraiser_name}
              />
            )}
            {sweep.goal_minute_last && (
              <ResultRow
                label="Last goal"
                minute={sweep.goal_minute_last}
                owner={minutes?.find((m) => m.minute === sweep.goal_minute_last)?.owner_name}
                fundraiserName={club.fundraiser_name}
              />
            )}
          </div>
        )}

        <MinuteBoard
          sweep={sweep}
          club={club}
          minutes={minutes || []}
          currentUserId={user.id}
          organizerStripeOnboarded={!!organizerProfile?.stripe_onboarded}
          organizerName={organizerProfile?.name}
        />

        {isOrganizer && (
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <OrganizerControls sweep={sweep} />
            <a
              href={`/sweeps/${sweep.id}/buyers`}
              className="text-sm text-[var(--club-primary)] hover:underline"
            >
              View buyers & contact details →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({
  label,
  minute,
  owner,
  fundraiserName,
}: {
  label: string;
  minute: number;
  owner?: string | null;
  fundraiserName: string;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-chalk/70">
        {label} — minute {minute}
      </span>
      <span className={`font-bold ${owner ? "text-[var(--club-primary)]" : "text-chalk/50"}`}>
        {owner ? `${owner} wins` : `Unclaimed — goes to the ${fundraiserName}`}
      </span>
    </div>
  );
}
