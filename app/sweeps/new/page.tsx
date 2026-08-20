"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STANDARD_TERMS } from "@/lib/types";

export default function NewSweepPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [kickoffTime, setKickoffTime] = useState("");
  const [price, setPrice] = useState(2);
  const [totalMinutes, setTotalMinutes] = useState(90);
  const [cause, setCause] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: sweep, error: insertError } = await supabase
      .from("sweeps")
      .insert({
        organizer_id: user.id,
        name,
        event_date: eventDate || null,
        kickoff_time: kickoffTime || null,
        price_per_minute: Math.round(price * 100),
        total_minutes: totalMinutes,
        cause: cause || null,
      })
      .select()
      .single();

    if (insertError || !sweep) {
      setError(insertError?.message || "Something went wrong creating the sweep.");
      setLoading(false);
      return;
    }

    // Pre-populate minute rows 1..totalMinutes via the DB helper function.
    const { error: rpcError } = await supabase.rpc("create_sweep_minutes", {
      p_sweep_id: sweep.id,
      p_total_minutes: totalMinutes,
    });
    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    router.push(`/sweeps/${sweep.id}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-pitch border border-white/10 rounded-2xl p-8 space-y-4"
      >
        <h1 className="font-display text-2xl text-center mb-2">Set up a sweep</h1>

        <div>
          <label className="block text-xs font-mono tracking-wide text-white/60 mb-1">Event name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rovers vs City"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/15 text-chalk"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-mono tracking-wide text-white/60 mb-1">Date</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/15 text-chalk"
            />
          </div>
          <div>
            <label className="block text-xs font-mono tracking-wide text-white/60 mb-1">Kickoff</label>
            <input
              type="time"
              value={kickoffTime}
              onChange={(e) => setKickoffTime(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/15 text-chalk"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-mono tracking-wide text-white/60 mb-1">
              Price per minute (£)
            </label>
            <input
              type="number"
              min={1}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/15 text-chalk"
            />
          </div>
          <div>
            <label className="block text-xs font-mono tracking-wide text-white/60 mb-1">
              Minutes on the board
            </label>
            <input
              type="number"
              min={10}
              max={120}
              value={totalMinutes}
              onChange={(e) => setTotalMinutes(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/15 text-chalk"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono tracking-wide text-white/60 mb-1">
            Cause (optional)
          </label>
          <textarea
            rows={3}
            value={cause}
            onChange={(e) => setCause(e.target.value)}
            placeholder="e.g. Raising money for the youth team's new kit."
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/15 text-chalk"
          />
        </div>

        <div className="rounded-xl border border-red/20 bg-red/5 p-4">
          <div className="font-mono text-[11px] tracking-wide text-gold mb-2">
            STANDARD TERMS — APPLIED TO EVERY SWEEP
          </div>
          <ul className="list-disc pl-4 space-y-1 text-xs text-white/75">
            {STANDARD_TERMS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        {error && <p className="text-red text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-gold text-[#241C00] font-bold disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create sweep"}
        </button>
      </form>
    </div>
  );
}
