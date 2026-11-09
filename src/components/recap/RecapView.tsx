"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/Wordmark";
import type { Recap, RecapAvatar, HostAnalytics, AnalyticsQuestion, AnalyticsPerson } from "@/lib/recap";

const TEAM_BG = ["bg-magenta", "bg-cyan", "bg-gold", "bg-green"];
type View = "overview" | "superlatives" | "players" | "tallies" | "questions" | "people";

function typeLabel(t: string): string {
  return (
    (
      {
        pick_person: "who's most likely",
        likelihood: "likelihood",
        multiple_choice: "multiple choice",
        open_text: "open answer",
        guess_who: "whose answer",
        guess_what: "guess the answer",
      } as Record<string, string>
    )[t] ?? t
  );
}

function Avatar({ a, size = 44 }: { a: RecapAvatar; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-black text-ink"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${a.from}, ${a.to})`,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {a.initials}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4 text-center">
      <div className="font-display text-3xl font-black text-cream">{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}

export function RecapView({
  recap,
  analytics,
  groupHref,
}: {
  recap: Recap;
  analytics?: HostAnalytics | null;
  groupHref?: string | null;
}) {
  const [view, setView] = useState<View>("overview");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  const show = (v: View) => view === "overview" || view === v;
  const maxVotes = Math.max(1, ...recap.votesBoard.map((v) => v.votes));
  const focusedEmpty =
    (view === "superlatives" && recap.superlatives.length === 0) ||
    (view === "players" && recap.players.length === 0) ||
    (view === "tallies" && recap.votesBoard.length === 0);

  const tabs: [View, string][] = [
    ["overview", "Overview"],
    ["superlatives", "Superlatives"],
    ["players", "Player cards"],
    ["tallies", "Tallies"],
    ...((analytics
      ? [
          ["questions", "🔒 Questions"],
          ["people", "🔒 People"],
        ]
      : []) as [View, string][]),
  ];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      {/* nav: back to the Tallyho home, and (host) back to this game's home */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <a href="/" aria-label="Tallyho home">
          <Wordmark size="sm" />
        </a>
        {groupHref && (
          <a href={groupHref} className="text-sm text-cream/50 hover:text-cream">
            ⌂ Game home
          </a>
        )}
      </div>

      {/* header */}
      <div className="text-center">
        <div className="label">Tallyho · Game recap</div>
        <h1 className="mt-1 font-display text-4xl font-black sm:text-5xl">{recap.groupName}</h1>
        {recap.winner && (
          <p className="mt-2 text-lg">
            {recap.winner.tie ? (
              <span className="text-cream/80">It ended in a tie!</span>
            ) : (
              <>
                🏆 <span className="text-shimmer-gold font-display font-black">{recap.winner.name}</span>{" "}
                took the crown with {recap.winner.points}
              </>
            )}
          </p>
        )}
      </div>

      {/* share */}
      <div className="mt-5 flex flex-col items-center justify-center gap-1.5">
        <button onClick={copy} className="btn btn-primary text-sm">
          {copied ? "✓ Link copied" : "🔗 Copy recap link"}
        </button>
        <span className="text-xs text-cream/45">Anyone with the link can view — drop it in the group chat.</span>
      </div>

      {/* view switcher */}
      <div className="mt-6 flex flex-wrap justify-center gap-1.5">
        {tabs.map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              view === v
                ? "border-magenta bg-magenta/20 text-cream"
                : "border-white/15 bg-white/5 text-cream/70 hover:border-cyan hover:text-cream",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {focusedEmpty && (
        <p className="mt-8 text-center text-sm text-cream/50">Nothing to show for this view.</p>
      )}

      {/* group vibe */}
      {show("overview") && (
        <section className="card mt-6 p-6 text-center">
          <div className="text-3xl">✨</div>
          <p className="mx-auto mt-2 max-w-2xl font-display text-xl font-bold leading-snug">
            {recap.themes}
          </p>
        </section>
      )}

      {/* totals */}
      {view === "overview" && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Turns played" value={recap.totals.questionsPlayed} />
          <Stat label="Right answers" value={recap.totals.rightAnswers} />
          <Stat label="Points scored" value={recap.totals.totalPoints} />
        </div>
      )}

      {/* superlatives */}
      {show("superlatives") && recap.superlatives.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-black">🏅 Superlatives</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {recap.superlatives.map((s) => (
              <div key={s.key} className="card flex items-center gap-3 p-4">
                <div className="text-3xl">{s.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-xs uppercase tracking-wide text-cream/50">
                    {s.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar a={s.avatar} size={26} />
                    <span className="truncate font-display text-lg font-black">{s.memberName}</span>
                  </div>
                  <div className="text-xs text-cream/55">{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* player cards */}
      {show("players") && recap.players.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-black">🎭 Player cards</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {recap.players.map((p) => (
              <div key={p.memberId} className="card p-4">
                <div className="flex items-center gap-3">
                  <Avatar a={p.avatar} size={48} />
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg font-black">{p.name}</div>
                    <div className="truncate text-xs text-cyan">
                      {p.title}
                      {p.teamName ? ` · ${p.teamName}` : ""}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-sm text-cream/80">{p.persona}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.votesReceived > 0 && (
                    <span className="chip cursor-default text-xs">📣 named {p.votesReceived}×</span>
                  )}
                  {p.correct > 0 && <span className="chip cursor-default text-xs">🎯 {p.correct} right</span>}
                  {p.points > 0 && <span className="chip cursor-default text-xs">💎 {p.points} pts</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* tallies */}
      {show("tallies") && recap.votesBoard.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-black">📣 Who got named most</h2>
          <p className="text-sm text-cream/55">
            Total tallies across every &ldquo;who&apos;s most likely&rdquo; question.
          </p>
          <div className="mt-3 space-y-2">
            {recap.votesBoard.map((v, i) => (
              <div key={v.name} className="card flex items-center gap-3 p-3">
                <span className="w-5 text-center font-display font-black text-cream/40">{i + 1}</span>
                <Avatar a={v.avatar} size={32} />
                <span className="flex-1 truncate font-semibold">{v.name}</span>
                <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-white/10 sm:block">
                  <div
                    className="h-full rounded-full bg-magenta"
                    style={{ width: `${(v.votes / maxVotes) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right font-display text-lg font-black text-gold">{v.votes}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* standings */}
      {view === "overview" && recap.teams.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-black">🏁 Final standings</h2>
          <div className="mx-auto mt-3 max-w-md space-y-2">
            {recap.teams.map((t, i) => (
              <div
                key={t.teamId}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-4 py-3",
                  i === 0 && !recap.winner?.tie
                    ? "border-gold bg-gold/10"
                    : "border-white/10 bg-white/5",
                )}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <span className={cn("h-2.5 w-2.5 rounded-full", TEAM_BG[t.index % TEAM_BG.length])} />
                  {i === 0 && !recap.winner?.tie ? "👑 " : `${i + 1}. `}
                  {t.name}
                </span>
                <span className="font-display text-2xl font-black">{t.points}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* host-only: every question + who answered what */}
      {view === "questions" && analytics && <QuestionsPanel analytics={analytics} />}

      {/* host-only: per-person answer sheet + who named them */}
      {view === "people" && analytics && <PeoplePanel analytics={analytics} />}

      <div className="mt-10 text-center text-xs text-cream/40">
        Made with <span className="font-display font-bold text-cream/70">Tallyho</span>
        {recap.aiUsed ? " · personas written by AI" : ""}
      </div>
    </main>
  );
}

function HostBanner() {
  return (
    <div className="mb-4 rounded-xl border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gold">
      🔒 Host-only — raw responses and votes. These are <span className="font-semibold">not</span> on the public
      recap link; only you (the group owner) see this.
    </div>
  );
}

function QuestionsPanel({ analytics }: { analytics: HostAnalytics }) {
  const [filter, setFilter] = useState("");
  const f = filter.trim().toLowerCase();
  const qs = f ? analytics.questions.filter((q) => q.prompt.toLowerCase().includes(f)) : analytics.questions;
  return (
    <section className="mt-6">
      <HostBanner />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-black">📋 Every question &amp; answer</h2>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter questions…"
          className="input w-full max-w-[12rem] text-sm"
        />
      </div>
      <p className="mt-1 text-sm text-cream/55">
        {analytics.questions.length} questions · {analytics.totalResponses} responses. Tap any question to see
        exactly who answered what.
      </p>
      <div className="mt-3 space-y-2">
        {qs.map((q) => (
          <QuestionRow key={q.id} q={q} />
        ))}
        {qs.length === 0 && <p className="text-sm text-cream/50">No questions match &ldquo;{filter}&rdquo;.</p>}
      </div>
    </section>
  );
}

function QuestionRow({ q }: { q: AnalyticsQuestion }) {
  const maxCount = Math.max(1, ...q.buckets.map((b) => b.count));
  const showTally = q.buckets.length > 1 && q.type !== "open_text";
  return (
    <details className="card p-0 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4">
        <span className="min-w-0">
          <span className="chip mr-2 inline-block cursor-pointer text-[0.6rem] uppercase tracking-wide">
            {typeLabel(q.type)}
          </span>
          <span className="font-semibold">{q.prompt}</span>
        </span>
        <span className="chip shrink-0 cursor-pointer whitespace-nowrap text-xs">👁 {q.responseCount}</span>
      </summary>
      <div className="border-t border-white/8 p-4 pt-3">
        {showTally && (
          <div className="mb-3 space-y-1.5">
            {q.buckets.slice(0, 8).map((b) => (
              <div key={b.label} className="flex items-center gap-2 text-sm">
                <span className="w-28 shrink-0 truncate text-cream/70">{b.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-cyan" style={{ width: `${(b.count / maxCount) * 100}%` }} />
                </div>
                <span className="w-6 text-right font-display font-black text-cream/70">{b.count}</span>
              </div>
            ))}
          </div>
        )}
        <ul className="space-y-1.5 text-sm">
          {q.responses.map((r, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <span className="shrink-0 text-cream/55">
                {r.name}
                {r.teamName ? <span className="text-cream/35"> · {r.teamName}</span> : ""}
              </span>
              <span className="min-w-0 text-right font-medium">
                {r.answer || <span className="text-cream/30">—</span>}
                {r.matched && r.matched.toLowerCase() !== r.answer.trim().toLowerCase() && (
                  <span className="text-cream/40"> → {r.matched}</span>
                )}
              </span>
            </li>
          ))}
          {q.responses.length === 0 && <li className="text-cream/40">No one answered this.</li>}
        </ul>
        {q.results.length > 0 && (
          <div className="mt-3 border-t border-white/8 pt-2">
            <div className="label mb-1">Played live</div>
            {q.results.map((res, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-cream/55">
                  {res.correct ? "✅" : "❌"} {res.teamName}
                  {res.memberName ? ` · ${res.memberName}` : ""}
                </span>
                <span className="shrink-0">
                  &ldquo;{res.guess || "—"}&rdquo; <span className="font-display font-black text-gold">+{res.points}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function PeoplePanel({ analytics }: { analytics: HostAnalytics }) {
  const people = analytics.people;
  const [selId, setSelId] = useState(people[0]?.memberId ?? "");
  const sel = people.find((p) => p.memberId === selId) ?? people[0];
  return (
    <section className="mt-6">
      <HostBanner />
      <h2 className="font-display text-xl font-black">🧑 By person</h2>
      <p className="mt-1 text-sm text-cream/55">
        Pick anyone to see their full answer sheet, who named them, and how they played.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {people.map((p) => (
          <button
            key={p.memberId}
            onClick={() => setSelId(p.memberId)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              p.memberId === selId
                ? "border-magenta bg-magenta/20 text-cream"
                : "border-white/15 bg-white/5 text-cream/70 hover:border-cyan hover:text-cream",
            )}
          >
            {p.name}
          </button>
        ))}
      </div>
      {sel && <PersonDetail p={sel} />}
    </section>
  );
}

function PersonDetail({ p }: { p: AnalyticsPerson }) {
  return (
    <div className="mt-4 space-y-4">
      <div className="card flex items-center gap-3 p-4">
        <Avatar a={p.avatar} size={44} />
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-black">{p.name}</div>
          <div className="truncate text-xs text-cyan">
            {p.teamName ?? "No team"}
            {p.isPlaying ? "" : " · answer-only"}
          </div>
        </div>
        <div className="ml-auto shrink-0 text-right">
          <div className="font-display text-2xl font-black text-gold">{p.votesReceived}</div>
          <div className="label">votes received</div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-display font-bold">Their answers ({p.answers.length})</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {p.answers.map((a, i) => (
            <li key={i} className="border-t border-white/8 pt-2 first:border-0 first:pt-0">
              <div className="text-xs text-cream/50">
                <span className="mr-1 uppercase tracking-wide text-cream/35">[{typeLabel(a.type)}]</span>
                {a.prompt}
              </div>
              <div className="font-medium">{a.answer || <span className="text-cream/30">—</span>}</div>
            </li>
          ))}
          {p.answers.length === 0 && <li className="text-cream/40">Didn&apos;t answer any questions.</li>}
        </ul>
      </div>

      {p.namedBy.length > 0 && (
        <div className="card p-4">
          <h3 className="font-display font-bold">Named by ({p.namedBy.length})</h3>
          <p className="mb-2 text-xs text-cream/50">Who put {p.name} as their answer on a &ldquo;most likely&rdquo; question.</p>
          <ul className="space-y-1 text-sm">
            {p.namedBy.map((n, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span className="shrink-0 font-medium">{n.voter}</span>
                <span className="min-w-0 text-right text-xs text-cream/55">{n.question}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.liveTurns.length > 0 && (
        <div className="card p-4">
          <h3 className="font-display font-bold">Turns they played ({p.liveTurns.length})</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {p.liveTurns.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-cream/60">
                  {t.correct ? "✅" : "❌"} {t.prompt}
                </span>
                <span className="shrink-0">
                  &ldquo;{t.guess || "—"}&rdquo; <span className="font-display font-black text-gold">+{t.points}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
