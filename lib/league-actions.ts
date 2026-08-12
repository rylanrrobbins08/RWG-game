"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  createWeightClassBots,
  makeLeagueCode,
  makeLeagueId,
  normalizeLeagueCode,
  type LeagueWrestler,
  type PlayerLeague,
} from "@/lib/league";
import type { AttributeScores } from "@/lib/game-store";
import type { Json } from "@/lib/supabase/database.types";

export type CloudLeague = PlayerLeague;

export type LeaguePlayerSnapshot = {
  name: string;
  weightClass: number;
  wins: number;
  losses: number;
  attributes: AttributeScores;
};

function memberKeyForUser(userId: string) {
  return `user:${userId}`;
}

function toPlayerLeague(
  row: { id: string; name: string; code: string; created_by: string | null },
  userId: string,
): CloudLeague {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    createdByPlayer: row.created_by === userId,
  };
}

function rowToWrestler(
  row: {
    member_key: string;
    user_id: string | null;
    wrestler_name: string;
    school: string;
    weight_class: number;
    wins: number;
    losses: number;
    attributes: Json;
    is_bot: boolean;
    tier: string | null;
  },
  currentUserId: string,
): LeagueWrestler {
  const isPlayer = !row.is_bot && row.user_id === currentUserId;
  const attrs =
    row.attributes && typeof row.attributes === "object"
      ? (row.attributes as LeagueWrestler["attributes"])
      : ({} as LeagueWrestler["attributes"]);
  return {
    id: isPlayer ? "league-player" : row.member_key,
    name: row.wrestler_name,
    school: row.school || (isPlayer ? "Your Room" : ""),
    wins: row.wins,
    losses: row.losses,
    attributes: attrs,
    weightClass: row.weight_class,
    tier: row.is_bot
      ? row.tier === "elite" || row.tier === "low"
        ? row.tier
        : "high"
      : undefined,
    isPlayer: isPlayer || undefined,
  };
}

async function requireUser() {
  if (!getSupabaseEnv()) {
    return { supabase: null, user: null, error: "Supabase is not configured." };
  }
  const supabase = await createClient();
  if (!supabase) {
    return { supabase: null, user: null, error: "Supabase is not configured." };
  }
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) return { supabase, user: null, error: error.message };
    if (!user) return { supabase, user: null, error: "Sign in required." };
    return { supabase, user, error: null };
  } catch (error) {
    return {
      supabase: null,
      user: null,
      error: error instanceof Error ? error.message : "Supabase is not configured.",
    };
  }
}

type SupabaseServer = NonNullable<Awaited<ReturnType<typeof createClient>>>;

async function ensureWeightClassBots(
  supabase: SupabaseServer,
  leagueId: string,
  weightClass: number,
) {
  const { data: existing } = await supabase
    .from("league_members")
    .select("member_key")
    .eq("league_id", leagueId)
    .eq("weight_class", weightClass)
    .eq("is_bot", true);

  if ((existing?.length ?? 0) >= 30) return;

  const bots = createWeightClassBots(weightClass, leagueId);
  const rows = bots.map((bot) => ({
    league_id: leagueId,
    member_key: bot.id,
    user_id: null,
    wrestler_name: bot.name,
    school: bot.school,
    weight_class: weightClass,
    wins: bot.wins,
    losses: bot.losses,
    attributes: bot.attributes as unknown as Json,
    is_bot: true,
    tier: bot.tier ?? "high",
    updated_at: new Date().toISOString(),
  }));

  await supabase.from("league_members").upsert(rows, {
    onConflict: "league_id,member_key",
    ignoreDuplicates: true,
  });
}

async function upsertPlayerMember(
  supabase: SupabaseServer,
  leagueId: string,
  userId: string,
  player: LeaguePlayerSnapshot,
) {
  const { error } = await supabase.from("league_members").upsert(
    {
      league_id: leagueId,
      member_key: memberKeyForUser(userId),
      user_id: userId,
      wrestler_name: player.name,
      school: "Your Room",
      weight_class: player.weightClass,
      wins: player.wins,
      losses: player.losses,
      attributes: player.attributes as unknown as Json,
      is_bot: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "league_id,member_key" },
  );
  return error;
}

async function loadRoster(
  supabase: SupabaseServer,
  leagueId: string,
  weightClass: number,
  userId: string,
): Promise<LeagueWrestler[]> {
  await ensureWeightClassBots(supabase, leagueId, weightClass);

  const { data, error } = await supabase
    .from("league_members")
    .select(
      "member_key, user_id, wrestler_name, school, weight_class, wins, losses, attributes, is_bot, tier",
    )
    .eq("league_id", leagueId)
    .eq("weight_class", weightClass);

  if (error || !data) return [];
  return data.map((row) => rowToWrestler(row, userId));
}

/** Browse every open league (presets + player-created). */
export async function listOpenLeagues(): Promise<
  { ok: true; leagues: CloudLeague[] } | { ok: false; error: string; leagues: CloudLeague[] }
