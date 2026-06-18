import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { FreeUntilBanner } from "@/components/ui/free-until-banner";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.jockeyfinder.com";

const description =
  "The ride planning platform for New Zealand thoroughbred racing. See who is riding where, request rides, and confirm bookings in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "JockeyFinder",
  title: {
    default: "JockeyFinder - Plan rides. Book jockeys faster.",
    template: "%s - JockeyFinder",
  },
  description,
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_NZ",
    siteName: "JockeyFinder",
    url: siteUrl,
    title: "JockeyFinder — Race day bookings, simplified.",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "JockeyFinder — Race day bookings, simplified.",
    description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-NZ" className={`${sans.variable} ${display.variable}`}>
      <body>
        <FreeUntilBanner />
        {children}
      </body>
    </html>
  );
}
