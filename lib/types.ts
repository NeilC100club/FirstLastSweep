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
};

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
