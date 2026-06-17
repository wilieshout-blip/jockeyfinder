import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewRequestForm } from "./new-request-form";
import { nzToday, nzDatePlusDays } from "@/lib/utils";
import type { Meeting, Profile } from "@/lib/types";

interface Option {
  id: string;
  label: string;
}

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ meeting?: string; jockey?: string; trainer?: string }>;
}) {
  const queryParams = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (!me) redirect("/login");

  const allowed =
    (me.role === "trainer" && me.verified) ||
    (me.role === "jockey" && me.verified) ||
    (me.role === "agent" && me.verification_status === "approved");

  if (!allowed) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          New ride request
        </h1>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          {me.role === "owner"
            ? "Owners cannot create ride requests directly. Talk to your trainer, who can request jockeys and add you to the ride chat."
            : "Your account needs to be verified before you can send ride requests. You will be able to use this page as soon as that happens."}
        </div>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-turf-700 underline"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  // Meetings to pick from: next 60 days.
  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, nztr_day_id, meeting_date, track, club, source, meeting_type")
    .gte("meeting_date", nzToday())
    .lte("meeting_date", nzDatePlusDays(60))
    .order("meeting_date", { ascending: true })
    .returns<Meeting[]>();

  // Counterpart options depend on the caller's role.
  const counterpartRole = me.role === "trainer" ? "jockey" : "trainer";
  const { data: counterparts } = await supabase
    .from("public_profiles")
    .select("id, full_name, riding_weight, apprentice_claim, base_region")
    .eq("role", counterpartRole)
    .order("full_name");

  const counterpartOptions: Option[] = (counterparts ?? []).map((p) => ({
    id: p.id,
    label:
      counterpartRole === "jockey"
        ? `${p.full_name ?? "Jockey"}${p.riding_weight != null ? ` · ${p.riding_weight}kg` : ""}${
            p.apprentice_claim ? ` · a${p.apprentice_claim}` : ""
          }`
        : `${p.full_name ?? "Trainer"}${p.base_region ? ` · ${p.base_region}` : ""}`,
  }));

  // Agents also pick which managed jockey the ride is for.
  let managedOptions: Option[] = [];
  if (me.role === "agent") {
    const { data: links } = await supabase
      .from("agent_jockeys")
      .select("jockey_id")
      .eq("agent_id", user.id);
    const ids = (links ?? []).map((l) => l.jockey_id);
    if (ids.length > 0) {
      const { data: js } = await supabase
        .from("profiles")
        .select("id, full_name, riding_weight")
        .in("id", ids)
        .order("full_name");
      managedOptions = (js ?? []).map((j) => ({
        id: j.id,
        label: `${j.full_name ?? "Jockey"}${j.riding_weight != null ? ` · ${j.riding_weight}kg` : ""}`,
      }));
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-turf-600">
          Ride requests
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          New ride request
        </h1>
        <p className="mt-2 text-zinc-600">
          {me.role === "trainer"
            ? "Pick a meeting and a verified jockey. They will get the request straight away."
            : me.role === "jockey"
              ? "Pick a meeting and a verified trainer to put your hand up for a ride."
              : "Pick the jockey you manage, the meeting, and the trainer."}
        </p>
      </div>

      <NewRequestForm
        role={me.role}
        meetings={meetings ?? []}
        counterparts={counterpartOptions}
        managedJockeys={managedOptions}
        defaults={{
          meeting: queryParams.meeting ?? "",
          counterpart:
            (me.role === "trainer" ? queryParams.jockey : queryParams.trainer) ?? "",
          managedJockey: queryParams.jockey ?? "",
        }}
      />
    </div>
  );
}
