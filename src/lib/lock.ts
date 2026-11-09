// Answer-lock rules, shared by the host dashboard and the member write paths.
// Pure (no server deps) so it can run on the server or be reasoned about in tests.

export interface LockableGroup {
  status: string;
  answer_deadline?: string | null;
}

/** Has the host-set answer deadline come and gone? */
export function deadlinePassed(deadline: string | null | undefined, now: Date = new Date()): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  return !isNaN(d.getTime()) && now.getTime() >= d.getTime();
}

/**
 * Whether a group's answers are locked right now. Locked when:
 *   • the host moved the group out of "setup" (ready = manual lock, live/done = played), OR
 *   • an answer deadline was set and has now passed (the default auto-lock).
 * The host can always reopen (which clears a passed deadline — see setAnswerLock).
 */
export function isAnswersLocked(group: LockableGroup, now: Date = new Date()): boolean {
  if (group.status !== "setup") return true;
  return deadlinePassed(group.answer_deadline ?? null, now);
}

export type LockReason = "open" | "deadline" | "manual" | "played";

/** Why answers are (or aren't) locked — drives the dashboard copy. */
export function lockReason(group: LockableGroup, now: Date = new Date()): LockReason {
  if (group.status === "live" || group.status === "done") return "played";
  if (group.status === "ready") return "manual";
  if (deadlinePassed(group.answer_deadline ?? null, now)) return "deadline";
  return "open";
}
