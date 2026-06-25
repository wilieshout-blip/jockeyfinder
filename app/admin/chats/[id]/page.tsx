import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: thread } = await admin
    .from("chat_threads")
    .select("id, type, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!thread) notFound();

  const { data: messages } = await admin
    .from("messages")
    .select("id, body, created_at, sender_id, profiles:sender_id(full_name, role)")
    .eq("thread_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/admin/chats" className="text-sm font-medium text-turf-700 hover:underline">← All chats</Link>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink capitalize">{thread.type ?? "Booking"} chat</h1>
      <p className="text-sm text-zinc-500">Read-only · started {formatDateTime(thread.created_at)}</p>

      <div className="mt-5 space-y-3">
        {(messages ?? []).map((m: any) => (
          <div key={m.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">
                {m.profiles?.full_name ?? "Unknown"}
                {m.profiles?.role ? <span className="ml-1.5 text-xs font-normal text-zinc-400 capitalize">{m.profiles.role}</span> : null}
              </p>
              <span className="text-xs text-zinc-400">{formatDateTime(m.created_at)}</span>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-700">{m.body}</p>
          </div>
        ))}
        {(messages ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-zinc-400">
            No messages in this thread.
          </p>
        ) : null}
      </div>
    </div>
  );
}
