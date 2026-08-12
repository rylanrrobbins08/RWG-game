"use client";

import Link from "next/link";
import { nextLetterGrade, useGameStore } from "@/lib/game-store";
import ArenaPage from "./ArenaPage";
import SchoolStudy from "./SchoolStudy";
import WrestlerAvatar from "./WrestlerAvatar";

export default function SchoolPage() {
  const wrestler = useGameStore((state) => state.wrestler);
  const next = nextLetterGrade(wrestler.grade);

  return (
    <ArenaPage>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <WrestlerAvatar
            name={wrestler.name}
            weightClass={wrestler.weightClass}
            size="md"
          />
          <div>
            <p className="rwg-label">Academics</p>
            <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
              School
            </h1>
            <p className="mt-1 text-sm text-muted">
              Study to raise your letter grade for recruiting.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rwg-card-accent px-4 py-4 text-center sm:text-left">
          <p className="rwg-label">Current Grade</p>
          <p className="mt-1 font-display text-5xl font-semibold text-accent">
            {wrestler.grade}
          </p>
          <p className="mt-1 text-xs text-muted">
            {next ? `Next upgrade: ${next}` : "Top of the transcript"}
          </p>
        </div>
        <div className="rwg-card-inset px-4 py-4">
          <p className="rwg-label">Study Progress</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-foreground">
            {next ? `${wrestler.studyProgress}` : "—"}
            {next && <span className="text-lg text-muted">/100</span>}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{
                width: next ? `${wrestler.studyProgress}%` : "100%",
              }}
            />
          </div>
        </div>
        <div className="rwg-card-inset px-4 py-4">
          <p className="rwg-label">Ready To</p>
          <p className="mt-1 font-display text-xl font-semibold text-foreground">
            {next
              ? wrestler.studyProgress >= 100
                ? `Unlock ${next}`
                : `Work toward ${next}`
              : "Hold Grade A"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Energy {wrestler.energy}% · Budget ${wrestler.budget}
          </p>
        </div>
      </section>

      <SchoolStudy />

      <div className="flex flex-wrap gap-3">
        <Link href="/training" className="rwg-btn rwg-btn-ghost">
          Training Room
        </Link>
        <Link href="/dashboard" className="rwg-btn rwg-btn-ghost">
          Dashboard
        </Link>
      </div>
    </ArenaPage>
  );
}
