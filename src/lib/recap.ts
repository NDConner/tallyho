import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fuzzyMatch, normalize } from "@/lib/match";
import { tallyBuckets, consensusScore } from "@/lib/feud";
import { generateJSON, generateText, hasAI } from "@/lib/ai/anthropic";
import { recordResonance } from "@/lib/questionBank";

// ============================================================================
// End-of-game recap: the shareable stats + superlatives + per-person "profiles"
// shown after a game. Built once (lazily on first view) and cached into
// games.state.recap so the public recap link is instant on repeat views.
//
// Deterministic by default (works with no API key); AI adds witty personas and
// a group-vibe paragraph when a key is set (bounded to 2 calls). Attribution
// relies on enriched game_events (memberId/teamId/round) written at score time.
// ============================================================================

export const RECAP_VERSION = 1;
const CONSENSUS_TYPES = ["pick_person", "likelihood", "multiple_choice", "open_text"];

const GRADIENTS: [string, string][] = [
  ["#ff2e88", "#ffc53d"],
  ["#22d3ee", "#34d399"],
  ["#ffc53d", "#ff2e88"],
  ["#34d399", "#22d3ee"],
  ["#ff6fb0", "#22d3ee"],
  ["#22d3ee", "#ff2e88"],
  ["#ffc53d", "#34d399"],
  ["#ff2e88", "#22d3ee"],
];

