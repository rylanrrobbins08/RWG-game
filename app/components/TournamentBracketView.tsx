"use client";

import { useMemo, useState } from "react";
import {
  entrantLabel,
  getPlayerMatch,
  getPlayerMatchOpponent,
  sameEntrant,
  type BracketEntrant,
  type BracketMatch,
  type TournamentBracket,
} from "@/lib/bracket";
import {
  getEffectiveAttributes,
  useGameStore,
} from "@/lib/game-store";
import {
  normalizeLeagueAttributes,
  type WrestlerScoutProfile,
} from "@/lib/league";
import type { SeasonEvent } from "@/lib/season-schedule";
import { EVENT_STYLES } from "@/lib/season-schedule";
import WrestlerScoutModal from "./WrestlerScoutModal";

type TournamentBracketViewProps = {
  event: SeasonEvent;
  bracket: TournamentBracket;
  lastResult?: { won: boolean; opponentName: string } | null;
  onWrestle: () => void;
};

function Slot({
  entrant,
  highlight,
  winner,
  hideIdentity,
  record,
  onScout,
}: {
  entrant: BracketEntrant | null;
  highlight?: boolean;
  winner?: boolean;
  hideIdentity?: boolean;
  record?: string | null;
  onScout?: (entrant: BracketEntrant) => void;
}) {
  const isPlayer = entrant?.kind === "player";
  const label = hideIdentity && !isPlayer ? "TBD" : entrantLabel(entrant);
  const canScout = Boolean(entrant && !hideIdentity && onScout);

  const className = `w-full rounded-sm border px-2 py-1.5 text-left text-xs sm:text-sm ${
    highlight
      ? "border-accent bg-accent/20 text-accent"
      : isPlayer
        ? "border-accent/50 bg-accent/10 text-foreground"
        : "border-panel-border bg-background/50 text-foreground"
  } ${winner ? "font-semibold" : ""} ${
    canScout
      ? "cursor-pointer transition hover:border-accent/70 hover:bg-accent/10"
      : ""
  }`;

  const body = (
    <>
      <span className="line-clamp-1 font-display">{label}</span>
      {entrant?.kind === "bot" && !hideIdentity && (
        <span className="mt-0.5 block text-[10px] text-muted">
          {entrant.opponent.school}
          {record ? ` · ${record}` : ""}
        </span>
      )}
      {canScout && (
        <span className="mt-0.5 block text-[9px] uppercase tracking-[0.1em] text-accent/80">
          Scout
        </span>
      )}
    </>
  );

  if (canScout && entrant) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => onScout?.(entrant)}
      >
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}

function MatchCard({
  match,
  active,
  obscureNonCurrent,
  leagueById,
  onScout,
}: {
  match: BracketMatch;
  active?: boolean;
  obscureNonCurrent?: boolean;
  leagueById: Map<string, { wins: number; losses: number }>;
  onScout: (entrant: BracketEntrant) => void;
}) {
  const hideA = Boolean(
    obscureNonCurrent && match.a && match.a.kind !== "player",
  );
  const hideB = Boolean(
    obscureNonCurrent && match.b && match.b.kind !== "player",
  );

  function recordFor(entrant: BracketEntrant | null) {
    if (entrant?.kind === "player") {
      const row = leagueById.get("league-player");
      return row ? `${row.wins}-${row.losses}` : null;
    }
    if (entrant?.kind !== "bot") return null;
    const row = leagueById.get(entrant.opponent.id);
    return row ? `${row.wins}-${row.losses}` : null;
  }

  return (
    <div
      className={`rounded-md border px-2 py-2 ${
        active
          ? "border-accent bg-accent/10 shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)]"
          : "border-panel-border/80 bg-panel/60"
      }`}
    >
      <p className="mb-1.5 font-display text-[9px] uppercase tracking-[0.12em] text-muted">
        {match.roundLabel}
        {match.side === "consolation" ? " · WB" : ""}
      </p>
      <div className="flex flex-col gap-1">
        <Slot
          entrant={match.a}
          highlight={active && match.a?.kind === "player"}
          winner={sameEntrant(match.a, match.winner)}
          hideIdentity={hideA}
          record={recordFor(match.a)}
          onScout={onScout}
        />
        <Slot
          entrant={match.b}
          highlight={active && match.b?.kind === "player"}
          winner={sameEntrant(match.b, match.winner)}
          hideIdentity={hideB}
          record={recordFor(match.b)}
          onScout={onScout}
        />
      </div>
    </div>
  );
}

