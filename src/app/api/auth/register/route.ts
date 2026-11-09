import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { lookupGroup } from "@/lib/join";

export const runtime = "nodejs";

/**
 * Create a confirmed account immediately (no email round-trip) so a player can
 * sign up straight from a game invite and claim their slot — no magic-link
 * detour. Gated by a valid join code so it isn't an open sign-up endpoint. The
 * client signs in with the same password right after.
 */
export async function POST(req: Request) {
  const { email, password, code } = await req.json().catch(() => ({}));
  const em = String(email ?? "").trim().toLowerCase();
  const pw = String(password ?? "");
  if (!em || pw.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Enter an email and a password of at least 6 characters." },
      { status: 400 },
    );
  }
  // Only allow sign-up from a real game invite.
  if (!code || !(await lookupGroup(String(code)))) {
    return NextResponse.json({ ok: false, error: "Open this from your game invite link." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: em,
    password: pw,
    email_confirm: true, // trusted via the join code — skip the email verification step
  });
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    // Already have an account — that's fine; the client will just sign in.
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return NextResponse.json({ ok: true, created: false });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, created: true, userId: data.user?.id ?? null });
}
