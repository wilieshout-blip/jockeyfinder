"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { searchUsers, startDirectMessage } from "./actions";

interface UserResult {
    id: string;
    full_name: string | null;
    profile_photo_url: string | null;
    role: string | null;
}

const ROLE_LABELS: Record<string, string> = {
    jockey: "Jockey",
    trainer: "Trainer",
    owner: "Owner",
    agent: "Agent",
};

export function NewConversationButton() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<UserResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [pending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

  // Focus input when modal opens
  useEffect(() => {
        if (open) {
                setTimeout(() => inputRef.current?.focus(), 50);
                setQuery("");
                setResults([]);
        }
  }, [open]);

  // Debounced search
  useEffect(() => {
        if (query.trim().length < 2) {
                setResults([]);
                return;
        }
        const t = setTimeout(async () => {
                setLoading(true);
                const r = await searchUsers(query);
                setResults(r as UserResult[]);
                setLoading(false);
        }, 220);
        return () => clearTimeout(t);
  }, [query]);

  // Close on Escape or click outside
  useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
                if (e.key === "Escape") setOpen(false);
        }
        function onClickOutside(e: MouseEvent) {
                if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                          setOpen(false);
                }
        }
        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onClickOutside);
        return () => {
                document.removeEventListener("keydown", onKey);
                document.removeEventListener("mousedown", onClickOutside);
        };
  }, [open]);

  function openThread(userId: string) {
        const fd = new FormData();
        fd.set("user_id", userId);
        startTransition(() => startDirectMessage(fd));
        setOpen(false);
  }

  return (
        <div className="relative" ref={containerRef}>
                <button
                          onClick={() => setOpen((o) => !o)}
                          aria-label="New conversation"
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-turf-600 text-white shadow-sm transition hover:bg-turf-700 active:scale-95"
                        >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                  <path d="M12 5v14M5 12h14" />
                        </svg>
                </button>
        
          {open ? (
                  <div
                              className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-line bg-white shadow-xl"
                              role="dialog"
                              aria-label="New conversation"
                            >
                            <div className="p-3">
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                                                      New conversation
                                        </p>
                                        <div className="relative">
                                                      <input
                                                                        ref={inputRef}
                                                                        type="text"
                                                                        value={query}
                                                                        onChange={(e) => setQuery(e.target.value)}
                                                                        placeholder="Search by name..."
                                                                        className="w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-sm text-ink placeholder-zinc-400 outline-none focus:border-turf-500 focus:ring-2 focus:ring-turf-200"
                                                                      />
                                          {loading ? (
                                              <svg
                                                                  className="absolute right-3 top-3 h-4 w-4 animate-spin text-zinc-400"
                                                                  viewBox="0 0 24 24"
                                                                  fill="none"
                                                                >
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                              </svg>
                                            ) : null}
                                        </div>
                            </div>
                  
                    {results.length > 0 ? (
                                          <ul className="max-h-72 overflow-y-auto border-t border-line pb-2" role="listbox">
                                            {results.map((u) => (
                                                            <li key={u.id}>
                                                                              <button
                                                                                                    onClick={() => openThread(u.id)}
                                                                                                    disabled={pending}
                                                                                                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-mist disabled:opacity-50"
                                                                                                  >
                                                                                                  <Avatar src={u.profile_photo_url} name={u.full_name} size="sm" />
                                                                                                  <div className="min-w-0 flex-1">
                                                                                                                        <p className="truncate text-sm font-medium text-ink">
                                                                                                                          {u.full_name ?? "Unknown"}
                                                                                                                          </p>
                                                                                                    {u.role ? (
                                                                                                                            <p className="text-xs capitalize text-zinc-500">
                                                                                                                              {ROLE_LABELS[u.role] ?? u.role}
                                                                                                                              </p>
                                                                                                                          ) : null}
                                                                                                    </div>
                                                                                {pending ? null : (
                                                                                                                          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-zinc-300" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                                                                                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                                                                                                                            </svg>
                                                                                                  )}
                                                                              </button>
                                                            </li>
                                                          ))}
                                          </ul>
                                        ) : query.trim().length >= 2 && !loading ? (
                                          <p className="border-t border-line px-4 py-4 text-sm text-zinc-500">
                                                        No users found for "{query}"
                                          </p>
                                        ) : query.trim().length > 0 && query.trim().length < 2 ? (
                                          <p className="border-t border-line px-4 py-4 text-sm text-zinc-400">
                                                        Type at least 2 characters to search
                                          </p>
                                        ) : null}
                  </div>
                ) : null}
        </div>
      );
}
