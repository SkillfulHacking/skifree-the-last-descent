/**
 * Audio test bench: trigger every sound, drive continuous parameters with sliders, and run an
 * OfflineAudioContext render suite (same AudioCore code path as the game) reporting peak/RMS/NaN stats.
 * Open /preview/audio.html; append ?auto to run the offline suite on load (used by headless checks).
 */
import * as THREE from 'three';
import type { AudioFrameState, ImpactKind, MusicMode, SurfaceType } from '../src/core/types';
import { AudioEngine } from '../src/audio/AudioEngine';
import { AudioCore } from '../src/audio/AudioCore';
import { type BufferStats, bufferStats } from '../src/audio/logic';

interface OfflineResult extends BufferStats {
  name: string;
  seconds: number;
  rawPeak: number;
  renderMs: number;
}

declare global {
  interface Window {
    __offlineResults?: OfflineResult[];
    __offlineError?: string;
    __ready?: boolean;
  }
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const engine = new AudioEngine();
const statusEl = $('status');

// ---------------------------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------------------------
const params: Record<string, number> = {};
function slider(parent: string, key: string, label: string, min: number, max: number, step: number, value: number, onInput?: () => void): void {
  const row = document.createElement('label');
  row.className = 'row';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  const out = document.createElement('output');
  const sync = (): void => {
    params[key] = Number(input.value);
    out.textContent = Number(input.value).toFixed(step < 1 ? 2 : 0);
    onInput?.();
  };
  input.addEventListener('input', sync);
  row.append(label, input, out);
  $(parent).append(row);
  sync();
}
const flags: Record<string, boolean> = {};
function checkbox(parent: string, key: string, label: string, value: boolean): void {
  const l = document.createElement('label');
  l.className = 'chk';
  const c = document.createElement('input');
  c.type = 'checkbox';
  c.checked = value;
  flags[key] = value;
  c.addEventListener('change', () => (flags[key] = c.checked));
  l.append(c, ' ', label);
  $(parent).append(l);
}
function button(parent: string, label: string, fn: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => {
    void engine.unlock().then(() => {
      fn();
      refreshStatus();
    });
  });
  $(parent).append(b);
  return b;
}

const applyVolumes = (): void => engine.setVolumes({ master: params.master ?? 0.9, music: params.music ?? 0.7, sfx: params.sfx ?? 0.9 });
slider('volumes', 'master', 'Master', 0, 1, 0.01, 0.9, applyVolumes);
slider('volumes', 'music', 'Music', 0, 1, 0.01, 0.7, applyVolumes);
slider('volumes', 'sfx', 'SFX', 0, 1, 0.01, 0.9, applyVolumes);

const modeButtons: HTMLButtonElement[] = [];
for (const m of ['none', 'menu', 'explore', 'tension', 'chase', 'victory', 'defeat'] as MusicMode[]) {
  const b = button('music', m, () => {
    engine.setMusicMode(m);
    for (const x of modeButtons) x.classList.toggle('active', x === b);
  });
  modeButtons.push(b);
}
slider('musicParams', 'chase', 'Chase intensity', 0, 1, 0.01, 0.3);
slider('musicParams', 'eerie', 'Eerie', 0, 1, 0.01, 0);

slider('cont', 'speed', 'Speed m/s', 0, 40, 0.1, 0);
slider('cont', 'edge', 'Edge load', 0, 1, 0.01, 0.4);
slider('cont', 'brake', 'Brake (pizza)', 0, 1, 0.01, 0);
checkbox('flags', 'grounded', 'grounded', true);
checkbox('flags', 'drifting', 'drifting', false);
checkbox('flags', 'crashed', 'crashed', false);

slider('yeti', 'yetiDist', 'Yeti distance', 2, 200, 0.5, 200);
slider('yeti', 'yetiAngle', 'Yeti angle °', -180, 180, 1, 180);
slider('yeti', 'crowd', 'Crowd level', 0, 1, 0.01, 0);
checkbox('yeti', 'yetiPresent', 'yeti present', false);
checkbox('yeti', 'yetiRunning', 'yeti running', false);

const listenerPos = new THREE.Vector3(0, 1.6, 0);
const listenerFwd = new THREE.Vector3(0, 0, 1);
function yetiPos(): THREE.Vector3 {
  const a = ((params.yetiAngle ?? 180) * Math.PI) / 180;
  const d = params.yetiDist ?? 100;
  return new THREE.Vector3(Math.sin(a) * d, 1.5, Math.cos(a) * d);
}

