"use client";

import { useState } from "react";
import Link from "next/link";
import { loadWrestler } from "@/lib/wrestlers";
import { saveWrestler } from "@/lib/saveWrestler";
import { getGameSnapshot, useGameStore } from "@/lib/game-store";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function CloudSync() {
  const hydrateFromSave = useGameStore((state) => state.hydrateFromSave);
  const setUserId = useGameStore((state) => state.setUserId);
  const userId = useGameStore((state) => state.userId);
  const [status, setStatus] = useState(
    isSupabaseConfigured
      ? "Manual save/load for your cloud wrestler."
      : "Add Supabase keys to .env.local to enable cloud saves.",
  );
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    const snapshot = getGameSnapshot();
    const result = await saveWrestler(snapshot);
    setBusy(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setUserId(result.userId);
    setStatus(
      `Saved ${snapshot.wrestler.name} for user ${result.userId.slice(0, 8)}… (week ${snapshot.week}).`,
    );
  }

  async function handleLoad() {
    setBusy(true);
    const result = await loadWrestler();
    setBusy(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    if (!result.data) {
      setStatus("No saved wrestler found for this account.");
      return;
    }
    hydrateFromSave({
      wrestler: result.data.wrestler,
      week: result.data.week,
      season: result.data.season,
      userId: result.data.userId,
    });
    setStatus(`Loaded ${result.data.wrestler.name} (week ${result.data.week}).`);
  }

  return (
    <section className="rounded-md border border-panel-border bg-panel/80 p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.14em] text-muted">
            Cloud Save
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
            Supabase Sync
          </h2>
        </div>
        <p className="text-sm text-muted">
          {userId ? `user_id ${userId.slice(0, 8)}…` : "No user linked"}
        </p>
      </div>

      <p className="mb-4 text-sm text-muted" role="status">
        {status}
      </p>

      {!userId ? (
        <p className="text-sm text-muted">
          <Link href="/auth" className="text-accent hover:text-accent-hover">
            Log in
          </Link>{" "}
          to save wrestler data with your user id.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !isSupabaseConfigured}
            onClick={handleSave}
            className="rounded-md bg-accent px-4 py-2 font-display text-sm font-semibold uppercase tracking-[0.08em] text-background transition hover:bg-accent-hover disabled:opacity-40"
          >
            Save Wrestler
          </button>
          <button
            type="button"
            disabled={busy || !isSupabaseConfigured}
            onClick={handleLoad}
            className="rounded-md border border-mat bg-mat/50 px-4 py-2 font-display text-sm font-semibold uppercase tracking-[0.08em] text-foreground transition hover:bg-mat disabled:opacity-40"
          >
            Load Wrestler
          </button>
        </div>
      )}
    </section>
  );
}
