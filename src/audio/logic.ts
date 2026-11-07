/**
 * Pure (DOM-free) audio logic: parameter mappings, envelope math, step scheduling,
 * voice limiting and curve / impulse generation. Everything here is unit-testable in Node.
 */
import type { AudioFrameState, MusicMode, SurfaceType } from '../core/types';

export const clamp = (x: number, lo = 0, hi = 1): number => (x < lo ? lo : x > hi ? hi : Number.isFinite(x) ? x : lo);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export const dbToGain = (db: number): number => Math.pow(10, db / 20);
/** Frame-rate independent exponential smoothing coefficient. */
export const smoothFactor = (dt: number, tau: number): number => (tau <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dt) / tau));

/** Small deterministic PRNG (mulberry32). Returns floats in [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------------------------
export interface Adsr {
  a: number;
  d: number;
  /** Sustain level as a fraction of peak. */
  s: number;
  r: number;
  peak: number;
}

/** Value of a linear ADSR at time `t` (seconds since note-on) for a gate held `gate` seconds. */
export function adsrValueAt(t: number, gate: number, e: Adsr): number {
  const level = (x: number): number => {
    if (x <= 0) return 0;
    if (x < e.a) return (e.peak * x) / Math.max(1e-6, e.a);
    if (x < e.a + e.d) return lerp(e.peak, e.peak * e.s, (x - e.a) / Math.max(1e-6, e.d));
    return e.peak * e.s;
  };
  if (t < 0) return 0;
  if (t <= gate) return level(t);
  const atRelease = level(gate);
  const rt = t - gate;
  if (rt >= e.r) return 0;
  return atRelease * (1 - rt / Math.max(1e-6, e.r));
}

/** Total audible length of an ADSR note held for `gate` seconds. */
export const adsrEnd = (gate: number, e: Adsr): number => Math.max(0, gate) + e.r;

// ---------------------------------------------------------------------------------------------
// Step clock (lookahead scheduler core)
// ---------------------------------------------------------------------------------------------
export interface StepEvent {
  step: number;
  time: number;
}

/**
 * Tempo-locked step clock. The realtime scheduler calls `advance(now + lookahead)` every ~25 ms and
 * schedules each returned step on the AudioContext timeline; offline rendering calls it once.
 */
export class StepClock {
  step = 0;
  nextTime: number;
  constructor(
    public bpm: number,
    startTime: number,
    public stepsPerBeat = 4,
  ) {
    this.nextTime = startTime;
  }
  get stepDur(): number {
    return 60 / this.bpm / this.stepsPerBeat;
  }
  /** Return every step whose start time is < `until`, advancing the clock. */
  advance(until: number, maxSteps = 512): StepEvent[] {
    const out: StepEvent[] = [];
    while (this.nextTime < until && out.length < maxSteps) {
      out.push({ step: this.step, time: this.nextTime });
      this.step++;
      this.nextTime += this.stepDur;
    }
    return out;
  }
  /**
   * If the clock fell behind `now` by more than `tolerance` (throttled tab, long GC), jump forward
   * to the first step boundary at/after `now` instead of bursting out every missed note.
   * Returns the number of skipped steps.
   */
  catchUp(now: number, tolerance = 0.1): number {
    if (this.nextTime >= now - tolerance) return 0;
    const skip = Math.ceil((now - this.nextTime) / this.stepDur);
    this.step += skip;
    this.nextTime += skip * this.stepDur;
    return skip;
  }
  /** Restart timing at `time` without resetting the step counter (used after pause). */
  resync(time: number): void {
    this.nextTime = time;
  }
}

// ---------------------------------------------------------------------------------------------
// Voice limiting
// ---------------------------------------------------------------------------------------------
/** Caps total and per-key polyphony of one-shots, and rate-limits retriggers. */
export class VoiceLimiter {
  private ends = new Map<string, number[]>();
  private last = new Map<string, number>();
  constructor(public globalMax = 40) {}

