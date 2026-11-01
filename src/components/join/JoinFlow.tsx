"use client";

import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/Wordmark";
import { TOPIC_CATALOG } from "@/lib/trivia/topics";

interface MemberLite {
  id: string;
  name: string;
  isCaptain: boolean;
}
interface Question {
  id: string;
  prompt: string;
  type: string;
  options: string[] | null;
  answer: string | null;
}
interface Tasks {
  groupName: string;
  member: { id: string; name: string; isCaptain: boolean; teamId: string | null };
  roster: { id: string; name: string }[];
  questions: Question[];
  answeredCount: number;
  total: number;
  holdoutAssigned: boolean;
  captain: { teamId: string; teamName: string; selected: string[] } | null;
}

type Phase = "code" | "identify" | "tasks";

// Types that collect a free-text answer (vs. tapping an option/person).
const FREE_TEXT = ["open_text", "guess_who", "guess_what"];

// A one-line explainer shown under the prompt so players get how it'll play.
function typeHint(type: string): string | null {
  if (type === "guess_who")
    return "🙈 Your own answer — at game night the crew guesses who said it.";
  if (type === "guess_what")
    return "🤫 Just you answer this. Your crew will try to guess what you said.";
  return null;
}

export function JoinFlow({ initialCode }: { initialCode?: string }) {
  const [phase, setPhase] = useState<Phase>("code");
  const [code, setCode] = useState((initialCode ?? "").toUpperCase());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [group, setGroup] = useState<{ groupName: string; members: MemberLite[] } | null>(null);
  const [tasks, setTasks] = useState<Tasks | null>(null);
  const didAuto = useRef(false);

  useEffect(() => {
    if (initialCode && !didAuto.current) {
      didAuto.current = true;
      void lookup(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(c: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/join/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Couldn't find that group.");
        return;
      }
      setGroup({ groupName: data.groupName, members: data.members });
      setPhase("identify");
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function pickMe(memberId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/join/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, memberId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError("Something went wrong.");
        return;
      }
      setTasks(data);
      setPhase("tasks");
    } finally {
      setBusy(false);
    }
  }

  function switchUser() {
    setTasks(null);
    setPhase("identify");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Wordmark size="sm" />
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-magenta/30 bg-magenta/10 px-4 py-3 text-center text-sm text-magenta-soft">
            {error}
          </p>
        )}

        {phase === "code" && (
          <div className="card p-6 text-center">
            <h1 className="font-display text-2xl font-bold">Join your group</h1>
            <p className="mt-1 text-sm text-cream/60">Enter the code your host sent you.</p>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && code && lookup(code)}
              placeholder="ABC123"
              maxLength={8}
              className="input mt-5 text-center text-2xl font-bold tracking-[0.4em]"
            />
            <button
              onClick={() => lookup(code)}
              disabled={busy || code.length < 4}
              className="btn btn-primary mt-5 w-full"
            >
              {busy ? "Looking…" : "Find my group →"}
            </button>
          </div>
        )}

        {phase === "identify" && group && (
          <div className="card p-6">
            <p className="text-center text-sm text-cream/60">You&apos;re joining</p>
            <h1 className="text-center font-display text-2xl font-bold">{group.groupName}</h1>
            <p className="mt-5 mb-2 text-center label">Who are you?</p>
            <div className="grid grid-cols-2 gap-2">
              {group.members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => pickMe(m.id)}
                  disabled={busy}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold transition hover:border-magenta hover:bg-magenta/10 hover:text-cream disabled:opacity-50"
                >
                  {m.name}
                  {m.isCaptain && <span className="ml-1">🎖️</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === "tasks" && tasks && (
          <TaskFlow code={code} tasks={tasks} onSwitchUser={switchUser} />
        )}

        {phase !== "tasks" && (
          <p className="mt-6 text-center text-xs text-cream/40">
            Are you the host?{" "}
            <a href="/login" className="text-cyan hover:underline">
              Sign in to manage your groups →
            </a>
          </p>
        )}
      </div>
    </main>
  );
}

function OptionButton({
  label,
  selected,
  onClick,
  disabled,
  wide,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "rounded-xl border px-3 py-3 text-sm font-semibold transition disabled:opacity-60 " +
        (wide ? "w-full text-left " : "") +
        (selected
          ? "border-magenta bg-magenta/25 text-cream ring-1 ring-magenta"
          : "border-white/15 bg-white/5 text-cream/80 hover:border-magenta hover:bg-magenta/10 hover:text-cream")
      }
    >
      {selected && <span className="mr-1">✓</span>}
      {label}
    </button>
  );
}

