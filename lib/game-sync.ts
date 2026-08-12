import { getGameSnapshot, useGameStore } from "@/lib/game-store";
import {
  prepareCareerStorage,
  persistGameLocally,
} from "@/lib/local-save";
import { saveWrestler } from "@/lib/saveWrestler";
import { loadWrestler } from "@/lib/wrestlers";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

let canPersist = false;
let initialized = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Push current Zustand career to Supabase (no-op if logged out / unconfigured). */
export async function persistGameToSupabase() {
  if (!canPersist || !isSupabaseConfigured || !supabase) return;
  if (!useGameStore.getState().careerSelected) return;

  const result = await saveWrestler(getGameSnapshot());
  if (result.ok) {
    useGameStore.getState().setUserId(result.userId);
    return;
  }
  if (result.error !== "Sign in required to save.") {
    console.warn("persistGameToSupabase:", result.error);
  }
}

function schedulePersist() {
  if (!useGameStore.getState().careerSelected) return;

  // Always keep a local snapshot so tab switches / reloads keep tournament progress.
  persistGameLocally();

  if (!canPersist) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void persistGameToSupabase();
  }, 500);
}

/**
 * Load cloud save into the store when a user is signed in.
 * Only applies when a career is already selected (does not bypass select screen).
 * Preserves in-progress tournament from local state when cloud has none.
 * @returns `"loaded" | "empty" | "skipped"`
 */
export async function loadGameFromSupabase(): Promise<"loaded" | "empty" | "skipped"> {
  if (!isSupabaseConfigured || !supabase) return "skipped";
  if (!useGameStore.getState().careerSelected) return "skipped";

  const result = await loadWrestler();
  if (!result.ok) {
    if (result.error !== "Sign in required to load wrestler data.") {
      console.warn("loadGameFromSupabase:", result.error);
    }
    return "skipped";
  }

  if (!result.data) return "empty";

  const localTournament = useGameStore.getState().activeTournament;

  useGameStore.getState().hydrateFromSave({
    wrestler: result.data.wrestler,
    week: result.data.week,
    season: result.data.season,
    userId: result.data.userId,
    // Keep local tournament / completed events when cloud row omits them.
    activeTournament: localTournament,
  });
  return "loaded";
}

/**
 * Prepare multi-career storage and auto-save when the active career changes.
 * Does not auto-select a career — the select screen handles that.
 * Call once from the app shell.
 */
export function initGameSync() {
  if (initialized) return;
  initialized = true;

  prepareCareerStorage();

  useGameStore.subscribe((state, prev) => {
    if (!state.careerSelected) return;

    const changed =
      state.wrestler !== prev.wrestler ||
      state.week !== prev.week ||
      state.season !== prev.season ||
      state.hiredTrainers !== prev.hiredTrainers ||
      state.completedEventIds !== prev.completedEventIds ||
      state.activeTournament !== prev.activeTournament ||
      state.leagueRoster !== prev.leagueRoster ||
      state.playerLeagues !== prev.playerLeagues ||
      state.activeLeagueId !== prev.activeLeagueId ||
      state.leagueRosterCache !== prev.leagueRosterCache ||
      state.equippedMoves !== prev.equippedMoves ||
      state.moveLevels !== prev.moveLevels;

    if (changed) schedulePersist();
  });

  if (!isSupabaseConfigured || !supabase) {
    canPersist = true;
    return;
  }

  void (async () => {
    canPersist = true;
  })();

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" && useGameStore.getState().careerSelected) {
      void (async () => {
        canPersist = false;
        const status = await loadGameFromSupabase();
        canPersist = true;
        persistGameLocally();
        if (status === "empty") {
          await persistGameToSupabase();
        }
      })();
    }
  });
}

/** Flush a save immediately (e.g. right after Create Wrestler). */
export function persistGameNow() {
  if (!useGameStore.getState().careerSelected) return;
  persistGameLocally();
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  void persistGameToSupabase();
}
