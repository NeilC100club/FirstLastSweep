import type { CSSProperties } from "react";

export type SweepStatus = "open" | "locked" | "finished";

export type Club = {
  id: string;
  name: string;
  short_name: string;
  fundraiser_name: string; // e.g. "100 Club" or "Club Fund" — what the pot is called
  logo_url: string | null;
  primary_color: string; // main accent — CTAs, prize pool, "yours" swatch
  secondary_color: string; // "taken" minute swatch
  text_on_primary: string; // text colour that reads on top of primary_color
  created_at: string;
};

// Sensible fallback so a sweep never renders unbranded if its club failed to load.
export const DEFAULT_CLUB: Club = {
  id: "",
  name: "First and Last Sweep",
  short_name: "First and Last Sweep",
  fundraiser_name: "club fund",
  logo_url: null,
  primary_color: "#F2A900",
  secondary_color: "#4C7A5A",
  text_on_primary: "#241C00",
  created_at: "",
};

export type Sweep = {
  id: string;
  organizer_id: string;
  club_id: string | null;
  name: string;
  event_date: string | null;
  kickoff_time: string | null;
  price_per_minute: number; // pence
  total_minutes: number;
  cause: string | null;
  status: SweepStatus;
  goal_minute_first: number | null;
  goal_minute_last: number | null;
  archived_at: string | null;
  board_emailed_at: string | null;
  created_at: string;
};

export type Minute = {
  id: string;
  sweep_id: string;
  minute: number;
  owner_name: string | null;
  owner_id: string | null;
  buyer_email: string | null;
  stripe_checkout_session_id: string | null;
  purchased_at: string | null;
  payment_method: "card" | "cash" | null;
  allocated_by: string | null;
};

// The board is shown in sections: first half (1-45), second half (46-90) and,
// for the rare board with more than 90 minutes, extra time (91+).
export type BoardSection<T extends { minute: number }> = { label: string; range: string; items: T[] };

export function boardSections<T extends { minute: number }>(items: T[]): BoardSection<T>[] {
  const sections = [
    { label: "First half", from: 1, to: 45 },
    { label: "Second half", from: 46, to: 90 },
    { label: "Extra time", from: 91, to: Infinity },
  ];
  return sections
    .map((s) => {
      const inSection = items.filter((i) => i.minute >= s.from && i.minute <= s.to);
      const last = inSection.length ? inSection[inSection.length - 1].minute : s.from;
      return { label: s.label, range: `Minutes ${s.from}–${last}`, items: inSection };
    })
    .filter((s) => s.items.length > 0);
}

// Kick-off is entered as a UK date + time. This turns it into a real moment in
// time (handling BST/GMT), so we can tell whether the board should be closed.
export function kickoffInstant(eventDate: string | null, kickoffTime: string | null): Date | null {
  if (!eventDate || !kickoffTime) return null;
  const [y, mo, d] = eventDate.split("-").map(Number);
  const [h, mi] = kickoffTime.split(":").map(Number);
  if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) return null;
  // Start by pretending the UK time is UTC, then correct by the UK offset at that moment.
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(asUtc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const londonAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const offset = londonAsUtc - asUtc; // 0 in winter, 1 hour in summer
  return new Date(asUtc - offset);
}

export function kickoffPassed(sweep: Pick<Sweep, "event_date" | "kickoff_time">, now = new Date()): boolean {
  const k = kickoffInstant(sweep.event_date, sweep.kickoff_time);
  return !!k && k.getTime() <= now.getTime();
}

// The standard terms are the same for every club — only what the fundraising
// pot is called changes (e.g. Newport County's "100 Club" vs GVD's "Club Fund").
export function standardTerms(fundraiserName: string = DEFAULT_CLUB.fundraiser_name): string[] {
  return [
    `Half the total collected is the prize pot. The other half goes to the ${fundraiserName} fundraising pot.`,
    `If no one holds the exact minute the goal is scored in, the money goes to the ${fundraiserName} fundraising pot.`,
    `If a goal is scored in injury time, that prize goes to the ${fundraiserName} fundraising pot.`,
    `If the match finishes 0-0, the money goes to the ${fundraiserName} fundraising pot.`,
  ];
}

// Converts a "#RRGGBB" hex colour to an "R G B" triplet, for use with Tailwind's
// rgb(var(--x)/alpha%) arbitrary-value syntax — lets club colours support the
// same opacity variants (/10, /15, /25, /30 …) the old fixed "gold" token did.
export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function clubThemeStyle(club: Club): CSSProperties {
  return {
    ["--club-primary" as string]: club.primary_color,
    ["--club-primary-rgb" as string]: hexToRgbTriplet(club.primary_color),
    ["--club-secondary" as string]: club.secondary_color,
    ["--club-text-on-primary" as string]: club.text_on_primary,
  } as CSSProperties;
}
