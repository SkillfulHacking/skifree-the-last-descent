#!/usr/bin/env python3
"""W-077: summarise tension rows (tests/sim/tension.measure.test.ts) by location/length/difficulty/player.
usage: python3 -I tools/tension_summary.py <file.jsonl> [<compare.jsonl>]
Files must live under .measure/ or docs/reviews/biomes/whiteout/balance/ (path or unique file name)."""
import json, sys, statistics, collections
import os
# W-087: the tool opens only files it enumerates itself under these fixed measurement directories.
# A command-line argument is a lookup key matched against that list; it is never opened as a path.
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
def load(key):
    files = catalogue()
    want = os.path.normpath(key)
    hits = [full for rel, full in files.items() if rel == want] or \
           [full for rel, full in files.items() if os.path.basename(rel) == want]
    if len(hits) != 1:
        sys.exit(f'refusing {key}: give a .jsonl under {" or ".join(MEASURE_DIRS)} (by path or unique name)')
    with open(hits[0], encoding='utf-8') as fh:
        return [json.loads(l) for l in fh if l.strip()]
def summ(rows):
    g = collections.defaultdict(list)
    for r in rows:
        g[(r['biome'], r['len'], r['diff'], r['behaviour'])].append(r)
    out = {}
    for k, v in g.items():
        out[k] = dict(n=len(v), caught=sum(r['outcome'] == 'caught' for r in v),
                      minGap=statistics.median([max(0, r['minGap']) for r in v]),
                      t45=statistics.median([r['t45'] for r in v]), t25=statistics.median([r['t25'] for r in v]),
                      t110=statistics.median([r['t110'] for r in v]))
    return out
a = summ([r for r in load(sys.argv[1]) if r.get('enc', 0) == 0 and r['len'] in ('sprint', 'standard')])
b = summ([r for r in load(sys.argv[2]) if r.get('enc', 0) == 0 and r['len'] in ('sprint', 'standard')]) if len(sys.argv) > 2 else None
for k in sorted(a):
    x = a[k]
    s = f"{k[0]:9}{k[1]:9}{k[2]:7}{k[3]:12} caught {x['caught']}/{x['n']}  min {x['minGap']:5.1f}  <110 {x['t110']:5.1f}  <45 {x['t45']:5.1f}  <25 {x['t25']:4.1f}"
    if b and k in b:
        y = b[k]
        s += f"   ->  caught {y['caught']}/{y['n']}  min {y['minGap']:5.1f}  <110 {y['t110']:5.1f}  <45 {y['t45']:5.1f}  <25 {y['t25']:4.1f}"
    print(s)
