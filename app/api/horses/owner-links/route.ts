import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { horse_id } = await request.json();
  if (!horse_id) return NextResponse.json({ error: "horse_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("owner_horse_links")
    .upsert({ owner_id: user.id, horse_id, status: "confirmed" }, { onConflict: "owner_id,horse_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("owner_horse_links")
    .select("id, status, horses(id, name, sire, dam, nztr_trainer_name)")
    .eq("owner_id", user.id)
    .in("status", ["confirmed", "pending"])
    .order("created_at", { ascending: false });

  return NextResponse.json(data ?? []);
}
