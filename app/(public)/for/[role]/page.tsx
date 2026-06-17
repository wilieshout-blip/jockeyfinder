import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";

type RoleKey = "jockeys" | "trainers" | "owners" | "agents";

type RoleContent = {
  label: string;
  eyebrow: string;
  headline: string;
  introduction: string;
  accent: string;
  price: string;
  verification: string;
  primaryAction: string;
  highlights: Array<{ label: string; value: string }>;
  tools: Array<{ title: string; body: string }>;
  workflow: Array<{ title: string; body: string }>;
  dashboard: {
    title: string;
    status: string;
    rows: Array<{ label: string; value: string; meta: string }>;
  };
};

const roleContent: Record<RoleKey, RoleContent> = {
  jockeys: {
    label: "Jockeys",
    eyebrow: "Your race week, organised",
    headline: "Be easier to find, easier to book, and ready for every meeting.",
    introduction:
      "JockeyFinder gives riders one calm place to publish availability, keep riding details current, receive offers and turn accepted rides into a clear race-day plan.",
    accent: "J",
    price: "100-day free trial, then $40 NZD per month",
    verification:
      "Race jockey profiles become public after NZTR matching or manual approval. Trial riders upload their permit and remain limited to eligible meetings.",
    primaryAction: "Create a jockey account",
    highlights: [
      { label: "Meetings marked", value: "4" },
      { label: "Ride offers", value: "3" },
      { label: "Confirmed rides", value: "6" },
    ],
    tools: [
      {
        title: "Meeting attendance",
        body: "Mark the NZ meetings you plan to attend so trainers can find you before they begin calling around.",
      },
      {
        title: "Weight and claim",
        body: "Keep your current riding weight, apprentice claim and availability notes beside every booking decision.",
      },
      {
        title: "Ride offers",
        body: "Review the horse, race, weight and trainer in one request, then accept or decline from your phone.",
      },
      {
        title: "Race-day plan",
        body: "See your confirmed rides in meeting order with the conversations and details that belong to each booking.",
      },
      {
        title: "Professional profile",
        body: "Give trainers a verified view of your licence, region, preferred tracks and recent riding activity.",
      },
      {
        title: "Booking messages",
        body: "Keep instructions and confirmations attached to the ride instead of scattered across calls and texts.",
      },
    ],
    workflow: [
      {
        title: "Set your availability",
        body: "Choose your meetings and keep your weight details current.",
      },
      {
        title: "Review the offer",
        body: "Open the horse, race and trainer details before deciding.",
      },
      {
        title: "Confirm the ride",
        body: "Accept once and let JockeyFinder update the booking record.",
      },
    ],
    dashboard: {
      title: "Rider week",
      status: "Available",
      rows: [
        { label: "Te Rapa R6", value: "Sunline", meta: "Accepted - 52kg" },
        { label: "Ellerslie R3", value: "Black Caviar", meta: "Offer received" },
        { label: "Trentham", value: "Meeting marked", meta: "Saturday" },
      ],
    },
  },
  trainers: {
    label: "Trainers",
    eyebrow: "Fill rides without the phone tag",
    headline: "See who is riding where before you make the first call.",
    introduction:
      "JockeyFinder brings meeting availability, rider details, horse assignments and written confirmations into one trainer workspace built around the way a stable plans race day.",
    accent: "T",
    price: "$5 NZD per week",
    verification:
      "Trainer accounts are checked against the NZTR registry. A matching mobile number can speed up approval and protect the directory from impersonation.",
    primaryAction: "Create a trainer account",
    highlights: [
      { label: "Stable runners", value: "8" },
      { label: "Rides to fill", value: "2" },
      { label: "Confirmed riders", value: "6" },
    ],
    tools: [
      {
        title: "Live rider availability",
        body: "Open a meeting and see verified jockeys who have marked themselves on course, including weight and claim.",
      },
      {
        title: "Jockey matching",
        body: "Compare the practical information that matters for the horse, distance and available ride weight.",
      },
      {
        title: "Ride requests",
        body: "Send a structured request with the meeting, race, horse and message already attached.",
      },
      {
        title: "Stable runners",
        body: "Link horses to your stable and keep upcoming entries, riders and unresolved bookings in one view.",
      },
      {
        title: "Written confirmations",
        body: "Every acceptance and assignment stays recorded, reducing last-minute uncertainty for the whole team.",
      },
      {
        title: "Race-day chat",
        body: "Open the conversation connected to a ride and include the owner when everyone needs the same plan.",
      },
    ],
    workflow: [
      {
        title: "Open the meeting",
        body: "Review your runners and the jockeys already attending.",
      },
      {
        title: "Request the best fit",
        body: "Choose a rider, add the horse and send the offer.",
      },
      {
        title: "Lock in the booking",
        body: "The accepted ride moves into your stable plan automatically.",
      },
    ],
    dashboard: {
      title: "Stable board",
      status: "2 actions",
      rows: [
        { label: "Te Rapa R6", value: "Sunline", meta: "R. Lennox confirmed" },
        { label: "Ellerslie R3", value: "Winx", meta: "Choose a jockey" },
        { label: "Riccarton R8", value: "Makybe Diva", meta: "Request sent" },
      ],
    },
  },
  owners: {
    label: "Owners",
    eyebrow: "A clearer view of your racing",
    headline: "Know what is happening with every horse without chasing updates.",
    introduction:
      "The owner hub connects horses, race-card matches, runners, trainers, jockeys and booking messages so the important race-day picture is visible at a glance.",
    accent: "O",
    price: "$2 NZD per week",
    verification:
      "Owners can link a horse and confirm ownership matches from available race-card data. Private stable and booking information remains limited to authorised accounts.",
    primaryAction: "Create an owner account",
    highlights: [
      { label: "Linked horses", value: "3" },
      { label: "Upcoming runners", value: "2" },
      { label: "Stable updates", value: "5" },
    ],
    tools: [
      {
        title: "Linked horses",
        body: "Build one ownership list and confirm likely matches found in incoming race-card information.",
      },
      {
        title: "Upcoming runners",
        body: "See the meeting, race time, distance, barrier, weight and booked rider as declarations arrive.",
      },
      {
        title: "Trainer and jockey details",
        body: "Open the people connected with your runner without searching across separate racing sites.",
      },
      {
        title: "Stable activity",
        body: "Understand which horses are entered, which rides are confirmed and which decisions still need attention.",
      },
      {
        title: "Connected messages",
        body: "Jump into the relevant conversation when the trainer includes you in a booking or race-day plan.",
      },
      {
        title: "Race-day overview",
        body: "Use a simple mobile view on course instead of piecing together information from several message threads.",
      },
    ],
    workflow: [
      {
        title: "Link your horses",
        body: "Search the racing register and confirm the horses connected to you.",
      },
      {
        title: "Watch the race card",
        body: "Entries, riders and key race details collect in your owner hub.",
      },
      {
        title: "Stay in the loop",
        body: "Open the trainer, jockey or message attached to the runner.",
      },
    ],
    dashboard: {
      title: "Ownership hub",
      status: "All matched",
      rows: [
        { label: "Te Rapa R6", value: "Makybe Diva", meta: "Rider confirmed" },
        { label: "Ellerslie R3", value: "Winx", meta: "Barrier 5 - 14:18" },
        { label: "Stable note", value: "Black Caviar", meta: "New update" },
      ],
    },
  },
  agents: {
    label: "Agents",
    eyebrow: "One account for every rider",
    headline: "Manage calendars, offers and conversations across your whole book.",
    introduction:
      "Agent accounts provide a controlled workspace for approved representatives to act for linked jockeys while keeping every action attached to the correct rider.",
    accent: "A",
    price: "Onboarded individually",
    verification:
      "Agent accounts are manually approved. Riders are linked deliberately so an agent only manages the jockeys they are authorised to represent.",
    primaryAction: "Apply for an agent account",
    highlights: [
      { label: "Managed jockeys", value: "5" },
      { label: "Open offers", value: "7" },
      { label: "Meetings covered", value: "9" },
    ],
    tools: [
      {
        title: "Multi-rider calendar",
        body: "Switch between jockeys and manage meeting attendance without signing in and out of separate accounts.",
      },
      {
        title: "Offer oversight",
        body: "Review requests across the whole team and see what is new, accepted or still awaiting a response.",
      },
      {
        title: "Rider-specific actions",
        body: "Every attendance change and ride request stays attached to the jockey you selected.",
      },
      {
        title: "Shared inbox",
        body: "Keep trainer conversations organised around rides rather than mixing every negotiation together.",
      },
      {
        title: "Availability control",
        body: "Maintain each rider's meetings, weight details and practical notes from one trusted account.",
      },
      {
        title: "Clear audit trail",
        body: "Give riders and trainers a reliable record of who requested, accepted and confirmed each ride.",
      },
    ],
    workflow: [
      {
        title: "Choose a jockey",
        body: "Switch into the rider you are managing for this action.",
      },
      {
        title: "Plan and respond",
        body: "Manage meetings, offers and booking conversations.",
      },
      {
        title: "Keep everyone aligned",
        body: "The jockey sees the same confirmed plan in their account.",
      },
    ],
    dashboard: {
      title: "Agency desk",
      status: "7 open",
      rows: [
        { label: "R. Lennox", value: "Te Rapa", meta: "2 confirmed rides" },
        { label: "M. Vale", value: "Ellerslie", meta: "3 new offers" },
        { label: "K. Avery", value: "Trentham", meta: "Attendance needed" },
      ],
    },
  },
};

