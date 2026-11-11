/**
 * Procedurally modelled & animated player skier.
 *
 * Frame: `root` origin = point on the snow between the skis, +Z = direction of travel, +Y up.
 * The game drives root.position / root.quaternion; everything else (lean, angulation, crouch,
 * leg IK that keeps the skis planted, poles, crash tumble …) is handled here.
 *
 * Hierarchy (THREE.Bone, skinned fabric meshes + rigid attachments):
 *   root → bodyRoot → pelvis → spine → chest → neck → head (helmet, goggles)
 *                                        chest → clavicle → upperArm → forearm → hand (glove, pole)
 *                     pelvis → thigh → shin (boot cuff) → foot (boot shell, binding, ski)
 */
import * as THREE from 'three';
import type { QualityPreset, SkierPose } from '../core/types';
import { BONE, BONE_COUNT, DIM, armBones, legBones, sideSign } from './skier/rig';
import { acquireSkierGeometry, releaseSkierGeometry, type SkierGeometry } from './skier/parts';
import { createSkierMaterials, setJacketColor, type SkierMaterials } from './skier/materials';
import { PoseSpec, buildActivePose, buildCrashPose, type SmoothedPose } from './skier/pose';
import { basisQuat, clamp, damp, smoothstep, solveTwoBone } from './skier/math';

export interface SkierModelOptions {
  quality: QualityPreset;
  jacketColor?: number;
  pantsColor?: number;
}

const SKI_TIP_LOCAL = new THREE.Vector3(0, -DIM.ANKLE_H + 0.075, DIM.SKI_MOUNT_Z + DIM.SKI_HALF - 0.02);
const SKI_TAIL_LOCAL = new THREE.Vector3(0, -DIM.ANKLE_H + 0.004, DIM.SKI_MOUNT_Z - DIM.SKI_HALF + 0.08);
const SKI_BASE_LOCAL = new THREE.Vector3(0, -DIM.ANKLE_H, DIM.SKI_MOUNT_Z);
const FIST = new THREE.Vector3(0, DIM.FIST_Y, 0);

// scratch
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _end = new THREE.Vector3();
const _bend = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();

interface BodyXf {
  p: THREE.Vector3;
  q: THREE.Quaternion;
}
const xf = (): BodyXf => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() });

export class SkierModel {
  readonly root: THREE.Group;
  /** Object3D attached at the right hand where a trophy can be parented (kept upright). */
  readonly rightHandSocket: THREE.Object3D;

  private readonly quality: QualityPreset;
  private readonly geo: SkierGeometry;
  private readonly mats: SkierMaterials;
  private readonly bodyRoot = new THREE.Group();
  private readonly bones: THREE.Bone[] = [];
  private readonly skeleton: THREE.Skeleton;
  private readonly poles: [THREE.Group, THREE.Group];
  private readonly specActive = new PoseSpec();
  private readonly specCrash = new PoseSpec();
  private readonly spec = new PoseSpec();
  private readonly st: SmoothedPose = {
    steer: 0, lean: 0, tuck: 0, pizza: 0, drift: 0, driftAngle: 0, crouch: 0, air: 0, airTime: 0, land: 0,
    crashW: 0, crashTime: 0, crashSide: 1, speed: 0, lookBack: 0, celebrate: 0, wobble: 0, time: 0,
  };
  private initialized = false;
  private wasCrashed = false;
  private disposed = false;
  // body-space joint transforms of the last solve (for ground clamping)
  private readonly bx = {
    pelvis: xf(), spine: xf(), chest: xf(), neck: xf(), head: xf(),
    hand: [xf(), xf()] as [BodyXf, BodyXf],
    elbow: [new THREE.Vector3(), new THREE.Vector3()] as [THREE.Vector3, THREE.Vector3],
    knee: [new THREE.Vector3(), new THREE.Vector3()] as [THREE.Vector3, THREE.Vector3],
    foot: [xf(), xf()] as [BodyXf, BodyXf],
  };

