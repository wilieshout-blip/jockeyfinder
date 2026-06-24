import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.jockeyfinder.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "", priority: 1, freq: "weekly" },
    { path: "/meetings", priority: 0.9, freq: "daily" },
    { path: "/jockeys", priority: 0.8, freq: "daily" },
    { path: "/trainers", priority: 0.8, freq: "daily" },
    { path: "/signup", priority: 0.7, freq: "monthly" },
    { path: "/login", priority: 0.4, freq: "monthly" },
    { path: "/for/jockeys", priority: 0.7, freq: "monthly" },
    { path: "/for/trainers", priority: 0.7, freq: "monthly" },
    { path: "/for/owners", priority: 0.7, freq: "monthly" },
    { path: "/for/agents", priority: 0.7, freq: "monthly" },
    { path: "/privacy", priority: 0.3, freq: "yearly" },
    { path: "/terms", priority: 0.3, freq: "yearly" },
  ];
  return routes.map((r) => ({
    url: base + r.path,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));
}
