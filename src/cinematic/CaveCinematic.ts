/**
 * The Yeti cave reveal (≈16 s). The simulation is frozen for its whole duration; on completion the
 * Yeti leaps from the ledge and the chase begins. Storyboard beats are annotated inline.
 */
import * as THREE from 'three';
import { Timeline, ease, pose, type CamPose } from './Timeline';
import type { Stage } from '../game/Stage';
import { CAVE_GATHER_AT, CAVE_LEAP_AT, CAVE_TURN_AT, LEAP_SETUP, leapSetupLook, startCanonicalChase } from './caveHandoff';
import { yetiSpawnAfterCinematic } from '../yeti/spawn';
import type { CaveCinematicExtras } from '../world/presentation/cave';

/**
 * Cave-relative camera stations of the shared encounter: offsets (along the cave's outward
 * direction O, up, +z) from the mouth. Exported so a location's cave dressing can keep its props
 * out of these lenses (see cameraClearance / the Fjord sea cave).
 */
export const CAVE_CAMS = {
  establish: [30, 7, 14],
  slough0: [24, 3.5, 9],
  slough1: [21, 3.2, 7],
  dark0: [12, 2.4, 1.5],
  dark1: [6.5, 2.3, 0.6],
  emerge0: [9.0, 1.4, 3.2],
  emerge1: [8.6, 1.5, 2.8],
  roar0: [7.5, 0.6, 3.2],
  roar1: [7, 0.5, 3],
} as const satisfies Record<string, readonly [number, number, number]>;

/**
 * The sight lines of the shared cave shots (camera → what it looks at), in world space, for a cave
 * with this mouth / outward / brow. The hand and face close-ups sit within ~3 m of the mouth along O
 * and are approximated by a station there.
 */
export function caveCameraSightlines(mouth: THREE.Vector3, outward: THREE.Vector3, lipTop: THREE.Vector3): Array<{ cam: THREE.Vector3; look: THREE.Vector3 }> {
  const O = outward;
  const at = (ox: number, oy: number, oz: number) => mouth.clone().addScaledVector(O, ox).add(new THREE.Vector3(0, oy, oz));
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  return [
    { cam: at(...CAVE_CAMS.establish), look: mouth.clone().add(v(0, 5, 0)) },
    { cam: at(...CAVE_CAMS.slough0), look: lipTop.clone() },
    { cam: at(...CAVE_CAMS.slough1), look: lipTop.clone().add(v(0, -1, 0)) },
    { cam: at(...CAVE_CAMS.dark0), look: mouth.clone().add(v(0, 1.6, 0)) },
    { cam: at(...CAVE_CAMS.dark1), look: mouth.clone().add(v(0, 1.5, 0)) },
    { cam: at(...CAVE_CAMS.emerge0), look: mouth.clone().addScaledVector(O, 0.6).add(v(0, 1.8, 0)) },
    { cam: at(...CAVE_CAMS.emerge1), look: mouth.clone().addScaledVector(O, 1.6).add(v(0, 1.9, 0)) },
    { cam: at(...CAVE_CAMS.roar0), look: mouth.clone().add(v(-1.5, 3.0, 0)) },
    { cam: at(...CAVE_CAMS.roar1), look: mouth.clone().add(v(-1.5, 3.2, 0)) },
    // hand insert and face close-ups (Yeti at the mouth / on the ledge)
    { cam: at(2.8, 1.2, 0.9), look: mouth.clone().add(v(0, 0.6, 0)) },
    { cam: at(4.2, 2.9, 0.8), look: mouth.clone().addScaledVector(O, 1.6).add(v(0, 3.1, 0)) },
  ];
}

export class CaveCinematic {
  readonly tl = new Timeline();
  private eye = 0;
  private eyeTarget = 0;
  private shakeLevel = 0;
  private dim = 0;
  private dimShade = 1;
  onRunPrompt: (() => void) | null = null;

  /** exit-path samples: depth s (m inside the mouth; negative = out on the ledge) → floor point */
  private path: Array<{ s: number; p: THREE.Vector3 }> = [];

