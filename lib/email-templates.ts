// Starter templates for the admin broadcast console. Bodies are HTML inserted
// into the standard branded email layout (see lib/email.ts -> sendBroadcastEmail).
// The token {{first_name}} is replaced per recipient before sending.

export type Audience = "all" | "jockey" | "trainer" | "owner" | "agent";

export const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "all", label: "All users" },
  { value: "jockey", label: "Jockeys" },
  { value: "trainer", label: "Trainers" },
  { value: "owner", label: "Owners" },
  { value: "agent", label: "Agents" },
];

export function isAudience(v: string): v is Audience {
  return AUDIENCES.some((a) => a.value === v);
}

const SITE = "https://www.jockeyfinder.com";

function button(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;background:#16a34a;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:10px 22px;border-radius:99px">${label}</a>`;
}

function p(text: string) {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151">${text}</p>`;
}

function h2(text: string) {
  return `<h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827">${text}</h2>`;
}

export interface EmailTemplate {
  id: string;
  name: string;
  suggestedAudience: Audience;
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "blank",
    name: "Blank / write your own",
    suggestedAudience: "all",
    subject: "",
    body: `${h2("Heading")}${p("Hi {{first_name}},")}${p("Write your message here.")}${button("Open JockeyFinder →", SITE)}`,
  },
  {
    id: "announcement",
    name: "General announcement",
    suggestedAudience: "all",
    subject: "A quick update from JockeyFinder",
    body: `${h2("A quick update")}${p("Hi {{first_name}},")}${p(
      "We wanted to share a quick update with you about JockeyFinder. [Add your news here.]"
    )}${p("Thanks for being part of the community.")}${button("Open your dashboard →", `${SITE}/dashboard`)}`,
  },
  {
    id: "feature_shortlists",
    name: "New feature: preferred riders (trainers)",
    suggestedAudience: "trainer",
    subject: "New: shortlist your preferred riders",
    body: `${h2("Spot your go-to riders instantly")}${p("Hi {{first_name}},")}${p(
      "You can now build a shortlist of up to five preferred riders. They're starred and sorted to the top of the “Riding here” list on every meeting, so you can find your go-to jockeys at a glance."
    )}${p("Open your dashboard to add yours.")}${button("Set up your shortlist →", `${SITE}/dashboard`)}`,
  },
  {
    id: "jockey_attendance",
    name: "Jockeys: mark your attendance",
    suggestedAudience: "jockey",
    subject: "Let trainers know where you're riding",
    body: `${h2("Mark the meetings you're attending")}${p("Hi {{first_name}},")}${p(
      "Trainers look for available riders on every meeting page. Mark the meetings you're attending and keep your riding weight current so you show up when they're booking rides."
    )}${button("Update your calendar →", `${SITE}/dashboard/calendar`)}`,
  },
  {
    id: "free_until",
    name: "Reminder: free until 1 Oct 2026",
    suggestedAudience: "all",
    subject: "JockeyFinder is free for everyone until 1 October 2026",
    body: `${h2("Free for everyone — no card required")}${p("Hi {{first_name}},")}${p(
      "A reminder that JockeyFinder is completely free for everyone until 1 October 2026. Plan rides, book jockeys, and message connections at no cost — no credit card needed."
    )}${button("Open JockeyFinder →", SITE)}`,
  },
];
