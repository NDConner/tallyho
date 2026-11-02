import { STARTER_POOL, CATEGORY_OF_TOPIC, type StarterQuestion } from "@/lib/trivia/topics";
import { shuffle } from "@/lib/utils";

export interface TriviaRow {
  teamId: string;
  topic: string;
  prompt: string;
  correct_answer: string;
  accepted_variants: string[];
  point_value: number;
}

const norm = (s: string) => (s ?? "").trim().toLowerCase();

/**
 * Build a balanced starter bank. Each team gets up to `countPerTeam` questions
 * at the same point value (so per-team totals stay equal), drawn in priority:
 *   1) questions whose topic the captain actually SELECTED
 *   2) questions in the same CATEGORIES as their selected topics
 * It never bleeds into categories the team didn't pick. Prompts are de-duped
 * GLOBALLY (no question repeats across teams) and any `exclude`d prompts
 * (flagged too-obvious) are skipped.
 */
export function buildStarterBank(opts: {
  teams: { id: string; selectedTopics: string[] }[];
  countPerTeam: number;
  pointValue: number;
  exclude?: Set<string>;
}): TriviaRow[] {
  const rows: TriviaRow[] = [];
  const used = new Set<string>(); // normalized prompts already placed (global)
  const exclude = opts.exclude ?? new Set<string>();

  for (const team of opts.teams) {
    const topics = new Set(team.selectedTopics);
    const categories = new Set(
      team.selectedTopics.map((t) => CATEGORY_OF_TOPIC[t]).filter(Boolean),
    );
    const byTopic = shuffle(STARTER_POOL.filter((q) => topics.has(q.topic)));
    const byCategory = shuffle(
      STARTER_POOL.filter((q) => !topics.has(q.topic) && categories.has(q.category)),
    );

    const picks: StarterQuestion[] = [];
    for (const q of [...byTopic, ...byCategory]) {
      if (picks.length >= opts.countPerTeam) break;
      const key = norm(q.prompt);
      if (used.has(key) || exclude.has(key)) continue;
      used.add(key);
      picks.push(q);
    }
    for (const q of picks) {
      rows.push({
        teamId: team.id,
        topic: q.topic,
        prompt: q.prompt,
        correct_answer: q.answer,
        accepted_variants: q.variants,
        point_value: opts.pointValue,
      });
    }
  }
  return rows;
}
