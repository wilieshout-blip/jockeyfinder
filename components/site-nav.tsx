"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { buttonClasses } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/meetings", label: "Meetings" },
  { href: "/jockeys", label: "Jockeys" },
  { href: "/trainers", label: "Trainers" },
];

export function SiteNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Session-aware: logged-in users see Dashboard + Log out (not Log in/Sign up),
  // so visiting a public page (e.g. via the logo) no longer looks like a logout.
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setLoggedIn(!!session?.user)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/95 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo dark priority />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cn(
                "border-b px-3 py-2 text-xs font-semibold uppercase tracking-[0.13em] transition-colors",
                isActive(l.href)
                  ? "border-gold-400 text-white"
                  : "border-transparent text-zinc-400 hover:text-white"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          {loggedIn ? (
            <>
              <Link
                href="/dashboard"
                className={buttonClasses("inverse", "sm", "rounded-none border-transparent")}
              >
                Dashboard
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className={buttonClasses(
                    "accent",
                    "sm",
                    "rounded-none bg-gold-400 text-ink hover:bg-gold-300"
                  )}
                >
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                aria-current={pathname === "/login" ? "page" : undefined}
                className={buttonClasses(
                  "inverse",
                  "sm",
                  cn(
                    "rounded-none",
                    pathname === "/login" ? "border-gold-400" : "border-transparent"
                  )
                )}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                aria-current={pathname === "/signup" ? "page" : undefined}
                className={buttonClasses(
                  "accent",
                  "sm",
                  "rounded-none bg-gold-400 text-ink hover:bg-gold-300"
                )}
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <details className="group relative md:hidden">
          <summary className="list-none p-2 text-zinc-300 transition-colors hover:text-white">
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
          <div className="absolute right-0 mt-2 w-72 border border-zinc-800 bg-zinc-950 p-3 shadow-lift">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={cn(
                  "block border-l-2 px-3 py-3 text-base font-medium",
                  isActive(l.href)
                    ? "border-gold-400 bg-zinc-900 text-white"
                    : "border-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white"
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {loggedIn ? (
                <>
                  <Link
                    href="/dashboard"
                    className={buttonClasses("inverse", "md", "rounded-none")}
                  >
                    Dashboard
                  </Link>
                  <form action="/auth/signout" method="post">
                    <button
                      type="submit"
                      className={buttonClasses(
                        "accent",
                        "md",
                        "w-full rounded-none bg-gold-400 text-ink"
                      )}
                    >
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    aria-current={pathname === "/login" ? "page" : undefined}
                    className={buttonClasses("inverse", "md", "rounded-none")}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    aria-current={pathname === "/signup" ? "page" : undefined}
                    className={buttonClasses("accent", "md", "rounded-none bg-gold-400 text-ink")}
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
