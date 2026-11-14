/**
 * Weather capability: wind, visibility and snowfall as a pure, deterministic function of
 * (position, time, seed). No three.js, no Math.random: the same course and run time always give
 * the same weather, so it can be tested and replayed.
 *
 * Rendering reads it every frame (Environment.applyWeather: fog density, flake drift/opacity).
 * Physics reads it through the environment hook with an explicit coupling (crosswind acceleration
 * while airborne, balance wobble from gusts while grounded). Alpine's coupling is zero, so its
 * physics are untouched; its sample reproduces the constants the renderer always used
 * (flake drift windX = 1, base fog, base flakes).
 */
import { clamp, fbm, gnoise, smoothstep } from '../../core/rng';

export interface WeatherSample {
  /** wind at the skier, m/s (+X = the skier's left when facing downhill, +Z = downhill) */
  windX: number;
  windZ: number;
  /** × the biome's base fog density (1 = biome default, > 1 = thicker / lower visibility) */
  visibility: number;
  /** × the biome's ambient flake opacity (1 = biome default, 0 = no falling snow) */
  snowfall: number;
  /** 0..1 gustiness right now (drives balance coupling and audio) */
  gust: number;
}

export interface WeatherCoupling {
  /** airborne crosswind: acceleration (m/s²) = airborne × wind (m/s). 0 = none. Keep ≤ ~0.15. */
  airborne: number;
  /** grounded balance: wobble = balance × gust (0..1). 0 = none. Keep ≤ ~0.5. */
  balance: number;
}

export interface WeatherModel {
  readonly id: string;
  /** true when `sample` never changes (lets the engine sample once) */
  readonly static?: boolean;
  readonly coupling: WeatherCoupling;
  sample(x: number, z: number, t: number, seed: number, out: WeatherSample): WeatherSample;
}

export function makeWeatherSample(): WeatherSample {
  return { windX: 1, windZ: 0, visibility: 1, snowfall: 1, gust: 0 };
}

export const CALM: Readonly<WeatherCoupling> = Object.freeze({ airborne: 0, balance: 0 });

/** Alpine: today's constants (flakes drift with windX = 1; base fog; base snowfall; no physics). */
export const ALPINE_WEATHER: WeatherModel = {
  id: 'alpine',
  static: true,
  coupling: CALM,
  sample(_x, _z, _t, _seed, out) {
    out.windX = 1;
    out.windZ = 0;
    out.visibility = 1;
    out.snowfall = 1;
    out.gust = 0;
    return out;
  },
};

export interface ParametricWeather {
  id: string;
  /** mean wind, m/s */
  wind: readonly [number, number];
  /** gust amplitude as a fraction of the mean (0..1.5) and gust timescale (s) */
  gustiness: number;
  gustPeriod: number;
  /** slow weather fronts: period (s) and how far visibility/snowfall swing over a front */
  frontPeriod: number;
  visibility: readonly [number, number];
  snowfall: readonly [number, number];
  /** local fog banks: probability-like coverage 0..1 and the visibility multiplier inside one */
  fogBanks?: { coverage: number; visibility: number; size: number };
  coupling: WeatherCoupling;
}

/**
 * A ready-made deterministic model: mean wind + gusts (time noise), slow "fronts" that move
 * visibility and snowfall between their ranges, and optional stationary fog banks (space noise).
 * Fjord: light steady crosswind, clear. Whiteout: strong gusts, fronts, fog banks.
 */
export function parametricWeather(p: ParametricWeather): WeatherModel {
  return {
    id: p.id,
    coupling: p.coupling,
    sample(x, z, t, seed, out) {
      const g = clamp(0.5 + 0.5 * gnoise(t / p.gustPeriod, 0.37, seed + 101), 0, 1);
      const k = 1 + p.gustiness * (2 * g - 1);
      // the gust direction wanders slightly
      const veer = 0.25 * gnoise(t / (p.gustPeriod * 3), 1.7, seed + 102);
      const c = Math.cos(veer);
      const s = Math.sin(veer);
      out.windX = (p.wind[0] * c - p.wind[1] * s) * k;
      out.windZ = (p.wind[0] * s + p.wind[1] * c) * k;
      out.gust = clamp(p.gustiness * g, 0, 1);
      const front = smoothstep(-0.4, 0.4, fbm(t / p.frontPeriod, 0.5, seed + 103, 2));
      out.visibility = p.visibility[0] + (p.visibility[1] - p.visibility[0]) * front;
      out.snowfall = p.snowfall[0] + (p.snowfall[1] - p.snowfall[0]) * front;
      if (p.fogBanks) {
        const n = 0.5 + 0.5 * fbm(x / p.fogBanks.size, z / p.fogBanks.size, seed + 104, 2);
        const inBank = smoothstep(1 - p.fogBanks.coverage, 1 - p.fogBanks.coverage + 0.12, n);
        out.visibility *= 1 + (p.fogBanks.visibility - 1) * inBank;
      }
      return out;
    },
  };
}

/** Problems with a model (empty = fine): sample it over a grid of space/time. */
export function validateWeather(m: WeatherModel, seed = 1): string[] {
  const out: string[] = [];
  const c = m.coupling;
  if (!(c.airborne >= 0 && c.airborne <= 0.3)) out.push(`coupling.airborne=${c.airborne} outside [0, 0.3]`);
  if (!(c.balance >= 0 && c.balance <= 1)) out.push(`coupling.balance=${c.balance} outside [0, 1]`);
  const s = makeWeatherSample();
  for (let t = 0; t < 600; t += 37)
    for (let z = 0; z < 6000; z += 1300) {
      m.sample(0, z, t, seed, s);
      if (![s.windX, s.windZ, s.visibility, s.snowfall, s.gust].every(Number.isFinite)) out.push(`non-finite sample at z=${z} t=${t}`);
      else if (s.visibility <= 0 || s.visibility > 12) out.push(`visibility=${s.visibility} outside (0, 12] at z=${z} t=${t}`);
      else if (s.snowfall < 0 || s.snowfall > 4) out.push(`snowfall=${s.snowfall} outside [0, 4]`);
      else if (Math.hypot(s.windX, s.windZ) > 40) out.push(`wind ${Math.hypot(s.windX, s.windZ).toFixed(1)} m/s > 40`);
      if (out.length > 4) return out;
    }
  return out;
}
