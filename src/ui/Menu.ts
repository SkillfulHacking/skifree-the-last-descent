/**
 * Data-driven menu screens, navigable by keyboard, gamepad (D-pad/stick + A/B) and mouse.
 */
import type { MenuInput } from '../input/Input';

export type MenuItem =
  | { kind: 'button'; label: string; action: () => void; hint?: string; primary?: boolean }
  | { kind: 'slider'; label: string; get: () => number; set: (v: number) => void; min: number; max: number; step: number; fmt?: (v: number) => string }
  | { kind: 'toggle'; label: string; get: () => boolean; set: (v: boolean) => void }
  | { kind: 'select'; label: string; options: Array<{ value: string; label: string }>; get: () => string; set: (v: string) => void; note?: string }
  | { kind: 'bind'; label: string; get: () => string; listen: (done: () => void) => void }
  | { kind: 'text'; label: string; get: () => string; set: (v: string) => void; placeholder?: string; maxLength?: number; note?: string }
  | { kind: 'info'; html: string }
  | { kind: 'custom'; render: (el: HTMLElement) => void; update?: (el: HTMLElement) => void };

export interface Screen {
  id: string;
  title: string;
  subtitle?: string;
  /** large title rendered outside the panel (main menu hero) — never clipped by the panel */
  hero?: { title: string; tagline: string };
  /** footer note under the panel */
  aside?: string;
  items: MenuItem[];
  onBack?: () => void;
  cls?: string;
}

