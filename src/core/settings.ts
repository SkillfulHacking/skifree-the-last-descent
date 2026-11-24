/** Persistent settings, personal bests and progress flags (localStorage, failure-tolerant). */
import type { QualityPreset } from './types';
import { DEFAULT_BINDINGS, type Action } from '../input/Input';
import type { CourseMode, Difficulty, LengthMode } from '../game/CourseConfig';
import { DEFAULT_BIOME, hasBiome, listBiomes, type BiomeId } from '../world/biome';

export interface Settings {
  quality: QualityPreset;
  renderScale: number;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  cameraShake: number; // 0..1
  reduceFlashes: boolean;
  /** (round 4, W-088) controller vibration (rumble) on impacts and the Yeti's landing */
  vibration: boolean;
  /** thinner snow, lighter storm fog, less blowing motion (presentation only: W-049) */
  reduceWeather: boolean;
  reduceCameraMotion: boolean;
  invertCameraY: boolean;
  invertCameraX: boolean;
  steerSensitivity: number;
  cameraSensitivity: number;
  deadzone: number;
  showFps: boolean;
  showTutorial: boolean;
  /** contextual control hints (e.g. the one-time pole push hint) — separate from the tutorial */
  controlHints: boolean;
  /** the one-time pole push hint has been shown */
  seenPoleHint: boolean;
  uiScale: number;
  rearView: boolean;
  captions: boolean;
  /** which mountain */
  course: CourseMode;
  /** how long */
  courseLength: LengthMode;
  /** last custom seed text */
  customSeed: string;
  /** Daily: replay a past day (YYYY-MM-DD) or null for today (UTC) */
  dailyDate: string | null;
  /** Yeti pursuit difficulty */
  difficulty: Difficulty;
  /** location (registered biome id) */
  biome: BiomeId;
  bindings: Record<Action, string[]>;
}

export interface Records {
  bestTime: number | null; // seconds to finish (wins only)
  bestScore: number;
  bestDistance: number;
  bestSurvival: number;
  runs: number;
  wins: number;
  seenCaveCinematic: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'high',
  renderScale: 1,
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.9,
  cameraShake: 1,
  reduceFlashes: false,
  vibration: true,
  reduceWeather: false,
  reduceCameraMotion: false,
  invertCameraY: false,
  invertCameraX: false,
  steerSensitivity: 1,
  cameraSensitivity: 1,
  deadzone: 0.15,
  showFps: false,
  showTutorial: true,
  controlHints: true,
  seenPoleHint: false,
  uiScale: 1,
  rearView: true,
  captions: true,
  course: 'classic',
  courseLength: 'standard',
  customSeed: 'POWDER',
  dailyDate: null,
  difficulty: 'normal',
  biome: DEFAULT_BIOME,
  bindings: structuredClone(DEFAULT_BINDINGS),
};

export const DEFAULT_RECORDS: Records = { bestTime: null, bestScore: 0, bestDistance: 0, bestSurvival: 0, runs: 0, wins: 0, seenCaveCinematic: false };

/** Local records, kept separately for every course id (mode + seed/date + length). */
export interface RecordBook {
  /**
   * The pre-round-4 progress flag shared by every location (production builds still read it). Kept as
   * "a cave cinematic has been watched somewhere"; the game itself now reads `seenCave`.
   */
  seenCaveCinematic: boolean;
  /**
   * (Round 4, owner's decision B) the cave cinematic watched to its end, per location (biome id). A
   * first viewing in a location cannot be skipped; seeing one location's never marks another's.
   */
  seenCave: Partial<Record<BiomeId, true>>;
  courses: Record<string, Records>;
  /**
   * What the stored book held that this build does not know (fields from other builds), written back
   * unchanged with the book: top level and per course. Never shown to the game.
   */
  unknown?: { top: Record<string, unknown>; courses: Record<string, Record<string, unknown>> };
}

