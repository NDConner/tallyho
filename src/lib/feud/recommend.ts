import type { FeudQuestionType } from "@/lib/types";
import { shuffle } from "@/lib/utils";

export interface RecommendedQuestion {
  prompt: string;
  type: FeudQuestionType;
  options?: string[];
}

// Biased toward pick-a-person (cleanest tallies), with a few of each other type.
const PICK_PERSON = [
  "Who is most likely to get famous?",
  "Who would survive longest in a zombie apocalypse?",
  "Who is most likely to show up late to everything?",
  "Who gives the best advice?",
  "Who is most likely to start their own business?",
  "Who is the worst at keeping a secret?",
  "Who would win in an arm-wrestle?",
  "Who is most likely to cry at a wedding?",
  "Who is the most competitive?",
  "Who is most likely to forget your birthday?",
  "Who is the secret softie of the group?",
  "Who would blow their last dollar on something ridiculous?",
  "Who is most likely to go viral?",
  "Who takes the longest to get ready?",
  "Who is most likely to become a millionaire?",
  "Who is the group therapist?",
  "Who is most likely to get lost with GPS on?",
  "Who would survive the longest without their phone?",
];

const LIKELIHOOD_SCALE = ["Never", "Sometimes", "Usually", "Always"];
const LIKELIHOOD_TEMPLATES = [
  "How likely is {name} to be the last to leave a party?",
  "How likely is {name} to reply to a text within a minute?",
  "How likely is {name} to plan the next group trip?",
  "How likely is {name} to talk their way out of a ticket?",
];

const SITUATIONAL: { prompt: string; options: string[] }[] = [
  { prompt: "What does {name} do first at a party?", options: ["Hits the snacks", "Takes over the music", "Works the room", "Finds the dog"] },
  { prompt: "How does {name} handle being wrong?", options: ["Doubles down", "Changes the subject", "Admits it instantly", "Makes a joke"] },
  { prompt: "What's {name}'s role in the group?", options: ["The planner", "The wildcard", "The mom friend", "The instigator"] },
  { prompt: "{name}'s ideal weekend is…", options: ["Big night out", "Couch and a series", "Outdoor adventure", "Whatever's happening"] },
];

const OPEN_TEXT = [
  "First word that comes to mind when you hear '{name}'?",
  "Describe this group in one word.",
  "What's the most '{group}' thing imaginable?",
];

// "Whose answer?" — everyone gives a personal answer; live, the answer is shown
// and the team guesses who said it. Prompts must make sense answered about
// YOURSELF (first person), since each member answers for themselves.
const GUESS_WHO = [
  "Your all-time favorite music artist?",
  "Your favorite athlete of all time?",
  "Your go-to karaoke song?",
  "Your most-used emoji?",
  "A movie you can rewatch forever?",
  "Your dream vacation spot?",
  "Your comfort food?",
  "A hidden talent of yours?",
];

/**
 * Deterministic, member-aware recommendations — no API key required. The AI
 * recommender (server-side, optional) can replace these; this is the fallback.
 */
export function recommendFeudQuestions(opts: {
  groupName: string;
  memberNames: string[];
  count: number;
}): RecommendedQuestion[] {
  const names = shuffle(opts.memberNames.length ? opts.memberNames : ["someone"]);
  const out: RecommendedQuestion[] = [];
  let ni = 0;
  const nextName = () => names[ni++ % names.length];

  // Lead with pick-person.
  for (const p of shuffle(PICK_PERSON)) out.push({ type: "pick_person", prompt: p });
  // Sprinkle the other types.
  for (const t of shuffle(SITUATIONAL)) {
    out.push({ type: "multiple_choice", prompt: t.prompt.replace("{name}", nextName()), options: t.options });
  }
  for (const t of shuffle(LIKELIHOOD_TEMPLATES)) {
    out.push({ type: "likelihood", prompt: t.replace("{name}", nextName()), options: LIKELIHOOD_SCALE });
  }
  for (const t of shuffle(OPEN_TEXT)) {
    out.push({
      type: "open_text",
      prompt: t.replace("{name}", nextName()).replace("{group}", opts.groupName),
    });
  }
  // A couple of "whose answer?" prompts for variety.
  for (const p of shuffle(GUESS_WHO).slice(0, 3)) {
    out.push({ type: "guess_who", prompt: p });
  }

  // Interleave so the set isn't all pick-person up front, then trim to count.
  const persons = out.filter((q) => q.type === "pick_person");
  const others = out.filter((q) => q.type !== "pick_person");
  const mixed: RecommendedQuestion[] = [];
  let pi = 0;
  let oi = 0;
  while (mixed.length < out.length) {
    if (pi < persons.length) mixed.push(persons[pi++]);
    if (mixed.length % 3 === 0 && oi < others.length) mixed.push(others[oi++]);
    if (pi >= persons.length && oi >= others.length) break;
    if (pi >= persons.length && oi < others.length) mixed.push(others[oi++]);
  }
  return mixed.slice(0, Math.max(1, opts.count));
}

/** Recommended overshoot count for a group of N: M = ceil(N*1.5) + 3. */
export function recommendedCount(memberCount: number): number {
  return Math.max(6, Math.ceil(memberCount * 1.5) + 3);
}
