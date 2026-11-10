/**
 * The mountain: a deterministic heightfield driven by a CourseProfile (see profile.ts).
 * Pure functions only — shared by rendering, physics, AI, simulation and tests.
 *
 * Convention: +Y up, the course descends toward +Z. Course progress is measured by Z,
 * which is monotonic along the route, so it is a reliable phase metric.
 */
import { clamp, fbm, gnoise, ridged, smoothstep } from '../core/rng';
import type { SurfaceType } from '../core/types';
import { caveTerrainHeight, CAVE_INFLUENCE_Z, type CaveAnchor } from './caveTerrain';
import { CLASSIC, foreshadowFor, ClassicProfile, GeneratedProfile, type CliffBand, type CourseProfile, type Kicker } from './profile';
import { getBiome, type Biome } from './biome';
import { Coast } from './coast';

export type { Kicker, CliffBand, CourseProfile, Encounter, Sighting, SegmentType, AltRoute } from './profile';
import type { AltRoute } from './profile';
export { CAVE_D, CAVE_FLOOR_RAISE } from './caveTerrain';

export const SEED_DEFAULT = 20261106;
/** coastal locations: share of the valley-wall rise kept on the sea side (a low bank to the rim) */
const SEA_BANK = 0.22;
/** coastal locations: share of the valley cross-section's rise kept on the sea side of the piste */
const SEA_CROSS = 0.4;

/** Classic-course constants (the original 3 km mountain). New code should ask the profile. */
export const COURSE = {
  startZ: 0,
  finishZ: CLASSIC.finishZ,
  caveZ: CLASSIC.caveZ,
  caveTriggerZ: CLASSIC.caveZ + 22,
  foreshadowZ: foreshadowFor(CLASSIC.caveZ),
  tutorialEndZ: CLASSIC.tutorialEndZ,
} as const;

export class Mountain {
  readonly seed: number;
  readonly profile: CourseProfile;
  /** the location this mountain is skied in (look + terrain knobs); see biome.ts */
  readonly biome: Biome;
  // terrain amplitudes from the biome (alpine: the original literals, so heights are bit-identical)
  private readonly kWall: number;
  private readonly kRelief: number;
  private readonly kRanges: number;
  private readonly kUndulation: number;
  private readonly kDetail: number;
  private readonly kMoguls: number;
  private readonly kDrifts: number;
  private readonly kDriftsPowder: number;
  private readonly kRollers: number;
  private kTmp: Kicker[] = [];
  private cTmp: CliffBand[] = [];
  private caveCache: { z0: number; z1: number; list: CaveAnchor[] } = { z0: 1, z1: 0, list: [] };
  /**
   * The sea coast beside the course (biomes with `terrain.coast`, e.g. Fjord Coast): cliffs, fjord
   * water levels, islands, the harbour shore. null for inland locations (Alpine): heights unchanged.
   */
  readonly coast: Coast | null;
  private readonly landAt = (x: number, z: number) => this.landHeight(x, z);

  /**
   * `new Mountain()` / `new Mountain(seed)` → the classic course; pass a profile for any other.
   * `biome` defaults to the default biome (alpine).
   */
  constructor(seedOrProfile: number | CourseProfile = SEED_DEFAULT, seed?: number, biome: Biome = getBiome()) {
    this.biome = biome;
    const t = biome.terrain;
    this.kWall = t.wallHeight;
    this.kRelief = t.wallRelief;
    this.kRanges = t.rangeHeight;
    this.kUndulation = t.undulation;
    this.kDetail = t.detail;
    this.kMoguls = t.moguls;
    this.kDrifts = t.drifts;
    this.kDriftsPowder = t.driftsPowder;
    this.kRollers = t.rollers;
    if (typeof seedOrProfile === 'number') {
      this.seed = seedOrProfile;
      this.profile = new ClassicProfile(seedOrProfile);
    } else {
      this.profile = seedOrProfile;
      this.seed = seed ?? SEED_DEFAULT;
    }
    this.coast = t.coast ? new Coast(this.profile, this.seed, t.coast) : null;
    if (this.coast) this.coast.terrain = (x, z) => this.heightAt(x, z);
  }

