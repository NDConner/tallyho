import { NextResponse } from "next/server";
import { validateMember } from "@/lib/join";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { code, memberId, questionId, answer } = await req.json().catch(() => ({}));
  if (!code || !memberId || !questionId) return NextResponse.json({ ok: false }, { status: 400 });

  const ctx = await validateMember(String(code), String(memberId));
  if (!ctx) return NextResponse.json({ ok: false }, { status: 403 });

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

  // Don't let a member answer the question they're held out of.
  const { data: ho } = await supabase
    .from("feud_question_assignments")
    .select("question_id")
    .eq("group_id", ctx.group.id)
    .eq("member_id", memberId)
    .maybeSingle();
  if (ho?.question_id === questionId) {
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
