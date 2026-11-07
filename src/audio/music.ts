/**
 * Original synthesized adaptive score. Each music mode is an "instance" with its own step clock and
 * fade gains; switching modes crossfades instances. Notes are scheduled ahead on the AudioContext
 * timeline (lookahead scheduler), never per rendered frame.
 */
import type { MusicMode } from '../core/types';
import { MODE_BPM, MODE_FADE_OUT, StepClock, chaseMix, clamp, introRecentlyPlayed, modeFadeIn, mulberry32 } from './logic';
import { type Dest, type Mix, rampParam, target } from './graph';
import {
  bass,
  bell,
  brass,
  clap,
  cymbal,
  drone,
  gong,
  hat,
  heartbeat,
  pad,
  pluck,
  riser,
  shime,
  softKick,
  stacStrings,
  subBass,
  swellStrings,
  taiko,
  timpani,
} from './instruments';

type Rng = () => number;

// ---------------------------------------------------------------------------------------------
// Menu — calm, wintry: D minor-ish pad + celesta arpeggio (66 bpm)
// ---------------------------------------------------------------------------------------------
const MENU_CHORDS = [
  [50, 53, 57, 64], // Dm9
  [46, 50, 53, 57], // Bbmaj7
  [43, 46, 50, 57], // Gm(add9)
  [45, 50, 52, 57], // Asus4
] as const;
const MENU_ROOTS = [38, 34, 31, 33] as const;
const ARP = [0, 2, 1, 3, 2, 4, 3, 1] as const;

function menuStep(d: Dest, step: number, t: number, sd: number, rng: Rng): void {
  const bar = step >> 4;
  const s = step & 15;
  const ci = (bar >> 1) % 4;
  const chord = MENU_CHORDS[ci]!;
  if (s === 0 && bar % 2 === 0) {
    pad(d, t, [...chord], 32 * sd, { gain: 0.085, attack: 2.2, release: 3.5, cutoff: 950, send: 0.7 });
    subBass(d, t, MENU_ROOTS[ci]!, 32 * sd * 0.95, 0.07);
  }
  if (s % 2 === 0) {
    const tones = [...chord.map((x) => x + 12), chord[1] + 24];
    const note = tones[ARP[(s >> 1) % 8]! % tones.length]!;
    if (s === 0 || rng() < 0.8) bell(d, t, note, 0.045, 2.8, 0.85);
  }
  if (s === 9 && bar % 4 === 3 && rng() < 0.6) bell(d, t, chord[3] + 24, 0.02, 3.5, 1);
}

// ---------------------------------------------------------------------------------------------
// Explore — light, adventurous F major (100 bpm)
// ---------------------------------------------------------------------------------------------
const EX_CHORDS = [
  [53, 57, 60], // F
  [52, 55, 60], // C/E
  [50, 53, 57], // Dm
  [50, 53, 58], // Bb/D
] as const;
const EX_ROOTS = [41, 36, 38, 34] as const;
const EX_MASK = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1] as const;
const EX_MOTIF: Record<number, Record<number, number>> = {
  4: { 0: 72, 4: 74, 6: 77, 8: 76, 12: 72 },
  5: { 0: 74, 4: 72, 8: 69, 12: 70 },
  6: { 0: 72, 4: 74, 6: 77, 8: 81, 12: 79 },
  7: { 0: 77, 6: 76, 8: 74 },
};

function exploreStep(d: Dest, step: number, t: number, sd: number): void {
  const bar = step >> 4;
  const s = step & 15;
  const ci = bar % 4;
  const chord = EX_CHORDS[ci]!;
  const root = EX_ROOTS[ci]!;
  if (s === 0) pad(d, t, [...chord], 16 * sd + 0.2, { gain: 0.045, attack: 0.5, release: 1.3, cutoff: 1700, send: 0.5 });
  if (s === 0 || s === 6 || s === 10) bass(d, t, root + (s === 10 ? 12 : 0), 2 * sd, 0.1, 650);
  if (EX_MASK[s]) {
    const tones = [...chord.map((x) => x + 12), chord[0] + 24];
    pluck(d, t, tones[(s * 3 + bar) % tones.length]!, 0.04, 0.65, 0.3);
  }
  const motif = EX_MOTIF[bar % 8]?.[s];
  if (motif !== undefined) bell(d, t, motif, 0.05, 1.5, 0.5);
  if (s === 0 || s === 8) softKick(d, t, 0.75);
  if (bar % 2 === 1 && s === 10) softKick(d, t, 0.45);
  if (s === 4 || s === 12) clap(d, t, 0.22);
  if (s % 4 === 2) hat(d, t, 0.45);
  else if (s % 2 === 1) hat(d, t, 0.18);
}

