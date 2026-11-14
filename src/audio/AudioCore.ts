/**
 * Context-agnostic audio core: owns the mix graph, ambience layers, music engine and one-shots.
 * Works on any BaseAudioContext, so the test bench can render it with an OfflineAudioContext.
 */
import type { AudioFrameState, ImpactKind, MusicMode } from '../core/types';
import { Ambience } from './ambience';
import { type Dest, Mix, type MixOptions, type Vec3Like, setListenerPose } from './graph';
import { VoiceLimiter, clamp, musicDuck } from './logic';
import { MusicEngine, defeatSting, scheduleFanfare } from './music';
import * as sfx from './sfx';
import { coastCue } from './coastal';

export interface AudioVolumes {
  master: number;
  music: number;
  sfx: number;
}

/** Per-sound polyphony caps and retrigger intervals. */
const LIMITS: Record<string, readonly [maxVoices: number, minInterval: number]> = {
  impact: [6, 0.03],
  takeoff: [2, 0.1],
  landing: [2, 0.08],
  pop: [2, 0.06],
  exertion: [1, 0.15],
  footstep: [4, 0.05],
  roar: [2, 0.4],
  growl: [3, 0.3],
  rumble: [1, 0.5],
  snow: [3, 0.1],
  branch: [4, 0.04],
  gulp: [1, 0.2],
  burp: [1, 0.3],
  fanfare: [1, 1],
  defeat: [1, 1],
  cheer: [2, 0.4],
  ui: [4, 0.02],
  run: [1, 0.5],
};

export class AudioCore {
  readonly ctx: BaseAudioContext;
  readonly mix: Mix;
  readonly music: MusicEngine;
  readonly ambience: Ambience;
  private limiter = new VoiceLimiter(36);
  private paused = false;
  private disposed = false;

  constructor(ctx: BaseAudioContext, opts: MixOptions = {}) {
    this.ctx = ctx;
    this.mix = new Mix(ctx, opts);
    this.music = new MusicEngine(this.mix);
    this.ambience = new Ambience(this.mix);
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  setVolumes(v: AudioVolumes): void {
    this.mix.setVolumes(clamp(v.master), clamp(v.music), clamp(v.sfx), this.now);
  }

  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    this.mix.setPaused(paused, this.now);
    if (paused) this.music.pause();
    else this.music.resume(this.now);
  }

  setMusicMode(mode: MusicMode): void {
    this.music.setMode(mode, this.now);
  }

  /** Lookahead music scheduling (call every ~25 ms in realtime, or once with a long horizon offline). */
  scheduleMusic(lookahead: number): void {
    const now = this.now;
    this.music.schedule(now, now + lookahead);
  }

  update(dt: number, s: AudioFrameState): void {
    if (this.disposed) return;
    const now = this.now;
    setListenerPose(this.ctx, s.listenerPos, s.listenerForward, now);
    this.ambience.update(dt, s, now, this.paused);
    this.music.setIntensity(s.chaseIntensity, now);
    this.mix.setDuck(musicDuck(s.eerie), now);
  }

  private go(key: string, dur: number, fn: () => void): void {
    if (this.disposed) return;
    const lim = LIMITS[key] ?? [4, 0];
    if (!this.limiter.tryAcquire(key, this.now, dur, lim[0], lim[1])) return;
    try {
      fn();
    } catch {
      /* one-shots must never throw */
    }
  }
  private get dst(): Dest {
    return this.mix.sfxDest();
  }
  private get t(): number {
    return this.now + 0.005;
  }

  playImpact(kind: ImpactKind, intensity: number): void {
    this.go('impact', 0.6, () => sfx.impact(this.dst, this.t, kind, intensity));
  }
  playTakeoff(intensity: number): void {
    this.go('takeoff', 0.45, () => sfx.takeoff(this.dst, this.t, intensity));
  }
  playLanding(intensity: number, hard: boolean): void {
    this.go('landing', 0.5, () => sfx.landing(this.dst, this.t, intensity, hard));
  }
  playPop(): void {
    this.go('pop', 0.15, () => sfx.pop(this.dst, this.t));
  }
  playExertion(kind: 'grunt' | 'yelp' | 'gasp'): void {
    this.go('exertion', 0.4, () => sfx.exertion(this.dst, this.t, kind));
  }
  playYetiFootstep(pos: Vec3Like | null, strength: number): void {
    this.go('footstep', 0.6, () => sfx.yetiFootstep(this.dst, this.t, pos, strength));
  }
  playYetiRoar(pos: Vec3Like | null, intensity: number): void {
    this.go('roar', 2.7, () => sfx.yetiRoar(this.dst, this.t, intensity, pos));
  }
  playYetiGrowl(pos: Vec3Like | null, distant: boolean): void {
    this.go('growl', 1.9, () => sfx.yetiGrowl(this.dst, this.t, pos, distant));
  }
  playCaveRumble(): void {
    this.go('rumble', 4, () => sfx.caveRumble(this.dst, this.t));
  }
  playSnowSlide(): void {
    this.go('snow', 1.5, () => sfx.snowSlide(this.dst, this.t));
  }
  /** location cue by id (hazard telegraph/active/hit cues, viewpoints; see coastal.ts) */
  playCue(id: string, pos: Vec3Like | null): void {
    this.go(`cue:${id}`, 1.2, () => coastCue(this.dst, this.t, id, pos));
  }
  playBranchSnap(pos: Vec3Like | null): void {
    this.go('branch', 0.65, () => sfx.branchSnap(this.dst, this.t, pos));
  }
  playGulp(): void {
    this.go('gulp', 0.6, () => sfx.gulp(this.dst, this.t));
  }
  playBurp(): void {
    this.go('burp', 0.9, () => sfx.burp(this.dst, this.t));
  }
  playVictoryFanfare(): void {
    this.go('fanfare', 10, () => {
      this.music.noteOneShot('victory', this.now);
      scheduleFanfare(this.dst, this.t + 0.02);
    });
  }
  playDefeatSting(): void {
    this.go('defeat', 5, () => {
      this.music.noteOneShot('defeat', this.now);
      defeatSting(this.dst, this.t);
    });
  }
  playCrowdCheer(intensity: number): void {
    this.go('cheer', 2.8, () => sfx.crowdCheer(this.dst, this.t, intensity));
  }
  playUiClick(): void {
    this.go('ui', 0.1, () => sfx.uiClick(this.dst, this.t));
  }
  playUiMove(): void {
    this.go('ui', 0.06, () => sfx.uiMove(this.dst, this.t));
  }
  playRunPrompt(): void {
    this.go('run', 3, () => sfx.runPrompt(this.dst, this.t));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.music.dispose();
    this.ambience.dispose();
    this.mix.dispose();
    this.limiter.reset();
  }
}
