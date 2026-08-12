import type { Wrestler } from "@/lib/game-store";
import {
  saveWrestlerToCloud,
  type CloudSaveResult,
} from "@/lib/wrestler-actions";

export type SaveWrestlerInput = {
  wrestler: Wrestler;
  week: number;
  season: number;
  id?: string | null;
};

export type SaveWrestlerResult = CloudSaveResult;

/**
 * Save the current wrestler career to the Supabase `wrestlers` table.
 * Runs as a server action so the auth cookie is used on the request.
 */
export async function saveWrestler(
  input: SaveWrestlerInput,
): Promise<SaveWrestlerResult> {
  return saveWrestlerToCloud(input);
}
