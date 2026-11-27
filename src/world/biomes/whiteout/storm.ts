/**
 * Whiteout Ridge weather (pure, deterministic): a cycle of storm fronts over a high, exposed ridge.
 *
 * Each front: a clear window (the vista: sun, long views) → the front building in (≈ 9 s: the wind
 * rises, the sky greys, the snow thickens — the telegraph) → the storm (visibility down to ~80 m,
 * strong crosswind, heavy snow) → easing (≈ 8 s). Durations vary per front from the course seed.
 * The wind veers from one front to the next (a storm blows from the left or from the right of the
 * fall line), so a skier reads each front's direction from the drifting snow and the HUD.
 *
 * On top of the fronts: fog banks lying in fixed places on the mountain, and localized blizzard
 * cells sweeping across the piste (a hazard kind, ./hazards.ts).
 *
 * Exposure (WeatherModel.exposure): ridges, open bowls and the fast alternate lines take the full
 * wind; trees and gullies are sheltered (BiomeEnvironment scales the crosswind on jumps, the
 * gust wobble and the headwind by it).
 */
import { clamp, fbm, gnoise, hash2, smoothstep } from '../../../core/rng';
import type { ExposureQuery, WeatherModel, WeatherSample } from '../../capabilities/weather';

/** front timing (s) */
export const FRONT = {
  /** the start is in fair weather for this long (learn the controls in the clear) */
  calmStart: 22,
  clear: [22, 50] as const,
  build: 9,
  storm: [38, 58] as const,
  ease: 8,
} as const;

/** fog multipliers over the biome's base density (validateWeather caps visibility at 12) */
// (W-039, round 2: a storm reads as a whiteout — ≈ 55% fog at 50 m, ≈ 87% at 80 m, nothing past
// ~120 m; the drift-gap markers, trail lamps and rim wands carry further: views)
export const STORM_FOG = { clear: 0.65, storm: 21, bank: 2.4 } as const;

export interface FrontState {
  /** 0..1 storm intensity */
  s: number;
  /** +1 / −1: which side of the fall line this front blows from (+X = toward the skier's left) */
  dir: number;
  /** 'clear' | 'build' | 'storm' | 'ease' */
  phase: 'clear' | 'build' | 'storm' | 'ease';
  /** seconds until the phase ends */
  left: number;
  /** index of the front */
  k: number;
}

/**
 * Front types (full production, brief §8: no weather on a metronome): most are full storms; some only
 * graze the ridge (the cloud base lifts before it closes in: a shorter, lighter storm); some windows
 * are long fair spells; and now and then a squall follows hard on the last one (a short window).
 */
export const FRONT_TYPES = {
  full: { peak: 1, storm: 1, clear: 1 },
  graze: { peak: 0.62, storm: 0.6, clear: 1 },
  longClear: { peak: 1, storm: 1, clear: 3.1 },
  backToBack: { peak: 0.85, storm: 0.7, clear: 0.45 },
} as const;
export type FrontType = keyof typeof FRONT_TYPES;

/** the type of front k (deterministic): the first is always a full storm (the course's signature) */
export function frontType(k: number, seed: number): FrontType {
  if (k === 0) return 'full';
  const r = hash2(k, 14, seed);
  return r < 0.45 ? 'full' : r < 0.67 ? 'graze' : r < 0.87 ? 'longClear' : 'backToBack';
}

interface Front {
  t0: number;
  /** storm peak (0..1) */
  peak: number;
  /** clear window, build, storm, ease ends (absolute times) */
  c: number;
  b: number;
  st: number;
  e: number;
  dir: number;
}

const cache = new Map<number, Front[]>();

function fronts(seed: number, upTo: number): Front[] {
  let list = cache.get(seed);
  if (!list) {
    list = [];
    if (cache.size > 16) cache.clear();
    cache.set(seed, list);
  }
  while (!list.length || list[list.length - 1]!.e <= upTo) {
    const k = list.length;
    const t0 = k === 0 ? 0 : list[k - 1]!.e;
    const r1 = hash2(k, 11, seed);
    const r2 = hash2(k, 12, seed);
    const r3 = hash2(k, 13, seed);
    const ty = FRONT_TYPES[frontType(k, seed)];
    const clear = k === 0 ? FRONT.calmStart : (FRONT.clear[0] + (FRONT.clear[1] - FRONT.clear[0]) * r1) * ty.clear;
    const storm = (FRONT.storm[0] + (FRONT.storm[1] - FRONT.storm[0]) * r2) * ty.storm;
    const c = t0 + clear;
    const b = c + FRONT.build;
    const st = b + storm;
    const e = st + FRONT.ease;
    // the first front blows from the left; then it veers to the other side about two times in three
    const prev = k === 0 ? -1 : list[k - 1]!.dir;
    const dir = k === 0 ? 1 : r3 < 0.66 ? -prev : prev;
    list.push({ t0, peak: ty.peak, c, b, st, e, dir });
  }
  return list;
}

