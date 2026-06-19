"use server";

import { createClient } from "@/lib/supabase/server";

export interface AvatarUploadResult {
  url?: string;
  error?: string;
}

/**
 * Uploads a cropped avatar for the signed-in user, server-side. Running with
 * the user's server session means the storage request is reliably
 * authenticated and satisfies the avatars-bucket RLS policy
 * (folder = auth.uid()). The previous browser-side upload reached storage
 * without the auth token, which Supabase rejected with a 400.
 */
export async function uploadAvatar(
  formData: FormData
): Promise<AvatarUploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired — please sign in again." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No image was received." };
  }

  const path = `${user.id}/${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: "image/jpeg" });
  if (upErr) return { error: upErr.message };

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: profErr } = await supabase
    .from("profiles")
    .update({ profile_photo_url: data.publicUrl })
    .eq("id", user.id);
  if (profErr) return { error: profErr.message };

  return { url: data.publicUrl };
}
