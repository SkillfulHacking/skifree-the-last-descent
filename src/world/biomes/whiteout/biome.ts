/**
 * Whiteout Ridge (`whiteout`, code WHITE): difficulty 3/5, "Stormy".
 *
 * A high, bare ridge above the treeline where the weather is the course: storm fronts roll over in
 * cycles (clear vista windows → a telegraphed build → a storm with ~80 m visibility and a strong
 * crosswind → easing), localized blizzard cells sweep across the exposed stretches, wind drifts lie
 * across the open slopes, fog banks sit in the hollows, and the snow is wind-scoured hard pack on
 * the exposed ground (fast, little grip) and soft in the sheltered gullies and the last trees.
 *
 * Decisions the weather asks for, all telegraphed (sky, snow drift, wind audio, HUD): take the
 * exposed fast lines (hard pack, full crosswind, blizzards) or the sheltered ones (soft, calm,
 * slower); ski into a blizzard blind or check speed and let it blow through; pick the gap in a row
 * of drifts. Low visibility is kept fair: illuminated trail markers along the racing line show the
 * way through a whiteout, the fog never closes in below ~80 m, and the HUD's Yeti and snowball cues
 * are drawn over the weather.
 *
 * The Yeti is never faster here (brief): the game difficulty scales only the environment's
 * intensity. Pure data + pure models (no three.js); the presentation is registered in ./views.
 */
import { smoothstep } from '../../../core/rng';
import { ALPINE, deriveBiome, type Biome } from '../../biome';
import { resetSurface, type SurfaceModel } from '../../capabilities';
import { WHITEOUT_WEATHER, whiteoutExposure } from './storm';
// the drift rows' gaps are kept clear of obstacles by the hazard field module (it installs the hook)
import '../../hazards/field';

export const WHITEOUT_ID = 'whiteout';

/**
 * Wind-scoured hard pack on exposed ground (× at full exposure): faster (less friction), less edge
 * (grip, longer carve); soft wind-sheltered snow in the trees and gullies: slower.
 */
export const HARDPACK = { friction: 0.72, grip: 0.7, carveRadius: 1.18 } as const;
export const SOFT = { friction: 1.16, dragAdd: 0.0025 } as const;

export const WHITEOUT_SURFACE: SurfaceModel = {
  id: 'whiteout',
  modifiers(q, out) {
    resetSurface(out);
    const m = q.mountain;
    if (!m) return;
    const e = whiteoutExposure(m, q.x, q.z);
    const hard = smoothstep(0.62, 0.95, e);
    const soft = 1 - smoothstep(0.3, 0.5, e);
    if (hard > 0) {
      out.friction = 1 + (HARDPACK.friction - 1) * hard;
      out.grip = 1 + (HARDPACK.grip - 1) * hard;
      out.carveRadius = 1 + (HARDPACK.carveRadius - 1) * hard;
    } else if (soft > 0) {
      out.friction = 1 + (SOFT.friction - 1) * soft;
      out.dragAdd = SOFT.dragAdd * soft;
    }
  },
};

