// ============================================================================
// Scoring — standard, response-independent.
//
// A survey/feud answer is worth a FIXED amount by its RANK in the group's tally
// (1st/2nd/3rd), never by how many people happened to say it, so every question
// is weighted the same. How many ranks actually pay out scales with how many
// distinct choices the question offered:
//
//   ≤ 2 choices  → only the winning answer scores (3)
//   3 – 6 choices → 1st & 2nd score (3, 2)
//   7 + choices  → 1st, 2nd & 3rd score (3, 2, 1)
//
// A correct all-or-nothing guess (guess_who / guess_what) equals a 1st-place
// answer (WIN_POINTS). A correct trivia answer is worth TRIVIA_POINTS.
// Tune the numbers here.
// ============================================================================

export const SURVEY_PLACE_POINTS: readonly number[] = [3, 2, 1]; // 1st, 2nd, 3rd
export const WIN_POINTS = SURVEY_PLACE_POINTS[0]; // all-or-nothing (guess_who/guess_what)
export const TRIVIA_POINTS = 2; // every correct trivia answer

/** How many ranks pay out, given how many distinct choices/answers exist. */
export function placesForChoices(choiceCount: number): number {
  if (choiceCount <= 2) return 1;
  if (choiceCount <= 6) return 2;
  return SURVEY_PLACE_POINTS.length; // 3
}

/**
 * Points for a tallied answer by its 0-based rank (0 = top answer), capped to
 * the number of paying ranks for this question (`places`, default all three).
 */
export function rankPoints(
  rankIndex: number,
  places: number = SURVEY_PLACE_POINTS.length,
): number {
  if (rankIndex < 0 || rankIndex >= places) return 0;
  return SURVEY_PLACE_POINTS[rankIndex] ?? 0;
}
