export type InjurySource = "match" | "training";

export type Injury = {
  name: string;
  weeksRemaining: number;
  source: InjurySource;
};

const INJURY_NAMES = [
  "Shoulder sprain",
  "Ankle tweak",
  "Rib bruise",
  "Knee strain",
  "Neck stiffness",
  "Hamstring pull",
] as const;

/**
 * Small injury chance. Higher Conditioning lowers risk.
 * Match: ~14% at Cond 0 → ~4% at Cond 20
 * Training: ~9% at Cond 0 → ~2% at Cond 20
 */
export function getInjuryChance(
  conditioning: number,
  source: InjurySource,
): number {
  const cond = Math.max(0, Math.min(20, conditioning));
  const base = source === "match" ? 0.14 : 0.09;
  const floor = source === "match" ? 0.03 : 0.02;
  return Math.max(floor, base - cond * 0.005);
}

export function rollInjury(
  conditioning: number,
  source: InjurySource,
): Injury | null {
  if (Math.random() >= getInjuryChance(conditioning, source)) {
    return null;
  }

  const name = INJURY_NAMES[Math.floor(Math.random() * INJURY_NAMES.length)];
  const weeksRemaining =
    source === "match"
      ? 1 + Math.floor(Math.random() * 3)
      : 1 + Math.floor(Math.random() * 2);

  return { name, weeksRemaining, source };
}

export function tickInjury(injury: Injury | null): Injury | null {
  if (!injury) return null;
  const weeksRemaining = injury.weeksRemaining - 1;
  if (weeksRemaining <= 0) return null;
  return { ...injury, weeksRemaining };
}

export function formatInjuryStatus(injury: Injury | null): string {
  if (!injury) return "Healthy";
  const weeks =
    injury.weeksRemaining === 1
      ? "1 week left"
      : `${injury.weeksRemaining} weeks left`;
  return `${injury.name} · ${weeks}`;
}
