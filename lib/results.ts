import type { Minute, Sweep } from "@/lib/types";

export type GoalResult = {
  label: "First goal" | "Last goal";
  minute: number | null;
  winnerName: string | null;
  winnerEmail: string | null;
  prize: number; // pence
};

export type SweepResult = {
  noGoals: boolean;
  totalCollected: number; // pence
  goals: GoalResult[];
  sameWinner: boolean; // 1-0 style: one minute is both first and last goal
  toFund: number; // pence that ends up in the fundraising pot
};

// Works out who won what. Half the money is the prize pot, split equally between
// the first-goal minute and the last-goal minute. Any share nobody holds the minute
// for (or a 0-0) goes to the fundraising pot along with the other half.
export function calculateResult(
  sweep: Pick<Sweep, "price_per_minute" | "goal_minute_first" | "goal_minute_last">,
  minutes: Pick<Minute, "minute" | "owner_name" | "buyer_email">[]
): SweepResult {
  const sold = minutes.filter((m) => m.owner_name).length;
  const totalCollected = sold * sweep.price_per_minute;
  const share = totalCollected / 4;

  const goal = (label: GoalResult["label"], minute: number | null): GoalResult => {
    const holder = minute ? minutes.find((m) => m.minute === minute && m.owner_name) : undefined;
    return {
      label,
      minute,
      winnerName: holder?.owner_name || null,
      winnerEmail: holder?.buyer_email || null,
      prize: holder ? share : 0,
    };
  };

  const goals = [goal("First goal", sweep.goal_minute_first), goal("Last goal", sweep.goal_minute_last)];
  const noGoals = !sweep.goal_minute_first && !sweep.goal_minute_last;
  const sameWinner =
    !!sweep.goal_minute_first && sweep.goal_minute_first === sweep.goal_minute_last && !!goals[0].winnerName;
  const prizesPaid = goals.reduce((sum, g) => sum + g.prize, 0);

  return { noGoals, totalCollected, goals, sameWinner, toFund: totalCollected - prizesPaid };
}

export function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}
