import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS } from "@/lib/brand";
import { getHostAnalytics } from "@/lib/host-analytics";
import { isAdmin } from "@/lib/admin";
import { seedDemoGroup } from "./actions";

const STATUS_STYLE: Record<string, string> = {
  setup: "border-cyan/30 bg-cyan/10 text-cyan",
  ready: "border-green/30 bg-green/10 text-green",
  live: "border-magenta/30 bg-magenta/10 text-magenta-soft",
  done: "border-white/20 bg-white/5 text-cream/50",
};
const STATUS_LABEL: Record<string, string> = {
  setup: "open",
  ready: "locked",
  live: "live",
  done: "closed",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="card p-4 text-center">
      <div className="font-display text-3xl font-black text-cream tabular-nums">{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const a = await getHostAnalytics(supabase, user.id);
  const canAdmin = isAdmin(user.email);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-black">Host analytics</h1>
          <p className="mt-1 max-w-xl text-sm text-cream/60">
            Every group, game and result you&apos;ve run — the output that turns a party game into real
            insight on your people and what lands. Open any group to drill into questions and answers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAdmin && (
            <Link href="/admin" className="btn btn-ghost whitespace-nowrap">
              🛡️ Admin
            </Link>
          )}
          <Link href="/me" className="btn btn-ghost whitespace-nowrap">
            🏠 Your home
          </Link>
          <form action={seedDemoGroup}>
            <button type="submit" className="btn btn-ghost whitespace-nowrap">
              🎲 Demo group
            </button>
          </form>
          <Link href="/dashboard/new" className="btn btn-primary whitespace-nowrap">
            + New group
          </Link>
        </div>
      </div>

      {a.totals.groups === 0 ? (
        <div className="card mt-8 flex flex-col items-center px-6 py-16 text-center">
          <div className="text-5xl">🎤</div>
          <h2 className="mt-4 font-display text-2xl font-bold">No groups yet</h2>
          <p className="mt-2 max-w-sm text-sm text-cream/60">
            Spin up your first group — add everyone&apos;s names, pick a vibe, and we&apos;ll generate a
            private portal your crew fills out. Your analytics build up from there.
          </p>
          <Link href="/dashboard/new" className="btn btn-primary mt-6">
            Create your first group →
          </Link>
          <form action={seedDemoGroup} className="mt-3">
            <button type="submit" className="btn btn-ghost">
              or spin up a demo group 🎲
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* headline numbers */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={a.totals.groups} label="Groups" />
            <Stat value={a.totals.gamesPlayed} label="Games played" />
            <Stat value={a.totals.peopleSlots} label="Player spots" />
            <Stat value={a.totals.accounts} label="Signed-in players" />
          </div>

          {/* breakdowns */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <section className="card p-5">
              <h2 className="font-display text-sm font-bold">Group types</h2>
              <div className="mt-3 space-y-1.5">
                {a.byCategory.map((c) => (
                  <div key={c.label} className="flex items-center gap-2 text-sm">
                    <span className="w-28 shrink-0 truncate text-cream/70">
                      {CATEGORY_LABELS[c.label as keyof typeof CATEGORY_LABELS] ?? c.label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan"
                        style={{ width: `${(c.count / a.totals.groups) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right text-xs text-cream/50">{c.count}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="card p-5">
              <h2 className="font-display text-sm font-bold">Feud themes</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.byTheme.map((t) => (
                  <span key={t.label} className="chip cursor-default text-xs">
                    {t.label} · {t.count}
                  </span>
                ))}
              </div>
            </section>
          </div>

          {/* per-group output */}
          <div className="mt-8 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Your groups</h2>
            <span className="text-sm text-cream/50">{a.groups.length} total</span>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {a.groups.map((g) => (
              <div key={g.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-xl font-bold">{g.name}</h3>
                  <span className={`chip cursor-default border text-xs ${STATUS_STYLE[g.status] ?? STATUS_STYLE.setup}`}>
                    {STATUS_LABEL[g.status] ?? g.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-cream/55">
                  {CATEGORY_LABELS[g.category as keyof typeof CATEGORY_LABELS] ?? g.category} · 🎭 {g.theme}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-cream/60">
                  <span>👥 {g.people} players</span>
                  <span>🏳️ {g.teams} teams</span>
                  <span>🎮 {g.gamesPlayed} played</span>
                  <span>📅 {fmtDate(g.createdAt)}</span>
                </div>
                <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
                  {g.lastGame ? (
                    g.lastGame.tie ? (
                      <span className="text-cream/70">🤝 Last game: a tie</span>
                    ) : (
                      <span className="text-cream/80">
                        🏆 <span className="font-semibold text-cream">{g.lastGame.winner}</span> won
                        {g.lastGame.scores[0] ? ` (${g.lastGame.scores[0].points})` : ""}
                      </span>
                    )
                  ) : (
                    <span className="text-cream/40">Not played yet</span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between pt-1">
                  <Link href={`/dashboard/g/${g.id}`} className="text-sm text-cyan hover:underline">
                    Open →
                  </Link>
                  {g.lastRecapGameId && (
                    <Link href={`/recap/${g.lastRecapGameId}`} className="text-xs text-cream/50 hover:text-cream">
                      🎬 Recap
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
