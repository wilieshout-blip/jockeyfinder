import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Choose a new password for your JockeyFinder account.",
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