const impacts: ImpactKind[] = ['branch', 'rock-light', 'rock-heavy', 'tree-heavy', 'crash', 'log'];
for (const k of impacts) button('sfxA', `impact: ${k}`, () => engine.playImpact(k, 1));
button('sfxA', 'takeoff', () => engine.playTakeoff(0.8));
button('sfxA', 'landing soft', () => engine.playLanding(0.5, false));
button('sfxA', 'landing hard', () => engine.playLanding(1, true));
button('sfxA', 'pop', () => engine.playPop());
button('sfxA', 'grunt', () => engine.playExertion('grunt'));
button('sfxA', 'yelp', () => engine.playExertion('yelp'));
button('sfxA', 'gasp', () => engine.playExertion('gasp'));
button('sfxA', 'snow slide', () => engine.playSnowSlide());
button('sfxA', 'branch snap', () => engine.playBranchSnap(null));
button('sfxA', 'branch snap (left)', () => engine.playBranchSnap(new THREE.Vector3(-6, 2, 4)));

button('sfxB', 'ROAR', () => engine.playYetiRoar(null, 1));
button('sfxB', 'roar @ yeti pos', () => engine.playYetiRoar(yetiPos(), 1));
button('sfxB', 'growl near', () => engine.playYetiGrowl(yetiPos(), false));
button('sfxB', 'growl distant', () => engine.playYetiGrowl(null, true));
button('sfxB', 'yeti footstep', () => engine.playYetiFootstep(yetiPos(), 1));
button('sfxB', 'cave rumble', () => engine.playCaveRumble());
button('sfxB', 'gulp', () => engine.playGulp());
button('sfxB', 'burp', () => engine.playBurp());
button('sfxB', 'gulp+burp', () => {
  engine.playGulp();
  setTimeout(() => engine.playBurp(), 900);
});
button('sfxB', 'victory fanfare', () => engine.playVictoryFanfare());
button('sfxB', 'defeat sting', () => engine.playDefeatSting());
button('sfxB', 'crowd cheer', () => engine.playCrowdCheer(1));
button('sfxB', 'RUN.', () => engine.playRunPrompt());
button('sfxB', 'ui click', () => engine.playUiClick());
button('sfxB', 'ui move', () => engine.playUiMove());

let paused = false;
$('pause').addEventListener('click', () => {
  paused = !paused;
  engine.setPaused(paused);
  $('pause').textContent = paused ? 'Resume' : 'Pause';
});
$('unlock').addEventListener('click', () => void engine.unlock().then(refreshStatus));
function refreshStatus(): void {
  statusEl.textContent = engine.ready ? 'running' : 'locked — click "Unlock audio"';
}

