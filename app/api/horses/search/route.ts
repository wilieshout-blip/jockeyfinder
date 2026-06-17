import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const { data } = await supabase
    .from("horses")
    .select("id, name, sire, dam, nztr_trainer_name")
    .ilike("name", `%${q}%`)
    .limit(20);

  return NextResponse.json(data ?? []);
}