  static generated(seed: number, length: number, biome: Biome = getBiome()): Mountain {
    return new Mountain(new GeneratedProfile(seed, length, biome.terrain), seed, biome);
  }

  /** The classic hand-tuned 3 km course (its tracks ignore the biome's scale knobs). */
  static classic(seed: number = SEED_DEFAULT, biome: Biome = getBiome()): Mountain {
    return new Mountain(seed, undefined, biome);
  }

  // --- profile delegates ----------------------------------------------------------------------
  centerX(z: number) {
    return this.profile.centerX(z);
  }
  routeX(z: number) {
    return this.profile.routeX(z);
  }
  halfWidth(z: number) {
    return this.profile.halfWidth(z);
  }
  slopeDeg(z: number) {
    return this.profile.slopeDeg(z);
  }
  baseHeight(z: number) {
    return this.profile.baseHeight(z);
  }
  get finishZ() {
    return this.profile.finishZ;
  }

  private altCache: { z0: number; z1: number; list: AltRoute[] } = { z0: 1, z1: 0, list: [] };
  /** Alternate lines overlapping [z0, z1] (cached per 256 m window). */
  altsNear(z0: number, z1: number): AltRoute[] {
    const c = this.altCache;
    if (z0 >= c.z0 && z1 <= c.z1) return c.list;
    const w0 = Math.floor(z0 / 256) * 256 - 256;
    const w1 = Math.ceil(z1 / 256) * 256 + 256;
    this.altCache = { z0: w0, z1: w1, list: this.profile.altRoutes(w0, w1) };
    return this.altCache.list;
  }

  /**
   * Alternate-line shaping at (x, z): 0..1 lane weight (1 on the line, 0 beyond 7 m, faded in/out
   * over 40 m at the ends). The line is a hard-packed, slightly sunken chute: fast, low grip.
   */
  altLane(x: number, z: number): number {
    const list = this.altsNear(z, z);
    for (const a of list) {
      if (z < a.z0 || z > a.z1) continue;
      const dx = Math.abs(x - this.profile.altX(a, z));
      if (dx > 7) continue;
      const ends = smoothstep(a.z0, a.z0 + 40, z) * (1 - smoothstep(a.z1 - 40, a.z1, z));
      return (1 - smoothstep(3.5, 7, dx)) * ends;
    }
    return 0;
  }

  /** Cave anchors whose influence overlaps [z0, z1] (cached per 256 m window). */
  cavesNear(z0: number, z1: number): CaveAnchor[] {
    const c = this.caveCache;
    if (z0 >= c.z0 && z1 <= c.z1) return c.list;
    const w0 = Math.floor(z0 / 256) * 256 - 256;
    const w1 = Math.ceil(z1 / 256) * 256 + 256;
    const list = this.profile.encounters(w0 - CAVE_INFLUENCE_Z, w1 + CAVE_INFLUENCE_Z).map((e) => e.anchor).filter((a) => a.z + CAVE_INFLUENCE_Z >= w0 && a.z - CAVE_INFLUENCE_Z <= w1);
    this.caveCache = { z0: w0, z1: w1, list };
    return list;
  }

  /** All caves on a finite course / the first few on Endless (convenience for single-cave code). */
  get caves(): CaveAnchor[] {
    return this.profile.encounters(-Infinity, Number.isFinite(this.profile.finishZ) ? this.profile.finishZ : 30000).map((e) => e.anchor);
  }

  /** Terrain height at world (x, z). */
  heightAt(x: number, z: number): number {
    const h = this.landHeight(x, z);
    return this.coast ? this.coast.shape(x, z, h, this.landAt) : h;
  }

