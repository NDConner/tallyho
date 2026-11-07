import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { memberHoldouts } from "@/lib/holdouts";
import { TOPIC_CATALOG } from "@/lib/trivia/topics";

// Member/captain self-service helpers. These run in API route handlers behind
// the service-role key, gated by the group's join code (members don't auth).

const CONSENSUS_TYPES = ["pick_person", "likelihood", "multiple_choice", "open_text"];

export interface ActiveCategory {
  name: string;
  custom: boolean;
  topics: string[];
}

/** The categories captains pick trivia topics within: the host's custom set if
 *  they defined one, otherwise the built-in catalog. */
export function activeCategories(trivia_categories: unknown): ActiveCategory[] {
  const catalogTopics = new Map(TOPIC_CATALOG.map((c) => [c.category, c.topics]));
  if (Array.isArray(trivia_categories) && trivia_categories.length) {
    return (trivia_categories as { name?: string; custom?: boolean }[])
      .filter((c) => c && typeof c.name === "string" && c.name.trim())
      .map((c) => ({
        name: c.name as string,
        custom: Boolean(c.custom),
        topics: catalogTopics.get(c.name as string) ?? [],
      }));
  }
  return TOPIC_CATALOG.map((c) => ({ name: c.category, custom: false, topics: c.topics }));
}

export async function lookupGroup(code: string) {
  const supabase = createSupabaseAdminClient();
  const { data: group } = await supabase
    .from("groups")
    .select("id, name, status, dynamic_note, join_code, scheduled_time, answer_deadline, trivia_categories")
    .eq("join_code", code.trim().toUpperCase())
    .maybeSingle();
  if (!group) return null;

  const [{ data: members }, { data: teams }] = await Promise.all([
    supabase
      .from("members")
      .select("id, display_name, is_captain, team_id, is_playing")
      .eq("group_id", group.id)
      .order("created_at"),
    supabase
      .from("teams")
      .select("id, name, team_index, logo_url, emoji")
      .eq("group_id", group.id)
      .order("team_index"),
  ]);
  return { group, members: members ?? [], teams: teams ?? [] };
}

export async function validateMember(code: string, memberId: string) {
  const ctx = await lookupGroup(code);
  if (!ctx) return null;
  const member = ctx.members.find((m) => m.id === memberId);
  if (!member || member.is_playing === false) return null; // answer-only guests can't be "me"
  return { ...ctx, member };
}

