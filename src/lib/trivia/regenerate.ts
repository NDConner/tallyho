import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStarterBank } from "@/lib/trivia/generate";
import { WIN_POINTS } from "@/lib/scoring";
import { generateJSON, hasAI } from "@/lib/ai/anthropic";

interface TeamInput {
  id: string;
  name: string;
  selectedTopics: string[];
}

/** Topic-tailored trivia via AI. Returns null on failure so the caller falls
 *  back to the starter pool (and keeps both teams balanced). */
async function aiTriviaBank(teams: TeamInput[], countPerTeam: number, pointValue: number) {
  const out: {
    teamId: string;
    topic: string;
    prompt: string;
    correct_answer: string;
    accepted_variants: string[];
    point_value: number;
  }[] = [];
  for (const team of teams) {
    const topics = team.selectedTopics.length ? team.selectedTopics : ["General Knowledge"];
    const ai = await generateJSON<{
      questions: { topic: string; prompt: string; answer: string; variants?: string[] }[];
    }>({
      system:
        "You write trivia questions with one clear correct answer and a few accepted answer variants. Return JSON only.",
      prompt: `Write ${countPerTeam} trivia questions spread across these topics: ${topics.join(", ")}.
JSON: {"questions":[{"topic":string,"prompt":string,"answer":string,"variants":string[]}]}`,
      maxTokens: 1600,
    });
    const valid = (ai?.questions ?? []).filter((q) => q.prompt && q.answer).slice(0, countPerTeam);
    if (valid.length < countPerTeam) return null;
    for (const q of valid) {
      out.push({
        teamId: team.id,
        topic: q.topic || topics[0],
        prompt: q.prompt,
        correct_answer: q.answer,
        accepted_variants: q.variants ?? [],
        point_value: pointValue,
      });
    }
  }
  return out;
}

/**
 * (Re)generate the trivia bank: balanced + calibrated, AI-tailored if a key is
 * set, otherwise the starter pool biased to each team's chosen topics. Replaces
 * any existing bank. Shared by the "Generate" action and the next-round flow.
 */
export async function regenerateTriviaBank(
  supabase: SupabaseClient,
  groupId: string,
): Promise<void> {
  const [{ data: teams }, { data: members }, { data: selected }] = await Promise.all([
    supabase.from("teams").select("id, name").eq("group_id", groupId).order("team_index"),
    supabase.from("members").select("id, team_id").eq("group_id", groupId).eq("is_playing", true),
    supabase.from("trivia_topics").select("team_id, name").eq("group_id", groupId).eq("selected", true),
  ]);
  if (!teams || teams.length === 0) return;

  // Standard scoring: every trivia question is worth a 1st-place answer.
  const constant = WIN_POINTS;

  const sizeByTeam = new Map<string, number>();
  for (const m of members ?? []) {
    if (m.team_id) sizeByTeam.set(m.team_id, (sizeByTeam.get(m.team_id) ?? 0) + 1);
  }
  const countPerTeam = Math.max(5, 0, ...[...sizeByTeam.values()]);

  const topicsByTeam = new Map<string, string[]>();
  for (const t of selected ?? []) {
    const arr = topicsByTeam.get(t.team_id) ?? [];
    arr.push(t.name);
    topicsByTeam.set(t.team_id, arr);
  }
  const teamInputs: TeamInput[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    selectedTopics: topicsByTeam.get(t.id) ?? [],
  }));

  let rows = buildStarterBank({
    teams: teamInputs.map((t) => ({ id: t.id, selectedTopics: t.selectedTopics })),
    countPerTeam,
    pointValue: constant,
  });
  if (hasAI()) {
    const ai = await aiTriviaBank(teamInputs, countPerTeam, constant);
    if (ai && ai.length) rows = ai;
  }

  await supabase.from("trivia_questions").delete().eq("group_id", groupId);
  await supabase.from("trivia_questions").insert(
    rows.map((r) => ({
      group_id: groupId,
      team_id: r.teamId,
      topic: r.topic,
      prompt: r.prompt,
      correct_answer: r.correct_answer,
      accepted_variants: r.accepted_variants,
      point_value: r.point_value,
      round_no: 1,
    })),
  );
  await supabase.from("groups").update({ calibration_constant: constant }).eq("id", groupId);
}
