"""Summarise pursuit-tension rows (tests/sim/tension.measure.test.ts output) per biome/len/diff/behaviour.

usage: python3 -I tools/tension_table.py <file.jsonl> [...]   (files under .measure/ or docs/reviews/biomes/whiteout/balance/)
Prints caught/n, median start and minimum gap, median seconds inside 45 m and 25 m, median CLOSING seconds.
"""
import json
import statistics
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


def med(xs):
    xs = [x for x in xs if x is not None and x >= 0]
    return round(statistics.median(xs), 1) if xs else None


def main(paths):
    g = defaultdict(list)
    for p in paths:
        with open(resolve(p), encoding='utf-8') as fh:
            for line in fh:
                if line.strip():
                    r = json.loads(line)
                    g[(r['biome'], r['len'], r['diff'], r['behaviour'])].append(r)
    print(f"{'biome':9}{'len':9}{'diff':7}{'behaviour':12}{'caught':>8}{'start':>7}{'min':>7}{'<45s':>6}{'<25s':>6}{'clos':>6}")
    for k in sorted(g):
        v = g[k]
        c = sum(r['outcome'] == 'caught' for r in v)
        print(f"{k[0]:9}{k[1]:9}{k[2]:7}{k[3]:12}{c:>4}/{len(v):<3}{med([r['startGap'] for r in v])!s:>7}{med([r['minGap'] for r in v])!s:>7}"
              f"{med([r['t45'] for r in v])!s:>6}{med([r['t25'] for r in v])!s:>6}{med([r['closingS'] for r in v])!s:>6}")


if __name__ == '__main__':
    main(sys.argv[1:])
