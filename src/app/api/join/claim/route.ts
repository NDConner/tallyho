import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { lookupGroup } from "@/lib/join";

/**
 * Claim a roster slot for the signed-in member. This is the one place a person
 * becomes a member: we require an authenticated session and bind the member row
 * to their auth.users id, atomically and only if the slot is still free (or was
 * reserved for their email). After this, that name belongs to them — nobody else
 * can read or overwrite its answers (enforced on the other routes).
 */
export async function POST(req: Request) {
  const { code, memberId } = await req.json().catch(() => ({}) as { code?: string; memberId?: string });
  if (!code || !memberId) {
    return NextResponse.json({ ok: false, error: "Missing code or name." }, { status: 400 });
  }

  // Who is calling? (reads the member's own auth session from cookies)
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in first to claim your spot." }, { status: 401 });
  }

  const ctx = await lookupGroup(String(code));
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "No group found for that code." }, { status: 404 });
  }
  type M = { id: string; display_name: string; is_playing: boolean; user_id: string | null; claim_email: string | null };
  const members = ctx.members as unknown as M[];
  const member = members.find((m) => m.id === memberId);
  if (!member || member.is_playing === false) {
    return NextResponse.json({ ok: false, error: "Pick a playing name." }, { status: 400 });
  }

  // Already yours — idempotent success.
  if (member.user_id === user.id) {
    return NextResponse.json({ ok: true, alreadyMine: true });
  }
  // Taken by someone else.
  if (member.user_id) {
    return NextResponse.json(
      { ok: false, error: "That name's already claimed by someone else." },
      { status: 409 },
    );
  }
  // Host reserved this slot for a specific email.
  const email = (user.email ?? "").toLowerCase();
  if (member.claim_email && member.claim_email.toLowerCase() !== email) {
    return NextResponse.json(
      { ok: false, error: "That spot is reserved for a different email address." },
      { status: 403 },
    );
  }
  // One account can hold only one slot per group.
  const mineAlready = members.find((m) => m.user_id === user.id);
  if (mineAlready) {
    return NextResponse.json(
      { ok: false, error: `You already claimed "${mineAlready.display_name}" in this group.` },
      { status: 409 },
    );
  }

  // Atomic claim: only succeeds while the slot is still unclaimed.
  const admin = createSupabaseAdminClient();
  const { data: updated, error } = await admin
    .from("members")
    .update({ user_id: user.id, claimed_at: new Date().toISOString() })
    .eq("id", memberId)
    .is("user_id", null)
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    return NextResponse.json(
      { ok: false, error: "Someone just claimed that name — pick another." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
