"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home({ initialMode } = {}) {
  const [mode, setMode] = useState(initialMode || "login"); // login | signup

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("jockey");
  const [phone, setPhone] = useState("");
  const [licenceFile, setLicenceFile] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [msg, setMsg] = useState("");
  const [sessionUser, setSessionUser] = useState(null);
  const [myProfile, setMyProfile] = useState(null);

  const needsVerification = role === "jockey" || role === "trainer";

  async function refreshSessionAndProfile() {
    const { data } = await supabase.auth.getUser();
    const u = data?.user || null;
    setSessionUser(u);

    if (!u) {
      setMyProfile(null);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, status, email, phone")
      .eq("id", u.id)
      .single();

    setMyProfile(profile || null);
  }

  useEffect(() => {
    refreshSessionAndProfile();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshSessionAndProfile();
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  async function login(e) {
    e.preventDefault();
    setMsg("Logging in...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMsg("Login error: " + error.message);
      return;
    }

    setMsg("Logged in ✅");
    await refreshSessionAndProfile();
  }

  async function logout() {
    setMsg("Logging out...");
    await supabase.auth.signOut();
    setMsg("Logged out ✅");
    setSessionUser(null);
    setMyProfile(null);
  }

  async function signUp(e) {
    e.preventDefault();
    setMsg("Creating account...");

    if (needsVerification && !licenceFile) {
      setMsg("Licence photo required for jockeys and trainers.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMsg("Signup error: " + error.message);
      return;
    }

    const user = data?.user;

    if (!user) {
      setMsg("Signup created. If email confirm is on, check your email.");
      return;
    }

    const profileStatus = needsVerification ? "pending" : "approved_viewonly";

    const { error: profileError } = await supabase.from("profiles").upsert(
      [
        {
          id: user.id,
          full_name: fullName,
          role,
          phone,
          status: profileStatus,
          email,
        },
      ],
      { onConflict: "id" }
    );

    if (profileError) {
      setMsg("Profile save error: " + profileError.message);
      return;
    }

    if (needsVerification) {
      setMsg("Uploading licence...");

      const ext = licenceFile.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("verification-docs")
        .upload(filePath, licenceFile);

      if (uploadError) {
        setMsg("Upload error: " + uploadError.message);
        return;
      }

      const docType = role === "trainer" ? "trainer_licence" : "jockey_licence";

      const { error: docError } = await supabase
        .from("verification_documents")
        .insert([
          {
            user_id: user.id,
            doc_type: docType,
            storage_path: filePath,
            status: "pending",
          },
        ]);

      if (docError) {
        setMsg("Verification save error: " + docError.message);
        return;
      }

      setMsg("Signup complete ✅ Pending verification.");
      await refreshSessionAndProfile();
      return;
    }

    setMsg("Signup complete ✅ Owner account (view-only).");
    await refreshSessionAndProfile();
  }

  const roleNow = myProfile?.role || "";
  const showRequests = roleNow === "jockey" || roleNow === "trainer";
  const showAdmin = roleNow === "admin";

  return (
    <main style={{ maxWidth: 620, margin: "40px auto", fontFamily: "Arial" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800 }}>JockeyFinder</h1>

      {sessionUser ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 10,
          }}
        >
          <div style={{ fontWeight: 700 }}>You are logged in ✅</div>
          <div>Email: {sessionUser.email}</div>
          <div>
            Role: <b>{myProfile?.role || "loading..."}</b>
          </div>
          <div>Status: {myProfile?.status || "loading..."}</div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <a
              href="/meetings"
              style={{
                padding: 12,
                fontWeight: 800,
                textAlign: "center",
                border: "1px solid #ddd",
                borderRadius: 10,
                textDecoration: "none",
              }}
            >
              Go to Meetings
            </a>

            {showRequests && (
              <a
                href="/requests"
                style={{
                  padding: 12,
                  fontWeight: 800,
                  textAlign: "center",
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  textDecoration: "none",
                }}
              >
                Go to Ride Requests
              </a>
            )}

            {showAdmin && (
              <a
                href="/admin"
                style={{
                  padding: 12,
                  fontWeight: 800,
                  textAlign: "center",
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  textDecoration: "none",
                }}
              >
                Go to Admin (verify users)
              </a>
            )}

            <button onClick={logout} style={{ padding: 12, fontWeight: 800 }}>
              Log out
            </button>
          </div>

          {roleNow === "owner" && (
            <div style={{ marginTop: 10, opacity: 0.8 }}>
              Owner accounts are view-only. You can browse meetings and see attendance.
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <button
            onClick={() => setMode("login")}
            style={{ padding: 10, fontWeight: mode === "login" ? 800 : 400 }}
          >
            Log in
          </button>
          <button
            onClick={() => setMode("signup")}
            style={{ padding: 10, fontWeight: mode === "signup" ? 800 : 400 }}
          >
            Sign up
          </button>
        </div>
      )}

      {!sessionUser && mode === "login" && (
        <form onSubmit={login} style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 10 }}
            required
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 10 }}
            required
          />
          <button style={{ padding: 12, fontWeight: 800 }} type="submit">
            Log in
          </button>
        </form>
      )}

      {!sessionUser && mode === "signup" && (
        <form onSubmit={signUp} style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <input
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{ padding: 10 }}
            required
          />

          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: 10 }}>
            <option value="jockey">Jockey (verified)</option>
            <option value="trainer">Trainer (verified)</option>
            <option value="owner">Horse Owner (view-only)</option>
          </select>

          <input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ padding: 10 }}
            required
          />

          {needsVerification && (
            <input type="file" accept="image/*" onChange={(e) => setLicenceFile(e.target.files[0])} />
          )}

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 10 }}
            required
          />

          <input
            placeholder="Password (6+ chars)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 10 }}
            required
          />

          <button style={{ padding: 12, fontWeight: 800 }} type="submit">
            Sign up
          </button>
        </form>
      )}

      <p style={{ marginTop: 16 }}>{msg}</p>
    </main>
  );
}