const KEY_S = 'skifree-tld.settings.v1';
const KEY_R = 'skifree-tld.records.v1';
const KEY_RB = 'skifree-tld.records.v2';

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function storage(): KV | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadSettings(kv: KV | null = storage()): Settings {
  const base = structuredClone(DEFAULT_SETTINGS);
  try {
    const raw = kv?.getItem(KEY_S);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const merged = { ...base, ...parsed, bindings: { ...base.bindings, ...(parsed.bindings ?? {}) } };
    if (!['low', 'medium', 'high', 'ultra'].includes(merged.quality)) merged.quality = 'high';
    return sanitize(merged);
  } catch {
    return base;
  }
}

/** Clamp/repair every field so corrupt or hand-edited storage can never break the game. */
export function sanitize(s: Settings): Settings {
  const d = DEFAULT_SETTINGS;
  const num = (v: unknown, def: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);
  const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
  s.renderScale = num(s.renderScale, d.renderScale, 0.5, 1);
  s.masterVolume = num(s.masterVolume, d.masterVolume, 0, 1);
  s.musicVolume = num(s.musicVolume, d.musicVolume, 0, 1);
  s.sfxVolume = num(s.sfxVolume, d.sfxVolume, 0, 1);
  s.cameraShake = num(s.cameraShake, d.cameraShake, 0, 1);
  s.steerSensitivity = num(s.steerSensitivity, d.steerSensitivity, 0.5, 1.6);
  s.cameraSensitivity = num(s.cameraSensitivity, d.cameraSensitivity, 0.3, 2);
  s.deadzone = num(s.deadzone, d.deadzone, 0.02, 0.4);
  s.uiScale = num(s.uiScale, d.uiScale, 0.85, 1.5);
  s.reduceFlashes = bool(s.reduceFlashes, d.reduceFlashes);
  s.vibration = bool(s.vibration, d.vibration);
  s.reduceWeather = bool(s.reduceWeather, d.reduceWeather);
  s.reduceCameraMotion = bool(s.reduceCameraMotion, d.reduceCameraMotion);
  s.invertCameraX = bool(s.invertCameraX, d.invertCameraX);
  s.invertCameraY = bool(s.invertCameraY, d.invertCameraY);
  s.showFps = bool(s.showFps, d.showFps);
  s.showTutorial = bool(s.showTutorial, d.showTutorial);
  s.controlHints = bool(s.controlHints, d.controlHints);
  s.seenPoleHint = bool(s.seenPoleHint, d.seenPoleHint);
  s.rearView = bool(s.rearView, d.rearView);
  s.captions = bool(s.captions, d.captions);
  if (s.course !== 'classic' && s.course !== 'daily' && s.course !== 'custom') s.course = 'classic';
  if (!['sprint', 'standard', 'endurance', 'expedition', 'endless'].includes(s.courseLength)) s.courseLength = d.courseLength;
  if (s.difficulty !== 'relaxed' && s.difficulty !== 'normal' && s.difficulty !== 'hard') s.difficulty = 'normal';
  if (!hasBiome(s.biome)) s.biome = DEFAULT_BIOME;
  if (typeof s.customSeed !== 'string' || !s.customSeed.trim() || s.customSeed.length > 40) s.customSeed = d.customSeed;
  if (s.dailyDate !== null && !(typeof s.dailyDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.dailyDate) && new Date(`${s.dailyDate}T00:00:00Z`).toISOString().startsWith(s.dailyDate))) s.dailyDate = null;
  for (const k of Object.keys(d.bindings) as Array<keyof Settings['bindings']>) {
    const v = s.bindings?.[k];
    // (an action other than Pause/Skip left with only Escape — possible after a rebind in an
    // unreleased Pass 6 build — is unusable: it gets its default keys back)
    const escOnly = k !== 'pause' && k !== 'skip' && Array.isArray(v) && v.length > 0 && v.every((c) => c === 'Escape');
    s.bindings[k] = Array.isArray(v) && v.every((c) => typeof c === 'string') && v.length > 0 && !escOnly ? v : [...d.bindings[k]];
  }
  if (!s.bindings.pause.includes('Escape')) s.bindings.pause.push('Escape');
  return s;
}

