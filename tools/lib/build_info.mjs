// Round 6 (W-106, W-087 hardening): identify a build without running a shell or any program found on PATH.
//  - gitHead(): the checked-out commit, read from .git files (no `git` process).
//  - srcHash(): SHA-256 over the game's sources (src/** and index.html), path and content, in sorted order.
//  - the build writes both to dist/build-info.json (vite.config.ts), so evidence and perf tools record the
//    build that was actually served (servedBuild) rather than whatever HEAD happens to be checked out.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, resolve, sep } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

function gitDir(root) {
  const g = join(root, '.git');
  if (!existsSync(g)) return null;
  if (statSync(g).isDirectory()) return g;
  const m = /^gitdir:\s*(.+)\s*$/m.exec(readFileSync(g, 'utf8'));
  return m ? resolve(root, m[1]) : null;
}

/** the checked-out commit (full SHA), or 'unknown'; never spawns a process */
export function gitHead(root = ROOT) {
  try {
    const dir = gitDir(root);
    if (!dir) return 'unknown';
    const head = readFileSync(join(dir, 'HEAD'), 'utf8').trim();
    const ref = /^ref:\s*(\S+)$/.exec(head);
    if (!ref) return /^[0-9a-f]{40}$/.test(head) ? head : 'unknown';
    // a linked worktree keeps refs in the common dir
    const common = existsSync(join(dir, 'commondir')) ? resolve(dir, readFileSync(join(dir, 'commondir'), 'utf8').trim()) : dir;
    for (const d of [dir, common]) {
      const f = join(d, ...ref[1].split('/'));
      if (existsSync(f)) return readFileSync(f, 'utf8').trim();
    }
    const packed = join(common, 'packed-refs');
    if (existsSync(packed)) {
      for (const line of readFileSync(packed, 'utf8').split('\n')) {
        const [sha, name] = line.trim().split(' ');
        if (name === ref[1] && /^[0-9a-f]{40}$/.test(sha)) return sha;
      }
    }
  } catch {
    /* fall through */
  }
  return 'unknown';
}

function walk(dir, out) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/** SHA-256 (hex, 16 chars) over src/** and index.html: path and bytes, sorted by path */
export function srcHash(root = ROOT) {
  const files = walk(join(root, 'src'), []);
  if (existsSync(join(root, 'index.html'))) files.push(join(root, 'index.html'));
  const h = createHash('sha256');
  for (const f of files.map((f) => relative(root, f).split(sep).join('/')).sort()) {
    h.update(f + '\0');
    h.update(readFileSync(join(root, f)));
    h.update('\0');
  }
  return h.digest('hex').slice(0, 16);
}

export function buildInfo(root = ROOT) {
  return { gitHead: gitHead(root), srcHash: srcHash(root), builtAt: new Date().toISOString() };
}

/**
 * The build the server at `base` is serving (its build-info.json), with whether it matches the working
 * tree's sources. Throws when the build has no build-info.json: evidence must name what it captured.
 */
export async function servedBuild(base) {
  const url = new URL('build-info.json', base.endsWith('/') ? base : base + '/');
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}. Rebuild (npm run build) so the served build records what it is.`);
  const info = await r.json();
  const local = srcHash();
  return { ...info, sha: String(info.gitHead).slice(0, 7), workingTreeSrcHash: local, matchesWorkingTree: info.srcHash === local };
}
