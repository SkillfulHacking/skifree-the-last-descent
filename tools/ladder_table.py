"""Summarise ladder rows (tests/sim/ladder.measure.test.ts output): held-out wins and the Classic result.

usage: python3 -I tools/ladder_table.py <file.jsonl> [...]   (files under .measure/ or docs/reviews/biomes/whiteout/balance/)
One line per file × biome × difficulty × policy: wins/n on held-out seeds for Sprint and Standard, and the
Classic course's outcome with its minimum and final Yeti gap.
"""
import json
import sys
from collections import defaultdict
import os

# (Round 5, SonarCloud AaIXUMn7… / AaIXUMmp…, as W-087) the tool opens only files it enumerates itself under
# fixed measurement directories (no symlinks); a command-line argument is a lookup key matched against that
# list — a path relative to the repository, a path inside one of the directories, or a unique file name — and
# is never opened as a path.
ROOT = os.path.realpath(os.getcwd())
MEASURE_DIRS = ('.measure', os.path.join('docs', 'reviews', 'biomes', 'whiteout', 'balance'))


def catalogue():
    found = {}
    for d in MEASURE_DIRS:
        base = os.path.join(ROOT, d)
        for dirpath, _dirs, files in os.walk(base, followlinks=False):
            for f in files:
                full = os.path.join(dirpath, f)
                if f.endswith('.jsonl') and not os.path.islink(full):
                    found[os.path.relpath(full, ROOT)] = full
    return found


def resolve(key):
    files = catalogue()
    want = os.path.normpath(key)
    hits = [full for rel, full in files.items() if rel == want]
    if not hits:
        hits = [full for rel, full in files.items() if any(rel == os.path.join(d, want) for d in MEASURE_DIRS)]
    if not hits:
        hits = [full for rel, full in files.items() if os.path.basename(rel) == want]
    if len(hits) != 1:
        sys.exit(f'refusing {key}: give a .jsonl under {" or ".join(MEASURE_DIRS)} (by path or unique name)')
    return hits[0]


def main(paths):
    for p in paths:
        g = defaultdict(list)
        with open(resolve(p), encoding='utf-8') as fh:
            for line in fh:
                if line.strip():
                    r = json.loads(line)
                    g[(r['biome'], r['diff'], r['policy'])].append(r)
        for k in sorted(g):
            parts = []
            for L in ('sprint', 'standard'):
                v = [r for r in g[k] if r['len'] == L and r['seed'] != 'CLASSIC']
                w = sum(r['outcome'] == 'victory' for r in v)
                c = [r for r in g[k] if r['len'] == L and r['seed'] == 'CLASSIC']
                cs = (f"{'W' if c[0]['outcome'] == 'victory' else 'L'} min {c[0]['minGap']:.0f}") if c else '-'
                parts.append(f"{L[:3]} {w:>2}/{len(v):<2} ({100 * w / max(1, len(v)):3.0f}%) classic {cs:10}")
            print(f"{p.split('/')[-1]:28} {k[0]:8} {k[1]:6} {k[2]:15} " + '  '.join(parts))


if __name__ == '__main__':
    main(sys.argv[1:])
