/**
 * The Yeti: procedural sculpted + skinned creature with instanced shell fur, fur-lock cards,
 * teeth/claws and glowing eyes, driven by fully procedural, cross-faded animation.
 *
 * root: origin on the ground between the feet, faces +Z, +Y up. The game positions/rotates root.
 *
 * Grounding contract: the game sets `root.position` to a point ON the ground (y = ground height at the root
 * XZ) and a yaw-only rotation. With `setGround(sampler)` the model plants each sole (and the knuckles when
 * knuckle-walking) on the sampled terrain, adapts the pelvis to slopes and locks planted feet in world space.
 * Teleports (> 0.5 m in one update) and the first update snap all filtered state, so no settling pop is visible.
 */
import * as THREE from 'three';
import type { QualityPreset, YetiAnimState, YetiMode } from '../core/types';
import { buildYetiGeometry, qualityConfig, toBufferGeometry } from './model/buildGeometry';
import {
  createCardMaterial,
  createEyeMaterial,
  createFurUniforms,
  createHardMaterial,
  createLockTexture,
  createShellMaterial,
  createSkinMaterial,
  type FurUniforms,
} from './model/materials';
import {
  GAIT_MODES,
  GALLOP_STRIKES,
  PoseSample,
  crossfadeTime,
  modeFreq,
  sampleMode,
  smooth,
  type AnimCtx,
} from './model/animation';
import { Grounding, PROBE_COUNT, type GroundSampler } from './model/ground';
import { PoseSolver } from './model/pose';
import { B, BONE_COUNT, BONE_NAMES, HEAD_CENTER, MOUTH_POS, PARENT_INDEX, armFrame } from './model/rig';

/** Debug overlay (created lazily by setDebug(true)). */
interface DebugOverlay {
  group: THREE.Group;
  root: THREE.Mesh;
  contacts: THREE.Mesh[];
  samples: THREE.Mesh[][];
  geos: THREE.BufferGeometry[];
  mats: THREE.MeshBasicMaterial[];
}

export class YetiModel {
  readonly root: THREE.Group;
  readonly rightHandSocket: THREE.Object3D;
  onFootstep: ((side: 'left' | 'right', worldPos: THREE.Vector3, strength: number) => void) | null = null;

