import { NextResponse } from "next/server";
import { runKickoffJob } from "@/lib/closeBoards";

// Called every minute by a Supabase scheduled job (see supabase/2026-10-kickoff-schedule.sql).
// Locks any board whose kick-off has passed and emails its PDF to everyone who bought.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const result = await runKickoffJob();
  return NextResponse.json(result);
}
