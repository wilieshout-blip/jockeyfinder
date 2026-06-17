"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Supabase puts a recovery session in place when the email link is opened.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit() {
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(friendlyAuthError(error, "Unable to update the password. Please try again."));
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1400);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-14 sm:py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Choose a new password
      </h1>
      <p className="mt-2 text-zinc-600">
        Pick something you will remember. Minimum eight characters.
      </p>

      <form
        className="mt-8 space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {done ? (
          <div className="rounded-xl border border-turf-200 bg-turf-50 p-4">
            <p className="font-medium text-turf-800">Password updated</p>
            <p className="mt-1 text-sm text-turf-700">
              Taking you to your dashboard...
            </p>
          </div>
        ) : !ready ? (
          <p className="text-sm text-zinc-600">
            Open this page from the reset link in your email. If you arrived here
            directly, request a new link from the{" "}
            <Link href="/forgot-password" className="font-medium text-turf-700 underline">
              forgot password
            </Link>{" "}
            page.
          </p>
        ) : (
          <>
            <div>
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                minLength={8}
                required
              />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm password</Label>
              <PasswordInput
                id="confirm"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
                minLength={8}
                required
              />
            </div>
            {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
            <Button
              type="submit"
              className="w-full"
              variant="accent"
              disabled={busy || !password || !confirm}
            >
              {busy ? "Saving..." : "Save new password"}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
