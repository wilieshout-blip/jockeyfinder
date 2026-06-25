"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  initialMessages: boolean;
  initialMarketing: boolean;
}

type Key = "email_notify_messages" | "email_notify_marketing";

function Toggle({
  checked,
  pending,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  pending: boolean;
  onChange: () => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={pending}
        onClick={onChange}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-turf-600" : "bg-zinc-300",
          pending && "opacity-60"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

/** Lets a user opt in/out of the emails JockeyFinder sends. Writes directly to
 * their own profile row under RLS. */
export function NotificationPreferences({ userId, initialMessages, initialMarketing }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [marketing, setMarketing] = useState(initialMarketing);
  const [pendingKey, setPendingKey] = useState<Key | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function update(key: Key, next: boolean) {
    setErr(null);
    setPendingKey(key);
    // optimistic
    if (key === "email_notify_messages") setMessages(next);
    else setMarketing(next);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ [key]: next })
      .eq("id", userId);

    setPendingKey(null);
    if (error) {
      // revert
      if (key === "email_notify_messages") setMessages(!next);
      else setMarketing(!next);
      setErr("Couldn't save that change. Please try again.");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
      <h2 className="font-display text-lg font-semibold text-ink">Notifications</h2>
      <p className="mt-0.5 text-sm text-zinc-500">
        Choose which emails JockeyFinder sends you. Account and security emails are always sent.
      </p>
      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
      <div className="mt-2 divide-y divide-line">
        <Toggle
          label="New messages"
          description="Email me when someone sends me a message (at most once every 30 minutes per chat)."
          checked={messages}
          pending={pendingKey === "email_notify_messages"}
          onChange={() => update("email_notify_messages", !messages)}
        />
        <Toggle
          label="Product news & announcements"
          description="Occasional updates from the JockeyFinder team about new features and racing."
          checked={marketing}
          pending={pendingKey === "email_notify_marketing"}
          onChange={() => update("email_notify_marketing", !marketing)}
        />
      </div>
    </section>
  );
}