  /** Height of the land (everything but a coast's cliffs and sea), at world (x, z). */
  private landHeight(x: number, z: number): number {
    const P = this.profile;
    const s = this.seed;
    const cx = P.centerX(z);
    const d = x - cx;
    const w = P.halfWidth(z);
    const ad = Math.abs(d);
    let h = P.baseHeight(z);

    // summit massif behind the start
    if (z < 0) {
      const b = -z;
      h += 0.00022 * b * b + 0.18 * b;
    }

    // valley cross-section (a coast: the sea side is flatter, so the rim and the sea beyond it sit
    // low in the gameplay view instead of behind a rising bank — art request R1)
    const cross = 0.0016 * d * d * (ad < w ? 1 : w / ad);
    h += this.coast && d < 0 ? cross * SEA_CROSS : cross;
    // each side of the valley has its own character: banks set back further or closer, steeper or gentler
    const side: 1 | -1 = d >= 0 ? 1 : -1;
    const sideW = w * P.sideSetback(z, side);
    const e = Math.max(0, ad - Math.max(w, sideW));
    if (e > 0) {
      const es = e * P.sideSteep(z, side);
      // walls ease in from the piste (gentle banks, then steepening valley sides)
      const wall = this.kWall * (1 - Math.exp(-(es * es) / (2 * 230 * 230))) + 0.0025 * es * es * Math.exp(-es / 120) + 0.04 * es;
      // wall relief: ridged noise gives spurs and gullies, but on its own its sharp creases read as
      // "egg-crate" spikes (A30) — blend in smooth fbm and soften the finest octave
      const rr = ridged(x / 160, z / 160, s + 7, 3);
      const rf = 0.5 + 0.5 * fbm(x / 210, z / 210, s + 17, 3);
      const rough = (0.55 * rr + 0.45 * rf) * this.kRelief * smoothstep(30, 220, e) * (0.6 + 0.4 * P.rockBias(z));
      if (side < 0 && this.coast) {
        // a coast: the sea side is only a low bank up to the cliff rim (open views over the fjord)
        h += (wall + rough) * SEA_BANK;
      } else {
        h += wall + rough;
        // distant ranges
        h += this.kRanges * smoothstep(350, 2600, e) * (0.35 + ridged(x / 900, z / 900, s + 11, 5));
      }
    }

    // rolling large-scale undulation
    h += fbm(x / 210, z / 210, s + 1, 3) * this.kUndulation;
    // mid-scale terrain variation
    h += fbm(x / 46, z / 46, s + 2, 3) * this.kDetail;

    // moguls: in specific zones and along piste edges
    const mogulZone = P.mogulZone(z);
    const edge = smoothstep(w * 0.55, w * 0.9, ad) * (1 - smoothstep(w * 1.1, w * 1.6, ad));
    const mogulAmp = this.kMoguls * clamp(mogulZone * (1 - smoothstep(w * 0.25, w * 0.35, Math.abs(x - P.routeX(z)))) + edge * 0.6, 0, 1);
    if (mogulAmp > 0.001) h += mogulAmp * gnoise(x / 4.2, z / 5.1, s + 3);

    // wind-shaped drifts (anisotropic), mostly off the groomed line
    const driftMask = smoothstep(w * 0.4, w * 1.2, ad);
    if (driftMask > 0.001) h += driftMask * (this.kDrifts + this.kDriftsPowder * P.powderBias(z)) * gnoise(x / 26, z / 7.5, s + 4);

    // rollers across the piste
    const roller = P.rollerZone(z);
    if (roller > 0.001) h += this.kRollers * Math.sin(z / 37) * roller;

    // kickers
    for (const k of P.kickersNear(z - 4, z + 16, this.kTmp)) {
      const u = z - k.z;
      if (u < -k.run || u > 4) continue;
      const lat = Math.abs(d - k.d);
      if (lat > k.width * 0.5 + 3) continue;
      const lm = 1 - smoothstep(k.width * 0.5, k.width * 0.5 + 3, lat);
      let p: number;
      if (u <= 0) {
        const t = (u + k.run) / k.run;
        p = t * t * (1.6 - 0.6 * t); // concave-then-steep transition, lip at u=0
      } else {
        p = 1 - smoothstep(0, 4, u);
      }
      h += k.height * p * lm;
    }

    // cliff bands: raised plateau ending in a drop
    for (const c of P.cliffsNear(z - 6, z + 90, this.cTmp)) {
      const lm = smoothstep(c.dMin - 6, c.dMin, d) * (1 - smoothstep(c.dMax, c.dMax + 6, d));
      if (lm <= 0) continue;
      const plateau = smoothstep(c.z - 80, c.z - 20, z) * (1 - smoothstep(c.z, c.z + 2.2, z));
      h += c.drop * plateau * lm;
    }

    // caves cut into cliffs (terrain cut and cave mesh share src/world/caveTerrain.ts)
    for (const c of this.cavesNear(z, z)) if (Math.abs(z - c.z) < CAVE_INFLUENCE_Z) h = caveTerrainHeight(c, x, z, d, h, s);

    // alternate lines: a shallow sunken chute (reads as a line, channels the skier)
    if (P.kind === 'generated') {
      const al = this.altLane(x, z);
      if (al > 0) h -= 0.7 * al;
    }

    // resort / checkpoint run-outs: flatten
    const flat = P.flatten(z);
    if (flat > 0) {
      const f = flat * (1 - smoothstep(130, 260, ad));
      const target = P.baseHeight(z) + 0.0016 * d * d * 0.2;
      h += (target - h) * f * 0.85;
    }

    return h;
  }

