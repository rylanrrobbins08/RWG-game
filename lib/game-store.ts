import { create } from "zustand";
import {
  createDefaultLoadout,
  normalizeLoadout,
  getMoveById,
  getMoveLevel,
  costToUpgrade,
  type EquippedLoadout,
  type MoveLevel,
  type MoveLevels,
  type MovePosition,
} from "@/lib/moves";
import {
  WEIGHT_CUTS,
  defaultNaturalWeight,
  type WeightCutLevel,
} from "@/lib/weight-cut";
import { tickInjury, type Injury } from "@/lib/injury";
import {
  fakeRanks,
  getSchoolAction,
  isLetterGrade,
  isStateCode,
  nextLetterGrade,
  type LetterGrade,
  type SchoolActionId,
} from "@/lib/wrestler-profile";
import {
  MAX_ACTIVE_TRAINERS,
  getTrainerById,
} from "@/lib/trainers";
import { listBracketBots, type TournamentBracket } from "@/lib/bracket";
import {
  getCurrentWrestleEvent,
  YEAR_SCHEDULE,
} from "@/lib/season-schedule";
import {
  applyBotMatchResultsToRoster,
  applyLeagueMatchToRoster,
  createLeagueRoster,
  ensureLeagueMembers,
  findLeagueByCode,
  isFullWeightClassRoster,
  makeLeagueCode,
  makeLeagueId,
  normalizeLeagueRoster,
  OPEN_LEAGUES,
  rosterStorageKey,
  syncPlayerLeagueRecord,
  type BotMatchResult,
  type LeagueOpponentRef,
  type LeagueWrestler,
  type PlayerLeague,
} from "@/lib/league";

export type { LetterGrade, SchoolActionId } from "@/lib/wrestler-profile";
export { MAX_ACTIVE_TRAINERS, TRAINER_CATALOG } from "@/lib/trainers";
export { SCHOOL_ACTIONS, nextLetterGrade } from "@/lib/wrestler-profile";
export type { LeagueWrestler, PlayerLeague } from "@/lib/league";
export {
  LEAGUE_META,
  OPEN_LEAGUES,
  STANDINGS_DISPLAY_COUNT,
  WEIGHT_CLASS_BOT_COUNT,
  rankLeagueStandings,
  tierLabel,
  topLeagueStandings,
} from "@/lib/league";

const DEFAULT_LEAGUE = OPEN_LEAGUES[0];

function defaultPlayerLeagues(): PlayerLeague[] {
  return [{ ...DEFAULT_LEAGUE }];
}

function syncRosterPlayer(
  roster: LeagueWrestler[],
  wrestler: Wrestler,
): LeagueWrestler[] {
  return syncPlayerLeagueRecord(
    roster,
    wrestler.name,
    wrestler.record.wins,
    wrestler.record.losses,
    wrestler.attributes,
    wrestler.weightClass,
  );
}

function buildRosterForLeague(
  wrestler: Wrestler,
  leagueId: string,
  cache: Record<string, LeagueWrestler[]>,
): LeagueWrestler[] {
  const key = rosterStorageKey(leagueId, wrestler.weightClass);
  const cached = cache[key];
  if (cached && isFullWeightClassRoster(cached)) {
    return syncRosterPlayer(normalizeLeagueRoster(cached), wrestler);
  }
  return createLeagueRoster(
    wrestler.name,
    wrestler.weightClass,
    wrestler.attributes,
    leagueId,
  );
}

function withActiveRoster(
  activeLeagueId: string,
  wrestler: Wrestler,
  leagueRoster: LeagueWrestler[],
  leagueRosterCache: Record<string, LeagueWrestler[]>,
) {
  const key = rosterStorageKey(activeLeagueId, wrestler.weightClass);
  return {
    leagueRoster,
    leagueRosterCache: {
      ...leagueRosterCache,
      [key]: leagueRoster,
    },
  };
}

/** In-progress tournament so leaving Match / other tabs does not reset the bracket. */
export type ActiveTournament = {
  eventId: string;
  bracket: TournamentBracket;
  /** Shown on the bracket after returning from a bout. */
  lastResult?: {
    won: boolean;
    opponentName: string;
  } | null;
  /** Bot-vs-bot match ids already applied to league W-L (no double-count). */
  recordedMatchIds?: string[];
};

export const ATTRIBUTES = [
  "Strength",
  "Speed",
  "Technique",
  "Conditioning",
  "Durability",
  "Mental",
  "Grades",
] as const;

export type Attribute = (typeof ATTRIBUTES)[number];
export type AttributeScores = Record<Attribute, number>;

