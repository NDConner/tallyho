import { BRAND } from "@/lib/brand";
import type { Group } from "@/lib/types";

export function joinLink(group: Pick<Group, "join_code">, appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/join?code=${group.join_code}`;
}

export interface InviteOpts {
  /** Roughly how many questions this person answers (drives the time estimate). */
  questionCount?: number;
  /** ISO deadline for finishing questions, if the host set one. */
  deadline?: string | null;
}

/** A friendly, honest time estimate based on how many questions there are. */
function estimateMinutes(count?: number): number {
  if (!count || count <= 0) return 5;
  return Math.max(3, Math.round(count * 0.2)); // ~12s per question, floor 3 min
}

function deadlineLine(deadline?: string | null): string | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return null;
  const when = d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `Please finish by ${when}.`;
}

/** Copy-paste message for regular members. */
export function memberInvite(
  group: Pick<Group, "name" | "join_code">,
  appUrl: string,
  opts: InviteOpts = {},
): string {
  const link = joinLink(group, appUrl);
  const mins = estimateMinutes(opts.questionCount);
  const dl = deadlineLine(opts.deadline);
  return [
    `🎤 You're in for ${group.name}'s game of ${BRAND.name}!`,
    ``,
    `Tap the link, pick your name, and answer your questions — it's how the whole game gets built around our crew. Have fun with it and be honest; the more thoughtful (and funnier) your answers, the better the game.`,
    ``,
    `⏱️ Takes about ${mins} minutes.${dl ? ` ${dl}` : ""}`,
    ``,
    link,
    `Group code: ${group.join_code}`,
  ].join("\n");
}

/** Copy-paste message for team captains (team branding + topics + their crew). */
export function captainInvite(
  group: Pick<Group, "name" | "join_code">,
  appUrl: string,
  opts: InviteOpts = {},
): string {
  const link = joinLink(group, appUrl);
  const mins = estimateMinutes(opts.questionCount);
  const dl = deadlineLine(opts.deadline);
  return [
    `🎖️ You're a TEAM CAPTAIN for ${group.name}'s game of ${BRAND.name}!`,
    ``,
    `Tap the link and pick your name — you'll get a captain screen. Your jobs:`,
    `  1) Name your team (add a logo or photo if you want — optional but fun)`,
    `  2) Pick your team's trivia topics`,
    `  3) Make sure your whole team answers their questions before game night`,
    `  4) Answer your own questions too`,
    ``,
    `⏱️ Your own questions take about ${mins} minutes.${dl ? ` ${dl}` : ""}`,
    ``,
    link,
    `Group code: ${group.join_code}`,
  ].join("\n");
}
