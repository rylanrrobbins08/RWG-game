"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { storeAuthUserId } from "@/lib/supabase/auth";
import { listWrestlersFromCloud } from "@/lib/wrestler-actions";
import type { CloudWrestler } from "@/lib/supabase/wrestler-row";
import WrestlerSelect from "./WrestlerSelect";

/** Home fallback when the server session cookie is not visible yet. */
export default function HomeEntry() {
  const router = useRouter();
  const [roster, setRoster] = useState<{
    wrestlers: CloudWrestler[];
    loadError: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = getSupabase();
      if (!supabase) {
        router.replace("/auth");
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      const session = data.session;
      if (error || !session?.user) {
        router.replace("/auth");
        return;
      }

      storeAuthUserId(session.user.id);
      const result = await listWrestlersFromCloud();
      if (cancelled) return;
      setRoster({
        wrestlers: result.data,
        loadError: result.ok ? null : result.error,
      });
    }

    void load().catch((caught) => {
      console.error("Home entry:", caught);
      if (!cancelled) router.replace("/auth");
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!roster) {
    return (
      <p className="flex min-h-full flex-1 items-center justify-center px-5 text-sm text-muted">
        Loading wrestlers…
      </p>
    );
  }

  return (
    <WrestlerSelect
      initialWrestlers={roster.wrestlers}
      loadError={roster.loadError}
    />
  );
}
