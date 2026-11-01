"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SaysReveal } from "@/components/SaysReveal";
import { pickTagline } from "@/lib/brand";
import { cn } from "@/lib/utils";
import {
  scoreFeud,
  scoreTrivia,
  scoreGuessWho,
  scoreGuessWhat,
  persistTurn,
  setGameStatus,
  setGameTimers,
  adjustScore,
  startNextRound,
  type GameTurn,
  type FeudResult,
  type TriviaResult,
  type GuessResult,
} from "@/app/play/actions";

interface FeudQ {
  prompt: string;
  type: string;
  options: string[] | null;
}
interface TriviaQ {
  id: string;
  topic: string;
  prompt: string;
  point_value: number;
}
interface TeamLite {
  id: string;
  name: string;
  index: number;
}

export interface LiveGamePayload {
  groupId: string;
  gameId: string;
  groupName: string;
  allOrNothingValue: number;
  settings: { feudSeconds: number; triviaSeconds: number };
  teams: TeamLite[];
  initialScores: Record<string, number>;
  queue: GameTurn[];
  cursor: number;
  feudQuestions: Record<string, FeudQ>;
  triviaByTeam: Record<string, TriviaQ[]>;
  topicsByTeam: Record<string, string[]>;
}

type Phase = "preGame" | "intro" | "feud" | "feudReveal" | "trivia" | "triviaReveal" | "over";

const TEAM_ACCENT = ["text-magenta", "text-cyan", "text-gold", "text-green"];
const TEAM_BG = ["bg-magenta", "bg-cyan", "bg-gold", "bg-green"];