export function generateStaticParams() {
  return Object.keys(roleContent).map((role) => ({ role }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ role: string }>;
}): Promise<Metadata> {
  const { role } = await params;
  const content = roleContent[role as RoleKey];
  if (!content) return {};

  return {
    title: `JockeyFinder for ${content.label}`,
    description: content.introduction,
  };
}

export default async function RolePage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  const content = roleContent[role as RoleKey];
  if (!content) notFound();

  const signupRole = role.slice(0, -1);

  return (
    <>
      <section className="border-b border-zinc-800 bg-ink text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <Link
              href="/#account-types"
              className="text-sm font-medium text-turf-200 hover:text-white"
            >
              Back to account types
            </Link>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-turf-200">
              {content.eyebrow}
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              JockeyFinder for {content.label}
            </h1>
            <p className="mt-4 text-xl font-medium leading-relaxed text-white">
              {content.headline}
            </p>
            <p className="mt-4 max-w-xl leading-relaxed text-zinc-400">
              {content.introduction}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/signup?role=${signupRole}`}
                className={buttonClasses("accent", "lg")}
              >
                {content.primaryAction}
              </Link>
              <Link href="/meetings" className={buttonClasses("inverse", "lg")}>
                Browse meetings
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-lift">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-turf-600 font-display font-bold text-white">
                  {content.accent}
                </span>
                <div>
                  <p className="font-display font-semibold text-white">
                    {content.dashboard.title}
                  </p>
                  <p className="text-xs text-zinc-500">Today in JockeyFinder</p>
                </div>
              </div>
              <span className="rounded-full border border-turf-700 bg-turf-950 px-3 py-1 text-xs font-semibold text-turf-200">
                {content.dashboard.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-px bg-zinc-800">
              {content.highlights.map((item) => (
                <div key={item.label} className="bg-zinc-950 px-4 py-5">
                  <p className="font-display text-2xl font-semibold text-white">
                    {item.value}
                  </p>
                  <p className="mt-1 text-[11px] leading-tight text-zinc-500">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2 p-4">
              {content.dashboard.rows.map((row) => (
                <div
                  key={`${row.label}-${row.value}`}
                  className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-500">
                      {row.label}
                    </p>
                    <p className="truncate font-semibold text-white">
                      {row.value}
                    </p>
                  </div>
                  <span className="ml-auto text-right text-xs font-medium text-turf-200">
                    {row.meta}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-turf-600">
            Built for the job
          </p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink">
            The tools this account puts in one place
          </h2>
          <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            {content.tools.map((tool, index) => (
              <div key={tool.title} className="border-t border-line pt-5">
                <span className="text-xs font-semibold text-turf-600">
                  0{index + 1}
                </span>
                <h3 className="mt-2 font-display text-lg font-semibold text-ink">
                  {tool.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                  {tool.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-turf-600">
              How it works
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
              A simpler path from planning to race day
            </h2>
            <div className="mt-8 space-y-4">
              {content.workflow.map((step, index) => (
                <div
                  key={step.title}
                  className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-line pb-4"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink font-display text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-display font-semibold text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="self-start rounded-2xl border border-line bg-white p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-turf-600">
              Account details
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
              {content.price}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-600">
              {content.verification}
            </p>
            <Link
              href={`/signup?role=${signupRole}`}
              className={buttonClasses("accent", "lg", "mt-6 w-full")}
            >
              {content.primaryAction}
            </Link>
            <p className="mt-3 text-center text-xs text-zinc-400">
              No credit card is required during the current free-access period.
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
