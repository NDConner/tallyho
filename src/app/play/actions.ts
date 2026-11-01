"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tallyBuckets, scoreFeudGuess } from "@/lib/feud";
import { fuzzyMatch } from "@/lib/match";
import { ensureAllHoldouts, reassignHoldoutsNewRound } from "@/lib/holdouts";
import { regenerateTriviaBank } from "@/lib/trivia/regenerate";
import { shuffle } from "@/lib/utils";
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
 *  challenges through a round of otherwise-consensus turns. */
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

/** Build the interleaved turn queue and create a game row. Returns the new game
 *  id, or null if there was nothing to play. */
async function createGameForGroup(
  supabase: SupabaseClient,
  groupId: string,
  numRounds: number,
): Promise<string | null> {
  const [
    { data: teamData },
    { data: memberData },
    { data: assignmentData },
    { data: questionData },
  ] = await Promise.all([
    supabase.from("teams").select("*").eq("group_id", groupId).order("team_index"),
    supabase.from("members").select("*").eq("group_id", groupId).order("created_at"),
    supabase.from("feud_question_assignments").select("*").eq("group_id", groupId),
    supabase
      .from("feud_questions")
      .select("id, type, target_member_id")
      .eq("group_id", groupId),
  ]);
  const teams = (teamData ?? []) as Team[];
  const members = (memberData ?? []) as Member[];
  const holdoutByMember = new Map<string, string>(
    (assignmentData ?? []).map((a) => [a.member_id, a.question_id]),
  );
  const nameById = new Map(members.map((m) => [m.id, m.display_name]));

  // Build the targeted-challenge pool (guess_who / guess_what) from responses.
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
      const hasAnswer = resp.some((r) => r.memberId === q.target_member_id);
      if (hasAnswer) challenges.push({ kind: "guess_what", questionId: q.id, targetId: q.target_member_id });
    }
  }

  // Interleave teams' members: T0.m0, T1.m0, T0.m1, T1.m1, …
  const membersByTeam = new Map<string, Member[]>();
  for (const t of teams) membersByTeam.set(t.id, members.filter((m) => m.team_id === t.id));
  const maxLen = Math.max(0, ...[...membersByTeam.values()].map((a) => a.length));
  const players: { teamId: string; teamName: string; member: Member }[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const t of teams) {
      const m = membersByTeam.get(t.id)?.[i];
      if (m) players.push({ teamId: t.id, teamName: t.name, member: m });
    }
  }

  const base = (p: (typeof players)[number], round: number) => ({
    round,
    teamId: p.teamId,
    teamName: p.teamName,
    memberId: p.member.id,
    memberName: p.member.display_name,
  });

  // A targeted challenge the player is eligible to guess (never their own answer).
  function buildTargeted(ch: Challenge, p: (typeof players)[number], round: number): GameTurn | null {
    if (ch.kind === "guess_who") {
      const authors = ch.responders.filter((r) => r.memberId !== p.member.id);
      if (!authors.length) return null;
      const a = authors[Math.floor(Math.random() * authors.length)];
      return {
        ...base(p, round),
        kind: "guess_who",
        feudQuestionId: ch.questionId,
        answerMemberId: a.memberId,
        revealAnswer: a.answer,
      };
    }
    if (ch.targetId === p.member.id) return null;
    return {
      ...base(p, round),
      kind: "guess_what",
      feudQuestionId: ch.questionId,
      targetMemberId: ch.targetId,
      targetName: nameById.get(ch.targetId) ?? "someone",
    };
  }

  const queue: GameTurn[] = [];
  for (let r = 1; r <= numRounds; r++) {
    const slots = spacedSlots(players.length, challenges.length);
    const pool = shuffle(challenges); // fresh order each round so authors vary
    const turnAt: (GameTurn | null)[] = new Array(players.length).fill(null);
    // Place each targeted challenge at the earliest eligible, unfilled slot.
    for (const ch of pool) {
      for (const idx of slots) {
        if (turnAt[idx]) continue;
        const turn = buildTargeted(ch, players[idx], r);
        if (turn) {
          turnAt[idx] = turn;
          break;
        }
      }
    }
    // Everyone else plays their fresh consensus holdout.
    players.forEach((p, idx) => {
      if (turnAt[idx]) return;
      const qid = holdoutByMember.get(p.member.id);
      if (qid) turnAt[idx] = { ...base(p, r), kind: "feud", feudQuestionId: qid };
    });
    for (const t of turnAt) if (t) queue.push(t);
  }
  if (queue.length === 0) return null;

  const settings = {
    feudSeconds: DEFAULT_SETTINGS.feudSeconds,
    triviaSeconds: DEFAULT_SETTINGS.triviaSeconds,
  };
  const { data: gameRow, error } = await supabase
    .from("games")
    .insert({
      group_id: groupId,
      status: "active",
      num_teams: teams.length,
      num_rounds: numRounds,
      current_round: 1,
      current_team_id: queue[0].teamId,
      current_member_id: queue[0].memberId,
      current_phase: "feud",
      settings,
      state: { queue, cursor: 0 },
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !gameRow) return null;

  await supabase
    .from("game_scores")
    .insert(teams.map((t) => ({ game_id: gameRow.id, team_id: t.id, points: 0 })));
  await supabase.from("groups").update({ status: "live" }).eq("id", groupId);
  return gameRow.id as string;
}