/** Short blurbs for tooltips / help text next to each attribute. */
export const ATTRIBUTE_INFO: Record<Attribute, string> = {
  Strength: "Power on shots, rides, and mat returns.",
  Speed: "Level changes, finishes, and scramble pace.",
  Technique: "Move unlocks, chains, and scoring efficiency.",
  Conditioning: "Gas tank, injury risk, and late-match edge.",
  Durability: "Ability to absorb pressure and stay in bouts.",
  Mental: "Composure, IQ, and clutch decision-making.",
  Grades:
    "Affects recruiting offers and NIL money. Higher grades unlock better colleges.",
};

export type Wrestler = {
  name: string;
  weightClass: number;
  /** Walking / non-cut body weight. */
  naturalWeight: number;
  /** Active weigh-in cut plan. */
  weightCut: WeightCutLevel;
  /** Recruiting letter grade (A–D). New careers start at B. */
  grade: LetterGrade;
  /** Progress 0–100 toward the next letter grade via school/study. */
  studyProgress: number;
  hometown: string;
  /** US state code, e.g. "IA". */
  state: string;
  /** Placeholder national ranking — replace with real system later. */
  nationalRank: number;
  /** Placeholder in-state ranking — replace with real system later. */
  stateRank: number;
  attributes: AttributeScores;
  record: { wins: number; losses: number };
  energy: number;
  fatigue: number;
  budget: number;
  /** Active injury, if any. */
  injury: Injury | null;
};

export type CreateWrestlerInput = {
  name: string;
  weightClass: number;
  attributes: AttributeScores;
  hometown: string;
  state: string;
  naturalWeight?: number;
};

const ATTR_MAX = 20;

export const defaultAttributes: AttributeScores = {
  Strength: 8,
  Speed: 7,
  Technique: 9,
  Conditioning: 6,
  Durability: 7,
  Mental: 8,
  Grades: 5,
};

const defaultWrestler: Wrestler = {
  name: "Alex Rivera",
  weightClass: 144,
  naturalWeight: defaultNaturalWeight(144),
  weightCut: "none",
  grade: "B",
  studyProgress: 0,
  hometown: "Des Moines",
  state: "IA",
  nationalRank: 212,
  stateRank: 8,
  attributes: { ...defaultAttributes },
  record: { wins: 4, losses: 1 },
  energy: 78,
  fatigue: 22,
  budget: 2400,
  injury: null,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAttributes(
  raw: AttributeScores | Record<string, number> | null | undefined,
): AttributeScores {
  const source = raw ?? {};
  const next = { ...defaultAttributes };

  for (const key of ATTRIBUTES) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      next[key] = clamp(value, 0, ATTR_MAX);
    }
  }

  // Migrate legacy Charisma saves → Grades
  const legacy = source as Record<string, number>;
  if (
    typeof legacy.Charisma === "number" &&
    Number.isFinite(legacy.Charisma) &&
    typeof source.Grades !== "number"
  ) {
    next.Grades = clamp(legacy.Charisma, 0, ATTR_MAX);
  }

  return next;
}

function normalizeWrestler(wrestler: Wrestler): Wrestler {
  const weightClass = wrestler.weightClass;
  const naturalWeight =
    typeof wrestler.naturalWeight === "number" && wrestler.naturalWeight > 0
      ? wrestler.naturalWeight
      : defaultNaturalWeight(weightClass);
  const weightCut: WeightCutLevel =
    wrestler.weightCut && wrestler.weightCut in WEIGHT_CUTS
      ? wrestler.weightCut
      : "none";

  const injury =
    wrestler.injury &&
    typeof wrestler.injury.name === "string" &&
    typeof wrestler.injury.weeksRemaining === "number" &&
    wrestler.injury.weeksRemaining > 0
      ? {
          name: wrestler.injury.name,
          weeksRemaining: wrestler.injury.weeksRemaining,
          source: wrestler.injury.source === "training" ? "training" as const : "match" as const,
        }
      : null;

  const grade: LetterGrade = isLetterGrade(wrestler.grade) ? wrestler.grade : "B";
  const studyProgress =
    typeof wrestler.studyProgress === "number" && Number.isFinite(wrestler.studyProgress)
      ? Math.max(0, Math.min(100, Math.round(wrestler.studyProgress)))
      : 0;
  const hometown =
    typeof wrestler.hometown === "string" && wrestler.hometown.trim()
      ? wrestler.hometown.trim()
      : "Unknown";
  const state = isStateCode(wrestler.state) ? wrestler.state : "IA";

  const ranks =
    typeof wrestler.nationalRank === "number" &&
    wrestler.nationalRank > 0 &&
    typeof wrestler.stateRank === "number" &&
    wrestler.stateRank > 0
      ? {
          nationalRank: wrestler.nationalRank,
          stateRank: wrestler.stateRank,
        }
      : fakeRanks({
          name: wrestler.name,
          state,
          grade,
          weightClass,
        });

  return {
    ...wrestler,
    naturalWeight,
    weightCut,
    grade,
    studyProgress,
    hometown,
    state,
    nationalRank: ranks.nationalRank,
    stateRank: ranks.stateRank,
    injury,
    attributes: normalizeAttributes(wrestler.attributes),
    record: { ...wrestler.record },
  };
}

