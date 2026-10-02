import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { clubThemeStyle, type Club } from "@/lib/types";
import { getRole } from "@/lib/admin";
import { claimedCounts, sortForDisplay, type SweepWithClub } from "@/lib/sweeps";
import AppHeader from "@/components/AppHeader";
import SweepCard from "@/components/SweepCard";
import HowItWorks from "@/components/HowItWorks";

// One dashboard, three views:
//  - super user: every club's boards (plus removed boards) and the clubs & organisers screen
//  - organiser: only the boards for the club(s) they've been appointed to, in that club's colours
//  - buyer: sent to their own club's page; if we don't know their club yet, they pick one
export default async function DashboardPage({ searchParams }: { searchParams: { archived?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [role, { data: profile }] = await Promise.all([
    getRole(supabase, user.id),
    supabase.from("profiles").select("name, home_club_id").eq("id", user.id).single(),
  ]);

  // ---- Buyers --------------------------------------------------------------
  if (!role.isOrganiser) {
    if (profile?.home_club_id) {
      const { data: home } = await supabase.from("clubs").select("slug").eq("id", profile.home_club_id).maybeSingle();
      if (home?.slug) redirect(`/c/${home.slug}`);
    }
    const { data: clubs } = await supabase.from("clubs").select("*").order("name");
    return (
      <div className="min-h-screen">
        <AppHeader name={profile?.name} />
        <div className="max-w-3xl mx-auto px-5 py-8">
          <h1 className="font-display text-2xl mb-1">Which club are you here for?</h1>
          <p className="text-sm text-chalk/60 mb-6">Pick your club to see its sweeps.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(clubs || []).map((c: Club) => (
              <Link
                key={c.id}
                href={`/c/${c.slug}`}
                className="flex items-center gap-4 rounded-2xl p-4 border border-chalk/10"
                style={{ backgroundColor: c.primary_color, color: c.text_on_primary }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.logo_url || "/logo.png"} alt="" className="h-12 w-auto" />
                <div>
                  <div className="font-display text-lg leading-tight">{c.name}</div>
                  <div className="text-xs opacity-75">{c.fundraiser_name}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- Organisers and the super user --------------------------------------
  const showArchived = role.admin && searchParams.archived === "1";

  let query = supabase.from("sweeps").select("*, club:clubs(*)").order("created_at", { ascending: false });
  query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (!role.admin) query = query.in("club_id", role.clubIds);
  const { data } = await query;
  const sweeps = sortForDisplay((data || []) as SweepWithClub[]);
  const counts = await claimedCounts(
    supabase,
    sweeps.map((s) => s.id)
  );

  // An organiser who runs exactly one club gets that club's badge and colours throughout.
  let club: Club | null = null;
  if (!role.admin && role.clubIds.length === 1) {
    const { data: c } = await supabase.from("clubs").select("*").eq("id", role.clubIds[0]).maybeSingle();
    club = (c as Club) || null;
  }

  return (
    <div className="min-h-screen" style={club ? clubThemeStyle(club) : undefined}>
      <AppHeader club={club} name={profile?.name} admin={role.admin} />

      <div className="max-w-4xl mx-auto px-5 py-6 pb-20">
        <HowItWorks fundraiserName={club?.fundraiser_name} />

        <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
          <div>
            <div className="font-mono text-xs tracking-widest text-chalk/50 mb-1">
              {showArchived ? "REMOVED BOARDS" : role.admin ? "ALL CLUBS" : club ? club.name.toUpperCase() : "YOUR CLUBS"}
            </div>
            <h1 className="font-display text-2xl">
              {showArchived ? "Open one to restore it." : "Kick off a new one, or jump back in."}
            </h1>
            {role.admin && (
              <div className="flex gap-4 mt-1">
                <Link
                  href={showArchived ? "/dashboard" : "/dashboard?archived=1"}
                  className="text-xs text-chalk/60 underline"
                >
                  {showArchived ? "← Back to current boards" : "View removed boards"}
                </Link>
                <Link href="/admin" className="text-xs text-chalk/60 underline">
                  Clubs & organisers
                </Link>
              </div>
            )}
          </div>
          {!showArchived && (
            <Link
              href="/sweeps/new"
              className="px-5 py-3 rounded-lg font-bold text-sm"
              style={{
                backgroundColor: club?.primary_color || "#F2A900",
                color: club?.text_on_primary || "#241C00",
              }}
            >
              + New sweep
            </Link>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {sweeps.map((s) => (
            <SweepCard key={s.id} sweep={s} claimed={counts[s.id] || 0} showClub={!club} />
          ))}
          {sweeps.length === 0 && (
            <p className="text-chalk/60 text-sm col-span-2">
              {showArchived ? "No removed boards." : "No sweeps yet — create your first one above."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