  constructor(private st: Stage) {
    {
      const ep = st.world.cave.exitPath;
      ep.forEach((p, i) => this.path.push({ s: i === ep.length - 1 ? LEDGE_AT : 14 - 0.75 * i, p }));
    }
    const { world, camera, follow, phys } = st;
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
    const toCave = new THREE.Vector3(M.x - P.x, 0, M.z - P.z).normalize();
    const reactionCam = pose(P.clone().addScaledVector(downhill, 3.0).addScaledVector(toCave, -2.2).add(new THREE.Vector3(0, 1.4, 0)), P.clone().add(new THREE.Vector3(0, 1.35, 0)), 46);
    const tl = this.tl;

    // Beat 1: the camera pulls away from the skier and turns toward the cliffside
    tl.shot({ start: 0, end: 2.4, from: () => startPose, via: () => pose(P.clone().add(new THREE.Vector3(-4, 7, -6)), M.clone().add(new THREE.Vector3(0, 6, 0)), 55), to: () => pose(at(M, ...CAVE_CAMS.establish), M.clone().add(new THREE.Vector3(0, 5, 0)), 42), easing: ease.inOutCubic });
    // Beat 2: snow sloughs off the rocks around the cave
    tl.shot({ start: 2.4, end: 3.8, from: () => pose(at(M, ...CAVE_CAMS.slough0), cave.lipTop, 40), to: () => pose(at(M, ...CAVE_CAMS.slough1), cave.lipTop.clone().add(new THREE.Vector3(0, -1, 0)), 40), handheld: 0.03 });
    // Beats 3–4: a huge shadow moves in the darkness; two eyes appear
    tl.shot({ start: 3.8, end: 6.6, from: () => pose(at(M, ...CAVE_CAMS.dark0), yetiInside.clone().lerp(yetiRoot(), 0.6).add(new THREE.Vector3(0, 1.6, 0)), 38), to: () => pose(at(M, ...CAVE_CAMS.dark1), yetiRoot().clone().add(new THREE.Vector3(0, 1.5, 0)), 30), easing: ease.linear, handheld: 0.02 });
    // Beat 5: a giant furry hand reaches out of the dark and plants on the threshold
    // (low, close, from just outside the mouth; the head looms behind it in the darkness)
    const hand = new THREE.Vector3();
    const handHead = new THREE.Vector3();
    const handShot = (dist: number, fov: number) => () => {
      st.yeti.getHandWorldPosition('right', hand);
      st.yeti.getHeadWorldPosition(handHead);
      const look = hand.clone().lerp(handHead, 0.35);
      // camera a little higher and looking slightly lower: the planted hand sits above the letterbox (C12)
      return pose(hand.clone().addScaledVector(O, dist).add(new THREE.Vector3(0, 0.95, 0.9)), look.add(new THREE.Vector3(0, -0.15, 0)), fov);
    };
    tl.shot({ start: 6.6, end: 7.9, from: handShot(2.8, 34), to: handShot(2.4, 32), handheld: 0.012 });
    // Beat 6–7: he emerges and rises to full height (low angle)
    tl.shot({ start: 7.9, end: 11.0, from: () => pose(at(M, ...CAVE_CAMS.emerge0), M.clone().addScaledVector(O, 0.6).add(new THREE.Vector3(0, 1.8, 0)), 50), to: () => pose(at(M, ...CAVE_CAMS.emerge1), M.clone().addScaledVector(O, 1.6).add(new THREE.Vector3(0, 1.9, 0)), 50), handheld: 0.02 });
    // Beat 8: the roar — wide, then (beat 9) a close-up on the face
    tl.shot({ start: 11.0, end: 12.3, from: () => pose(at(M, ...CAVE_CAMS.roar0), M.clone().add(new THREE.Vector3(-1.5, 3.0, 0)), 46), to: () => pose(at(M, ...CAVE_CAMS.roar1), M.clone().add(new THREE.Vector3(-1.5, 3.2, 0)), 44) });
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
    tl.shot({ start: 13.7, end: 14.2, from: () => reactionCam, to: () => pose(reactionCam.pos.clone().add(new THREE.Vector3(0, 0.1, 0.4)), reactionCam.look, 44) });
    // Beat 10b: he leaps from the ledge toward the piste — seen past the skier's shoulder
    // over the skier's shoulder: camera behind the skier on the line to the cave, framing both
    const leapCam = P.clone().addScaledVector(toCave, -LEAP_SETUP.back).addScaledVector(downhill, 1.3).add(new THREE.Vector3(0, 1.35 + LEAP_SETUP.lift, 0));
    const skierHead = P.clone().add(new THREE.Vector3(0, 1.5, 0));
    {
      // keep the ledge in sight: where the ground between the camera and the ledge rises above the
      // line of sight (a cave cut into a bank above the piste — Whiteout's crest side), lift the camera
      // until it clears; an unobstructed shot (every Alpine and Fjord cave) is left exactly as it was
      const m = st.world.mountain;
      const target = st.world.cave.ledge.clone().add(new THREE.Vector3(0, 1.6, 0)).lerp(skierHead, 0.34);
      const blocked = (c: THREE.Vector3) => {
        for (let i = 2; i < 24; i++) {
          const u = i / 24;
          const x = c.x + (target.x - c.x) * u, z = c.z + (target.z - c.z) * u;
          if (c.y + (target.y - c.y) * u < m.heightAt(x, z) + 0.6) return true;
        }
        return false;
      };
      for (let k = 0; k < 24 && blocked(leapCam); k++) leapCam.y += 0.5;
    }
    const yetiLook = () => leapSetupLook(leapCam, st.yeti.root.position.clone().add(new THREE.Vector3(0, 1.6, 0)), skierHead);
    // Beat 10b: from behind the skier's position toward the cave, the Yeti gathering on the ledge
    tl.shot({ start: CAVE_GATHER_AT, end: CAVE_TURN_AT, from: () => pose(leapCam, yetiLook(), LEAP_SETUP.fov), to: () => pose(leapCam.clone().add(new THREE.Vector3(0, 0.1, 0)), yetiLook(), LEAP_SETUP.fov) });
    // Beat 11 (W-076, owner's decision 1): the camera swings around the skier from the Yeti to the run
    // and lands on the follow camera's own forward pose, so control returns looking downhill — the
    // same gameplay camera a skip gives. The leap is the chase's first second (caveHandoff.ts).
    // Reduce Camera Motion: no swing — a hold on the Yeti, then a cut to the forward view.
    let fwd: CamPose | null = null;
    const forward = () => (fwd ??= st.gameplayPose());
    const turnFrom = () => pose(leapCam.clone().add(new THREE.Vector3(0, 0.1, 0)), yetiLook(), LEAP_SETUP.fov);
    const pivot = P.clone().add(new THREE.Vector3(0, 1.2, 0));
    if (st.settings.reduceCameraMotion) {
      const cutAt = (CAVE_TURN_AT + CAVE_LEAP_AT) / 2;
      tl.shot({ start: CAVE_TURN_AT, end: cutAt, from: turnFrom, to: turnFrom });
      tl.shot({ start: cutAt, end: CAVE_LEAP_AT, from: forward, to: forward });
    } else tl.shot({ start: CAVE_TURN_AT, end: CAVE_LEAP_AT, from: turnFrom, to: forward, orbit: () => pivot, easing: ease.inOut });

    // --- actors & sound
    tl.at(0, () => {
      st.hud.letterbox(true);
      st.hud.gameplayWidgets(false);
      st.hud.clearCaption();
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
      // stops at the threshold on all fours, one hand planted on the lip of the floor
      this.placeAt(GRIP_AT);
      st.setYetiMode('crawl');
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
    tl.at(CAVE_GATHER_AT, () => {
      // (at the cut) he takes his place for the leap: on the ledge, facing the piste — the chase AI
      // takes him from here; the leap's crouch and launch play when control returns
      const sp = yetiSpawnAfterCinematic(st.world.mountain, st.world.focusEncounter?.anchor, st.world.cave.ledge);
      st.yeti.root.position.copy(sp.pos);
      st.yeti.root.rotation.set(0, sp.heading, 0);
      st.setYetiMode('stand');
      st.audio.playYetiGrowl(sp.pos, false);
    });
    tl.at(CAVE_TURN_AT, () => {
      // the skier turns to face the run and the bars open as the camera comes round (0.7 s transition)
      st.poseOverride = { lookBack: 0, wobble: 0.2 };
      st.hud.letterbox(false);
    });

    // location beats (Fjord: gulls, spray, its own shot overrides); none for Alpine
    this.extra = st.world.presentation.cave.cinematic?.({ st, cave, tl, at: (ox, oy, oz) => at(M, ox, oy, oz) }) ?? null;
    // the cinematic ends at the leap, whatever a location's beats schedule after it
    tl.duration = CAVE_LEAP_AT;
  }

  private extra: CaveCinematicExtras | null = null;

  /** Yeti root motion during the scripted beats. */
  update(dt: number) {
    const st = this.st;
    const t = this.tl.time;
    this.extra?.update?.(dt, t);
    const O = st.world.cave.outward;
    if (t >= CAVE_LEAP_AT) {
      st.yetiAnim.speed = 0;
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
      const sNow = CRAWL_FROM + (GRIP_AT - CRAWL_FROM) * ease.out(k);
      this.placeAt(sNow);
      st.yetiAnim.speed = t < 1.0 ? 0 : (Math.abs(GRIP_AT - CRAWL_FROM) / 5.2) * Math.max(0.15, 1 - k) * 2; // ease-out speed
    } else st.yetiAnim.speed = 0;
    // the light drops while we stare into the darkness (sky/ambient light would otherwise
    // wash the inside of the cave; the sun is already blocked by the tunnel's shadow)
    // starts dimming well before the cut to the dark interior (3.8 s), so that shot opens dark (C4)
    const dim = t > 2.9 && t < 7.9 ? 1 : 0;
    this.dim += (dim - this.dim) * (1 - Math.exp(-2.5 * dt));
    st.world.env.setAmbientScale(1 - 0.85 * this.dim);
    // during the dark beats the Yeti is a shape in the shadow wherever he stands (eyes stay lit, A9)
    this.dimShade = 1 - 0.82 * this.dim;
    this.applyShade();
    // a cloud crosses the sun while we stare into the cave: low sun would otherwise reach in
    // through the mouth and light the Yeti like a stage (the reveal needs darkness and eyes)
    st.world.env.setSunScale(1 - 0.82 * this.dim);
    st.world.terrain.uniforms.uCloudShadow.value = 1 + 1.5 * this.dim;
    // no sun glints and no falling flakes against the black interior (they read as stars, C9/A8)
    st.world.terrain.uniforms.uGlint.value = 1 - this.dim;
    st.world.env.setFlakes(this.dim < 0.2);
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
  private curS = 0;
  private applyShade() {
    const s = this.curS;
    this.st.yeti.setShade(this.tl.time >= CAVE_GATHER_AT ? 1 : Math.min(this.dimShade, 1 - 0.88 * Math.min(1, Math.max(0, (s - 0.5) / 6))));
  }

  private placeAt(s: number) {
    const P = this.path;
    if (!P.length) return;
    let i = 0;
    while (i < P.length - 2 && P[i + 1]!.s > s) i++;
    const a = P[i]!;
    const b = P[i + 1] ?? a;
    const f = a.s === b.s ? 0 : Math.min(1, Math.max(0, (a.s - s) / (a.s - b.s)));
    const root = this.st.yeti.root;
    // deeper in the tunnel = darker (the sky light cannot reach in there)
    this.curS = s;
    this.applyShade();
    root.position.lerpVectors(a.p, b.p, f);
    root.position.y = this.st.world.cave.floorHeightAt(root.position.x, root.position.z);
    const dx = b.p.x - a.p.x;
    const dz = b.p.z - a.p.z;
    if (dx * dx + dz * dz > 1e-6) root.rotation.set(0, Math.atan2(dx, dz), 0);
  }

  /** The spawn state handed to the chase when the cinematic ends (or is skipped). */
  finish() {
    const st = this.st;
    this.extra?.dispose();
    this.extra = null;
    st.yeti.setEyeGlow(0);
    st.yeti.setShade(1);
    st.world.env.setAmbientScale(1);
    st.world.env.setSunScale(1);
    st.world.terrain.uniforms.uCloudShadow.value = 1;
    st.world.terrain.uniforms.uGlint.value = 1;
    st.world.env.setFlakes(true);
    st.hud.letterbox(false);
    st.hud.gameplayWidgets(true);
    st.poseOverride = {};
    {
      // (round 3) one canonical chase start, watched or skipped at any moment: the Yeti on the ledge,
      // leaping (caveHandoff.ts) — skipping removes only the presentation
      const m = st.world.mountain;
      const sp = yetiSpawnAfterCinematic(m, st.world.focusEncounter?.anchor, st.world.cave.ledge);
      startCanonicalChase(st.yetiAI, sp, (x, z) => m.heightAt(x, z));
    }
    st.yetiManual = false;
    // the chase runs on the open mountain
    const m = st.world.mountain;
    st.yeti.setGround((x, z) => m.heightAt(x, z));
  }
}

/** exit-path depths (see Cave.exitPath): crawl start, grip point, ledge */
const CRAWL_FROM = 12.5;
const GRIP_AT = 0.6;
const LEDGE_AT = -2.2;
