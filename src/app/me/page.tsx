import { redirect } from "next/navigation";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your games — Tallyho" };

/**
 * A signed-in member's history: every group they've claimed a spot in, what they
 * answered, and the games they were part of — across every group. Built with the
 * service role gated by the authenticated user's id (members don't own the group
 * rows, so they can't read them directly).
 */
export default async function MePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: memberRows } = await admin
    .from("members")
    .select("id, group_id, display_name, is_captain, team_id, claimed_at")
    .eq("user_id", user.id)
    .order("claimed_at", { ascending: false });
  const members = memberRows ?? [];
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

  const cards = members
    .map((m) => {
      const g = groupById.get(m.group_id as string);
      if (!g) return null;
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
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Wordmark size="sm" />
        <form action="/auth/signout" method="post">
          <button className="text-xs text-cream/50 underline hover:text-cream">Sign out</button>
        </form>
      </div>

      <h1 className="font-display text-3xl font-black">Your games</h1>
      <p className="mt-1 text-sm text-cream/55">
        Signed in as {user.email}. Everywhere you&apos;ve claimed your spot — your answers stay yours.
      </p>

      {cards.length === 0 ? (
        <div className="card mt-6 p-6 text-center">
          <div className="text-4xl">🎭</div>
          <p className="mt-2 font-display text-lg font-bold">No games yet</p>
          <p className="mt-1 text-sm text-cream/55">
            When a host sends you a join link, sign in and claim your name — your groups and answers will show
            up here.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {cards.map((c) => (
            <section key={c.memberId} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold">{c.groupName}</h2>
                  <p className="mt-0.5 text-sm text-cream/60">
                    You played as <span className="font-semibold text-cream">{c.name}</span>
                    {c.isCaptain && " 🎖️"}
                    {c.teamName ? ` · ${c.teamName}` : ""}
                  </p>
                </div>
                <span className="chip cursor-default text-xs">
                  {c.status === "done" ? "✓ played" : c.status === "live" ? "● live" : "setup"}
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
    </main>
  );
}
