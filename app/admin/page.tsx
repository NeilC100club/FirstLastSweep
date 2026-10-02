import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import type { Club } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import ClubsAdmin, { type Organiser } from "./ClubsAdmin";

// Super user screen: add and brand clubs, and appoint each club's organisers.
export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await isAdmin(supabase, user.id))) redirect("/dashboard");

  const service = createServiceClient();
  const [{ data: clubs }, { data: links }, { data: profiles }] = await Promise.all([
    service.from("clubs").select("*").order("name"),
    service.from("club_organisers").select("club_id, user_id"),
    service.from("profiles").select("id, name"),
  ]);

  // Emails live in Supabase's auth table, which only the server can read.
  const emails: Record<string, string> = {};
  for (let page = 1; page <= 20; page++) {
    const { data } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users || [];
    users.forEach((u: { id: string; email?: string }) => {
      if (u.email) emails[u.id] = u.email;
    });
    if (users.length < 1000) break;
  }
  const names: Record<string, string> = {};
  (profiles || []).forEach((p: { id: string; name: string }) => (names[p.id] = p.name));

  const organisers: Organiser[] = (links || []).map((l: { club_id: string; user_id: string }) => ({
    clubId: l.club_id,
    userId: l.user_id,
    name: names[l.user_id] || "",
    email: emails[l.user_id] || "",
  }));

  return (
    <div className="min-h-screen">
      <AppHeader admin />
      <div className="max-w-3xl mx-auto px-5 py-6 pb-20">
        <a href="/dashboard" className="text-sm text-chalk/60 mb-4 inline-block">
          ← All sweeps
        </a>
        <div className="font-mono text-[11px] tracking-widest text-chalk/50 mb-1">SUPER USER</div>
        <h1 className="font-display text-2xl sm:text-3xl mb-1">Clubs & organisers</h1>
        <p className="text-sm text-chalk/60 mb-6">
          Add a club with its badge and colours, then appoint who runs its sweeps. Organisers only see their own
          club&apos;s boards. All card payments come to your Stripe account.
        </p>
        <ClubsAdmin clubs={(clubs || []) as Club[]} organisers={organisers} siteUrl={process.env.NEXT_PUBLIC_SITE_URL || ""} />
      </div>
    </div>
  );
}
