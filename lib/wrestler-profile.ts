/** Recruiting / academic letter grade shown on the wrestler profile. */
export const LETTER_GRADES = ["A", "B", "C", "D"] as const;
export type LetterGrade = (typeof LETTER_GRADES)[number];

/** Worst → best (D is lowest, A is highest). */
export const GRADE_RANK_ORDER: LetterGrade[] = ["D", "C", "B", "A"];

export type SchoolActionId = "study-hall" | "tutor" | "all-nighter";

export type SchoolAction = {
  id: SchoolActionId;
  name: string;
  description: string;
  /** Progress toward the next letter grade (0–100). */
  progress: number;
  energy: number;
  fatigue: number;
  budget: number;
};

export const SCHOOL_ACTIONS: SchoolAction[] = [
  {
    id: "study-hall",
    name: "Study Hall",
    description: "Quiet reps with textbooks. Steady academic progress.",
    progress: 28,
    energy: 10,
    fatigue: 4,
    budget: 0,
  },
  {
    id: "tutor",
    name: "Hire Tutor",
    description: "Paid help that moves your transcript faster.",
    progress: 45,
    energy: 6,
    fatigue: 2,
    budget: 220,
  },
  {
    id: "all-nighter",
    name: "All-Nighter",
    description: "Grind late. Big progress, heavy gas tank hit.",
    progress: 40,
    energy: 18,
    fatigue: 12,
    budget: 0,
  },
];

export function gradeRankIndex(grade: LetterGrade) {
  return GRADE_RANK_ORDER.indexOf(grade);
}

export function nextLetterGrade(grade: LetterGrade): LetterGrade | null {
  const index = gradeRankIndex(grade);
  if (index < 0 || index >= GRADE_RANK_ORDER.length - 1) return null;
  return GRADE_RANK_ORDER[index + 1];
}

export function getSchoolAction(id: SchoolActionId): SchoolAction | undefined {
  return SCHOOL_ACTIONS.find((action) => action.id === id);
}

export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;

export type StateCode = (typeof US_STATES)[number]["code"];

const GRADE_NATIONAL_BASE: Record<LetterGrade, number> = {
  A: 45,
  B: 180,
  C: 520,
  D: 1100,
};

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Placeholder ranks until a real ranking system exists. */
export function fakeRanks(input: {
  name: string;
  state: string;
  grade: LetterGrade;
  weightClass: number;
}): { nationalRank: number; stateRank: number } {
  const seed = hashString(
    `${input.name}|${input.state}|${input.grade}|${input.weightClass}`,
  );
  const nationalRank = GRADE_NATIONAL_BASE[input.grade] + (seed % 90);
  const stateRank = Math.max(1, Math.floor(nationalRank / 25) + (seed % 12));
  return { nationalRank, stateRank };
}

export type RankPair = { nationalRank: number; stateRank: number };

/** Derive display ranks for an AI opponent from identity + ability. */
export function opponentDisplayRanks(input: {
  id: string;
  name: string;
  weightClass: number;
  overall: number;
  tier?: "elite" | "high" | "low";
}): RankPair {
  const tierBase =
    input.tier === "elite" ? 40 : input.tier === "low" ? 220 : 120;
  const ovr = Math.max(4, Math.min(18, input.overall));
  const seed = hashString(`${input.id}|${input.name}|${input.weightClass}`);
  const nationalRank = Math.max(
    1,
    Math.min(500, Math.round(tierBase + (18 - ovr) * 14 + (seed % 35))),
  );
  const stateRank = Math.max(1, Math.min(80, Math.floor(nationalRank / 20) + (seed % 10)));
  return { nationalRank, stateRank };
}

/**
 * Nudge national/state ranks after a bout.
 * Lower numbers are better. Wins vs stronger (better-ranked) foes move you more.
 */
export function ranksAfterMatch(
  before: RankPair,
  won: boolean,
  opponentNationalRank: number,
  endedBy: "decision" | "major" | "tech" | "pin" | "suddenVictory" = "decision",
): RankPair {
  const gap = before.nationalRank - opponentNationalRank;
  let nationalDelta: number;

  if (won) {
    nationalDelta = -Math.max(4, Math.round(7 + Math.max(0, gap) * 0.18));
    if (endedBy === "pin") nationalDelta -= 3;
    else if (endedBy === "tech") nationalDelta -= 2;
    else if (endedBy === "major") nationalDelta -= 1;
  } else {
    nationalDelta = Math.max(4, Math.round(6 + Math.max(0, -gap) * 0.14));
    if (endedBy === "pin") nationalDelta += 2;
    else if (endedBy === "tech") nationalDelta += 1;
  }

  const nationalRank = Math.max(1, Math.min(999, before.nationalRank + nationalDelta));
  const stateDelta = Math.round(nationalDelta / 3) || (won ? -1 : 1);
  const stateRank = Math.max(1, Math.min(99, before.stateRank + stateDelta));
  return { nationalRank, stateRank };
}

/** Smaller inverse move for the opponent's displayed ranks. */
export function opponentRanksAfterMatch(
  before: RankPair,
  playerWon: boolean,
  playerNationalRank: number,
  endedBy: "decision" | "major" | "tech" | "pin" | "suddenVictory" = "decision",
): RankPair {
  return ranksAfterMatch(before, !playerWon, playerNationalRank, endedBy);
}

export function formatHometown(hometown: string, state: string) {
  const city = hometown.trim();
  const st = state.trim().toUpperCase();
  if (!city && !st) return "—";
  if (!city) return st;
  if (!st) return city;
  return `${city}, ${st}`;
}

export function isLetterGrade(value: unknown): value is LetterGrade {
  return (
    typeof value === "string" &&
    (LETTER_GRADES as readonly string[]).includes(value)
  );
}

export function isStateCode(value: unknown): value is StateCode {
  return (
    typeof value === "string" &&
    US_STATES.some((state) => state.code === value)
  );
}
