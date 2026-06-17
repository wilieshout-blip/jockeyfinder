import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  hasAllowedUploadSignature,
  isSameOriginRequest,
} from "@/lib/security";

export const runtime = "nodejs";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File must be under 10 MB" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasAllowedUploadSignature(file.type, bytes)) {
    return NextResponse.json(
      { error: "The file contents do not match the selected type" },
      { status: 400 }
    );
  }

  const extension =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/jpeg"
      ? "jpg"
      : file.type.split("/")[1];
  const path = `${user.id}/trial-permit.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("identity-docs")
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[permit-upload] storage error:", uploadError.message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      id_document_path: path,
      id_document_uploaded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    console.error("[permit-upload] profile error:", profileError.message);
    return NextResponse.json({ error: "Upload could not be recorded" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