/** The storm front at physics time t (deterministic per seed). */
export function frontAt(t: number, seed: number, out?: FrontState): FrontState {
  const o = out ?? { s: 0, dir: 1, phase: 'clear', left: 0, k: 0 };
  const tt = Math.max(0, t);
  const list = fronts(seed, tt);
  // binary search for the front containing tt
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid]!.e <= tt) lo = mid + 1;
    else hi = mid;
  }
  const f = list[lo]!;
  o.k = lo;
  o.dir = f.dir;
  if (tt < f.c) {
    o.phase = 'clear';
    o.s = 0;
    o.left = f.c - tt;
  } else if (tt < f.b) {
    o.phase = 'build';
    o.s = f.peak * smoothstep(f.c, f.b, tt);
    o.left = f.b - tt;
  } else if (tt < f.st) {
    o.phase = 'storm';
    // the storm breathes: heavier squalls and short lulls inside it, never below 0.72
    o.s = f.peak * (0.86 + 0.14 * gnoise(tt / 7, 3.1 + lo, seed + 301));
    o.left = f.st - tt;
  } else {
    o.phase = 'ease';
    o.s = f.peak * (1 - smoothstep(f.st, f.e, tt));
    o.left = f.e - tt;
  }
  o.s = clamp(o.s, 0, 1);
  return o;
}

/** wind exposure by segment type (1 = open to the wind) */
export const SEGMENT_EXPOSURE: Readonly<Record<string, number>> = {
  ridgeline: 1,
  highspeed: 0.95,
  basin: 0.9,
  cliffside: 0.9,
  summit: 0.9,
  alpine: 0.75,
  moguls: 0.7,
  powder: 0.65,
  beginner: 0.6,
  encounter: 0.6,
  checkpoint: 0.5,
  chute: 0.35,
  forest: 0.3,
  finish: 0.4,
  classic: 0.75,
};

/**
 * The lee shoulder in a front (W-035): the groomed racing line runs over the crown of the run, where
 * the wind is fastest; 3–12 m off it on the downwind side the wind eddies (and drops its snow: the
 * drift rows). There the wind's grip on the skier — the side-slip, the skid, the headwind — falls
 * by up to `shelter` × the front's strength. Which side is the lee follows the front's direction,
 * which the player reads from the blowing snow, the wands and the HUD's wind arrow: moving onto the
 * lee shoulder in a storm is a line choice (a longer line where the course bends the other way, the
 * drift rows to read). Both shoulders are kept clear of obstacles on exposed ground
 * (WHITEOUT_WEATHER.clearZones), and the open crest lines (the alternate lines) take the full wind.
 */
export const LEE = {
  /** the share of the wind the lee shoulder takes away at full storm */
  shelter: 0.5,
  /** the shoulder: from `from` to `to` m off the racing line, on the downwind side */
  from: 3,
  to: 12,
  /** the shoulders are kept free of rock and trees: centred this far off the line, ± half */
  lane: 13,
  laneHalf: 5,
} as const;

const leeFront: FrontState = { s: 0, dir: 1, phase: 'clear', left: 0, k: 0 };

/**
 * Smooth, skiable snow between two points across the piste (and along it at the far end): no
 * terrain step or kink a skier would hit (round 2: a 5 m step beside the racing line on some seeds —
 * reviewer B F8 — made a drift gap beyond it a trap). Steps of 1.5 m: no grade change over
 * `kink` between neighbours, no grade over `grade`.
 */
export const SKIABLE = { step: 1.5, kink: 0.45, grade: 0.9 } as const;
export function skiableAcross(m: ExposureQuery & { heightAt?(x: number, z: number): number }, x0: number, x1: number, z: number, along = 0): boolean {
  const h = m.heightAt;
  if (!h) return true;
  const S = SKIABLE;
  const check = (pts: Array<[number, number]>) => {
    let prev = Number.NaN;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1]!;
      const [bx, bz] = pts[i]!;
      const g = (h.call(m, bx, bz) - h.call(m, ax, az)) / Math.hypot(bx - ax, bz - az);
      if (Math.abs(g) > S.grade) return false;
      if (!Number.isNaN(prev) && Math.abs(g - prev) > S.kink) return false;
      prev = g;
    }
    return true;
  };
  const n = Math.max(2, Math.ceil(Math.abs(x1 - x0) / S.step));
  const across: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) across.push([x0 + ((x1 - x0) * i) / n, z]);
  if (!check(across)) return false;
  if (along > 0) {
    const pts: Array<[number, number]> = [];
    for (let dz = -along; dz <= along + 1e-6; dz += S.step) pts.push([x1, z + dz]);
    if (!check(pts)) return false;
  }
  return true;
}

/**
 * Is there a marked, cleared lee shoulder on `side` (+1 = +X) of the racing line at z? On exposed
 * ground (the open runs where the fronts bite), where the shoulder lies on the piste and the snow
 * out to it is smooth (skiableAcross).
 */