export function LiveGame(p: LiveGamePayload) {
  const router = useRouter();
  const [cursor, setCursor] = useState(p.cursor);
  const [phase, setPhase] = useState<Phase>(p.cursor === 0 ? "preGame" : "intro");
  const [scores, setScores] = useState<Record<string, number>>(p.initialScores);
  const [pending, setPending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [feudSeconds, setFeudSeconds] = useState(p.settings.feudSeconds);
  const [triviaSeconds, setTriviaSeconds] = useState(p.settings.triviaSeconds);
  const [timeLeft, setTimeLeft] = useState(0);

  const [guess, setGuess] = useState("");
  const [answer, setAnswer] = useState("");
  const [feudRes, setFeudRes] = useState<FeudResult | null>(null);
  const [guessRes, setGuessRes] = useState<GuessResult | null>(null);
  const [triviaRes, setTriviaRes] = useState<TriviaResult | null>(null);
  const [usedTrivia, setUsedTrivia] = useState<Set<string>>(new Set());
  const [currentTrivia, setCurrentTrivia] = useState<TriviaQ | null>(null);

  const turn = p.queue[cursor];
  const total = p.queue.length;
  const teamIndexById = new Map(p.teams.map((t) => [t.id, t.index]));
  const accentIdx = turn ? (teamIndexById.get(turn.teamId) ?? 0) % TEAM_ACCENT.length : 0;

  // --- timer ---------------------------------------------------------------
  const onTimeoutRef = useRef<() => void>(() => {});
  onTimeoutRef.current = () => {
    if (phase === "feud") submitSurvey();
    else if (phase === "trivia") submitTrivia();
  };
  useEffect(() => {
    if ((phase !== "feud" && phase !== "trivia") || paused) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          onTimeoutRef.current();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, paused]);

  // --- handlers ------------------------------------------------------------
  function startFeud() {
    setGuess("");
    setFeudRes(null);
    setGuessRes(null);
    setTimeLeft(feudSeconds);
    setPhase("feud");
  }

  async function submitSurvey() {
    if (pending || phase !== "feud" || !turn) return;
    setPending(true);
    setPhase("feudReveal");
    try {
      if (turn.kind === "guess_who") {
        const res = await scoreGuessWho({
          gameId: p.gameId,
          questionId: turn.feudQuestionId,
          answerMemberId: turn.answerMemberId ?? "",
          teamId: turn.teamId,
          guess,
        });
        setGuessRes(res);
        if (res.points > 0)
          setScores((s) => ({ ...s, [turn.teamId]: (s[turn.teamId] ?? 0) + res.points }));
      } else if (turn.kind === "guess_what") {
        const res = await scoreGuessWhat({
          gameId: p.gameId,
          questionId: turn.feudQuestionId,
          targetMemberId: turn.targetMemberId ?? "",
          teamId: turn.teamId,
          guess,
        });
        setGuessRes(res);
        if (res.points > 0)
          setScores((s) => ({ ...s, [turn.teamId]: (s[turn.teamId] ?? 0) + res.points }));
      } else {
        const res = await scoreFeud({
          gameId: p.gameId,
          questionId: turn.feudQuestionId,
          teamId: turn.teamId,
          guess,
        });
        setFeudRes(res);
        if (res.points > 0)
          setScores((s) => ({ ...s, [turn.teamId]: (s[turn.teamId] ?? 0) + res.points }));
      }
    } finally {
      setPending(false);
    }
  }

  function continueToTrivia() {
    if (!turn) return;
    const bank = p.triviaByTeam[turn.teamId] ?? [];
    // Prefer an unused question; if the bank is exhausted (e.g. multi-round),
    // reuse one so every turn still gets a trivia question.
    let next = bank.find((q) => !usedTrivia.has(q.id));
    if (!next && bank.length > 0) next = bank[Math.floor(Math.random() * bank.length)];
    if (!next) {
      nextTurn();
      return;
    }
    setUsedTrivia((s) => new Set(s).add(next.id));
    setCurrentTrivia(next);
    setAnswer("");
    setTriviaRes(null);
    setTimeLeft(triviaSeconds);
    setPhase("trivia");
  }

  async function submitTrivia() {
    if (pending || phase !== "trivia" || !turn || !currentTrivia) return;
    setPending(true);
    setPhase("triviaReveal");
    try {
      const res = await scoreTrivia({
        gameId: p.gameId,
        questionId: currentTrivia.id,
        teamId: turn.teamId,
        answer,
      });
      setTriviaRes(res);
      if (res.points > 0)
        setScores((s) => ({ ...s, [turn.teamId]: (s[turn.teamId] ?? 0) + res.points }));
    } finally {
      setPending(false);
    }
  }

  async function nextTurn() {
    const next = cursor + 1;
    if (next >= total) {
      await persistTurn({ gameId: p.gameId, cursor, finished: true });
      setPhase("over");
      return;
    }
    await persistTurn({ gameId: p.gameId, cursor: next });
    setCursor(next);
    setCurrentTrivia(null);
    setFeudRes(null);
    setGuessRes(null);
    setTriviaRes(null);
    setPhase("intro");
  }

  async function togglePause() {
    const np = !paused;
    setPaused(np);
    await setGameStatus({ gameId: p.gameId, status: np ? "paused" : "active" });
  }

  async function applyTimers(f: number, t: number) {
    setFeudSeconds(f);
    setTriviaSeconds(t);
    await setGameTimers({ gameId: p.gameId, feudSeconds: f, triviaSeconds: t });
  }

  // Host overrides on the reveal screens (fix a fuzzy-match dispute, etc.).
  async function overrideFeud(bucketLabel: string, bucketCount: number) {
    if (!turn || !feudRes) return;
    const delta = bucketCount - feudRes.points;
    setFeudRes({ ...feudRes, matched: bucketLabel, points: bucketCount });
    setScores((s) => ({ ...s, [turn.teamId]: Math.max(0, (s[turn.teamId] ?? 0) + delta) }));
    await adjustScore({ gameId: p.gameId, teamId: turn.teamId, delta });
  }

  async function overrideTrivia(makeCorrect: boolean) {
    if (!turn || !triviaRes || !currentTrivia) return;
    const target = makeCorrect ? currentTrivia.point_value : 0;
    const delta = target - triviaRes.points;
    setTriviaRes({ ...triviaRes, correct: makeCorrect, points: target });
    setScores((s) => ({ ...s, [turn.teamId]: Math.max(0, (s[turn.teamId] ?? 0) + delta) }));
    await adjustScore({ gameId: p.gameId, teamId: turn.teamId, delta });
  }

  // All-or-nothing override for guess_who / guess_what reveals.
  async function overrideGuess(makeCorrect: boolean) {
    if (!turn || !guessRes) return;
    const target = makeCorrect ? p.allOrNothingValue : 0;
    const delta = target - guessRes.points;
    setGuessRes({ ...guessRes, correct: makeCorrect, points: target });
    setScores((s) => ({ ...s, [turn.teamId]: Math.max(0, (s[turn.teamId] ?? 0) + delta) }));
    await adjustScore({ gameId: p.gameId, teamId: turn.teamId, delta });
  }

  // --- render --------------------------------------------------------------
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-4">
      <TopBar
        groupName={p.groupName}
        round={turn?.round ?? 1}
        numRounds={p.queue[total - 1]?.round ?? 1}
        cursor={cursor}
        total={total}
        paused={paused}
        onPause={togglePause}
        onSettings={() => setShowSettings((s) => !s)}
        onExit={() => router.push(`/dashboard/g/${p.groupId}`)}
        phase={phase}
      />

      <Scoreboard teams={p.teams} scores={scores} activeTeamId={turn?.teamId} />

      {showSettings && (
        <SettingsPanel
          feudSeconds={feudSeconds}
          triviaSeconds={triviaSeconds}
          onApply={applyTimers}
          onClose={() => setShowSettings(false)}
        />
      )}

      <div className="relative flex flex-1 items-center justify-center py-6">
        {paused && phase !== "over" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-ink/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="font-display text-4xl font-black">Paused</div>
              <button onClick={togglePause} className="btn btn-primary mt-4">
                Resume ▶
              </button>
            </div>
          </div>
        )}

        {/* PRE-GAME: show each team's trivia topics */}
        {phase === "preGame" && (
          <div className="w-full max-w-2xl text-center">
            <div className="text-5xl">📋</div>
            <h2 className="mt-3 font-display text-4xl font-black">Tonight&apos;s trivia</h2>
            <p className="mt-1 text-cream/60">
              What each team drew. (Feud questions stay a surprise!)
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {p.teams.map((t) => (
                <div key={t.id} className="card p-4 text-left">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", TEAM_BG[t.index % TEAM_BG.length])} />
                    <span className="font-display font-bold">{t.name}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(p.topicsByTeam[t.id] ?? []).map((topic) => (
                      <span key={topic} className="chip cursor-default text-xs">
                        {topic}
                      </span>
                    ))}
                    {(p.topicsByTeam[t.id] ?? []).length === 0 && (
                      <span className="text-xs text-cream/40">No topics yet</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setPhase("intro")} className="btn btn-primary mt-8 text-lg">
              Start the game →
            </button>
          </div>
        )}

        {/* INTRO */}
        {phase === "intro" && turn && (
          <div className="text-center">
            <div className="label">
              {turn.teamName} ·{" "}
              {turn.kind === "guess_who"
                ? "whose answer?"
                : turn.kind === "guess_what"
                  ? "guess their answer"
                  : "feud turn"}
            </div>
            <h2 className="mt-2 font-display text-5xl font-black">
              <span className={TEAM_ACCENT[accentIdx]}>{turn.memberName}</span> is up!
            </h2>
            <p className="mt-3 text-cream/60">
              {turn.kind === "guess_who"
                ? "An answer's about to show — name who gave it."
                : turn.kind === "guess_what"
                  ? `Guess what ${turn.targetName} answered.`
                  : "Guess what the group said."}{" "}
              {feudSeconds}s on the clock.
            </p>
            <button onClick={startFeud} className="btn btn-primary mt-8 text-lg">
              {turn.kind === "feud" ? "Start feud question →" : "Reveal & guess →"}
            </button>
          </div>
        )}

        {/* SURVEY (feud / guess_who / guess_what) */}
        {phase === "feud" && turn && (
          <div className="w-full max-w-2xl text-center">
            <TimerRing seconds={timeLeft} total={feudSeconds} />

            {turn.kind === "guess_who" ? (
              <>
                <div className="mt-6 text-sm text-cream/50">
                  Someone answered “{p.feudQuestions[turn.feudQuestionId]?.prompt ?? "…"}”
                </div>
                <div className="mt-2 font-display text-4xl font-black text-gold">
                  “{turn.revealAnswer}”
                </div>
                <p className="mt-3 text-lg text-cream/70">Who said it?</p>
                <div className="chip mt-3 inline-flex">🎯 {p.allOrNothingValue} pts · all or nothing</div>
              </>
            ) : turn.kind === "guess_what" ? (
              <>
                <div className="mt-6 text-sm text-cream/50">
                  {turn.targetName}&apos;s answer to:
                </div>
                <h2 className="mt-1 font-display text-3xl font-bold leading-snug">
                  {p.feudQuestions[turn.feudQuestionId]?.prompt ?? "…"}
                </h2>
                <p className="mt-3 text-lg text-cream/70">
                  What did {turn.targetName} say?
                </p>
                <div className="chip mt-3 inline-flex">🎯 {p.allOrNothingValue} pts · all or nothing</div>
              </>
            ) : (
              <>
                <h2 className="mt-6 font-display text-3xl font-bold leading-snug">
                  {p.feudQuestions[turn.feudQuestionId]?.prompt ?? "…"}
                </h2>
                {renderOptions(p.feudQuestions[turn.feudQuestionId])}
              </>
            )}

            <input
              autoFocus
              className="input mt-6 text-center text-xl"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSurvey()}
              placeholder={
                turn.kind === "guess_who"
                  ? "Name who said it…"
                  : turn.kind === "guess_what"
                    ? `Guess ${turn.targetName}'s answer…`
                    : `${turn.memberName}, type your guess…`
              }
            />
            <button onClick={submitSurvey} disabled={pending} className="btn btn-primary mt-5 text-lg">
              Lock it in
            </button>
          </div>
        )}

        {/* SURVEY REVEAL */}
        {phase === "feudReveal" && turn && turn.kind === "feud" && (
          <FeudRevealPanel
            groupName={p.groupName}
            guess={guess}
            result={feudRes}
            pending={pending}
            onOverride={overrideFeud}
            onContinue={continueToTrivia}
          />
        )}
        {phase === "feudReveal" && turn && turn.kind !== "feud" && (
          <GuessRevealPanel
            kind={turn.kind}
            guess={guess}
            result={guessRes}
            pending={pending}
            onOverride={overrideGuess}
            onContinue={continueToTrivia}
          />
        )}

        {/* TRIVIA */}
        {phase === "trivia" && currentTrivia && turn && (
          <div className="w-full max-w-2xl text-center">
            <TimerRing seconds={timeLeft} total={triviaSeconds} />
            <div className="chip mt-6 inline-flex">📚 {currentTrivia.topic} · {currentTrivia.point_value} pts</div>
            <h2 className="mt-4 font-display text-3xl font-bold leading-snug">
              {currentTrivia.prompt}
            </h2>
            <p className="mt-2 text-sm text-cream/50">Captain answers for {turn.teamName}.</p>
            <input
              autoFocus
              className="input mt-6 text-center text-xl"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitTrivia()}
              placeholder="Team's answer…"
            />
            <button onClick={submitTrivia} disabled={pending} className="btn btn-primary mt-5 text-lg">
              Lock it in
            </button>
          </div>
        )}

        {/* TRIVIA REVEAL */}
        {phase === "triviaReveal" && (
          <TriviaRevealPanel
            answer={answer}
            result={triviaRes}
            pending={pending}
            onOverride={overrideTrivia}
            onNext={nextTurn}
            last={cursor + 1 >= total}
          />
        )}

        {/* OVER */}
        {phase === "over" && <GameOver teams={p.teams} scores={scores} groupId={p.groupId} />}
      </div>
    </div>
  );
}

