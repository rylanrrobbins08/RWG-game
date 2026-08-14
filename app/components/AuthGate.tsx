"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { storeAuthUserId } from "@/lib/supabase/auth";
import LoginScreen from "./LoginScreen";

function isEntryPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/auth" ||
    pathname.startsWith("/create")
  );
}

/**
 * Keep signed-out users on login for game routes.
 * Home, auth, and create always render so `/` cannot get stuck behind the gate.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [loggedIn, setLoggedIn] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoggedIn(true);
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

  if (!loggedIn && !isEntryPath(pathname)) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