  constructor(opts: SkierModelOptions) {
    this.quality = opts.quality;
    this.root = new THREE.Group();
    this.root.name = 'SkierModel';
    this.root.add(this.bodyRoot);
    this.bodyRoot.name = 'SkierBody';
    this.geo = acquireSkierGeometry(opts.quality);
    this.mats = createSkierMaterials(opts.quality, this.geo, opts.jacketColor ?? 0xc8302a, opts.pantsColor ?? 0x262a33);

    // ---- skeleton (bind pose) ----
    const names = Object.keys(BONE) as (keyof typeof BONE)[];
    for (let k = 0; k < BONE_COUNT; k++) {
      const b = new THREE.Bone();
      b.name = names.find((n) => BONE[n] === k) ?? `bone${k}`;
      this.bones.push(b);
    }
    const B = this.bones;
    const link = (parent: number, child: number, x: number, y: number, z: number): void => {
      B[parent].add(B[child]);
      B[child].position.set(x, y, z);
    };
    this.bodyRoot.add(B[BONE.pelvis]);
    B[BONE.pelvis].position.set(0, DIM.PELVIS_BIND_Y, 0);
    link(BONE.pelvis, BONE.spine, 0, DIM.SPINE_Y, 0);
    link(BONE.spine, BONE.chest, 0, DIM.CHEST_Y, 0);
    link(BONE.chest, BONE.neck, 0, DIM.NECK_Y, 0);
    link(BONE.neck, BONE.head, 0, DIM.HEAD_Y, 0);
    for (let i = 0; i < 2; i++) {
      const sg = sideSign(i);
      const a = armBones(i);
      link(BONE.chest, a.clav, sg * DIM.CLAV_X, DIM.CLAV_Y, DIM.CLAV_Z);
      link(a.clav, a.upper, sg * DIM.SHOULDER_X, DIM.SHOULDER_Y, 0);
      link(a.upper, a.fore, 0, -DIM.UPPER_ARM, 0);
      link(a.fore, a.hand, 0, -DIM.FOREARM, 0);
      const l = legBones(i);
      link(BONE.pelvis, l.thigh, sg * DIM.HIP_X, DIM.HIP_Y, 0);
      link(l.thigh, l.shin, 0, -DIM.THIGH, 0);
      link(l.shin, l.foot, 0, -DIM.SHIN, 0);
    }
    this.root.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(this.bones);

    // ---- skinned fabric ----
    const g = this.geo;
    const m = this.mats;
    const identity = new THREE.Matrix4();
    for (const [geom, mat] of [
      [g.jacket, m.jacket],
      [g.stripe, m.stripe],
      [g.pants, m.pants],
      [g.gaiter, m.gaiter],
    ] as [THREE.BufferGeometry, THREE.Material][]) {
      const sm = new THREE.SkinnedMesh(geom, mat);
      sm.frustumCulled = false;
      this.bodyRoot.add(sm);
      sm.bind(this.skeleton, identity);
      this.shadow(sm);
    }

    // ---- rigid attachments ----
    const head = B[BONE.head];
    this.attach(head, g.headFill, m.headFill);
    this.attach(head, g.helmet, m.helmet);
    this.attach(head, g.helmetDark, m.helmetDark);
    this.attach(head, g.goggleFrame, m.goggleFrame);
    this.attach(head, g.lens, m.lens).castShadow = false;
    this.attach(head, g.strap, m.strap);

    const poles: THREE.Group[] = [];
    for (let i = 0; i < 2; i++) {
      const a = armBones(i);
      const l = legBones(i);
      this.attach(B[a.fore], g.elbowFill, m.jacket);
      this.attach(B[a.hand], g.glove[i], m.glove);
      const pole = new THREE.Group();
      pole.name = i === 0 ? 'poleL' : 'poleR';
      this.attach(pole, g.poleGrip, m.poleGrip);
      this.attach(pole, g.poleShaft, m.poleShaft);
      pole.position.copy(FIST);
      B[a.hand].add(pole);
      poles.push(pole);

      this.attach(B[l.shin], g.kneeFill, m.pants).position.set(0, 0.004, 0.006);
      const cuff = this.attach(B[l.shin], g.bootCuff[i], m.bootCuff);
      cuff.position.set(0, -DIM.SHIN, 0);
      this.attach(B[l.shin], g.bootCuffMetal[i], m.metal).position.set(0, -DIM.SHIN, 0);
      const foot = B[l.foot];
      this.attach(foot, g.bootShell[i], m.bootShell);
      this.attach(foot, g.bootMetal[i], m.metal);
      this.attach(foot, g.bootDark, m.bootDark);
      this.attach(foot, g.binding, m.binding);
      this.attach(foot, g.bindingAccent, m.bindingAccent);
      this.attach(foot, g.ski, m.ski);
    }
    this.poles = [poles[0], poles[1]];
    this.rightHandSocket = new THREE.Object3D();
    this.rightHandSocket.name = 'rightHandSocket';
    this.rightHandSocket.position.copy(FIST);
    B[BONE.handR].add(this.rightHandSocket);
  }