export function leeLaneAt(m: ExposureQuery, z: number, side: number): boolean {
  const rx = m.routeX(z);
  if (whiteoutExposure(m, rx, z) < 0.6) return false;
  const cx = m.centerX ? m.centerX(z) : rx;
  if (Math.abs(rx + side * LEE.lane - cx) > m.halfWidth(z) - LEE.laneHalf - 2) return false;
  return skiableAcross(m, rx, rx + side * (LEE.lane + LEE.laneHalf), z, 8);
}

/**
 * 0..1 wind exposure at (x, z): the segment's openness (blended over 80 m), full on the alternate
 * lines. With the time and the course seed, the lee of the piste in a front (LEE) as well; without
 * them (the snow surface, the hazard placement), the ground's openness only.
 */
/**
 * (W-080) the main line's share of the wind where an alternate crest line runs beside it (round 3: 1).
 * 0.75: the sheltered line pays in a storm and the exposed crest no longer wins it outright — Classic
 * Hard Sprint, the reader on the main line caught while the weather-blind crest line won
 * (balance/w080/README.md). An object so measurement runs can compare.
 */
export const CREST_LEE = { main: 0.75 };

export function whiteoutExposure(m: ExposureQuery, x: number, z: number, t?: number, seed?: number): number {
  const seg = (zz: number) => SEGMENT_EXPOSURE[m.profile.segmentAt(zz)] ?? 0.75;
  let base = 0.25 * seg(z - 40) + 0.5 * seg(z) + 0.25 * seg(z + 40);
  if (t !== undefined && seed !== undefined) {
    const f = frontAt(t, seed, leeFront);
    if (f.s > 0) base *= 1 - LEE.shelter * f.s * smoothstep(LEE.from, LEE.to, (x - m.routeX(z)) * f.dir);
  }
  // the fast alternate lines run over the open crest: fully exposed. (W-080) Where one runs, the main
  // line keeps below the crest, in its lee: it takes CREST_LEE.main of the segment's exposure — the
  // sheltered line the storm caption and the reader choose in a front (round 3: equally exposed on
  // crest segments, so the storm-line decision hardly mattered and the crest won even in a storm)
  const al = m.altLane(x, z);
  // (the wind's grip only — with a time, as physics and the weather ask; where the hazards and the lee
  // shoulders are placed, without one, the ground's openness is unchanged)
  if (t !== undefined && CREST_LEE.main < 1 && (m.profile.altRouteX?.(z) ?? null) !== null) base *= CREST_LEE.main;
  return al > 0 ? base + (1 - base) * al : base;
}


const W = { calm: 2.5, storm: 12.5, along: 1.2 } as const;

export const WHITEOUT_WEATHER: WeatherModel = {
  id: 'whiteout',
  coupling: { airborne: 0.13, balance: 0.4, headwind: { relaxed: 0.0002, normal: 0.001, hard: 0.001 }, groundSlip: 0.075, skidDrag: 0.0028 },
  exposure: whiteoutExposure,
  // the lee shoulders either side of the racing line stay free of rock and trees on exposed ground
  clearZones(m, z0, z1) {
    const out: Array<{ x: number; z: number; hx: number; hz: number }> = [];
    const step = 16;
    for (let z = Math.floor(z0 / step) * step + step / 2; z < z1; z += step) {
      const rx = m.routeX(z);
      // (each stretch reaches 12 m past its ends: a skier moving onto or off the shoulder crosses
      // that ground too)
      for (const side of [-1, 1]) if (leeLaneAt(m, z, side)) out.push({ x: rx + side * (LEE.lane - 2), z, hx: LEE.laneHalf + 2, hz: step / 2 + 12 });
    }
    return out;
  },
  front: (t, seed) => frontAt(t, seed, forecast),
  sample(x: number, z: number, t: number, seed: number, out: WeatherSample): WeatherSample {
    const f = frontAt(t, seed, scratch);
    const s = f.s;
    const g = clamp(0.5 + 0.5 * gnoise(t / 4.5, 0.61, seed + 311), 0, 1);
    const gustiness = 0.3 + 0.35 * s;
    const k = 1 + gustiness * (2 * g - 1);
    const speed = (W.calm + (W.storm - W.calm) * s) * k;
    out.windX = f.dir * speed;
    out.windZ = W.along * k;
    out.gust = clamp(gustiness * g * (0.4 + 0.6 * s), 0, 1);
    out.storm = s;
    // fog: the front, plus banks lying in fixed hollows (thicker in fair weather than the clear air)
    const bankN = 0.5 + 0.5 * fbm(x / 340, z / 340, seed + 304, 2);
    const bank = smoothstep(0.66, 0.78, bankN);
    const fog = STORM_FOG.clear + (STORM_FOG.storm - STORM_FOG.clear) * Math.pow(s, 1.3);
    out.visibility = Math.min(24, fog * (1 + (STORM_FOG.bank - 1) * bank * (1 - 0.6 * s)));
    out.snowfall = 0.25 + 2.6 * s;
    return out;
  },
};
const forecast: FrontState = { s: 0, dir: 1, phase: 'clear', left: 0, k: 0 };
const scratch: FrontState = { s: 0, dir: 1, phase: 'clear', left: 0, k: 0 };
