const jockeys = [
  {
    name: "O. Bosson",
    weight: "57kg",
    claim: null,
    rides: "Te Rapa - 3 rides",
    note: "Senior rider, strong 1400m record",
  },
  {
    name: "C. Grylls",
    weight: "53kg",
    claim: null,
    rides: "Te Rapa - 5 rides",
    note: "Available after Race 4",
  },
  {
    name: "S. Spratt",
    weight: "52kg",
    claim: null,
    rides: "Te Rapa - 2 rides",
    note: "Confirmed on course",
  },
  {
    name: "M. Hashizume",
    weight: "51.5kg",
    claim: "a2",
    rides: "Te Rapa - 4 rides",
    note: "Apprentice claim available",
  },
];

const steps = [
  "Open meeting",
  "Scan jockeys",
  "Choose rider",
  "Request ride",
  "Request sent",
];

export function TrainerRideDemo() {
  const selected = jockeys[2];

  return (
    <div className="jockeybox-demo relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/90 p-3 shadow-lift backdrop-blur sm:p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-turf-200/60 to-transparent" />
      <div className="jockeybox-cursor pointer-events-none absolute z-20 hidden h-8 w-8 sm:block" aria-hidden>
        <div className="demo-cursor" />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-3 py-2.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-turf-200">
              JockeyBox
            </p>
            <p className="mt-0.5 font-display text-sm font-semibold text-white">
              Trainer booking flow
            </p>
          </div>
          <span className="jockeybox-status rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
            Request sent to {selected.name}
          </span>
        </div>

        <div className="grid min-h-[480px] gap-0 lg:grid-cols-[0.72fr_1fr]">
          <div className="border-b border-zinc-800 bg-zinc-900/70 p-3 lg:border-b-0 lg:border-r">
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
                    Race 6 - 1400m - Our filly needs a rider
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {steps.map((label, index) => (
                <div
                  key={label}
                  className={`jockeybox-step jockeybox-step-${index} flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-left text-xs text-zinc-500`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="relative p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Riding here
                </p>
                <p className="text-xs text-zinc-400">Available jockeys at Te Rapa</p>
              </div>
              <span className="rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-400">
                4 verified
              </span>
            </div>

            <div className="space-y-2">
              {jockeys.map((jockey, index) => {
                const active = index === 2;
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
                          {jockey.rides}
                        </span>
                      </span>
                      <span className="text-sm tabular-nums text-zinc-400">
                        {jockey.weight}
                      </span>
                      {jockey.claim ? (
                        <span className="rounded-md bg-turf-600 px-1.5 py-1 font-display text-xs font-semibold text-white">
                          {jockey.claim}
                        </span>
                      ) : null}
                    </div>
                    {active ? (
                      <div className="jockeybox-note mt-2 rounded-lg bg-zinc-950/60 px-3 py-2 text-xs text-turf-100">
                        {jockey.note}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="jockeybox-request mt-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-white">Request ride</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Belle Of Waikato - Race 6 - 1400m
                  </p>
                </div>
                <span className="jockeybox-send rounded-lg bg-turf-600 px-3 py-2 text-xs font-semibold text-white">
                  Send request
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  ["Rider", selected.name],
                  ["Weight", selected.weight],
                  ["Status", "Ready"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-zinc-950/60 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      {label}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-zinc-100">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="jockeybox-toast absolute inset-x-3 bottom-3 rounded-xl border border-turf-500 bg-turf-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lift">
              Ride request sent - chat opens when the rider responds.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
