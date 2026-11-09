"use client";

import { useState, useTransition } from "react";
import { duplicateGroup } from "@/app/dashboard/g/[id]/actions";

type OptKey =
  | "includePlayers"
  | "includeQuestions"
  | "includeResponses"
  | "includeTopics"
  | "includeTriviaBank";

const OPTIONS: { key: OptKey; label: string; desc: string }[] = [
  { key: "includePlayers", label: "Players & teams", desc: "Names, teams and captains — as fresh, unclaimed slots" },
  { key: "includeQuestions", label: "Feud questions", desc: "Every feud question you authored" },
  { key: "includeResponses", label: "Players' saved answers", desc: "What everyone answered (needs players + questions)" },
  { key: "includeTopics", label: "Trivia topics", desc: "Your captains' chosen topics" },
  { key: "includeTriviaBank", label: "Trivia bank", desc: "The generated trivia questions" },
];

/** Clone a group, choosing exactly which parts come along. Calls the
 *  duplicateGroup server action, which redirects to the new copy on success. */
export function DuplicateDialog({
  groupId,
  groupName,
  defaultOpen = false,
}: {
  groupId: string;
  groupName: string;
  defaultOpen?: boolean;
}) {
  const [name, setName] = useState(`${groupName} (copy)`);
  const [opts, setOpts] = useState<Record<OptKey, boolean>>({
    includePlayers: true,
    includeQuestions: true,
    includeResponses: false,
    includeTopics: true,
    includeTriviaBank: true,
  });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const canResponses = opts.includePlayers && opts.includeQuestions;

  function toggle(key: OptKey) {
    setOpts((o) => {
      const next = { ...o, [key]: !o[key] };
      if (!(next.includePlayers && next.includeQuestions)) next.includeResponses = false;
      return next;
    });
  }

  function submit() {
    setErr(null);
    start(async () => {
      const res = await duplicateGroup({
        groupId,
        name,
        includePlayers: opts.includePlayers,
        includeQuestions: opts.includeQuestions,
        includeResponses: opts.includeResponses && canResponses,
        includeTopics: opts.includeTopics,
        includeTriviaBank: opts.includeTriviaBank,
      });
      if (res && !res.ok) setErr(res.error);
      // On success the action redirects to the new group — navigation happens.
    });
  }

  return (
    <details open={defaultOpen} className="[&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">📋 Duplicate this game</h2>
        <span className="chip cursor-pointer text-xs whitespace-nowrap">Customize &amp; copy</span>
      </summary>
      <p className="mt-1 text-sm text-cream/55">
        Spin up a fresh game from this one — play again with the same crew, or use it as a baseline for
        a brand-new group. Pick exactly what comes along. The copy starts in setup with a new join code
        and every roster slot unclaimed.
      </p>

      <label className="mt-4 block">
        <span className="label">New game name</span>
        <input
          className="input mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Name the copy"
        />
      </label>

      <ul className="mt-3 space-y-1.5">
        {OPTIONS.map((o) => {
          const disabled = o.key === "includeResponses" && !canResponses;
          const checked = o.key === "includeResponses" ? opts.includeResponses && canResponses : opts[o.key];
          return (
            <li key={o.key}>
              <label
                className={
                  "flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 " +
                  (disabled ? "opacity-40" : "bg-white/5 hover:bg-white/8")
                }
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-magenta"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(o.key)}
                />
                <span className="min-w-0">
                  <span className="text-sm font-semibold text-cream">{o.label}</span>
                  <span className="block text-xs text-cream/50">{o.desc}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {err && <p className="mt-3 text-sm text-magenta">{err}</p>}

      <button onClick={submit} disabled={pending} className="btn btn-primary mt-4 text-sm">
        {pending ? "Duplicating…" : "📋 Create the copy"}
      </button>
    </details>
  );
}
