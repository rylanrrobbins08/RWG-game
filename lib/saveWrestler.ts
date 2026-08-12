import type { Wrestler } from "@/lib/game-store";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type SaveWrestlerInput = {
  wrestler: Wrestler;
  week: number;
  season: number;
};

export type SaveWrestlerResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

/**
 * Save the current wrestler career to Supabase (`wrestlers` table).
 * Always stores `user_id` from the signed-in auth user.
 */
export async function saveWrestler(
  input: SaveWrestlerInput,
): Promise<SaveWrestlerResult> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      error:
        "Supabase is not configured. Copy .env.local.example to .env.local and add your keys.",
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return { ok: false, error: authError.message };
  if (!user) return { ok: false, error: "Sign in required to save." };

  const { error } = await supabase.from("wrestlers").upsert(
    {
      user_id: user.id,
      name: input.wrestler.name,
      weight_class: input.wrestler.weightClass,
      natural_weight: input.wrestler.naturalWeight,
      weight_cut: input.wrestler.weightCut,
      attributes: input.wrestler.attributes,
      record: input.wrestler.record,
      energy: input.wrestler.energy,
      fatigue: input.wrestler.fatigue,
      budget: input.wrestler.budget,
      week: input.week,
      season: input.season,
      injury: input.wrestler.injury,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true, userId: user.id };
}
