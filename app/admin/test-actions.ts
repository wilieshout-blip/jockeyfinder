"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/utils";
import { SITE_URL } from "@/lib/supabase/config";

const TEST_PASSWORD = "TestPass123!";

const TEST_ACCOUNTS: Record<
  string,
  { role: "jockey" | "trainer" | "owner" | "agent"; firstName: string; lastName: string; phone: string }
> = {
  "test-jockey@jockeyfinder.com": {
    role: "jockey",
    firstName: "Test",
    lastName: "Jockey",
    phone: "0210000101",
  },
  "test-trainer@jockeyfinder.com": {
    role: "trainer",
    firstName: "Test",
    lastName: "Trainer",
    phone: "0210000102",
  },
  "test-owner@jockeyfinder.com": {
    role: "owner",
    firstName: "Test",
    lastName: "Owner",
    phone: "0210000103",
  },
  "test-agent@jockeyfinder.com": {
    role: "agent",
    firstName: "Test",
    lastName: "Agent",
    phone: "0210000104",
  },
};

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return null;
  return data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
}

async function ensureTestAccount(
  admin: ReturnType<typeof createAdminClient>,
  email: string
) {
  const account = TEST_ACCOUNTS[email];
  if (!account) return null;

  let userId = await findAuthUserIdByEmail(admin, email);

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: account.role,
        first_name: account.firstName,
        last_name: account.lastName,
        phone: account.phone,
      },
    });
    if (error || !data.user) {
      console.error("create test user error:", error);
      return null;
    }
    userId = data.user.id;
  } else {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: account.role,
        first_name: account.firstName,
        last_name: account.lastName,
        phone: account.phone,
      },
    });
    if (error) console.error("update test user error:", error);
  }

  await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      first_name: account.firstName,
      last_name: account.lastName,
      full_name: account.firstName + " " + account.lastName,
      role: account.role,
      phone: account.phone,
      is_test: true,
      verified: true,
      verification_status: "approved",
      status: "approved",
      registry_match: true,
      bio:
        account.role === "owner"
          ? "Demo owner account for testing horse tracking and race-day features."
          : "Demo " + account.role + " account for testing.",
    },
    { onConflict: "id" }
  );

  return userId;
}

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
    if (!email || !TEST_ACCOUNTS[email]) redirect("/admin?test_error=unknown");

  const admin = createAdminClient();
  const testUserId = await ensureTestAccount(admin, email);
  if (!testUserId) redirect("/admin?test_error=setup_failed");

    const { data, error } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: {
                  redirectTo: `${SITE_URL}/auth/callback?next=/dashboard`,
          },
    });

  if (error || !data?.properties?.action_link) {
        console.error("generateLink error:", error);
        redirect("/admin?test_error=link_failed");
  }

  redirect(data.properties.action_link);
}
