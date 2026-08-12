import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string };

/** Current browser session user (null if logged out or Supabase unset). */
export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null;

  const supabase = getSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("getCurrentUser:", error.message);
    return null;
  }

  return user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { error } = await getSupabase().auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { error } = await getSupabase().auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut(): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { error } = await getSupabase().auth.signOut();
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
