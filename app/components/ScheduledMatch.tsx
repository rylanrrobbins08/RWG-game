"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/lib/game-store";
import {
  leagueBotToMatchOpponent,
  memberKeyForUserId,
  pickDualOpponent,
} from "@/lib/league";
import { generateDualOpponent, isBracketEvent } from "@/lib/opponents";
import {
  EVENT_STYLES,
  eventsForWeek,
  getCurrentWrestleEvent,
} from "@/lib/season-schedule";
import { getPvpMatch, type PvpMatchResult } from "@/lib/league-actions";
import { persistGameNow } from "@/lib/game-sync";
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
  const userId = useGameStore((state) => state.userId);
  const activeLeagueId = useGameStore((state) => state.activeLeagueId);
  const applyMatchResult = useGameStore((state) => state.applyMatchResult);
  const ensureWeightClassRoster = useGameStore(
    (state) => state.ensureWeightClassRoster,
  );
  const [pvpMatch, setPvpMatch] = useState<PvpMatchResult | null>(null);
  const [pvpReady, setPvpReady] = useState(false);
  const appliedPvpKey = useRef<string | null>(null);
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
        school: bot.isHuman ? bot.school : school,
        note: bot.isHuman
          ? `Player vs player — ${event.detail}`
          : `${event.detail} Facing ${school}.`,
      };
    }
    return generateDualOpponent(event, wrestler.weightClass);
  }, [event, wrestler.weightClass, leagueRoster]);

  useEffect(() => {
    if (!event || !dualOpponent?.isHuman || !userId) {
      setPvpMatch(null);
      setPvpReady(true);
      return;
    }

    let cancelled = false;
    setPvpReady(false);
    const opponentKey = dualOpponent.id.startsWith("user:")
      ? dualOpponent.id
      : memberKeyForUserId(dualOpponent.userId ?? dualOpponent.id);

    void getPvpMatch({
      leagueId: activeLeagueId,
      eventId: event.id,
      yourMemberKey: memberKeyForUserId(userId),
      opponentMemberKey: opponentKey,
    }).then((result) => {
      if (cancelled) return;
      setPvpMatch(result.ok ? result.match : null);
      setPvpReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [activeLeagueId, dualOpponent, event, userId]);

  useEffect(() => {
    if (!event || !dualOpponent || !pvpMatch) return;
    const key = `${event.id}|${pvpMatch.winnerKey}|${pvpMatch.scoreA}-${pvpMatch.scoreB}`;
    if (appliedPvpKey.current === key) return;
    if (completedEventIds.includes(event.id)) return;
    appliedPvpKey.current = key;
    applyMatchResult({
      won: pvpMatch.youWon,
      eventId: event.id,
      opponent: {
        id: dualOpponent.id,
        name: dualOpponent.name,
        school: dualOpponent.school,
        attributes: dualOpponent.attributes,
        userId: dualOpponent.userId ?? null,
      },
    });
    persistGameNow();
  }, [
    applyMatchResult,
    completedEventIds,
    dualOpponent,
    event,
    pvpMatch,
  ]);

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

  if (isBracketEvent(event)) {
    return <TournamentEvent event={event} />;
  }

  if (!dualOpponent) {
    return null;
  }

  if (dualOpponent.isHuman && !pvpReady) {
    return (
      <ArenaPage>
        <p className="text-sm text-muted">Checking player-vs-player bout…</p>
      </ArenaPage>
    );
  }

  if (pvpMatch && userId) {
    const yourKey = memberKeyForUserId(userId);
    const yourScore =
      pvpMatch.memberA === yourKey ? pvpMatch.scoreA : pvpMatch.scoreB;
    const theirScore =
      pvpMatch.memberA === yourKey ? pvpMatch.scoreB : pvpMatch.scoreA;
    return (
      <ArenaPage>
        <header>
          <p className="rwg-label">Player vs Player</p>
          <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
            Bout Complete
          </h1>
        </header>
        <section className="rwg-card-accent p-5">
          <p className="font-display text-xl font-semibold text-foreground">
            {pvpMatch.youWon ? "You won" : "You lost"} vs {dualOpponent.name}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-accent">
            {yourScore} – {theirScore}
          </p>
          <p className="mt-2 text-sm text-muted">
            This dual was already wrestled in your shared league. Both players
            see the same result.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/league" className="rwg-btn rwg-btn-primary">
              League Standings
            </Link>
            <Link href="/calendar" className="rwg-btn rwg-btn-ghost">
              Calendar
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

  return <MatchSimulation event={event} opponent={dualOpponent} />;
}
