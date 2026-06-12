import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/site-nav";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <SiteNav isAuthed={Boolean(user)} />;
}
