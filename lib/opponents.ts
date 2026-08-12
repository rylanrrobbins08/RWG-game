import { ATTRIBUTES, type AttributeScores } from "@/lib/game-store";
import type { SeasonEvent } from "@/lib/season-schedule";

export type BotTier = "elite" | "high" | "low";

export type AiOpponent = {
  id: string;
  name: string;
  school: string;
  record: string;
  weightClass: number;
  style: string;
  note: string;
  attributes: AttributeScores;
  tier?: BotTier;
};

const FIRST_NAMES = [
  "Marcus", "Diego", "Kai", "Noah", "Ethan", "Jamal", "Cole", "Ryder",
  "Tyson", "Andre", "Felix", "Owen", "Blake", "Caleb", "Hector", "Isaiah",
  "Jonah", "Levi", "Miles", "Nolan", "Parker", "Quinn", "Roman", "Seth",
  "Travis", "Victor", "Wade", "Xander", "Yves", "Zane", "Asher", "Bodhi",
];

const LAST_NAMES = [
  "Cruz", "Nguyen", "Patel", "Brooks", "Keller", "Ramirez", "Singh", "Walsh",
  "Okada", "Berg", "Diaz", "Foster", "Grant", "Hayes", "Ibarra", "Jensen",
  "Kim", "Lopez", "Morris", "Nash", "Ortiz", "Price", "Reed", "Santos",
  "Turner", "Vega", "West", "Young", "Zimmer", "Alvarez", "Boone", "Chen",
];

const SCHOOLS = [
  "Northridge", "Eastside", "Central", "Westbrook", "Lakewood", "Valley HS",
  "Lincoln Prep", "St. Mark's", "Oakmont", "Riverside", "Summit Academy",
  "Prairie View", "Harbor Tech", "Ironwood", "Cedar Falls", "Blair",
];

const STYLES = [
  "Pressure rider",
  "Low-level shooter",
  "Scramble artist",
  "Heavy hand-fighter",
  "Mat return specialist",
  "Counter wrestler",
  "Pace pusher",
  "Technical chain wrestler",
];

const NOTES = [
  "Strong on top. Susceptible to low singles.",
  "Dangerous from neutral. Soft on bottom.",
  "Gas tank fades late — push period 3.",
  "Heavy wrists; clear ties early.",
  "Explosive level changes off the whistle.",
  "Patient rider; needs a scramble to open.",
  "Heads-up defensively; punish stalling.",
  "Loves front headlocks — keep posture.",
];

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

function clampAttr(n: number) {
  return Math.max(4, Math.min(18, Math.round(n)));
}

function buildAttributes(rng: () => number, powerBias: number): AttributeScores {
  const base = 7 + powerBias * 3;
  const attrs = {} as AttributeScores;
  for (const attr of ATTRIBUTES) {
    const wobble = (rng() - 0.5) * 4;
    attrs[attr] = clampAttr(base + wobble + (attr === "Technique" ? powerBias : 0));
  }
  // Push one specialty higher so bots feel distinct
  const specialty = ATTRIBUTES[Math.floor(rng() * (ATTRIBUTES.length - 1))]; // skip Grades bias
  attrs[specialty] = clampAttr(attrs[specialty] + 2 + rng() * 2);
  return attrs;
}

function uniqueName(rng: () => number, used: Set<string>) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
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

/** Deterministic AI opponent from a seed string. */
export function generateOpponent(
  seed: string,
  weightClass: number,
  powerBias = 0.5,
): AiOpponent {
  const rng = mulberry32(hashString(seed));
  const used = new Set<string>();
  const name = uniqueName(rng, used);
  const wins = 2 + Math.floor(rng() * 10);
  const losses = Math.floor(rng() * 5);
  return {
    id: `bot-${hashString(seed)}`,
    name,
    school: SCHOOLS[Math.floor(rng() * SCHOOLS.length)],
    record: `${wins}-${losses}`,
    weightClass,
    style: STYLES[Math.floor(rng() * STYLES.length)],
    note: NOTES[Math.floor(rng() * NOTES.length)],
    attributes: buildAttributes(rng, powerBias),
  };
}

/** Batch of unique bots for a bracket / dual. */
export function generateOpponents(
  count: number,
  seed: string,
  weightClass: number,
  powerScale = 0.55,
): AiOpponent[] {
  const rng = mulberry32(hashString(seed));
  const used = new Set<string>();
  const bots: AiOpponent[] = [];

  for (let i = 0; i < count; i += 1) {
    const localSeed = `${seed}|${i}|${Math.floor(rng() * 1e9)}`;
    const localRng = mulberry32(hashString(localSeed));
    const name = uniqueName(localRng, used);
    const wins = 2 + Math.floor(localRng() * 12);
    const losses = Math.floor(localRng() * 6);
    const powerBias = powerScale * (0.35 + localRng() * 0.9);
    bots.push({
      id: `bot-${hashString(localSeed)}`,
      name,
      school: SCHOOLS[Math.floor(localRng() * SCHOOLS.length)],
      record: `${wins}-${losses}`,
      weightClass,
      style: STYLES[Math.floor(localRng() * STYLES.length)],
      note: NOTES[Math.floor(localRng() * NOTES.length)],
      attributes: buildAttributes(localRng, powerBias),
    });
  }

  return bots;
}

export function isBracketEvent(event: SeasonEvent): boolean {
  return event.type === "tournament" || event.type === "major";
}

/** Every tournament / major uses a full 16-man bracket. */
export function bracketSizeForEvent(_event: SeasonEvent): 16 {
  return 16;
}

/** Dual meet opponent — uses event title when it looks like "vs School". */
export function generateDualOpponent(
  event: SeasonEvent,
  weightClass: number,
): AiOpponent {
  const vsMatch = event.title.match(/^vs\s+(.+)$/i);
  const school = vsMatch?.[1]?.trim() || event.location || "Rival HS";
  const bot = generateOpponent(
    `${event.id}|dual|${weightClass}`,
    weightClass,
    0.55,
  );
  return {
    ...bot,
    school,
    note: `${event.detail} Facing ${school}.`,
  };
}