export function makeWhiteoutBiome(): Biome {
  return deriveBiome(ALPINE, {
    id: WHITEOUT_ID,
    code: 'WHITE',
    name: 'Whiteout Ridge',
    description: 'A storm-swept ridge: fronts, blizzards and drifts.',
    // high, cold, overcast light; the sun low and pale (the storms dim it further: Environment.applyWeather)
    sky: { turbidity: 6.5, rayleigh: 0.9, mieCoefficient: 0.009, mieDirectionalG: 0.78, sunElevation: 17, sunAzimuth: 205 },
    lighting: {
      sunColor: [0.93, 0.9, 0.86],
      sunIntensity: 3.6,
      hemiSky: [0.62, 0.7, 0.86],
      hemiGround: [0.66, 0.7, 0.78],
      hemiIntensity: 0.42,
      envIntensity: 0.42,
      envGround: 0x9aa6b8,
      exposure: 0.82,
    },
    // clear windows still have high-altitude haze; the storm fronts thicken it (WeatherModel)
    atmosphere: { fogColor: [0.74, 0.79, 0.86], fogDensity: 0.00085, sunHaze: [0.95, 0.92, 0.86], linear: 1 / 26000, falloff: 1 / 1400, maxFogDensity: 0.016 },
    weather: { flakeDensity: 1.25, flakeSize: 0.075, flakeOpacity: 0.85, flakeColor: 0xf4f8ff },
    terrainLook: {
      snow: [0.86, 0.9, 0.95],
      windSlab: [0.76, 0.82, 0.9],
      packed: [0.74, 0.79, 0.86],
      powder: [0.9, 0.93, 0.97],
      ice: [0.58, 0.68, 0.8],
      // dark granite and frost-shattered schist
      rockA: [0.12, 0.125, 0.135],
      rockB: [0.2, 0.2, 0.205],
      rockC: [0.055, 0.058, 0.066],
      shadeTint: [0.86, 0.92, 1.08],
      // (round 3, W-065) the valley under the ridge reads as depth: the far flank and floor, well below
      // the eye, darker and colder than the snow beside the piste
      valleyShade: { tint: [0.42, 0.5, 0.62], amount: 0.75, below: [40, 260], dist: [220, 800] },
      // (Round 5, W-065: four blind reads — "the drop is implied, not shown") the flank beyond the rim is
      // wind-scoured bare rock, dark blue-grey with snow in its gullies: from the line the rim is where the
      // snow ends against a dark band falling away
      scouredFlank: { rock: [0.16, 0.18, 0.22], slope: [0.16, 0.26], below: [6, 22], streak: 0.55 },
      skylightTint: [0.9, 0.96, 1.15],
    },
    ranges: { skyColor: [0.6, 0.67, 0.78], snow: [0.9, 0.92, 0.96], stoneDark: [0.11, 0.115, 0.13], stoneLight: [0.3, 0.31, 0.33], lowland: [0.2, 0.22, 0.26], horizonHaze: 0.8, soft: 0.8 },
    trees: {
      species: [
        // stunted krummholz spruce at the treeline: short, dense, flagged
        { name: 'Krummholz spruce', height: 4.2, crownBase: 0.05, baseR: 1.9, whorls: 7, maxBranches: 6, droop0: 0.5, droop1: 0.15, gap: 0.22, needle: [0.03, 0.07, 0.06], lean: 0.22 },
        // subalpine fir in the sheltered gullies
        { name: 'Subalpine fir', height: 8.5, crownBase: 0.08, baseR: 1.6, whorls: 10, maxBranches: 6, droop0: 0.62, droop1: 0.12, gap: 0.08, needle: [0.028, 0.072, 0.065], lean: 0.04 },
        // a rime-plastered snag
        { name: 'Rimed snag', height: 6.5, crownBase: 0.35, baseR: 1.3, whorls: 5, maxBranches: 4, droop0: 0.3, droop1: 0.1, gap: 0.45, needle: [0.05, 0.08, 0.07], lean: 0.12 },
      ],
      speciesWeights: [0.5, 0.35, 0.15],
      bark: [0.27, 0.22, 0.19],
      tintA: [0.85, 0.95, 1.05],
      tintB: [1.0, 1.0, 0.95],
      snow: [0.93, 0.95, 0.99],
      density: 0.2,
      decorDensity: 0.7,
    },
    rocks: { base: [0.21, 0.215, 0.225], tintCool: [0.92, 0.97, 1.05], tintWarm: [1.04, 1.0, 0.95], tintDark: [0.5, 0.52, 0.56], snow: [0.92, 0.94, 0.98], scan: ['boulder_01', 'namaqualand_boulder_02', 'namaqualand_boulder_06'] },
    obstacles: { rocks: 1.5, logs: 0.1, stumps: 0.25, cellStream: true },
    terrain: {
      // (W-077) Alpine's fixed Yeti pace is Alpine's own (deriveBiome would inherit it): unchanged here
      encounterPace: 1,
      // (Round 5, W-095: on Normal a competent weather reader was never pressed — the gap only grew)
      // Normal's fixed pace ×1.06: a clean run still escapes; mistakes and slow lines now cost ground
      difficultyPace: { normal: 1.06, hard: 1 },
      // a high bare ridge: broad open bowls and ridgelines, with sheltered gullies and the last
      // trees lower down; steeper and more varied than Fjord's even runs
      slopeScale: 1.0,
      widthScale: 1.12,
      swingScale: 1.1,
      segmentWeights: { alpine: 1.6, highspeed: 1.2, powder: 0.6, basin: 1.8, ridgeline: 2.4, cliffside: 0.5, beginner: 0.4, forest: 1.1, chute: 1.0, moguls: 0.5 },
      // (round 3, R2 F N1) the floor is 14°, not 11°: a storm's headwind and skid drag hold a tucked
      // skier at ~12–14 m/s on 11° ground, below the Yeti's 16.5 m/s, so a long gentle traverse in a
      // front (Classic: 580 m at 11°) was a catch no line or stance could avoid. At 14° the weather
      // reader keeps ahead in the storm; ploughing the drift rows still loses ground (the skill).
      // (W-080, round 4) 15°: on Hard (Yeti 17.7 m/s) a tucked expert in a full storm on 14° ground held
      // ~16–17 m/s, so a storm over the floor was a catch for a perfect run (balance/w080/README.md)
      minSlope: 15,
      startSlope: 8,
      // fast alternate lines over the exposed crests (the risky choice in a storm)
      altTypes: ['alpine', 'highspeed', 'basin', 'ridgeline', 'chute', 'forest'],
      // on the ridge, not in a valley: low, broken shoulders either side of the piste (the sky and
      // the storm visible over them) and big peaks far off across the void, seen in the clear windows
      // the course runs along the ridge's shoulder: on the right the ground rolls over and falls
      // away into open air (the storms come over it); the caves are cut into the left side
      // (full production) the top of a broad ridge: on the right the bank rolls over a corniced rim
      // and the flank falls ~520 m into the valley; on the left a broken rocky crest (35–75 m) with
      // the ground falling away behind it — sky and storms on both sides. The caves are cut into
      // the crest side.
      // (round 2, W-041) the rim 10 m off the piste (was 26) behind a low 1.5 m lip (was 3.5): where the line
      // runs on the drop side the fall-away is in the gameplay camera's view, not hidden by a bank
      // (round 3, W-065: from the line the rim stood 5–8 m above the eye, so nothing past it showed)
      // the drop-side bank no longer climbs to the rim: it rolls down 2 m to it
      // (round 4, W-065 / W-093) farRanges 0.3: the ranges beyond the drop rise out of the valley cloud
      // sea below eye height — the drop reads as depth, not as a plateau above a plain (blind review A)
      ridge: { dropSide: 1, rim: 10, lip: 1.5, depth: 520, flank: 680, crest: 75, crestE: 150, backDrop: 380, rollDown: 2, farRanges: 0.3 },
      caveSide: -1,
      wallHeight: 130,
      wallRelief: 95,
      rangeHeight: 1400,
      rangeSoft: 0.4,
      undulation: 9,
      detail: 1.8,
      moguls: 0.3,
      // wind-sculpted: big drifts and sastrugi
      drifts: 1.7,
      driftWarp: 1,
      driftsPowder: 1.1,
      rollers: 0.9,
    },
    audio: { ambience: 'wind', windGain: 1.15, windPitch: 0.92 },
    capabilities: {
      surface: WHITEOUT_SURFACE,
      weather: WHITEOUT_WEATHER,
      // drifts and blizzards on every difficulty; Relaxed softer, long courses × 0.85 (as Fjord)
      // (Round 5, W-094) Hard is the storm, not the Yeti: stronger weather on Hard (× 1.1, was 0.8 as on
      // Normal), and it builds down the mountain past 3 km (× 1.5 by 8 km) — a long descent now costs more
      // than a short one; the Sprint course and the Yeti are untouched by the build-up
      hazards: { kinds: ['wind-drift', 'blizzard'], density: 1, intensity: { relaxed: 0.5, normal: 0.8, hard: 1.1 }, longCourse: 0.85, builds: { from: 3000, to: 8000, amount: { hard: 0.5 } } },
      finish: { id: 'whiteout-rescue' },
      refuge: { id: 'ridge-rescue-hut', name: 'Rescue hut' },
      cave: { id: 'whiteout-storm-cave' },
      scenery: { id: 'whiteout-ridge' },
      audio: { ambience: ['wind'] },
      rating: { level: 3, label: 'Stormy' },
    },
  });
}
