"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useGameStore } from "@/lib/game-store";
import {
  leagueBotToMatchOpponent,
  pickDualOpponent,
} from "@/lib/league";
import { generateDualOpponent, isBracketEvent } from "@/lib/opponents";
import {
  EVENT_STYLES,
  eventsForWeek,
  getCurrentWrestleEvent,
} from "@/lib/season-schedule";
import ArenaPage from "./ArenaPage";
import MatchSimulation from "./MatchSimulation";
import TournamentEvent from "./TournamentEvent";

/** Gates the match sim behind the current calendar wrestle event. */
export default function ScheduledMatch() {
  const week = useGameStore((state) => state.week);
  const wrestler = useGameStore((state) => state.wrestler);
  const completedEventIds = useGameStore((state) => state.completedEventIds);
  const activeTournament = useGameStore((state) => state.activeTournament);
  const leagueRoster = useGameStore((state) => state.leagueRoster);
  const ensureWeightClassRoster = useGameStore(
    (state) => state.ensureWeightClassRoster,
  );
  const event = getCurrentWrestleEvent(week);
  const weekEvents = eventsForWeek(week);
  const alreadyCompleted = event
    ? completedEventIds.includes(event.id)
    : false;
  const resumeTournament =
    event !== null &&
    isBracketEvent(event) &&
    activeTournament?.eventId === event.id;

  useEffect(() => {
    ensureWeightClassRoster();
  }, [ensureWeightClassRoster, wrestler.weightClass]);

  const dualOpponent = useMemo(() => {
    if (!event || isBracketEvent(event)) return null;
    const picked = pickDualOpponent(
      leagueRoster,
      `${event.id}|dual|${wrestler.weightClass}`,
    );
    if (picked) {
      const bot = leagueBotToMatchOpponent(picked, wrestler.weightClass);
      const vsMatch = event.title.match(/^vs\s+(.+)$/i);
      const school = vsMatch?.[1]?.trim() || event.location || bot.school;
      return {
        ...bot,
        school,
        note: `${event.detail} Facing ${school}.`,
      };
    }
    return generateDualOpponent(event, wrestler.weightClass);
  }, [event, wrestler.weightClass, leagueRoster]);

  if (!event) {
    return (
      <ArenaPage>
        <header>
          <p className="rwg-label">Match</p>
          <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
            No Bout Scheduled
          </h1>
        </header>

        <section className="rwg-card">
          <p className="font-display text-xl font-semibold text-foreground">
            Nothing to wrestle this week
          </p>
          <p className="mt-2 text-sm text-muted">
            Free / open matches are disabled. You can only wrestle the dual,
            tournament, or major listed on the calendar for Week {week}.
          </p>
          {weekEvents[0] ? (
            <p className="mt-3 text-sm text-muted">
              This week’s event is{" "}
              <span className="font-medium text-foreground">
                {weekEvents[0].title}
              </span>{" "}
              ({EVENT_STYLES[weekEvents[0].type].label}) — it is not a match
              entry.
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Week {week} has no scheduled calendar event.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/calendar" className="rwg-btn rwg-btn-primary">
              Open Calendar
            </Link>
            <Link href="/training" className="rwg-btn rwg-btn-ghost">
              Training Room
            </Link>
            <Link href="/dashboard" className="rwg-btn rwg-btn-ghost">
              Dashboard
            </Link>
          </div>
        </section>
      </ArenaPage>
    );
  }

  if (alreadyCompleted && !resumeTournament) {
    return (
      <ArenaPage>
        <header>
          <p className="rwg-label">Match</p>
          <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
            Event Complete
          </h1>
        </header>

        <section className="rwg-card">
          <p className="font-display text-xl font-semibold text-foreground">
            {event.title} is already finished
          </p>
          <p className="mt-2 text-sm text-muted">
            Rematches are not allowed. Advance the calendar to reach the next
            dual, tournament, or major.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/calendar" className="rwg-btn rwg-btn-primary">
              Open Calendar
            </Link>
            <Link href="/dashboard" className="rwg-btn rwg-btn-ghost">
              Dashboard
            </Link>
          </div>
        </section>
      </ArenaPage>
    );
  }

  if (isBracketEvent(event)) {
    return <TournamentEvent event={event} />;
  }

  if (!dualOpponent) {
    return null;
  }

  return <MatchSimulation event={event} opponent={dualOpponent} />;
}
