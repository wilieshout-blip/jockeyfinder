"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationBell() {
  const supabase = useRef(createClient()).current;
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, type, title, body, href, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(15);
      if (mounted) setItems((data as Notif[]) ?? []);
    })();
    const ch = supabase
      .channel("notif-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (p) => setItems((prev) => [p.new as Notif, ...prev].slice(0, 15))
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [supabase]);

  async function markAllRead() {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    await supabase.from("notifications").update({ read_at: now }).in("id", ids);
  }

  async function markRead(id: string) {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? now } : n)));
    await supabase.from("notifications").update({ read_at: now }).eq("id", id);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative p-2 text-zinc-400 transition-colors hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 20a2 2 0 004 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unread > 0 ? (
          <span className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-lift">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 ? (
                <button onClick={markAllRead} className="text-xs font-medium text-turf-700 hover:underline">
                  Mark all read
                </button>
              ) : null}
            </div>
            <div className="max-h-96 divide-y divide-line overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-400">No notifications yet.</p>
              ) : (
                items.map((n) => {
                  const inner = (
                    <div className="flex gap-2.5 px-4 py-3">
                      <span
                        className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-turf-500"}`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{n.title}</p>
                        {n.body ? <p className="mt-0.5 truncate text-xs text-zinc-500">{n.body}</p> : null}
                        <p className="mt-0.5 text-[11px] text-zinc-400">{formatDateTime(n.created_at)}</p>
                      </div>
                    </div>
                  );
                  return n.href ? (
                    <Link
                      key={n.id}
                      href={n.href}
                      onClick={() => {
                        markRead(n.id);
                        setOpen(false);
                      }}
                      className="block transition-colors hover:bg-mist/60"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button key={n.id} onClick={() => markRead(n.id)} className="block w-full text-left transition-colors hover:bg-mist/60">
                      {inner}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
