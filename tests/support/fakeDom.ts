// A minimal element tree for UI classes in Node (classList, textContent, children, style): enough to
// construct the HUD and read back what it shows. Not a layout engine.
class FakeClassList {
  private s = new Set<string>();
  constructor(private owner: FakeEl) {}
  add(...c: string[]) { for (const x of c) this.s.add(x); this.sync(); }
  remove(...c: string[]) { for (const x of c) this.s.delete(x); this.sync(); }
  toggle(c: string, on?: boolean) { const v = on ?? !this.s.has(c); if (v) this.s.add(c); else this.s.delete(c); this.sync(); return v; }
  contains(c: string) { return this.s.has(c); }
  set(v: string) { this.s = new Set(v.split(/\s+/).filter(Boolean)); }
  private sync() { this.owner._cls = [...this.s].join(' '); }
}
export class FakeEl {
  _cls = '';
  tagName: string;
  children: FakeEl[] = [];
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  textContent: string | null = '';
  innerHTML = '';
  classList = new FakeClassList(this);
  constructor(tag: string) { this.tagName = tag; }
  get className() { return this._cls; }
  set className(v: string) { this._cls = v; this.classList.set(v); }
  appendChild(c: FakeEl) { this.children.push(c); return c; }
  append(...c: FakeEl[]) { for (const x of c) this.children.push(x); }
  remove() {}
  querySelector() { return new FakeEl('div'); }
  querySelectorAll() { return []; }
  setAttribute() {}
  removeAttribute() {}
  addEventListener() {}
  removeEventListener() {}
  getContext() { return null; }
  getBoundingClientRect() { return { width: 0, height: 0, left: 0, top: 0 }; }
}
(globalThis as any).document = { createElement: (t: string) => new FakeEl(t), createElementNS: (_n: string, t: string) => new FakeEl(t), body: new FakeEl('body') };
export {};
