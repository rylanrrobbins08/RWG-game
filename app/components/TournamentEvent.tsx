"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  buildTournamentBracket,
  getPlayerMatch,
  getPlayerMatchOpponent,
  resolveAfterPlayerMatch,
} from "@/lib/bracket";
import { useGameStore } from "@/lib/game-store";
import {
  leagueBotToMatchOpponent,
  pickBracketBots,
} from "@/lib/league";
import type { AiOpponent } from "@/lib/opponents";
import type { SeasonEvent } from "@/lib/season-schedule";
import ArenaPage from "./ArenaPage";
import MatchSimulation from "./MatchSimulation";
import TournamentBracketView from "./TournamentBracketView";

type View = "bracket" | "match";

/** Orchestrates 16-man bracket + wrestle-backs for tournament/major events. */
export default function TournamentEvent({ event }: { event: SeasonEvent }) {
  const wrestler = useGameStore((state) => state.wrestler);
  const activeTournament = useGameStore((state) => state.activeTournament);
  const setActiveTournament = useGameStore((state) => state.setActiveTournament);
  const updateActiveTournament = useGameStore(
    (state) => state.updateActiveTournament,
  );
  const clearActiveTournament = useGameStore(
    (state) => state.clearActiveTournament,
  );
  const clearTournamentLastResult = useGameStore(
    (state) => state.clearTournamentLastResult,
  );
  const ensureWeightClassRoster = useGameStore(
    (state) => state.ensureWeightClassRoster,
  );

  const [view, setView] = useState<View>("bracket");
  /** Locked opponent for the active bout — avoids remounting into the next match. */
  const [boutOpponent, setBoutOpponent] = useState<AiOpponent | null>(null);
  /** Win/loss waiting to be applied to the bracket after the summary CTA. */
  const [pendingWon, setPendingWon] = useState<boolean | null>(null);

  useEffect(() => {
    ensureWeightClassRoster();
  }, [ensureWeightClassRoster, wrestler.weightClass]);

  // Seed or resume persisted bracket for this event.
  useEffect(() => {
    if (activeTournament?.eventId === event.id) return;
    ensureWeightClassRoster();
    const roster = useGameStore.getState().leagueRoster;
    const field = pickBracketBots(
      roster,
      15,
      `${event.id}|${wrestler.name}|${wrestler.weightClass}`,
    ).map((bot) => leagueBotToMatchOpponent(bot, wrestler.weightClass));

    setActiveTournament({
      eventId: event.id,
      bracket: buildTournamentBracket(
        event,
        wrestler.name,
        wrestler.weightClass,
        field,
      ),
      lastResult: null,
      recordedMatchIds: [],
    });
  }, [
    activeTournament?.eventId,
    event,
    setActiveTournament,
    ensureWeightClassRoster,
    wrestler.name,
    wrestler.weightClass,
  ]);

  const bracket =
    activeTournament?.eventId === event.id ? activeTournament.bracket : null;
  const lastResult =
    activeTournament?.eventId === event.id
      ? activeTournament.lastResult
      : null;

  const playerMatch = useMemo(
    () => (bracket ? getPlayerMatch(bracket) : null),
    [bracket],
  );
  const nextOpponent = useMemo(
    () => (bracket ? getPlayerMatchOpponent(bracket) : null),
    [bracket],
  );
  const finished = bracket ? bracket.status !== "active" : false;

  function startBout() {
    if (!nextOpponent || !bracket || finished) return;
    clearTournamentLastResult();
    setPendingWon(null);
    setBoutOpponent(nextOpponent);
    setView("match");
  }

  /** Record is already saved; only remember the result until the player continues. */
  function handleMatchComplete(won: boolean) {
    setPendingWon(won);
  }

  function continueAfterSummary() {
    if (pendingWon !== null && bracket && boutOpponent) {
      const { bracket: next, botResults } = resolveAfterPlayerMatch(
        bracket,
        pendingWon,
        wrestler.name,
      );
      updateActiveTournament(
        next,
        {
          won: pendingWon,
          opponentName: boutOpponent.name,
        },
        botResults,
      );
    }
    setPendingWon(null);
    setBoutOpponent(null);
    setView("bracket");
  }

  function shouldCompleteEvent(won: boolean) {
    if (!bracket || !playerMatch) return false;
    const losses = bracket.playerLosses;
    const label = playerMatch.roundLabel;
    if (!won && losses >= 1) return true;
    if (won && label === "Final" && bracket.playerSide === "championship") {
      return true;
    }
    if (label === "3rd Place") return true;
    return false;
  }

  function leaveTournament() {
    clearActiveTournament();
  }

  if (!bracket) {
    return (
      <ArenaPage>
        <p className="text-sm text-muted">Loading bracket…</p>
      </ArenaPage>
    );
  }

  if (view === "match" && boutOpponent) {
    const eventWillComplete =
      pendingWon !== null
        ? shouldCompleteEvent(pendingWon)
        : false;

    return (
      <MatchSimulation
        key={`bout-${boutOpponent.id}`}
        event={event}
        opponent={boutOpponent}
        shouldCompleteEvent={shouldCompleteEvent}
        onMatchComplete={handleMatchComplete}
        afterMatchAction={{
          label: eventWillComplete
            ? "Return to Bracket"
            : "Continue to Bracket",
          onClick: continueAfterSummary,
          finishedMessage: eventWillComplete
            ? "Review the summary, then return to the bracket to finish this event."
            : "Review the summary, then continue to the bracket when you are ready for the next bout.",
        }}
      />
    );
  }

  return (
    <ArenaPage wide>
      <TournamentBracketView
        event={event}
        bracket={bracket}
        lastResult={lastResult}
        onWrestle={startBout}
      />

      {finished && (
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/calendar"
            className="rwg-btn rwg-btn-primary"
            onClick={leaveTournament}
          >
            Back to Calendar
          </Link>
          <Link
            href="/dashboard"
            className="rwg-btn rwg-btn-ghost"
            onClick={leaveTournament}
          >
            Dashboard
          </Link>
        </div>
      )}
    </ArenaPage>
  );
}
