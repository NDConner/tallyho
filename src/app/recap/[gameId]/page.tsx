import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrBuildRecap } from "@/lib/recap";
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
  return <RecapView recap={recap} />;
}
