import type { AiOpponent } from "@/lib/opponents";
import { bracketSizeForEvent } from "@/lib/opponents";
import type { SeasonEvent } from "@/lib/season-schedule";
import type { BotMatchResult, LeagueOpponentRef } from "@/lib/league";

export type BracketEntrant =
  | { kind: "player"; label: string }
  | { kind: "bot"; opponent: AiOpponent };

export type BracketSide = "championship" | "consolation";

export type BracketMatch = {
  id: string;
  side: BracketSide;
  round: number;
  roundLabel: string;
  index: number;
  a: BracketEntrant | null;
  b: BracketEntrant | null;
  winner: BracketEntrant | null;
  loser: BracketEntrant | null;
};

export type TournamentStatus =
  | "active"
  | "champion"
  | "placed"
  | "eliminated";

export type TournamentBracket = {
  size: 16;
  championship: BracketMatch[][];
  consolation: BracketMatch[][];
  playerLosses: number;
  playerSide: BracketSide;
  playerRoundIndex: number;
  status: TournamentStatus;
  placement?: number;
};

export type ResolveAfterPlayerMatchResult = {
  bracket: TournamentBracket;
  /** Newly resolved bot-vs-bot matches (for league W-L updates). */
  botResults: BotMatchResult[];
};

const CHAMP_LABELS = [
  "Round of 16",
  "Quarterfinal",
  "Semifinal",
  "Final",
] as const;

/** Double-elim style wrestle-backs for a 16-man field. */
const CONSOL_LABELS = [
  "Wrestle-back R1",
  "Wrestle-back R2",
  "Wrestle-back R3",
  "Wrestle-back R4",
  "3rd Place",
] as const;

