"""Summarise ladder rows (tests/sim/ladder.measure.test.ts output): held-out wins and the Classic result.

usage: python3 tools/ladder_table.py <file.jsonl> [...]
One line per file × biome × difficulty × policy: wins/n on held-out seeds for Sprint and Standard, and the
Classic course's outcome with its minimum and final Yeti gap.
"""
import json
import sys
from collections import defaultdict


def main(paths):
    for p in paths:
        g = defaultdict(list)
        with open(p, encoding='utf-8') as fh:
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