export function saveSettings(s: Settings, kv: KV | null = storage()) {
  try {
    kv?.setItem(KEY_S, JSON.stringify(s));
  } catch {
    /* storage full / blocked */
  }
}

export function loadRecords(kv: KV | null = storage()): Records {
  try {
    const raw = kv?.getItem(KEY_R);
    if (!raw) return { ...DEFAULT_RECORDS };
    return { ...DEFAULT_RECORDS, ...(JSON.parse(raw) as Partial<Records>) };
  } catch {
    return { ...DEFAULT_RECORDS };
  }
}

export function saveRecords(r: Records, kv: KV | null = storage()) {
  try {
    kv?.setItem(KEY_R, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

/** The location of a course id (courseId: an `@CODE` suffix; none = Alpine). */
export function courseBiome(id: string, codes: Readonly<Record<string, BiomeId>>): BiomeId | null {
  const at = id.lastIndexOf('@');
  if (at < 0) return DEFAULT_BIOME;
  return codes[id.slice(at + 1)] ?? null;
}

const RECORD_FIELDS = new Set<string>(Object.keys(DEFAULT_RECORDS));
const BOOK_FIELDS = new Set(['seenCaveCinematic', 'seenCave', 'courses']);

/**
 * (Round 4, decision B) The per-location history for a book stored before it existed (no `seenCave`):
 *  - the old flag meant "a cave cinematic was watched to its end somewhere";
 *  - reliable evidence of where: runs on that location's courses. With runs on Alpine (or no runs at
 *    all — the flag then came from Alpine, the first location every player gets) Alpine is marked;
 *  - with no Alpine runs but Fjord runs, it can only have been Fjord's: Fjord is marked;
 *  - Whiteout is never inferred from the old flag (owner's decision B): its storm-cave version is new.
 * Idempotent: a book that has `seenCave` is never migrated again.
 */
export function migrateCaveHistory(legacySeen: boolean, courses: Record<string, Records>, codes: Readonly<Record<string, BiomeId>>): Partial<Record<BiomeId, true>> {
  const out: Partial<Record<BiomeId, true>> = {};
  if (!legacySeen) return out;
  const runs: Partial<Record<string, number>> = {};
  for (const [id, r] of Object.entries(courses)) {
    const b = courseBiome(id, codes);
    if (b) runs[b] = (runs[b] ?? 0) + r.runs;
  }
  const any = Object.values(runs).some((n) => (n ?? 0) > 0);
  if ((runs[DEFAULT_BIOME] ?? 0) > 0 || !any) out[DEFAULT_BIOME] = true;
  else if ((runs['fjord'] ?? 0) > 0) out['fjord' as BiomeId] = true;
  return out;
}

/** Biome codes (the `@CODE` of course ids) → ids, from the registry (the locations registered at load) */
function biomeCodes(): Record<string, BiomeId> {
  return Object.fromEntries(listBiomes().map((b) => [b.code, b.id]));
}

/**
 * Load the per-course record book. Records from before courses existed (v1: one global set,
 * all earned on the original 3 km course) are migrated to CLASSIC-SPR. Fields this build does not
 * know are kept and written back unchanged (round 4).
 */
export function loadRecordBook(kv: KV | null = storage()): RecordBook {
  const book: RecordBook = { seenCaveCinematic: false, seenCave: {}, courses: {}, unknown: { top: {}, courses: {} } };
  try {
    const raw = kv?.getItem(KEY_RB);
    if (raw) {
      const p = JSON.parse(raw) as Partial<RecordBook> & Record<string, unknown>;
      if (!p || typeof p !== 'object') return book;
      book.seenCaveCinematic = p.seenCaveCinematic === true;
      if (p.courses && typeof p.courses === 'object')
        for (const [k, v] of Object.entries(p.courses)) {
          if (!v || typeof v !== 'object') continue;
          book.courses[k] = cleanRecords(v);
          const extra = Object.fromEntries(Object.entries(v as unknown as Record<string, unknown>).filter(([f]) => !RECORD_FIELDS.has(f)));
          if (Object.keys(extra).length) book.unknown!.courses[k] = extra;
        }
      for (const [f, v] of Object.entries(p)) if (!BOOK_FIELDS.has(f)) book.unknown!.top[f] = v;
      if (p.seenCave && typeof p.seenCave === 'object') {
        for (const [b, v] of Object.entries(p.seenCave)) if (v === true) book.seenCave[b as BiomeId] = true;
      } else book.seenCave = migrateCaveHistory(book.seenCaveCinematic, book.courses, biomeCodes());
      return book;
    }
    const old = kv?.getItem(KEY_R);
    if (old) {
      const r = { ...DEFAULT_RECORDS, ...(JSON.parse(old) as Partial<Records>) };
      book.seenCaveCinematic = r.seenCaveCinematic === true;
      if (r.runs > 0) book.courses['CLASSIC-SPR'] = cleanRecords(r);
      book.seenCave = migrateCaveHistory(book.seenCaveCinematic, book.courses, biomeCodes());
    }
  } catch {
    /* corrupt: start fresh */
  }
  return book;
}

/** Has the cave cinematic been watched to its end in this location? */
export function caveSeen(b: RecordBook, biome: BiomeId): boolean {
  return b.seenCave[biome] === true;
}

/** Mark a location's cave cinematic watched (its first complete viewing). */
export function markCaveSeen(b: RecordBook, biome: BiomeId): void {
  b.seenCave[biome] = true;
  b.seenCaveCinematic = true;
}

/** Repair a stored record set: every field gets the right type and a sane range (B9). */
export function cleanRecords(v: Partial<Records>): Records {
  const n = (x: unknown, def: number) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : def);
  return {
    bestTime: typeof v.bestTime === 'number' && Number.isFinite(v.bestTime) && v.bestTime > 0 ? v.bestTime : null,
    bestScore: n(v.bestScore, 0),
    bestDistance: n(v.bestDistance, 0),
    bestSurvival: n(v.bestSurvival, 0),
    runs: Math.floor(n(v.runs, 0)),
    wins: Math.floor(n(v.wins, 0)),
    seenCaveCinematic: v.seenCaveCinematic === true,
  };
}

export function saveRecordBook(b: RecordBook, kv: KV | null = storage()) {
  try {
    // what this build knows, over what it does not (kept as it was stored)
    const u = b.unknown ?? { top: {}, courses: {} };
    const courses: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(b.courses)) courses[k] = { ...(u.courses[k] ?? {}), ...v };
    kv?.setItem(KEY_RB, JSON.stringify({ ...u.top, seenCaveCinematic: b.seenCaveCinematic, seenCave: b.seenCave, courses }));
  } catch {
    /* ignore */
  }
}

export function recordsFor(b: RecordBook, id: string): Records {
  return b.courses[id] ?? { ...DEFAULT_RECORDS, seenCaveCinematic: b.seenCaveCinematic };
}

export interface RunStats {
  won: boolean;
  /** Endless: run banked at a checkpoint (counts as a completed run, not a win) */
  banked?: boolean;
  /** course identity + seed, shown on the results screen */
  courseId?: string;
  seed?: number;
  /** Endless: refuges reached */
  checkpoints?: number;
  time: number;
  distance: number;
  maxSpeed: number;
  airtime: number;
  longestAir: number;
  crashes: number;
  survival: number; // seconds after the yeti appeared
  score: number;
}

/** Merge a finished run into the records. Returns which records were beaten. */
export function applyRun(r: Records, run: RunStats): { records: Records; newBest: string[] } {
  const out = { ...r, runs: r.runs + 1, wins: r.wins + (run.won ? 1 : 0) };
  const newBest: string[] = [];
  if (run.won && (out.bestTime === null || run.time < out.bestTime)) {
    out.bestTime = run.time;
    newBest.push('time');
  }
  if (run.score > out.bestScore) {
    out.bestScore = run.score;
    newBest.push('score');
  }
  if (run.distance > out.bestDistance) {
    out.bestDistance = run.distance;
    newBest.push('distance');
  }
  if (run.survival > out.bestSurvival) {
    out.bestSurvival = run.survival;
    newBest.push('survival');
  }
  return { records: out, newBest };
}
