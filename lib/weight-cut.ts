import type { Attribute } from "@/lib/game-store";

export const WEIGHT_CUT_LEVELS = ["none", "mild", "moderate", "aggressive"] as const;
export type WeightCutLevel = (typeof WEIGHT_CUT_LEVELS)[number];

export type WeightCutPenalty = {
  id: WeightCutLevel;
  label: string;
  /** Approx. pounds dropped with this cut plan. */
  lbsCut: number;
  description: string;
  /** Applied to energy when this cut is active (negative). */
  energy: number;
  /** Applied to fatigue when this cut is active (positive). */
  fatigue: number;
  /** Temporary attribute modifiers while the cut is active. */
  attributes: Partial<Record<Attribute, number>>;
};

export const WEIGHT_CUTS: Record<WeightCutLevel, WeightCutPenalty> = {
  none: {
    id: "none",
    label: "None",
    lbsCut: 0,
    description: "Walk around natural. No cut stress.",
    energy: 0,
    fatigue: 0,
    attributes: {},
  },
  mild: {
    id: "mild",
    label: "Mild",
    lbsCut: 3,
    description: "Light water cut the night before.",
    energy: -6,
    fatigue: 6,
    attributes: { Conditioning: -1 },
  },
  moderate: {
    id: "moderate",
    label: "Moderate",
    lbsCut: 6,
    description: "Sauna + restricted fluids for 24 hours.",
    energy: -14,
    fatigue: 14,
    attributes: { Conditioning: -1, Speed: -1, Strength: -1 },
  },
  aggressive: {
    id: "aggressive",
    label: "Aggressive",
    lbsCut: 10,
    description: "Hard cut. Empty tank by weigh-in.",
    energy: -24,
    fatigue: 26,
    attributes: {
      Conditioning: -2,
      Speed: -2,
      Strength: -1,
      Mental: -1,
      Durability: -1,
    },
  },
};

/** Default walking weight: a few pounds above the competition class. */
export function defaultNaturalWeight(weightClass: number): number {
  return weightClass + 5;
}

export function poundsToCut(naturalWeight: number, weightClass: number): number {
  return Math.max(0, naturalWeight - weightClass);
}

export function getActivePenalties(level: WeightCutLevel): {
  energy: number;
  fatigue: number;
  attributes: Partial<Record<Attribute, number>>;
} {
  const cut = WEIGHT_CUTS[level];
  return {
    energy: cut.energy,
    fatigue: cut.fatigue,
    attributes: { ...cut.attributes },
  };
}

export function formatAttrPenalty(attr: Attribute, delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${attr} ${sign}${delta}`;
}
