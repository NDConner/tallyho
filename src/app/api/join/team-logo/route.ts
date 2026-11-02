import { NextResponse } from "next/server";
import { validateMember } from "@/lib/join";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

/** Captain uploads (or removes) their team's logo/photo. Service-role, gated by
 *  join code + captain-of-this-team. Stored in the public `team-logos` bucket. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false }, { status: 400 });

  const code = String(form.get("code") || "");
  const memberId = String(form.get("memberId") || "");
  const teamId = String(form.get("teamId") || "");
  const remove = String(form.get("remove") || "") === "1";
  if (!code || !memberId || !teamId) return NextResponse.json({ ok: false }, { status: 400 });

  const ctx = await validateMember(code, memberId);
  if (!ctx) return NextResponse.json({ ok: false }, { status: 403 });
  if (!ctx.member.is_captain || ctx.member.team_id !== teamId) {
    return NextResponse.json({ ok: false, error: "not captain of this team" }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  if (remove) {
    await supabase.from("teams").update({ logo_url: null }).eq("id", teamId);
    return NextResponse.json({ ok: true, logoUrl: null });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ ok: false }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });
  const type = file.type || "image/png";
  if (!type.startsWith("image/"))
    return NextResponse.json({ ok: false, error: "not_image" }, { status: 400 });

  const ext = (type.split("/")[1] || "png").replace("jpeg", "jpg").replace("svg+xml", "svg");
  const path = `${ctx.group.id}/${teamId}-${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("team-logos")
    .upload(path, buf, { contentType: type, upsert: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data: pub } = supabase.storage.from("team-logos").getPublicUrl(path);
  const logoUrl = pub.publicUrl;
  await supabase.from("teams").update({ logo_url: logoUrl }).eq("id", teamId);
  return NextResponse.json({ ok: true, logoUrl });
}
