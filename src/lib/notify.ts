import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Drop an in-app notification into someone's inbox (service-role write). Best
 *  effort: if the notifications table isn't there yet, it no-ops rather than
 *  breaking the caller. */
export async function createNotification(
  admin: SupabaseClient,
  n: {
    userId: string;
    type: string;
    title: string;
    body?: string | null;
    link?: string | null;
    groupId?: string | null;
  },
): Promise<void> {
  await admin.from("notifications").insert({
    user_id: n.userId,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
    group_id: n.groupId ?? null,
  });
}
