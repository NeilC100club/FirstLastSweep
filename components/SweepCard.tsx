import Link from "next/link";
import type { SweepWithClub } from "@/lib/sweeps";

export default function SweepCard({ sweep: s, claimed, showClub = true }: { sweep: SweepWithClub; claimed: number; showClub?: boolean }) {
  const pct = Math.round((claimed / s.total_minutes) * 100);
  const isFinished = s.status === "finished";
  const clubColor = s.club?.primary_color || "#F2A900";
  return (
    <Link href={`/sweeps/${s.id}`} className="relative block bg-pitch border border-chalk/10 rounded-2xl p-5 overflow-hidden">
      {isFinished && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-chalk/70">
          <span className="text-white text-6xl font-black leading-none" aria-hidden="true">
            ✕
          </span>
          <span className="font-mono text-base sm:text-lg font-extrabold tracking-widest text-white">FINISHED</span>
        </div>
      )}
      <div className={isFinished ? "opacity-30 grayscale" : ""}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className="font-mono text-[10px] tracking-wide px-2 py-1 rounded-full"
              style={{ backgroundColor: `${clubColor}26`, color: s.club?.secondary_color || clubColor }}
            >
              {s.status === "open" ? "OPEN" : s.status === "locked" ? "KICKED OFF" : "FINISHED"}
            </span>
            {showClub && s.club?.short_name && (
              <span className="flex items-center gap-1 font-mono text-[10px] tracking-wide px-2 py-1 rounded-full bg-chalk/10 text-chalk/60">
                {s.club.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.club.logo_url} alt="" className="h-3.5 w-auto" />
                )}
                {s.club.short_name}
              </span>
            )}
          </div>
          <span className="font-mono text-xs text-chalk/70">£{(s.price_per_minute / 100).toFixed(2)}/min</span>
        </div>
        <h3 className="font-display text-lg mb-1">{s.name}</h3>
        <div className="text-xs text-chalk/60 mb-3">
          {s.event_date} {s.kickoff_time ? `· ${s.kickoff_time.slice(0, 5)} kickoff` : ""}
        </div>
        <div className="h-1.5 rounded bg-chalk/10 overflow-hidden mb-2">
          <div className="h-full" style={{ width: `${pct}%`, backgroundColor: clubColor }} />
        </div>
        <div className="text-xs text-chalk/60">
          {claimed} / {s.total_minutes} minutes claimed
        </div>
      </div>
    </Link>
  );
}