> {
  const auth = await requireUser();
  if (!auth.user || !auth.supabase) {
    return { ok: false, error: auth.error ?? "Sign in required.", leagues: [] };
  }

  const { data, error } = await auth.supabase
    .from("leagues")
    .select("id, name, code, created_by")
    .eq("is_open", true)
    .order("created_at", { ascending: true });

  if (error) return { ok: false, error: error.message, leagues: [] };
  return {
    ok: true,
    leagues: (data ?? []).map((row) => toPlayerLeague(row, auth.user.id)),
  };
}

export async function createLeagueOnline(
  name: string,
  player: LeaguePlayerSnapshot,
): Promise<
  | { ok: true; league: CloudLeague; roster: LeagueWrestler[] }
  | { ok: false; error: string }
> {
  const trimmed = name.trim();
  if (trimmed.length < 3) {
    return { ok: false, error: "League name needs at least 3 characters." };
  }
  if (trimmed.length > 40) {
    return { ok: false, error: "League name is too long (40 max)." };
  }

  const auth = await requireUser();
  if (!auth.user || !auth.supabase) {
    return { ok: false, error: auth.error ?? "Sign in required." };
  }

  const id = makeLeagueId(trimmed);
  const code = makeLeagueCode(trimmed, id);

  const inserted = await auth.supabase
    .from("leagues")
    .insert({
      id,
      name: trimmed,
      code,
      created_by: auth.user.id,
      is_open: true,
    })
    .select("id, name, code, created_by")
    .single();

  if (inserted.error || !inserted.data) {
    return {
      ok: false,
      error: inserted.error?.message ?? "Could not create league.",
    };
  }

  const memberError = await upsertPlayerMember(
    auth.supabase,
    inserted.data.id,
    auth.user.id,
    player,
  );
  if (memberError) return { ok: false, error: memberError.message };

  const roster = await loadRoster(
    auth.supabase,
    inserted.data.id,
    player.weightClass,
    auth.user.id,
  );

  return {
    ok: true,
    league: toPlayerLeague(inserted.data, auth.user.id),
    roster,
  };
}

export async function joinLeagueOnline(
  input: { leagueId?: string; code?: string },
  player: LeaguePlayerSnapshot,
): Promise<
  | { ok: true; league: CloudLeague; roster: LeagueWrestler[] }
  | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.user || !auth.supabase) {
    return { ok: false, error: auth.error ?? "Sign in required." };
  }

  let query = auth.supabase.from("leagues").select("id, name, code, created_by");
  if (input.leagueId) {
    query = query.eq("id", input.leagueId);
  } else if (input.code) {
    query = query.eq("code", normalizeLeagueCode(input.code));
  } else {
    return { ok: false, error: "Pick an open circuit or enter a valid code." };
  }

  const { data: league, error } = await query.maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!league) {
    return {
      ok: false,
      error: input.code
        ? "No league found for that code."
        : "Pick an open circuit or enter a valid code.",
    };
  }

  const memberError = await upsertPlayerMember(
    auth.supabase,
    league.id,
    auth.user.id,
    player,
  );
  if (memberError) return { ok: false, error: memberError.message };

  const roster = await loadRoster(
    auth.supabase,
    league.id,
    player.weightClass,
    auth.user.id,
  );

  return {
    ok: true,
    league: toPlayerLeague(league, auth.user.id),
    roster,
  };
}

/** Shared standings + members for one league / weight class. */
export async function loadLeagueRosterOnline(
  leagueId: string,
  weightClass: number,
): Promise<
  | { ok: true; league: CloudLeague; roster: LeagueWrestler[] }
  | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.user || !auth.supabase) {
    return { ok: false, error: auth.error ?? "Sign in required." };
  }

  const { data: league, error } = await auth.supabase
    .from("leagues")
    .select("id, name, code, created_by")
    .eq("id", leagueId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!league) return { ok: false, error: "League not found." };

  const roster = await loadRoster(
    auth.supabase,
    league.id,
    weightClass,
    auth.user.id,
  );

  return {
    ok: true,
    league: toPlayerLeague(league, auth.user.id),
    roster,
  };
}

/** Push this player's record and bot W-L so everyone sees the same standings. */
export async function syncLeagueRosterToCloud(input: {
  leagueId: string;
  player: LeaguePlayerSnapshot;
  roster: LeagueWrestler[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.user || !auth.supabase) {
    return { ok: false, error: auth.error ?? "Sign in required." };
  }

  const memberError = await upsertPlayerMember(
    auth.supabase,
    input.leagueId,
    auth.user.id,
    input.player,
  );
  if (memberError) return { ok: false, error: memberError.message };

  const bots = input.roster.filter((member) => !member.isPlayer);
  if (bots.length > 0) {
    const rows = bots.map((bot) => ({
      league_id: input.leagueId,
      member_key: bot.id,
      user_id: null as string | null,
      wrestler_name: bot.name,
      school: bot.school,
      weight_class: input.player.weightClass,
      wins: bot.wins,
      losses: bot.losses,
      attributes: bot.attributes as unknown as Json,
      is_bot: true,
      tier: bot.tier ?? "high",
      updated_at: new Date().toISOString(),
    }));
    const { error } = await auth.supabase.from("league_members").upsert(rows, {
      onConflict: "league_id,member_key",
    });
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}
