"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import type { Message } from "@/lib/types";

export function ChatThreadClient({
  threadId,
  meId,
  initialMessages,
  senders,
}: {
  threadId: string;
  meId: string;
  initialMessages: Message[];
  senders: Record<string, { name: string; photo: string | null }>;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("messages")
      .insert({ thread_id: threadId, sender_id: meId, body })
      .select("*")
      .single<Message>();

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDraft("");
    if (data) {
      setMessages((prev) =>
        prev.some((m) => m.id === data.id) ? prev : [...prev, data]
      );
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col rounded-2xl border border-line bg-white shadow-card">
      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-400">
            No messages yet. Say hello.
          </p>
        ) : null}
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          const sender = m.sender_id ? senders[m.sender_id] : undefined;
          return (
            <div
              key={m.id}
              className={cn("flex items-end gap-2", mine && "flex-row-reverse")}
            >
              {!mine ? (
                <Avatar src={sender?.photo} name={sender?.name} size="sm" />
              ) : null}
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm",
                  mine
                    ? "rounded-br-md bg-ink text-white"
                    : "rounded-bl-md bg-mist text-ink"
                )}
              >
                {!mine && sender ? (
                  <p className="mb-0.5 text-xs font-semibold text-turf-700">
                    {sender.name}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    mine ? "text-zinc-400" : "text-zinc-400"
                  )}
                >
                  {formatDateTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line p-3">
        {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Write a message"
            className="max-h-32 min-h-[44px] w-full resize-y rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-zinc-400 focus:border-turf-600 focus:outline-none focus:ring-2 focus:ring-turf-100"
          />
          <Button variant="accent" onClick={send} disabled={busy || !draft.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
