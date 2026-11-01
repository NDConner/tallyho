import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Only consensus-type questions ("guess the group's top answer") are held out.
// guess_who is answered by everyone; guess_what only by its target — neither is
// ever a holdout.
const CONSENSUS_TYPES = ["pick_person", "likelihood", "multiple_choice", "open_text"];

// The fresh-question guarantee: every member is held out of exactly one distinct
// question — the one they'll play live — and they answer all the others. These
// helpers take a Supabase client so both the admin (authed) and member
// (service-role) paths can share the exact same logic.

/**
 * Ensure one member has a holdout. Guarantees the holdout is a question they
 * have NOT answered (removing a stray response if necessary, so it stays fresh
 * for live play). Returns the holdout question id, or null if there aren't
 * enough distinct questions to hold one out for them.
 */
export async function ensureMemberHoldout(
  supabase: SupabaseClient,
  groupId: string,
  memberId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("feud_question_assignments")
    .select("question_id")
    .eq("group_id", groupId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (existing) return existing.question_id;

  const [{ data: questions }, { data: held }, { data: answered }] = await Promise.all([
    supabase.from("feud_questions").select("id, type").eq("group_id", groupId).order("created_at"),
    supabase.from("feud_question_assignments").select("question_id").eq("group_id", groupId),
    supabase.from("feud_responses").select("question_id").eq("member_id", memberId),
  ]);

  const ids = (questions ?? [])
    .filter((q: { type: string }) => CONSENSUS_TYPES.includes(q.type))
    .map((q: { id: string }) => q.id);
  if (ids.length === 0) return null;
  const heldSet = new Set((held ?? []).map((h: { question_id: string }) => h.question_id));
  const answeredSet = new Set((answered ?? []).map((a: { question_id: string }) => a.question_id));

  // Prefer a question that's un-held AND unanswered by them; otherwise take any
  // un-held question and unanswer it below.
  const candidate =
    ids.find((id) => !heldSet.has(id) && !answeredSet.has(id)) ??
    ids.find((id) => !heldSet.has(id));
  if (!candidate) return null; // every question is already someone's holdout

  const { error } = await supabase
    .from("feud_question_assignments")
    .insert({ group_id: groupId, question_id: candidate, member_id: memberId });
  if (error) {
    // Lost a race on the unique constraint — return whatever stuck.
    const { data: again } = await supabase
      .from("feud_question_assignments")
      .select("question_id")
      .eq("group_id", groupId)
      .eq("member_id", memberId)
      .maybeSingle();
    return again?.question_id ?? null;
  }

  if (answeredSet.has(candidate)) {
    await supabase
      .from("feud_responses")
      .delete()
      .eq("member_id", memberId)
      .eq("question_id", candidate);
  }
  return candidate;
}

/** Assign holdouts to every member that lacks one (called pre-game). Processes
 *  members in order, re-reading assignments each time so holdouts stay distinct. */
export async function ensureAllHoldouts(supabase: SupabaseClient, groupId: string): Promise<void> {
  const { data: members } = await supabase
    .from("members")
    .select("id")
    .eq("group_id", groupId)
    .order("created_at");
  for (const m of members ?? []) {
    await ensureMemberHoldout(supabase, groupId, m.id);
  }
}

/**
 * For a new round: clear existing holdouts and assign each member a DIFFERENT
 * question than last round (unanswering it so it plays fresh). Best-effort if
 * there aren't enough questions to fully rotate.
 */
export async function reassignHoldoutsNewRound(
  supabase: SupabaseClient,
  groupId: string,
): Promise<void> {
  const { data: prev } = await supabase
    .from("feud_question_assignments")
    .select("member_id, question_id")
    .eq("group_id", groupId);
  const prevBy = new Map<string, string>((prev ?? []).map((a) => [a.member_id, a.question_id]));
  await supabase.from("feud_question_assignments").delete().eq("group_id", groupId);

  const [{ data: members }, { data: questions }] = await Promise.all([
    supabase.from("members").select("id").eq("group_id", groupId).order("created_at"),
    supabase.from("feud_questions").select("id, type").eq("group_id", groupId).order("created_at"),
  ]);
  const qIds = (questions ?? [])
    .filter((q: { type: string }) => CONSENSUS_TYPES.includes(q.type))
    .map((q: { id: string }) => q.id);
  const held = new Set<string>();

  for (const m of members ?? []) {
    const { data: answered } = await supabase
      .from("feud_responses")
      .select("question_id")
      .eq("member_id", m.id);
    const answeredSet = new Set((answered ?? []).map((a: { question_id: string }) => a.question_id));
    const prevH = prevBy.get(m.id);
    // Prefer a different-from-last question they answered (so unanswering it
    // makes it fresh); then any different un-held question; then anything.
    const candidate =
      qIds.find((q) => !held.has(q) && q !== prevH && answeredSet.has(q)) ??
      qIds.find((q) => !held.has(q) && q !== prevH) ??
      qIds.find((q) => !held.has(q));
    if (!candidate) continue;
    held.add(candidate);
    await supabase
      .from("feud_question_assignments")
      .insert({ group_id: groupId, question_id: candidate, member_id: m.id });
    if (answeredSet.has(candidate)) {
      await supabase
        .from("feud_responses")
        .delete()
        .eq("member_id", m.id)
        .eq("question_id", candidate);
    }
  }
}
