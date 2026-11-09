"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAllHoldouts } from "@/lib/holdouts";
import { regenerateTriviaBank } from "@/lib/trivia/regenerate";
import { STARTER_POOL, CATEGORY_OF_TOPIC } from "@/lib/trivia/topics";
import { TRIVIA_POINTS } from "@/lib/scoring";
import { normalize } from "@/lib/match";
import { shuffle, partition } from "@/lib/utils";

/**
 * Add a member to an existing group at any time (including after others have
 * started filling out). If no team is chosen, the new member joins the
 * smallest team to keep things balanced.
 */
export async function addMember(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const name = String(formData.get("name") || "").trim();
  let teamId = String(formData.get("teamId") || "") || null;
  if (!groupId || !name) return;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (!teamId) {
    const { data: members } = await supabase
      .from("members")
      .select("team_id")
      .eq("group_id", groupId)
      .eq("is_playing", true);
    const { data: teams } = await supabase
      .from("teams")
      .select("id")
      .eq("group_id", groupId)
      .order("team_index");
    if (teams && teams.length > 0) {
      const counts = new Map<string, number>(teams.map((t) => [t.id, 0]));
      (members ?? []).forEach((m) => {
        if (m.team_id && counts.has(m.team_id)) counts.set(m.team_id, counts.get(m.team_id)! + 1);
      });
      teamId = [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];
    }
  }

  await supabase.from("members").insert({
    group_id: groupId,
    display_name: name,
    team_id: teamId,
    is_captain: false,
  });

  revalidatePath(`/dashboard/g/${groupId}`);
}

/** Move a player to a different team. They drop captaincy on the move (the old
 *  team's captain slot is cleared if it was them); reassign with setCaptain. */
export async function moveMember(input: { groupId: string; memberId: string; teamId: string }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: m } = await supabase
    .from("members")
    .select("team_id")
    .eq("id", input.memberId)
    .single();

  await supabase
    .from("members")
    .update({ team_id: input.teamId, is_captain: false })
    .eq("id", input.memberId);

  if (m?.team_id) {
    await supabase
      .from("teams")
      .update({ captain_member_id: null })
      .eq("id", m.team_id)
      .eq("captain_member_id", input.memberId);
  }

  revalidatePath(`/dashboard/g/${input.groupId}`);
}

/** Make a player the captain of their team (replaces the team's current captain). */
export async function setCaptain(input: { groupId: string; memberId: string }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: m } = await supabase
    .from("members")
    .select("team_id")
    .eq("id", input.memberId)
    .single();
  if (!m?.team_id) return;

  await supabase.from("members").update({ is_captain: false }).eq("team_id", m.team_id);
  await supabase.from("members").update({ is_captain: true }).eq("id", input.memberId);
  await supabase.from("teams").update({ captain_member_id: input.memberId }).eq("id", m.team_id);

  revalidatePath(`/dashboard/g/${input.groupId}`);
}

/** Rename a group. */
export async function renameGroup(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!groupId || !name) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("groups").update({ name }).eq("id", groupId);
  revalidatePath(`/dashboard/g/${groupId}`);
  revalidatePath("/dashboard");
}

/** Permanently delete a group and everything under it (cascades). */
export async function deleteGroup(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  if (!groupId) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("groups").delete().eq("id", groupId);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/** Randomly redraw team rosters across the existing teams and pick fresh
 *  captains. Handy for re-balancing any time before the game. */
export async function reshuffleTeams(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  if (!groupId) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const [{ data: teams }, { data: members }] = await Promise.all([
    supabase.from("teams").select("id").eq("group_id", groupId).order("team_index"),
    supabase.from("members").select("id").eq("group_id", groupId).eq("is_playing", true),
  ]);
  if (!teams || teams.length === 0 || !members || members.length === 0) return;

  // Clear captains, then randomly partition members across the teams.
  await supabase.from("teams").update({ captain_member_id: null }).eq("group_id", groupId);
  const buckets = partition(shuffle(members), teams.length);
  for (let i = 0; i < buckets.length; i++) {
    const teamId = teams[i].id;
    const ids = buckets[i].map((m) => m.id);
    if (ids.length === 0) continue;
    await supabase.from("members").update({ team_id: teamId, is_captain: false }).in("id", ids);
    // New captain for this team.
    const captainId = ids[Math.floor(Math.random() * ids.length)];
    await supabase.from("members").update({ is_captain: true }).eq("id", captainId);
    await supabase.from("teams").update({ captain_member_id: captainId }).eq("id", teamId);
  }
  revalidatePath(`/dashboard/g/${groupId}`);
}

/** (Re)generate the trivia bank (balanced + calibrated; AI-tailored with a key,
 *  else the starter pool). Also ensures every member has a fresh holdout. */
export async function generateTriviaBank(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  if (!groupId) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await ensureAllHoldouts(supabase, groupId);
  await regenerateTriviaBank(supabase, groupId);
  revalidatePath(`/dashboard/g/${groupId}`);
}

/**
 * Lock or reopen member answers. Locking moves the group out of "setup" (to
 * "ready"), which the member/captain write routes reject — so nobody can submit
 * or change answers, topics, team names, or logos. Reopening returns to "setup".
 * Doesn't touch a game already in progress ("live"/"done" stay as they are).
 */
export async function setAnswerLock(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const lock = String(formData.get("lock") || "") === "1";
  if (!groupId) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: g } = await supabase.from("groups").select("status").eq("id", groupId).single();
  if (!g) return;
  if (lock) {
    // Only lock from the open "setup" state; never stomp a live/done game.
    if (g.status === "setup") await supabase.from("groups").update({ status: "ready" }).eq("id", groupId);
  } else {
    // Reopen only from a locked-but-not-yet-played state.
    if (g.status === "ready") await supabase.from("groups").update({ status: "setup" }).eq("id", groupId);
  }
  revalidatePath(`/dashboard/g/${groupId}`);
}