// ---------------------------------------------------------------------------------------------
// Tension — drones, low pulses, dissonant swells, heartbeat (72 bpm)
// ---------------------------------------------------------------------------------------------
function tensionStep(d: Dest, step: number, t: number, sd: number, rng: Rng): void {
  const bar = step >> 4;
  const s = step & 15;
  if (step % 64 === 0) drone(d, t, [26, 33], 64 * sd + 3, 0.16, 210);
  if (s === 0 || s === 8) subBass(d, t, 26, sd * 1.5, 0.13);
  if (s === 6 || s === 14) subBass(d, t, 26, sd, 0.06);
  if (s % 4 === 0) heartbeat(d, t, 0.32);
  if (step % 64 === 32) swellStrings(d, t, [62, 63, 69], 32 * sd, 0.07, 1300, 0.6);
  if (step % 128 === 96) swellStrings(d, t, [80, 81, 86], 32 * sd, 0.03, 3200, 0.8);
  if (s === 12 && bar % 2 === 1 && rng() < 0.5) bell(d, t, rng() < 0.5 ? 86 : 87, 0.025, 3, 0.95, rng() * 30 - 15);
}

// ---------------------------------------------------------------------------------------------
// Chase — driving D minor, taiko, ostinato bass, staccato strings, rising brass (156 bpm)
// ---------------------------------------------------------------------------------------------
const CH_CHORDS = [
  [57, 62, 65],
  [57, 62, 65],
  [58, 62, 65],
  [60, 64, 67],
] as const;
const CH_ROOTS = [38, 38, 34, 36] as const;
const BASS_PAT = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 7, 0, 12, 0] as const;

function chaseStep(d: Dest, step: number, t: number, sd: number, intensity: number): void {
  const m = chaseMix(intensity);
  const bar = step >> 4;
  const s = step & 15;
  const ci = bar % 4;
  const chord = CH_CHORDS[ci]!;
  const root = CH_ROOTS[ci]!;
  bass(d, t, root + BASS_PAT[s]!, sd * 0.8, 0.19 * m.bassGain, 450 + 1700 * intensity);
  // drums
  if (s === 0) taiko(d, t, 1, 1);
  if (s === 8) taiko(d, t, 0.85, 1);
  if (m.extraTaiko && (s === 3 || s === 6 || s === 11 || s === 14)) taiko(d, t, 0.5, 0.8, 0.2);
  if (m.roll && bar % 4 === 3 && s >= 12) taiko(d, t, 0.4 + 0.15 * (s - 12), 0.7, 0.2);
  if (m.shime && s % 4 === 2) shime(d, t, 0.7);
  if (s === 4 || s === 12) clap(d, t, 0.55);
  if (m.hats > 0.02) hat(d, t, (s % 2 === 0 ? 0.9 : 0.5) * m.hats);
  if (step % 64 === 0 && intensity > 0.5) cymbal(d, t, 1.2, 0.07, false);
  // staccato strings
  if (s % 2 === 0 || (intensity > 0.6 && s % 4 === 3)) {
    stacStrings(d, t, [...chord], sd * 0.7, 0.07 * m.strings, Math.min(m.filterHz, 6500));
  }
  // brass stabs
  if (m.brass > 0.02) {
    const voicing = (up: number): number[] => [root + 12 + up, root + 19 + up, root + 24 + up];
    if (bar % 4 !== 3) {
      if (s === 0 && bar % 2 === 0) brass(d, t, voicing(0), 3 * sd, 0.15 * m.brass, 0.9);
      if (s === 10 && bar % 2 === 1) brass(d, t, voicing(0), 2 * sd, 0.12 * m.brass, 0.9);
    } else if (s % 4 === 0) {
      const k = s >> 2;
      brass(d, t, voicing([0, 2, 3, 5][k]!), 2 * sd, (0.12 + 0.02 * k) * m.brass, 1.1);
    }
  }
  if (m.riser && bar % 4 === 2 && s === 0) riser(d, t, 32 * sd, 0.1);
}

// ---------------------------------------------------------------------------------------------
// Victory — brass fanfare (bars 0-3), then a warm D major loop
// ---------------------------------------------------------------------------------------------
export const FANFARE_STEPS = 64;
const FANFARE_MELODY: Record<number, readonly [number, number]> = {
  0: [57, 2],
  2: [62, 2],
  4: [66, 2],
  6: [69, 6],
  12: [69, 1.5],
  14: [71, 2],
};

