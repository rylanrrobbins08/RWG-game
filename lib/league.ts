/** League roster + standings helpers (live W-L records per weight class). */

export const LEAGUE_ATTR_KEYS = [
  "Strength",
  "Speed",
  "Technique",
  "Conditioning",
  "Durability",
  "Mental",
  "Grades",
] as const;

export type LeagueAttribute = (typeof LEAGUE_ATTR_KEYS)[number];
export type LeagueAttributeScores = Record<LeagueAttribute, number>;

/** Bots in each weight-class field (player is separate). */
export const WEIGHT_CLASS_BOT_COUNT = 30;
/** Standings table shows only the top N. */
export const STANDINGS_DISPLAY_COUNT = 15;

export type BotTier = "elite" | "high" | "low";

export type LeagueWrestler = {
  id: string;
  name: string;
  school: string;
  wins: number;
  losses: number;
  attributes: LeagueAttributeScores;
  weightClass: number;
  tier?: BotTier;
  isPlayer?: boolean;
  /** Auth user id when this row is a real player (you or a friend). */
  userId?: string | null;
};

export type LeagueStanding = LeagueWrestler & {
  rank: number;
};

export type LeagueOpponentRef = {
  id: string;
  name: string;
  school?: string;
  attributes?: LeagueAttributeScores;
  weightClass?: number;
  tier?: BotTier;
  userId?: string | null;
};

const FIRST_NAMES = [
  "Marcus", "Diego", "Kai", "Noah", "Ethan", "Jamal", "Cole", "Ryder",
  "Tyson", "Andre", "Felix", "Owen", "Blake", "Caleb", "Hector", "Isaiah",
  "Jonah", "Levi", "Miles", "Nolan", "Parker", "Quinn", "Roman", "Seth",
  "Travis", "Victor", "Wade", "Xander", "Yves", "Zane", "Asher", "Bodhi",
  "Dante", "Eli", "Finn", "Gage", "Hank", "Ivan", "Jett", "Kobe",
];

const LAST_NAMES = [
  "Cruz", "Nguyen", "Patel", "Brooks", "Keller", "Ramirez", "Singh", "Walsh",
  "Okada", "Berg", "Diaz", "Foster", "Grant", "Hayes", "Ibarra", "Jensen",
  "Kim", "Lopez", "Morris", "Nash", "Ortiz", "Price", "Reed", "Santos",
  "Turner", "Vega", "West", "Young", "Zimmer", "Alvarez", "Boone", "Chen",
  "Dalton", "Ellis", "Frost", "Gibbs", "Huang", "Ingram", "Jordan", "Knox",
];

const SCHOOLS = [
  "Northridge", "Eastside", "Central", "Westbrook", "Lakewood", "Valley HS",
  "Lincoln Prep", "St. Mark's", "Oakmont", "Riverside", "Summit Academy",
  "Prairie View", "Harbor Tech", "Ironwood", "Cedar Falls", "Blair",
  "Southgate", "Crestview", "Maple Ridge", "Union City",
];

export const LEAGUE_META = {
  name: "Midwest Circuit",
  id: "midwest-circuit",
};

/** Membership entry for leagues the player has created or joined. */
export type PlayerLeague = {
  id: string;
  name: string;
  /** Short uppercase code used to join (e.g. MWST). */
  code: string;
  createdByPlayer: boolean;
};

/** Preset circuits available on Join League. */
export const OPEN_LEAGUES: PlayerLeague[] = [
  {
    id: "midwest-circuit",
    name: "Midwest Circuit",
    code: "MWST",
    createdByPlayer: false,
  },
  {
    id: "coastal-clash",
    name: "Coastal Clash",
    code: "COAST",
    createdByPlayer: false,
  },
  {
    id: "iron-belt",
    name: "Iron Belt Duals",
    code: "IRON",
    createdByPlayer: false,
  },
  {
    id: "heartland-open",
    name: "Heartland Open",
    code: "HLAND",
    createdByPlayer: false,
  },
];

export function isHumanLeagueMember(member: LeagueWrestler) {
  return Boolean(member.isPlayer || member.userId);
}

export function memberKeyForUserId(userId: string) {
  return `user:${userId}`;
}

export function rosterStorageKey(leagueId: string, weightClass: number) {
  return `${leagueId}|${weightClass}`;
}

export function normalizeLeagueCode(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

/** Attribute power targets by difficulty tier. */
const TIER_POWER: Record<BotTier, { bias: number; label: string }> = {
  elite: { bias: 1.2, label: "Elite" },
  high: { bias: 0.78, label: "Challenging" },
  low: { bias: 0.28, label: "Developing" },
};

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeLeagueId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  const suffix = (hashString(`${name}|${Date.now()}`) % 10000)
    .toString()
    .padStart(4, "0");
  return `${slug || "league"}-${suffix}`;
}

