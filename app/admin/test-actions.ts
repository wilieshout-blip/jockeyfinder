"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/utils";

const TEST_EMAILS = [
    "test-jockey@jockeyfinder.com",
    "test-trainer@jockeyfinder.com",
    "test-owner@jockeyfinder.com",
    "test-agent@jockeyfinder.com",
  ];

const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.jockeyfinder.com";

/**
 * Generates a one-time magic link for a test account and redirects to it,
 * instantly signing the admin in as that test user.
 * Only callable by the admin.
 */
export async function switchToTestUser(formData: FormData) {
    const supabase = await createClient();
    const {
          data: { user },
    } = await supabase.auth.getUser();
    if (!user || !isAdminEmail(user.email)) redirect("/dashboard");

  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
    if (!email || !TEST_EMAILS.includes(email)) redirect("/admin");

  const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: {
                  redirectTo: `${SITE_URL}/auth/callback`,
          },
    });

  if (error || !data?.properties?.action_link) {
        console.error("generateLink error:", error);
        redirect("/admin");
  }

  redirect(data.properties.action_link);
}
