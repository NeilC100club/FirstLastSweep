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
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-5">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-pitch border border-white/10 rounded-2xl p-6 sm:p-8"
      >
        <div className="text-center mb-7">
          <div className="font-mono text-[11px] tracking-widest text-gold mb-1.5">NEW SWEEP</div>
          <h1 className="font-display text-2xl sm:text-3xl">Set up a sweep</h1>
        </div>

        {/* Match details */}
        <fieldset className="space-y-4">
          <legend className="font-mono text-[11px] tracking-widest text-white/50 mb-1">
            MATCH DETAILS
          </legend>
          <div>
            <label className="block text-xs font-mono tracking-wide text-white/60 mb-1.5">
              Event name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rovers vs City"
              className="w-full px-4 py-3.5 rounded-lg bg-white/5 border border-white/15 text-chalk placeholder:text-white/30"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono tracking-wide text-white/60 mb-1.5">Date</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-4 py-3.5 rounded-lg bg-white/5 border border-white/15 text-chalk"
              />
            </div>
            <div>
              <label className="block text-xs font-mono tracking-wide text-white/60 mb-1.5">
                Kickoff
              </label>
              <input
                type="time"
                value={kickoffTime}
                onChange={(e) => setKickoffTime(e.target.value)}
                className="w-full px-4 py-3.5 rounded-lg bg-white/5 border border-white/15 text-chalk"
              />
            </div>
          </div>
        </fieldset>

        <div className="h-px bg-white/10 my-6" />

        {/* Pricing */}
        <fieldset className="space-y-4">
          <legend className="font-mono text-[11px] tracking-widest text-white/50 mb-1">
            THE BOARD
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono tracking-wide text-white/60 mb-1.5">
                Price per minute
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50">£</span>
                <input
                  type="number"
                  min={1}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-3.5 rounded-lg bg-white/5 border border-white/15 text-chalk"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono tracking-wide text-white/60 mb-1.5">
                Minutes on the board
              </label>
              <input
                type="number"
                min={10}
                max={120}
                value={totalMinutes}
                onChange={(e) => setTotalMinutes(Number(e.target.value))}
                className="w-full px-4 py-3.5 rounded-lg bg-white/5 border border-white/15 text-chalk"
              />
            </div>
          </div>
          <p className="text-xs text-white/40">
            Board runs minute 1 to {totalMinutes || 90} · prize pool = {totalMinutes || 90} × £
            {price || 0}, half goes to the 100 Club
          </p>
        </fieldset>

        <div className="h-px bg-white/10 my-6" />

        {/* About */}
        <fieldset>
          <legend className="font-mono text-[11px] tracking-widest text-white/50 mb-1.5">
            ABOUT THIS SWEEP
          </legend>
          <label className="block text-xs font-mono tracking-wide text-white/60 mb-1.5">
            Cause (optional)
          </label>
          <textarea
            rows={3}
            value={cause}
            onChange={(e) => setCause(e.target.value)}
            placeholder="e.g. Raising money for the youth team's new kit."
            className="w-full px-4 py-3.5 rounded-lg bg-white/5 border border-white/15 text-chalk placeholder:text-white/30"
          />
        </fieldset>

        <div className="rounded-xl border border-red/20 bg-red/5 p-4 mt-6">
          <div className="font-mono text-[11px] tracking-wide text-gold mb-2">
            STANDARD TERMS — APPLIED TO EVERY SWEEP
          </div>
          <ul className="list-disc pl-4 space-y-1.5 text-xs text-white/75 leading-relaxed">
            {STANDARD_TERMS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        {error && (
          <p className="text-red text-sm mt-4 bg-red/10 border border-red/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-lg bg-gold text-[#241C00] font-bold text-base disabled:opacity-60 mt-6 transition-opacity"
        >
          {loading ? "Creating…" : "Create sweep"}
        </button>
      </form>
    </div>
  );
}