export function makeLeagueCode(name: string, id: string) {
  const letters = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = (letters.slice(0, 4) || "LGUE").padEnd(4, "X");
  const num = (hashString(id) % 100).toString().padStart(2, "0");
  return normalizeLeagueCode(`${prefix}${num}`);
}

/** Look up a preset or already-joined league by join code. */
export function findLeagueByCode(
  code: string,
  known: PlayerLeague[] = [],
): PlayerLeague | null {
  const normalized = normalizeLeagueCode(code);
  if (!normalized) return null;
  return (
    OPEN_LEAGUES.find((league) => league.code === normalized) ??
    known.find((league) => league.code === normalized) ??
    null
  );
}

function clampAttr(n: number) {
  return Math.max(4, Math.min(18, Math.round(n)));
}

function tierForIndex(index: number): BotTier {
  // Top 5 elite · next 15 high · bottom 10 low
  if (index < 5) return "elite";
  if (index < 20) return "high";
  return "low";
}

/** Deterministic attributes for a league / scout profile. */
export function generateLeagueAttributes(
  seed: string,
  powerBias = 0.55,
): LeagueAttributeScores {
  const rng = mulberry32(hashString(seed));
  const base = 7 + powerBias * 3;
  const attrs = {} as LeagueAttributeScores;
  for (const key of LEAGUE_ATTR_KEYS) {
    const wobble = (rng() - 0.5) * 3.5;
    attrs[key] = clampAttr(
      base + wobble + (key === "Technique" ? powerBias * 0.8 : 0),
    );
  }
  const specialty =
    LEAGUE_ATTR_KEYS[Math.floor(rng() * (LEAGUE_ATTR_KEYS.length - 1))];
  attrs[specialty] = clampAttr(attrs[specialty] + 1.5 + rng() * 2);
  return attrs;
}

export function normalizeLeagueAttributes(
  raw: Partial<LeagueAttributeScores> | Record<string, number> | null | undefined,
  seed = "default",
  powerBias = 0.55,
): LeagueAttributeScores {
  if (!raw || typeof raw !== "object") {
    return generateLeagueAttributes(seed, powerBias);
  }
  const fallback = generateLeagueAttributes(seed, powerBias);
  const next = {} as LeagueAttributeScores;
  for (const key of LEAGUE_ATTR_KEYS) {
    const value = raw[key];
    next[key] =
      typeof value === "number" && Number.isFinite(value)
        ? clampAttr(value)
        : fallback[key];
  }
  return next;
}

