"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ATTRIBUTES, ATTRIBUTE_INFO, useGameStore } from "@/lib/game-store";
import { persistGameNow } from "@/lib/game-sync";
import {
  WEIGHT_CUTS,
  formatAttrPenalty,
  type WeightCutLevel,
} from "@/lib/weight-cut";
import { formatHometown } from "@/lib/wrestler-profile";
import ArenaPage from "./ArenaPage";
import WrestlerAvatar from "./WrestlerAvatar";
import AttributeLabel from "./AttributeLabel";
import SchoolStudy from "./SchoolStudy";

const CUT_BUTTONS: { level: WeightCutLevel; label: string }[] = [
  { level: "mild", label: "Mild Cut" },
  { level: "moderate", label: "Moderate Cut" },
  { level: "aggressive", label: "Aggressive Cut" },
];

export default function WrestlerPage() {
  const wrestler = useGameStore((state) => state.wrestler);
  const setWeightCut = useGameStore((state) => state.setWeightCut);

  const cut = WEIGHT_CUTS[wrestler.weightCut];
  const location = formatHometown(wrestler.hometown, wrestler.state);

  const penalties = useMemo(() => {
    if (wrestler.weightCut === "none") return [];
    const rows: string[] = [];
    if (cut.energy !== 0) rows.push(`Energy ${cut.energy}`);
    if (cut.fatigue !== 0) rows.push(`Fatigue +${cut.fatigue}`);
    for (const attr of ATTRIBUTES) {
      const delta = cut.attributes[attr];
      if (delta) rows.push(formatAttrPenalty(attr, delta));
    }
    return rows;
  }, [cut, wrestler.weightCut]);

  function applyCut(level: WeightCutLevel) {
    const next = wrestler.weightCut === level ? "none" : level;
    setWeightCut(next);
    persistGameNow();
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
            <p className="rwg-label">Athlete</p>
            <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
              {wrestler.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {location} · {wrestler.weightClass} lbs · Record{" "}
              {wrestler.record.wins}-{wrestler.record.losses}
            </p>
            <p className="mt-1 text-sm text-muted">
              Energy {wrestler.energy}% · Fatigue {wrestler.fatigue}%
            </p>
          </div>
        </div>
        <Link href="/" className="rwg-btn rwg-btn-ghost !text-xs">
          Switch Wrestler
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rwg-card-inset text-center">
          <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Grade</p>
          <p className="mt-1 font-display text-3xl font-semibold text-accent">
            {wrestler.grade}
          </p>
        </div>
        <div className="rwg-card-inset text-center">
          <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Hometown</p>
          <p className="mt-1 font-display text-base font-semibold leading-snug text-foreground">
            {location}
          </p>
        </div>
        <div className="rwg-card-inset text-center">
          <p className="text-[10px] uppercase tracking-[0.1em] text-muted">
            National Rank
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
            #{wrestler.nationalRank}
          </p>
        </div>
        <div className="rwg-card-inset text-center">
          <p className="text-[10px] uppercase tracking-[0.1em] text-muted">State Rank</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
            #{wrestler.stateRank}
          </p>
        </div>
      </section>

      <SchoolStudy />

      <section className="rwg-card">
        <p className="rwg-label">Stats</p>
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {ATTRIBUTES.map((attr) => (
            <li
              key={attr}
              className="flex items-center justify-between gap-2 text-sm"
              title={ATTRIBUTE_INFO[attr]}
            >
              <AttributeLabel attr={attr} className="text-sm text-muted" />
              <span className="font-display text-lg font-semibold tabular-nums text-foreground">
                {wrestler.attributes[attr]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rwg-card !p-4 sm:!p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="rwg-label">Weight Cut</p>
            <p className="mt-1 font-display text-2xl font-semibold text-foreground">
              {wrestler.weightClass}
              <span className="ml-1 text-base font-medium text-muted">lbs class</span>
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Natural {wrestler.naturalWeight} lbs · Active: {cut.label}
              {cut.lbsCut > 0 ? ` (~${cut.lbsCut} lbs)` : ""}
            </p>
          </div>
          {wrestler.weightCut !== "none" && (
            <button
              type="button"
              onClick={() => applyCut("none")}
              className="rwg-btn rwg-btn-ghost !px-3 !py-2 !text-xs"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CUT_BUTTONS.map(({ level, label }) => {
            const selected = wrestler.weightCut === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => applyCut(level)}
                className={`rounded-md border px-3 py-2.5 font-display text-sm font-semibold uppercase tracking-[0.06em] transition ${
                  selected
                    ? "border-accent bg-accent text-background"
                    : "border-panel-border bg-background/40 text-foreground hover:border-accent/60"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 border-t border-panel-border/70 pt-3">
          <p className="rwg-label">Penalties</p>
          {penalties.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted">None — no cut applied.</p>
          ) : (
            <p className="mt-1.5 text-sm text-foreground">
              {penalties.join(" · ")}
            </p>
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/calendar" className="rwg-btn rwg-btn-primary">
          Calendar / Match Week
        </Link>
        <Link href="/dashboard" className="rwg-btn rwg-btn-ghost">
          Dashboard
        </Link>
      </div>
    </ArenaPage>
  );
}
