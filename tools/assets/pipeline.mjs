#!/usr/bin/env node
// Reproducible asset pipeline: every distributable art file in the game is listed in
// tools/assets/manifest.json with its source, licence, recipe and SHA-256.
//
//   node tools/assets/pipeline.mjs fetch      download the Poly Haven originals into .asset-cache/
//                                             (build time only, md5-checked against the API)
//   node tools/assets/pipeline.mjs build [dir] regenerate every output (default: in place)
//   node tools/assets/pipeline.mjs check      fetch + build into a temp dir and require every output
//                                             to be byte-identical to the committed file
//   node tools/assets/pipeline.mjs verify     OFFLINE (CI): committed files match the manifest,
//                                             every file in the asset folders is listed, licence
//                                             metadata complete
//   node tools/assets/pipeline.mjs licenses   online: authors in the manifest match Poly Haven's
//                                             /info records; writes `verified` dates
//
// The game never contacts Poly Haven; nothing here runs at runtime. See tools/assets/README.md.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = join(ROOT, 'tools/assets/manifest.json');
const CACHE = join(ROOT, '.asset-cache');
const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const UA = m.userAgent;
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const md5 = (p) => createHash('md5').update(readFileSync(p)).digest('hex');
const python = process.env.PYTHON ?? 'python3';
const run = (cmd, args, env = {}) => execFileSync(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, ...env } }).toString();

async function api(path) {
  const r = await fetch(`https://api.polyhaven.com${path}`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Poly Haven API ${path}: HTTP ${r.status}`);
  return r.json();
}

async function download(url, dest, wantMd5) {
  if (existsSync(dest) && md5(dest) === wantMd5) return false;
  mkdirSync(dirname(dest), { recursive: true });
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`download ${url}: HTTP ${r.status}`);
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  const got = md5(dest);
  if (got !== wantMd5) throw new Error(`md5 mismatch for ${url}: ${got} != ${wantMd5}`);
  return true;
}

/** where a source's files live in the cache */
const srcDir = (slug) => join(CACHE, slug);

async function fetchAll() {
  for (const [slug, s] of Object.entries(m.sources)) {
    if (s.provider !== 'polyhaven') continue;
    const files = await api(`/files/${slug}`);
    for (const f of s.files) {
      let e = files[f.map]?.[f.res]?.[f.format];
      if (!e) throw new Error(`${slug}: no ${f.map}/${f.res}/${f.format} in the API listing`);
      // a glTF entry lists its buffers and textures in `include`; the scans only need the .bin
      if (f.include) e = e.include[f.include];
      if (e.md5 !== f.md5) throw new Error(`${slug}: ${f.name} upstream md5 ${e.md5} differs from the manifest ${f.md5} (the asset changed upstream — review before updating)`);
      const got = await download(e.url, join(srcDir(slug), f.dest), f.md5);
      console.log(`${got ? 'fetched' : 'cached '} ${slug}/${f.dest}`);
    }
  }
}

function buildAll(outRoot) {
  const tmp = mkdtempSync(join(tmpdir(), 'assets-'));
  try {
    for (const o of m.outputs) {
      const out = join(outRoot, o.path);
      mkdirSync(dirname(out), { recursive: true });
    }
    // textures: convert the 4K originals to 1K intermediates, then pack
    for (const [slug, s] of Object.entries(m.sources)) {
      if (s.type !== 'texture' || s.provider !== 'polyhaven') continue;
      run(python, ['tools/assets/convert_textures.py', srcDir(slug), join(tmp, 'conv'), '1024']);
      const outBase = join(outRoot, `src/world/art/textures/${slug}`);
      run(python, ['tools/assets/pack_scans.py', join(tmp, 'conv'), slug, outBase]);
    }
    // models: simplify the glTF scans to the SKM1 format
    for (const [slug, s] of Object.entries(m.sources)) {
      if (s.type !== 'model') continue;
      const gltf = s.files.find((f) => f.dest.endsWith('.gltf'));
      run(process.execPath, ['tools/assets/scan_to_skm.mjs', join(srcDir(slug), gltf.dest), join(outRoot, `src/world/art/models/${slug}.skm`), String(s.triangles)]);
    }
    // procedural sets (original code)
    for (const [name, s] of Object.entries(m.sources)) {
      if (s.provider !== 'procedural') continue;
      run(process.execPath, ['tools/assets/bake_procedural.mjs', join(outRoot, 'src/world/art/textures'), '1024'], { SETS: name });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function verify() {
  const problems = [];
  const listed = new Set();
  for (const o of m.outputs) {
    listed.add(o.path);
    const p = join(ROOT, o.path);
    if (!existsSync(p)) {
      problems.push(`missing: ${o.path}`);
      continue;
    }
    const h = sha256(p);
    if (h !== o.sha256) problems.push(`sha256 mismatch: ${o.path} (${h})`);
    if (statSync(p).size !== o.bytes) problems.push(`size mismatch: ${o.path}`);
    const s = m.sources[o.from];
    if (!s) problems.push(`${o.path}: unknown source ${o.from}`);
    else {
      if (!s.license?.spdx || !s.license?.url) problems.push(`${o.path}: source ${o.from} lacks licence metadata`);
      if (s.provider === 'polyhaven' && (!s.page || !s.authors || Object.keys(s.authors).length === 0)) problems.push(`${o.path}: source ${o.from} lacks page/authors`);
      if (s.provider === 'polyhaven' && !s.verified) problems.push(`${o.path}: source ${o.from} licence/authors never verified`);
    }
  }
  for (const dir of m.assetDirs) {
    for (const f of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${f}`;
      if (!listed.has(rel)) problems.push(`unlisted asset file: ${rel} (add it to the manifest with its source and licence, or remove it)`);
    }
  }
  return problems;
}