function uniqueName(rng: () => number, used: Set<string>) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    const name = `${first} ${last}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const fallback = `Wrestler ${used.size + 1}`;
  used.add(fallback);
  return fallback;
}

/** Build the 30-bot field for a weight class with difficulty tiers. */
export function createWeightClassBots(
  weightClass: number,
  leagueId = LEAGUE_META.id,
): LeagueWrestler[] {
  const rng = mulberry32(hashString(`weight-field|${leagueId}|${weightClass}`));
  const used = new Set<string>();
  const bots: LeagueWrestler[] = [];

  for (let i = 0; i < WEIGHT_CLASS_BOT_COUNT; i += 1) {
    const tier = tierForIndex(i);
    const id = `${leagueId}|wc${weightClass}-bot-${i}`;
    const localRng = mulberry32(hashString(`${id}|${weightClass}`));
    void rng();
    const name = uniqueName(localRng, used);
    const school = SCHOOLS[Math.floor(localRng() * SCHOOLS.length)];
    const bias = TIER_POWER[tier].bias + (localRng() - 0.5) * 0.08;
    bots.push({
      id,
      name,
      school,
      wins: 0,
      losses: 0,
      weightClass,
      tier,
      attributes: generateLeagueAttributes(id, bias),
    });
  }

  return bots;
}

/**
 * Fresh weight-class roster: player + 30 tiered bots (31 total).
 * Standings UI shows only the top 15.
 */
export function createLeagueRoster(
  playerName: string,
  weightClass: number,
  playerAttributes?: LeagueAttributeScores,
  leagueId = LEAGUE_META.id,
): LeagueWrestler[] {
  return [
    {
      id: "league-player",
      name: playerName,
      school: "Your Room",
      wins: 0,
      losses: 0,
      weightClass,
      attributes:
        playerAttributes ??
        generateLeagueAttributes(
          `player|${playerName}|${weightClass}|${leagueId}`,
        ),
      isPlayer: true,
    },
    ...createWeightClassBots(weightClass, leagueId),
  ];
}

/** True when roster looks like a full weight-class field. */
export function isFullWeightClassRoster(roster: LeagueWrestler[]): boolean {
  const bots = roster.filter((m) => !m.isPlayer);
  return bots.length >= WEIGHT_CLASS_BOT_COUNT;
}

/** Keep the player row aligned with the career record (+ optional attrs). */
export function syncPlayerLeagueRecord(
  roster: LeagueWrestler[],
  playerName: string,
  wins: number,
  losses: number,
  attributes?: LeagueAttributeScores,
  weightClass?: number,
): LeagueWrestler[] {
  const wc =
    weightClass ??
    roster.find((m) => m.isPlayer)?.weightClass ??
    roster[0]?.weightClass ??
    145;

  const normalized = normalizeLeagueRoster(roster);
  const hasPlayer = normalized.some((m) => m.isPlayer);
  if (!hasPlayer) {
    return [
      {
        id: "league-player",
        name: playerName,
        school: "Your Room",
        wins,
        losses,
        weightClass: wc,
        attributes:
          attributes ?? generateLeagueAttributes(`player|${playerName}|${wc}`),
        isPlayer: true,
      },
      ...normalized,
    ];
  }
  return normalized.map((member) => {
    if (!member.isPlayer) return member;
    return {
      ...member,
      name: playerName,
      wins,
      losses,
      weightClass: wc,
      attributes: attributes ?? member.attributes,
    };
  });
}

export function normalizeLeagueMember(member: LeagueWrestler): LeagueWrestler {
  const human = isHumanLeagueMember(member);
  const tier = member.tier ?? (human ? undefined : "high");
  const bias = tier ? TIER_POWER[tier].bias : 0.55;
  return {
    ...member,
    weightClass: member.weightClass || 145,
    userId: member.userId ?? null,
    tier: human ? undefined : tier,
    attributes: normalizeLeagueAttributes(
      member.attributes,
      member.id,
      bias,
    ),
  };
}

export function normalizeLeagueRoster(roster: LeagueWrestler[]): LeagueWrestler[] {
  return roster.map(normalizeLeagueMember);
}

/**
 * Apply a completed bout to league records.
 * Player W-L should already match career record; opponent is upserted/updated.
 */
export function applyLeagueMatchToRoster(
  roster: LeagueWrestler[],
  player: {
    name: string;
    wins: number;
    losses: number;
    attributes?: LeagueAttributeScores;
    weightClass?: number;
  },
  opponent: LeagueOpponentRef,
  playerWon: boolean,
): LeagueWrestler[] {
  let next = syncPlayerLeagueRecord(
    roster,
    player.name,
    player.wins,
    player.losses,
    player.attributes,
    player.weightClass,
  );

  const index = next.findIndex(
    (m) =>
      !m.isPlayer &&
      (m.id === opponent.id ||
        (opponent.userId && m.userId === opponent.userId) ||
        m.name.toLowerCase() === opponent.name.toLowerCase()),
  );

  const wc =
    opponent.weightClass ??
    player.weightClass ??
    next.find((m) => m.isPlayer)?.weightClass ??
    145;

  if (index >= 0) {
    const current = next[index];
    next = next.map((member, i) =>
      i === index
        ? {
            ...member,
            wins: current.wins + (playerWon ? 0 : 1),
            losses: current.losses + (playerWon ? 1 : 0),
            school: opponent.school ?? member.school,
            attributes: opponent.attributes
              ? normalizeLeagueAttributes(
                  opponent.attributes,
                  opponent.id,
                  member.tier ? TIER_POWER[member.tier].bias : 0.55,
                )
              : member.attributes,
          }
        : member,
    );
  } else {
    next = [
      ...next,
      {
        id: opponent.id,
        name: opponent.name,
        school: opponent.school ?? "Independent",
        wins: playerWon ? 0 : 1,
        losses: playerWon ? 1 : 0,
        weightClass: wc,
        tier: opponent.tier ?? "high",
        userId: opponent.userId ?? null,
        attributes: normalizeLeagueAttributes(
          opponent.attributes,
          opponent.id,
          TIER_POWER[opponent.tier ?? "high"].bias,
        ),
      },
    ];
  }

  return next;
}

/** Result of a resolved bot-vs-bot bracket match. */
export type BotMatchResult = {
  matchId: string;
  winner: LeagueOpponentRef;
  loser: LeagueOpponentRef;
};

function upsertBotRecord(
  roster: LeagueWrestler[],
  wrestler: LeagueOpponentRef,
  won: boolean,
): LeagueWrestler[] {
  const index = roster.findIndex(
    (m) =>
      !m.isPlayer &&
      (m.id === wrestler.id ||
        m.name.toLowerCase() === wrestler.name.toLowerCase()),
  );

  const wc =
    wrestler.weightClass ??
    roster.find((m) => !m.isPlayer)?.weightClass ??
    145;

  if (index >= 0) {
    const current = roster[index];
    return roster.map((member, i) =>
      i === index
        ? {
            ...member,
            wins: current.wins + (won ? 1 : 0),
            losses: current.losses + (won ? 0 : 1),
            school: wrestler.school ?? member.school,
            attributes: wrestler.attributes
              ? normalizeLeagueAttributes(
                  wrestler.attributes,
                  wrestler.id,
                  member.tier ? TIER_POWER[member.tier].bias : 0.55,
                )
              : member.attributes,
          }
        : member,
    );
  }

  return [
    ...roster,
    {
      id: wrestler.id,
      name: wrestler.name,
      school: wrestler.school ?? "Independent",
      wins: won ? 1 : 0,
      losses: won ? 0 : 1,
      weightClass: wc,
      tier: wrestler.tier ?? "high",
      attributes: normalizeLeagueAttributes(
        wrestler.attributes,
        wrestler.id,
        TIER_POWER[wrestler.tier ?? "high"].bias,
      ),
    },
  ];
}

/** Apply one or more bot-vs-bot results to the league roster. */
export function applyBotMatchResultsToRoster(
  roster: LeagueWrestler[],
  results: BotMatchResult[],
): LeagueWrestler[] {
  let next = roster;
  for (const result of results) {
    next = upsertBotRecord(next, result.winner, true);
    next = upsertBotRecord(next, result.loser, false);
  }
  return next;
}

/** Ensure bots exist on the roster at 0-0 without changing existing W-L. */
export function ensureLeagueMembers(
  roster: LeagueWrestler[],
  members: LeagueOpponentRef[],
): LeagueWrestler[] {
  let next = normalizeLeagueRoster(roster);
  for (const member of members) {
    const index = next.findIndex(
      (m) =>
        !m.isPlayer &&
        (m.id === member.id ||
          m.name.toLowerCase() === member.name.toLowerCase()),
    );
    if (index >= 0) {
      if (member.attributes) {
        next = next.map((row, i) =>
          i === index
            ? {
                ...row,
                school: member.school ?? row.school,
                attributes: normalizeLeagueAttributes(
                  member.attributes,
                  member.id,
                  row.tier ? TIER_POWER[row.tier].bias : 0.55,
                ),
              }
            : row,
        );
      }
      continue;
    }
    next.push({
      id: member.id,
      name: member.name,
      school: member.school ?? "Independent",
      wins: 0,
      losses: 0,
      weightClass: member.weightClass ?? next[0]?.weightClass ?? 145,
      tier: member.tier ?? "high",
      attributes: normalizeLeagueAttributes(
        member.attributes,
        member.id,
        TIER_POWER[member.tier ?? "high"].bias,
      ),
    });
  }
  return next;
}

function winPct(wins: number, losses: number) {
  const total = wins + losses;
  return total === 0 ? 0 : wins / total;
}

function overallAttrs(attrs: LeagueAttributeScores) {
  const values = Object.values(attrs);
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

/** Rank by wins, then win%, then fewer losses, then overall attrs, then name. */
export function rankLeagueStandings(
  roster: LeagueWrestler[],
): LeagueStanding[] {
  const sorted = [...roster].map(normalizeLeagueMember).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const pctDiff = winPct(b.wins, b.losses) - winPct(a.wins, a.losses);
    if (pctDiff !== 0) return pctDiff;
    if (a.losses !== b.losses) return a.losses - b.losses;
    const ovrDiff = overallAttrs(b.attributes) - overallAttrs(a.attributes);
    if (Math.abs(ovrDiff) > 0.05) return ovrDiff;
    return a.name.localeCompare(b.name);
  });

  return sorted.map((member, index) => ({
    ...member,
    rank: index + 1,
  }));
}

/** Top N standings rows for the League UI. */
export function topLeagueStandings(
  roster: LeagueWrestler[],
  limit = STANDINGS_DISPLAY_COUNT,
): LeagueStanding[] {
  return rankLeagueStandings(roster).slice(0, limit);
}

export function isLeagueRoster(value: unknown): value is LeagueWrestler[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (row) =>
      row &&
      typeof row === "object" &&
      typeof row.id === "string" &&
      typeof row.name === "string" &&
      typeof row.wins === "number" &&
      typeof row.losses === "number",
  );
}

/** Scout card payload used by League / bracket. */
export type WrestlerScoutProfile = {
  id: string;
  name: string;
  school: string;
  wins: number;
  losses: number;
  attributes: LeagueAttributeScores;
  isPlayer?: boolean;
  isHuman?: boolean;
  tier?: BotTier;
  weightClass?: number;
};

/** Convert a league member into a match AiOpponent shape. */
export function leagueBotToMatchOpponent(
  bot: LeagueWrestler,
  weightClass: number,
): import("@/lib/opponents").AiOpponent {
  const human = isHumanLeagueMember(bot) && !bot.isPlayer;
  return {
    id: bot.id,
    name: bot.name,
    school: bot.school || (human ? "Online player" : "Independent"),
    record: `${bot.wins}-${bot.losses}`,
    weightClass: bot.weightClass || weightClass,
    style: human ? "Player vs player" : "Varsity competitor",
    note: human
      ? "Real player in this league — this bout uses their live attributes."
      : "Scout attributes before you wrestle.",
    attributes: bot.attributes,
    tier: bot.tier ?? "high",
    isHuman: human,
    userId: bot.userId ?? null,
  };
}

/**
 * Pick `count` bots from the weight-class field for a bracket.
 * Mixes tiers so elites can appear without filling the whole draw.
 */
export function pickBracketBots(
  roster: LeagueWrestler[],
  count: number,
  seed: string,
): LeagueWrestler[] {
  const bots = normalizeLeagueRoster(roster).filter((m) => !m.isPlayer);
  if (bots.length === 0) return [];

  const rng = mulberry32(hashString(seed));
  const elite = bots.filter((b) => b.tier === "elite");
  const high = bots.filter((b) => b.tier === "high");
  const low = bots.filter((b) => b.tier === "low");

  const shuffle = <T,>(list: T[]) => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const picked: LeagueWrestler[] = [];
  const take = (pool: LeagueWrestler[], n: number) => {
    let remaining = n;
    for (const bot of shuffle(pool)) {
      if (picked.length >= count || remaining <= 0) return;
      if (picked.some((p) => p.id === bot.id)) continue;
      picked.push(bot);
      remaining -= 1;
    }
  };

  // Aim for ~3 elite, ~8 high, ~4 low in a 16-man (15 opponents)
  const eliteTarget = Math.min(3, elite.length, count);
  const lowTarget = Math.min(4, low.length, Math.max(0, count - eliteTarget));
  const highTarget = Math.max(0, count - eliteTarget - lowTarget);

  take(elite, eliteTarget);
  take(high, highTarget);
  take(low, lowTarget);
  // Fill any remaining from leftover pools
  take(shuffle(bots), count - picked.length);

  return picked.slice(0, count);
}

/** Pick one dual opponent from the weight-class field (humans first, then bots). */
export function pickDualOpponent(
  roster: LeagueWrestler[],
  seed: string,
): LeagueWrestler | null {
  const normalized = normalizeLeagueRoster(roster);
  const humanOpponent = pickHumanDualOpponent(normalized, seed);
  if (humanOpponent) return humanOpponent;

  const bots = normalized.filter((m) => !m.isPlayer && !m.userId);
  if (bots.length === 0) return null;
  const rng = mulberry32(hashString(seed));
  const high = bots.filter((b) => b.tier === "high");
  const pool = high.length > 0 ? high : bots;
  return pool[Math.floor(rng() * pool.length)] ?? bots[0] ?? null;
}

/** Pair real players in a league so both see the same opponent for a given week. */
export function pickHumanDualOpponent(
  roster: LeagueWrestler[],
  seed: string,
): LeagueWrestler | null {
  const humans = normalizeLeagueRoster(roster).filter(isHumanLeagueMember);
  if (humans.length < 2) return null;

  const sorted = [...humans].sort((a, b) =>
    (a.userId ?? a.id).localeCompare(b.userId ?? b.id),
  );
  const rotate = hashString(seed) % sorted.length;
  const rotated = [...sorted.slice(rotate), ...sorted.slice(0, rotate)];

  for (let i = 0; i + 1 < rotated.length; i += 2) {
    const a = rotated[i];
    const b = rotated[i + 1];
    if (a.isPlayer) return b;
    if (b.isPlayer) return a;
  }
  return null;
}

export function tierLabel(tier?: BotTier): string {
  if (!tier) return "";
  return TIER_POWER[tier].label;
}
