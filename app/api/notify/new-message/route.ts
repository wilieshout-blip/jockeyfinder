import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailNewMessage } from "@/lib/email";

export const dynamic = "force-dynamic";

// Called by the AFTER INSERT trigger on public.messages (via pg_net).
// Authenticated with a shared secret stored in public.app_config.
// Emails every other participant in the thread who hasn't opted out, throttled
// to at most one email per 30 minutes per thread so an active chat doesn't spam.
const THROTTLE_MS = 30 * 60 * 1000;

export async function POST(req: Request) {
  const supabase = createAdminClient();

  const { data: cfg } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "message_hook_secret")
    .maybeSingle();

  const expected = cfg?.value;
  const provided = req.headers.get("x-hook-secret");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let messageId: string | null = null;
  try {
    const body = await req.json();
    messageId = body?.message_id ?? null;
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  if (!messageId) return NextResponse.json({ error: "message_id required" }, { status: 400 });

  const { data: message } = await supabase
    .from("messages")
    .select("id, thread_id, sender_id, body")
    .eq("id", messageId)
    .maybeSingle();

  if (!message || !message.thread_id) {
    return NextResponse.json({ ok: true, skipped: "no message" });
  }

  // Sender's display name.
  let senderName = "Someone";
  if (message.sender_id) {
    const { data: sender } = await supabase
      .from("profiles")
      .select("full_name, first_name")
      .eq("id", message.sender_id)
      .maybeSingle();
    senderName = sender?.full_name || sender?.first_name || "Someone";
  }

  // Everyone else in the thread.
  const { data: participants } = await supabase
    .from("chat_participants")
    .select("user_id, last_emailed_at")
    .eq("thread_id", message.thread_id);

  const recipients = (participants ?? []).filter((p) => p.user_id !== message.sender_id);
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no recipients" });
  }

  const recipientIds = recipients.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, email_notify_messages, is_test, is_placeholder, suspended")
    .in("id", recipientIds);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const now = Date.now();
  let sent = 0;

  for (const r of recipients) {
    const p = profileById.get(r.user_id);
    if (!p || !p.email) continue;
    if (p.is_test || p.is_placeholder || p.suspended) continue;
    if (p.email_notify_messages === false) continue;

    // Throttle per participant/thread.
    if (r.last_emailed_at && now - new Date(r.last_emailed_at).getTime() < THROTTLE_MS) {
      continue;
    }

    await emailNewMessage({
      to: p.email,
      senderName,
      preview: message.body ?? "",
      threadId: message.thread_id,
    });
    await supabase
      .from("chat_participants")
      .update({ last_emailed_at: new Date().toISOString() })
      .eq("thread_id", message.thread_id)
      .eq("user_id", r.user_id);
    sent += 1;
  }

  return NextResponse.json({ ok: true, sent });
}
