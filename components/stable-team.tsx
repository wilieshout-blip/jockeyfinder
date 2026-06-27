import { inviteStableMember, removeStableMember } from "@/app/dashboard/stable/actions";

export interface StableMember {
  id: string;
  role: string;
  invite_email: string | null;
  member_id: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
}

export function StableTeam({ members }: { members: StableMember[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-display font-semibold text-ink">Stable team</h2>
        <p className="mt-0.5 text-xs text-zinc-400">
          Assistant trainers &amp; foremen share your ride requests under one operation.
        </p>
      </div>

      {members.length > 0 ? (
        <div className="divide-y divide-line">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {m.profiles?.full_name || m.invite_email || "Invited member"}
                  {!m.member_id ? (
                    <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">invited</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-zinc-400">
                  {m.profiles?.email || m.invite_email} · {m.role}
                </p>
              </div>
              <form action={removeStableMember}>
                <input type="hidden" name="id" value={m.id} />
                <button className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50">Remove</button>
              </form>
            </div>
          ))}
        </div>
      ) : null}

      <form action={inviteStableMember} className="flex flex-wrap items-center gap-2 px-5 py-4">
        <input
          name="email"
          type="email"
          placeholder="assistant@email.com"
          className="min-w-[180px] flex-1 rounded-lg border border-line px-2.5 py-1.5 text-sm"
        />
        <select name="role" className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm">
          <option value="assistant">Assistant trainer</option>
          <option value="foreman">Foreman</option>
        </select>
        <button className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700">Invite</button>
      </form>
    </section>
  );
}
