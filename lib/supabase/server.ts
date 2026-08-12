import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";
import type { Database } from "./database.types";

/** Server Component / Route Handler client, or `null` if unconfigured. */
export async function createClient() {
  const env = getSupabaseEnv();
  if (!env) return null;

  try {
    const cookieStore = await cookies();

    return createServerClient<Database>(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — middleware/proxy will refresh sessions.
          }
        },
      },
    });
  } catch (error) {
    console.error("Supabase server client failed:", error);
    return null;
  }
}
