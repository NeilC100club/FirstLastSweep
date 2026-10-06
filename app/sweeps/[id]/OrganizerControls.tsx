"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Sweep } from "@/lib/types";

export default function OrganizerControls({ sweep, isAdmin = false }: { sweep: Sweep; isAdmin?: boolean }) {
  return (
    <>
      <StatusControls sweep={sweep} />
      {isAdmin && <ArchiveControl sweep={sweep} />}
    </>
  );
}

// Super user only: hide a board from the dashboard (or bring it back). Nothing is
// deleted, so buyer records and amounts are always kept.
function ArchiveControl({ sweep }: { sweep: Sweep }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    const warning =
      sweep.status === "finished"
        ? `Remove "${sweep.name}" from the dashboard? The records are kept and you can restore it later.`
        : `"${sweep.name}" hasn't finished yet. Remove it from the dashboard anyway? You can restore it later.`;
    if (!window.confirm(warning)) return;
    setWorking(true);
    const res = await fetch(`/api/sweeps/${sweep.id}`, { method: "DELETE" });
    setWorking(false);
    if (!res.ok) {
      setError((await res.json()).error || "Couldn't remove the board.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function restore() {
    setWorking(true);
    const res = await fetch(`/api/sweeps/${sweep.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    setWorking(false);
    if (!res.ok) {
      setError((await res.json()).error || "Couldn't restore the board.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4">
      {sweep.archived_at ? (
        <button onClick={restore} disabled={working} className="px-5 py-3 rounded-lg border border-chalk/15 text-sm disabled:opacity-60">
          {working ? "Restoring…" : "Restore board"}
        </button>
      ) : (
        <button
          onClick={archive}
          disabled={working}
          className="px-5 py-3 rounded-lg border border-red/40 text-red text-sm disabled:opacity-60"
        >
          {working ? "Removing…" : "Remove board"}
        </button>
      )}
      {error && <p className="text-red text-xs mt-2">{error}</p>}
    </div>
  );
}

function StatusControls({ sweep }: { sweep: Sweep }) {
  const router = useRouter();
  const [showResultForm, setShowResultForm] = useState(false);
  const [firstMin, setFirstMin] = useState("");
  const [lastMin, setLastMin] = useState("");
  const [noGoals, setNoGoals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);

  async function lockBoard() {
    if (!window.confirm("Lock the board now? Nobody will be able to buy after this, and everyone who bought gets the board PDF by email.")) return;
    setSaving(true);
    // Done on the server so the PDF email goes out to buyers straight away.
    await fetch(`/api/sweeps/${sweep.id}/lock`, { method: "POST" });
    setSaving(false);
    router.refresh();
  }

  async function submitResult(e: React.FormEvent) {
    e.preventDefault();
    const first = noGoals || firstMin === "" ? null : Number(firstMin);
    const last = noGoals || lastMin === "" ? null : Number(lastMin);
    const summary = noGoals
      ? "0-0, no goals"
      : `first goal minute ${first ?? "none"}, last goal minute ${last ?? "none"}`;
    if (!window.confirm(`Confirm the result: ${summary}?\n\nThis finishes the sweep and emails the result to everyone who bought with an email address. It can't be undone.`)) return;
    setSaving(true);
    setResultError(null);
    const res = await fetch(`/api/sweeps/${sweep.id}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first, last }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setResultError(data.error || "Couldn't save the result — try again.");
      return;
    }
    setShowResultForm(false);
    router.refresh();
  }

  if (sweep.status === "open") {
    return (
      <div className="mt-4">
        <button
          onClick={lockBoard}
          disabled={saving}
          className="px-5 py-3 rounded-lg border border-chalk/15 text-sm"
        >
          {saving ? "Locking…" : "Lock board now"}
        </button>
      </div>
    );
  }

  if (sweep.status === "locked") {
    return (
      <div className="mt-4">
        {!showResultForm ? (
          <button
            onClick={() => setShowResultForm(true)}
            className="px-5 py-3 rounded-lg bg-[var(--club-primary)] text-[var(--club-text-on-primary)] font-bold text-sm"
          >
            Enter result
          </button>
        ) : (
          <form
            onSubmit={submitResult}
            className="bg-pitch border border-chalk/10 rounded-2xl p-6 space-y-4 max-w-sm"
          >
            <h3 className="font-display text-lg">Enter the result</h3>

            <label className="flex items-center gap-2 text-sm text-chalk/75">
              <input
                type="checkbox"
                checked={noGoals}
                onChange={(e) => {
                  setNoGoals(e.target.checked);
                  if (e.target.checked) {
                    setFirstMin("");
                    setLastMin("");
                  }
                }}
              />
              Match finished 0-0
            </label>

            <div>
              <label className="block text-xs font-mono tracking-wide text-chalk/60 mb-1">
                First goal — minute
              </label>
              <input
                type="number"
                min={1}
                max={sweep.total_minutes}
                disabled={noGoals}
                value={firstMin}
                onChange={(e) => setFirstMin(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-chalk/5 border border-chalk/15 text-chalk disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-mono tracking-wide text-chalk/60 mb-1">
                Last goal — minute
              </label>
              <input
                type="number"
                min={1}
                max={sweep.total_minutes}
                disabled={noGoals}
                value={lastMin}
                onChange={(e) => setLastMin(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-chalk/5 border border-chalk/15 text-chalk disabled:opacity-50"
              />
            </div>

            <p className="text-xs text-chalk/50">
              Everyone who bought with an email address gets the result and the final board by email.
            </p>
            {resultError && <p className="text-red text-sm">{resultError}</p>}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResultForm(false)}
                className="px-4 py-2.5 rounded-lg border border-chalk/15 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2.5 rounded-lg bg-[var(--club-primary)] text-[var(--club-text-on-primary)] font-bold text-sm disabled:opacity-60"
              >
                {saving ? "Saving…" : "Confirm result"}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return null;
}
