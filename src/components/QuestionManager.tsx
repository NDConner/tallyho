"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addQuestion,
  updateQuestion,
  deleteQuestion,
  suggestNewList,
  suggestMore,
} from "@/app/dashboard/g/[id]/questions/actions";
import type { FeudQuestionType } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface QItem {
  id: string;
  prompt: string;
  type: FeudQuestionType;
  options: string[] | null;
  target_member_id: string | null;
  source: string;
  ai_recommended: boolean;
  responseCount: number;
}

interface MemberLite {
  id: string;
  name: string;
}

const TYPE_META: Record<
  FeudQuestionType,
  { label: string; hint: string; hasOptions: boolean }
> = {
  pick_person: { label: "Pick a person", hint: "Answers are group members — cleanest tally.", hasOptions: false },
  multiple_choice: { label: "Multiple choice", hint: "Give 2–20 options.", hasOptions: true },
  likelihood: { label: "Likelihood", hint: "A scale, e.g. Never → Always.", hasOptions: true },
  open_text: { label: "Open text", hint: "Free text, clustered into buckets.", hasOptions: false },
  guess_who: {
    label: "Whose answer?",
    hint: "Everyone answers about themselves. All-or-nothing.",
    hasOptions: false,
  },
  guess_what: {
    label: "Guess their answer",
    hint: "Only the person you pick answers. All-or-nothing.",
    hasOptions: false,
  },
};
const DEFAULT_SCALE = ["Never", "Sometimes", "Usually", "Always"];
const TYPE_BADGE: Record<FeudQuestionType, string> = {
  pick_person: "bg-magenta/15 text-magenta-soft border-magenta/30",
  multiple_choice: "bg-cyan/15 text-cyan border-cyan/30",
  likelihood: "bg-gold/15 text-gold border-gold/30",
  open_text: "bg-green/15 text-green border-green/30",
  guess_who: "bg-cyan/15 text-cyan border-cyan/30",
  guess_what: "bg-magenta/15 text-magenta-soft border-magenta/30",
};

// Plain-language "how it plays live" note for the two targeted kinds.
function playsNote(type: FeudQuestionType): string | null {
  if (type === "guess_who")
    return "🎯 Everyone answers this about themselves. Live, one answer is shown and the team guesses WHO said it — all or nothing.";
  if (type === "guess_what")
    return "🎯 Only the chosen person answers. Live, the team guesses WHAT they said — all or nothing.";
  return null;
}

