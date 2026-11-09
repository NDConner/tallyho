"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Wordmark } from "@/components/Wordmark";
import { MemberAuth } from "@/components/join/MemberAuth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface MemberLite {
  id: string;
  name: string;
  isCaptain: boolean;
  claimed: boolean;
}
interface Question {
  id: string;
  prompt: string;
  type: string;
  options: string[] | null;
  answer: string | null;
}
interface Teammate {
  id: string;
  name: string;
  isCaptain: boolean;
  status: "done" | "progress" | "notstarted";
}
interface ActiveCategory {
  name: string;
  custom: boolean;
  topics: string[];
}
interface Captain {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  emoji: string | null;
  selected: { name: string; category: string }[];
  categories: ActiveCategory[];
  triviaPicker: string; // "captains" | "host"
  teammates: Teammate[];
}
interface Tasks {
  groupName: string;
  locked: boolean;
  isOwner: boolean;
  gameDate: string | null;
  answerDeadline: string | null;
  feudSubject: { mode: string; theme: string | null; pool: string[] } | null;
  member: { id: string; name: string; isCaptain: boolean; teamId: string | null };
  roster: { id: string; name: string }[];
  questions: Question[];
  answeredCount: number;
  total: number;
  holdoutAssigned: boolean;
  captain: Captain | null;
}

type Phase = "code" | "identify" | "tasks";
const FREE_TEXT = ["open_text", "guess_who", "guess_what"];

function typeHint(type: string): string | null {
  if (type === "guess_who") return "🙈 Your own answer — at game night the crew guesses who said it.";
  if (type === "guess_what") return "🤫 Just you answer this. Your crew will try to guess what you said.";
  return null;
}

function prettyDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function JoinFlow({ initialCode }: { initialCode?: string }) {
  const [phase, setPhase] = useState<Phase>("code");
  const [code, setCode] = useState((initialCode ?? "").toUpperCase());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [group, setGroup] = useState<{ groupName: string; requireLogin: boolean; members: MemberLite[] } | null>(
    null,
  );
  const [tasks, setTasks] = useState<Tasks | null>(null);
  const [identifyFilter, setIdentifyFilter] = useState("");
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const didAuto = useRef(false);

  useEffect(() => {
    if (initialCode && !didAuto.current) {
      didAuto.current = true;
      void lookup(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the member's own auth session (for claiming + "signed in as").
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => setAuthEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setAuthEmail(session?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    setAuthEmail(null);
  }

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
      setGroup({ groupName: data.groupName, requireLogin: Boolean(data.requireLogin), members: data.members });
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
      // Signed in? Claim this slot (links it to the account) before loading it.
      if (authEmail) {
        const claimRes = await fetch("/api/join/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, memberId }),
        });
        const claimData = await claimRes.json().catch(() => ({ ok: false }));
        if (!claimData.ok) {
          setError(claimData.error ?? "Couldn't claim that name.");
          return;
        }
      }
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
    if (code) void lookup(code); // refresh claim badges
  }

  // Compact header on the tasks view (saves phone real estate); full on entry.
  const compact = phase === "tasks";

  return (
    <main className={"flex flex-1 justify-center px-4 " + (compact ? "items-start py-4" : "items-center py-10")}>
      <div className="w-full max-w-md">
        <div className={"flex justify-center " + (compact ? "mb-3" : "mb-6")}>
          <Wordmark size={compact ? "xs" : "sm"} />
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
            <button onClick={() => lookup(code)} disabled={busy || code.length < 4} className="btn btn-primary mt-5 w-full">
              {busy ? "Looking…" : "Find my group →"}
            </button>
          </div>
        )}

        {phase === "identify" && group && (
          <div className="space-y-4">
            {authEmail && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-green/30 bg-green/5 px-3 py-2 text-xs">
                <span className="min-w-0 truncate text-green">✓ Signed in as {authEmail}</span>
                <div className="flex shrink-0 items-center gap-3">
                  <a href="/me" className="text-cyan underline hover:text-cream">
                    Your games
                  </a>
                  <button onClick={signOut} className="text-cream/50 underline hover:text-cream">
                    Sign out
                  </button>
                </div>
              </div>
            )}

            {!authEmail && (
              <MemberAuth
                code={code}
                onAuthed={(email) => {
                  setAuthEmail(email);
                  void lookup(code);
                }}
              />
            )}

            {(authEmail || !group.requireLogin) && (
              <div className="card p-6">
                <p className="text-center text-sm text-cream/60">You&apos;re joining</p>
                <h1 className="text-center font-display text-2xl font-bold">{group.groupName}</h1>
                <p className="mt-5 mb-2 text-center label">
                  {authEmail ? "Pick your name to claim it" : "Who are you?"}
                </p>
                {group.members.length > 8 && (
                  <input
                    value={identifyFilter}
                    onChange={(e) => setIdentifyFilter(e.target.value)}
                    placeholder="Type your name to find yourself…"
                    className="input mb-2 text-sm"
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  {group.members
                    .filter((m) => m.name.toLowerCase().includes(identifyFilter.trim().toLowerCase()))
                    .map((m) => {
                      const locked = m.claimed && !authEmail; // claimed name needs its owner signed in
                      return (
                        <button
                          key={m.id}
                          onClick={() => pickMe(m.id)}
                          disabled={busy || locked}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold transition hover:border-magenta hover:bg-magenta/10 hover:text-cream disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-white/5"
                        >
                          {m.name}
                          {m.isCaptain && <span className="ml-1">🎖️</span>}
                          {m.claimed && (
                            <span className="mt-0.5 block text-[0.6rem] font-normal text-cream/40">
                              {authEmail ? "🔒 claimed" : "🔒 sign in as them"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
                {!authEmail && !group.requireLogin && (
                  <p className="mt-3 text-center text-xs text-cream/45">
                    Signing in isn&apos;t required yet — but it keeps your answers private to you and saves your
                    history.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {phase === "tasks" && tasks && <TaskRouter code={code} tasks={tasks} onSwitchUser={switchUser} />}

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

/** Captains land on their hub first; everyone else goes straight to questions. */
function TaskRouter({ code, tasks, onSwitchUser }: { code: string; tasks: Tasks; onSwitchUser: () => void }) {
  const [view, setView] = useState<"hub" | "questions" | "done">(tasks.captain ? "hub" : "questions");

  // Answers live HERE, not inside QuestionFlow, so they survive the
  // unmount/remount when the member jumps to the hub/done card and back to
  // "Review answers". Seeded once from whatever was already saved on the server.
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of tasks.questions) if (q.answer != null && q.answer.trim()) init[q.id] = q.answer;
    return init;
  });
  const answeredCount = tasks.questions.reduce((n, q) => n + (answers[q.id]?.trim() ? 1 : 0), 0);

  // Once locked, nobody can change anything. A member on the legacy code+name
  // flow (not a verified owner) also can't open the review — picking a name is no
  // proof of identity, so it would let them read someone else's answers. A signed-
  // in owner, though, is provably themselves, so they get a read-only review.
  if (tasks.locked && !tasks.isOwner) return <LockedScreen tasks={tasks} onSwitchUser={onSwitchUser} />;

  if (view === "questions") {
    return (
      <QuestionFlow
        code={code}
        tasks={tasks}
        answers={answers}
        setAnswers={setAnswers}
        answeredCount={answeredCount}
        onSwitchUser={onSwitchUser}
        onBack={tasks.captain ? () => setView("hub") : undefined}
        onDone={() => setView(tasks.captain ? "hub" : "done")}
      />
    );
  }

  if (view === "hub" && tasks.captain) {
    return (
      <CaptainHub
        code={code}
        tasks={tasks}
        answeredCount={answeredCount}
        onAnswer={() => setView("questions")}
        onSwitchUser={onSwitchUser}
      />
    );
  }

  // Non-captain finished.
  return <DoneCard tasks={tasks} answeredCount={answeredCount} onReview={() => setView("questions")} onSwitchUser={onSwitchUser} />;
}

/** Shown to every member once the host locks: a confirmation with no answers and
 *  no way into the review — so no one can snoop by picking another person's name. */
function LockedScreen({ tasks, onSwitchUser }: { tasks: Tasks; onSwitchUser: () => void }) {
  const gd = prettyDate(tasks.gameDate);
  return (
    <div className="card p-7 text-center">
      <div className="animate-pop text-6xl">🔒</div>
      <h1 className="mt-3 font-display text-2xl font-bold">You&apos;re locked in, {tasks.member.name}!</h1>
      <p className="mt-2 text-sm text-cream/60">
        Your host has locked everything in for game night. No more changes — and everyone&apos;s answers
        stay hidden until you play them live.
      </p>
      {tasks.total > 0 && (
        <p className="mt-2 text-sm text-cream/70">
          You finished {tasks.answeredCount} of {tasks.total}. 🎉
        </p>
      )}
      {gd && <p className="mt-2 text-xs text-gold">🗓️ See you {gd}.</p>}
      <button onClick={onSwitchUser} className="btn btn-ghost mt-5 text-sm">
        I&apos;m someone else
      </button>
    </div>
  );
}

function DoneCard({
  tasks,
  answeredCount,
  onReview,
  onSwitchUser,
}: {
  tasks: Tasks;
  answeredCount: number;
  onReview: () => void;
  onSwitchUser: () => void;
}) {
  const done = tasks.total === 0 || answeredCount >= tasks.total;
  const dl = prettyDate(tasks.answerDeadline);
  return (
    <div className="card p-7 text-center">
      <div className="animate-pop text-6xl">{done ? "🎉" : "👍"}</div>
      <h1 className="mt-3 font-display text-2xl font-bold">
        {done ? `All set, ${tasks.member.name}!` : `Thanks, ${tasks.member.name}!`}
      </h1>
      <p className="mt-2 text-sm text-cream/60">
        {tasks.total > 0 ? `You answered ${answeredCount} of ${tasks.total}.` : "You're all squared away."}{" "}
        Your host takes it from here.
      </p>
      {dl && !done && <p className="mt-2 text-xs text-gold">⏰ Try to finish by {dl}.</p>}
      <div className="mt-5 flex justify-center gap-2">
        {tasks.total > 0 && (
          <button onClick={onReview} className="btn btn-ghost text-sm">
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

// ─── Captain hub ─────────────────────────────────────────────────────────────

function CaptainHub({
  code,
  tasks,
  answeredCount,
  onAnswer,
  onSwitchUser,
}: {
  code: string;
  tasks: Tasks;
  answeredCount: number;
  onAnswer: () => void;
  onSwitchUser: () => void;
}) {
  const cap = tasks.captain!;
  const locked = tasks.locked;
  const [teamName, setTeamName] = useState(cap.teamName);
  const [logoUrl, setLogoUrl] = useState<string | null>(cap.logoUrl);
  const [selected, setSelected] = useState<{ name: string; category: string }[]>(cap.selected);
  const myDone = tasks.total === 0 || answeredCount >= tasks.total;
  const dl = prettyDate(tasks.answerDeadline);
  const gd = prettyDate(tasks.gameDate);

  const teamDone = cap.teammates.filter((t) => t.status === "done").length;

  return (
    <div className="card p-5">
      <div className="text-center">
        <div className="text-3xl">🎖️</div>
        <h1 className="mt-1 font-display text-xl font-bold">Captain {tasks.member.name}</h1>
        <p className="text-sm text-cream/60">Get your team ready for {tasks.groupName}.</p>
        {(gd || dl) && (
          <p className="mt-1 text-xs text-cream/45">
            {gd && <>🗓️ {gd}</>}
            {gd && dl && " · "}
            {dl && <>⏰ answers due {dl}</>}
          </p>
        )}
      </div>

      {locked && (
        <p className="mt-4 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-center text-xs text-gold">
          🔒 Your host has locked things in for game night. You can review everything below, but team
          details, topics, and answers can&apos;t be changed now.
        </p>
      )}

      {/* 1) Team name + logo */}
      <div className="mt-4 rounded-xl border border-white/10 bg-ink/40 p-3">
        <div className="label mb-2">1 · Your team</div>
        <div className="flex items-center gap-3">
          <TeamLogo code={code} memberId={tasks.member.id} teamId={cap.teamId} logoUrl={logoUrl} onChange={setLogoUrl} locked={locked} />
          <div className="min-w-0 flex-1">
            <TeamNameEditor code={code} memberId={tasks.member.id} teamId={cap.teamId} name={teamName} onRenamed={setTeamName} locked={locked} />
          </div>
        </div>
      </div>

      {/* 2) Topics (hidden when the host picks topics for everyone) */}
      <div className="mt-3 rounded-xl border border-white/10 bg-ink/40 p-3">
        <div className="label mb-2">2 · Trivia topics</div>
        {cap.triviaPicker === "host" ? (
          <p className="text-sm text-cream/55">
            🎛️ Your host is choosing the trivia topics for every team — nothing to pick here.
          </p>
        ) : (
          <CaptainTopics
            code={code}
            memberId={tasks.member.id}
            teamId={cap.teamId}
            categories={cap.categories}
            selected={selected}
            onSaved={setSelected}
            locked={locked}
          />
        )}
      </div>

      {/* 3) Team fill-out status */}
      <div className="mt-3 rounded-xl border border-white/10 bg-ink/40 p-3">
        <div className="flex items-center justify-between">
          <div className="label">3 · Your crew</div>
          <span className="text-xs text-cream/50">{teamDone}/{cap.teammates.length} done</span>
        </div>
        <ul className="mt-2 space-y-1">
          {cap.teammates.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">
                {t.name}
                {t.isCaptain && <span className="ml-1 text-xs">🎖️</span>}
              </span>
              <span
                className={
                  "chip cursor-default text-xs " +
                  (t.status === "done"
                    ? "border-green/40 text-green"
                    : t.status === "progress"
                      ? "border-gold/40 text-gold"
                      : "border-white/15 text-cream/45")
                }
              >
                {t.status === "done" ? "✓ done" : t.status === "progress" ? "in progress" : "not started"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-cream/45">Nudge anyone who hasn&apos;t finished before game night.</p>
      </div>

      {/* 4) Answer your own */}
      <div className="mt-4">
        <button onClick={onAnswer} className="btn btn-primary w-full">
          {locked
            ? "👀 Review my answers"
            : myDone
              ? "✓ Review my questions"
              : `4 · Answer my questions (${answeredCount}/${tasks.total}) →`}
        </button>
        <button onClick={onSwitchUser} className="mt-2 w-full text-center text-xs text-cream/45 hover:text-cream">
          I&apos;m someone else
        </button>
      </div>
    </div>
  );
}

function TeamLogo({
  code,
  memberId,
  teamId,
  logoUrl,
  onChange,
  locked,
}: {
  code: string;
  memberId: string;
  teamId: string;
  logoUrl: string | null;
  onChange: (u: string | null) => void;
  locked?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setErr(null);
    if (file.size > 4 * 1024 * 1024) {
      setErr("Max 4 MB.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("code", code);
      fd.set("memberId", memberId);
      fd.set("teamId", teamId);
      fd.set("file", file);
      const res = await fetch("/api/join/team-logo", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) onChange(data.logoUrl);
      else setErr("Upload failed.");
    } catch {
      setErr("Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("code", code);
      fd.set("memberId", memberId);
      fd.set("teamId", teamId);
      fd.set("remove", "1");
      await fetch("/api/join/team-logo", { method: "POST", body: fd });
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || locked}
        className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-dashed border-white/25 bg-white/5 text-xl hover:border-cyan disabled:hover:border-white/25"
        title={locked ? "Locked by your host" : "Upload a team logo or photo"}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Team logo" className="h-full w-full object-cover" />
        ) : busy ? (
          "…"
        ) : (
          "＋"
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      <div className="mt-1 text-[0.65rem] text-cream/45">
        {logoUrl ? (
          locked ? (
            "Team logo"
          ) : (
            <button onClick={remove} disabled={busy} className="hover:text-magenta">
              Remove
            </button>
          )
        ) : (
          "Logo (optional)"
        )}
      </div>
      {err && <div className="text-[0.65rem] text-magenta-soft">{err}</div>}
    </div>
  );
}

function CaptainTopics({
  code,
  memberId,
  teamId,
  categories,
  selected,
  onSaved,
  locked,
}: {
  code: string;
  memberId: string;
  teamId: string;
  categories: ActiveCategory[];
  selected: { name: string; category: string }[];
  onSaved: (s: { name: string; category: string }[]) => void;
  locked?: boolean;
}) {
  const [picks, setPicks] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of selected) init[s.category] = s.name;
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const chosen = categories.filter((c) => picks[c.name]).length;

  function set(cat: string, name: string) {
    setPicks((p) => ({ ...p, [cat]: name }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    try {
      const topics = Object.entries(picks)
        .filter(([, name]) => name && name.trim())
        .map(([category, name]) => ({ category, name: name.trim() }));
      const res = await fetch("/api/join/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, memberId, teamId, topics }),
      });
      const data = await res.json();
      if (data.ok) {
        onSaved(data.selected ?? []);
        setSaved(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-xs text-cream/55">
        Pick or type one topic per category ({chosen}/{categories.length}).
      </p>
      <div className="mt-2 space-y-3">
        {categories.map((cat) => (
          <div key={cat.name}>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-cream/80">
              {cat.name}
              {picks[cat.name] && <span className="text-green">✓</span>}
            </div>
            {cat.topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {cat.topics.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set(cat.name, t)}
                    disabled={locked}
                    className={
                      "rounded-full border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-60 " +
                      (picks[cat.name] === t
                        ? "border-magenta bg-magenta/25 text-cream"
                        : "border-white/15 bg-white/5 text-cream/70 hover:border-cyan hover:text-cream")
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            <input
              value={picks[cat.name] && !cat.topics.includes(picks[cat.name]) ? picks[cat.name] : ""}
              onChange={(e) => set(cat.name, e.target.value)}
              disabled={locked}
              placeholder={cat.topics.length ? "…or type your own" : "Type a topic (e.g. our 2024 retreat)"}
              maxLength={60}
              className="input mt-1.5 text-sm"
            />
          </div>
        ))}
      </div>
      <button onClick={save} disabled={busy || saved || locked} className="btn btn-primary mt-3 w-full text-sm">
        {locked ? "🔒 Locked" : busy ? "Saving…" : saved ? "Topics saved ✓" : "Save topics"}
      </button>
    </div>
  );
}

/** A captain renames their own team from their phone. */
function TeamNameEditor({
  code,
  memberId,
  teamId,
  name,
  onRenamed,
  locked,
}: {
  code: string;
  memberId: string;
  teamId: string;
  name: string;
  onRenamed: (n: string) => void;
  locked?: boolean;
}) {
  const [val, setVal] = useState(name);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);

  async function save() {
    const next = val.trim();
    if (!next || next === name) {
      setVal(name);
      setSaved(true);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/join/team-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, memberId, teamId, name: next }),
      });
      const data = await res.json();
      if (data.ok) {
        onRenamed(data.name ?? next);
        setSaved(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="label">Team name</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          value={val}
          maxLength={40}
          disabled={locked}
          onChange={(e) => {
            setVal(e.target.value);
            setSaved(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="input text-sm"
        />
        <button onClick={save} disabled={busy || saved || locked} className="btn btn-primary shrink-0 text-xs">
          {locked ? "🔒" : busy ? "…" : saved ? "✓" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Question answering (mobile-first, sticky) ───────────────────────────────

function QuestionFlow({
  code,
  tasks,
  answers,
  setAnswers,
  answeredCount,
  onSwitchUser,
  onBack,
  onDone,
}: {
  code: string;
  tasks: Tasks;
  answers: Record<string, string>;
  setAnswers: Dispatch<SetStateAction<Record<string, string>>>;
  answeredCount: number;
  onSwitchUser: () => void;
  onBack?: () => void;
  onDone: () => void;
}) {
  const total = tasks.questions.length;
  // Open on the first still-unanswered question. If everything is already
  // answered (e.g. the member tapped "Review answers"), start at the top with
  // every saved pick shown. A question with no saved answer starts blank.
  const initialIdx = (() => {
    const f = tasks.questions.findIndex((qq) => !answers[qq.id]?.trim());
    return f === -1 ? 0 : f;
  })();
  const [idx, setIdx] = useState(initialIdx);
  const [text, setText] = useState(answers[tasks.questions[initialIdx]?.id] ?? "");
  const [optFilter, setOptFilter] = useState("");
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  const q = tasks.questions[idx];
  const locked = tasks.locked;

  useEffect(() => {
    setText(answers[q?.id] ?? "");
    setOptFilter("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function toTop() {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // The optimistic update keeps the pick on screen immediately AND in the
  // lifted state, so it survives leaving for the hub/done card and coming back
  // to review. The network write runs in the background with one retry; a hard
  // failure flags the question so an answer is never silently dropped.
  function saveAnswer(qid: string, value: string) {
    if (locked) return; // answers are locked by the host — review only
    const v = value.trim();
    if (!v) return;
    setAnswers((a) => (a[qid] === v ? a : { ...a, [qid]: v }));
    setFailed((f) => (f[qid] ? { ...f, [qid]: false } : f));
    const body = JSON.stringify({ code, memberId: tasks.member.id, questionId: qid, answer: v });
    const once = () =>
      fetch("/api/join/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
      });
    void once()
      .catch(() => once()) // one retry for a transient blip
      .catch(() => setFailed((f) => ({ ...f, [qid]: true })));
  }

  function goPrev() {
    if (idx > 0) {
      setIdx(idx - 1);
      toTop();
    } else if (onBack) {
      onBack();
    }
  }
  function goNext() {
    if (FREE_TEXT.includes(q?.type) && text.trim()) saveAnswer(q.id, text);
    if (idx < total - 1) {
      setIdx(idx + 1);
      toTop();
    } else {
      onDone();
    }
  }

  if (total === 0) {
    onDone();
    return null;
  }

  const selected = answers[q.id];

  // Sticky top nav + question, so they're always visible while scrolling options.
  const Nav = ({ bottom }: { bottom?: boolean }) => (
    <div className={"flex items-center justify-between gap-2 " + (bottom ? "mt-6" : "")}>
      <button onClick={goPrev} disabled={idx === 0 && !onBack} className="btn btn-ghost disabled:opacity-40">
        ← {idx === 0 && onBack ? "Hub" : "Prev"}
      </button>
      <button onClick={goNext} className="btn btn-primary">
        {idx < total - 1 ? "Next →" : onBack ? "Back to hub →" : "Finish →"}
      </button>
    </div>
  );

  return (
    <div className="card overflow-hidden p-0">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-ink/95 px-5 pt-4 pb-3 backdrop-blur">
        <div className="flex items-center justify-between text-xs">
          <button onClick={onSwitchUser} className="text-cream/50 hover:text-cream">
            ← Not {tasks.member.name}?
          </button>
          <span className="text-cream/50">
            {answeredCount}/{total} answered
          </span>
        </div>
        {locked && (
          <p className="mt-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold">
            🔒 Answers are locked by your host — you can review yours, but can&apos;t change them.
          </p>
        )}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-magenta transition-all"
            style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-3 text-xs text-cream/45">Question {idx + 1} of {total}</div>
        <h2 className="mt-1 font-display text-lg font-bold leading-snug">{q.prompt}</h2>
        <div className="mt-3">
          <Nav />
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        {failed[q.id] && (
          <p className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-magenta/10 px-3 py-2 text-xs text-magenta-soft">
            <span>⚠ Couldn&apos;t save that one.</span>
            <button
              onClick={() => saveAnswer(q.id, answers[q.id] ?? text)}
              className="font-semibold underline hover:text-cream"
            >
              Retry
            </button>
          </p>
        )}
        {typeHint(q.type) && (
          <p className="mb-3 rounded-lg bg-cyan/10 px-3 py-2 text-xs text-cyan">{typeHint(q.type)}</p>
        )}

        {q.type === "pick_person" &&
          (() => {
            // Themed games pick from a fixed pool (athletes, Disney, …); otherwise
            // from the group roster. Same button grid + filter either way.
            const themed = tasks.feudSubject?.mode === "theme" ? tasks.feudSubject : null;
            const opts = themed
              ? themed.pool.map((n) => ({ id: n, name: n }))
              : tasks.roster;
            return (
              <div>
                {themed && (
                  <p className="mb-2 text-xs text-cyan">🎭 Answers come from: {themed.theme}</p>
                )}
                {opts.length > 8 && (
                  <input
                    value={optFilter}
                    onChange={(e) => setOptFilter(e.target.value)}
                    placeholder={themed ? "Type to filter…" : "Type a name to filter…"}
                    className="input mb-2 text-sm"
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  {opts
                    .filter((m) => m.name.toLowerCase().includes(optFilter.trim().toLowerCase()))
                    .map((m) => (
                      <OptionButton key={m.id} label={m.name} selected={selected === m.name} onClick={() => saveAnswer(q.id, m.name)} disabled={locked} />
                    ))}
                </div>
              </div>
            );
          })()}

        {(q.type === "multiple_choice" || q.type === "likelihood") && (
          <div className="space-y-2">
            {(q.options ?? []).length > 8 && (
              <input
                value={optFilter}
                onChange={(e) => setOptFilter(e.target.value)}
                placeholder="Type to filter options…"
                className="input text-sm"
              />
            )}
            {(q.options ?? [])
              .filter((o) => o.toLowerCase().includes(optFilter.trim().toLowerCase()))
              .map((o) => (
                <OptionButton key={o} label={o} selected={selected === o} onClick={() => saveAnswer(q.id, o)} wide disabled={locked} />
              ))}
          </div>
        )}

        {q.type === "open_text" && (
          <input
            autoFocus
            disabled={locked}
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
            disabled={locked}
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
            disabled={locked}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text.trim() && saveAnswer(q.id, text)}
            placeholder="Your answer… (just you — keep it a secret!)"
            maxLength={160}
            className="input min-h-[80px] resize-y"
          />
        )}

        <Nav bottom />
      </div>
    </div>
  );
}

function OptionButton({
  label,
  selected,
  onClick,
  wide,
  disabled,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  wide?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "rounded-xl border px-3 py-3 text-sm font-semibold transition " +
        (disabled ? "cursor-default " : "active:scale-[0.98] ") +
        (wide ? "w-full text-left " : "") +
        (selected
          ? "border-magenta bg-magenta/25 text-cream ring-1 ring-magenta"
          : disabled
            ? "border-white/10 bg-white/5 text-cream/40"
            : "border-white/15 bg-white/5 text-cream/80 hover:border-magenta hover:bg-magenta/10 hover:text-cream")
      }
    >
      {selected && <span className="mr-1">✓</span>}
      {label}
    </button>
  );
}
