import { ImageResponse } from "next/og";

// Branded social-share card used for og:image and twitter:image across the site.
export const runtime = "edge";
export const alt = "JockeyFinder — Plan rides. Book jockeys.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "#0b3d2e",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", height: 6, width: 96, background: "#16a34a", marginBottom: 40 }} />
        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>
          <span style={{ color: "#ffffff" }}>JOCKEY</span>
          <span style={{ color: "#34d399" }}>FINDER</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 38, color: "#a7c3b6", maxWidth: 960, lineHeight: 1.3 }}>
          Plan rides. Book jockeys. New Zealand thoroughbred racing, in one place.
        </div>
        <div style={{ marginTop: 48, fontSize: 26, color: "#6f9384" }}>jockeyfinder.com</div>
      </div>
    ),
    { ...size }
  );
}