export class MenuSystem {
  readonly root: HTMLDivElement;
  private panel: HTMLDivElement;
  private hero: HTMLDivElement;
  private aside: HTMLDivElement;
  private stack: Screen[] = [];
  private index = 0;
  private rows: HTMLElement[] = [];
  private listening = false;
  onSound: ((kind: 'move' | 'click') => void) | null = null;
  onCancelListen: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'menu-root hidden';
    this.hero = document.createElement('div');
    this.hero.className = 'menu-hero';
    this.root.appendChild(this.hero);
    this.panel = document.createElement('div');
    this.panel.className = 'menu-panel';
    this.root.appendChild(this.panel);
    this.aside = document.createElement('div');
    this.aside.className = 'menu-aside';
    this.root.appendChild(this.aside);
    parent.appendChild(this.root);
  }

  get visible() {
    return !this.root.classList.contains('hidden');
  }

  get current(): Screen | undefined {
    return this.stack[this.stack.length - 1];
  }

  open(s: Screen) {
    this.stack = [s];
    this.index = this.firstFocusable(s);
    this.render();
    this.root.classList.remove('hidden');
  }

  /** Replace the current screen in place, keeping the focused row (live-updating menus). */
  replace(s: Screen) {
    const keep = this.index;
    this.stack[this.stack.length - 1] = s;
    this.index = this.focusable(keep) ? keep : this.firstFocusable(s);
    this.render();
  }

  /** Focus the row with this label (tests / restoring focus). */
  focusLabel(label: string): boolean {
    const i = this.current?.items.findIndex((it) => 'label' in it && it.label === label) ?? -1;
    if (i < 0 || !this.focusable(i)) return false;
    this.index = i;
    this.highlight();
    return true;
  }

  get focusIndex() {
    return this.index;
  }

  push(s: Screen) {
    this.stack.push(s);
    this.index = this.firstFocusable(s);
    this.render();
    this.root.classList.remove('hidden');
  }

  pop() {
    if (this.stack.length > 1) {
      this.stack.pop();
      this.index = this.firstFocusable(this.current!);
      this.render();
    } else this.current?.onBack?.();
  }

  close() {
    this.drafts.clear();
    this.stack = [];
    this.root.classList.add('hidden');
  }

  private firstFocusable(s: Screen) {
    const i = s.items.findIndex((it) => it.kind !== 'info' && it.kind !== 'custom');
    return Math.max(0, i);
  }

  private focusable(i: number) {
    const it = this.current?.items[i];
    return !!it && it.kind !== 'info' && it.kind !== 'custom';
  }

  render() {
    const s = this.current;
    if (!s) return;
    this.root.className = `menu-root ${s.cls ?? ''}`;
    this.panel.innerHTML = '';
    this.hero.innerHTML = s.hero ? `<h1 class="hero-title" aria-label="${s.hero.title}">${s.hero.title}</h1><div class="hero-tagline">${s.hero.tagline}</div>` : '';
    this.hero.classList.toggle('hidden', !s.hero);
    this.aside.innerHTML = s.aside ?? '';
    this.aside.classList.toggle('hidden', !s.aside);
    if (!s.hero) {
      const h = document.createElement('h1');
      h.className = 'menu-title';
      h.textContent = s.title;
      this.panel.appendChild(h);
    }
    if (s.subtitle) {
      const sub = document.createElement('div');
      sub.className = 'menu-subtitle';
      sub.innerHTML = s.subtitle;
      this.panel.appendChild(sub);
    }
    const list = document.createElement('div');
    list.className = 'menu-list';
    this.panel.appendChild(list);
    this.rows = s.items.map((it, i) => {
      const row = document.createElement('div');
      row.className = `menu-row kind-${it.kind}`;
      if (it.kind === 'button' && it.primary) row.classList.add('primary');
      row.addEventListener('mouseenter', () => {
        if (this.focusable(i) && this.index !== i) {
          this.index = i;
          this.highlight();
        }
      });
      row.addEventListener('click', (e) => {
        if (!this.focusable(i)) return;
        this.index = i;
        const target = e.target as HTMLElement;
        if (target.closest('.dec')) this.adjust(-1);
        else if (target.closest('.inc')) this.adjust(1);
        else if (it.kind === 'slider') {
          const bar = row.querySelector('.bar') as HTMLElement | null;
          if (bar && target.closest('.bar')) {
            const r = bar.getBoundingClientRect();
            const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
            const v = it.min + f * (it.max - it.min);
            it.set(Math.round(v / it.step) * it.step);
            this.refresh();
          }
        } else this.activate();
      });
      list.appendChild(row);
      this.fill(row, it);
      return row;
    });
    const foot = document.createElement('div');
    foot.className = 'menu-foot';
    foot.innerHTML = this.stack.length > 1 || s.onBack ? '<kbd>↑↓</kbd> select · <kbd>←→</kbd> adjust · <kbd>Enter</kbd>/<kbd>A</kbd> confirm · <kbd>Esc</kbd>/<kbd>B</kbd> back' : '<kbd>↑↓</kbd> select · <kbd>Enter</kbd>/<kbd>A</kbd> confirm';
    this.panel.appendChild(foot);
    this.highlight();
  }

  private fill(row: HTMLElement, it: MenuItem) {
    switch (it.kind) {
      case 'button':
        row.innerHTML = `<span class="label">${it.label}</span>${it.hint ? `<span class="hint">${it.hint}</span>` : ''}`;
        break;
      case 'slider': {
        const v = it.get();
        const f = (v - it.min) / (it.max - it.min);
        row.innerHTML = `<span class="label">${it.label}</span><span class="ctl"><span class="dec">◀</span><span class="bar"><span class="fill" style="width:${(f * 100).toFixed(0)}%"></span></span><span class="val">${it.fmt ? it.fmt(v) : v.toFixed(2)}</span><span class="inc">▶</span></span>`;
        break;
      }
      case 'toggle':
        row.innerHTML = `<span class="label">${it.label}</span><span class="ctl"><span class="dec">◀</span><span class="val">${it.get() ? 'On' : 'Off'}</span><span class="inc">▶</span></span>`;
        break;
      case 'select': {
        const cur = it.options.find((o) => o.value === it.get());
        row.innerHTML = `<span class="label">${it.label}${it.note ? `<small>${it.note}</small>` : ''}</span><span class="ctl"><span class="dec">◀</span><span class="val">${cur?.label ?? it.get()}</span><span class="inc">▶</span></span>`;
        break;
      }
      case 'bind':
        row.innerHTML = `<span class="label">${it.label}</span><span class="ctl"><kbd>${it.get()}</kbd></span>`;
        break;
      case 'text': {
        row.innerHTML = `<span class="label">${it.label}${it.note ? `<small>${it.note}</small>` : ''}</span><span class="ctl"><input type="text" spellcheck="false" autocomplete="off" maxlength="${it.maxLength ?? 24}" placeholder="${it.placeholder ?? ''}"></span>`;
        const input = row.querySelector('input')!;
        input.value = it.get();
        input.addEventListener('focus', () => (this.listening = true));
        // Enter applies. Leaving the field keeps the typed text as a draft WITHOUT re-rendering
        // the menu (a re-render would swallow the click that caused the blur, e.g. on Start);
        // drafts are applied before any button runs (commitDrafts).
        input.addEventListener('blur', () => {
          this.listening = false;
          const v = input.value.trim();
          if (v && v !== it.get()) this.drafts.set(it, v);
          else this.drafts.delete(it);
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            if (e.key === 'Escape') {
              input.value = it.get();
              this.drafts.delete(it);
              input.blur();
            } else {
              const v = input.value.trim();
              this.drafts.delete(it);
              input.blur();
              this.drafts.delete(it);
              if (v && v !== it.get()) it.set(v);
              this.refresh();
            }
          }
        });
        break;
      }
      case 'info':
        row.innerHTML = it.html;
        break;
      case 'custom':
        it.render(row);
        break;
    }
  }

  refresh() {
    const s = this.current;
    if (!s) return;
    s.items.forEach((it, i) => {
      const row = this.rows[i];
      if (!row || it.kind === 'custom') return;
      if (it.kind === 'text') {
        const input = row.querySelector('input');
        if (input && document.activeElement !== input) input.value = it.get();
        return;
      }
      if (it.kind === 'info') {
        if (row.innerHTML !== it.html) row.innerHTML = it.html;
        return;
      }
      this.fill(row, it);
    });
    this.highlight();
  }

  private highlight() {
    this.rows.forEach((r, i) => r.classList.toggle('focus', i === this.index));
    // keep the focused row visible without scrolling the title away when everything fits
    if (this.panel.scrollHeight > this.panel.clientHeight + 4) this.rows[this.index]?.scrollIntoView({ block: 'nearest' });
  }

  private move(d: number) {
    const s = this.current;
    if (!s) return;
    let i = this.index;
    for (let n = 0; n < s.items.length; n++) {
      i = (i + d + s.items.length) % s.items.length;
      if (this.focusable(i)) break;
    }
    if (i !== this.index) {
      this.index = i;
      this.highlight();
      this.onSound?.('move');
    }
  }

  private adjust(d: number) {
    const it = this.current?.items[this.index];
    if (!it) return;
    if (it.kind === 'slider') it.set(Math.min(it.max, Math.max(it.min, +(it.get() + d * it.step).toFixed(4))));
    else if (it.kind === 'toggle') it.set(!it.get());
    else if (it.kind === 'select') {
      const i = it.options.findIndex((o) => o.value === it.get());
      const n = it.options[(i + d + it.options.length) % it.options.length];
      if (n) it.set(n.value);
    } else return;
    this.onSound?.('move');
    this.refresh();
  }

  private drafts = new Map<MenuItem, string>();

  /** Apply text typed into fields but not confirmed with Enter. Returns true if any applied. */
  commitDrafts(): boolean {
    if (!this.drafts.size) return false;
    const pending = [...this.drafts];
    this.drafts.clear();
    for (const [it, v] of pending) if (it.kind === 'text') it.set(v);
    return true;
  }

  private activate() {
    const it = this.current?.items[this.index];
    if (!it) return;
    this.onSound?.('click');
    if (it.kind === 'button') {
      // apply typed-but-unconfirmed text first; the action then sees the up-to-date state
      if (this.commitDrafts()) {
        const same = this.current?.items.find((x) => x.kind === 'button' && x.label === it.label);
        if (same && same.kind === 'button') return same.action();
      }
      it.action();
    }
    else if (it.kind === 'toggle') this.adjust(1);
    else if (it.kind === 'select') this.adjust(1);
    else if (it.kind === 'text') {
      const input = this.rows[this.index]?.querySelector('input');
      input?.focus();
      input?.select();
    } else if (it.kind === 'bind') {
      this.listening = true;
      const row = this.rows[this.index];
      if (row) row.querySelector('kbd')!.textContent = 'press a key…';
      it.listen(() => {
        this.listening = false;
        this.refresh();
      });
    }
  }

  private lastDevicePad(_m: MenuInput): boolean {
    return document.body.dataset['device'] !== undefined && document.body.dataset['device'] !== 'keyboard';
  }

  /** Per-frame: navigation + live custom rows. */
  update(m: MenuInput) {
    if (!this.visible) return;
    if (this.listening) {
      const active = document.activeElement as HTMLElement | null;
      if (active && active.tagName === 'INPUT') {
        // text entry: keyboard goes to the field; a controller can still leave it
        if (m.back || (m.confirm && this.lastDevicePad(m))) active.blur();
        return;
      }
      // controller users can cancel a key-remap prompt
      if (m.back || m.confirm) {
        this.listening = false;
        this.onCancelListen?.();
        this.refresh();
      }
      return;
    }
    const s = this.current;
    if (!s) return;
    if (m.up) this.move(-1);
    if (m.down) this.move(1);
    if (m.left) this.adjust(-1);
    if (m.right) this.adjust(1);
    if (m.confirm) this.activate();
    else if (m.back) this.pop();
    s.items.forEach((it, i) => {
      if (it.kind === 'custom' && it.update && this.rows[i]) it.update(this.rows[i]!);
    });
  }
}
