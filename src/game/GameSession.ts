/**
 * One run of the game: fixed-timestep simulation, phase progression, events → FX/audio/camera,
 * cinematics, scoring and results. Created fresh for every run; the World is reused.
 */
import * as THREE from 'three';
import type { Encounter, Sighting } from '../world/course';
import { DIFFICULTY } from './CourseConfig';
import { capabilitiesOf } from '../world/capabilities';

/** style points for discovering a scenic viewpoint (they sit outside the chases: exploring is free) */
export const VIEWPOINT_POINTS = 500;
/** soft (location) caption priorities: a higher one replaces a lower one still on screen */
export const CAPTION_PRIORITY = { ambient: 0, report: 1, warning: 2 } as const;
/** style points for clearing a Fjord gap jump (× the multiplier) */
export const GAP_POINTS = { cleared: 150, clean: 300 } as const;
import { PHYS_DT, SkierPhysics, type SkierEvent, type SkierInput, DRIFT_MIN_SPEED, poleEffect } from '../physics/SkierPhysics';
import { YetiAI } from '../yeti/YetiAI';
import { RunState } from './RunState';
import { FollowCamera } from '../camera/FollowCamera';
import { CaveCinematic } from '../cinematic/CaveCinematic';
import { DefeatCinematic, VictoryCinematic } from '../cinematic/EndCinematics';
import { Timeline, ease, pose } from '../cinematic/Timeline';
import { autopilotInput, type AutopilotStyle } from '../debug/autopilot';
import { clamp, damp, smoothstep, wrapAngle } from '../core/rng';
import { victorySteer } from './victorySteer';
import type { SkierPose, YetiAnimState, YetiMode, AudioFrameState } from '../core/types';
import type { World } from './World';
import type { SkierModel } from '../player/SkierModel';
import type { YetiModel } from '../yeti/YetiModel';
import type { AudioEngine } from '../audio/AudioEngine';
import type { Hud } from '../ui/Hud';
import type { Settings, RunStats } from '../core/settings';
import type { Action, Device, GameplayInput } from '../input/Input';
import type { Stage } from './Stage';
import { SnowballBarrage, SNOWBALL, clampToPiste, type SnowballEvent } from '../yeti/Snowballs';
import { SnowballView } from '../yeti/SnowballView';
import { THROW } from '../yeti/model/animation';
import { EventBus, type GameEvent, type RunContext, type RunOutcome } from './events';
import { RunTelemetry } from './telemetry';

const UP = new THREE.Vector3(0, 1, 0);

/** pole push prompt thresholds (m/s): shown below `show` (20 km/h), hidden above `hide` */
export const POLE_PROMPT = { show: 20 / 3.6, hide: 26 / 3.6 } as const;

