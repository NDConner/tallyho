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

  type TriviaPoolItem = {
    id: string;
    topic: string;
    category: string | null;
    prompt: string;
    correct_answer?: string;
    accepted_variants?: string[];
    point_value?: number;
  };
  const state = (game.state ?? {}) as {
    queue?: GameTurn[];
    cursor?: number;
    questionsPerTeam?: number;
    triviaOnly?: boolean;
    winTarget?: number;
    triviaPool?: TriviaPoolItem[];
  };
  const queue = state.queue ?? [];
  const cursor = state.cursor ?? 0;
  const triviaOnly = Boolean(state.triviaOnly);

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
  const topicsByTeam: Record<string, string[]> = {};
  let usedTriviaIds: string[] = [];

  if (triviaOnly) {
    // Trivia-only game: one shared random pool for every team (answers stay in
    // game state, server-side). The client's global "used" set keeps questions
    // from repeating across teams. Seed already-asked ones from this game's
    // events so a resumed trivia-only game also never repeats.
    const clientPool = (state.triviaPool ?? []).map((q) => ({
      id: q.id,
      topic: q.topic,
      category: q.category ?? null,
      prompt: q.prompt,
      point_value: q.point_value ?? TRIVIA_POINTS,
    }));
    for (const t of teams ?? []) {
      triviaByTeam[t.id] = clientPool;
      topicsByTeam[t.id] = [];
    }
    const { data: triviaEvents } = await supabase
      .from("game_events")
      .select("payload")
      .eq("game_id", gameId)
      .eq("type", "trivia_result");
    usedTriviaIds = [
      ...new Set(
        (triviaEvents ?? [])
          .map((e) => (e.payload as { questionId?: string } | null)?.questionId)
          .filter((x): x is string => Boolean(x)),
      ),
    ];
  } else {
    for (const t of trivia ?? []) {
      (triviaByTeam[t.team_id] ??= []).push({
        id: t.id,
        topic: t.topic,
        category: categoryOfTopic.get(t.topic) ?? null,
        prompt: t.prompt,
        point_value: t.point_value,
      });
    }
    for (const t of trivia ?? []) {
      (topicsByTeam[t.team_id] ??= []);
      if (!topicsByTeam[t.team_id].includes(t.topic)) topicsByTeam[t.team_id].push(t.topic);
    }
    // Trivia already asked earlier in this game (used = true). Seeding these means
    // a resumed game never re-asks a question the group has already seen.
    usedTriviaIds = (trivia ?? [])
      .filter((t) => (t as { used?: boolean }).used)
      .map((t) => t.id);
  }

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
    triviaOnly,
    winTarget: state.winTarget ?? null,
  };

  return <LiveGame {...payload} />;
}
