import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Only consensus-type questions ("guess the group's top answer") are held out.
// guess_who is answered by everyone; guess_what only by its target — neither is
// ever a holdout.
const CONSENSUS_TYPES = ["pick_person", "likelihood", "multiple_choice", "open_text"];

// The fresh-question guarantee: every consensus question is held out for exactly
// ONE player (the one who'll play it live, having NOT answered it). Questions are
// distributed as evenly as possible across players and balanced across teams, so
// with 40 questions and 20 players each player holds ~2 and answers the other 38,
// and every authored question gets played. These helpers take a Supabase client
// so the admin (authed) and member (service-role) paths share the exact logic.

interface PlayerRow {
  id: string;
  team_id: string | null;
}

/** Deterministic, team-balanced plan: question i → players[i % P], where players
 *  are ordered by team then join order. Returns member→questionIds. */
function buildPlan(players: PlayerRow[], questionIds: string[]): Map<string, string[]> {
  const plan = new Map<string, string[]>();
  for (const p of players) plan.set(p.id, []);
  if (players.length === 0) return plan;
  questionIds.forEach((qid, i) => {
    const p = players[i % players.length];
    plan.get(p.id)!.push(qid);
  });
  return plan;
}

/** Order players by (team order, join order) so round-robin balances teams. */
async function orderedPlayers(supabase: SupabaseClient, groupId: string): Promise<PlayerRow[]> {
  const [{ data: members }, { data: teams }] = await Promise.all([
    supabase
      .from("members")
      .select("id, team_id, created_at")
      .eq("group_id", groupId)
      .eq("is_playing", true)
      .order("created_at"),
    supabase.from("teams").select("id, team_index").eq("group_id", groupId),
  ]);
  const order = new Map<string, number>((teams ?? []).map((t) => [t.id, t.team_index]));
  return [...(members ?? [])].sort((a, b) => {
    const ta = a.team_id ? (order.get(a.team_id) ?? 99) : 99;
    const tb = b.team_id ? (order.get(b.team_id) ?? 99) : 99;
    if (ta !== tb) return ta - tb;
    return String(a.created_at).localeCompare(String(b.created_at));
  });
}

async function consensusQuestionIds(supabase: SupabaseClient, groupId: string): Promise<string[]> {
  const { data } = await supabase
    .from("feud_questions")
    .select("id, type, is_buffer")
    .eq("group_id", groupId)
    .order("created_at");
  // Buffer questions are explicitly held out of play (a host can hide any
  // question by flagging it is_buffer), so they never become a live holdout.
  return (data ?? [])
    .filter((q) => CONSENSUS_TYPES.includes(q.type) && !q.is_buffer)
    .map((q) => q.id);
}

/** True when the current assignments already equal the given plan exactly. */
function planMatches(
  plan: Map<string, string[]>,
  existing: { member_id: string; question_id: string }[],
): boolean {
  const want = new Set<string>();
  for (const [mid, qids] of plan) for (const q of qids) want.add(`${mid}:${q}`);
  if (existing.length !== want.size) return false;
  for (const a of existing) if (!want.has(`${a.member_id}:${a.question_id}`)) return false;
  return true;
}

/**
 * Apply a balanced holdout plan for the whole group (idempotent): if the current
 * assignments already match, it does nothing; otherwise it rebuilds them and
 * un-answers any response a member gave to a question they now hold out (so it
 * stays fresh for live play). Safe to call repeatedly (fill-out + pre-game).
 */
export async function ensureAllHoldouts(supabase: SupabaseClient, groupId: string): Promise<void> {
  const [players, qIds, { data: existing }] = await Promise.all([
    orderedPlayers(supabase, groupId),
    consensusQuestionIds(supabase, groupId),
    supabase
      .from("feud_question_assignments")
      .select("member_id, question_id")
      .eq("group_id", groupId),
  ]);
  if (players.length === 0 || qIds.length === 0) return;

  const plan = buildPlan(players, qIds);
  if (planMatches(plan, existing ?? [])) return;

  // Rebuild from scratch (simplest correct path).
  await supabase.from("feud_question_assignments").delete().eq("group_id", groupId);
  const rows: { group_id: string; question_id: string; member_id: string }[] = [];
  for (const [memberId, questionIds] of plan) {
    for (const questionId of questionIds) rows.push({ group_id: groupId, question_id: questionId, member_id: memberId });
  }
  if (rows.length) await supabase.from("feud_question_assignments").insert(rows);

  // Un-answer each member's held questions so there's a real tally to guess.
  for (const [memberId, questionIds] of plan) {
    if (questionIds.length) {
      await supabase
        .from("feud_responses")
        .delete()
        .eq("member_id", memberId)
        .in("question_id", questionIds);
    }
  }
}

/** The set of question ids a single member is held out of (so the fill-out flow
 *  can exclude them). Ensures the whole-group plan exists first. */
export async function memberHoldouts(
  supabase: SupabaseClient,
  groupId: string,
  memberId: string,
): Promise<Set<string>> {
  await ensureAllHoldouts(supabase, groupId);
  const { data } = await supabase
    .from("feud_question_assignments")
    .select("question_id")
    .eq("group_id", groupId)
    .eq("member_id", memberId);
  return new Set((data ?? []).map((a) => a.question_id));
}

/**
 * For "play again": rotate the plan by one player so different people hold (and
 * therefore play) different questions, then un-answer accordingly. Best-effort.
 */
export async function reassignHoldoutsNewRound(
  supabase: SupabaseClient,
  groupId: string,
): Promise<void> {
  const [players, qIds] = await Promise.all([
    orderedPlayers(supabase, groupId),
    consensusQuestionIds(supabase, groupId),
  ]);
  if (players.length === 0 || qIds.length === 0) return;

  // Shift the round-robin by one so holdouts differ from last game.
  const rotated = [...players.slice(1), players[0]];
  const plan = buildPlan(rotated, qIds);

  await supabase.from("feud_question_assignments").delete().eq("group_id", groupId);
  const rows: { group_id: string; question_id: string; member_id: string }[] = [];
  for (const [memberId, questionIds] of plan)
    for (const questionId of questionIds) rows.push({ group_id: groupId, question_id: questionId, member_id: memberId });
  if (rows.length) await supabase.from("feud_question_assignments").insert(rows);
  for (const [memberId, questionIds] of plan)
    if (questionIds.length)
      await supabase.from("feud_responses").delete().eq("member_id", memberId).in("question_id", questionIds);
}
