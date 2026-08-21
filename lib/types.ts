export type SweepStatus = "open" | "locked" | "finished";

export type Sweep = {
  id: string;
  organizer_id: string;
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

export const STANDARD_TERMS = [
  "Half the total collected is the prize pot. The other half goes to the 100 CLUB fundraising pot.",
  "If no one holds the exact minute the goal is scored in, the money goes to the 100 CLUB fundraising pot.",
  "If a goal is scored in injury time, that prize goes to the 100 CLUB fundraising pot.",
  "If the match finishes 0-0, the money goes to the 100 CLUB fundraising pot.",
];
