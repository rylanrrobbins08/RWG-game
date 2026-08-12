import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useGameStore } from "@/lib/game-store";
import { setCareerStorageUserId } from "@/lib/career-slots";

export type AuthResult =
  | { ok: true; userId: string; email: string | null; session: boolean }
  | { ok: false; error: string };

const NOT_CONFIGURED =
  "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the app.";

/** Keep the signed-in auth user id in the game store and per-user local saves. */
export function storeAuthUserId(userId: string | null) {
  useGameStore.getState().setUserId(userId);
  setCareerStorageUserId(userId);
}

export function formatAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (text.includes("email not confirmed")) {
    return "Confirm your email, then log in.";
  }
  if (text.includes("user already registered") || text.includes("already been registered")) {
    return "An account with this email already exists. Log in instead.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (text.includes("network") || text.includes("failed to fetch")) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return message;
}

/** Current browser session user (null if logged out or Supabase unset). */
export async function getCurrentUser() {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("getCurrentUser:", error.message);
      return null;
    }

    if (user) storeAuthUserId(user.id);
    return user;
  } catch (error) {
    console.error("getCurrentUser:", error);
    return null;
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: NOT_CONFIGURED };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) return { ok: false, error: formatAuthError(error.message) };

    const user = data.session?.user ?? data.user;
    if (!user) {
      return { ok: false, error: "Could not create account." };
    }

    if (!data.session && (user.identities?.length ?? 0) === 0) {
      return {
        ok: false,
        error: "An account with this email already exists. Log in instead.",
      };
    }

    if (data.session) {
      storeAuthUserId(user.id);
    }

    return {
      ok: true,
      userId: user.id,
      email: user.email ?? null,
      session: Boolean(data.session),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? formatAuthError(error.message) : "Sign up failed.",
    };
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: NOT_CONFIGURED };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { ok: false, error: formatAuthError(error.message) };

    const user = data.user ?? data.session?.user;
    if (!user) return { ok: false, error: "Could not log in." };

    storeAuthUserId(user.id);
    return {
      ok: true,
      userId: user.id,
      email: user.email ?? null,
      session: true,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? formatAuthError(error.message) : "Login failed.",
    };
  }
}

export async function signOut(): Promise<AuthResult> {
  const supabase = getSupabase();
  storeAuthUserId(null);
  useGameStore.getState().clearCareerSelection();

  if (!supabase) {
    return { ok: true, userId: "", email: null, session: false };
  }

  try {
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, error: formatAuthError(error.message) };
    return { ok: true, userId: "", email: null, session: false };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? formatAuthError(error.message) : "Logout failed.",
    };
  }
}
