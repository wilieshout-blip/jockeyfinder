import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/chats/join-meeting-group
 * Called when a jockey marks themselves as attending a meeting.
 * Ensures a meeting_group chat thread exists for that meeting,
 * then adds the jockey as a participant (idempotent).
 */
export async function POST(request: Request) {
  // Verify the caller is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { meetingId, userId } = body as { meetingId?: string; userId?: string };
  if (!meetingId || !userId) {
    return NextResponse.json({ error: "meetingId and userId required" }, { status: 400 });
  }

  // Use admin client so RLS doesn't block thread creation
  const admin = createAdminClient();

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
