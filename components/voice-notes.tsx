"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDateTime } from "@/lib/utils";

export interface VoiceNote {
  id: string;
  url: string | null;
  kind: string;
  created_at: string;
  sender_id: string | null;
  duration_s: number | null;
}

const KIND_LABEL: Record<string, string> = {
  pre_race: "Pre-race",
  post_race: "Post-race",
  note: "Note",
};

const MAX_SECONDS = 60;

export function VoiceNotes({
  threadId,
  meId,
  initialNotes,
  senders,
}: {
  threadId: string;
  meId: string;
  initialNotes: VoiceNote[];
  senders: Record<string, { name: string; photo: string | null }>;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"pre_race" | "post_race" | "note">("pre_race");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  async function start() {
    setErr(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErr("Recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void upload(secondsRef.current);
      };
      recRef.current = rec;
      secondsRef.current = 0;
      setSeconds(0);
      rec.start();
      setRecording(true);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_SECONDS) stop();
      }, 1000);
    } catch {
      setErr("Couldn't access your microphone.");
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    if (recRef.current && recRef.current.state === "recording") recRef.current.stop();
  }

  async function upload(duration: number) {
    setBusy(true);
    setErr(null);
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const supabase = createClient();
    const path = `${threadId}/${crypto.randomUUID()}.webm`;
    const { error: upErr } = await supabase.storage
      .from("voice-notes")
      .upload(path, blob, { contentType: "audio/webm" });
    if (upErr) {
      setErr("Upload failed. Please try again.");
      setBusy(false);
      return;
    }
    const { error: insErr } = await supabase.from("voice_notes").insert({
      thread_id: threadId,
      sender_id: meId,
      kind,
      audio_path: path,
      duration_s: duration || null,
    });
    setBusy(false);
    if (insErr) {
      setErr("Couldn't save the note.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Voice notes</h2>
        <div className="flex items-center gap-1.5">
          {(["pre_race", "post_race", "note"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              disabled={recording || busy}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                kind === k ? "bg-ink text-white" : "border border-line text-zinc-500 hover:bg-mist"
              )}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {initialNotes.length > 0 ? (
        <div className="mt-3 space-y-2">
          {initialNotes.map((n) => (
            <div key={n.id} className="rounded-xl border border-line bg-mist/40 px-3 py-2">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-turf-50 px-2 py-0.5 text-[10px] font-semibold text-turf-700">
                  {KIND_LABEL[n.kind] ?? "Note"}
                </span>
                <span className="text-xs text-zinc-500">
                  {n.sender_id ? senders[n.sender_id]?.name ?? "Member" : "Member"} · {formatDateTime(n.created_at)}
                </span>
              </div>
              {n.url ? (
                <audio controls preload="none" src={n.url} className="h-9 w-full" />
              ) : (
                <p className="text-xs text-zinc-400">Audio unavailable.</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-400">No voice notes yet.</p>
      )}

      <div className="mt-3 flex items-center gap-3">
        {!recording ? (
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-turf-600 px-4 py-2 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-50"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-white" />
            {busy ? "Saving…" : "Record"}
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-sm bg-white" />
            Stop · {seconds}s
          </button>
        )}
        <span className="text-xs text-zinc-400">Up to {MAX_SECONDS}s, shared with everyone in this chat.</span>
      </div>
      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
