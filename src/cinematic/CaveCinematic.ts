/**
 * The Yeti cave reveal (≈16 s). The simulation is frozen for its whole duration; on completion the
 * Yeti leaps from the ledge and the chase begins. Storyboard beats are annotated inline.
 */
import * as THREE from 'three';
import { Timeline, ease, pose, type CamPose } from './Timeline';
import type { Stage } from '../game/Stage';
import { yetiSpawnAfterCinematic } from '../yeti/spawn';

export class CaveCinematic {
  readonly tl = new Timeline();
  private eye = 0;
  private eyeTarget = 0;
  private shakeLevel = 0;
  private dim = 0;
  private sunBase: number;
  private leap: { t: number; from: THREE.Vector3; vel: THREE.Vector3; heading: number; landed: boolean } | null = null;
  onRunPrompt: (() => void) | null = null;

  /** exit-path samples: depth s (m inside the mouth; negative = out on the ledge) → floor point */
  private path: Array<{ s: number; p: THREE.Vector3 }> = [];

  constructor(private st: Stage) {
    {
      const ep = st.world.cave.exitPath;
      ep.forEach((p, i) => this.path.push({ s: i === ep.length - 1 ? LEDGE_AT : 14 - 0.75 * i, p }));
    }
    const { world, camera, follow, phys } = st;
    this.sunBase = world.env.sun.intensity;
    const cave = world.cave;
    const M = cave.mouth.clone();
    const O = cave.outward.clone(); // toward the piste (-X)
    const P = phys.s.pos.clone();
    const downhill = new THREE.Vector3(0, 0, 1);
    const startPose = pose(camera.position, follow.lookTarget, camera.fov);
    const at = (base: THREE.Vector3, ox: number, oy: number, oz: number) => base.clone().addScaledVector(O, ox).add(new THREE.Vector3(0, oy, oz));
    const yetiInside = cave.inside.clone();
    // the Yeti walks the cave's own exit path (deep chamber → mouth → ledge); its feet are planted
    // on the exact visible floor (cave.floorHeightAt) for the whole sequence
    st.yeti.setGround((x, z) => cave.floorHeightAt(x, z));
    const yetiRoot = () => st.yeti.root.position;
    const head = new THREE.Vector3();
    const followPos = new THREE.Vector3();
    const followLook = new THREE.Vector3();
    const followPose = (): CamPose => {
      const s = phys.s;
      follow.idealPose({ pos: s.pos, vel: s.vel, heading: s.heading, grounded: s.grounded, crashed: false, speed: s.speed }, followPos, followLook);
      return pose(followPos, followLook, 64);
    };
    const toCave = new THREE.Vector3(M.x - P.x, 0, M.z - P.z).normalize();
    const reactionCam = pose(P.clone().addScaledVector(downhill, 3.0).addScaledVector(toCave, -2.2).add(new THREE.Vector3(0, 1.4, 0)), P.clone().add(new THREE.Vector3(0, 1.35, 0)), 46);
    const tl = this.tl;

    // Beat 1: the camera pulls away from the skier and turns toward the cliffside
    tl.shot({ start: 0, end: 2.4, from: () => startPose, via: () => pose(P.clone().add(new THREE.Vector3(-4, 7, -6)), M.clone().add(new THREE.Vector3(0, 6, 0)), 55), to: () => pose(at(M, 30, 7, 14), M.clone().add(new THREE.Vector3(0, 5, 0)), 42), easing: ease.inOutCubic });
    // Beat 2: snow sloughs off the rocks around the cave
    tl.shot({ start: 2.4, end: 3.8, from: () => pose(at(M, 24, 3.5, 9), cave.lipTop, 40), to: () => pose(at(M, 21, 3.2, 7), cave.lipTop.clone().add(new THREE.Vector3(0, -1, 0)), 40), handheld: 0.03 });
    // Beats 3–4: a huge shadow moves in the darkness; two eyes appear
    tl.shot({ start: 3.8, end: 6.6, from: () => pose(at(M, 12, 2.4, 1.5), yetiInside.clone().lerp(yetiRoot(), 0.6).add(new THREE.Vector3(0, 1.6, 0)), 38), to: () => pose(at(M, 6.5, 2.3, 0.6), yetiRoot().clone().add(new THREE.Vector3(0, 1.5, 0)), 30), easing: ease.linear, handheld: 0.02 });
    // Beat 5: a giant furry hand grips the cave entrance
    const hand = new THREE.Vector3();
    const handShot = (dist: number, fov: number) => () => {
      st.yeti.getHandWorldPosition('right', hand);
      return pose(hand.clone().addScaledVector(O, dist).add(new THREE.Vector3(0, -0.5, -0.9)), hand.clone().add(new THREE.Vector3(0, -0.2, 0)), fov);
    };
    tl.shot({ start: 6.6, end: 7.9, from: handShot(2.8, 34), to: handShot(2.4, 32), handheld: 0.012 });
    // Beat 6–7: he emerges and rises to full height (low angle)
    tl.shot({ start: 7.9, end: 11.0, from: () => pose(at(M, 9.0, 1.4, 3.2), M.clone().addScaledVector(O, 0.6).add(new THREE.Vector3(0, 1.8, 0)), 50), to: () => pose(at(M, 8.2, 1.2, 2.8), M.clone().addScaledVector(O, 1.6).add(new THREE.Vector3(0, 2.6, 0)), 48), handheld: 0.02 });
    // Beat 8: the roar — wide, then (beat 9) a close-up on the face
    tl.shot({ start: 11.0, end: 12.3, from: () => pose(at(M, 7.5, 0.6, 3.2), M.clone().add(new THREE.Vector3(-1.5, 3.0, 0)), 46), to: () => pose(at(M, 7, 0.5, 3), M.clone().add(new THREE.Vector3(-1.5, 3.2, 0)), 44) });
    tl.shot({
      start: 12.3,
      end: 13.7,
      from: () => {
        st.yeti.getHeadWorldPosition(head);
        return pose(head.clone().addScaledVector(O, 2.6).add(new THREE.Vector3(0, -0.15, 0.9)), head, 34);
      },
      to: () => {
        st.yeti.getHeadWorldPosition(head);
        return pose(head.clone().addScaledVector(O, 2.1).add(new THREE.Vector3(0, -0.2, 0.7)), head, 30);
      },
    });
    // Beat 10: cut to the skier, who looks back over their shoulder
    tl.shot({ start: 13.7, end: 14.6, from: () => reactionCam, to: () => pose(reactionCam.pos.clone().add(new THREE.Vector3(0, 0.1, 0.4)), reactionCam.look, 44) });
    // Beat 10b: he leaps from the ledge toward the piste — seen past the skier's shoulder
    const leapCam = P.clone().addScaledVector(downhill, -2.6).addScaledVector(toCave, -1.6).add(new THREE.Vector3(0, 1.5, 0));
    const yetiLook = () => st.yeti.root.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    tl.shot({ start: 14.6, end: 15.8, from: () => pose(leapCam, yetiLook(), 30), to: () => pose(leapCam.clone().add(new THREE.Vector3(0, 0.3, 0)), yetiLook(), 38) });
    // Beat 11: swing back into third person
    tl.shot({ start: 15.8, end: 17.0, from: () => pose(leapCam, yetiLook(), 38), via: () => pose(P.clone().addScaledVector(downhill, -5).add(new THREE.Vector3(0, 3, 0)), P.clone().add(new THREE.Vector3(0, 1.2, 4)), 58), to: followPose, easing: ease.inOutCubic });

    // --- actors & sound
    tl.at(0, () => {
      st.hud.letterbox(true);
      st.hud.gameplayWidgets(false);
      st.audio.setMusicMode('tension');
      st.audio.playYetiGrowl(M, false);
      st.yetiManual = true;
      st.yeti.setVisible(true);
      this.placeAt(CRAWL_FROM);
      st.setYetiMode('crawl');
      st.poseOverride = { lookBack: 0 };
    });
    tl.at(2.45, () => {
      st.audio.playCaveRumble();
      st.hud.caption('[rumbling from the cliff]');
      st.audio.playSnowSlide();
      this.shakeLevel = 0.25;
    });
    for (let i = 0; i < 10; i++) {
      tl.at(2.5 + i * 0.12, () => {
        const p = cave.lipTop;
        st.world.particles.emit({ x: p.x + (Math.random() - 0.5) * 2, y: p.y + 6 + Math.random() * 6, z: p.z + (Math.random() - 0.5) * 14, vx: -0.6, vy: 0, vz: 0, spread: 0.6, size: 0.5, life: 2.2, count: 22, gravity: 0.5, drag: 0.4, grow: 0.5, alpha: 0.9 });
      });
    }
    tl.at(4.9, () => {
      st.audio.playYetiGrowl(M, false);
      st.hud.caption('[something growls in the dark]');
    });
    tl.at(5.4, () => (this.eyeTarget = st.settings.reduceFlashes ? 0.55 : 1));
    tl.at(6.2, () => {
      // the grip pose settles while we are still on the eyes, so the insert finds the hand
      this.placeAt(GRIP_AT);
      st.setYetiMode('grip');
    });
    tl.at(6.6, () => {
      st.audio.playImpact('rock-light', 0.6);
    });
    tl.at(7.9, () => {
      this.eyeTarget = 0.25;
      st.setYetiMode('emerge');
    });
    tl.at(10.0, () => st.setYetiMode('stand'));
    // the music drops out so the roar hits from silence
    tl.at(10.65, () => st.audio.setMusicMode('none'));
    tl.at(11.05, () => {
      st.setYetiMode('roar');
      st.audio.playYetiRoar(M, 1);
      st.hud.caption('[TERRIFYING ROAR]', 2.5);
      st.shake(0.9);
      this.shakeLevel = 0.6;
    });
    tl.at(11.4, () => st.shakeTrees(M, 45, 30));
    tl.at(13.7, () => {
      this.shakeLevel = 0;
      st.poseOverride = { lookBack: 1, wobble: 0.3 };
      st.audio.playExertion('gasp');
      st.audio.setMusicMode('tension');
    });
    tl.at(14.6, () => {
      const sp = yetiSpawnAfterCinematic(st.world.mountain, st.world.focusEncounter?.anchor, st.world.cave.ledge);
      this.leap = { t: 0, from: sp.pos.clone(), vel: sp.leap.clone(), heading: sp.heading, landed: false };
      st.yeti.root.position.copy(sp.pos);
      st.yeti.root.rotation.set(0, sp.heading, 0);
      st.setYetiMode('leap');
      st.audio.playYetiGrowl(sp.pos, false);
    });
    tl.at(15.8, () => {
      st.poseOverride = { lookBack: 0 };
      st.hud.letterbox(false);
    });
    tl.at(17.0, () => {
      st.hud.gameplayWidgets(true);
      st.poseOverride = {};
      this.onRunPrompt?.();
    });
  }

