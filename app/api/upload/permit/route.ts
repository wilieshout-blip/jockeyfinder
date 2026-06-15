// app/api/upload/permit/route.ts
// Accepts a trial rider permit document upload immediately after signUp().
// The user ID is known (returned by auth.signUp) but the user is not yet
// authenticated (email confirmation pending), so we use the service role.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const userId = formData.get("user_id") as string | null;
  const file = formData.get("file") as File | null;

  if (!userId || !file) {
    return NextResponse.json({ error: "Missing user_id or file" }, { status: 400 });
  }

  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const path = userId + "/trial-permit." + ext;

  const admin = createAdminClient();
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from("identity-docs")
    .upload(path, Buffer.from(bytes), {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[permit-upload] storage error:", uploadError.message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  // Store the path on the profile row so admin can retrieve a signed URL later.
  const { error: dbError } = await admin
    .from("profiles")
    .update({ id_document_path: path })
    .eq("id", userId);

  if (dbError) {
    console.error("[permit-upload] db error:", dbError.message);
    // Non-fatal: storage upload succeeded; admin can still find the file.
  }

  return NextResponse.json({ ok: true });
}
