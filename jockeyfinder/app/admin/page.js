"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminPage() {
  const [msg, setMsg] = useState("");
  const [profile, setProfile] = useState(null);

  async function loadProfile() {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;

    if (!user) {
      setMsg("Not logged in");
      return;
    }

    const { data: p, error } = await supabase
      .from("profiles")
      .select("full_name, role, status")
      .eq("id", user.id)
      .single();

    if (error) {
      setMsg("Profile error: " + error.message);
      return;
    }

    setProfile(p);

    if (p.role !== "admin") {
      setMsg("Access denied. Admins only.");
    } else {
      setMsg("");
    }
  }

  async function syncMeetings() {
    setMsg("Syncing meetings from LoveRacing…");

    try {
      const res = await fetch(
        "/api/loveracing/sync?start=01-Jan-2026&end=31-Jan-2026"
      );
      const data = await res.json();

      if (!data.ok) {
        setMsg("Sync error: " + (data.error || "unknown"));
        return;
      }

      setMsg(`✅ Synced ${data.inserted} meetings successfully`);
    } catch (e) {
      setMsg("Network error: " + e.message);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  return (
    <main style={{ maxWidth: 700, margin: "40px auto", fontFamily: "Arial" }}>
      <h1 style={{ fontSize: 30, fontWeight: 800 }}>Admin</h1>

      {profile && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 10,
          }}
        >
          <div>
            Logged in as: <b>{profile.full_name}</b>
          </div>
          <div>
            Role: <b>{profile.role}</b> | Status: {profile.status}
          </div>
        </div>
      )}

      <p style={{ marginTop: 12 }}>{msg}</p>

      {profile?.role === "admin" && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 10,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            Data sync
          </h2>

          <button
            onClick={syncMeetings}
            style={{ marginTop: 12, padding: 12, fontWeight: 800 }}
          >
            Sync meetings from LoveRacing
          </button>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <a href="/meetings" style={{ fontWeight: 700 }}>
          Go to meetings
        </a>
      </div>
    </main>
  );
}
