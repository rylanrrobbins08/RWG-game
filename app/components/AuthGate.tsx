"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { storeAuthUserId } from "@/lib/supabase/auth";
import LoginScreen from "./LoginScreen";

/**
 * Login / Sign Up is the first screen when there is no session.
 * Missing or broken Supabase config shows the form with a clear message — never a crash.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoggedIn(false);
      return;
    }

    let mounted = true;

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const user = data.session?.user ?? null;
        storeAuthUserId(user?.id ?? null);
        setLoggedIn(Boolean(user));
      })
      .catch((error) => {
        console.error("Auth session check failed:", error);
        if (!mounted) return;
        storeAuthUserId(null);
        setLoggedIn(false);
      });

    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const listener = supabase.auth.onAuthStateChange((_event, session) => {
        storeAuthUserId(session?.user?.id ?? null);
        setLoggedIn(Boolean(session?.user));
      });
      subscription = listener.data.subscription;
    } catch (error) {
      console.error("Auth listener failed:", error);
      setLoggedIn(false);
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  if (!loggedIn) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
