/**
 * Versioned local progression save (achievements + statistics), stored separately from settings
 * and records under its own localStorage key.
 *
 * Format (see docs/PROGRESSION.md):
 *   { version, achievements: { <id>: { earnedAt } }, stats: { counters, sets }, ...unknownKeys }
 *
 * - Migrations run stepwise (MIGRATIONS[v] turns version v into v + 1) on load.
 * - Unknown achievement ids (removed definitions, or a newer build's) are preserved untouched.
 * - Unknown top-level keys are preserved (round-tripped).
 * - A save from a NEWER build than this one is loaded best-effort and marked read-only: this
 *   build never overwrites it (a downgrade must not destroy progress).
 * - Corrupt data is backed up under `<key>.corrupt` and the player starts fresh.
 */
import { emptyStats, type EarnedMap, type ProgressStats } from './achievements';

export const PROGRESS_KEY = 'skifree-tld.progress';
export const PROGRESS_VERSION = 1;

export interface ProgressSave {
  version: number;
  achievements: EarnedMap;
  stats: ProgressStats;
  /** unknown top-level keys from other builds, preserved */
  [extra: string]: unknown;
}

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export const emptySave = (): ProgressSave => ({ version: PROGRESS_VERSION, achievements: {}, stats: emptyStats() });

type Raw = Record<string, unknown>;
/** MIGRATIONS[v]: version v → v + 1 (pure; input is a parsed object of version v). */
export const MIGRATIONS: Record<number, (s: Raw) => Raw> = {};

const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const MAX_SET = 1000;

/** Repair every known field; keep unknown ids/keys. */
export function sanitizeSave(raw: Raw): ProgressSave {
  const achievements: EarnedMap = {};
  if (isObj(raw.achievements))
    for (const [id, v] of Object.entries(raw.achievements)) {
      const t = isObj(v) ? v.earnedAt : undefined;
      if (typeof t === 'number' && Number.isFinite(t) && t > 0) achievements[id] = { earnedAt: t };
    }
  const stats = emptyStats();
  const st = isObj(raw.stats) ? raw.stats : {};
  if (isObj(st.counters))
    for (const [k, v] of Object.entries(st.counters)) if (typeof v === 'number' && Number.isFinite(v) && v >= 0) stats.counters[k] = v;
  if (isObj(st.sets))
    for (const [k, v] of Object.entries(st.sets)) if (Array.isArray(v)) stats.sets[k] = [...new Set(v.filter((x): x is string => typeof x === 'string'))].slice(0, MAX_SET);
  const out: ProgressSave = { ...raw, version: typeof raw.version === 'number' ? raw.version : PROGRESS_VERSION, achievements, stats };
  return out;
}

export interface LoadResult {
  save: ProgressSave;
  /** the stored data came from a newer build: never write it back */
  readOnly: boolean;
  /** the stored data was unreadable and was backed up */
  recovered: boolean;
  /** migrated from this version (null: no migration) */
  migratedFrom: number | null;
}

/** Parse + migrate + sanitize stored progress (pure apart from the corrupt backup). */
export function loadProgress(kv: KV | null): LoadResult {
  let raw: string | null = null;
  try {
    raw = kv?.getItem(PROGRESS_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (!raw) return { save: emptySave(), readOnly: false, recovered: false, migratedFrom: null };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }
  const v = isObj(data) ? data.version : undefined;
  if (!isObj(data) || typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    try {
      kv?.setItem(`${PROGRESS_KEY}.corrupt`, raw);
    } catch {
      /* ignore */
    }
    return { save: emptySave(), readOnly: false, recovered: true, migratedFrom: null };
  }
  if (v > PROGRESS_VERSION) return { save: sanitizeSave(data), readOnly: true, recovered: false, migratedFrom: null };
  let cur: Raw = data;
  for (let k = v; k < PROGRESS_VERSION; k++) {
    const m = MIGRATIONS[k];
    if (!m) throw new Error(`missing progress migration ${k} → ${k + 1}`);
    cur = { ...m(cur), version: k + 1 };
  }
  return { save: sanitizeSave(cur), readOnly: false, recovered: false, migratedFrom: v < PROGRESS_VERSION ? v : null };
}

export function writeProgress(kv: KV | null, s: ProgressSave): boolean {
  try {
    kv?.setItem(PROGRESS_KEY, JSON.stringify({ ...s, version: PROGRESS_VERSION }));
    return true;
  } catch {
    return false;
  }
}

export function browserStorage(): KV | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
