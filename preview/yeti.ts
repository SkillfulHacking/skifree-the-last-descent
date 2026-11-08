/**
 * Yeti preview harness.
 * URL params: mode=<YetiMode> t=<s into mode> speed=<m/s> turn=<-1..1> cam=front|side|threequarter|face|back|low|hand|foot
 *             (hand/foot: close-up of the left hand/foot; ang=<deg> orbit angle around it, dist=<m>)
 *             shade=<0..1> YetiModel.setShade (depth darkening)
 *             quality=low|medium|high|ultra glow=<0..1> from=<YetiMode> (cross-fade test: plays `from` for 1 s first)
 *             dark=1 (night lighting for the eye-glow reveal)
 *             ground=flat|slope|bumpy|cave  terrain passed to YetiModel.setGround (root placed on it)
 *             debug=1  grounding debug overlay (root cross, sole contacts, ground samples)
 *             seq=<s>  play the cave sequence crawl 3 s → emerge 2 s → stand 1.2 s → roar 2.5 s at 30 fps along a
 *                      sloped bumpy path (default ground=cave) and stop at <s> (seq=end for the whole sequence).
 *                      The whole sequence is always simulated once for the numeric report: window.__groundReport.
 */
import * as THREE from 'three';
import { YetiModel } from '../src/yeti/YetiModel';
import type { QualityPreset, YetiMode } from '../src/core/types';

declare global {
  interface Window {
    __ready?: boolean;
    __yeti?: YetiModel;
    __renderer?: THREE.WebGLRenderer;
    __groundReport?: GroundReport;
  }
}

interface FrameRow {
  t: number;
  mode: YetiMode;
  /** per foot [L, R]: min / max sole-probe height above the ground (m) */
  min: [number, number];
  max: [number, number];
  planted: [boolean, boolean];
  stepping: [boolean, boolean];
  /** tracked world points (head, hands) */
  pts?: Record<string, number[]>;
}
interface GroundReport {
  ground: string;
  fps: number;
  frames: FrameRow[];
  summary: {
    worstPenetrationCm: number;
    worstPenetrationAt: string;
    worstPlantedFloatCm: number;
    worstPlantedFloatAt: string;
    firstFrameClearanceCm: [number, number];
    steps: number;
    maxSlipPerStepCm: number;
    maxSlipRatio: number;
    meanSlipRatio: number;
    correctiveSteps: number;
    stepList: string[];
    /** largest frame-to-frame change of velocity (m/s) of tracked points: detects pops in transitions */
    maxVelJump: Record<string, { mps: number; at: string }>;
    /** lowest hand (palm) clearance above the ground, cm */
    minHandClearanceCm: number;
    minHandClearanceAt: string;
    byMode: Record<string, { penCm: number; floatCm: number }>;
  };
}

console.log(`script start ${performance.now().toFixed(0)} ms`);
const q = new URLSearchParams(location.search);
const mode = (q.get('mode') ?? 'stand') as YetiMode;
const T = parseFloat(q.get('t') ?? '2');
const speed = parseFloat(q.get('speed') ?? (mode === 'run' ? '10' : mode === 'walk' || mode === 'turnAway' ? '2.5' : mode === 'emerge' ? '1.4' : '0'));
const turn = parseFloat(q.get('turn') ?? '0');
const camName = q.get('cam') ?? 'threequarter';
const quality = (q.get('quality') ?? 'high') as QualityPreset;
const glow = parseFloat(q.get('glow') ?? '0');
const from = q.get('from') as YetiMode | null;
const dark = q.get('dark') === '1';
const strip = Math.max(1, parseInt(q.get('strip') ?? '1', 10));
const stripStep = parseFloat(q.get('step') ?? '0.15');
const seqParam = q.get('seq');
const groundName = q.get('ground') ?? (seqParam !== null ? 'cave' : '');
const debug = q.get('debug') === '1';

