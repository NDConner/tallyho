import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LiveGame, type LiveGamePayload } from "@/components/game/LiveGame";
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
    .select("name, calibration_constant")
    .eq("id", groupId)
    .single();

  const state = (game.state ?? {}) as { queue?: GameTurn[]; cursor?: number };
  const queue = state.queue ?? [];
  const cursor = state.cursor ?? 0;

  const [{ data: teams }, { data: scoreRows }, { data: feudQs }, { data: trivia }] =
    await Promise.all([
      supabase.from("teams").select("id, name, team_index").eq("group_id", groupId).order("team_index"),
      supabase.from("game_scores").select("team_id, points").eq("game_id", gameId),
      supabase.from("feud_questions").select("id, prompt, type, options").eq("group_id", groupId),
      supabase
        .from("trivia_questions")
        .select("id, team_id, topic, prompt, point_value")
        .eq("group_id", groupId),
    ]);

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
    { id: string; topic: string; prompt: string; point_value: number }[]
  > = {};
  for (const t of trivia ?? []) {
    (triviaByTeam[t.team_id] ??= []).push({
      id: t.id,
      topic: t.topic,
      prompt: t.prompt,
      point_value: t.point_value,
    });
  }

  const topicsByTeam: Record<string, string[]> = {};
  for (const t of trivia ?? []) {
    (topicsByTeam[t.team_id] ??= []);
    if (!topicsByTeam[t.team_id].includes(t.topic)) topicsByTeam[t.team_id].push(t.topic);
  }

  const initialScores: Record<string, number> = {};
  for (const t of teams ?? []) initialScores[t.id] = 0;
  for (const s of scoreRows ?? []) initialScores[s.team_id] = s.points;

  // All-or-nothing value for guess_who / guess_what = the group's calibration
  // constant (same as a trivia question). Fall back to the trivia point value.
  const constant = Number(group?.calibration_constant ?? 0);
  const allOrNothingValue =
    constant >= 2 ? Math.round(constant) : (trivia ?? [])[0]?.point_value ?? 3;

  const payload: LiveGamePayload = {
    groupId,
    gameId,
    groupName: group?.name ?? "The group",
    allOrNothingValue,
    settings:
      (game.settings as { feudSeconds: number; triviaSeconds: number }) ?? {
        feudSeconds: 25,
        triviaSeconds: 210,
      },
    teams: (teams ?? []).map((t) => ({ id: t.id, name: t.name, index: t.team_index })),
    initialScores,
    queue,
    cursor,
    feudQuestions,
    triviaByTeam,
    topicsByTeam,
  };

  return <LiveGame {...payload} />;
}
