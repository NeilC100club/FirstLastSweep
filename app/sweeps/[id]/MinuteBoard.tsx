"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Minute, Sweep } from "@/lib/types";

export default function MinuteBoard({
  sweep,
  minutes,
  currentUserId,
  organizerStripeOnboarded,
  organizerName,
}: {
  sweep: Sweep;
  minutes: Minute[];
  currentUserId: string;
  organizerStripeOnboarded: boolean;
  organizerName?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [selected, setSelected] = useState<number[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  async function downloadPdf() {
    if (!gridRef.current) return;
    setExportingPdf(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(gridRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const imgData = canvas.toDataURL("image/png");

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;
      let y = margin;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(sweep.name, margin, y);
      y += 22;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      const meta = [
        sweep.event_date,
        sweep.kickoff_time ? `${sweep.kickoff_time.slice(0, 5)} kickoff` : null,
        organizerName ? `Organised by ${organizerName}` : null,
        `£${(sweep.price_per_minute / 100).toFixed(2)} per minute`,
      ]
        .filter(Boolean)
        .join("   ·   ");
      doc.text(meta, margin, y);
      y += 24;

      const claimedCount = minutes.filter((m) => m.owner_name).length;
      const totalCollected = claimedCount * sweep.price_per_minute;
      const prizePot = totalCollected / 2;
      const clubPot = totalCollected / 2;

      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Prize pool", margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Total collected: £${(totalCollected / 100).toFixed(2)}`, margin, y);
      y += 14;
      doc.text(`Prize pot (50%): £${(prizePot / 100).toFixed(2)}`, margin, y);
      y += 14;
      doc.text(`100 Club fundraising pot (50%): £${(clubPot / 100).toFixed(2)}`, margin, y);
      y += 22;

      if (sweep.status === "finished") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Result", margin, y);
        y += 16;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        const describeGoal = (label: string, minute: number | null) => {
          if (!minute) return;
          const w = minutes.find((m) => m.minute === minute);
          const outcome = w?.owner_name ? `${w.owner_name} wins` : "Unclaimed — goes to the 100 CLUB";
          doc.text(`${label} — minute ${minute}: ${outcome}`, margin, y);
          y += 14;
        };
        describeGoal("First goal", sweep.goal_minute_first);
        describeGoal("Last goal", sweep.goal_minute_last);
        y += 8;
      }

      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      doc.addImage(imgData, "PNG", margin, y, imgWidth, imgHeight);

      const safeName = sweep.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
      doc.save(`${safeName || "sweep"}-board.pdf`);
    } finally {
      setExportingPdf(false);
    }
  }

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
      <div ref={gridRef} className="bg-pitch border border-chalk/10 rounded-2xl p-3 sm:p-5">
        <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 sm:gap-2">
          {minutes.map((m) => {
            const isMine = m.owner_id === currentUserId;
            const isSelected = selected.includes(m.minute);
            const isWinner =
              sweep.status === "finished" &&
              (m.minute === sweep.goal_minute_first || m.minute === sweep.goal_minute_last);
            const clickable = !m.owner_name && sweep.status === "open";

            let bg = "bg-chalk/5 hover:bg-chalk/10";
            let textColor = "text-chalk";
            if (isWinner) {
              bg = "bg-red";
              textColor = "text-[#241C00]";
            } else if (isMine) {
              bg = "bg-gold";
              textColor = "text-[#241C00]";
            } else if (m.owner_name) {
              bg = "bg-[#4C7A5A]";
              textColor = "text-white/95";
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
                  isSelected ? "border-gold border-2" : "border-chalk/15"
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
        <div className="flex gap-4 flex-wrap text-xs text-chalk/70">
          <Legend swatch="bg-chalk/5 border border-chalk/20" label="Open" />
          <Legend swatch="bg-[#4C7A5A]" label="Taken" />
          <Legend swatch="bg-gold" label="Yours" />
          {sweep.status === "finished" && <Legend swatch="bg-red" label="Winner" />}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={downloadPdf}
            disabled={exportingPdf}
            className="px-4 py-2.5 rounded-lg border border-chalk/15 text-sm font-semibold disabled:opacity-60"
          >
            {exportingPdf ? "Preparing PDF…" : "Download PDF"}
          </button>

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
      </div>

      {error && <p className="text-red text-sm mt-3">{error}</p>}

      {/* Mobile — sticky bar at the bottom of the screen so the buy button is always reachable */}
      {sweep.status === "open" && selected.length > 0 && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-pitchDark border-t border-chalk/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-20">
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
