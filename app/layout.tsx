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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: {
    default: "JockeyFinder - Plan rides. Book jockeys faster.",
    template: "%s - JockeyFinder",
  },
  description:
    "The ride planning platform for New Zealand thoroughbred racing. See who is riding where, request rides, and confirm bookings in one place.",
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
