/** In-game HUD (DOM overlay): speed, distance, score, airtime, Yeti proximity, prompts, cinematics. */
import { glyph, type Action, type Device } from '../input/Input';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
}

export interface HudFrame {
  speedKmh: number;
  distanceToFinish: number;
  score: number;
  multiplier: number;
  yetiDistance: number | null;
  chase: boolean;
  crashed: boolean;
  canRecover: boolean;
  airTime: number;
  progress: number; // 0..1 along the course
  caveProgress: number;
}

export class Hud {
  readonly root: HTMLDivElement;
  private speed: HTMLDivElement;
  private speedUnit: HTMLDivElement;
  private dist: HTMLDivElement;
  private score: HTMLDivElement;
  private mult: HTMLDivElement;
  private yetiWrap: HTMLDivElement;
  private yetiBar: HTMLDivElement;
  private yetiLabel: HTMLDivElement;
  private prompt: HTMLDivElement;
  private trick: HTMLDivElement;
  private air: HTMLDivElement;
  private center: HTMLDivElement;
  private sub: HTMLDivElement;
  private letterTop: HTMLDivElement;
  private letterBot: HTMLDivElement;
  private danger: HTMLDivElement;
  private skipHint: HTMLDivElement;
  private progressFill: HTMLDivElement;
  private progressYeti: HTMLDivElement;
  private progressCave: HTMLDivElement;
  private fps: HTMLDivElement;
  private cap: HTMLDivElement;
  private trickTimer = 0;
  private centerTimer = 0;
  private promptKey = '';
  device: Device = 'keyboard';
  bindings: Record<Action, string[]>;
  reduceFlashes = false;

  constructor(parent: HTMLElement, bindings: Record<Action, string[]>) {
    this.bindings = bindings;
    this.root = el('div', 'hud hidden', parent);
    el('div', 'hud-vignette', this.root);
    this.danger = el('div', 'hud-danger', this.root);
    this.letterTop = el('div', 'letterbox top', this.root);
    this.letterBot = el('div', 'letterbox bottom', this.root);

    const tl = el('div', 'hud-tl', this.root);
    this.score = el('div', 'hud-score', tl, '0');
    this.mult = el('div', 'hud-mult', tl, '×1.0');

    const tr = el('div', 'hud-tr', this.root);
    el('div', 'hud-label', tr, 'TO FINISH');
    this.dist = el('div', 'hud-dist', tr, '3000 m');
    const prog = el('div', 'hud-progress', tr);
    this.progressFill = el('div', 'fill', prog);
    this.progressCave = el('div', 'cave-mark', prog);
    this.progressYeti = el('div', 'yeti-mark', prog);

    const br = el('div', 'hud-br', this.root);
    this.speed = el('div', 'hud-speed', br, '0');
    this.speedUnit = el('div', 'hud-speed-unit', br, 'KM/H');

    this.yetiWrap = el('div', 'hud-yeti hidden', this.root);
    this.yetiLabel = el('div', 'hud-yeti-label', this.yetiWrap, 'YETI');
    const bar = el('div', 'hud-yeti-bar', this.yetiWrap);
    this.yetiBar = el('div', 'fill', bar);

    this.air = el('div', 'hud-air', this.root);
    this.trick = el('div', 'hud-trick', this.root);
    this.prompt = el('div', 'hud-prompt', this.root);
    this.center = el('div', 'hud-center', this.root);
    this.sub = el('div', 'hud-sub', this.root);
    this.skipHint = el('div', 'hud-skip hidden', this.root);
    this.fps = el('div', 'hud-fps hidden', this.root);
    this.cap = el('div', 'hud-caption', this.root);
  }

  show(v: boolean) {
    this.root.classList.toggle('hidden', !v);
  }

  /** Hide the gameplay widgets (cinematics) but keep overlays. */
  gameplayWidgets(v: boolean) {
    this.root.classList.toggle('cine', !v);
  }

  letterbox(on: boolean) {
    this.letterTop.classList.toggle('on', on);
    this.letterBot.classList.toggle('on', on);
  }

  setSkipHint(text: string | null) {
    this.skipHint.classList.toggle('hidden', !text);
    if (text) this.skipHint.textContent = text;
  }

  g(a: Action): string {
    return `<kbd>${glyph(this.device, a, this.bindings)}</kbd>`;
  }

