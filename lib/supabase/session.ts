import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** Signed-in user for Server Components, or null if logged out / unconfigured. */
export async function getOptionalUser() {
  if (!getSupabaseEnv()) return null;
  try {
    const supabase = await createClient();
    if (!supabase) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error("getOptionalUser:", error);
    return null;
  }
}