function BracketColumns({
  rounds,
  activeMatchId,
  playerSide,
  playerRoundIndex,
  finished,
  leagueById,
  onScout,
}: {
  rounds: BracketMatch[][];
  activeMatchId: string | null;
  playerSide: TournamentBracket["playerSide"];
  playerRoundIndex: number;
  finished: boolean;
  leagueById: Map<string, { wins: number; losses: number }>;
  onScout: (entrant: BracketEntrant) => void;
}) {
  return (
    <div className="mt-4 flex min-w-max gap-4 pb-2">
      {rounds.map((row, roundIndex) => {
        const isFutureForPlayer =
          !finished &&
          playerSide === row[0]?.side &&
          roundIndex > playerRoundIndex;

        return (
          <div
            key={row[0]?.id ?? roundIndex}
            className="flex w-40 flex-col gap-3 sm:w-48"
          >
            <p className="font-display text-[10px] uppercase tracking-[0.14em] text-accent">
              {row[0]?.roundLabel}
            </p>
            <div
              className="flex flex-col justify-around gap-3"
              style={{ minHeight: `${Math.max(row.length, 1) * 5.5}rem` }}
            >
              {row.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  active={!finished && match.id === activeMatchId}
                  obscureNonCurrent={isFutureForPlayer}
                  leagueById={leagueById}
                  onScout={onScout}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Full 16-man championship + wrestle-back bracket. */
export default function TournamentBracketView({
  event,
  bracket,
  lastResult,
  onWrestle,
}: TournamentBracketViewProps) {
  const wrestler = useGameStore((state) => state.wrestler);
  const leagueRoster = useGameStore((state) => state.leagueRoster);
  const [scout, setScout] = useState<WrestlerScoutProfile | null>(null);

  const activeMatch = getPlayerMatch(bracket);
  const opponent = getPlayerMatchOpponent(bracket);
  const finished = bracket.status !== "active";

  const playerAttrs = useMemo(
    () => getEffectiveAttributes(wrestler),
    [wrestler],
  );

  const leagueById = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number }>();
    for (const row of leagueRoster) {
      map.set(row.id, { wins: row.wins, losses: row.losses });
    }
    map.set("league-player", {
      wins: wrestler.record.wins,
      losses: wrestler.record.losses,
    });
    return map;
  }, [leagueRoster, wrestler.record.wins, wrestler.record.losses]);

  const opponentRecord = useMemo(() => {
    if (!opponent) return null;
    const row =
      leagueById.get(opponent.id) ??
      leagueRoster.find(
        (m) =>
          !m.isPlayer &&
          m.name.toLowerCase() === opponent.name.toLowerCase(),
      );
    return row ? `${row.wins}-${row.losses}` : opponent.record;
  }, [opponent, leagueById, leagueRoster]);

  function scoutEntrant(entrant: BracketEntrant) {
    if (entrant.kind === "player") {
      setScout({
        id: "league-player",
        name: wrestler.name,
        school: "Your Room",
        wins: wrestler.record.wins,
        losses: wrestler.record.losses,
        attributes: playerAttrs,
        isPlayer: true,
      });
      return;
    }

    const leagueRow = leagueRoster.find(
      (m) =>
        !m.isPlayer &&
        (m.id === entrant.opponent.id ||
          m.name.toLowerCase() === entrant.opponent.name.toLowerCase()),
    );

    setScout({
      id: entrant.opponent.id,
      name: entrant.opponent.name,
      school: entrant.opponent.school,
      wins: leagueRow?.wins ?? 0,
      losses: leagueRow?.losses ?? 0,
      attributes: normalizeLeagueAttributes(
        entrant.opponent.attributes,
        entrant.opponent.id,
      ),
    });
  }

  const statusCopy =
    bracket.status === "champion"
      ? { label: "Champion", body: `You won ${event.title}` }
      : bracket.status === "placed"
        ? { label: "3rd Place", body: `Podium finish at ${event.title}` }
        : bracket.status === "eliminated"
          ? {
              label: "Eliminated",
              body: `Two losses — tournament run over`,
            }
          : null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="rwg-label">
            {EVENT_STYLES[event.type].label} · 16-Man · Wrestle-backs
          </p>
          <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
            {event.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {event.location} · {event.detail}
          </p>
        </div>
        {bracket.playerLosses > 0 && bracket.status === "active" && (
          <p className="font-display text-xs uppercase tracking-[0.14em] text-danger-soft">
            1 loss · wrestle-backs
          </p>
        )}
      </header>

      {lastResult && (
        <section
          className={
            lastResult.won ? "rwg-card-accent !p-4" : "rwg-card !p-4"
          }
        >
          <p className="rwg-label">Last Bout</p>
          <p className="mt-1 font-display text-xl font-semibold text-foreground">
            {lastResult.won ? "Win" : "Loss"} vs {lastResult.opponentName}
          </p>
          {!finished && (
            <p className="mt-1 text-sm text-muted">
              Bracket updated — your next opponent is posted when available.
            </p>
          )}
        </section>
      )}

      {!finished && activeMatch && (
        <section className="rwg-card-accent !p-4">
          <p className="rwg-label">
            Your Next Bout ·{" "}
            {activeMatch.side === "consolation"
              ? "Wrestle-back"
              : "Championship"}
          </p>
          <p className="mt-1 font-display text-xl font-semibold text-foreground">
            {activeMatch.roundLabel}: vs {opponent?.name ?? "TBD"}
          </p>
          {opponent && (
            <p className="mt-1 text-sm text-muted">
              {opponent.school} · {opponentRecord}
            </p>
          )}
          {!opponent && (
            <p className="mt-1 text-sm text-muted">
              Opponent locks in after you finish your current bout and the
              bracket advances.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onWrestle}
              disabled={!opponent}
              className="rwg-btn rwg-btn-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Wrestle {activeMatch.roundLabel}
            </button>
            {opponent && (
              <button
                type="button"
                onClick={() =>
                  scoutEntrant({ kind: "bot", opponent })
                }
                className="rwg-btn rwg-btn-ghost"
              >
                Scout Opponent
              </button>
            )}
          </div>
        </section>
      )}

      {statusCopy && (
        <section
          className={
            bracket.status === "eliminated"
              ? "rwg-card !p-4"
              : "rwg-card-accent !p-4"
          }
        >
          <p className="rwg-label">{statusCopy.label}</p>
          <p
            className={`mt-1 font-display text-2xl font-semibold ${
              bracket.status === "eliminated" ? "text-foreground" : "text-accent"
            }`}
          >
            {statusCopy.body}
          </p>
        </section>
      )}

      <section className="rwg-card overflow-x-auto">
        <p className="rwg-label">Championship Bracket</p>
        <p className="mt-1 text-sm text-muted">
          Tap a visible wrestler to scout attributes. Later rounds stay TBD
          until you advance.
        </p>
        <BracketColumns
          rounds={bracket.championship}
          activeMatchId={activeMatch?.id ?? null}
          playerSide={bracket.playerSide}
          playerRoundIndex={bracket.playerRoundIndex}
          finished={finished}
          leagueById={leagueById}
          onScout={scoutEntrant}
        />
      </section>

      <section className="rwg-card overflow-x-auto">
        <p className="rwg-label">Wrestle-backs</p>
        <p className="mt-1 text-sm text-muted">
          One loss drops you here. A second loss eliminates you. Win through for
          3rd place.
        </p>
        <BracketColumns
          rounds={bracket.consolation}
          activeMatchId={activeMatch?.id ?? null}
          playerSide={bracket.playerSide}
          playerRoundIndex={bracket.playerRoundIndex}
          finished={finished}
          leagueById={leagueById}
          onScout={scoutEntrant}
        />
      </section>

      {scout && (
        <WrestlerScoutModal profile={scout} onClose={() => setScout(null)} />
      )}
    </div>
  );
}
