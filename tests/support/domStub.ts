// Minimal DOM canvas stub so three.js view builders (canvas textures) run in Node, without a GPU.
const ctx2d = new Proxy(
  {},
  {
    get(_t, k) {
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (k === 'createImageData') return (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop() {} });
      return () => undefined;
    },
    set() {
      return true;
    },
  },
);
(globalThis as any).document = {
  createElement: (tag: string) => {
    const c: any = { tagName: tag, width: 300, height: 150, style: {}, getContext: () => ctx2d, addEventListener() {}, removeEventListener() {} };
    return c;
  },
  createElementNS: (_ns: string, tag: string) => (globalThis as any).document.createElement(tag),
};
export {};
