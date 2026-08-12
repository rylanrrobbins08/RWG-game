import type { Attribute } from "@/lib/game-store";

export const MOVE_POSITIONS = ["neutral", "top", "bottom"] as const;
export type MovePosition = (typeof MOVE_POSITIONS)[number];

export const POSITION_LABELS: Record<MovePosition, string> = {
  neutral: "Neutral",
  top: "Top",
  bottom: "Bottom",
};

export const MOVES_PER_POSITION = 4;

export type Move = {
  id: string;
  name: string;
  position: MovePosition;
  primary: Attribute;
  description: string;
  /** Minimum Technique required to unlock (0 = starter). */
  unlockTechnique: number;
};

export type EquippedLoadout = Record<MovePosition, string[]>;

export const MOVE_CATALOG: Move[] = [
  // Neutral
  { id: "low-single", name: "Low Single", position: "neutral", primary: "Speed", description: "Shoot under the hands to the lead leg.", unlockTechnique: 0 },
  { id: "high-c", name: "High-C Snap", position: "neutral", primary: "Strength", description: "Snap the head and drive into a high crotch.", unlockTechnique: 0 },
  { id: "duck-under", name: "Duck Under", position: "neutral", primary: "Speed", description: "Clear the collar tie and finish behind.", unlockTechnique: 0 },
  { id: "ankle-pick", name: "Ankle Pick", position: "neutral", primary: "Technique", description: "Chop the far ankle off a collar tie.", unlockTechnique: 0 },
  { id: "firemans", name: "Fireman's Carry", position: "neutral", primary: "Strength", description: "Load and dump off an underhook.", unlockTechnique: 6 },
  { id: "blast-double", name: "Blast Double", position: "neutral", primary: "Conditioning", description: "Level change and finish through both legs.", unlockTechnique: 8 },
  { id: "slide-by", name: "Slide By", position: "neutral", primary: "Technique", description: "Clear the underhook and score the go-behind.", unlockTechnique: 10 },
  { id: "front-headlock", name: "Front Headlock Throw", position: "neutral", primary: "Strength", description: "Snap to front headlock and rotate for points.", unlockTechnique: 12 },

  // Top
  { id: "arm-bar-tilt", name: "Arm Bar Tilt", position: "top", primary: "Technique", description: "Weave the near arm and turn for near-fall.", unlockTechnique: 0 },
  { id: "spiral-ride", name: "Spiral Ride", position: "top", primary: "Strength", description: "Drive the hips and break them down.", unlockTechnique: 0 },
  { id: "wrist-ride", name: "Wrist Ride", position: "top", primary: "Conditioning", description: "Control the far wrist and ride heavy.", unlockTechnique: 0 },
  { id: "half-nelson", name: "Half Nelson", position: "top", primary: "Strength", description: "Thread the half and turn them over.", unlockTechnique: 0 },
  { id: "power-half", name: "Power Half", position: "top", primary: "Strength", description: "Stack with a deep half for near-fall.", unlockTechnique: 7 },
  { id: "turk", name: "Turk / Leg Lace", position: "top", primary: "Technique", description: "Step over and lace for turns.", unlockTechnique: 9 },
  { id: "claw-ride", name: "Claw Ride", position: "top", primary: "Mental", description: "Dig the claw and keep hips heavy.", unlockTechnique: 11 },
  { id: "cement-mixer", name: "Cement Mixer", position: "top", primary: "Technique", description: "Trap the arm and roll for back points.", unlockTechnique: 13 },

  // Bottom
  { id: "stand-up", name: "Stand-Up Escape", position: "bottom", primary: "Conditioning", description: "Base up, clear hands, and cut away.", unlockTechnique: 0 },
  { id: "switch", name: "Switch", position: "bottom", primary: "Speed", description: "Sit and switch for the reversal.", unlockTechnique: 0 },
  { id: "granby", name: "Granby Roll", position: "bottom", primary: "Technique", description: "Shoulder roll to clear and reverse.", unlockTechnique: 0 },
  { id: "hip-heist", name: "Hip Heist", position: "bottom", primary: "Speed", description: "Pop the hips and face the opponent.", unlockTechnique: 0 },
  { id: "peterson", name: "Peterson Roll", position: "bottom", primary: "Technique", description: "Trap the arm and roll for back points.", unlockTechnique: 6 },
  { id: "sit-out", name: "Sit-Out Turn-In", position: "bottom", primary: "Mental", description: "Sit through and turn into them.", unlockTechnique: 8 },
  { id: "elevator", name: "Elevator", position: "bottom", primary: "Strength", description: "Elevate the hooking leg and reverse.", unlockTechnique: 10 },
  { id: "quad-pod", name: "Quad Pod Scramble", position: "bottom", primary: "Conditioning", description: "Hand-fight out of a scramble and cut free.", unlockTechnique: 12 },
];