  /** Surface normal by central differences. Writes into out [nx, ny, nz]. */
  normalAt(x: number, z: number, out: { x: number; y: number; z: number }, eps = 0.35): void {
    const hl = this.heightAt(x - eps, z);
    const hr = this.heightAt(x + eps, z);
    const hd = this.heightAt(x, z - eps);
    const hu = this.heightAt(x, z + eps);
    const nx = hl - hr;
    const nz = hd - hu;
    const ny = 2 * eps;
    const l = Math.hypot(nx, ny, nz);
    out.x = nx / l;
    out.y = ny / l;
    out.z = nz / l;
  }

  /** Surface type at a position (drives grip/drag). Must match the terrain shader's look. */
  surfaceAt(x: number, z: number): SurfaceType {
    const v = this.surfaceWeights(x, z);
    if (v.ice > 0.5) return 'ice';
    if (v.powder > 0.5) return 'powder';
    if (v.groomed > 0.5) return 'packed';
    return 'snow';
  }

  /** Continuous surface weights in 0..1 (also baked into terrain vertex attributes). */
  surfaceWeights(x: number, z: number): { ice: number; powder: number; groomed: number } {
    const P = this.profile;
    const s = this.seed;
    const d = x - P.centerX(z);
    const w = P.halfWidth(z);
    const ad = Math.abs(d);
    const iceNoise = fbm(x / 22, z / 30, s + 21, 2);
    const iceZone = 0.25 + 0.75 * P.iceZone(z);
    const ice = smoothstep(0.28, 0.4, iceNoise * iceZone) * (1 - smoothstep(w * 0.8, w, ad)) * smoothstep(120, 160, z);
    const powderNoise = fbm(x / 35, z / 35, s + 22, 2);
    const pb = P.powderBias(z);
    const powder = clamp(smoothstep(w * 0.78, w * 1.05, ad) + smoothstep(0.35 - 0.2 * pb, 0.5 - 0.2 * pb, powderNoise) * smoothstep(w * (0.45 - 0.25 * pb), w * (0.7 - 0.25 * pb), ad), 0, 1) * (1 - ice);
    const groomed = (1 - smoothstep(w * 0.3, w * 0.5, Math.abs(x - P.routeX(z)))) * (1 - ice) * (1 - powder);
    if (P.kind === 'generated') {
      // alternate lines are hard-packed, partly icy: faster, less grip (risk for the time saved)
      const al = this.altLane(x, z);
      if (al > 0) {
        const ice2 = Math.max(ice, 0.75 * al);
        return { ice: ice2, powder: powder * (1 - al), groomed: groomed * (1 - al) };
      }
    }
    return { ice, powder, groomed };
  }
}
