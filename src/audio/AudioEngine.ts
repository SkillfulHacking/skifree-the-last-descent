/**
 * SkiFree — The Last Descent: runtime-synthesized audio engine (Web Audio API only, no samples).
 *
 * Thin realtime wrapper around AudioCore: creates/resumes the AudioContext on a user gesture, runs
 * the 25 ms lookahead music scheduler, and guards every call so nothing throws before unlock.
 */
import type * as THREE from 'three';
import type { AudioFrameState, ImpactKind, MusicMode } from '../core/types';
import { AudioCore, type AudioVolumes } from './AudioCore';

export type { AudioVolumes } from './AudioCore';

/** How far ahead (s) music notes are scheduled, and how often (ms) the scheduler wakes. */
const LOOKAHEAD_S = 0.15;
const TICK_MS = 25;

type AudioContextCtor = new (opts?: AudioContextOptions) => AudioContext;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private core: AudioCore | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private volumes: AudioVolumes = { master: 0.9, music: 0.7, sfx: 0.9 };
  private mode: MusicMode = 'none';
  private paused = false;
  private disposed = false;
  private unlocking: Promise<void> | null = null;
  private wind = { gain: 1, pitch: 1 };
  private beds: readonly string[] = ['wind'];

  constructor() {}

  get ready(): boolean {
    return !!this.core && !!this.ctx && this.ctx.state === 'running' && !this.disposed;
  }

  /** Create/resume the AudioContext. Must be called from a user gesture. Safe to call repeatedly. */
  unlock(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.unlocking) return this.unlocking;
    this.unlocking = this.doUnlock().finally(() => {
      this.unlocking = null;
    });
    return this.unlocking;
  }

  private async doUnlock(): Promise<void> {
    try {
      if (!this.ctx) {
        const w = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
        const Ctor = w.AudioContext ?? w.webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor({ latencyHint: 'interactive' });
        this.core = new AudioCore(this.ctx);
        this.core.setVolumes(this.volumes);
        if (this.paused) this.core.setPaused(true);
        if (this.mode !== 'none') this.core.setMusicMode(this.mode);
        this.core.ambience.windGain = this.wind.gain;
        this.core.ambience.windPitch = this.wind.pitch;
        if (this.beds.some((b) => b !== 'wind')) this.core.ambience.setBeds(this.beds);
        this.startScheduler();
      }
      if (this.ctx.state !== 'running') await this.ctx.resume();
    } catch {
      /* audio unavailable — engine stays silent */
    }
  }

  private startScheduler(): void {
    const tick = (): void => {
      if (this.disposed || !this.core) return;
      try {
        if (this.ctx && this.ctx.state === 'running') this.core.scheduleMusic(LOOKAHEAD_S);
      } catch {
        /* keep ticking */
      }
      this.timer = setTimeout(tick, TICK_MS);
    };
    tick();
  }

  setVolumes(v: AudioVolumes): void {
    this.volumes = { master: v.master, music: v.music, sfx: v.sfx };
    this.safe(() => this.core?.setVolumes(this.volumes));
  }

  /** Suspends continuous sounds & music gracefully (fade). UI one-shots still play while paused. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    this.safe(() => this.core?.setPaused(paused));
  }

  /** Crossfades between music states. Remembered if called before unlock. */
  setMusicMode(mode: MusicMode): void {
    this.mode = mode;
    this.safe(() => this.core?.setMusicMode(mode));
  }

  /** Location ambience (biome audio): wind gain / pitch multipliers. Remembered if called before unlock. */
  setAmbience(a: { windGain: number; windPitch: number }, beds: readonly string[] = ['wind']): void {
    this.wind = { gain: a.windGain, pitch: a.windPitch };
    const changed = beds.join() !== this.beds.join();
    this.beds = beds;
    this.safe(() => {
      if (!this.core) return;
      this.core.ambience.windGain = a.windGain;
      this.core.ambience.windPitch = a.windPitch;
      if (changed) this.core.ambience.setBeds(beds);
    });
  }

  /** A location cue by id (hazard telegraph/active/hit, viewpoints), optionally positional. */
  playCue(id: string, pos: THREE.Vector3 | null): void {
    this.safe(() => this.core?.playCue(id, pos));
  }

  /** Per-frame continuous state (wind, skis, yeti breathing, chase intensity, crowd, listener). */
  update(dt: number, s: AudioFrameState): void {
    if (!this.ready) return;
    this.safe(() => this.core!.update(dt, s));
  }

  playImpact(kind: ImpactKind, intensity: number): void {
    this.one((c) => c.playImpact(kind, intensity));
  }
  playTakeoff(intensity: number): void {
    this.one((c) => c.playTakeoff(intensity));
  }
  playLanding(intensity: number, hard: boolean): void {
    this.one((c) => c.playLanding(intensity, hard));
  }
  playPop(): void {
    this.one((c) => c.playPop());
  }
  playExertion(kind: 'grunt' | 'yelp' | 'gasp'): void {
    this.one((c) => c.playExertion(kind));
  }
  playYetiFootstep(pos: THREE.Vector3, strength: number): void {
    this.one((c) => c.playYetiFootstep(pos, strength));
  }
  playYetiRoar(pos: THREE.Vector3 | null, intensity: number): void {
    this.one((c) => c.playYetiRoar(pos, intensity));
  }
  playYetiGrowl(pos: THREE.Vector3 | null, distant: boolean): void {
    this.one((c) => c.playYetiGrowl(pos, distant));
  }
  playCaveRumble(): void {
    this.one((c) => c.playCaveRumble());
  }
  playSnowSlide(): void {
    this.one((c) => c.playSnowSlide());
  }
  playBranchSnap(pos: THREE.Vector3 | null): void {
    this.one((c) => c.playBranchSnap(pos));
  }
  playGulp(): void {
    this.one((c) => c.playGulp());
  }
  playBurp(): void {
    this.one((c) => c.playBurp());
  }
  playVictoryFanfare(): void {
    this.one((c) => c.playVictoryFanfare());
  }
  playDefeatSting(): void {
    this.one((c) => c.playDefeatSting());
  }
  playCrowdCheer(intensity: number): void {
    this.one((c) => c.playCrowdCheer(intensity));
  }
  playUiClick(): void {
    this.one((c) => c.playUiClick());
  }
  playUiMove(): void {
    this.one((c) => c.playUiMove());
  }
  /** Dramatic hit when "RUN." appears. */
  playRunPrompt(): void {
    this.one((c) => c.playRunPrompt());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.safe(() => this.core?.dispose());
    this.core = null;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) ctx.close().catch(() => undefined);
  }

  private one(fn: (c: AudioCore) => void): void {
    if (!this.ready || !this.core) return;
    const c = this.core;
    this.safe(() => fn(c));
  }

  private safe(fn: () => void): void {
    try {
      fn();
    } catch {
      /* never throw into game code */
    }
  }
}