  /** Yeti root motion during the scripted beats. */
  update(dt: number) {
    const st = this.st;
    const t = this.tl.time;
    const O = st.world.cave.outward;
    if (this.leap) {
      const L = this.leap;
      if (!L.landed) {
        L.t += dt;
        const p = st.yeti.root.position;
        p.set(L.from.x + L.vel.x * L.t, L.from.y + L.vel.y * L.t - 4.905 * L.t * L.t, L.from.z + L.vel.z * L.t);
        const h = st.world.mountain.heightAt(p.x, p.z);
        if (L.t > 0.2 && p.y <= h) {
          p.y = h;
          L.landed = true;
          st.setYetiMode('run');
          st.shake(0.5);
          st.audio.playYetiFootstep(p, 1);
          st.world.particles.emit({ x: p.x, y: h + 0.2, z: p.z, vx: 0, vy: 2, vz: 0, spread: 2.5, size: 0.7, life: 1.4, count: 60, gravity: 0.5, drag: 1.6, grow: 1.4, alpha: 0.85 });
        }
      }
      st.yetiAnim.speed = L.landed ? 0 : 6;
    } else if (t >= 7.9 && t < 10.0) {
      // heavy steps out of the darkness onto the ledge (root speed = real path speed)
      const k = (t - 7.9) / 2.1;
      const sNow = GRIP_AT + (LEDGE_AT - GRIP_AT) * ease.out(k);
      const sPrev = GRIP_AT + (LEDGE_AT - GRIP_AT) * ease.out(Math.max(0, k - dt / 2.1));
      this.placeAt(sNow);
      st.yetiAnim.speed = Math.abs(sNow - sPrev) / Math.max(1e-3, dt);
    } else if (t < 6.2) {
      // a low prowl up the tunnel from the deep chamber (deep in the dark until the eyes beat)
      const k = Math.min(1, Math.max(0, (t - 1.0) / 5.2));
      const sNow = CRAWL_FROM + (GRIP_AT + 0.6 - CRAWL_FROM) * k;
      this.placeAt(sNow);
      st.yetiAnim.speed = t < 1.0 ? 0 : Math.abs(GRIP_AT + 0.6 - CRAWL_FROM) / 5.2;
    } else st.yetiAnim.speed = 0;
    // the light drops while we stare into the darkness (sky/ambient light would otherwise
    // wash the inside of the cave; the sun is already blocked by the tunnel's shadow)
    const dim = t > 3.6 && t < 7.9 ? 1 : 0;
    this.dim += (dim - this.dim) * (1 - Math.exp(-2.5 * dt));
    st.world.env.setAmbientScale(1 - 0.85 * this.dim);
    // a cloud crosses the sun while we stare into the cave: low sun would otherwise reach in
    // through the mouth and light the Yeti like a stage (the reveal needs darkness and eyes)
    st.world.env.sun.intensity = this.sunBase * (1 - 0.82 * this.dim);
    st.world.terrain.uniforms.uCloudShadow.value = 1 + 1.5 * this.dim;
    this.eye += (this.eyeTarget - this.eye) * (1 - Math.exp(-3 * dt));
    st.yeti.setEyeGlow(this.eye);
    if (this.shakeLevel > 0) {
      st.shake(this.shakeLevel * dt * 2);
      this.shakeLevel = Math.max(0, this.shakeLevel - dt * 0.4);
    }
    // roar breath vapour
    if (t > 11.1 && t < 13.5 && Math.random() < 0.6) {
      const m = new THREE.Vector3();
      st.yeti.getMouthWorldPosition(m);
      st.world.particles.emit({ x: m.x, y: m.y, z: m.z, vx: O.x * 3, vy: 0.3, vz: O.z * 3, spread: 0.6, size: 0.35, life: 1.4, count: 3, gravity: -0.05, drag: 1.2, grow: 1.4, alpha: 0.35, color: 0.9 });
    }
  }

