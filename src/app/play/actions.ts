"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tallyBuckets, scoreFeudGuess } from "@/lib/feud";
import { fuzzyMatch, normalize } from "@/lib/match";
import { ensureAllHoldouts, reassignHoldoutsNewRound } from "@/lib/holdouts";
import { regenerateTriviaBank } from "@/lib/trivia/regenerate";
import { shuffle } from "@/lib/utils";
import { WIN_POINTS, TRIVIA_POINTS, SURVEY_PLACE_POINTS, placesForChoices } from "@/lib/scoring";
import type { Member, Team, VoteBucket, SurveyKind } from "@/lib/types";

const DEFAULT_SETTINGS = { feudSeconds: 25, triviaSeconds: 210 };

export interface GameTurn {
  round: number;
  teamId: string;
  teamName: string;
  memberId: string;
  memberName: string;
  kind: SurveyKind; // "feud" (consensus) | "guess_who" | "guess_what"
  feudQuestionId: string;
  // guess_who: the author whose answer is shown (scored server-side) + the text.
  answerMemberId?: string;
  revealAnswer?: string;
  // guess_what: whose answer the team guesses (the content stays server-side).
  targetMemberId?: string;
  targetName?: string;
}

export interface FeudResult {
  buckets: VoteBucket[];
  matched: string | null;
  points: number;
  places: number; // how many ranks paid out for this question (1–3)
}

export interface TriviaResult {
  correct: boolean;
  points: number;
  correctAnswer: string;
}

// Shared result for the all-or-nothing targeted kinds. `correctLabel` is the
// person (guess_who) or the answer (guess_what) to reveal.
export interface GuessResult {
  correct: boolean;
  points: number;
  correctLabel: string;
}

/** Evenly spread k positions across n indices — used to mix targeted
 *  challenges through a run of otherwise-consensus turns. */
function spacedSlots(n: number, k: number): number[] {
  if (k <= 0 || n <= 0) return [];
  const out = new Set<number>();
  for (let i = 1; i <= k; i++) out.add(Math.min(n - 1, Math.round((i * n) / (k + 1))));
  return [...out];
}

async function addPoints(
  supabase: SupabaseClient,
  gameId: string,
  teamId: string,
  points: number,
) {
  if (points === 0) return;
  const { data } = await supabase
    .from("game_scores")
    .select("id, points")
    .eq("game_id", gameId)
    .eq("team_id", teamId)
    .single();
  if (data) {
    await supabase
      .from("game_scores")
      .update({ points: data.points + points })
      .eq("id", data.id);
  }
}

/**
 * Build the turn queue and create a game row. Rounds are gone: each team plays
 * `questionsPerTeam` turns (a feud turn + a trivia question each), teams stay
 * equal, and a few turns are swapped for guess_who / guess_what challenges that
 * spotlight the people named least. Returns the new game id, or null if there
 * was nothing to play.
 */
