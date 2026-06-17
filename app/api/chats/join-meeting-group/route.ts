import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest, isUuid } from "@/lib/security";

/**
 * POST /api/chats/join-meeting-group
 * Called when a jockey marks themselves as attending a meeting.
 * Ensures a meeting_group chat thread exists for that meeting,
 * then adds the jockey as a participant (idempotent).
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  // Verify the caller is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { meetingId, userId } = body as { meetingId?: string; userId?: string };
  if (!isUuid(meetingId) || !isUuid(userId)) {
    return NextResponse.json({ error: "meetingId and userId required" }, { status: 400 });
  }

  // Use admin client so RLS doesn't block thread creation
  const admin = createAdminClient();

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("id, role, verification_status")
    .eq("id", userId)
    .maybeSingle();

  if (
    !targetProfile ||
    targetProfile.role !== "jockey" ||
    targetProfile.verification_status !== "approved"
  ) {
    return NextResponse.json({ error: "Jockey is not approved" }, { status: 403 });
  }

  if (userId !== user.id) {
    const [{ data: caller }, { data: link }] = await Promise.all([
      admin
        .from("profiles")
        .select("role, verification_status")
        .eq("id", user.id)
        .maybeSingle(),
      admin
        .from("agent_jockeys")
        .select("jockey_id")
        .eq("agent_id", user.id)
        .eq("jockey_id", userId)
        .maybeSingle(),
    ]);

    if (
      caller?.role !== "agent" ||
      caller.verification_status !== "approved" ||
      !link
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // 1. Find or create the meeting_group thread
  let threadId: string;

  const { data: existing } = await admin
    .from("chat_threads")
    .select("id")
    .eq("meeting_id", meetingId)
    .eq("type", "meeting_group")
    .maybeSingle();

  if (existing) {
    threadId = existing.id;
  } else {
    const { data: thread, error: threadError } = await admin
      .from("chat_threads")
      .insert({ type: "meeting_group", meeting_id: meetingId })
      .select("id")
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { error: threadError?.message ?? "Failed to create thread" },
        { status: 500 }
      );
    }
    threadId = thread.id;
  }

  // 2. Add the jockey as a participant (ignore if already there)
  const { error: participantError } = await admin
    .from("chat_participants")
    .upsert({ thread_id: threadId, user_id: userId }, { onConflict: "thread_id,user_id" });

  if (participantError) {
    return NextResponse.json({ error: participantError.message }, { status: 500 });
  }

  return NextResponse.json({ threadId });
}
