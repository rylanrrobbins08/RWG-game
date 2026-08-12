/**
 * RWG Supabase browser client (cookie-based for Next.js proxy/auth).
 *
 * Add these to `.env.local` (see `.env.local.example`):
 *   NEXT_PUBLIC_SUPABASE_URL=
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";

function tryCreateBrowserClient(): SupabaseClient<Database> | null {
  const env = getSupabaseEnv();
  if (!env) return null;

  try {
    return createBrowserClient<Database>(env.url, env.anonKey);
  } catch (error) {
    console.error("Supabase browser client failed:", error);
    return null;
  }
}

/** Shared browser client — `null` when env keys are missing or invalid. */
export const supabase: SupabaseClient<Database> | null = tryCreateBrowserClient();

export const isSupabaseConfigured = supabase !== null;

/** Browser client, or `null` if Supabase is not configured. */
export function getSupabase(): SupabaseClient<Database> | null {
  return supabase;
}
