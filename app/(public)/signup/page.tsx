"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Hint, Input, Label } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";
import { friendlyAuthError } from "@/lib/auth-errors";
import type { Role } from "@/lib/types";

type LicenceType = "race_jockey" | "trial_jumpout_only";

const ROLES: {
  value: Role;
  title: string;
  blurb: string;
  icon: string;
  badge?: string;
}[] = [
  {
    value: "jockey",
    title: "Jockey",
    icon: "🏇",
    blurb: "Mark your race days, share weight & claim, receive ride offers.",
  },
  {
    value: "trainer",
    title: "Trainer",
    icon: "📋",
    blurb: "Find who's riding where and send structured ride requests.",
    badge: "Free until 1 Oct 2026",
  },
  {
    value: "owner",
    title: "Owner",
    icon: "🏆",
    blurb: "Follow your horses, runners, riders and stable activity.",
    badge: "Free until 1 Oct 2026",
  },
  {
    value: "agent",
    title: "Agent",
    icon: "🤝",
    blurb: "Manage multiple jockeys, their calendars and ride requests.",
  },
];

function PasswordStrength({ password }: { password: string }) {
  const len = password.length;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const score =
    (len >= 8 ? 1 : 0) +
    (len >= 12 ? 1 : 0) +
    (hasUpper ? 1 : 0) +
    (hasNumber ? 1 : 0);

  if (!password) return null;

  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const colours = [
    "bg-red-400",
    "bg-orange-400",
    "bg-amber-400",
    "bg-lime-500",
    "bg-turf-600",
  ];

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < score ? colours[score] : "bg-line"
            )}
          />
        ))}
      </div>
      <p className="text-[11px] text-zinc-500">{labels[score]}</p>
    </div>
  );
}

