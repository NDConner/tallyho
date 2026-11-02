"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateJoinCode } from "@/lib/utils";
import { tallyBuckets, consensusScore } from "@/lib/feud";
import { TRIVIA_POINTS } from "@/lib/scoring";
import { DEMO_GROUP, DEMO_TEAMS, DEMO_FEUD, DEMO_TRIVIA_BY_TEAM } from "@/lib/demo/data";

/**
 * Build a complete, ready-to-play demo group from deterministic fixtures.
 * Requires no Anthropic key. Creates the group, teams, members + captains, all
 * feud questions with crafted responses and holdout assignments, and a balanced
 * trivia bank — then drops you on the group portal, ready to host.
 */
export async function seedDemoGroup() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const allNames = DEMO_TEAMS.flatMap((t) => t.members);

  // 1) Group
  let groupId: string | null = null;
  for (let i = 0; i < 6 && !groupId; i++) {
    const join_code = generateJoinCode(6);
    const { data, error } = await supabase
      .from("groups")
      .insert({
        created_by: user.id,
        name: DEMO_GROUP.name,
        category: DEMO_GROUP.category,
        dynamic_note: DEMO_GROUP.dynamicNote,
        num_teams: DEMO_TEAMS.length,
        num_rounds: 1,
        team_assignment: "admin",
        join_code,
        status: "ready",
      })
      .select("id")
      .single();
    if (!error && data) {
      groupId = data.id;
      break;
    }
    if (error && error.code !== "23505") throw new Error(error.message);
  }
  if (!groupId) throw new Error("Could not create the demo group. Try again.");

  // 2) Teams
  const { data: teamRows, error: teamErr } = await supabase
    .from("teams")
    .insert(DEMO_TEAMS.map((t) => ({ group_id: groupId, name: t.name, team_index: t.index })))
    .select("id, team_index");
  if (teamErr || !teamRows) throw new Error(teamErr?.message ?? "Failed to create teams.");
  const teamIdByIndex = new Map<number, string>(teamRows.map((t) => [t.team_index, t.id]));

  // 3) Members (+ captain flag)
  const { data: memberRows, error: memErr } = await supabase
    .from("members")
    .insert(
      DEMO_TEAMS.flatMap((t) =>
        t.members.map((name) => ({
          group_id: groupId,
          display_name: name,
          team_id: teamIdByIndex.get(t.index)!,
          is_captain: name === t.captain,
        })),
      ),
    )
    .select("id, display_name");
  if (memErr || !memberRows) throw new Error(memErr?.message ?? "Failed to add members.");
  const memberIdByName = new Map<string, string>(memberRows.map((m) => [m.display_name, m.id]));

  // captain pointers on teams
  for (const t of DEMO_TEAMS) {
    await supabase
      .from("teams")
      .update({ captain_member_id: memberIdByName.get(t.captain)! })
      .eq("id", teamIdByIndex.get(t.index)!);
  }

  // 4) Feud questions + responses + holdout assignments
  for (const q of DEMO_FEUD) {
    const expanded: string[] = [];
    for (const [ans, count] of q.dist) for (let k = 0; k < count; k++) expanded.push(ans);
    const buckets = tallyBuckets(expanded);
    const score = consensusScore(buckets);

    const { data: qRow, error: qErr } = await supabase
      .from("feud_questions")
      .insert({
        group_id: groupId,
        prompt: q.prompt,
        type: q.type,
        options: q.options ?? null,
        source: "recommended",
        ai_recommended: false,
        is_buffer: q.holdout === null,
        usable: score >= 0.3333,
        consensus_score: score,
        top_bucket: buckets[0]?.label ?? null,
      })
      .select("id")
      .single();
    if (qErr || !qRow) throw new Error(qErr?.message ?? "Failed to create a feud question.");

    const answerers = allNames.filter((n) => n !== q.holdout); // 8 for holdout, 9 for buffer
    await supabase.from("feud_responses").insert(
      answerers.map((name, idx) => ({
        question_id: qRow.id,
        member_id: memberIdByName.get(name)!,
        raw_answer: expanded[idx] ?? expanded[expanded.length - 1],
        normalized_bucket: expanded[idx] ?? null,
      })),
    );

    if (q.holdout) {
      await supabase.from("feud_question_assignments").insert({
        group_id: groupId,
        question_id: qRow.id,
        member_id: memberIdByName.get(q.holdout)!,
      });
    }
  }

  // 5) Trivia topics + balanced, point-valued bank
  for (const t of DEMO_TRIVIA_BY_TEAM) {
    const teamId = teamIdByIndex.get(t.team)!;
    await supabase.from("trivia_topics").insert(
      t.questions.map((q) => ({
        group_id: groupId,
        team_id: teamId,
        category: q.category,
        name: q.topic,
        selected: true,
        source: "recommended",
      })),
    );
    await supabase.from("trivia_questions").insert(
      t.questions.map((q) => ({
        group_id: groupId,
        team_id: teamId,
        topic: q.topic,
        prompt: q.prompt,
        correct_answer: q.answer,
        accepted_variants: q.variants,
        point_value: TRIVIA_POINTS,
        round_no: 1,
      })),
    );
  }

  redirect(`/dashboard/g/${groupId}?created=1&demo=1`);
}
