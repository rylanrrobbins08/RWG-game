"use client";

import {
  ATTRIBUTES,
  ATTRIBUTE_INFO,
  type AttributeScores,
} from "@/lib/game-store";
import type { WrestlerScoutProfile } from "@/lib/league";
import WrestlerAvatar from "./WrestlerAvatar";

type WrestlerScoutModalProps = {
  profile: WrestlerScoutProfile;
  onClose: () => void;
};

function overall(attrs: AttributeScores | WrestlerScoutProfile["attributes"]) {
  const values = Object.values(attrs);
  return Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 10) / 10;
}

/** Overlay scout card — attributes for league rivals and bracket opponents. */
export default function WrestlerScoutModal({
  profile,
  onClose,
}: WrestlerScoutModalProps) {
  const ovr = overall(profile.attributes);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scout-title"
      onClick={onClose}
    >
      <div
        className="rwg-card max-h-[90vh] w-full max-w-md overflow-y-auto !p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <WrestlerAvatar name={profile.name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="rwg-label">Scout Report</p>
            <h2
              id="scout-title"
              className="font-display text-2xl font-semibold uppercase tracking-wide text-foreground"
            >
              {profile.name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {profile.school} · {profile.wins}-{profile.losses} · OVR {ovr}
              {profile.isPlayer ? " · You" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rwg-btn rwg-btn-ghost !px-3 !py-2 text-xs"
            aria-label="Close scout report"
          >
            Close
          </button>
        </div>

        <ul className="mt-5 flex flex-col gap-2">
          {ATTRIBUTES.map((attr) => {
            const value = profile.attributes[attr] ?? 0;
            const pct = Math.max(0, Math.min(100, (value / 18) * 100));
            return (
              <li
                key={attr}
                className="rounded-md border border-panel-border bg-background/40 px-3 py-2.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-sm font-semibold text-foreground">
                    {attr}
                  </span>
                  <span className="font-display text-lg font-semibold tabular-nums text-accent">
                    {value}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted">{ATTRIBUTE_INFO[attr]}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
