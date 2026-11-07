/**
 * Cave ↔ heightfield contract.
 *
 * A cave is placed by a CaveAnchor (any number of caves can exist on a course). The heightfield
 * calls `caveTerrainHeight` for points near an anchor; the cave mesh (src/world/Cave.ts) is built
 * from the same anchor and the same functions, so the terrain cut and the cave geometry are
 * designed together and never drift apart.
 *
 * Local cave frame: origin at the cliff base on the route-facing side, `u` = distance INTO the hill
 * (along -outward), `v` = lateral (along the downhill direction, +Z), heights are world Y.
 */
import { ridged, smoothstep } from '../core/rng';

export interface CaveAnchor {
  /** Course progress (world Z) of the cave mouth centre. */
  z: number;
  /** World X of the route centreline at `z` (the cave cliff is offset from it). */
  centerX: number;
  /** +1: cliff on the +X side of the piste (mouth faces -X). -1: mirrored. */
  side: 1 | -1;
  /** Lateral distance of the cliff base from the centreline. */
  d: number;
}

/** Lateral offset (from centreline) of the cave cliff base — default placement. */
export const CAVE_D = 46;
/** The cave floor sits this far above the surrounding slope (a rocky ledge). */
export const CAVE_FLOOR_RAISE = 1.6;

/** Outward unit direction of the mouth (toward the piste) in world XZ. */
export function caveOutward(a: CaveAnchor): { x: number; z: number } {
  return { x: -a.side, z: 0 };
}

/** World XZ of the mouth centre (at the cliff base). */
export function caveMouthXZ(a: CaveAnchor): { x: number; z: number } {
  return { x: a.centerX + a.side * (a.d + 2), z: a.z };
}

/** Quick reject radius: points farther than this (in Z) from the anchor are unaffected. */
export const CAVE_INFLUENCE_Z = 120;

/**
 * Height modification for the cliff and the cave notch.
 * @param x,z  world position
 * @param d    signed lateral offset from the centreline at z (x - centerX(z))
 * @param h    terrain height before the cave is applied
 * @param seed world seed
 */
export function caveTerrainHeight(a: CaveAnchor, x: number, z: number, d: number, h: number, seed: number): number {
  const cz = Math.abs(z - a.z);
  if (cz >= CAVE_INFLUENCE_Z) return h;
  const sd = d * a.side; // distance toward the cliff side
  const D = a.d;
  if (sd <= D - 14) return h;
  const zm = 1 - smoothstep(55, 120, cz);
  const rise = smoothstep(D - 2, D + 6, sd);
  // the cliff is lower right around the mouth so the cave's roof can cap it
  const cliffH = 28 - 17 * (1 - smoothstep(9, 26, cz)) * smoothstep(D - 6, D + 2, sd) * (1 - smoothstep(D + 24, D + 40, sd));
  const cliff = zm * (cliffH * rise + 6 * smoothstep(D - 14, D - 2, sd) + ridged(x / 14, z / 14, seed + 9, 3) * 6 * rise);
  // the cave: a notch cut into the cliff at floor level (the cave mesh forms walls/ceiling)
  const notch = (1 - smoothstep(4.0, 6.0, cz)) * smoothstep(D - 7, D - 4, sd) * (1 - smoothstep(D + 27, D + 30, sd));
  return h + cliff * (1 - notch) + notch * CAVE_FLOOR_RAISE;
}
