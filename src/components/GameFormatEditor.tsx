"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setGameFormat } from "@/app/dashboard/g/[id]/actions";

const BLENDS = [
  { ratio: 0, label: "Trivia only", hint: "No feud — random trivia to a target score" },
  { ratio: 50, label: "Even", hint: "Feud & trivia, 1:1" },
  { ratio: 67, label: "More feud", hint: "Trivia every other turn" },
  { ratio: 75, label: "Mostly feud", hint: "Trivia ~every 3rd turn" },
  { ratio: 100, label: "Feud only", hint: "No trivia" },
];

function nearestBlend(r: number): number {
  return BLENDS.reduce((a, b) => (Math.abs(b.ratio - r) < Math.abs(a.ratio - r) ? b : a)).ratio;
}

/** Host control for the live game's format: feud↔trivia blend, who picks trivia
 *  topics, and whether missed questions can be stolen. */
export function GameFormatEditor({
  groupId,
  initial,
}: {
  groupId: string;
  initial: { feudRatio: number; triviaPicker: "captains" | "host"; stealsEnabled: boolean };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [ratio, setRatio] = useState(nearestBlend(initial.feudRatio));
  const [picker, setPicker] = useState<"captains" | "host">(initial.triviaPicker);
  const [steals, setSteals] = useState(initial.stealsEnabled);

  const feudOnly = ratio >= 100;
  const triviaOnly = ratio === 0;
  const noTopics = feudOnly || triviaOnly; // neither extreme uses captain topic picks
  const dirty = () => setSaved(false);

  function save() {
    start(async () => {
      const res = await setGameFormat({ groupId, feudRatio: ratio, triviaPicker: picker, stealsEnabled: steals });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* feud / trivia blend */}
      <div>
        <div className="label mb-1.5">Feud &amp; trivia mix</div>
        <div className="flex flex-wrap gap-1.5">
          {BLENDS.map((b) => (
            <button
              key={b.ratio}
              type="button"
              onClick={() => { setRatio(b.ratio); dirty(); }}
              title={b.hint}
              className={
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition " +
                (ratio === b.ratio
                  ? "border-magenta bg-magenta/20 text-cream"
                  : "border-white/15 bg-white/5 text-cream/70 hover:border-cyan")
              }
            >
              {b.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-cream/45">
          {BLENDS.find((b) => b.ratio === ratio)?.hint}
          {!noTopics && " · trivia comes from your bank"}
        </p>
      </div>

      {/* who picks trivia topics */}
      {!noTopics && (
        <div>
          <div className="label mb-1.5">Who picks trivia topics?</div>
          <div className="flex flex-wrap gap-1.5">
            {(["captains", "host"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => { setPicker(v); dirty(); }}
                className={
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition " +
                  (picker === v
                    ? "border-magenta bg-magenta/20 text-cream"
                    : "border-white/15 bg-white/5 text-cream/70 hover:border-cyan")
                }
              >
                {v === "captains" ? "🎖️ Captains pick" : "🎛️ Host picks"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-cream/45">
            {picker === "captains"
              ? "Each captain chooses their team's topics from their phone."
              : "You set every team's topics on the Trivia & topics page."}
          </p>
        </div>
      )}

      {/* steals */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/5 px-3 py-2.5 hover:bg-white/8">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-magenta"
          checked={steals}
          onChange={(e) => { setSteals(e.target.checked); dirty(); }}
        />
        <span className="min-w-0">
          <span className="text-sm font-semibold text-cream">🪝 Allow steals</span>
          <span className="block text-xs text-cream/50">
            If a team misses, the next team can steal it for a flat +1 (the steal rotates with the
            turn, so it keeps switching between teams).
          </span>
        </span>
      </label>

      <button onClick={save} disabled={pending || saved} className="btn btn-primary text-sm">
        {pending ? "Saving…" : saved ? "Saved ✓" : "Save format"}
      </button>
    </div>
  );
}
