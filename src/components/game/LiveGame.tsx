"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SaysReveal } from "@/components/SaysReveal";
import { pickTagline } from "@/lib/brand";
import { cn } from "@/lib/utils";
import {
  scoreFeud,
  scoreTrivia,
  scoreTriviaFromState,
  scoreGuessWho,
  scoreGuessWhat,
  flagTriviaTooObvious,
  persistTurn,
  setGameStatus,
  setGameTimers,
  setWinTarget,
  adjustScore,
  revertTurn,
  recordSteal,
  startNextRound,
  startTriviaOnlyGame,
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
  category: string | null;
  prompt: string;
  point_value: number;
}
interface TeamLite {
  id: string;
  name: string;
  index: number;
  logoUrl: string | null;
  emoji: string | null;
}

export interface LiveGamePayload {
  groupId: string;
  gameId: string;
  groupName: string;
  allOrNothingValue: number;
  triviaPoints: number;
  placePoints: number[]; // survey 1st/2nd/3rd point values (e.g. [3,2,1])
  questionsPerTeam: number;
  settings: { feudSeconds: number; triviaSeconds: number };
  teams: TeamLite[];
  initialScores: Record<string, number>;
  queue: GameTurn[];
  cursor: number;
  feudQuestions: Record<string, FeudQ>;
  triviaByTeam: Record<string, TriviaQ[]>;
  topicsByTeam: Record<string, string[]>;
  usedTriviaIds?: string[]; // trivia already asked (so a resumed game skips them)
  triviaOnly?: boolean; // skip the survey entirely — trivia rounds only
  winTarget?: number | null; // trivia-only: score to play to (default behaviour when null)
  turnNetSeed?: Record<number, Record<string, number>>; // points each past turn awarded (for back-nav reversal)
  feudRatio?: number; // % of the game that's feud vs trivia (100 = feud only); governs which turns get a trivia question
  stealsEnabled?: boolean; // a missed question can be stolen by the next team for +1
}

/** Which turn cursors get a trivia question, given the feud:trivia split.
 *  ratio 50 → every turn (1:1); 100 → none (feud only); 75 → ~every 3rd, etc.
 *  Trivia slots are spread evenly across the game. */
function computeTriviaCursors(total: number, feudRatio: number): Set<number> {
  if (total <= 0 || feudRatio >= 100) return new Set();
  const want = Math.min(total, Math.max(0, Math.round((total * (100 - feudRatio)) / feudRatio)));
  if (want >= total) return new Set(Array.from({ length: total }, (_, i) => i));
  const out = new Set<number>();
  for (let i = 1; i <= want; i++) out.add(Math.min(total - 1, Math.round((i * total) / (want + 1))));
  return out;
}

type Phase = "preGame" | "intro" | "feud" | "feudReveal" | "triviaIntro" | "trivia" | "triviaReveal" | "over";

const TEAM_ACCENT = ["text-magenta", "text-cyan", "text-gold", "text-green"];
const TEAM_BG = ["bg-magenta", "bg-cyan", "bg-gold", "bg-green"];

/** A team's logo (uploaded), emoji badge, or a plain color dot. */
function TeamBadge({ team, className }: { team: TeamLite; className?: string }) {
  const box = className ?? "h-6 w-6";
  if (team.logoUrl)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logoUrl} alt="" className={cn("rounded-full object-cover", box)} />;
  if (team.emoji) return <span className={cn("grid place-items-center", box)}>{team.emoji}</span>;
  return <span className={cn("inline-block rounded-full", box, TEAM_BG[team.index % TEAM_BG.length])} />;
}

