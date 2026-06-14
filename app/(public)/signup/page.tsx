"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Hint, Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const ROLES: { value: Role; title: string; blurb: string; icon: string; free: boolean }[] = [
  { value: "jockey", title: "Jockey", icon: "🏇", blurb: "Mark your race days, share weight & claim, receive ride offers.", free: false },
  { value: "trainer", title: "Trainer", icon: "📋", blurb: "Find who's riding where and send ride requests. Free forever.", free: true },
  { value: "owner", title: "Owner", icon: "🏆", blurb: "Follow your horses and track who's riding them. Free forever.", free: true },
  { value: "agent", title: "Agent", icon: "🤝", blurb: "Manage multiple jockeys, their calendars and ride requests.", free: false },
];

function PasswordStrength({ password }: { password: string }) {
  const len = password.length;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const score = (len >= 8 ? 1 : 0) + (len >= 12 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNumber ? 1 : 0);
  if (!password) return null;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const colours = ["bg-red-400", "bg-orange-400", "bg-amber-400", "bg-lime-500", "bg-turf-600"];
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < score ? colours[score] : "bg-line")} />
        ))}
      </div>
      <p className="text-[11px] text-zinc-500">{labels[score]}</p>
    </div>
  );
}

function CheckEmail({ email }: { email: string }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-20">
      <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-turf-50">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-turf-600" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Check your inbox</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          We sent a confirmation link to <span className="font-semibold text-ink">{email}</span>. Click it to activate your account.
        </p>
        <p className="mt-4 text-xs text-zinc-400">The email may take a minute or two. Check your spam folder if you don't see it.</p>
        <div className="mt-6 border-t border-line pt-5">
          <Link href="/login" className="text-sm font-medium text-turf-700 hover:underline">Back to log in</Link>
        </div>
      </div>
    </div>
  );
}

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

  const canSubmit = !busy && !!firstName.trim() && !!lastName.trim() && !!email.trim() && !!phone.trim() && password.length >= 8;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { role, first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() },
      },
    });
    setBusy(false);
    if (authError) { setError(authError.message); return; }
    if (data.session) { router.push("/dashboard"); router.refresh(); }
    else { setCheckEmail(true); }
  }

  if (checkEmail) return <CheckEmail email={email} />;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-4 py-12 sm:py-18">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Create your account</h1>
        <p className="mt-2 text-zinc-600">Takes under a minute. Choose your role first — it shapes your dashboard.</p>
      </div>

      <section>
        <p className="mb-3 text-sm font-semibold text-ink">I am a&hellip;</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={cn(
                "relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all",
                role === r.value ? "border-turf-600 bg-turf-50 ring-1 ring-turf-600" : "border-line bg-white hover:border-zinc-300 hover:bg-mist/50"
              )}
            >
              <span className="mb-2 text-xl">{r.icon}</span>
              <span className="text-sm font-semibold text-ink">{r.title}</span>
              <span className="mt-1 text-[11px] leading-relaxed text-zinc-500">{r.blurb}</span>
              {r.free && (
                <span className="mt-2 rounded-full bg-turf-50 px-2 py-0.5 text-[10px] font-semibold text-turf-700">Free</span>
              )}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-8 space-y-5 rounded-2xl border border-line bg-white p-6 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="first">First name</Label>
            <Input id="first" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Sarah" />
          </div>
          <div>
            <Label htmlFor="last">Last name</Label>
            <Input id="last" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Williams" />
          </div>
        </div>
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.co.nz" />
        </div>
        <div>
          <Label htmlFor="phone">Mobile number</Label>
          <Input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="021 123 4567" />
          {role === "trainer" && <Hint>Trainers are verified instantly when this matches the NZTR people registry.</Hint>}
          {role === "agent" && <Hint>We match this against the NZTR registry, then an admin approves agent accounts manually.</Hint>}
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="At least 8 characters"
          />
          <PasswordStrength password={password} />
        </div>
        {role === "jockey" && (
          <div className="rounded-xl bg-turf-50 px-4 py-3 text-sm text-turf-800">
            <p className="font-semibold">100-day free trial, then $40 NZD/mo</p>
            <p className="mt-0.5 text-xs text-turf-700">Your profile goes public once verified by our team. No card needed to start.</p>
          </div>
        )}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button className="w-full" variant="accent" onClick={submit} disabled={!canSubmit}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
        <p className="text-center text-xs text-zinc-400">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline hover:text-zinc-600">Terms of Service</Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-zinc-600">Privacy Policy</Link>.
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-turf-700 underline">Log in</Link>
      </p>
    </div>
  );
                                     }
