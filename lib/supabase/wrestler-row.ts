import {
  defaultAttributes,
  type AttributeScores,
  type Wrestler,
} from "@/lib/game-store";
import type { Injury } from "@/lib/injury";
import { fakeRanks, isLetterGrade, isStateCode, type LetterGrade } from "@/lib/wrestler-profile";
import {
  defaultNaturalWeight,
  type WeightCutLevel,
} from "@/lib/weight-cut";

export type CloudWrestler = {
  id: string;
  userId: string;
  wrestler: Wrestler;
  week: number;
  season: number;
  updatedAt: string;
};

type WrestlerTableRow = {
  id: string;
  user_id: string;
  name: string;
  weight_class: number;
  attributes: unknown;
  record?: unknown;
  energy?: number;
  fatigue?: number;
  budget?: number;
  week?: number;
  season?: number;
  updated_at?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asAttributes(value: unknown): AttributeScores {
  const source = asRecord(value);
  const next = { ...defaultAttributes };
  for (const key of Object.keys(next) as (keyof AttributeScores)[]) {
    const raw = source[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      next[key] = raw;
    }
  }
  return next;
}

function asWinLoss(value: unknown): Wrestler["record"] {
  const source = asRecord(value);
  return {
    wins: typeof source.wins === "number" ? source.wins : 0,
    losses: typeof source.losses === "number" ? source.losses : 0,
  };
}

function extraString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extraNumber(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Persist profile fields inside the jsonb attributes column. */
export function attributesForCloud(wrestler: Wrestler): Record<string, unknown> {
  return {
    ...wrestler.attributes,
    hometown: wrestler.hometown,
    state: wrestler.state,
    grade: wrestler.grade,
    studyProgress: wrestler.studyProgress,
    nationalRank: wrestler.nationalRank,
    stateRank: wrestler.stateRank,
    naturalWeight: wrestler.naturalWeight,
    weightCut: wrestler.weightCut,
    injury: wrestler.injury,
  };
}

export function rowToCloudWrestler(row: WrestlerTableRow): CloudWrestler {
  const attrSource = asRecord(row.attributes);
  const attributes = asAttributes(row.attributes);
  const weightClass = row.weight_class;
  const hometown = extraString(attrSource, "hometown") ?? "Unknown";
  const state = isStateCode(extraString(attrSource, "state") ?? "")
    ? (extraString(attrSource, "state") as string)
    : "IA";
  const rawGrade = extraString(attrSource, "grade");
  const grade: LetterGrade = isLetterGrade(rawGrade) ? rawGrade : "B";
  const studyProgress = extraNumber(attrSource, "studyProgress") ?? 0;
  const naturalWeight =
    extraNumber(attrSource, "naturalWeight") ?? defaultNaturalWeight(weightClass);
  const weightCut = (extraString(attrSource, "weightCut") as WeightCutLevel | null) ?? "none";
  const ranks =
    extraNumber(attrSource, "nationalRank") && extraNumber(attrSource, "stateRank")
      ? {
          nationalRank: extraNumber(attrSource, "nationalRank")!,
          stateRank: extraNumber(attrSource, "stateRank")!,
        }
      : fakeRanks({ name: row.name, state, grade, weightClass });

  const injuryRaw = attrSource.injury;
  let injury: Injury | null = null;
  if (injuryRaw && typeof injuryRaw === "object") {
    const raw = injuryRaw as Record<string, unknown>;
    if (typeof raw.name === "string" && typeof raw.weeksRemaining === "number") {
      injury = {
        name: raw.name,
        weeksRemaining: raw.weeksRemaining,
        source: raw.source === "training" ? "training" : "match",
      };
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    wrestler: {
      name: row.name,
      weightClass,
      naturalWeight,
      weightCut,
      grade,
      studyProgress: Math.max(0, Math.min(100, Math.round(studyProgress))),
      hometown,
      state,
      nationalRank: ranks.nationalRank,
      stateRank: ranks.stateRank,
      attributes,
      record: asWinLoss(row.record),
      energy: typeof row.energy === "number" ? row.energy : 100,
      fatigue: typeof row.fatigue === "number" ? row.fatigue : 0,
      budget: typeof row.budget === "number" ? row.budget : 2000,
      injury,
    },
    week: typeof row.week === "number" ? row.week : 1,
    season: typeof row.season === "number" ? row.season : 1,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}
