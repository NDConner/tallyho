// ============================================================================
// Scoring calibration
//
// Feud points are naturally bounded by group size: a feud answer is worth the
// number of group members who gave that same answer (1 .. N-1). To keep the
// trivia stream balanced against the feud stream, we derive a calibration
// constant from the group's own answer distributions rather than hard-coding.
//
// Per round a team plays `teamSize` feud turns and `teamSize` trivia questions.
//   feud potential   ≈ teamSize × (avg top-bucket size of usable questions)
//   trivia potential  = teamSize × (trivia point value)
// Setting trivia point value = avg top-bucket size makes one round's feud
// potential ≈ its trivia potential. Uniform point values also guarantee the
// two teams carry equal total trivia value per round.
//
// The two targeted kinds (guess_who / guess_what) are ALL-OR-NOTHING and worth
// exactly this same calibration constant: a correct targeted guess earns what a
// solid feud answer or a right trivia question does, and a miss earns zero. That
// keeps every question type comparable on the scoreboard.
// ============================================================================

export function averageTopBucket(topBucketCounts: number[]): number {
  if (topBucketCounts.length === 0) return 0;
  return topBucketCounts.reduce((a, b) => a + b, 0) / topBucketCounts.length;
}

/** The points a strong answer is worth for this group (floor of 2). */
export function calibrationConstant(avgTopBucket: number): number {
  return Math.max(2, Math.round(avgTopBucket));
}

/**
 * Point value for each trivia question. Uniform by default so both teams'
 * per-round totals are equal. Tunable: an admin override could scale this, and
 * the bank can vary values as long as each team's per-round total stays equal.
 */
export function triviaPointValue(constant: number): number {
  return constant;
}
