/**
 * Public Supabase connection values for the jockeyfinder-prod project.
 *
 * The URL and anon key are public by design, they ship inside every
 * browser bundle, so committing them as fallbacks is safe and means
 * the app runs with zero configuration. Environment variables still
 * take precedence. The service role key is environment only and must
 * never appear in this file.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://dlqtdflylyknjtpwzedn.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRscXRkZmx5bHlrbmp0cHd6ZWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMDYwNjEsImV4cCI6MjA5Njc4MjA2MX0.lc0HH-g3GEH_vjccNHqjOPLDIxcuXID07EcgH1e3vYU";
