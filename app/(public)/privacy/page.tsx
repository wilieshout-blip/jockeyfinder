import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How JockeyFinder collects, uses, stores and protects personal information.",
};

const sections = [
  {
    title: "1. Who we are",
    body: (
      <>
        <p>
          JockeyFinder is a New Zealand racing platform that helps jockeys,
          trainers, owners and agents plan meetings, request rides, confirm
          bookings and communicate about race-day activity.
        </p>
        <p>
          JockeyFinder is the agency responsible for personal information
          collected through jockeyfinder.com. For privacy questions, contact
          our Privacy Officer at{" "}
          <a
            href="mailto:Wilieshout@gmail.com"
            className="font-medium text-turf-700 underline"
          >
            Wilieshout@gmail.com
          </a>
          .
        </p>
      </>
    ),
  },
  {
    title: "2. Information we collect",
    body: (
      <>
        <p>Depending on how you use JockeyFinder, we may collect:</p>
        <ul>
          <li>name, email address, mobile number and account role;</li>
          <li>
            profile details such as region, photo, biography, licence type,
            riding weight, apprentice claim and preferred tracks;
          </li>
          <li>
            verification information, including registry matches and documents
            you choose or are required to upload;
          </li>
          <li>
            horse links, ownership claims, meeting attendance, ride requests,
            assignments and booking status;
          </li>
          <li>
            messages and other content shared with people in your booking or
            meeting conversations;
          </li>
          <li>
            subscription status and billing identifiers. Payment card details
            are handled by Stripe and are not stored by JockeyFinder; and
          </li>
          <li>
            basic technical information needed to run and secure the service,
            such as session cookies, device information, IP address and
            security logs.
          </li>
        </ul>
        <p>
          We may also receive racing information from NZTR, LoveRacing, TAB NZ,
          race cards and other lawful public or licensed racing sources. This
          can include names, licences, locations, entries, horses, trainers,
          jockeys, results and statistics.
        </p>
      </>
    ),
  },
  {
    title: "3. Why we use information",
    body: (
      <>
        <p>We use personal information where reasonably necessary to:</p>
        <ul>
          <li>create, secure and administer accounts;</li>
          <li>verify racing roles and reduce impersonation or misuse;</li>
          <li>show appropriate public directory and race-day information;</li>
          <li>
            match horses, participants, meetings, race entries and bookings;
          </li>
          <li>deliver messages, notifications and service emails;</li>
          <li>process subscriptions and provide billing support;</li>
          <li>operate, troubleshoot, improve and protect JockeyFinder; and</li>
          <li>meet legal obligations and respond to valid legal requests.</li>
        </ul>
        <p>
          We do not sell personal information or use private messages for
          third-party advertising.
        </p>
      </>
    ),
  },
  {
    title: "4. What other people can see",
    body: (
      <>
        <p>
          Verified jockey and trainer profiles may display selected professional
          information publicly, including name, profile photo, role, region,
          biography, riding details and racing activity. Test accounts and
          unapproved profiles are excluded from public directories.
        </p>
        <p>
          Booking details, stable information, horse links and messages are
          intended only for the account holders and authorised participants
          involved in that feature. Please avoid sharing information in a group
          chat that other participants do not need.
        </p>
      </>
    ),
  },
  {
    title: "5. Service providers and overseas processing",
    body: (
      <>
        <p>
          We use specialist providers to run JockeyFinder, including Supabase
          for authentication, database and storage services, Vercel for
          hosting, Stripe for payments and Resend for service email. These
          providers may process or store information outside New Zealand.
        </p>
        <p>
          We take reasonable steps to use reputable providers and safeguards
          appropriate to the information and the requirements of New Zealand
          privacy law. We may also disclose information where you direct us to,
          where it is necessary to provide a feature, or where disclosure is
          required or authorised by law.
        </p>
      </>
    ),
  },
  {
    title: "6. Storage and security",
    body: (
      <>
        <p>
          We use access controls, authenticated sessions, database row-level
          security, private document storage, encrypted network connections and
          restricted administrator tools to protect personal information.
          Identity documents are available only to authorised administrators.
        </p>
        <p>
          No internet service can promise absolute security. If we identify a
          privacy breach that may cause serious harm, we will follow applicable
          notification requirements and take reasonable steps to contain it.
          Please report suspected account misuse promptly.
        </p>
      </>
    ),
  },
  {
    title: "7. Retention",
    body: (
      <>
        <p>
          We retain account and racing information while it is needed to
          provide JockeyFinder, maintain reliable booking records, resolve
          disputes, prevent misuse and meet legal or financial obligations.
          Information that is no longer reasonably required may be deleted or
          de-identified.
        </p>
        <p>
          Verification documents are kept only for as long as reasonably needed
          for verification, review, dispute handling or legal requirements.
        </p>
      </>
    ),
  },
  {
    title: "8. Access, correction and account choices",
    body: (
      <>
        <p>
          You can update much of your account information from your profile.
          You may ask us for access to, or correction of, personal information
          we hold about you. You may also ask us to close your account, subject
          to information we need to retain lawfully or for legitimate booking
          records.
        </p>
        <p>
          Email the Privacy Officer using the address above. We may need to
          verify your identity before actioning a request.
        </p>
      </>
    ),
  },
  {
    title: "9. Cookies",
    body: (
      <p>
        JockeyFinder uses essential cookies and similar browser storage to keep
        you signed in, protect sessions and remember necessary account
        settings. Blocking essential cookies may prevent account features from
        working.
      </p>
    ),
  },
  {
    title: "10. Complaints and changes",
    body: (
      <>
        <p>
          Please contact us first if you have a privacy concern so we can try
          to resolve it. You can also make a complaint to the{" "}
          <a
            href="https://www.privacy.org.nz/your-rights/how-to-complain/"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-turf-700 underline"
          >
            Office of the Privacy Commissioner
          </a>
          .
        </p>
        <p>
          We may update this policy as JockeyFinder changes. The latest version
          will be published here with its effective date.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
      <Link
        href="/"
        className="text-sm font-medium text-turf-700 hover:underline"
      >
        Back to JockeyFinder
      </Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-turf-600">
        Legal
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">
        Privacy Policy
      </h1>
      <p className="mt-3 text-sm text-zinc-500">Effective 18 June 2026</p>
      <div className="mt-8 rounded-2xl border border-turf-200 bg-turf-50 p-5 text-sm leading-relaxed text-turf-800">
        This policy is written for JockeyFinder&apos;s New Zealand operations
        and is intended to explain our practices under the Privacy Act 2020.
      </div>

      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-xl font-semibold text-ink">
              {section.title}
            </h2>
            <div className="legal-copy mt-3 space-y-3 text-sm leading-7 text-zinc-600">
              {section.body}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
