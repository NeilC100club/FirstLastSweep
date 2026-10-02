import { standardTerms } from "@/lib/types";

export default function HowItWorks({ fundraiserName }: { fundraiserName?: string }) {
  return (
    <details className="bg-pitch border border-chalk/10 rounded-2xl p-5 mb-7">
      <summary className="font-mono text-xs tracking-widest text-chalk/60 cursor-pointer">HOW IT WORKS</summary>
      <p className="text-sm text-black leading-relaxed mt-3 mb-3">
        Each sweep splits a match into its 90 minutes. Buy the minute you fancy — if the first or last match goal
        goes in during that minute, you&apos;re in the money. Half of everything collected forms the prize pot, split
        between whoever holds the first goal&apos;s minute and whoever holds the last goal&apos;s minute; the other half
        goes to the {fundraiserName || "club fund"}.
      </p>
      <p className="text-sm text-black leading-relaxed mb-3">
        For example: if 84 minutes are sold at £2, the first-goal minute wins £42 and the last-goal minute wins £42 —
        the other £84 goes to the {fundraiserName || "club fund"}. If it finishes 1-0, that one minute is both, so it
        takes the full £84.
      </p>
      <ul className="list-disc pl-4 space-y-1 text-xs text-chalk/70">
        {standardTerms(fundraiserName).map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </details>
  );
}
