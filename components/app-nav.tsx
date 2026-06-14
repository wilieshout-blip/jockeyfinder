"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const PRIMARY = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/meetings", label: "Meetings" },
  { href: "/jockeys", label: "Find Jockeys" },
];

function moreItems(role: Role, isAdmin: boolean) {
  const items: { href: string; label: string }[] = [];
  if (role === "jockey" || role === "agent") {
    items.push({ href: "/dashboard/calendar", label: "My Calendar" });
  }
  items.push(
    { href: "/trainers", label: "Trainers" },
    { href: "/dashboard/requests", label: "Ride Requests" },
    { href: "/dashboard/messages", label: "Messages" }
  );
  if (role === "agent") {
    items.push({ href: "/dashboard/agent", label: "My Jockeys" });
  }
  if (role === "jockey" || role === "agent") {
    items.push({ href: "/dashboard/billing", label: "Billing" });
  }
  return items;
}

export function AppNav({
  name,
  role,
  photoUrl,
  isAdmin,
}: {
  name: string;
  role: Role;
  photoUrl: string | null;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const secondary = moreItems(role, isAdmin);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  const linkCls = (href: string, exact = false) =>
    cn(
      "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"))
        ? "bg-ink text-white"
        : "text-zinc-600 hover:bg-mist hover:text-ink"
    );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-1">
          <Logo href="/dashboard" />
          <nav className="ml-4 hidden items-center gap-0.5 lg:flex" aria-label="Main">
            {PRIMARY.map((item) => (
              <Link key={item.href} href={item.href} className={linkCls(item.href, item.href === "/dashboard")}>
                {item.label}
              </Link>
            ))}
            <div ref={moreRef} className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  moreOpen ? "bg-mist text-ink" : "text-zinc-600 hover:bg-mist hover:text-ink"
                )}
              >
                More
                <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {moreOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-48 rounded-xl border border-line bg-white py-1.5 shadow-lift">
                  {secondary.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn("block px-3 py-2 text-sm font-medium transition-colors", pathname === item.href ? "text-turf-700" : "text-zinc-700 hover:bg-mist hover:text-ink")}
                    >
                      {item.label}
                    </Link>
                  ))}
                  {isAdmin && (
                    <>
                      <div className="my-1.5 border-t border-line" />
                      <Link href="/admin" className="block px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-mist hover:text-ink">Admin</Link>
                    </>
                  )}
                </div>
              )}
            </div>
          </nav>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-mist"
            >
              <Avatar src={photoUrl} name={name} size="sm" />
              <div className="text-left leading-tight">
                <p className="max-w-[140px] truncate text-sm font-medium text-ink">{name}</p>
                <p className="text-xs capitalize text-zinc-500">{role}</p>
              </div>
              <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5 text-zinc-400 transition-transform", profileOpen && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-line bg-white py-1.5 shadow-lift">
                <Link href="/dashboard/profile" className="block px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-mist hover:text-ink">My Profile</Link>
                <div className="my-1.5 border-t border-line" />
                <form action="/auth/signout" method="post">
                  <button type="submit" className="block w-full px-3 py-2 text-left text-sm font-medium text-zinc-500 hover:bg-mist hover:text-ink">Log out</button>
                </form>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-zinc-700 hover:bg-mist lg:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-label="Toggle menu"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-white px-4 pb-6 pt-3 lg:hidden">
          <nav className="space-y-0.5">
            {[...PRIMARY, ...secondary].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn("block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", pathname === item.href ? "bg-ink text-white" : "text-zinc-600 hover:bg-mist hover:text-ink")}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-500 hover:bg-mist">Admin</Link>
            )}
          </nav>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <div className="flex items-center gap-2.5">
              <Avatar src={photoUrl} name={name} size="sm" />
              <div className="leading-tight">
                <p className="text-sm font-medium text-ink">{name}</p>
                <p className="text-xs capitalize text-zinc-500">{role}</p>
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button type="submit" className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-mist hover:text-ink">Log out</button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
    }
