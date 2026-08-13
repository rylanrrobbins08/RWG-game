import { getGameSnapshot, useGameStore } from "@/lib/game-store";
import {
  persistGameLocally,
  prepareCareerStorage,
  savedGameToHydrate,
} from "@/lib/local-save";
import { saveWrestler } from "@/lib/saveWrestler";
import { loadWrestler } from "@/lib/wrestlers";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { replaceCareerId } from "@/lib/career-slots";
import { isUuid } from "@/lib/league";
import { syncLeagueRosterToCloud } from "@/lib/league-actions";

let canPersist = false;
let initialized = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Push current Zustand career to Supabase (no-op if logged out / unconfigured). */
export async function persistGameToSupabase(force = false) {
  if (!force && !canPersist) return;
  if (!useGameStore.getState().careerSelected) return;

  const result = await saveWrestler(getGameSnapshot());
  if (result.ok) {
    useGameStore.getState().setUserId(result.userId);
    const currentId = useGameStore.getState().activeCareerId;
    if (result.id && currentId && result.id !== currentId) {
      replaceCareerId(currentId, result.id);
      useGameStore.getState().setActiveCareer(result.id, true);
    }
    const snapshot = getGameSnapshot();
    if (isUuid(snapshot.activeLeagueId)) {
      void syncLeagueRosterToCloud({
        leagueId: snapshot.activeLeagueId,
        player: {
          name: snapshot.wrestler.name,
          weightClass: snapshot.wrestler.weightClass,
          wins: snapshot.wrestler.record.wins,
          losses: snapshot.wrestler.record.losses,
          attributes: snapshot.wrestler.attributes,
        },
        roster: snapshot.leagueRoster,
      });
    }
    return result;
  }
  if (result.error !== "Sign in required to save." && result.error !== "Supabase is not configured.") {
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

async function pullCloudIntoStore(careerId?: string | null) {
  canPersist = false;
  const status = await loadGameFromSupabase(careerId);
  canPersist = true;
  persistGameLocally();
  if (status === "empty") {
    await persistGameToSupabase();
  }
}

/**
 * Load cloud save into the store when a user is signed in.
 * Only applies when a career is already selected (does not bypass select screen).
 * Preserves in-progress tournament from local state when cloud has none.
 * @returns `"loaded" | "empty" | "skipped"`
 */
export async function loadGameFromSupabase(
  careerId?: string | null,
): Promise<"loaded" | "empty" | "skipped"> {
  if (!isSupabaseConfigured || !supabase) return "skipped";
  if (!useGameStore.getState().careerSelected) return "skipped";

  const id = careerId ?? useGameStore.getState().activeCareerId;
  const result = await loadWrestler(id);
  if (!result.ok) {
    if (result.error !== "Sign in required to load wrestler data.") {
      console.warn("loadGameFromSupabase:", result.error);
    }
    return "skipped";
  }

  if (!result.data) return "empty";

  const localTournament = useGameStore.getState().activeTournament;
  useGameStore.getState().hydrateFromSave(
    savedGameToHydrate(result.data, localTournament),
  );
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

  canPersist = true;

  void (async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && useGameStore.getState().careerSelected) {
      await pullCloudIntoStore();
    }
  })();

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" && useGameStore.getState().careerSelected) {
      void pullCloudIntoStore();
    }
  });
}

/** Flush a save immediately (e.g. right after Create Wrestler). */
export async function persistGameNow(): Promise<void> {
  if (!useGameStore.getState().careerSelected) return;
  persistGameLocally();
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await persistGameToSupabase(true);
}
