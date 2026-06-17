import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to manage JockeyFinder race-day bookings and availability.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
