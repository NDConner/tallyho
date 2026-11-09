"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAllHoldouts } from "@/lib/holdouts";
import { regenerateTriviaBank } from "@/lib/trivia/regenerate";
import { STARTER_POOL, CATEGORY_OF_TOPIC } from "@/lib/trivia/topics";
import { TRIVIA_POINTS } from "@/lib/scoring";
import { normalize } from "@/lib/match";
import { shuffle, partition, generateJoinCode } from "@/lib/utils";
import { deadlinePassed } from "@/lib/lock";

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
  const { data: g } = await supabase
    .from("groups")
    .select("status, answer_deadline")
    .eq("id", groupId)
    .single();
  if (!g) return;
  if (lock) {
    // Manual lock from the open "setup" state; never stomp a live/done game.
    if (g.status === "setup") await supabase.from("groups").update({ status: "ready" }).eq("id", groupId);
  } else {
    // Reopen to "setup". If the answer deadline has already passed, clear it so it
    // doesn't instantly re-lock — "open it back up" should actually reopen. A still-
    // future deadline is kept (the host only un-did an early manual lock).
    if (g.status === "ready" || g.status === "setup") {
      const update: { status: string; answer_deadline?: null } = { status: "setup" };
      if (deadlinePassed(g.answer_deadline)) update.answer_deadline = null;
      await supabase.from("groups").update(update).eq("id", groupId);
    }
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

// ─── Close out / reopen a game night ─────────────────────────────────────────

/** Wrap up a group's game night: mark the group "closed" (done) and finish any
 *  lingering active/paused game so nothing still reads as "in progress". The
 *  group page then shows the closed, recap-focused view. */
export async function closeOutGame(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  if (!groupId) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("games")
    .update({ status: "done" })
    .eq("group_id", groupId)
    .in("status", ["active", "paused"]);
  await supabase.from("groups").update({ status: "done" }).eq("id", groupId);
  revalidatePath(`/dashboard/g/${groupId}`);
  revalidatePath("/dashboard");
}

/** Reopen a closed group back to setup — edit the roster/questions or run it
 *  again with the same crew. (To keep the finished game's results and start
 *  clean, use Duplicate instead.) */
export async function reopenGroup(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  if (!groupId) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("groups").update({ status: "setup" }).eq("id", groupId);
  revalidatePath(`/dashboard/g/${groupId}`);
  revalidatePath("/dashboard");
}

// ─── Customized duplication ──────────────────────────────────────────────────

export interface DuplicateOptions {
  groupId: string;
  name: string;
  includePlayers: boolean; // member names, teams, captains (fresh, unclaimed)
  includeQuestions: boolean; // feud questions
  includeResponses: boolean; // players' saved answers + holdouts (needs players + questions)
  includeTopics: boolean; // captains' trivia topic picks
  includeTriviaBank: boolean; // generated trivia question bank
}

/**
 * Clone a group into a brand-new one, copying exactly the parts the host picked —
 * so they can play again with the same setup, or use it as a baseline for a whole
 * new crew. Always fresh: new join code, "setup" status, no schedule, and every
 * roster slot unclaimed (new people sign in and claim). Redirects to the copy.
 */
export async function duplicateGroup(
  opts: DuplicateOptions,
): Promise<{ ok: false; error: string } | void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const srcId = opts.groupId;
  const { data: src } = await supabase.from("groups").select("*").eq("id", srcId).single();
  if (!src) return { ok: false, error: "Group not found." };

  // Dependency fixups: answers need both players and questions to remap onto.
  const includePlayers = opts.includePlayers;
  const includeQuestions = opts.includeQuestions;
  const includeResponses = opts.includeResponses && includePlayers && includeQuestions;
  const includeTopics = opts.includeTopics;
  const includeTriviaBank = opts.includeTriviaBank;

  const name = (opts.name?.trim() || `${src.name} (copy)`).slice(0, 80);

  // 1) The new group (fresh code + setup + no schedule).
  let newGroupId: string | null = null;
  for (let attempt = 0; attempt < 6 && !newGroupId; attempt++) {
    const join_code = generateJoinCode(6);
    const { data, error } = await supabase
      .from("groups")
      .insert({
        created_by: user.id,
        name,
        category: src.category,
        category_custom_desc: src.category_custom_desc ?? null,
        dynamic_note: src.dynamic_note ?? "",
        num_teams: src.num_teams ?? 2,
        num_rounds: src.num_rounds ?? 1,
        team_assignment: src.team_assignment ?? "random",
        trivia_categories: src.trivia_categories ?? null,
        require_member_login: src.require_member_login ?? true,
        join_code,
        status: "setup",
      })
      .select("id")
      .single();
    if (!error && data) {
      newGroupId = data.id as string;
      break;
    }
    if (error && error.code !== "23505") return { ok: false, error: error.message };
  }
  if (!newGroupId) return { ok: false, error: "Could not generate a unique join code." };

  // 2) Teams — always copied (the skeleton trivia + captaincy hang off). Mapped by
  //    the stable team_index so trivia can re-point even without players.
  const { data: srcTeams } = await supabase
    .from("teams")
    .select("*")
    .eq("group_id", srcId)
    .order("team_index");
  const teamOldToNew = new Map<string, string>();
  if (srcTeams && srcTeams.length) {
    const { data: newTeams } = await supabase
      .from("teams")
      .insert(
        srcTeams.map((t) => ({
          group_id: newGroupId,
          name: t.name,
          team_index: t.team_index,
          emoji: t.emoji ?? null,
          logo_url: includePlayers ? (t.logo_url ?? null) : null,
        })),
      )
      .select("id, team_index");
    const newByIndex = new Map<number, string>();
    for (const t of newTeams ?? []) newByIndex.set(t.team_index as number, t.id as string);
    for (const t of srcTeams) {
      const nid = newByIndex.get(t.team_index as number);
      if (nid) teamOldToNew.set(t.id as string, nid);
    }
  }

  // 3) Members (if players). Fresh, unclaimed slots. Bulk insert returns rows in
  //    input order, so we zip old→new ids by index to remap captains/answers.
  const memberOldToNew = new Map<string, string>();
  if (includePlayers) {
    const { data: srcMembers } = await supabase
      .from("members")
      .select("*")
      .eq("group_id", srcId)
      .order("created_at");
    const list = srcMembers ?? [];
    if (list.length) {
      const { data: newMembers } = await supabase
        .from("members")
        .insert(
          list.map((m) => ({
            group_id: newGroupId,
            display_name: m.display_name,
            team_id: m.team_id ? (teamOldToNew.get(m.team_id) ?? null) : null,
            is_captain: Boolean(m.is_captain),
            is_playing: m.is_playing !== false,
          })),
        )
        .select("id");
      const inserted = newMembers ?? [];
      list.forEach((m, i) => {
        if (inserted[i]) memberOldToNew.set(m.id as string, inserted[i].id as string);
      });
      // Re-point each team's captain to the copied member.
      for (const t of srcTeams ?? []) {
        const cap = (t as { captain_member_id?: string | null }).captain_member_id;
        const newTeam = teamOldToNew.get(t.id as string);
        const newCap = cap ? memberOldToNew.get(cap) : null;
        if (newTeam && newCap)
          await supabase.from("teams").update({ captain_member_id: newCap }).eq("id", newTeam);
      }
    }
  }

  // 4) Feud questions (if questions). guess_what targets are remapped when players
  //    came along, otherwise dropped (the host re-picks a target).
  const questionOldToNew = new Map<string, string>();
  if (includeQuestions) {
    const { data: srcQs } = await supabase
      .from("feud_questions")
      .select("*")
      .eq("group_id", srcId)
      .order("created_at");
    const list = srcQs ?? [];
    if (list.length) {
      const { data: newQs } = await supabase
        .from("feud_questions")
        .insert(
          list.map((q) => ({
            group_id: newGroupId,
            prompt: q.prompt,
            type: q.type,
            options: q.options ?? null,
            target_member_id:
              includePlayers && q.target_member_id
                ? (memberOldToNew.get(q.target_member_id) ?? null)
                : null,
            source: q.source ?? "admin",
            ai_recommended: Boolean(q.ai_recommended),
            is_buffer: Boolean(q.is_buffer),
            usable: q.usable ?? null,
            consensus_score: q.consensus_score ?? null,
            top_bucket: q.top_bucket ?? null,
          })),
        )
        .select("id");
      const inserted = newQs ?? [];
      list.forEach((q, i) => {
        if (inserted[i]) questionOldToNew.set(q.id as string, inserted[i].id as string);
      });
    }
  }

  // 5) Players' saved answers + holdout assignments (if responses).
  if (includeResponses && questionOldToNew.size) {
    const { data: srcResp } = await supabase
      .from("feud_responses")
      .select("question_id, member_id, raw_answer, normalized_bucket")
      .in("question_id", [...questionOldToNew.keys()]);
    const respRows: {
      question_id: string;
      member_id: string;
      raw_answer: string;
      normalized_bucket: string;
    }[] = [];
    for (const r of srcResp ?? []) {
      const q = questionOldToNew.get(r.question_id as string);
      const m = memberOldToNew.get(r.member_id as string);
      if (q && m)
        respRows.push({
          question_id: q,
          member_id: m,
          raw_answer: r.raw_answer as string,
          normalized_bucket: (r.normalized_bucket as string) ?? (r.raw_answer as string),
        });
    }
    if (respRows.length) await supabase.from("feud_responses").insert(respRows);

    const { data: srcAsg } = await supabase
      .from("feud_question_assignments")
      .select("question_id, member_id")
      .eq("group_id", srcId);
    const asgRows: { group_id: string; question_id: string; member_id: string }[] = [];
    for (const a of srcAsg ?? []) {
      const q = questionOldToNew.get(a.question_id as string);
      const m = memberOldToNew.get(a.member_id as string);
      if (q && m) asgRows.push({ group_id: newGroupId, question_id: q, member_id: m });
    }
    if (asgRows.length) await supabase.from("feud_question_assignments").insert(asgRows);
  }

  // 6) Trivia topics (captains' picks) — re-pointed by team.
  if (includeTopics && teamOldToNew.size) {
    const { data: srcTopics } = await supabase
      .from("trivia_topics")
      .select("team_id, category, name, selected, source")
      .eq("group_id", srcId);
    const rows: {
      group_id: string;
      team_id: string | null;
      category: string;
      name: string;
      selected: boolean;
      source: string;
    }[] = [];
    for (const t of srcTopics ?? []) {
      const team = t.team_id ? (teamOldToNew.get(t.team_id as string) ?? null) : null;
      rows.push({
        group_id: newGroupId,
        team_id: team,
        category: t.category as string,
        name: t.name as string,
        selected: (t.selected as boolean) ?? true,
        source: (t.source as string) ?? "custom",
      });
    }
    if (rows.length) await supabase.from("trivia_topics").insert(rows);
  }

  // 7) Trivia bank — re-pointed by team, every question reset to unused.
  if (includeTriviaBank && teamOldToNew.size) {
    const { data: srcTrivia } = await supabase
      .from("trivia_questions")
      .select("team_id, topic, prompt, correct_answer, accepted_variants, point_value, round_no")
      .eq("group_id", srcId);
    const rows: {
      group_id: string;
      team_id: string;
      topic: string;
      prompt: string;
      correct_answer: string;
      accepted_variants: string[];
      point_value: number;
      round_no: number | null;
      used: boolean;
    }[] = [];
    for (const t of srcTrivia ?? []) {
      const team = teamOldToNew.get(t.team_id as string);
      if (!team) continue;
      rows.push({
        group_id: newGroupId,
        team_id: team,
        topic: t.topic as string,
        prompt: t.prompt as string,
        correct_answer: t.correct_answer as string,
        accepted_variants: (t.accepted_variants as string[]) ?? [],
        point_value: (t.point_value as number) ?? TRIVIA_POINTS,
        round_no: (t.round_no as number | null) ?? 1,
        used: false,
      });
    }
    if (rows.length) await supabase.from("trivia_questions").insert(rows);
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/g/${newGroupId}?created=1`);
}
