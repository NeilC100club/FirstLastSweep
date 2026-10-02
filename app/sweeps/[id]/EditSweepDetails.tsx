"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Sweep } from "@/lib/types";

// Lets the organiser (or a super user) fix the board's details after it's been
// created — a spelling mistake, the wrong date or kick-off time, the cause text.
export default function EditSweepDetails({ sweep }: { sweep: Sweep }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(sweep.name);
  const [eventDate, setEventDate] = useState(sweep.event_date || "");
  const [kickoffTime, setKickoffTime] = useState(sweep.kickoff_time?.slice(0, 5) || "");
  const [cause, setCause] = useState(sweep.cause || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reset() {
    setName(sweep.name);
    setEventDate(sweep.event_date || "");
    setKickoffTime(sweep.kickoff_time?.slice(0, 5) || "");
    setCause(sweep.cause || "");
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/sweeps/${sweep.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, event_date: eventDate, kickoff_time: kickoffTime, cause }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't save — try again.");
      return;
    }
    setOpen(false);
    setNotice(data.reopened ? "Saved — the board is open again until the new kick-off." : "Saved.");
    router.refresh();
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button
          onClick={() => {
            reset();
            setNotice(null);
            setOpen(true);
          }}
          className="px-5 py-3 rounded-lg border border-chalk/15 text-sm"
        >
          Edit board details
        </button>
        {notice && <p className="text-xs text-chalk/60 mt-2">{notice}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mt-4 w-full max-w-lg bg-pitch border border-chalk/10 rounded-2xl p-6 space-y-4">
      <h3 className="font-display text-lg">Edit board details</h3>

      <div>
        <label className="block text-xs font-mono tracking-wide text-chalk/60 mb-1.5">Event name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-chalk/5 border border-chalk/15 text-chalk"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-mono tracking-wide text-chalk/60 mb-1.5">Date</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-chalk/5 border border-chalk/15 text-chalk"
          />
        </div>
        <div>
          <label className="block text-xs font-mono tracking-wide text-chalk/60 mb-1.5">Kickoff</label>
          <input
            type="time"
            value={kickoffTime}
            onChange={(e) => setKickoffTime(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-chalk/5 border border-chalk/15 text-chalk"
          />
        </div>
      </div>
      <p className="text-xs text-chalk/50 -mt-2">The board closes automatically at this kick-off time (UK time).</p>

      <div>
        <label className="block text-xs font-mono tracking-wide text-chalk/60 mb-1.5">Cause (optional)</label>
        <textarea
          rows={3}
          value={cause}
          onChange={(e) => setCause(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-chalk/5 border border-chalk/15 text-chalk"
        />
      </div>

      <p className="text-xs text-chalk/50">
        Price per minute and the number of minutes can&apos;t be changed once people have started buying.
      </p>

      {error && <p className="text-red text-sm">{error}</p>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2.5 rounded-lg border border-chalk/15 text-sm">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2.5 rounded-lg bg-[var(--club-primary)] text-[var(--club-text-on-primary)] font-bold text-sm disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