function frameState(): AudioFrameState {
  const present = flags.yetiPresent ?? false;
  const yp = present ? yetiPos() : null;
  return {
    listenerPos,
    listenerForward: listenerFwd,
    speed: params.speed ?? 0,
    grounded: flags.grounded ?? true,
    edgeLoad: params.edge ?? 0,
    brake: params.brake ?? 0,
    drifting: flags.drifting ?? false,
    surface: ($('surface') as HTMLSelectElement).value as SurfaceType,
    crashed: flags.crashed ?? false,
    yetiPos: yp,
    yetiDistance: yp ? (params.yetiDist ?? 100) : null,
    yetiRunning: flags.yetiRunning ?? false,
    chaseIntensity: params.chase ?? 0,
    crowdLevel: params.crowd ?? 0,
    eerie: params.eerie ?? 0,
  };
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  engine.update(dt, frameState());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------------------------------------
// Offline render suite
// ---------------------------------------------------------------------------------------------
const SR = 48000;
type Setup = (core: AudioCore, ctx: OfflineAudioContext) => void;
interface Case {
  name: string;
  seconds: number;
  setup: Setup;
}

const baseState = (): AudioFrameState => ({
  listenerPos: new THREE.Vector3(0, 1.6, 0),
  listenerForward: new THREE.Vector3(0, 0, 1),
  speed: 0,
  grounded: true,
  edgeLoad: 0.5,
  brake: 0,
  drifting: false,
  surface: 'snow',
  crashed: false,
  yetiPos: null,
  yetiDistance: null,
  yetiRunning: false,
  chaseIntensity: 0,
  crowdLevel: 0,
  eerie: 0,
});

/**
 * Drive the music scheduler exactly like realtime: wake every 25 ms (via OfflineAudioContext.suspend)
 * and schedule 150 ms ahead, so only the notes a live game would have in flight exist in the graph.
 * This makes the render time a fair proxy for realtime CPU cost.
 */
const LOOKAHEAD = 0.15;
const TICK = 0.025;
function driveScheduler(core: AudioCore, ctx: OfflineAudioContext, seconds: number, at?: (t: number) => void): void {
  core.music.schedule(0, LOOKAHEAD);
  for (let t = TICK; t < seconds - TICK; t += TICK) {
    const tt = t;
    ctx
      .suspend(tt)
      .then(() => {
        at?.(tt);
        core.music.schedule(ctx.currentTime, ctx.currentTime + LOOKAHEAD);
        return ctx.resume();
      })
      .catch(() => undefined);
  }
}
const music = (mode: MusicMode, intensity = 0, seconds = 0): Setup => (core, ctx) => {
  core.music.setIntensity(intensity, 0);
  core.setMusicMode(mode);
  driveScheduler(core, ctx, seconds || ctx.length / ctx.sampleRate);
};

/** Ambience with per-50 ms parameter updates via OfflineAudioContext.suspend(). */
const ambience = (fn: (t: number, s: AudioFrameState) => void, seconds: number): Setup => (core, ctx) => {
  const s = baseState();
  fn(0, s);
  core.update(0.05, s);
  for (let t = 0.05; t < seconds - 0.05; t += 0.05) {
    const tt = t;
    ctx
      .suspend(tt)
      .then(() => {
        fn(tt, s);
        core.update(0.05, s);
        return ctx.resume();
      })
      .catch(() => undefined);
  }
};

const CASES: Case[] = [
  { name: 'roar (non-positional)', seconds: 5, setup: (c) => c.playYetiRoar(null, 1) },
  { name: 'roar (positional, behind-left 12 m)', seconds: 5, setup: (c) => c.playYetiRoar(new THREE.Vector3(-6, 1, -10), 1) },
  { name: 'growl distant', seconds: 5, setup: (c) => c.playYetiGrowl(null, true) },
  { name: 'growl near', seconds: 3, setup: (c) => c.playYetiGrowl(new THREE.Vector3(3, 1, -5), false) },
  { name: 'yeti footstep', seconds: 1, setup: (c) => c.playYetiFootstep(new THREE.Vector3(0, 0, -8), 1) },
  ...impacts.map((k): Case => ({ name: `impact ${k}`, seconds: 1.6, setup: (c) => c.playImpact(k, 1) })),
  { name: 'takeoff', seconds: 0.8, setup: (c) => c.playTakeoff(1) },
  { name: 'landing hard', seconds: 0.8, setup: (c) => c.playLanding(1, true) },
  { name: 'pop', seconds: 0.5, setup: (c) => c.playPop() },
  { name: 'grunt', seconds: 0.6, setup: (c) => c.playExertion('grunt') },
  { name: 'yelp', seconds: 0.7, setup: (c) => c.playExertion('yelp') },
  { name: 'gasp', seconds: 0.8, setup: (c) => c.playExertion('gasp') },
  { name: 'cave rumble', seconds: 6, setup: (c) => c.playCaveRumble() },
  { name: 'snow slide', seconds: 2, setup: (c) => c.playSnowSlide() },
  { name: 'branch snap', seconds: 1, setup: (c) => c.playBranchSnap(null) },
  { name: 'gulp', seconds: 1, setup: (c) => c.playGulp() },
  { name: 'burp', seconds: 1.4, setup: (c) => c.playBurp() },
  { name: 'victory fanfare', seconds: 14, setup: (c) => c.playVictoryFanfare() },
  { name: 'defeat sting', seconds: 7, setup: (c) => c.playDefeatSting() },
  { name: 'crowd cheer', seconds: 3.5, setup: (c) => c.playCrowdCheer(1) },
  { name: 'ui click', seconds: 0.3, setup: (c) => c.playUiClick() },
  { name: 'ui move', seconds: 0.3, setup: (c) => c.playUiMove() },
  { name: 'RUN. prompt', seconds: 4, setup: (c) => c.playRunPrompt() },
  { name: 'everything at once (stress)', seconds: 5, setup: (c) => {
    c.playYetiRoar(null, 1);
    c.playRunPrompt();
    c.playCaveRumble();
    c.playImpact('crash', 1);
    c.playImpact('rock-heavy', 1);
    c.playLanding(1, true);
    c.playCrowdCheer(1);
    music('chase', 1)(c, c.ctx as OfflineAudioContext);
  } },
  { name: 'music: menu', seconds: 16, setup: music('menu') },
  { name: 'music: explore', seconds: 12, setup: music('explore') },
  { name: 'music: tension', seconds: 16, setup: music('tension') },
  { name: 'music: chase i=0.2', seconds: 10, setup: music('chase', 0.2) },
  { name: 'music: chase i=1.0', seconds: 10, setup: music('chase', 1) },
  { name: 'music: victory', seconds: 16, setup: music('victory') },
  { name: 'music: defeat', seconds: 7, setup: music('defeat') },
  {
    name: 'music: explore→chase crossfade @3s',
    seconds: 8,
    setup: (c, ctx) => {
      c.music.setMode('explore', 0);
      let switched = false;
      driveScheduler(c, ctx, 8, (t) => {
        if (!switched && t >= 3) {
          switched = true;
          c.music.setIntensity(0.6, ctx.currentTime);
          c.music.setMode('chase', ctx.currentTime);
        }
      });
    },
  },
  {
    name: 'ambience: accelerate 0→32 m/s, drift @2s, ice @3s',
    seconds: 4.5,
    setup: ambience((t, s) => {
      s.speed = Math.min(32, t * 12);
      s.drifting = t > 2 && t < 2.8;
      s.surface = t > 3 ? 'ice' : 'snow';
      s.edgeLoad = 0.6;
    }, 4.5),
  },
  {
    name: 'ambience: yeti approaching (running), crowd 0.6',
    seconds: 5,
    setup: ambience((t, s) => {
      const d = Math.max(4, 60 - t * 12);
      s.yetiPos = new THREE.Vector3(2, 1.5, -d);
      s.yetiDistance = d;
      s.yetiRunning = true;
      s.crowdLevel = 0.6;
      s.speed = 15;
    }, 5),
  },
];

async function renderCase(c: Case, bypassClipper: boolean): Promise<{ stats: BufferStats; ms: number }> {
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(SR * c.seconds), sampleRate: SR });
  const core = new AudioCore(ctx, { bypassClipper });
  core.setVolumes({ master: 0.9, music: 0.7, sfx: 0.9 });
  c.setup(core, ctx);
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  const ms = performance.now() - t0;
  const chans = [buf.getChannelData(0), buf.getChannelData(1)];
  core.dispose();
  return { stats: bufferStats(chans, SR), ms };
}

