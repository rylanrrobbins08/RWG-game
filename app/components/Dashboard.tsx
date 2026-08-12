"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ATTRIBUTES, ATTRIBUTE_INFO, useGameStore } from "@/lib/game-store";
import { formatInjuryStatus } from "@/lib/injury";
import { persistGameNow } from "@/lib/game-sync";
import {
  EVENT_STYLES,
  eventsForWeek,
  getCurrentWrestleEvent,
} from "@/lib/season-schedule";
import ArenaPage from "./ArenaPage";
import AttributeLabel from "./AttributeLabel";
import WrestlerAvatar from "./WrestlerAvatar";

/** Post-college unlock for coach career (HS ~1–4, college ~5–8). */
const COLLEGE_COMPLETE_SEASON = 8;

export default function Dashboard() {
  const router = useRouter();
  const wrestler = useGameStore((state) => state.wrestler);
  const week = useGameStore((state) => state.week);
  const season = useGameStore((state) => state.season);
  const careerMode = useGameStore((state) => state.careerMode);
  const retireToCoach = useGameStore((state) => state.retireToCoach);

  const collegeComplete = season > COLLEGE_COMPLETE_SEASON;
  const showCoachPath = collegeComplete || careerMode === "coach";

  const wrestleEvent = useMemo(() => getCurrentWrestleEvent(week), [week]);
  const completedEventIds = useGameStore((state) => state.completedEventIds);
  const wrestleAvailable =
    wrestleEvent !== null && !completedEventIds.includes(wrestleEvent.id);
  const weekEvents = useMemo(() => eventsForWeek(week), [week]);
  const currentEvent = wrestleEvent ?? weekEvents[0] ?? null;

  const overall = useMemo(() => {
    const values = Object.values(wrestler.attributes);
    return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
  }, [wrestler.attributes]);

  function handleRetire() {
    retireToCoach();
    persistGameNow();
    router.push("/coach");
  }

  return (
    <ArenaPage>
      <header>
        <p className="rwg-label">Career Dashboard</p>
        <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
          Home Base
        </h1>
      </header>

      {/* Wrestler summary */}
      <section className="rwg-card">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <WrestlerAvatar
              name={wrestler.name}
              weightClass={wrestler.weightClass}
              size="lg"
            />
            <div className="min-w-0">
              <p className="rwg-label">Wrestler Summary</p>
              <h2 className="mt-1 truncate font-display text-2xl font-semibold text-foreground sm:text-3xl">
                {wrestler.name}
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                {wrestler.weightClass} lbs · Season {season} · OVR{" "}
                <span className="font-semibold text-accent">{overall}</span>
              </p>
              <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-accent">
                {wrestler.record.wins}-{wrestler.record.losses}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[14rem]">
            <div className="rwg-card-inset text-center">
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Energy</p>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums text-accent">
                {wrestler.energy}%
              </p>
            </div>
            <div className="rwg-card-inset text-center">
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Fatigue</p>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums text-danger-soft">
                {wrestler.fatigue}%
              </p>
            </div>
            <div className="rwg-card-inset text-center">
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Status</p>
              <p
                className={`mt-1 font-display text-sm font-semibold ${
                  wrestler.injury ? "text-danger-soft" : "text-mat-bright"
                }`}
                title={formatInjuryStatus(wrestler.injury)}
              >
                {wrestler.injury ? "Injured" : "Healthy"}
              </p>
            </div>
          </div>
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

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Current week */}
        <section className="rwg-card">
          <p className="rwg-label">Current Week</p>
          <h2 className="mt-1 font-display text-3xl font-semibold tabular-nums text-accent">
            Week {week}
          </h2>

          <div className="mt-4 rwg-card-accent px-4 py-4">
            {currentEvent ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${EVENT_STYLES[currentEvent.type].className}`}
                  >
                    {EVENT_STYLES[currentEvent.type].label}
                  </span>
                  <span className="text-xs text-muted">Season {season}</span>
                </div>
                <p className="mt-2 font-display text-xl font-semibold text-foreground">
                  {currentEvent.title}
                </p>
                <p className="mt-1 text-sm text-muted">{currentEvent.detail}</p>
              </>
            ) : (
              <>
                <p className="font-display text-xl font-semibold text-foreground">
                  Open Week
                </p>
                <p className="mt-1 text-sm text-muted">
                  Nothing scheduled — check the calendar for the next match week.
                </p>
              </>
            )}
          </div>
        </section>

        {/* Quick actions */}
        <section className="flex flex-col gap-3">
          <p className="rwg-label">Quick Actions</p>

          <Link
            href="/training"
            className="rwg-card flex flex-1 flex-col justify-center border-mat/50 px-5 py-4 transition hover:border-mat-bright/40"
          >
            <p className="font-display text-xs uppercase tracking-[0.14em] text-mat-bright">
              Train
            </p>
            <p className="mt-1 font-display text-xl font-semibold uppercase tracking-wide text-foreground">
              Training Room
            </p>
          </Link>

          {wrestleAvailable && wrestleEvent ? (
            <Link
              href="/match"
              className="rwg-btn rwg-btn-primary flex flex-1 flex-col items-stretch justify-center !px-5 !py-4 text-left"
            >
              <p className="font-display text-xs uppercase tracking-[0.14em] text-accent-foreground/70">
                Scheduled Match
              </p>
              <p className="mt-1 font-display text-xl font-semibold uppercase tracking-wide">
                {wrestleEvent.title}
              </p>
            </Link>
          ) : (
            <Link
              href="/calendar"
              className="rwg-card flex flex-1 flex-col justify-center px-5 py-4 transition hover:border-accent/50"
            >
              <p className="rwg-label">
                {wrestleEvent ? "Event Complete" : "No Bout This Week"}
              </p>
              <p className="mt-1 font-display text-xl font-semibold uppercase tracking-wide text-foreground">
                Check Calendar
              </p>
            </Link>
          )}

          <Link
            href="/calendar"
            className="rwg-card flex flex-1 flex-col justify-center px-5 py-4 transition hover:border-accent/50"
          >
            <p className="rwg-label">Calendar</p>
            <p className="mt-1 font-display text-xl font-semibold uppercase tracking-wide text-foreground">
              Year Board
            </p>
          </Link>

          {showCoachPath &&
            (careerMode === "coach" ? (
              <Link
                href="/coach"
                className="rwg-card flex flex-col justify-center px-5 py-4 transition hover:border-accent/50"
              >
                <p className="rwg-label">Post-College</p>
                <p className="mt-1 font-display text-xl font-semibold uppercase tracking-wide text-foreground">
                  Coach Office
                </p>
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleRetire}
                className="rwg-card flex flex-col justify-center px-5 py-4 text-left transition hover:border-accent/50"
              >
                <p className="rwg-label">Post-College</p>
                <p className="mt-1 font-display text-xl font-semibold uppercase tracking-wide text-foreground">
                  Retire & Become Coach
                </p>
                <p className="mt-1 text-sm text-muted">
                  College complete (season {season})
                </p>
              </button>
            ))}
        </section>
      </div>
    </ArenaPage>
  );
}
