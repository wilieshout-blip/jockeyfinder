import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/premium";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Everything JockeyFinder can do, explained in plain English — for jockeys, trainers, owners, agents and admins.",
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
      { title: "See every race meeting", blurb: "A list of all the upcoming race days in New Zealand. Tap one to see the races, horses and who's riding." },
      { title: "List or calendar view", blurb: "See the race days as a simple list, or flip to a calendar to see the whole month and tap any day." },
      { title: "Race cards", blurb: "For each race day: every race, every horse, the barrier, the weight and the jockey riding them." },
      { title: "Premier days highlighted", blurb: "Meetings with a Group or Listed (black-type) feature race get a gold highlight so the big days stand out." },
      { title: "Finished races are marked", blurb: "Once a race has run it gets a line through it and says “Finished”, and the meeting drops off the list afterwards." },
      { title: "Find jockeys, trainers & agents", blurb: "Searchable directories. Tap anyone to see their page — including an agent's page with the riders they represent." },
      { title: "Free until 1 October 2026", blurb: "JockeyFinder is free for everyone until then — no credit card needed to join." },
    ],
  },
  {
    audience: "For jockeys",
    intro: "Show trainers you're available and ready to ride.",
    features: [
      { title: "Your profile page", blurb: "Your name, riding weight, apprentice claim, season stats and the meetings you're attending." },
      { title: "Mark you're attending", blurb: "Tap “I'm attending” on a meeting so trainers know you'll be there to book." },
      { title: "Riding weight with a safety check", blurb: "Keep your weight up to date. If you type something that looks like a typo, it asks “is that right?” before saving." },
      { title: "Season stats", blurb: "Your wins and placings for the season show on your profile, pulled from the official results." },
      { title: "Black book", blurb: "Keep a private list of horses you like. When one is entered to race soon, it shows up under “racing soon”." },
      { title: "Your agent on your profile", blurb: "If you have an agent, their name (and phone, if you allow it) shows on your page with a link to them." },
      { title: "Contact privacy", blurb: "You choose whether your phone shows, and whether your agent's phone shows. Owners never see your personal number." },
      { title: "Pre & post-race voice notes", blurb: "Record a quick 30-second audio note about how a horse felt — shared only with the people in that ride's chat." },
    ],
  },
  {
    audience: "For trainers",
    intro: "Find and book the right rider, fast.",
    features: [
      { title: "Your stable, loaded for you", blurb: "We find your horses from the race records so you just tick “mine / not mine” instead of typing them in." },
      { title: "Your runners", blurb: "All your horses entered to race soon, with the meeting, race and who's riding." },
      { title: "Request a jockey", blurb: "Send a ride request from a horse or a jockey's page. They're notified by email (and text, if set up) to respond." },
      { title: "Preferred riders shortlist", blurb: "Pick up to 5 favourite jockeys — they get a gold star and jump to the top of the rider list on every meeting." },
      { title: "S.O.S. ride-vacancy beacon", blurb: "Got a last-minute gap? One tap alerts every verified jockey marked attending who isn't already booked there." },
      { title: "Gap finder", blurb: "If a horse your rider was booked on gets scratched, we flag that rider as freed up so you can re-book them." },
      { title: "Stable team", blurb: "Invite assistant trainers or foremen so your whole operation shares the same ride requests." },
    ],
  },
  {
    audience: "For owners & syndicates",
    intro: "Keep your horses — and your fellow owners — in the loop.",
    features: [
      { title: "Link your horses", blurb: "We match your horses from the records so you just confirm which ones are yours." },
      { title: "Upcoming runners", blurb: "See when your horses race next, where, and who the trainer and jockey are." },
      { title: "Run a syndicate", blurb: "Create an ownership group, add your horses and invite the micro-owners by email." },
      { title: "One update to everyone", blurb: "Syndicate managers write a single update and it's emailed to every micro-owner at once." },
      { title: "Jockey-booked alerts", blurb: "The moment a jockey is assigned to your horse, you (and every syndicate member) get an email." },
      { title: "Privacy firewall", blurb: "Owners don't see a jockey's personal contact details — questions route through the trainer or manager." },
    ],
  },
  {
    audience: "For agents",
    intro: "Manage your whole book in one place.",
    features: [
      { title: "Your jockeys", blurb: "Add the riders you look after and see them together with their weights and claims." },
      { title: "Your own agent page", blurb: "A public page listing the jockeys you represent, so trainers can find and message you." },
      { title: "Black book", blurb: "Track horses for your riders and get a heads-up when they're entered to race." },
      { title: "No double-booking", blurb: "We stop you accidentally booking two of your own riders on the same horse — while still letting you chase options across different horses." },
    ],
  },
  {
    audience: "Messages & alerts",
    intro: "Stay in touch wherever you are.",
    features: [
      { title: "In-app messages", blurb: "Chat with trainers, jockeys and agents about gear, transport and race-day plans." },
      { title: "Email when you get a message", blurb: "Not online? We email you so you don't miss it." },
      { title: "Text-message fallback", blurb: "When SMS is switched on, a high-priority request you haven't opened in 15 minutes is sent to your phone with a quick link." },
      { title: "Choose your emails", blurb: "Turn different emails on or off in your profile — new messages, or news and announcements." },
    ],
  },
  {
    audience: "Safety & fair play",
    intro: "Behind-the-scenes tools that keep things accurate and above board.",
    features: [
      { title: "Medical stand-down alerts", blurb: "If a rider is stood down, only the trainers booked with them in the exact affected race(s) are told — nothing is guessed or auto-published." },
      { title: "Travel feasibility check", blurb: "If someone marks attendance at two meetings a long way apart on the same day, it's flagged as tight or impossible." },
      { title: "Weight & clash monitor", blurb: "Unrealistic riding weights or same-day double-ups are flagged for a human to check." },
      { title: "Chat oversight", blurb: "Admins can review booking chats to step in if anyone tries to deal outside the platform." },
      { title: "Verified accounts", blurb: "Jockeys, trainers and agents are checked before they appear publicly, and accounts can be paused if needed." },
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