function CheckEmail({
  email,
  permitReminder,
}: {
  email: string;
  permitReminder: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-20">
      <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-turf-50">
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8 text-turf-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Check your inbox
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          We sent a confirmation link to{" "}
          <span className="font-semibold text-ink">{email}</span>. Click it to
          activate your account.
        </p>
        <p className="mt-4 text-xs text-zinc-400">
          The email may take a minute or two. Check your spam folder if you
          don&apos;t see it.
        </p>
        {permitReminder ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            After confirming your email, log in and upload your trial rider
            permit from your profile. We do not upload identity documents until
            the account is securely signed in.
          </p>
        ) : null}
        <div className="mt-6 border-t border-line pt-5">
          <Link
            href="/login"
            className="text-sm font-medium text-turf-700 hover:underline"
          >
            Back to log in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("jockey");
  const [licenceType, setLicenceType] = useState<LicenceType>("race_jockey");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [permitFile, setPermitFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isTrialRider = role === "jockey" && licenceType === "trial_jumpout_only";

  useEffect(() => {
    const requestedRole = new URLSearchParams(window.location.search).get("role");
    if (ROLES.some((candidate) => candidate.value === requestedRole)) {
      setRole(requestedRole as Role);
    }
  }, []);

  const canSubmit =
    !busy &&
    !!firstName.trim() &&
    !!lastName.trim() &&
    !!email.trim() &&
    !!phone.trim() &&
    password.length >= 8 &&
    password === confirmPassword &&
    (!isTrialRider || !!permitFile);

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();

    const metadata: Record<string, string> = {
      role,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim(),
    };
    if (role === "jockey") {
      metadata.licence_type = licenceType;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: metadata,
      },
    });

    if (authError) {
      setError(friendlyAuthError(authError, "Unable to create the account. Please try again."));
      setBusy(false);
      return;
    }

    // Upload trial rider permit (if applicable) before asking them to check email
    if (isTrialRider && permitFile && data.session) {
      const fd = new FormData();
      fd.append("file", permitFile);
      const res = await fetch("/api/upload/permit", { method: "POST", body: fd });
      if (!res.ok) {
        // Non-fatal: account is created; they can upload via dashboard
        console.warn("[signup] permit upload failed:", await res.text());
      }
    }

    setBusy(false);
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <CheckEmail
        email={email}
        permitReminder={isTrialRider && !!permitFile}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-4 py-12 sm:py-18">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Create your account
        </h1>
        <p className="mt-2 text-zinc-600">
          Takes under a minute. Choose your role first — it shapes your
          dashboard.
        </p>
      </div>

      {/* Role picker */}
      <section>
        <p className="mb-3 text-sm font-semibold text-ink">I am a&hellip;</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              aria-pressed={role === r.value}
              className={cn(
                "relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all",
                role === r.value
                  ? "border-turf-600 bg-turf-50 ring-1 ring-turf-600"
                  : "border-line bg-white hover:border-zinc-300 hover:bg-mist/50"
              )}
            >
              <span className="mb-2 text-xl" aria-hidden="true">{r.icon}</span>
              <span className="text-sm font-semibold text-ink">{r.title}</span>
              <span className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                {r.blurb}
              </span>
              {r.badge && (
                <span className="mt-2 rounded-full bg-turf-50 px-2 py-0.5 text-[10px] font-semibold text-turf-700">
                  {r.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Jockey licence sub-type */}
      {role === "jockey" && (
        <section className="mt-4">
          <p className="mb-2 text-sm font-semibold text-ink">Licence type</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setLicenceType("race_jockey")}
              aria-pressed={licenceType === "race_jockey"}
              className={cn(
                "flex flex-col items-start rounded-2xl border p-4 text-left transition-all",
                licenceType === "race_jockey"
                  ? "border-turf-600 bg-turf-50 ring-1 ring-turf-600"
                  : "border-line bg-white hover:border-zinc-300 hover:bg-mist/50"
              )}
            >
              <span className="mb-1 text-lg">🏆</span>
              <span className="text-sm font-semibold text-ink">Race jockey</span>
              <span className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                Full race licence — eligible for race days and trials.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setLicenceType("trial_jumpout_only")}
              aria-pressed={licenceType === "trial_jumpout_only"}
              className={cn(
                "flex flex-col items-start rounded-2xl border p-4 text-left transition-all",
                licenceType === "trial_jumpout_only"
                  ? "border-turf-600 bg-turf-50 ring-1 ring-turf-600"
                  : "border-line bg-white hover:border-zinc-300 hover:bg-mist/50"
              )}
            >
              <span className="mb-1 text-lg">🎽</span>
              <span className="text-sm font-semibold text-ink">Trial rider</span>
              <span className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                Track / trial permit — eligible for trials and jump-outs only.
              </span>
            </button>
          </div>
        </section>
      )}

      {/* Trial rider permit upload */}
      {isTrialRider && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Permit document required
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Upload your NZTR trial rider permit, licence, or official approval
            letter. Accepted formats: JPG, PNG, PDF (max 10 MB). Your account
            will be manually reviewed before you can request rides.
          </p>
          <div className="mt-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => setPermitFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
                permitFile
                  ? "border-turf-400 bg-turf-50 text-turf-800"
                  : "border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
              )}
            >
              {permitFile ? (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {permitFile.name}
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Choose file
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Details form */}
      <form
        className="mt-6 space-y-5 rounded-2xl border border-line bg-white p-6 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="first">First name</Label>
            <Input
              id="first"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Sarah"
              required
            />
          </div>
          <div>
            <Label htmlFor="last">Last name</Label>
            <Input
              id="last"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Williams"
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="email">Email address</Label>
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
          <Label htmlFor="phone">Mobile number</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="021 123 4567"
            required
          />
          {role === "trainer" && (
            <Hint>
              Trainers are verified instantly when this matches the NZTR people
              registry.
            </Hint>
          )}
          {role === "agent" && (
            <Hint>
              We match this against the NZTR registry, then an admin approves
              agent accounts manually.
            </Hint>
          )}
          {role === "jockey" && licenceType === "race_jockey" && (
            <Hint>
              Jockeys are matched against the NZTR registry. Your profile goes
              public once verified.
            </Hint>
          )}
          {isTrialRider && (
            <Hint>
              Trial rider accounts require manual approval. Upload your permit
              above and we&apos;ll review within 1–2 business days.
            </Hint>
          )}
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
          <PasswordStrength password={password} />
        </div>

        <div>
          <Label htmlFor="confirm-password">Confirm password</Label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Type it again"
            minLength={8}
            required
          />
          {confirmPassword && password !== confirmPassword ? (
            <p className="mt-1.5 text-xs text-red-600">Passwords do not match.</p>
          ) : null}
        </div>

        {role === "jockey" && !isTrialRider && (
          <div className="rounded-xl bg-turf-50 px-4 py-3 text-sm text-turf-800">
            <p className="font-semibold">100-day free trial, then $40 NZD/mo</p>
            <p className="mt-0.5 text-xs text-turf-700">
              Your profile goes public once verified by our team. No card needed
              to start.
            </p>
          </div>
        )}

        {isTrialRider && (
          <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            <p className="font-semibold">Trial rider — free account</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Trial riders can request rides at trials and jump-outs once approved.
              No subscription required.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          variant="accent"
          disabled={!canSubmit}
        >
          {busy
            ? "Creating account…"
            : isTrialRider && !permitFile
            ? "Upload permit to continue"
            : "Create account"}
        </Button>

        <p className="text-center text-xs text-zinc-400">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline hover:text-zinc-600">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-zinc-600">
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-turf-700 underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
