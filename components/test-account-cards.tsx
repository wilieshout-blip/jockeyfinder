"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const TEST_PASSWORD = "TestPass123!";

const TEST_ACCOUNTS = [
  { email: "test-jockey@jockeyfinder.com", label: "Jockey", icon: "J", bg: "bg-turf-50 border-turf-200 hover:bg-turf-100" },
  { email: "test-trainer@jockeyfinder.com", label: "Trainer", icon: "T", bg: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
  { email: "test-owner@jockeyfinder.com", label: "Owner", icon: "O", bg: "bg-amber-50 border-amber-200 hover:bg-amber-100" },
  { email: "test-agent@jockeyfinder.com", label: "Agent", icon: "A", bg: "bg-zinc-50 border-zinc-200 hover:bg-zinc-100" },
];

/**
 * Signs the admin in as a test account client-side — the same
 * signInWithPassword call the real login page uses (which works), rather than
 * a server action. The four accounts share the password below and are seeded
 * verified/approved.
 */
export function TestAccountCards() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function signIn(email: string) {
    setError(null);
    setActiveEmail(email);
    startTransition(async () => {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: TEST_PASSWORD,
      });
      if (signInError) {
        setActiveEmail(null);
        setError(`Could not sign in as ${email}: ${signInError.message}`);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div>
      {error ? (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TEST_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            disabled={pending}
            onClick={() => signIn(account.email)}
            className={cn(
              "premium-card-hover w-full border p-4 text-left disabled:opacity-60",
              account.bg
            )}
          >
            <span className="mb-2 block text-2xl">{account.icon}</span>
            <p className="text-sm font-semibold text-ink">Test {account.label}</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {pending && activeEmail === account.email ? "Signing in…" : "Sign in →"}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
