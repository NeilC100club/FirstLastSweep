import Link from "next/link";
import type { Club } from "@/lib/types";
import SignOutButton from "@/app/dashboard/SignOutButton";

// Top bar. When a club is given it wears that club's badge and colours.
export default function AppHeader({
  club,
  name,
  admin = false,
}: {
  club?: Club | null;
  name?: string | null;
  admin?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-5 py-4 border-b border-chalk/10"
      style={club ? { backgroundColor: club.primary_color, color: club.text_on_primary } : undefined}
    >
      <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={club?.logo_url || "/logo.png"} alt={club?.short_name || "First and Last"} className="h-9 w-auto shrink-0" />
        <div className="leading-tight min-w-0">
          <div className="font-mono text-xs tracking-widest font-bold truncate">
            {club ? `${club.short_name} ${club.fundraiser_name}`.toUpperCase() : "FIRST AND LAST GOAL SWEEP"}
          </div>
          {club && <div className="font-mono text-[10px] tracking-wide opacity-70">First and Last Goal Sweep</div>}
        </div>
      </Link>
      <div className="flex items-center gap-2 shrink-0">
        {admin && (
          <Link
            href="/admin"
            className="font-mono text-[10px] tracking-widest px-2.5 py-1.5 rounded-full bg-chalk text-white font-bold"
          >
            SUPER USER
          </Link>
        )}
        {name && (
          <span className="hidden sm:inline font-mono text-xs px-3 py-1.5 rounded-full bg-black/10">{name}</span>
        )}
        <SignOutButton />
      </div>
    </div>
  );
}
