"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  getEffectiveAttributes,
  type Attribute,
  type AttributeScores,
  type Wrestler,
  useGameStore,
} from "@/lib/game-store";
import {
  MOVE_POSITIONS,
  POSITION_LABELS,
  getMoveById,
  getMoveLevel,
  type Move,
  type MovePosition,
} from "@/lib/moves";
import { formatInjuryStatus, rollInjury, type Injury } from "@/lib/injury";
import type { AiOpponent } from "@/lib/opponents";
import type { SeasonEvent } from "@/lib/season-schedule";
import { EVENT_STYLES } from "@/lib/season-schedule";
import {
  opponentDisplayRanks,
  opponentRanksAfterMatch,
  ranksAfterMatch,
  type RankPair,
} from "@/lib/wrestler-profile";
import ArenaPage from "./ArenaPage";
import WrestlerAvatar from "./WrestlerAvatar";
import WrestlingClash from "./WrestlingClash";

type Phase = "choosing-position" | "deciding" | "complete";
type ScoreKind =
  | "takedown"
  | "escape"
  | "reversal"
  | "nearfall2"
  | "nearfall3"
  | "riding"
  | "pin";

/** Folkstyle scoring used for live and final bout totals. */
const SCORE_VALUES: Record<ScoreKind, number> = {
  takedown: 3,
  escape: 1,
  reversal: 2,
  nearfall2: 2,
  nearfall3: 3,
  riding: 1,
  pin: 0,
};

const SCORE_LABELS: Record<ScoreKind, string> = {
  takedown: "Takedown",
  escape: "Escape",
  reversal: "Reversal",
  nearfall2: "Near Fall",
  nearfall3: "Near Fall",
  riding: "Riding Time",
  pin: "Pin",
};

/** College-style clocks: 3:00 / 2:00 / 2:00 + 1:00 sudden victory. */
const PERIOD_SECONDS = [180, 120, 120] as const;
const OT_SECONDS = 60;
const REGULATION_PERIODS = 3;
const RIDING_ADVANTAGE_SECONDS = 60;
const TECH_FALL_MARGIN = 15;
const MAJOR_DECISION_MARGIN = 8;

type PositionChooser = "you" | "opponent";

type PeriodChoice = {
  period: number;
  isOvertime: boolean;
  moveId: string;
  moveName: string;
  fromPosition: MovePosition;
};

type PeriodOutcome = {
  period: number;
  isOvertime: boolean;
  moveName: string;
  outcome: string;
  /** Net points for you (+ scored / − opponent scored). */
  points: number;
  scoreKind: ScoreKind | null;
  scorer: "you" | "opponent" | null;
  power: number;
  secondsUsed: number;
  endsMatch: boolean;
};

type MatchResult = {
  won: boolean;
  yourScore: number;
  opponentScore: number;
  method: string;
  highlight: string;
  attributeGains: Partial<Record<Attribute, number>>;
  periodOutcomes: PeriodOutcome[];
  yourPower: number;
  opponentPower: number;
  injury: Injury | null;
  ridingTimeYou: number;
  ridingTimeOpp: number;
  endedBy: "decision" | "major" | "tech" | "pin" | "suddenVictory";
  yourRanksBefore: RankPair;
  yourRanksAfter: RankPair;
  opponentRanksBefore: RankPair;
  opponentRanksAfter: RankPair;
};

export type MatchSimulationProps = {
  event: SeasonEvent;
  opponent: AiOpponent;
  /** Defaults to always marking the calendar event complete. */
  shouldCompleteEvent?: (won: boolean) => boolean;
  onMatchComplete?: (won: boolean) => void;
  /** Replaces the default “event finished” calendar CTA after the bout. */
  afterMatchAction?: {
    label: string;
    onClick: () => void;
    finishedMessage?: string;
  };
};

function resolveEquippedMoves(
  loadout: Record<MovePosition, string[]>,
  position: MovePosition,
): Move[] {
  return loadout[position]
    .map((id) => getMoveById(id))
    .filter((move): move is Move => Boolean(move));
}