  /** Approximate rendered triangle count of one skier at this quality. */
  get triangleCount(): number {
    return this.geo.triangles;
  }

  update(dt: number, pose: SkierPose): void {
    if (this.disposed) return;
    dt = clamp(dt, 0, 0.1);
    const st = this.st;
    const crashTarget = pose.crashed ? 1 - smoothstep(0, 1, pose.recover) : 0;
    if (!this.initialized) {
      this.initialized = true;
      st.steer = pose.steer;
      st.lean = pose.lean;
      st.tuck = pose.tuck;
      st.pizza = pose.pizza;
      st.drift = pose.drift;
      st.driftAngle = pose.driftAngle;
      st.crouch = pose.crouch;
      st.air = pose.airborne ? 1 : 0;
      st.land = pose.landImpact;
      st.lookBack = pose.lookBack;
      st.celebrate = pose.celebrate;
      st.wobble = pose.wobble;
      st.crashW = crashTarget;
    } else {
      st.steer = damp(st.steer, pose.steer, 8, dt);
      st.lean = damp(st.lean, pose.lean, 14, dt);
      st.tuck = damp(st.tuck, pose.tuck, 7, dt);
      st.pizza = damp(st.pizza, pose.pizza, 9, dt);
      st.drift = damp(st.drift, pose.drift, 8, dt);
      st.driftAngle = damp(st.driftAngle, pose.driftAngle, 9, dt);
      st.crouch = damp(st.crouch, pose.crouch, 12, dt);
      st.air = damp(st.air, pose.airborne ? 1 : 0, pose.airborne ? 6 : 12, dt);
      st.land = damp(st.land, pose.landImpact, pose.landImpact > st.land ? 30 : 10, dt);
      st.lookBack = damp(st.lookBack, pose.lookBack, 7, dt);
      st.celebrate = damp(st.celebrate, pose.celebrate, 5, dt);
      st.wobble = damp(st.wobble, pose.wobble, 9, dt);
      st.crashW = damp(st.crashW, crashTarget, crashTarget > st.crashW ? 20 : 9, dt);
    }
    if (pose.crashed && !this.wasCrashed) {
      st.crashSide = st.lean > 0.02 ? 1 : st.lean < -0.02 ? -1 : st.steer >= 0 ? 1 : -1;
    }
    this.wasCrashed = pose.crashed;
    st.airTime = pose.airTime;
    st.crashTime = pose.crashTime;
    st.speed = pose.speed;
    st.time = pose.time;

    buildActivePose(st, this.specActive);
    let spec = this.specActive;
    if (st.crashW > 0.0005) {
      buildCrashPose(st, this.specCrash);
      spec = this.spec.blend(this.specActive, this.specCrash, smoothstep(0, 1, st.crashW));
    }
    this.apply(spec);
    if (st.crashW > 0.0005) this.groundClamp(Math.min(1, st.crashW * 3));

    // fabric flutter and idle motion
    this.mats.flutter.uTime.value = pose.time;
    this.mats.flutter.uFlutter.value = 0.0045 * clamp(pose.speed / 28, 0, 1) * (1 - st.crashW * 0.8) + 0.0012 * st.wobble;
  }

