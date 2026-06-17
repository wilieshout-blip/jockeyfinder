"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setError(friendlyAuthError(error, "Unable to log in. Please try again."));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-14 sm:py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Log in
      </h1>
      <p className="mt-2 text-zinc-600">
        Welcome back. Plan your race days in one place.
      </p>

      <form
        className="mt-8 space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
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
        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            required
          />
        </div>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-turf-700 hover:underline">
            Forgot your password?
          </Link>
        </div>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <Button
          type="submit"
          className="w-full"
          variant="accent"
          disabled={busy || !email || !password}
        >
          {busy ? "Logging in..." : "Log in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        New to JockeyFinder?{" "}
        <Link href="/signup" className="font-medium text-turf-700 underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