// ---- terrain samplers (world space)
const GROUNDS: Record<string, (x: number, z: number) => number> = {
  flat: () => 0,
  slope: (x, z) => -0.26 * z + 0.1 * x,
  bumpy: (x, z) => 0.1 * Math.sin(1.9 * x + 0.3) * Math.cos(1.5 * z) + 0.05 * Math.sin(3.3 * x + 2.1 * z) + 0.025 * Math.sin(4.9 * x - 3.7 * z),
  cave: (x, z) =>
    -0.1 * z + 0.03 * x + 0.07 * Math.sin(2.0 * x + 0.4) * Math.cos(1.6 * z + 0.2) + 0.035 * Math.sin(3.8 * x - 3.1 * z) + 0.015 * Math.sin(4.7 * x + 4.4 * z),
};
const groundFn = groundName ? GROUNDS[groundName] ?? GROUNDS.flat : null;

// ---- the cave sequence
const SEQ: Array<{ mode: YetiMode; dur: number; speed: number }> = [
  { mode: 'crawl', dur: 3, speed: 1.1 },
  { mode: 'emerge', dur: 2, speed: 1.3 },
  { mode: 'stand', dur: 1.2, speed: 0 },
  { mode: 'roar', dur: 2.5, speed: 0 },
];
const SEQ_LEN = SEQ.reduce((a, b) => a + b.dur, 0);
const SEQ_DT = 1 / 30;
/** root path: gentle S-curve heading roughly +Z; arc length ≈ z */
const pathAt = (d: number, out: THREE.Vector3): number => {
  const z = -3.6 + d;
  const x = 0.7 * Math.sin(0.35 * d);
  out.set(x, 0, z);
  return Math.atan2(0.7 * 0.35 * Math.cos(0.35 * d), 1);
};

/**
 * Plays the sequence on `y` (root translated along the path at the mode speed, y on the ground), until `stopAt`.
 * Returns the report over the simulated frames.
 */
