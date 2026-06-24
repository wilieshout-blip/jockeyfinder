import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.jockeyfinder.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep private/auth/api surfaces out of search indexes.
        disallow: ["/dashboard", "/admin", "/api", "/reset-password", "/forgot-password"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
