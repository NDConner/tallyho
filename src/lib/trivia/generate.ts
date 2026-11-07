import { STARTER_POOL, type StarterQuestion } from "@/lib/trivia/topics";
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
 * Build a balanced starter bank, STRICTLY matching each team's chosen topics.
 *
 *  • Strict match — a team only ever gets questions whose topic it actually
 *    selected. No category "bleed" into neighbouring topics (that's what put
 *    "First Lines" / "20th Century Fiction" in front of a team that picked
 *    Harry Potter). A custom topic with no curated questions simply contributes
 *    nothing rather than pulling in the wrong thing.
 *  • Balanced — round-robin across the team's topics so each is represented as
 *    evenly as possible (±1), instead of one topic hogging the slots.
 *  • Hardest-first — questions flagged `hard` are taken before the rest.
 *  • No repeats — a prompt placed for any team is never used again anywhere.
 *  • Equal teams — every team ends with the same number of questions (trivia
 *    pairs 1:1 with feud turns), trimmed to the smallest a team could fill.
 */
export function buildStarterBank(opts: {
  teams: { id: string; selectedTopics: string[] }[];
  countPerTeam: number;
  pointValue: number;
  exclude?: Set<string>;
}): TriviaRow[] {
  const exclude = opts.exclude ?? new Set<string>();
  const used = new Set<string>(); // normalized prompts already placed (global)

  const poolByTopic = new Map<string, StarterQuestion[]>();
  for (const q of STARTER_POOL) {
    const arr = poolByTopic.get(q.topic) ?? [];
    arr.push(q);
    poolByTopic.set(q.topic, arr);
  }
  // A topic's questions, hardest-first (shuffled within each tier), minus any
  // the host flagged as too obvious.
  const orderedTopic = (topic: string): StarterQuestion[] => {
    const all = (poolByTopic.get(topic) ?? []).filter((q) => !exclude.has(norm(q.prompt)));
    return [...shuffle(all.filter((q) => q.hard)), ...shuffle(all.filter((q) => !q.hard))];
  };

  const perTeam = opts.teams.map((team) => {
    const queues = team.selectedTopics.map((t) => orderedTopic(t));
    const rows: TriviaRow[] = [];
    let advanced = true;
    while (rows.length < opts.countPerTeam && advanced) {
      advanced = false;
      for (const queue of queues) {
        if (rows.length >= opts.countPerTeam) break;
        let picked: StarterQuestion | undefined;
        while (queue.length) {
          const cand = queue.shift()!;
          if (!used.has(norm(cand.prompt))) {
            picked = cand;
            break;
          }
        }
        if (!picked) continue;
        used.add(norm(picked.prompt));
        rows.push({
          teamId: team.id,
          topic: picked.topic,
          prompt: picked.prompt,
          correct_answer: picked.answer,
          accepted_variants: picked.variants,
          point_value: opts.pointValue,
        });
        advanced = true;
      }
    }
    return rows;
  });

  // Keep every team the same length so trivia lines up 1:1 with feud turns.
  const minLen = perTeam.length ? Math.min(...perTeam.map((r) => r.length)) : 0;
  return perTeam.flatMap((rows) => rows.slice(0, minLen));
}