export function getMovesForPosition(position: MovePosition): Move[] {
  return MOVE_CATALOG.filter((move) => move.position === position);
}

export function getMoveById(id: string): Move | undefined {
  return MOVE_CATALOG.find((move) => move.id === id);
}

export function isMoveUnlocked(move: Move, technique: number): boolean {
  return technique >= move.unlockTechnique;
}

export function getUnlockedMoves(
  position: MovePosition,
  technique: number,
): Move[] {
  return getMovesForPosition(position).filter((move) =>
    isMoveUnlocked(move, technique),
  );
}

export function createDefaultLoadout(technique: number): EquippedLoadout {
  const loadout = {} as EquippedLoadout;

  for (const position of MOVE_POSITIONS) {
    const unlocked = getUnlockedMoves(position, technique);
    const starters = getMovesForPosition(position).filter((m) => m.unlockTechnique === 0);
    const pool = unlocked.length >= MOVES_PER_POSITION ? unlocked : starters;
    loadout[position] = pool.slice(0, MOVES_PER_POSITION).map((m) => m.id);
  }

  return loadout;
}

export function normalizeLoadout(
  loadout: EquippedLoadout,
  technique: number,
): EquippedLoadout {
  const next = {} as EquippedLoadout;

  for (const position of MOVE_POSITIONS) {
    const unlockedIds = new Set(
      getUnlockedMoves(position, technique).map((m) => m.id),
    );
    const selected = (loadout[position] ?? []).filter((id) => unlockedIds.has(id));
    const fillers = getUnlockedMoves(position, technique)
      .map((m) => m.id)
      .filter((id) => !selected.includes(id));

    next[position] = [...selected, ...fillers].slice(0, MOVES_PER_POSITION);

    while (next[position].length < MOVES_PER_POSITION) {
      const fallback = getMovesForPosition(position).find(
        (m) => !next[position].includes(m.id),
      );
      if (!fallback) break;
      next[position].push(fallback.id);
    }
  }

  return next;
}

export const MOVE_MAX_LEVEL = 3;
export type MoveLevel = 1 | 2 | 3;

/** Budget cost to reach each level from the previous one. */
export const UPGRADE_COST: Record<2 | 3, number> = {
  2: 200,
  3: 450,
};

export type MoveLevels = Record<string, MoveLevel>;

export function getMoveLevel(levels: MoveLevels, moveId: string): MoveLevel {
  const level = levels[moveId] ?? 1;
  if (level >= 3) return 3;
  if (level === 2) return 2;
  return 1;
}

export function costToUpgrade(currentLevel: MoveLevel): number | null {
  if (currentLevel >= MOVE_MAX_LEVEL) return null;
  const next = (currentLevel + 1) as 2 | 3;
  return UPGRADE_COST[next];
}

/** Starter moves shown on the upgrade page. */
export const UPGRADABLE_MOVE_IDS = [
  "low-single",
  "high-c",
  "arm-bar-tilt",
  "spiral-ride",
  "stand-up",
  "switch",
] as const;
