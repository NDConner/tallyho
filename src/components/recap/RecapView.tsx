"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Recap, RecapAvatar } from "@/lib/recap";

const TEAM_BG = ["bg-magenta", "bg-cyan", "bg-gold", "bg-green"];
type View = "overview" | "superlatives" | "players" | "tallies";

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

export function RecapView({ recap }: { recap: Recap }) {
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
  ];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
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

      <div className="mt-10 text-center text-xs text-cream/40">
        Made with <span className="font-display font-bold text-cream/70">Tallyho</span>
        {recap.aiUsed ? " · personas written by AI" : ""}
      </div>
    </main>
  );
}
