"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFeudSubject } from "@/app/dashboard/g/[id]/actions";
import { BUILTIN_SUBJECTS, type FeudSubject } from "@/lib/feud/subjects";

/** Host control for what pick-a-person questions are answered FROM: the group
 *  roster (classic), a built-in theme, or a custom list. */
export function FeudSubjectEditor({
  groupId,
  initial,
}: {
  groupId: string;
  initial: FeudSubject;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const matchedBuiltin =
    initial.mode === "theme"
      ? BUILTIN_SUBJECTS.find((b) => b.label.toLowerCase() === (initial.theme ?? "").toLowerCase())
      : undefined;

  const [mode, setMode] = useState<"group" | "theme">(initial.mode);
  const [choice, setChoice] = useState<string>(
    initial.mode === "theme" ? (matchedBuiltin?.key ?? "custom") : BUILTIN_SUBJECTS[0].key,
  );
  const [customTheme, setCustomTheme] = useState(
    initial.mode === "theme" && !matchedBuiltin ? (initial.theme ?? "") : "",
  );
  const [customText, setCustomText] = useState(
    initial.mode === "theme" && !matchedBuiltin ? initial.pool.join("\n") : "",
  );

  const selectedBuiltin = BUILTIN_SUBJECTS.find((b) => b.key === choice);
  const customEntries = customText
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  function dirty() {
    setSaved(false);
    setErr(null);
  }

  function save() {
    setErr(null);
    start(async () => {
      const res =
        mode === "group"
          ? await setFeudSubject({ groupId, mode: "group" })
          : choice === "custom"
            ? await setFeudSubject({ groupId, mode: "theme", customTheme, customEntries })
            : await setFeudSubject({ groupId, mode: "theme", builtinKey: choice });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setErr(res.error ?? "Couldn't save.");
      }
    });
  }

  const canSave = mode === "group" || choice !== "custom" || customEntries.length >= 2;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setMode("group"); dirty(); }}
          className={
            "rounded-xl border px-3 py-1.5 text-sm font-semibold transition " +
            (mode === "group"
              ? "border-magenta bg-magenta/20 text-cream"
              : "border-white/15 bg-white/5 text-cream/70 hover:border-cyan")
          }
        >
          👥 Your crew
        </button>
        <button
          type="button"
          onClick={() => { setMode("theme"); dirty(); }}
          className={
            "rounded-xl border px-3 py-1.5 text-sm font-semibold transition " +
            (mode === "theme"
              ? "border-magenta bg-magenta/20 text-cream"
              : "border-white/15 bg-white/5 text-cream/70 hover:border-cyan")
          }
        >
          🎭 A theme
        </button>
      </div>

      {mode === "group" ? (
        <p className="mt-3 text-sm text-cream/55">
          Pick-a-person questions are answered with your group&apos;s own names — the classic game.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-cream/55">
            &ldquo;Most likely to…&rdquo; questions are answered from this pool instead of your roster.
            Phrase your feud questions to fit (e.g. &ldquo;Which one would survive a zombie apocalypse?&rdquo;).
          </p>
          <div className="flex flex-wrap gap-1.5">
            {BUILTIN_SUBJECTS.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => { setChoice(b.key); dirty(); }}
                className={
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition " +
                  (choice === b.key
                    ? "border-magenta bg-magenta/20 text-cream"
                    : "border-white/15 bg-white/5 text-cream/70 hover:border-cyan")
                }
              >
                {b.emoji} {b.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setChoice("custom"); dirty(); }}
              className={
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition " +
                (choice === "custom"
                  ? "border-magenta bg-magenta/20 text-cream"
                  : "border-white/15 bg-white/5 text-cream/70 hover:border-cyan")
              }
            >
              ✏️ Custom…
            </button>
          </div>

          {choice !== "custom" && selectedBuiltin ? (
            <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-cream/60">
              {selectedBuiltin.pool.length} options · e.g. {selectedBuiltin.pool.slice(0, 4).join(", ")}…
            </p>
          ) : (
            <div className="space-y-2">
              <input
                className="input text-sm"
                value={customTheme}
                onChange={(e) => { setCustomTheme(e.target.value); dirty(); }}
                placeholder="Name this pool (e.g. “NBA legends”, “our coworkers”)"
                maxLength={40}
              />
              <textarea
                className="input min-h-[96px] resize-y text-sm"
                value={customText}
                onChange={(e) => { setCustomText(e.target.value); dirty(); }}
                placeholder="One option per line (or comma-separated)…"
              />
              <p className="text-xs text-cream/45">{customEntries.length} options</p>
            </div>
          )}
        </div>
      )}

      {err && <p className="mt-3 text-sm text-magenta">{err}</p>}

      <button onClick={save} disabled={pending || saved || !canSave} className="btn btn-primary mt-4 text-sm">
        {pending ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}