/** Create a game, build the interleaved turn queue, and jump to the play view. */
export async function startGame(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const numRounds = Math.max(1, Math.min(5, Number(formData.get("rounds") || 1)));
  if (!groupId) redirect("/dashboard");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Guarantee every member has a fresh holdout before building the turn queue.
  await ensureAllHoldouts(supabase, groupId);
  const gameId = await createGameForGroup(supabase, groupId, numRounds);
  if (!gameId) redirect(`/dashboard/g/${groupId}`);
  redirect(`/play/${gameId}`);
}

/** Start another round: give everyone a DIFFERENT feud question and a fresh
 *  trivia bank, then spin up a new game. */
export async function startNextRound(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  if (!groupId) redirect("/dashboard");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await reassignHoldoutsNewRound(supabase, groupId);
  await regenerateTriviaBank(supabase, groupId);
  const gameId = await createGameForGroup(supabase, groupId, 1);
  if (!gameId) redirect(`/dashboard/g/${groupId}`);
  redirect(`/play/${gameId}`);
}

/** Tally the group's answers, fuzzy-match the guess, score it, and persist. */
export async function scoreFeud(input: {
  gameId: string;
  questionId: string;
  teamId: string;
  guess: string;
}): Promise<FeudResult> {
  const supabase = await createSupabaseServerClient();
  const { data: responses } = await supabase
    .from("feud_responses")
    .select("normalized_bucket, raw_answer")
    .eq("question_id", input.questionId);

  const answers = (responses ?? []).map((r) => r.normalized_bucket || r.raw_answer);
  const buckets = tallyBuckets(answers);
  const matched = fuzzyMatch(input.guess, buckets.map((b) => b.label));
  const points = scoreFeudGuess(buckets, matched);

  await addPoints(supabase, input.gameId, input.teamId, points);
  await supabase.from("game_events").insert({
    game_id: input.gameId,
    type: "feud_result",
    payload: { questionId: input.questionId, guess: input.guess, matched, points },
  });

  return { buckets, matched, points };
}

/** Match the captain's answer against accepted variants, score, and persist. */
export async function scoreTrivia(input: {
  gameId: string;
  questionId: string;
  teamId: string;
  answer: string;
}): Promise<TriviaResult> {
  const supabase = await createSupabaseServerClient();
  const { data: q } = await supabase
    .from("trivia_questions")
    .select("*")
    .eq("id", input.questionId)
    .single();
  if (!q) return { correct: false, points: 0, correctAnswer: "" };

  const candidates = [q.correct_answer, ...((q.accepted_variants as string[]) ?? [])];
  const matched = fuzzyMatch(input.answer, candidates);
  const correct = matched !== null;
  const points = correct ? q.point_value : 0;

  await supabase.from("trivia_questions").update({ used: true }).eq("id", q.id);
  await addPoints(supabase, input.gameId, input.teamId, points);
  await supabase.from("game_events").insert({
    game_id: input.gameId,
    type: "trivia_result",
    payload: { questionId: q.id, answer: input.answer, correct, points },
  });

  return { correct, points, correctAnswer: q.correct_answer };
}

