// A small 2D render of racing silks from a free-text description such as
// "Cambridge blue, black V, white sleeves, red cap". Best-effort: maps common
// NZ colour names + a few patterns onto an SVG jersey. Self-contained — give it
// any description string.

const COLOURS: Record<string, string> = {
  "cambridge blue": "#a3c1e0",
  "light blue": "#7fb2e5",
  "royal blue": "#1f4fd0",
  navy: "#0b1f52",
  blue: "#1f64d0",
  red: "#d62828",
  maroon: "#7b1f2b",
  pink: "#f06fae",
  orange: "#f08a24",
  gold: "#e8b923",
  yellow: "#f2d600",
  green: "#1f9e57",
  "dark green": "#0f5c34",
  emerald: "#10996b",
  white: "#ffffff",
  cream: "#f6efd9",
  black: "#1a1a1a",
  grey: "#8a8f98",
  gray: "#8a8f98",
  silver: "#c7ccd2",
  purple: "#7b3fb0",
  violet: "#7b3fb0",
  brown: "#7a4a24",
  tan: "#c8a16a",
  teal: "#179a9a",
};

function findColour(text: string, fallback: string): string {
  const t = text.toLowerCase();
  // Longest names first so "cambridge blue" beats "blue".
  for (const name of Object.keys(COLOURS).sort((a, b) => b.length - a.length)) {
    if (t.includes(name)) return COLOURS[name];
  }
  return fallback;
}

interface Parts {
  body: string;
  sleeves: string;
  cap: string;
  pattern: "solid" | "v" | "hoops" | "stripes" | "sash" | "star" | "spots" | "halves";
  patternColour: string;
}

function parseSilks(desc: string): Parts {
  const lower = (desc || "").toLowerCase();
  const segs = lower.split(/[,;]| and /).map((s) => s.trim()).filter(Boolean);

  const bodySeg = segs[0] ?? "";
  const sleeveSeg = segs.find((s) => /sleeve/.test(s)) ?? "";
  const capSeg = segs.find((s) => /cap/.test(s)) ?? "";
  const patternSeg = segs.find((s) => /(v|hoop|stripe|sash|star|spot|half|halve)/.test(s)) ?? "";

  let pattern: Parts["pattern"] = "solid";
  if (/\bhoop/.test(lower)) pattern = "hoops";
  else if (/\bstripe/.test(lower)) pattern = "stripes";
  else if (/\bsash/.test(lower)) pattern = "sash";
  else if (/\bstar/.test(lower)) pattern = "star";
  else if (/\bspot|spotted|dots?/.test(lower)) pattern = "spots";
  else if (/\bhalf|halve/.test(lower)) pattern = "halves";
  else if (/\bv\b|chevron/.test(lower)) pattern = "v";

  const body = findColour(bodySeg, "#1f64d0");
  const sleeves = sleeveSeg ? findColour(sleeveSeg, body) : body;
  const cap = capSeg ? findColour(capSeg, body) : body;
  const patternColour = patternSeg ? findColour(patternSeg, "#ffffff") : "#ffffff";

  return { body, sleeves, cap, pattern, patternColour };
}

export function SilkPreview({
  description,
  size = 40,
}: {
  description: string | null | undefined;
  size?: number;
}) {
  if (!description) return null;
  const p = parseSilks(description);

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={`Silks: ${description}`}>
      {/* sleeves */}
      <path d="M8 12 L2 18 L5 26 L11 22 Z" fill={p.sleeves} stroke="#0003" strokeWidth="0.5" />
      <path d="M32 12 L38 18 L35 26 L29 22 Z" fill={p.sleeves} stroke="#0003" strokeWidth="0.5" />
      {/* body */}
      <path d="M11 11 Q20 7 29 11 L29 33 Q20 36 11 33 Z" fill={p.body} stroke="#0003" strokeWidth="0.5" />
      {/* pattern overlays clipped to the body */}
      <clipPath id={`body-${size}`}>
        <path d="M11 11 Q20 7 29 11 L29 33 Q20 36 11 33 Z" />
      </clipPath>
      <g clipPath={`url(#body-${size})`}>
        {p.pattern === "hoops" &&
          [13, 18, 23, 28, 33].map((y) => (
            <rect key={y} x="10" y={y} width="20" height="2.4" fill={p.patternColour} />
          ))}
        {p.pattern === "stripes" &&
          [12, 15, 18, 21, 24, 27].map((x) => (
            <rect key={x} x={x} y="8" width="1.8" height="28" fill={p.patternColour} />
          ))}
        {p.pattern === "v" && <path d="M11 11 L20 24 L29 11 L29 16 L20 29 L11 16 Z" fill={p.patternColour} />}
        {p.pattern === "sash" && <path d="M11 12 L29 30 L29 33 L11 15 Z" fill={p.patternColour} />}
        {p.pattern === "halves" && <path d="M20 8 L29 11 L29 33 L20 35 Z" fill={p.patternColour} />}
        {p.pattern === "star" && (
          <path
            d="M20 14 l1.8 3.7 4 .6 -2.9 2.8 .7 4 -3.6 -1.9 -3.6 1.9 .7 -4 -2.9 -2.8 4 -.6 Z"
            fill={p.patternColour}
          />
        )}
        {p.pattern === "spots" &&
          [
            [15, 16],
            [24, 16],
            [20, 22],
            [15, 28],
            [24, 28],
          ].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="1.8" fill={p.patternColour} />)}
      </g>
      {/* cap */}
      <circle cx="20" cy="7" r="4" fill={p.cap} stroke="#0003" strokeWidth="0.5" />
    </svg>
  );
}
