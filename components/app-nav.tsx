"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

function navItems(role: Role, isAdmin: boolean) {
  const items = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/meetings", label: "Meetings" },
  ];
  if (role === "jockey" || role === "agent") {
    items.push({ href: "/dashboard/calendar", label: "My Calendar" });
  }
  items.push(
    { href: "/jockeys", label: "Jockeys" },
    { href: "/trainers", label: "Trainers" },
    { href: "/dashboard/requests", label: "Requests" },
    { href: "/dashboard/messages", label: "Messages" }
  );
  if (role === "agent") items.push({ href: "/dashboard/agent", label: "My Jockeys" });
  if (role === "jockey" || role === "agent") {
    items.push({ href: "/dashboard/billing", label: "Billing" });
  }
  items.push({ href: "/dashboard/profile", label: "Profile" });
  if (isAdmin) items.push({ href: "/admin", label: "Admin" });
  return items;
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function AppNav({
  name,
  role,
  photoUrl,
  isAdmin,
  requestBadge = 0,
  messageBadge = 0,
}: {
  name: string;
  role: Role;
  photoUrl: string | null;
  isAdmin: boolean;
  requestBadge?: number;
  messageBadge?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = navItems(role, isAdmin);

  const badges: Record<string, number> = {
    "/dashboard/requests": requestBadge,
    "/dashboard/messages": messageBadge,
  };

  const linkClass = (href: string) =>
    cn(
      "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      pathname === href
        ? "bg-ink text-white"
        : "text-zinc-600 hover:bg-mist hover:text-ink"
    );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo href="/dashboard" />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="App">
            {items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={cn(linkClass(i.href), "flex items-center py-2")}
              >
                {i.label}
                <NavBadge count={badges[i.href] ?? 0} />
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <div className="flex items-center gap-2.5">
            <Avatar src={photoUrl} name={name} size="sm" />
            <div className="leading-tight">
              <p className="max-w-[160px] truncate text-sm font-medium text-ink">{name}</p>
              <p className="text-xs capitalize text-zinc-500">{role}</p>
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-mist hover:text-ink">
              Log out
            </button>
          </form>
        </div>

        <button
          className="rounded-lg p-2 text-zinc-700 hover:bg-mist lg:hidden"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div className="border-t border-line bg-white px-4 pb-5 pt-2 lg:hidden">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              onClick={() => setOpen(false)}
              className={cn(linkClass(i.href), "flex items-center")}
            >
              {i.label}
              <NavBadge count={badges[i.href] ?? 0} />
            </Link>
          ))}
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <div className="flex items-center gap-2.5">
              <Avatar src={photoUrl} name={name} size="sm" />
              <div className="leading-tight">
                <p className="text-sm font-medium text-ink">{name}</p>
                <p className="text-xs capitalize text-zinc-500">{role}</p>
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-mist">
                Log out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </header>
  );
  }
