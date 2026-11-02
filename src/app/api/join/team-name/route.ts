import { NextResponse } from "next/server";
import { validateMember } from "@/lib/join";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// A captain renames their own team from their phone. Gated by the join code +
// the member being this team's captain (service role does the write).
export async function POST(req: Request) {
  const { code, memberId, teamId, name } = await req.json().catch(() => ({}));
  const clean = String(name ?? "").trim().slice(0, 40);
  if (!code || !memberId || !teamId || !clean) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const ctx = await validateMember(String(code), String(memberId));
  if (!ctx) return NextResponse.json({ ok: false }, { status: 403 });
  if (!ctx.member.is_captain || ctx.member.team_id !== teamId) {
    return NextResponse.json({ ok: false, error: "not_captain" }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  await supabase.from("teams").update({ name: clean }).eq("id", teamId).eq("group_id", ctx.group.id);
  return NextResponse.json({ ok: true, name: clean });
}
