"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/lib/game-store";
import {
  EVENT_STYLES,
  YEAR_SCHEDULE,
  YEAR_WEEKS,
  eventsForWeek,
  getCurrentWrestleEvent,
  isWrestleEvent,
  type SeasonEvent,
} from "@/lib/season-schedule";
import ArenaPage from "./ArenaPage";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function weekToMonthIndex(week: number) {
  return Math.min(11, Math.floor((week - 1) / (YEAR_WEEKS / 12)));
}

export default function Calendar() {
  const week = useGameStore((state) => state.week);
  const season = useGameStore((state) => state.season);
  const advanceWeek = useGameStore((state) => state.advanceWeek);
  const startNextSeason = useGameStore((state) => state.startNextSeason);
  const currentWeek = Math.min(Math.max(week, 1), YEAR_WEEKS);

  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [note, setNote] = useState(
    "Full-year board — click any week for events. Enter matches only from the current week.",
  );

  const selectedEvents = useMemo(
    () => eventsForWeek(selectedWeek),
    [selectedWeek],
  );

  const currentWrestleEvent = useMemo(
    () => getCurrentWrestleEvent(currentWeek),
    [currentWeek],
  );
  const completedEventIds = useGameStore((state) => state.completedEventIds);
  const currentEventDone = currentWrestleEvent
    ? completedEventIds.includes(currentWrestleEvent.id)
    : false;
  /** Dual / tournament / major this week must be wrestled before advancing. */
  const mustWrestleFirst = Boolean(currentWrestleEvent && !currentEventDone);
  const canAdvance = !mustWrestleFirst;

  const currentWeekEvents = useMemo(
    () => eventsForWeek(currentWeek),
    [currentWeek],
  );

  const majorEvents = useMemo(
    () => YEAR_SCHEDULE.filter((event) => event.major || event.type === "major"),
    [],
  );

  const weeks = useMemo(
    () =>
      Array.from({ length: YEAR_WEEKS }, (_, index) => {
        const weekNum = index + 1;
        const events = eventsForWeek(weekNum);
        return {
          week: weekNum,
          events,
          hasMajor: events.some((e) => e.major || e.type === "major"),
          title: events[0]?.title ?? null,
        };
      }),
    [],
  );

  function handleAdvance() {
    if (!canAdvance) {
      setNote(
        currentWrestleEvent
          ? `Wrestle ${currentWrestleEvent.title} before advancing the week.`
          : "Finish this week’s event before advancing.",
      );
      return;
    }

    if (week >= YEAR_WEEKS) {
      startNextSeason();
      setSelectedWeek(1);
      setNote(`Season ${season + 1} started at Week 1.`);
      return;
    }

    const nextWeek = week + 1;
    advanceWeek(YEAR_WEEKS);
    setSelectedWeek(nextWeek);
    const nextEvents = eventsForWeek(nextWeek);
    setNote(
      nextEvents[0]
        ? `Advanced to Week ${nextWeek} — ${nextEvents[0].title}.`
        : `Advanced to Week ${nextWeek}.`,
    );
  }

  function renderEventCard(event: SeasonEvent, opts: { isCurrentWeek: boolean }) {
    const style = EVENT_STYLES[event.type];
    const done = completedEventIds.includes(event.id);
    const canEnter =
      opts.isCurrentWeek && isWrestleEvent(event) && !done;

    const body = (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-current/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em]">
            {style.label}
          </span>
          {(event.major || event.type === "major") && (
            <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-foreground">
              Major
            </span>
          )}
          {done && (
            <span className="rounded border border-current/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em]">
              Done
            </span>
          )}
          <span className="text-xs opacity-80">{event.location}</span>
        </div>
        <h3 className="mt-2 font-display text-xl font-semibold text-foreground">
          {event.title}
        </h3>
        <p className="mt-1 text-sm opacity-90">{event.detail}</p>
        {canEnter && (
          <p className="mt-3 font-display text-xs uppercase tracking-[0.12em] text-accent">
            Tap to enter match →
          </p>
        )}
        {opts.isCurrentWeek && isWrestleEvent(event) && done && (
          <p className="mt-3 text-xs opacity-80">
            Bout finished — rematch not available. Advance the week for the next event.
          </p>
        )}
        {opts.isCurrentWeek && !isWrestleEvent(event) && (
          <p className="mt-3 text-xs opacity-80">
            Not a match week event — no bout to enter.
          </p>
        )}
      </>
    );

    if (canEnter) {
      return (
        <Link
          key={event.id}
          href="/match"
          className={`block rounded-md border px-4 py-4 transition hover:brightness-110 ${style.className}`}
        >
          {body}
        </Link>
      );
    }

    return (
      <article
        key={event.id}
        className={`rounded-md border px-4 py-4 ${style.className}`}
      >
        {body}
      </article>
    );
  }

  return (
    <ArenaPage wide>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="rwg-label">Season Calendar</p>
          <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-5xl">
            Year Board
          </h1>
          <p className="mt-1 text-sm text-muted">
            Season {season} · Career Week {currentWeek} of {YEAR_WEEKS}
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
          {mustWrestleFirst && currentWrestleEvent && (
            <p className="text-right text-xs text-muted">
              Wrestle{" "}
              <span className="font-medium text-foreground">
                {currentWrestleEvent.title}
              </span>{" "}
              before advancing
            </p>
          )}
          <button
            type="button"
            onClick={handleAdvance}
            disabled={!canAdvance}
            className="rwg-btn rwg-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {week >= YEAR_WEEKS ? "Start Next Season" : "Ready to Advance"}
          </button>
          {mustWrestleFirst && (
            <Link
              href="/match"
              className="text-center font-display text-xs uppercase tracking-[0.12em] text-accent hover:text-accent-hover sm:text-right"
            >
              Go to Match →
            </Link>
          )}
        </div>
      </header>

      <p className="rwg-card-inset text-sm text-muted" role="status">
        {note}
      </p>

      <section className="rwg-card-accent p-4 sm:p-5">
        <p className="rwg-label">This Week · Match Entry</p>
        {currentWrestleEvent && !currentEventDone ? (
          <div className="mt-3">
            {renderEventCard(currentWrestleEvent, { isCurrentWeek: true })}
          </div>
        ) : currentWrestleEvent && currentEventDone ? (
          <div className="mt-3 rwg-card-inset px-4 py-5">
            <p className="font-display text-lg font-semibold text-foreground">
              {currentWrestleEvent.title} — complete
            </p>
            <p className="mt-1 text-sm text-muted">
              You already wrestled this event. Rematches are disabled — advance the
              calendar for the next bout.
            </p>
          </div>
        ) : (
          <div className="mt-3 rwg-card-inset px-4 py-5">
            <p className="font-display text-lg font-semibold text-foreground">
              Nothing to wrestle this week
            </p>
            <p className="mt-1 text-sm text-muted">
              {currentWeekEvents[0]
                ? `Week ${currentWeek} is “${currentWeekEvents[0].title}” (${EVENT_STYLES[currentWeekEvents[0].type].label}) — no dual, tournament, or major bout scheduled.`
                : `Week ${currentWeek} has no scheduled event. Advance the calendar when you are ready for the next match week.`}
            </p>
            <Link
              href="/training"
              className="mt-4 inline-flex font-display text-xs uppercase tracking-[0.12em] text-accent hover:text-accent-hover"
            >
              Go train instead →
            </Link>
          </div>
        )}
      </section>

      <section className="rwg-card-accent p-4 sm:p-5">
        <p className="rwg-label">Major Events</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {majorEvents.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => setSelectedWeek(event.week)}
                className="rounded-md border border-accent/50 bg-accent/15 px-3 py-2 text-left transition hover:border-accent hover:bg-accent/25"
              >
                <span className="font-display text-xs uppercase tracking-[0.1em] text-accent">
                  Wk {event.week}
                </span>
                <span className="mt-0.5 block font-display text-sm font-semibold text-foreground">
                  {event.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
        <section className="rwg-card">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="rwg-label">Full Year</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
                52-Week Grid
              </h2>
            </div>
            <p className="text-xs text-muted">
              Gold border = current · Amber fill = selected · Dot = major
            </p>
          </div>

          <div className="mb-3 hidden grid-cols-12 gap-1 sm:grid">
            {MONTH_LABELS.map((label) => (
              <p
                key={label}
                className="text-center font-display text-[10px] uppercase tracking-[0.12em] text-muted"
              >
                {label}
              </p>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-[repeat(13,minmax(0,1fr))]">
            {weeks.map((cell) => {
              const isCurrent = cell.week === currentWeek;
              const isSelected = cell.week === selectedWeek;
              const monthHint = MONTH_LABELS[weekToMonthIndex(cell.week)];

              return (
                <button
                  key={cell.week}
                  type="button"
                  onClick={() => setSelectedWeek(cell.week)}
                  title={
                    cell.title
                      ? `Week ${cell.week}: ${cell.title}`
                      : `Week ${cell.week} · ${monthHint}`
                  }
                  className={`relative flex min-h-[3.5rem] flex-col items-start justify-between rounded-md border px-2 py-2 text-left transition sm:min-h-[4.25rem] ${
                    isSelected
                      ? "border-accent bg-accent/20"
                      : isCurrent
                        ? "border-accent bg-panel"
                        : cell.hasMajor
                          ? "border-accent/40 bg-accent/10 hover:border-accent/70"
                          : "border-panel-border bg-background/40 hover:border-accent/40"
                  } ${isCurrent ? "ring-2 ring-accent ring-offset-1 ring-offset-background" : ""}`}
                >
                  <span className="font-display text-xs font-semibold tabular-nums text-accent">
                    {cell.week}
                  </span>
                  <span className="line-clamp-2 text-[10px] leading-tight text-muted sm:text-[11px]">
                    {cell.title ?? "Open"}
                  </span>
                  {cell.hasMajor && (
                    <span
                      className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent"
                      aria-hidden
                    />
                  )}
                  {isCurrent && (
                    <span className="absolute bottom-1 right-1 font-display text-[8px] uppercase tracking-[0.08em] text-accent">
                      Now
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rwg-card flex flex-col">
          <p className="rwg-label">Selected Week</p>
          <h2 className="mt-1 font-display text-3xl font-semibold tabular-nums text-accent">
            Week {selectedWeek}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {MONTH_LABELS[weekToMonthIndex(selectedWeek)]} window
            {selectedWeek === currentWeek ? " · Current career week" : ""}
          </p>

          <div className="mt-5 flex flex-1 flex-col gap-3">
            {selectedEvents.length === 0 ? (
              <div className="rwg-card-inset flex flex-1 flex-col justify-center px-4 py-6">
                <p className="font-display text-lg font-semibold text-foreground">
                  Open week
                </p>
                <p className="mt-1 text-sm text-muted">
                  {selectedWeek === currentWeek
                    ? "Nothing to wrestle this week — no dual, tournament, or major is scheduled."
                    : "No scheduled event on this week."}
                </p>
              </div>
            ) : (
              selectedEvents.map((event) =>
                renderEventCard(event, {
                  isCurrentWeek: selectedWeek === currentWeek,
                }),
              )
            )}
          </div>

          {selectedWeek !== currentWeek && (
            <p className="mt-4 text-xs text-muted">
              Viewing Week {selectedWeek}. Your career is on Week {currentWeek} —
              only the current week’s match can be entered.
            </p>
          )}
        </section>
      </div>

      <section className="rwg-card">
        <p className="rwg-label">Year List</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
          Scheduled Weeks
        </h2>
        <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
          {YEAR_SCHEDULE.map((event) => {
            const isCurrent = event.week === currentWeek;
            const isSelected = event.week === selectedWeek;
            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => setSelectedWeek(event.week)}
                  className={`flex w-full items-start justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition ${
                    isSelected
                      ? "border-accent bg-accent/15"
                      : isCurrent
                        ? "border-accent/60 bg-panel"
                        : "border-panel-border bg-background/40 hover:border-accent/40"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-display text-xs uppercase tracking-[0.12em] text-accent">
                      Week {event.week}
                      {isCurrent ? " · Now" : ""}
                      {(event.major || event.type === "major") ? " · Major" : ""}
                    </p>
                    <p className="mt-0.5 truncate font-display text-base font-semibold text-foreground">
                      {event.title}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{event.location}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </ArenaPage>
  );
}
