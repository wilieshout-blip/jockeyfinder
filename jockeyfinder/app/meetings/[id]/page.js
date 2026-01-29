"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const AVAIL_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "booked", label: "Booked" },
  { value: "not_available", label: "Not available" },
];

export default function MeetingDetail({ params }) {
  const meetingId = params.id;

  const [msg, setMsg] = useState("");
  const [meeting, setMeeting] = useState(null);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [attRow, setAttRow] = useState(null);
  const [availability, setAvailability] = useState("available");
  const [note, setNote] = useState("");

  const [attendees, setAttendees] = useState([]);
  const [myRequests, setMyRequests] = useState([]); // trainer outgoing for this meeting

  const isVerifiedUser = useMemo(() => {
    if (!profile) return false;
    if (profile.role === "jockey" || profile.role === "trainer") {
      return profile.status === "approved";
    }
    return true;
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
      .select("role, status, full_name, email")
      .eq("id", u.id)
      .single();

    if (pErr) {
      setMsg("Profile error: " + pErr.message);
      return;
    }
    setProfile(p);

    const { data: m, error: mErr } = await supabase
      .from("meetings")
      .select("id, meeting_date, track")
      .eq("id", meetingId)
      .single();

    if (mErr) {
      setMsg("Meeting error: " + mErr.message);
      return;
    }
    setMeeting(m);

    const { data: myAtt } = await supabase
      .from("meeting_attendance")
      .select("id, attending, availability, note")
      .eq("meeting_id", meetingId)
      .eq("user_id", u.id)
      .maybeSingle();

    setAttRow(myAtt || null);
    setAvailability(myAtt?.availability || "available");
    setNote(myAtt?.note || "");

    // Load roster
    const { data: roster, error: rErr } = await supabase
      .from("meeting_attendance")
      .select("id, user_id, attending, availability, note, created_at")
      .eq("meeting_id", meetingId)
      .eq("attending", true)
      .order("created_at", { ascending: true });

    if (rErr) {
      setMsg("Roster error: " + rErr.message);
      return;
    }

    const userIds = (roster || []).map((x) => x.user_id);
    let profMap = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, role, status")
        .in("id", userIds);

      (profs || []).forEach((pp) => {
        profMap[pp.id] = pp;
      });
    }

    const merged = (roster || []).map((r) => ({
      ...r,
      profile: profMap[r.user_id] || null,
    }));

    setAttendees(merged);

    // If trainer, load outgoing requests for this meeting
    if (p.role === "trainer") {
      const { data: reqs } = await supabase
        .from("ride_requests")
        .select("id, jockey_id, horse, race_number, note, status, created_at")
        .eq("meeting_id", meetingId)
        .eq("trainer_id", u.id)
        .order("created_at", { ascending: false });

      setMyRequests(reqs || []);
    } else {
      setMyRequests([]);
    }

    setMsg("");
  }

  async function markAttending() {
    if (!user) return;
    if (!profile) return;

    if (profile.role === "jockey" || profile.role === "trainer") {
      if (profile.status !== "approved") {
        setMsg("You must be approved before marking attendance.");
        return;
      }
    } else if (profile.role === "owner") {
      setMsg("Owners are view-only.");
      return;
    }

    setMsg("Saving...");

    const { error } = await supabase.from("meeting_attendance").upsert(
      [
        {
          meeting_id: meetingId,
          user_id: user.id,
          attending: true,
          availability,
          note: note?.trim() || null,
        },
      ],
      { onConflict: "meeting_id,user_id" }
    );

    if (error) {
      setMsg("Save error: " + error.message);
      return;
    }

    setMsg("Saved ✅");
    await load();
  }

  async function markNotAttending() {
    if (!user) return;
    if (!profile) return;

    if (profile.role === "owner") {
      setMsg("Owners are view-only.");
      return;
    }

    setMsg("Updating...");

    const { error } = await supabase
      .from("meeting_attendance")
      .delete()
      .eq("meeting_id", meetingId)
      .eq("user_id", user.id);

    if (error) {
      setMsg("Update error: " + error.message);
      return;
    }

    setMsg("Removed ✅");
    await load();
  }

  function findTrainerRequestForJockey(jockeyId) {
    return (myRequests || []).find((r) => r.jockey_id === jockeyId) || null;
  }

  async function requestRide(jockeyId) {
    if (!user || !profile) return;

    if (!(profile.role === "trainer" && profile.status === "approved")) {
      setMsg("Only approved trainers can request rides.");
      return;
    }

    const horse = window.prompt("Horse name (optional):", "") || "";
    const raceStr = window.prompt("Race number (optional):", "") || "";
    const noteTxt = window.prompt("Note to jockey (optional):", "") || "";

    let raceNumber = null;
    if (raceStr.trim()) {
      const n = Number(raceStr.trim());
      if (!Number.isNaN(n)) raceNumber = n;
    }

    setMsg("Sending request...");

    const { error } = await supabase.from("ride_requests").insert([
      {
        meeting_id: meetingId,
        trainer_id: user.id,
        jockey_id: jockeyId,
        horse: horse.trim() || null,
        race_number: raceNumber,
        note: noteTxt.trim() || null,
        status: "requested",
      },
    ]);

    if (error) {
      setMsg("Request error: " + error.message);
      return;
    }

    setMsg("Request sent ✅");
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "Arial" }}>
      <a href="/meetings" style={{ fontWeight: 700 }}>
        ← Back to meetings
      </a>

      <h1 style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>
        {meeting ? `${meeting.track} | ${meeting.meeting_date}` : "Meeting"}
      </h1>

      <div
        style={{
          marginTop: 10,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
        }}
      >
        <div>
          Logged in as: <b>{profile?.full_name || "..."}</b> ({profile?.role || "..."}) | status:{" "}
          {profile?.status || "..."}
        </div>

        <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
          <a href="/requests" style={{ fontWeight: 700 }}>
            Go to /requests
          </a>
        </div>

        {profile?.role === "owner" && (
          <div style={{ marginTop: 6, opacity: 0.8 }}>Owner accounts are view-only.</div>
        )}
      </div>

      <p style={{ marginTop: 12 }}>{msg}</p>

      <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>My attendance</h2>

        {profile?.role === "owner" ? (
          <div style={{ marginTop: 8 }}>Owners cannot mark attendance.</div>
        ) : (
          <>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <label style={{ fontWeight: 700 }}>Availability</label>
              <select
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                style={{ padding: 10 }}
                disabled={!isVerifiedUser}
              >
                {AVAIL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <label style={{ fontWeight: 700 }}>Note (optional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Example: can do 54kg, prefer Te Rapa"
                style={{ padding: 10 }}
                disabled={!isVerifiedUser}
              />

              {(profile?.role === "jockey" || profile?.role === "trainer") &&
                profile?.status !== "approved" && (
                  <div style={{ padding: 10, border: "1px solid #f0c", borderRadius: 8 }}>
                    You are not approved yet. Admin must approve you before you can mark attendance.
                  </div>
                )}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <button
                onClick={markAttending}
                style={{ padding: 12, fontWeight: 800 }}
                disabled={!isVerifiedUser}
              >
                I am attending
              </button>
              <button onClick={markNotAttending} style={{ padding: 12, fontWeight: 800 }}>
                I am not attending
              </button>
            </div>

            {attRow && (
              <div style={{ marginTop: 10, opacity: 0.8 }}>
                You are marked attending as: <b>{attRow.availability}</b>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
          Attending list (with availability)
        </h2>

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {attendees.map((a) => {
            const isJockey = a.profile?.role === "jockey";
            const canRequest =
              isApprovedTrainer && isJockey && a.profile?.status === "approved" && a.availability === "available";

            const existing = isApprovedTrainer ? findTrainerRequestForJockey(a.user_id) : null;

            return (
              <div
                key={a.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 160px 1fr",
                  gap: 10,
                  padding: 10,
                  border: "1px solid #eee",
                  borderRadius: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{a.profile?.full_name || a.user_id}</div>
                  <div style={{ opacity: 0.75 }}>
                    {a.profile?.role || "unknown"} | status: {a.profile?.status || "?"}
                  </div>
                </div>

                <div style={{ fontWeight: 800, textTransform: "capitalize" }}>
                  {a.availability.replace("_", " ")}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ opacity: 0.9 }}>{a.note || ""}</div>

                  {isApprovedTrainer && (
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {existing ? (
                        <div style={{ fontWeight: 700 }}>
                          Request status: {existing.status}
                          {existing.horse ? ` | Horse: ${existing.horse}` : ""}
                          {existing.race_number ? ` | Race: ${existing.race_number}` : ""}
                        </div>
                      ) : (
                        <div style={{ opacity: 0.75 }}>No request yet</div>
                      )}

                      <button
                        onClick={() => requestRide(a.user_id)}
                        disabled={!canRequest || !!existing}
                        style={{ padding: 10, fontWeight: 800 }}
                        title={
                          existing
                            ? "You already requested this jockey for this meeting."
                            : canRequest
                            ? "Request ride"
                            : "Only available, approved jockeys can be requested"
                        }
                      >
                        Request ride
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {attendees.length === 0 && (
            <div style={{ marginTop: 8, opacity: 0.8 }}>No one has marked attending yet.</div>
          )}
        </div>
      </div>
    </main>
  );
}
