"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Live user search for the new-conversation dialog.
 * Filters out the current user, test accounts, and returns at most 8 hits.
 */
export async function searchUsers(query: string) {
    const q = query.trim();
    if (q.length < 2) return [];

  const supabase = await createClient();
    const {
          data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

  const { data } = await supabase
      .from("profiles")
      .select("id, full_name, profile_photo_url, role")
      .ilike("full_name", `%${q}%`)
      .neq("id", user.id)
      .eq("is_test", false)
      .order("full_name")
      .limit(8);

  return data ?? [];
}

/**
 * Starts (or reuses) a one to one chat with another user, then drops
 * the sender into the thread. Only signed in, verified people can
 * start chats, which keeps spam out of riders' inboxes.
 */
export async function startDirectMessage(formData: FormData) {
    const otherId = String(formData.get("user_id") || "");
    if (!otherId) redirect("/dashboard/messages");

  const supabase = await createClient();
    const {
          data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/login?next=/dashboard/messages`);
    if (user.id === otherId) redirect("/dashboard/messages");

  const { data: me } = await supabase
      .from("profiles")
      .select("verified, verification_status")
      .eq("id", user.id)
      .single();

  if (!me || me.verification_status !== "approved") {
        redirect("/dashboard?error=verify_first");
  }

  // Reuse an existing direct thread between the two if there is one.
  const { data: myThreads } = await supabase
      .from("chat_participants")
      .select("thread_id")
      .eq("user_id", user.id);

  const ids = (myThreads || []).map((t) => t.thread_id);
    if (ids.length > 0) {
          const { data: shared } = await supabase
            .from("chat_participants")
            .select("thread_id, chat_threads!inner(type)")
            .eq("user_id", otherId)
            .eq("chat_threads.type", "direct")
            .in("thread_id", ids)
            .limit(1);

      const existing = shared && shared.length > 0 ? shared[0].thread_id : null;
          if (existing) redirect(`/dashboard/messages/${existing}`);
    }

  const { data: thread, error } = await supabase
      .from("chat_threads")
      .insert({ type: "direct", created_by: user.id })
      .select("id")
      .single();

  if (error || !thread) redirect("/dashboard/messages?error=could_not_start");

  await supabase.from("chat_participants").insert([
    { thread_id: thread.id, user_id: user.id },
    { thread_id: thread.id, user_id: otherId },
      ]);

  redirect(`/dashboard/messages/${thread.id}`);
}
