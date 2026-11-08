/**
 * One run of the game: fixed-timestep simulation, phase progression, events → FX/audio/camera,
 * cinematics, scoring and results. Created fresh for every run; the World is reused.
 */
import * as THREE from 'three';
import type { Encounter, Sighting } from '../world/course';
import { DIFFICULTY } from './CourseConfig';
import { PHYS_DT, SkierPhysics, type SkierEvent, type SkierInput, DRIFT_MIN_SPEED } from '../physics/SkierPhysics';
import { YetiAI } from '../yeti/YetiAI';
import { RunState } from './RunState';
import { FollowCamera } from '../camera/FollowCamera';
import { CaveCinematic } from '../cinematic/CaveCinematic';
import { DefeatCinematic, VictoryCinematic } from '../cinematic/EndCinematics';
import { Timeline, ease, pose } from '../cinematic/Timeline';
import { autopilotInput, type AutopilotStyle } from '../debug/autopilot';
import { clamp, damp, smoothstep, wrapAngle } from '../core/rng';
import type { SkierPose, YetiAnimState, YetiMode, AudioFrameState } from '../core/types';
import type { World } from './World';
import type { SkierModel } from '../player/SkierModel';
import type { YetiModel } from '../yeti/YetiModel';
import type { AudioEngine } from '../audio/AudioEngine';
import type { Hud } from '../ui/Hud';
import type { Settings, RunStats } from '../core/settings';
import type { Device, GameplayInput } from '../input/Input';
import type { Stage } from './Stage';

const UP = new THREE.Vector3(0, 1, 0);

const TUTORIAL: Array<{ key: string; html: (h: Hud) => string; done: (s: SessionView) => boolean }> = [
  { key: 'steer', html: (h) => `${h.g('left')} ${h.g('right')} Steer — lean into the turns`, done: (s) => s.tut.steer > 1.0 },
  { key: 'pizza', html: (h) => `Hold ${h.g('brake')} <b>PIZZA</b> — snowplow to brake`, done: (s) => s.tut.brake > 0.7 },
  { key: 'fries', html: (h) => `Hold ${h.g('tuck')} <b>FRENCH FRIES</b> — tuck for speed`, done: (s) => s.tut.tuck > 1.2 },
  { key: 'drift', html: (h) => `At speed, hold ${h.g('drift')} + steer to <b>DRIFT</b>`, done: (s) => s.tut.drift > 0.5 },
  { key: 'pop', html: (h) => `Kicker ahead — hold ${h.g('pop')} and release to <b>POP</b>`, done: (s) => s.tut.air > 0.35 },
];

interface SessionView {
  tut: { steer: number; brake: number; tuck: number; drift: number; air: number };
}

export interface SessionHooks {
  onResults(stats: RunStats, won: boolean): void;
  onPauseRequest(): void;
}

export class GameSession implements Stage {
  readonly phys: SkierPhysics;
  readonly yetiAI: YetiAI;
  readonly run: RunState;
  readonly follow: FollowCamera;
  poseOverride: Partial<SkierPose> = {};
  yetiAnim: YetiAnimState = { mode: 'hidden', modeTime: 0, speed: 0, turn: 0, time: 0 };
  yetiManual = false;
  private acc = 0;
  private time = 0;
  private prevPos = new THREE.Vector3();
  private renderPos = new THREE.Vector3();
  private prevHeading = 0;
  private normalSmoothed = new THREE.Vector3(0, 1, 0);
  private input: SkierInput = { steer: 0, tuck: 0, brake: 0, drift: false, pop: false, recover: false };
  private recoverLatch = false;
  private cave: CaveCinematic | null = null;
  private defeat: DefeatCinematic | null = null;
  private victory: VictoryCinematic | null = null;
  private intro: Timeline | null = null;
  autopilot: AutopilotStyle | null = null;
  paused = false;
  // scoring
  private multiplier = 1;
  private cleanTime = 0;
  private style = 0;
  private resultsSent = false;
  tut = { steer: 0, brake: 0, tuck: 0, drift: 0, air: 0 };
  private tutIndex = 0;
  private tutHold = 0;
  private growls = new Set<number>();
  private eerie = 0;
  private sprayAcc = 0;
  private breathAcc = 0;
  private vF = new THREE.Vector3();
  private vFwd = new THREE.Vector3();
  private vX = new THREE.Vector3();
  private vL = new THREE.Vector3();
  private vR = new THREE.Vector3();
  private vM = new THREE.Vector3();
  private vRight = new THREE.Vector3();
  private m4 = new THREE.Matrix4();
  private lastLeft = new THREE.Vector3();
  private lastRight = new THREE.Vector3();