export async function getMemberTasks(code: string, memberId: string) {
  const ctx = await validateMember(code, memberId);
  if (!ctx) return null;
  const supabase = createSupabaseAdminClient();

  const holdoutSet = await memberHoldouts(supabase, ctx.group.id, memberId);
  const [{ data: questions }, { data: responses }] = await Promise.all([
    supabase
      .from("feud_questions")
      .select("id, prompt, type, options, target_member_id, is_buffer")
      .eq("group_id", ctx.group.id)
      .order("created_at"),
    supabase.from("feud_responses").select("question_id, raw_answer").eq("member_id", memberId),
  ]);

  const answerByQ = new Map<string, string>();
  for (const r of responses ?? []) answerByQ.set(r.question_id, r.raw_answer);

  // What THIS member fills out:
  //  • buffer questions — never (a host hid them from the game entirely)
  //  • consensus types  — every one except the ones they're held out of
  //  • guess_who        — everyone answers (a personal answer for others to guess)
  //  • guess_what       — only the hand-picked target answers
  const allForMember = (questions ?? [])
    .filter((q) => {
      if (q.is_buffer) return false;
      if (q.type === "guess_who") return true;
      if (q.type === "guess_what") return q.target_member_id === memberId;
      return !holdoutSet.has(q.id); // consensus types
    })
    .map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      options: q.options,
      answer: answerByQ.get(q.id) ?? null,
    }));
  const answeredCount = allForMember.filter((q) => q.answer !== null).length;

  // Captain block: team branding + topics + who-on-the-team-has-filled-out.
  let captain: {
    teamId: string;
    teamName: string;
    logoUrl: string | null;
    emoji: string | null;
    selected: { name: string; category: string }[];
    categories: ActiveCategory[];
    teammates: { id: string; name: string; isCaptain: boolean; status: "done" | "progress" | "notstarted" }[];
  } | null = null;

  if (ctx.member.is_captain && ctx.member.team_id) {
    const team = ctx.teams.find((t) => t.id === ctx.member.team_id);
    const [{ data: sel }, { data: allQ }] = await Promise.all([
      supabase
        .from("trivia_topics")
        .select("name, category")
        .eq("team_id", ctx.member.team_id)
        .eq("selected", true),
      supabase
        .from("feud_questions")
        .select("id, type, target_member_id")
        .eq("group_id", ctx.group.id),
    ]);

    // Fill-out status for this captain's teammates.
    const teamMembers = ctx.members.filter(
      (m) => m.team_id === ctx.member.team_id && m.is_playing !== false,
    );
    const qs = allQ ?? [];
    const consensusCount = qs.filter((q) => CONSENSUS_TYPES.includes(q.type)).length;
    const guessWhoCount = qs.filter((q) => q.type === "guess_who").length;
    const guessWhatBy = new Map<string, number>();
    for (const q of qs)
      if (q.type === "guess_what" && q.target_member_id)
        guessWhatBy.set(q.target_member_id, (guessWhatBy.get(q.target_member_id) ?? 0) + 1);

    const memberIds = teamMembers.map((m) => m.id);
    const [{ data: resp }, { data: asg }] = await Promise.all([
      memberIds.length
        ? supabase.from("feud_responses").select("member_id").in("member_id", memberIds)
        : Promise.resolve({ data: [] as { member_id: string }[] }),
      supabase.from("feud_question_assignments").select("member_id").eq("group_id", ctx.group.id),
    ]);
    const answeredByMember = new Map<string, number>();
    for (const r of resp ?? []) answeredByMember.set(r.member_id, (answeredByMember.get(r.member_id) ?? 0) + 1);
    const holdoutsByMember = new Map<string, number>();
    for (const a of asg ?? []) holdoutsByMember.set(a.member_id, (holdoutsByMember.get(a.member_id) ?? 0) + 1);

    const teammates = teamMembers.map((m) => {
      const answered = answeredByMember.get(m.id) ?? 0;
      const target = Math.max(
        0,
        consensusCount - (holdoutsByMember.get(m.id) ?? 0) + guessWhoCount + (guessWhatBy.get(m.id) ?? 0),
      );
      const status: "done" | "progress" | "notstarted" =
        target > 0 && answered >= target ? "done" : answered > 0 ? "progress" : "notstarted";
      return { id: m.id, name: m.display_name, isCaptain: m.is_captain, status };
    });

    captain = {
      teamId: ctx.member.team_id,
      teamName: team?.name ?? "your team",
      logoUrl: (team as { logo_url?: string | null })?.logo_url ?? null,
      emoji: (team as { emoji?: string | null })?.emoji ?? null,
      selected: (sel ?? []).map((s) => ({ name: s.name, category: s.category })),
      categories: activeCategories(ctx.group.trivia_categories),
      teammates,
    };
  }

  return {
    groupName: ctx.group.name,
    // Answers are open only while the group is in "setup". Once the host locks
    // (any other status), members can review but not submit or change anything.
    locked: ctx.group.status !== "setup",
    gameDate: ctx.group.scheduled_time ?? null,
    answerDeadline: ctx.group.answer_deadline ?? null,
    member: {
      id: ctx.member.id,
      name: ctx.member.display_name,
      isCaptain: ctx.member.is_captain,
      teamId: ctx.member.team_id,
    },
    roster: ctx.members.map((m) => ({ id: m.id, name: m.display_name })),
    questions: allForMember,
    answeredCount,
    total: allForMember.length,
    holdoutAssigned: holdoutSet.size > 0,
    captain,
  };
}
