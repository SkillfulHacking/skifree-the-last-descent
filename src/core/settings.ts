/** Persistent settings, personal bests and progress flags (localStorage, failure-tolerant). */
import type { QualityPreset } from './types';
import { DEFAULT_BINDINGS, type Action } from '../input/Input';
import type { CourseMode, LengthMode } from '../game/CourseConfig';

export interface Settings {
  quality: QualityPreset;
  renderScale: number;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  cameraShake: number; // 0..1
  reduceFlashes: boolean;
  reduceCameraMotion: boolean;
  invertCameraY: boolean;
  invertCameraX: boolean;
  steerSensitivity: number;
  cameraSensitivity: number;
  deadzone: number;
  showFps: boolean;
  showTutorial: boolean;
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
  reduceCameraMotion: false,
  invertCameraY: false,
  invertCameraX: false,
  steerSensitivity: 1,
  cameraSensitivity: 1,
  deadzone: 0.15,
  showFps: false,
  showTutorial: true,
  uiScale: 1,
  rearView: true,
  captions: true,
  course: 'classic',
  courseLength: 'standard',
  customSeed: 'POWDER',
  dailyDate: null,
  bindings: structuredClone(DEFAULT_BINDINGS),
};

export const DEFAULT_RECORDS: Records = { bestTime: null, bestScore: 0, bestDistance: 0, bestSurvival: 0, runs: 0, wins: 0, seenCaveCinematic: false };

/** Local records, kept separately for every course id (mode + seed/date + length). */
export interface RecordBook {
  /** progress flag shared by all courses */
  seenCaveCinematic: boolean;
  courses: Record<string, Records>;
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
  s.reduceCameraMotion = bool(s.reduceCameraMotion, d.reduceCameraMotion);
  s.invertCameraX = bool(s.invertCameraX, d.invertCameraX);
  s.invertCameraY = bool(s.invertCameraY, d.invertCameraY);
  s.showFps = bool(s.showFps, d.showFps);
  s.showTutorial = bool(s.showTutorial, d.showTutorial);
  s.rearView = bool(s.rearView, d.rearView);
  s.captions = bool(s.captions, d.captions);
  if (s.course !== 'classic' && s.course !== 'daily' && s.course !== 'custom') s.course = 'classic';
  if (!['sprint', 'standard', 'endurance', 'expedition', 'endless'].includes(s.courseLength)) s.courseLength = d.courseLength;
  if (typeof s.customSeed !== 'string' || !s.customSeed.trim() || s.customSeed.length > 40) s.customSeed = d.customSeed;
  if (s.dailyDate !== null && !(typeof s.dailyDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.dailyDate))) s.dailyDate = null;
  for (const k of Object.keys(d.bindings) as Array<keyof Settings['bindings']>) {
    const v = s.bindings?.[k];
    s.bindings[k] = Array.isArray(v) && v.every((c) => typeof c === 'string') && v.length > 0 ? v : [...d.bindings[k]];
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

/**
 * Load the per-course record book. Records from before courses existed (v1: one global set,
 * all earned on the original 3 km course) are migrated to CLASSIC-SPR.
 */
export function loadRecordBook(kv: KV | null = storage()): RecordBook {
  const book: RecordBook = { seenCaveCinematic: false, courses: {} };
  try {
    const raw = kv?.getItem(KEY_RB);
    if (raw) {
      const p = JSON.parse(raw) as Partial<RecordBook>;
      book.seenCaveCinematic = p.seenCaveCinematic === true;
      if (p.courses && typeof p.courses === 'object') for (const [k, v] of Object.entries(p.courses)) if (v && typeof v === 'object') book.courses[k] = { ...DEFAULT_RECORDS, ...v };
      return book;
    }
    const old = kv?.getItem(KEY_R);
    if (old) {
      const r = { ...DEFAULT_RECORDS, ...(JSON.parse(old) as Partial<Records>) };
      book.seenCaveCinematic = r.seenCaveCinematic;
      if (r.runs > 0) book.courses['CLASSIC-SPR'] = r;
    }
  } catch {
    /* corrupt: start fresh */
  }
  return book;
}

export function saveRecordBook(b: RecordBook, kv: KV | null = storage()) {
  try {
    kv?.setItem(KEY_RB, JSON.stringify(b));
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