type GameState = {
  userId: string | null;
  wrestler: Wrestler;
  week: number;
  season: number;
  equippedMoves: EquippedLoadout;
  moveLevels: MoveLevels;
  /** Hired trainer ids (max MAX_ACTIVE_TRAINERS). */
  hiredTrainers: string[];
  /** Calendar event ids already wrestled this career (no rematch). */
  completedEventIds: string[];
  /** In-progress tournament bracket (persisted locally). */
  activeTournament: ActiveTournament | null;
  /** Circuit roster with live win-loss records (active league). */
  leagueRoster: LeagueWrestler[];
  /** Leagues the player has created or joined. */
  playerLeagues: PlayerLeague[];
  /** Currently selected league id. */
  activeLeagueId: string;
  /** Per-league / weight-class roster snapshots. */
  leagueRosterCache: Record<string, LeagueWrestler[]>;
  /** Active multi-career slot id (local). */
  activeCareerId: string | null;
  /** True after the player picks or creates a career this session. */
  careerSelected: boolean;
  /** Athlete career vs post-Olympic coach stub. */
  careerMode: "athlete" | "coach";
  createWrestler: (input: CreateWrestlerInput) => void;
  setWrestler: (patch: Partial<Wrestler>) => void;
  updateAttributes: (attributes: AttributeScores) => void;
  applyAttributeGains: (gains: Partial<AttributeScores>) => void;
  applyMatchResult: (result: {
    won: boolean;
    attributeGains?: Partial<AttributeScores>;
    injury?: Injury | null;
    eventId?: string;
    /** When set, updates this opponent's league W-L as well. */
    opponent?: LeagueOpponentRef;
    /** Updated national/state ranks after the bout. */
    ranks?: { nationalRank: number; stateRank: number };
  }) => void;
  setInjury: (injury: Injury | null) => void;
  setWeightCut: (level: WeightCutLevel) => void;
  setWeek: (week: number) => void;
  advanceWeek: (maxWeek?: number) => void;
  setSeason: (season: number) => void;
  startNextSeason: () => void;
  setUserId: (userId: string | null) => void;
  setEquippedMoves: (loadout: EquippedLoadout) => void;
  setEquippedForPosition: (position: MovePosition, moveIds: string[]) => void;
  upgradeMove: (moveId: string) => { ok: true; level: MoveLevel } | { ok: false; error: string };
  hireTrainer: (trainerId: string) => { ok: true } | { ok: false; error: string };
  dismissTrainer: (trainerId: string) => void;
  /** Study / school action that fills progress toward the next letter grade. */
  performSchoolAction: (
    actionId: SchoolActionId,
  ) =>
    | { ok: true; grade: LetterGrade; studyProgress: number; upgraded: boolean }
    | { ok: false; error: string };
  retireToCoach: () => void;
  setActiveTournament: (tournament: ActiveTournament) => void;
  updateActiveTournament: (
    bracket: TournamentBracket,
    lastResult?: ActiveTournament["lastResult"],
    botResults?: BotMatchResult[],
  ) => void;
  clearActiveTournament: () => void;
  clearTournamentLastResult: () => void;
  /** Ensure the current weight class has a full 30-bot field. */
  ensureWeightClassRoster: () => void;
  createPlayerLeague: (
    name: string,
  ) => { ok: true; league: PlayerLeague } | { ok: false; error: string };
  joinLeague: (
    input: { leagueId?: string; code?: string },
  ) => { ok: true; league: PlayerLeague } | { ok: false; error: string };
  setActiveLeague: (
    leagueId: string,
  ) => { ok: true; league: PlayerLeague } | { ok: false; error: string };
  setActiveCareer: (careerId: string | null, selected: boolean) => void;
  clearCareerSelection: () => void;
  hydrateFromSave: (save: {
    wrestler: Wrestler;
    week: number;
    season: number;
    userId?: string | null;
    equippedMoves?: EquippedLoadout;
    moveLevels?: MoveLevels;
    hiredTrainers?: string[];
    completedEventIds?: string[];
    activeTournament?: ActiveTournament | null;
    leagueRoster?: LeagueWrestler[];
    playerLeagues?: PlayerLeague[];
    activeLeagueId?: string;
    leagueRosterCache?: Record<string, LeagueWrestler[]>;
    careerMode?: "athlete" | "coach";
  }) => void;
};

