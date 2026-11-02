import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { QuestionManager, type QItem } from "@/components/QuestionManager";
import type { FeudQuestion } from "@/lib/types";

export default async function QuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: group } = await supabase.from("groups").select("id, name").eq("id", id).single();
  if (!group) notFound();

  const [{ data: qData }, { data: memberData }] = await Promise.all([
    supabase.from("feud_questions").select("*").eq("group_id", id).order("created_at"),
    supabase
      .from("members")
      .select("id, display_name")
      .eq("group_id", id)
      .eq("is_playing", true)
      .order("created_at"),
  ]);
  const qs = (qData ?? []) as FeudQuestion[];
  const members = (memberData ?? []).map((m) => ({ id: m.id, name: m.display_name }));

  const counts = new Map<string, number>();
  const ids = qs.map((q) => q.id);
  if (ids.length) {
    const { data: resp } = await supabase
      .from("feud_responses")
      .select("question_id")
      .in("question_id", ids);
    for (const r of resp ?? []) counts.set(r.question_id, (counts.get(r.question_id) ?? 0) + 1);
  }

  const questions: QItem[] = qs.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    type: q.type,
    options: q.options,
    target_member_id: q.target_member_id,
    source: q.source,
    ai_recommended: q.ai_recommended,
    responseCount: counts.get(q.id) ?? 0,
  }));

  return (
    <div>
      <Link href={`/dashboard/g/${id}`} className="text-sm text-cream/50 hover:text-cream">
        ← Back to {group.name}
      </Link>
      <h1 className="mt-3 mb-1 font-display text-3xl font-black">Feud questions</h1>
      <p className="mb-6 max-w-2xl text-sm text-cream/55">
        These are what your group answers about each other. Add, edit, or remove freely — bias
        toward pick-a-person and multiple-choice for clean tallies. Each player will be held out of
        exactly one of these to play live.
      </p>
      <QuestionManager
        groupId={id}
        questions={questions}
        members={members}
        memberCount={members.length}
      />
    </div>
  );
}
