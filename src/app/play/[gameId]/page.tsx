import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LiveGame, type LiveGamePayload } from "@/components/game/LiveGame";
import { SURVEY_PLACE_POINTS, WIN_POINTS, TRIVIA_POINTS } from "@/lib/scoring";
import type { GameTurn } from "@/app/play/actions";

export default async function PlayPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: game } = await supabase.from("games").select("*").eq("id", gameId).single();
  if (!game) redirect("/dashboard");
  const groupId = game.group_id as string;

  const { data: group } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single();

  const state = (game.state ?? {}) as { queue?: GameTurn[]; cursor?: number; questionsPerTeam?: number };
  const queue = state.queue ?? [];
  const cursor = state.cursor ?? 0;

  const [{ data: teams }, { data: scoreRows }, { data: feudQs }, { data: trivia }, { data: topicRows }] =
    await Promise.all([
      supabase.from("teams").select("id, name, team_index, logo_url, emoji").eq("group_id", groupId).order("team_index"),
      supabase.from("game_scores").select("team_id, points").eq("game_id", gameId),
      supabase.from("feud_questions").select("id, prompt, type, options").eq("group_id", groupId),
      supabase
        .from("trivia_questions")
        .select("id, team_id, topic, prompt, point_value, used")
        .eq("group_id", groupId),
      supabase.from("trivia_topics").select("name, category").eq("group_id", groupId),
    ]);
  const categoryOfTopic = new Map<string, string>();
  for (const t of topicRows ?? []) categoryOfTopic.set(t.name, t.category);

  const feudQuestions: Record<string, { prompt: string; type: string; options: string[] | null }> = {};
  for (const q of feudQs ?? []) {
    feudQuestions[q.id] = {
      prompt: q.prompt,
      type: q.type,
      options: (q.options as string[] | null) ?? null,
    };
  }

  const triviaByTeam: Record<
    string,
    { id: string; topic: string; category: string | null; prompt: string; point_value: number }[]
  > = {};
  for (const t of trivia ?? []) {
    (triviaByTeam[t.team_id] ??= []).push({
      id: t.id,
      topic: t.topic,
      category: categoryOfTopic.get(t.topic) ?? null,
      prompt: t.prompt,
      point_value: t.point_value,
    });
  }

  const topicsByTeam: Record<string, string[]> = {};
  for (const t of trivia ?? []) {
    (topicsByTeam[t.team_id] ??= []);
    if (!topicsByTeam[t.team_id].includes(t.topic)) topicsByTeam[t.team_id].push(t.topic);
  }

  // Trivia already asked earlier in this game (used = true). Seeding these means
  // a resumed game never re-asks a question the group has already seen.
  const usedTriviaIds = (trivia ?? [])
    .filter((t) => (t as { used?: boolean }).used)
    .map((t) => t.id);

  const initialScores: Record<string, number> = {};
  for (const t of teams ?? []) initialScores[t.id] = 0;
  for (const s of scoreRows ?? []) initialScores[s.team_id] = s.points;

  // Standard scoring: a correct all-or-nothing guess equals a 1st-place answer;
  // every correct trivia answer is worth TRIVIA_POINTS.
  const allOrNothingValue = WIN_POINTS;

  const payload: LiveGamePayload = {
    groupId,
    gameId,
    groupName: group?.name ?? "The group",
    allOrNothingValue,
    triviaPoints: TRIVIA_POINTS,
    questionsPerTeam: state.questionsPerTeam ?? Math.max(1, Math.round(queue.length / Math.max(1, (teams ?? []).length))),
    placePoints: [...SURVEY_PLACE_POINTS],
    settings:
      (game.settings as { feudSeconds: number; triviaSeconds: number }) ?? {
        feudSeconds: 25,
        triviaSeconds: 210,
      },
    teams: (teams ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      index: t.team_index,
      logoUrl: (t as { logo_url?: string | null }).logo_url ?? null,
      emoji: (t as { emoji?: string | null }).emoji ?? null,
    })),
    initialScores,
    queue,
    cursor,
    feudQuestions,
    triviaByTeam,
    topicsByTeam,
    usedTriviaIds,
  };

  return <LiveGame {...payload} />;
}
