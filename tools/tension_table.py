"""Summarise pursuit-tension rows (tests/sim/tension.measure.test.ts output) per biome/len/diff/behaviour.

usage: python3 tools/tension_table.py <file.jsonl> [...]
Prints caught/n, median start and minimum gap, median seconds inside 45 m and 25 m, median CLOSING seconds.
"""
import json
import statistics
import sys
from collections import defaultdict


def med(xs):
    xs = [x for x in xs if x is not None and x >= 0]
    return round(statistics.median(xs), 1) if xs else None


def main(paths):
    g = defaultdict(list)
    for p in paths:
        with open(p, encoding='utf-8') as fh:
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
