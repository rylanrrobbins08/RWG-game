"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ATTRIBUTES,
  ATTRIBUTE_INFO,
  getGameSnapshot,
  useGameStore,
} from "@/lib/game-store";
import { formatInjuryStatus } from "@/lib/injury";
import { saveWrestler } from "@/lib/saveWrestler";
import { signOut } from "@/lib/supabase/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import ArenaPage from "./ArenaPage";
import AttributeLabel from "./AttributeLabel";
import WrestlerAvatar from "./WrestlerAvatar";

export default function SettingsProfile() {
  const router = useRouter();
  const wrestler = useGameStore((state) => state.wrestler);
  const week = useGameStore((state) => state.week);
  const season = useGameStore((state) => state.season);
  const careerMode = useGameStore((state) => state.careerMode);
  const userId = useGameStore((state) => state.userId);
  const setUserId = useGameStore((state) => state.setUserId);

  const [status, setStatus] = useState(
    "Manage your profile, export a backup, or sign out.",
  );
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const overall = useMemo(() => {
    const values = Object.values(wrestler.attributes);
    return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
  }, [wrestler.attributes]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  function exportData() {
    const snapshot = {
      ...getGameSnapshot(),
      exportedAt: new Date().toISOString(),
      version: 1,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `rwg-save-${wrestler.name.replace(/\s+/g, "-").toLowerCase()}-${stamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Exported career JSON to your downloads.");
  }

  async function saveData() {
    if (!isSupabaseConfigured) {
      setStatus("Supabase is not configured — use Export for a local backup.");
      return;
    }
    if (!userId) {
      setStatus("Sign in to save your career to the cloud.");
      return;
    }

    setSaving(true);
    setStatus("Saving to cloud…");
    const result = await saveWrestler(getGameSnapshot());
    setSaving(false);

    if (result.ok) {
      setUserId(result.userId);
      setStatus("Career saved to Supabase.");
      return;
    }

    setStatus(result.error);
  }

  async function handleLogout() {
    setLoggingOut(true);
    setStatus("Signing out…");
    const result = await signOut();
    setUserId(null);
    setEmail(null);
    setLoggingOut(false);

    if (!result.ok && isSupabaseConfigured) {
      setStatus(result.error);
      return;
    }

    setStatus("Signed out.");
    router.replace(isSupabaseConfigured ? "/auth" : "/");
    router.refresh();
  }

  return (
    <ArenaPage>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <WrestlerAvatar
            name={wrestler.name}
            weightClass={wrestler.weightClass}
            size="lg"
          />
          <div>
            <p className="rwg-label">Settings</p>
            <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
              Profile
            </h1>
            <p className="mt-1 text-sm text-muted">
              {email ?? (userId ? "Signed in" : "Local career")}
              {careerMode === "coach" ? " · Coach mode" : ""}
            </p>
          </div>
        </div>
        <p className="rwg-card-inset max-w-md text-sm text-muted" role="status">
          {status}
        </p>
      </header>

      <section className="rwg-card">
        <p className="rwg-label">Wrestler Overview</p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
          {wrestler.name}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {wrestler.weightClass} lbs · Season {season} · Week {week} · OVR{" "}
          <span className="font-semibold text-accent">{overall}</span>
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rwg-card-inset">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Record</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-accent">
              {wrestler.record.wins}-{wrestler.record.losses}
            </p>
          </div>
          <div className="rwg-card-inset">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Energy</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-accent">
              {wrestler.energy}%
            </p>
          </div>
          <div className="rwg-card-inset">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Fatigue</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-danger-soft">
              {wrestler.fatigue}%
            </p>
          </div>
          <div className="rwg-card-inset">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Budget</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
              ${wrestler.budget.toLocaleString()}
            </p>
          </div>
        </div>

        <div
          className={`mt-4 rounded-md border px-4 py-3 ${
            wrestler.injury
              ? "border-danger/50 bg-danger/15"
              : "border-mat/50 bg-mat/30"
          }`}
        >
          <p className="rwg-label">Injury</p>
          <p
            className={`mt-1 font-display text-base font-semibold ${
              wrestler.injury ? "text-danger-soft" : "text-mat-bright"
            }`}
          >
            {formatInjuryStatus(wrestler.injury)}
          </p>
        </div>

        <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-panel-border/70 pt-4 sm:grid-cols-4">
          {ATTRIBUTES.map((attr) => (
            <li
              key={attr}
              className="flex items-center justify-between gap-2 text-sm"
              title={ATTRIBUTE_INFO[attr]}
            >
              <AttributeLabel attr={attr} className="text-sm text-muted" />
              <span className="font-display font-semibold tabular-nums text-foreground">
                {wrestler.attributes[attr]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rwg-card">
        <p className="rwg-label">Data</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
          Export & Save
        </h2>
        <p className="mt-2 text-sm text-muted">
          Download a JSON backup of your career, or push the current save to the cloud.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={exportData} className="rwg-btn rwg-btn-ghost flex-1">
            Export Data
          </button>
          <button
            type="button"
            onClick={() => void saveData()}
            disabled={saving}
            className="rwg-btn rwg-btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save to Cloud"}
          </button>
        </div>
      </section>

      <section className="rwg-card">
        <p className="rwg-label">Account</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
          Session
        </h2>
        <p className="mt-2 text-sm text-muted">
          {isSupabaseConfigured
            ? userId
              ? `Signed in${email ? ` as ${email}` : ""}.`
              : "Not signed in — log in to sync saves across devices."
            : "Auth is unavailable until Supabase is configured."}
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {!userId && isSupabaseConfigured && (
            <Link href="/auth" className="rwg-btn rwg-btn-primary flex-1 text-center">
              Log In
            </Link>
          )}
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut || !userId}
            className="rwg-btn flex-1 border border-danger/50 bg-danger/15 text-danger-soft transition hover:border-danger hover:bg-danger/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loggingOut ? "Signing out…" : "Logout"}
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard" className="rwg-btn rwg-btn-ghost">
          Back to Dashboard
        </Link>
      </div>
    </ArenaPage>
  );
}