export function QuestionManager({
  groupId,
  questions,
  members,
  memberCount,
}: {
  groupId: string;
  questions: QItem[];
  members: MemberLite[];
  memberCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [guidance, setGuidance] = useState("");
  const target = Math.max(memberCount, 6);
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  function save(
    data: {
      prompt: string;
      type: FeudQuestionType;
      options: string[] | null;
      targetMemberId: string | null;
    },
    id?: string,
  ) {
    start(async () => {
      if (id) await updateQuestion({ groupId, questionId: id, ...data });
      else await addQuestion({ groupId, ...data });
      setEditingId(null);
      setAdding(false);
      router.refresh();
    });
  }
  function remove(id: string) {
    start(async () => {
      await deleteQuestion({ groupId, questionId: id });
      router.refresh();
    });
  }
  function runAction(action: (fd: FormData) => Promise<void>) {
    start(async () => {
      const fd = new FormData();
      fd.set("groupId", groupId);
      fd.set("guidance", guidance);
      await action(fd);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-lg font-bold">
              {questions.length} question{questions.length === 1 ? "" : "s"}
            </div>
            <p className="text-sm text-cream/55">
              Every question gets played live. For {memberCount} players, aim for at least{" "}
              <span className="text-cream">~{target}</span> (about one per player) — add more for a
              longer game; they split evenly across the teams.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (
                  questions.length === 0 ||
                  confirm("Replace ALL current questions with a fresh suggested list?")
                )
                  runAction(suggestNewList);
              }}
              className="btn btn-ghost text-sm"
              disabled={pending}
            >
              ✨ Suggest a new list
            </button>
            <button
              onClick={() => runAction(suggestMore)}
              className="btn btn-secondary text-sm"
              disabled={pending}
            >
              ➕ Add 10 more
            </button>
            <button
              onClick={() => { setAdding(true); setEditingId(null); }}
              className="btn btn-primary text-sm"
            >
              + Add question
            </button>
          </div>
        </div>
        <div>
          <input
            className="input text-sm"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder="Guide new suggestions (optional): e.g. “lean into our Tahoe trips and inside jokes”"
            maxLength={200}
          />
          <p className="mt-1 text-xs text-cream/40">
            Steers <span className="text-cream/60">✨ Suggest a new list</span> and{" "}
            <span className="text-cream/60">➕ Add 10 more</span> when AI suggestions are on.
          </p>
        </div>
      </div>

      {adding && (
        <QuestionForm
          members={members}
          pending={pending}
          onSave={(d) => save(d)}
          onCancel={() => setAdding(false)}
        />
      )}

      {questions.length === 0 && !adding && (
        <div className="card p-8 text-center text-cream/55">
          No questions yet. Add the recommended set to get started, then tweak away.
        </div>
      )}

      <ul className="space-y-3">
        {questions.map((q) =>
          editingId === q.id ? (
            <QuestionForm
              key={q.id}
              initial={q}
              members={members}
              pending={pending}
              onSave={(d) => save(d, q.id)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <li key={q.id} className="card flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", TYPE_BADGE[q.type])}>
                    {TYPE_META[q.type].label}
                  </span>
                  {q.type === "guess_what" && (
                    <span className="chip cursor-default text-xs">
                      👤 {nameById.get(q.target_member_id ?? "") ?? "pick someone"} answers
                    </span>
                  )}
                  {q.ai_recommended && <span className="chip cursor-default text-xs">AI</span>}
                  {q.responseCount > 0 && (
                    <span className="text-xs text-cream/45">{q.responseCount} answered</span>
                  )}
                </div>
                <p className="mt-1.5 font-medium">{q.prompt}</p>
                {q.options && q.options.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {q.options.map((o, i) => (
                      <span key={i} className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-cream/70">
                        {o}
                      </span>
                    ))}
                  </div>
                )}
                {playsNote(q.type) && (
                  <p className="mt-2 text-xs text-cream/45">{playsNote(q.type)}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => { setEditingId(q.id); setAdding(false); }} className="px-2 text-sm text-cream/50 hover:text-cyan" title="Edit">
                  ✏️
                </button>
                <button onClick={() => remove(q.id)} disabled={pending} className="px-2 text-sm text-cream/50 hover:text-magenta" title="Delete">
                  🗑️
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function QuestionForm({
  initial,
  members,
  onSave,
  onCancel,
  pending,
}: {
  initial?: QItem;
  members: MemberLite[];
  onSave: (d: {
    prompt: string;
    type: FeudQuestionType;
    options: string[] | null;
    targetMemberId: string | null;
  }) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [type, setType] = useState<FeudQuestionType>(initial?.type ?? "pick_person");
  const [options, setOptions] = useState<string[]>(initial?.options ?? []);
  const [targetMemberId, setTargetMemberId] = useState<string | null>(initial?.target_member_id ?? null);
  const meta = TYPE_META[type];

  function changeType(t: FeudQuestionType) {
    setType(t);
    if (t === "likelihood") setOptions((o) => (o.length ? o : [...DEFAULT_SCALE]));
    else if (t === "multiple_choice") setOptions((o) => (o.length ? o : ["", "", "", ""]));
    else setOptions([]);
    if (t !== "guess_what") setTargetMemberId(null);
  }

  const canSave =
    prompt.trim().length > 0 &&
    (!meta.hasOptions || options.filter((o) => o.trim()).length >= 2) &&
    (type !== "guess_what" || Boolean(targetMemberId));

  const promptPlaceholder =
    type === "guess_who"
      ? "e.g. Your all-time favorite music artist?"
      : type === "guess_what"
        ? "e.g. FMK: Ryan Gosling, Pedro Pascal, Timothée Chalamet"
        : "Who in the group is most likely to…?";

  return (
    <div className="card space-y-3 border border-magenta/30 p-4">
      <textarea
        autoFocus
        className="input min-h-[64px] resize-y"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={promptPlaceholder}
        maxLength={200}
      />
      <div>
        <div className="label mb-1">Answer type</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(TYPE_META) as FeudQuestionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => changeType(t)}
              className={
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition " +
                (type === t
                  ? "border-magenta bg-magenta/20 text-cream"
                  : "border-white/15 bg-white/5 text-cream/70 hover:border-cyan hover:text-cream")
              }
            >
              {TYPE_META[t].label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-cream/45">{meta.hint}</p>
      </div>

      {/* How-it-plays explainer for the targeted kinds */}
      {(type === "guess_who" || type === "guess_what") && (
        <div className="rounded-xl border border-cyan/25 bg-cyan/10 p-3 text-xs text-cyan">
          {playsNote(type)}
        </div>
      )}

      {/* guess_what: who is the single person that answers */}
      {type === "guess_what" && (
        <div>
          <div className="label mb-1">Who answers this?</div>
          <select
            className="input"
            value={targetMemberId ?? ""}
            onChange={(e) => setTargetMemberId(e.target.value || null)}
          >
            <option value="">Pick a person…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {members.length === 0 && (
            <p className="mt-1 text-xs text-magenta-soft">Add players first, then pick who answers.</p>
          )}
        </div>
      )}

      {meta.hasOptions && (
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="input"
                value={o}
                onChange={(e) => setOptions((arr) => arr.map((x, idx) => (idx === i ? e.target.value : x)))}
                placeholder={`Option ${i + 1}`}
                maxLength={60}
              />
              <button type="button" onClick={() => setOptions((arr) => arr.filter((_, idx) => idx !== i))} className="px-2 text-cream/40 hover:text-magenta">
                ✕
              </button>
            </div>
          ))}
          {options.length < 20 && (
            <button type="button" onClick={() => setOptions((arr) => [...arr, ""])} className="btn btn-ghost text-xs">
              + Option
            </button>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn btn-ghost text-sm">
          Cancel
        </button>
        <button
          onClick={() =>
            onSave({
              prompt,
              type,
              options: meta.hasOptions ? options : null,
              targetMemberId: type === "guess_what" ? targetMemberId : null,
            })
          }
          disabled={!canSave || pending}
          className="btn btn-primary text-sm"
        >
          {pending ? "Saving…" : initial ? "Save" : "Add"}
        </button>
      </div>
    </div>
  );
}
