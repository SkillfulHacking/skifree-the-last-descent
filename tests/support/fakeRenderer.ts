// A WebGLRenderer stand-in for building a World in Node: every property is a callable no-op proxy
// (PMREM, pixel ratio …). Nothing reaches a GPU: no draws, no uploads, no shader compiles.
const make = (): unknown =>
  new Proxy(function () {}, {
    get(_t, k) {
      if (k === 'getPixelRatio') return () => 1;
      if (k === 'coordinateSystem') return 2000; // THREE.WebGLCoordinateSystem
      if (k === 'getClearColor') return (c: unknown) => c;
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'then') return undefined;
      return make();
    },
    apply() {
      return make();
    },
    set() {
      return true;
    },
  });
export const fakeRenderer = make() as import('three').WebGLRenderer;