function overall(attrs: AiOpponent["attributes"]) {
  const values = Object.values(attrs);
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function strongerBot(
  a: Extract<BracketEntrant, { kind: "bot" }>,
  b: Extract<BracketEntrant, { kind: "bot" }>,
): BracketEntrant {
  return overall(a.opponent.attributes) >= overall(b.opponent.attributes) ? a : b;
}

function weakerBot(
  a: Extract<BracketEntrant, { kind: "bot" }>,
  b: Extract<BracketEntrant, { kind: "bot" }>,
): BracketEntrant {
  return overall(a.opponent.attributes) < overall(b.opponent.attributes) ? a : b;
}

function cloneRounds(rounds: BracketMatch[][]): BracketMatch[][] {
  return rounds.map((row) => row.map((m) => ({ ...m })));
}

export function entrantLabel(entrant: BracketEntrant | null): string {
  if (!entrant) return "TBD";
  if (entrant.kind === "player") return entrant.label;
  return entrant.opponent.name;
}

export function sameEntrant(
  a: BracketEntrant | null,
  b: BracketEntrant | null,
): boolean {
  if (!a || !b) return false;
  if (a.kind === "player" && b.kind === "player") return true;
  if (a.kind === "bot" && b.kind === "bot") {
    return a.opponent.id === b.opponent.id;
  }
  return false;
}

function emptyMatch(
  eventId: string,
  side: BracketSide,
  round: number,
  index: number,
  roundLabel: string,
): BracketMatch {
  return {
    id: `${eventId}-${side}-r${round}-m${index}`,
    side,
    round,
    roundLabel,
    index,
    a: null,
    b: null,
    winner: null,
    loser: null,
  };
}

function matchHasPlayer(match: BracketMatch): boolean {
  return match.a?.kind === "player" || match.b?.kind === "player";
}

function slotContains(match: BracketMatch, entrant: BracketEntrant): boolean {
  return sameEntrant(match.a, entrant) || sameEntrant(match.b, entrant);
}

function fillPair(match: BracketMatch, entrant: BracketEntrant) {
  if (slotContains(match, entrant)) return;
  if (!match.a) match.a = entrant;
  else if (!match.b) match.b = entrant;
}

function setMatchResult(
  match: BracketMatch,
  winner: BracketEntrant,
  loser: BracketEntrant,
) {
  match.winner = winner;
  match.loser = loser;
}

function botRef(
  entrant: Extract<BracketEntrant, { kind: "bot" }>,
): LeagueOpponentRef {
  return {
    id: entrant.opponent.id,
    name: entrant.opponent.name,
    school: entrant.opponent.school,
    attributes: entrant.opponent.attributes,
    weightClass: entrant.opponent.weightClass,
    tier: entrant.opponent.tier,
  };
}

/** Resolve a bot-vs-bot match; push a league result when newly decided. */
function resolveBotMatch(match: BracketMatch, sink: BotMatchResult[]) {
  if (match.winner) return;
  if (match.a?.kind !== "bot" || match.b?.kind !== "bot") return;
  const winner = strongerBot(match.a, match.b);
  const loser = weakerBot(match.a, match.b);
  setMatchResult(match, winner, loser);
  if (winner.kind === "bot" && loser.kind === "bot") {
    sink.push({
      matchId: match.id,
      winner: botRef(winner),
      loser: botRef(loser),
    });
  }
}

function opponentOfPlayer(match: BracketMatch): BracketEntrant | null {
  if (match.a?.kind === "player") return match.b;
  if (match.b?.kind === "player") return match.a;
  return null;
}

/** All unique bots seeded in the bracket (for league roster registration). */
export function listBracketBots(
  bracket: TournamentBracket,
): LeagueOpponentRef[] {
  const byId = new Map<string, LeagueOpponentRef>();
  const rows = [...bracket.championship, ...bracket.consolation];
  for (const row of rows) {
    for (const match of row) {
      for (const slot of [match.a, match.b, match.winner, match.loser]) {
        if (slot?.kind !== "bot") continue;
        byId.set(slot.opponent.id, botRef(slot));
      }
    }
  }
  return [...byId.values()];
}

/**
 * 16-man championship + wrestle-back bracket.
 * Pass league-field bots so records stay tied to the weight-class roster.
 * Unplayed rounds stay TBD. Bot matches resolve only after the player finishes.
 */
export function buildTournamentBracket(
  event: SeasonEvent,
  playerName: string,
  weightClass: number,
  fieldBots: AiOpponent[],
): TournamentBracket {
  const size = bracketSizeForEvent(event);
  const bots = fieldBots.slice(0, size - 1);

  const firstSlots: BracketEntrant[] = [
    { kind: "player", label: playerName },
    ...bots.map((opponent) => ({ kind: "bot" as const, opponent })),
  ];

  const championship: BracketMatch[][] = [];
  const r16: BracketMatch[] = [];
  for (let i = 0; i < size; i += 2) {
    r16.push({
      ...emptyMatch(event.id, "championship", 1, i / 2, CHAMP_LABELS[0]),
      a: firstSlots[i] ?? null,
      b: firstSlots[i + 1] ?? null,
    });
  }
  championship.push(r16);

  for (let round = 2; round <= 4; round += 1) {
    const matchCount = size / 2 ** round;
    championship.push(
      Array.from({ length: matchCount }, (_, i) =>
        emptyMatch(event.id, "championship", round, i, CHAMP_LABELS[round - 1]),
      ),
    );
  }

  const consolation: BracketMatch[][] = [
    Array.from({ length: 4 }, (_, i) =>
      emptyMatch(event.id, "consolation", 1, i, CONSOL_LABELS[0]),
    ),
    Array.from({ length: 4 }, (_, i) =>
      emptyMatch(event.id, "consolation", 2, i, CONSOL_LABELS[1]),
    ),
    Array.from({ length: 2 }, (_, i) =>
      emptyMatch(event.id, "consolation", 3, i, CONSOL_LABELS[2]),
    ),
    Array.from({ length: 2 }, (_, i) =>
      emptyMatch(event.id, "consolation", 4, i, CONSOL_LABELS[3]),
    ),
    [emptyMatch(event.id, "consolation", 5, 0, CONSOL_LABELS[4])],
  ];

  return {
    size,
    championship,
    consolation,
    playerLosses: 0,
    playerSide: "championship",
    playerRoundIndex: 0,
    status: "active",
  };
}

export function getPlayerMatch(bracket: TournamentBracket): BracketMatch | null {
  if (bracket.status !== "active") return null;
  const rounds =
    bracket.playerSide === "championship"
      ? bracket.championship
      : bracket.consolation;
  return rounds[bracket.playerRoundIndex]?.find(matchHasPlayer) ?? null;
}

export function getPlayerMatchOpponent(
  bracket: TournamentBracket,
): AiOpponent | null {
  const match = getPlayerMatch(bracket);
  if (!match) return null;
  const other = opponentOfPlayer(match);
  return other?.kind === "bot" ? other.opponent : null;
}

/**
 * Player finished their bout → resolve the rest of that round, advance the
 * bracket, and only then reveal the next opponent.
 * Also returns newly resolved bot-vs-bot results for league records.
 */
export function resolveAfterPlayerMatch(
  bracket: TournamentBracket,
  playerWon: boolean,
  playerLabel: string,
): ResolveAfterPlayerMatchResult {
  if (bracket.status !== "active") {
    return { bracket, botResults: [] };
  }

  const championship = cloneRounds(bracket.championship);
  const consolation = cloneRounds(bracket.consolation);
  const player: BracketEntrant = { kind: "player", label: playerLabel };
  const botResults: BotMatchResult[] = [];

  const rounds =
    bracket.playerSide === "championship" ? championship : consolation;
  const roundIndex = bracket.playerRoundIndex;
  const row = rounds[roundIndex];
  const playerMatch = row?.find(matchHasPlayer);
  if (!playerMatch) return { bracket, botResults: [] };

  const opp = opponentOfPlayer(playerMatch);
  if (!opp) return { bracket, botResults: [] };

  setMatchResult(
    playerMatch,
    playerWon ? player : opp,
    playerWon ? opp : player,
  );

  for (const match of row) {
    if (match.id === playerMatch.id) continue;
    if (matchHasPlayer(match)) continue;
    resolveBotMatch(match, botResults);
  }

  let playerLosses = bracket.playerLosses + (playerWon ? 0 : 1);
  let status: TournamentStatus = "active";
  let placement: number | undefined;
  let playerSide = bracket.playerSide;
  let playerRoundIndex = roundIndex;

  if (bracket.playerSide === "championship") {
    feedChampionshipRound(championship, consolation, roundIndex, botResults);
    cascadeBotConsolation(consolation, championship, botResults);

    if (playerWon) {
      if (roundIndex >= championship.length - 1) {
        status = "champion";
        placement = 1;
      } else {
        playerSide = "championship";
        playerRoundIndex = roundIndex + 1;
      }
    } else if (playerLosses >= 2) {
      status = "eliminated";
    } else {
      playerSide = "consolation";
      playerRoundIndex =
        findPlayerRound(consolation) ?? championshipLossFeed(roundIndex);
    }
  } else {
    feedConsolationRound(consolation, roundIndex, botResults);
    cascadeBotConsolation(consolation, championship, botResults);

    if (!playerWon || playerLosses >= 2) {
      status = "eliminated";
      playerLosses = Math.max(playerLosses, 2);
    } else if (roundIndex >= consolation.length - 1) {
      status = "placed";
      placement = 3;
    } else {
      playerSide = "consolation";
      playerRoundIndex = findPlayerRound(consolation) ?? roundIndex + 1;
    }
  }

  return {
    bracket: {
      ...bracket,
      championship,
      consolation,
      playerLosses,
      playerSide,
      playerRoundIndex,
      status,
      placement,
    },
    botResults,
  };
}

function championshipLossFeed(champRoundIndex: number): number {
  if (champRoundIndex === 0) return 0;
  if (champRoundIndex === 1) return 1;
  if (champRoundIndex === 2) return 3;
  return 4;
}

function findPlayerRound(rounds: BracketMatch[][]): number | null {
  for (let i = 0; i < rounds.length; i += 1) {
    if (rounds[i].some((m) => matchHasPlayer(m) && !m.winner)) return i;
  }
  for (let i = 0; i < rounds.length; i += 1) {
    if (rounds[i].some(matchHasPlayer)) return i;
  }
  return null;
}

function feedChampionshipRound(
  championship: BracketMatch[][],
  consolation: BracketMatch[][],
  roundIndex: number,
  botResults: BotMatchResult[],
) {
  const row = championship[roundIndex];
  const losers: BracketEntrant[] = [];

  for (const match of row) {
    if (!match.winner && match.a?.kind === "bot" && match.b?.kind === "bot") {
      resolveBotMatch(match, botResults);
    }
    if (match.winner) {
      const next = championship[roundIndex + 1]?.[Math.floor(match.index / 2)];
      if (next) {
        if (match.index % 2 === 0) next.a = match.winner;
        else next.b = match.winner;
      }
    }
    if (match.loser) losers.push(match.loser);
  }

  if (roundIndex === 0) {
    for (let i = 0; i < losers.length; i += 1) {
      const match = consolation[0][Math.floor(i / 2)];
      if (match) fillPair(match, losers[i]);
    }
  } else if (roundIndex === 1) {
    for (const m of consolation[0]) {
      if (!m.winner && !matchHasPlayer(m)) resolveBotMatch(m, botResults);
    }
    const wb1Winners = consolation[0]
      .map((m) => m.winner)
      .filter((e): e is BracketEntrant => Boolean(e));
    for (let i = 0; i < 4; i += 1) {
      const target = consolation[1][i];
      if (!target) continue;
      if (wb1Winners[i]) fillPair(target, wb1Winners[i]);
      if (losers[i]) fillPair(target, losers[i]);
    }
  } else if (roundIndex === 2) {
    for (const m of consolation[2]) {
      if (!m.winner && !matchHasPlayer(m)) resolveBotMatch(m, botResults);
    }
    const wb3Winners = consolation[2]
      .map((m) => m.winner)
      .filter((e): e is BracketEntrant => Boolean(e));
    for (let i = 0; i < 2; i += 1) {
      const target = consolation[3][i];
      if (!target) continue;
      if (wb3Winners[i]) fillPair(target, wb3Winners[i]);
      if (losers[i]) fillPair(target, losers[i]);
    }
  } else if (roundIndex === 3) {
    for (const loser of losers) {
      fillPair(consolation[4][0], loser);
    }
  }
}

function feedConsolationRound(
  consolation: BracketMatch[][],
  roundIndex: number,
  botResults: BotMatchResult[],
) {
  const row = consolation[roundIndex];
  for (const match of row) {
    if (!match.winner && !matchHasPlayer(match)) {
      resolveBotMatch(match, botResults);
    }
  }

  const winners = row
    .map((m) => m.winner)
    .filter((e): e is BracketEntrant => Boolean(e));

  if (roundIndex === 0) {
    for (let i = 0; i < winners.length; i += 1) {
      const target = consolation[1][i];
      if (target) fillPair(target, winners[i]);
    }
  } else if (roundIndex === 1) {
    for (let i = 0; i < winners.length; i += 1) {
      const target = consolation[2][Math.floor(i / 2)];
      if (target) fillPair(target, winners[i]);
    }
  } else if (roundIndex === 2) {
    for (let i = 0; i < winners.length; i += 1) {
      const target = consolation[3][i];
      if (target) fillPair(target, winners[i]);
    }
  } else if (roundIndex === 3) {
    for (const winner of winners) {
      fillPair(consolation[4][0], winner);
    }
  }
}

function cascadeBotConsolation(
  consolation: BracketMatch[][],
  championship: BracketMatch[][],
  botResults: BotMatchResult[],
) {
  for (let pass = 0; pass < 6; pass += 1) {
    let progressed = false;

    for (let r = 0; r < consolation.length; r += 1) {
      for (const match of consolation[r]) {
        if (match.winner || matchHasPlayer(match)) continue;
        if (match.a?.kind === "bot" && match.b?.kind === "bot") {
          resolveBotMatch(match, botResults);
          progressed = true;
        }
      }

      const row = consolation[r];
      const allResolved = row.every((m) => m.winner || matchHasPlayer(m));
      if (!allResolved) continue;

      if (r === 0) {
        const qfDone = championship[1]?.every((m) => m.winner);
        if (qfDone) {
          const losers = championship[1]
            .map((m) => m.loser)
            .filter((e): e is BracketEntrant => Boolean(e));
          const wb1Winners = row
            .map((m) => m.winner)
            .filter((e): e is BracketEntrant => Boolean(e));
          for (let i = 0; i < 4; i += 1) {
            const target = consolation[1][i];
            if (!target) continue;
            if (wb1Winners[i]) fillPair(target, wb1Winners[i]);
            if (losers[i]) fillPair(target, losers[i]);
          }
        } else {
          for (let i = 0; i < row.length; i += 1) {
            if (row[i].winner) fillPair(consolation[1][i], row[i].winner!);
          }
        }
      } else if (r === 1) {
        const winners = row
          .map((m) => m.winner)
          .filter((e): e is BracketEntrant => Boolean(e));
        if (winners.length === 4) {
          for (let i = 0; i < 4; i += 1) {
            fillPair(consolation[2][Math.floor(i / 2)], winners[i]);
          }
        }
      } else if (r === 2) {
        const sfDone = championship[2]?.every((m) => m.winner);
        const winners = row
          .map((m) => m.winner)
          .filter((e): e is BracketEntrant => Boolean(e));
        for (let i = 0; i < winners.length; i += 1) {
          fillPair(consolation[3][i], winners[i]);
        }
        if (sfDone) {
          const losers = championship[2]
            .map((m) => m.loser)
            .filter((e): e is BracketEntrant => Boolean(e));
          for (let i = 0; i < losers.length; i += 1) {
            fillPair(consolation[3][i], losers[i]);
          }
        }
      } else if (r === 3) {
        const winners = row
          .map((m) => m.winner)
          .filter((e): e is BracketEntrant => Boolean(e));
        for (const w of winners) fillPair(consolation[4][0], w);
      }
    }

    if (!progressed) break;
  }
}