  private prune(now: number): void {
    for (const [k, arr] of this.ends) {
      const live = arr.filter((e) => e > now);
      if (live.length) this.ends.set(k, live);
      else this.ends.delete(k);
    }
  }
  count(now: number, key?: string): number {
    this.prune(now);
    if (key !== undefined) return this.ends.get(key)?.length ?? 0;
    let n = 0;
    for (const arr of this.ends.values()) n += arr.length;
    return n;
  }
  /** Try to start a voice of `key` lasting `dur`. Returns false (and records nothing) if over a limit. */
  tryAcquire(key: string, now: number, dur: number, maxPerKey: number, minInterval = 0): boolean {
    this.prune(now);
    const last = this.last.get(key);
    if (last !== undefined && now - last < minInterval) return false;
    if (this.count(now) >= this.globalMax) return false;
    const arr = this.ends.get(key) ?? [];
    if (arr.length >= maxPerKey) return false;
    arr.push(now + Math.max(0, dur));
    this.ends.set(key, arr);
    this.last.set(key, now);
    return true;
  }
  reset(): void {
    this.ends.clear();
    this.last.clear();
  }
}

// ---------------------------------------------------------------------------------------------
// Curves & impulse responses
// ---------------------------------------------------------------------------------------------
/** Soft clipper: linear below 0.9, smoothly saturating to < 0.99. */
export function softClipValue(v: number): number {
  const a = Math.abs(v);
  if (a <= 0.9) return v;
  return Math.sign(v) * (0.9 + 0.089 * Math.tanh((a - 0.9) / 0.089));
}

/**
 * Curve for the master safety WaveShaper. The shaper's input domain [-1,1] represents signal values
 * [-range, range] (the shaper is preceded by a gain of 1/range).
 */
export function makeSoftClipCurve(n = 4096, range = 2): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * range;
    c[i] = softClipValue(x);
  }
  return c;
}

/** Odd-symmetric tanh drive curve normalised to ±1. `drive` ≥ 0 (0 ≈ linear). */
export function makeDriveCurve(drive: number, n = 2048): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  const k = Math.max(0.01, drive);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / norm;
  }
  return c;
}

export interface ImpulseOpts {
  seed?: number;
  /** Seconds of silence before the tail. */
  preDelay?: number;
  /** One-pole lowpass coefficient at the end of the tail (1 = no darkening, 0.05 = very dark). */
  damping?: number;
  /** Number of discrete early reflections. */
  early?: number;
}

/** Generate a stereo, exponentially decaying, progressively darkening noise impulse response. */
export function generateImpulse(sampleRate: number, seconds: number, opts: ImpulseOpts = {}): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const len = Math.max(1, Math.floor(sampleRate * seconds));
  const pre = Math.floor((opts.preDelay ?? 0.01) * sampleRate);
  const damping = clamp(opts.damping ?? 0.25, 0.01, 1);
  const rnd = mulberry32(opts.seed ?? 1234);
  const chans: [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] = [new Float32Array(len), new Float32Array(len)];
  for (let ch = 0; ch < 2; ch++) {
    const d = chans[ch]!;
    let y = 0;
    for (let i = pre; i < len; i++) {
      const tn = (i - pre) / Math.max(1, len - pre);
      const env = Math.exp(-6.9 * tn); // -60 dB at the end
      const coef = lerp(0.9, damping, Math.sqrt(tn));
      const x = rnd() * 2 - 1;
      y += coef * (x - y);
      d[i] = y * env * (1 - tn * 0.02);
    }
    // a few early reflections
    const early = opts.early ?? 6;
    for (let e = 0; e < early; e++) {
      const idx = pre + Math.floor((0.008 + rnd() * 0.07) * sampleRate);
      if (idx < len) d[idx] = (d[idx] ?? 0) + (rnd() * 2 - 1) * 0.6 * (1 - e / (early + 1));
    }
    // short fade-in to avoid a click at the head
    const fade = Math.min(len - pre, Math.floor(0.002 * sampleRate));
    for (let i = 0; i < fade; i++) d[pre + i] = (d[pre + i] ?? 0) * (i / fade);
  }
  return chans;
}

