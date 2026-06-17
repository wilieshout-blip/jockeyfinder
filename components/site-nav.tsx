import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonClasses } from "@/components/ui/button";

const links = [
  { href: "/", label: "Home" },
  { href: "/meetings", label: "Meetings" },
  { href: "/jockeys", label: "Jockeys" },
  { href: "/trainers", label: "Trainers" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo priority />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-mist hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          <Link href="/login" className={buttonClasses("ghost", "sm")}>
            Log in
          </Link>
          <Link href="/signup" className={buttonClasses("accent", "sm")}>
            Sign up
          </Link>
        </div>

        <details className="group relative md:hidden">
          <summary className="list-none rounded-lg p-2 text-zinc-700 transition-colors hover:bg-mist">
            <span className="sr-only">Toggle menu</span>
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 group-open:hidden"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
            <svg
              viewBox="0 0 24 24"
              className="hidden h-6 w-6 group-open:block"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </summary>
          <div className="absolute right-0 mt-2 w-72 rounded-xl border border-line bg-paper p-3 shadow-lift">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="block rounded-lg px-3 py-3 text-base font-medium text-zinc-700 hover:bg-mist"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <Link href="/login" className={buttonClasses("outline")}>
                Log in
              </Link>
              <Link href="/signup" className={buttonClasses("accent")}>
                Sign up
              </Link>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
