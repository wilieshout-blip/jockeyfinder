import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailNewSignup } from "@/lib/email";

export const dynamic = "force-dynamic";

// Called by a Postgres AFTER INSERT trigger on public.profiles (via pg_net).
// Authenticated with a shared secret stored in public.app_config, so no extra
// Vercel env var is needed -- both sides read it from the database.
export async function POST(req: Request) {
  const supabase = createAdminClient();

  const { data: cfg } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "signup_hook_secret")
    .maybeSingle();

  const expected = cfg?.value;
  const provided = req.headers.get("x-hook-secret");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let id: string | null = null;
  try {
    const body = await req.json();
    id = body?.id ?? null;
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, email, phone, is_test, is_placeholder")
    .eq("id", id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ ok: true, skipped: "no profile" });
  // Don't notify for seeded test/placeholder accounts.
  if (profile.is_test || profile.is_placeholder) {
    return NextResponse.json({ ok: true, skipped: "test/placeholder" });
  }

  await emailNewSignup({
    name: profile.full_name,
    role: profile.role,
    email: profile.email,
    phone: profile.phone,
  });

  return NextResponse.json({ ok: true });
}
