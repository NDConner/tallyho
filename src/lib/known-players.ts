import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface KnownPlayer {
  userId: string;
  name: string; // the most recent display name they used
  email: string | null;
}

/**
 * Distinct accounts that have claimed a roster slot in any group this host
 * created — "people who've played before." Lets a host re-add a returning player
 * by their account (so the game shows on their home) with one tap.
 */
export async function getKnownPlayers(hostUserId: string): Promise<KnownPlayer[]> {
  const admin = createSupabaseAdminClient();
  const { data: groups } = await admin.from("groups").select("id").eq("created_by", hostUserId);
  const groupIds = (groups ?? []).map((g) => g.id as string);
  if (!groupIds.length) return [];

  const { data: members } = await admin
    .from("members")
    .select("user_id, display_name, claimed_at")
    .in("group_id", groupIds)
    .not("user_id", "is", null)
    .order("claimed_at", { ascending: false });

  // Most recent display name per account.
  const byUser = new Map<string, string>();
  for (const m of members ?? []) {
    const uid = m.user_id as string;
    if (uid && !byUser.has(uid)) byUser.set(uid, (m.display_name as string) ?? "Player");
  }
  if (!byUser.size) return [];

  const out: KnownPlayer[] = [];
  await Promise.all(
    [...byUser.entries()].map(async ([userId, name]) => {
      const { data } = await admin.auth.admin.getUserById(userId);
      out.push({ userId, name, email: data?.user?.email ?? null });
    }),
  );
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
