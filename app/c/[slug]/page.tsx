import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clubThemeStyle, type Club } from "@/lib/types";
import { getRole } from "@/lib/admin";
import { claimedCounts, sortForDisplay, type SweepWithClub } from "@/lib/sweeps";
import AppHeader from "@/components/AppHeader";
import SweepCard from "@/components/SweepCard";
import HowItWorks from "@/components/HowItWorks";

// A club's own page — the link organisers share (e.g. /c/gvd). Shows only that
// club's boards, in its badge and colours, and remembers it as the buyer's club.
export default async function ClubPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/c/${encodeURIComponent(params.slug)}`);

  const { data: clubRow } = await supabase.from("clubs").select("*").eq("slug", params.slug).maybeSingle();
  if (!clubRow) notFound();
  const club = clubRow as Club;

  const [role, { data: profile }] = await Promise.all([
    getRole(supabase, user.id),
    supabase.from("profiles").select("name, home_club_id").eq("id", user.id).single(),
  ]);

  // Remember this as the buyer's club, so their dashboard brings them straight back here.
  if (profile && profile.home_club_id !== club.id) {
    await supabase.from("profiles").update({ home_club_id: club.id }).eq("id", user.id);
  }

  const { data } = await supabase
    .from("sweeps")
    .select("*, club:clubs(*)")
    .eq("club_id", club.id)
    .is("archived_at", null);
  const sweeps = sortForDisplay((data || []) as SweepWithClub[]);
  const counts = await claimedCounts(
    supabase,
    sweeps.map((s) => s.id)
  );
  const open = sweeps.filter((s) => s.status === "open");
  const others = sweeps.filter((s) => s.status !== "open");

  return (
    <div className="min-h-screen" style={clubThemeStyle(club)}>
      <AppHeader club={club} name={profile?.name} admin={role.admin} />

      <div className="max-w-4xl mx-auto px-5 py-6 pb-20">
        <div className="flex items-center gap-4 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={club.logo_url || "/logo.png"} alt={club.short_name} className="h-16 w-auto" />
          <div>
            <h1 className="font-display text-2xl sm:text-3xl leading-tight">{club.name}</h1>
            <div className="text-sm text-chalk/60">First and Last Goal Sweep · raising money for the {club.fundraiser_name}</div>
          </div>
        </div>

        <HowItWorks fundraiserName={club.fundraiser_name} />

        <div className="font-mono text-xs tracking-widest text-chalk/50 mb-3">OPEN FOR MINUTES</div>
        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          {open.map((s) => (
            <SweepCard key={s.id} sweep={s} claimed={counts[s.id] || 0} showClub={false} />
          ))}
          {open.length === 0 && (
            <p className="text-chalk/60 text-sm col-span-2">No boards open right now — check back before the next match.</p>
          )}
        </div>

        {others.length > 0 && (
          <>
            <div className="font-mono text-xs tracking-widest text-chalk/50 mb-3">RECENT</div>
            <div className="grid gap-4 sm:grid-cols-2">
              {others.map((s) => (
                <SweepCard key={s.id} sweep={s} claimed={counts[s.id] || 0} showClub={false} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
