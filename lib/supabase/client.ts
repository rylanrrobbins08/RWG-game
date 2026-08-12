import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";
import type { Database } from "./database.types";

/** Browser client, or `null` if Supabase is not configured. */
export function createClient() {
  const env = getSupabaseEnv();
  if (!env) return null;

  try {
    return createBrowserClient<Database>(env.url, env.anonKey);
  } catch (error) {
    console.error("Supabase browser client failed:", error);
    return null;
  }
}
