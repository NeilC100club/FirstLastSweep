"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Club } from "@/lib/types";

export type Organiser = { clubId: string; userId: string; name: string; email: string };

export default function ClubsAdmin({
  clubs,
  organisers,
  siteUrl,
}: {
  clubs: Club[];
  organisers: Organiser[];
  siteUrl: string;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-5">
      {clubs.map((club) => (
        <ClubCard
          key={club.id}
          club={club}
          organisers={organisers.filter((o) => o.clubId === club.id)}
          siteUrl={siteUrl}
        />
      ))}
      {adding ? (
        <div className="bg-pitch border border-chalk/10 rounded-2xl p-5">
          <h2 className="font-display text-lg mb-4">New club</h2>
          <ClubForm onDone={() => setAdding(false)} />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-chalk/20 text-sm font-semibold text-chalk/70"
        >
          + Add a club
        </button>
      )}
    </div>
  );
}

function ClubCard({ club, organisers, siteUrl }: { club: Club; organisers: Organiser[]; siteUrl: string }) {
  const [editing, setEditing] = useState(false);
  const link = club.slug ? `${siteUrl}/c/${club.slug}` : null;
  const [copied, setCopied] = useState(false);

  return (
    <div className="bg-pitch border border-chalk/10 rounded-2xl overflow-hidden">
      <div
        className="flex items-center gap-4 p-4"
        style={{ backgroundColor: club.primary_color, color: club.text_on_primary }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={club.logo_url || "/logo.png"} alt="" className="h-12 w-auto" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight truncate">{club.name}</div>
          <div className="text-xs opacity-75">
            {club.short_name} · {club.fundraiser_name}
          </div>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
          style={{ borderColor: club.text_on_primary }}
        >
          {editing ? "Close" : "Edit"}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {editing && <ClubForm club={club} onDone={() => setEditing(false)} />}

        {link && (
          <div className="text-sm">
            <div className="font-mono text-[11px] tracking-wide text-chalk/50 mb-1">CLUB LINK FOR BUYERS</div>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-chalk/5 rounded px-2 py-1.5 truncate">{link}</code>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="text-xs px-2.5 py-1.5 rounded border border-chalk/15 shrink-0"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <Organisers clubId={club.id} organisers={organisers} />
      </div>
    </div>
  );
}

function Organisers({ clubId, organisers }: { clubId: string; organisers: Organiser[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/organisers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId, email }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error || "Couldn't add them.");
      return;
    }
    setEmail("");
    router.refresh();
  }

  async function remove(o: Organiser) {
    if (!window.confirm(`Remove ${o.name || o.email} as an organiser? Their existing sweeps stay as they are.`)) return;
    await fetch("/api/admin/organisers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId, userId: o.userId }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="font-mono text-[11px] tracking-wide text-chalk/50 mb-2">ORGANISERS</div>
      {organisers.length === 0 && <p className="text-sm text-chalk/50 mb-2">No organisers yet.</p>}
      <ul className="space-y-1.5 mb-3">
        {organisers.map((o) => (
          <li key={o.userId} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              <strong>{o.name || "—"}</strong> <span className="text-chalk/60">{o.email}</span>
            </span>
            <button onClick={() => remove(o)} className="text-xs text-red shrink-0">
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Their login email"
          className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-chalk/5 border border-chalk/15 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2.5 rounded-lg bg-chalk text-white text-sm font-semibold disabled:opacity-60 shrink-0"
        >
          {busy ? "Adding…" : "Add organiser"}
        </button>
      </form>
      <p className="text-xs text-chalk/50 mt-1.5">They need to have signed up to the app first.</p>
      {error && <p className="text-red text-sm mt-2">{error}</p>}
    </div>
  );
}

function ClubForm({ club, onDone }: { club?: Club; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(club?.name || "");
  const [shortName, setShortName] = useState(club?.short_name || "");
  const [slug, setSlug] = useState(club?.slug || "");
  const [fundraiser, setFundraiser] = useState(club?.fundraiser_name || "Club Fund");
  const [primary, setPrimary] = useState(club?.primary_color || "#F2A900");
  const [secondary, setSecondary] = useState(club?.secondary_color || "#161412");
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/clubs", {
      method: club ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: club?.id,
        name,
        short_name: shortName,
        slug,
        fundraiser_name: fundraiser,
        primary_color: primary,
        secondary_color: secondary,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(data.error || "Couldn't save the club.");
      return;
    }
    const clubId = club?.id || data.club?.id;
    if (logo && clubId) {
      const form = new FormData();
      form.append("clubId", clubId);
      form.append("file", logo);
      const up = await fetch("/api/admin/clubs/logo", { method: "POST", body: form });
      if (!up.ok) {
        setBusy(false);
        setError(`Club saved, but the badge didn't upload: ${(await up.json()).error || "try again"}`);
        router.refresh();
        return;
      }
    }
    setBusy(false);
    onDone();
    router.refresh();
  }

  const field = "w-full px-3 py-2.5 rounded-lg bg-chalk/5 border border-chalk/15 text-sm";
  const label = "block text-xs font-mono tracking-wide text-chalk/60 mb-1";

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        <label className={label}>Club name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Graig Villa Dino" className={field} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Short name</label>
          <input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="e.g. GVD" className={field} />
        </div>
        <div>
          <label className={label}>Fundraising pot is called</label>
          <input value={fundraiser} onChange={(e) => setFundraiser(e.target.value)} placeholder="e.g. 100 Club" className={field} />
        </div>
      </div>
      <div>
        <label className={label}>Club link</label>
        <div className="flex items-center gap-1 text-sm">
          <span className="text-chalk/50">/c/</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="gvd" className={field} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Main colour</label>
          <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="w-full h-11 rounded-lg border border-chalk/15" />
        </div>
        <div>
          <label className={label}>Second colour</label>
          <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="w-full h-11 rounded-lg border border-chalk/15" />
        </div>
      </div>
      <div>
        <label className={label}>Badge {club?.logo_url ? "(leave empty to keep the current one)" : ""}</label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={(e) => setLogo(e.target.files?.[0] || null)}
          className="text-sm"
        />
      </div>
      {error && <p className="text-red text-sm">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="px-4 py-2.5 rounded-lg border border-chalk/15 text-sm">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="px-4 py-2.5 rounded-lg bg-chalk text-white text-sm font-semibold disabled:opacity-60">
          {busy ? "Saving…" : club ? "Save club" : "Add club"}
        </button>
      </div>
    </form>
  );
}