  /** Writes the world-space position of the given hand (fist centre). */
  getHandWorldPosition(side: 'left' | 'right', target: THREE.Vector3): THREE.Vector3 {
    const b = this.bones[side === 'left' ? BONE.handL : BONE.handR];
    b.updateWorldMatrix(true, false);
    return target.copy(FIST).applyMatrix4(b.matrixWorld);
  }

  /** World-space position of a ski tail on the snow (track ribbons / spray emitters). */
  getSkiTailWorld(side: 'left' | 'right', target: THREE.Vector3): THREE.Vector3 {
    const b = this.bones[side === 'left' ? BONE.footL : BONE.footR];
    b.updateWorldMatrix(true, false);
    return target.copy(SKI_TAIL_LOCAL).applyMatrix4(b.matrixWorld);
  }

  getSkiTipWorld(side: 'left' | 'right', target: THREE.Vector3): THREE.Vector3 {
    const b = this.bones[side === 'left' ? BONE.footL : BONE.footR];
    b.updateWorldMatrix(true, false);
    return target.copy(SKI_TIP_LOCAL).applyMatrix4(b.matrixWorld);
  }

  setVisible(v: boolean): void {
    this.root.visible = v;
  }

  /** Cosmetics: recolour the jacket (purely visual). */
  setJacketColor(color: number): void {
    setJacketColor(this.mats, color);
  }