export function fanfareStep(d: Dest, step: number, t: number, sd: number): void {
  const bar = step >> 4;
  const s = step & 15;
  if (bar === 0) {
    const m = FANFARE_MELODY[s];
    if (m) brass(d, t, [m[0], m[0] - 12], m[1] * sd * 0.95, 0.16, 0.9);
    if (s === 0) timpani(d, t, 38, 0.9);
    if (s === 6) timpani(d, t, 33, 0.8);
  } else if (bar === 1) {
    if (s === 0) {
      brass(d, t, [62, 66, 69, 74], 14 * sd, 0.19, 1);
      timpani(d, t, 38, 1);
      pad(d, t, [50, 57, 62, 66], 16 * sd, { gain: 0.05, attack: 0.3, release: 1 });
    }
    if (s === 4) cymbal(d, t, 12 * sd, 0.07, true);
    if (s >= 8) timpani(d, t, 33, 0.3 + (s - 8) * 0.07);
  } else if (bar === 2) {
    if (s === 0) {
      brass(d, t, [62, 67, 71, 74], 7 * sd, 0.19, 1);
      timpani(d, t, 43, 0.8);
    }
    if (s === 8) {
      brass(d, t, [64, 69, 73, 76], 7 * sd, 0.19, 1);
      timpani(d, t, 45, 0.8);
    }
    if (s === 12 || s === 14) timpani(d, t, 45, 0.5);
  } else if (bar === 3 && s === 0) {
    brass(d, t, [50, 57, 62, 66, 69, 74], 16 * sd, 0.22, 1.1);
    timpani(d, t, 38, 1.1);
    cymbal(d, t, 2.5, 0.11, false);
    pad(d, t, [50, 57, 62, 66, 69], 16 * sd, { gain: 0.07, attack: 0.3, release: 2 });
  }
}

const VIC_CHORDS = [
  [50, 57, 62, 66], // D
  [50, 59, 62, 67], // G/D
  [47, 54, 59, 62], // Bm
  [45, 52, 57, 61], // A
] as const;
const VIC_ROOTS = [38, 43, 35, 33] as const;

function victoryLoopStep(d: Dest, step: number, t: number, sd: number, rng: Rng): void {
  const bar = step >> 4;
  const s = step & 15;
  const ci = (bar >> 1) % 4;
  const chord = VIC_CHORDS[ci]!;
  if (s === 0 && bar % 2 === 0) {
    pad(d, t, [...chord], 32 * sd, { gain: 0.07, attack: 1.2, release: 2.5, cutoff: 1500, send: 0.6 });
    subBass(d, t, VIC_ROOTS[ci]!, 32 * sd * 0.92, 0.1);
  }
  const tones = [...chord.map((x) => x + 12)];
  if (s === 0 || s === 6 || s === 10) bell(d, t, tones[(bar + (s >> 1)) % tones.length]!, 0.045, 2.2, 0.7);
  if (s % 4 === 2 && rng() < 0.7) pluck(d, t, tones[(s >> 2) % tones.length]!, 0.025, 0.4, 0.4, 0.5);
}

// ---------------------------------------------------------------------------------------------
// Defeat sting
// ---------------------------------------------------------------------------------------------
export function defeatSting(d: Dest, t: number): number {
  timpani(d, t, 26, 1);
  gong(d, t, 0.22);
  subBass(d, t, 26, 2.2, 0.2);
  brass(d, t, [38, 39, 45], 2.2, 0.17, 0.45);
  [62, 60, 58, 57].forEach((m, i) => brass(d, t + 0.45 + i * 0.5, [m, m - 12], 0.46, 0.09, 0.3));
  pad(d, t + 2.45, [50, 53, 56, 62], 1.6, { gain: 0.085, attack: 0.4, release: 2.8, cutoff: 750, send: 0.8 });
  swellStrings(d, t + 2.3, [74, 75], 2.5, 0.03, 2500, 0.7);
  return 5.5;
}

// ---------------------------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------------------------
interface Inst {
  mode: MusicMode;
  clock: StepClock;
  dry: GainNode;
  send: GainNode;
  filter: BiquadFilterNode | null;
  dest: Dest;
  endAt: number | null;
  offset: number;
}

export class MusicEngine {
  private insts: Inst[] = [];
  private current: MusicMode = 'none';
  private intensity = 0;
  private paused = false;
  private lastVictoryShot = -1e9;
  private lastDefeatShot = -1e9;
  private rng = mulberry32(4242);

  constructor(private readonly mix: Mix) {}

  get mode(): MusicMode {
    return this.current;
  }
  get activeInstances(): number {
    return this.insts.length;
  }

