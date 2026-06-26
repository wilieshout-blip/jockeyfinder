"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { signIn } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="w-full"
      variant="accent"
      disabled={pending}
    >
      {pending ? "Logging in..." : "Log in"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(signIn, { error: null });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-14 sm:py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Log in
      </h1>
      <p className="mt-2 text-zinc-600">
        Welcome back. Plan your race days in one place.
      </p>

      <form action={formAction}>
        <div className="mt-8 space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.co.nz"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
            />
          </div>
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-turf-700 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
          {state?.error ? (
            <p className="text-sm text-red-600">{state.error}</p>
          ) : null}
          <SubmitButton />
        </div>
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
