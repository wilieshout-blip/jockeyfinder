import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/premium";
import { EmptyState } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/utils";
import { SyndicateHorseAdder } from "@/components/syndicate-horse-adder";
import {
  createSyndicate,
  deleteSyndicate,
  addSyndicateMember,
  removeSyndicateMember,
  removeSyndicateHorse,
  postSyndicateUpdate,
} from "./actions";

export const dynamic = "force-dynamic";

interface Member {
  id: string;
  user_id: string | null;
  invite_email: string | null;
  share_label: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
}
interface GroupHorse {
  horse_id: string;
  horses: { id: string; name: string } | null;
}
interface Update {
  id: string;
  body: string;
  created_at: string;
}
interface ManagedGroup {
  id: string;
  name: string;
  ownership_memberships: Member[];
  group_horses: GroupHorse[];
  syndicate_updates: Update[];
}

export default async function SyndicatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: managedRaw } = await supabase
    .from("ownership_groups")
    .select(
      "id, name, ownership_memberships(id, user_id, invite_email, share_label, profiles:profiles!user_id(full_name, email)), group_horses(horse_id, horses(id, name)), syndicate_updates(id, body, created_at)"
    )
    .eq("manager_id", user.id)
    .order("created_at", { ascending: false });
  const managed = (managedRaw ?? []) as unknown as ManagedGroup[];

  // Groups I'm a micro-owner in.
  const { data: memberRows } = await supabase
    .from("ownership_memberships")
    .select("share_label, ownership_groups(id, name, syndicate_updates(id, body, created_at))")
    .eq("user_id", user.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Ownership"
        title="Syndicates"
        description="Run an ownership group: add your horses, invite the micro-owners, and post one update that reaches everyone."
      />

      {/* Create */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink">Create a syndicate</h2>
        <form action={createSyndicate} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            name="name"
            placeholder="Syndicate name (e.g. Phar Lap Syndicate)"
            className="min-w-[240px] flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-turf-400"
          />
          <button className="rounded-xl bg-turf-600 px-4 py-2 text-sm font-semibold text-white hover:bg-turf-700">
            Create
          </button>
        </form>
      </section>

      {/* Managed groups */}
      {managed.length > 0 ? (
        <section className="space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Syndicates you manage</h2>
          {managed.map((g) => {
            const horseIds = g.group_horses.map((h) => h.horse_id);
            const updates = [...g.syndicate_updates].sort((a, b) => b.created_at.localeCompare(a.created_at));
            return (
              <div key={g.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <h3 className="font-display font-semibold text-ink">{g.name}</h3>
                  <form action={deleteSyndicate} className="shrink-0">
                    <input type="hidden" name="group_id" value={g.id} />
                    <button className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50">Delete</button>
                  </form>
                </div>

                <div className="grid gap-5 p-5 lg:grid-cols-2">
                  {/* Members */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Micro-owners · {g.ownership_memberships.length}
                    </p>
                    <div className="space-y-1.5">
                      {g.ownership_memberships.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">
                              {m.profiles?.full_name || m.invite_email || "Invited owner"}
                              {!m.user_id ? <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">invited</span> : null}
                            </p>
                            <p className="truncate text-xs text-zinc-400">
                              {m.profiles?.email || m.invite_email}{m.share_label ? ` · ${m.share_label}` : ""}
                            </p>
                          </div>
                          <form action={removeSyndicateMember}>
                            <input type="hidden" name="membership_id" value={m.id} />
                            <input type="hidden" name="group_id" value={g.id} />
                            <button className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50">Remove</button>
                          </form>
                        </div>
                      ))}
                      {g.ownership_memberships.length === 0 ? (
                        <p className="text-sm text-zinc-400">No micro-owners yet.</p>
                      ) : null}
                    </div>
                    <form action={addSyndicateMember} className="mt-3 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="group_id" value={g.id} />
                      <input name="email" type="email" placeholder="owner@email.com" className="min-w-[150px] flex-1 rounded-lg border border-line px-2.5 py-1.5 text-sm" />
                      <input name="share_label" placeholder="Share (e.g. 5%)" className="w-28 rounded-lg border border-line px-2.5 py-1.5 text-sm" />
                      <button className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700">Invite</button>
                    </form>
                  </div>

                  {/* Horses */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Horses · {g.group_horses.length}
                    </p>
                    <div className="space-y-1.5">
                      {g.group_horses.map((h) => (
                        <div key={h.horse_id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                          <p className="truncate text-sm font-medium text-ink">{h.horses?.name ?? "Horse"}</p>
                          <form action={removeSyndicateHorse}>
                            <input type="hidden" name="group_id" value={g.id} />
                            <input type="hidden" name="horse_id" value={h.horse_id} />
                            <button className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50">Remove</button>
                          </form>
                        </div>
                      ))}
                      {g.group_horses.length === 0 ? <p className="text-sm text-zinc-400">No horses yet.</p> : null}
                    </div>
                    <div className="mt-3">
                      <SyndicateHorseAdder groupId={g.id} existingIds={horseIds} />
                    </div>
                  </div>
                </div>

                {/* Post update */}
                <div className="border-t border-line bg-zinc-50 px-5 py-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Broadcast an update</p>
                  <form action={postSyndicateUpdate} className="space-y-2">
                    <input type="hidden" name="group_id" value={g.id} />
                    <textarea name="body" rows={2} placeholder="Write one update — it emails every micro-owner." className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
                    <button className="rounded-xl bg-turf-600 px-4 py-2 text-sm font-semibold text-white hover:bg-turf-700">Post &amp; notify owners</button>
                  </form>
                  {updates.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {updates.slice(0, 4).map((u) => (
                        <div key={u.id} className="rounded-lg border border-line bg-white px-3 py-2">
                          <p className="whitespace-pre-wrap text-sm text-ink">{u.body}</p>
                          <p className="mt-0.5 text-[11px] text-zinc-400">{formatDateTime(u.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {/* Member-of groups */}
      {memberRows && memberRows.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Syndicates you're in</h2>
          {memberRows.map((row: any, i: number) => {
            const grp = row.ownership_groups;
            if (!grp) return null;
            const updates = [...(grp.syndicate_updates ?? [])].sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
            return (
              <div key={grp.id ?? i} className="rounded-2xl border border-line bg-white p-5 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display font-semibold text-ink">{grp.name}</h3>
                  {row.share_label ? <span className="rounded-full bg-mist px-2.5 py-0.5 text-xs font-medium text-zinc-600">{row.share_label}</span> : null}
                </div>
                {updates.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {updates.slice(0, 5).map((u: any) => (
                      <div key={u.id} className="rounded-lg border border-line bg-paper px-3 py-2">
                        <p className="whitespace-pre-wrap text-sm text-ink">{u.body}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-400">{formatDateTime(u.created_at)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-400">No updates from this syndicate yet.</p>
                )}
              </div>
            );
          })}
        </section>
      ) : null}

      {managed.length === 0 && (!memberRows || memberRows.length === 0) ? (
        <EmptyState title="No syndicates yet">
          Create a syndicate above to add your horses and invite micro-owners.
        </EmptyState>
      ) : null}
    </div>
  );
}
