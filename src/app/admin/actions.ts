"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";

async function currentIsAdmin(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return isAdmin(user?.email);
}

/**
 * Reset a user's password to a fresh temporary one (no email round-trip). Returns
 * the temp password for the admin to relay to the user. Admin-only.
 */
export async function adminResetPassword(input: {
  userId: string;
}): Promise<{ ok: boolean; password?: string; error?: string }> {
  if (!(await currentIsAdmin())) return { ok: false, error: "Not authorized." };
  const temp =
    "Tally-" + Math.random().toString(36).slice(2, 8) + String(Math.floor(10 + Math.random() * 89));
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(input.userId, { password: temp });
  if (error) return { ok: false, error: error.message };
  return { ok: true, password: temp };
}

/**
 * Permanently delete a user account. Their claimed roster slots free up
 * (members.user_id → null) and their profile cascades. Admin-only.
 */
export async function adminDeleteUser(input: { userId: string }): Promise<{ ok: boolean; error?: string }> {
  if (!(await currentIsAdmin())) return { ok: false, error: "Not authorized." };
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(input.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
