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
  /** and tilted up this far (rad): the subject sits low in the frame, the sea beyond it */
  pitch: number;
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

/** the same, yielding after each ray */
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
      // (a long ray over the fjord costs ~a hundred height samples: yield after each)
      if (j < ny - 1 || i < nx - 1) yield;
    }
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
export function* bestSeaPose(m: Mountain, subject: THREE.Vector3, stations: THREE.Vector3[], props: Array<{ p: THREE.Vector3; r: number }>, fov: number, minWater = 0.05, maxDropDeg = 24): Generator<void, SeaPose | null, void> {
  let best: SeaPose | null = null;
  let bestScore = -Infinity;
  // the subject in the centre, or a third of the way in from either side (the frame turned toward the sea)
  for (const cam of stations) {
    yield;
    if (!clearShot(m, cam, subject, props)) continue;
    // far stations shoot long (a telephoto keeps the Yeti large in frame: ~ the same size as from
    // the near ring at the base fov)
    const dist = cam.distanceTo(subject);
    // (round 5 capture: a high station looking steeply down at the mouth rolled the frame into a
    // map view with the sea as a "sky" — a character shot stays near eye level: ≤ 24° down for the
    // emergence, ≤ 32° for the leap, which looks down the slope at him anyway)
    const drop = cam.y - subject.y;
    if (drop > Math.tan(THREE.MathUtils.degToRad(maxDropDeg)) * Math.hypot(cam.x - subject.x, cam.z - subject.z)) continue;
    const fovS = dist > 45 ? Math.max(26, fov * Math.min(1, 70 / dist)) : fov;
    // (round 4b: also tilted up, the subject in the lower third — from above the cave's hill the sea
    // lies beyond and below the hill's crest, near the top of a frame centred on the mouth)
    const vf = THREE.MathUtils.degToRad(fovS) / 2;
    const hfovS = Math.atan(Math.tan(vf) * (16 / 9));
    for (const [yaw, pitch] of [[0, 0], [0.42 * hfovS, 0], [-0.42 * hfovS, 0], [0, 0.55 * vf], [0.42 * hfovS, 0.55 * vf], [-0.42 * hfovS, 0.55 * vf]] as const) {
      const look = framedLook(cam, subject, yaw, pitch);
      const w = yield* waterFractionSteps(m, cam, look, fovS);
      // (closer stations win a near tie: the Yeti must stay large in frame)
      const score = w - 0.0015 * dist;
      if (w >= minWater && (!best || score > bestScore + 1e-9)) {
        best = { cam: cam.clone(), look, fov: fovS, water: w, yaw, pitch };
        bestScore = score;
      }
    }
  }
  return best;
}

/** the look point turned `yaw` about +Y and tilted up `pitch` (rad) around the camera from the subject */
export function framedLook(cam: THREE.Vector3, subject: THREE.Vector3, yaw: number, pitch: number): THREE.Vector3 {
  const look = turnedLook(cam, subject, yaw);
  if (pitch === 0) return look;
  const dl = look.clone().sub(cam);
  const hl = Math.max(1e-6, Math.hypot(dl.x, dl.z));
  const a = Math.atan2(dl.y, hl) + pitch;
  return look.copy(cam).add(new THREE.Vector3((dl.x / hl) * Math.cos(a), Math.sin(a), (dl.z / hl) * Math.cos(a)).multiplyScalar(dl.length()));
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
  // (round 4b, C r4 #1: on Standard and longer the cave sits in an ordinary valley side and the sea
  // lies behind its hill — the low ring found no water for any of 10 such caves; higher and wider
  // stations look over the hill's shoulder to the fjord)
  // stations far out on the slope, low: their frame is near-level, so its upper rays clear the
  // cave's hill and reach the fjord far below and behind it)
  for (const ang of [-60, -35, -15, 15, 35, 60])
    for (const [d, h] of [[14, 6], [14, 16], [14, 30], [26, 6], [26, 16], [26, 30], [55, 5], [80, 6], [110, 8]] as const) {
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
  for (const a of [12, 22])
    for (const b of [-16, -12, -6, 6, 12, 16])
      for (const h of [3, 9, 22, 55, 80]) {
        const p = ledge.clone().addScaledVector(out, a).addScaledVector(tan, b);
        p.y = Math.max(p.y, ground ? ground(p.x, p.z) : p.y) + h;
        s.push(p);
      }
  return s;
}
