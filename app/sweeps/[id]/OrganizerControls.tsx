"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Sweep } from "@/lib/types";

export default function OrganizerControls({ sweep }: { sweep: Sweep }) {
  const router = useRouter();
  const supabase = createClient();
  const [showResultForm, setShowResultForm] = useState(false);
  const [firstMin, setFirstMin] = useState("");
  const [lastMin, setLastMin] = useState("");
  const [noGoals, setNoGoals] = useState(false);
  const [saving, setSaving] = useState(false);

  async function lockBoard() {
    setSaving(true);
    await supabase.from("sweeps").update({ status: "locked" }).eq("id", sweep.id);
    setSaving(false);
    router.refresh();
  }

  async function submitResult(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from("sweeps")
      .update({
        goal_minute_first: noGoals || firstMin === "" ? null : Number(firstMin),
        goal_minute_last: noGoals || lastMin === "" ? null : Number(lastMin),
        status: "finished",
      })
      .eq("id", sweep.id);
    setSaving(false);
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
          {saving ? "Locking…" : "Lock board & kick off"}
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
            className="px-5 py-3 rounded-lg bg-gold text-[#241C00] font-bold text-sm"
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
                className="px-4 py-2.5 rounded-lg bg-gold text-[#241C00] font-bold text-sm disabled:opacity-60"
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
