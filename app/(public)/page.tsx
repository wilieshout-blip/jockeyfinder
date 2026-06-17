import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { ClothChip } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/card";
import { TrainerRideDemo } from "@/components/trainer-ride-demo";

export const metadata = {
  title: "JockeyFinder · Plan rides. Book jockeys faster. See who's riding where.",
};

/* ---------- small inline icons (single stroke, quiet) ---------- */

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const icons = {
  helmet: "M4 13a8 8 0 0 1 16 0v3H4v-3zM4 16h16M9 20h6",
  clipboard:
    "M9 4h6v3H9zM7 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1M8 12h8M8 16h5",
  eye: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  users:
    "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.85M15 3.15A3.5 3.5 0 0 1 15 10",
  flag: "M5 21V4m0 0c4-2 8 2 12 0v9c-4 2-8-2-12 0",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z",
};

/* ---------- hero mock: a live-looking racecard row ---------- */

function HeroRacecard() {
  const riders = [
    { name: "O. Bosson", weight: "57kg", claim: null },
    { name: "C. Grylls", weight: "53kg", claim: null },
    { name: "S. Spratt", weight: "52kg", claim: null },
    { name: "M. Hashizume", weight: "51.5kg", claim: "a2" },
  ];
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lift backdrop-blur sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-zinc-900 text-center">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-turf-200">
              Sat
            </span>
            <span className="font-display text-xl font-bold leading-none text-white">
              14
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
              Jun
            </span>
          </div>
          <div>
            <p className="font-display text-base font-semibold text-white">
              Te Rapa
            </p>
            <p className="text-xs text-zinc-400">Waikato Racing Club</p>
          </div>
        </div>
        <span className="rounded-full border border-turf-700 bg-turf-800/40 px-2.5 py-1 text-[11px] font-medium text-turf-100">
          Race meeting
        </span>
      </div>

      <p className="mb-2.5 mt-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        Riding here · 4 jockeys
      </p>
      <ul className="space-y-2">
        {riders.map((r) => (
          <li
            key={r.name}
            className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2.5"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 font-display text-[11px] font-semibold text-zinc-300">
              {r.name[0]}
            </span>
            <span className="flex-1 text-sm font-medium text-zinc-100">
              {r.name}
            </span>
            <span className="text-sm tabular-nums text-zinc-400">{r.weight}</span>
            {r.claim ? (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-turf-600 px-1.5 font-display text-xs font-semibold text-white">
                {r.claim}
              </span>
            ) : (
              <span className="w-6" />
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3.5 flex items-center justify-between rounded-xl bg-turf-800/30 px-3.5 py-2.5">
        <p className="text-xs text-turf-100">
          New ride request · Race 6, 1400m
        </p>
        <span className="rounded-lg bg-turf-600 px-2.5 py-1 text-xs font-semibold text-white">
          Respond
        </span>
      </div>
    </div>
  );
}

/* ---------- role section data ---------- */

const roles = [
  {
    icon: icons.helmet,
    name: "For Jockeys",
    lead: "Run your race week from your phone.",
    points: [
      "Mark which meetings you are attending in one tap",
      "Keep your riding weight and apprentice claim current, updated daily if needed",
      "Receive ride offers and accept or decline instantly",
      "Request rides from trainers once you are verified",
    ],
  },
  {
    icon: icons.clipboard,
    name: "For Trainers",
    lead: "See available riders before you pick up the phone.",
    points: [
      "See every verified jockey attending each meeting",
      "Check declared weights and apprentice claims at a glance",
      "Request a jockey for a ride and confirm bookings in writing",
      "Assign riders to horses and races, with a chat opened automatically",
    ],
  },
  {
    icon: icons.eye,
    name: "For Owners",
    lead: "Know who is riding your horse, and when.",
    points: [
      "Follow upcoming meetings and ride plans",
      "View jockey and trainer profiles",
      "Join the conversation when your trainer adds you to a ride chat",
      "Link your horses as runner data arrives",
    ],
  },
  {
    icon: icons.users,
    name: "For Agents",
    lead: "Manage every rider on your book in one place.",
    points: [
      "Run calendars and attendance for multiple jockeys",
      "Request rides on behalf of the riders you manage",
      "Keep every negotiation and confirmation in one inbox",
      "Approved accounts only, for an extra layer of trust",
    ],
  },
];

const steps = [
  {
    title: "The calendar fills itself",
    body: "Upcoming NZ race meetings sync automatically from official LoveRacing and NZTR data, three months ahead.",
  },
  {
    title: "Jockeys mark attendance",
    body: "Riders tap the meetings they are heading to. Their declared weight and claim are saved with each entry.",
  },
  {
    title: "Trainers book with confidence",
    body: "Trainers see exactly who is riding where, send ride requests, and lock in bookings without the phone tag.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-turf-500" />
              Built for New Zealand thoroughbred racing
            </p>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Plan rides. Book jockeys faster.{" "}
              <span className="text-turf-200">See who&apos;s riding where.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-400">
              JockeyFinder gives jockeys, trainers, owners and agents one place
              to plan race days, request rides and confirm bookings. Fewer
              calls and texts. No last-minute confusion.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonClasses("accent", "lg")}>
                Sign up free
              </Link>
              <Link
                href="/login"
                className={buttonClasses("inverse", "lg")}
              >
                Log in
              </Link>
            </div>
            <p className="mt-5 text-sm text-zinc-500">
              Trainers $5/week · Owners $2/week. Jockeys get 2 weeks free, then $20 NZD/week.
            </p>
          </div>

          <TrainerRideDemo />
        </div>
      </section>

      {/* ---------- THE PROBLEM ---------- */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:grid-cols-3 sm:px-6">
          {[
            {
              stat: "One calendar",
              copy: "Every upcoming NZ meeting for the next three months, synced from official racing data.",
            },
            {
              stat: "Verified riders",
              copy: "Only verified jockeys appear publicly, with current weight and apprentice claim beside their name.",
            },
            {
              stat: "Bookings in writing",
              copy: "Ride requests, acceptances and assignments live in one record, not across ten text threads.",
            },
          ].map((item) => (
            <div key={item.stat}>
              <p className="font-display text-xl font-semibold text-ink">
                {item.stat}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                {item.copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- ROLES ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading eyebrow="Who it's for" title="Every part of the stable, on the same page">
          Racing runs on relationships and timing. JockeyFinder keeps both
          intact while removing the guesswork.
        </SectionHeading>

        <div className="grid gap-5 md:grid-cols-2">
          {roles.map((role) => (
            <div
              key={role.name}
              className="rounded-2xl border border-line bg-white p-6 shadow-card transition-shadow hover:shadow-lift"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-turf-50 text-turf-700">
                  <Icon d={role.icon} />
                </span>
                <h3 className="font-display text-lg font-semibold text-ink">
                  {role.name}
                </h3>
              </div>
              <p className="mt-3 font-medium text-zinc-800">{role.lead}</p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                {role.points.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <svg
                      viewBox="0 0 16 16"
                      className="mt-0.5 h-4 w-4 shrink-0 text-turf-600"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M6.5 12.2 2.8 8.5l1.1-1.1 2.6 2.6 5.6-5.6 1.1 1.1-6.7 6.7z" />
                    </svg>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- RACE DAYS ---------- */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading eyebrow="Race days" title="From calendar to confirmed ride">
            The public meetings page is open to everyone. The booking tools sit
            behind verified accounts.
          </SectionHeading>
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-line bg-paper p-6">
                <ClothChip tone="ink">{i + 1}</ClothChip>
                <h3 className="mt-4 font-display text-base font-semibold text-ink">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/meetings" className={buttonClasses("outline", "md")}>
              Browse upcoming meetings
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- TRUST / VERIFICATION ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Trust built in"
              title="Verification before visibility"
            >
              A booking platform only works if everyone on it is who they say
              they are.
            </SectionHeading>
            <ul className="space-y-4 text-sm leading-relaxed text-zinc-600">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-turf-600 font-display text-xs font-bold text-white">
                  J
                </span>
                <span>
                  <strong className="text-ink">Jockeys</strong> are approved
                  individually before they appear publicly or can request
                  rides.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink font-display text-xs font-bold text-white">
                  T
                </span>
                <span>
                  <strong className="text-ink">Trainers</strong> are
                  auto-approved when their phone number matches the NZTR
                  registry.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-500 font-display text-xs font-bold text-white">
                  A
                </span>
                <span>
                  <strong className="text-ink">Agents</strong> are always
                  manually reviewed, even with a registry match.
                </span>
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
            <div className="flex items-center gap-3 border-b border-line pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-turf-50 text-turf-700">
                <Icon d={icons.chat} />
              </span>
              <div>
                <p className="font-display font-semibold text-ink">
                  Messaging where the booking lives
                </p>
                <p className="text-xs text-zinc-500">
                  A chat opens automatically when a ride is assigned
                </p>
              </div>
            </div>
            <div className="space-y-3 pt-4 text-sm">
              <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-mist px-3.5 py-2.5 text-zinc-700">
                Confirmed for Race 6. She works best ridden quiet early.
              </div>
              <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-turf-600 px-3.5 py-2.5 text-white">
                Got it. I&apos;ll be on course by 11. See you at the birdcage.
              </div>
              <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-mist px-3.5 py-2.5 text-zinc-700">
                Owner&apos;s joining this chat so everyone has the plan.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- EARLY ACCESS CTA ---------- */}
      <section className="bg-ink">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-turf-200">
            Early access
          </p>
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Be on the platform before the spring carnivals
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Trainers and owners join free. Jockeys get a 2-week free trial,
            then $20 NZD/week. Agents are onboarded individually.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className={buttonClasses("accent", "lg")}>
              Create your account
            </Link>
            <Link
              href="/meetings"
              className={buttonClasses("inverse", "lg")}
            >
              See who&apos;s riding
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