  /** Put the Yeti root on the exit path at depth s, on the exact floor, facing out. */
  private placeAt(s: number) {
    const P = this.path;
    if (!P.length) return;
    let i = 0;
    while (i < P.length - 2 && P[i + 1]!.s > s) i++;
    const a = P[i]!;
    const b = P[i + 1] ?? a;
    const f = a.s === b.s ? 0 : Math.min(1, Math.max(0, (a.s - s) / (a.s - b.s)));
    const root = this.st.yeti.root;
    root.position.lerpVectors(a.p, b.p, f);
    root.position.y = this.st.world.cave.floorHeightAt(root.position.x, root.position.z);
    const dx = b.p.x - a.p.x;
    const dz = b.p.z - a.p.z;
    if (dx * dx + dz * dz > 1e-6) root.rotation.set(0, Math.atan2(dx, dz), 0);
  }

  /** The spawn state handed to the chase when the cinematic ends (or is skipped). */
  finish() {
    const st = this.st;
    st.yeti.setEyeGlow(0);
    st.world.env.setAmbientScale(1);
    st.world.env.sun.intensity = this.sunBase;
    st.world.terrain.uniforms.uCloudShadow.value = 1;
    st.hud.letterbox(false);
    st.hud.gameplayWidgets(true);
    st.poseOverride = {};
    if (this.leap?.landed) {
      // the leap was filmed: the chase starts where he landed
      const p = st.yeti.root.position;
      st.yetiAI.place(p.x, p.z, this.leap.heading);
      st.yetiAI.startChase(null);
    } else {
      const sp = yetiSpawnAfterCinematic(st.world.mountain, st.world.focusEncounter?.anchor, st.world.cave.ledge);
      st.yetiAI.place(sp.pos.x, sp.pos.z, sp.heading, sp.pos.y - st.world.mountain.heightAt(sp.pos.x, sp.pos.z));
      st.yetiAI.startChase(sp.leap);
    }
    st.yetiManual = false;
    // the chase runs on the open mountain
    const m = st.world.mountain;
    st.yeti.setGround((x, z) => m.heightAt(x, z));
  }
}

/** exit-path depths (see Cave.exitPath): crawl start, grip point, ledge */
const CRAWL_FROM = 12.5;
const GRIP_AT = 1.0;
const LEDGE_AT = -2.2;
