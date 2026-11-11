/**
 * Fjord Coast (`fjord`, code FJORD): difficulty 2/5, "Scenic".
 *
 * Snowy coastal mountains above a Scandinavian fjord: the piste runs along the top of enormous sea
 * cliffs (the coast capability, src/world/coast.ts), with cold blue water far below, islands and
 * skerries, a mountain range across the fjord and the open sea beyond a harbour finish. Low, warm
 * Nordic winter sun over the water, crisp clear air (long views), sparse pines and wind-bent spruce
 * high up, dark gneiss rock.
 *
 * Gameplay (environment-driven, never a faster Yeti): wide open, steady runs (no segment flatter
 * than 11°) with alternate lines; ridgeline spines with gap jumps; a gentle onshore crosswind on
 * airborne skiers (weather coupling); wind gates on exposed stretches of the racing line (round 4:
 * a rock rib with a gusty notch on its sea side and a drifted lee on its land side), squalls over jumps, and wind-scoured rock on and beside the line
 * (./hazards.ts); a cornice along the cliff rim that bogs down anyone who heads for the edge (the
 * surface model below) with an updraft and an out-of-bounds recovery for anyone who jumps it
 * (capabilities/environment.ts); and optional viewpoints on the rim in the stretches where nothing
 * is chasing you (Coast.lookouts).
 *
 * Pure data + pure models (no three.js); the presentation is registered in ./views.
 */
import { smoothstep } from '../../../core/rng';
import { ALPINE, deriveBiome, type Biome } from '../../biome';
import { parametricWeather, resetSurface, type SurfaceModel, type SurfaceQuery } from '../../capabilities';
import type { CoastParams } from '../../coast';

export const FJORD_ID = 'fjord';

/** Coast tuning: fjord arms ~3.4 km long, walls 0.3–1.3 km high, a harbour quay at the finish. */
export const FJORD_COAST: CoastParams = {
  reach: 3400,
  margin: [40, 130],
  rim: [22, 70],
  steep: [0.3, 0.58],
  far: [2600, 4300],
  farHeight: [700, 1500],
  depth: 180,
  // a low cornice lip (the cornice's heavy snow, the updraft and the out-of-bounds recovery are
  // what keep skiers off the edge): the sea stays in view from the piste (art request R1)
  berm: [2.5, 4.5],
  quay: 2.4,
  // the waterfront in the mid-ground of the run-out and the finish frames (art request R5)
  quayZ: 120,
  // on open stretches the cliff rim runs 46–72 m from the racing line (art request R1)
  nearRim: [46, 72],
};

/**
 * Cornice guard: extra drag / friction at full guard strength (over the last ~20 m to the edge).
 * The heavy snow resists travel toward the sea: `heading` is the range of the seaward direction
 * cosine over which it comes in (full from ≈ 53° toward the sea, a fifth of it running along the rim,
 * none heading inland), so turning back inland — or even along the rim — always gets the skier
 * moving again, slowly or from a standstill (no invisible trap; CORNICE_STALL is the backstop).
 */
export const CORNICE = { dragAdd: 0.12, friction: 10, grip: 0.7, heading: [-0.25, 0.6] } as const;

/** 0..1: how much of the cornice's resistance applies to travel with horizontal velocity (vx, vz) */
export function corniceHeading(rimSlope: number, vx: number | undefined, vz: number | undefined): number {
  if (vx === undefined || vz === undefined) return 1;
  const v = Math.hypot(vx, vz);
  if (v < 1e-6) return 1;
  // toward the sea = up the beyond-rim gradient (−1, rimX′(z)) (the sea is on −X)
  const cos = (-vx + rimSlope * vz) / (v * Math.hypot(1, rimSlope));
  return smoothstep(CORNICE.heading[0], CORNICE.heading[1], cos);
}

/**
 * Ridgeline spines (profile spine lines): wind-packed hard snow on the crest — the fastest snow on
 * the course (× friction) and, unlike the icy alternate lines elsewhere, it holds an edge (× grip,
 * which brings the alternate line's ice grip back to about packed snow).
 */
export const SPINE_SNOW = { friction: 0.3, grip: 3.1 } as const;

/** 0..1 weight of a ridgeline spine's lane at (x, z) (0 off it) */
function spineLane(m: NonNullable<SurfaceQuery['mountain']>, x: number, z: number): number {
  for (const a of m.altsNear(z, z)) {
    if (a.bow === undefined || z < a.z0 || z > a.z1) continue;
    return m.altLane(x, z);
  }
  return 0;
}

