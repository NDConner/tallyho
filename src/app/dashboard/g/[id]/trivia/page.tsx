import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TOPIC_CATALOG } from "@/lib/trivia/topics";
import { activeCategories } from "@/lib/join";
import { TriviaManager } from "@/components/TriviaManager";
import { generateTriviaBank } from "../actions";
import type { Group, Team } from "@/lib/types";

export default async function TriviaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: groupData } = await supabase.from("groups").select("*").eq("id", id).single();
  if (!groupData) notFound();
  const group = groupData as Group & { trivia_categories: unknown };

  const [{ data: teamData }, { data: topicRows }, { data: qRows }] = await Promise.all([
    supabase.from("teams").select("id, name, team_index").eq("group_id", id).order("team_index"),
    supabase.from("trivia_topics").select("team_id, name, category").eq("group_id", id).eq("selected", true),
    supabase
      .from("trivia_questions")
      .select("id, team_id, topic, prompt, correct_answer, accepted_variants, point_value")
      .eq("group_id", id)
      .order("created_at"),
  ]);
  const teams = (teamData ?? []) as Team[];

  const cats = activeCategories(group.trivia_categories);
  const teamView = teams.map((t) => ({
    id: t.id,
    name: t.name,
    index: t.team_index,
    topics: (topicRows ?? []).filter((x) => x.team_id === t.id).map((x) => ({ name: x.name, category: x.category })),
    questions: (qRows ?? [])
      .filter((x) => x.team_id === t.id)
      .map((x) => ({
        id: x.id,
        topic: x.topic,
        prompt: x.prompt,
        correct_answer: x.correct_answer,
        accepted_variants: (x.accepted_variants as string[]) ?? [],
      })),
  }));

  return (
    <div>
      <Link href={`/dashboard/g/${id}`} className="text-sm text-cream/50 hover:text-cream">
        ← Back to {group.name}
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black">Trivia &amp; topics</h1>
          <p className="mt-1 text-sm text-cream/55">
            Edit questions, add your own, swap each team&apos;s topics, or set custom categories
            (great for company trivia). Every question is worth 2 points.
          </p>
        </div>
        <form action={generateTriviaBank}>
          <input type="hidden" name="groupId" value={id} />
          <button type="submit" className="btn btn-ghost text-sm">
            ⚡ Regenerate from topics
          </button>
        </form>
      </div>

      <div className="mt-6">
        <TriviaManager
          groupId={id}
          categories={cats}
          catalog={TOPIC_CATALOG}
          teams={teamView}
        />
      </div>
    </div>
  );
}