/** The group's all-or-nothing point value — its calibration constant (floor 2),
 *  so guess_who / guess_what are worth a solid feud answer. */
async function groupConstant(supabase: SupabaseClient, groupId: string): Promise<number> {
  const { data: g } = await supabase
    .from("groups")
    .select("calibration_constant")
    .eq("id", groupId)
    .single();
  const c = Number(g?.calibration_constant ?? 0);
  if (c >= 2) return Math.round(c);
  const { count } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  return Math.max(2, Math.round((count ?? 4) / 2));
}

/** guess_who: the team named a person; did it match whoever gave the shown
 *  answer? All-or-nothing. */
export async function scoreGuessWho(input: {
  gameId: string;
  questionId: string;
  answerMemberId: string;
  teamId: string;
  guess: string;
}): Promise<GuessResult> {
  const supabase = await createSupabaseServerClient();
  const { data: game } = await supabase.from("games").select("group_id").eq("id", input.gameId).single();
  const { data: author } = await supabase
    .from("members")
    .select("display_name")
    .eq("id", input.answerMemberId)
    .single();
  const name = author?.display_name ?? "";
  const correct = name ? fuzzyMatch(input.guess, [name]) !== null : false;
  const constant = await groupConstant(supabase, (game?.group_id as string) ?? "");
  const points = correct ? constant : 0;

  await addPoints(supabase, input.gameId, input.teamId, points);
  await supabase.from("game_events").insert({
    game_id: input.gameId,
    type: "guess_who_result",
    payload: { questionId: input.questionId, guess: input.guess, correct, points },
  });
  return { correct, points, correctLabel: name };
}

/** guess_what: the team guessed what the target said. All-or-nothing. */
export async function scoreGuessWhat(input: {
  gameId: string;
  questionId: string;
  targetMemberId: string;
  teamId: string;
  guess: string;
}): Promise<GuessResult> {
  const supabase = await createSupabaseServerClient();
  const { data: game } = await supabase.from("games").select("group_id").eq("id", input.gameId).single();
  const { data: resp } = await supabase
    .from("feud_responses")
    .select("raw_answer")
    .eq("question_id", input.questionId)
    .eq("member_id", input.targetMemberId)
    .maybeSingle();
  const answer = resp?.raw_answer ?? "";
  const correct = answer ? fuzzyMatch(input.guess, [answer]) !== null : false;
  const constant = await groupConstant(supabase, (game?.group_id as string) ?? "");
  const points = correct ? constant : 0;

  await addPoints(supabase, input.gameId, input.teamId, points);
  await supabase.from("game_events").insert({
    game_id: input.gameId,
    type: "guess_what_result",
    payload: { questionId: input.questionId, guess: input.guess, correct, points },
  });
  return { correct, points, correctLabel: answer };
}

/** Persist the turn cursor (so an admin refresh resumes at the right turn). */
export async function persistTurn(input: {
  gameId: string;
  cursor: number;
  finished?: boolean;
}) {
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
  const { data: game } = await supabase
    .from("games")
    .select("state")
    .eq("id", input.gameId)
    .single();
  const queue = ((game?.state as { queue?: GameTurn[] })?.queue ?? []) as GameTurn[];
  const turn = queue[input.cursor];
  await supabase
    .from("games")
    .update({
      state: { queue, cursor: input.cursor },
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

export async function setGameTimers(input: {
  gameId: string;
  feudSeconds: number;
  triviaSeconds: number;
}) {
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("games")
    .update({ settings: { feudSeconds: input.feudSeconds, triviaSeconds: input.triviaSeconds } })
    .eq("id", input.gameId);
}

/** Adjust a team's running score by a delta — used for host overrides on the
 *  reveal screens (fixing a fuzzy-match dispute, marking trivia right/wrong). */
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
