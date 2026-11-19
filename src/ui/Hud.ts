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
  /** where the (next) cave sits on the progress bar, or null when there is none to show */
  caveProgress: number | null;
  /** Endless: no finish — show the distance travelled and the next refuge instead */
  endless?: boolean;
  distance?: number;
  nextRefuge?: number | null;
}

/** 640 m · 8.4 km · 48 km */
export function fmtDistance(m: number): string {
  const v = Math.max(0, m);
  if (Math.round(v) < 1000) return `${Math.round(v)} m`;
  if (v < 20000) return `${(v / 1000).toFixed(1)} km`;
  return `${Math.round(v / 1000)} km`;
}

export class Hud {
  readonly root: HTMLDivElement;
  private speed: HTMLDivElement;
  private speedUnit: HTMLDivElement;
  private dist: HTMLDivElement;
  private distLabel!: HTMLDivElement;
  private distSub!: HTMLDivElement;
  private prog!: HTMLDivElement;
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
    this.distLabel = el('div', 'hud-label', tr, 'TO FINISH');
    this.dist = el('div', 'hud-dist', tr, '');
    this.distSub = el('div', 'hud-label hud-dist-sub', tr, '');
    const prog = el('div', 'hud-progress', tr);
    this.prog = prog;
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

    this.weatherPill = el('div', 'hud-weather hidden', this.root);
    this.air = el('div', 'hud-air', this.root);
    this.trick = el('div', 'hud-trick', this.root);
    this.prompt = el('div', 'hud-prompt', this.root);
    this.center = el('div', 'hud-center', this.root);
    this.sub = el('div', 'hud-sub', this.root);
    this.skipHint = el('div', 'hud-skip hidden', this.root);
    this.fps = el('div', 'hud-fps hidden', this.root);
    this.cap = el('div', 'hud-caption', this.root);
    this.capHard = el('div', 'cap-line cap-hard', this.cap);
    this.capSoft = el('div', 'cap-line cap-soft', this.cap);
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

  private weatherPill: HTMLElement;
  private weatherText = '';
  /**
   * The storm-front forecast (Whiteout): a pill under the score with the wind's direction (an arrow
   * pointing the way it blows) — e.g. "STORM IN 6 s ←", "STORM ←", "CLEARING". null hides it.
   */
  setWeather(text: string | null, level: 'warn' | 'storm' | 'calm' = 'calm') {
    const t = text ?? '';
    if (t === this.weatherText) return;
    this.weatherText = t;
    this.weatherPill.classList.toggle('hidden', !text);
    this.weatherPill.classList.toggle('warn', level === 'warn');
    this.weatherPill.classList.toggle('storm', level === 'storm');
    this.weatherPill.textContent = t;
  }

  /** the weather pill's text (tests) */
  get weatherPillText(): string | null {
    return this.weatherText || null;
  }

