import type { VoteBucket } from "@/lib/types";
import { rankPoints } from "@/lib/scoring";

/** Tally answers into sorted vote buckets (highest count first). */
export function tallyBuckets(answers: string[]): VoteBucket[] {
  const counts = new Map<string, number>();
  for (const a of answers) {
    const key = (a ?? "").trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function totalVotes(buckets: VoteBucket[]): number {
  return buckets.reduce((s, b) => s + b.count, 0);
}

/** Fraction of votes in the top bucket — the concentration metric used by the
 *  consensus quality filter (M6). */
export function consensusScore(buckets: VoteBucket[]): number {
  const total = totalVotes(buckets);
  return total === 0 ? 0 : buckets[0].count / total;
}

/**
 * Score a feud guess against the tally. Standard, response-independent: points
 * are fixed by the matched answer's RANK (1st/2nd/3rd), not by its vote count,
 * and capped to the number of paying ranks for this question (`places`).
 * `matchedLabel` is the bucket the normalizer mapped the guess to (or null).
 */
export function scoreFeudGuess(
  buckets: VoteBucket[],
  matchedLabel: string | null,
  places?: number,
): number {
  if (!matchedLabel) return 0;
  const idx = buckets.findIndex((b) => b.label.toLowerCase() === matchedLabel.toLowerCase());
  return idx === -1 ? 0 : rankPoints(idx, places);
}