/**
 * Fjord surface: the snow skis like Alpine snow everywhere on the course; only the deep, wind-loaded
 * cornice behind the cairns along the cliff rim changes the numbers (continuous, so the edge of
 * the zone is felt as the snow getting heavier, not as a wall).
 */
export const FJORD_SURFACE: SurfaceModel = {
  id: 'fjord',
  modifiers(q, out) {
    resetSurface(out);
    const m = q.mountain;
    const c = m?.coast;
    if (!m || !c) return;
    const sp = spineLane(m, q.x, q.z);
    if (sp > 0) {
      out.friction = 1 + (SPINE_SNOW.friction - 1) * sp;
      out.grip = 1 + (SPINE_SNOW.grip - 1) * sp;
      return;
    }
    const g = c.guard(q.x, q.z);
    if (g <= 0) return;
    const r = g * corniceHeading((c.rimX(q.z + 1) - c.rimX(q.z - 1)) / 2, q.vx, q.vz);
    out.dragAdd = CORNICE.dragAdd * r;
    out.friction = 1 + (CORNICE.friction - 1) * r;
    out.grip = 1 + (CORNICE.grip - 1) * g;
  },
};

/**
 * Fjord weather: clear and crisp, a steady onshore breeze (+X, off the sea) with gusts, a few
 * flakes blowing off the ridges. Coupled to physics only while airborne (≤ ~0.6 m/s² from the
 * breeze; squalls add more), so grounded skiing is never pushed.
 */
export const FJORD_WEATHER = parametricWeather({
  id: 'fjord',
  wind: [3.4, 0.5],
  gustiness: 0.45,
  gustPeriod: 6.5,
  frontPeriod: 260,
  visibility: [0.85, 1.12],
  snowfall: [0.2, 0.6],
  coupling: { airborne: 0.12, balance: 0 },
});

