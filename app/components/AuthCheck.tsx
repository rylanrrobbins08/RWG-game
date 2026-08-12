"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useGameStore } from "@/lib/game-store";

type AuthStatus = "loading" | "missing-config" | "signed-out" | "signed-in";

/** Basic auth status for the dashboard. */
export default function AuthCheck() {
  const userId = useGameStore((state) => state.userId);
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured ? "loading" : "missing-config",
  );
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user);
      setStatus(data.user ? "signed-in" : "signed-out");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus(session?.user ? "signed-in" : "signed-out");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (status === "missing-config") {
    return (
      <div className="rounded-md border border-panel-border bg-panel/80 px-4 py-3 text-sm text-muted">
        Supabase is not configured. Add keys to{" "}
        <code className="text-foreground">.env.local</code> to enable auth and cloud saves.
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="rounded-md border border-panel-border bg-panel/80 px-4 py-3 text-sm text-muted">
        Checking auth…
      </div>
    );
  }

  if (status === "signed-out") {
    return (
      <div className="rounded-md border border-[#c45c4a]/40 bg-[#c45c4a]/10 px-4 py-3 text-sm text-[#e8a090]">
        Not signed in.{" "}
        <Link href="/auth" className="font-medium text-accent hover:text-accent-hover">
          Log in or sign up
        </Link>{" "}
        to protect your wrestler save.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-mat/60 bg-mat/25 px-4 py-3 text-sm text-[#8fd4b0]">
      Signed in as <span className="font-medium text-foreground">{user?.email}</span>
      {userId && (
        <span className="mt-1 block text-xs text-muted">
          user_id: <code className="text-foreground">{userId}</code>
        </span>
      )}
    </div>
  );
}