  /** Context prompt (tutorial / recover). Pass null to clear. */
  setPrompt(key: string | null, html = '') {
    if (key === this.promptKey) return;
    this.promptKey = key ?? '';
    this.prompt.innerHTML = html;
    this.prompt.classList.toggle('on', !!key);
  }

  refreshPrompt(html: string) {
    this.prompt.innerHTML = html;
  }

  get currentPrompt() {
    return this.promptKey;
  }

  popTrick(text: string, points: number) {
    this.trick.innerHTML = `<span>${text}</span><b>+${points}</b>`;
    this.trick.classList.remove('pop');
    void this.trick.offsetWidth;
    this.trick.classList.add('pop');
    this.trickTimer = 1.8;
  }

  /** Big centred title (e.g. RUN., YOU SURVIVED THE MOUNTAIN). */
  title(text: string, sub = '', cls = '', duration = 2.5) {
    this.center.className = `hud-center on ${cls}`;
    this.center.textContent = text;
    this.sub.className = `hud-sub ${sub ? 'on' : ''} ${cls}`;
    this.sub.textContent = sub;
    this.centerTimer = duration;
  }

  clearTitle() {
    this.centerTimer = 0;
    this.center.classList.remove('on');
    this.sub.classList.remove('on');
  }

  captionsOn = true;
  private capTimer = 0;
  /** Closed caption for important non-speech sounds. */
  caption(text: string, seconds = 2.2) {
    if (!this.captionsOn) return;
    this.cap.textContent = text;
    this.cap.classList.add('on');
    this.capTimer = seconds;
  }

  showFps(on: boolean) {
    this.fps.classList.toggle('hidden', !on);
  }

  setFps(text: string) {
    this.fps.textContent = text;
  }

  update(dt: number, f: HudFrame) {
    this.speed.textContent = String(Math.round(f.speedKmh));
    this.speed.classList.toggle('fast', f.speedKmh > 90);
    this.speedUnit.textContent = 'KM/H';
    this.dist.textContent = `${Math.max(0, Math.round(f.distanceToFinish))} m`;
    this.score.textContent = Math.round(f.score).toLocaleString('en-US');
    this.mult.textContent = `×${f.multiplier.toFixed(1)}`;
    this.mult.classList.toggle('hot', f.multiplier >= 2);
    this.progressFill.style.width = `${(f.progress * 100).toFixed(1)}%`;
    this.progressCave.style.left = `${(f.caveProgress * 100).toFixed(1)}%`;
    if (f.airTime > 0.35) {
      this.air.textContent = `AIR ${f.airTime.toFixed(1)}s`;
      this.air.classList.add('on');
    } else this.air.classList.remove('on');

    const chase = f.chase && f.yetiDistance !== null;
    this.yetiWrap.classList.toggle('hidden', !chase);
    this.progressYeti.classList.toggle('hidden', !chase);
    if (chase && f.yetiDistance !== null) {
      const d = f.yetiDistance;
      const threat = Math.max(0, Math.min(1, 1 - (d - 3) / 120));
      this.yetiBar.style.width = `${(threat * 100).toFixed(1)}%`;
      this.yetiLabel.textContent = d < 25 ? `YETI  ${Math.round(d)} m  — MOVE!` : `YETI  ${Math.round(d)} m`;
      this.yetiWrap.classList.toggle('near', d < 40);
      const pulse = this.reduceFlashes ? 0.55 : 0.5 + 0.5 * Math.sin(performance.now() / (d < 25 ? 90 : 160));
      this.danger.style.opacity = String(Math.max(0, threat - 0.55) * 2.0 * (0.6 + 0.4 * pulse));
      const yetiProg = Math.max(0, Math.min(1, f.progress - d / 3000));
      this.progressYeti.style.left = `${(yetiProg * 100).toFixed(1)}%`;
    } else this.danger.style.opacity = '0';

    if (this.trickTimer > 0) {
      this.trickTimer -= dt;
      if (this.trickTimer <= 0) this.trick.classList.remove('pop');
    }
    if (this.capTimer > 0) {
      this.capTimer -= dt;
      if (this.capTimer <= 0) this.cap.classList.remove('on');
    }
    if (this.centerTimer > 0) {
      this.centerTimer -= dt;
      if (this.centerTimer <= 0) this.clearTitle();
    }
  }

  reset() {
    this.clearTitle();
    this.setPrompt(null);
    this.letterbox(false);
    this.gameplayWidgets(true);
    this.setSkipHint(null);
    this.trick.classList.remove('pop');
    this.danger.style.opacity = '0';
  }
}