export function makeFjordBiome(): Biome {
  return deriveBiome(ALPINE, {
    id: FJORD_ID,
    code: 'FJORD',
    name: 'Fjord Coast',
    description: 'Sea cliffs above a cold fjord, a harbour finish by the open sea.',
    // low Nordic winter sun over the fjord (from the sea side, slightly behind the skier)
    sky: { turbidity: 1.9, rayleigh: 1.3, mieCoefficient: 0.0032, mieDirectionalG: 0.84, sunElevation: 12.5, sunAzimuth: 258 },
    lighting: {
      sunColor: [1.0, 0.79, 0.6],
      sunIntensity: 4.5,
      hemiSky: [0.36, 0.53, 1.0],
      hemiGround: [0.5, 0.58, 0.7],
      hemiIntensity: 0.27,
      envIntensity: 0.34,
      envGround: 0x7b8ba4,
      exposure: 0.8,
    },
    // crisp, clear air: long views across the fjord; haze stays thin over the water
    atmosphere: { fogColor: [0.68, 0.79, 0.93], fogDensity: 0.000125, sunHaze: [1.0, 0.84, 0.66], linear: 1 / 46000, falloff: 1 / 2600 },
    weather: { flakeDensity: 0.3, flakeSize: 0.07, flakeOpacity: 0.55, flakeColor: 0xffffff },
    terrainLook: {
      snow: [0.88, 0.92, 0.975],
      windSlab: [0.79, 0.855, 0.935],
      packed: [0.78, 0.835, 0.915],
      powder: [0.9, 0.935, 0.98],
      ice: [0.55, 0.68, 0.82],
      // Scandinavian gneiss: blue-grey, dark bands, a little lichen-brown
      rockA: [0.095, 0.105, 0.122],
      rockB: [0.17, 0.163, 0.155],
      rockC: [0.042, 0.047, 0.057],
      shadeTint: [0.84, 0.93, 1.12],
      skylightTint: [0.84, 0.97, 1.28],
    },
    ranges: { skyColor: [0.46, 0.61, 0.88], snow: [0.93, 0.95, 0.995], stoneDark: [0.085, 0.095, 0.115], stoneLight: [0.24, 0.255, 0.28], lowland: [0.06, 0.075, 0.09], openSector: { center: 2.2, halfWidth: 1.35, floor: 0.03 }, horizonHaze: 0.62 },
    trees: {
      species: [
        // Scots pine: tall bare red-brown trunk, a high, open, flat-topped crown
        { name: 'Scots pine', height: 12.5, crownBase: 0.52, baseR: 2.3, whorls: 6, maxBranches: 5, droop0: 0.12, droop1: 0.03, gap: 0.32, needle: [0.045, 0.095, 0.055], lean: 0.14 },
        // coastal spruce: narrow and dark
        { name: 'Coastal spruce', height: 9.2, crownBase: 0.1, baseR: 1.9, whorls: 10, maxBranches: 6, droop0: 0.6, droop1: 0.12, gap: 0.1, needle: [0.03, 0.082, 0.07], lean: 0.05 },
        // wind-bent spruce on the exposed rim: short, ragged, leaning away from the sea
        { name: 'Wind-bent spruce', height: 6.2, crownBase: 0.18, baseR: 1.8, whorls: 7, maxBranches: 5, droop0: 0.42, droop1: 0.1, gap: 0.3, needle: [0.04, 0.088, 0.062], lean: 0.32 },
      ],
      speciesWeights: [0.42, 0.36, 0.22],
      bark: [0.33, 0.2, 0.13],
      tintA: [0.8, 0.98, 1.1],
      tintB: [1.12, 1.04, 0.84],
      snow: [0.86, 0.9, 0.96],
      density: 0.42,
      decorDensity: 0.55,
    },
    rocks: { base: [0.19, 0.198, 0.21], tintCool: [0.9, 0.97, 1.06], tintWarm: [1.1, 1.02, 0.92], tintDark: [0.5, 0.52, 0.58], snow: [0.88, 0.91, 0.965] },
    obstacles: { rocks: 1.7, logs: 0.25, stumps: 0.35 },
    terrain: {
      // round 3 (B N1, F2): the round-2 terrain (minSlope 14, highspeed-heavy, swing 0.8) made the
      // Fjord the faster mountain on unseen seeds. The terrain alone now skis like Alpine's for a
      // skilled skier (measured route gradient on 8 unseen seeds: Sprint 14.8° / Standard 15.8° /
      // Endurance 15.5°, against Alpine's 14.8° / 16.5° / 16.2°; the same line swing) and the
      // location's extra difficulty comes from its environment (./hazards.ts). Large open runs
      // and exposed ridgelines still dominate; the floor keeps flat run-ins out.
      slopeScale: 0.92,
      widthScale: 1.08,
      swingScale: 1,
      segmentWeights: { alpine: 3, highspeed: 1.4, powder: 1.2, basin: 1.0, ridgeline: 2.2, cliffside: 1.2, beginner: 0.6, forest: 0.8, chute: 0.4, moguls: 0.8 },
      minSlope: 11,
      // the run-in from the start gate drops a little more steeply, so the snow's undulation never
      // stalls a skier who has not learned to skate yet (E6)
      startSlope: 8,
      // the Yeti's caves are cut into the sea side, the fjord showing over them (art request R4)
      caveSide: -1,
      altTypes: ['alpine', 'highspeed', 'powder', 'basin', 'ridgeline', 'cliffside', 'forest'],
      // ridgeline shortcuts: every ridgeline gets a spine line on the crest (bowed a little toward
      // the sea, wind-packed fast snow: SPINE_SNOW) with a gully to jump from a take-off halfway
      // along; the piste below it is scoured to rock (./hazards.ts). Optional, ~1 s faster.
      // round 3 (B5): also on cliffside runs (the other exposed segment type), bowed further out
      // so it is a separate line on most of them (inland where the rim leaves no room)
      spine: { types: ['ridgeline', 'cliffside'], bow: 0.42, side: -1, gap: true },
      wallHeight: 380,
      wallRelief: 170,
      rangeHeight: 1150,
      undulation: 8,
      detail: 1.6,
      moguls: 0.36,
      drifts: 1.1,
      driftsPowder: 0.7,
      rollers: 0.7,
      coast: FJORD_COAST,
    },
    audio: { ambience: 'wind', windGain: 0.85, windPitch: 1.08 },
    capabilities: {
      surface: FJORD_SURFACE,
      weather: FJORD_WEATHER,
      // the same gates, squalls and rock on every difficulty (course codes describe one course); the
      // game difficulty scales how hard they punish, never whether the choice matters (round 4, D7/B3):
      // Relaxed 0.6 (softer push, knock and drift: the same choices, smaller stakes), Hard 1.2 (the
      // Yeti is not touched: brief §2). Round 3's Relaxed 0.25 effectively switched the location off.
      hazards: { kinds: ['sea-gust', 'scoured-rock', 'gap-marker'], density: 1, intensity: { relaxed: 0.5, normal: 1, hard: 1.2 } },
      finish: { id: 'fjord-harbour' },
      refuge: { id: 'coastal-shelter', name: 'Coastal shelter' },
      cave: { id: 'fjord-sea-cave' },
      scenery: { id: 'fjord-coast' },
      audio: { ambience: ['wind', 'surf', 'gulls'] },
      rating: { level: 2, label: 'Scenic' },
    },
  });
}
