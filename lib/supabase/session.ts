import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "./env";

/** Signed-in user for Server Components, or null if logged out / unconfigured. */
export async function getOptionalUser() {
  if (!getSupabaseEnv()) return null;
  try {
    const supabase = await createClient();
    if (!supabase) return null;

    const { data: userData, error } = await supabase.auth.getUser();
    if (userData.user) return userData.user;
    if (error) {
      console.error("getOptionalUser:", error.message);
    }

    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.user ?? null;
  } catch (error) {
    console.error("getOptionalUser:", error);
    return null;
  }
}