function renderOptions(q?: FeudQ) {
  if (!q || !q.options || q.options.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {q.options.map((o) => (
        <span key={o} className="chip cursor-default">
          {o}
        </span>
      ))}
    </div>
  );
}

function TopBar({
  groupName,
  round,
  numRounds,
  cursor,
  total,
  paused,
  onPause,
  onSettings,
  onExit,
  phase,
}: {
  groupName: string;
  round: number;
  numRounds: number;
  cursor: number;
  total: number;
  paused: boolean;
  onPause: () => void;
  onSettings: () => void;
  onExit: () => void;
  phase: Phase;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="text-cream/60">
        <span className="font-display font-bold text-cream">{groupName}</span> · Round {round}/
        {numRounds} · Turn {Math.min(cursor + 1, total)}/{total}
      </div>
      <div className="flex items-center gap-2">
        {phase !== "over" && (
          <>
            <button onClick={onPause} className="btn btn-ghost px-3 py-1.5 text-xs">
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
            <button onClick={onSettings} className="btn btn-ghost px-3 py-1.5 text-xs">
              ⚙ Timers
            </button>
          </>
        )}
        <button onClick={onExit} className="btn btn-ghost px-3 py-1.5 text-xs">
          Exit
        </button>
      </div>
    </div>
  );
}