function TaskFlow({
  code,
  tasks,
  onSwitchUser,
}: {
  code: string;
  tasks: Tasks;
  onSwitchUser: () => void;
}) {
  const total = tasks.questions.length;
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of tasks.questions) if (q.answer != null) init[q.id] = q.answer;
    return init;
  });
  const [idx, setIdx] = useState(() => {
    const firstUn = tasks.questions.findIndex((q) => q.answer == null);
    return firstUn === -1 ? 0 : firstUn;
  });
  const [step, setStep] = useState<"feud" | "topics" | "done">(
    total === 0 ? (tasks.captain ? "topics" : "done") : "feud",
  );
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState(answers[tasks.questions[0]?.id] ?? "");

  const q = tasks.questions[idx];
  const answeredCount = Object.keys(answers).length;

  useEffect(() => {
    setText(answers[q?.id] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  async function saveAnswer(qid: string, value: string) {
    if (!value.trim()) return;
    setAnswers((a) => ({ ...a, [qid]: value }));
    setBusy(true);
    try {
      await fetch("/api/join/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, memberId: tasks.member.id, questionId: qid, answer: value }),
      });
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    if (FREE_TEXT.includes(q?.type) && text.trim()) saveAnswer(q.id, text);
    if (idx < total - 1) setIdx(idx + 1);
    else setStep(tasks.captain ? "topics" : "done");
  }

  if (step === "topics" && tasks.captain) {
    return (
      <TopicPicker
        code={code}
        memberId={tasks.member.id}
        captain={tasks.captain}
        memberName={tasks.member.name}
        onBack={total > 0 ? () => { setStep("feud"); setIdx(total - 1); } : undefined}
        onDone={() => setStep("done")}
      />
    );
  }

  if (step === "done" || total === 0) {
    const allAnswered = answeredCount >= total;
    return (
      <div className="card p-7 text-center">
        <div className="animate-pop text-6xl">{allAnswered ? "🎉" : "👍"}</div>
        <h1 className="mt-3 font-display text-2xl font-bold">
          {allAnswered ? `All set, ${tasks.member.name}!` : `Thanks, ${tasks.member.name}!`}
        </h1>
        <p className="mt-2 text-sm text-cream/60">
          {total > 0
            ? `You answered ${answeredCount} of ${total}.`
            : "You're all squared away."}{" "}
          Your host takes it from here.
        </p>
        {tasks.captain && (
          <p className="mt-2 rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold">
            🎖️ Captain topics locked in for {tasks.captain.teamName}.
          </p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          {total > 0 && (
            <button onClick={() => { setStep("feud"); setIdx(0); }} className="btn btn-ghost text-sm">
              Review answers
            </button>
          )}
          <button onClick={onSwitchUser} className="btn btn-ghost text-sm">
            I&apos;m someone else
          </button>
        </div>
      </div>
    );
  }

  const selected = answers[q.id];
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between text-xs">
        <button onClick={onSwitchUser} className="text-cream/50 hover:text-cream">
          ← Not {tasks.member.name}?
        </button>
        <span className="text-cream/50">{answeredCount}/{total} answered</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-magenta transition-all"
          style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }}
        />
      </div>

      <div className="mt-4 text-xs text-cream/45">Question {idx + 1} of {total}</div>
      <h2 className="mt-1 font-display text-xl font-bold leading-snug">{q.prompt}</h2>
      {typeHint(q.type) && (
        <p className="mt-2 rounded-lg bg-cyan/10 px-3 py-2 text-xs text-cyan">{typeHint(q.type)}</p>
      )}

      <div className="mt-4">
        {q.type === "pick_person" && (
          <div className="grid grid-cols-2 gap-2">
            {tasks.roster.map((m) => (
              <OptionButton
                key={m.id}
                label={m.name}
                selected={selected === m.name}
                onClick={() => saveAnswer(q.id, m.name)}
                disabled={busy}
              />
            ))}
          </div>
        )}

        {(q.type === "multiple_choice" || q.type === "likelihood") && (
          <div className="space-y-2">
            {(q.options ?? []).map((o) => (
              <OptionButton
                key={o}
                label={o}
                selected={selected === o}
                onClick={() => saveAnswer(q.id, o)}
                disabled={busy}
                wide
              />
            ))}
          </div>
        )}

        {q.type === "open_text" && (
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text.trim() && saveAnswer(q.id, text)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) {
                saveAnswer(q.id, text);
                goNext();
              }
            }}
            placeholder="Type your answer…"
            maxLength={80}
            className="input"
          />
        )}

        {q.type === "guess_who" && (
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text.trim() && saveAnswer(q.id, text)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) {
                saveAnswer(q.id, text);
                goNext();
              }
            }}
            placeholder="Your answer…"
            maxLength={80}
            className="input"
          />
        )}

        {q.type === "guess_what" && (
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text.trim() && saveAnswer(q.id, text)}
            placeholder="Your answer… (just you — keep it a secret!)"
            maxLength={160}
            className="input min-h-[80px] resize-y"
          />
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="btn btn-ghost disabled:opacity-40"
        >
          ← Previous
        </button>
        <button onClick={goNext} className="btn btn-primary">
          {idx < total - 1 ? "Next →" : tasks.captain ? "On to topics →" : "Finish →"}
        </button>
      </div>
    </div>
  );
}

