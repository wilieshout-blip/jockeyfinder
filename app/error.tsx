"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
      <p className="font-display text-5xl font-bold tracking-tight text-amber-500">Oops</p>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-zinc-600">
        That&apos;s on us, not you. Try again, or head back home — the rest of the site is fine.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-turf-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-turf-700"
        >
          Try again
        </button>
        <Link href="/" className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-turf-300">
          Home
        </Link>
      </div>
    </div>
  );
}
