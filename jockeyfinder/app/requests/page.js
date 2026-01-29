"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const STATUS_LABEL = {
  requested: "Requested",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
};

export default function RequestsPage() {
  const [msg, setMsg] = useState("");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [incoming, setIncoming] = useState([]); // jockey incoming requests
  const [outgoing, setOutgoing] = useState([]); // trainer outgoing requests

  const isApprovedJockey = useMemo(() => {
    return profile?.role === "jockey" && profile?.status === "approved";
  }, [profile]);

  const isApprovedTrainer = useMemo(() => {
    return profile?.role === "trainer" && profile?.status === "approved";
  }, [profile]);

  async function load() {
    setMsg("Loading...");

    const { data: authData } = await supabase.auth.getUser();
    const u = authData?.user || null;
    setUser(u);

    if (!u) {
      setMsg("Please log in first.");
      return;
    }

    const { data: p, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, role, status, email")
      .eq("id", u.id)
      .single();

    if (pErr) {
      setMsg("Profile error: " + pErr.message);
      return;
    }
    setProfile(p);

    // Owners are view-only: they can view meetings, but not requests
    if (p.role === "owner") {
      setIncoming([]);
      setOutgoing([]);
      setMsg("Owners are view-only and cannot view or manage ride requests.");
      return;
    }

    // Incoming requests for jockey
    if (p.role === "jockey") {
      const { data: reqs, error } = await supabase
        .from("ride_requests")
        .select("id, meeting_id, trainer_id, jockey_id, horse, race_number, note, status, created_at")
        .eq("jockey_id", u.id)
        .order("created_at", { ascending: false });

      if (error) {
        setMsg("Load requests error: " + error.message);
        return;
      }

      const enriched = await enrichRequests(reqs || []);
      setIncoming(enriched);
      setOutgoing([]);
      setMsg("");
      return;
    }

    // Outgoing requests for trainer
    if (p.role === "trainer") {
      const { data: reqs, error } = await supabase
        .from("ride_requests")
        .select("id, meeting_id, trainer_id, jockey_id, horse, race_number, note, status, created_at")
        .eq("trainer_id", u.id)
        .order("created_at", { ascending: false });

      if (error) {
        setMsg("Load requests error: " + error.message);
        return;
      }

      const enriched = await enrichRequests(reqs || []);
      setOutgoing(enriched);
      setIncoming([]);
      setMsg("");
      return;
    }

    // Admin can see all (optional)
    if (p.role === "admin") {
      const { data: reqs, error } = await supabase
        .from("ride_requests")
        .select("id, meeting_id, trainer_id, jockey_id, horse, race_number, note, status, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setMsg("Load requests error: " + error.message);
        return;
      }

      const enriched = await enrichRequests(reqs || []);
      setIncoming(enriched);
      setOutgoing([]);
      setMsg("");
      return;
    }

    setMsg("");
  }

  async function enrichRequests(reqs) {
    const meetingIds = [...new Set(reqs.map((r) => r.meeting_id).filter(Boolean))];
    const trainerIds = [...new Set(reqs.map((r) => r.trainer_id).filter(Boolean))];
    const jockeyIds = [...new Set(reqs.map((r) => r.jockey_id).filter(Boolean))];

    let meetingsMap = {};
    if (meetingIds.length) {
      const { data: meets } = await supabase
        .from("meetings")
        .select("id, meeting_date, track")
        .in("id", meetingIds);

      (meets || []).forEach((m) => (meetingsMap[m.id] = m));
    }

    let profMap = {};
    const allIds = [...new Set([...trainerIds, ...jockeyIds])];
    if (allIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, role, status")
        .in("id", allIds);

      (profs || []).forEach((p) => (profMap[p.id] = p));
    }

    return reqs.map((r) => ({
      ...r,
      meeting: meetingsMap[r.meeting_id] || null,
      trainerProfile: profMap[r.trainer_id] || null,
      jockeyProfile: profMap[r.jockey_id] || null,
    }));
  }

  // ✅ Accept = sets request accepted AND marks jockey booked for that meeting
  async function setRequestStatus(requestId, newStatus, meetingId) {
    if (!user || !profile) return;

    if (profile.role !== "jockey") {
      setMsg("Only jockeys can accept or decline requests.");
      return;
    }

    if (profile.status !== "approved") {
      setMsg("You must be approved before accepting or declining requests.");
      return;
    }

    setMsg("Updating...");

    // 1) Update the request
    const { error: reqErr } = await supabase
      .from("ride_requests")
      .update({ status: newStatus })
      .eq("id", requestId);

    if (reqErr) {
      setMsg("Update error: " + reqErr.message);
      return;
    }

    // 2) If accepted: set availability to booked in meeting_attendance
    if (newStatus === "accepted") {
      // We use UPSERT so it works even if the jockey forgot to click "I am attending"
      const { error: attErr } = await supabase.from("meeting_attendance").upsert(
        [
          {
            meeting_id: meetingId,
            user_id: user.id,
            attending: true,
            availability: "booked",
          },
        ],
        { onConflict: "meeting_id,user_id" }
      );

      if (attErr) {
        setMsg("Booked update error: " + attErr.message);
        return;
      }
    }

    setMsg("Updated ✅");
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "Arial" }}>
      <a href="/" style={{ fontWeight: 700 }}>
        ← Back home
      </a>

      <h1 style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>Ride Requests</h1>

      <div style={{ marginTop: 10, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <div>
          Logged in as: <b>{profile?.full_name || "..."}</b> ({profile?.role || "..."}) | status:{" "}
          {profile?.status || "..."}
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
          <a href="/meetings" style={{ fontWeight: 700 }}>
            Go to /meetings
          </a>
        </div>
      </div>

      <p style={{ marginTop: 12 }}>{msg}</p>

      {profile?.role === "jockey" && (
        <section style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Incoming requests (for you)</h2>

          {!isApprovedJockey && (
            <div style={{ marginTop: 10, padding: 10, border: "1px solid #f0c", borderRadius: 8 }}>
              You are not approved yet. Admin must approve you before you can accept or decline ride requests.
            </div>
          )}

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {incoming.map((r) => (
              <div
                key={r.id}
                style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, display: "grid", gap: 6 }}
              >
                <div style={{ fontWeight: 800 }}>
                  {r.meeting ? `${r.meeting.track} | ${r.meeting.meeting_date}` : `Meeting: ${r.meeting_id}`}
                </div>

                <div style={{ opacity: 0.85 }}>
                  From trainer: <b>{r.trainerProfile?.full_name || r.trainer_id}</b>
                </div>

                <div style={{ opacity: 0.85 }}>
                  Horse: <b>{r.horse || "-"}</b> | Race: <b>{r.race_number || "-"}</b>
                </div>

                {r.note && <div style={{ opacity: 0.9 }}>Note: {r.note}</div>}

                <div style={{ fontWeight: 800 }}>
                  Status: <span style={{ textTransform: "capitalize" }}>{STATUS_LABEL[r.status] || r.status}</span>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  <button
                    onClick={() => setRequestStatus(r.id, "accepted", r.meeting_id)}
                    disabled={!isApprovedJockey || r.status !== "requested"}
                    style={{ padding: 10, fontWeight: 800 }}
                    title={r.status !== "requested" ? "Only requested items can be accepted." : "Accept request"}
                  >
                    Accept
                  </button>

                  <button
                    onClick={() => setRequestStatus(r.id, "declined", r.meeting_id)}
                    disabled={!isApprovedJockey || r.status !== "requested"}
                    style={{ padding: 10, fontWeight: 800 }}
                    title={r.status !== "requested" ? "Only requested items can be declined." : "Decline request"}
                  >
                    Decline
                  </button>

                  <a href={`/meetings/${r.meeting_id}`} style={{ fontWeight: 700, padding: 10 }}>
                    View meeting
                  </a>
                </div>
              </div>
            ))}

            {incoming.length === 0 && <div style={{ opacity: 0.8 }}>No incoming ride requests yet.</div>}
          </div>
        </section>
      )}

      {profile?.role === "trainer" && (
        <section style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>My outgoing requests</h2>

          {!isApprovedTrainer && (
            <div style={{ marginTop: 10, padding: 10, border: "1px solid #f0c", borderRadius: 8 }}>
              You are not approved yet. Only approved trainers should be able to request rides.
            </div>
          )}

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {outgoing.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 12,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  {r.meeting ? `${r.meeting.track} | ${r.meeting.meeting_date}` : `Meeting: ${r.meeting_id}`}
                </div>

                <div style={{ opacity: 0.85 }}>
                  To jockey: <b>{r.jockeyProfile?.full_name || r.jockey_id}</b>
                </div>

                <div style={{ opacity: 0.85 }}>
                  Horse: <b>{r.horse || "-"}</b> | Race: <b>{r.race_number || "-"}</b>
                </div>

                {r.note && <div style={{ opacity: 0.9 }}>Note: {r.note}</div>}

                <div style={{ fontWeight: 800 }}>
                  Status: <span style={{ textTransform: "capitalize" }}>{STATUS_LABEL[r.status] || r.status}</span>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  <a href={`/meetings/${r.meeting_id}`} style={{ fontWeight: 700 }}>
                    View meeting
                  </a>
                </div>
              </div>
            ))}

            {outgoing.length === 0 && <div style={{ opacity: 0.8 }}>No outgoing requests yet.</div>}
          </div>
        </section>
      )}

      {profile?.role === "owner" && (
        <section style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          Owners are view-only. You can browse meetings, but you cannot view or manage ride requests.
        </section>
      )}
    </main>
  );
}
