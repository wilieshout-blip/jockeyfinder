import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { Avatar } from "@/components/ui/avatar";
import { formatClaim, formatWeight } from "@/lib/utils";
import { linkJockeyByEmail, unlinkJockey } from "./actions";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; linked?: string }>;
}) {
  const queryParams = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, verification_status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "agent") redirect("/dashboard");

  const approved = profile.verification_status === "approved";

  let managed: {
    id: string;
    full_name: string | null;
    profile_photo_url: string | null;
    riding_weight: number | null;
    apprentice: boolean | null;
    apprentice_claim: number | null;
    base_region: string | null;
    verified: boolean | null;
  }[] = [];

  if (approved) {
    const { data: links } = await supabase
      .from("agent_jockeys")
      .select("jockey_id")
      .eq("agent_id", user.id);

    const ids = (links || []).map((l) => l.jockey_id);
    if (ids.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, full_name, profile_photo_url, riding_weight, apprentice, apprentice_claim, base_region, verified"
        )
        .in("id", ids)
        .order("full_name");
      managed = data || [];
    }
  }

  const errorMessages: Record<string, string> = {
    not_approved: "Your agent account needs admin approval before you can manage jockeys.",
    missing_email: "Enter the jockey's email address.",
    not_found: "No jockey account found with that email. Ask them to sign up first.",
    link_failed: "Could not link that jockey. Please try again.",
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Agent tools"
        title="My jockeys"
      >
        Manage availability and ride requests on behalf of the riders you represent.
      </SectionHeading>

      {queryParams.error && errorMessages[queryParams.error] && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessages[queryParams.error]}
        </div>
      )}
      {queryParams.linked && (
        <div className="rounded-xl border border-turf-200 bg-turf-50 px-4 py-3 text-sm text-turf-700">
          Jockey linked. You can now set their calendar and send requests for them.
        </div>
      )}

      {!approved ? (
        <Card>
          <CardBody>
            <div className="flex items-start gap-3">
              <Badge tone="amber">Pending approval</Badge>
              <p className="text-sm text-zinc-600">
                An admin reviews every agent account before it goes live. Once you are
                approved this page unlocks jockey management, shared calendars and
                request handling. Pricing for agents is agreed directly with the
                JockeyFinder team.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          {managed.length === 0 ? (
            <EmptyState title="No jockeys linked yet">
              Add a jockey below using the email they signed up with.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {managed.map((j) => (
                <Card key={j.id}>
                  <CardBody className="flex flex-wrap items-center gap-4">
                    <Avatar
                      name={j.full_name || "Jockey"}
                      src={j.profile_photo_url}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-semibold text-ink">
                        {j.full_name || "Unnamed jockey"}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {formatWeight(j.riding_weight)}
                        {j.apprentice ? ` · ${formatClaim(j.apprentice_claim)}` : ""}
                        {j.base_region ? ` · ${j.base_region}` : ""}
                        {!j.verified ? " · awaiting verification" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/calendar?jockey=${j.id}`}
                        className={buttonClasses("outline", "sm")}
                      >
                        Calendar
                      </Link>
                      <Link
                        href={`/dashboard/requests/new?jockey=${j.id}`}
                        className={buttonClasses("outline", "sm")}
                      >
                        New request
                      </Link>
                      <form action={unlinkJockey}>
                        <input type="hidden" name="jockey_id" value={j.id} />
                        <Button variant="ghost" size="sm" type="submit">
                          Unlink
                        </Button>
                      </form>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardBody>
              <h3 className="font-display text-base font-semibold text-ink">
                Link a jockey
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                They must already have a JockeyFinder account.
              </p>
              <form
                action={linkJockeyByEmail}
                className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <Label htmlFor="email">Jockey email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="rider@example.com"
                  />
                </div>
                <Button type="submit">Link jockey</Button>
              </form>
              <p className="mt-3 text-xs text-zinc-500">
                Linking lets you mark meetings, update weights and handle ride
                requests on their behalf. The jockey can see everything you do.
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
