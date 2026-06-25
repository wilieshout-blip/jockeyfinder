"use client";

import { useState, useTransition } from "react";
import { sendBroadcast } from "@/app/admin/actions";
import { AUDIENCES, EMAIL_TEMPLATES, type Audience } from "@/lib/email-templates";

interface Props {
  audienceCounts: Record<string, number>;
}

function personalize(s: string) {
  return s.replace(/\{\{first_name\}\}/g, "there");
}

export function AdminBroadcast({ audienceCounts }: Props) {
  const [audience, setAudience] = useState<Audience>("all");
  const [templateId, setTemplateId] = useState(EMAIL_TEMPLATES[0]?.id ?? "");
  const [subject, setSubject] = useState(EMAIL_TEMPLATES[0]?.subject ?? "");
  const [body, setBody] = useState(EMAIL_TEMPLATES[0]?.body ?? "");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = audienceCounts[audience] ?? 0;
  const audienceLabel = AUDIENCES.find((a) => a.value === audience)?.label ?? "users";

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = EMAIL_TEMPLATES.find((x) => x.id === id);
    if (t) {
      setSubject(t.subject);
      setBody(t.body);
      setAudience(t.suggestedAudience);
    }
    setResult(null);
    setError(null);
  }

  function handleSend() {
    setResult(null);
    setError(null);
    if (!subject.trim() || !body.trim()) {
      setError("Add a subject and body first.");
      return;
    }
    const ok = window.confirm(
      `Send this email to ${count} ${audienceLabel.toLowerCase()} (everyone who hasn't opted out)? This sends real email and can't be undone.`
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await sendBroadcast({ audience, subject, body });
      if (res.ok) {
        setResult(`Sent to ${res.sent} of ${res.total} recipient${res.total === 1 ? "" : "s"}.`);
      } else {
        setError(res.error ?? "Failed to send.");
      }
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Audience
          </label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as Audience)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
          >
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label} ({audienceCounts[a.value] ?? 0})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            {count} eligible recipient{count === 1 ? "" : "s"} — excludes opted-out, suspended,
            rejected and test accounts.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Template
          </label>
          <select
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
          >
            {EMAIL_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Subject
          </label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Body (HTML)
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 font-mono text-xs leading-relaxed"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Use <code className="rounded bg-mist px-1">{"{{first_name}}"}</code> to personalise.
            It&apos;s wrapped in the branded JockeyFinder email shell automatically.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSend}
            disabled={pending}
            className="rounded-xl bg-turf-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-50"
          >
            {pending ? "Sending…" : `Send to ${count} ${audienceLabel.toLowerCase()}`}
          </button>
          {result ? <span className="text-sm font-medium text-turf-700">{result}</span> : null}
          {error ? <span className="text-sm font-medium text-red-600">{error}</span> : null}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview</p>
        <div className="rounded-2xl border border-line bg-[#0b3d2e] p-4">
          <div className="mx-auto max-w-[520px] overflow-hidden rounded-2xl bg-white">
            <div className="h-1 bg-[#16a34a]" />
            <div className="px-6 py-6">
              <p className="mb-3 text-sm font-semibold text-zinc-500">
                Subject: <span className="text-ink">{personalize(subject) || "(no subject)"}</span>
              </p>
              <div
                className="prose-sm text-sm text-zinc-700"
                // Admin-authored content rendered for preview only.
                dangerouslySetInnerHTML={{ __html: personalize(body) }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
