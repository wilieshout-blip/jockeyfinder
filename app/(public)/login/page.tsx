"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

export default function LoginPage() {
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
      setError(error.message);
      return;
    }
    // Hard redirect instead of router.push + router.refresh.
    // In Next.js 14 App Router, calling router.push and router.refresh
    // together without await creates a race condition: the refresh
    // re-fetches /login before the push completes, and the competing
    // navigation states cancel each other, leaving the user on /login
    // despite a successful sign-in.
    // window.location.replace does a clean full-page HTTP redirect that
    // carries all cookies, bypassing React Router state entirely.
    window.location.replace("/dashboard");
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-14 sm:py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Log in
      </h1>
      <p className="mt-2 text-zinc-600">
        Welcome back. Plan your race days in one place.
      </p>

      <div className="mt-8 space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.co.nz"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Your password"
          />
        </div>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-turf-700 hover:underline">
            Forgot your password?
          </Link>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button
          className="w-full"
          variant="accent"
          onClick={submit}
          disabled={busy || !email || !password}
        >
          {busy ? "Logging in..." : "Log in"}
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-600">
        New to JockeyFinder?{" "}
        <Link href="/signup" className="font-medium text-turf-700 underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
