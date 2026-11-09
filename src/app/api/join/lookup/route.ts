import { NextResponse } from "next/server";
import { lookupGroup } from "@/lib/join";

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({ code: "" }));
  if (!code) return NextResponse.json({ ok: false, error: "Enter a code." }, { status: 400 });

  const ctx = await lookupGroup(String(code));
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: "No group found for that code." },
      { status: 404 },
    );
  }
  return NextResponse.json({
    ok: true,
    groupId: ctx.group.id,
    groupName: ctx.group.name,
    dynamicNote: ctx.group.dynamic_note,
    code: ctx.group.join_code,
    requireLogin: Boolean((ctx.group as { require_member_login?: boolean }).require_member_login),
    members: ctx.members
      .filter((m) => m.is_playing !== false)
      .map((m) => ({
        id: m.id,
        name: m.display_name,
        isCaptain: m.is_captain,
        claimed: Boolean((m as { user_id?: string | null }).user_id),
      })),
  });
}
