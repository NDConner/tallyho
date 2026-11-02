import { NextResponse } from "next/server";
import { validateMember } from "@/lib/join";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_OF_TOPIC } from "@/lib/trivia/topics";

export async function POST(req: Request) {
  const { code, memberId, teamId, topics } = await req.json().catch(() => ({}));
  if (!code || !memberId || !teamId || !Array.isArray(topics)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ctx = await validateMember(String(code), String(memberId));
  if (!ctx) return NextResponse.json({ ok: false }, { status: 403 });
  if (!ctx.member.is_captain || ctx.member.team_id !== teamId) {
    return NextResponse.json({ ok: false, error: "not captain of this team" }, { status: 403 });
  }

  // Accept {name, category} objects (custom categories work) or legacy strings.
  // Enforce one topic per category (last pick wins per category).
  const byCategory = new Map<string, string>();
  for (const t of topics as unknown[]) {
    let name = "";
    let category = "";
    if (typeof t === "string") {
      name = t;
      category = CATEGORY_OF_TOPIC[t] ?? "Mixed";
    } else if (t && typeof t === "object" && typeof (t as { name?: unknown }).name === "string") {
      name = (t as { name: string }).name;
      const c = (t as { category?: unknown }).category;
      category = (typeof c === "string" && c.trim()) || CATEGORY_OF_TOPIC[name] || "Mixed";
    } else {
      continue;
    }
    name = name.trim().slice(0, 60);
    category = category.trim().slice(0, 40);
    if (name && category) byCategory.set(category, name);
  }

  const supabase = createSupabaseAdminClient();
  await supabase.from("trivia_topics").delete().eq("team_id", teamId);
  const rows = [...byCategory.entries()].map(([category, name]) => ({
    group_id: ctx.group.id,
    team_id: teamId,
    category,
    name,
    selected: true,
    source: "custom",
  }));
  if (rows.length) await supabase.from("trivia_topics").insert(rows);
  return NextResponse.json({ ok: true, selected: rows.map((r) => ({ name: r.name, category: r.category })) });
}
