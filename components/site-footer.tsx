import Link from "next/link";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-3 text-sm text-zinc-500">
              Plan rides. Book jockeys faster. See who is riding where.
              Built for New Zealand thoroughbred racing.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-sm">
            <div>
              <p className="mb-3 font-semibold text-ink">Product</p>
              <ul className="space-y-2 text-zinc-600">
                <li><Link className="hover:text-ink" href="/meetings">Race meetings</Link></li>
                <li><Link className="hover:text-ink" href="/jockeys">Jockey directory</Link></li>
                <li><Link className="hover:text-ink" href="/trainers">Trainer directory</Link></li>
                <li><Link className="hover:text-ink" href="/signup">Sign up</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 font-semibold text-ink">Account</p>
              <ul className="space-y-2 text-zinc-600">
                <li><Link className="hover:text-ink" href="/login">Log in</Link></li>
                <li><Link className="hover:text-ink" href="/dashboard">Dashboard</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-zinc-400 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} JockeyFinder. All rights reserved.</p>
          <p>Race calendar data sourced from LoveRacing / NZTR.</p>
        </div>
      </div>
    </footer>
  );
}