async function runOffline(): Promise<OfflineResult[]> {
  const table = $('results') as HTMLTableElement;
  table.innerHTML =
    '<tr><th>case</th><th>sec</th><th>peak</th><th>pre-clip peak</th><th>RMS dBFS</th><th>max 50ms RMS dBFS</th><th>NaN</th><th>&gt;1.0</th><th>render ms</th></tr>';
  const results: OfflineResult[] = [];
  const db = (x: number): string => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');
  for (const c of CASES) {
    $('offlineStatus').textContent = `rendering ${c.name}…`;
    const final = await renderCase(c, false);
    const raw = await renderCase(c, true);
    const r: OfflineResult = { name: c.name, seconds: c.seconds, ...final.stats, rawPeak: raw.stats.peak, renderMs: Math.round(final.ms) };
    results.push(r);
    const silent = r.maxShortRms < 0.003;
    const row = document.createElement('tr');
    row.innerHTML = `<td>${r.name}</td><td>${r.seconds}</td><td class="${r.peak > 1 ? 'bad' : 'ok'}">${r.peak.toFixed(3)}</td><td>${r.rawPeak.toFixed(
      3,
    )}</td><td class="${silent ? 'bad' : ''}">${db(r.rms)}</td><td>${db(r.maxShortRms)}</td><td class="${r.nans ? 'bad' : 'ok'}">${r.nans}</td><td class="${
      r.overOne ? 'bad' : 'ok'
    }">${r.overOne}</td><td>${r.renderMs}</td>`;
    table.append(row);
  }
  $('offlineStatus').textContent = `done (${results.length} cases)`;
  return results;
}

$('runOffline').addEventListener('click', () => {
  void runOffline().then((r) => (window.__offlineResults = r));
});

if (new URLSearchParams(location.search).has('auto')) {
  runOffline()
    .then((r) => {
      window.__offlineResults = r;
      window.__ready = true;
    })
    .catch((e: unknown) => {
      window.__offlineError = String(e);
      window.__ready = true;
    });
}
