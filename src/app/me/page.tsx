import { redirect } from "next/navigation";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { CATEGORY_LABELS } from "@/lib/brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { markNotificationsRead } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your home — Tallyho" };

const STATUS_LABEL: Record<string, string> = {
  setup: "open",
  ready: "locked",
  live: "live",
  done: "closed",
};
const STATUS_CHIP: Record<string, string> = {
  setup: "border-cyan/30 text-cyan",
  ready: "border-green/30 text-green",
  live: "border-magenta/30 text-magenta-soft",
  done: "border-white/20 text-cream/50",
};

/**
 * A signed-in person's home. Two roles, side by side:
 *   • Games you host — groups you created (→ the host dashboard for each)
 *   • Games you're in — groups where you've claimed a player slot (→ your answers)
 * Plus a clear path to start/host your own. Built with the service role gated by
 * the authenticated user's id (members don't own group rows, so can't read them
 * directly).
 */
export default async function MePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();

  const [{ data: memberRows }, { data: hostedRows }, { data: notifRows }] = await Promise.all([
    admin
      .from("members")
      .select("id, group_id, display_name, is_captain, team_id, claimed_at")
      .eq("user_id", user.id)
      .order("claimed_at", { ascending: false }),
    admin
      .from("groups")
      .select("id, name, category, join_code, status, created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false }),
    // Defensive: returns an error (handled as empty) if notifications isn't migrated yet.
    admin
      .from("notifications")
      .select("id, type, title, body, link, group_id, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  const members = memberRows ?? [];
  const hosted = hostedRows ?? [];
  const notifications = (notifRows ?? []) as {
    id: string;
    title: string;
    body: string | null;
    link: string | null;
    read_at: string | null;
  }[];
  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const groupIds = [...new Set(members.map((m) => m.group_id as string))];

  const [{ data: groups }, { data: teams }, { data: games }, { data: responses }] = await Promise.all([
    groupIds.length
      ? admin.from("groups").select("id, name, category, join_code, status").in("id", groupIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    groupIds.length
      ? admin.from("teams").select("id, name").in("group_id", groupIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    groupIds.length
      ? admin
          .from("games")
          .select("id, group_id, status, created_at")
          .in("group_id", groupIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    members.length
      ? admin.from("feud_responses").select("member_id").in(
          "member_id",
          members.map((m) => m.id as string),
        )
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const groupById = new Map((groups ?? []).map((g) => [g.id as string, g]));
  const teamById = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));
  const answersByMember = new Map<string, number>();
  for (const r of responses ?? [])
    answersByMember.set(r.member_id as string, (answersByMember.get(r.member_id as string) ?? 0) + 1);
  const latestDoneGameByGroup = new Map<string, string>();
  for (const g of games ?? []) {
    if (g.status === "done" && !latestDoneGameByGroup.has(g.group_id as string))
      latestDoneGameByGroup.set(g.group_id as string, g.id as string);
  }

  // Don't list a group twice: if you host a group AND claimed a slot in it, it
  // already shows under "Games you host".
  const hostedIds = new Set(hosted.map((g) => g.id as string));
  const cards = members
    .map((m) => {
      const g = groupById.get(m.group_id as string);
      if (!g) return null;
      if (hostedIds.has(m.group_id as string)) return null;
      return {
        memberId: m.id as string,
        name: m.display_name as string,
        isCaptain: Boolean(m.is_captain),
        teamName: m.team_id ? (teamById.get(m.team_id as string) ?? null) : null,
        groupName: g.name as string,
        joinCode: g.join_code as string,
        status: g.status as string,
        answers: answersByMember.get(m.id as string) ?? 0,
        recapGameId: latestDoneGameByGroup.get(m.group_id as string) ?? null,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/" aria-label="Tallyho home">
          <Wordmark size="sm" />
        </Link>
        <form action="/auth/signout" method="post">
          <button className="text-xs text-cream/50 underline hover:text-cream">Sign out</button>
        </form>
      </div>

      <h1 className="font-display text-3xl font-black">Your home</h1>
      <p className="mt-1 text-sm text-cream/55">Signed in as {user.email}.</p>

      {/* notifications inbox */}
      {notifications.length > 0 && (
        <section className="card mt-6 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold">
              🔔 Notifications
              {unreadCount > 0 && (
                <span className="chip ml-2 cursor-default border-cyan/40 text-xs text-cyan">
                  {unreadCount} new
                </span>
              )}
            </h2>
            {unreadCount > 0 && (
              <form action={markNotificationsRead}>
                <button className="text-xs text-cream/50 underline hover:text-cream">Mark all read</button>
              </form>
            )}
          </div>
          <ul className="mt-3 space-y-2">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={
                  "rounded-xl border px-3 py-2 " +
                  (n.read_at ? "border-white/10 bg-white/5" : "border-cyan/30 bg-cyan/5")
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-cream">
                      {!n.read_at && "🟢 "}
                      {n.title}
                    </div>
                    {n.body && <div className="mt-0.5 text-xs text-cream/60">{n.body}</div>}
                  </div>
                  {n.link && (
                    <Link href={n.link} className="btn btn-ghost shrink-0 text-xs">
                      Open →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* host a game */}
      <section className="card mt-6 flex flex-wrap items-center justify-between gap-4 border-magenta/30 bg-magenta/5 p-5">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold">🎤 Host your own game</h2>
          <p className="mt-1 text-sm text-cream/60">
            Build a group, gather everyone&apos;s answers, then run the live show on the TV.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/dashboard/new" className="btn btn-primary text-sm whitespace-nowrap">
            + New game
          </Link>
          {hosted.length > 0 && (
            <Link href="/dashboard" className="btn btn-ghost text-sm whitespace-nowrap">
              Host dashboard →
            </Link>
          )}
        </div>
      </section>

      {/* games you host */}
      {hosted.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold">Games you host</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {hosted.map((g) => (
              <Link
                key={g.id as string}
                href={`/dashboard/g/${g.id}`}
                className="card group p-4 transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-bold">{g.name as string}</h3>
                  <span
                    className={
                      "chip cursor-default border text-xs " +
                      (STATUS_CHIP[g.status as string] ?? STATUS_CHIP.setup)
                    }
                  >
                    {STATUS_LABEL[g.status as string] ?? (g.status as string)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-cream/55">
                  {CATEGORY_LABELS[g.category as keyof typeof CATEGORY_LABELS] ?? (g.category as string)}
                </p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-cream/50">
                    Code{" "}
                    <span className="font-mono font-semibold tracking-widest text-cream">
                      {g.join_code as string}
                    </span>
                  </span>
                  <span className="text-cyan group-hover:underline">Manage →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* games you're in */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">Games you&apos;re in</h2>
        {cards.length === 0 ? (
          <div className="card mt-3 p-6 text-center">
            <div className="text-4xl">🎭</div>
            <p className="mt-2 font-display text-lg font-bold">No games yet</p>
            <p className="mt-1 text-sm text-cream/55">
              When a host sends you a join link, sign in and claim your name — your groups and answers
              will show up here.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {cards.map((c) => (
              <section key={c.memberId} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-bold">{c.groupName}</h3>
                    <p className="mt-0.5 text-sm text-cream/60">
                      You played as <span className="font-semibold text-cream">{c.name}</span>
                      {c.isCaptain && " 🎖️"}
                      {c.teamName ? ` · ${c.teamName}` : ""}
                    </p>
                  </div>
                  <span className="chip cursor-default text-xs">
                    {c.status === "done" ? "✓ played" : c.status === "live" ? "● live" : "open"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="chip cursor-default text-xs">📝 {c.answers} answers</span>
                  <Link href={`/join?code=${c.joinCode}`} className="btn btn-ghost text-xs">
                    Review my answers →
                  </Link>
                  {c.recapGameId && (
                    <Link href={`/recap/${c.recapGameId}`} className="btn btn-secondary text-xs">
                      🎬 Game recap
                    </Link>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
