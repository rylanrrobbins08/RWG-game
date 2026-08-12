import type { Attribute } from "@/lib/game-store";

export const MAX_ACTIVE_TRAINERS = 5;

export type Trainer = {
  id: string;
  name: string;
  specialty: Attribute;
  /** One-time hire cost from budget. */
  cost: number;
  /** Training gain multiplier for the specialty attribute. */
  multiplier: number;
  blurb: string;
};

export const TRAINER_CATALOG: Trainer[] = [
  {
    id: "marcus-cole",
    name: "Marcus Cole",
    specialty: "Strength",
    cost: 450,
    multiplier: 1.35,
    blurb: "Old-school weight-room hammer. Builds finish power.",
  },
  {
    id: "lena-park",
    name: "Lena Park",
    specialty: "Speed",
    cost: 420,
    multiplier: 1.3,
    blurb: "Footwork drills and level-change timing.",
  },
  {
    id: "coach-reyes",
    name: "Diego Reyes",
    specialty: "Technique",
    cost: 500,
    multiplier: 1.4,
    blurb: "Chain wrestling and scoring efficiency.",
  },
  {
    id: "amina-holt",
    name: "Amina Holt",
    specialty: "Conditioning",
    cost: 380,
    multiplier: 1.25,
    blurb: "Gas-tank circuits that hurt in a good way.",
  },
  {
    id: "jake-morrow",
    name: "Jake Morrow",
    specialty: "Mental",
    cost: 360,
    multiplier: 1.3,
    blurb: "Film, composure, and clutch decision work.",
  },
  {
    id: "sofia-nguyen",
    name: "Sofia Nguyen",
    specialty: "Durability",
    cost: 400,
    multiplier: 1.25,
    blurb: "Recovery habits and pressure absorption.",
  },
];

export function getTrainerById(id: string): Trainer | undefined {
  return TRAINER_CATALOG.find((trainer) => trainer.id === id);
}

/** Best specialty multiplier among hired trainers for an attribute (1 if none). */
export function specialtyMultiplier(
  hiredIds: string[],
  attr: Attribute,
): number {
  let best = 1;
  for (const id of hiredIds) {
    const trainer = getTrainerById(id);
    if (trainer && trainer.specialty === attr) {
      best = Math.max(best, trainer.multiplier);
    }
  }
  return best;
}
