/**
 * Continuous, parameter-driven layers: wind, ski-on-snow, yeti breathing (positional), crowd.
 * Long-running looped noise sources are created once; `update` only moves parameters (throttled)
 * and occasionally schedules short breath / laughter grains.
 */
import type { AudioFrameState } from '../core/types';
import { crowdTargets, gustValue, skiTargets, windTargets, yetiBreathTargets } from './logic';
import { type Mix, createPanner, setPannerPosition, target } from './graph';
import { laugh, yetiBreath } from './sfx';

export class Ambience {
  private nodes: AudioNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  // wind
  private windLowF: BiquadFilterNode;
  private windLowG: GainNode;
  private windHiF: BiquadFilterNode;
  private windHiG: GainNode;
  private windPan: StereoPannerNode;
  // ski
  private scrapeF: BiquadFilterNode;
  private scrapeG: GainNode;
  private chatterOsc: OscillatorNode;
  private chatterBase: GainNode;
  private chatterDepth: GainNode;
  private iceF: BiquadFilterNode;
  private iceG: GainNode;
  private powderF: BiquadFilterNode;
  private powderG: GainNode;
  // crowd
  private crowdG: GainNode;
  // yeti
  private yetiPanner: PannerNode;
  private yetiG: GainNode;
  private breathTimer = 0;
  private exhale = true;
  private laughTimer = 2;
  private time = 0;
  private sinceParam = 1;
  private rnd = Math.random;
  /** location (biome) wind character: gain and filter-frequency multipliers (1 = alpine) */
  windGain = 1;
  windPitch = 1;

  constructor(private readonly mix: Mix) {
    const ctx = mix.ctx;
    const out = mix.ambIn;
    const loop = (buf: AudioBuffer, rate = 1): AudioBufferSourceNode => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.playbackRate.value = rate;
      this.sources.push(s);
      this.nodes.push(s);
      return s;
    };
    const filt = (type: BiquadFilterType, f: number, q = 0.707, gain = 0): BiquadFilterNode => {
      const n = ctx.createBiquadFilter();
      n.type = type;
      n.frequency.value = f;
      n.Q.value = q;
      n.gain.value = gain;
      this.nodes.push(n);
      return n;
    };
    const gain = (v: number): GainNode => {
      const g = ctx.createGain();
      g.gain.value = v;
      this.nodes.push(g);
      return g;
    };

    // --- wind: brown-noise body + resonant whistle, slowly panned with gusts
    this.windPan = ctx.createStereoPanner();
    this.nodes.push(this.windPan);
    this.windPan.connect(out);
    const wb = loop(mix.brown, 1);
    this.windLowF = filt('lowpass', 400, 0.6);
    this.windLowG = gain(0);
    wb.connect(this.windLowF).connect(this.windLowG).connect(this.windPan);
    const ww = loop(mix.white, 0.97);
    this.windHiF = filt('bandpass', 1200, 4);
    this.windHiG = gain(0);
    ww.connect(this.windHiF).connect(this.windHiG).connect(this.windPan);

    // --- ski: one white source feeds scrape + ice; brown feeds powder
    const sw = loop(mix.white, 1.03);
    this.scrapeF = filt('bandpass', 1400, 0.9);
    this.chatterBase = gain(1);
    this.chatterDepth = gain(0);
    this.chatterOsc = ctx.createOscillator();
    this.chatterOsc.type = 'square';
    this.chatterOsc.frequency.value = 22;
    this.sources.push(this.chatterOsc);
    this.nodes.push(this.chatterOsc);
    this.chatterOsc.connect(this.chatterDepth).connect(this.chatterBase.gain);
    this.scrapeG = gain(0);
    sw.connect(this.scrapeF).connect(this.chatterBase).connect(this.scrapeG).connect(out);
    this.iceF = filt('highpass', 6000, 0.8);
    const glass = filt('peaking', 7600, 6, 9);
    this.iceG = gain(0);
    sw.connect(this.iceF).connect(glass).connect(this.iceG).connect(out);
    const sb = loop(mix.brown, 1.6);
    this.powderF = filt('lowpass', 700, 0.5);
    this.powderG = gain(0);
    sb.connect(this.powderF).connect(this.powderG).connect(out);