function Scoreboard({
  teams,
  scores,
  activeTeamId,
}: {
  teams: TeamLite[];
  scores: Record<string, number>;
  activeTeamId?: string;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {teams.map((t) => {
        const active = t.id === activeTeamId;
        return (
          <div
            key={t.id}
            className={cn(
              "card flex items-center justify-between px-4 py-3",
              active && "ring-2 ring-magenta",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", TEAM_BG[t.index % TEAM_BG.length])} />
              <span className="text-sm font-semibold">{t.name}</span>
            </div>
            <span className="font-display text-2xl font-black">{scores[t.id] ?? 0}</span>
          </div>
        );
      })}
    </div>
  );
}

function TimerRing({ seconds, total }: { seconds: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const low = seconds <= 5;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = total > 90 ? `${mins}:${String(secs).padStart(2, "0")}` : `${seconds}`;
  return (
    <div className="mx-auto w-full max-w-xs">
      <div className={cn("text-center font-display text-4xl font-black", low ? "text-magenta" : "text-cream")}>
        {display}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all duration-1000 ease-linear", low ? "bg-magenta" : "bg-cyan")}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

function FeudRevealPanel({
  groupName,
  guess,
  result,
  pending,
  onOverride,
  onContinue,
}: {
  groupName: string;
  guess: string;
  result: FeudResult | null;
  pending: boolean;
  onOverride: (label: string, count: number) => void;
  onContinue: () => void;
}) {
  if (!result) {
    return (
      <div className="text-center">
        <SaysReveal groupName={groupName} size="lg" />
        <p className="mt-6 animate-pulse text-cream/60">Tallying the votes…</p>
      </div>
    );
  }
  const total = result.buckets.reduce((s, b) => s + b.count, 0);
  const points = result.points;
  const taglineBucket = points === 0 ? "feudMiss" : points >= 3 ? "feudBigHit" : "feudSmallHit";
  return (
    <div className="w-full max-w-2xl text-center">
      <SaysReveal groupName={groupName} size="lg" />
      <p className="mt-3 text-sm text-cream/55">
        Guessed <span className="font-semibold text-cream">“{guess || "—"}”</span>
        {result.matched ? (
          <>
            {" "}
            → matched <span className="font-semibold text-gold">{result.matched}</span>
          </>
        ) : (
          <> → no match</>
        )}
      </p>
      <div className="mt-4 space-y-2">
        {result.buckets.map((b) => {
          const matched = result.matched?.toLowerCase() === b.label.toLowerCase();
          return (
            <button
              key={b.label}
              onClick={() => onOverride(b.label, b.count)}
              disabled={pending}
              title="Tap to award this answer (host override)"
              className={cn(
                "animate-flip-in relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition hover:border-gold/70",
                matched ? "border-gold bg-gold/10" : "border-white/10 bg-white/5",
              )}
            >
              <div
                className="absolute inset-y-0 left-0 bg-white/5"
                style={{ width: `${total ? (b.count / total) * 100 : 0}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span className="font-semibold">{b.label}</span>
                <span className="font-display text-xl font-black">{b.count}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-5">
        <div className="font-display text-2xl font-bold">
          {points > 0 ? (
            <>
              <span className="text-shimmer-gold">+{points}</span> points!
            </>
          ) : (
            <span className="text-cream/70">No match — 0 points</span>
          )}
        </div>
        <p className="mt-1 text-cream/60">{pickTagline(taglineBucket, total)}</p>
        <p className="mt-1 text-xs text-cream/40">Wrong match? Tap the answer they meant.</p>
      </div>
      <button onClick={onContinue} disabled={pending} className="btn btn-secondary mt-6 text-lg">
        On to trivia →
      </button>
    </div>
  );
}

function GuessRevealPanel({
  kind,
  guess,
  result,
  pending,
  onOverride,
  onContinue,
}: {
  kind: string;
  guess: string;
  result: GuessResult | null;
  pending: boolean;
  onOverride: (correct: boolean) => void;
  onContinue: () => void;
}) {
  if (!result) {
    return (
      <div className="text-center">
        <div className="animate-pulse text-6xl">⏳</div>
        <p className="mt-3 text-cream/60">Checking…</p>
      </div>
    );
  }
  const correct = result.correct;
  return (
    <div className="w-full max-w-2xl text-center">
      <div className="text-7xl">{correct ? "✅" : "❌"}</div>
      <h2 className={cn("mt-4 font-display text-4xl font-black", correct ? "text-green" : "text-magenta")}>
        {correct ? "Nailed it!" : "Not quite"}
      </h2>
      <p className="mt-2 text-sm text-cream/55">
        Guessed <span className="font-semibold text-cream">“{guess || "—"}”</span>
      </p>
      <p className="mt-1 text-cream/80">
        {kind === "guess_who" ? "It was " : "They said "}
        <span className="font-semibold text-gold">{result.correctLabel || "—"}</span>
      </p>
      <div className="mt-4 font-display text-2xl font-bold">
        {result.points > 0 ? (
          <span className="text-shimmer-gold">+{result.points} points</span>
        ) : (
          <span className="text-cream/60">+0 points</span>
        )}
      </div>
      <button
        onClick={() => onOverride(!correct)}
        disabled={pending}
        className="mt-3 text-xs text-cream/45 underline hover:text-cream"
      >
        {correct ? "Mark it wrong instead" : "Actually correct — give the points"}
      </button>
      <div className="mt-5">
        <button onClick={onContinue} disabled={pending} className="btn btn-secondary text-lg">
          On to trivia →
        </button>
      </div>
    </div>
  );
}

function TriviaRevealPanel({
  answer,
  result,
  pending,
  onOverride,
  onNext,
  last,
}: {
  answer: string;
  result: TriviaResult | null;
  pending: boolean;
  onOverride: (correct: boolean) => void;
  onNext: () => void;
  last: boolean;
}) {
  if (!result) {
    return (
      <div className="text-center">
        <div className="animate-pulse text-6xl">⏳</div>
        <p className="mt-3 text-cream/60">Checking the answer…</p>
      </div>
    );
  }
  const correct = result.correct;
  return (
    <div className="text-center">
      <div className="text-7xl">{correct ? "✅" : "❌"}</div>
      <h2 className={cn("mt-4 font-display text-4xl font-black", correct ? "text-green" : "text-magenta")}>
        {correct ? "Correct!" : "Not quite"}
      </h2>
      <p className="mt-2 text-sm text-cream/55">
        They said <span className="font-semibold text-cream">“{answer || "—"}”</span>
      </p>
      <p className="mt-1 text-cream/80">
        Correct answer: <span className="font-semibold text-cream">{result.correctAnswer}</span>
      </p>
      <div className="mt-4 font-display text-2xl font-bold">
        {result.points > 0 ? (
          <span className="text-shimmer-gold">+{result.points} points</span>
        ) : (
          <span className="text-cream/60">+0 points</span>
        )}
      </div>
      <p className="mt-1 text-cream/60">{pickTagline(correct ? "triviaRight" : "triviaWrong")}</p>
      <button
        onClick={() => onOverride(!correct)}
        disabled={pending}
        className="mt-3 text-xs text-cream/45 underline hover:text-cream"
      >
        {correct ? "Mark it wrong instead" : "Actually correct — give the points"}
      </button>
      <div className="mt-4">
        <button onClick={onNext} disabled={pending} className="btn btn-primary text-lg">
          {last ? "See final scores 🏆" : "Next turn →"}
        </button>
      </div>
    </div>
  );
}

function GameOver({
  teams,
  scores,
  groupId,
}: {
  teams: TeamLite[];
  scores: Record<string, number>;
  groupId: string;
}) {
  const ranked = [...teams].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  const top = ranked[0];
  const tie = ranked.length > 1 && (scores[ranked[0].id] ?? 0) === (scores[ranked[1].id] ?? 0);
  return (
    <div className="text-center">
      <div className="animate-pop text-7xl">🏆</div>
      <h2 className="mt-3 font-display text-5xl font-black">
        {tie ? "It's a tie!" : <span className="text-shimmer-gold">{top.name} wins!</span>}
      </h2>
      <div className="mx-auto mt-8 max-w-sm space-y-2">
        {ranked.map((t, i) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center justify-between rounded-xl border px-4 py-3",
              i === 0 && !tie ? "border-gold bg-gold/10" : "border-white/10 bg-white/5",
            )}
          >
            <span className="font-semibold">
              {i === 0 && !tie ? "👑 " : `${i + 1}. `}
              {t.name}
            </span>
            <span className="font-display text-2xl font-black">{scores[t.id] ?? 0}</span>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <form action={startNextRound}>
          <input type="hidden" name="groupId" value={groupId} />
          <button type="submit" className="btn btn-primary">
            🔄 Play another round
          </button>
        </form>
        <a href={`/dashboard/g/${groupId}`} className="btn btn-ghost">
          Back to group
        </a>
      </div>
      <p className="mt-3 text-xs text-cream/40">
        Another round reshuffles feud questions and generates fresh trivia.
      </p>
    </div>
  );
}

function SettingsPanel({
  feudSeconds,
  triviaSeconds,
  onApply,
  onClose,
}: {
  feudSeconds: number;
  triviaSeconds: number;
  onApply: (f: number, t: number) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(feudSeconds);
  const [t, setT] = useState(triviaSeconds);
  return (
    <div className="card mt-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold">Adjust timers</h3>
        <button onClick={onClose} className="text-cream/50 hover:text-cream" aria-label="Close">
          ✕
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <label className="block">
          <span className="label">Feud seconds</span>
          <input
            type="number"
            min={5}
            max={120}
            value={f}
            onChange={(e) => setF(Number(e.target.value))}
            className="input mt-1"
          />
        </label>
        <label className="block">
          <span className="label">Trivia seconds</span>
          <input
            type="number"
            min={30}
            max={600}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
            className="input mt-1"
          />
        </label>
      </div>
      <button
        onClick={() => {
          onApply(f, t);
          onClose();
        }}
        className="btn btn-secondary mt-3 text-sm"
      >
        Apply (takes effect next turn)
      </button>
    </div>
  );
}
