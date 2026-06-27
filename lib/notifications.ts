import { createAdminClient } from "@/lib/supabase/admin";

export interface NewNotification {
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
}

/** Record an in-app notification (the bell) for one user. Never throws. */
export async function recordNotification(userId: string, n: NewNotification) {
  if (!userId) return;
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert({
      user_id: userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      href: n.href ?? null,
    });
  } catch (e) {
    console.error("recordNotification failed:", e);
  }
}

/** Record the same notification for several users. */
export async function recordNotifications(userIds: string[], n: NewNotification) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert(
      ids.map((user_id) => ({
        user_id,
        type: n.type,
        title: n.title,
        body: n.body ?? null,
        href: n.href ?? null,
      }))
    );
  } catch (e) {
    console.error("recordNotifications failed:", e);
  }
}
