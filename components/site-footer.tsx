import Link from "next/link";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <Logo dark />
            <p className="mt-4 max-w-xs text-sm leading-6 text-zinc-500">
              Race-day bookings and operations for New Zealand thoroughbred
              racing.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <div>
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-300">Product</p>
              <ul className="space-y-2.5 text-zinc-400">
                <li><Link className="hover:text-white" href="/meetings">Race meetings</Link></li>
                <li><Link className="hover:text-white" href="/jockeys">Jockey directory</Link></li>
                <li><Link className="hover:text-white" href="/trainers">Trainer directory</Link></li>
                <li><Link className="hover:text-white" href="/signup">Sign up</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-300">Account</p>
              <ul className="space-y-2.5 text-zinc-400">
                <li><Link className="hover:text-white" href="/login">Log in</Link></li>
                <li><Link className="hover:text-white" href="/dashboard">Dashboard</Link></li>
                <li>
                  <a
                    className="inline-flex items-center gap-1.5 hover:text-white"
                    href="https://instagram.com/jockeyfinder"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
                      <rect x="3" y="3" width="18" height="18" rx="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
                    </svg>
                    Instagram
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-300">Legal</p>
              <ul className="space-y-2.5 text-zinc-400">
                <li><Link className="hover:text-white" href="/privacy">Privacy policy</Link></li>
                <li><Link className="hover:text-white" href="/terms">Terms of service</Link></li>
                <li><a className="hover:text-white" href="mailto:wilieshout@gmail.com">wilieshout@gmail.com</a></li>
                <li><a className="hover:text-white" href="tel:+642041618711">+64 204 1618711</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-white/10 pt-6 text-xs text-zinc-600">
          <p>&copy; {new Date().getFullYear()} JockeyFinder. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