function TopicPicker({
  code,
  memberId,
  captain,
  memberName,
  onBack,
  onDone,
}: {
  code: string;
  memberId: string;
  captain: { teamId: string; teamName: string; selected: string[] };
  memberName: string;
  onBack?: () => void;
  onDone: () => void;
}) {
  const [picks, setPicks] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const cat of TOPIC_CATALOG) {
      const found = cat.topics.find((t) => captain.selected.includes(t));
      if (found) init[cat.category] = found;
    }
    return init;
  });
  const [busy, setBusy] = useState(false);
  const chosen = Object.values(picks);
  const complete = TOPIC_CATALOG.every((c) => picks[c.category]);

  async function submit() {
    setBusy(true);
    try {
      await fetch("/api/join/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, memberId, teamId: captain.teamId, topics: chosen }),
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="text-center">
        <div className="text-3xl">🎖️</div>
        <h1 className="mt-1 font-display text-xl font-bold">Captain {memberName}</h1>
        <p className="text-sm text-cream/60">
          Pick <b className="text-cream">one topic per category</b> for {captain.teamName}.
        </p>
        <p className="mt-1 text-xs text-cream/45">
          {chosen.length}/{TOPIC_CATALOG.length} categories
        </p>
      </div>

      <div className="mt-4 max-h-[52vh] space-y-4 overflow-y-auto pr-1">
        {TOPIC_CATALOG.map((cat) => (
          <div key={cat.category}>
            <div className="label mb-1 flex items-center gap-2">
              {cat.category}
              {picks[cat.category] && <span className="text-green">✓</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cat.topics.map((t) => {
                const on = picks[cat.category] === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPicks((p) => ({ ...p, [cat.category]: t }))}
                    className={
                      "rounded-full border px-2.5 py-1 text-xs font-semibold transition " +
                      (on
                        ? "border-magenta bg-magenta/25 text-cream"
                        : "border-white/15 bg-white/5 text-cream/70 hover:border-cyan hover:text-cream")
                    }
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        {onBack && (
          <button onClick={onBack} className="btn btn-ghost text-sm">
            ← Back
          </button>
        )}
        <button onClick={submit} disabled={busy || !complete} className="btn btn-primary flex-1">
          {busy ? "Saving…" : complete ? "Lock in topics" : `Pick ${TOPIC_CATALOG.length - chosen.length} more`}
        </button>
      </div>
    </div>
  );
}