  /** current jacket colour (sRGB hex; tests) */
  get jacketColor(): number {
    return this.mats.jacket.color.getHex();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const mat of this.mats.list) mat.dispose();
    this.skeleton.dispose();
    releaseSkierGeometry(this.quality);
  }

  // -------------------------------------------------------------------------------------------

  private attach(parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(g, m);
    this.shadow(mesh);
    parent.add(mesh);
    return mesh;
  }

  private shadow(o: THREE.Mesh): void {
    o.castShadow = true;
    o.receiveShadow = true;
  }

  /** Apply a pose spec: FK for the spine, analytic IK for arms and legs. */
  private apply(s: PoseSpec): void {
    const B = this.bones;
    const bx = this.bx;
    this.bodyRoot.position.copy(s.bodyPos);
    this.bodyRoot.quaternion.copy(s.bodyQuat);

    // spine chain
    B[BONE.pelvis].position.copy(s.pelvisPos);
    B[BONE.pelvis].quaternion.copy(s.pelvisQuat);
    B[BONE.spine].quaternion.copy(s.spine);
    B[BONE.chest].quaternion.copy(s.chest);
    B[BONE.neck].quaternion.copy(s.neck);
    B[BONE.head].quaternion.copy(s.head);
    bx.pelvis.p.copy(s.pelvisPos);
    bx.pelvis.q.copy(s.pelvisQuat);
    this.fk(bx.pelvis, B[BONE.spine], bx.spine);
    this.fk(bx.spine, B[BONE.chest], bx.chest);
    this.fk(bx.chest, B[BONE.neck], bx.neck);
    this.fk(bx.neck, B[BONE.head], bx.head);

    const clavX = xfScratch;
    for (let i = 0; i < 2; i++) {
      const a = armBones(i);
      // ---- arm ----
      B[a.clav].quaternion.copy(s.clav[i]);
      this.fk(bx.chest, B[a.clav], clavX);
      const S = _v1.copy(B[a.upper].position).applyQuaternion(clavX.q).add(clavX.p);
      solveTwoBone(S, s.hand[i], s.elbowPole[i], DIM.UPPER_ARM, DIM.FOREARM, _mid, _end, _bend);
      bx.elbow[i].copy(_mid);
      _z.copy(_bend).negate();
      const qUpper = basisQuat(_y.subVectors(S, _mid).normalize(), _z, _q1);
      const qFore = basisQuat(_y.subVectors(_mid, _end).normalize(), _z, _q2);
      // hand: wrist straight, rotated so the grip axis (+Z) runs up the pole
      const qHand = basisQuat(_y, _v2.copy(s.poleDir[i]).negate(), bx.hand[i].q);
      bx.hand[i].p.copy(_end);
      B[a.upper].quaternion.copy(clavX.q).invert().multiply(qUpper);
      B[a.fore].quaternion.copy(qUpper).invert().multiply(qFore);
      B[a.hand].quaternion.copy(qFore).invert().multiply(qHand);
      // pole aim (pole local -Y = shaft direction)
      const pole = this.poles[i];
      const qPoleBody = basisQuat(_v3.copy(s.poleDir[i]).negate(), _v2.set(0, 0, 1).applyQuaternion(qHand), _q3);
      _q1.copy(qHand).invert();
      pole.quaternion.copy(_q1).multiply(qPoleBody);
      pole.position.copy(FIST).addScaledVector(_v2.copy(s.poleDir[i]).applyQuaternion(_q1), -s.poleSlide[i]);
      if (i === 1) {
        // keep the trophy socket upright in body space
        this.rightHandSocket.quaternion.copy(_q1);
      }

      // ---- leg ----
      const l = legBones(i);
      const H = _v1.copy(B[l.thigh].position).applyQuaternion(s.pelvisQuat).add(s.pelvisPos);
      solveTwoBone(H, s.ankle[i], s.kneePole[i], DIM.THIGH, DIM.SHIN, _mid, _end, _bend);
      bx.knee[i].copy(_mid);
      const qThigh = basisQuat(_y.subVectors(H, _mid).normalize(), _bend, _q1);
      const qShin = basisQuat(_y.subVectors(_mid, _end).normalize(), _bend, _q2);
      B[l.thigh].quaternion.copy(s.pelvisQuat).invert().multiply(qThigh);
      B[l.shin].quaternion.copy(qThigh).invert().multiply(qShin);
      B[l.foot].quaternion.copy(qShin).invert().multiply(s.foot[i]);
      bx.foot[i].p.copy(_end);
      bx.foot[i].q.copy(s.foot[i]);
    }
  }

  private fk(parent: BodyXf, bone: THREE.Object3D, out: BodyXf): void {
    out.p.copy(bone.position).applyQuaternion(parent.q).add(parent.p);
    out.q.copy(parent.q).multiply(bone.quaternion);
  }

  /** While crashed: lift/lower the tumbling body so its lowest part rests on the snow. */
  private groundClamp(w: number): void {
    const t = this.st.crashTime;
    const dig = this.st.crashW > 0.5 && t < 1.5 ? 0.35 - 0.23 * smoothstep(0.9, 1.5, t) : 0.12;
    const q = this.bodyRoot.quaternion;
    const p = this.bodyRoot.position;
    const bx = this.bx;
    let minY = Infinity;
    const test = (v: THREE.Vector3, r: number): void => {
      const y = _v3.copy(v).applyQuaternion(q).add(p).y - r;
      if (y < minY) minY = y;
    };
    test(_v2.set(DIM.HEAD_CX, DIM.HEAD_CY, DIM.HEAD_CZ).applyQuaternion(bx.head.q).add(bx.head.p), 0.14);
    test(_v2.set(0, 0.12, -0.01).applyQuaternion(bx.chest.q).add(bx.chest.p), 0.15);
    test(bx.spine.p, 0.13);
    test(_v2.set(0, -0.04, -0.01).applyQuaternion(bx.pelvis.q).add(bx.pelvis.p), 0.13);
    for (let i = 0; i < 2; i++) {
      test(bx.knee[i], 0.07);
      test(bx.elbow[i], 0.06);
      test(bx.hand[i].p, 0.05);
      test(_v2.copy(SKI_BASE_LOCAL).applyQuaternion(bx.foot[i].q).add(bx.foot[i].p), 0);
      // ski tips/tails may dig into soft snow (deeper while tumbling)
      test(_v2.copy(SKI_TIP_LOCAL).applyQuaternion(bx.foot[i].q).add(bx.foot[i].p), -dig);
      test(_v2.copy(SKI_TAIL_LOCAL).applyQuaternion(bx.foot[i].q).add(bx.foot[i].p), -dig);
    }
    if (Number.isFinite(minY)) p.y -= minY * w;
  }
}

const xfScratch: BodyXf = xf();
