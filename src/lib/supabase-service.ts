import { createClient } from "@supabase/supabase-js";

// Service client — for public pages where no user auth context is needed.
// Uses the anon key with RLS (share_links is publicly readable by token).
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