const OPPONENT_ACTIONS = [
  "shoots a high crotch",
  "rides tight with a wrist",
  "circles and hand-fights",
  "works for a turn",
  "scrambles for position",
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function overallRating(attrs: AttributeScores) {
  const values = Object.values(attrs);
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function formatClock(totalSeconds: number) {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Late periods drain gas harder; Conditioning softens the hit. */
function periodFatiguePenalty(
  periodNumber: number,
  conditioning: number,
  isOvertime: boolean,
) {
  const periodIndex = isOvertime ? REGULATION_PERIODS : Math.max(0, periodNumber - 1);
  const raw = periodIndex * 2.8 + (isOvertime ? 3.5 : 0);
  const mitigation = conditioning / 20;
  return raw * (1.15 - mitigation * 0.55);
}

function computePeriodPower(
  move: Move,
  you: AttributeScores,
  opponent: AttributeScores,
  energy: number,
  fatigue: number,
  period: number,
  isOvertime: boolean,
  moveLevel = 1,
) {
  const lateHit = periodFatiguePenalty(period, you.Conditioning, isOvertime);
  const oppLateHit = periodFatiguePenalty(
    period,
    opponent.Conditioning,
    isOvertime,
  );

  const yourEdge =
    you[move.primary] * 1.4 +
    you.Technique * 1.1 +
    you.Mental * 0.8 +
    energy * 0.04 -
    fatigue * 0.05 -
    lateHit +
    (moveLevel - 1) * 1.5;

  const oppEdge =
    opponent[move.primary] * 1.2 +
    opponent.Technique +
    opponent.Strength * 0.8 +
    opponent.Durability * 0.6 -
    oppLateHit * 0.85;

  const variance = ((period * 3 + move.id.length * 5) % 7) - 3;
  return yourEdge - oppEdge + variance;
}

/** Convert edge power into a 0–100 success chance for UI preview. */
function successChanceFromPower(power: number) {
  return clamp(Math.round(48 + power * 5.5), 8, 94);
}

function conditioningPct(
  cond: number,
  periodsDone: number,
  fatigue = 0,
  exchangesDone = 0,
) {
  const base = (cond / 20) * 100;
  const drain = periodsDone * 16 + exchangesDone * 3.5 + fatigue * 0.3;
  return clamp(Math.round(base - drain), 8, 100);
}

function scoreFromOutcomes(outcomes: PeriodOutcome[]) {
  let yours = 0;
  let theirs = 0;
  for (const outcome of outcomes) {
    if (outcome.points > 0) yours += outcome.points;
    if (outcome.points < 0) theirs += Math.abs(outcome.points);
  }
  return { yours, theirs };
}

function formatScoreDelta(outcome: PeriodOutcome) {
  if (outcome.scoreKind === "pin") {
    return outcome.scorer === "you" ? "PIN" : "PINNED";
  }
  if (!outcome.scoreKind || !outcome.scorer) return "0";
  const label = SCORE_LABELS[outcome.scoreKind];
  const pts = SCORE_VALUES[outcome.scoreKind];
  if (pts === 0) return label;
  if (outcome.scorer === "you") return `${label} +${pts}`;
  return `${label} −${pts}`;
}

function exchangeDuration(
  power: number,
  scoreKind: ScoreKind | null,
  clockRemaining: number,
) {
  if (scoreKind === "pin") return Math.max(8, Math.min(clockRemaining, 28));
  const base = 34 - clamp(Math.round(power), -6, 6);
  return clamp(base, 24, 50);
}

/** AI picks Neutral / Top / Bottom for their choice period. */
function aiChooseStartPosition(attrs: AttributeScores): MovePosition {
  const top = attrs.Strength * 1.2 + attrs.Technique + attrs.Conditioning;
  const bottom = attrs.Speed * 1.2 + attrs.Conditioning + attrs.Mental;
  const neutral = attrs.Speed + attrs.Technique * 1.2 + attrs.Strength;
  if (top >= bottom && top >= neutral) return "top";
  if (bottom >= neutral) return "bottom";
  return "neutral";
}

/** Map opponent's chosen start into your mat position. */
function matFromOpponentChoice(opponentWants: MovePosition): MovePosition {
  if (opponentWants === "neutral") return "neutral";
  if (opponentWants === "top") return "bottom";
  return "top";
}

function diskWinner(seed: string): PositionChooser {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2 === 0 ? "you" : "opponent";
}

/**
 * Resolve an exchange into folkstyle points:
 * TD 3 · Esc 1 · Rev 2 · Near Fall 2/3 · Pin ends the bout
 */
function resolveExchange(
  choice: PeriodChoice,
  you: AttributeScores,
  opponent: AttributeScores,
  energy: number,
  fatigue: number,
  moves: Move[],
  moveLevel = 1,
  opponentShort = "Opp",
  clockRemaining = 60,
): PeriodOutcome {
  const move = moves.find((item) => item.id === choice.moveId) ?? moves[0];
  const power = computePeriodPower(
    move,
    you,
    opponent,
    energy,
    fatigue,
    choice.period,
    choice.isOvertime,
    moveLevel,
  );

  let points = 0;
  let outcome = "";
  let scoreKind: ScoreKind | null = null;
  let scorer: "you" | "opponent" | null = null;
  let endsMatch = false;

  const award = (
    kind: ScoreKind,
    to: "you" | "opponent",
    text: string,
    end = false,
  ) => {
    scoreKind = kind;
    scorer = to;
    points = to === "you" ? SCORE_VALUES[kind] : -SCORE_VALUES[kind];
    outcome = text;
    endsMatch = end;
  };

  if (move.position === "neutral") {
    if (power >= 2.5) {
      award(
        "takedown",
        "you",
        `${move.name} finishes — takedown (${SCORE_VALUES.takedown}).`,
      );
    } else if (power <= -2.5) {
      award(
        "takedown",
        "opponent",
        `${opponentShort} beats ${move.name} — takedown (${SCORE_VALUES.takedown}).`,
      );
    } else {
      outcome = `${move.name} creates a scramble; no score.`;
    }
  } else if (move.position === "bottom") {
    if (power <= -5.5) {
      award(
        "pin",
        "opponent",
        `${opponentShort} turns and sticks you — FALL!`,
        true,
      );
    } else if (power >= 3.2) {
      award(
        "reversal",
        "you",
        `${move.name} turns it — reversal (${SCORE_VALUES.reversal}).`,
      );
    } else if (power >= 1.5) {
      award(
        "escape",
        "you",
        `${move.name} clears — escape (${SCORE_VALUES.escape}).`,
      );
    } else if (power <= -3.5) {
      outcome = `${opponentShort} rides through ${move.name}; no escape.`;
    } else {
      outcome = `${move.name} doesn't free you; still bottom.`;
    }
  } else {
    // Top — turns, near-falls, or pin; opponent can escape/reverse
    if (power >= 5.2) {
      award(
        "pin",
        "you",
        `${move.name} stacks them — FALL!`,
        true,
      );
    } else if (power >= 4) {
      award(
        "nearfall3",
        "you",
        `${move.name} turns them — near fall (${SCORE_VALUES.nearfall3}).`,
      );
    } else if (power >= 2.5) {
      award(
        "nearfall2",
        "you",
        `${move.name} exposes the back — near fall (${SCORE_VALUES.nearfall2}).`,
      );
    } else if (power <= -3) {
      award(
        "reversal",
        "opponent",
        `${opponentShort} reverses ${move.name} (${SCORE_VALUES.reversal}).`,
      );
    } else if (power <= -1.5) {
      award(
        "escape",
        "opponent",
        `${opponentShort} escapes ${move.name} (${SCORE_VALUES.escape}).`,
      );
    } else if (power >= 1.2) {
      outcome = `${move.name} keeps the ride tight; building riding time.`;
    } else {
      outcome = `Top scramble off ${move.name}; no score.`;
    }
  }

  // Sudden victory: any scoring exchange ends the bout.
  if (choice.isOvertime && scoreKind && scoreKind !== "pin" && points !== 0) {
    endsMatch = true;
    outcome = `${outcome} Sudden victory!`;
  }

  const secondsUsed = exchangeDuration(power, scoreKind, clockRemaining);

  return {
    period: choice.period,
    isOvertime: choice.isOvertime,
    moveName: move.name,
    outcome,
    points,
    scoreKind,
    scorer,
    power: Math.round(power * 10) / 10,
    secondsUsed,
    endsMatch,
  };
}

/** Advance mat position from the scoring result of the exchange. */
function nextMatPosition(
  current: MovePosition,
  outcome: PeriodOutcome,
): MovePosition {
  if (outcome.scoreKind === "pin") return current;
  if (!outcome.scoreKind || !outcome.scorer) return current;

  if (current === "neutral" && outcome.scoreKind === "takedown") {
    return outcome.scorer === "you" ? "top" : "bottom";
  }

  if (current === "bottom") {
    if (outcome.scoreKind === "escape" && outcome.scorer === "you") return "neutral";
    if (outcome.scoreKind === "reversal" && outcome.scorer === "you") return "top";
  }

  if (current === "top") {
    if (outcome.scoreKind === "escape" && outcome.scorer === "opponent") {
      return "neutral";
    }
    if (outcome.scoreKind === "reversal" && outcome.scorer === "opponent") {
      return "bottom";
    }
    // Near-fall keeps top control
  }

  return current;
}

function buildAttributeGains(
  won: boolean,
  choices: PeriodChoice[],
): Partial<Record<Attribute, number>> {
  const gains: Partial<Record<Attribute, number>> = {
    Mental: 1,
    Conditioning: 1,
  };

  if (won) {
    gains.Grades = 1;
  } else {
    gains.Durability = 1;
  }

  const movePrimaryCounts: Partial<Record<Attribute, number>> = {};

  for (const choice of choices) {
    const move = getMoveById(choice.moveId);
    if (move) {
      movePrimaryCounts[move.primary] = (movePrimaryCounts[move.primary] ?? 0) + 1;
    }
  }

  const topMoveAttr = (
    Object.entries(movePrimaryCounts) as [Attribute, number][]
  ).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topMoveAttr) {
    gains[topMoveAttr] = (gains[topMoveAttr] ?? 0) + 1;
  }

  return gains;
}

function methodFromResult(args: {
  won: boolean;
  yourScore: number;
  opponentScore: number;
  endedBy: MatchResult["endedBy"];
  tiedOnScore: boolean;
}): string {
  const { won, yourScore, opponentScore, endedBy, tiedOnScore } = args;
  if (endedBy === "pin") return won ? "Fall (Pin)" : "Pinned";
  if (endedBy === "tech") return won ? "Technical Fall" : "Technical Fall Loss";
  if (endedBy === "suddenVictory") {
    return won ? "Sudden Victory" : "Sudden Victory Loss";
  }
  if (endedBy === "major") {
    return won ? "Major Decision" : "Major Decision Loss";
  }
  if (tiedOnScore) return won ? "Criteria Decision" : "Criteria Decision Loss";
  if (yourScore === opponentScore) {
    return won ? "Criteria Decision" : "Criteria Decision Loss";
  }
  return won ? "Decision" : "Decision Loss";
}

function finalizeMatchResult(args: {
  choices: PeriodChoice[];
  outcomes: PeriodOutcome[];
  wrestler: Wrestler;
  opponent: AiOpponent;
  ridingTimeYou: number;
  ridingTimeOpp: number;
  endedBy: MatchResult["endedBy"];
  yourScore: number;
  opponentScore: number;
  yourRanksBefore: RankPair;
  yourRanksAfter: RankPair;
  opponentRanksBefore: RankPair;
  opponentRanksAfter: RankPair;
}): MatchResult {
  const {
    choices,
    outcomes,
    wrestler,
    opponent,
    ridingTimeYou,
    ridingTimeOpp,
    endedBy,
    yourScore,
    opponentScore,
    yourRanksBefore,
    yourRanksAfter,
    opponentRanksBefore,
    opponentRanksAfter,
  } = args;

  const effectiveAttrs = getEffectiveAttributes(wrestler);
  const yourPower = Math.round(overallRating(effectiveAttrs) * 10) / 10;
  const opponentPower = Math.round(overallRating(opponent.attributes) * 10) / 10;

  let won: boolean;
  if (endedBy === "pin") {
    const pinOutcome = outcomes.find((o) => o.scoreKind === "pin");
    won = pinOutcome?.scorer === "you";
  } else if (yourScore !== opponentScore) {
    won = yourScore > opponentScore;
  } else {
    won = yourPower >= opponentPower;
  }

  const attributeGains = buildAttributeGains(won, choices);
  const injury = wrestler.injury
    ? null
    : rollInjury(effectiveAttrs.Conditioning, "match");
  const oppShort = opponent.name.split(" ")[0] ?? opponent.name;
  const method = methodFromResult({
    won,
    yourScore,
    opponentScore,
    endedBy,
    tiedOnScore: yourScore === opponentScore && endedBy === "decision",
  });

  const rideNote =
    ridingTimeYou !== ridingTimeOpp
      ? ` Riding time ${formatClock(ridingTimeYou)}–${formatClock(ridingTimeOpp)}.`
      : "";

  return {
    won,
    yourScore,
    opponentScore,
    method,
    highlight: won
      ? `Final ${yourScore}–${opponentScore} · ${method}.${rideNote}`
      : `${oppShort} takes it ${opponentScore}–${yourScore} · ${method}.${rideNote}`,
    attributeGains,
    periodOutcomes: outcomes,
    yourPower,
    opponentPower,
    injury,
    ridingTimeYou,
    ridingTimeOpp,
    endedBy,
    yourRanksBefore,
    yourRanksAfter,
    opponentRanksBefore,
    opponentRanksAfter,
  };
}

function formatRankLine(before: number, after: number) {
  if (before === after) return `#${after}`;
  return `#${before} → #${after}`;
}

function periodLabel(period: number, isOvertime: boolean) {
  if (isOvertime) return "OT · Sudden Victory";
  return `Period ${period}`;
}

export default function MatchSimulation({
  event,
  opponent,
  shouldCompleteEvent,
  onMatchComplete,
  afterMatchAction,
}: MatchSimulationProps) {
  const oppShort = opponent.name.split(" ")[0] ?? opponent.name;
  const wrestler = useGameStore((state) => state.wrestler);
  const equippedMoves = useGameStore((state) => state.equippedMoves);
  const moveLevels = useGameStore((state) => state.moveLevels);
  const leagueRoster = useGameStore((state) => state.leagueRoster);
  const applyMatchResult = useGameStore((state) => state.applyMatchResult);

  const opponentRecord = useMemo(() => {
    const member = leagueRoster.find(
      (row) =>
        !row.isPlayer &&
        (row.id === opponent.id ||
          row.name.toLowerCase() === opponent.name.toLowerCase()),
    );
    return member ? `${member.wins}-${member.losses}` : opponent.record;
  }, [leagueRoster, opponent.id, opponent.name, opponent.record]);

  const [phase, setPhase] = useState<Phase>("deciding");
  const [periodIndex, setPeriodIndex] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);
  const [clock, setClock] = useState<number>(PERIOD_SECONDS[0]);
  const [matPosition, setMatPosition] = useState<MovePosition>("neutral");
  const [selectedMoveId, setSelectedMoveId] = useState<string | null>(null);
  const [choices, setChoices] = useState<PeriodChoice[]>([]);
  const [liveOutcomes, setLiveOutcomes] = useState<PeriodOutcome[]>([]);
  const [ridingYou, setRidingYou] = useState(0);
  const [ridingOpp, setRidingOpp] = useState(0);
  const [ridingAwarded, setRidingAwarded] = useState(false);
  /** Who chooses Period 2 start; the other chooses Period 3. Set after Period 1. */
  const [period2Chooser, setPeriod2Chooser] = useState<PositionChooser | null>(
    null,
  );
  const [result, setResult] = useState<MatchResult | null>(null);
  const [status, setStatus] = useState(
    `${event.title} — Period 1 starts Neutral. Multiple exchanges each period.`,
  );

  const [ranksBeforeYou] = useState<RankPair>(() => ({
    nationalRank: wrestler.nationalRank,
    stateRank: wrestler.stateRank,
  }));
  const [ranksBeforeOpp] = useState<RankPair>(() =>
    opponentDisplayRanks({
      id: opponent.id,
      name: opponent.name,
      weightClass: opponent.weightClass,
      overall: overallRating(opponent.attributes),
      tier: opponent.tier,
    }),
  );

  const effectiveAttrs = useMemo(() => getEffectiveAttributes(wrestler), [wrestler]);

  const equippedForPosition = useMemo(
    () => resolveEquippedMoves(equippedMoves, matPosition),
    [equippedMoves, matPosition],
  );

  const currentPeriod = isOvertime ? REGULATION_PERIODS : periodIndex + 1;
  const opponentAction =
    OPPONENT_ACTIONS[liveOutcomes.length % OPPONENT_ACTIONS.length];
  const selectedMove = selectedMoveId ? getMoveById(selectedMoveId) : undefined;
  const moveMatchesPosition = selectedMove?.position === matPosition;
  const canLockIn =
    phase === "deciding" &&
    selectedMoveId !== null &&
    moveMatchesPosition &&
    equippedForPosition.length > 0;
  const periodsForCond = isOvertime ? REGULATION_PERIODS : periodIndex;
  const liveScore = scoreFromOutcomes(liveOutcomes);

  const yourCondPct = conditioningPct(
    effectiveAttrs.Conditioning,
    periodsForCond + (isOvertime ? 1 : 0),
    wrestler.fatigue,
    liveOutcomes.length,
  );
  const oppCondPct = conditioningPct(
    opponent.attributes.Conditioning,
    periodsForCond + (isOvertime ? 1 : 0),
    18,
    liveOutcomes.length,
  );

  const selectedSuccessChance = useMemo(() => {
    if (!selectedMoveId || phase !== "deciding") return null;
    const move = getMoveById(selectedMoveId);
    if (!move || move.position !== matPosition) return null;
    const power = computePeriodPower(
      move,
      effectiveAttrs,
      opponent.attributes,
      wrestler.energy,
      wrestler.fatigue,
      currentPeriod,
      isOvertime,
      getMoveLevel(moveLevels, move.id),
    );
    return successChanceFromPower(power);
  }, [
    selectedMoveId,
    matPosition,
    phase,
    effectiveAttrs,
    opponent.attributes,
    wrestler.energy,
    wrestler.fatigue,
    currentPeriod,
    isOvertime,
    moveLevels,
  ]);

  const yourOverall = useMemo(
    () => Math.round(overallRating(effectiveAttrs)),
    [effectiveAttrs],
  );

  const progressPct = useMemo(() => {
    if (phase === "complete") return 100;
    if (isOvertime) return 92;
    const periodShare = ((periodIndex + (clock > 0 ? 0.5 : 1)) / REGULATION_PERIODS) * 90;
    return clamp(Math.round(periodShare), 5, 90);
  }, [phase, isOvertime, periodIndex, clock]);

  function applyRidingForExchange(
    position: MovePosition,
    seconds: number,
    youRide: number,
    oppRide: number,
  ) {
    if (position === "top") {
      return { you: youRide + seconds, opp: oppRide };
    }
    if (position === "bottom") {
      return { you: youRide, opp: oppRide + seconds };
    }
    return { you: youRide, opp: oppRide };
  }

  function maybeRidingPoint(
    youRide: number,
    oppRide: number,
    outcomes: PeriodOutcome[],
    alreadyAwarded: boolean,
  ): {
    outcomes: PeriodOutcome[];
    yourScore: number;
    opponentScore: number;
    awarded: boolean;
  } {
    const base = scoreFromOutcomes(outcomes);
    if (alreadyAwarded) {
      return {
        outcomes,
        yourScore: base.yours,
        opponentScore: base.theirs,
        awarded: true,
      };
    }

    const diff = youRide - oppRide;
    if (Math.abs(diff) < RIDING_ADVANTAGE_SECONDS) {
      return {
        outcomes,
        yourScore: base.yours,
        opponentScore: base.theirs,
        awarded: false,
      };
    }

    const youGetIt = diff >= RIDING_ADVANTAGE_SECONDS;
    const rideOutcome: PeriodOutcome = {
      period: REGULATION_PERIODS,
      isOvertime: false,
      moveName: "Riding Time",
      outcome: youGetIt
        ? `Riding time advantage (${formatClock(youRide)}–${formatClock(oppRide)}) — +1.`
        : `${oppShort} earns riding time (${formatClock(oppRide)}–${formatClock(youRide)}) — +1.`,
      points: youGetIt ? SCORE_VALUES.riding : -SCORE_VALUES.riding,
      scoreKind: "riding",
      scorer: youGetIt ? "you" : "opponent",
      power: 0,
      secondsUsed: 0,
      endsMatch: false,
    };
    const next = [...outcomes, rideOutcome];
    const score = scoreFromOutcomes(next);
    return {
      outcomes: next,
      yourScore: score.yours,
      opponentScore: score.theirs,
      awarded: true,
    };
  }

  function commitMatchEnd(args: {
    nextChoices: PeriodChoice[];
    nextOutcomes: PeriodOutcome[];
    youRide: number;
    oppRide: number;
    endedBy: MatchResult["endedBy"];
    alreadyAwardedRiding: boolean;
  }) {
    let outcomes = args.nextOutcomes;
    let endedBy = args.endedBy;
    let awarded = args.alreadyAwardedRiding;

    // Riding time point is awarded at the end of regulation (before OT / decision).
    if (endedBy === "decision" || endedBy === "major") {
      const ride = maybeRidingPoint(
        args.youRide,
        args.oppRide,
        outcomes,
        awarded,
      );
      outcomes = ride.outcomes;
      awarded = ride.awarded;
    }

    let { yours, theirs } = scoreFromOutcomes(outcomes);

    // Reclassify decision vs major after riding point.
    if (endedBy === "decision" || endedBy === "major") {
      const margin = Math.abs(yours - theirs);
      if (margin >= TECH_FALL_MARGIN) {
        endedBy = "tech";
      } else if (margin >= MAJOR_DECISION_MARGIN) {
        endedBy = "major";
      } else {
        endedBy = "decision";
      }
    }

    let won: boolean;
    if (endedBy === "pin") {
      const pinOutcome = outcomes.find((o) => o.scoreKind === "pin");
      won = pinOutcome?.scorer === "you";
    } else if (yours !== theirs) {
      won = yours > theirs;
    } else {
      won =
        overallRating(getEffectiveAttributes(wrestler)) >=
        overallRating(opponent.attributes);
    }

    const yourRanksAfter = ranksAfterMatch(
      ranksBeforeYou,
      won,
      ranksBeforeOpp.nationalRank,
      endedBy,
    );
    const opponentRanksAfter = opponentRanksAfterMatch(
      ranksBeforeOpp,
      won,
      ranksBeforeYou.nationalRank,
      endedBy,
    );

    const matchResult = finalizeMatchResult({
      choices: args.nextChoices,
      outcomes,
      wrestler,
      opponent,
      ridingTimeYou: args.youRide,
      ridingTimeOpp: args.oppRide,
      endedBy,
      yourScore: yours,
      opponentScore: theirs,
      yourRanksBefore: ranksBeforeYou,
      yourRanksAfter,
      opponentRanksBefore: ranksBeforeOpp,
      opponentRanksAfter,
    });

    const completeEvent = shouldCompleteEvent?.(matchResult.won) ?? true;
    applyMatchResult({
      won: matchResult.won,
      attributeGains: matchResult.attributeGains,
      injury: matchResult.injury ?? wrestler.injury,
      eventId: completeEvent ? event.id : undefined,
      opponent: {
        id: opponent.id,
        name: opponent.name,
        school: opponent.school,
        attributes: opponent.attributes,
      },
      ranks: yourRanksAfter,
    });

    onMatchComplete?.(matchResult.won);

    // Always show the post-match summary; parent continues only via explicit CTA.
    setLiveOutcomes(outcomes);
    setRidingAwarded(awarded);
    setResult(matchResult);
    setPhase("complete");

    const injuryNote = matchResult.injury
      ? ` Injury: ${formatInjuryStatus(matchResult.injury)}.`
      : "";

    setStatus(
      `${matchResult.won ? "Win" : "Loss"} by ${matchResult.method}. Review the summary below.${injuryNote}`,
    );
  }

  function beginPeriodWithChoice(
    nextPeriodIndex: number,
    score: { yours: number; theirs: number },
    chooser: PositionChooser,
    diskP2: PositionChooser | null,
  ) {
    setPeriodIndex(nextPeriodIndex);
    setClock(PERIOD_SECONDS[nextPeriodIndex]);
    setSelectedMoveId(null);

    const periodNumber = nextPeriodIndex + 1;
    const diskPrefix =
      nextPeriodIndex === 1 && diskP2
        ? diskP2 === "you"
          ? "You won the disk. "
          : `${oppShort} won the disk. `
        : "";

    if (chooser === "you") {
      setPhase("choosing-position");
      setStatus(
        `${diskPrefix}Period ${periodNumber} — your choice: Neutral, Top, or Bottom. Score ${score.yours}–${score.theirs}.`,
      );
      return;
    }

    const opponentWants = aiChooseStartPosition(opponent.attributes);
    const yourMat = matFromOpponentChoice(opponentWants);
    setMatPosition(yourMat);
    setPhase("deciding");
    setStatus(
      `${diskPrefix}Period ${periodNumber} — ${oppShort} chooses ${POSITION_LABELS[opponentWants]}. You start on ${POSITION_LABELS[yourMat]}. ${formatClock(PERIOD_SECONDS[nextPeriodIndex])} · ${score.yours}–${score.theirs}.`,
    );
  }

  function startNextPeriodOrOt(
    nextPeriodIndex: number,
    score: { yours: number; theirs: number },
    nextOutcomes: PeriodOutcome[],
    nextChoices: PeriodChoice[],
    youRide: number,
    oppRide: number,
    awardedRiding: boolean,
  ) {
    if (nextPeriodIndex >= REGULATION_PERIODS) {
      // End of regulation
      const ride = maybeRidingPoint(youRide, oppRide, nextOutcomes, awardedRiding);
      setRidingAwarded(ride.awarded);
      setLiveOutcomes(ride.outcomes);

      if (ride.yourScore === ride.opponentScore) {
        setIsOvertime(true);
        setPeriodIndex(REGULATION_PERIODS);
        setClock(OT_SECONDS);
        setMatPosition("neutral");
        setPhase("deciding");
        setSelectedMoveId(null);
        setStatus(
          `Tied ${ride.yourScore}–${ride.opponentScore} after regulation. Overtime — sudden victory from Neutral.`,
        );
        return;
      }

      const margin = Math.abs(ride.yourScore - ride.opponentScore);
      commitMatchEnd({
        nextChoices,
        nextOutcomes: ride.outcomes,
        youRide,
        oppRide,
        endedBy:
          margin >= TECH_FALL_MARGIN
            ? "tech"
            : margin >= MAJOR_DECISION_MARGIN
              ? "major"
              : "decision",
        alreadyAwardedRiding: true,
      });
      return;
    }

    // After Period 1, flip the disk: winner chooses P2, other chooses P3.
    let p2 = period2Chooser;
    if (nextPeriodIndex === 1 && !p2) {
      p2 = diskWinner(`${event.id}|${opponent.id}|${wrestler.name}`);
      setPeriod2Chooser(p2);
    }

    const chooser: PositionChooser =
      nextPeriodIndex === 1
        ? (p2 ?? "you")
        : p2 === "you"
          ? "opponent"
          : "you";

    beginPeriodWithChoice(nextPeriodIndex, score, chooser, p2);
  }

  function choosePeriodPosition(position: MovePosition) {
    if (phase !== "choosing-position") return;
    setMatPosition(position);
    setPhase("deciding");
    setStatus(
      `Period ${periodIndex + 1} — you start on ${POSITION_LABELS[position]}. ${formatClock(clock)} on the clock.`,
    );
  }

  function lockInExchange() {
    if (!selectedMoveId || phase !== "deciding") return;

    const move = getMoveById(selectedMoveId);
    if (!move || move.position !== matPosition) {
      setStatus(
        `Illegal choice — only ${POSITION_LABELS[matPosition]} moves while in ${POSITION_LABELS[matPosition]}.`,
      );
      setSelectedMoveId(null);
      return;
    }

    const nextChoice: PeriodChoice = {
      period: currentPeriod,
      isOvertime,
      moveId: move.id,
      moveName: move.name,
      fromPosition: matPosition,
    };
    const nextChoices = [...choices, nextChoice];
    const outcome = resolveExchange(
      nextChoice,
      effectiveAttrs,
      opponent.attributes,
      wrestler.energy,
      wrestler.fatigue,
      equippedForPosition,
      getMoveLevel(moveLevels, move.id),
      oppShort,
      clock,
    );

    const seconds = Math.min(outcome.secondsUsed, Math.max(clock, 1));
    const ride = applyRidingForExchange(matPosition, seconds, ridingYou, ridingOpp);
    setRidingYou(ride.you);
    setRidingOpp(ride.opp);

    const nextOutcomes = [...liveOutcomes, outcome];
    const nextPosition = nextMatPosition(matPosition, outcome);
    const nextClock = Math.max(0, clock - seconds);

    setChoices(nextChoices);
    setLiveOutcomes(nextOutcomes);
    setMatPosition(nextPosition);
    setSelectedMoveId(null);
    setClock(nextClock);

    const score = scoreFromOutcomes(nextOutcomes);
    const margin = Math.abs(score.yours - score.theirs);

    // Pin ends immediately
    if (outcome.scoreKind === "pin") {
      commitMatchEnd({
        nextChoices,
        nextOutcomes,
        youRide: ride.you,
        oppRide: ride.opp,
        endedBy: "pin",
        alreadyAwardedRiding: ridingAwarded,
      });
      return;
    }

    // Tech fall (15+) ends immediately
    if (margin >= TECH_FALL_MARGIN) {
      commitMatchEnd({
        nextChoices,
        nextOutcomes,
        youRide: ride.you,
        oppRide: ride.opp,
        endedBy: "tech",
        alreadyAwardedRiding: ridingAwarded,
      });
      return;
    }

    // Sudden victory score
    if (isOvertime && outcome.endsMatch) {
      commitMatchEnd({
        nextChoices,
        nextOutcomes,
        youRide: ride.you,
        oppRide: ride.opp,
        endedBy: "suddenVictory",
        alreadyAwardedRiding: ridingAwarded,
      });
      return;
    }

    // Period / OT clock expired
    if (nextClock <= 0) {
      if (isOvertime) {
        // Still tied after OT — criteria
        commitMatchEnd({
          nextChoices,
          nextOutcomes,
          youRide: ride.you,
          oppRide: ride.opp,
          endedBy: "decision",
          alreadyAwardedRiding: ridingAwarded,
        });
        return;
      }

      setStatus(
        `Period ${currentPeriod} ends. ${outcome.outcome} Score ${score.yours}–${score.theirs}.`,
      );
      startNextPeriodOrOt(
        periodIndex + 1,
        score,
        nextOutcomes,
        nextChoices,
        ride.you,
        ride.opp,
        ridingAwarded,
      );
      return;
    }

    setStatus(
      `${periodLabel(currentPeriod, isOvertime)}: ${outcome.outcome} Now ${POSITION_LABELS[nextPosition]}. ${formatClock(nextClock)} left · ${score.yours}–${score.theirs}.`,
    );
  }

  function moveChance(move: Move) {
    if (move.position !== matPosition || phase !== "deciding") {
      return null;
    }
    const power = computePeriodPower(
      move,
      effectiveAttrs,
      opponent.attributes,
      wrestler.energy,
      wrestler.fatigue,
      currentPeriod,
      isOvertime,
      getMoveLevel(moveLevels, move.id),
    );
    return successChanceFromPower(power);
  }

  const rideDiff = ridingYou - ridingOpp;
  const rideLeader =
    Math.abs(rideDiff) >= RIDING_ADVANTAGE_SECONDS
      ? rideDiff > 0
        ? "you"
        : "opp"
      : null;

  return (
    <ArenaPage wide>
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="rwg-label">
              Week Event · {EVENT_STYLES[event.type].label}
            </p>
            <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
              {event.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {event.location} · {event.detail}
            </p>
          </div>
          <p
            className="max-w-md text-sm text-muted sm:text-right"
            role="status"
          >
            {status}
          </p>
        </header>

        {phase !== "complete" ? (
          <section className="rwg-arena-board p-4 sm:p-5">
            <div className="relative z-[1] flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-[10px] uppercase tracking-[0.16em] text-accent">
                      Live Score · {periodLabel(currentPeriod, isOvertime)}
                      {!isOvertime ? ` / ${REGULATION_PERIODS}` : ""}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-muted">
                      TD {SCORE_VALUES.takedown} · Esc {SCORE_VALUES.escape} · Rev{" "}
                      {SCORE_VALUES.reversal} · NF 2/3 · RT · Pin · TF{" "}
                      {TECH_FALL_MARGIN}+
                    </p>
                    <div className="mt-2 flex items-end gap-3 sm:gap-5">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                          {wrestler.name}
                        </p>
                        <p
                          key={`you-${liveScore.yours}`}
                          className="rwg-score-live text-accent"
                        >
                          {liveScore.yours}
                        </p>
                      </div>
                      <p className="mb-2 font-display text-2xl font-semibold text-muted sm:mb-3 sm:text-3xl">
                        –
                      </p>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                          {opponent.name}
                        </p>
                        <p
                          key={`opp-${liveScore.theirs}`}
                          className="rwg-score-live"
                        >
                          {liveScore.theirs}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-right">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                        Time Remaining
                      </p>
                      <p className="font-display text-2xl font-semibold tabular-nums text-accent">
                        {formatClock(clock)}
                      </p>
                    </div>
                    <div className="sm:hidden">
                      <WrestlingClash
                        youName={wrestler.name}
                        youWeight={wrestler.weightClass}
                        opponentName={opponent.name}
                        opponentWeight={opponent.weightClass}
                        position={matPosition}
                        active={phase === "deciding"}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {MOVE_POSITIONS.map((pos) => {
                    const active = matPosition === pos;
                    return (
                      <span
                        key={pos}
                        className={`rounded-md border px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.12em] ${
                          active
                            ? "border-accent bg-accent text-background"
                            : "border-panel-border/80 bg-background/30 text-muted"
                        }`}
                      >
                        {POSITION_LABELS[pos]}
                      </span>
                    );
                  })}
                  <span className="rounded-md border border-panel-border/80 bg-background/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                    RT {formatClock(ridingYou)}–{formatClock(ridingOpp)}
                    {rideLeader === "you"
                      ? " · +1 pending"
                      : rideLeader === "opp"
                        ? " · opp +1 pending"
                        : ""}
                  </span>
                  {selectedSuccessChance !== null && (
                    <span className="ml-auto rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 font-display text-xs font-semibold tabular-nums text-accent">
                      Success {selectedSuccessChance}%
                    </span>
                  )}
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-[0.1em] text-muted">
                        Your Conditioning
                      </p>
                      <span className="font-display text-xs font-semibold tabular-nums text-foreground">
                        {yourCondPct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/40">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-500"
                        style={{ width: `${yourCondPct}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-[0.1em] text-muted">
                        {oppShort} Conditioning
                      </p>
                      <span className="font-display text-xs font-semibold tabular-nums text-foreground">
                        {oppCondPct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/40">
                      <div
                        className="h-full rounded-full bg-[#c45c4a] transition-all duration-500"
                        style={{ width: `${oppCondPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden shrink-0 flex-col items-center justify-center sm:flex">
                <WrestlingClash
                  youName={wrestler.name}
                  youWeight={wrestler.weightClass}
                  opponentName={opponent.name}
                  opponentWeight={opponent.weightClass}
                  position={matPosition}
                  active={phase === "deciding"}
                />
                <p className="mt-2 max-w-[11rem] text-center text-[11px] leading-snug text-muted">
                  {phase === "choosing-position"
                    ? "Choose starting position"
                    : phase === "deciding"
                      ? `${oppShort} ${opponentAction}`
                      : "Match complete"}
                </p>
              </div>
            </div>

            {liveOutcomes.length > 0 && (
              <ul className="relative z-[1] mt-4 flex max-h-40 flex-col gap-1 overflow-y-auto border-t border-accent/15 pt-3">
                {liveOutcomes.map((outcome, idx) => (
                  <li
                    key={`${outcome.period}-${outcome.moveName}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-muted">
                      {outcome.isOvertime
                        ? "OT"
                        : outcome.scoreKind === "riding"
                          ? "RT"
                          : `P${outcome.period}`}
                      : {outcome.moveName}
                    </span>
                    <span
                      className={`font-display font-semibold tabular-nums ${
                        outcome.points > 0 || outcome.scoreKind === "pin"
                          ? outcome.scorer === "you"
                            ? "text-accent"
                            : "text-danger"
                          : outcome.points < 0
                            ? "text-danger"
                            : "text-muted"
                      }`}
                    >
                      {formatScoreDelta(outcome)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <div className="h-1.5 overflow-hidden rounded-full bg-panel">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rwg-card flex items-center gap-3 !p-3">
            <WrestlerAvatar
              name={wrestler.name}
              weightClass={wrestler.weightClass}
              size="sm"
            />
            <div className="min-w-0">
              <p className="rwg-label">You</p>
              <p className="truncate font-display text-lg font-semibold text-foreground">
                {wrestler.name}
              </p>
              <p className="text-xs text-muted">
                {wrestler.weightClass} lbs · OVR {yourOverall} · Energy{" "}
                {wrestler.energy}%
              </p>
            </div>
          </div>
          <div className="rwg-card-accent flex items-center gap-3 !p-3 sm:flex-row-reverse sm:text-right">
            <WrestlerAvatar
              name={opponent.name}
              weightClass={opponent.weightClass}
              size="sm"
            />
            <div className="min-w-0">
              <p className="font-display text-[10px] uppercase tracking-[0.14em] text-accent">
                Opponent
              </p>
              <p className="truncate font-display text-lg font-semibold text-foreground">
                {opponent.name}
              </p>
              <p className="text-xs text-muted">
                {opponent.school} · {opponentRecord} · OVR{" "}
                {Math.round(overallRating(opponent.attributes))}
              </p>
            </div>
          </div>
        </section>

        {phase === "choosing-position" && (
          <section className="rounded-md border border-accent/40 bg-accent/10 p-5 sm:p-6">
            <p className="font-display text-xs uppercase tracking-[0.14em] text-accent">
              Period {periodIndex + 1} Starting Position
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
              Your Choice
            </h2>
            <p className="mt-2 text-sm text-muted">
              Period 1 is always Neutral. Disk winner chooses Period 2; the other
              chooses Period 3 — Neutral, Top, or Bottom. Multiple exchanges run
              on a {formatClock(PERIOD_SECONDS[periodIndex])} clock.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => choosePeriodPosition("neutral")}
                className="rounded-md border border-panel-border bg-background/50 px-4 py-5 text-left transition hover:border-accent/70"
              >
                <p className="font-display text-lg font-semibold uppercase tracking-[0.08em] text-foreground">
                  Neutral
                </p>
                <p className="mt-1 text-sm text-muted">
                  Hand-fight and shoot for takedowns.
                </p>
              </button>
              <button
                type="button"
                onClick={() => choosePeriodPosition("top")}
                className="rounded-md border border-panel-border bg-background/50 px-4 py-5 text-left transition hover:border-accent/70"
              >
                <p className="font-display text-lg font-semibold uppercase tracking-[0.08em] text-foreground">
                  Top
                </p>
                <p className="mt-1 text-sm text-muted">
                  Ride for near-fall, pin, and riding time.
                </p>
              </button>
              <button
                type="button"
                onClick={() => choosePeriodPosition("bottom")}
                className="rounded-md border border-panel-border bg-background/50 px-4 py-5 text-left transition hover:border-accent/70"
              >
                <p className="font-display text-lg font-semibold uppercase tracking-[0.08em] text-foreground">
                  Bottom
                </p>
                <p className="mt-1 text-sm text-muted">
                  Fight for escape (1) or reversal (2).
                </p>
              </button>
            </div>
          </section>
        )}

        {phase === "deciding" && (
          <>
            <section className="rounded-md border border-panel-border bg-panel/80 p-5">
              <p className="font-display text-xs uppercase tracking-[0.14em] text-muted">
                {periodLabel(currentPeriod, isOvertime)} ·{" "}
                <span className="text-accent">{POSITION_LABELS[matPosition]}</span> ·{" "}
                <span className="tabular-nums text-accent">{formatClock(clock)}</span>
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
                {isOvertime
                  ? "Sudden victory — first score wins"
                  : `${oppShort} ${opponentAction}`}
              </h2>
              <p className="mt-1 text-sm text-muted">
                You are in {POSITION_LABELS[matPosition]} — pick a{" "}
                {POSITION_LABELS[matPosition]} move. You can lock in multiple
                exchanges until the period clock runs out.
              </p>

              <div className="mt-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-xs uppercase tracking-[0.14em] text-muted">
                    {POSITION_LABELS[matPosition]} Moves
                  </p>
                  <Link
                    href="/moves"
                    className="font-display text-[10px] uppercase tracking-[0.12em] text-accent transition hover:text-accent-hover"
                  >
                    Edit loadout →
                  </Link>
                </div>

                {equippedForPosition.length === 0 ? (
                  <div className="rounded-md border border-panel-border bg-background/40 px-4 py-4 text-sm text-muted">
                    No {POSITION_LABELS[matPosition].toLowerCase()} moves equipped.{" "}
                    <Link href="/moves" className="text-accent hover:text-accent-hover">
                      Equip some on Moves
                    </Link>{" "}
                    before locking this exchange.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {equippedForPosition.map((move) => {
                      const selected = selectedMoveId === move.id;
                      const chance = moveChance(move);
                      return (
                        <button
                          key={move.id}
                          type="button"
                          onClick={() => {
                            if (move.position !== matPosition) return;
                            setSelectedMoveId(move.id);
                          }}
                          className={`rounded-md border px-4 py-3 text-left transition ${
                            selected
                              ? "border-accent bg-accent/15"
                              : "border-panel-border bg-background/40 hover:border-accent/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-display text-base font-semibold text-foreground">
                              {move.name}
                            </p>
                            {chance !== null && (
                              <span
                                className={`shrink-0 font-display text-sm font-semibold tabular-nums ${
                                  chance >= 55
                                    ? "text-accent"
                                    : chance >= 40
                                      ? "text-foreground"
                                      : "text-danger"
                                }`}
                              >
                                {chance}%
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs uppercase tracking-[0.1em] text-muted">
                            {POSITION_LABELS[move.position]} · scales with {move.primary}{" "}
                            ({effectiveAttrs[move.primary]}) · success
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={lockInExchange}
                disabled={!canLockIn}
                className="mt-5 w-full rounded-md bg-accent px-5 py-3.5 font-display text-base font-semibold uppercase tracking-[0.08em] text-background transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                Lock In Exchange
              </button>
            </section>

            {liveOutcomes.length > 0 && (
              <section className="rounded-md border border-panel-border bg-panel/60 p-4">
                <p className="font-display text-xs uppercase tracking-[0.14em] text-muted">
                  Bout Log
                </p>
                <ul className="mt-3 flex max-h-48 flex-col gap-2 overflow-y-auto">
                  {liveOutcomes.map((outcome, idx) => (
                    <li
                      key={`log-${outcome.period}-${idx}`}
                      className="border-b border-panel-border/60 pb-2 text-sm text-muted last:border-0 last:pb-0"
                    >
                      {outcome.isOvertime
                        ? "OT"
                        : outcome.scoreKind === "riding"
                          ? "RT"
                          : `P${outcome.period}`}
                      : {outcome.moveName} — {outcome.outcome}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {phase === "complete" && result && (
          <section className="rounded-md border border-panel-border bg-panel/80 p-5 sm:p-6">
            <p className="font-display text-xs uppercase tracking-[0.14em] text-muted">
              Match Summary
            </p>
            <h2
              className={`mt-1 font-display text-4xl font-semibold uppercase tracking-wide ${
                result.won ? "text-accent" : "text-danger"
              }`}
            >
              {result.won ? "Win" : "Loss"}
            </h2>
            <p className="mt-1 font-display text-xl font-semibold text-foreground">
              {result.method}
            </p>
            <p className="mt-1 text-sm text-muted">
              vs {opponent.name} ({opponent.school}) · Record now{" "}
              <span className="font-display font-semibold text-accent">
                {wrestler.record.wins}-{wrestler.record.losses}
              </span>
            </p>

            <div className="mt-5 grid grid-cols-3 items-center gap-3 rounded-md border border-panel-border bg-background/40 px-4 py-4 text-center">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted">
                  {wrestler.name}
                </p>
                <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-accent">
                  {result.yourScore}
                </p>
              </div>
              <div>
                <p className="font-display text-[10px] uppercase tracking-[0.14em] text-muted">
                  Final Score
                </p>
                <p className="mt-1 font-display text-lg text-muted">–</p>
                <p className="mt-1 font-display text-sm font-semibold text-foreground">
                  {result.method}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted">
                  {opponent.name}
                </p>
                <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-foreground">
                  {result.opponentScore}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-accent/40 bg-accent/10 px-4 py-3">
                <p className="font-display text-xs uppercase tracking-[0.14em] text-accent">
                  Your Rank
                </p>
                <p className="mt-2 text-sm text-foreground">
                  National{" "}
                  <span className="font-display font-semibold tabular-nums">
                    {formatRankLine(
                      result.yourRanksBefore.nationalRank,
                      result.yourRanksAfter.nationalRank,
                    )}
                  </span>
                </p>
                <p className="mt-1 text-sm text-foreground">
                  State{" "}
                  <span className="font-display font-semibold tabular-nums">
                    {formatRankLine(
                      result.yourRanksBefore.stateRank,
                      result.yourRanksAfter.stateRank,
                    )}
                  </span>
                </p>
              </div>
              <div className="rounded-md border border-panel-border bg-background/40 px-4 py-3">
                <p className="font-display text-xs uppercase tracking-[0.14em] text-muted">
                  {opponent.name} Rank
                </p>
                <p className="mt-2 text-sm text-foreground">
                  National{" "}
                  <span className="font-display font-semibold tabular-nums">
                    {formatRankLine(
                      result.opponentRanksBefore.nationalRank,
                      result.opponentRanksAfter.nationalRank,
                    )}
                  </span>
                </p>
                <p className="mt-1 text-sm text-foreground">
                  State{" "}
                  <span className="font-display font-semibold tabular-nums">
                    {formatRankLine(
                      result.opponentRanksBefore.stateRank,
                      result.opponentRanksAfter.stateRank,
                    )}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border border-panel-border bg-background/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                  Result Type
                </p>
                <p className="mt-0.5 font-display text-sm font-semibold text-foreground">
                  {result.endedBy === "pin"
                    ? "Fall (Pin)"
                    : result.endedBy === "tech"
                      ? "Technical Fall"
                      : result.endedBy === "suddenVictory"
                        ? "Sudden Victory"
                        : result.endedBy === "major"
                          ? "Major Decision"
                          : "Decision"}
                </p>
              </div>
              <div className="rounded-md border border-panel-border bg-background/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                  Riding Time
                </p>
                <p className="mt-0.5 font-display text-sm font-semibold tabular-nums text-foreground">
                  {formatClock(result.ridingTimeYou)}–
                  {formatClock(result.ridingTimeOpp)}
                </p>
              </div>
              <div className="rounded-md border border-panel-border bg-background/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                  Margin
                </p>
                <p className="mt-0.5 font-display text-sm font-semibold tabular-nums text-foreground">
                  {Math.abs(result.yourScore - result.opponentScore)} pts
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted">{result.highlight}</p>

            {result.injury ? (
              <p className="mt-3 rounded-md border border-[#c45c4a]/50 bg-[#c45c4a]/15 px-3 py-2 text-sm text-[#e8a090]">
                Injury sustained: {formatInjuryStatus(result.injury)}
              </p>
            ) : wrestler.injury ? (
              <p className="mt-3 rounded-md border border-[#c45c4a]/40 bg-[#c45c4a]/10 px-3 py-2 text-sm text-[#e8a090]">
                Still injured: {formatInjuryStatus(wrestler.injury)}
              </p>
            ) : null}

            <div className="mt-5">
              <p className="font-display text-xs uppercase tracking-[0.14em] text-muted">
                Key Moments
              </p>
              <ul className="mt-3 flex max-h-56 flex-col gap-2 overflow-y-auto">
                {result.periodOutcomes
                  .filter(
                    (moment) =>
                      moment.scoreKind !== null ||
                      moment.endsMatch ||
                      moment.points !== 0,
                  )
                  .map((moment, idx) => (
                    <li
                      key={`moment-${moment.period}-${idx}`}
                      className="rounded-md border border-panel-border bg-background/40 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-display text-sm font-semibold text-foreground">
                          {moment.isOvertime
                            ? "OT"
                            : moment.scoreKind === "riding"
                              ? "Riding Time"
                              : `Period ${moment.period}`}{" "}
                          · {moment.moveName}
                        </p>
                        <span
                          className={`font-display text-sm font-semibold tabular-nums ${
                            moment.scorer === "you"
                              ? "text-accent"
                              : moment.scorer === "opponent"
                                ? "text-danger"
                                : "text-muted"
                          }`}
                        >
                          {formatScoreDelta(moment)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted">{moment.outcome}</p>
                    </li>
                  ))}
                {result.periodOutcomes.every(
                  (moment) =>
                    moment.scoreKind === null &&
                    !moment.endsMatch &&
                    moment.points === 0,
                ) && (
                  <li className="rounded-md border border-panel-border bg-background/40 px-4 py-3 text-sm text-muted">
                    No scoring moments — decided on criteria.
                  </li>
                )}
              </ul>
            </div>

            <div className="mt-5 rounded-md border border-accent/40 bg-accent/10 px-4 py-3">
              <p className="font-display text-xs uppercase tracking-[0.14em] text-accent">
                Attribute Gains
              </p>
              {Object.keys(result.attributeGains).length === 0 ? (
                <p className="mt-2 text-sm text-muted">No attribute gains this bout.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(result.attributeGains).map(([attr, gain]) => (
                    <li
                      key={attr}
                      className="rounded-md border border-accent/30 bg-background/40 px-3 py-1.5 font-display text-sm font-semibold text-foreground"
                    >
                      {attr} <span className="text-accent">+{gain}</span>
                      <span className="ml-1 text-xs font-normal text-muted">
                        → {wrestler.attributes[attr as Attribute]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <details className="mt-5 rounded-md border border-panel-border bg-background/20 px-4 py-3">
              <summary className="cursor-pointer font-display text-xs uppercase tracking-[0.14em] text-muted">
                Full Bout Log
              </summary>
              <ul className="mt-3 flex max-h-48 flex-col gap-2 overflow-y-auto">
                {result.periodOutcomes.map((period, idx) => (
                  <li
                    key={`result-${period.period}-${idx}`}
                    className="border-b border-panel-border/60 pb-2 text-sm text-muted last:border-0 last:pb-0"
                  >
                    {period.isOvertime
                      ? "OT"
                      : period.scoreKind === "riding"
                        ? "RT"
                        : `P${period.period}`}
                    : {period.moveName} — {period.outcome}
                  </li>
                ))}
              </ul>
            </details>

            {afterMatchAction ? (
              <>
                <p className="mt-6 text-sm text-muted">
                  {afterMatchAction.finishedMessage ??
                    "When you are ready, continue. The next match will not start until you choose."}
                </p>
                <button
                  type="button"
                  onClick={afterMatchAction.onClick}
                  className="mt-3 block w-full rounded-md bg-accent px-5 py-3.5 text-center font-display text-sm font-semibold uppercase tracking-[0.08em] text-background transition hover:bg-accent-hover"
                >
                  {afterMatchAction.label}
                </button>
              </>
            ) : (
              <>
                <p className="mt-6 text-sm text-muted">
                  This event is finished. Advance the calendar when you are ready
                  for the next bout — nothing starts automatically.
                </p>
                <Link
                  href="/calendar"
                  className="mt-3 block w-full rounded-md bg-accent px-5 py-3.5 text-center font-display text-sm font-semibold uppercase tracking-[0.08em] text-background transition hover:bg-accent-hover"
                >
                  Back to Calendar
                </Link>
              </>
            )}
            <Link
              href="/dashboard"
              className="mt-3 block w-full rounded-md border border-panel-border bg-transparent px-5 py-3 text-center font-display text-sm font-semibold uppercase tracking-[0.08em] text-muted transition hover:border-accent/60 hover:text-foreground"
            >
              Dashboard
            </Link>
          </section>
        )}
      </ArenaPage>
  );
}
