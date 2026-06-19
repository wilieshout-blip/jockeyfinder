import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using JockeyFinder.",
};

export default function TermsPage() {
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
        Terms of Service
      </h1>
      <p className="mt-3 text-sm text-zinc-500">Effective 18 June 2026</p>

      <div className="legal-copy mt-10 space-y-8 text-sm leading-7 text-zinc-600">
        <section>
          <h2>Using JockeyFinder</h2>
          <p>
            You must provide accurate account information, keep your login
            secure and use the platform only for lawful New Zealand racing
            activity. You are responsible for actions taken through your
            account.
          </p>
        </section>
        <section>
          <h2>Profiles and verification</h2>
          <p>
            We may verify accounts against racing registers or documents,
            decline or remove a profile, and restrict features where identity,
            authority or licence status cannot be confirmed. Verification is a
            platform trust measure and is not a guarantee of professional
            performance or suitability.
          </p>
        </section>
        <section>
          <h2>Bookings and racing information</h2>
          <p>
            JockeyFinder helps people communicate and record ride arrangements.
            Users remain responsible for checking official race conditions,
            declarations, licences, weights, availability and final bookings.
            Racing information can change and may occasionally be delayed or
            incomplete.
          </p>
          <p>
            Racing information shown on JockeyFinder is compiled from publicly
            available and lawfully obtained racing sources, including New Zealand
            Thoroughbred Racing and LOVERACING.NZ data. JockeyFinder is an
            independent platform and is not affiliated with, endorsed by, or an
            official service of New Zealand Thoroughbred Racing or LOVERACING.NZ.
          </p>
        </section>
        <section>
          <h2>Acceptable use</h2>
          <p>
            Do not impersonate another person, scrape or overload the service,
            bypass access controls, upload malicious material, harass users,
            publish private information without authority or use JockeyFinder
            to arrange unlawful activity.
          </p>
        </section>
        <section>
          <h2>Subscriptions</h2>
          <p>
            Paid features are billed at the price shown when you subscribe.
            Stripe processes payments. You can manage or cancel an active
            subscription through the billing portal, subject to the billing
            terms shown at purchase and applicable consumer law.
          </p>
        </section>
        <section>
          <h2>Availability and liability</h2>
          <p>
            We work to keep JockeyFinder reliable and secure but cannot promise
            uninterrupted or error-free access. To the extent permitted by law,
            JockeyFinder is not responsible for racing decisions, missed rides,
            user conduct or losses caused by reliance on information that
            should have been checked against official sources.
          </p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>
            Questions about these terms can be sent to{" "}
            <a
              href="mailto:Wilieshout@gmail.com"
              className="font-medium text-turf-700 underline"
            >
              Wilieshout@gmail.com
            </a>
            . These terms are governed by New Zealand law.
          </p>
        </section>
      </div>
    </div>
  );
}