export const useGameStore = create<GameState>((set, get) => ({
  userId: null,
  wrestler: defaultWrestler,
  week: 3,
  season: 1,
  equippedMoves: createDefaultLoadout(defaultWrestler.attributes.Technique),
  moveLevels: {},
  hiredTrainers: [],
  completedEventIds: [],
  activeTournament: null,
  leagueRoster: createLeagueRoster(
    defaultWrestler.name,
    defaultWrestler.weightClass,
    defaultWrestler.attributes,
    DEFAULT_LEAGUE.id,
  ),
  playerLeagues: defaultPlayerLeagues(),
  activeLeagueId: DEFAULT_LEAGUE.id,
  leagueRosterCache: {},
  activeCareerId: null,
  careerSelected: false,
  careerMode: "athlete",

  createWrestler: (input) => {
    const name = input.name.trim();
    const hometown = input.hometown.trim();
    const state = input.state.trim().toUpperCase();
    const grade: LetterGrade = "B";
    const ranks = fakeRanks({
      name,
      state,
      grade,
      weightClass: input.weightClass,
    });
    const leagueId = DEFAULT_LEAGUE.id;
    const leagueRoster = createLeagueRoster(
      name,
      input.weightClass,
      input.attributes,
      leagueId,
    );

    set({
      wrestler: {
        name,
        weightClass: input.weightClass,
        naturalWeight: input.naturalWeight ?? defaultNaturalWeight(input.weightClass),
        weightCut: "none",
        grade,
        studyProgress: 0,
        hometown,
        state,
        nationalRank: ranks.nationalRank,
        stateRank: ranks.stateRank,
        attributes: normalizeAttributes(input.attributes),
        record: { wins: 0, losses: 0 },
        energy: 100,
        fatigue: 0,
        budget: 2000,
        injury: null,
      },
      week: 1,
      season: 1,
      equippedMoves: createDefaultLoadout(input.attributes.Technique),
      moveLevels: {},
      hiredTrainers: [],
      completedEventIds: [],
      activeTournament: null,
      playerLeagues: defaultPlayerLeagues(),
      activeLeagueId: leagueId,
      leagueRoster,
      leagueRosterCache: {
        [rosterStorageKey(leagueId, input.weightClass)]: leagueRoster,
      },
      careerMode: "athlete",
    });
  },

  setWrestler: (patch) =>
    set((state) => {
      const wrestler = { ...state.wrestler, ...patch };
      const weightChanged =
        patch.weightClass !== undefined &&
        patch.weightClass !== state.wrestler.weightClass;
      if (!weightChanged) return { wrestler };
      const leagueRoster = createLeagueRoster(
        wrestler.name,
        wrestler.weightClass,
        wrestler.attributes,
        state.activeLeagueId,
      );
      return {
        wrestler,
        ...withActiveRoster(
          state.activeLeagueId,
          wrestler,
          leagueRoster,
          state.leagueRosterCache,
        ),
      };
    }),

  updateAttributes: (attributes) =>
    set((state) => ({
      wrestler: { ...state.wrestler, attributes: { ...attributes } },
      equippedMoves: normalizeLoadout(state.equippedMoves, attributes.Technique),
    })),

  applyAttributeGains: (gains) =>
    set((state) => {
      const attributes = { ...state.wrestler.attributes };
      for (const key of ATTRIBUTES) {
        const gain = gains[key] ?? 0;
        if (gain !== 0) {
          attributes[key] = clamp(attributes[key] + gain, 0, ATTR_MAX);
        }
      }
      return {
        wrestler: { ...state.wrestler, attributes },
        equippedMoves: normalizeLoadout(state.equippedMoves, attributes.Technique),
      };
    }),

  applyMatchResult: ({ won, attributeGains = {}, injury, eventId, opponent, ranks }) =>
    set((state) => {
      const attributes = { ...state.wrestler.attributes };
      for (const key of ATTRIBUTES) {
        const gain = attributeGains[key] ?? 0;
        if (gain !== 0) {
          attributes[key] = clamp(attributes[key] + gain, 0, ATTR_MAX);
        }
      }

      const completedEventIds =
        eventId && !state.completedEventIds.includes(eventId)
          ? [...state.completedEventIds, eventId]
          : state.completedEventIds;

      const record = {
        wins: state.wrestler.record.wins + (won ? 1 : 0),
        losses: state.wrestler.record.losses + (won ? 0 : 1),
      };

      const rosterBase =
        state.leagueRoster.length > 0 &&
        isFullWeightClassRoster(state.leagueRoster)
          ? state.leagueRoster
          : createLeagueRoster(
              state.wrestler.name,
              state.wrestler.weightClass,
              state.wrestler.attributes,
              state.activeLeagueId,
            );

      const leagueRoster = opponent
        ? applyLeagueMatchToRoster(
            rosterBase,
            {
              name: state.wrestler.name,
              wins: record.wins,
              losses: record.losses,
              attributes: attributes,
              weightClass: state.wrestler.weightClass,
            },
            {
              ...opponent,
              attributes: opponent.attributes,
              weightClass: state.wrestler.weightClass,
            },
            won,
          )
        : syncPlayerLeagueRecord(
            rosterBase,
            state.wrestler.name,
            record.wins,
            record.losses,
            attributes,
            state.wrestler.weightClass,
          );

      return {
        wrestler: {
          ...state.wrestler,
          attributes,
          record,
          nationalRank: ranks?.nationalRank ?? state.wrestler.nationalRank,
          stateRank: ranks?.stateRank ?? state.wrestler.stateRank,
          energy: clamp(state.wrestler.energy - (won ? 12 : 18), 0, 100),
          fatigue: clamp(state.wrestler.fatigue + (won ? 8 : 14), 0, 100),
          injury:
            injury !== undefined
              ? injury
              : state.wrestler.injury,
        },
        equippedMoves: normalizeLoadout(state.equippedMoves, attributes.Technique),
        completedEventIds,
        ...withActiveRoster(
          state.activeLeagueId,
          { ...state.wrestler, attributes, record },
          leagueRoster,
          state.leagueRosterCache,
        ),
      };
    }),

  setInjury: (injury) =>
    set((state) => ({
      wrestler: { ...state.wrestler, injury },
    })),

  setWeightCut: (level) =>
    set((state) => {
      const prev = WEIGHT_CUTS[state.wrestler.weightCut];
      const next = WEIGHT_CUTS[level];
      const energyDelta = next.energy - prev.energy;
      const fatigueDelta = next.fatigue - prev.fatigue;

      return {
        wrestler: {
          ...state.wrestler,
          weightCut: level,
          energy: clamp(state.wrestler.energy + energyDelta, 0, 100),
          fatigue: clamp(state.wrestler.fatigue + fatigueDelta, 0, 100),
        },
      };
    }),

  setWeek: (week) =>
    set((state) => ({
      week,
      activeTournament: tournamentForWeek(state.activeTournament, week),
    })),

  advanceWeek: (maxWeek = 22) =>
    set((state) => {
      const pending = getCurrentWrestleEvent(state.week);
      if (pending && !state.completedEventIds.includes(pending.id)) {
        return state;
      }
      const week = clamp(state.week + 1, 1, maxWeek);
      return {
        week,
        wrestler: {
          ...state.wrestler,
          injury: tickInjury(state.wrestler.injury),
        },
        activeTournament: tournamentForWeek(state.activeTournament, week),
      };
    }),

  setSeason: (season) => set({ season }),

  startNextSeason: () =>
    set((state) => {
      const pending = getCurrentWrestleEvent(state.week);
      if (pending && !state.completedEventIds.includes(pending.id)) {
        return state;
      }
      return {
        season: state.season + 1,
        week: 1,
        activeTournament: null,
      };
    }),

  setUserId: (userId) => set({ userId }),

  setEquippedMoves: (loadout) =>
    set((state) => ({
      equippedMoves: normalizeLoadout(loadout, state.wrestler.attributes.Technique),
    })),

  setEquippedForPosition: (position, moveIds) =>
    set((state) => ({
      equippedMoves: normalizeLoadout(
        { ...state.equippedMoves, [position]: moveIds.slice(0, 4) },
        state.wrestler.attributes.Technique,
      ),
    })),

  upgradeMove: (moveId): { ok: true; level: MoveLevel } | { ok: false; error: string } => {
    let result: { ok: true; level: MoveLevel } | { ok: false; error: string } = {
      ok: false,
      error: "Upgrade failed.",
    };

    set((state) => {
      const move = getMoveById(moveId);
      if (!move) {
        result = { ok: false, error: "Unknown move." };
        return state;
      }

      const current = getMoveLevel(state.moveLevels, moveId);
      const cost = costToUpgrade(current);
      if (cost === null) {
        result = { ok: false, error: "Already at max level." };
        return state;
      }
      if (state.wrestler.budget < cost) {
        result = {
          ok: false,
          error: `Need $${cost} (have $${state.wrestler.budget}).`,
        };
        return state;
      }

      const nextLevel = (current + 1) as MoveLevel;
      result = { ok: true, level: nextLevel };

      return {
        wrestler: {
          ...state.wrestler,
          budget: state.wrestler.budget - cost,
        },
        moveLevels: {
          ...state.moveLevels,
          [moveId]: nextLevel,
        },
      };
    });

    return result;
  },

  hireTrainer: (trainerId): { ok: true } | { ok: false; error: string } => {
    let result: { ok: true } | { ok: false; error: string } = {
      ok: false,
      error: "Hire failed.",
    };

    set((state) => {
      const trainer = getTrainerById(trainerId);
      if (!trainer) {
        result = { ok: false, error: "Unknown trainer." };
        return state;
      }
      if (state.hiredTrainers.includes(trainerId)) {
        result = { ok: false, error: "Already on staff." };
        return state;
      }
      if (state.hiredTrainers.length >= MAX_ACTIVE_TRAINERS) {
        result = {
          ok: false,
          error: `Staff full (${MAX_ACTIVE_TRAINERS} max).`,
        };
        return state;
      }
      if (state.wrestler.budget < trainer.cost) {
        result = {
          ok: false,
          error: `Need $${trainer.cost} (have $${state.wrestler.budget}).`,
        };
        return state;
      }

      result = { ok: true };
      return {
        wrestler: {
          ...state.wrestler,
          budget: state.wrestler.budget - trainer.cost,
        },
        hiredTrainers: [...state.hiredTrainers, trainerId],
      };
    });

    return result;
  },

  dismissTrainer: (trainerId) =>
    set((state) => ({
      hiredTrainers: state.hiredTrainers.filter((id) => id !== trainerId),
    })),

  performSchoolAction: (actionId) => {
    let result:
      | { ok: true; grade: LetterGrade; studyProgress: number; upgraded: boolean }
      | { ok: false; error: string } = { ok: false, error: "Study failed." };

    set((state) => {
      const action = getSchoolAction(actionId);
      if (!action) {
        result = { ok: false, error: "Unknown school action." };
        return state;
      }

      const target = nextLetterGrade(state.wrestler.grade);
      if (!target) {
        result = { ok: false, error: "Already at Grade A — top of the transcript." };
        return state;
      }

      if (state.wrestler.energy < action.energy) {
        result = {
          ok: false,
          error: `Need ${action.energy}% energy (have ${state.wrestler.energy}%).`,
        };
        return state;
      }
      if (state.wrestler.budget < action.budget) {
        result = {
          ok: false,
          error: `Need $${action.budget} (have $${state.wrestler.budget}).`,
        };
        return state;
      }

      let studyProgress = state.wrestler.studyProgress + action.progress;
      let grade = state.wrestler.grade;
      let upgraded = false;
      const attributes = { ...state.wrestler.attributes };
      attributes.Grades = clamp(attributes.Grades + 1, 0, ATTR_MAX);

      if (studyProgress >= 100) {
        grade = target;
        studyProgress = 0;
        upgraded = true;
        attributes.Grades = clamp(attributes.Grades + 1, 0, ATTR_MAX);
      }

      const ranks = upgraded
        ? fakeRanks({
            name: state.wrestler.name,
            state: state.wrestler.state,
            grade,
            weightClass: state.wrestler.weightClass,
          })
        : {
            nationalRank: state.wrestler.nationalRank,
            stateRank: state.wrestler.stateRank,
          };

      result = { ok: true, grade, studyProgress, upgraded };

      return {
        wrestler: {
          ...state.wrestler,
          grade,
          studyProgress,
          attributes,
          nationalRank: ranks.nationalRank,
          stateRank: ranks.stateRank,
          energy: clamp(state.wrestler.energy - action.energy, 0, 100),
          fatigue: clamp(state.wrestler.fatigue + action.fatigue, 0, 100),
          budget: state.wrestler.budget - action.budget,
        },
        equippedMoves: normalizeLoadout(state.equippedMoves, attributes.Technique),
      };
    });

    return result;
  },

  retireToCoach: () =>
    set({
      careerMode: "coach",
    }),

  setActiveTournament: (tournament) =>
    set((state) => {
      const bots = listBracketBots(tournament.bracket);
      const rosterBase =
        state.leagueRoster.length > 0 &&
        isFullWeightClassRoster(state.leagueRoster)
          ? state.leagueRoster
          : createLeagueRoster(
              state.wrestler.name,
              state.wrestler.weightClass,
              state.wrestler.attributes,
              state.activeLeagueId,
            );
      const leagueRoster = ensureLeagueMembers(rosterBase, bots);
      return {
        activeTournament: {
          ...tournament,
          recordedMatchIds: tournament.recordedMatchIds ?? [],
        },
        ...withActiveRoster(
          state.activeLeagueId,
          state.wrestler,
          leagueRoster,
          state.leagueRosterCache,
        ),
      };
    }),

  updateActiveTournament: (bracket, lastResult, botResults = []) =>
    set((state) => {
      if (!state.activeTournament) return state;

      const already = new Set(state.activeTournament.recordedMatchIds ?? []);
      const fresh = botResults.filter((result) => !already.has(result.matchId));
      for (const result of fresh) already.add(result.matchId);

      const rosterBase =
        state.leagueRoster.length > 0 &&
        isFullWeightClassRoster(state.leagueRoster)
          ? state.leagueRoster
          : createLeagueRoster(
              state.wrestler.name,
              state.wrestler.weightClass,
              state.wrestler.attributes,
              state.activeLeagueId,
            );
      const leagueRoster = applyBotMatchResultsToRoster(rosterBase, fresh);

      return {
        activeTournament: {
          ...state.activeTournament,
          bracket,
          lastResult:
            lastResult === undefined
              ? state.activeTournament.lastResult
              : lastResult,
          recordedMatchIds: [...already],
        },
        ...withActiveRoster(
          state.activeLeagueId,
          state.wrestler,
          leagueRoster,
          state.leagueRosterCache,
        ),
      };
    }),

  clearActiveTournament: () => set({ activeTournament: null }),

  clearTournamentLastResult: () =>
    set((state) => {
      if (!state.activeTournament) return state;
      return {
        activeTournament: {
          ...state.activeTournament,
          lastResult: null,
        },
      };
    }),

  ensureWeightClassRoster: () =>
    set((state) => {
      const { wrestler, leagueRoster, activeLeagueId, leagueRosterCache } =
        state;
      const sameWeight = leagueRoster.every(
        (m) => !m.weightClass || m.weightClass === wrestler.weightClass,
      );
      if (isFullWeightClassRoster(leagueRoster) && sameWeight) {
        const synced = syncRosterPlayer(leagueRoster, wrestler);
        return withActiveRoster(
          activeLeagueId,
          wrestler,
          synced,
          leagueRosterCache,
        );
      }
      const next = buildRosterForLeague(
        wrestler,
        activeLeagueId,
        leagueRosterCache,
      );
      return withActiveRoster(activeLeagueId, wrestler, next, leagueRosterCache);
    }),

  createPlayerLeague: (name) => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      return { ok: false, error: "League name needs at least 3 characters." };
    }
    if (trimmed.length > 40) {
      return { ok: false, error: "League name is too long (40 max)." };
    }

    const state = get();
    const id = makeLeagueId(trimmed);
    const code = makeLeagueCode(trimmed, id);
    const league: PlayerLeague = {
      id,
      name: trimmed,
      code,
      createdByPlayer: true,
    };
    const leagueRoster = createLeagueRoster(
      state.wrestler.name,
      state.wrestler.weightClass,
      state.wrestler.attributes,
      id,
    );
    // Cache the outgoing active roster before switching.
    const prevKey = rosterStorageKey(
      state.activeLeagueId,
      state.wrestler.weightClass,
    );
    const cache = {
      ...state.leagueRosterCache,
      [prevKey]: state.leagueRoster,
      [rosterStorageKey(id, state.wrestler.weightClass)]: leagueRoster,
    };

    set({
      playerLeagues: [...state.playerLeagues, league],
      activeLeagueId: id,
      leagueRoster,
      leagueRosterCache: cache,
    });
    return { ok: true, league };
  },

  joinLeague: ({ leagueId, code }) => {
    const state = get();
    let target: PlayerLeague | null = null;

    if (leagueId) {
      target =
        OPEN_LEAGUES.find((league) => league.id === leagueId) ??
        state.playerLeagues.find((league) => league.id === leagueId) ??
        null;
    } else if (code) {
      target = findLeagueByCode(code, state.playerLeagues);
    }

    if (!target) {
      return {
        ok: false,
        error: code
          ? "No league found for that code."
          : "Pick an open circuit or enter a valid code.",
      };
    }

    const alreadyMember = state.playerLeagues.some(
      (league) => league.id === target!.id,
    );
    const playerLeagues = alreadyMember
      ? state.playerLeagues
      : [...state.playerLeagues, { ...target }];

    const prevKey = rosterStorageKey(
      state.activeLeagueId,
      state.wrestler.weightClass,
    );
    const cacheWithCurrent = {
      ...state.leagueRosterCache,
      [prevKey]: state.leagueRoster,
    };
    const leagueRoster = buildRosterForLeague(
      state.wrestler,
      target.id,
      cacheWithCurrent,
    );

    set({
      playerLeagues,
      activeLeagueId: target.id,
      ...withActiveRoster(
        target.id,
        state.wrestler,
        leagueRoster,
        cacheWithCurrent,
      ),
    });
    return { ok: true, league: target };
  },

  setActiveLeague: (leagueId) => {
    const state = get();
    const league = state.playerLeagues.find((item) => item.id === leagueId);
    if (!league) {
      return { ok: false, error: "You're not in that league." };
    }
    if (league.id === state.activeLeagueId) {
      return { ok: true, league };
    }

    const prevKey = rosterStorageKey(
      state.activeLeagueId,
      state.wrestler.weightClass,
    );
    const cacheWithCurrent = {
      ...state.leagueRosterCache,
      [prevKey]: state.leagueRoster,
    };
    const leagueRoster = buildRosterForLeague(
      state.wrestler,
      league.id,
      cacheWithCurrent,
    );

    set({
      activeLeagueId: league.id,
      ...withActiveRoster(
        league.id,
        state.wrestler,
        leagueRoster,
        cacheWithCurrent,
      ),
    });
    return { ok: true, league };
  },

  setActiveCareer: (careerId, selected) =>
    set({
      activeCareerId: careerId,
      careerSelected: selected,
    }),

  clearCareerSelection: () =>
    set({
      careerSelected: false,
    }),

  hydrateFromSave: (save) =>
    set((state) => {
      const wrestler = normalizeWrestler(save.wrestler);
      const hiredTrainers = (save.hiredTrainers ?? state.hiredTrainers)
        .filter((id) => Boolean(getTrainerById(id)))
        .slice(0, MAX_ACTIVE_TRAINERS);

      const playerLeagues =
        Array.isArray(save.playerLeagues) && save.playerLeagues.length > 0
          ? normalizePlayerLeagues(save.playerLeagues)
          : state.playerLeagues.length > 0
            ? state.playerLeagues
            : defaultPlayerLeagues();

      const activeLeagueId =
        (save.activeLeagueId &&
          playerLeagues.some((league) => league.id === save.activeLeagueId) &&
          save.activeLeagueId) ||
        playerLeagues[0]?.id ||
        DEFAULT_LEAGUE.id;

      const leagueRosterCache = normalizeRosterCache(
        save.leagueRosterCache ?? state.leagueRosterCache,
      );

      const rawRoster = save.leagueRoster ?? state.leagueRoster;
      const usable =
        isLeagueRosterLike(rawRoster) &&
        isFullWeightClassRoster(rawRoster as LeagueWrestler[]) &&
        (rawRoster as LeagueWrestler[]).some(
          (m) => m.isPlayer || m.weightClass === wrestler.weightClass,
        )
          ? normalizeLeagueRoster(rawRoster as LeagueWrestler[])
          : buildRosterForLeague(wrestler, activeLeagueId, leagueRosterCache);

      const leagueRoster = syncRosterPlayer(usable, wrestler);
      const key = rosterStorageKey(activeLeagueId, wrestler.weightClass);

      return {
        userId: save.userId ?? null,
        wrestler,
        week: save.week,
        season: save.season,
        equippedMoves: normalizeLoadout(
          save.equippedMoves ?? state.equippedMoves,
          wrestler.attributes.Technique,
        ),
        moveLevels: save.moveLevels ?? state.moveLevels,
        hiredTrainers,
        completedEventIds: save.completedEventIds ?? state.completedEventIds,
        activeTournament:
          save.activeTournament !== undefined
            ? save.activeTournament
            : state.activeTournament,
        playerLeagues,
        activeLeagueId,
        leagueRoster,
        leagueRosterCache: {
          ...leagueRosterCache,
          [key]: leagueRoster,
        },
        careerMode: save.careerMode ?? state.careerMode,
      };
    }),
}));

