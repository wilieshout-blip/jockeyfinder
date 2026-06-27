import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
      <p className="font-display text-6xl font-bold tracking-tight text-turf-600">404</p>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-2 max-w-md text-zinc-600">
        It may have moved, the race day may be over, or it never existed. Let&apos;s get you back on track.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="rounded-full bg-turf-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-turf-700">
          Home
        </Link>
        <Link href="/meetings" className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-turf-300">
          Race meetings
        </Link>
        <Link href="/features" className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-turf-300">
          Features
        </Link>
      </div>
    </div>
  );
}
