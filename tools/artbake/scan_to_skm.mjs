// Poly Haven glTF scan -> compact simplified mesh for the game (build-time, outside the repo's runtime).
// usage: node convert.mjs <in.gltf> <out.bin> <targetTris> [upAxisFix]
// Output layout (little-endian): u32 magic 'SKM1', u32 vertexCount, u32 indexCount,
//   f32 bbox min[3], f32 bbox max[3], u16 quantized positions [3*vc] (0..65535 over the bbox),
//   u16|u32 indices (u16 when vc < 65536).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';

const [inPath, outPath, targetStr] = process.argv.slice(2);
const target = Number(targetStr ?? 6000);
const gltf = JSON.parse(readFileSync(inPath, 'utf8'));
const bins = gltf.buffers.map((b) => readFileSync(join(dirname(inPath), b.uri)));
const view = (acc) => {
  const a = gltf.accessors[acc];
  const bv = gltf.bufferViews[a.bufferView];
  const buf = bins[bv.buffer];
  const off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
  const stride = bv.byteStride;
  if (stride && stride !== comps * T.BYTES_PER_ELEMENT) {
    const out = new T(a.count * comps);
    for (let i = 0; i < a.count; i++) {
      const v = new T(buf.buffer, buf.byteOffset + off + i * stride, comps);
      out.set(v, i * comps);
    }
    return out;
  }
  return new T(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + a.count * comps * T.BYTES_PER_ELEMENT));
};
// merge every primitive of every mesh, applying node transforms (translation/scale/rotation ignored if absent)
const P = [];
const I = [];
for (const node of gltf.nodes ?? []) {
  if (node.mesh === undefined) continue;
  const m = gltf.meshes[node.mesh];
  const s = node.scale ?? [1, 1, 1];
  const t = node.translation ?? [0, 0, 0];
  for (const prim of m.primitives) {
    const pos = view(prim.attributes.POSITION);
    const base = P.length / 3;
    for (let i = 0; i < pos.length; i += 3) P.push(pos[i] * s[0] + t[0], pos[i + 1] * s[1] + t[1], pos[i + 2] * s[2] + t[2]);
    const idx = prim.indices !== undefined ? view(prim.indices) : Array.from({ length: pos.length / 3 }, (_, i) => i);
    for (const k of idx) I.push(k + base);
  }
}
let pos = new Float32Array(P);
let idx = new Uint32Array(I);
// weld identical positions (UV seams split vertices)
{
  const map = new Map();
  const remap = new Uint32Array(pos.length / 3);
  const np = [];
  for (let i = 0; i < pos.length / 3; i++) {
    const k = `${pos[3 * i].toFixed(4)},${pos[3 * i + 1].toFixed(4)},${pos[3 * i + 2].toFixed(4)}`;
    let j = map.get(k);
    if (j === undefined) {
      j = np.length / 3;
      map.set(k, j);
      np.push(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]);
    }
    remap[i] = j;
  }
  pos = new Float32Array(np);
  idx = idx.map((v) => remap[v]);
}
await MeshoptSimplifier.ready;
const [simp, err] = MeshoptSimplifier.simplify(idx, pos, 3, Math.min(idx.length, target * 3), 0.05, []);
// compact
const used = new Map();
const outP = [];
const outI = new Uint32Array(simp.length);
for (let i = 0; i < simp.length; i++) {
  let j = used.get(simp[i]);
  if (j === undefined) {
    j = outP.length / 3;
    used.set(simp[i], j);
    outP.push(pos[3 * simp[i]], pos[3 * simp[i] + 1], pos[3 * simp[i] + 2]);
  }
  outI[i] = j;
}
const vc = outP.length / 3;
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < vc; i++) for (let a = 0; a < 3; a++) {
  min[a] = Math.min(min[a], outP[3 * i + a]);
  max[a] = Math.max(max[a], outP[3 * i + a]);
}
const big = vc >= 65536;
const header = 12 + 24;
const buf = Buffer.alloc(header + vc * 6 + outI.length * (big ? 4 : 2) + 4);
buf.write('SKM1', 0, 'ascii');
buf.writeUInt32LE(vc, 4);
buf.writeUInt32LE(outI.length, 8);
for (let a = 0; a < 3; a++) {
  buf.writeFloatLE(min[a], 12 + 4 * a);
  buf.writeFloatLE(max[a], 24 + 4 * a);
}
let o = header;
for (let i = 0; i < vc; i++) for (let a = 0; a < 3; a++) {
  const q = Math.round(((outP[3 * i + a] - min[a]) / Math.max(1e-9, max[a] - min[a])) * 65535);
  buf.writeUInt16LE(q, o);
  o += 2;
}
if (o % 4 && big) o += 4 - (o % 4);
for (const v of outI) {
  if (big) buf.writeUInt32LE(v, o), (o += 4);
  else buf.writeUInt16LE(v, o), (o += 2);
}
writeFileSync(outPath, buf.subarray(0, o));
console.log(`${inPath}: ${I.length / 3} tris → ${outI.length / 3} (err ${err.toFixed(4)}), ${vc} verts, bbox ${min.map((v) => v.toFixed(2))} .. ${max.map((v) => v.toFixed(2))}, ${o} bytes`);
