import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrBuildRecap, buildHostAnalytics, type HostAnalytics } from "@/lib/recap";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RecapView } from "@/components/recap/RecapView";

// Public, shareable page. Built lazily + cached on first view (see getOrBuildRecap).
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gameId: string }>;
}): Promise<Metadata> {
  const { gameId } = await params;
  const recap = await getOrBuildRecap(gameId).catch(() => null);
  if (!recap) return { title: "Game recap — Tallyho" };
  const title = `${recap.groupName} — game recap`;
  const desc = recap.winner
    ? `${recap.winner.tie ? "A tie!" : `${recap.winner.name} took it.`} ${recap.totals.rightAnswers} right answers, ${recap.superlatives.length} superlatives, and a card for everyone.`
    : "Stats, superlatives and player cards from the game.";
  return { title, description: desc, openGraph: { title, description: desc } };
}

export default async function RecapPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const recap = await getOrBuildRecap(gameId);
  if (!recap) notFound();

  // Deep analytics (raw responses + who voted for what) are HOST-ONLY: built and
  // sent to the client only when the signed-in viewer owns this game's group, so
  // the public recap link never leaks anyone's answers.
  let analytics: HostAnalytics | null = null;
  let groupHref: string | null = null; // host-only link back to this game's home
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const admin = createSupabaseAdminClient();
      const { data: game } = await admin.from("games").select("group_id").eq("id", gameId).maybeSingle();
      if (game) {
        const { data: group } = await admin
          .from("groups")
          .select("created_by")
          .eq("id", game.group_id as string)
          .maybeSingle();
        if (group && group.created_by === user.id) {
          analytics = await buildHostAnalytics(gameId);
          groupHref = `/dashboard/g/${game.group_id}`;
        }
      }
    }
  } catch {
    /* never block the public recap on the analytics path */
  }

  return <RecapView recap={recap} analytics={analytics} groupHref={groupHref} />;
}
