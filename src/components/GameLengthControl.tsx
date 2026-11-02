"use client";

import { useState } from "react";
import { startGame } from "@/app/play/actions";

// Rough per-turn pace (minutes) for a feud guess + its trivia question, including
// reveals, the category transition, and a little host banter. A range, because
// real tables never use the full timer every time.
const LOW = 1.25;
const HIGH = 2.25;
const MID = (LOW + HIGH) / 2;

function fmtRange(turns: number): string {
  const lo = Math.max(1, Math.round(turns * LOW));
  const hi = Math.max(lo, Math.round(turns * HIGH));
  return lo === hi ? `~${lo} min` : `~${lo}–${hi} min`;
}

/**
 * Replaces the old "Rounds" dropdown. The host dials the game length either by
 * number of questions per team or by a target time (each updates the other),
 * with a live estimate. `capacity` is the most questions-per-team available
 * (from the authored/held-out questions).
 */
export function GameLengthControl({
  groupId,
  capacity,
  numTeams,
}: {
  groupId: string;
  capacity: number;
  numTeams: number;
}) {
  const cap = Math.max(1, capacity);
  const [perTeam, setPerTeam] = useState(Math.min(cap, Math.max(3, cap)));
  const clamp = (n: number) => Math.max(1, Math.min(cap, n));
  const totalTurns = perTeam * Math.max(1, numTeams);

  const TARGETS = [30, 45, 60, 90];
  function setByMinutes(mins: number) {
    const turns = mins / MID; // total turns to roughly fill the time
    setPerTeam(clamp(Math.round(turns / Math.max(1, numTeams))));
  }

  return (
    <div className="mt-4">
      <div className="label">Game length</div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPerTeam((v) => clamp(v - 1))}
            className="btn btn-ghost h-9 w-9 p-0 text-lg"
            aria-label="Fewer questions"
          >
            −
          </button>
          <div className="min-w-[3rem] text-center">
            <div className="font-display text-2xl font-black tabular-nums">{perTeam}</div>
            <div className="text-[0.65rem] uppercase tracking-wide text-cream/45">per team</div>
          </div>
          <button
            type="button"
            onClick={() => setPerTeam((v) => clamp(v + 1))}
            className="btn btn-ghost h-9 w-9 p-0 text-lg"
            aria-label="More questions"
          >
            +
          </button>
        </div>
        <div className="text-sm text-cream/60">
          <span className="font-semibold text-cream">{totalTurns}</span> questions total ·{" "}
          <span className="font-semibold text-cream">{fmtRange(totalTurns)}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-cream/45">Aim for:</span>
        {TARGETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setByMinutes(m)}
            className="chip cursor-pointer text-xs hover:border-cyan hover:text-cream"
          >
            {m < 60 ? `${m} min` : `${m / 60} hr`}
          </button>
        ))}
        <span className="text-xs text-cream/40">(caps at {cap}/team)</span>
      </div>

      <form action={startGame} className="mt-4">
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="questionsPerTeam" value={perTeam} />
        <button type="submit" className="btn btn-primary text-lg">
          ▶ Host live game
        </button>
      </form>
    </div>
  );
}
