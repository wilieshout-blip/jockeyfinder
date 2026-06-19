import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { TrainerRideDemo } from "@/components/trainer-ride-demo";
import { MessageFlowDemo } from "@/components/message-flow-demo";
import {
  AnimatedSection,
  ArrowLink,
  DashboardPreview,
  StatCard,
  VerificationCard,
  VideoHero,
} from "@/components/premium";

export const metadata = {
  title: { absolute: "JockeyFinder — Race day bookings, simplified." },
  description:
    "JockeyFinder helps trainers find available jockeys, send ride requests, and manage race-day availability in one clean platform.",
};

const roles = [
  {
    href: "/for/jockeys",
    buttonLabel: "View jockey account",
    number: "01",
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
    href: "/for/trainers",
    buttonLabel: "View trainer account",
    number: "02",
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
    href: "/for/owners",
    buttonLabel: "View owner account",
    number: "03",
    name: "For Owners",
    lead: "Turn race day into a clear ownership hub.",
    points: [
      "Link horses and confirm race-card ownership matches",
      "See upcoming runners, race times, barriers and riders",
      "Open trainer, jockey and ride messages from one place",
      "Understand stable activity without chasing updates",
    ],
  },
  {
    href: "/for/agents",
    buttonLabel: "View agent account",
    number: "04",
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

const workflow = [
  {
    number: "01",
    title: "The calendar fills itself",
    body: "Upcoming NZ race meetings sync automatically from official LoveRacing and NZTR data, three months ahead.",
  },
  {
    number: "02",
    title: "Jockeys mark attendance",
    body: "Riders tap the meetings they are heading to. Their declared weight and claim are saved with each entry.",
  },
  {
    number: "03",
    title: "Trainers book with confidence",
    body: "Trainers see exactly who is riding where, send ride requests, and lock in bookings without the phone tag.",
  },
];

const features = [
  {
    label: "Availability",
    title: "Know who is on course",
    body: "Meeting attendance, current riding weights and apprentice claims are visible before a trainer starts the booking conversation.",
  },
  {
    label: "Requests",
    title: "Structure every offer",
    body: "Horse, meeting, race, weight and notes stay attached to one request from first contact through to assignment.",
  },
  {
    label: "Race day",
    title: "Keep the whole team aligned",
    body: "Confirmed bookings open a focused conversation for trainers, jockeys and invited owners.",
  },
  {
    label: "Operations",
    title: "One source of truth",
    body: "Race cards, linked horses, requests and messages sit inside one secure operational record.",
  },
];

function SectionIntro({
  eyebrow,
  title,
  body,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  dark?: boolean;
}) {
  return (
    <div className="max-w-3xl">
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${
          dark ? "text-gold-300" : "text-turf-700"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-4 font-display text-4xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-5xl lg:text-6xl ${
          dark ? "text-white" : "text-ink"
        }`}
      >
        {title}
      </h2>
      <p
        className={`mt-5 max-w-2xl text-base leading-7 sm:text-lg ${
          dark ? "text-zinc-400" : "text-zinc-600"
        }`}
      >
        {body}
      </p>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <VideoHero>
        <div className="relative mx-auto grid min-h-[calc(100svh-7.2rem)] max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-20">
          <div className="relative z-10 max-w-3xl">
            <div className="mb-8 flex items-center gap-3">
              <span className="h-px w-12 bg-gold-400" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-300">
                New Zealand racing operations
              </p>
            </div>
            <h1 className="font-display text-[clamp(3.5rem,8.5vw,7.6rem)] font-semibold leading-[0.82] tracking-[-0.075em] text-white">
              Race day
              <span className="block text-turf-300">bookings,</span>
              <span className="block">simplified.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-300 sm:text-xl">
              JockeyFinder helps trainers find available jockeys, send ride
              requests, and manage race-day availability in one clean platform.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className={buttonClasses(
                  "accent",
                  "lg",
                  "rounded-none bg-gold-400 text-ink hover:bg-gold-300 active:bg-gold-500"
                )}
              >
                Start using JockeyFinder
              </Link>
              <Link
                href="/login"
                className={buttonClasses("inverse", "lg", "rounded-none border-white/30")}
              >
                Log in
              </Link>
            </div>
            <div className="mt-10 grid max-w-xl grid-cols-3 border-y border-white/10 py-4 text-xs text-zinc-500">
              <span>Verified accounts</span>
              <span className="border-x border-white/10 px-4">NZ race data</span>
              <span className="pl-4">Mobile first</span>
            </div>
          </div>
          <div className="relative z-10 hidden lg:block">
            <DashboardPreview />
          </div>
          <div className="absolute bottom-5 left-4 z-10 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:left-6 lg:left-8">
            <span className="h-8 w-px bg-gold-400/60" />
            Scroll to explore
          </div>
        </div>
      </VideoHero>

      <section className="border-b border-line bg-white">
        <AnimatedSection className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:px-8">
          <StatCard
            label="Race calendar"
            value="90 days"
            detail="Official upcoming meetings in one searchable view."
          />
          <StatCard
            label="Booking record"
            value="One thread"
            detail="Request, response, assignment and chat stay connected."
          />
          <StatCard
            label="Account trust"
            value="Verified"
            detail="Riders, trainers and agents are checked before full access."
          />
        </AnimatedSection>
      </section>

      <section className="bg-paper">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <AnimatedSection className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <SectionIntro
              eyebrow="The problem"
              title="Race-day decisions still live across phone calls, texts and memory."
              body="The relationship should stay personal. The operational record should not depend on who answered the phone."
            />
            <div className="border-t border-line">
              {[
                ["01", "Availability changes quickly", "Trainers need current attendance, weight and claim information before approaching a rider."],
                ["02", "Requests lose context", "Horse, race and meeting details get split across messages, calls and different people."],
                ["03", "Confirmation is hard to track", "Owners, agents, trainers and jockeys can each hold a different version of the plan."],
              ].map(([number, title, body]) => (
                <div
                  key={number}
                  className="grid gap-4 border-b border-line py-7 sm:grid-cols-[72px_1fr]"
                >
                  <span className="editorial-number font-display text-4xl font-semibold">
                    {number}
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section className="premium-grid overflow-hidden bg-ink text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <AnimatedSection>
            <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
              <SectionIntro
                dark
                eyebrow="The product"
                title="From open ride to confirmed booking."
                body="The existing JockeyBox workflow remains the centrepiece: a trainer finds the right rider, sends a structured request, and receives a clear response."
              />
              <ArrowLink href="/signup" className="text-gold-300">
                Create an account
              </ArrowLink>
            </div>
            <div className="mx-auto max-w-6xl lg:translate-x-8">
              <TrainerRideDemo />
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <AnimatedSection>
            <SectionIntro
              eyebrow="Workflow"
              title="Three moves. One reliable race-day record."
              body="JockeyFinder removes administrative friction without getting between the people who make racing work."
            />
            <div className="mt-14 grid border-y border-line md:grid-cols-3">
              {workflow.map((step, index) => (
                <div
                  key={step.number}
                  className={`relative px-1 py-8 md:px-8 md:py-10 ${
                    index > 0 ? "border-t border-line md:border-l md:border-t-0" : ""
                  }`}
                >
                  <span className="editorial-number font-display text-6xl font-semibold">
                    {step.number}
                  </span>
                  <h3 className="mt-8 font-display text-xl font-semibold text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">{step.body}</p>
                </div>
              ))}
            </div>
            <Link
              href="/meetings"
              className={buttonClasses("outline", "md", "mt-8 rounded-none")}
            >
              Browse upcoming meetings
            </Link>
          </AnimatedSection>
        </div>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <AnimatedSection>
            <SectionIntro
              eyebrow="Operational clarity"
              title="Built for the full race-day loop."
              body="Each surface is designed to answer the next practical question quickly, from who is available to what has already been confirmed."
            />
            <div className="mt-12 grid gap-px overflow-hidden border border-line bg-line md:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="premium-card-hover bg-white p-7 sm:p-9"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-500">
                    {feature.label}
                  </p>
                  <h3 className="mt-6 font-display text-2xl font-semibold tracking-[-0.035em] text-ink">
                    {feature.title}
                  </h3>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-600">
                    {feature.body}
                  </p>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section id="account-types" className="scroll-mt-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <AnimatedSection>
            <SectionIntro
              eyebrow="Who it is for"
              title="Every part of the stable, on the same page."
              body="Racing runs on relationships and timing. JockeyFinder keeps both intact while removing the guesswork."
            />
            <div className="mt-14 grid gap-5 md:grid-cols-2">
              {roles.map((role) => (
                <article
                  key={role.name}
                  className="premium-card-hover flex flex-col border border-line bg-paper p-7 sm:p-9"
                >
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-turf-700">
                        Account type
                      </p>
                      <h3 className="mt-3 font-display text-3xl font-semibold tracking-[-0.045em] text-ink">
                        {role.name}
                      </h3>
                    </div>
                    <span className="editorial-number font-display text-5xl font-semibold">
                      {role.number}
                    </span>
                  </div>
                  <p className="mt-7 text-base font-semibold text-zinc-800">{role.lead}</p>
                  <ul className="mt-5 flex-1 space-y-3 text-sm leading-6 text-zinc-600">
                    {role.points.map((point) => (
                      <li key={point} className="flex gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={role.href}
                    className={buttonClasses("outline", "md", "mt-8 self-start rounded-none")}
                  >
                    {role.buttonLabel}
                  </Link>
                </article>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <AnimatedSection>
            <SectionIntro
              eyebrow="Trust built in"
              title="Verification before visibility."
              body="A booking platform only works if everyone on it is who they say they are."
            />
            <div className="mt-10">
              <VerificationCard
                letter="J"
                title="Jockeys"
                body="Approved individually before they appear publicly or can request rides."
              />
              <VerificationCard
                letter="T"
                title="Trainers"
                body="Auto-approved when their phone number matches the NZTR registry."
                tone="dark"
              />
              <VerificationCard
                letter="A"
                title="Agents"
                body="Always manually reviewed, even when registry details already match."
                tone="gold"
              />
            </div>
          </AnimatedSection>
          <AnimatedSection delay={120} className="lg:pt-20">
            <MessageFlowDemo />
          </AnimatedSection>
        </div>
      </section>

      <section className="relative overflow-hidden bg-turf-900 text-white">
        <div className="premium-grid absolute inset-0 opacity-60" aria-hidden />
        <AnimatedSection className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="grid items-end gap-10 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-300">
                Early access
              </p>
              <h2 className="mt-4 max-w-4xl font-display text-5xl font-semibold leading-[0.92] tracking-[-0.065em] sm:text-6xl lg:text-7xl">
                Put the race-day plan in one place.
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-7 text-turf-100/75">
                Everyone has free access until 1 October 2026. After that,
                jockeys are $12.99/week, trainers are $4.99/week and owners are
                $1.99/week — save 10% on a 6-month plan or 15% on an annual plan.
                Agents are onboarded individually.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:flex-col">
              <Link
                href="/signup"
                className={buttonClasses(
                  "accent",
                  "lg",
                  "rounded-none bg-gold-400 text-ink hover:bg-gold-300"
                )}
              >
                Start using JockeyFinder
              </Link>
              <Link
                href="/login"
                className={buttonClasses("inverse", "lg", "rounded-none")}
              >
                Log in
              </Link>
            </div>
          </div>
        </AnimatedSection>
      </section>
    </>
  );
}
