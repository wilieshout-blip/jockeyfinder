import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/premium";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Everything JockeyFinder can do, explained in plain English — for jockeys, trainers, owners and agents.",
};

// ─────────────────────────────────────────────────────────────────────────────
// MAINTENANCE: add a new item here every time a feature ships. Keep the language
// simple — write it like you're explaining it to a 10-year-old.
// ─────────────────────────────────────────────────────────────────────────────

interface Feature {
  title: string;
  blurb: string;
}
interface Group {
  audience: string;
  intro: string;
  features: Feature[];
}

const GROUPS: Group[] = [
  {
    audience: "For everyone",
    intro: "Things anyone can use, even without an account.",
    features: [
      {
        title: "See every race meeting",
        blurb:
          "A list of all the upcoming race days in New Zealand. Tap one to see the races, the horses, and who is riding.",
      },
      {
        title: "Race cards",
        blurb:
          "For each race day you can see every race, every horse, the barrier they start from, and the jockey riding them.",
      },
      {
        title: "Finished races are marked",
        blurb:
          "Once a race has been run, it gets a line through it and says “Finished”, and the meeting drops off the list so you only see what's coming up.",
      },
      {
        title: "List or calendar view",
        blurb:
          "See the race days as a simple list, or flip to a calendar to see the whole month at a glance and tap any day to see what's on.",
      },
      {
        title: "Find jockeys and trainers",
        blurb:
          "Two big lists — one of jockeys, one of trainers. You can search by name and tap anyone to see their page.",
      },
      {
        title: "It's free",
        blurb:
          "JockeyFinder is free for everyone until 1 October 2026. You don't even need a credit card to join.",
      },
    ],
  },
  {
    audience: "For jockeys",
    intro: "Tools to show trainers you're available and ready to ride.",
    features: [
      {
        title: "Your own profile page",
        blurb:
          "A page with your name, your riding weight, your apprentice claim, and the meetings you're going to.",
      },
      {
        title: "Tell everyone you're attending",
        blurb:
          "Tap “I'm attending” on a meeting and trainers can see you'll be there, so they know to book you.",
      },
      {
        title: "Keep your riding weight up to date",
        blurb:
          "Type in your weight for the day. Trainers see it next to your name everywhere, so there are no surprises.",
      },
      {
        title: "Season stats",
        blurb:
          "Your wins and placings for the season show on your profile (these fill in once race results are loaded).",
      },
      {
        title: "Show or hide your contact details",
        blurb:
          "You decide if your phone number shows on your profile, and whether your agent's phone shows too. You're in charge.",
      },
      {
        title: "Your agent is on your profile",
        blurb:
          "If you have an agent, their name shows on your page with a link to their page, so trainers can reach the right person.",
      },
    ],
  },
  {
    audience: "For trainers",
    intro: "Find and book the right rider, fast.",
    features: [
      {
        title: "Your stable, loaded for you",
        blurb:
          "We find the horses in your stable from the race records and ask you to tick “mine” or “not mine”. No typing them all in.",
      },
      {
        title: "Your runners",
        blurb:
          "See all your horses that are entered to race soon, with the meeting, the race, and who's riding.",
      },
      {
        title: "Ask a jockey to ride",
        blurb:
          "Send a ride request straight from a horse or a jockey's page. They get to say yes or no.",
      },
      {
        title: "Preferred riders shortlist",
        blurb:
          "Pick up to 5 favourite jockeys. They get a gold star and jump to the top of the rider list on every meeting, so you spot them straight away.",
      },
    ],
  },
  {
    audience: "For owners",
    intro: "Keep an eye on your horses without the hassle.",
    features: [
      {
        title: "Link your horses",
        blurb:
          "We match your horses from the records so you just confirm which ones are yours.",
      },
      {
        title: "Upcoming runners",
        blurb:
          "See when your horses are racing next, where, and who the trainer and jockey are.",
      },
    ],
  },
  {
    audience: "For agents",
    intro: "Manage all your riders in one place.",
    features: [
      {
        title: "Your jockeys",
        blurb:
          "Add the jockeys you look after and see them all together, with their weights and claims.",
      },
      {
        title: "Your own agent page",
        blurb:
          "You get a page that lists the jockeys you represent, so trainers can find you and message you.",
      },
    ],
  },
  {
    audience: "Messages & notifications",
    intro: "Stay in touch and never miss a thing.",
    features: [
      {
        title: "In-app messages",
        blurb:
          "Chat with trainers, jockeys and agents right inside JockeyFinder about gear, transport and race-day plans.",
      },
      {
        title: "Email when you get a message",
        blurb:
          "If someone messages you and you're not online, we send you an email so you don't miss it.",
      },
      {
        title: "Choose your emails",
        blurb:
          "In your profile you can turn different emails on or off — like new messages, or news and announcements.",
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="What you can do"
        title="Features"
        description="Everything JockeyFinder can do, in plain English. We add to this list every time something new ships."
      />

      <div className="mt-8 space-y-10">
        {GROUPS.map((group) => (
          <section key={group.audience}>
            <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
              {group.audience}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{group.intro}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {group.features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-line bg-white p-5 shadow-card"
                >
                  <p className="font-display font-semibold text-ink">{f.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{f.blurb}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-turf-200 bg-turf-50/50 p-6 text-center">
        <p className="font-display text-lg font-semibold text-ink">Ready to jump in?</p>
        <p className="mt-1 text-sm text-zinc-600">It's free for everyone until 1 October 2026.</p>
        <Link
          href="/signup"
          className="mt-4 inline-block rounded-full bg-turf-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-turf-700"
        >
          Create your free account
        </Link>
      </div>
    </div>
  );
}
