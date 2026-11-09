import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeFeudSubject } from "@/lib/feud/subjects";

export interface GroupAnalytics {
  id: string;
  name: string;
  category: string;
  status: string;
  createdAt: string;
  theme: string; // "Your crew" or the themed label (athletes, Disney, …)
  people: number; // playing members
  teams: number;
  gamesPlayed: number; // finished games
  lastRecapGameId: string | null;
  lastGame: { winner: string | null; tie: boolean; scores: { team: string; points: number }[] } | null;
}

export interface HostAnalytics {
  totals: {
    groups: number;
    gamesPlayed: number; // finished
    gamesStarted: number; // any status
    peopleSlots: number; // sum of playing members across groups
    accounts: number; // distinct signed-in players
  };
  byCategory: { label: string; count: number }[];
  byTheme: { label: string; count: number }[];
  groups: GroupAnalytics[];
}

const EMPTY: HostAnalytics = {
  totals: { groups: 0, gamesPlayed: 0, gamesStarted: 0, peopleSlots: 0, accounts: 0 },
  byCategory: [],
  byTheme: [],
  groups: [],
};

/**
 * Aggregate everything a host has run — groups, people, games and their
 * outputs — for the analytics dashboard. Uses the caller's RLS-scoped client, so
 * it only ever sees the host's own data.
 */
export async function getHostAnalytics(
  supabase: SupabaseClient,
  hostUserId: string,
): Promise<HostAnalytics> {
  const { data: groupRows } = await supabase
    .from("groups")
    .select("*")
    .eq("created_by", hostUserId)
    .order("created_at", { ascending: false });
  const groups = (groupRows ?? []) as Record<string, unknown>[];
  const groupIds = groups.map((g) => g.id as string);
  if (!groupIds.length) return EMPTY;

  const [{ data: memberRows }, { data: teamRows }, { data: gameRows }] = await Promise.all([
    supabase.from("members").select("group_id, is_playing, user_id").in("group_id", groupIds),
    supabase.from("teams").select("id, group_id, name").in("group_id", groupIds),
    supabase
      .from("games")
      .select("id, group_id, status, created_at")
      .in("group_id", groupIds)
      .order("created_at", { ascending: false }),
  ]);
  const members = memberRows ?? [];
  const teams = teamRows ?? [];
  const games = gameRows ?? [];

  // Scores for finished games only (for each group's latest result).
  const doneGameIds = games.filter((g) => g.status === "done").map((g) => g.id as string);
  const { data: scoreRows } = doneGameIds.length
    ? await supabase.from("game_scores").select("game_id, team_id, points").in("game_id", doneGameIds)
    : { data: [] as { game_id: string; team_id: string; points: number }[] };
  const scores = scoreRows ?? [];

  const teamName = new Map(teams.map((t) => [t.id as string, t.name as string]));
  const scoresByGame = new Map<string, { team: string; points: number }[]>();
  for (const s of scores) {
    const arr = scoresByGame.get(s.game_id as string) ?? [];
    arr.push({ team: teamName.get(s.team_id as string) ?? "Team", points: (s.points as number) ?? 0 });
    scoresByGame.set(s.game_id as string, arr);
  }

  // Per-group rollups.
  const playingByGroup = new Map<string, number>();
  const teamCountByGroup = new Map<string, number>();
  const accounts = new Set<string>();
  let peopleSlots = 0;
  for (const m of members) {
    if (m.is_playing !== false) {
      playingByGroup.set(m.group_id as string, (playingByGroup.get(m.group_id as string) ?? 0) + 1);
      peopleSlots++;
    }
    if (m.user_id) accounts.add(m.user_id as string);
  }
  for (const t of teams)
    teamCountByGroup.set(t.group_id as string, (teamCountByGroup.get(t.group_id as string) ?? 0) + 1);

  const doneCountByGroup = new Map<string, number>();
  const latestDoneByGroup = new Map<string, string>(); // games are newest-first
  for (const g of games) {
    if (g.status === "done") {
      doneCountByGroup.set(g.group_id as string, (doneCountByGroup.get(g.group_id as string) ?? 0) + 1);
      if (!latestDoneByGroup.has(g.group_id as string))
        latestDoneByGroup.set(g.group_id as string, g.id as string);
    }
  }

  const catCount = new Map<string, number>();
  const themeCount = new Map<string, number>();

  const groupsOut: GroupAnalytics[] = groups.map((g) => {
    const id = g.id as string;
    const subject = normalizeFeudSubject((g as { feud_subject?: unknown }).feud_subject);
    const theme = subject.mode === "theme" ? (subject.theme ?? "Theme") : "Your crew";
    const category = (g.category as string) ?? "general";
    catCount.set(category, (catCount.get(category) ?? 0) + 1);
    themeCount.set(theme, (themeCount.get(theme) ?? 0) + 1);

    const lastGameId = latestDoneByGroup.get(id) ?? null;
    let lastGame: GroupAnalytics["lastGame"] = null;
    if (lastGameId) {
      const gs = [...(scoresByGame.get(lastGameId) ?? [])].sort((a, b) => b.points - a.points);
      if (gs.length) {
        const tie = gs.length > 1 && gs[0].points === gs[1].points;
        lastGame = { winner: tie ? null : gs[0].team, tie, scores: gs };
      }
    }

    return {
      id,
      name: g.name as string,
      category,
      status: g.status as string,
      createdAt: g.created_at as string,
      theme,
      people: playingByGroup.get(id) ?? 0,
      teams: teamCountByGroup.get(id) ?? 0,
      gamesPlayed: doneCountByGroup.get(id) ?? 0,
      lastRecapGameId: lastGameId,
      lastGame,
    };
  });

  return {
    totals: {
      groups: groups.length,
      gamesPlayed: doneGameIds.length,
      gamesStarted: games.length,
      peopleSlots,
      accounts: accounts.size,
    },
    byCategory: [...catCount.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    byTheme: [...themeCount.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    groups: groupsOut,
  };
}