// ---------------------------------------------------------------------------------------------
// Continuous-layer parameter mappings
// ---------------------------------------------------------------------------------------------
/** Deterministic 0..1 gust value from time (sum of incommensurate sines, peaky). */
export function gustValue(t: number): number {
  const s = 0.5 * Math.sin(0.31 * t) + 0.3 * Math.sin(0.73 * t + 1.3) + 0.2 * Math.sin(1.91 * t + 0.7);
  return Math.pow(clamp(0.5 + 0.5 * s), 1.6);
}

export interface WindTargets {
  lowGain: number;
  lowFreq: number;
  whistleGain: number;
  whistleFreq: number;
  whistleQ: number;
  pan: number;
}

export function windTargets(speed: number, eerie: number, gust: number): WindTargets {
  const v = clamp(speed / 35);
  const g = clamp(gust);
  const duck = 1 - 0.75 * clamp(eerie);
  return {
    lowGain: (0.1 + 0.32 * v + 0.12 * g) * duck,
    lowFreq: 220 + 900 * v + 260 * g,
    whistleGain: (0.015 + 0.16 * Math.pow(v, 1.5) + 0.05 * g) * duck,
    whistleFreq: 850 + 1900 * v + 500 * g,
    whistleQ: 3 + 5 * v,
    pan: (g - 0.5) * 0.6,
  };
}

export interface SkiTargets {
  scrapeGain: number;
  scrapeFreq: number;
  scrapeQ: number;
  iceGain: number;
  iceFreq: number;
  powderGain: number;
  powderFreq: number;
  /** 0..1 amplitude-modulation depth of the crunchy chatter. */
  chatterDepth: number;
  chatterRate: number;
}

const SURFACE_MIX: Record<SurfaceType, { scrape: number; ice: number; powder: number; freq: number }> = {
  snow: { scrape: 1, ice: 0.12, powder: 0.3, freq: 1400 },
  packed: { scrape: 1.1, ice: 0.25, powder: 0.1, freq: 1900 },
  powder: { scrape: 0.25, ice: 0, powder: 1, freq: 900 },
  ice: { scrape: 0.45, ice: 1, powder: 0, freq: 2700 },
};

export type SkiInput = Pick<AudioFrameState, 'speed' | 'grounded' | 'edgeLoad' | 'brake' | 'drifting' | 'surface' | 'crashed'>;

export function skiTargets(s: SkiInput): SkiTargets {
  const w = SURFACE_MIX[s.surface] ?? SURFACE_MIX.snow;
  const v = clamp(s.speed / 30);
  const harsh = Math.max(clamp(s.brake), s.drifting ? 1 : 0);
  const moving = clamp(s.speed / 2);
  const silent = !s.grounded || s.crashed;
  const base = Math.pow(v, 0.7) * (0.35 + 0.65 * clamp(s.edgeLoad)) + harsh * 0.45 * clamp(s.speed / 5);
  const k = silent ? 0 : moving;
  return {
    scrapeGain: clamp(base * w.scrape * 0.55, 0, 0.9) * k,
    scrapeFreq: w.freq * (0.7 + 0.6 * v) * (1 + 0.35 * harsh),
    scrapeQ: s.surface === 'ice' ? 1.6 : 0.9 + 0.6 * harsh,
    iceGain: clamp((Math.pow(v, 0.8) * 0.35 + harsh * 0.15) * w.ice, 0, 0.6) * k,
    iceFreq: 5500 + 2500 * v,
    powderGain: clamp((0.1 + 0.6 * Math.pow(v, 0.8)) * w.powder * (0.7 + 0.3 * clamp(s.edgeLoad)), 0, 0.8) * k,
    powderFreq: 450 + 1000 * v,
    chatterDepth: silent ? 0 : harsh * 0.85 * clamp(s.speed / 4),
    chatterRate: 16 + 24 * v,
  };
}