/** a binding's glyph as plain text (captions are text, not HTML) */
function glyphText(h: Hud, a: Action): string {
  return h.g(a).replace(/<[^>]+>/g, '');
}

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
  private input: SkierInput = { steer: 0, tuck: 0, brake: 0, drift: false, pop: false, recover: false, pole: false };
  private recoverLatch = false;
  private cave: CaveCinematic | null = null;
  private defeat: DefeatCinematic | null = null;
  private victory: VictoryCinematic | null = null;
  private intro: Timeline | null = null;
  private autopilotStyle: AutopilotStyle | null = null;
  /** debug autopilot (taints the run: its progress never persists) */
  get autopilot(): AutopilotStyle | null {
    return this.autopilotStyle;
  }
  set autopilot(v: AutopilotStyle | null) {
    if (v) this.debugUsed = true;
    this.autopilotStyle = v;
  }
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

  // --- gameplay events (achievements / statistics; see events.ts) ---------------------------
  /** Gameplay event bus of this run. Subscribe before the first frame (RunStarted is emitted on the first simulated step). */
  readonly events: EventBus;
  private telemetry: RunTelemetry;
  private runStartedSent = false;
  private runFinishedSent = false;
  private chaseMinGap = Infinity;
  /** a debug control (teleport, fast-forward, autopilot, forced chase …) was used: progress from this run must not persist */
  debugUsed = false;

  constructor(
    readonly world: World,
    readonly skier: SkierModel,
    readonly yeti: YetiModel,
    readonly audio: AudioEngine,
    readonly hud: Hud,
    readonly settings: Settings,
    readonly camera: THREE.PerspectiveCamera,
    private hooks: SessionHooks,
    opts: { skipIntro?: boolean; events?: EventBus } = {},
  ) {
    const m = world.mountain;
    this.events = opts.events ?? new EventBus();
    this.telemetry = new RunTelemetry(this.events);
    this.run = new RunState({ tutorialEndZ: m.profile.tutorialEndZ, finishZ: m.finishZ, encounters: (a, b) => m.profile.encounters(a, b) });
    world.focusEncounter = null;
    world.stream(2, true);
    this.phys = new SkierPhysics(world.mountain, world.obstacles, world.extraColliders, world.environment);
    this.phys.reset(m.routeX(2), 2, 0, 0);
    this.yetiAI = new YetiAI(world.mountain, world.obstacles);
    this.snowballs = world.course.difficulty === 'hard' ? new SnowballBarrage(world.seed, (x, z) => m.heightAt(x, z), (x, z) => clampToPiste(m, x, z)) : null;
    if (this.snowballs) {
      this.snowView = new SnowballView((x, z, out) => m.normalAt(x, z, out));
      world.scene.add(this.snowView.group);
      // round 2, D8: the view creates its ball and its glint sprite (the only SpriteMaterial in the
      // game) lazily at the first wind-up, which compiled the sprite program mid-chase. Create
      // them now, far below the course (hidden again on the next update), so App can compile them
      // at the start of the run (warmupObjects).
      this.snowView.update(null, 0, new THREE.Vector3(), new THREE.Vector3(0, -5000, 0));
    }
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
    this.listenEnvironment();
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

  private keepAboveGround(p: THREE.Vector3, clearance: number) {
    const m = this.world.mountain;
    // sample a little around the eye too: the near plane must clear a steep side slope as well
    let g = m.heightAt(p.x, p.z);
    for (const [dx, dz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]] as const) g = Math.max(g, m.heightAt(p.x + dx, p.z + dz) - 0.4);
    if (p.y < g + clearance) p.y = g + clearance;
  }

  // --- intro ------------------------------------------------------------------------
  private buildIntro() {
    const s = this.phys.s;
    const P = s.pos.clone();
    const tl = new Timeline();
    const fp = new THREE.Vector3();
    const fl = new THREE.Vector3();
    this.follow.idealPose(this.followTarget(), fp, fl);
    tl.shot({ start: 0, end: 4.2, from: () => pose(P.clone().add(new THREE.Vector3(18, 9, 22)), P.clone().add(new THREE.Vector3(0, 1.2, 0)), 46), via: () => pose(P.clone().add(new THREE.Vector3(10, 4, -8)), P.clone().add(new THREE.Vector3(0, 1.4, 4)), 52), to: () => pose(fp, fl, 64), easing: ease.inOutCubic });
    const goal = this.endless ? 'Survive as far as you can. Bank your run at the refuges.' : `Reach the ${this.world.finishDef.goal ?? 'resort'}, ${(this.world.mountain.finishZ / 1000).toFixed(0)} km down the mountain.`;
    tl.at(0.2, () => this.hud.title('THE LAST DESCENT', goal, 'intro notice', 3.4));
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
      // the opening shot is authored relative to the skier; on some mountains its path would
      // pass through the terrain (and the ground would vanish): keep it above the snow
      this.keepAboveGround(this.camera.position, 1.6);
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
    // the same button: Recover when down, a pole push when upright (SkierPhysics.poleCycle decides)
    this.input.pole = ctl && gi.recoverHeld;
    if (gi.recoverPressed) this.recoverLatch = true;
  }

  private fixedStep() {
    const s = this.phys.s;
    this.prevPos.copy(s.pos);
    this.prevHeading = s.heading;
    if (!this.autopilot) {
      this.input.recover = this.recoverLatch;
      this.input.polePressed = this.recoverLatch && this.input.pole === true;
    }
    if (!this.runStartedSent) this.emitRunStarted();
    this.phys.step(this.input, PHYS_DT);
    this.recoverLatch = false;
    for (const e of this.phys.drainEvents()) {
      this.onEvent(e);
      this.telemetry.onSkierEvent(e, s);
    }
    this.telemetry.step(s, PHYS_DT);
    this.checkLookouts();
    if (this.pendingSurfCaption && s.time > 4 && this.run.controllable) {
      this.pendingSurfCaption = false;
      this.envCaption('[surf booms against the cliffs far below]', 3, 'surf', CAPTION_PRIORITY.ambient);
    }

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
      const target = { pos: s.pos, vel: s.vel, airborne: !s.grounded, down: s.crashed || s.recoverTime > 0 };
      this.yetiAI.update(PHYS_DT, target);
      this.stepSnowballs();
      if (this.yetiAI.phase === 'chase' && !this.yetiAI.airborne) this.chaseMinGap = Math.min(this.chaseMinGap, this.yetiAI.distance);
      if (this.yetiAI.canCatch(target) && this.run.catchPlayer()) this.beginDefeat();
      else if (s.pos.z >= this.world.mountain.finishZ && this.run.reachFinish()) this.beginVictory();
      else {
        const encIdx = this.run.encounter?.index ?? -1;
        if (this.run.reachCheckpoint(s.pos.z)) this.onCheckpoint(encIdx);
      }
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
    // on a coast the other side is the sea: the Yeti howls from the land side (+X)
    const side = m.coast ? 1 : sg.side;
    const x = m.centerX(z) + side * (m.halfWidth(z) + 140);
    const p = new THREE.Vector3(x, m.heightAt(x, z) + 4, z);
    this.audio.playYetiGrowl(p, true);
    // facing downhill (+Z), +X is on the skier's LEFT
    this.hud.caption(side > 0 ? '[a howl from the ridge to your left]' : '[a howl from the ridge to your right]', 3);
  }

  private mouthOf(e: Encounter): THREE.Vector3 {
    return this.world.caveFor(e).cave.mouth;
  }

  /** A refuge at the end of a chase was reached (Endless: bank the run). The Yeti gives up for now. */
  private onCheckpoint(encounter: number) {
    this.events.emit({ type: 'YetiEscaped', encounter, via: 'refuge', chaseTime: this.run.chaseTime, closestGap: this.chaseMinGap });
    this.events.emit({ type: 'RefugeReached', index: this.run.checkpointsReached });
    if (this.endless) this.banked = this.liveScore();
    this.yetiAI.standDown();
    this.snowballs?.reset();
    this.yeti.setVisible(false);
    this.yetiAnim.mode = 'hidden';
    this.world.focusEncounter = null;
    this.audio.setMusicMode('explore');
    if (this.endless) this.hud.title(`REFUGE ${this.run.checkpointsReached}`, `Run banked: ${this.banked.toLocaleString('en-US')} pts. Retire from the pause menu, or push on.`, 'intro notice', 4);
    else this.hud.title(`REFUGE ${this.run.checkpointsReached}`, `${this.refugeName} reached. The Yeti lost your trail… for now. The ${this.world.finishDef.goal ?? 'resort'} is still a long way down.`, 'intro notice', 4);
    this.hud.caption('[a furious howl fades behind you]', 3);
    this.audio.playUiMove();
  }

  /** what refuges are called here ("Coastal shelter", "Ski patrol cabin") */
  private get refugeName(): string {
    return capabilitiesOf(this.world.biome).refuge.name;
  }

  /** Endless: score safely banked at the last refuge */
  banked = 0;

  get endless(): boolean {
    return !Number.isFinite(this.world.mountain.finishZ);
  }

  /** Endless: end the run now, keeping the banked score. */
  retire(): boolean {
    if (!this.endless || !this.run.retire()) return false;
    this.emitRunFinished('retired');
    this.sendResults(false);
    return true;
  }

  private fixedStepVictory() {
    const s = this.phys.s;
    this.prevPos.copy(s.pos);
    this.prevHeading = s.heading;
    const v = this.victory;
    if (!v) return;
    // auto-steer to the stop point; drift-brake into a hockey stop near it (victorySteer.ts)
    const st = { hockey: this.hockey };
    const { input: inp, hockeyStarted } = victorySteer(s, v.stopPoint, st, { onMark: v.stopOnMark, driftMin: DRIFT_MIN_SPEED });
    this.hockey = st.hockey;
    if (hockeyStarted) {
      this.world.particles.emit({ x: s.pos.x, y: s.pos.y + 0.1, z: s.pos.z, vx: s.vel.x * 0.4, vy: 1.6, vz: s.vel.z * 0.4, spread: 2.2, size: 0.45, life: 1.3, count: 70, gravity: 0.5, drag: 1.8, grow: 1.4, alpha: 0.85 });
    }
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
        this.takeoff = { x: s.pos.x, z: s.pos.z };
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
        this.judgeGap(e.clean);
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
      case 'pole-plant': {
        // both tips bite: a crunch, a puff of snow at each basket, a light tick on the controller
        this.audio.playPolePlant(e.surface, 0.45 + 0.55 * e.effect);
        const f = { x: Math.sin(s.heading), z: Math.cos(s.heading) };
        if (e.surface !== 'ice') {
          for (const sg of [-1, 1]) {
            // at the tips (beside the bindings, ~0.42 m out), left behind on the snow (animation review r1)
            const x = s.pos.x + f.z * 0.42 * sg + f.x * 0.04;
            const z = s.pos.z - f.x * 0.42 * sg + f.z * 0.04;
            this.world.particles.emit({ x, y: this.world.mountain.heightAt(x, z) + 0.05, z, vx: 0, vy: 0.7, vz: 0, spread: 0.25, size: 0.22, life: 0.55, count: e.surface === 'powder' ? 9 : 5, gravity: 0.6, drag: 3, grow: 0.8, alpha: 0.7 });
          }
        }
        this.rumble?.(0, 0.25 * e.effect, 45);
        break;
      }
      case 'pole-stroke':
        break;
      case 'relocate':
        // out of bounds (over a sea cliff's crest): back on the piste, with a clear cue
        this.prevPos.copy(s.pos);
        this.follow.snap(this.followTarget());
        if (e.reason === 'pinned against the rock') {
          this.hud.title('BACK ON THE PISTE', 'You were boxed in against the rock. Back to the run.', 'intro notice', 3);
          this.hud.caption('[you scramble out from under the rock — back on the piste]', 3);
        } else if (e.reason === 'stuck in the cornice') {
          this.hud.title('BACK ON THE PISTE', 'You bogged down in the deep cornice snow. Keep inside the cairns along the cliff.', 'intro notice', 4);
          this.hud.caption('[you flounder out of the cornice — back on the piste]', 3);
        } else {
          this.hud.title('BACK ON THE PISTE', 'You went over the cornice. Keep inside the cairns along the cliff.', 'intro notice', 4);
          this.hud.caption('[you tumble over the cornice — back on the piste]', 3);
        }
        break;
      case 'trick':
        this.style += Math.round(e.points * this.multiplier);
        this.hud.popTrick(e.name, Math.round(e.points * this.multiplier));
        if (e.name.startsWith('CLEAN')) this.multiplier = Math.min(4, +(this.multiplier + 0.2).toFixed(1));
        break;
    }
  }

  private takeoff: { x: number; z: number } | null = null;
  /**
   * A Fjord gap jump (a gully across a ridgeline spine, taken off its kicker): clearing it scores
   * (more for a clean landing); coming up short lands you in the gully (it costs speed, no points).
   */
  private judgeGap(clean: boolean) {
    const t = this.takeoff;
    this.takeoff = null;
    const P = this.world.mountain.profile;
    if (!t || !P.gapsNear) return;
    const s = this.phys.s;
    for (const g of P.gapsNear(t.z - 6, t.z + 6, [])) {
      if (Math.abs(t.z - g.lipZ) > 4 || Math.abs(t.x - g.x) > g.hw) continue;
      if (s.pos.z > g.z + g.len) {
        const pts = clean ? GAP_POINTS.clean : GAP_POINTS.cleared;
        this.style += Math.round(pts * this.multiplier);
        this.hud.popTrick(clean ? 'GAP CLEARED · CLEAN' : 'GAP CLEARED', Math.round(pts * this.multiplier));
      } else this.envCaption('[short — you drop into the gully]', 1.8, 'gap', CAPTION_PRIORITY.report);
      return;
    }
  }

  /** Hard: snowballs from the Yeti — wind-up, throws, landing zones, hits (fixed step). */
  private stepSnowballs() {
    const b = this.snowballs;
    if (!b) return;
    const s = this.phys.s;
    const ai = this.yetiAI;
    this.snowEv.length = 0;
    // the ball leaves from the (rendered) Yeti's right hand
    const hand = this.yeti.getHandWorldPosition('right', this.tmpHand);
    b.update(PHYS_DT, ai.pos, s, ai.phase === 'chase' && !ai.airborne, this.snowEv, hand);
    const fx = this.world.particles;
    for (const e of this.snowEv) {
      if (e.type === 'windup') {
        this.yetiAnim.throwT = 0;
        continue;
      }
      if (e.type === 'throw') {
        this.events.emit({ type: 'SnowballThrown' });
        const f = e.ball.from;
        fx.emit({ x: f.x, y: f.y, z: f.z, vx: 0, vy: 0.6, vz: 3, spread: 0.6, size: 0.35, life: 0.5, count: 10, gravity: 0.4, drag: 2, grow: 1.3, alpha: 0.6 });
        this.audio.playYetiGrowl(this.yeti.root.position, false);
        if (b.throws === 1) this.hud.caption('[the Yeti hurls a snowball — watch the red marks]', 2.6);
        continue;
      }
      const p = e.ball.to;
      if (e.type === 'land') {
        // impact: a burst of snow where it lands
        fx.emit({ x: p.x, y: p.y + 0.3, z: p.z, vx: 0, vy: 3, vz: 0, spread: 2.5, size: 0.7, life: 1.3, count: 60, gravity: 0.7, drag: 1.6, grow: 1.3, alpha: 0.9 });
        this.audio.playLanding(0.7, true);
        if (Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < 9) this.shake(0.12);
        continue;
      }
      if (e.hit === 'miss') {
        this.events.emit({ type: 'SnowballDodged', distance: e.distance });
        continue;
      }
      const direct = e.hit === 'direct';
      this.events.emit({ type: 'SnowballHit', direct, distance: e.distance });
      this.phys.knock(direct ? SNOWBALL.directKeep : SNOWBALL.nearKeep, direct ? SNOWBALL.directWobble : SNOWBALL.nearWobble);
      this.shake(direct ? 0.9 : 0.35);
      if (direct) {
        this.audio.playExertion('yelp');
        this.hud.popTrick('SNOWBALLED!', 0);
        this.multiplier = 1;
        this.cleanTime = 0;
        fx.emit({ x: s.pos.x, y: s.pos.y + 1.4, z: s.pos.z, vx: s.vel.x * 0.5, vy: 1.5, vz: s.vel.z * 0.5, spread: 1.6, size: 0.5, life: 1, count: 40, gravity: 0.6, drag: 2, grow: 1.2, alpha: 0.9 });
      }
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
    this.snowballs?.reset();
    this.recordsSeenCave = true;
    this.onCaveSeen?.();
    this.chaseMinGap = Infinity;
    if (this.run.encounter) this.events.emit({ type: 'YetiEncountered', encounter: this.run.encounter.index, difficulty: this.world.course.difficulty });
    this.hud.setSkipHint(null);
    this.hud.title('RUN.', '', 'run', 1.6);
    this.audio.playRunPrompt();
    this.audio.setMusicMode('chase');
    this.follow.snap(this.followTarget());
    this.yeti.setVisible(true);
  }

  onCaveSeen: (() => void) | null = null;
  /** controller rumble (App wires it to the active gamepad; strong/weak 0..1, ms) */
  rumble: ((strong: number, weak: number, ms: number) => void) | null = null;
  /** fired once when the tutorial has been through all its lessons */
  onTutorialDone: (() => void) | null = null;
  /** the tutorial was shown in this run (first playthrough) */
  tutorialShown = false;
  /** Hard: the Yeti throws snowballs during the chase */
  readonly snowballs: SnowballBarrage | null;
  private snowView: SnowballView | null = null;

  /** objects created with the session whose materials App compiles before the first frame */
  get warmupObjects(): THREE.Object3D[] {
    return this.snowView ? [this.snowView.group] : [];
  }
  private snowEv: SnowballEvent[] = [];
  private tmpHand = new THREE.Vector3();
  private tmpHeld = new THREE.Vector3();

  private beginDefeat() {
    this.emitRunFinished('caught');
    this.hud.setPrompt(null);
    this.yetiAI.phase = 'caught';
    this.defeat = new DefeatCinematic(this);
    this.defeat.onResults = () => this.sendResults(false);
  }

  private beginVictory() {
    this.events.emit({ type: 'YetiEscaped', encounter: this.run.encounter?.index ?? -1, via: 'finish', chaseTime: this.run.chaseTime, closestGap: this.chaseMinGap });
    this.emitRunFinished('victory');
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

  // --- location events (scenic viewpoints, hazards) ----------------------------------
  // (VIEWPOINT_POINTS: see the top of the file)
  /** viewpoints discovered this run (once per run per id) */
  readonly discovered = new Set<string>();
  private envOff: (() => void) | null = null;

  /** Biome environment → gameplay events: a hazard passed safely is a HazardSurvived. */
  private listenEnvironment() {
    this.envOff = this.world.environment.listen((e) => {
      if (e.type === 'hazard-passed') {
        // a squall counts when it was gusting near you; rock when you kept off it
        if (!e.hit && (e.kind !== 'scoured-rock' || !e.entered)) this.reportHazardSurvived(e.kind);
      } else if (e.type === 'hazard-telegraph' || e.type === 'hazard-active' || e.type === 'hazard-hit') {
        if (e.cue) this.audio.playCue(e.cue, new THREE.Vector3(e.hazard.x, e.hazard.y + 2, e.hazard.z));
        if (e.type === 'hazard-telegraph' && e.kind === 'sea-gust') {
          // captioned like the Yeti's cues (the windsock alone is easy to miss at speed)
          // (throttled per squall, not per kind: one squall's warning never mutes the next one's — round 3 E1)
          const P = e.hazard.params as { slip?: number; gate?: unknown };
          const text = P.gate ? '[a squall builds off the sea — take the lee of the rocks, or the notch in the lull]' : (P.slip ?? 0) > 0 ? '[a squall builds off the sea — it will push you left]' : '[a squall gusts across the jump ahead]';
          this.envCaption(text, 2.4, `squall:${e.hazard.id}`, CAPTION_PRIORITY.warning);
        }
        // every blizzard cell gets its warning once: when it builds ahead, or — a cell already blowing
        // when it comes into range — when it is first seen (W-046: round 1 left those uncaptioned)
        if ((e.type === 'hazard-telegraph' || e.type === 'hazard-active') && e.kind === 'blizzard' && !this.blizzardWarned.has(e.hazard.id)) {
          this.blizzardWarned.add(e.hazard.id);
          if (this.blizzardWarned.size > 64) this.blizzardWarned.delete(this.blizzardWarned.values().next().value!);
          const dir = (e.hazard.params as { dir?: number }).dir ?? 1;
          const what = e.type === 'hazard-telegraph' ? 'a blizzard builds ahead' : 'a blizzard is blowing across the piste ahead';
          this.envCaption(`[${what} — stand up out of the tuck; it pushes you ${dir > 0 ? 'left' : 'right'}]`, 2.8, `blizzard:${e.hazard.id}`, CAPTION_PRIORITY.warning, 3.5);
        }
        if (e.type === 'hazard-hit' && e.kind === 'blizzard') this.envCaption('[a gust catches you in the tuck — you stagger]', 2, 'blizzard-hit', CAPTION_PRIORITY.report);
      } else if (e.type === 'hazard-enter' && e.kind === 'wind-drift') {
        this.audio.playCue('drift-plough', null);
        this.envCaption('[skis plough into a deep drift]', 1.4, 'drift', CAPTION_PRIORITY.report);
      } else if (e.type === 'hazard-enter' && e.kind === 'scoured-rock') {
        this.audio.playCue('rock-scrape', null);
        this.envCaption('[skis scrape over bare rock]', 1.6, 'rock', CAPTION_PRIORITY.report);
      }
    });
    // the sea below: the coastal ambience is captioned once per run
    if (capabilitiesOf(this.world.biome).audio.ambience.includes('surf')) this.pendingSurfCaption = true;
  }

  private pendingSurfCaption = false;
  /** blizzard cells already warned about this run (one warning per cell) */
  private blizzardWarned = new Set<number>();
  /** last time each kind of location caption was shown (separate throttles: round 2, E3) */
  private envCaptionAt = new Map<string, number>();
  /**
   * Caption a location sound (squall, rock, surf, viewpoint). Never replaces a Yeti caption; a
   * warning that asks for a decision (a squall ahead) replaces a report (rock under the skis) that is
   * still on screen; each kind at most once every 3 s, so one kind never mutes another.
   */
  private envCaption(text: string, seconds: number, kind: string, priority: number = CAPTION_PRIORITY.report, ttl = 4) {
    const t = this.phys.s.time;
    if (t - (this.envCaptionAt.get(kind) ?? -Infinity) < 3) return;
    // warnings wait for the caption line (Hud queue) for up to `ttl` s; reports are dropped if busy
    if (this.hud.caption(text, seconds, { soft: true, priority, queue: priority >= CAPTION_PRIORITY.warning, ttl })) this.envCaptionAt.set(kind, t);
  }

  /** Optional viewpoints on a coast's rim: reaching one reports ScenicLocationDiscovered once per run. */
  private checkLookouts() {
    const c = this.world.mountain.coast;
    if (!c) return;
    const s = this.phys.s;
    for (const l of c.lookouts(s.pos.z - 20, s.pos.z + 20)) {
      if (this.discovered.has(l.id) || Math.hypot(s.pos.x - l.x, s.pos.z - l.z) > l.r || s.crashed) continue;
      this.discovered.add(l.id);
      this.reportScenicDiscovered(l.id);
      const pts = VIEWPOINT_POINTS;
      this.style += pts;
      this.hud.popTrick('VIEWPOINT DISCOVERED', pts);
      this.audio.playCue('viewpoint', null);
      this.envCaptionAt.delete('viewpoint');
      this.envCaption('[gulls cry over open water — a viewpoint]', 2.4, 'viewpoint', CAPTION_PRIORITY.warning);
    }
  }

  // --- gameplay events --------------------------------------------------------------
  /** Course identity carried by run-level events. */
  get runContext(): RunContext {
    const c = this.world.course;
    return { courseId: this.world.id, mode: c.mode, length: c.length, biome: c.biome, difficulty: c.difficulty, date: c.date };
  }

  private emitRunStarted() {
    this.runStartedSent = true;
    this.events.emit({ type: 'RunStarted', ...this.runContext });
    this.events.emit({ type: 'BiomeVisited', biome: this.world.course.biome });
  }

  private emitRunFinished(outcome: RunOutcome) {
    if (this.runFinishedSent) return;
    this.runFinishedSent = true;
    this.telemetry.flush();
    const st = this.stats(outcome === 'victory');
    this.events.emit({ type: 'RunFinished', ...this.runContext, outcome, distance: st.distance, time: st.time, refuges: st.checkpoints ?? 0, crashes: st.crashes, score: st.score });
  }

  /** Emit a gameplay event from outside the session (biome hazards, scenic triggers). */
  emitEvent(e: GameEvent) {
    this.events.emit(e);
  }

  /** Biome hazards: the skier got through a hazard of this kind without crashing. */
  reportHazardSurvived(kind: string) {
    this.events.emit({ type: 'HazardSurvived', biome: this.world.course.biome, kind });
  }

  /** Biome scenery: a designated scenic location (stable id within the biome) was reached. */
  reportScenicDiscovered(id: string) {
    this.events.emit({ type: 'ScenicLocationDiscovered', biome: this.world.course.biome, id });
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
      // (no frozen mid-stroke arms when the physics stops: cinematics, capture — QA r1)
      pole: s.poleT >= 0 && !s.crashed && this.run.simulating ? 1 : 0,
      polePhase: s.poleT >= 0 ? s.poleT / s.polePeriod : 1,
      poleAmp: 0.55 + 0.45 * poleEffect(s.speed),
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
    this.updateYetiStormLook();
    this.yetiAnim.modeTime += dt;
    if (this.yetiAnim.throwT !== undefined) {
      this.yetiAnim.throwT += dt;
      if (this.yetiAnim.throwT > THROW.end || this.run.phase !== 'chase') this.yetiAnim.throwT = undefined;
    }
    const held = this.run.phase === 'chase' && this.snowballs?.windingUp ? this.yeti.getHandWorldPosition('right', this.tmpHeld) : null;
    this.snowView?.update(this.run.phase === 'chase' ? this.snowballs : null, this.time, this.camera.position, held);
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
    this.world.update(dt, this.time, focus, this.camera.position);
  }

  /** seconds the skier has been upright, grounded and slow enough for the pole prompt */
  private slowFor = 0;
  /** fired once, the first time the pole hint is shown (App persists it) */
  onPoleHint: (() => void) | null = null;

  /**
   * The pole push prompt (Pass 6): `<Recover> — POLE PUSH` while upright, on the ground and slow
   * (shown after 0.6 s below POLE_PROMPT.show, gone above POLE_PROMPT.hide — never at speed), and,
   * once ever, a caption that explains it the first time a player slows down that much.
   */
  private updatePolePrompt(dt: number) {
    const s = this.phys.s;
    const ok = this.run.controllable && !s.crashed && s.grounded && !this.autopilot && !this.intro;
    const sp = s.speed;
    if (ok && sp < POLE_PROMPT.show) this.slowFor += dt;
    else if (!ok || sp > POLE_PROMPT.hide) this.slowFor = 0;
    const show = this.slowFor > 0.6;
    if (show) {
      // (the key is part of the prompt id: a remap mid-run redraws it; QA r1) — still held since
      // getting up: the push needs a fresh press, so the prompt says so
      const k = this.hud.g('recover');
      if (s.poleArmed || !this.input.pole) this.hud.setPrompt(`pole:${this.hud.device}:${k}`, `${k} — <b>POLE PUSH</b>`);
      else this.hud.setPrompt(`pole-release:${this.hud.device}:${k}`, `Release ${k}, then press — <b>POLE PUSH</b>`);
      if (!this.settings.seenPoleHint && this.settings.controlHints && this.slowFor > 1.2) {
        // (a hint, not a sound caption: shown even with sound captions off; remembered once seen)
        const shown = this.hud.hint(`Moving slowly? Hold ${glyphText(this.hud, 'recover')} to push with your poles.`, 5);
        if (shown) {
          this.settings.seenPoleHint = true;
          this.onPoleHint?.();
        }
      }
    } else if (this.hud.currentPrompt.startsWith('pole')) this.hud.setPrompt(null);
  }

  private updateTutorial(dt: number) {
    const s = this.phys.s;
    if (s.crashed && this.run.controllable) {
      const can = s.crashTime > 1.0;
      this.hud.setPrompt(can ? `recover:${this.hud.device}:${this.hud.g('recover')}` : 'crashed', can ? `${this.hud.g('recover')} — <b>RECOVER</b>` : 'WIPEOUT!');
      this.slowFor = 0;
      return;
    }
    if (this.hud.currentPrompt.startsWith('recover') || this.hud.currentPrompt === 'crashed') this.hud.setPrompt(null);
    const tutorialOn = this.settings.showTutorial && this.run.phase === 'learn' && !this.autopilot && this.tutIndex < TUTORIAL.length;
    if (!tutorialOn) {
      if (this.hud.currentPrompt && this.tutIndex < TUTORIAL.length && this.run.phase !== 'learn' && !this.hud.currentPrompt.startsWith('pole')) this.hud.setPrompt(null);
      this.updatePolePrompt(dt);
      return;
    }
    const step = TUTORIAL[this.tutIndex];
    if (!step) return;
    this.tutorialShown = true;
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
      if (this.tutIndex >= TUTORIAL.length) this.onTutorialDone?.();
    }
  }

  private lastFront: { k: string; phase: string } = { k: '', phase: 'clear' };

  /**
   * (W-009) A white Yeti in a white storm. Not a colour that changes as he closes in (the slice's
   * distance darkening read as a fake): the storm's flat, dim light takes the pelt down with everything
   * else — the same at 10 m as at 60 m, changing only as slowly as the weather — and his eyes burn
   * through the snow as they do in the cave, the pair of points that finds him first.
   *
   * It applies while he is out in the weather on the course (the chase, and the catch). Once the run
   * moves on to anything else it is put back exactly once (Gitar, PR #9 r4581960912: it used to carry
   * into the rescue victory — the searchlight beat, the clearing — because the victory takes manual
   * control of the Yeti and nothing reset it). The cave cinematic owns the Yeti's look in its phase and
   * restores it itself.
   */
  private yetiStormLook = false;
  private updateYetiStormLook() {
    const ph = this.run.phase;
    if ((ph === 'chase' || ph === 'caught') && this.run.yetiReleased) {
      const storm = this.world.weather.storm ?? 0;
      this.yeti.setShade(1 - 0.36 * storm);
      this.yeti.setEyeGlow(0.75 * smoothstep(0.25, 0.7, storm));
      this.yetiStormLook = true;
    } else if (this.yetiStormLook && ph !== 'caveCinematic') {
      this.yeti.setShade(1);
      this.yeti.setEyeGlow(0);
      this.yetiStormLook = false;
    }
  }
  /** the storm-front forecast on the HUD and in the captions (locations whose weather has fronts) */
  private updateWeatherHud() {
    const env = this.world.environment;
    const wm = capabilitiesOf(this.world.biome).weather;
    const f = wm.front?.(env.clock, env.seed) ?? null;
    if (!f || !this.run.simulating) {
      this.hud.setWeather(null);
      return;
    }
    // +X (dir +1) is the skier's left when facing downhill: the arrow points the way the wind pushes
    const arrow = f.dir > 0 ? '←' : '→';
    const side = f.dir > 0 ? 'left' : 'right';
    if (f.phase === 'build') this.hud.setWeather(`STORM IN ${Math.max(1, Math.ceil(f.left))} s  ${arrow}`, 'warn');
    else if (f.phase === 'storm') this.hud.setWeather(`STORM  ${arrow}`, 'storm');
    else if (f.phase === 'ease') this.hud.setWeather('CLEARING', 'calm');
    else this.hud.setWeather(null);
    if (f.phase !== this.lastFront.phase) {
      if (f.phase === 'build') {
        // (W-048) heard from upwind: the front rolls in from the side it will blow from
        const sp = this.phys.s.pos;
        this.audio.playCue('blizzard-build', new THREE.Vector3(sp.x - f.dir * 60, sp.y + 8, sp.z + 20));
        // (W-047: short enough to read at 15 characters a second while the front builds.) Round 3 (R2
        // F N2, W-055): the caption no longer sends the player to the lee shoulder — measured, it is not
        // a net win (it crosses the drift rows) — but to the marked drift gaps, the move that is
        // (balance/round2: +12/−0 on held-out Normal Sprint seeds)
        this.envCaption(`[a storm front rolls in — the wind pushes you ${side}; ski the flagged gaps in the drifts]`, 3.2, 'front', CAPTION_PRIORITY.warning, 6);
      } else if (f.phase === 'ease') {
        // (round 3, R2 A N8) the front's warning is taken back as it eases
        this.hud.withdrawCaption((t) => t.startsWith('[a storm front rolls in'));
        this.envCaptionAt.delete('front');
        this.envCaption('[the storm eases — the view opens up]', 2.2, 'front', CAPTION_PRIORITY.report);
      }
      this.lastFront.phase = f.phase;
    }
  }

  private updateHud(dt: number) {
    this.updateWeatherHud();
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
      coast: this.coastLevel(),
      weather: this.weatherAudio(),
    };
    this.audio.update(dt, st);
  }

  /**
   * The storm for the wind bed (W-048): the front's strength, the shelter where the skier is, and
   * where the wind comes from relative to the camera (it blows toward +X when dir = +1).
   */
  private weatherAudio(): AudioFrameState['weather'] {
    const env = this.world.environment;
    const f = capabilitiesOf(this.world.biome).weather.front?.(env.clock, env.seed) ?? null;
    if (!f) return undefined;
    const fwd = this.camera.getWorldDirection(this.vFwd);
    // the listener's right (Web Audio pan +1) is forward × up = (−fwd.z, 0, fwd.x); the wind comes
    // from −dir·X
    const rx = -fwd.z;
    const rz = fwd.x;
    const len = Math.hypot(rx, rz) || 1;
    const pan = (-f.dir * rx) / len;
    void rz;
    // (round 3, R2 C N-6) a victory that stages its own weather (Whiteout: the storm holds, then
    // breaks) is heard as staged: the wind drops with the break, not with the live front
    const wo = this.victory ? this.world.weatherOverride : null;
    const storm = wo ? wo.storm : this.run.simulating || this.victory ? f.s : 0;
    return { storm, exposure: env.lastExposure ?? 1, pan };
  }

  /** 0..1 closeness to the sea for the surf/gull beds (coastal locations) */
  private coastLevel(): number {
    const c = this.world.mountain.coast;
    if (!c) return 0;
    const p = this.camera.position;
    return clamp(1 - (p.y - c.seaLevelAt(p.z)) / 1100, 0.18, 1);
  }

  /** victory cheer level for the resort */
  get resortState() {
    const fz = this.world.mountain.finishZ;
    return { cheer: this.victory ? this.victory.cheer : smoothstep(fz - 150, fz, this.phys.s.pos.z) * 0.4, lookAt: this.skier.root.position, welcome: this.victory?.welcome ?? 0 };
  }

  // --- debug / test harness (not exposed in UI) -----------------------------------
  /** (evidence captures) jump the run's physics clock — the weather timeline follows it (Whiteout fronts) */
  debugSetTime(t: number) {
    this.debugUsed = true;
    this.phys.s.time = t;
  }

  debugTeleport(z: number, speed = 18, atX?: number, heading?: number) {
    this.debugUsed = true;
    const m = this.world.mountain;
    this.world.stream(z, true);
    this.world.vegetation.flush();
    this.world.terrain.flushAround(m.routeX(z), z);
    const x = atX ?? m.routeX(z);
    this.phys.teleport(x, z, heading ?? Math.atan2(m.routeX(z + 10) - x, 10), speed);
    this.prevPos.copy(this.phys.s.pos);
    this.telemetry.resync(this.phys.s);
    this.follow.snap(this.followTarget());
    if (this.intro) this.endIntro();
    // keep phase consistent with progress (never skip the next cave)
    // landing past a cave trigger plays that encounter's cinematic now (never skipped)
    if (this.run.phase !== 'chase' && this.run.progress(z, 0)) this.beginCave();
  }

  /** Debug: skip a cave cinematic that is playing. */
  debugSkipCave() {
    this.debugUsed = true;
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
    this.debugUsed = true;
    if (this.run.phase !== 'chase') return;
    const s = this.phys.s;
    const z = s.pos.z - gap;
    this.yetiAI.place(this.world.mountain.routeX(z), z, 0);
    this.yetiAI.airborne = false;
  }

  /** Fast-forward the simulation without rendering (deterministic). */
  debugAdvance(seconds: number) {
    this.debugUsed = true;
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
  /** (debug/captures) buttons held during debugFrames (e.g. { recoverHeld: true } to keep poling) */
  debugHeld: Partial<GameplayInput> = {};

  debugFrames(n: number, dt = 1 / 30) {
    this.debugUsed = true;
    const neutral = { steer: 0, tuck: 0, brake: 0, drift: false, pop: false, recoverPressed: false, recoverHeld: false, lookBack: false, pausePressed: false, skipPressed: false, camX: 0, camY: 0, ...this.debugHeld };
    for (let i = 0; i < n; i++) {
      this.frame(dt, neutral, 'keyboard');
      // (round 3, R2 C N-3/N-5) the finish animates as in play (App's loop updates it there): the
      // captures stepped the session alone, so the station's door, lantern and searchlight never moved
      const r = this.world.resort;
      if (r && Math.abs(this.camera.position.z - r.finishZ) < 900) r.update(dt, this.time, this.resortState);
    }
  }

  debugState() {
    const s = this.phys.s;
    return {
      phase: this.run.phase,
      outcome: this.run.outcome,
      z: s.pos.z,
      x: s.pos.x,
      y: s.pos.y,
      time: s.time,
      speed: s.speed,
      /** (evidence) a Hard snowball in flight, i.e. its landing ring is up */
      snowballMarker: (this.snowballs?.balls.length ?? 0) > 0,
      yetiLook: this.yeti.look,
      yetiVisible: this.yeti.root.visible,
      grounded: s.grounded,
      crashed: s.crashed,
      heading: s.heading,
      yetiDistance: this.yetiAI.distance,
      yetiPhase: this.yetiAI.phase,
      yetiMode: this.yetiAnim.mode,
      yetiPos: [this.yetiAI.pos.x, this.yetiAI.pos.y, this.yetiAI.pos.z],
      yetiThrowT: this.yetiAnim.throwT ?? null,
      chaseTime: this.run.chaseTime,
      cinematicTime: this.cave?.tl.time ?? this.victory?.tl.time ?? this.defeat?.tl.time ?? -1,
      crashes: s.crashes,
      poleStrokes: s.poleStrokes,
      poleT: s.poleT,
      prompt: this.hud.currentPrompt,
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
    this.envOff?.();
    this.envOff = null;
    this.snowView?.dispose();
    this.snowView = null;
    for (const t of this.timers) clearTimeout(t);
    this.world.env.setAmbientScale(1);
    this.world.env.setSunScale(1);
    this.timers = [];
    this.yeti.onFootstep = null;
    // an abandoned run (restart / exit) still reports its last partial pizza chunk and open drift
    if (!this.runFinishedSent) this.telemetry.flush();
    this.events.clear();
    // return the trophy to the podium for the next run
    this.world.resetTrophy();
    this.skier.setVisible(true);
    this.yeti.setVisible(false);
  }
}
