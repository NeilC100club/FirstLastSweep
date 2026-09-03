import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function BuyersPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sweep } = await supabase.from("sweeps").select("*").eq("id", params.id).single();
  if (!sweep) notFound();
  if (sweep.organizer_id !== user.id) redirect(`/sweeps/${params.id}`);

  const { data: minutes } = await supabase
    .from("minutes")
    .select("*")
    .eq("sweep_id", sweep.id)
    .not("owner_name", "is", null)
    .order("minute", { ascending: true });

  // Group by buyer (name + email) so someone who bought several minutes shows as one row.
  const byBuyer = new Map
    string,
    { name: string; email: string | null; minuteList: number[]; total: number }
  >();
  (minutes || []).forEach((m) => {
    const key = `${m.owner_name}::${m.buyer_email || ""}`;
    const existing = byBuyer.get(key);
    if (existing) {
      existing.minuteList.push(m.minute);
      existing.total += sweep.price_per_minute;
    } else {
      byBuyer.set(key, {
        name: m.owner_name!,
        email: m.buyer_email,
        minuteList: [m.minute],
        total: sweep.price_per_minute,
      });
    }
  });
  const buyers = Array.from(byBuyer.values()).sort((a, b) => a.minuteList[0] - b.minuteList[0]);

  const totalCollected = (minutes || []).length * sweep.price_per_minute;
  const prizePot = totalCollected / 2;
  const clubPot = totalCollected / 2;

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-5 py-6 pb-20">
        <a href={`/sweeps/${sweep.id}`} className="text-sm text-chalk/60 mb-4 inline-block">
          ← Back to board
        </a>

        <div className="font-mono text-[11px] tracking-widest text-chalk/50 mb-1">ORGANISER ONLY</div>
        <h1 className="font-display text-2xl sm:text-3xl mb-1">{sweep.name} — buyers</h1>
        <p className="text-sm text-chalk/60 mb-6">
          Everyone who's bought a minute, and how to reach them once it's time to settle up.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <SummaryCard label="Total collected" value={`£${(totalCollected / 100).toFixed(2)}`} />
          <SummaryCard label="Prize pot (50%)" value={`£${(prizePot / 100).toFixed(2)}`} highlight />
          <SummaryCard label="100 Club (50%)" value={`£${(clubPot / 100).toFixed(2)}`} />
        </div>

        <div className="bg-pitch border border-chalk/10 rounded-2xl overflow-hidden">
          {buyers.length === 0 ? (
            <p className="text-chalk/60 text-sm p-6">No minutes bought yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-chalk/10 text-left text-chalk/50 font-mono text-[11px] tracking-wide">
                  <th className="p-4 font-normal">Name</th>
                  <th className="p-4 font-normal">Email</th>
                  <th className="p-4 font-normal">Minutes</th>
                  <th className="p-4 font-normal text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map((b, i) => (
                  <tr key={i} className="border-b border-chalk/5 last:border-0">
                    <td className="p-4 font-semibold">{b.name}</td>
                    <td className="p-4 text-chalk/70">
                      {b.email ? (
                        <a href={`mailto:${b.email}`} className="text-gold hover:underline">
                          {b.email}
                        </a>
                      ) : (
                        <span className="text-chalk/30">—</span>
                      )}
                    </td>
                    <td className="p-4 text-chalk/70 font-mono text-xs">
                      {b.minuteList.sort((a, b) => a - b).join(", ")}
                    </td>
                    <td className="p-4 text-right font-mono">£{(b.total / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {sweep.status === "finished" && (sweep.goal_minute_first || sweep.goal_minute_last) && (
          <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 mt-6">
            <div className="font-mono text-[11px] text-chalk/50 tracking-wide mb-2">WHO'S OWED THE PRIZE</div>
            {sweep.goal_minute_first && (
              <WinnerRow label="First goal" minute={sweep.goal_minute_first} minutes={minutes || []} />
            )}
            {sweep.goal_minute_last && (
              <WinnerRow label="Last goal" minute={sweep.goal_minute_last} minutes={minutes || []} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? "bg-gold/10 border-gold/30" : "bg-chalk/5 border-chalk/10"
      }`}
    >
      <div className="font-mono text-[10px] text-chalk/50 tracking-wide mb-1">{label}</div>
      <div className={`font-display text-xl ${highlight ? "text-gold" : "text-chalk"}`}>{value}</div>
    </div>
  );
}

function WinnerRow({
  label,
  minute,
  minutes,
}: {
  label: string;
  minute: number;
  minutes: { minute: number; owner_name: string | null; buyer_email: string | null }[];
}) {
  const winner = minutes.find((m) => m.minute === minute);
  return (
    <div className="flex justify-between text-sm mb-1">
      <span className="text-chalk/70">
        {label} — minute {minute}
      </span>
      <span className={`font-bold ${winner?.owner_name ? "text-gold" : "text-chalk/50"}`}>
        {winner?.owner_name
          ? `${winner.owner_name}${winner.buyer_email ? ` (${winner.buyer_email})` : ""}`
          : "Unclaimed — goes to the 100 CLUB"}
      </span>
    </div>
  );
}