  private bones: THREE.Bone[] = [];
  private skeleton: THREE.Skeleton;
  private solver = new PoseSolver();
  private body: THREE.SkinnedMesh;
  private shells: THREE.SkinnedMesh;
  private cards: THREE.SkinnedMesh;
  private hard: THREE.SkinnedMesh;
  private eyes: THREE.Mesh;
  private furU: FurUniforms;
  private eyeGlow: THREE.IUniform<number>;
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];

  private curMode: YetiMode = 'lurk';
  private prevMode: YetiMode = 'lurk';
  private prevTime = 0;
  private lastModeTime = 0;
  private fade = 1;
  private fadeDur = 0.3;
  private prevFrozen = false;
  private phase = 0;
  private gallopW = 0;
  private started = false;
  private sA = new PoseSample();
  private sB = new PoseSample();
  private sOut = new PoseSample();
  private sFrozen = new PoseSample();
  private ground = new Grounding();
  private needSnap = true;
  private hasLast = false;
  private lastRoot = new THREE.Vector3();
  private lastYaw = 0;
  private dbg: DebugOverlay | null = null;
  private debugOn = false;
  private tmp2 = new THREE.Vector3();
  private prevSpeed = 0;
  private rebaseLocks = false;
  private lastSpeed = 0;
  private ctx: AnimCtx = { speed: 0, turn: 0, time: 0, phase: 0, freq: 1, gallop: 0 };
  private lastHipsY = 0;
  private furVel = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private palmBind: THREE.Vector3[];

  constructor(opts: { quality: QualityPreset }) {
    const cfg = qualityConfig(opts.quality);
    const geo = buildYetiGeometry(opts.quality);
    this.root = new THREE.Group();
    this.root.name = 'Yeti';

    // ---- skeleton (bind: identity rotations, model-space positions)
    for (let i = 0; i < BONE_COUNT; i++) {
      const b = new THREE.Bone();
      b.name = `yeti_${BONE_NAMES[i]}`;
      b.position.copy(this.solver.bindLocal[i]);
      this.bones.push(b);
      const p = PARENT_INDEX[i];
      if (p >= 0) this.bones[p].add(b);
    }
    this.root.add(this.bones[0]);
    const inverses = this.solver.bind.map((p) => new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
    this.skeleton = new THREE.Skeleton(this.bones, inverses);
    const ident = new THREE.Matrix4();
    const bounds = new THREE.Sphere(new THREE.Vector3(0, 1.6, 0.3), 3.2);

    const mkSkinned = (g: THREE.BufferGeometry, m: THREE.Material): THREE.SkinnedMesh => {
      const mesh = new THREE.SkinnedMesh(g, m);
      mesh.bind(this.skeleton, ident);
      mesh.boundingSphere = bounds.clone();
      g.boundingSphere = bounds.clone();
      mesh.frustumCulled = true;
      this.root.add(mesh);
      return mesh;
    };

    // ---- body surface
    const bodyGeo = toBufferGeometry(geo.body);
    const skinMat = createSkinMaterial();
    this.body = mkSkinned(bodyGeo, skinMat);
    this.body.name = 'YetiBody';
    this.body.castShadow = true;
    this.body.receiveShadow = true;

    // ---- shell fur: one instanced draw call for all shells
    const shellGeo = new THREE.InstancedBufferGeometry();
    for (const name of ['position', 'normal', 'skinIndex', 'skinWeight', 'furData']) {
      const a = bodyGeo.getAttribute(name);
      if (a) shellGeo.setAttribute(name, a);
    }
    shellGeo.setIndex(new THREE.BufferAttribute(geo.shellIndex, 1));
    const shellIdx = new Float32Array(cfg.shells);
    for (let i = 0; i < cfg.shells; i++) shellIdx[i] = i;
    shellGeo.setAttribute('shell', new THREE.InstancedBufferAttribute(shellIdx, 1));
    shellGeo.instanceCount = cfg.shells;
    this.furU = createFurUniforms(cfg.shells);
    const shellMat = createShellMaterial(this.furU);
    this.shells = mkSkinned(shellGeo, shellMat);
    this.shells.name = 'YetiShellFur';
    this.shells.castShadow = false;
    this.shells.receiveShadow = true;
    this.shells.renderOrder = 1;

    // ---- shaggy fur cards
    const cardGeo = toBufferGeometry(geo.cards);
    const lockTex = createLockTexture();
    const cardMat = createCardMaterial(lockTex);
    this.cards = mkSkinned(cardGeo, cardMat);
    this.cards.name = 'YetiFurCards';
    this.cards.castShadow = true;
    this.cards.receiveShadow = true;
    this.cards.renderOrder = 2;

    // ---- teeth & claws
    const hardGeo = toBufferGeometry(geo.hard);
    const hardMat = createHardMaterial();
    this.hard = mkSkinned(hardGeo, hardMat);
    this.hard.name = 'YetiTeethClaws';
    this.hard.castShadow = true;
    this.hard.receiveShadow = true;

    // ---- eyes (rigid on the head bone)
    const eyeGeo = new THREE.BufferGeometry();
    eyeGeo.setAttribute('position', new THREE.BufferAttribute(geo.eyes.position, 3));
    eyeGeo.setAttribute('normal', new THREE.BufferAttribute(geo.eyes.normal, 3));
    eyeGeo.setAttribute('color', new THREE.BufferAttribute(geo.eyes.color, 3));
    eyeGeo.setIndex(new THREE.BufferAttribute(geo.eyes.index, 1));
    const eyeMat = createEyeMaterial();
    this.eyeGlow = eyeMat.glow;
    this.eyes = new THREE.Mesh(eyeGeo, eyeMat.material);
    this.eyes.name = 'YetiEyes';
    this.eyes.position.copy(this.solver.bind[B.head]).multiplyScalar(-1);
    this.bones[B.head].add(this.eyes);

    this.geometries.push(bodyGeo, shellGeo, cardGeo, hardGeo, eyeGeo);
    this.materials.push(skinMat, shellMat, cardMat, hardMat, eyeMat.material);
    this.textures.push(lockTex);

    // ---- palm sockets
    this.palmBind = [1, -1].map((s) => {
      const f = armFrame(s);
      return f.wrist.clone().addScaledVector(f.d, 0.14).addScaledVector(f.n, 0.075);
    });
    this.rightHandSocket = new THREE.Object3D();
    this.rightHandSocket.name = 'YetiRightHandSocket';
    this.rightHandSocket.position.copy(this.palmBind[1]).sub(this.solver.bind[B.handR]);
    this.bones[B.handR].add(this.rightHandSocket);

    // initial pose
    this.update(0, { mode: 'lurk', modeTime: 0, speed: 0, turn: 0, time: 0 });
    // the first real update snaps to its mode instead of cross-fading from this placeholder pose
    this.started = false;
    this.needSnap = true;
    this.hasLast = false;
  }

  /** World-space ground sampler. When set, each foot (and knuckle during the gallop) is IK-planted on it. */
  setGround(sampler: ((x: number, z: number) => number) | null): void {
    this.ground.sampler = sampler as GroundSampler | null;
    this.needSnap = true;
  }

  update(dt: number, anim: YetiAnimState): void {
    const mode: YetiMode = anim.mode === 'hidden' ? 'lurk' : anim.mode;
    // root motion: teleports snap the grounding state (no settling pop on the first visible frame)
    this.root.updateWorldMatrix(true, false);
    const M = this.root.matrixWorld;
    const e = M.elements;
    const yaw = Math.atan2(e[8], e[0]);
    let moved = 0;
    let turned = 0;
    if (this.hasLast) {
      moved = Math.hypot(e[12] - this.lastRoot.x, e[13] - this.lastRoot.y, e[14] - this.lastRoot.z);
      turned = Math.abs(Math.atan2(Math.sin(yaw - this.lastYaw), Math.cos(yaw - this.lastYaw)));
    }
    let snap = this.needSnap || !this.hasLast || moved > 0.5 || turned > 0.8;
    if (!this.started) {
      this.curMode = mode;
      this.prevMode = mode;
      this.fade = 1;
      this.started = true;
      snap = true;
    } else if (mode !== this.curMode) {
      // a mode change in the middle of a cross-fade blends from the frozen in-between pose (no pop)
      this.prevFrozen = this.fade < 1;
      if (this.prevFrozen) this.sFrozen.copy(this.sOut);
      this.prevMode = this.curMode;
      this.prevTime = this.lastModeTime;
      this.curMode = mode;
      this.fade = 0;
      this.fadeDur = crossfadeTime(this.prevMode, mode);
      this.prevSpeed = this.lastSpeed;
      if (GAIT_MODES.has(mode)) this.rebaseLocks = true;
      if (moved > 0.2) snap = true;
    }
    this.needSnap = false;
    this.hasLast = true;
    this.lastRoot.set(e[12], e[13], e[14]);
    this.lastYaw = yaw;
    this.lastModeTime = anim.modeTime;
    this.fade = Math.min(1, this.fade + dt / this.fadeDur);
    this.prevTime += dt;
    const f = this.fade * this.fade * (3 - 2 * this.fade);

    const v = Math.max(0, anim.speed);
    const gTarget = mode === 'run' ? smooth(7.5, 10, v) : 0;
    this.gallopW += (gTarget - this.gallopW) * Math.min(1, dt * 4);
    if (dt === 0) this.gallopW = gTarget;
    const curGait = GAIT_MODES.has(mode);
    const prevGait = this.fade < 1 && GAIT_MODES.has(this.prevMode) && !this.prevFrozen;
    const fc = modeFreq(mode, v, this.gallopW);
    // the outgoing gait keeps the speed it had when the mode changed (it must not collapse when the root stops)
    const vp = this.prevSpeed;
    const fp = modeFreq(this.prevMode, vp, this.gallopW);
    const freq = curGait && prevGait ? fp + (fc - fp) * f : curGait ? fc : fp;
    const gait = curGait || prevGait;
    const prevPhase = this.phase;
    if (gait) this.phase += freq * dt;

    const c = this.ctx;
    c.speed = v;
    c.turn = THREE.MathUtils.clamp(anim.turn, -1, 1);
    c.time = anim.time;
    c.phase = this.phase;
    c.freq = freq;
    c.gallop = this.gallopW;

    sampleMode(mode, this.sA, anim.modeTime, c);
    let out = this.sA;
    if (this.fade < 1) {
      if (this.prevFrozen) this.sB.copy(this.sFrozen);
      else {
        c.speed = vp;
        sampleMode(this.prevMode, this.sB, this.prevTime, c);
        c.speed = v;
      }
      this.sB.lerpTo(this.sA, f);
      // entering a gait: the feet follow the gait itself (a blend of a static and a moving foot slides on the
      // ground while the root moves); the foot locks and the swing offset carry the feet over smoothly
      if (curGait) {
        const a = this.sA;
        const b = this.sB;
        for (let i = 0; i < 2; i++) {
          b.foot[i].copy(a.foot[i]);
          b.footPitch[i] = a.footPitch[i];
          b.footYaw[i] = a.footYaw[i];
          b.toes[i] = a.toes[i];
          b.knee[i].copy(a.knee[i]);
          b.plant[i] = a.plant[i];
        }
      }
      out = this.sB;
    }
    this.sOut.copy(out);
    this.lastSpeed = v;
    // terrain adaptation around the IK solve
    const sv = this.solver;
    const g = this.ground;
    g.debug = this.debugOn;
    // standing still the yeti keeps a staggered stance rather than shuffling its feet into the authored one
    g.stepThreshold = curGait ? 0.15 : mode === 'grab' || mode === 'disgust' ? 0.2 : 0.42;
    g.prepare(out, M, dt, snap, this.rebaseLocks);
    this.rebaseLocks = false;
    sv.applyFK(out);
    g.finish(out, sv);
    sv.solveRest(out, g);
    g.post(out, sv);

    // write bones
    for (let i = 0; i < BONE_COUNT; i++) this.bones[i].quaternion.copy(sv.local[i]);
    this.bones[B.hips].position.copy(sv.bindLocal[B.hips]).add(sv.hipsOffset);

    // fur dynamics: droop/trail with motion and vertical bounce
    const hy = sv.mp[B.hips].y;
    const vy = dt > 0 ? (hy - this.lastHipsY) / dt : 0;
    this.lastHipsY = hy;
    const k = Math.min(1, dt * 10);
    this.furVel.x += (-c.turn * Math.min(v, 12) * 0.012 - this.furVel.x) * k;
    this.furVel.y += (THREE.MathUtils.clamp(-vy * 0.12, -0.35, 0.35) - this.furVel.y) * k;
    this.furVel.z += (-Math.min(v, 15) * 0.022 - this.furVel.z) * k;
    this.furU.uMotion.value.copy(this.furVel);

    if (GAIT_MODES.has(mode) && this.fade > 0.5 && dt > 0 && v > 0.3) this.emitFootsteps(prevPhase, this.phase, mode, v);
    if (this.debugOn) this.updateDebug();
  }

  private emitFootsteps(p0: number, p1: number, mode: YetiMode, v: number): void {
    if (!this.onFootstep) return;
    const crossed = (ph: number): boolean => Math.floor(p1 - ph) > Math.floor(p0 - ph);
    const base = THREE.MathUtils.clamp(0.35 + v / 14, 0, 1) * (mode === 'emerge' ? 1.15 : mode === 'turnAway' ? 0.7 : 1);
    const fire = (side: 'left' | 'right', bone: number, offset: THREE.Vector3, strength: number): void => {
      const p = this.tmp.copy(offset).applyQuaternion(this.solver.mq[bone]).add(this.solver.mp[bone]);
      p.y = Math.max(this.ground.gm(p.x, p.z), p.y);
      const world = p.clone().applyMatrix4(this.root.matrixWorld);
      this.onFootstep?.(side, world, Math.min(1, strength));
    };
    const foot = (side: 'left' | 'right', strength: number): void => {
      const p = this.tmp;
      this.ground.contact(side === 'left' ? 0 : 1, this.solver, p);
      this.onFootstep?.(side, p.clone().applyMatrix4(this.root.matrixWorld), Math.min(1, strength));
    };
    if (this.gallopW > 0.5) {
      for (const st of GALLOP_STRIKES) {
        if (!crossed(st.ph)) continue;
        const side = st.side === 0 ? 'left' : 'right';
        if (st.hand) fire(side, st.side === 0 ? B.handL : B.handR, new THREE.Vector3(0, -0.3, 0.05), base * 0.85);
        else foot(side, base);
      }
    } else {
      const k = mode === 'crawl' ? 0.6 : 1;
      if (crossed(0)) foot('left', base * k);
      if (crossed(0.5)) foot('right', base * k);
    }
  }

  private toWorld(local: THREE.Vector3, target: THREE.Vector3): THREE.Vector3 {
    this.root.updateWorldMatrix(true, false);
    return target.copy(local).applyMatrix4(this.root.matrixWorld);
  }

  getHeadWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    return this.toWorld(this.solver.pointOn(B.head, HEAD_CENTER, new THREE.Vector3()), target);
  }

  getMouthWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    const m = this.solver.mouth(new THREE.Vector3());
    // a little in front of the lips
    const fwd = this.solver.pointOn(B.head, MOUTH_POS.clone().add(new THREE.Vector3(0, 0, 0.06)), new THREE.Vector3());
    const lip = this.solver.pointOn(B.head, MOUTH_POS, new THREE.Vector3());
    m.add(fwd.sub(lip));
    return this.toWorld(m, target);
  }

  getHandWorldPosition(side: 'left' | 'right', target: THREE.Vector3): THREE.Vector3 {
    const i = side === 'left' ? 0 : 1;
    const bone = side === 'left' ? B.handL : B.handR;
    return this.toWorld(this.solver.pointOn(bone, this.palmBind[i], new THREE.Vector3()), target);
  }

  setEyeGlow(v: number): void {
    this.eyeGlow.value = THREE.MathUtils.clamp(v, 0, 1);
  }

  setVisible(v: boolean): void {
    if (v && !this.root.visible) this.needSnap = true;
    this.root.visible = v;
  }

  /** World positions of the foot contact points (soles) — for tests/debug. */
  getFootContacts(target: { left: THREE.Vector3; right: THREE.Vector3 }): void {
    this.root.updateWorldMatrix(true, false);
    this.ground.contact(0, this.solver, target.left);
    this.ground.contact(1, this.solver, target.right);
    target.left.applyMatrix4(this.root.matrixWorld);
    target.right.applyMatrix4(this.root.matrixWorld);
  }

  /**
   * Tests/debug: per foot, the clearance of the lowest sole probe above the ground (m, negative = penetration),
   * whether the foot is planted (locked, weight-bearing) and whether it is taking a corrective step.
   */
  getGroundingState(out: { clearance: number[]; planted: boolean[]; stepping: boolean[] }): void {
    for (let i = 0; i < 2; i++) {
      out.clearance[i] = this.ground.contact(i, this.solver, this.tmp2);
      out.planted[i] = this.ground.isLocked(i) && this.ground.plant[i] > 0.99;
      out.stepping[i] = this.ground.isStepping(i);
    }
  }

  /** Tests: world positions of every sole probe (heel, ball inner/outer, centre, toe tip) of a foot. */
  getSoleProbes(side: 'left' | 'right', out: THREE.Vector3[]): void {
    this.root.updateWorldMatrix(true, false);
    this.ground.probesSolved(side === 'left' ? 0 : 1, this.solver, out);
    for (const p of out) p.applyMatrix4(this.root.matrixWorld);
  }

  /** Debug overlay: root marker, foot contact markers, ground-sample markers under each foot. Off by default. */
  setDebug(v: boolean): void {
    this.debugOn = v;
    if (v && !this.dbg) this.dbg = this.createDebug();
    if (this.dbg) this.dbg.group.visible = v;
    if (v) this.updateDebug();
  }

  private createDebug(): DebugOverlay {
    const group = new THREE.Group();
    group.name = 'YetiGroundDebug';
    const mk = (color: number): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true, opacity: 0.95 });
    const mats = [mk(0xff2bd6), mk(0x20ff40), mk(0xffd000), mk(0xff3020), mk(0x20c8ff)];
    const sphere = new THREE.SphereGeometry(0.045, 12, 8);
    const box = new THREE.BoxGeometry(0.03, 0.03, 0.03);
    const cross = new THREE.BoxGeometry(0.6, 0.02, 0.02);
    const root = new THREE.Mesh(cross, mats[0]);
    const root2 = new THREE.Mesh(cross, mats[0]);
    root2.rotation.y = Math.PI / 2;
    root.add(root2);
    group.add(root);
    const contacts = [0, 1].map(() => {
      const m = new THREE.Mesh(sphere, mats[1]);
      group.add(m);
      return m;
    });
    const samples = [0, 1].map(() =>
      Array.from({ length: PROBE_COUNT }, () => {
        const m = new THREE.Mesh(box, mats[4]);
        group.add(m);
        return m;
      }),
    );
    group.traverse((o) => {
      o.renderOrder = 10;
      o.frustumCulled = false;
    });
    this.root.add(group);
    return { group, root, contacts, samples, geos: [sphere, box, cross], mats };
  }

  private updateDebug(): void {
    const d = this.dbg;
    if (!d) return;
    for (let i = 0; i < 2; i++) {
      const cl = this.ground.contact(i, this.solver, d.contacts[i].position);
      const st = this.ground.isStepping(i) ? 2 : this.ground.isLocked(i) ? 1 : 3;
      d.contacts[i].material = Math.abs(cl) > 0.02 && st === 1 ? d.mats[3] : d.mats[st];
      for (let k = 0; k < PROBE_COUNT; k++) d.samples[i][k].position.copy(this.ground.dbgGround[i][k]);
    }
  }

  /** Debug/LOD helper: toggle fur shells and cards (e.g. far LOD or sculpt inspection). */
  setFurVisible(v: boolean): void {
    this.shells.visible = v;
    this.cards.visible = v;
  }

  /** Number of draw calls (excluding shadow passes). */
  get drawCalls(): number {
    return 5;
  }

  dispose(): void {
    if (this.dbg) {
      for (const g of this.dbg.geos) g.dispose();
      for (const m of this.dbg.mats) m.dispose();
      this.dbg.group.removeFromParent();
      this.dbg = null;
    }
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.skeleton.dispose();
    this.root.removeFromParent();
  }
}