/**
 * Add an "answer-only" name: someone in the friend group who should be pickable
 * on pick-a-person questions but won't be at game night. They get no team, no
 * join, no fill-out, and never take a turn.
 */
export async function addGuest(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!groupId || !name) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("members").insert({
    group_id: groupId,
    display_name: name,
    is_playing: false,
    is_captain: false,
    team_id: null,
  });
  revalidatePath(`/dashboard/g/${groupId}`);
}

/** Remove a member — a player or an answer-only guest. Cascades their answers. */
export async function removeMember(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const memberId = String(formData.get("memberId") || "");
  if (!groupId || !memberId) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("members").delete().eq("id", memberId);
  revalidatePath(`/dashboard/g/${groupId}`);
}

/** Rename a team (host side; captains can also rename their own team in /join). */
export async function renameTeam(input: { groupId: string; teamId: string; name: string }) {
  const name = input.name.trim();
  if (!input.groupId || !input.teamId || !name) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("teams").update({ name }).eq("id", input.teamId).eq("group_id", input.groupId);
  revalidatePath(`/dashboard/g/${input.groupId}`);
}

// ─── Scheduling ──────────────────────────────────────────────────────────────

/** Set the game date and the deadline for everyone to finish their questions.
 *  Values are datetime-local strings (or empty to clear). */
export async function setSchedule(input: { groupId: string; gameDate: string; answerDeadline: string }) {
  if (!input.groupId) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const toIso = (v: string) => {
    const t = (v ?? "").trim();
    if (!t) return null;
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };
  await supabase
    .from("groups")
    .update({ scheduled_time: toIso(input.gameDate), answer_deadline: toIso(input.answerDeadline) })
    .eq("id", input.groupId);
  revalidatePath(`/dashboard/g/${input.groupId}`);
}

// ─── Member accounts ─────────────────────────────────────────────────────────

/** Require members to sign in + claim their name before answering (per group). */
export async function setRequireMemberLogin(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const value = String(formData.get("value") || "") === "1";
  if (!groupId) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("groups").update({ require_member_login: value }).eq("id", groupId);
  revalidatePath(`/dashboard/g/${groupId}`);
}

/** Free a claimed roster slot (someone grabbed the wrong name) so the right
 *  account can claim it. */
export async function unclaimMember(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const memberId = String(formData.get("memberId") || "");
  if (!groupId || !memberId) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("members")
    .update({ user_id: null, claimed_at: null })
    .eq("id", memberId)
    .eq("group_id", groupId);
  revalidatePath(`/dashboard/g/${groupId}`);
}

// ─── Trivia categories + topics + bank editing ───────────────────────────────

/** Set which categories captains pick trivia topics within (built-in + custom,
 *  e.g. "company trivia"). Empty array resets to the built-in five. */
export async function setTriviaCategories(input: {
  groupId: string;
  categories: { name: string; custom: boolean }[];
}) {
  if (!input.groupId) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const clean = (input.categories ?? [])
    .map((c) => ({ name: String(c.name ?? "").trim().slice(0, 40), custom: Boolean(c.custom) }))
    .filter((c) => c.name);
  await supabase
    .from("groups")
    .update({ trivia_categories: clean.length ? clean : null })
    .eq("id", input.groupId);
  revalidatePath(`/dashboard/g/${input.groupId}/trivia`);
  revalidatePath(`/dashboard/g/${input.groupId}`);
}

/** Replace a team's selected trivia topics (host side). Each topic carries its
 *  category (so custom categories work too). */