  setSkipHint(text: string | null) {
    this.skipHint.classList.toggle('hidden', !text);
    if (text) this.skipHint.innerHTML = text; // text carries <kbd> glyph markup from g()
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
    this.trick.innerHTML = points ? `<span>${text}</span><b>+${points}</b>` : `<span>${text}</span>`;
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
  /**
   * Captions (W-046/W-047, round 2): two lines in one box, so a location warning is never lost
   * behind the Yeti's cues and the Yeti's cues are never hidden by one —
   *  - the hard line: the Yeti and the run's own moments (footsteps, howls, roars). A caption with
   *    the same text already on screen is only extended (the footsteps, re-sent each frame);
   *  - the soft line: location sounds (squalls, blizzards, fronts, drifts, rock). A higher priority
   *    replaces a lower one on screen; one that cannot show yet waits in a queue (highest priority
   *    first, then oldest) until the line is free, unless it goes stale (`ttl`, s) first — a
   *    blizzard warning for a cell already behind the skier is no use.
   * Duration follows reading time: at least 1 s + 15 characters a second (capped at 8 s).
   */
  private capHard: HTMLDivElement;
  private capSoft: HTMLDivElement;
  private hardTimer = 0;
  private softTimer = 0;
  private softPriority = 0;
  private softQueue: Array<{ text: string; seconds: number; priority: number; ttl: number; n: number }> = [];
  private softN = 0;
  /** shown seconds for a caption of this text: never shorter than it takes to read */
  static readSeconds(text: string, seconds: number): number {
    return Math.min(8, Math.max(seconds, 1 + text.length / 15));
  }
  /**
   * Closed caption for important non-speech sounds. `soft`: a location sound (the soft line);
   * `queue` (default true for soft captions with priority ≥ 2, the warnings): wait for the line
   * instead of being dropped, for up to `ttl` s. Returns whether it was shown or queued.
   */
  caption(text: string, seconds = 2.2, opts: { soft?: boolean; priority?: number; queue?: boolean; ttl?: number } = {}): boolean {
    if (!this.captionsOn) return false;
    const secs = Hud.readSeconds(text, seconds);
    if (!opts.soft) {
      if (this.hardTimer > 0 && this.capHard.textContent === text) {
        this.hardTimer = Math.max(this.hardTimer, secs);
        return true;
      }
      this.capHard.textContent = text;
      this.capHard.classList.add('on');
      this.hardTimer = secs;
      this.refreshCaption();
      return true;
    }
    const pr = opts.priority ?? 0;
    if (this.softTimer > 0 && pr <= this.softPriority) {
      if (opts.queue ?? pr >= 2) {
        this.softQueue.push({ text, seconds: secs, priority: pr, ttl: opts.ttl ?? 4, n: this.softN++ });
        return true;
      }
      return false;
    }
    this.showSoft(text, secs, pr);
    return true;
  }

  private showSoft(text: string, secs: number, pr: number) {
    this.capSoft.textContent = text;
    this.capSoft.classList.add('on');
    this.cap.classList.remove('hint');
    this.softTimer = secs;
    this.softPriority = pr;
    this.refreshCaption();
  }

  private refreshCaption() {
    const on = this.hardTimer > 0 || this.softTimer > 0;
    this.cap.classList.toggle('on', on);
    if (!on) this.cap.classList.remove('hint');
  }

  /** captions waiting for the soft line (tests) */
  get captionQueue(): readonly string[] {
    return [...this.softQueue].sort((a, b) => b.priority - a.priority || a.n - b.n).map((q) => q.text);
  }

  /**
   * A one-time control hint in the caption line (not a sound caption, so it shows with captions
   * off). Never replaces a caption on screen; returns whether it was shown.
   */
  hint(text: string, seconds = 5): boolean {
    if (this.hardTimer > 0 || this.softTimer > 0) return false;
    this.capSoft.textContent = text;
    this.capSoft.classList.add('on');
    this.cap.classList.add('on', 'hint');
    this.softTimer = seconds;
    this.softPriority = 1;
    return true;
  }

  /** the caption(s) on screen (tests): the hard line, then the soft line */
  get captionText(): string | null {
    const parts: string[] = [];
    if (this.hardTimer > 0) parts.push(this.capHard.textContent ?? '');
    if (this.softTimer > 0) parts.push(this.capSoft.textContent ?? '');
    return parts.length ? parts.join('\n') : null;
  }

  /**
   * Take back a soft caption that no longer holds (round 3, R2 A N8: "a storm front rolls in" stayed
   * up into the clearing): drops it from the queue, and ends it if it is on screen.
   */
  withdrawCaption(match: (text: string) => boolean) {
    for (let i = this.softQueue.length - 1; i >= 0; i--) if (match(this.softQueue[i]!.text)) this.softQueue.splice(i, 1);
    if (this.softTimer > 0 && match(this.capSoft.textContent ?? '')) {
      this.softTimer = 0;
      this.softPriority = 0;
      this.capSoft.classList.remove('on');
      this.refreshCaption();
    }
  }

  clearCaption() {
    this.hardTimer = 0;
    this.softTimer = 0;
    this.softPriority = 0;
    this.softQueue.length = 0;
    this.capHard.classList.remove('on');
    this.capSoft.classList.remove('on');
    this.cap.classList.remove('on', 'hint');
  }

  /** advance the caption timers and the queue (from update; separate for tests) */
  tickCaptions(dt: number) {
    if (this.hardTimer > 0) {
      this.hardTimer -= dt;
      if (this.hardTimer <= 0) this.capHard.classList.remove('on');
    }
    for (const q of this.softQueue) q.ttl -= dt;
    if (this.softTimer > 0) {
      this.softTimer -= dt;
      if (this.softTimer <= 0) {
        this.capSoft.classList.remove('on');
        this.cap.classList.remove('hint');
        this.softPriority = 0;
      }
    }
    if (this.softTimer <= 0) {
      this.softQueue = this.softQueue.filter((q) => q.ttl > 0);
      if (this.softQueue.length && this.captionsOn) {
        this.softQueue.sort((a, b) => b.priority - a.priority || a.n - b.n);
        const q = this.softQueue.shift()!;
        this.showSoft(q.text, q.seconds, q.priority);
      }
    }
    this.refreshCaption();
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
    if (f.endless) {
      this.distLabel.textContent = 'DISTANCE';
      this.dist.textContent = fmtDistance(f.distance ?? 0);
      this.distSub.textContent = f.nextRefuge != null && f.nextRefuge > 0 ? `REFUGE IN ${fmtDistance(f.nextRefuge)}` : '';
    } else {
      this.distLabel.textContent = 'TO FINISH';
      this.dist.textContent = fmtDistance(f.distanceToFinish);
      this.distSub.textContent = '';
    }
    this.prog.classList.toggle('hidden', !!f.endless);
    this.score.textContent = Math.round(f.score).toLocaleString('en-US');
    this.mult.textContent = `×${f.multiplier.toFixed(1)}`;
    this.mult.classList.toggle('hot', f.multiplier >= 2);
    this.progressFill.style.width = `${(f.progress * 100).toFixed(1)}%`;
    this.progressCave.classList.toggle('hidden', f.caveProgress === null);
    if (f.caveProgress !== null) this.progressCave.style.left = `${(f.caveProgress * 100).toFixed(1)}%`;
    if (f.airTime > 0.35) {
      this.air.textContent = `AIR ${f.airTime.toFixed(1)}s`;
      this.air.classList.add('on');
    } else this.air.classList.remove('on');

    const chase = f.chase && f.yetiDistance !== null;
    this.yetiWrap.classList.toggle('hidden', !chase);
    this.progressYeti.classList.toggle('hidden', !chase);
    // (a chase's first frame, before the Yeti's first update, has no distance yet: W-076 review)
    if (chase && f.yetiDistance !== null && Number.isFinite(f.yetiDistance)) {
      const d = f.yetiDistance;
      const threat = Math.max(0, Math.min(1, 1 - (d - 3) / 120));
      this.yetiBar.style.width = `${(threat * 100).toFixed(1)}%`;
      this.yetiLabel.textContent = d < 25 ? `YETI  ${Math.round(d)} m  — MOVE!` : `YETI  ${Math.round(d)} m`;
      this.yetiWrap.classList.toggle('near', d < 40);
      const pulse = this.reduceFlashes ? 0.55 : 0.5 + 0.5 * Math.sin(performance.now() / (d < 25 ? 90 : 160));
      this.danger.style.opacity = String(Math.max(0, threat - 0.55) * 2.0 * (0.6 + 0.4 * pulse));
      const total = f.progress > 0 ? (f.distance ?? 0) / f.progress : 3000;
      const yetiProg = Math.max(0, Math.min(1, f.progress - d / Math.max(1, total)));
      this.progressYeti.style.left = `${(yetiProg * 100).toFixed(1)}%`;
    } else this.danger.style.opacity = '0';

    if (this.trickTimer > 0) {
      this.trickTimer -= dt;
      if (this.trickTimer <= 0) this.trick.classList.remove('pop');
    }
    this.tickCaptions(dt);
    if (this.centerTimer > 0) {
      this.centerTimer -= dt;
      if (this.centerTimer <= 0) this.clearTitle();
    }
  }

  reset() {
    this.clearCaption();
    this.clearTitle();
    this.setPrompt(null);
    this.letterbox(false);
    this.gameplayWidgets(true);
    this.setSkipHint(null);
    this.trick.classList.remove('pop');
    this.danger.style.opacity = '0';
  }
}