export function LiveGame(p: LiveGamePayload) {
  const router = useRouter();
  const [cursor, setCursor] = useState(p.cursor);
  const [phase, setPhase] = useState<Phase>(p.cursor === 0 ? "preGame" : "intro");
  const [scores, setScores] = useState<Record<string, number>>(p.initialScores);
  const [pending, setPending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [winTarget, setWinTargetLocal] = useState(p.winTarget ?? 0);

  const [feudSeconds, setFeudSeconds] = useState(p.settings.feudSeconds);
  const [triviaSeconds, setTriviaSeconds] = useState(p.settings.triviaSeconds);
  const [timeLeft, setTimeLeft] = useState(0);

  const [guess, setGuess] = useState("");
  const [answer, setAnswer] = useState("");
  const [feudRes, setFeudRes] = useState<FeudResult | null>(null);
  const [feudBase, setFeudBase] = useState<FeudResult | null>(null); // original (pre-override) for undo
  const [guessRes, setGuessRes] = useState<GuessResult | null>(null);
  const [guessBase, setGuessBase] = useState<GuessResult | null>(null);
  const [triviaRes, setTriviaRes] = useState<TriviaResult | null>(null);
  const [usedTrivia, setUsedTrivia] = useState<Set<string>>(() => new Set(p.usedTriviaIds ?? []));
  const [currentTrivia, setCurrentTrivia] = useState<TriviaQ | null>(null);

  // --- turn ledger: the net points each turn has awarded, so the host can step
  //     back to a question and we reverse exactly what it scored before re-play.
  const turnNetRef = useRef<Record<number, Record<string, number>>>({});
  const completedRef = useRef<Set<number>>(new Set());
  const furthestRef = useRef<number>(p.cursor);
  const pickedTriviaRef = useRef<Record<number, TriviaQ>>({});
  const seededRef = useRef(false);
  if (!seededRef.current) {
    seededRef.current = true;
    for (const [c, m] of Object.entries(p.turnNetSeed ?? {})) {
      turnNetRef.current[Number(c)] = { ...m };
      completedRef.current.add(Number(c));
      furthestRef.current = Math.max(furthestRef.current, Number(c));
    }
  }

  // Steal mode: resolved steals per cursor ("won" = next team took +1, "skip" = none).
  const [steals, setSteals] = useState<Record<number, "won" | "skip">>({});
  // Which turns carry a trivia question, from the feud:trivia split (computed once).
  const triviaCursorsRef = useRef<Set<number> | null>(null);
  if (triviaCursorsRef.current === null)
    triviaCursorsRef.current = computeTriviaCursors(p.queue.length, p.feudRatio ?? 50);
  const turnHasTrivia = (c: number) => (p.triviaOnly ? true : triviaCursorsRef.current!.has(c));

  const addTurnNet = (c: number, teamId: string, pts: number) => {
    if (!pts) return;
    const m = (turnNetRef.current[c] ??= {});
    m[teamId] = (m[teamId] ?? 0) + pts;
  };
  // Re-playing a turn we already scored: undo its points + events first.
  async function revertIfReplaying(c: number) {
    if (!completedRef.current.has(c)) return;
    const net = { ...(turnNetRef.current[c] ?? {}) };
    setScores((s) => {
      const ns = { ...s };
      for (const [tid, pts] of Object.entries(net)) ns[tid] = Math.max(0, (ns[tid] ?? 0) - pts);
      return ns;
    });
    delete turnNetRef.current[c];
    completedRef.current.delete(c);
    setSteals((s) => {
      const n = { ...s };
      delete n[c];
      return n;
    });
    await revertTurn({ gameId: p.gameId, cursor: c, deltas: net });
  }
  // Jump to any turn (back to fix an accidental entry, or forward to a played one).
  async function goToTurn(target: number) {
    if (pending || target < 0 || target >= p.queue.length || target === cursor) return;
    setPaused(false);
    setGuess("");
    setAnswer("");
    setFeudRes(null);
    setFeudBase(null);
    setGuessRes(null);
    setGuessBase(null);
    setTriviaRes(null);
    setCurrentTrivia(null);
    setCursor(target);
    setPhase(target === 0 ? "preGame" : "intro");
    void persistTurn({ gameId: p.gameId, cursor: target }); // background; UI already moved
  }

  const turn = p.queue[cursor];
  const total = p.queue.length;
  const teamById = new Map(p.teams.map((t) => [t.id, t]));
  const activeTeam = turn ? teamById.get(turn.teamId) : undefined;
  const accentIdx = activeTeam ? activeTeam.index % TEAM_ACCENT.length : 0;

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
  async function startFeud() {
    await revertIfReplaying(cursor); // re-doing a past turn? wipe its old score first
    setGuess("");
    setFeudRes(null);
    setFeudBase(null);
    setGuessRes(null);
    setGuessBase(null);
    setTimeLeft(feudSeconds);
    setPhase("feud");
  }

  async function submitSurvey() {
    if (pending || phase !== "feud" || !turn) return;
    setPending(true);
    setPhase("feudReveal");
    const who = { memberId: turn.memberId, memberName: turn.memberName, round: turn.round, cursor };
    try {
      if (turn.kind === "guess_who") {
        const res = await scoreGuessWho({
          gameId: p.gameId,
          questionId: turn.feudQuestionId,
          answerMemberId: turn.answerMemberId ?? "",
          teamId: turn.teamId,
          guess,
          ...who,
        });
        setGuessRes(res);
        setGuessBase(res);
        if (res.points > 0) setScores((s) => ({ ...s, [turn.teamId]: (s[turn.teamId] ?? 0) + res.points }));
      addTurnNet(cursor, turn.teamId, res.points);
      } else if (turn.kind === "guess_what") {
        const res = await scoreGuessWhat({
          gameId: p.gameId,
          questionId: turn.feudQuestionId,
          targetMemberId: turn.targetMemberId ?? "",
          teamId: turn.teamId,
          guess,
          ...who,
        });
        setGuessRes(res);
        setGuessBase(res);
        if (res.points > 0) setScores((s) => ({ ...s, [turn.teamId]: (s[turn.teamId] ?? 0) + res.points }));
      addTurnNet(cursor, turn.teamId, res.points);
      } else {
        const res = await scoreFeud({
          gameId: p.gameId,
          questionId: turn.feudQuestionId,
          teamId: turn.teamId,
          guess,
          ...who,
        });
        setFeudRes(res);
        setFeudBase(res);
        if (res.points > 0) setScores((s) => ({ ...s, [turn.teamId]: (s[turn.teamId] ?? 0) + res.points }));
      addTurnNet(cursor, turn.teamId, res.points);
      }
    } finally {
      setPending(false);
    }
  }

  // Pick a trivia question and show the "get ready" transition (category reveal).
  async function continueToTrivia() {
    if (!turn) return;
    await revertIfReplaying(cursor); // trivia-only re-play starts here; feud re-play already reverted
    const bank = p.triviaByTeam[turn.teamId] ?? [];
    // Re-use the same question when re-playing a turn, otherwise take the next unused.
    let next = pickedTriviaRef.current[cursor] ?? bank.find((q) => !usedTrivia.has(q.id));
    if (!next && bank.length > 0) next = bank[Math.floor(Math.random() * bank.length)];
    if (!next) {
      nextTurn();
      return;
    }
    pickedTriviaRef.current[cursor] = next;
    setUsedTrivia((s) => new Set(s).add(next!.id));
    setCurrentTrivia(next);
    setAnswer("");
    setTriviaRes(null);
    setPhase("triviaIntro");
  }

  // After a feud/guess reveal: play this turn's trivia if it has one (per the
  // feud:trivia split), otherwise move straight on (e.g. a feud-only game).
  function afterSurvey() {
    if (turnHasTrivia(cursor)) continueToTrivia();
    else nextTurn();
  }

  // Steal: the active team missed; the next team (rotates with the active team)
  // can take it for a flat +1.
  async function resolveSteal(won: boolean, stealTeamId: string) {
    setSteals((s) => ({ ...s, [cursor]: won ? "won" : "skip" }));
    if (!won) return;
    setScores((s) => ({ ...s, [stealTeamId]: (s[stealTeamId] ?? 0) + 1 }));
    addTurnNet(cursor, stealTeamId, 1);
    await recordSteal({
      gameId: p.gameId,
      teamId: stealTeamId,
      cursor,
      questionId: turn?.feudQuestionId || currentTrivia?.id || undefined,
    });
  }

  function startTrivia() {
    setTimeLeft(triviaSeconds);
    setPhase("trivia");
  }

  // Host: this trivia question is too obvious — log it (to teach future
  // generation) and swap in the next unused one.
  async function swapTriviaTooEasy() {
    if (!turn || !currentTrivia) return;
    const bank = p.triviaByTeam[turn.teamId] ?? [];
    const next = bank.find((q) => q.id !== currentTrivia.id && !usedTrivia.has(q.id));
    const flaggedId = currentTrivia.id;
    if (next) {
      setUsedTrivia((s) => new Set(s).add(next.id));
      setCurrentTrivia(next);
      setAnswer("");
      if (phase === "trivia") setTimeLeft(triviaSeconds);
    }
    await flagTriviaTooObvious({ groupId: p.groupId, gameId: p.gameId, questionId: flaggedId });
  }

  async function submitTrivia() {
    if (pending || phase !== "trivia" || !turn || !currentTrivia) return;
    setPending(true);
    setPhase("triviaReveal");
    try {
      const res = p.triviaOnly
        ? await scoreTriviaFromState({
            gameId: p.gameId,
            questionId: currentTrivia.id,
            teamId: turn.teamId,
            answer,
            memberId: turn.memberId,
            memberName: turn.memberName,
            cursor,
          })
        : await scoreTrivia({
            gameId: p.gameId,
            questionId: currentTrivia.id,
            teamId: turn.teamId,
            answer,
            memberId: turn.memberId,
            memberName: turn.memberName,
            round: turn.round,
            topic: currentTrivia.topic,
            cursor,
          });
      setTriviaRes(res);
      if (res.points > 0) setScores((s) => ({ ...s, [turn.teamId]: (s[turn.teamId] ?? 0) + res.points }));
      addTurnNet(cursor, turn.teamId, res.points);
    } finally {
      setPending(false);
    }
  }

  // Trivia-only: end now (crown the leader), or raise the target and play on.
  function endGameNow() {
    setPhase("over");
    void persistTurn({ gameId: p.gameId, cursor, finished: true });
  }
  async function keepPlaying() {
    const next = (winTarget || 0) + 10;
    setWinTargetLocal(next);
    await setWinTarget({ gameId: p.gameId, winTarget: next });
    await nextTurn();
  }

  function nextTurn() {
    completedRef.current.add(cursor); // this turn is scored & banked (reversible via back-nav)
    const next = cursor + 1;
    if (next >= total) {
      setPhase("over");
      void persistTurn({ gameId: p.gameId, cursor, finished: true }); // persist in background
      return;
    }
    // Advance the UI immediately; persist the cursor in the background so the
    // click feels instant (the cursor is also recoverable from game events).
    furthestRef.current = Math.max(furthestRef.current, next);
    setCursor(next);
    setCurrentTrivia(null);
    setFeudRes(null);
    setFeudBase(null);
    setGuessRes(null);
    setGuessBase(null);
    setTriviaRes(null);
    setPhase("intro");
    void persistTurn({ gameId: p.gameId, cursor: next });
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

  // Host overrides on the feud reveal (award a specific answer the guesser meant).
  async function overrideFeud(bucketLabel: string, awardPoints: number) {
    if (!turn || !feudRes) return;
    const delta = awardPoints - feudRes.points;
    setFeudRes({ ...feudRes, matched: bucketLabel, points: awardPoints });
    setScores((s) => ({ ...s, [turn.teamId]: Math.max(0, (s[turn.teamId] ?? 0) + delta) }));
    addTurnNet(cursor, turn.teamId, delta);
    await adjustScore({ gameId: p.gameId, teamId: turn.teamId, delta });
  }
  // Undo a feud override back to what was auto-scored.
  async function undoFeud() {
    if (!turn || !feudRes || !feudBase) return;
    const delta = feudBase.points - feudRes.points;
    setFeudRes(feudBase);
    if (delta !== 0) {
      setScores((s) => ({ ...s, [turn.teamId]: Math.max(0, (s[turn.teamId] ?? 0) + delta) }));
      addTurnNet(cursor, turn.teamId, delta);
      await adjustScore({ gameId: p.gameId, teamId: turn.teamId, delta });
    }
  }

  async function adjustTeam(teamId: string, delta: number) {
    setScores((s) => ({ ...s, [teamId]: Math.max(0, (s[teamId] ?? 0) + delta) }));
    await adjustScore({ gameId: p.gameId, teamId, delta });
  }

  async function overrideTrivia(makeCorrect: boolean) {
    if (!turn || !triviaRes) return;
    const target = makeCorrect ? p.triviaPoints : 0;
    const delta = target - triviaRes.points;
    setTriviaRes({ ...triviaRes, correct: makeCorrect, points: target });
    setScores((s) => ({ ...s, [turn.teamId]: Math.max(0, (s[turn.teamId] ?? 0) + delta) }));
    addTurnNet(cursor, turn.teamId, delta);
    await adjustScore({ gameId: p.gameId, teamId: turn.teamId, delta });
  }

  // All-or-nothing toggle for guess_who / guess_what reveals.
  async function overrideGuess(makeCorrect: boolean) {
    if (!turn || !guessRes) return;
    const target = makeCorrect ? p.allOrNothingValue : 0;
    const delta = target - guessRes.points;
    setGuessRes({ ...guessRes, correct: makeCorrect, points: target });
    setScores((s) => ({ ...s, [turn.teamId]: Math.max(0, (s[turn.teamId] ?? 0) + delta) }));
    addTurnNet(cursor, turn.teamId, delta);
    await adjustScore({ gameId: p.gameId, teamId: turn.teamId, delta });
  }

  // Steal availability for the current reveal: the next team (rotates with the
  // active team) can take a missed question for +1.
  const stealPos = turn ? p.teams.findIndex((t) => t.id === turn.teamId) : -1;
  const stealTeam =
    p.stealsEnabled && stealPos >= 0 && p.teams.length > 1
      ? p.teams[(stealPos + 1) % p.teams.length]
      : null;
  const activeMissed =
    (phase === "feudReveal" && turn?.kind === "feud" && feudRes != null && feudRes.points === 0) ||
    (phase === "feudReveal" && turn != null && turn.kind !== "feud" && guessRes != null && guessRes.points === 0) ||
    (phase === "triviaReveal" && triviaRes != null && triviaRes.points === 0);
  const stealResult = steals[cursor];
  const stealOffered = Boolean(stealTeam && activeMissed && stealResult === undefined);
  const hasTrivia = !p.triviaOnly && (triviaCursorsRef.current?.size ?? 0) > 0;

  // --- render --------------------------------------------------------------
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-4">
      <TopBar
        groupName={p.groupName}
        groupId={p.groupId}
        cursor={cursor}
        total={total}
        paused={paused}
        onPause={togglePause}
        onSettings={() => setShowSettings((s) => !s)}
        onScores={() => setShowScores((s) => !s)}
        onExit={() => router.push(`/dashboard/g/${p.groupId}`)}
        onPrev={() => goToTurn(cursor - 1)}
        onNext={() => goToTurn(cursor + 1)}
        canPrev={cursor > 0 && phase !== "over"}
        canNext={cursor < furthestRef.current && phase !== "over"}
        phase={phase}
      />

      {/* re-visiting an earlier, already-played question */}
      {phase !== "over" && cursor < furthestRef.current && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gold">
          <span>⏮ You stepped back to question {cursor + 1}. Re-playing it replaces its old answer &amp; score.</span>
          <button onClick={() => goToTurn(furthestRef.current)} className="shrink-0 font-semibold underline hover:text-cream">
            Back to live (Q{Math.min(furthestRef.current + 1, total)}) →
          </button>
        </div>
      )}

      <Scoreboard teams={p.teams} scores={scores} activeTeamId={turn?.teamId} />

      {showSettings && (
        <SettingsPanel
          feudSeconds={feudSeconds}
          triviaSeconds={triviaSeconds}
          onApply={applyTimers}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showScores && phase !== "over" && (
        <ScoreAdjustPanel
          teams={p.teams}
          scores={scores}
          step={p.allOrNothingValue}
          onAdjust={adjustTeam}
          onClose={() => setShowScores(false)}
        />
      )}

      {/* STEAL: active team missed — the next team can take it for +1 */}
      {stealOffered && stealTeam && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan/40 bg-cyan/10 px-3 py-2 text-sm">
          <span className="min-w-0">
            🪝 Missed! <span className="font-semibold text-cream">{stealTeam.name}</span> can steal for{" "}
            <span className="font-semibold">+1</span> — did they get it?
          </span>
          <span className="flex shrink-0 gap-2">
            <button
              onClick={() => resolveSteal(true, stealTeam.id)}
              className="btn btn-primary px-3 py-1 text-xs"
            >
              ✓ Steal +1
            </button>
            <button
              onClick={() => resolveSteal(false, stealTeam.id)}
              className="btn btn-ghost px-3 py-1 text-xs"
            >
              ✗ No steal
            </button>
          </span>
        </div>
      )}
      {stealResult === "won" && stealTeam && (phase === "feudReveal" || phase === "triviaReveal") && (
        <div className="mt-3 rounded-xl border border-green/40 bg-green/10 px-3 py-2 text-sm text-green">
          🪝 {stealTeam.name} stole it — +1!
        </div>
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

        {/* PRE-GAME (trivia-only): simple "first to N" splash */}
        {phase === "preGame" && p.triviaOnly && (
          <div className="w-full max-w-xl text-center">
            <div className="text-5xl">🎲</div>
            <h2 className="mt-3 font-display text-4xl font-black">Trivia night</h2>
            <p className="mt-2 text-cream/70">
              Completely random questions. Teams go back and forth — captain answers for the team.
              Every right answer is <span className="font-semibold text-cream">{p.triviaPoints} points</span>.
            </p>
            {winTarget > 0 && (
              <div className="mt-4 chip inline-flex text-sm">🏁 First to {winTarget} wins</div>
            )}
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              {p.teams.map((t) => (
                <div key={t.id} className="card flex items-center justify-center gap-2 p-3">
                  <TeamBadge team={t} className="h-6 w-6 text-base" />
                  <span className="font-display font-bold">{t.name}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setPhase("intro")} className="btn btn-primary mt-8 text-lg">
              Start trivia →
            </button>
          </div>
        )}

        {/* PRE-GAME: show each team's trivia topics (or a feud-only splash) */}
        {phase === "preGame" && !p.triviaOnly && (
          <div className="w-full max-w-2xl text-center">
            <div className="text-5xl">{hasTrivia ? "📋" : "🎤"}</div>
            <h2 className="mt-3 font-display text-4xl font-black">
              {hasTrivia ? "Tonight's trivia" : "Feud night"}
            </h2>
            <p className="mt-1 text-cream/60">
              {hasTrivia
                ? "What each team drew. (Feud questions stay a surprise!)"
                : "All feud, no trivia tonight — guess what your crew said."}
            </p>
            {hasTrivia && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {p.teams.map((t) => (
                  <div key={t.id} className="card p-4 text-left">
                    <div className="flex items-center gap-2">
                      <TeamBadge team={t} className="h-7 w-7 text-lg" />
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
            )}
            <button onClick={() => setPhase("intro")} className="btn btn-primary mt-8 text-lg">
              Start the game →
            </button>
          </div>
        )}

        {/* INTRO */}
        {phase === "intro" && turn && activeTeam && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <TeamBadge team={activeTeam} className="h-7 w-7 text-lg" />
              <div className="label">
                {turn.teamName} ·{" "}
                {p.triviaOnly
                  ? "trivia turn"
                  : turn.kind === "guess_who"
                    ? "whose answer?"
                    : turn.kind === "guess_what"
                      ? "guess their answer"
                      : "feud turn"}
              </div>
            </div>
            <h2 className="mt-2 font-display text-5xl font-black">
              <span className={TEAM_ACCENT[accentIdx]}>{turn.memberName}</span> is up!
            </h2>
            <p className="mt-3 text-cream/60">
              {p.triviaOnly
                ? `A random question for ${turn.teamName} — captain answers.`
                : turn.kind === "guess_who"
                  ? "An answer's about to show — name who gave it."
                  : turn.kind === "guess_what"
                    ? `Guess what ${turn.targetName} answered.`
                    : "Guess what the group said."}{" "}
              {p.triviaOnly ? `${triviaSeconds}s on the clock.` : `${feudSeconds}s on the clock.`}
            </p>
            <button
              onClick={p.triviaOnly ? continueToTrivia : startFeud}
              className="btn btn-primary mt-8 text-lg"
            >
              {p.triviaOnly ? "Bring the question →" : turn.kind === "feud" ? "Start feud question →" : "Reveal & guess →"}
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
                <div className="mt-2 font-display text-4xl font-black text-gold">“{turn.revealAnswer}”</div>
                <p className="mt-3 text-lg text-cream/70">Who said it?</p>
                <div className="chip mt-3 inline-flex">🎯 {p.allOrNothingValue} pts · all or nothing</div>
              </>
            ) : turn.kind === "guess_what" ? (
              <>
                <div className="mt-6 text-sm text-cream/50">{turn.targetName}&apos;s answer to:</div>
                <h2 className="mt-1 font-display text-3xl font-bold leading-snug">
                  {p.feudQuestions[turn.feudQuestionId]?.prompt ?? "…"}
                </h2>
                <p className="mt-3 text-lg text-cream/70">What did {turn.targetName} say?</p>
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
            <div className="mt-5 flex items-center justify-center gap-2">
              <button onClick={() => setPhase("intro")} className="btn btn-ghost">
                ← Back
              </button>
              <button onClick={submitSurvey} disabled={pending} className="btn btn-primary text-lg">
                Lock it in
              </button>
            </div>
          </div>
        )}

        {/* SURVEY REVEAL */}
        {phase === "feudReveal" && turn && turn.kind === "feud" && (
          <FeudRevealPanel
            groupName={p.groupName}
            guess={guess}
            result={feudRes}
            base={feudBase}
            placePoints={p.placePoints}
            pending={pending}
            onOverride={overrideFeud}
            onUndo={undoFeud}
            onContinue={afterSurvey}
            continueLabel={turnHasTrivia(cursor) ? "On to trivia →" : "Next →"}
          />
        )}
        {phase === "feudReveal" && turn && turn.kind !== "feud" && (
          <GuessRevealPanel
            kind={turn.kind}
            guess={guess}
            result={guessRes}
            base={guessBase}
            pending={pending}
            onOverride={overrideGuess}
            onContinue={afterSurvey}
            continueLabel={turnHasTrivia(cursor) ? "On to trivia →" : "Next →"}
          />
        )}

        {/* TRIVIA TRANSITION — tell them the category they'll be grilled on */}
        {phase === "triviaIntro" && currentTrivia && turn && activeTeam && (
          <div className="w-full max-w-xl text-center">
            <div className="text-5xl">📚</div>
            <p className="mt-3 label">Trivia time</p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <TeamBadge team={activeTeam} className="h-7 w-7 text-lg" />
              <span className="font-display text-2xl font-bold">{turn.teamName}</span>
            </div>
            <p className="mt-4 text-cream/70">You&apos;re getting grilled on…</p>
            <div className="mt-2 font-display text-4xl font-black text-shimmer-gold">{currentTrivia.topic}</div>
            {currentTrivia.category && (
              <div className="mt-1 text-sm uppercase tracking-wide text-cream/45">{currentTrivia.category}</div>
            )}
            <div className="mt-6 flex items-center justify-center gap-2">
              <button onClick={() => setPhase(p.triviaOnly ? "intro" : "feudReveal")} className="btn btn-ghost">
                ← Back
              </button>
              <button onClick={startTrivia} className="btn btn-primary text-lg">
                Bring it on →
              </button>
            </div>
            <button onClick={swapTriviaTooEasy} className="mt-4 block w-full text-xs text-cream/40 hover:text-cream">
              Swap this topic&apos;s question (too easy?)
            </button>
          </div>
        )}

        {/* TRIVIA */}
        {phase === "trivia" && currentTrivia && turn && (
          <div className="w-full max-w-2xl text-center">
            <TimerRing seconds={timeLeft} total={triviaSeconds} />
            <div className="chip mt-6 inline-flex">
              📚 {currentTrivia.topic} · {p.triviaPoints} pts
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold leading-snug">{currentTrivia.prompt}</h2>
            <p className="mt-2 text-sm text-cream/50">Captain answers for {turn.teamName}.</p>
            <input
              autoFocus
              className="input mt-6 text-center text-xl"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitTrivia()}
              placeholder="Team's answer…"
            />
            <div className="mt-5 flex items-center justify-center gap-2">
              <button onClick={() => setPhase("triviaIntro")} className="btn btn-ghost">
                ← Back
              </button>
              <button onClick={submitTrivia} disabled={pending} className="btn btn-primary text-lg">
                Lock it in
              </button>
            </div>
            <button onClick={swapTriviaTooEasy} className="mt-3 text-xs text-cream/40 hover:text-cream">
              ⚠ Too obvious — swap &amp; flag it
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
            triviaOnly={Boolean(p.triviaOnly)}
            winTarget={winTarget}
            teams={p.teams}
            scores={scores}
            onEndGame={endGameNow}
            onKeepPlaying={keepPlaying}
          />
        )}

        {/* OVER */}
        {phase === "over" && (
          <GameOver
            teams={p.teams}
            scores={scores}
            groupId={p.groupId}
            gameId={p.gameId}
            questionsPerTeam={p.questionsPerTeam}
            triviaOnly={Boolean(p.triviaOnly)}
            winTarget={winTarget}
          />
        )}
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
  groupId,
  cursor,
  total,
  paused,
  onPause,
  onSettings,
  onScores,
  onExit,
  onPrev,
  onNext,
  canPrev,
  canNext,
  phase,
}: {
  groupName: string;
  groupId: string;
  cursor: number;
  total: number;
  paused: boolean;
  onPause: () => void;
  onSettings: () => void;
  onScores: () => void;
  onExit: () => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  phase: Phase;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex min-w-0 items-center gap-1.5">
        {phase !== "over" && (
          <>
            <button
              onClick={onPrev}
              disabled={!canPrev}
              title="Previous question (fix an accidental entry)"
              aria-label="Previous question"
              className="btn btn-ghost px-2 py-1 text-xs disabled:opacity-30"
            >
              ‹
            </button>
            <button
              onClick={onNext}
              disabled={!canNext}
              title="Next question"
              aria-label="Next question"
              className="btn btn-ghost px-2 py-1 text-xs disabled:opacity-30"
            >
              ›
            </button>
          </>
        )}
        <a
          href="/dashboard"
          title="Tallyho home — all your games"
          aria-label="Tallyho home"
          className="btn btn-ghost px-2 py-1 text-xs"
        >
          ⌂
        </a>
        <div className="min-w-0 truncate text-cream/60">
          <a
            href={`/dashboard/g/${groupId}`}
            title="Back to this game's home"
            className="font-display font-bold text-cream hover:text-cyan hover:underline"
          >
            {groupName}
          </a>{" "}
          · Q {Math.min(cursor + 1, total)}/{total}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {phase !== "over" && (
          <>
            <button onClick={onPause} className="btn btn-ghost px-3 py-1.5 text-xs">
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
            <button onClick={onScores} className="btn btn-ghost px-3 py-1.5 text-xs">
              ⚖ Scores
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
              "card flex items-center justify-between gap-2 px-3 py-3",
              active && "ring-2 ring-magenta",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <TeamBadge team={t} className="h-5 w-5 shrink-0 text-sm" />
              <span className="truncate text-sm font-semibold">{t.name}</span>
            </div>
            <span className="shrink-0 font-display text-2xl font-black tabular-nums">{scores[t.id] ?? 0}</span>
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
  base,
  placePoints,
  pending,
  onOverride,
  onUndo,
  onContinue,
  continueLabel,
}: {
  groupName: string;
  guess: string;
  result: FeudResult | null;
  base: FeudResult | null;
  placePoints: number[];
  pending: boolean;
  onOverride: (label: string, awardPoints: number) => void;
  onUndo: () => void;
  onContinue: () => void;
  continueLabel: string;
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
  const places = result.places ?? placePoints.length;
  const top = placePoints[0] ?? 0;
  const points = result.points;
  const taglineBucket = points === 0 ? "feudMiss" : points >= top ? "feudBigHit" : "feudSmallHit";
  const ordinals = ["1st", "2nd", "3rd"];
  const overridden = Boolean(base && (base.points !== result.points || base.matched !== result.matched));
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
        {result.buckets.map((b, i) => {
          const matched = result.matched?.toLowerCase() === b.label.toLowerCase();
          const award = i < places ? (placePoints[i] ?? 0) : 0;
          return (
            <button
              key={b.label}
              onClick={() => onOverride(b.label, award)}
              disabled={pending}
              title="Tap to award this answer to the team (host override)"
              className={cn(
                "animate-flip-in relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition hover:border-gold/70",
                matched ? "border-gold bg-gold/10" : "border-white/10 bg-white/5",
              )}
            >
              <div
                className="absolute inset-y-0 left-0 bg-white/5"
                style={{ width: `${total ? (b.count / total) * 100 : 0}%` }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold">
                  {i < places && (
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[0.65rem] font-bold text-cream/70">
                      {ordinals[i]}
                    </span>
                  )}
                  {b.label}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-cream/45">{b.count} said</span>
                  <span className={cn("font-display text-xl font-black", award > 0 ? "text-gold" : "text-cream/35")}>
                    +{award}
                  </span>
                </span>
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
        <p className="mt-1 text-xs text-cream/40">
          {places === 1
            ? `Only the top answer scores (+${placePoints[0] ?? 0}).`
            : places === 2
              ? `Top answer +${placePoints[0] ?? 0}, 2nd +${placePoints[1] ?? 0}.`
              : `Top +${placePoints[0] ?? 0}, 2nd +${placePoints[1] ?? 0}, 3rd +${placePoints[2] ?? 0}.`}{" "}
          Wrong match? Tap the answer they meant.
          {overridden && (
            <>
              {" "}
              <button onClick={onUndo} disabled={pending} className="underline hover:text-cream">
                ↺ Undo
              </button>
            </>
          )}
        </p>
      </div>
      <button onClick={onContinue} disabled={pending} className="btn btn-secondary mt-6 text-lg">
        {continueLabel}
      </button>
    </div>
  );
}

function GuessRevealPanel({
  kind,
  guess,
  result,
  base,
  pending,
  onOverride,
  onContinue,
  continueLabel,
}: {
  kind: string;
  guess: string;
  result: GuessResult | null;
  base: GuessResult | null;
  pending: boolean;
  onOverride: (correct: boolean) => void;
  onContinue: () => void;
  continueLabel: string;
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
  const overridden = Boolean(base && base.correct !== result.correct);
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
        {overridden ? "↺ Undo" : correct ? "Mark it wrong instead" : "Actually correct — give the points"}
      </button>
      <div className="mt-5">
        <button onClick={onContinue} disabled={pending} className="btn btn-secondary text-lg">
          {continueLabel}
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
  triviaOnly = false,
  winTarget = 0,
  teams = [],
  scores = {},
  onEndGame,
  onKeepPlaying,
}: {
  answer: string;
  result: TriviaResult | null;
  pending: boolean;
  onOverride: (correct: boolean) => void;
  onNext: () => void;
  last: boolean;
  triviaOnly?: boolean;
  winTarget?: number;
  teams?: TeamLite[];
  scores?: Record<string, number>;
  onEndGame?: () => void;
  onKeepPlaying?: () => void;
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
  const ranked = [...teams].map((t) => ({ t, s: scores[t.id] ?? 0 })).sort((a, b) => b.s - a.s);
  const leader = ranked[0];
  const reachedLeader = triviaOnly && winTarget > 0 && leader && leader.s >= winTarget ? leader : null;
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
      {reachedLeader ? (
        <div className="mt-5">
          <div className="font-display text-2xl font-black text-shimmer-gold">
            🏁 {reachedLeader.t.name} reached {reachedLeader.s}!
          </div>
          <p className="mt-1 text-sm text-cream/60">Call it here, or raise the bar and keep rolling.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button onClick={onEndGame} disabled={pending} className="btn btn-primary text-lg">
              🏆 End &amp; crown {reachedLeader.t.name}
            </button>
            <button onClick={onKeepPlaying} disabled={pending} className="btn btn-secondary">
              Keep playing → first to {winTarget + 10}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <button onClick={onNext} disabled={pending} className="btn btn-primary text-lg">
            {last ? "See final scores 🏆" : "Next turn →"}
          </button>
        </div>
      )}
    </div>
  );
}

function GameOver({
  teams,
  scores,
  groupId,
  gameId,
  questionsPerTeam,
  triviaOnly = false,
  winTarget = 0,
}: {
  teams: TeamLite[];
  scores: Record<string, number>;
  groupId: string;
  gameId: string;
  questionsPerTeam: number;
  triviaOnly?: boolean;
  winTarget?: number;
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
              "flex items-center justify-between gap-2 rounded-xl border px-4 py-3",
              i === 0 && !tie ? "border-gold bg-gold/10" : "border-white/10 bg-white/5",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 font-semibold">
              <span className="shrink-0">{i === 0 && !tie ? "👑" : `${i + 1}.`}</span>
              <TeamBadge team={t} className="h-5 w-5 shrink-0 text-sm" />
              <span className="truncate">{t.name}</span>
            </span>
            <span className="shrink-0 font-display text-2xl font-black tabular-nums">{scores[t.id] ?? 0}</span>
          </div>
        ))}
      </div>
      {triviaOnly ? (
        <>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <form action={startTriviaOnlyGame}>
              <input type="hidden" name="groupId" value={groupId} />
              <input type="hidden" name="winTarget" value={winTarget || 30} />
              <button type="submit" className="btn btn-primary text-lg">
                🎲 New trivia game
              </button>
            </form>
            <a href={`/recap/${gameId}`} className="btn btn-secondary">
              🎬 See the recap
            </a>
            <a href={`/dashboard/g/${groupId}`} className="btn btn-ghost">
              Back to group
            </a>
          </div>
          <p className="mt-3 text-xs text-cream/40">
            New game keeps the same teams with a fresh 0–0 scoreboard and brand-new random questions.
          </p>
        </>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={`/recap/${gameId}`} className="btn btn-primary text-lg">
              🎬 See the recap
            </a>
            <form action={startNextRound}>
              <input type="hidden" name="groupId" value={groupId} />
              <input type="hidden" name="questionsPerTeam" value={questionsPerTeam} />
              <button type="submit" className="btn btn-secondary">
                🔄 Play again
              </button>
            </form>
            <a href={`/dashboard/g/${groupId}`} className="btn btn-ghost">
              Back to group
            </a>
          </div>
          <p className="mt-3 text-xs text-cream/40">
            The recap has every stat, superlative and player card — easy to share. Play again reshuffles feud
            questions and generates fresh trivia.
          </p>
        </>
      )}
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
  // Track as strings so the field can be cleared/edited without snapping to 0.
  const [f, setF] = useState(String(feudSeconds));
  const [t, setT] = useState(String(triviaSeconds));
  const clamp = (v: string, lo: number, hi: number, fallback: number) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(lo, Math.min(hi, n));
  };
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
            inputMode="numeric"
            min={5}
            max={120}
            value={f}
            onChange={(e) => setF(e.target.value)}
            onBlur={() => setF(String(clamp(f, 5, 120, feudSeconds)))}
            className="input mt-1"
          />
        </label>
        <label className="block">
          <span className="label">Trivia seconds</span>
          <input
            type="number"
            inputMode="numeric"
            min={30}
            max={600}
            value={t}
            onChange={(e) => setT(e.target.value)}
            onBlur={() => setT(String(clamp(t, 30, 600, triviaSeconds)))}
            className="input mt-1"
          />
        </label>
      </div>
      <button
        onClick={() => {
          onApply(clamp(f, 5, 120, feudSeconds), clamp(t, 30, 600, triviaSeconds));
          onClose();
        }}
        className="btn btn-secondary mt-3 text-sm"
      >
        Apply (takes effect next turn)
      </button>
    </div>
  );
}

function ScoreAdjustPanel({
  teams,
  scores,
  step,
  onAdjust,
  onClose,
}: {
  teams: TeamLite[];
  scores: Record<string, number>;
  step: number;
  onAdjust: (teamId: string, delta: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="card mt-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold">Fix scores</h3>
        <button onClick={onClose} className="text-cream/50 hover:text-cream" aria-label="Close">
          ✕
        </button>
      </div>
      <p className="mt-1 text-xs text-cream/50">
        Nudge any team if the auto-scoring got something wrong — handy when a free-text answer wasn&apos;t
        recognized. Changes save immediately.
      </p>
      <div className="mt-3 space-y-2">
        {teams.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <TeamBadge team={t} className="h-5 w-5 shrink-0 text-sm" />
              <span className="truncate text-sm font-semibold">{t.name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button onClick={() => onAdjust(t.id, -step)} className="btn btn-ghost px-2 py-1 text-xs">
                −{step}
              </button>
              <button onClick={() => onAdjust(t.id, -1)} className="btn btn-ghost px-2 py-1 text-xs">
                −1
              </button>
              <span className="w-9 text-center font-display text-xl font-black tabular-nums">{scores[t.id] ?? 0}</span>
              <button onClick={() => onAdjust(t.id, 1)} className="btn btn-ghost px-2 py-1 text-xs">
                +1
              </button>
              <button onClick={() => onAdjust(t.id, step)} className="btn btn-ghost px-2 py-1 text-xs">
                +{step}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