  /** Record that a one-shot fanfare/sting just played so the music mode doesn't double it. */
  noteOneShot(kind: 'victory' | 'defeat', now: number): void {
    if (kind === 'victory') this.lastVictoryShot = now;
    else this.lastDefeatShot = now;
  }

  setMode(mode: MusicMode, now: number): void {
    if (mode === this.current) return;
    this.current = mode;
    for (const i of this.insts) {
      if (i.endAt !== null) continue;
      rampParam(i.dry.gain, 0, now, MODE_FADE_OUT);
      rampParam(i.send.gain, 0, now, MODE_FADE_OUT);
      i.endAt = now + MODE_FADE_OUT + 0.05;
    }
    if (mode === 'none') return;
    const ctx = this.mix.ctx;
    const dry = ctx.createGain();
    const send = ctx.createGain();
    const fi = modeFadeIn(mode);
    for (const g of [dry, send]) {
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(1, now + fi);
    }
    dry.connect(this.mix.musicIn);
    send.connect(this.mix.musicSendIn);
    let filter: BiquadFilterNode | null = null;
    if (mode === 'chase') {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.8;
      filter.frequency.value = chaseMix(this.intensity).filterHz;
      filter.connect(dry);
    }
    let offset = 0;
    if (mode === 'victory' && introRecentlyPlayed(now, this.lastVictoryShot)) offset = FANFARE_STEPS;
    if (mode === 'defeat' && introRecentlyPlayed(now, this.lastDefeatShot)) offset = 1;
    this.insts.push({
      mode,
      clock: new StepClock(MODE_BPM[mode], now + 0.05),
      dry,
      send,
      filter,
      dest: { ctx, noise: this.mix.white, brown: this.mix.brown, out: filter ?? dry, send, cave: this.mix.caveIn, echo: this.mix.echoIn },
      endAt: null,
      offset,
    });
  }

  setIntensity(i: number, now: number): void {
    const v = clamp(i);
    if (Math.abs(v - this.intensity) < 0.002) return;
    this.intensity = v;
    for (const inst of this.insts) if (inst.filter) target(inst.filter.frequency, chaseMix(v).filterHz, now, 0.25);
  }

  /** Schedule every step that starts before `until`. Call every ~25 ms with until = now + lookahead. */
  schedule(now: number, until: number): void {
    for (let k = this.insts.length - 1; k >= 0; k--) {
      const inst = this.insts[k]!;
      if (inst.endAt !== null && now >= inst.endAt) {
        this.release(inst);
        this.insts.splice(k, 1);
      }
    }
    if (this.paused) return;
    for (const inst of this.insts) {
      inst.clock.catchUp(now);
      const horizon = inst.endAt !== null ? Math.min(until, inst.endAt) : until;
      for (const ev of inst.clock.advance(horizon)) {
        try {
          this.playStep(inst, ev.step + inst.offset, ev.time);
        } catch {
          /* never let a scheduling hiccup kill the loop */
        }
      }
    }
  }

  pause(): void {
    this.paused = true;
  }
  resume(now: number): void {
    this.paused = false;
    for (const inst of this.insts) inst.clock.resync(now + 0.08);
  }

  private playStep(inst: Inst, step: number, t: number): void {
    const d = inst.dest;
    const sd = inst.clock.stepDur;
    switch (inst.mode) {
      case 'menu':
        menuStep(d, step, t, sd, this.rng);
        break;
      case 'explore':
        exploreStep(d, step, t, sd);
        break;
      case 'tension':
        tensionStep(d, step, t, sd, this.rng);
        break;
      case 'chase':
        chaseStep(d, step, t, sd, this.intensity);
        break;
      case 'victory':
        if (step < FANFARE_STEPS) fanfareStep(d, step, t, sd);
        else victoryLoopStep(d, step - FANFARE_STEPS, t, sd, this.rng);
        break;
      case 'defeat':
        if (step === 0) defeatSting(d, t);
        break;
      case 'none':
        break;
    }
  }

  private release(inst: Inst): void {
    for (const n of [inst.dry, inst.send, inst.filter]) {
      try {
        n?.disconnect();
      } catch {
        /* noop */
      }
    }
  }

  dispose(): void {
    for (const i of this.insts) this.release(i);
    this.insts = [];
  }
}

/** Schedule the full fanfare (as a one-shot) starting at `t`. Returns its duration. */
export function scheduleFanfare(d: Dest, t: number): number {
  const sd = 60 / MODE_BPM.victory / 4;
  for (let s = 0; s < FANFARE_STEPS; s++) fanfareStep(d, s, t + s * sd, sd);
  return FANFARE_STEPS * sd + 2.5;
}