    // --- crowd murmur: three vowel-ish bands with independent slow babble modulation
    this.crowdG = gain(0);
    this.crowdG.connect(out);
    const cw = loop(mix.white, 0.9);
    const cb = loop(mix.brown, 1.2);
    const bands: Array<[number, number, number, number]> = [
      [350, 3, 0.7, 1.1],
      [800, 4, 1.3, 0.8],
      [1600, 5, 2.1, 0.45],
    ];
    for (const [f, q, rate, lvl] of bands) {
      const bp = filt('bandpass', f, q);
      const am = gain(0.6);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rate;
      this.sources.push(lfo);
      this.nodes.push(lfo);
      lfo.connect(gain(0.4)).connect(am.gain);
      cw.connect(bp);
      cb.connect(gain(0.6)).connect(bp);
      bp.connect(am).connect(gain(lvl * Math.sqrt(q))).connect(this.crowdG);
    }

    // --- yeti breathing: persistent HRTF panner + level
    this.yetiPanner = createPanner(ctx, 6);
    this.yetiG = gain(0);
    this.nodes.push(this.yetiPanner);
    this.yetiG.connect(this.yetiPanner).connect(out);

    const t0 = ctx.currentTime;
    for (const s of this.sources) {
      if (s instanceof AudioBufferSourceNode) s.start(t0, Math.random() * 2);
      else s.start(t0);
    }
  }

  /** Per-frame update. Parameters are written at most ~30×/s; grains scheduled as needed. */
  update(dt: number, s: AudioFrameState, now: number, paused: boolean): void {
    const step = Math.min(Math.max(dt, 0), 0.25);
    this.time += step;
    this.sinceParam += step;
    if (this.sinceParam >= 0.033) {
      this.sinceParam = 0;
      this.applyParams(s, now);
    }
    if (s.yetiPos) setPannerPosition(this.yetiPanner, s.yetiPos, now, 0.03);
    if (paused) return;

    const yb = yetiBreathTargets(s.yetiDistance, s.yetiRunning);
    if (yb.active && s.yetiPos) {
      this.breathTimer -= step;
      if (this.breathTimer <= 0) {
        const dur = yetiBreath(this.mix.ambDest(), now + 0.02, this.yetiG, this.exhale, s.yetiRunning);
        this.exhale = !this.exhale;
        this.breathTimer = Math.max(yb.period, dur * 0.9) * (0.9 + this.rnd() * 0.2);
      }
    } else {
      this.breathTimer = 0.2;
    }

    const cr = crowdTargets(s.crowdLevel);
    if (cr.laughRate > 0.001) {
      this.laughTimer -= step;
      if (this.laughTimer <= 0) {
        laugh(this.mix.ambDest(), now + 0.02, this.rnd() * 1.6 - 0.8, s.crowdLevel);
        this.laughTimer = (-Math.log(1 - this.rnd() * 0.95) / cr.laughRate) * 1 + 0.6;
      }
    }
  }

  private applyParams(s: AudioFrameState, now: number): void {
    const w = windTargets(s.speed, s.eerie, gustValue(this.time));
    target(this.windLowG.gain, w.lowGain * this.windGain, now, 0.25);
    target(this.windLowF.frequency, w.lowFreq * this.windPitch, now, 0.25);
    target(this.windHiG.gain, w.whistleGain * this.windGain, now, 0.3);
    target(this.windHiF.frequency, w.whistleFreq * this.windPitch, now, 0.3);
    target(this.windHiF.Q, w.whistleQ, now, 0.3);
    target(this.windPan.pan, w.pan, now, 0.6);

    const k = skiTargets(s);
    const fast = 0.05;
    target(this.scrapeG.gain, k.scrapeGain, now, fast);
    target(this.scrapeF.frequency, k.scrapeFreq, now, fast);
    target(this.scrapeF.Q, k.scrapeQ, now, 0.1);
    target(this.chatterDepth.gain, k.chatterDepth / 2, now, fast);
    target(this.chatterBase.gain, 1 - k.chatterDepth / 2, now, fast);
    target(this.chatterOsc.frequency, k.chatterRate * (0.85 + this.rnd() * 0.3), now, 0.02);
    target(this.iceG.gain, k.iceGain, now, fast);
    target(this.iceF.frequency, k.iceFreq, now, fast);
    target(this.powderG.gain, k.powderGain, now, 0.08);
    target(this.powderF.frequency, k.powderFreq, now, 0.08);

    const yb = yetiBreathTargets(s.yetiDistance, s.yetiRunning);
    target(this.yetiG.gain, s.yetiPos ? yb.gain * 1.4 : 0, now, 0.15);

    target(this.crowdG.gain, crowdTargets(s.crowdLevel).murmurGain, now, 0.5);
  }

  dispose(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* noop */
      }
    }
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        /* noop */
      }
    }
    this.nodes = [];
    this.sources = [];
  }
}
