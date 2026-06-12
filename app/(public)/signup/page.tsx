"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Hint, Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const ROLES: { value: Role; title: string; blurb: string }[] = [
  {
    value: "jockey",
    title: "Jockey",
    blurb: "Mark race days, share your weight and claim, receive ride offers.",
  },
  {
    value: "trainer",
    title: "Trainer",
    blurb: "See who is riding where and request jockeys. Free, auto verified.",
  },
  {
    value: "owner",
    title: "Owner",
    blurb: "Follow ride plans for your horses. Free, view only to start.",
  },
  {
    value: "agent",
    title: "Agent",
    blurb: "Manage several jockeys, their calendars, and their ride requests.",
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("jockey");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          role,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
        },
      },
    });

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      // Email confirmation is enabled in the Supabase project.
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Check your inbox
        </h1>
        <p className="mt-3 text-zinc-600">
          We have sent a confirmation link to{" "}
          <span className="font-medium text-ink">{email}</span>. Click it to
          activate your account, then log in.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-4 py-14 sm:py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Create your account
      </h1>
      <p className="mt-2 text-zinc-600">
        Pick your role first. It sets up the right dashboard and permissions.
      </p>

      <div className="mt-8 space-y-6 rounded-2xl border border-line bg-white p-6 shadow-card">
        <div>
          <Label>I am a</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={cn(
                  "rounded-xl border p-3.5 text-left transition-colors",
                  role === r.value
                    ? "border-turf-600 bg-turf-50 ring-1 ring-turf-600"
                    : "border-line bg-white hover:border-zinc-400"
                )}
              >
                <p className="font-medium text-ink">{r.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                  {r.blurb}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="first">First name</Label>
            <Input
              id="first"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="last">Last name</Label>
            <Input
              id="last"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

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
          <Label htmlFor="phone">Mobile number</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="021 123 4567"
          />
          {role === "trainer" ? (
            <Hint>
              Trainers are verified instantly when this number matches the
              NZTR people registry.
            </Hint>
          ) : null}
          {role === "agent" ? (
            <Hint>
              We match this against the NZTR registry, then an admin approves
              agent accounts manually.
            </Hint>
          ) : null}
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>

        {role === "jockey" ? (
          <p className="rounded-xl bg-mist p-3 text-sm text-zinc-600">
            Jockey accounts include a 100 day free trial, then $40 NZD per
            month. Your profile goes public once verified by our team.
          </p>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button
          className="w-full"
          variant="accent"
          onClick={submit}
          disabled={
            busy || !firstName || !lastName || !email || !phone || password.length < 8
          }
        >
          {busy ? "Creating account..." : "Sign up"}
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-turf-700 underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