async function createGameForGroup(
  supabase: SupabaseClient,
  groupId: string,
  questionsPerTeam: number,
): Promise<string | null> {
  const [{ data: teamData }, { data: memberData }, { data: assignmentData }, { data: questionData }] =
    await Promise.all([
      supabase.from("teams").select("*").eq("group_id", groupId).order("team_index"),
      supabase.from("members").select("*").eq("group_id", groupId).eq("is_playing", true).order("created_at"),
      supabase.from("feud_question_assignments").select("member_id, question_id").eq("group_id", groupId),
      supabase.from("feud_questions").select("id, type, target_member_id").eq("group_id", groupId),
    ]);
  const teams = (teamData ?? []) as Team[];
  const members = (memberData ?? []) as Member[];
  const nameById = new Map(members.map((m) => [m.id, m.display_name]));

  // Each member's held-out (consensus) questions — their live feud turns.
  const holdoutByMember = new Map<string, string[]>();
  for (const a of assignmentData ?? []) {
    const arr = holdoutByMember.get(a.member_id) ?? [];
    arr.push(a.question_id);
    holdoutByMember.set(a.member_id, arr);
  }

  // Targeted-challenge pool (guess_who / guess_what) from responses.
  const questions = (questionData ?? []) as { id: string; type: string; target_member_id: string | null }[];
  const targetedIds = questions.filter((q) => q.type === "guess_who" || q.type === "guess_what").map((q) => q.id);
  const responsesById = new Map<string, { memberId: string; answer: string }[]>();
  if (targetedIds.length) {
    const { data: resp } = await supabase
      .from("feud_responses")
      .select("question_id, member_id, raw_answer")
      .in("question_id", targetedIds);
    for (const r of resp ?? []) {
      const arr = responsesById.get(r.question_id) ?? [];
      arr.push({ memberId: r.member_id, answer: r.raw_answer });
      responsesById.set(r.question_id, arr);
    }
  }
  type Challenge =
    | { kind: "guess_who"; questionId: string; responders: { memberId: string; answer: string }[] }
    | { kind: "guess_what"; questionId: string; targetId: string };
  const challenges: Challenge[] = [];
  for (const q of questions) {
    const resp = responsesById.get(q.id) ?? [];
    if (q.type === "guess_who" && resp.length >= 1) {
      challenges.push({ kind: "guess_who", questionId: q.id, responders: resp });
    } else if (q.type === "guess_what" && q.target_member_id) {
      if (resp.some((r) => r.memberId === q.target_member_id))
        challenges.push({ kind: "guess_what", questionId: q.id, targetId: q.target_member_id });
    }
  }

  // How often each player was NAMED on pick-a-person questions — quiet people
  // (named least) get their "Whose answer?" cards surfaced first.
  const pickIds = questions.filter((q) => q.type === "pick_person").map((q) => q.id);
  const mentionByMember = new Map<string, number>();
  if (pickIds.length) {
    const nameToId = new Map(members.map((m) => [normalize(m.display_name), m.id]));
    const { data: picks } = await supabase.from("feud_responses").select("raw_answer").in("question_id", pickIds);
    for (const r of picks ?? []) {
      const id = nameToId.get(normalize(r.raw_answer));
      if (id) mentionByMember.set(id, (mentionByMember.get(id) ?? 0) + 1);
    }
  }
  const featured = new Map<string, number>();

  const base = (teamId: string, teamName: string, m: Member) => ({
    round: 1,
    teamId,
    teamName,
    memberId: m.id,
    memberName: m.display_name,
  });

  function buildTargeted(ch: Challenge, teamId: string, teamName: string, m: Member): GameTurn | null {
    if (ch.kind === "guess_who") {
      const authors = ch.responders.filter((r) => r.memberId !== m.id);
      if (!authors.length) return null;
      const a = [...authors].sort((x, y) => {
        const fx = featured.get(x.memberId) ?? 0;
        const fy = featured.get(y.memberId) ?? 0;
        if (fx !== fy) return fx - fy;
        const mx = mentionByMember.get(x.memberId) ?? 0;
        const my = mentionByMember.get(y.memberId) ?? 0;
        if (mx !== my) return mx - my;
        return Math.random() - 0.5;
      })[0];
      featured.set(a.memberId, (featured.get(a.memberId) ?? 0) + 1);
      return {
        ...base(teamId, teamName, m),
        kind: "guess_who",
        feudQuestionId: ch.questionId,
        answerMemberId: a.memberId,
        revealAnswer: a.answer,
      };
    }
    if (ch.targetId === m.id) return null;
    return {
      ...base(teamId, teamName, m),
      kind: "guess_what",
      feudQuestionId: ch.questionId,
      targetMemberId: ch.targetId,
      targetName: nameById.get(ch.targetId) ?? "someone",
    };
  }

  // Per-team turn lists: interleave each member's holdouts (so members alternate).
  const usedChallenges = new Set<number>();
  const pool = shuffle(challenges);
  const perTeam: GameTurn[][] = [];
  for (const t of teams) {
    const teamMembers = members.filter((m) => m.team_id === t.id);
    const queues = teamMembers.map((m) => ({ m, q: [...(holdoutByMember.get(m.id) ?? [])] }));
    const turns: GameTurn[] = [];
    let any = true;
    while (any) {
      any = false;
      for (const row of queues) {
        const qid = row.q.shift();
        if (qid) {
          turns.push({ ...base(t.id, t.name, row.m), kind: "feud", feudQuestionId: qid });
          any = true;
        }
      }
    }
    // Weave in targeted challenges by replacing spaced consensus slots.
    const want = Math.min(pool.length, Math.floor(turns.length / 3));
    const slots = spacedSlots(turns.length, want);
    for (const slot of slots) {
      const player = members.find((m) => m.id === turns[slot].memberId);
      if (!player) continue;
      for (let k = 0; k < pool.length; k++) {
        if (usedChallenges.has(k)) continue;
        const challengeTurn = buildTargeted(pool[k], t.id, t.name, player);
        if (challengeTurn) {
          usedChallenges.add(k);
          turns[slot] = challengeTurn;
          break;
        }
      }
    }
    perTeam.push(turns);
  }

  // Equalize: every team plays the same number of turns, clamped to the host's
  // choice (min 3, or the capacity if there are fewer).
  const capacity = Math.min(...perTeam.map((t) => t.length));
  if (!Number.isFinite(capacity) || capacity <= 0) return null;
  const k = Math.max(1, Math.min(questionsPerTeam || capacity, capacity));

  // Interleave teams: T0.t0, T1.t0, T0.t1, T1.t1, …
  const queue: GameTurn[] = [];
  for (let i = 0; i < k; i++) for (const t of perTeam) if (t[i]) queue.push(t[i]);
  if (queue.length === 0) return null;

  const settings = { feudSeconds: DEFAULT_SETTINGS.feudSeconds, triviaSeconds: DEFAULT_SETTINGS.triviaSeconds };
  const { data: gameRow, error } = await supabase
    .from("games")
    .insert({
      group_id: groupId,
      status: "active",
      num_teams: teams.length,
      num_rounds: 1,
      current_round: 1,
      current_team_id: queue[0].teamId,
      current_member_id: queue[0].memberId,
      current_phase: "feud",
      settings,
      state: { queue, cursor: 0, questionsPerTeam: k },
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !gameRow) return null;

  await supabase.from("game_scores").insert(teams.map((t) => ({ game_id: gameRow.id, team_id: t.id, points: 0 })));
  await supabase.from("groups").update({ status: "live" }).eq("id", groupId);
  return gameRow.id as string;
}

/** Create a game and jump to the play view. `questionsPerTeam` sets the length. */
export async function startGame(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const questionsPerTeam = Math.max(1, Math.min(60, Number(formData.get("questionsPerTeam") || 0)));
  if (!groupId) redirect("/dashboard");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await ensureAllHoldouts(supabase, groupId);
  const gameId = await createGameForGroup(supabase, groupId, questionsPerTeam);
  if (!gameId) redirect(`/dashboard/g/${groupId}`);
  redirect(`/play/${gameId}`);
}

/** Play again: rotate holdouts so different people play different questions and
 *  refresh the trivia bank, then spin up a new game of the same length. */
export async function startNextRound(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const questionsPerTeam = Math.max(1, Math.min(60, Number(formData.get("questionsPerTeam") || 0)));
  if (!groupId) redirect("/dashboard");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await reassignHoldoutsNewRound(supabase, groupId);
  await regenerateTriviaBank(supabase, groupId);
  const gameId = await createGameForGroup(supabase, groupId, questionsPerTeam);
  if (!gameId) redirect(`/dashboard/g/${groupId}`);
  redirect(`/play/${gameId}`);
}

/** Tally the group's answers, fuzzy-match the guess, score it (capped by how
 *  many choices the question offered), and persist. */
export async function scoreFeud(input: {
  gameId: string;
  questionId: string;
  teamId: string;
  guess: string;
  memberId?: string;
  memberName?: string;
  round?: number;
}): Promise<FeudResult> {
  const supabase = await createSupabaseServerClient();
  const [{ data: responses }, { data: q }] = await Promise.all([
    supabase.from("feud_responses").select("normalized_bucket, raw_answer").eq("question_id", input.questionId),
    supabase.from("feud_questions").select("type, options").eq("id", input.questionId).maybeSingle(),
  ]);

  const answers = (responses ?? []).map((r) => r.normalized_bucket || r.raw_answer);
  const buckets = tallyBuckets(answers);
  const matched = fuzzyMatch(input.guess, buckets.map((b) => b.label));
  // Option-based questions (multiple_choice / likelihood) cap paying ranks by
  // how many options they offered; open pick-a-person / open-text keep the full
  // 3-place feud scale.
  const optCount = Array.isArray(q?.options) ? (q!.options as string[]).length : 0;
  const places = optCount > 0 ? placesForChoices(optCount) : SURVEY_PLACE_POINTS.length;
  const points = scoreFeudGuess(buckets, matched, places);

  await addPoints(supabase, input.gameId, input.teamId, points);
  await supabase.from("game_events").insert({
    game_id: input.gameId,
    type: "feud_result",
    payload: {
      questionId: input.questionId,
      guess: input.guess,
      matched,
      points,
      places,
      kind: "feud",
      correct: points > 0,
      teamId: input.teamId,
      memberId: input.memberId ?? null,
      memberName: input.memberName ?? null,
      round: input.round ?? null,
    },
  });

  return { buckets, matched, points, places };
}

/** Match the captain's answer against accepted variants, score (TRIVIA_POINTS),
 *  and persist. */
export async function scoreTrivia(input: {
  gameId: string;
  questionId: string;
  teamId: string;
  answer: string;
  memberId?: string;
  memberName?: string;
  round?: number;
  topic?: string;
}): Promise<TriviaResult> {
  const supabase = await createSupabaseServerClient();
  const { data: q } = await supabase.from("trivia_questions").select("*").eq("id", input.questionId).single();
  if (!q) return { correct: false, points: 0, correctAnswer: "" };

  const candidates = [q.correct_answer, ...((q.accepted_variants as string[]) ?? [])];
  const matched = fuzzyMatch(input.answer, candidates);
  const correct = matched !== null;
  const points = correct ? TRIVIA_POINTS : 0;

  await supabase.from("trivia_questions").update({ used: true }).eq("id", q.id);
  await addPoints(supabase, input.gameId, input.teamId, points);
  await supabase.from("game_events").insert({
    game_id: input.gameId,
    type: "trivia_result",
    payload: {
      questionId: q.id,
      answer: input.answer,
      correct,
      points,
      topic: input.topic ?? q.topic,
      teamId: input.teamId,
      memberId: input.memberId ?? null,
      memberName: input.memberName ?? null,
      round: input.round ?? null,
    },
  });

  return { correct, points, correctAnswer: q.correct_answer };
}

/** guess_who: did the team name whoever gave the shown answer? All-or-nothing. */
export async function scoreGuessWho(input: {
  gameId: string;
  questionId: string;
  answerMemberId: string;
  teamId: string;
  guess: string;
  memberId?: string;
  memberName?: string;
  round?: number;
}): Promise<GuessResult> {
  const supabase = await createSupabaseServerClient();
  const { data: author } = await supabase
    .from("members")
    .select("display_name")
    .eq("id", input.answerMemberId)
    .single();
  const name = author?.display_name ?? "";
  const correct = name ? fuzzyMatch(input.guess, [name]) !== null : false;
  const points = correct ? WIN_POINTS : 0;

  await addPoints(supabase, input.gameId, input.teamId, points);
  await supabase.from("game_events").insert({
    game_id: input.gameId,
    type: "guess_who_result",
    payload: {
      questionId: input.questionId,
      guess: input.guess,
      correct,
      points,
      kind: "guess_who",
      correctLabel: name,
      authorMemberId: input.answerMemberId,
      teamId: input.teamId,
      memberId: input.memberId ?? null,
      memberName: input.memberName ?? null,
      round: input.round ?? null,
    },
  });
  return { correct, points, correctLabel: name };
}

/** guess_what: did the team guess what the target said? All-or-nothing. */
export async function scoreGuessWhat(input: {
  gameId: string;
  questionId: string;
  targetMemberId: string;
  teamId: string;
  guess: string;
  memberId?: string;
  memberName?: string;
  round?: number;
}): Promise<GuessResult> {
  const supabase = await createSupabaseServerClient();
  const { data: resp } = await supabase
    .from("feud_responses")
    .select("raw_answer")
    .eq("question_id", input.questionId)
    .eq("member_id", input.targetMemberId)
    .maybeSingle();
  const answer = resp?.raw_answer ?? "";
  const correct = answer ? fuzzyMatch(input.guess, [answer]) !== null : false;
  const points = correct ? WIN_POINTS : 0;

  await addPoints(supabase, input.gameId, input.teamId, points);
  await supabase.from("game_events").insert({
    game_id: input.gameId,
    type: "guess_what_result",
    payload: {
      questionId: input.questionId,
      guess: input.guess,
      correct,
      points,
      kind: "guess_what",
      correctLabel: answer,
      targetMemberId: input.targetMemberId,
      teamId: input.teamId,
      memberId: input.memberId ?? null,
      memberName: input.memberName ?? null,
      round: input.round ?? null,
    },
  });
  return { correct, points, correctLabel: answer };
}

/**
 * Flag a trivia question as too obvious during the game. Logs it so future
 * generation avoids it, and marks it used so the swap-to-next picks another.
 */
export async function flagTriviaTooObvious(input: {
  groupId: string;
  gameId: string;
  questionId: string;
  reason?: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: q } = await supabase
    .from("trivia_questions")
    .select("prompt, correct_answer")
    .eq("id", input.questionId)
    .maybeSingle();
  if (!q) return;

  await supabase.from("trivia_feedback").insert({
    group_id: input.groupId,
    question_id: input.questionId,
    prompt: q.prompt,
    normalized_prompt: normalize(q.prompt),
    correct_answer: q.correct_answer,
    reason: input.reason || "too_obvious",
  });
  await supabase.from("trivia_questions").update({ used: true }).eq("id", input.questionId);
  await supabase.from("game_events").insert({
    game_id: input.gameId,
    type: "trivia_flagged",
    payload: { questionId: input.questionId, reason: input.reason || "too_obvious" },
  });
}

/** Persist the turn cursor (so an admin refresh resumes at the right turn). */
export async function persistTurn(input: { gameId: string; cursor: number; finished?: boolean }) {
  const supabase = await createSupabaseServerClient();
  if (input.finished) {
    const { data: g } = await supabase
      .from("games")
      .update({ status: "done" })
      .eq("id", input.gameId)
      .select("group_id")
      .single();
    if (g) await supabase.from("groups").update({ status: "done" }).eq("id", g.group_id);
    return;
  }
  const { data: game } = await supabase.from("games").select("state").eq("id", input.gameId).single();
  const st = (game?.state as { queue?: GameTurn[]; questionsPerTeam?: number }) ?? {};
  const queue = (st.queue ?? []) as GameTurn[];
  const turn = queue[input.cursor];
  await supabase
    .from("games")
    .update({
      state: { queue, cursor: input.cursor, questionsPerTeam: st.questionsPerTeam ?? null },
      current_round: turn?.round ?? 1,
      current_team_id: turn?.teamId ?? null,
      current_member_id: turn?.memberId ?? null,
    })
    .eq("id", input.gameId);
}

export async function setGameStatus(input: { gameId: string; status: "active" | "paused" }) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("games").update({ status: input.status }).eq("id", input.gameId);
}

export async function setGameTimers(input: { gameId: string; feudSeconds: number; triviaSeconds: number }) {
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("games")
    .update({ settings: { feudSeconds: input.feudSeconds, triviaSeconds: input.triviaSeconds } })
    .eq("id", input.gameId);
}

/** Adjust a team's running score by a delta — host overrides on reveal screens. */
export async function adjustScore(input: { gameId: string; teamId: string; delta: number }) {
  if (!input.delta) return;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("game_scores")
    .select("id, points")
    .eq("game_id", input.gameId)
    .eq("team_id", input.teamId)
    .single();
  if (data) {
    await supabase
      .from("game_scores")
      .update({ points: Math.max(0, data.points + input.delta) })
      .eq("id", data.id);
  }
}
