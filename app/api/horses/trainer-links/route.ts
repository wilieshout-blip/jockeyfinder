import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/horses/trainer-links — add a horse to trainer's stable (confirmed)
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { horse_id } = await request.json();
  if (!horse_id) return NextResponse.json({ error: "horse_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("trainer_horse_links")
    .upsert({ trainer_id: user.id, horse_id, status: "confirmed" }, { onConflict: "trainer_id,horse_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// GET /api/horses/trainer-links — list confirmed horses for current trainer
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("trainer_horse_links")
    .select("id, status, horses(id, name, sire, dam, nztr_trainer_name)")
    .eq("trainer_id", user.id)
    .in("status", ["confirmed", "pending"])
    .order("created_at", { ascending: false });

  return NextResponse.json(data ?? []);
}