export interface RecapAvatar {
  initials: string;
  from: string;
  to: string;
}
export interface RecapTeam {
  teamId: string;
  name: string;
  index: number;
  points: number;
}
export interface RecapSuperlative {
  key: string;
  emoji: string;
  title: string;
  memberName: string;
  avatar: RecapAvatar;
  detail: string;
}
export interface RecapPlayer {
  memberId: string;
  name: string;
  teamName: string | null;
  avatar: RecapAvatar;
  title: string;
  persona: string;
  votesReceived: number;
  correct: number;
  points: number;
  standoutAnswer: string | null;
}
export interface Recap {
  version: number;
  groupName: string;
  generatedAt: string;
  rounds: number;
  teams: RecapTeam[];
  winner: { name: string; tie: boolean; points: number } | null;
  totals: { questionsPlayed: number; rightAnswers: number; totalPoints: number };
  superlatives: RecapSuperlative[];
  players: RecapPlayer[];
  votesBoard: { name: string; votes: number; avatar: RecapAvatar }[];
  themes: string;
  aiUsed: boolean;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function avatarFor(name: string): RecapAvatar {
  const toks = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    (toks[0]?.[0] ?? "?").toUpperCase() + (toks.length > 1 ? toks[toks.length - 1][0].toUpperCase() : "");
  const [from, to] = GRADIENTS[hashStr(name) % GRADIENTS.length];
  return { initials: initials || "?", from, to };
}
function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

type Row = Record<string, unknown>;

/** Get the cached recap or build + cache it. Public-safe (service role). */
export async function getOrBuildRecap(gameId: string): Promise<Recap | null> {
  const supabase = createSupabaseAdminClient();
  const { data: game } = await supabase
    .from("games")
    .select("id, group_id, state, num_rounds, status")
    .eq("id", gameId)
    .maybeSingle();
  if (!game) return null;
  const state = (game.state ?? {}) as Row;
  const done = game.status === "done";
  const cached = state.recap as Recap | undefined;
  // Only trust a cached recap once the game is finished; while a game is still in
  // progress we rebuild each view so the recap stays current.
  if (done && cached && cached.version === RECAP_VERSION) return cached;

  const recap = await buildRecap(supabase, game as Row);
  if (done) {
    try {
      await supabase.from("games").update({ state: { ...state, recap } }).eq("id", game.id as string);
    } catch {
      /* non-fatal: recap still returned for this view */
    }
  }
  return recap;
}

async function buildRecap(supabase: SupabaseClient, game: Row): Promise<Recap> {
  const groupId = game.group_id as string;
  const gameId = game.id as string;

  const [{ data: group }, { data: teamRows }, { data: memberRows }, { data: scoreRows }, { data: events }, { data: questionRows }] =
    await Promise.all([
      supabase.from("groups").select("name, category").eq("id", groupId).maybeSingle(),
      supabase.from("teams").select("id, name, team_index").eq("group_id", groupId).order("team_index"),
      supabase.from("members").select("id, display_name, team_id, is_playing").eq("group_id", groupId).order("created_at"),
      supabase.from("game_scores").select("team_id, points").eq("game_id", gameId),
      supabase.from("game_events").select("type, payload").eq("game_id", gameId).order("created_at"),
      supabase.from("feud_questions").select("id, prompt, type, options").eq("group_id", groupId),
    ]);

  const teams = (teamRows ?? []) as Row[];
  const members = (memberRows ?? []) as Row[];
  const questions = (questionRows ?? []) as Row[];
  const qIds = questions.map((q) => q.id as string);
  const { data: respRows } = qIds.length
    ? await supabase.from("feud_responses").select("question_id, member_id, raw_answer").in("question_id", qIds)
    : { data: [] as Row[] };
  const responses = (respRows ?? []) as Row[];

  const nameById = new Map(members.map((m) => [m.id as string, m.display_name as string]));
  const teamNameById = new Map(teams.map((t) => [t.id as string, t.name as string]));
  const players = members.filter((m) => m.is_playing !== false);
  const allNames = members.map((m) => m.display_name as string);

  // ---- Scores / winner -----------------------------------------------------
  const scoreByTeam = new Map<string, number>();
  for (const s of scoreRows ?? []) scoreByTeam.set(s.team_id as string, (s.points as number) ?? 0);
  const recapTeams: RecapTeam[] = teams
    .map((t) => ({
      teamId: t.id as string,
      name: t.name as string,
      index: (t.team_index as number) ?? 0,
      points: scoreByTeam.get(t.id as string) ?? 0,
    }))
    .sort((a, b) => b.points - a.points);
  const winner =
    recapTeams.length > 0
      ? {
          name: recapTeams[0].name,
          points: recapTeams[0].points,
          tie: recapTeams.length > 1 && recapTeams[0].points === recapTeams[1].points,
        }
      : null;

  // ---- Per-player stats from enriched events -------------------------------
  const correctByMember = new Map<string, number>();
  const pointsByMember = new Map<string, number>();
  const openBookByAuthor = new Map<string, number>(); // guess_who authors correctly identified
  let rightAnswers = 0;
  let totalPoints = 0;
  let questionsPlayed = 0;
  const RESULT_TYPES = new Set(["feud_result", "guess_who_result", "guess_what_result", "trivia_result"]);
  const triviaCorrectByMember = new Map<string, number>();
  for (const e of events ?? []) {
    const type = e.type as string;
    if (!RESULT_TYPES.has(type)) continue;
    const p = (e.payload ?? {}) as Row;
    const pts = Number(p.points ?? 0);
    const mid = p.memberId as string | undefined;
    const correct = Boolean(p.correct) || pts > 0;
    totalPoints += pts;
    if (type !== "trivia_result") questionsPlayed += 1;
    if (correct) rightAnswers += 1;
    if (mid) {
      pointsByMember.set(mid, (pointsByMember.get(mid) ?? 0) + pts);
      if (correct) correctByMember.set(mid, (correctByMember.get(mid) ?? 0) + 1);
      if (type === "trivia_result" && correct)
        triviaCorrectByMember.set(mid, (triviaCorrectByMember.get(mid) ?? 0) + 1);
    }
    if (type === "guess_who_result" && correct && p.authorMemberId)
      openBookByAuthor.set(p.authorMemberId as string, (openBookByAuthor.get(p.authorMemberId as string) ?? 0) + 1);
  }

  // ---- Votes received ("total tallies") from pick_person responses ---------
  const typeByQ = new Map(questions.map((q) => [q.id as string, q.type as string]));
  const optionsByQ = new Map(questions.map((q) => [q.id as string, (q.options as string[] | null) ?? null]));
  const promptByQ = new Map(questions.map((q) => [q.id as string, q.prompt as string]));
  const votesByName = new Map<string, number>();
  for (const r of responses) {
    if (typeByQ.get(r.question_id as string) !== "pick_person") continue;
    const matched = fuzzyMatch(r.raw_answer as string, allNames);
    if (matched) votesByName.set(matched, (votesByName.get(matched) ?? 0) + 1);
  }

  // ---- Lone wolf: answers nobody else gave (by question) -------------------
  const byQuestion = new Map<string, Row[]>();
  for (const r of responses) {
    const arr = byQuestion.get(r.question_id as string) ?? [];
    arr.push(r);
    byQuestion.set(r.question_id as string, arr);
  }
  const loneByMember = new Map<string, number>();
  for (const [, rs] of byQuestion) {
    const counts = new Map<string, number>();
    for (const r of rs) counts.set(normalize(r.raw_answer as string), (counts.get(normalize(r.raw_answer as string)) ?? 0) + 1);
    for (const r of rs)
      if (counts.get(normalize(r.raw_answer as string)) === 1)
        loneByMember.set(r.member_id as string, (loneByMember.get(r.member_id as string) ?? 0) + 1);
  }

  // Each member's free-text answers (open_text / guess_who / guess_what) for flavor.
  const answersByMember = new Map<string, string[]>();
  for (const r of responses) {
    const t = typeByQ.get(r.question_id as string);
    if (t === "open_text" || t === "guess_who" || t === "guess_what") {
      const arr = answersByMember.get(r.member_id as string) ?? [];
      arr.push(r.raw_answer as string);
      answersByMember.set(r.member_id as string, arr);
    }
  }

  // ---- Superlatives (greedy, distinct winners where possible) --------------
  const used = new Set<string>();
  function rankedBy(map: Map<string, number>): { id: string; n: number }[] {
    return [...map.entries()]
      .filter(([id]) => nameById.has(id))
      .map(([id, n]) => ({ id, n }))
      .sort((a, b) => b.n - a.n);
  }
  function award(
    key: string,
    emoji: string,
    title: string,
    ranked: { id: string; n: number }[],
    detail: (n: number) => string,
  ): RecapSuperlative | null {
    // Prefer a not-yet-awarded person with a positive score.
    const pick = ranked.find((r) => r.n > 0 && !used.has(r.id)) ?? ranked.find((r) => r.n > 0);
    if (!pick) return null;
    used.add(pick.id);
    const name = nameById.get(pick.id) ?? "Someone";
    return { key, emoji, title, memberName: name, avatar: avatarFor(name), detail: detail(pick.n) };
  }
  const idByName = (name: string): string | null => {
    const m = members.find((mm) => (mm.display_name as string) === name);
    return m ? (m.id as string) : null;
  };
  const votesRanked = [...votesByName.entries()]
    .map(([name, n]) => ({ id: idByName(name), n }))
    .filter((r): r is { id: string; n: number } => Boolean(r.id))
    .sort((a, b) => b.n - a.n);

  const superlatives: RecapSuperlative[] = [];
  const push = (s: RecapSuperlative | null) => {
    if (s) superlatives.push(s);
  };
  push(award("main_character", "📣", "The Main Character", votesRanked, (n) => `named ${n} time${n === 1 ? "" : "s"}`));
  push(award("mind_reader", "🎯", "The Mind Reader", rankedBy(correctByMember), (n) => `${n} right on the night`));
  push(award("trivia_titan", "🧠", "Trivia Titan", rankedBy(triviaCorrectByMember), (n) => `${n} trivia correct`));
  push(award("lone_wolf", "🐺", "The Lone Wolf", rankedBy(loneByMember), (n) => `${n} one-of-a-kind answer${n === 1 ? "" : "s"}`));
  push(award("open_book", "🙈", "The Open Book", rankedBy(openBookByAuthor), (n) => `read like a book ${n}×`));
  push(award("high_scorer", "💎", "The Point Machine", rankedBy(pointsByMember), (n) => `${n} points earned`));

  const topVotesId = votesRanked[0]?.id;
  const topCorrectId = rankedBy(correctByMember)[0]?.id;
  const topLoneId = rankedBy(loneByMember)[0]?.id;

  // ---- Player profiles -----------------------------------------------------
  const basePlayers: RecapPlayer[] = players
    .map((m) => {
      const id = m.id as string;
      const name = m.display_name as string;
      const standout = (answersByMember.get(id) ?? []).sort((a, b) => b.length - a.length)[0] ?? null;
      let title = "The Crew Member";
      if (id === topVotesId && (votesByName.get(name) ?? 0) > 0) title = "The Main Character";
      else if (id === topCorrectId && (correctByMember.get(id) ?? 0) > 0) title = "The Mind Reader";
      else if (id === topLoneId && (loneByMember.get(id) ?? 0) > 0) title = "The Wildcard";
      else if ((pointsByMember.get(id) ?? 0) > 0) title = "The Contender";
      const bits: string[] = [];
      const v = votesByName.get(name) ?? 0;
      const c = correctByMember.get(id) ?? 0;
      if (v > 0) bits.push(`named ${v}×`);
      if (c > 0) bits.push(`${c} right`);
      const persona = `${bits.join(" · ") || "Along for the ride"}.${standout ? ` Went with “${standout}.”` : ""}`;
      return {
        memberId: id,
        name,
        teamName: m.team_id ? teamNameById.get(m.team_id as string) ?? null : null,
        avatar: avatarFor(name),
        title,
        persona,
        votesReceived: v,
        correct: c,
        points: pointsByMember.get(id) ?? 0,
        standoutAnswer: standout,
      };
    })
    .sort((a, b) => b.points - a.points || b.votesReceived - a.votesReceived);

  const votesBoard = [...votesByName.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, votes]) => ({ name, votes, avatar: avatarFor(name) }));

  // ---- Deterministic themes ------------------------------------------------
  const commonOpen = mostCommon(
    responses
      .filter((r) => typeByQ.get(r.question_id as string) === "open_text")
      .map((r) => (r.raw_answer as string).trim()),
  );
  const themeParts: string[] = [];
  if (topVotesId) themeParts.push(`${nameById.get(topVotesId)} stole the spotlight`);
  if (topCorrectId && topCorrectId !== topVotesId) themeParts.push(`${nameById.get(topCorrectId)} read the room best`);
  if (topLoneId && topLoneId !== topVotesId && topLoneId !== topCorrectId)
    themeParts.push(`${nameById.get(topLoneId)} kept everyone guessing`);
  if (commonOpen) themeParts.push(`and “${commonOpen}” came up more than once`);
  let themes = themeParts.length
    ? cap(themeParts.join(", ")) + "."
    : `${group?.name ?? "The crew"} brought the hot takes and bold guesses.`;

  // ---- AI enrichment (bounded; falls back to the deterministic text) -------
  let aiUsed = false;
  const finalPlayers = basePlayers;
  if (hasAI() && players.length > 0) {
    const facts = basePlayers.map((p) => ({
      name: p.name,
      namedTimes: p.votesReceived,
      rightGuesses: p.correct,
      answers: (answersByMember.get(p.memberId) ?? []).slice(0, 4),
    }));
    const [personaJson, themeText] = await Promise.all([
      generateJSON<{ players: { name: string; title: string; persona: string }[] }>({
        system:
          "You roast and celebrate a friend group after a party game, warmly. Each person gets a short, specific 'player card'. Return JSON only.",
        prompt: `Here is the data for each player (how many times the group named them in 'who is most likely' questions, how many live guesses they got right, and some of their free-text answers):
${JSON.stringify(facts)}
Return {"players":[{"name":<exact name>,"title":<2-4 word superlative like "The Main Character">,"persona":<one witty, affectionate sentence, max 20 words, referencing their data>}]}. One entry per player, keep names EXACTLY as given.`,
        maxTokens: 1200,
      }),
      generateText({
        system: "You sum up a friend group's vibe after a party game in one or two punchy, affectionate sentences.",
        prompt: `Group "${group?.name}". Most-named people: ${votesBoard.slice(0, 3).map((v) => `${v.name} (${v.votes})`).join(", ") || "n/a"}. Superlatives: ${superlatives.map((s) => `${s.memberName}=${s.title}`).join(", ") || "n/a"}. Common answers: ${commonOpen || "n/a"}. Write 1-2 sentences capturing the group's personality. No preamble.`,
        maxTokens: 160,
      }),
    ]);
    if (personaJson?.players?.length) {
      const byName = new Map(personaJson.players.map((pp) => [normalize(pp.name), pp]));
      for (const p of finalPlayers) {
        const hit = byName.get(normalize(p.name));
        if (hit?.title) p.title = hit.title.slice(0, 40);
        if (hit?.persona) p.persona = hit.persona.slice(0, 220);
      }
      aiUsed = true;
    }
    if (themeText && themeText.trim()) {
      themes = themeText.trim().slice(0, 400);
      aiUsed = true;
    }
  }

  // ---- Fold resonance back into the global bank (best-effort) --------------
  const resonanceSamples: { prompt: string; type: string; category?: string | null; options?: string[] | null; consensus: number }[] = [];
  for (const [qid, rs] of byQuestion) {
    const t = typeByQ.get(qid);
    if (!t || !CONSENSUS_TYPES.includes(t) || rs.length < 2) continue;
    const buckets = tallyBuckets(rs.map((r) => r.raw_answer as string));
    resonanceSamples.push({
      prompt: promptByQ.get(qid) ?? "",
      type: t,
      category: (group?.category as string) ?? null,
      options: optionsByQ.get(qid),
      consensus: consensusScore(buckets),
    });
  }
  await recordResonance(resonanceSamples, groupId);

  return {
    version: RECAP_VERSION,
    groupName: group?.name ?? "The group",
    generatedAt: new Date().toISOString(),
    rounds: (game.num_rounds as number) ?? 1,
    teams: recapTeams,
    winner,
    totals: { questionsPlayed, rightAnswers, totalPoints },
    superlatives,
    players: finalPlayers,
    votesBoard,
    themes,
    aiUsed,
  };
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, { label: string; n: number }>();
  for (const v of values) {
    const key = normalize(v);
    if (!key) continue;
    const cur = counts.get(key);
    if (cur) cur.n += 1;
    else counts.set(key, { label: v.trim(), n: 1 });
  }
  let best: { label: string; n: number } | null = null;
  for (const [, c] of counts) if (c.n >= 2 && (!best || c.n > best.n)) best = c;
  return best?.label ?? null;
}
