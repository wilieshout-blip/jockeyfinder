"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

/**
 * Server Action for email+password sign-in.
 *
 * WHY SERVER-SIDE: createBrowserClient stores the session via document.cookie
 * which is set in JS microtasks. In some environments (browser cookie limits,
 * Turbopack bundling quirks, SameSite/Secure attribute mismatch) those cookies
 * don't arrive at the middleware, causing an immediate 307 back to /login.
 *
 * Running signInWithPassword in a Server Action means Next.js sets the session
 * cookies on the HTTP *response* via next/headers cookieStore.set(), so they
 * are guaranteed to be present on the very next request — no race conditions.
 */
export async function signIn(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = ((formData.get("email") as string) ?? "").trim();
  const password = (formData.get("password") as string) ?? "";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as any ?? {});
        });
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
