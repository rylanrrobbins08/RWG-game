import {
  getGameSnapshot,
  useGameStore,
  type ActiveTournament,
  type PlayerLeague,
} from "@/lib/game-store";
import {
  createCareerSlot,
  loadCareerSave,
  migrateLegacyCareerIfNeeded,
  persistCareerSlot,
  setActiveCareerId,
  type CareerSaveBlob,
} from "@/lib/career-slots";
import { isLeagueRoster, isFullWeightClassRoster } from "@/lib/league";
import { createDefaultLoadout } from "@/lib/moves";

export type LocalGameSave = ReturnType<typeof getGameSnapshot>;

function isActiveTournament(value: unknown): value is ActiveTournament {
  if (!value || typeof value !== "object") return false;
  const t = value as ActiveTournament;
  return (
    typeof t.eventId === "string" &&
    t.bracket != null &&
    typeof t.bracket === "object" &&
    Array.isArray(t.bracket.championship) &&
    Array.isArray(t.bracket.consolation)
  );
}

function isPlayerLeague(value: unknown): value is PlayerLeague {
  if (!value || typeof value !== "object") return false;
  const league = value as PlayerLeague;
  return (
    typeof league.id === "string" &&
    typeof league.name === "string" &&
    typeof league.code === "string"
  );
}

function parseRosterCache(
  value: unknown,
): Record<string, LocalGameSave["leagueRoster"]> {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, LocalGameSave["leagueRoster"]> = {};
  for (const [key, roster] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (isLeagueRoster(roster) && isFullWeightClassRoster(roster)) {
      next[key] = roster;
    }
  }
  return next;
}

function normalizeParsedSave(
  parsed: Partial<LocalGameSave>,
): LocalGameSave | null {
  if (!parsed?.wrestler || typeof parsed.week !== "number") return null;
  const technique = parsed.wrestler.attributes?.Technique ?? 10;
  const playerLeagues = Array.isArray(parsed.playerLeagues)
    ? parsed.playerLeagues.filter(isPlayerLeague)
    : [];
  return {
    wrestler: parsed.wrestler,
    week: parsed.week,
    season: typeof parsed.season === "number" ? parsed.season : 1,
    equippedMoves: parsed.equippedMoves ?? createDefaultLoadout(technique),
    moveLevels: parsed.moveLevels ?? {},
    hiredTrainers: parsed.hiredTrainers ?? [],
    completedEventIds: parsed.completedEventIds ?? [],
    activeTournament: isActiveTournament(parsed.activeTournament)
      ? parsed.activeTournament
      : null,
    leagueRoster: isLeagueRoster(parsed.leagueRoster)
      ? parsed.leagueRoster
      : [],
    playerLeagues,
    activeLeagueId:
      typeof parsed.activeLeagueId === "string" ? parsed.activeLeagueId : "",
    leagueRosterCache: parseRosterCache(parsed.leagueRosterCache),
    careerMode: parsed.careerMode === "coach" ? "coach" : "athlete",
  };
}

/** Parse a raw JSON string (legacy or slot) into a LocalGameSave. */
export function parseGameSaveJson(raw: string): LocalGameSave | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LocalGameSave>;
    return normalizeParsedSave(parsed);
  } catch {
    return null;
  }
}

function blobToSave(blob: CareerSaveBlob): LocalGameSave | null {
  return normalizeParsedSave(blob as Partial<LocalGameSave>);
}

/** Persist the active career slot (no-op if none selected). */
export function persistGameLocally() {
  if (typeof window === "undefined") return;
  const careerId = useGameStore.getState().activeCareerId;
  if (!careerId) return;
  try {
    persistCareerSlot(getGameSnapshot() as CareerSaveBlob, careerId);
  } catch (error) {
    console.warn("persistGameLocally:", error);
  }
}

/** Load a specific career into the store and mark it active. */
export function loadCareerIntoStore(careerId: string): boolean {
  const blob = loadCareerSave(careerId);
  if (!blob) return false;
  const save = blobToSave(blob);
  if (!save) return false;
  useGameStore.getState().hydrateFromSave(save);
  useGameStore.getState().setActiveCareer(careerId, true);
  setActiveCareerId(careerId);
  return true;
}

/**
 * After createWrestler fills the store, allocate a new slot and select it.
 * @returns career id or null if at capacity
 */
export function commitNewCareerFromStore(): string | null {
  const snapshot = getGameSnapshot();
  const id = createCareerSlot(snapshot as CareerSaveBlob);
  if (!id) return null;
  useGameStore.getState().setActiveCareer(id, true);
  return id;
}

/** Migrate legacy single-career save into multi-slot storage. */
export function prepareCareerStorage() {
  migrateLegacyCareerIfNeeded((raw) => {
    const save = parseGameSaveJson(raw);
    return save ? (save as CareerSaveBlob) : null;
  });
}