function runSequence(y: YetiModel, g: (x: number, z: number) => number, stopAt: number): GroundReport {
  y.setGround(g);
  const frames: FrameRow[] = [];
  const probes = [0, 1].map(() => Array.from({ length: 5 }, () => new THREE.Vector3()));
  const prevProbes = [0, 1].map(() => Array.from({ length: 5 }, () => new THREE.Vector3()));
  const st = { clearance: [0, 0], planted: [false, false], stepping: [false, false] };
  const lowestPrev = [-1, -1];
  const prevClear = [new Array<number>(5).fill(0), new Array<number>(5).fill(0)];
  const slipAcc = [0, 0];
  const plantStart = [new THREE.Vector3(), new THREE.Vector3()];
  const lastPlant: Array<THREE.Vector3 | null> = [null, null];
  const steps: Array<{ slip: number; stride: number; foot?: string; from?: string; to?: string }> = [];
  const plantFrom = ['', ''];
  let corrective = 0;
  const wasStepping = [false, false];
  let pen = 0;
  let penAt = '';
  let flt = 0;
  let fltAt = '';
  const byMode: Record<string, { penCm: number; floatCm: number }> = {};
  let first: [number, number] = [0, 0];
  let d = 0;
  let time = 0;
  let seg = 0;
  let modeTime = 0;
  const pos = new THREE.Vector3();
  const track: Record<string, { p: THREE.Vector3; v: THREE.Vector3; has: number; get: (o: THREE.Vector3) => THREE.Vector3 }> = {
    head: { p: new THREE.Vector3(), v: new THREE.Vector3(), has: 0, get: (o) => y.getHeadWorldPosition(o) },
    handL: { p: new THREE.Vector3(), v: new THREE.Vector3(), has: 0, get: (o) => y.getHandWorldPosition('left', o) },
    handR: { p: new THREE.Vector3(), v: new THREE.Vector3(), has: 0, get: (o) => y.getHandWorldPosition('right', o) },
  };
  const maxVelJump: Record<string, { mps: number; at: string }> = {};
  let minHand = Infinity;
  let minHandAt = '';
  const tp = new THREE.Vector3();
  const tv = new THREE.Vector3();
  const nFrames = Math.round(Math.min(stopAt, SEQ_LEN) / SEQ_DT);
  let segEnd = SEQ[0].dur;
  for (let f = 0; f <= nFrames; f++) {
    const t = f * SEQ_DT;
    while (seg < SEQ.length - 1 && t >= segEnd - 1e-6) {
      seg++;
      segEnd += SEQ[seg].dur;
      modeTime = 0;
    }
    const S = SEQ[seg];
    const dt = f === 0 ? 0 : SEQ_DT;
    if (f > 0) {
      d += S.speed * dt;
      modeTime += dt;
      time += dt;
    }
    const yaw = pathAt(d, pos);
    y.root.position.set(pos.x, g(pos.x, pos.z), pos.z);
    y.root.rotation.set(0, yaw, 0);
    y.update(dt, { mode: S.mode, modeTime, speed: S.speed, turn: 0, time });
    y.getGroundingState(st);
    const row: FrameRow = { t: +t.toFixed(3), mode: S.mode, min: [0, 0], max: [0, 0], planted: [st.planted[0], st.planted[1]], stepping: [st.stepping[0], st.stepping[1]] };
    for (let i = 0; i < 2; i++) {
      y.getSoleProbes(i === 0 ? 'left' : 'right', probes[i]);
      let mn = Infinity;
      let mx = -Infinity;
      let lo = 0;
      probes[i].forEach((p, k) => {
        const c = p.y - g(p.x, p.z);
        if (c < mn) {
          mn = c;
          lo = k;
        }
        mx = Math.max(mx, c);
      });
      row.min[i] = +mn.toFixed(4);
      row.max[i] = +mx.toFixed(4);
      const tag = `${S.mode}@${t.toFixed(2)}s ${i === 0 ? 'L' : 'R'}`;
      const bm = (byMode[S.mode] ??= { penCm: 0, floatCm: 0 });
      if (-mn > pen) {
        pen = -mn;
        penAt = tag;
      }
      bm.penCm = Math.max(bm.penCm, -mn * 100);
      if (st.planted[i]) {
        if (mn > flt) {
          flt = mn;
          fltAt = tag;
        }
        bm.floatCm = Math.max(bm.floatCm, mn * 100);
        // slip: horizontal travel, between consecutive planted frames, of the probe that is on the ground in
        // both frames (rolling heel→ball is not slip)
        if (lowestPrev[i] >= 0) {
          let best = 0;
          let bc = Infinity;
          for (let k = 0; k < 5; k++) {
            const c = probes[i][k].y - g(probes[i][k].x, probes[i][k].z) + prevClear[i][k];
            if (c < bc) {
              bc = c;
              best = k;
            }
          }
          const a = probes[i][best];
          const b = prevProbes[i][best];
          slipAcc[i] += Math.hypot(a.x - b.x, a.z - b.z);
        } else {
          slipAcc[i] = 0;
          plantStart[i].copy(probes[i][3]);
          plantFrom[i] = `${S.mode}@${t.toFixed(2)}`;
        }
        lowestPrev[i] = lo;
      } else if (lowestPrev[i] >= 0) {
        const stride = lastPlant[i] ? Math.hypot(plantStart[i].x - lastPlant[i]!.x, plantStart[i].z - lastPlant[i]!.z) : 0;
        steps.push({ slip: slipAcc[i], stride, foot: i === 0 ? 'L' : 'R', from: plantFrom[i], to: `${S.mode}@${t.toFixed(2)}` });
        lastPlant[i] = plantStart[i].clone();
        lowestPrev[i] = -1;
      }
      for (let k = 0; k < 5; k++) {
        prevProbes[i][k].copy(probes[i][k]);
        prevClear[i][k] = probes[i][k].y - g(probes[i][k].x, probes[i][k].z);
      }
      if (st.stepping[i] && !wasStepping[i]) corrective++;
      wasStepping[i] = st.stepping[i];
    }
    for (const [name, tr] of Object.entries(track)) {
      tr.get(tp);
      (row.pts ??= {})[name] = [+tp.x.toFixed(3), +tp.y.toFixed(3), +tp.z.toFixed(3)];
      if (name !== 'head' && tp.y - g(tp.x, tp.z) < minHand) {
        minHand = tp.y - g(tp.x, tp.z);
        minHandAt = `${name} ${S.mode}@${t.toFixed(2)}s`;
      }
      if (tr.has > 0 && dt > 0) {
        tv.copy(tp).sub(tr.p).divideScalar(dt);
        if (tr.has > 1) {
          const j = tv.distanceTo(tr.v);
          const m = (maxVelJump[name] ??= { mps: 0, at: '' });
          if (j > m.mps) {
            m.mps = +j.toFixed(3);
            m.at = `${S.mode}@${t.toFixed(2)}s`;
          }
        }
        tr.v.copy(tv);
      }
      tr.p.copy(tp);
      tr.has++;
    }
    if (f === 0) first = [row.min[0], row.min[1]];
    frames.push(row);
  }
  for (let i = 0; i < 2; i++) if (lowestPrev[i] >= 0) steps.push({ slip: slipAcc[i], stride: lastPlant[i] ? Math.hypot(plantStart[i].x - lastPlant[i]!.x, plantStart[i].z - lastPlant[i]!.z) : 0 });
  const moving = steps.filter((s) => s.stride > 0.2);
  const ratios = moving.map((s) => s.slip / s.stride);
  return {
    ground: groundName,
    fps: 30,
    frames,
    summary: {
      worstPenetrationCm: +(pen * 100).toFixed(2),
      worstPenetrationAt: penAt,
      worstPlantedFloatCm: +(flt * 100).toFixed(2),
      worstPlantedFloatAt: fltAt,
      firstFrameClearanceCm: [+(first[0] * 100).toFixed(2), +(first[1] * 100).toFixed(2)],
      steps: steps.length,
      maxSlipPerStepCm: +(Math.max(0, ...steps.map((s) => s.slip)) * 100).toFixed(2),
      maxSlipRatio: +Math.max(0, ...ratios).toFixed(3),
      meanSlipRatio: +(ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0).toFixed(3),
      correctiveSteps: corrective,
      stepList: steps.map((s) => `${s.foot ?? ''} ${s.from ?? ''}→${s.to ?? 'end'} slip ${(s.slip * 100).toFixed(1)}cm stride ${(s.stride * 100).toFixed(0)}cm`),
      maxVelJump,
      minHandClearanceCm: +(minHand * 100).toFixed(2),
      minHandClearanceAt: minHandAt,
      byMode,
    },
  };
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = dark ? 0.9 : 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
window.__renderer = renderer;

const scene = new THREE.Scene();
scene.background = new THREE.Color(dark ? 0x05070b : 0x8fc3ea);
scene.fog = new THREE.Fog(scene.background.getHex(), 18, 60);

const hemi = new THREE.HemisphereLight(0xcfe3ff, 0xe8eef8, dark ? 0.05 : 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1df, dark ? 0.05 : 3.0);
sun.position.set(5, 9, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -4;
sun.shadow.camera.right = 4;
sun.shadow.camera.top = 5;
sun.shadow.camera.bottom = -2;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 30;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

// snow ground: the sampled terrain (ground=...) or the legacy gentle undulation
const groundGeo = groundFn ? new THREE.PlaneGeometry(18, 18, 180, 180) : new THREE.PlaneGeometry(80, 80, 120, 120);
groundGeo.rotateX(-Math.PI / 2);
const gp = groundGeo.getAttribute('position');
for (let i = 0; i < gp.count; i++) {
  const x = gp.getX(i);
  const z = gp.getZ(i);
  const r = Math.hypot(x, z);
  const h = groundFn ? groundFn(x, z) : r < 3 ? 0 : (Math.sin(x * 0.35) * Math.cos(z * 0.27) * 0.25 + Math.sin(x * 1.3 + z) * 0.04) * Math.min(1, (r - 3) / 4);
  gp.setY(i, h);
}
groundGeo.computeVertexNormals();
const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.85 }));
ground.receiveShadow = true;
scene.add(ground);

