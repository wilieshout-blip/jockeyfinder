import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

const PUBLIC_REVALIDATE_SECONDS = 60;

export function createPublicClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init?: any) =>
        fetch(input, {
          ...init,
          next: { revalidate: PUBLIC_REVALIDATE_SECONDS },
        }),
    },
  });
}
