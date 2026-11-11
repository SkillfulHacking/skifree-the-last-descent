/**
 * Sea framing for the Fjord cave cinematic (round 4, Phase B: "the Fjord cinematic lost its ocean
 * framing"). Since round 4 every Fjord cave is cut into the sea side of the piste with its mouth
 * facing inland, so round 3's "seaward" test (mouth looking out over the sea) was false for every
 * cave and the emergence fell back to a shot with no sea in it.
 *
 * Here the emergence and the leap pick their camera from a small, fixed set of stations around the
 * cave by casting rays through the frame against the actual terrain and water: the station whose
 * frame shows the most open water — with the subject in clear view (terrain and every dressing prop
 * out of the sight line) — wins. Deterministic (pure function of the mountain, the cave and the
 * props), computed once in the dressing's time slices, never in the cinematic's frame.
 */
import * as THREE from 'three';
import type { Mountain } from '../../../course';

export interface SeaPose {
  cam: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
  /** the frame is turned this far (rad, about +Y) from the subject: the subject sits off-centre, the sea fills the other side */
  yaw: number;
  /** share of the frame's sample rays that end on open water */
  water: number;
}

/** fraction of a 7×4 grid of rays through the frame that reach open water first */
export function waterFraction(m: Mountain, cam: THREE.Vector3, look: THREE.Vector3, fov: number, aspect = 16 / 9): number {
  const job = waterFractionSteps(m, cam, look, fov, aspect);
  let r = job.next();
  while (!r.done) r = job.next();
  return r.value;
}

/** the same, yielding after each row of rays (a row costs a few ms of height samples) */
export function* waterFractionSteps(m: Mountain, cam: THREE.Vector3, look: THREE.Vector3, fov: number, aspect = 16 / 9, nx = 7, ny = 4): Generator<void, number, void> {
  const coast = m.coast;
  if (!coast) return 0;
  const fwd = look.clone().sub(cam).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd);
  const ty = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const tx = ty * aspect;
  let hits = 0;
  const p = new THREE.Vector3();
  const d = new THREE.Vector3();
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const sx = ((i + 0.5) / nx) * 2 - 1;
      const sy = ((j + 0.5) / ny) * 2 - 1;
      d.copy(fwd).addScaledVector(right, sx * tx).addScaledVector(up, sy * ty).normalize();
      let t = 2;
      while (t < 7000) {
        p.copy(cam).addScaledVector(d, t);
        const h = m.heightAt(p.x, p.z);
        const lv = coast.seaLevelAt(p.z);
        if (p.y <= Math.max(h, lv)) {
          if (h < lv - 0.5) hits++;
          break;
        }
        if (d.y > 0 && p.y > cam.y + 1500) break;
        t += 2 + t * 0.11;
      }
    }
    if (j < ny - 1) yield;
  }
  return hits / (nx * ny);
}

/** the segment cam→subject stays above the terrain and clear of every prop (spheres) */
export function clearShot(m: Mountain, cam: THREE.Vector3, subject: THREE.Vector3, props: Array<{ p: THREE.Vector3; r: number }>): boolean {
  if (cam.y < m.heightAt(cam.x, cam.z) + 1.6) return false;
  const seg = subject.clone().sub(cam);
  const len = seg.length();
  for (let k = 1; k < 12; k++) {
    const q = cam.clone().addScaledVector(seg, k / 12);
    if (q.y < m.heightAt(q.x, q.z) + 0.3) return false;
  }
  const dir = seg.clone().divideScalar(len);
  for (const pr of props) {
    const v = pr.p.clone().sub(cam);
    const along = THREE.MathUtils.clamp(v.dot(dir), 0, len);
    const dist = v.distanceTo(dir.clone().multiplyScalar(along));
    if (dist < pr.r + 0.4) return false;
    if (pr.p.distanceTo(cam) < pr.r + 1.5) return false;
  }
  return true;
}

/**
 * Best sea-framing pose among `stations` (time-sliced: yields after each station). Returns null when
 * no station both sees the subject and shows at least `minWater` of open water.
 */
export function* bestSeaPose(m: Mountain, subject: THREE.Vector3, stations: THREE.Vector3[], props: Array<{ p: THREE.Vector3; r: number }>, fov: number, minWater = 0.05): Generator<void, SeaPose | null, void> {
  let best: SeaPose | null = null;
  let bestScore = -Infinity;
  // the subject in the centre, or a third of the way in from either side (the frame turned toward the sea)
  const hfov = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * (16 / 9));
  for (const cam of stations) {
    yield;
    if (!clearShot(m, cam, subject, props)) continue;
    for (const yaw of [0, 0.42 * hfov, -0.42 * hfov]) {
      const look = turnedLook(cam, subject, yaw);
      const w = yield* waterFractionSteps(m, cam, look, fov);
      // (closer stations win a near tie: the Yeti must stay large in frame)
      const score = w - 0.0025 * cam.distanceTo(subject);
      if (w >= minWater && (!best || score > bestScore + 1e-9)) {
        best = { cam: cam.clone(), look, fov, water: w, yaw };
        bestScore = score;
      }
    }
  }
  return best;
}

/** the look point turned `yaw` rad about +Y around the camera from the subject */
export function turnedLook(cam: THREE.Vector3, subject: THREE.Vector3, yaw: number): THREE.Vector3 {
  return subject.clone().sub(cam).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(cam);
}

/**
 * The stations: for the emergence (the Yeti at the mouth), out in front of the cave and to either
 * side, at two heights; for the leap (the Yeti over the ledge toward the skier), out on the slope
 * looking back up at him, and up beside the ledge.
 */
export function emergeStations(mouth: THREE.Vector3, out: THREE.Vector3, tan: THREE.Vector3, ground?: (x: number, z: number) => number): THREE.Vector3[] {
  const s: THREE.Vector3[] = [];
  // on a ring in front of the mouth (the sea lies behind the cave's hill: it shows past its flanks)
  for (const ang of [-60, -35, 35, 60])
    for (const [d, h] of [[14, 6], [14, 16], [14, 30], [26, 6], [26, 16], [26, 30]] as const) {
      {
        const r = THREE.MathUtils.degToRad(ang);
        const p = mouth.clone().addScaledVector(out, d * Math.cos(r)).addScaledVector(tan, d * Math.sin(r));
        p.y = Math.max(p.y, ground ? ground(p.x, p.z) : p.y) + h;
        s.push(p);
      }
    }
  return s;
}

export function leapStations(ledge: THREE.Vector3, out: THREE.Vector3, tan: THREE.Vector3, ground?: (x: number, z: number) => number): THREE.Vector3[] {
  const s: THREE.Vector3[] = [];
  for (const a of [12])
    for (const b of [-12, -6, 6, 12])
      for (const h of [3, 9]) {
        const p = ledge.clone().addScaledVector(out, a).addScaledVector(tan, b);
        p.y = Math.max(p.y, ground ? ground(p.x, p.z) : p.y) + h;
        s.push(p);
      }
  return s;
}
