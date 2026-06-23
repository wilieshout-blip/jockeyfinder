"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  setUserVerification,
  setUserRole,
  deleteUser,
  sendTestSignupEmail,
} from "@/app/admin/actions";

export interface AdminUser {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  verification_status: string | null;
  verified: boolean | null;
  registry_match: boolean | null;
  is_test: boolean | null;
  is_placeholder: boolean | null;
  created_at: string | null;
}

const ROLES = ["jockey", "trainer", "owner", "agent", "admin"];

function statusTone(s: string | null) {
  if (s === "approved") return "bg-turf-100 text-turf-700";
  if (s === "rejected") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

export function AdminUsersTable({ users }: { users: AdminUser[] }) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [testPending, startTest] = useTransition();
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && (u.verification_status ?? "pending") !== statusFilter) return false;
      if (!q) return true;
      return [u.full_name, u.email, u.phone].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [users, query, roleFilter, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: users.length };
    for (const u of users) c[u.role ?? "?"] = (c[u.role ?? "?"] ?? 0) + 1;
    return c;
  }, [users]);

  function runTest() {
    setTestMsg(null);
    startTest(async () => {
      const r = await sendTestSignupEmail();
      setTestMsg(r.ok ? "Test email sent — check your inbox." : "Failed to send (check Resend config).");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Users</h1>
          <p className="text-sm text-zinc-500">
            {counts.all} total · {counts.jockey ?? 0} jockeys · {counts.trainer ?? 0} trainers ·{" "}
            {counts.owner ?? 0} owners · {counts.agent ?? 0} agents
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={runTest}
            disabled={testPending}
            className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {testPending ? "Sending…" : "Send test signup email"}
          </button>
          {testMsg ? <span className="text-xs text-zinc-500">{testMsg}</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, phone"
          className="flex-1 min-w-[200px] rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-turf-500"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <option value="all">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-mist text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2.5">User</th>
              <th className="px-3 py-2.5">Role</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Verification</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((u) => (
              <tr key={u.id} className="align-top">
                <td className="px-3 py-3">
                  <p className="font-semibold text-ink">
                    {u.full_name || "—"}
                    {u.is_test ? <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">test</span> : null}
                    {u.is_placeholder ? <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">placeholder</span> : null}
                  </p>
                  <p className="text-xs text-zinc-500">{u.email || "no email"}</p>
                  <p className="text-xs text-zinc-400">{u.phone || ""}{u.registry_match ? " · registry ✓" : ""}</p>
                </td>
                <td className="px-3 py-3">
                  <form action={setUserRole} className="flex items-center gap-1">
                    <input type="hidden" name="user_id" value={u.id} />
                    <select name="role" defaultValue={u.role ?? "jockey"} className="rounded-lg border border-line bg-white px-2 py-1 text-xs">
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button className="rounded-lg border border-line px-2 py-1 text-xs text-zinc-600 hover:bg-mist">Save</button>
                  </form>
                </td>
                <td className="px-3 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", statusTone(u.verification_status))}>
                    {u.verification_status ?? "pending"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(["approved", "rejected", "pending"] as const).map((s) => (
                      <form key={s} action={setUserVerification}>
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="status" value={s} />
                        <button
                          className={cn(
                            "rounded-lg px-2 py-1 text-xs font-medium",
                            (u.verification_status ?? "pending") === s
                              ? "bg-ink text-white"
                              : "border border-line text-zinc-600 hover:bg-mist"
                          )}
                        >
                          {s === "approved" ? "Approve" : s === "rejected" ? "Reject" : "Pending"}
                        </button>
                      </form>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <form
                    action={deleteUser}
                    onSubmit={(e) => {
                      if (!confirm(`Delete ${u.full_name || u.email || "this user"}? This cannot be undone.`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="user_id" value={u.id} />
                    <button className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-zinc-400">No users match.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
