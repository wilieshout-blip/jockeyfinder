"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buttonClasses } from "@/components/ui/button";

/**
 * Shown to unverified users whose phone did not match the NZTR
 * register. Any photo ID works: licence, passport, NZTR licence card.
 * The file goes into a private bucket only admins can open.
 */
export function IdUploadForm({
  userId,
  uploadedAt,
}: {
  userId: string;
  uploadedAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Please keep the file under 10 MB.");
      return;
    }
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("identity-docs")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setBusy(false);
      setError(uploadError.message);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        id_document_path: path,
        id_document_uploaded_at: new Date().toISOString(),
      })
      .eq("id", userId);

    setBusy(false);
    if (profileError) {
      setError(profileError.message);
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-white/60 p-3">
      {done || uploadedAt ? (
        <p className="text-sm text-amber-900">
          <span className="font-semibold">ID received.</span> The team will
          review it shortly. You can upload a clearer photo any time below.
        </p>
      ) : (
        <p className="text-sm text-amber-900">
          <span className="font-semibold">Speed things up:</span> upload a photo
          of any ID (driver licence, passport, or your NZTR licence card) and an
          admin will verify you from that. Only admins can see it.
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            disabled={busy}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <span className={buttonClasses("primary", "sm")}>
            {busy ? "Uploading..." : uploadedAt || done ? "Replace ID" : "Upload ID"}
          </span>
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