  constructor(
    readonly world: World,
    readonly skier: SkierModel,
    readonly yeti: YetiModel,
    readonly audio: AudioEngine,
    readonly hud: Hud,
    readonly settings: Settings,
    readonly camera: THREE.PerspectiveCamera,
    private hooks: SessionHooks,
    opts: { skipIntro?: boolean } = {},
  ) {
    const m = world.mountain;
    this.run = new RunState({ tutorialEndZ: m.profile.tutorialEndZ, finishZ: m.finishZ, encounters: (a, b) => m.profile.encounters(a, b) });
    world.focusEncounter = null;
    world.stream(2, true);
    this.phys = new SkierPhysics(world.mountain, world.obstacles, world.extraColliders);
    this.phys.reset(m.routeX(2), 2, 0, 0);
    this.yetiAI = new YetiAI(world.mountain, world.obstacles);
    this.follow = new FollowCamera(camera, world.mountain, world.obstacles);
    this.follow.shakeScale = settings.cameraShake;
    this.follow.reduceMotion = settings.reduceCameraMotion;
    this.prevPos.copy(this.phys.s.pos);
    this.skier.setVisible(true);
    this.yeti.setVisible(false);
    this.yeti.setGround((x, z) => m.heightAt(x, z));
    this.yeti.onFootstep = (side, p, strength) => {
      this.world.yetiPrints.add(p.x, p.z, this.yetiAI.heading, side, 1.1);
      this.audio.playYetiFootstep(p, strength);
      if (this.yetiAI.distance < 45 && this.run.phase === 'chase') this.hud.caption('[heavy footsteps behind you]', 1.2);
      // snow puffs only on open snow: inside the dark cave the unlit particles glow like orbs (A12)
      const inCave = this.run.phase === 'caveCinematic' && Number.isFinite(this.world.cave.clearanceAt(p.x, p.z));
      if (!inCave) this.world.particles.emit({ x: p.x, y: p.y + 0.1, z: p.z, vx: 0, vy: 0.8, vz: 0, spread: 1.2 * strength, size: 0.55, life: 0.9, count: Math.round(6 + 8 * strength), gravity: 0.4, drag: 2, grow: 1.2, alpha: 0.6 });
      const d = this.yetiAI.distance;
      if (d < 30) this.shake(0.12 * strength * (1 - d / 30));
    };
    this.world.tracks.clear();
    this.world.particles.clear();
    this.world.yetiPrints.clear();
    this.hud.reset();
    this.audio.setMusicMode('explore');
    this.follow.snap(this.followTarget());
    if (!opts.skipIntro) this.buildIntro();
    else this.run.endIntro();
  }

  // --- Stage API -----------------------------------------------------------------
  shake(amount: number) {
    this.follow.addTrauma(amount * this.settings.cameraShake);
  }

  setYetiMode(m: YetiMode) {
    if (this.yetiAnim.mode !== m) {
      this.yetiAnim.mode = m;
      this.yetiAnim.modeTime = 0;
    }
  }

  shakeTrees(center: THREE.Vector3, radius: number, max: number) {
    let n = 0;
    for (const o of this.world.obstacles.inRange(center.z - radius, center.z + radius)) {
      if (o.kind !== 'tree') continue;
      if (Math.abs(o.z - center.z) > radius || Math.abs(o.x - center.x) > radius) continue;
      if (n++ > max) break;
      const delay = Math.hypot(o.x - center.x, o.z - center.z) / 60;
      this.timers.push(setTimeout(() => {
        for (let k = 0; k < 3; k++)
          this.world.particles.emit({ x: o.x, y: o.y + o.height * (0.4 + 0.2 * k), z: o.z, vx: 0, vy: -0.5, vz: 0, spread: 1.4 * o.scale, size: 0.45, life: 1.6, count: 8, gravity: 0.35, drag: 1, grow: 0.6, alpha: 0.75 });
      }, delay * 1000));
    }
  }

  private timers: ReturnType<typeof setTimeout>[] = [];
  private hockey = false;

  // --- intro ------------------------------------------------------------------------
  private buildIntro() {
    const s = this.phys.s;
    const P = s.pos.clone();
    const tl = new Timeline();
    const fp = new THREE.Vector3();
    const fl = new THREE.Vector3();
    this.follow.idealPose(this.followTarget(), fp, fl);
    tl.shot({ start: 0, end: 4.2, from: () => pose(P.clone().add(new THREE.Vector3(18, 9, 22)), P.clone().add(new THREE.Vector3(0, 1.2, 0)), 46), via: () => pose(P.clone().add(new THREE.Vector3(10, 4, -8)), P.clone().add(new THREE.Vector3(0, 1.4, 4)), 52), to: () => pose(fp, fl, 64), easing: ease.inOutCubic });
    const goal = this.endless ? 'Survive as far as you can. Bank your run at the refuges.' : `Reach the resort, ${(this.world.mountain.finishZ / 1000).toFixed(0)} km down the mountain.`;
    tl.at(0.2, () => this.hud.title('THE LAST DESCENT', goal, 'intro', 3.4));
    tl.at(4.2, () => {});
    this.intro = tl;
    this.hud.letterbox(true);
    this.hud.gameplayWidgets(false);
  }

  private endIntro() {
    this.intro = null;
    this.hud.letterbox(false);
    this.hud.gameplayWidgets(true);
    this.run.endIntro();
    this.follow.snap(this.followTarget());
  }

