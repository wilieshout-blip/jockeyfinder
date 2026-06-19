"use client";

import { useState } from "react";
import Link from "next/link";
import { JockeyCards } from "./jockey-cards";
import { RegistryPeopleList } from "@/components/registry-people-list";
import type { DirectoryJockey, JockeyStat } from "./jockey-cards";
import type { RegistryPerson } from "@/components/registry-people-list";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ISLAND_REGIONS: Record<string, string[]> = {
      "North Island": [
            "Northland", "Auckland", "Waikato", "Bay of Plenty", "Gisborne",
                "Hawke's Bay", "Taranaki", "Manawatu", "Wellington",
      ],
        "South Island": [
                "Nelson/Marlborough", "West Coast", "Canterbury", "Otago", "Southland",
        ],
};

const REGION_KEYWORDS: Record<string, string[]> = {
      Northland: ["northland", "whangarei"],
        Auckland: ["auckland"],
          Waikato: ["waikato", "hamilton", "cambridge", "matamata"],
            "Bay of Plenty": ["bay of plenty", "bop", "tauranga", "rotorua", "whakatane"],
              Gisborne: ["gisborne"],
                "Hawke's Bay": ["hawke", "hastings", "napier"],
                  Taranaki: ["taranaki", "new plymouth"],
                    Manawatu: ["manawatu", "palmerston north", "whanganui", "rangitikei", "horowhenua", "levin"],
                      Wellington: ["wellington", "kapiti", "hutt", "masterton", "wairarapa", "lower hutt", "upper hutt"],
                        "Nelson/Marlborough": ["nelson", "marlborough", "tasman", "blenheim", "motueka"],
                          "West Coast": ["west coast", "greymouth", "hokitika"],
                            Canterbury: ["canterbury", "christchurch", "selwyn", "waimakariri", "ashburton"],
                              Otago: ["otago", "dunedin", "queenstown", "central otago", "alexandra"],
                                Southland: ["southland", "invercargill", "gore"],
};

function matchesRegion(text: string | null, island: string | null, region: string | null): boolean {
      if (!island && !region) return true;
        if (!text) return false;
          const lower = text.toLowerCase();
            if (region) return REGION_KEYWORDS[region]?.some((kw) => lower.includes(kw)) ?? false;
              return ISLAND_REGIONS[island!]?.some((r) => REGION_KEYWORDS[r]?.some((kw) => lower.includes(kw))) ?? false;
}

interface Props {
      jockeys: DirectoryJockey[];
        stats: JockeyStat[];
          counts: Record<string, number>;
            registryPeople: RegistryPerson[];
}

export function JockeyDirectory({ jockeys, stats, counts, registryPeople }: Props) {
      const [island, setIsland] = useState<string | null>(null);
        const [region, setRegion] = useState<string | null>(null);

          function selectIsland(i: string) {
                if (island === i) { setIsland(null); setRegion(null); }
                    else { setIsland(i); setRegion(null); }
          }
            function selectRegion(r: string) { setRegion(region === r ? null : r); }
              function clear() { setIsland(null); setRegion(null); }

                const isFiltered = !!island;
                  const activeRegions = island ? ISLAND_REGIONS[island] : [];
                    const filteredJockeys = jockeys.filter((j) => matchesRegion(j.base_region, island, region));
                      const filteredRegistry = registryPeople.filter((p) => matchesRegion(p.location, island, region));

                        return (
                                <div>
                                      <div className="mb-6 space-y-3">
                                              <div className="flex flex-wrap items-center gap-2">
                                                        {["North Island", "South Island"].map((i) => (
                                                                        <button key={i} type="button" onClick={() => selectIsland(i)}
                                                                                      aria-pressed={island === i}
                                                                                      className={cn("rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                                                                                                      island === i ? "border-ink bg-ink text-white" : "border-line bg-white text-zinc-700 hover:border-zinc-400")}>
                                                                                                                    {i}
                                                                                                                                </button>
                        ))}
                                  {isFiltered && (
                                                <button type="button" onClick={clear} className="px-2 text-sm text-zinc-400 hover:text-zinc-600">
                                                              Clear ×
                                                                          </button>
                                  )}
                                          </div>
                                                  {island && (
                                                              <div className="flex flex-wrap gap-2">
                                                                          {activeRegions.map((r) => (
                                                                                          <button key={r} type="button" onClick={() => selectRegion(r)}
                                                                                                          aria-pressed={region === r}
                                                                                                          className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                                                                                                                            region === r ? "border-turf-600 bg-turf-600 text-white" : "border-line bg-white text-zinc-600 hover:border-turf-400")}>
                                                                                                                                            {r}
                                                                                                                                                          </button>
                                                  ))}
                                                            </div>
                        )}
                              </div>
                              
                                    {filteredJockeys.length > 0 ? (
                                                <JockeyCards jockeys={filteredJockeys} stats={stats} counts={counts} />
                                    ) : (
                                                <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center">
                                                          <p className="text-sm text-zinc-500">
                                                                      {isFiltered ? "No verified jockeys in this region." : "No verified jockeys yet."}
                                                                                </p>
                                                                                        </div>
                                    )}

                                          {registryPeople.length > 0 && (
                                                    <section className="mt-12">
                                                              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                                                                          <div>
                                                                                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">NZTR register</p>
                                                                                                      <h2 className="font-display text-xl font-semibold tracking-tight text-ink">Not on JockeyFinder yet</h2>
                                                                                                                    <p className="mt-1 max-w-2xl text-sm text-zinc-500">
                                                                                                                                    Licensed jockeys listed on the public NZTR register. Tap a name to see their contact info.
                                                                                                                                                    They unlock their full profile the moment they sign up.
                                                                                                                                                                  </p>
                                                                                                                                                                              </div>
                                                                                                                                                                                          <Link href="/signup?role=jockey" className={buttonClasses("outline", "sm")}>I am a jockey, sign me up</Link>
                                                                                                                                                                                                    </div>
                                                                                                                                                                                                              {filteredRegistry.length > 0 ? (
                                                                                                                                                                                                                            <RegistryPeopleList people={filteredRegistry} />
                                                                                                                                                                                                              ) : (
                                                                                                                                                                                                                            <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-6 text-center">
                                                                                                                                                                                                                                          <p className="text-sm text-zinc-500">No registry entries for this region.</p>
                                                                                                                                                                                                                                                      </div>
                                                                                                                                                                                                              )}
                                                                                                                                                                                                                      </section>
                                          )}
                                              </div>
                        );
}
