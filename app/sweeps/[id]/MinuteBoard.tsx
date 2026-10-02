"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Club, Minute, Sweep } from "@/lib/types";
import { DEFAULT_CLUB, boardSections } from "@/lib/types";
import { buildBoardPdf, boardPdfFileName } from "@/lib/boardPdf";

export default function MinuteBoard({
  sweep,
  club = DEFAULT_CLUB,
  minutes,
  currentUserId,
  canAllocate = false,
  organizerName,
}: {
  canAllocate?: boolean;
  sweep: Sweep;
  club?: Club;
  minutes: Minute[];
  currentUserId: string;
  organizerStripeOnboarded?: boolean; // no longer used — all payments go to the main account
  organizerName?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [selected, setSelected] = useState<number[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  // Cash mode: the organiser / super user writes names straight onto the board.
  const [cashMode, setCashMode] = useState(false);
  const [cashName, setCashName] = useState("");
  const [cashEmail, setCashEmail] = useState("");
  const [allocating, setAllocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function downloadPdf() {
    setExportingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = buildBoardPdf(jsPDF, {
        sweep,
        minutes,
        fundraiserName: club.fundraiser_name,
        organizerName,
      });
      doc.save(boardPdfFileName(sweep.name));
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

  function toggle(m: Minute) {
    if (cashMode) {
      if (m.owner_name) {
        if (m.payment_method === "cash") removeCash(m);
        return;
      }
      if (sweep.status === "finished") return;
    } else if (sweep.status !== "open" || m.owner_name) {
      return;
    }
    setSelected((prev) =>
      prev.includes(m.minute) ? prev.filter((x) => x !== m.minute) : [...prev, m.minute]
    );
  }

  function switchMode(next: boolean) {
    setCashMode(next);
    setSelected([]);
    setError(null);
    setNotice(null);
  }

  async function allocateCash(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setAllocating(true);
    const res = await fetch(`/api/sweeps/${sweep.id}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes: selected, name: cashName, email: cashEmail }),
    });
    const data = await res.json();
    setAllocating(false);
    if (!res.ok) {
      setError(data.error || "Couldn't allocate — try again.");
      return;
    }
    if (data.error) setError(data.error);
    if (data.allocated?.length) {
      setNotice(`${cashName.trim()} added to minute${data.allocated.length > 1 ? "s" : ""} ${data.allocated.join(", ")}.`);
    }
    setSelected([]);
    setCashName("");
    setCashEmail("");
    router.refresh();
  }

  async function removeCash(m: Minute) {
    if (!window.confirm(`Remove ${m.owner_name} from minute ${m.minute}? Only do this if the cash is being refunded or it was entered by mistake.`)) return;
    setError(null);
    const res = await fetch(`/api/sweeps/${sweep.id}/allocate`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minute: m.minute }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Couldn't remove that minute.");
    else setNotice(`Minute ${m.minute} is open again.`);
    router.refresh();
  }

  async function startCheckout() {
    setError(null);
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
      {canAllocate && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="inline-flex rounded-lg border border-chalk/15 p-1 text-sm">
            <button
              onClick={() => switchMode(false)}
              className={`px-3 py-1.5 rounded-md ${!cashMode ? "bg-chalk text-white" : "text-chalk/70"}`}
            >
              Card sales
            </button>
            <button
              onClick={() => switchMode(true)}
              className={`px-3 py-1.5 rounded-md ${cashMode ? "bg-chalk text-white" : "text-chalk/70"}`}
            >
              Add cash names
            </button>
          </div>
          {cashMode && (
            <span className="text-xs text-chalk/60">
              Tap open minutes, then enter the name. Tap a minute marked CASH to remove it.
            </span>
          )}
        </div>
      )}

      <div className="space-y-4">
        {boardSections(minutes).map((section) => (
          <section key={section.label} className="bg-pitch border border-chalk/10 rounded-2xl p-3 sm:p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-lg sm:text-xl">{section.label}</h2>
              <span className="font-mono text-[11px] text-chalk/50">{section.range}</span>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5 sm:gap-2">
              {section.items.map((m) => {
                const isMine = m.owner_id === currentUserId;
                const isSelected = selected.includes(m.minute);
                const isWinner =
                  sweep.status === "finished" &&
                  (m.minute === sweep.goal_minute_first || m.minute === sweep.goal_minute_last);
                const isCash = m.payment_method === "cash";
                const clickable = cashMode
                  ? (!m.owner_name && sweep.status !== "finished") || (!!m.owner_name && isCash)
                  : !m.owner_name && sweep.status === "open";

                let bg = "bg-chalk/5 hover:bg-chalk/10";
                let textColor = "text-chalk";
                if (isWinner) {
                  bg = "bg-red";
                  textColor = "text-[var(--club-text-on-primary)]";
                } else if (isMine) {
                  bg = "bg-[var(--club-primary)]";
                  textColor = "text-[var(--club-text-on-primary)]";
                } else if (m.owner_name) {
                  bg = "bg-[var(--club-secondary)]";
                  textColor = "text-white/95";
                } else if (isSelected) {
                  bg = "bg-[rgb(var(--club-primary-rgb)/25%)] hover:bg-[rgb(var(--club-primary-rgb)/30%)]";
                }

                return (
                  <button
                    key={m.minute}
                    onClick={() => toggle(m)}
                    disabled={!clickable}
                    title={m.owner_name ? `Claimed by ${m.owner_name}` : "Available"}
                    className={`relative aspect-[0.85] rounded-md border transition-colors duration-100 ${
                      isSelected ? "border-[var(--club-primary)] border-2" : "border-chalk/15"
                    } ${bg} ${textColor} flex flex-col items-center justify-center overflow-hidden text-[11px] sm:text-[12px] font-mono ${
                      clickable ? "cursor-pointer active:scale-95" : "cursor-not-allowed"
                    } ${isWinner ? "animate-[pulse_1.4s_ease-in-out_2]" : ""}`}
                  >
                    {cashMode && isCash && (
                      <span className="absolute top-0 inset-x-0 text-[6px] sm:text-[7px] font-bold tracking-wider bg-black/30 leading-tight">
                        CASH
                      </span>
                    )}
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
          </section>
        ))}
      </div>

      {cashMode && selected.length > 0 && (
        <form
          onSubmit={allocateCash}
          className="mt-4 bg-pitch border-2 border-[var(--club-primary)] rounded-2xl p-4 sm:p-5 space-y-3"
        >
          <div className="font-display text-base">
            Cash for minute{selected.length > 1 ? "s" : ""} {selected.slice().sort((a, b) => a - b).join(", ")} — £
            {((selected.length * sweep.price_per_minute) / 100).toFixed(2)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              required
              autoFocus
              value={cashName}
              onChange={(e) => setCashName(e.target.value)}
              placeholder="Name to show on the board"
              maxLength={60}
              className="w-full px-4 py-3 rounded-lg bg-chalk/5 border border-chalk/15 text-chalk placeholder:text-chalk/40"
            />
            <input
              type="email"
              value={cashEmail}
              onChange={(e) => setCashEmail(e.target.value)}
              placeholder="Email (optional — for the PDF)"
              className="w-full px-4 py-3 rounded-lg bg-chalk/5 border border-chalk/15 text-chalk placeholder:text-chalk/40"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setSelected([])} className="px-4 py-2.5 rounded-lg border border-chalk/15 text-sm">
              Clear
            </button>
            <button
              type="submit"
              disabled={allocating}
              className="px-5 py-2.5 rounded-lg bg-[var(--club-primary)] text-[var(--club-text-on-primary)] font-bold text-sm disabled:opacity-60"
            >
              {allocating ? "Adding…" : "Add to board"}
            </button>
          </div>
        </form>
      )}

      <div className="flex justify-between items-center flex-wrap gap-4 mt-5">
        <div className="flex gap-4 flex-wrap text-xs text-chalk/70">
          <Legend swatch="bg-chalk/5 border border-chalk/20" label="Open" />
          <Legend swatch="bg-[var(--club-secondary)]" label="Taken" />
          <Legend swatch="bg-[var(--club-primary)]" label="Yours" />
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
          {!cashMode && sweep.status === "open" && selected.length > 0 && (
            <button
              onClick={startCheckout}
              disabled={checkingOut}
              className="hidden sm:block px-5 py-3 rounded-lg bg-[var(--club-primary)] text-[var(--club-text-on-primary)] font-bold text-sm disabled:opacity-60"
            >
              {checkingOut
                ? "Starting checkout…"
                : `Buy ${selected.length} minute${selected.length > 1 ? "s" : ""} — £${total.toFixed(2)}`}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red text-sm mt-3">{error}</p>}
      {notice && <p className="text-sm mt-3 text-chalk/70">{notice}</p>}

      {/* Mobile — sticky bar at the bottom of the screen so the buy button is always reachable */}
      {!cashMode && sweep.status === "open" && selected.length > 0 && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-pitchDark border-t border-chalk/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-20">
          <button
            onClick={startCheckout}
            disabled={checkingOut}
            className="w-full py-4 rounded-lg bg-[var(--club-primary)] text-[var(--club-text-on-primary)] font-bold text-base disabled:opacity-60"
          >
            {checkingOut
              ? "Starting checkout…"
              : `Buy ${selected.length} minute${selected.length > 1 ? "s" : ""} — £${total.toFixed(2)}`}
          </button>
        </div>
      )}
      {/* Spacer so the sticky bar never covers content underneath it on mobile */}
      {!cashMode && sweep.status === "open" && selected.length > 0 && <div className="sm:hidden h-20" />}
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
