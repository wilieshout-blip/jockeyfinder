"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { SITE_URL } from "@/lib/supabase/config";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const origin =
      typeof window !== "undefined" ? window.location.origin : SITE_URL;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      setError(friendlyAuthError(error, "Unable to send the reset link. Please try again."));
      return;
    }
    setSent(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-14 sm:py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Reset your password
      </h1>
      <p className="mt-2 text-zinc-600">
        Enter your email and we will send you a link to set a new password.
      </p>

      <form
        className="mt-8 space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {sent ? (
          <div className="rounded-xl border border-turf-200 bg-turf-50 p-4">
            <p className="font-medium text-turf-800">Check your email</p>
            <p className="mt-1 text-sm text-turf-700">
              If an account exists for {email}, a reset link is on its way. The
              link opens a page where you can choose a new password.
            </p>
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.co.nz"
                required
              />
            </div>
            {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
            <Button
              type="submit"
              className="w-full"
              variant="accent"
              disabled={busy || !email}
            >
              {busy ? "Sending..." : "Send reset link"}
            </Button>
          </>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-turf-700 underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
