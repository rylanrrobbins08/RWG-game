"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  createWeightClassBots,
  isUuid,
  makeLeagueCode,
  memberKeyForUserId,
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

const JOIN_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

function newJoinCode() {
  for (let i = 0; i < 8; i += 1) {
    const code = normalizeLeagueCode(makeLeagueCode());
    if (JOIN_CODE_PATTERN.test(code) && !isUuid(code)) return code;
  }
  return "ABC234";
}

function joinCodeFromRow(row: {
  code?: string | null;
  join_code?: string | null;
}) {
  const candidates = [row.join_code, row.code];
  for (const raw of candidates) {
    const code = normalizeLeagueCode(raw ?? "");
    if (code && !isUuid(code) && code.length >= 4 && code.length <= 8) {
      return code;
    }
  }
  return normalizeLeagueCode(row.code ?? row.join_code ?? "");
}

function toPlayerLeague(
  row: {
    id: string;
    name: string;
    code?: string | null;
    join_code?: string | null;
    created_by: string | null;
  },
  userId: string,
): CloudLeague {
  return {
    id: row.id,
    name: row.name,
    code: joinCodeFromRow(row),
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
  const isHuman = !row.is_bot && Boolean(row.user_id);
  const isPlayer = isHuman && row.user_id === currentUserId;
  const attrs =
    row.attributes && typeof row.attributes === "object"
      ? (row.attributes as LeagueWrestler["attributes"])
      : ({} as LeagueWrestler["attributes"]);
  return {
    id: isPlayer ? "league-player" : row.member_key,
    name: row.wrestler_name,
    school: row.school || (isPlayer ? "Your Room" : isHuman ? "Online player" : ""),
    wins: row.wins,
    losses: row.losses,
    attributes: attrs,
    weightClass: row.weight_class,
    userId: isHuman ? row.user_id : null,
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
  if (!isUuid(leagueId)) return;

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
    user_id: null as string | null,
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
  if (!isUuid(leagueId) || !isUuid(userId)) {
    return { message: "League id must be a UUID." };
  }
  const { error } = await supabase.from("league_members").upsert(
    {
      league_id: leagueId,
      member_key: memberKeyForUserId(userId),
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

const MEMBER_COLUMNS =
  "member_key, user_id, wrestler_name, school, weight_class, wins, losses, attributes, is_bot, tier";

async function loadRoster(
  supabase: SupabaseServer,
  leagueId: string,
  weightClass: number,
  userId: string,
): Promise<LeagueWrestler[]> {
  await ensureWeightClassBots(supabase, leagueId, weightClass);

  const humans = await supabase
    .from("league_members")
    .select(MEMBER_COLUMNS)
    .eq("league_id", leagueId)
    .eq("is_bot", false);

  const bots = await supabase
    .from("league_members")
    .select(MEMBER_COLUMNS)
    .eq("league_id", leagueId)
    .eq("weight_class", weightClass)
    .eq("is_bot", true);

  const rows = [...(humans.data ?? []), ...(bots.data ?? [])];
  return rows.map((row) => rowToWrestler(row, userId));
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
  if (!isUuid(auth.user.id)) {
    return { ok: false, error: "Sign in required." };
  }

  let lastError = "Could not create league.";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const joinCode = newJoinCode();
    const leagueId = crypto.randomUUID();
    const row = {
      id: leagueId,
      name: trimmed,
      code: joinCode,
      join_code: joinCode,
      created_by: auth.user.id,
      is_open: true,
    };

    let inserted = await auth.supabase
      .from("leagues")
      .insert(row)
      .select("id, name, code, join_code, created_by")
      .single();

    if (inserted.error && /join_code/i.test(inserted.error.message)) {
      const { join_code: _ignored, ...withoutJoinCode } = row;
      inserted = await auth.supabase
        .from("leagues")
        .insert(withoutJoinCode)
        .select("id, name, code, created_by")
        .single();
    }

    if (inserted.error && /uuid/i.test(inserted.error.message)) {
      inserted = await auth.supabase
        .from("leagues")
        .insert({
          id: leagueId,
          name: trimmed,
          join_code: joinCode,
          created_by: auth.user.id,
          is_open: true,
        })
        .select("id, name, join_code, created_by")
        .single();
    }

    if (!inserted.error && inserted.data) {
      if (!isUuid(inserted.data.id)) {
        return {
          ok: false,
          error: "League id must be a UUID. Check the leagues.id column type.",
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

    lastError = inserted.error?.message ?? lastError;
    const duplicate =
      inserted.error?.code === "23505" ||
      (inserted.error?.message ?? "").toLowerCase().includes("duplicate");
    if (!duplicate) {
      return { ok: false, error: lastError };
    }
  }

  return { ok: false, error: lastError };
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

  let league: {
    id: string;
    name: string;
    code?: string | null;
    join_code?: string | null;
    created_by: string | null;
  } | null = null;

  if (input.leagueId) {
    if (!isUuid(input.leagueId)) {
      return { ok: false, error: "League id must be a UUID." };
    }
    const found = await auth.supabase
      .from("leagues")
      .select("id, name, code, created_by")
      .eq("id", input.leagueId)
      .maybeSingle();
    if (found.error) return { ok: false, error: found.error.message };
    league = found.data;
  } else if (input.code) {
    const normalized = normalizeLeagueCode(input.code);
    if (!normalized || isUuid(normalized)) {
      return { ok: false, error: "Enter a short join code like ABC234." };
    }
    const byJoinCode = await auth.supabase
      .from("leagues")
      .select("id, name, code, join_code, created_by")
      .eq("join_code", normalized)
      .maybeSingle();
    if (!byJoinCode.error && byJoinCode.data) {
      league = byJoinCode.data;
    } else {
      const byCode = await auth.supabase
        .from("leagues")
        .select("id, name, code, created_by")
        .eq("code", normalized)
        .maybeSingle();
      if (byCode.error) return { ok: false, error: byCode.error.message };
      league = byCode.data;
    }
  } else {
    return { ok: false, error: "Pick an open circuit or enter a valid code." };
  }

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
  if (!isUuid(leagueId)) {
    return { ok: false, error: "League id must be a UUID." };
  }
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
  if (!isUuid(input.leagueId)) {
    return { ok: true };
  }
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

  const bots = input.roster.filter((member) => !member.isPlayer && !member.userId);
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

export type PvpMatchResult = {
  eventId: string;
  week: number;
  memberA: string;
  memberB: string;
  winnerKey: string;
  scoreA: number;
  scoreB: number;
  youWon: boolean;
};

function orderedMemberKeys(a: string, b: string) {
  return a < b ? ([a, b] as const) : ([b, a] as const);
}

/** Look up a completed player-vs-player dual for this event. */
export async function getPvpMatch(input: {
  leagueId: string;
  eventId: string;
  yourMemberKey: string;
  opponentMemberKey: string;
}): Promise<{ ok: true; match: PvpMatchResult | null } | { ok: false; error: string }> {
  if (!isUuid(input.leagueId)) {
    return { ok: true, match: null };
  }
  const auth = await requireUser();
  if (!auth.user || !auth.supabase) {
    return { ok: false, error: auth.error ?? "Sign in required." };
  }

  const [memberA, memberB] = orderedMemberKeys(
    input.yourMemberKey,
    input.opponentMemberKey,
  );

  const { data, error } = await auth.supabase
    .from("league_matches")
    .select("event_id, week, member_a, member_b, winner_key, score_a, score_b")
    .eq("league_id", input.leagueId)
    .eq("event_id", input.eventId)
    .eq("member_a", memberA)
    .eq("member_b", memberB)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data?.winner_key) return { ok: true, match: null };

  return {
    ok: true,
    match: {
      eventId: data.event_id,
      week: data.week,
      memberA: data.member_a,
      memberB: data.member_b,
      winnerKey: data.winner_key,
      scoreA: data.score_a ?? 0,
      scoreB: data.score_b ?? 0,
      youWon: data.winner_key === input.yourMemberKey,
    },
  };
}

/** Save a PvP dual once and update both players' shared W-L. */
export async function recordPvpMatch(input: {
  leagueId: string;
  eventId: string;
  week: number;
  yourMemberKey: string;
  opponentMemberKey: string;
  youWon: boolean;
  yourScore: number;
  opponentScore: number;
}): Promise<{ ok: true; match: PvpMatchResult } | { ok: false; error: string }> {
  if (!isUuid(input.leagueId)) {
    return { ok: false, error: "League id must be a UUID." };
  }
  const auth = await requireUser();
  if (!auth.user || !auth.supabase) {
    return { ok: false, error: auth.error ?? "Sign in required." };
  }

  const [memberA, memberB] = orderedMemberKeys(
    input.yourMemberKey,
    input.opponentMemberKey,
  );
  const winnerKey = input.youWon ? input.yourMemberKey : input.opponentMemberKey;
  const scoreA =
    memberA === input.yourMemberKey ? input.yourScore : input.opponentScore;
  const scoreB =
    memberB === input.yourMemberKey ? input.yourScore : input.opponentScore;

  const existing = await getPvpMatch({
    leagueId: input.leagueId,
    eventId: input.eventId,
    yourMemberKey: input.yourMemberKey,
    opponentMemberKey: input.opponentMemberKey,
  });
  if (!existing.ok) return existing;
  if (existing.match) return { ok: true, match: existing.match };

  const inserted = await auth.supabase.from("league_matches").insert({
    league_id: input.leagueId,
    event_id: input.eventId,
    week: input.week,
    member_a: memberA,
    member_b: memberB,
    winner_key: winnerKey,
    score_a: scoreA,
    score_b: scoreB,
    completed_at: new Date().toISOString(),
  });

  if (inserted.error) {
    const duplicate =
      inserted.error.code === "23505" ||
      inserted.error.message.toLowerCase().includes("duplicate");
    if (duplicate) {
      const again = await getPvpMatch({
        leagueId: input.leagueId,
        eventId: input.eventId,
        yourMemberKey: input.yourMemberKey,
        opponentMemberKey: input.opponentMemberKey,
      });
      if (again.ok && again.match) return { ok: true, match: again.match };
    }
    return { ok: false, error: inserted.error.message };
  }

  await bumpMemberRecord(
    auth.supabase,
    input.leagueId,
    input.yourMemberKey,
    input.youWon,
  );
  await bumpMemberRecord(
    auth.supabase,
    input.leagueId,
    input.opponentMemberKey,
    !input.youWon,
  );

  return {
    ok: true,
    match: {
      eventId: input.eventId,
      week: input.week,
      memberA,
      memberB,
      winnerKey,
      scoreA,
      scoreB,
      youWon: input.youWon,
    },
  };
}

async function bumpMemberRecord(
  supabase: SupabaseServer,
  leagueId: string,
  memberKey: string,
  won: boolean,
) {
  const { data } = await supabase
    .from("league_members")
    .select("wins, losses")
    .eq("league_id", leagueId)
    .eq("member_key", memberKey)
    .maybeSingle();
  if (!data) return;
  await supabase
    .from("league_members")
    .update({
      wins: (data.wins ?? 0) + (won ? 1 : 0),
      losses: (data.losses ?? 0) + (won ? 0 : 1),
      updated_at: new Date().toISOString(),
    })
    .eq("league_id", leagueId)
    .eq("member_key", memberKey);
}