function isLeagueRosterLike(value: unknown): value is LeagueWrestler[] {
  return Array.isArray(value) && value.length > 0;
}

function normalizePlayerLeagues(raw: PlayerLeague[]): PlayerLeague[] {
  const seen = new Set<string>();
  const leagues: PlayerLeague[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    if (typeof item.id !== "string" || typeof item.name !== "string") continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    leagues.push({
      id: item.id,
      name: item.name,
      code:
        typeof item.code === "string" && item.code
          ? item.code
          : makeLeagueCode(item.name, item.id),
      createdByPlayer: Boolean(item.createdByPlayer),
    });
  }
  if (leagues.length === 0) return defaultPlayerLeagues();
  return leagues;
}

function normalizeRosterCache(
  raw: Record<string, LeagueWrestler[]>,
): Record<string, LeagueWrestler[]> {
  if (!raw || typeof raw !== "object") return {};
  const next: Record<string, LeagueWrestler[]> = {};
  for (const [key, roster] of Object.entries(raw)) {
    if (isLeagueRosterLike(roster) && isFullWeightClassRoster(roster)) {
      next[key] = normalizeLeagueRoster(roster);
    }
  }
  return next;
}

function tournamentForWeek(
  active: ActiveTournament | null,
  week: number,
): ActiveTournament | null {
  if (!active) return null;
  const event = YEAR_SCHEDULE.find((item) => item.id === active.eventId);
  if (!event || event.week !== week) return null;
  return active;
}

/** Snapshot used by Supabase save helpers and local export. */
export function getGameSnapshot() {
  const {
    wrestler,
    week,
    season,
    equippedMoves,
    moveLevels,
    hiredTrainers,
    completedEventIds,
    activeTournament,
    leagueRoster,
    playerLeagues,
    activeLeagueId,
    leagueRosterCache,
    careerMode,
  } = useGameStore.getState();
  return {
    wrestler,
    week,
    season,
    equippedMoves,
    moveLevels,
    hiredTrainers,
    completedEventIds,
    activeTournament,
    leagueRoster,
    playerLeagues,
    activeLeagueId,
    leagueRosterCache,
    careerMode,
  };
}

/** Base attributes with active weight-cut modifiers applied. */
export function getEffectiveAttributes(
  wrestler: Wrestler = useGameStore.getState().wrestler,
): AttributeScores {
  const cut = WEIGHT_CUTS[wrestler.weightCut];
  const next = { ...wrestler.attributes };
  for (const attr of ATTRIBUTES) {
    const delta = cut.attributes[attr] ?? 0;
    next[attr] = clamp(next[attr] + delta, 0, ATTR_MAX);
  }
  return next;
}
