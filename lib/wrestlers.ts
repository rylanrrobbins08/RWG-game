import type { CareerListItem } from "@/lib/career-slots";
import {
  listWrestlersFromCloud,
  saveWrestlerToCloud,
} from "@/lib/wrestler-actions";
import type { CloudWrestler } from "@/lib/supabase/wrestler-row";

export type SavedGame = CloudWrestler & { rawSave?: unknown };

export type SaveLoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function savedGameToListItem(saved: SavedGame): CareerListItem {
  return {
    id: saved.id,
    updatedAt: saved.updatedAt,
    name: saved.wrestler.name,
    weightClass: saved.wrestler.weightClass,
    hometown: saved.wrestler.hometown,
    state: saved.wrestler.state,
    record: saved.wrestler.record,
    season: saved.season,
    week: saved.week,
    careerMode: "athlete",
  };
}

/** Load every wrestler career for the signed-in user. */
export async function loadWrestlers(): Promise<SaveLoadResult<SavedGame[]>> {
  const result = await listWrestlersFromCloud();
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

/** Load one wrestler save (by career id, or the most recently updated). */
export async function loadWrestler(
  careerId?: string | null,
): Promise<SaveLoadResult<SavedGame | null>> {
  const result = await listWrestlersFromCloud();
  if (!result.ok) return { ok: false, error: result.error };
  if (result.data.length === 0) return { ok: true, data: null };
  const match = careerId
    ? result.data.find((row) => row.id === careerId) ?? null
    : result.data[0];
  return { ok: true, data: match };
}

export { saveWrestlerToCloud as saveWrestler };
