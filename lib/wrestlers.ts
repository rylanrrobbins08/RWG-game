import type { Wrestler } from "@/lib/game-store";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { WrestlerRow } from "@/lib/supabase/database.types";
import {
  defaultNaturalWeight,
  type WeightCutLevel,
} from "@/lib/weight-cut";
import type { Injury } from "@/lib/injury";
import { fakeRanks, isLetterGrade, isStateCode } from "@/lib/wrestler-profile";

export type SavedGame = {
  id: string;
  userId: string;
  wrestler: Wrestler;
  week: number;
  season: number;
  updatedAt: string;
};

export type SaveLoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function parseInjury(raw: WrestlerRow["injury"]): Injury | null {
  if (!raw || typeof raw !== "object") return null;
  const name = typeof raw.name === "string" ? raw.name : null;
  const weeksRemaining =
    typeof raw.weeksRemaining === "number" ? raw.weeksRemaining : null;
  if (!name || !weeksRemaining || weeksRemaining <= 0) return null;
  return {
    name,
    weeksRemaining,
    source: raw.source === "training" ? "training" : "match",
  };
}

function rowToSavedGame(row: WrestlerRow): SavedGame {
  const weightClass = row.weight_class;
  const naturalWeight =
    typeof row.natural_weight === "number"
      ? row.natural_weight
      : defaultNaturalWeight(weightClass);
  const weightCut = (row.weight_cut as WeightCutLevel | undefined) ?? "none";

  // Profile fields are local/store-first for now; cloud columns come later.
  const grade = isLetterGrade(row.grade) ? row.grade : "B";
  const studyProgress =
    typeof row.study_progress === "number" && row.study_progress >= 0
      ? Math.min(100, Math.round(row.study_progress))
      : 0;
  const hometown =
    typeof row.hometown === "string" && row.hometown.trim()
      ? row.hometown.trim()
      : "Unknown";
  const state = isStateCode(row.state) ? row.state : "IA";
  const ranks =
    typeof row.national_rank === "number" &&
    row.national_rank > 0 &&
    typeof row.state_rank === "number" &&
    row.state_rank > 0
      ? { nationalRank: row.national_rank, stateRank: row.state_rank }
      : fakeRanks({ name: row.name, state, grade, weightClass });

  return {
    id: row.id,
    userId: row.user_id,
    wrestler: {
      name: row.name,
      weightClass,
      naturalWeight,
      weightCut,
      grade,
      studyProgress,
      hometown,
      state,
      nationalRank: ranks.nationalRank,
      stateRank: ranks.stateRank,
      attributes: row.attributes,
      record: row.record,
      energy: row.energy,
      fatigue: row.fatigue,
      budget: row.budget,
      injury: parseInjury(row.injury),
    },
    week: row.week,
    season: row.season,
    updatedAt: row.updated_at,
  };
}

/** Load the logged-in user's wrestler save (if any). */
export async function loadWrestler(): Promise<SaveLoadResult<SavedGame | null>> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return { ok: false, error: authError.message };
  if (!user) return { ok: false, error: "Sign in required to load wrestler data." };

  const { data, error } = await supabase
    .from("wrestlers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, data: null };

  return { ok: true, data: rowToSavedGame(data as WrestlerRow) };
}

/** Re-export the simple saver for convenience. */
export { saveWrestler } from "@/lib/saveWrestler";
