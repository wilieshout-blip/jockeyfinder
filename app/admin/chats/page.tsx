import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ChatSupervisorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: threads } = await admin
    .from("chat_threads")
    .select("id, type, ride_request_id, meeting_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const ids = (threads ?? []).map((t) => t.id);
  const partByThread = new Map<string, string[]>();
  const lastByThread = new Map<string, { body: string; created_at: string }>();
  if (ids.length > 0) {
    const [{ data: parts }, { data: msgs }] = await Promise.all([
      admin.from("chat_participants").select("thread_id, profiles(full_name, role)").in("thread_id", ids),
      admin.from("messages").select("thread_id, body, created_at").in("thread_id", ids).order("created_at", { ascending: false }),
    ]);
    for (const p of (parts ?? []) as any[]) {
      const name = p.profiles?.full_name ?? "Unknown";
      const role = p.profiles?.role ? ` (${p.profiles.role})` : "";
      if (!partByThread.has(p.thread_id)) partByThread.set(p.thread_id, []);
      partByThread.get(p.thread_id)!.push(name + role);
    }
    for (const m of (msgs ?? []) as any[]) {
      if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, { body: m.body, created_at: m.created_at });
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-sm font-medium text-turf-700 hover:underline">← Back to admin</Link>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Chat supervisor</h1>
      <p className="text-sm text-zinc-500">
        Read-only oversight of booking conversations. Visible to admins for safety and dispute handling — disclosed in the privacy policy.
      </p>

      {threads && threads.length > 0 ? (
        <div className="mt-5 space-y-2">
          {threads.map((t) => {
            const last = lastByThread.get(t.id);
            return (
              <Link
                key={t.id}
                href={`/admin/chats/${t.id}`}
                className="block rounded-2xl border border-line bg-white p-4 shadow-card transition-colors hover:border-turf-200"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-ink capitalize">{t.type ?? "booking"} chat</p>
                  <span className="text-xs text-zinc-400">{formatDateTime(t.created_at)}</span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">{(partByThread.get(t.id) ?? []).join(" · ") || "No participants"}</p>
                {last ? (
                  <p className="mt-2 truncate text-sm text-zinc-600">“{last.body}”</p>
                ) : (
                  <p className="mt-2 text-sm text-zinc-400">No messages yet.</p>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-zinc-400">
          No booking chats yet. Conversations appear here once trainers and jockeys start messaging.
        </p>
      )}
    </div>
  );
}
