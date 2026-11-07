/**
 * The Yeti: procedural sculpted + skinned creature with instanced shell fur, fur-lock cards,
 * teeth/claws and glowing eyes, driven by fully procedural, cross-faded animation.
 *
 * root: origin on the ground between the feet, faces +Z, +Y up. The game positions/rotates root.
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
  bipedFreq,
  gallopFreq,
  sampleMode,
  smooth,
  type AnimCtx,
} from './model/animation';
import { PoseSolver } from './model/pose';
import { B, BONE_COUNT, BONE_NAMES, HEAD_CENTER, MOUTH_POS, PARENT_INDEX, armFrame } from './model/rig';

const CROSSFADE = 0.3;

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
  private phase = 0;
  private gallopW = 0;
  private started = false;
  private sA = new PoseSample();
  private sB = new PoseSample();
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
  }

  update(dt: number, anim: YetiAnimState): void {
    const mode: YetiMode = anim.mode === 'hidden' ? 'lurk' : anim.mode;
    if (!this.started) {
      this.curMode = mode;
      this.prevMode = mode;
      this.fade = 1;
      this.started = true;
    } else if (mode !== this.curMode) {
      this.prevMode = this.curMode;
      this.prevTime = this.lastModeTime;
      this.curMode = mode;
      this.fade = 0;
    }
    this.lastModeTime = anim.modeTime;
    this.fade = Math.min(1, this.fade + dt / CROSSFADE);
    this.prevTime += dt;

    const v = Math.max(0, anim.speed);
    const gTarget = mode === 'run' ? smooth(7.5, 10, v) : 0;
    this.gallopW += (gTarget - this.gallopW) * Math.min(1, dt * 4);
    if (dt === 0) this.gallopW = gTarget;
    const freq = bipedFreq(v) * (1 - this.gallopW) + gallopFreq(v) * this.gallopW;
    const heavy = mode === 'emerge' ? 0.85 : mode === 'turnAway' ? 0.9 : 1;
    const gait = GAIT_MODES.has(mode) || (this.fade < 1 && GAIT_MODES.has(this.prevMode));
    const prevPhase = this.phase;
    if (gait) this.phase += freq * heavy * dt;

    const c = this.ctx;
    c.speed = v;
    c.turn = THREE.MathUtils.clamp(anim.turn, -1, 1);
    c.time = anim.time;
    c.phase = this.phase;
    c.freq = freq * heavy;
    c.gallop = this.gallopW;

    sampleMode(mode, this.sA, anim.modeTime, c);
    if (this.fade < 1) {
      sampleMode(this.prevMode, this.sB, this.prevTime, c);
      const f = this.fade * this.fade * (3 - 2 * this.fade);
      this.sB.lerpTo(this.sA, f);
      this.solver.apply(this.sB);
    } else this.solver.apply(this.sA);

    // write bones
    const sv = this.solver;
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
  }

  private emitFootsteps(p0: number, p1: number, mode: YetiMode, v: number): void {
    if (!this.onFootstep) return;
    const crossed = (ph: number): boolean => Math.floor(p1 - ph) > Math.floor(p0 - ph);
    const base = THREE.MathUtils.clamp(0.35 + v / 14, 0, 1) * (mode === 'emerge' ? 1.15 : mode === 'turnAway' ? 0.7 : 1);
    this.root.updateWorldMatrix(true, false);
    const fire = (side: 'left' | 'right', bone: number, offset: THREE.Vector3, strength: number): void => {
      const p = this.tmp.copy(offset).applyQuaternion(this.solver.mq[bone]).add(this.solver.mp[bone]);
      p.y = Math.max(0, p.y);
      const world = p.clone().applyMatrix4(this.root.matrixWorld);
      this.onFootstep?.(side, world, Math.min(1, strength));
    };
    const footOff = new THREE.Vector3(0, -0.2, 0.1);
    if (this.gallopW > 0.5) {
      for (const st of GALLOP_STRIKES) {
        if (!crossed(st.ph)) continue;
        const side = st.side === 0 ? 'left' : 'right';
        if (st.hand) fire(side, st.side === 0 ? B.handL : B.handR, new THREE.Vector3(0, -0.3, 0.05), base * 0.85);
        else fire(side, st.side === 0 ? B.footL : B.footR, footOff, base);
      }
    } else {
      if (crossed(0)) fire('left', B.footL, footOff, base);
      if (crossed(0.5)) fire('right', B.footR, footOff, base);
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
    this.root.visible = v;
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
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.skeleton.dispose();
    this.root.removeFromParent();
  }
}