  // --- per-frame ------------------------------------------------------------------
  frame(dtReal: number, gi: GameplayInput, device: Device) {
    const dt = Math.min(dtReal, 0.1);
    this.hud.device = device;
    const cavePausable = this.run.phase === 'caveCinematic' && !this.recordsSeenCave;
    if (gi.pausePressed && (!this.isCinematic() || cavePausable || this.intro)) {
      this.hooks.onPauseRequest();
      return;
    }
    if (this.paused) return;
    this.time += dt;
    this.yetiAnim.time = this.time;

    // cinematics consume skip input
    if (this.intro) {
      this.intro.advance(dt);
      this.intro.apply(this.camera);
      if (gi.skipPressed || gi.pop || this.intro.done) this.endIntro();
    } else if (this.run.phase === 'caveCinematic' && this.cave) {
      const canSkip = this.recordsSeenCave;
      this.hud.setSkipHint(canSkip ? `Skip  ${this.hud.g('skip')}` : null);
      if (canSkip && gi.skipPressed) {
        this.cave.tl.skip();
        this.follow.consumeTrauma(100);
        this.audio.setMusicMode('tension');
      } else {
        this.cave.tl.advance(dt);
        this.cave.update(dt);
        this.cave.tl.apply(this.camera, undefined);
        this.applyCineShake(dt);
      }
      if (this.cave.tl.done) {
        this.finishCave();
        // the cinematic already moved the Yeti this frame: start simulating next frame (C13)
        this.handoffFrame = true;
      }
    }

    // player input → physics input
    this.mapInput(gi);
    if (this.handoffFrame) {
      this.handoffFrame = false;
      this.acc = 0;
    } else if (this.run.simulating && !this.intro) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= PHYS_DT && steps < 12) {
        this.fixedStep();
        this.acc -= PHYS_DT;
        steps++;
      }
      if (steps === 12) this.acc = 0;
    } else if (this.run.phase === 'caught' || this.run.phase === 'victory' || this.run.phase === 'results') {
      // physics keeps running for the victory stop; the defeat drives the skier manually
      this.acc += dt;
      while (this.acc >= PHYS_DT) {
        if (this.victory || this.run.outcome === 'victory') this.fixedStepVictory();
        this.acc -= PHYS_DT;
      }
    }
    this.syncVisuals(dt);

    // the ending cinematics can be skipped straight to the results (after a beat)
    if ((this.victory || this.defeat) && !this.resultsSent) {
      const tl = (this.victory ?? this.defeat)!.tl;
      this.hud.setSkipHint(tl.time > 1.2 ? `Skip  ${this.hud.g('skip')}` : null);
      if (tl.time > 1.2 && gi.skipPressed) {
        this.hud.setSkipHint(null);
        this.sendResults(!!this.victory);
      }
    } else if (this.resultsSent && (this.victory || this.defeat)) this.hud.setSkipHint(null);
    if (this.defeat) {
      this.defeat.tl.advance(dt);
      this.defeat.update(dt);
      this.defeat.tl.apply(this.camera);
      this.applyCineShake(dt);
    } else if (this.victory) {
      this.victory.tl.advance(dt);
      this.victory.update(dt);
      this.victory.tl.apply(this.camera);
    } else if (!this.intro && this.run.phase !== 'caveCinematic') {
      this.follow.chaseFrame = damp(this.follow.chaseFrame, this.run.phase === 'chase' ? smoothstep(80, 15, this.yetiAI.distance) : 0, 2, dt);
      this.follow.orbit(gi.camX, gi.camY);
      this.follow.lookBack = gi.lookBack && this.run.controllable ? 1 : 0;
      this.follow.avoid = this.run.phase === 'chase' && this.yeti.root.visible ? this.yeti.root.position : null;
      this.follow.update(dt, this.followTarget(true));
    }
    this.updateTutorial(dt);
    this.updateHud(dt);
    this.updateAudio(dt);
  }

  recordsSeenCave = false;
  private handoffFrame = false;

  /** Rear-view framing (skier in the foreground, the yeti behind), or null when not needed. */
  rearView(out: { pos: THREE.Vector3; look: THREE.Vector3 }): number {
    if (this.run.phase !== 'chase' || !this.yeti.root.visible) return 0;
    const d = this.yetiAI.distance;
    if (d > 110) return 0;
    const s = this.phys.s;
    const yaw = s.speed > 2 ? Math.atan2(s.vel.x, s.vel.z) : s.heading;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const p = this.renderPos;
    // just ahead and off to the side of the skier, framed on the beast (the skier is a small
    // foreground silhouette at the frame edge)
    out.pos.set(p.x + fx * 1.5 + fz * 2.4, p.y + 1.5, p.z + fz * 1.5 - fx * 2.4);
    const y = this.yeti.root.position;
    out.look.set(y.x, y.y + 1.6, y.z);
    return smoothstep(110, 90, d);
  }

  get inIntro(): boolean {
    return !!this.intro;
  }

  private applyCineShake(dt: number) {
    // shake during cinematics uses the follow camera's trauma as a source
    const tr = this.follow.consumeTrauma(dt);
    if (tr > 0.001) {
      const a = tr * tr * 0.05 * this.settings.cameraShake * (this.settings.reduceCameraMotion ? 0 : 1);
      this.camera.rotateX((Math.random() - 0.5) * a);
      this.camera.rotateY((Math.random() - 0.5) * a);
    }
  }

  isCinematic() {
    return !!this.intro || this.run.phase === 'caveCinematic' || this.run.phase === 'caught' || this.run.phase === 'victory' || this.run.phase === 'results';
  }

  private mapInput(gi: GameplayInput) {
    if (this.autopilot) {
      this.input = autopilotInput(this.world.mountain, this.phys.s, this.autopilot, this.time);
      return;
    }
    const ctl = this.run.controllable;
    this.input.steer = ctl ? gi.steer : 0;
    this.input.tuck = ctl ? gi.tuck : 0;
    this.input.brake = ctl ? gi.brake : 0;
    this.input.drift = ctl && gi.drift;
    this.input.pop = ctl && gi.pop;
    if (gi.recoverPressed) this.recoverLatch = true;
  }

  private fixedStep() {
    const s = this.phys.s;
    this.prevPos.copy(s.pos);
    this.prevHeading = s.heading;
    if (!this.autopilot) this.input.recover = this.recoverLatch;
    this.phys.step(this.input, PHYS_DT);
    this.recoverLatch = false;
    for (const e of this.phys.drainEvents()) this.onEvent(e);

    // tutorial bookkeeping
    if (this.run.phase === 'learn') {
      if (Math.abs(this.input.steer) > 0.3) this.tut.steer += PHYS_DT;
      if (this.input.brake > 0.3) this.tut.brake += PHYS_DT;
      if (this.input.tuck > 0.3) this.tut.tuck += PHYS_DT;
      if (s.drifting) this.tut.drift += PHYS_DT;
      if (!s.grounded) this.tut.air += PHYS_DT;
    }
    // scoring: multiplier builds with clean riding at speed
    if (!s.crashed && s.speed > 14) {
      this.cleanTime += PHYS_DT;
      if (this.cleanTime > 6) {
        this.cleanTime = 0;
        this.multiplier = Math.min(4, +(this.multiplier + 0.1).toFixed(1));
      }
    }

    const startCave = this.run.progress(s.pos.z, PHYS_DT);
    if (startCave) this.beginCave();

    if (this.run.phase === 'chase') {
      const target = { pos: s.pos, vel: s.vel, airborne: !s.grounded };
      this.yetiAI.update(PHYS_DT, target);
      if (this.yetiAI.canCatch(target) && this.run.catchPlayer()) this.beginDefeat();
      else if (s.pos.z >= this.world.mountain.finishZ && this.run.reachFinish()) this.beginVictory();
      else if (this.run.reachCheckpoint(s.pos.z)) this.onCheckpoint();
    }

    // foreshadowing: growls & eerie ambience by progress (relative to the coming cave)
    const enc = this.run.encounter;
    if (enc && this.run.phase !== 'chase' && this.run.phase !== 'caveCinematic') {
      for (const off of [-390, -230, -100]) {
        const gz = enc.caveZ + off;
        const key = enc.index * 10 + (off === -390 ? 0 : off === -230 ? 1 : 2);
        if (!this.growls.has(key) && s.pos.z > gz) {
          this.growls.add(key);
          const mouth = this.mouthOf(enc);
          this.audio.playYetiGrowl(mouth, off < -150);
          this.hud.caption(off < -150 ? '[a distant growl echoes across the mountain]' : '[a deep growl, much closer]');
          if (off === -230) this.audio.playBranchSnap(mouth);
        }
      }
      this.eerie = smoothstep(enc.caveZ - 200, enc.caveZ - 10, s.pos.z);
    } else this.eerie = 0;
    // sightings on long courses: the Yeti is out there, watching (sound + caption)
    if (this.run.phase === 'free' || this.run.phase === 'foreshadow') {
      for (const sg of this.world.mountain.profile.sightings(s.pos.z - 20, s.pos.z)) this.sighting(sg);
    }
  }

  private seenSightings = new Set<number>();
  private sighting(sg: Sighting) {
    if (this.seenSightings.has(sg.z)) return;
    this.seenSightings.add(sg.z);
    const m = this.world.mountain;
    const z = sg.z + 160;
    const x = m.centerX(z) + sg.side * (m.halfWidth(z) + 140);
    const p = new THREE.Vector3(x, m.heightAt(x, z) + 4, z);
    this.audio.playYetiGrowl(p, true);
    this.hud.caption(sg.side > 0 ? '[a howl from the ridge to your right]' : '[a howl from the ridge to your left]', 3);
  }

  private mouthOf(e: Encounter): THREE.Vector3 {
    return this.world.caveFor(e).cave.mouth;
  }

  /** A refuge at the end of a chase was reached (Endless: bank the run). The Yeti gives up for now. */
  private onCheckpoint() {
    if (this.endless) this.banked = this.liveScore();
    this.yetiAI.standDown();
    this.yeti.setVisible(false);
    this.yetiAnim.mode = 'hidden';
    this.world.focusEncounter = null;
    this.audio.setMusicMode('explore');
    if (this.endless) this.hud.title(`REFUGE ${this.run.checkpointsReached}`, `Run banked: ${this.banked.toLocaleString('en-US')} pts. Retire from the pause menu, or push on.`, 'intro', 4);
    else this.hud.title(`REFUGE ${this.run.checkpointsReached}`, 'The Yeti lost your trail… for now. The resort is still a long way down.', 'intro', 4);
    this.hud.caption('[a furious howl fades behind you]', 3);
    this.audio.playUiMove();
  }

  /** Endless: score safely banked at the last refuge */
  banked = 0;

  get endless(): boolean {
    return !Number.isFinite(this.world.mountain.finishZ);
  }

  /** Endless: end the run now, keeping the banked score. */
  retire(): boolean {
    if (!this.endless || !this.run.retire()) return false;
    this.sendResults(false);
    return true;
  }

  private fixedStepVictory() {
    const s = this.phys.s;
    this.prevPos.copy(s.pos);
    this.prevHeading = s.heading;
    const v = this.victory;
    if (!v) return;
    // auto-steer to the stop point; drift-brake into a hockey stop near it
    const sp = v.stopPoint;
    const d = Math.hypot(sp.x - s.pos.x, sp.z - s.pos.z);
    const want = Math.atan2(sp.x - s.pos.x, Math.max(2, sp.z - s.pos.z));
    const err = wrapAngle(want - s.heading);
    const stopping = d < 22 || s.pos.z > sp.z - 4;
    // hockey stop: swing the skis ~90° across the direction of travel once, then hold the edge
    const travel = s.speed > 1 ? Math.atan2(s.vel.x, s.vel.z) : s.heading;
    const across = Math.abs(wrapAngle(s.heading - travel));
    if (stopping && !this.hockey) {
      this.hockey = true;
      this.world.particles.emit({ x: s.pos.x, y: s.pos.y + 0.1, z: s.pos.z, vx: s.vel.x * 0.4, vy: 1.6, vz: s.vel.z * 0.4, spread: 2.2, size: 0.45, life: 1.3, count: 70, gravity: 0.5, drag: 1.8, grow: 1.4, alpha: 0.85 });
    }
    const inp: SkierInput = {
      steer: stopping ? (across < 1.45 && s.speed > 2 ? 1 : 0) : clamp(-err * 2.5, -1, 1),
      tuck: 0,
      brake: stopping ? 1 : smoothstep(60, 20, d) * 0.6,
      drift: stopping && s.speed > DRIFT_MIN_SPEED,
      pop: false,
      recover: true,
    };
    this.phys.step(inp, PHYS_DT);
    for (const e of this.phys.drainEvents()) this.onEvent(e);
    if (s.speed < 0.5) s.vel.multiplyScalar(0.9);
  }

  // --- events -------------------------------------------------------------------
  private onEvent(e: SkierEvent) {
    const s = this.phys.s;
    const fx = this.world.particles;
    switch (e.type) {
      case 'takeoff':
        this.audio.playTakeoff(clamp(e.speed / 30, 0, 1));
        break;
      case 'pop':
        this.audio.playPop();
        break;
      case 'land': {
        this.audio.playLanding(e.impact, e.hard);
        const n = Math.round(10 + e.impact * 50);
        fx.emit({ x: s.pos.x, y: s.pos.y + 0.05, z: s.pos.z, vx: s.vel.x * 0.3, vy: 1.5 + e.impact * 2, vz: s.vel.z * 0.3, spread: 1.5 + e.impact * 2, size: 0.4 + e.impact * 0.4, life: 1.1, count: n, gravity: 0.5, drag: 2, grow: 1.4, alpha: 0.8 });
        if (e.hard) {
          this.shake(0.45);
          this.audio.playExertion('grunt');
        } else if (e.airTime > 0.3) this.shake(0.12 * e.impact);
        break;
      }
      case 'impact': {
        const big = e.kind !== 'branch' && e.kind !== 'rock-light';
        this.audio.playImpact(e.kind, e.intensity);
        if (e.kind === 'branch') this.audio.playBranchSnap(new THREE.Vector3(e.x, s.pos.y + 2, e.z));
        fx.emit({ x: (s.pos.x + e.x) / 2, y: s.pos.y + (e.kind === 'branch' ? 1.8 : 0.4), z: (s.pos.z + e.z) / 2, vx: 0, vy: e.kind === 'branch' ? -0.4 : 1, vz: 0, spread: 1.5, size: 0.4, life: 1.2, count: big ? 40 : 14, gravity: 0.5, alpha: 0.85 });
        this.shake(big ? 0.35 * e.intensity : 0.08);
        break;
      }
      case 'crash':
        this.audio.playImpact('crash', e.intensity);
        this.audio.playExertion('yelp');
        this.shake(0.8 * e.intensity);
        fx.emit({ x: s.pos.x, y: s.pos.y + 0.5, z: s.pos.z, vx: s.vel.x * 0.4, vy: 2.5, vz: s.vel.z * 0.4, spread: 3, size: 0.6, life: 1.5, count: 70, gravity: 0.5, drag: 1.8, grow: 1.2, alpha: 0.9 });
        this.multiplier = 1;
        this.cleanTime = 0;
        break;
      case 'recover':
        break;
      case 'trick':
        this.style += Math.round(e.points * this.multiplier);
        this.hud.popTrick(e.name, Math.round(e.points * this.multiplier));
        if (e.name.startsWith('CLEAN')) this.multiplier = Math.min(4, +(this.multiplier + 0.2).toFixed(1));
        break;
    }
  }

  // --- phases ---------------------------------------------------------------------
  private beginCave() {
    this.hud.setPrompt(null);
    const e = this.run.encounter!;
    this.world.focusEncounter = e;
    this.world.caveFor(e);
    // documented ceiling: never more than +33 % over the classic Yeti, whatever the escalation
    // and difficulty (B13); a skilled skier must always be able to escape
    this.yetiAI.speedMul = Math.min(1.33, e.speedMul * DIFFICULTY[this.world.course.difficulty].yetiSpeed);
    this.cave = new CaveCinematic(this);
    this.cave.onRunPrompt = () => {};
    this.input.steer = 0;
  }

  private finishCave() {
    if (!this.cave) return;
    this.cave.finish();
    this.cave = null;
    this.run.endCaveCinematic();
    this.recordsSeenCave = true;
    this.onCaveSeen?.();
    this.hud.setSkipHint(null);
    this.hud.title('RUN.', '', 'run', 1.6);
    this.audio.playRunPrompt();
    this.audio.setMusicMode('chase');
    this.follow.snap(this.followTarget());
    this.yeti.setVisible(true);
  }

  onCaveSeen: (() => void) | null = null;

  private beginDefeat() {
    this.hud.setPrompt(null);
    this.yetiAI.phase = 'caught';
    this.defeat = new DefeatCinematic(this);
    this.defeat.onResults = () => this.sendResults(false);
  }

  private beginVictory() {
    this.hud.setPrompt(null);
    this.yetiAI.phase = 'stopped';
    this.victory = new VictoryCinematic(this);
    this.victory.onResults = () => this.sendResults(true);
  }

  private sendResults(won: boolean) {
    if (this.resultsSent) return;
    this.resultsSent = true;
    this.run.showResults();
    this.hooks.onResults(this.stats(won), won);
  }

  /** score of the run so far (before end-of-run bonuses) */
  private liveScore(): number {
    const s = this.phys.s;
    const distance = clamp(s.pos.z, 0, this.world.mountain.finishZ);
    return Math.round(distance * 2 + this.style + this.run.chaseTime * 25 + this.run.checkpointsReached * 2500);
  }

  stats(won: boolean): RunStats {
    const s = this.phys.s;
    const distance = clamp(s.pos.z, 0, this.world.mountain.finishZ);
    const survival = this.run.chaseTime;
    let score = this.liveScore() + (won ? 5000 : 0) + Math.round(s.maxSpeed * 3.6 * 10);
    if (this.endless) {
      // Endless: retiring keeps the banked score; being caught keeps the bank plus half of the rest
      const live = this.liveScore();
      score = this.run.outcome === 'retired' ? this.banked : this.run.outcome === 'caught' ? this.banked + Math.round((live - this.banked) * 0.5) : live;
    }
    return {
      won,
      banked: this.endless && this.run.outcome === 'retired',
      time: this.run.runTime,
      distance,
      maxSpeed: s.maxSpeed,
      airtime: s.totalAir,
      longestAir: s.longestAir,
      crashes: s.crashes,
      survival,
      score,
      courseId: this.world.id,
      seed: this.world.seed,
      checkpoints: this.run.checkpointsReached,
    };
  }

  // --- visuals ----------------------------------------------------------------------
  private followTarget(interp = false) {
    const s = this.phys.s;
    const pos = interp ? this.renderPos : s.pos;
    return { pos, vel: s.vel, heading: s.heading, grounded: s.grounded, crashed: s.crashed, speed: s.speed };
  }

  private syncVisuals(dt: number) {
    const s = this.phys.s;
    const alpha = clamp(this.acc / PHYS_DT, 0, 1);
    this.renderPos.lerpVectors(this.prevPos, s.pos, this.run.simulating || this.victory ? alpha : 1);
    const heading = this.prevHeading + wrapAngle(s.heading - this.prevHeading) * alpha;

    const travel = s.speed > 3 ? Math.atan2(s.vel.x, s.vel.z) : heading;
    const rootYaw = s.crashed ? travel : s.speed > 3 && s.grounded ? travel : heading;
    // orientation: yaw + align to the (smoothed) terrain normal; level out in the air
    const targetN = s.grounded ? s.normal : UP;
    this.normalSmoothed.lerp(targetN, 1 - Math.exp(-(s.grounded ? 14 : 3) * dt)).normalize();
    const n = this.normalSmoothed;
    const f = this.vF.set(Math.sin(rootYaw), 0, Math.cos(rootYaw));
    f.addScaledVector(n, -f.dot(n)).normalize();
    const x = this.vX.crossVectors(n, f).normalize();
    const m = this.m4.makeBasis(x, n, f);
    if (!this.defeat?.held) {
      this.skier.root.position.copy(this.renderPos);
      this.skier.root.quaternion.setFromRotationMatrix(m);
    }

    const driftAngle = s.grounded && s.speed > 3 ? wrapAngle(heading - travel) : 0;
    const p: SkierPose = {
      steer: s.steerSmoothed,
      lean: s.lean,
      tuck: s.tuck,
      pizza: s.brake,
      drift: Math.max(s.driftAmount, clamp(Math.abs(driftAngle) * 1.5 - 0.15, 0, 1)),
      driftAngle,
      crouch: s.popCharge,
      airborne: !s.grounded,
      airTime: s.airTime,
      landImpact: s.landImpact,
      crashed: s.crashed,
      crashTime: s.crashTime,
      recover: s.recoverTime > 0 ? 1 - s.recoverTime / 0.7 : 0,
      speed: s.speed,
      lookBack: this.run.phase === 'chase' && this.yetiAI.distance < 45 ? 0.35 * Math.max(0, Math.sin(this.time * 0.8)) : 0,
      celebrate: 0,
      wobble: s.wobble,
      time: this.time,
      ...this.poseOverride,
    };
    this.skier.update(dt, p);

    // yeti transform
    if (!this.yetiManual && this.run.yetiReleased) {
      this.yeti.root.position.copy(this.yetiAI.pos);
      this.yeti.root.rotation.set(0, this.yetiAI.heading, 0);
      this.yetiAnim.speed = this.yetiAI.speed;
      this.yetiAnim.turn = this.yetiAI.turn;
      if (this.run.phase === 'chase') this.setYetiMode(this.yetiAI.mode);
    }
    this.yetiAnim.modeTime += dt;
    if (this.yeti.root.visible) {
      // fur shells are the costliest pixels in the game: only render them when the yeti is close enough to read
      this.yeti.setFurVisible(this.camera.position.distanceTo(this.yeti.root.position) < 140);
      this.yeti.update(dt, this.yetiAnim);
    }

    // ski tracks & snow spray
    if (!s.crashed && this.skier.root.visible && !this.defeat) {
      const l = this.skier.getSkiTailWorld('left', this.vL);
      const r = this.skier.getSkiTailWorld('right', this.vR);
      const right = this.vRight.set(Math.cos(rootYaw), 0, -Math.sin(rootYaw));
      const depth = s.surface === 'powder' ? 1 : s.surface === 'ice' ? 0.1 : 0.45;
      this.world.tracks.add(l, r, right, s.grounded, depth);
      this.lastLeft.copy(l);
      this.lastRight.copy(r);
      if (s.grounded && s.speed > 2) {
        const intensity = clamp(s.edgeLoad * 0.8 + s.brake * 0.8 + s.driftAmount + (s.surface === 'powder' ? 0.5 : 0), 0, 2) * clamp(s.speed / 20, 0.2, 1.4);
        this.sprayAcc += dt * (8 + intensity * 70);
        while (this.sprayAcc > 1) {
          this.sprayAcc -= 1;
          const src = Math.random() < 0.5 ? l : r;
          // spray goes outward from the turn and up
          const side = Math.sign(-s.steerSmoothed || (Math.random() - 0.5));
          this.world.particles.emit({
            x: src.x,
            y: src.y + 0.05,
            z: src.z,
            vx: s.vel.x * 0.35 + right.x * side * (1 + intensity * 2.5),
            vy: 0.6 + intensity * 1.6,
            vz: s.vel.z * 0.35 + right.z * side * (1 + intensity * 2.5),
            spread: 0.5 + intensity * 0.6,
            size: 0.16 + intensity * 0.22 + (s.surface === 'powder' ? 0.25 : 0),
            life: 0.6 + intensity * 0.5,
            count: 1,
            gravity: 0.65,
            drag: 2.2,
            grow: 1.6,
            alpha: 0.55 + 0.3 * Math.min(1, intensity),
          });
        }
      }
    }
    // breath vapour (cold air)
    this.breathAcc += dt;
    if (this.breathAcc > 2.6 && this.skier.root.visible) {
      this.breathAcc = 0;
      const h = this.skier.root.position.clone().add(new THREE.Vector3(0, 1.62 - s.tuck * 0.5, 0)).addScaledVector(f, 0.3);
      this.world.particles.emit({ x: h.x, y: h.y, z: h.z, vx: s.vel.x * 0.9 + f.x * 0.6, vy: 0.15, vz: s.vel.z * 0.9 + f.z * 0.6, spread: 0.1, size: 0.12, life: 1.0, count: 4, gravity: -0.02, drag: 2.5, grow: 2, alpha: 0.25, color: 0.9 });
    }
    if (this.run.yetiReleased && this.yeti.root.visible && Math.random() < dt * 2.5) {
      const mpos = this.yeti.getMouthWorldPosition(this.vM);
      this.world.particles.emit({ x: mpos.x, y: mpos.y, z: mpos.z, vx: this.yetiAI.vel.x * 0.8, vy: 0.2, vz: this.yetiAI.vel.z * 0.8, spread: 0.25, size: 0.3, life: 1.2, count: 5, gravity: -0.03, drag: 2, grow: 1.5, alpha: 0.3, color: 0.88 });
    }

    const focus = this.run.phase === 'caveCinematic' ? this.world.cave.mouth : this.renderPos;
    this.world.updateOrigin(focus);
    this.world.update(dt, this.time, focus, this.camera.position, 3.5);
  }

  private updateTutorial(dt: number) {
    const s = this.phys.s;
    if (s.crashed && this.run.controllable) {
      const can = s.crashTime > 1.0;
      this.hud.setPrompt(can ? `recover:${this.hud.device}` : 'crashed', can ? `Press ${this.hud.g('recover')} to get up` : 'WIPEOUT!');
      return;
    }
    if (this.hud.currentPrompt.startsWith('recover') || this.hud.currentPrompt === 'crashed') this.hud.setPrompt(null);
    if (!this.settings.showTutorial || this.run.phase !== 'learn' || this.autopilot) {
      if (this.hud.currentPrompt && this.tutIndex < TUTORIAL.length && this.run.phase !== 'learn') this.hud.setPrompt(null);
      return;
    }
    const step = TUTORIAL[this.tutIndex];
    if (!step) return;
    // the pop lesson is shown on approach to the tutorial kicker
    if (step.key === 'pop' && s.pos.z < this.world.mountain.profile.tutorialEndZ - 90) return;
    // drift needs speed: wait until fast enough
    if (step.key === 'drift' && s.speed < DRIFT_MIN_SPEED) {
      this.hud.setPrompt(`drift-wait:${this.hud.device}`, `Tuck to build speed — then hold ${this.hud.g('drift')} + steer to <b>DRIFT</b>`);
    } else {
      const key = `${step.key}:${this.hud.device}`;
      this.hud.setPrompt(key, step.html(this.hud));
    }
    this.tutHold += dt;
    if (this.tutHold > 1.5 && step.done(this)) {
      this.tutIndex++;
      this.tutHold = 0;
      this.hud.setPrompt(null);
      this.audio.playUiMove();
    }
  }

  private updateHud(dt: number) {
    const s = this.phys.s;
    const m = this.world.mountain;
    const L = m.finishZ;
    const enc = this.run.encounter;
    const nextRefuge = this.endless ? (enc?.checkpointZ ?? null) : null;
    this.hud.update(dt, {
      speedKmh: s.speed * 3.6,
      distanceToFinish: L - s.pos.z,
      endless: this.endless,
      distance: Math.max(0, s.pos.z),
      nextRefuge: nextRefuge !== null ? nextRefuge - s.pos.z : null,
      score: this.liveScore(),
      multiplier: this.multiplier,
      yetiDistance: this.run.phase === 'chase' ? this.yetiAI.distance : null,
      chase: this.run.phase === 'chase',
      crashed: s.crashed,
      canRecover: s.crashTime > 1,
      airTime: s.grounded ? 0 : s.airTime,
      progress: this.endless ? 0 : clamp(s.pos.z / L, 0, 1),
      caveProgress: this.endless || !enc ? null : enc.caveZ / L,
    });
  }

  private updateAudio(dt: number) {
    const s = this.phys.s;
    const fwd = this.camera.getWorldDirection(this.vFwd);
    const chase = this.run.phase === 'chase';
    const st: AudioFrameState = {
      listenerPos: this.camera.position,
      listenerForward: fwd,
      speed: this.run.simulating || this.victory ? s.speed : 0,
      grounded: s.grounded,
      edgeLoad: s.edgeLoad,
      brake: s.brake,
      drifting: s.drifting,
      surface: s.surface,
      crashed: s.crashed,
      yetiPos: this.run.yetiReleased || this.run.phase === 'caveCinematic' ? this.yeti.root.position : null,
      yetiDistance: this.run.yetiReleased ? this.yetiAI.distance : null,
      yetiRunning: chase,
      chaseIntensity: chase ? clamp(1 - (this.yetiAI.distance - 5) / 110, 0, 1) : 0,
      crowdLevel: this.world.resort ? smoothstep(this.world.mountain.finishZ - 400, this.world.mountain.finishZ, s.pos.z) : 0,
      eerie: this.run.phase === 'caveCinematic' ? 1 : this.eerie,
    };
    this.audio.update(dt, st);
  }

  /** victory cheer level for the resort */
  get resortState() {
    const fz = this.world.mountain.finishZ;
    return { cheer: this.victory ? this.victory.cheer : smoothstep(fz - 150, fz, this.phys.s.pos.z) * 0.4, lookAt: this.skier.root.position, welcome: this.victory?.welcome ?? 0 };
  }

  // --- debug / test harness (not exposed in UI) -----------------------------------
  debugTeleport(z: number, speed = 18) {
    const m = this.world.mountain;
    this.world.stream(z, true);
    this.world.vegetation.flush();
    this.world.terrain.flushAround(m.routeX(z), z);
    const x = m.routeX(z);
    this.phys.teleport(x, z, Math.atan2(m.routeX(z + 10) - x, 10), speed);
    this.prevPos.copy(this.phys.s.pos);
    this.follow.snap(this.followTarget());
    if (this.intro) this.endIntro();
    // keep phase consistent with progress (never skip the next cave)
    // landing past a cave trigger plays that encounter's cinematic now (never skipped)
    if (this.run.phase !== 'chase' && this.run.progress(z, 0)) this.beginCave();
  }

  /** Debug: skip a cave cinematic that is playing. */
  debugSkipCave() {
    if (this.cave) {
      this.cave.tl.skip();
      this.finishCave();
    }
  }

  /** Debug: run the next encounter's chase immediately (skips the cinematic). */
  debugToChase() {
    if (this.run.phase === 'chase') return;
    const e = this.run.encounter;
    if (!e) return;
    this.debugTeleport(e.triggerZ + 1, 16);
    if (this.cave) {
      this.cave.tl.skip();
      this.finishCave();
    }
  }

  debugPlaceYeti(gap: number) {
    if (this.run.phase !== 'chase') return;
    const s = this.phys.s;
    const z = s.pos.z - gap;
    this.yetiAI.place(this.world.mountain.routeX(z), z, 0);
    this.yetiAI.airborne = false;
  }

  /** Fast-forward the simulation without rendering (deterministic). */
  debugAdvance(seconds: number) {
    const n = Math.round(seconds / PHYS_DT);
    for (let i = 0; i < n; i++) {
      if (!this.run.simulating) break;
      if (i % 60 === 0) this.world.stream(this.phys.s.pos.z);
      if (this.autopilot) this.input = autopilotInput(this.world.mountain, this.phys.s, this.autopilot, this.time);
      this.time += PHYS_DT;
      this.fixedStep();
      if (this.cave) break; // a cave cinematic began: frames must drive it
    }
  }

  /** Run the per-frame logic N times at a fixed dt (cinematics included). */
  debugFrames(n: number, dt = 1 / 30) {
    const neutral = { steer: 0, tuck: 0, brake: 0, drift: false, pop: false, recoverPressed: false, lookBack: false, pausePressed: false, skipPressed: false, camX: 0, camY: 0 };
    for (let i = 0; i < n; i++) this.frame(dt, neutral, 'keyboard');
  }

  debugState() {
    const s = this.phys.s;
    return {
      phase: this.run.phase,
      outcome: this.run.outcome,
      z: s.pos.z,
      x: s.pos.x,
      speed: s.speed,
      grounded: s.grounded,
      crashed: s.crashed,
      heading: s.heading,
      yetiDistance: this.yetiAI.distance,
      yetiPhase: this.yetiAI.phase,
      yetiMode: this.yetiAnim.mode,
      chaseTime: this.run.chaseTime,
      cinematicTime: this.cave?.tl.time ?? this.victory?.tl.time ?? this.defeat?.tl.time ?? -1,
      crashes: s.crashes,
      intro: !!this.intro,
      encounter: this.run.encounter?.index ?? null,
      caveZ: this.run.encounter?.caveZ ?? null,
      checkpoints: this.run.checkpointsReached,
      finishZ: this.world.mountain.finishZ,
      courseId: this.world.id,
      origin: this.world.origin.toArray(),
      bands: this.world.obstacles.bandCount,
      vegBands: this.world.vegetation.bandCount,
      chunks: this.world.terrain.chunkCount,
      caves: this.world.caveCount,
    };
  }

  dispose() {
    for (const t of this.timers) clearTimeout(t);
    this.world.env.setAmbientScale(1);
    this.timers = [];
    this.yeti.onFootstep = null;
    // return the trophy to the podium for the next run
    this.world.resetTrophy();
    this.skier.setVisible(true);
    this.yeti.setVisible(false);
  }
}
