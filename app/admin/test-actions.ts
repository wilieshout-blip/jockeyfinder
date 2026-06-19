"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils";

const TEST_PASSWORD = "TestPass123!";

const TEST_EMAILS = new Set([
  "test-jockey@jockeyfinder.com",
  "test-trainer@jockeyfinder.com",
  "test-owner@jockeyfinder.com",
  "test-agent@jockeyfinder.com",
]);

/**
 * Signs the admin straight in as the chosen test account using its known
 * password. This deliberately avoids the GoTrue admin API + magic-link flow
 * (which needs the service-role key and an allow-listed redirect URL) — it
 * just calls signInWithPassword on the SSR client, which sets the session
 * cookies and swaps the admin session for the test user's. Only the admin
 * can trigger it. The four test accounts are seeded with this password.
 */
export async function switchToTestUser(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/dashboard");

  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  if (!email || !TEST_EMAILS.has(email)) redirect("/admin?test_error=unknown");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });

  if (error) {
    console.error("test sign-in error:", error.message);
    redirect("/admin?test_error=setup_failed");
  }

  redirect("/dashboard");
}
