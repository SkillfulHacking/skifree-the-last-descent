/**
 * Coastal sound (Fjord Coast), synthesized like everything else in the engine (no samples):
 *  - beds: 'surf' — a low, slowly breathing sea roar (brown noise through a swelling low-pass,
 *    with a hiss of foam on each swell); 'gulls' — occasional herring-gull calls (FM-swept
 *    oscillators with a rough edge), more of them near the water;
 *  - cues for the Fjord hazards and viewpoints: 'gust-build' (rising whoosh while a squall's
 *    windsock lifts), 'gust-blow' (the gust), 'rock-scrape' (skis on bare rock), 'viewpoint'
 *    (a two-note bell).
 * The level of the beds follows AudioFrameState.coast (0 inland … 1 at the water's edge).
 */
import type { Dest, Mix, Vec3Like } from './graph';
import { Voice, envAD, envPoints, expPoints, target } from './graph';

export const COAST_CUES = ['gust-build', 'gust-blow', 'rock-scrape', 'viewpoint', 'gull'] as const;

export function coastCue(d: Dest, t: number, id: string, pos: Vec3Like | null): number {
  const v = new Voice(d);
  const sp = v.spatial(pos, 14);
  sp.connect(d.out);
  if (id === 'gust-build' || id === 'gust-blow') {
    const build = id === 'gust-build';
    const dur = build ? 1.4 : 1.8;
    const n = v.noise('white');
    const bp = v.filter('bandpass', build ? 300 : 700, 1.4);
    const g = v.gain(0);
    expPoints(bp.frequency, t, build ? [[0, 280], [dur, 1500]] : [[0, 1300], [dur * 0.4, 900], [dur, 400]]);
    envPoints(g.gain, t, build ? [[0, 0], [dur * 0.85, 0.32], [dur, 0.05]] : [[0, 0.05], [0.25, 0.5], [dur * 0.6, 0.35], [dur, 0]]);
    n.connect(bp).connect(g).connect(sp);
    const lo = v.noise('brown');
    const lg = v.gain(0);
    envPoints(lg.gain, t, [[0, 0], [dur * 0.6, build ? 0.25 : 0.55], [dur, 0]]);
    lo.connect(v.filter('lowpass', 420, 0.7)).connect(lg).connect(sp);
    v.play(t, t + dur + 0.05);
    return dur;
  }
  if (id === 'rock-scrape') {
    const n = v.noise('white');
    const g = v.gain(0);
    envAD(g.gain, t, 0.35, 0.01, 0.32);
    const am = v.osc('square', 38);
    const amg = v.gain(0.5);
    am.connect(amg).connect(g.gain);
    n.connect(v.filter('bandpass', 2400, 1.2)).connect(g).connect(sp);
    v.play(t, t + 0.4);
    return 0.4;
  }
  if (id === 'viewpoint') {
    for (const [o, f] of [
      [0, 784],
      [0.16, 1175],
    ] as const) {
      const s = v.osc('sine', f);
      const s2 = v.osc('sine', f * 2.76);
      const g = v.gain(0);
      envAD(g.gain, t + o, 0.18, 0.005, 1.4);
      const g2 = v.gain(0);
      envAD(g2.gain, t + o, 0.05, 0.003, 0.4);
      s.connect(g).connect(sp);
      s2.connect(g2).connect(sp);
    }
    v.play(t, t + 1.8);
    return 1.8;
  }
  if (id === 'gull') return gull(v, sp, t);
  v.dispose();
  return 0;
}

/** one herring-gull "kyow-kyow-kyow" */
function gull(v: Voice, out: AudioNode, t: number): number {
  const n = 2 + Math.floor(v.random() * 3);
  const f0 = 1500 + v.random() * 500;
  let tt = t;
  for (let i = 0; i < n; i++) {
    const len = 0.16 + v.random() * 0.1;
    const c = v.osc('sawtooth', f0);
    const m = v.osc('sine', 9 + v.random() * 6);
    const mg = v.gain(f0 * 0.05);
    m.connect(mg).connect(c.frequency);
    expPoints(c.frequency, tt, [[0, f0 * 0.75], [len * 0.25, f0 * 1.1], [len, f0 * 0.7]]);
    const bp = v.filter('bandpass', f0 * 1.2, 4);
    const g = v.gain(0);
    envPoints(g.gain, tt, [[0, 0], [0.02, 0.09], [len * 0.7, 0.06], [len, 0]]);
    c.connect(bp).connect(g).connect(out);
    tt += len + 0.06 + v.random() * 0.06;
  }
  v.play(t, tt + 0.05);
  return tt - t;
}

/** Looping coastal beds (surf + gulls), created by Ambience when the location asks for them. */
export class CoastBeds {
  private nodes: AudioNode[] = [];
  private src: AudioBufferSourceNode[] = [];
  private surfG: GainNode;
  private surfF: BiquadFilterNode;
  private hissG: GainNode;
  private time = 0;
  private gullTimer = 3;
  level = 0;

  constructor(
    private mix: Mix,
    private surf: boolean,
    private gulls: boolean,
  ) {
    const ctx = mix.ctx;
    const out = mix.ambIn;
    const loop = (buf: AudioBuffer, rate: number) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.playbackRate.value = rate;
      this.src.push(s);
      this.nodes.push(s);
      return s;
    };
    this.surfF = ctx.createBiquadFilter();
    this.surfF.type = 'lowpass';
    this.surfF.frequency.value = 380;
    this.surfG = ctx.createGain();
    this.surfG.gain.value = 0;
    this.hissG = ctx.createGain();
    this.hissG.gain.value = 0;
    const hf = ctx.createBiquadFilter();
    hf.type = 'highpass';
    hf.frequency.value = 2500;
    this.nodes.push(this.surfF, this.surfG, this.hissG, hf);
    if (surf) {
      loop(mix.brown, 0.8).connect(this.surfF).connect(this.surfG).connect(out);
      loop(mix.white, 0.6).connect(hf).connect(this.hissG).connect(out);
    }
    const t0 = ctx.currentTime;
    for (const s of this.src) s.start(t0, Math.random() * 2);
  }

  update(dt: number, coast: number, now: number, paused: boolean) {
    this.time += dt;
    this.level += (coast - this.level) * Math.min(1, dt * 1.5);
    const L = this.level;
    if (this.surf) {
      // a swell every ~7 s: the roar rises and opens up, foam hisses on the break
      const sw = 0.5 + 0.5 * Math.sin((this.time / 7) * Math.PI * 2);
      const br = Math.pow(sw, 6);
      target(this.surfG.gain, L * (0.1 + 0.16 * sw), now, 0.3);
      target(this.surfF.frequency, 260 + 520 * sw * L, now, 0.3);
      target(this.hissG.gain, L * L * 0.05 * br, now, 0.15);
    }
    if (this.gulls && !paused) {
      this.gullTimer -= dt * (0.25 + L);
      if (this.gullTimer <= 0) {
        this.gullTimer = 3 + Math.random() * 7;
        if (L > 0.1) {
          const v = new Voice(this.mix.ambDest());
          const pan = v.stereo(Math.random() * 1.6 - 0.8);
          const g = v.gain(0.4 + 0.6 * L);
          g.connect(pan).connect(this.mix.ambIn);
          gull(v, g, now + 0.02);
        }
      }
    }
  }

  dispose() {
    for (const s of this.src) {
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
  }
}
