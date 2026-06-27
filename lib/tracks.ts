// Approximate coordinates of New Zealand racecourses, for the geographical
// feasibility check (can a rider physically make two same-day meetings?).
// Decimal degrees. Keyed by a normalised track name.

export interface LatLng {
  lat: number;
  lng: number;
  island: "N" | "S";
}

const TRACKS: Record<string, LatLng> = {
  ellerslie: { lat: -36.892, lng: 174.819, island: "N" },
  pukekohe: { lat: -37.208, lng: 174.907, island: "N" },
  avondale: { lat: -36.897, lng: 174.7, island: "N" },
  "te rapa": { lat: -37.767, lng: 175.238, island: "N" },
  matamata: { lat: -37.809, lng: 175.775, island: "N" },
  cambridge: { lat: -37.892, lng: 175.47, island: "N" },
  tauranga: { lat: -37.7, lng: 176.167, island: "N" },
  "arawa park": { lat: -38.137, lng: 176.25, island: "N" },
  rotorua: { lat: -38.137, lng: 176.25, island: "N" },
  "te aroha": { lat: -37.54, lng: 175.71, island: "N" },
  taupo: { lat: -38.69, lng: 176.08, island: "N" },
  "new plymouth": { lat: -39.085, lng: 174.047, island: "N" },
  hawera: { lat: -39.591, lng: 174.283, island: "N" },
  wanganui: { lat: -39.93, lng: 175.05, island: "N" },
  whanganui: { lat: -39.93, lng: 175.05, island: "N" },
  awapuni: { lat: -40.376, lng: 175.593, island: "N" },
  "palmerston north": { lat: -40.376, lng: 175.593, island: "N" },
  woodville: { lat: -40.33, lng: 175.87, island: "N" },
  foxton: { lat: -40.47, lng: 175.29, island: "N" },
  otaki: { lat: -40.756, lng: 175.149, island: "N" },
  trentham: { lat: -41.134, lng: 175.044, island: "N" },
  hastings: { lat: -39.639, lng: 176.843, island: "N" },
  waipukurau: { lat: -39.99, lng: 176.56, island: "N" },
  gisborne: { lat: -38.66, lng: 178.0, island: "N" },
  nelson: { lat: -41.34, lng: 173.18, island: "S" },
  blenheim: { lat: -41.52, lng: 173.96, island: "S" },
  "riccarton park": { lat: -43.536, lng: 172.553, island: "S" },
  riccarton: { lat: -43.536, lng: 172.553, island: "S" },
  ashburton: { lat: -43.9, lng: 171.75, island: "S" },
  "phar lap raceway": { lat: -44.4, lng: 171.25, island: "S" },
  timaru: { lat: -44.4, lng: 171.25, island: "S" },
  oamaru: { lat: -45.097, lng: 170.97, island: "S" },
  wingatui: { lat: -45.867, lng: 170.35, island: "S" },
  dunedin: { lat: -45.867, lng: 170.35, island: "S" },
  gore: { lat: -46.1, lng: 168.94, island: "S" },
  "ascot park": { lat: -46.408, lng: 168.368, island: "S" },
  invercargill: { lat: -46.408, lng: 168.368, island: "S" },
  riverton: { lat: -46.35, lng: 168.02, island: "S" },
  cromwell: { lat: -45.1, lng: 169.2, island: "S" },
  omakau: { lat: -45.1, lng: 169.2, island: "S" },
  kurow: { lat: -44.73, lng: 170.47, island: "S" },
  reefton: { lat: -42.12, lng: 171.86, island: "S" },
  greymouth: { lat: -42.45, lng: 171.21, island: "S" },
  westport: { lat: -41.75, lng: 171.6, island: "S" },
};

function normalizeTrack(track: string): string {
  return track
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(racecourse|raceway|park raceway|synthetic|trials?|jumpouts?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getTrackCoords(track: string | null | undefined): LatLng | null {
  if (!track) return null;
  const n = normalizeTrack(track);
  if (TRACKS[n]) return TRACKS[n];
  // Try a prefix/contains match against known keys (e.g. "Riccarton Park Synthetic").
  for (const key of Object.keys(TRACKS)) {
    if (n === key || n.startsWith(key + " ") || n.includes(key)) return TRACKS[key];
  }
  // Fall back to the first word (e.g. "Te Rapa" → match on "te rapa" handled above).
  return null;
}

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export type Feasibility = "ok" | "tight" | "infeasible" | "unknown";

/** Assess whether one rider could plausibly make two same-day meetings. */
export function sameDayFeasibility(trackA: string, trackB: string): {
  level: Feasibility;
  km: number | null;
  note: string;
} {
  const a = getTrackCoords(trackA);
  const b = getTrackCoords(trackB);
  if (!a || !b) return { level: "unknown", km: null, note: "Track location unknown." };
  const km = distanceKm(a, b);
  if (a.island !== b.island) {
    return { level: "infeasible", km, note: `Different islands (~${km}km) — needs a flight; almost certainly not both.` };
  }
  if (km <= 60) return { level: "ok", km, note: `~${km}km apart — doable.` };
  if (km <= 250) return { level: "tight", km, note: `~${km}km apart — tight, only with a day/twilight split.` };
  return { level: "infeasible", km, note: `~${km}km apart — travel time makes both unlikely.` };
}
