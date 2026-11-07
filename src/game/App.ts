/**
 * Application shell: renderer, loading, menus, settings, run lifecycle, perf overlay, debug harness.
 */
import * as THREE from 'three';
import { World } from './World';
import { GameSession } from './GameSession';
import { SkierModel } from '../player/SkierModel';
import { YetiModel } from '../yeti/YetiModel';
import { AudioEngine } from '../audio/AudioEngine';
import { Input, ACTION_LABELS, keyName, type Action, DEFAULT_BINDINGS, type GameplayInput } from '../input/Input';

const NEUTRAL_INPUT: GameplayInput = { steer: 0, tuck: 0, brake: 0, drift: false, pop: false, recoverPressed: false, lookBack: false, pausePressed: false, skipPressed: false, camX: 0, camY: 0 };
import { Hud } from '../ui/Hud';
import { MenuSystem, type Screen, type MenuItem } from '../ui/Menu';
import { applyRun, loadRecordBook, loadSettings, recordsFor, saveRecordBook, saveSettings, type RecordBook, type RunStats, type Settings, type Records } from '../core/settings';
import type { QualityPreset } from '../core/types';
import { LENGTH_INFO, LENGTH_MODES, addDays, courseId, courseLabel, makeCourse, msUntilRollover, parseCourseId, utcDate, type CourseConfig, type CourseMode, type LengthMode } from './CourseConfig';
import { fmtDistance } from '../ui/Hud';
import type { AutopilotStyle } from '../debug/autopilot';

type Mode = 'loading' | 'menu' | 'playing' | 'paused' | 'results';

export class App {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  settings: Settings;
  book: RecordBook;
  /** records of the current course */
  get records(): Records {
    return recordsFor(this.book, courseId(this.currentCourse()));
  }
  readonly input: Input;
  readonly audio = new AudioEngine();
  readonly hud: Hud;
  readonly menu: MenuSystem;
  world: World | null = null;
  skier: SkierModel | null = null;
  yeti: YetiModel | null = null;
  session: GameSession | null = null;
  mode: Mode = 'loading';
  private last = performance.now();
  private menuTime = 0;
  private loadingEl: HTMLDivElement;
  private loadingBar: HTMLDivElement;
  private loadingLabel: HTMLDivElement;
  private pendingQuality: QualityPreset | null = null;
  private perf = { fps: 0, frameMs: 0, frames: 0, acc: 0, worst: 0, samples: [] as number[] };
  private ui: HTMLElement;
  private contextLost = false;
  private errorStreak = 0;

  constructor(container: HTMLElement) {
    this.settings = loadSettings();
    this.book = loadRecordBook();
    this.renderer = new THREE.WebGLRenderer({ antialias: this.settings.quality !== 'low', powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 0.78;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.applyPixelRatio();
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.showFatal('The graphics context was lost. Reload the page to continue (try a lower graphics preset).');
    });
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.15, 12000);
    this.ui = document.createElement('div');
    this.ui.className = 'ui';
    container.appendChild(this.ui);
    this.input = new Input({ ...this.inputSettings() });
    this.input.onDeviceChange = (d) => {
      this.hud.device = d;
      document.body.dataset.device = d;
      this.menu.current && this.menu.refresh();
    };
    this.hud = new Hud(this.ui, this.settings.bindings);
    this.applyUiScale();
    this.hud.reduceFlashes = this.settings.reduceFlashes;
    this.hud.showFps(this.settings.showFps);
    this.menu = new MenuSystem(this.ui);
    this.menu.onSound = (k) => (k === 'move' ? this.audio.playUiMove() : this.audio.playUiClick());

    this.loadingEl = document.createElement('div');
    this.loadingEl.className = 'loading';
    this.loadingEl.innerHTML = `<div class="logo"><span class="sk">SKIFREE</span><span class="tld">THE LAST DESCENT</span></div><div class="load-bar"><div class="fill"></div></div><div class="load-label">Preparing</div>`;
    this.ui.appendChild(this.loadingEl);
    this.loadingBar = this.loadingEl.querySelector('.fill') as HTMLDivElement;
    this.loadingLabel = this.loadingEl.querySelector('.load-label') as HTMLDivElement;

