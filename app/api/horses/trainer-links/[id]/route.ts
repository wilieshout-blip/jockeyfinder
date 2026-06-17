import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };

// PATCH — confirm or dismiss a trainer horse link
export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await request.json();
  if (!["confirmed", "dismissed"].includes(status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const { error } = await supabase
    .from("trainer_horse_links")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("trainer_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — remove a horse from trainer's stable
export async function DELETE(_: Request, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("trainer_horse_links")
    .delete()
    .eq("id", params.id)
    .eq("trainer_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
