const jockeys = [
  {
    name: "M. Vale",
    weight: "57kg",
    rides: "2 rides today",
    tag: "Senior",
    note: "Strong 1400m record",
  },
  {
    name: "R. Lennox",
    weight: "52kg",
    rides: "1 ride today",
    tag: "Best match",
    note: "Confirmed on course",
  },
  {
    name: "P. Stone",
    weight: "54kg",
    rides: "1 ride today",
    tag: "Available",
    note: "Has a gap before Race 6",
  },
  {
    name: "K. Avery",
    weight: "52.5kg",
    rides: "2 rides today",
    tag: "a1",
    note: "Claim available",
  },
];

const steps = [
  "Open meeting",
  "Pick rider",
  "Send request",
  "Ride accepted",
];

export function TrainerRideDemo() {
  const selected = jockeys[1];

  return (
    <div className="jockeybox-demo relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/90 p-3 shadow-lift backdrop-blur sm:p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-turf-200/60 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_12%,rgba(31,122,82,0.18),transparent_34%)]" />
      <div className="jockeybox-cursor pointer-events-none absolute z-30 hidden sm:block" aria-hidden>
        <svg
          className="demo-cursor"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 3.5L19 14.25L12.15 15.1L9.2 21L4 3.5Z"
            fill="white"
            stroke="#18181b"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-turf-400/80" />
            <div className="ml-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-turf-200">
                JockeyBox demo
              </p>
              <p className="mt-0.5 font-display text-sm font-semibold text-white">
                Trainer books a rider, jockey accepts
              </p>
            </div>
          </div>
          <div className="min-w-[148px] text-right">
            <span className="jockeybox-status inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
              <span className="jockeybox-status-idle">Trainer view</span>
              <span className="jockeybox-status-done">Jockey accepted</span>
            </span>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
              <div className="jockeybox-progress h-full rounded-full bg-turf-400" />
            </div>
          </div>
        </div>

        <div className="jockeybox-caption relative border-b border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300">
          <span className="jockeybox-caption-line jockeybox-caption-0">
            Trainer selects R. Lennox for Sunline at Te Rapa.
          </span>
          <span className="jockeybox-caption-line jockeybox-caption-1">
            The ride request is reviewed and sent.
          </span>
          <span className="jockeybox-caption-line jockeybox-caption-2">
            The jockey accepts and both sides receive confirmation.
          </span>
        </div>

        <div className="jockeybox-stage relative min-h-[420px] overflow-hidden">
          <div className="jockeybox-trainer-screen absolute inset-0 grid gap-0 lg:grid-cols-[0.58fr_1fr]">
            <div className="hidden border-b border-zinc-800 bg-zinc-900/70 p-3 lg:block lg:border-b-0 lg:border-r">
              <div className="jockeybox-meeting rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-zinc-900 text-center">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-turf-200">
                      Sat
                    </span>
                    <span className="font-display text-lg font-bold leading-none text-white">
                      14
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
                      Jun
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-semibold text-white">
                      Te Rapa
                    </p>
                    <p className="truncate text-xs text-zinc-400">
                      Race 6 - 1400m - Sunline
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  <span className="rounded-lg bg-zinc-900 py-1.5">Open ride</span>
                  <span className="rounded-lg bg-zinc-900 py-1.5">4 riders</span>
                  <span className="rounded-lg bg-zinc-900 py-1.5">Today</span>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {steps.map((label, index) => (
                  <div
                    key={label}
                    className={`jockeybox-step jockeybox-step-${index} flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-left text-xs text-zinc-500`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-display text-[10px] font-semibold text-zinc-500">
                      {index + 1}
                    </span>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Riding here
                  </p>
                  <p className="text-xs text-zinc-400">Available jockeys at Te Rapa</p>
                </div>
                <div className="jockeybox-filter rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-400">
                  52-57kg
                </div>
              </div>

              <div className="jockeybox-search mb-2 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-turf-400" />
                <span>Verified riders with a race-day gap</span>
              </div>

              <div className="jockeybox-list-window relative h-[196px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
                <div className="jockeybox-list-scroll space-y-2 p-2">
                  {jockeys.map((jockey, index) => {
                    const active = index === 1;
                    return (
                      <div
                        key={jockey.name}
                        className={`jockeybox-jockey ${active ? "jockeybox-jockey-selected" : ""} group w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-left`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-display text-xs font-semibold text-zinc-300">
                            {jockey.name[0]}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-zinc-100">
                              {jockey.name}
                            </span>
                            <span className="block truncate text-xs text-zinc-500">
                              {jockey.rides} - {jockey.note}
                            </span>
                          </span>
                          <span className="text-sm tabular-nums text-zinc-400">
                            {jockey.weight}
                          </span>
                          <span className="rounded-md bg-zinc-800 px-1.5 py-1 font-display text-[10px] font-semibold text-zinc-300">
                            {jockey.tag}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-zinc-950 to-transparent" />
              </div>

              <div className="jockeybox-profile-card absolute inset-x-3 bottom-3 rounded-xl border border-turf-700 bg-zinc-950/95 p-3 shadow-lift">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-turf-700 font-display text-sm font-semibold text-white">
                    R
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-sm font-semibold text-white">
                        {selected.name}
                      </p>
                      <span className="rounded-full bg-turf-900 px-2 py-0.5 text-[10px] font-semibold text-turf-100">
                        Best match
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      {selected.weight} - {selected.rides} - {selected.note}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      <span className="rounded-lg bg-zinc-900 px-2 py-1.5">Verified</span>
                      <span className="rounded-lg bg-zinc-900 px-2 py-1.5">On course</span>
                      <span className="rounded-lg bg-zinc-900 px-2 py-1.5">Can ride 52kg</span>
                    </div>
                  </div>
                </div>
                <button className="jockeybox-request-button mt-3 w-full rounded-lg bg-turf-600 px-3 py-2 text-xs font-semibold text-white">
                  Request ride
                </button>
              </div>

              <div className="jockeybox-request-card absolute inset-x-3 bottom-3 rounded-xl border border-turf-600 bg-zinc-950 p-3 shadow-lift">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-white">Ride request</p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      Sunline - Race 6 - 1400m
                    </p>
                  </div>
                  <span className="jockeybox-send rounded-lg bg-turf-600 px-3 py-2 text-xs font-semibold text-white">
                    Send
                  </span>
                </div>
                <div className="jockeybox-message mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Message to {selected.name}
                  </p>
                  <p className="mt-1 h-5 overflow-hidden text-xs font-medium text-zinc-200">
                    <span className="jockeybox-type">
                      Can you ride Sunline in Race 6?
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="jockeybox-jockey-screen absolute inset-0 bg-zinc-950 p-3">
            <div className="mx-auto flex h-full max-w-md flex-col justify-center">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-lift">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-turf-700 font-display text-sm font-semibold text-white">
                      R
                    </span>
                    <div>
                      <p className="font-display text-sm font-semibold text-white">
                        R. Lennox
                      </p>
                      <p className="text-xs text-zinc-500">Jockey view</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-amber-400/40 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">
                    New request
                  </span>
                </div>

                <div className="jockeybox-phone-request mt-4 rounded-xl border border-turf-700 bg-turf-950/40 p-3">
                  <p className="text-xs font-semibold text-turf-100">
                    Koru Gate Racing requests a ride
                  </p>
                  <p className="mt-2 font-display text-lg font-semibold text-white">
                    Sunline
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    <span className="rounded-lg bg-zinc-950 px-2 py-2">Race 6</span>
                    <span className="rounded-lg bg-zinc-950 px-2 py-2">1400m</span>
                    <span className="rounded-lg bg-zinc-950 px-2 py-2">52kg</span>
                  </div>
                  <p className="mt-3 rounded-lg bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300">
                    Can you ride Sunline in Race 6?
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300">
                    Decline
                  </button>
                  <button className="jockeybox-accept rounded-lg bg-turf-600 px-3 py-2 text-xs font-semibold text-white">
                    Accept ride
                  </button>
                </div>

                <div className="jockeybox-accepted mt-4 rounded-xl border border-turf-500 bg-turf-600 px-3 py-2.5 text-sm font-semibold text-white">
                  Ride accepted - trainer and jockey chat opened.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
