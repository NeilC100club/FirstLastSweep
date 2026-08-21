"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Minute, Sweep } from "@/lib/types";

export default function MinuteBoard({
  sweep,
  minutes,
  currentUserId,
  organizerStripeOnboarded,
}: {
  sweep: Sweep;
  minutes: Minute[];
  currentUserId: string;
  organizerStripeOnboarded: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [selected, setSelected] = useState<number[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live updates: refresh the page's server data whenever any minute for this
  // sweep changes (another buyer claims one, or the organiser locks/finishes it).
  useEffect(() => {
    const channel = supabase
      .channel(`sweep-${sweep.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "minutes", filter: `sweep_id=eq.${sweep.id}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sweeps", filter: `id=eq.${sweep.id}` },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sweep.id, supabase, router]);

  function toggle(minute: number, owner: string | null) {
    if (sweep.status !== "open" || owner) return;
    setSelected((prev) =>
      prev.includes(minute) ? prev.filter((m) => m !== minute) : [...prev, minute]
    );
  }

  async function startCheckout() {
    setError(null);
    if (!organizerStripeOnboarded) {
      setError("This sweep's organiser hasn't finished setting up payouts yet — check back soon.");
      return;
    }
    setCheckingOut(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sweepId: sweep.id, minutes: selected }),
    });
    const data = await res.json();
    setCheckingOut(false);
    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error || "Couldn't start checkout — try again.");
    }
  }

  const total = (selected.length * sweep.price_per_minute) / 100;

  return (
    <div>
      <div className="bg-pitch border border-white/10 rounded-2xl p-3 sm:p-5">
        <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 sm:gap-2">
          {minutes.map((m) => {
            const isMine = m.owner_id === currentUserId;
            const isSelected = selected.includes(m.minute);
            const isWinner =
              sweep.status === "finished" &&
              (m.minute === sweep.goal_minute_first || m.minute === sweep.goal_minute_last);
            const clickable = !m.owner_name && sweep.status === "open";

            let bg = "bg-white/5 hover:bg-white/10";
            let textColor = "text-chalk";
            if (isWinner) {
              bg = "bg-red";
              textColor = "text-[#241C00]";
            } else if (isMine) {
              bg = "bg-gold";
              textColor = "text-[#241C00]";
            } else if (m.owner_name) {
              bg = "bg-[#274A3B]";
              textColor = "text-chalk/90";
            } else if (isSelected) {
              bg = "bg-gold/25 hover:bg-gold/30";
            }

            return (
              <button
                key={m.minute}
                onClick={() => toggle(m.minute, m.owner_name)}
                disabled={!clickable}
                title={m.owner_name ? `Claimed by ${m.owner_name}` : "Available"}
                className={`aspect-[0.85] rounded-md border transition-colors duration-100 ${
                  isSelected ? "border-gold border-2" : "border-white/15"
                } ${bg} ${textColor} flex flex-col items-center justify-center overflow-hidden text-[11px] sm:text-[12px] font-mono ${
                  clickable ? "cursor-pointer active:scale-95" : "cursor-not-allowed"
                } ${isWinner ? "animate-[pulse_1.4s_ease-in-out_2]" : ""}`}
              >
                {m.owner_name ? (
                  <>
                    <span className="text-[8px] sm:text-[9px] font-bold uppercase truncate max-w-full px-0.5 leading-tight">
                      {m.owner_name}
                    </span>
                    <span className="text-[7px] sm:text-[8px] opacity-70 leading-tight">{m.minute}</span>
                  </>
                ) : (
                  m.minute
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between items-center flex-wrap gap-4 mt-5">
        <div className="flex gap-4 flex-wrap text-xs text-white/70">
          <Legend swatch="bg-white/5 border border-white/20" label="Open" />
          <Legend swatch="bg-[#274A3B]" label="Taken" />
          <Legend swatch="bg-gold" label="Yours" />
          {sweep.status === "finished" && <Legend swatch="bg-red" label="Winner" />}
        </div>

        {/* Desktop/tablet buy button — inline, only shown alongside the legend */}
        {sweep.status === "open" && selected.length > 0 && (
          <button
            onClick={startCheckout}
            disabled={checkingOut}
            className="hidden sm:block px-5 py-3 rounded-lg bg-gold text-[#241C00] font-bold text-sm disabled:opacity-60"
          >
            {checkingOut
              ? "Starting checkout…"
              : `Buy ${selected.length} minute${selected.length > 1 ? "s" : ""} — £${total.toFixed(2)}`}
          </button>
        )}
      </div>

      {error && <p className="text-red text-sm mt-3">{error}</p>}

      {/* Mobile — sticky bar at the bottom of the screen so the buy button is always reachable */}
      {sweep.status === "open" && selected.length > 0 && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-pitchDark border-t border-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-20">
          <button
            onClick={startCheckout}
            disabled={checkingOut}
            className="w-full py-4 rounded-lg bg-gold text-[#241C00] font-bold text-base disabled:opacity-60"
          >
            {checkingOut
              ? "Starting checkout…"
              : `Buy ${selected.length} minute${selected.length > 1 ? "s" : ""} — £${total.toFixed(2)}`}
          </button>
        </div>
      )}
      {/* Spacer so the sticky bar never covers content underneath it on mobile */}
      {sweep.status === "open" && selected.length > 0 && <div className="sm:hidden h-20" />}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-3.5 h-3.5 rounded ${swatch}`} />
      {label}
    </span>
  );
}