const tBuild = performance.now();
const yetis: YetiModel[] = [];
let footsteps = 0;
const printMat = new THREE.MeshBasicMaterial({ color: 0x9fb4cc, transparent: true, opacity: 0.6, depthWrite: false });
const printGeo = new THREE.CircleGeometry(0.12, 16).rotateX(-Math.PI / 2);
const dt = 1 / 60;
for (let k = 0; k < strip; k++) {
  const yeti = new YetiModel({ quality });
  yetis.push(yeti);
  scene.add(yeti.root);
  // strips: lined up along Z (side camera) or X (front camera)
  const off = (k - (strip - 1) / 2) * 3.1;
  if (camName === 'front') yeti.root.position.x = off;
  else yeti.root.position.z = -off;
  yeti.setEyeGlow(glow);
  if (q.get('shade') !== null) yeti.setShade(parseFloat(q.get('shade')!));
  if (q.get('nofur') === '1') yeti.setFurVisible(false);
  yeti.onFootstep = (_side, pos, strength) => {
    footsteps++;
    const m = new THREE.Mesh(printGeo, printMat);
    m.position.copy(pos);
    m.position.y = 0.005;
    m.scale.setScalar(0.6 + strength);
    m.visible = q.get('prints') === '1';
    scene.add(m);
  };
  if (debug) yeti.setDebug(true);
  if (seqParam !== null && k === Math.floor((strip - 1) / 2)) {
    const g = groundFn ?? GROUNDS.cave;
    // full sequence once for the report (fresh model shares the cached geometry), then the displayed one
    const probe = new YetiModel({ quality });
    window.__groundReport = runSequence(probe, g, SEQ_LEN);
    probe.dispose();
    runSequence(yeti, g, seqParam === 'end' ? SEQ_LEN : parseFloat(seqParam));
    continue;
  }
  if (groundFn) {
    yeti.root.position.y = groundFn(yeti.root.position.x, yeti.root.position.z);
    yeti.setGround(groundFn);
  }
  // deterministic simulation; the root is translated forward at the animation speed (as the game does), so
  // planted feet stay put. Without a terrain it is moved back afterwards so strips stay lined up.
  let time = 0;
  const start = yeti.root.position.clone();
  let travelled = 0;
  const advance = (ddt: number): void => {
    travelled += speed * ddt;
    yeti.root.position.z = start.z + travelled;
    if (groundFn) yeti.root.position.y = groundFn(yeti.root.position.x, yeti.root.position.z);
  };
  const printsBefore = scene.children.length;
  if (from) {
    for (let i = 0; i < 60; i++) {
      time += dt;
      advance(dt);
      yeti.update(dt, { mode: from, modeTime: i * dt, speed, turn, time });
    }
  }
  const steps = Math.round((T + k * stripStep) / dt);
  for (let i = 0; i <= steps; i++) {
    const ddt = i === 0 && !from ? 0 : dt;
    advance(ddt);
    yeti.update(ddt, { mode, modeTime: i * dt, speed, turn, time });
    time += dt;
  }
  if (!groundFn) {
    yeti.root.position.copy(start);
    for (let c = printsBefore; c < scene.children.length; c++) scene.children[c].position.z -= travelled;
  }
}
console.log(`build+sim ${(performance.now() - tBuild).toFixed(0)} ms`);
const yeti = yetis[Math.floor((strip - 1) / 2)];
window.__yeti = yeti;
const widen = strip > 1 ? 1 + (strip - 1) * 0.55 : 1;

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 200);
const head = yeti.getHeadWorldPosition(new THREE.Vector3());
const target = yeti.root.position.clone().add(new THREE.Vector3(0, 1.55, 0.2));
const rootOff = yeti.root.position.clone();
switch (camName) {
  case 'front':
    camera.position.set(0, 1.7, 7.4 * widen);
    break;
  case 'side':
    camera.position.set(7.4 * widen, 1.7, 0.4);
    break;
  case 'back':
    camera.position.set(-2.5, 2.2, -6.5);
    break;
  case 'low':
    camera.position.set(1.4, 0.5, 4.2);
    target.set(0, 2.1, 0);
    break;
  case 'face': {
    camera.fov = 30;
    target.copy(head).add(new THREE.Vector3(0, -0.05, 0.1));
    camera.position.copy(head).add(new THREE.Vector3(0.5, 0.05, 1.35));
    break;
  }
  case 'face3q': {
    camera.fov = 30;
    target.copy(head).add(new THREE.Vector3(0, -0.05, 0.1));
    camera.position.copy(head).add(new THREE.Vector3(1.1, 0.0, 0.95));
    break;
  }
  case 'facefront': {
    camera.fov = 26;
    target.copy(head).add(new THREE.Vector3(0, -0.06, 0.12));
    camera.position.copy(head).add(new THREE.Vector3(0.0, 0.02, 1.25));
    break;
  }
  case 'face34': {
    // ~35° three-quarter from the yeti's right
    camera.fov = 26;
    target.copy(head).add(new THREE.Vector3(0, -0.06, 0.12));
    const a34 = (parseFloat(q.get('ang') ?? '35') * Math.PI) / 180;
    camera.position.copy(head).add(new THREE.Vector3(-1.26 * Math.sin(a34), 0.02, 1.26 * Math.cos(a34)));
    break;
  }
  case 'faceside': {
    camera.fov = 30;
    target.copy(head).add(new THREE.Vector3(0, -0.05, 0.1));
    camera.position.copy(head).add(new THREE.Vector3(1.45, 0.0, 0.1));
    break;
  }
  case 'hand':
  case 'foot': {
    camera.fov = 30;
    const fc = { left: new THREE.Vector3(), right: new THREE.Vector3() };
    if (camName === 'hand') yeti.getHandWorldPosition('left', target);
    else {
      yeti.getFootContacts(fc);
      target.copy(fc.left).add(new THREE.Vector3(0, 0.12, 0));
    }
    const ang = (parseFloat(q.get('ang') ?? '40') * Math.PI) / 180 + yeti.root.rotation.y;
    const dist = parseFloat(q.get('dist') ?? '1.1');
    camera.position.copy(target).add(new THREE.Vector3(Math.sin(ang) * dist, 0.25 * dist, Math.cos(ang) * dist));
    break;
  }
  case 'threequarter':
  default:
    camera.position.set(4.6 * widen, 2.1, 5.6 * widen);
    break;
}
if (!camName.startsWith('face') && camName !== 'hand' && camName !== 'foot') {
  // presets are authored around the origin: follow the root (and its yaw) when it moved
  const yaw = yeti.root.rotation.y;
  const rel = camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  camera.position.copy(rel.add(rootOff));
  if (camName === 'low') target.set(0, 2.1, 0).add(rootOff);
  else if (camName === 'side' || camName === 'front' || camName === 'threequarter' || camName === 'back') target.copy(rootOff).add(new THREE.Vector3(0, 1.55, 0));
  const zoom = parseFloat(q.get('zoom') ?? '1');
  if (zoom !== 1) camera.position.sub(target).divideScalar(zoom).add(target);
  if (q.get('camy')) camera.position.y = rootOff.y + parseFloat(q.get('camy')!);
  if (q.get('ty')) target.y = rootOff.y + parseFloat(q.get('ty')!);
}
camera.lookAt(target);
camera.updateProjectionMatrix();
if (window.__groundReport) console.log('groundReport ' + JSON.stringify(window.__groundReport.summary));

const info = document.getElementById('info');
if (info && seqParam !== null) info.textContent = `seq=${seqParam} ground=${groundName} q=${quality} ` + (window.__groundReport ? JSON.stringify(window.__groundReport.summary).slice(0, 160) : '');
else if (info) info.textContent = `mode=${mode} t=${T} speed=${speed} turn=${turn} q=${quality} footsteps=${footsteps}`;

let frames = 0;
function frame(): void {
  const tr = performance.now();
  renderer.render(scene, camera);
  console.log(`frame ${frames} ${(performance.now() - tr).toFixed(0)} ms at ${performance.now().toFixed(0)}`);
  frames++;
  if (frames === 2) {
    window.__ready = true;
    const i = renderer.info.render;
    if (info) info.textContent += ` calls=${i.calls} tris=${i.triangles}`;
  }
  if (frames < 2) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
