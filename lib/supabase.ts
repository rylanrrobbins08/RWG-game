/**
 * RWG Supabase browser client (cookie-based for Next.js proxy/auth).
 *
 * Add these to `.env.local` (see `.env.local.example`):
 *   NEXT_PUBLIC_SUPABASE_URL=
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let browserClient: SupabaseClient | null = null;

function createBrowserSupabase(): SupabaseClient {
  return createBrowserClient(url!, anonKey!);
}

/** Shared browser client — `null` when env keys are missing. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? (browserClient ??= createBrowserSupabase())
  : null;

/** Throws if Supabase env keys are missing. */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Copy .env.local.example to .env.local and add your keys.",
    );
  }
  return supabase;
}