async function licenses() {
  const today = new Date().toISOString().slice(0, 10);
  const bad = [];
  for (const [slug, s] of Object.entries(m.sources)) {
    if (s.provider !== 'polyhaven') continue;
    const info = await api(`/info/${slug}`);
    const a = JSON.stringify(Object.keys(info.authors).sort());
    const b = JSON.stringify(Object.keys(s.authors).sort());
    if (a !== b) bad.push(`${slug}: authors ${a} upstream vs ${b} in the manifest`);
    else s.verified = today;
  }
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
  return bad;
}

const cmd = process.argv[2];
if (cmd === 'fetch') await fetchAll();
else if (cmd === 'build') {
  buildAll(resolve(process.argv[3] ?? ROOT));
  console.log('built');
} else if (cmd === 'check') {
  await fetchAll();
  const out = mkdtempSync(join(tmpdir(), 'assets-out-'));
  buildAll(out);
  let bad = 0;
  for (const o of m.outputs) {
    const p = join(out, o.path);
    const h = existsSync(p) ? sha256(p) : 'missing';
    const ok = h === o.sha256;
    if (!ok) bad++;
    console.log(`${ok ? 'identical' : 'DIFFERENT'} ${o.path}${ok ? '' : ` (${h})`}`);
  }
  rmSync(out, { recursive: true, force: true });
  if (bad) {
    console.error(`${bad} output(s) not reproduced byte-for-byte`);
    process.exit(1);
  }
  console.log(`all ${m.outputs.length} outputs reproduced byte-for-byte`);
} else if (cmd === 'verify') {
  const p = verify();
  if (p.length) {
    for (const x of p) console.error(x);
    process.exit(1);
  }
  console.log(`asset manifest OK: ${m.outputs.length} files, sources ${Object.keys(m.sources).length}, licences present`);
} else if (cmd === 'licenses') {
  const bad = await licenses();
  if (bad.length) {
    for (const x of bad) console.error(x);
    process.exit(1);
  }
  console.log('authors match Poly Haven for every source; verified dates written');
} else {
  console.error('usage: pipeline.mjs fetch|build [dir]|check|verify|licenses');
  process.exit(2);
}