export async function setTeamTopics(input: {
  groupId: string;
  teamId: string;
  topics: { name: string; category: string }[];
}) {
  if (!input.groupId || !input.teamId) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const rows = (input.topics ?? [])
    .map((t) => ({ name: String(t.name ?? "").trim().slice(0, 60), category: String(t.category ?? "").trim() }))
    .filter((t) => t.name && t.category);
  await supabase.from("trivia_topics").delete().eq("team_id", input.teamId);
  if (rows.length) {
    await supabase.from("trivia_topics").insert(
      rows.map((t) => ({
        group_id: input.groupId,
        team_id: input.teamId,
        category: t.category,
        name: t.name,
        selected: true,
        source: "custom",
      })),
    );
  }
  revalidatePath(`/dashboard/g/${input.groupId}/trivia`);
  revalidatePath(`/dashboard/g/${input.groupId}`);
}

function cleanVariants(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 8);
}

export async function addTrivia(input: {
  groupId: string;
  teamId: string;
  topic: string;
  prompt: string;
  correctAnswer: string;
  variants: string[];
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const prompt = input.prompt.trim();
  const correct = input.correctAnswer.trim();
  if (!input.groupId || !input.teamId || !prompt || !correct) return;
  await supabase.from("trivia_questions").insert({
    group_id: input.groupId,
    team_id: input.teamId,
    topic: input.topic.trim() || "General",
    prompt,
    correct_answer: correct,
    accepted_variants: cleanVariants(input.variants),
    point_value: TRIVIA_POINTS,
    round_no: 1,
  });
  revalidatePath(`/dashboard/g/${input.groupId}/trivia`);
  revalidatePath(`/dashboard/g/${input.groupId}`);
}

export async function updateTrivia(input: {
  groupId: string;
  questionId: string;
  topic: string;
  prompt: string;
  correctAnswer: string;
  variants: string[];
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const prompt = input.prompt.trim();
  const correct = input.correctAnswer.trim();
  if (!prompt || !correct) return;
  await supabase
    .from("trivia_questions")
    .update({
      topic: input.topic.trim() || "General",
      prompt,
      correct_answer: correct,
      accepted_variants: cleanVariants(input.variants),
    })
    .eq("id", input.questionId);
  revalidatePath(`/dashboard/g/${input.groupId}/trivia`);
  revalidatePath(`/dashboard/g/${input.groupId}`);
}

export async function deleteTrivia(input: { groupId: string; questionId: string }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("trivia_questions").delete().eq("id", input.questionId);
  revalidatePath(`/dashboard/g/${input.groupId}/trivia`);
  revalidatePath(`/dashboard/g/${input.groupId}`);
}

/** Add N more curated questions to a team, matched to its topics/categories and
 *  de-duped against what it already has (and flagged-too-obvious prompts). */
export async function addMoreTrivia(input: { groupId: string; teamId: string; n: number }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const n = Math.max(1, Math.min(20, input.n || 5));

  const [{ data: topics }, { data: existing }, { data: flagged }] = await Promise.all([
    supabase.from("trivia_topics").select("name").eq("team_id", input.teamId).eq("selected", true),
    supabase.from("trivia_questions").select("prompt").eq("group_id", input.groupId),
    supabase.from("trivia_feedback").select("normalized_prompt").eq("group_id", input.groupId),
  ]);
  const selectedTopics = new Set((topics ?? []).map((t) => t.name));
  const selectedCats = new Set([...selectedTopics].map((t) => CATEGORY_OF_TOPIC[t]).filter(Boolean));
  const used = new Set((existing ?? []).map((e) => normalize(e.prompt)));
  for (const f of flagged ?? []) used.add(f.normalized_prompt);

  const byTopic = shuffle(STARTER_POOL.filter((q) => selectedTopics.has(q.topic)));
  const byCat = shuffle(STARTER_POOL.filter((q) => !selectedTopics.has(q.topic) && selectedCats.has(q.category)));
  const picks: typeof STARTER_POOL = [];
  for (const q of [...byTopic, ...byCat]) {
    if (picks.length >= n) break;
    const key = normalize(q.prompt);
    if (used.has(key)) continue;
    used.add(key);
    picks.push(q);
  }
  if (picks.length) {
    await supabase.from("trivia_questions").insert(
      picks.map((q) => ({
        group_id: input.groupId,
        team_id: input.teamId,
        topic: q.topic,
        prompt: q.prompt,
        correct_answer: q.answer,
        accepted_variants: q.variants,
        point_value: TRIVIA_POINTS,
        round_no: 1,
      })),
    );
  }
  revalidatePath(`/dashboard/g/${input.groupId}/trivia`);
  revalidatePath(`/dashboard/g/${input.groupId}`);
}