export interface YetiBreathTargets {
  gain: number;
  /** Seconds between breath half-cycles (inhale/exhale). */
  period: number;
  active: boolean;
}

export function yetiBreathTargets(distance: number | null, running: boolean): YetiBreathTargets {
  if (distance === null || !Number.isFinite(distance)) return { gain: 0, period: 1.5, active: false };
  const gain = Math.pow(clamp(1 - (distance - 4) / 116), 1.6);
  return { gain, period: running ? 0.42 : 1.25, active: gain > 0.01 };
}

export function crowdTargets(level: number): { murmurGain: number; laughRate: number } {
  const l = clamp(level);
  return { murmurGain: 0.32 * l, laughRate: 0.22 * l };
}

// ---------------------------------------------------------------------------------------------
// Music mapping
// ---------------------------------------------------------------------------------------------
export const MODE_BPM: Record<MusicMode, number> = {
  none: 60,
  menu: 66,
  explore: 100,
  tension: 72,
  chase: 156,
  victory: 96,
  defeat: 60,
};

export const MODE_FADE_OUT = 1.5;

/** Fade-in time for a mode (stings and the chase come in faster so they land with the action). */
export function modeFadeIn(mode: MusicMode): number {
  switch (mode) {
    case 'chase':
      return 0.6;
    case 'victory':
    case 'defeat':
      return 0.15;
    default:
      return 1.5;
  }
}

/** Music level multiplier while in the eerie zone. */
export const musicDuck = (eerie: number): number => 1 - 0.65 * clamp(eerie);

export interface ChaseMix {
  bassGain: number;
  strings: number;
  brass: number;
  hats: number;
  extraTaiko: boolean;
  shime: boolean;
  roll: boolean;
  riser: boolean;
  /** Cutoff of the chase-bus lowpass. */
  filterHz: number;
}

export function chaseMix(intensity: number): ChaseMix {
  const i = clamp(intensity);
  return {
    bassGain: 0.7 + 0.3 * i,
    strings: 0.25 + 0.75 * smoothstep(0.1, 0.5, i),
    brass: smoothstep(0.38, 0.8, i),
    hats: smoothstep(0.5, 0.85, i),
    extraTaiko: i > 0.3,
    shime: i > 0.5,
    roll: i > 0.7,
    riser: i > 0.85,
    filterHz: 1100 * Math.pow(2, i * 3.9),
  };
}

/** Whether a mode's intro sting should be skipped because the matching one-shot just played. */
export const introRecentlyPlayed = (now: number, lastOneShot: number, window = 4): boolean => now - lastOneShot >= 0 && now - lastOneShot < window;

/** Stats for an offline render (used by the test bench). */
export interface BufferStats {
  peak: number;
  rms: number;
  nans: number;
  overOne: number;
  /** RMS of the loudest 50 ms window. */
  maxShortRms: number;
}

export function bufferStats(channels: ArrayLike<number>[], sampleRate: number): BufferStats {
  let peak = 0;
  let sum = 0;
  let n = 0;
  let nans = 0;
  let over = 0;
  let maxShort = 0;
  const win = Math.max(1, Math.floor(sampleRate * 0.05));
  for (const d of channels) {
    let wsum = 0;
    let wc = 0;
    for (let i = 0; i < d.length; i++) {
      const x = d[i]!;
      if (!Number.isFinite(x)) {
        nans++;
        continue;
      }
      const a = Math.abs(x);
      if (a > peak) peak = a;
      if (a > 1) over++;
      sum += x * x;
      n++;
      wsum += x * x;
      wc++;
      if (wc === win) {
        maxShort = Math.max(maxShort, Math.sqrt(wsum / wc));
        wsum = 0;
        wc = 0;
      }
    }
  }
  return { peak, rms: n ? Math.sqrt(sum / n) : 0, nans, overOne: over, maxShortRms: maxShort };
}
