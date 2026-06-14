/**
 * Public Supabase connection values for the jockeyfinder-prod project.
 *
 * The URL and anon key are public by design – they ship inside every
 * browser bundle, so hardcoding them here is safe. The service role
 * key is server-only and must only ever come from environment variables.
 */

// Hardcoded so a wrong/missing Vercel env var can't cause a 401.
export const SUPABASE_URL = "https://dlqtdflylyknjtpwzedn.supabase.co";

export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRscXRkZmx5bHlrbmp0cHd6ZWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMDYwNjEsImV4cCI6MjA5Njc4MjA2MX0.lc0HH-g3GEH_vjccNHqjOPLDIxcuXID07EcgH1e3vYU";

/** Canonical site origin, used for auth email redirect links. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.jockeyfinder.com";
