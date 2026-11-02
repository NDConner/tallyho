import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureMemberHoldout } from "@/lib/holdouts";

// Member/captain self-service helpers. These run in API route handlers behind
// the service-role key, gated by the group's join code (members don't auth).

export async function lookupGroup(code: string) {
  const supabase = createSupabaseAdminClient();
  const { data: group } = await supabase
    .from("groups")
    .select("id, name, dynamic_note, join_code")
    .eq("join_code", code.trim().toUpperCase())
    .maybeSingle();
  if (!group) return null;

  const [{ data: members }, { data: teams }] = await Promise.all([
    supabase
      .from("members")
      .select("id, display_name, is_captain, team_id, is_playing")
      .eq("group_id", group.id)
      .order("created_at"),
    supabase.from("teams").select("id, name, team_index").eq("group_id", group.id).order("team_index"),
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

  const holdout = await ensureMemberHoldout(supabase, ctx.group.id, memberId);
  const [{ data: questions }, { data: responses }] = await Promise.all([
    supabase
      .from("feud_questions")
      .select("id, prompt, type, options, target_member_id")
      .eq("group_id", ctx.group.id)
      .order("created_at"),
    supabase.from("feud_responses").select("question_id, raw_answer").eq("member_id", memberId),
  ]);

  const answerByQ = new Map<string, string>();
  for (const r of responses ?? []) answerByQ.set(r.question_id, r.raw_answer);

  // What THIS member fills out:
  //  • consensus types — every one except their fresh holdout
  //  • guess_who       — everyone answers (a personal answer for others to guess)
  //  • guess_what      — only the hand-picked target answers
  const allForMember = (questions ?? [])
    .filter((q) => {
      if (q.type === "guess_who") return true;
      if (q.type === "guess_what") return q.target_member_id === memberId;
      return q.id !== holdout; // consensus types
    })
    .map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      options: q.options,
      answer: answerByQ.get(q.id) ?? null,
    }));
  const answeredCount = allForMember.filter((q) => q.answer !== null).length;

  let captain: { teamId: string; teamName: string; selected: string[] } | null = null;
  if (ctx.member.is_captain && ctx.member.team_id) {
    const { data: sel } = await supabase
      .from("trivia_topics")
      .select("name")
      .eq("team_id", ctx.member.team_id)
      .eq("selected", true);
    const team = ctx.teams.find((t) => t.id === ctx.member.team_id);
    captain = {
      teamId: ctx.member.team_id,
      teamName: team?.name ?? "your team",
      selected: (sel ?? []).map((s) => s.name),
    };
  }

  return {
    groupName: ctx.group.name,
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
    holdoutAssigned: Boolean(holdout),
    captain,
  };
}