    addEventListener('resize', () => this.resize());
    // audio needs a user gesture
    const unlock = () => void this.audio.unlock().then(() => this.applyVolumes());
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
    addEventListener('blur', () => {
      if (this.mode === 'playing') this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'playing') this.pause();
    });
  }

  private inputSettings() {
    const s = this.settings;
    return { deadzone: s.deadzone, steerSensitivity: s.steerSensitivity, cameraSensitivity: s.cameraSensitivity, invertCameraY: s.invertCameraY, invertCameraX: s.invertCameraX, bindings: s.bindings };
  }

  private applyPixelRatio() {
    const cap = { low: 1, medium: 1.25, high: 1.5, ultra: 2 }[this.settings.quality];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, cap) * this.settings.renderScale);
    this.renderer.setSize(innerWidth, innerHeight);
  }

  private resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.applyPixelRatio();
    this.world?.particles.setPixelRatio(this.renderer.getPixelRatio(), innerHeight);
  }

  private applyVolumes() {
    this.audio.setVolumes({ master: this.settings.masterVolume, music: this.settings.musicVolume, sfx: this.settings.sfxVolume });
  }

  private applyUiScale() {
    document.documentElement.style.setProperty('--ui-scale', String(this.settings.uiScale));
  }

  private saveAll() {
    saveSettings(this.settings);
    this.applyUiScale();
    this.input.settings = this.inputSettings();
    this.hud.bindings = this.settings.bindings;
    this.hud.reduceFlashes = this.settings.reduceFlashes;
    this.hud.showFps(this.settings.showFps);
    this.hud.captionsOn = this.settings.captions;
    if (this.session) {
      this.session.follow.shakeScale = this.settings.cameraShake;
      this.session.follow.reduceMotion = this.settings.reduceCameraMotion;
    }
    this.applyVolumes();
  }

  async start() {
    await this.buildWorld(this.settings.quality, this.currentCourse());
    this.loop();
    if (new URLSearchParams(location.search).has('debug')) this.installDebug();
    this.toMenu();
    (window as unknown as { __ready: boolean }).__ready = true;
  }

  /** The course the menu currently selects (Daily follows the UTC date unless a past day is chosen). */
  currentCourse(): CourseConfig {
    const s = this.settings;
    const today = utcDate();
    const date = s.dailyDate && s.dailyDate < today ? s.dailyDate : today;
    return makeCourse(s.course, s.courseLength, { date, customText: s.customSeed });
  }

  private async buildWorld(q: QualityPreset, course: CourseConfig) {
    this.mode = 'loading';
    this.loadingEl.classList.remove('hidden');
    const t0 = performance.now();
    this.session?.dispose();
    this.session = null;
    if (this.world) {
      this.world.dispose();
      this.world = null;
    }
    this.skier?.dispose();
    this.yeti?.dispose();
    const world = await World.create(this.renderer, q, course, (f, label) => {
      this.loadingBar.style.width = `${(f * 100).toFixed(0)}%`;
      this.loadingLabel.textContent = label;
    });
    this.skier = new SkierModel({ quality: q });
    this.yeti = new YetiModel({ quality: q });
    world.scene.add(this.skier.root, this.yeti.root);
    // cold rim light that makes the white beast read against white snow (always in the scene: no recompiles)
    const rim = new THREE.PointLight(0x9cc8ff, 0, 14, 2);
    rim.position.set(0, 3.2, -2.2);
    this.yeti.root.add(rim);
    this.yetiRim = rim;
    this.yeti.setVisible(false);
    this.world = world;
    world.particles.setPixelRatio(this.renderer.getPixelRatio(), innerHeight);
    // warm up shaders to avoid first-frame hitches
    this.placeMenuSkier();
    const r0 = world.mountain.routeX(0);
    this.camera.position.set(r0 + 20, world.mountain.heightAt(r0, 0) + 10, -30);
    this.camera.lookAt(r0, world.mountain.heightAt(r0, 0), 40);
    // warm up every shader permutation (including shadow passes) to avoid hitches at first sight
    this.yeti.setVisible(true);
    world.showAllForWarmup();
    if (world.resort) world.resort.group.visible = true;
    this.renderer.compile(world.scene, this.camera);
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(world.scene, this.camera);
    this.yeti.setVisible(false);
    this.loadingBar.style.width = '100%';
    console.info(`[skifree] ${world.id} built in ${(performance.now() - t0).toFixed(0)} ms (${q}); obstacles loaded: ${world.obstacles.obstacleCount}`);
    this.loadingEl.classList.add('hidden');
  }

  private placeMenuSkier() {
    if (!this.world || !this.skier) return;
    const x = this.world.mountain.routeX(1);
    this.skier.root.position.set(x, this.world.mountain.heightAt(x, 1), 1);
    this.skier.root.rotation.set(0, 0, 0);
    this.skier.setVisible(true);
  }

  // --- screens -------------------------------------------------------------------
  toMenu() {
    this.session?.dispose();
    this.session = null;
    this.mode = 'menu';
    this.hud.show(false);
    this.placeMenuSkier();
    this.yeti?.setVisible(false);
    this.world?.resetTrophy();
    this.audio.setMusicMode('menu');
    this.audio.setPaused(false);
    this.input.captureKeys = true;
    this.menu.open(this.mainScreen());
  }

  private mainScreen(): Screen {
    const st = this.settings;
    const c = this.currentCourse();
    const r = this.records;
    const today = utcDate();
    const changed = () => {
      this.saveAll();
      this.menu.replace(this.mainScreen());
    };
    const items: MenuItem[] = [
      { kind: 'button', label: 'Start', hint: LENGTH_INFO[c.length].label, primary: true, action: () => void this.startRun(false) },
      {
        kind: 'select',
        label: 'Mountain',
        options: [
          { value: 'classic', label: 'The Last Descent' },
          { value: 'daily', label: 'Daily Mountain' },
          { value: 'custom', label: 'Custom seed' },
        ],
        get: () => st.course,
        set: (v) => {
          st.course = v as CourseMode;
          changed();
        },
      },
      {
        kind: 'select',
        label: 'Length',
        options: LENGTH_MODES.map((l) => ({ value: l, label: LENGTH_INFO[l].label })),
        get: () => st.courseLength,
        set: (v) => {
          st.courseLength = v as LengthMode;
          changed();
        },
      },
    ];
    if (st.course === 'daily') {
      const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
      const hrs = Math.floor(msUntilRollover() / 3600000);
      items.push({
        kind: 'select',
        label: 'Day (UTC)',
        note: `new mountain in ${hrs} h · rolls over 00:00 UTC`,
        options: days.map((d, i) => ({ value: d, label: i === 0 ? `Today · ${d}` : d })),
        get: () => c.date ?? today,
        set: (v) => {
          st.dailyDate = v === today ? null : v;
          changed();
        },
      });
    } else if (st.course === 'custom') {
      items.push({
        kind: 'text',
        label: 'Seed',
        note: 'any word or number',
        placeholder: 'POWDER',
        maxLength: 24,
        get: () => st.customSeed,
        set: (v) => {
          st.customSeed = v.toUpperCase().slice(0, 24);
          changed();
        },
      });
    }
    const best = r.runs ? `Best ${r.bestScore.toLocaleString('en-US')} pts${r.bestTime !== null ? ` · ${fmtTime(r.bestTime)}` : ''} · ${fmtDistance(r.bestDistance)} · ${r.runs} run${r.runs === 1 ? '' : 's'}` : 'No runs on this course yet';
    items.push(
      { kind: 'info', html: `<div class="course-card"><span>Course code <span class="code">${courseId(c)}</span></span><span>seed ${c.seed}</span><span class="rec">${best} <i>(this device only)</i></span></div>` },
      {
        kind: 'text',
        label: 'Enter a course code',
        note: 'play a code a friend shared',
        placeholder: 'DAILY-2026-11-07-STD',
        maxLength: 32,
        get: () => '',
        set: (v) => {
          const parsed = parseCourseId(v);
          if (!parsed) {
            this.hud.caption(`Unknown course code: ${v.slice(0, 32)}`, 3);
            return;
          }
          st.course = parsed.mode;
          st.courseLength = parsed.length;
          if (parsed.mode === 'daily') st.dailyDate = parsed.date === today ? null : parsed.date;
          if (parsed.mode === 'custom' && parsed.customText) st.customSeed = parsed.customText;
          changed();
        },
      },
      { kind: 'button', label: 'Controls', action: () => this.menu.push(this.controlsScreen()) },
      { kind: 'button', label: 'Settings', action: () => this.menu.push(this.settingsScreen()) },
      { kind: 'button', label: 'Credits & Licences', action: () => this.menu.push(this.creditsScreen()) },
    );
    return {
      id: 'main',
      cls: 'main',
      title: 'SKIFREE',
      hero: { title: 'SKIFREE', tagline: 'THE LAST DESCENT' },
      items,
      aside: `${courseLabel(c)}`,
    };
  }

  async startRun(retry: boolean) {
    void this.audio.unlock().then(() => this.applyVolumes());
    const course = this.currentCourse();
    const q = this.pendingQuality ?? this.settings.quality;
    if (q !== this.world?.quality || courseId(course) !== this.world?.id) {
      this.menu.close();
      await this.buildWorld(q, course);
      this.applyPixelRatio();
    }
    this.pendingQuality = null;
    if (!this.world || !this.skier || !this.yeti) return;
    this.session?.dispose();
    this.menu.close();
    this.input.clearHeld();
    this.audio.setPaused(false);
    this.hud.show(true);
    this.session = new GameSession(this.world, this.skier, this.yeti, this.audio, this.hud, this.settings, this.camera, {
      onResults: (stats, won) => this.showResults(stats, won),
      onPauseRequest: () => this.pause(),
    }, { skipIntro: retry });
    this.session.recordsSeenCave = this.book.seenCaveCinematic;
    this.session.onCaveSeen = () => {
      this.book.seenCaveCinematic = true;
      saveRecordBook(this.book);
    };
    this.mode = 'playing';
  }

  pause() {
    if (this.mode !== 'playing' || !this.session) return;
    if (this.session.isCinematic() && this.session.run.phase !== 'caveCinematic' && !this.session.inIntro) return;
    this.mode = 'paused';
    this.session.paused = true;
    this.audio.setPaused(true);
    const resume = () => {
      this.menu.close();
      this.mode = 'playing';
      if (this.session) this.session.paused = false;
      this.audio.setPaused(false);
      this.input.clearHeld();
    };
    const s = this.session;
    const retire: MenuItem[] = s.endless
      ? [{ kind: 'button', label: 'Retire & bank', hint: `${s.banked.toLocaleString('en-US')} pts`, action: () => {
          this.menu.close();
          this.mode = 'playing';
          s.paused = false;
          this.audio.setPaused(false);
          s.retire();
        } }]
      : [];
    this.menu.open({
      id: 'pause',
      cls: 'pause',
      title: 'PAUSED',
      subtitle: `${courseLabel(this.world!.course)} · <span class="code">${this.world!.id}</span>`,
      onBack: resume,
      items: [
        { kind: 'button', label: 'Resume', primary: true, action: resume },
        ...retire,
        { kind: 'button', label: 'Restart Run', action: () => void this.startRun(true) },
        { kind: 'button', label: 'Controls', action: () => this.menu.push(this.controlsScreen()) },
        { kind: 'button', label: 'Settings', action: () => this.menu.push(this.settingsScreen()) },
        { kind: 'button', label: 'Exit to Menu', action: () => this.toMenu() },
      ],
    });
  }

  private showResults(stats: RunStats, won: boolean) {
    const id = stats.courseId ?? courseId(this.currentCourse());
    const { records, newBest } = applyRun(recordsFor(this.book, id), stats);
    this.book.courses[id] = records;
    saveRecordBook(this.book);
    const endless = !!this.session?.endless;
    this.mode = 'results';
    const nb = (k: string) => (newBest.includes(k) ? ' <em>NEW BEST</em>' : '');
    const row = (k: string, v: string) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`;
    const html = `<div class="stats">
      ${row('Course', `${courseLabel(this.world!.course)}`)}
      ${row('Course code', `<span class="code">${id}</span> · seed ${stats.seed ?? this.world!.seed}`)}
      ${row('Result', won ? 'Reached the resort' : stats.banked ? `Retired at refuge ${stats.checkpoints}` : endless ? `Caught after ${stats.checkpoints} refuge${stats.checkpoints === 1 ? '' : 's'}` : 'Caught by the Yeti')}
      ${row('Score', stats.score.toLocaleString('en-US') + nb('score'))}
      ${row('Time', fmtTime(stats.time) + (won ? nb('time') : ''))}
      ${row('Distance', fmtDistance(stats.distance) + nb('distance'))}
      ${row('Max speed', `${Math.round(stats.maxSpeed * 3.6)} km/h`)}
      ${row('Airtime', `${stats.airtime.toFixed(1)} s (longest ${stats.longestAir.toFixed(1)} s)`)}
      ${row('Major crashes', String(stats.crashes))}
      ${row('Survived the Yeti', `${stats.survival.toFixed(1)} s` + nb('survival'))}
      ${row('Personal best', `${records.bestScore.toLocaleString('en-US')} pts${records.bestTime !== null ? ' · ' + fmtTime(records.bestTime) : ''}`)}
    </div>`;
    this.menu.open({
      id: 'results',
      cls: won ? 'results win' : 'results lose',
      title: won ? 'YOU SURVIVED THE MOUNTAIN' : stats.banked ? 'RUN BANKED' : 'THE YETI WAS HUNGRY',
      items: [
        { kind: 'info', html },
        { kind: 'button', label: 'Retry', primary: true, action: () => void this.startRun(true) },
        { kind: 'button', label: 'Main Menu', action: () => this.toMenu() },
      ],
    });
  }

  private settingsScreen(): Screen {
    const s = this.settings;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const changed = () => this.saveAll();
    const items: MenuItem[] = [
      { kind: 'info', html: '<h3>Graphics</h3>' },
      {
        kind: 'select',
        label: 'Quality preset',
        note: 'applies on next run',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'ultra', label: 'Ultra' },
        ],
        get: () => this.pendingQuality ?? s.quality,
        set: (v) => {
          s.quality = v as QualityPreset;
          this.pendingQuality = s.quality;
          changed();
        },
      },
      { kind: 'slider', label: 'Render scale', min: 0.5, max: 1, step: 0.05, get: () => s.renderScale, set: (v) => ((s.renderScale = v), this.applyPixelRatio(), changed()), fmt: pct },
      { kind: 'toggle', label: 'Show performance stats', get: () => s.showFps, set: (v) => ((s.showFps = v), changed()) },
      { kind: 'toggle', label: 'Rear-view glance in the chase', get: () => s.rearView, set: (v) => ((s.rearView = v), changed()) },
      { kind: 'info', html: '<h3>Audio</h3>' },
      { kind: 'slider', label: 'Master volume', min: 0, max: 1, step: 0.05, get: () => s.masterVolume, set: (v) => ((s.masterVolume = v), changed()), fmt: pct },
      { kind: 'slider', label: 'Music', min: 0, max: 1, step: 0.05, get: () => s.musicVolume, set: (v) => ((s.musicVolume = v), changed()), fmt: pct },
      { kind: 'slider', label: 'Effects', min: 0, max: 1, step: 0.05, get: () => s.sfxVolume, set: (v) => ((s.sfxVolume = v), changed()), fmt: pct },
      { kind: 'info', html: '<h3>Camera & accessibility</h3>' },
      { kind: 'slider', label: 'Camera shake', min: 0, max: 1, step: 0.1, get: () => s.cameraShake, set: (v) => ((s.cameraShake = v), changed()), fmt: pct },
      { kind: 'toggle', label: 'Reduce camera motion', get: () => s.reduceCameraMotion, set: (v) => ((s.reduceCameraMotion = v), changed()) },
      { kind: 'toggle', label: 'Reduce flashes & pulsing', get: () => s.reduceFlashes, set: (v) => ((s.reduceFlashes = v), changed()) },
      { kind: 'slider', label: 'Interface text size', min: 0.85, max: 1.5, step: 0.05, get: () => s.uiScale, set: (v) => ((s.uiScale = v), changed()), fmt: pct },
      { kind: 'toggle', label: 'Sound captions', get: () => s.captions, set: (v) => ((s.captions = v), changed()) },
      { kind: 'toggle', label: 'Tutorial prompts', get: () => s.showTutorial, set: (v) => ((s.showTutorial = v), changed()) },
      { kind: 'button', label: 'Reset settings to defaults', action: () => {
        const keepQ = s.quality;
        Object.assign(s, loadSettings({ getItem: () => null, setItem: () => {} }));
        s.quality = keepQ;
        changed();
        this.applyPixelRatio();
        this.menu.refresh();
      } },
      { kind: 'button', label: 'Back', action: () => this.menu.pop() },
    ];
    return { id: 'settings', title: 'SETTINGS', items, onBack: () => this.menu.pop(), cls: 'wide' };
  }

  private controlsScreen(): Screen {
    const s = this.settings;
    const changed = () => this.saveAll();
    const actions: Action[] = ['left', 'right', 'tuck', 'brake', 'drift', 'pop', 'recover', 'lookback', 'pause'];
    const bindRows: MenuItem[] = actions.map((a) => ({
      kind: 'bind',
      label: ACTION_LABELS[a],
      get: () => s.bindings[a].map(keyName).join(' / '),
      listen: (done) => {
        const timer = setTimeout(() => {
          this.input.listenNextKey = null;
          done();
        }, 6000);
        this.menu.onCancelListen = () => {
          clearTimeout(timer);
          this.input.listenNextKey = null;
        };
        this.input.listenNextKey = (code) => {
          clearTimeout(timer);
          if (code !== 'Escape') {
            // the new key becomes the primary binding; it is removed from any other gameplay action
            for (const other of actions) if (other !== a) s.bindings[other] = s.bindings[other].filter((c) => c !== code);
            const rest = s.bindings[a].slice(1).filter((c) => c !== code);
            s.bindings[a] = [code, ...rest];
            // Escape always pauses, whatever else is bound
            if (!s.bindings.pause.includes('Escape')) s.bindings.pause.push('Escape');
            changed();
          }
          done();
        };
      },
    }));
    const tester: MenuItem = {
      kind: 'custom',
      render: (el) => {
        el.innerHTML = '<div class="pad-test"><div class="pad-name">No controller detected — press any button on your controller</div><div class="axes"></div><div class="btns"></div></div>';
      },
      update: (el) => {
        const snap = this.input.padSnapshot();
        const name = el.querySelector('.pad-name') as HTMLElement;
        const axes = el.querySelector('.axes') as HTMLElement;
        const btns = el.querySelector('.btns') as HTMLElement;
        if (!snap) {
          name.textContent = 'No controller detected — connect one and press any button';
          axes.innerHTML = '';
          btns.innerHTML = '';
          return;
        }
        name.textContent = `${this.input.activeDevice === 'playstation' ? 'PlayStation' : this.input.activeDevice === 'xbox' ? 'Xbox' : 'Controller'}: ${snap.id.slice(0, 60)}`;
        axes.innerHTML = snap.axes.slice(0, 4).map((v, i) => `<span class="axis"><i style="left:${((v + 1) * 50).toFixed(0)}%"></i><b>${['LX', 'LY', 'RX', 'RY'][i]}</b></span>`).join('');
        btns.innerHTML = snap.buttons.slice(0, 16).map((v, i) => `<span class="b ${v > 0.1 ? 'on' : ''}" style="--v:${v.toFixed(2)}">${i}</span>`).join('');
      },
    };
    const items: MenuItem[] = [
      { kind: 'info', html: `<div class="controls-grid">
        <div><h3>Keyboard</h3>
        <p><kbd>A</kbd>/<kbd>←</kbd> <kbd>D</kbd>/<kbd>→</kbd> steer · <kbd>W</kbd>/<kbd>↑</kbd> french fry (tuck) · <kbd>S</kbd>/<kbd>↓</kbd> pizza (brake)</p>
        <p><kbd>Shift</kbd> drift · <kbd>Space</kbd> hold &amp; release to pop · <kbd>R</kbd> recover · <kbd>C</kbd> look back · <kbd>Esc</kbd> pause · mouse drag: look around</p></div>
        <div><h3>Controller</h3>
        <p>Left stick steer · Right stick camera · <kbd>RT</kbd>/<kbd>R2</kbd> tuck · <kbd>LT</kbd>/<kbd>L2</kbd> brake (analog)</p>
        <p><kbd>RB</kbd>/<kbd>R1</kbd> drift · <kbd>A</kbd>/<kbd>✕</kbd> pop · <kbd>Y</kbd>/<kbd>△</kbd> recover · <kbd>B</kbd>/<kbd>○</kbd> look back · <kbd>Start</kbd>/<kbd>Options</kbd> pause</p></div>
      </div>` },
      { kind: 'info', html: '<h3>Remap keyboard</h3><p class="menu-note">Select an action and press the new key (Esc / controller B cancels). Controller buttons use the standard layout above.</p>' },
      ...bindRows,
      { kind: 'button', label: 'Restore default keys', action: () => ((s.bindings = structuredClone(DEFAULT_BINDINGS)), changed(), this.menu.refresh()) },
      { kind: 'info', html: '<h3>Controller & steering</h3>' },
      { kind: 'slider', label: 'Stick dead zone', min: 0.02, max: 0.4, step: 0.01, get: () => s.deadzone, set: (v) => ((s.deadzone = v), changed()), fmt: (v) => v.toFixed(2) },
      { kind: 'slider', label: 'Steering sensitivity', min: 0.5, max: 1.6, step: 0.05, get: () => s.steerSensitivity, set: (v) => ((s.steerSensitivity = v), changed()), fmt: (v) => `${v.toFixed(2)}×` },
      { kind: 'slider', label: 'Camera sensitivity', min: 0.3, max: 2, step: 0.1, get: () => s.cameraSensitivity, set: (v) => ((s.cameraSensitivity = v), changed()), fmt: (v) => `${v.toFixed(1)}×` },
      { kind: 'toggle', label: 'Invert camera X', get: () => s.invertCameraX, set: (v) => ((s.invertCameraX = v), changed()) },
      { kind: 'toggle', label: 'Invert camera Y', get: () => s.invertCameraY, set: (v) => ((s.invertCameraY = v), changed()) },
      tester,
      { kind: 'button', label: 'Back', action: () => this.menu.pop() },
    ];
    return { id: 'controls', title: 'CONTROLS', items, onBack: () => this.menu.pop(), cls: 'wide' };
  }

  private creditsScreen(): Screen {
    return {
      id: 'credits',
      title: 'CREDITS',
      cls: 'wide',
      onBack: () => this.menu.pop(),
      items: [
        { kind: 'info', html: `<p>An original reimagining inspired by the 1991 game <i>SkiFree</i> by Chris Pirih. No assets from the original are used.</p>
        <p>Everything you see and hear — the mountain, skier, Yeti, resort, guests, music and sound — is generated procedurally at runtime in code written for this project.</p>
        <p>Built with <b>three.js</b> (MIT) and <b>Vite</b> (MIT). See <code>docs/ASSETS_AND_LICENSES.md</code>.</p>` },
        { kind: 'button', label: 'Back', action: () => this.menu.pop() },
      ],
    };
  }

  // --- loop ----------------------------------------------------------------------
  private loop = () => {
    requestAnimationFrame(this.loop);
    if (this.contextLost) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.input.poll();
    this.updateAudioHint();
    try {
      this.frame(dt);
      this.errorStreak = 0;
    } catch (err) {
      this.errorStreak++;
      if (this.errorStreak <= 3) console.error(err);
      if (this.errorStreak === 60) this.showFatal(`Something went wrong and the game stopped responding (${String(err)}). Reload the page to continue.`);
    }
    this.trackPerf(dt, performance.now() - now);
  };

  private frame(dt: number) {
    const w = this.world;
    if (!w) return;
    if (this.mode === 'menu' || this.mode === 'loading') {
      this.menuTime += dt;
      this.menu.update(this.input.menu(dt));
      // living mountain: slow crane around the summit
      const cx = w.mountain.routeX(0);
      const cy = w.mountain.heightAt(cx, 0);
      const a = this.menuTime * 0.04 + 2.4;
      this.camera.position.set(cx + Math.sin(a) * 26, cy + 6 + Math.sin(this.menuTime * 0.1) * 1.5, Math.cos(a) * 26 + 4);
      this.camera.lookAt(cx + 4, cy + 1.5, 60);
      this.camera.fov = 55;
      this.camera.updateProjectionMatrix();
      this.skier?.update(dt, { steer: 0, lean: 0, tuck: 0, pizza: 0.25, drift: 0, driftAngle: 0, crouch: 0, airborne: false, airTime: 0, landImpact: 0, crashed: false, crashTime: 0, recover: 0, speed: 0, lookBack: 0, celebrate: 0, wobble: 0, time: this.menuTime });
      w.update(dt, this.menuTime, this.skier?.root.position ?? this.camera.position, this.camera.position, 4);
      // the resort is 3 km away from the menu view: don't animate it
      this.audio.update(dt, { listenerPos: this.camera.position, listenerForward: new THREE.Vector3(0, 0, 1), speed: 0, grounded: true, edgeLoad: 0, brake: 0, drifting: false, surface: 'snow', crashed: false, yetiPos: null, yetiDistance: null, yetiRunning: false, chaseIntensity: 0, crowdLevel: 0, eerie: 0 });
    } else if (this.session && this.hold) {
      // debug: simulation held (captures)
    } else if (this.session) {
      if (this.mode === 'paused' || this.mode === 'results') this.menu.update(this.input.menu(dt));
      if (this.mode === 'results') {
        // keep the ending alive behind the results panel (without consuming menu input)
        this.session.frame(dt, NEUTRAL_INPUT, this.input.activeDevice);
      } else if (this.mode === 'playing') this.session.frame(dt, this.input.gameplay(dt), this.input.activeDevice);
      // only animate the resort (guests, steam, flames) when the camera is anywhere near it
      if (w.resort && Math.abs(this.camera.position.z - w.resort.finishZ) < 900) w.resort.update(dt, performance.now() / 1000, this.session.resortState);
    }
    if (this.freeCam) {
      this.camera.position.copy(this.freeCam.pos);
      this.camera.lookAt(this.freeCam.look);
      this.camera.fov = this.freeCam.fov;
      this.camera.updateProjectionMatrix();
    }
    if (this.yetiRim) this.yetiRim.intensity = this.session && this.session.run.yetiReleased ? 6 : 0;
    if (this.mode === 'menu' || this.mode === 'loading') w.updateOrigin(this.camera.position);
    w.renderShifted([this.camera, this.rearCam], () => {
      this.renderer.render(w.scene, this.camera);
      this.renderRearView();
    });
  }

  private yetiRim: THREE.PointLight | null = null;
  private rearCam = new THREE.PerspectiveCamera(48, 2.4, 0.2, 2500);
  private rearPose = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  private rearFrame: HTMLDivElement | null = null;
  /** A small "glance back" window during the chase so the threat is visible, not just a HUD bar. */
  private renderRearView() {
    const s = this.session;
    const k = s && this.mode === 'playing' && this.settings.rearView && this.world?.quality !== 'low' && !s.isCinematic() ? s.rearView(this.rearPose) : 0;
    if (!this.rearFrame) {
      this.rearFrame = document.createElement('div');
      this.rearFrame.className = 'rear-view';
      document.body.appendChild(this.rearFrame);
    }
    this.rearFrame.style.opacity = String(k);
    if (k <= 0.02 || !this.world) return;
    const W = innerWidth;
    const H = innerHeight;
    const w = Math.round(Math.min(420, W * 0.3));
    const h = Math.round(w / 2.4);
    const x = Math.round((W - w) / 2);
    const top = 78;
    this.rearFrame.style.cssText = `left:${x}px;top:${top}px;width:${w}px;height:${h}px;opacity:${k}`;
    this.rearCam.position.copy(this.rearPose.pos);
    this.rearCam.lookAt(this.rearPose.look);
    this.rearCam.aspect = w / h;
    this.rearCam.updateProjectionMatrix();
    const r = this.renderer;
    const auto = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false; // reuse this frame's shadow map
    r.setScissorTest(true);
    r.setViewport(x, H - top - h, w, h);
    r.setScissor(x, H - top - h, w, h);
    r.autoClear = false;
    r.clearDepth();
    r.render(this.world.scene, this.rearCam);
    r.autoClear = true;
    r.setScissorTest(false);
    r.setViewport(0, 0, W, H);
    r.shadowMap.autoUpdate = auto;
  }

  private freeCam: { pos: THREE.Vector3; look: THREE.Vector3; fov: number } | null = null;
  private hold = false;

  private audioHint: HTMLDivElement | null = null;
  private updateAudioHint() {
    const need = !this.audio.ready && this.input.activeDevice !== 'keyboard';
    if (need && !this.audioHint) {
      this.audioHint = document.createElement('div');
      this.audioHint.className = 'audio-hint';
      this.audioHint.textContent = 'Press any key or click once to enable sound (browsers block audio until then).';
      this.ui.appendChild(this.audioHint);
    }
    this.audioHint?.classList.toggle('hidden', !need);
  }

  private trackPerf(dt: number, frameMs: number) {
    const p = this.perf;
    p.frames++;
    p.acc += dt;
    p.worst = Math.max(p.worst, dt * 1000);
    p.samples.push(dt * 1000);
    if (p.samples.length > 600) p.samples.shift();
    if (p.acc >= 0.5) {
      p.fps = p.frames / p.acc;
      p.frameMs = frameMs;
      if (this.settings.showFps) {
        const i = this.renderer.info;
        const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        this.hud.setFps(`${p.fps.toFixed(0)} fps · cpu ${frameMs.toFixed(1)} ms · worst ${p.worst.toFixed(0)} ms · ${i.render.calls} draws · ${(i.render.triangles / 1000).toFixed(0)}k tris · geo ${i.memory.geometries} · tex ${i.memory.textures}${mem ? ` · heap ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : ''}`);
      }
      p.frames = 0;
      p.acc = 0;
      p.worst = 0;
    }
  }

  private showFatal(msg: string) {
    const d = document.createElement('div');
    d.className = 'fatal';
    d.textContent = msg;
    this.ui.appendChild(d);
  }

  // --- debug harness (only with ?debug in the URL; never shown in the UI) ---------
  private installDebug() {
    const api = {
      state: () => ({ mode: this.mode, menu: this.menu.current?.id ?? null, session: this.session?.debugState() ?? null, records: this.records, course: this.world ? { id: this.world.id, label: courseLabel(this.world.course), seed: this.world.seed, finishZ: this.world.mountain.finishZ } : null }),
      /** select a course like the menu does (persists to settings), e.g. setCourse('daily','sprint',{date}) */
      setCourse: (mode: CourseMode, length: LengthMode, opts: { date?: string | null; custom?: string } = {}) => {
        this.settings.course = mode;
        this.settings.courseLength = length;
        if (opts.date !== undefined) this.settings.dailyDate = opts.date;
        if (opts.custom) this.settings.customSeed = opts.custom;
        this.saveAll();
        if (this.mode === 'menu') this.menu.replace(this.mainScreen());
        return courseId(this.currentCourse());
      },
      currentCourse: () => ({ ...this.currentCourse(), id: courseId(this.currentCourse()) }),
      toChase: () => this.session?.debugToChase(),
      retire: () => this.session?.retire(),
      menuFocus: (label: string) => this.menu.focusLabel(label),
      menuFocusIndex: () => this.menu.focusIndex,
      perf: () => {
        const s = [...this.perf.samples].sort((a, b) => a - b);
        const i = this.renderer.info;
        return { fps: this.perf.fps, p50: s[Math.floor(s.length * 0.5)] ?? 0, p95: s[Math.floor(s.length * 0.95)] ?? 0, calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, particles: this.world?.particles.aliveCount ?? 0, terrainPending: this.world?.terrain.pending ?? 0 };
      },
      startRun: (skipIntro = true) => this.startRun(skipIntro),
      toMenu: () => this.toMenu(),
      teleport: (z: number, speed = 18) => this.session?.debugTeleport(z, speed),
      toCave: () => {
        const e = this.session?.run.encounter;
        if (e) this.session?.debugTeleport(e.triggerZ - 12, 16);
      },
      advance: (sec: number) => this.session?.debugAdvance(sec),
      autopilot: (style: AutopilotStyle | null) => {
        if (this.session) this.session.autopilot = style;
      },
      placeYeti: (gap: number) => this.session?.debugPlaceYeti(gap),
      seenCave: (v: boolean) => {
        this.book.seenCaveCinematic = v;
        if (this.session) this.session.recordsSeenCave = v;
      },
      pause: () => this.pause(),
      menuId: () => this.menu.current?.id ?? null,
      pressMenu: (label: string) => {
        const it = this.menu.current?.items.find((i) => i.kind === 'button' && i.label === label);
        if (it && it.kind === 'button') it.action();
        return !!it;
      },
      setInputPads: (fn: () => ReadonlyArray<unknown>) => {
        this.input.padSource = fn as never;
      },
      input: this.input,
      frames: (n: number, dt = 1 / 30) => this.session?.debugFrames(n, dt),
      hold: (v: boolean) => {
        this.hold = v;
      },
      freeCam: (pos: number[] | null, look?: number[], fov = 50) => {
        this.freeCam = pos && look ? { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look), fov } : null;
      },
      breakdown: () => {
        const out: Record<string, { meshes: number; tris: number }> = {};
        const w = this.world;
        if (!w) return out;
        const groups: Record<string, THREE.Object3D> = { terrain: w.terrain.group, vegetation: w.vegetation.group, cave: w.cave.group, start: w.start.group, skier: this.skier!.root, yeti: this.yeti!.root };
        if (w.resort) groups['resort'] = w.resort.group;
        for (const [k, g] of Object.entries(groups)) {
          const r = { meshes: 0, tris: 0 };
          g.traverseVisible((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            const geo = m.geometry;
            const n = geo.index ? geo.index.count : (geo.getAttribute('position')?.count ?? 0);
            const inst = (m as unknown as THREE.InstancedMesh).isInstancedMesh ? (m as unknown as THREE.InstancedMesh).count : 1;
            r.meshes++;
            r.tris += (n / 3) * inst;
          });
          out[k] = r;
        }
        return out;
      },
      world: () => this.world,
      renderer: this.renderer,
      camera: this.camera,
      cameraPose: () => ({ pos: this.camera.position.toArray(), fov: this.camera.fov }),
    };
    (window as unknown as { __skifree: typeof api }).__skifree = api;
  }
}

export function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
