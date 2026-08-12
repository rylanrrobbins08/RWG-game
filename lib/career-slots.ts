/** Multi-career local storage — up to MAX_CAREERS independent saves. */

export const MAX_CAREERS = 5;

const CAREERS_KEY = "rwg-careers-v1";
/** Legacy single-career key — migrated into slots on first load. */
export const LEGACY_SAVE_KEY = "rwg-game-local-v1";

/** Isolate local career slots per signed-in auth user. */
let storageUserId: string | null = null;

export function setCareerStorageUserId(userId: string | null) {
  storageUserId = userId;
}

function storageKey() {
  return storageUserId ? `${CAREERS_KEY}:${storageUserId}` : CAREERS_KEY;
}

/** Minimal wrestler fields needed for the select list. */
type CareerWrestlerPreview = {
  name: string;
  weightClass: number;
  hometown: string;
  state: string;
  record: { wins: number; losses: number };
};

/** Opaque career snapshot stored per slot (matches getGameSnapshot shape). */
export type CareerSaveBlob = {
  wrestler: CareerWrestlerPreview;
  week: number;
  season: number;
  careerMode?: string;
  [key: string]: unknown;
};

export type CareerListItem = {
  id: string;
  updatedAt: string;
  name: string;
  weightClass: number;
  hometown: string;
  state: string;
  record: { wins: number; losses: number };
  season: number;
  week: number;
  careerMode: "athlete" | "coach";
};

export type StoredCareer = {
  id: string;
  updatedAt: string;
  save: CareerSaveBlob;
};

type CareersFile = {
  version: 1;
  activeCareerId: string | null;
  careers: StoredCareer[];
};

function emptyFile(): CareersFile {
  return { version: 1, activeCareerId: null, careers: [] };
}

function isCareerBlob(value: unknown): value is CareerSaveBlob {
  if (!value || typeof value !== "object") return false;
  const save = value as CareerSaveBlob;
  return (
    save.wrestler != null &&
    typeof save.wrestler === "object" &&
    typeof save.wrestler.name === "string" &&
    typeof save.week === "number"
  );
}

function readRawFile(): CareersFile {
  if (typeof window === "undefined") return emptyFile();
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return emptyFile();
    const parsed = JSON.parse(raw) as Partial<CareersFile>;
    if (!Array.isArray(parsed.careers)) return emptyFile();
    return {
      version: 1,
      activeCareerId:
        typeof parsed.activeCareerId === "string"
          ? parsed.activeCareerId
          : null,
      careers: parsed.careers.filter(
        (entry): entry is StoredCareer =>
          Boolean(entry) &&
          typeof entry.id === "string" &&
          isCareerBlob(entry.save),
      ),
    };
  } catch (error) {
    console.warn("readRawFile:", error);
    return emptyFile();
  }
}

function writeFile(file: CareersFile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(file));
  } catch (error) {
    console.warn("writeFile:", error);
  }
}

function toListItem(entry: StoredCareer): CareerListItem {
  const { wrestler, week, season, careerMode } = entry.save;
  return {
    id: entry.id,
    updatedAt: entry.updatedAt,
    name: wrestler.name,
    weightClass: wrestler.weightClass,
    hometown: wrestler.hometown ?? "",
    state: wrestler.state ?? "",
    record: {
      wins: wrestler.record?.wins ?? 0,
      losses: wrestler.record?.losses ?? 0,
    },
    season: typeof season === "number" ? season : 1,
    week: typeof week === "number" ? week : 1,
    careerMode: careerMode === "coach" ? "coach" : "athlete",
  };
}

/** Migrate legacy single save into the multi-career file once. */
export function migrateLegacyCareerIfNeeded(
  parseLegacy: (raw: string) => CareerSaveBlob | null,
) {
  if (typeof window === "undefined") return;
  const file = readRawFile();
  if (file.careers.length > 0) return;

  try {
    const legacy = window.localStorage.getItem(LEGACY_SAVE_KEY);
    if (!legacy) return;
    const save = parseLegacy(legacy);
    if (!save) return;
    const id = crypto.randomUUID();
    writeFile({
      version: 1,
      activeCareerId: id,
      careers: [
        {
          id,
          updatedAt: new Date().toISOString(),
          save,
        },
      ],
    });
  } catch (error) {
    console.warn("migrateLegacyCareerIfNeeded:", error);
  }
}

export function listCareers(): CareerListItem[] {
  return readRawFile()
    .careers.map(toListItem)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCareerCount(): number {
  return readRawFile().careers.length;
}

export function canCreateCareer(): boolean {
  return getCareerCount() < MAX_CAREERS;
}

export function getActiveCareerId(): string | null {
  return readRawFile().activeCareerId;
}

export function loadCareerSave(careerId: string): CareerSaveBlob | null {
  const entry = readRawFile().careers.find((c) => c.id === careerId);
  return entry?.save ?? null;
}

export function setActiveCareerId(careerId: string | null) {
  const file = readRawFile();
  file.activeCareerId = careerId;
  writeFile(file);
}

/** Create a new career slot from the current snapshot. */
export function createCareerSlot(save: CareerSaveBlob): string | null {
  const file = readRawFile();
  if (file.careers.length >= MAX_CAREERS) return null;
  const id = crypto.randomUUID();
  file.careers.push({
    id,
    updatedAt: new Date().toISOString(),
    save,
  });
  file.activeCareerId = id;
  writeFile(file);
  return id;
}

/** Overwrite the active (or given) career with the current snapshot. */
export function persistCareerSlot(
  save: CareerSaveBlob,
  careerId?: string | null,
) {
  const file = readRawFile();
  const id = careerId ?? file.activeCareerId;
  if (!id) return;
  const index = file.careers.findIndex((c) => c.id === id);
  if (index < 0) return;
  file.careers[index] = {
    id,
    updatedAt: new Date().toISOString(),
    save,
  };
  file.activeCareerId = id;
  writeFile(file);
}

export function getStoredCareer(careerId: string): StoredCareer | null {
  return readRawFile().careers.find((career) => career.id === careerId) ?? null;
}

/** Point an existing local slot at a cloud row id so later saves update the same wrestler. */
export function replaceCareerId(oldId: string, newId: string) {
  if (oldId === newId) return;
  const file = readRawFile();
  const index = file.careers.findIndex((career) => career.id === oldId);
  if (index < 0) return;
  if (file.careers.some((career) => career.id === newId)) return;
  file.careers[index] = { ...file.careers[index], id: newId };
  if (file.activeCareerId === oldId) file.activeCareerId = newId;
  writeFile(file);
}

/** Insert or overwrite a career slot by id (used when hydrating from Supabase). */
export function upsertCareerSlot(
  id: string,
  save: CareerSaveBlob,
  updatedAt?: string,
): boolean {
  const file = readRawFile();
  const index = file.careers.findIndex((career) => career.id === id);
  const entry: StoredCareer = {
    id,
    updatedAt: updatedAt ?? new Date().toISOString(),
    save,
  };
  if (index >= 0) {
    file.careers[index] = entry;
    writeFile(file);
    return true;
  }
  if (file.careers.length >= MAX_CAREERS) return false;
  file.careers.push(entry);
  writeFile(file);
  return true;
}

export function deleteCareerSlot(careerId: string) {
  const file = readRawFile();
  file.careers = file.careers.filter((c) => c.id !== careerId);
  if (file.activeCareerId === careerId) {
    file.activeCareerId = file.careers[0]?.id ?? null;
  }
  writeFile(file);
}
