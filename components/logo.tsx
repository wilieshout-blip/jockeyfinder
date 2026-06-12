import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({
  href = "/",
  dark = false,
  className,
}: {
  href?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="JockeyFinder home"
    >
      <Image
        src={dark ? "/brand/mark-white.png" : "/brand/mark-ink.png"}
        alt=""
        width={46}
        height={28}
        priority
        className="h-7 w-auto"
      />
      <span
        className={cn(
          "font-display text-base font-bold uppercase tracking-[0.14em]",
          dark ? "text-white" : "text-ink"
        )}
      >
        Jockey<span className="text-turf-600">Finder</span>
      </span>
    </Link>
  );
}
