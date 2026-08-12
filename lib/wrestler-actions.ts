"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  attributesForCloud,
  rowToCloudWrestler,
  type CloudWrestler,
} from "@/lib/supabase/wrestler-row";
import type { Wrestler } from "@/lib/game-store";

export type CloudSaveInput = {
  id?: string | null;
  wrestler: Wrestler;
  week: number;
  season: number;
};

export type CloudSaveResult =
  | { ok: true; userId: string; id: string }
  | { ok: false; error: string };

export type CloudListResult =
  | { ok: true; data: CloudWrestler[] }
  | { ok: false; error: string; data: CloudWrestler[] };

const WRESTLER_COLUMNS =
  "id, user_id, name, weight_class, attributes, record, energy, fatigue, budget, week, season, updated_at";

function tableRow(userId: string, input: CloudSaveInput) {
  return {
    user_id: userId,
    name: input.wrestler.name,
    weight_class: input.wrestler.weightClass,
    attributes: attributesForCloud(input.wrestler),
    record: input.wrestler.record,
    energy: input.wrestler.energy,
    fatigue: input.wrestler.fatigue,
    budget: input.wrestler.budget,
    week: input.week,
    season: input.season,
    updated_at: new Date().toISOString(),
  };
}

/** Insert a wrestler row for the signed-in user. Updates if a unique row already exists. */
export async function saveWrestlerToCloud(
  input: CloudSaveInput,
): Promise<CloudSaveResult> {
  if (!getSupabaseEnv()) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  let user;
  try {
    const auth = await supabase.auth.getUser();
    if (auth.error) return { ok: false, error: auth.error.message };
    user = auth.data.user;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Supabase is not configured.",
    };
  }
  if (!user) return { ok: false, error: "Sign in required to save." };

  const row = tableRow(user.id, input);
  const insertPayload = input.id ? { ...row, id: input.id } : row;

  const inserted = await supabase
    .from("wrestlers")
    .insert(insertPayload as never)
    .select("id")
    .single();

  if (!inserted.error && inserted.data?.id) {
    return { ok: true, userId: user.id, id: inserted.data.id };
  }

  if (input.id) {
    const byId = await supabase
      .from("wrestlers")
      .update(row as never)
      .eq("id", input.id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (!byId.error && byId.data?.id) {
      return { ok: true, userId: user.id, id: byId.data.id };
    }
  }

  const byUser = await supabase
    .from("wrestlers")
    .update(row as never)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (!byUser.error && byUser.data?.id) {
    return { ok: true, userId: user.id, id: byUser.data.id };
  }

  return {
    ok: false,
    error:
      inserted.error?.message ??
      byUser.error?.message ??
      "Could not save wrestler to Supabase.",
  };
}

/** Load every wrestler row for the signed-in user. */
export async function listWrestlersFromCloud(): Promise<CloudListResult> {
  if (!getSupabaseEnv()) {
    return { ok: false, error: "Supabase is not configured.", data: [] };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured.", data: [] };
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return { ok: false, error: authError.message, data: [] };
    }
    if (!user) {
      return { ok: false, error: "Sign in required to load wrestler data.", data: [] };
    }

    const { data, error } = await supabase
      .from("wrestlers")
      .select(WRESTLER_COLUMNS)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) return { ok: false, error: error.message, data: [] };

    return {
      ok: true,
      data: (data ?? []).map((row) => rowToCloudWrestler(row)),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Supabase is not configured.",
      data: [],
    };
  }
}
