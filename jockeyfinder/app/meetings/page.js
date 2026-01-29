"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function yyyyMmDd(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function labelDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

export default function MeetingsPublicPage() {
  const [msg, setMsg] = useState("");
  const [meetings, setMeetings] = useState([]);
  const [attendanceByMeeting, setAttendanceByMeeting] = useState({}); // meeting_id -> [attendees]

  const rangeLabel = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30);
    return `${labelDate(start.toISOString())} → ${labelDate(end.toISOString())}`;
  }, []);

  async function load() {
    setMsg("Loading race days...");

    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30);

    const startStr = yyyyMmDd(start);
    const endStr = yyyyMmDd(end);

    // Public: next 30 days only
    const { data: m, error: mErr } = await supabase
      .from("meetings")
      .select("id, meeting_date, track, club, nztr_day_id")
      .gte("meeting_date", startStr)
      .lte("meeting_date", endStr)
      .order("meeting_date", { ascending: true });

    if (mErr) {
      setMsg("Meetings error: " + mErr.message);
      return;
    }

    setMeetings(m || []);

    const ids = (m || []).map((x) => x.id);
    if (ids.length === 0) {
      setAttendanceByMeeting({});
      setMsg("");
      return;
    }

    // Public view (only verified jockeys should appear — enforced by DB view policy)
    const { data: a, error: aErr } = await supabase
      .from("public_meeting_attendance")
      .select("meeting_id, jockey_id, first_name, last_name, riding_weight, apprentice, apprentice_claim")
      .in("meeting_id", ids);

    if (aErr) {
      // If this fails, it's almost always missing the view/policy in Supabase.
      setMsg("Attendance error: " + aErr.message);
      setAttendanceByMeeting({});
      return;
    }

    const map = {};
    (a || []).forEach((row) => {
      if (!map[row.meeting_id]) map[row.meeting_id] = [];
      map[row.meeting_id].push(row);
    });

    // sort jockeys by name
    Object.keys(map).forEach((mid) => {
      map[mid].sort((x, y) => {
        const ax = `${x.last_name || ""} ${x.first_name || ""}`.toLowerCase();
        const ay = `${y.last_name || ""} ${y.first_name || ""}`.toLowerCase();
        return ax.localeCompare(ay);
      });
    });

    setAttendanceByMeeting(map);
    setMsg("");
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ maxWidth: 980, margin: "30px auto", padding: "0 14px", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>Race Days</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="/" style={{ fontWeight: 800 }}>Home</a>
          <a href="/login" style={{ fontWeight: 800 }}>Log in</a>
          <a href="/signup" style={{ fontWeight: 800 }}>Sign up</a>
        </div>
      </div>

      <div style={{ marginTop: 8, opacity: 0.75 }}>Showing: {rangeLabel} (next 30 days)</div>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {meetings.map((m) => {
          const attendees = attendanceByMeeting[m.id] || [];
          return (
            <div key={m.id} style={{ border: "1px solid #e7e7e7", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{m.track || "Meeting"}</div>
                  <div style={{ opacity: 0.8 }}>{labelDate(m.meeting_date)} {m.club ? `• ${m.club}` : ""}</div>
                </div>

                <a href={`/meetings/${m.id}`} style={{ fontWeight: 900 }}>
                  View meeting →
                </a>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  Jockeys attending ({attendees.length})
                </div>

                {attendees.length === 0 ? (
                  <div style={{ opacity: 0.7 }}>No verified jockeys have marked attending yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {attendees.map((a) => (
                      <div
                        key={a.jockey_id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          border: "1px solid #f0f0f0",
                          borderRadius: 12,
                          padding: 10,
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>
                          {a.first_name || ""} {a.last_name || ""}
                        </div>
                        <div style={{ opacity: 0.9 }}>
                          {a.riding_weight ? `${a.riding_weight}kg` : "—"}{" "}
                          {a.apprentice ? `• claim ${a.apprentice_claim ?? "—"}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {meetings.length === 0 && !msg && (
          <div style={{ opacity: 0.8 }}>No meetings found in the next 30 days.</div>
        )}
      </div>
    </main>
  );
}
