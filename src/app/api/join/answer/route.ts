import { NextResponse } from "next/server";
import { authorizeMember, currentUserId } from "@/lib/join";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAnswersLocked } from "@/lib/lock";

export async function POST(req: Request) {
  const { code, memberId, questionId, answer } = await req.json().catch(() => ({}));
  if (!code || !memberId || !questionId) return NextResponse.json({ ok: false }, { status: 400 });

  // Only the person who owns this slot (claimed + signed in) — or, for legacy
  // groups, anyone on the code+name flow — may write its answers.
  const userId = await currentUserId();
  const access = await authorizeMember(String(code), String(memberId), userId);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  const ctx = access;
  // Answers locked (host locked, or the deadline passed) — no submits or changes.
  if (isAnswersLocked(ctx.group)) {
    return NextResponse.json({ ok: false, error: "locked" }, { status: 423 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: q } = await supabase
    .from("feud_questions")
    .select("id, group_id, type, target_member_id")
    .eq("id", questionId)
    .maybeSingle();
  if (!q || q.group_id !== ctx.group.id) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  // guess_what is answered only by its hand-picked target.
  if (q.type === "guess_what" && q.target_member_id !== memberId) {
    return NextResponse.json({ ok: false, error: "not_target" }, { status: 403 });
  }

  // Don't let a member answer a question they're held out of (they may hold
  // several; a question is a holdout if there's any matching assignment row).
  const { data: ho } = await supabase
    .from("feud_question_assignments")
    .select("id")
    .eq("group_id", ctx.group.id)
    .eq("member_id", memberId)
    .eq("question_id", questionId)
    .limit(1);
  if (ho && ho.length > 0) {
    return NextResponse.json({ ok: false, error: "holdout" }, { status: 400 });
  }

  const raw = String(answer ?? "").trim();
  if (!raw) return NextResponse.json({ ok: false }, { status: 400 });

  // normalized_bucket = raw for now; the open-text clusterer (M6/AI) refines it.
  await supabase
    .from("feud_responses")
    .upsert(
      { question_id: questionId, member_id: memberId, raw_answer: raw, normalized_bucket: raw },
      { onConflict: "question_id,member_id" },
    );
  return NextResponse.json({ ok: true });
}
