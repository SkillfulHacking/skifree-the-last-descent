# Pursuit tension across locations (W-076, owner's decision 3)

**Build:** `pass5-whiteout` at `f915a77` (`at_f915a77.jsonl`; the canonical chase start, the presence cues and
W-056's placement rules). Earlier: `baseline_872ac4d.jsonl` (before the presence cues
and before W-056/W-065), `after_presence.jsonl` (`1d88f0a`).
**Runner:** `tests/sim/tension.measure.test.ts` (headless game, `simulate.ts`; Classic course of each location;
first chase). Model drivers, not human playtesters; none of them reads Whiteout's weather (the weather reader
is measured in `balance/w056/`).

## Players
| Player | What it does |
|---|---|
| skilled | the autopilot's racing line, tucked — a clean expert run |
| competent | the 'intermediate' style, scrubbing speed for 1 s every 12 s (no tuck, half brake) |
| cautious | the skilled line, braking whenever faster than 13 m/s (47 km/h) |
| crash | the skilled line, one crash 5 s into the chase |
| lateCrash | the same crash 20 s into the chase |
| poorRoute | the competent style, wandering ±12 m off the racing line |
| slowArrival | the skilled line, at 3 m/s when the chase begins |

Thresholds are the game's own cues: 110 m — the rear-view inset and the chase music start; 45 m — the
"[heavy footsteps behind you]" caption (the widget turns red at 40 m); 25 m — "MOVE!"; 13 m — lunge range.
"calls": the new distant calls heard while he is out of sight; "CLOSING s": seconds the new CLOSING
warning is shown.

## Findings
- **Gameplay is unchanged by the presence work** (same AI, start and speeds: `baseline` vs `after_presence`
  rows are identical except for the 'competent' driver, which was redefined — the plain 'intermediate'
  style skis the chase exactly like 'skilled').
- **Alpine: mistakes do not create pressure.** On Normal, a clean, a sloppy, a late-crashing and a
  wandering skier all keep the Yeti beyond 45 m for the whole chase; only braking (cautious) or a crash in the
  first seconds brings him close. Within ~15 s a competent skier is beyond the rear-view range (110 m) and
  stays there; a crash 20 s in never brings him back inside 53 m. Hard: the crash and the wandering line are
  caught; the clean skier never sees him inside 45 m.
- **Fjord: graded.** Normal: the skilled skier sees him inside 45 m for ~3 s, the sloppy one comes to 15 m,
  a crash to 18 m; braking and wandering are caught. Hard: the skilled skier comes to 16.5 m.
- **Whiteout (review F, F6: measured on the weather reader, `whiteout_reader.jsonl`; the plain
  autopilot ploughs every drift row there, so the `at_f915a77` Whiteout rows understate a good player):**
  Sprint Normal grades sharply — the clean reader escapes (44.5 m, inside 45 m for 0.9 s), every mistake
  (sloppy, braking, a crash at 5 s or 20 s, a wandering line) is caught. **Standard Normal does not:** a
  sloppy, late-crashing or wandering reader never comes inside the starting gap, as on Alpine (review F,
  F5 — the README's earlier "graded like Fjord" was wrong). Hard Standard grades the mistakes.
- **Presentation (this change):** a clean skier on Alpine or Fjord now hears him 2–5 times while he is out
  of sight; the CLOSING warning is shown for 5–28 s in the chases where the gap shrinks (crash, wander,
  sloppy runs).

## Reading against the owner's decision 3
A clean expert escape is a deserved escape. But "poor decisions and recoverable mistakes should create
pressure" is **not met on Alpine Normal (Sprint and Standard) nor on Whiteout Standard Normal**: there a
competent skier outruns the Yeti's pace (20–28 m/s against 16.5) and the existing far-behind catch-up holds
him at 115–170 m, beyond the inset and the chase music (review F's probe). Presentation makes him present;
it cannot make a mistake cost anything. That needs an evidence-led, scoped gameplay change (review F:
prefer a fixed per-location pace or course design over anything distance-based; do not strengthen the
catch-up term) with fresh cross-location balance and independent review — W-077, open. Fjord grades the
mistakes already; so do Whiteout Sprint and every Hard course measured.

## Tables (`f915a77`)
### Sprint, Normal
| Location | Length | Diff | Player | start gap @ skier speed | min gap | s < 110 m | s < 45 m | s < 25 m | s < 13 m | lunges | outcome (chase s) | calls | CLOSING s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| alpine | sprint | normal | skilled | 53.6 m @ 14.91 m/s | 53.6 | 14.2 | 0 | 0 | 0 | 0 | escaped (73.9 s) | 5 | 0 |
| alpine | sprint | normal | competent | 50.6 m @ 13.1 m/s | 50.6 | 40.6 | 0 | 0 | 0 | 0 | escaped (80.6 s) | 3 | 0 |
| alpine | sprint | normal | cautious | 47 m @ 11.91 m/s | 2.7 | 15.8 | 8.9 | 4.4 | 1.7 | 1 | caught at 15.8 s | 0 | 10.4 |
| alpine | sprint | normal | crash | 53.6 m @ 14.91 m/s | 27.5 | 30.6 | 11.7 | 0 | 0 | 0 | escaped (79.2 s) | 4 | 7.8 |
| alpine | sprint | normal | lateCrash | 53.6 m @ 14.91 m/s | 53.6 | 29 | 0 | 0 | 0 | 0 | escaped (78.3 s) | 3 | 4.4 |
| alpine | sprint | normal | poorRoute | 49 m @ 14.42 m/s | 49 | 93.4 | 0 | 0 | 0 | 0 | escaped (93.4 s) | 0 | 8 |
| alpine | sprint | normal | slowArrival | 34.2 m @ 3 m/s | 33.7 | 20.7 | 2.6 | 0 | 0 | 0 | escaped (77.5 s) | 5 | 0 |
| fjord | sprint | normal | skilled | 38.8 m @ 14.02 m/s | 38.8 | 48.3 | 2.6 | 0 | 0 | 0 | escaped (81.4 s) | 2 | 11.4 |
| fjord | sprint | normal | competent | 35.4 m @ 12.1 m/s | 15 | 77.1 | 12.6 | 5.7 | 0 | 0 | escaped (89.3 s) | 1 | 23.7 |
| fjord | sprint | normal | cautious | 33 m @ 11.3 m/s | 2.9 | 14.4 | 12.5 | 4.3 | 1.5 | 1 | caught at 14.4 s | 0 | 8.6 |
| fjord | sprint | normal | crash | 38.8 m @ 14.02 m/s | 18.2 | 62.1 | 18.7 | 8.1 | 0 | 0 | escaped (85.1 s) | 1 | 18.5 |
| fjord | sprint | normal | lateCrash | 38.8 m @ 14.02 m/s | 38.8 | 85.6 | 2.6 | 0 | 0 | 0 | escaped (86.8 s) | 0 | 19.4 |
| fjord | sprint | normal | poorRoute | 37.9 m @ 13.22 m/s | 2.7 | 89.8 | 12.5 | 3.7 | 1.6 | 1 | caught at 89.8 s | 0 | 24.2 |
| fjord | sprint | normal | slowArrival | 19.8 m @ 3 m/s | 19.8 | 53.7 | 10.4 | 1.7 | 0 | 0 | escaped (84.4 s) | 2 | 11.3 |
| whiteout | sprint | normal | skilled | 40.8 m @ 14.22 m/s | 2.8 | 75.8 | 23.2 | 7.6 | 5.3 | 2 | caught at 75.8 s | 0 | 26 |
| whiteout | sprint | normal | competent | 39.6 m @ 13.41 m/s | 2.8 | 57.8 | 21.7 | 3.3 | 1.6 | 1 | caught at 57.8 s | 0 | 25.2 |
| whiteout | sprint | normal | cautious | 36.7 m @ 12.1 m/s | 2.8 | 14.7 | 11.5 | 4.4 | 1.6 | 1 | caught at 14.7 s | 0 | 9 |
| whiteout | sprint | normal | crash | 40.8 m @ 14.22 m/s | 2.9 | 14.6 | 9 | 5.4 | 3.3 | 2 | caught at 14.6 s | 0 | 8.4 |
| whiteout | sprint | normal | lateCrash | 40.8 m @ 14.22 m/s | 2.8 | 28.3 | 7.2 | 3.6 | 1.9 | 1 | caught at 28.2 s | 0 | 8.2 |
| whiteout | sprint | normal | poorRoute | 44 m @ 14.31 m/s | 2.7 | 61.2 | 21.2 | 6 | 3.7 | 2 | caught at 61.2 s | 0 | 18 |
| whiteout | sprint | normal | slowArrival | 25.6 m @ 3 m/s | 2.8 | 78.3 | 27 | 7 | 1.7 | 1 | caught at 78.3 s | 0 | 24.1 |

### Sprint, Hard
| Location | Length | Diff | Player | start gap @ skier speed | min gap | s < 110 m | s < 45 m | s < 25 m | s < 13 m | lunges | outcome (chase s) | calls | CLOSING s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| alpine | sprint | hard | skilled | 53.6 m @ 14.91 m/s | 53.6 | 55.1 | 0 | 0 | 0 | 0 | escaped (79.8 s) | 2 | 7.1 |
| alpine | sprint | hard | competent | 50.6 m @ 13.1 m/s | 50.6 | 82.5 | 0 | 0 | 0 | 0 | escaped (85 s) | 0 | 13.5 |
| alpine | sprint | hard | cautious | 47 m @ 11.91 m/s | 2.8 | 11.9 | 5.6 | 3.4 | 1.3 | 1 | caught at 11.9 s | 0 | 6.6 |
| alpine | sprint | hard | crash | 53.6 m @ 14.91 m/s | 2.9 | 60.8 | 27.2 | 15.3 | 3.3 | 2 | caught at 67.5 s | 0 | 26.9 |
| alpine | sprint | hard | lateCrash | 53.6 m @ 14.91 m/s | 53.6 | 56.1 | 0 | 0 | 0 | 0 | escaped (80.1 s) | 1 | 6 |
| alpine | sprint | hard | poorRoute | 49 m @ 14.42 m/s | 2.8 | 82.6 | 59.8 | 41.9 | 12.7 | 5 | caught at 82.6 s | 0 | 17.2 |
| alpine | sprint | hard | slowArrival | 34.2 m @ 3 m/s | 33.7 | 47.9 | 12.1 | 0 | 0 | 0 | escaped (81.3 s) | 2 | 6.1 |
| fjord | sprint | hard | skilled | 38.8 m @ 14.02 m/s | 16.5 | 80.3 | 11.4 | 4.3 | 0 | 0 | escaped (84.8 s) | 0 | 22.3 |
| fjord | sprint | hard | competent | 35.4 m @ 12.1 m/s | 2.7 | 72.5 | 28.8 | 8.2 | 1.5 | 1 | caught at 72.5 s | 0 | 22.7 |
| fjord | sprint | hard | cautious | 33 m @ 11.3 m/s | 2.8 | 12.4 | 10.7 | 3.5 | 1.4 | 1 | caught at 12.4 s | 0 | 6.8 |
| fjord | sprint | hard | crash | 38.8 m @ 14.02 m/s | 2.8 | 14.9 | 10.5 | 5.9 | 3.4 | 2 | caught at 14.9 s | 0 | 8.8 |
| fjord | sprint | hard | lateCrash | 38.8 m @ 14.02 m/s | 2.9 | 29.8 | 8.7 | 3.3 | 1.2 | 1 | caught at 29.8 s | 0 | 8.6 |
| fjord | sprint | hard | poorRoute | 37.9 m @ 13.22 m/s | 2.8 | 63 | 25.2 | 13.5 | 6 | 2 | caught at 63 s | 0 | 13 |
| fjord | sprint | hard | slowArrival | 19.8 m @ 3 m/s | 19.8 | 86.2 | 23.3 | 1.7 | 0 | 0 | escaped (86.2 s) | 0 | 21.4 |
| whiteout | sprint | hard | skilled | 40.8 m @ 14.22 m/s | 2.7 | 51.2 | 29.5 | 15.9 | 2.6 | 1 | caught at 51.2 s | 0 | 21.8 |
| whiteout | sprint | hard | competent | 39.6 m @ 13.41 m/s | 2.8 | 28.6 | 14.3 | 8.5 | 4.5 | 2 | caught at 28.6 s | 0 | 17 |
| whiteout | sprint | hard | cautious | 36.7 m @ 12.1 m/s | 2.8 | 12.6 | 9.6 | 3.5 | 1.3 | 1 | caught at 12.6 s | 0 | 7 |
| whiteout | sprint | hard | crash | 40.8 m @ 14.22 m/s | 2.9 | 11.2 | 5.8 | 2.5 | 1.1 | 1 | caught at 11.2 s | 0 | 5.1 |
| whiteout | sprint | hard | lateCrash | 40.8 m @ 14.22 m/s | 2.8 | 24.6 | 4.7 | 1.7 | 0.7 | 1 | caught at 24.6 s | 0 | 6.6 |
| whiteout | sprint | hard | poorRoute | 44 m @ 14.31 m/s | 2.8 | 34.1 | 17.2 | 8.8 | 4 | 2 | caught at 34.1 s | 0 | 26.8 |
| whiteout | sprint | hard | slowArrival | 25.6 m @ 3 m/s | 2.7 | 53.3 | 52.8 | 17.3 | 2.6 | 1 | caught at 53.3 s | 0 | 16.2 |

### Standard, Normal and Hard
| Location | Length | Diff | Player | start gap @ skier speed | min gap | s < 110 m | s < 45 m | s < 25 m | s < 13 m | lunges | outcome (chase s) | calls | CLOSING s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| alpine | standard | normal | skilled | 53.2 m @ 16.94 m/s | 53.2 | 9.8 | 0 | 0 | 0 | 0 | escaped (62.2 s) | 4 | 0 |
| alpine | standard | normal | competent | 48.9 m @ 14.48 m/s | 48.9 | 14.8 | 0 | 0 | 0 | 0 | escaped (70.3 s) | 5 | 0 |
| alpine | standard | normal | cautious | 43 m @ 11.55 m/s | 2.8 | 16.2 | 9.9 | 4.6 | 1.9 | 1 | caught at 16.2 s | 0 | 10.4 |
| alpine | standard | normal | crash | 53.2 m @ 16.94 m/s | 44.9 | 26.4 | 0.8 | 0 | 0 | 0 | escaped (67.5 s) | 3 | 6.9 |
| alpine | standard | normal | lateCrash | 53.2 m @ 16.94 m/s | 53.2 | 21.3 | 0 | 0 | 0 | 0 | escaped (67.8 s) | 4 | 4.6 |
| alpine | standard | normal | poorRoute | 40.5 m @ 8.95 m/s | 2.9 | 42.1 | 3.8 | 1.2 | 0.5 | 1 | caught at 42.1 s | 0 | 5.1 |
| alpine | standard | normal | slowArrival | 31.2 m @ 3 m/s | 30.7 | 19 | 3.6 | 0 | 0 | 0 | escaped (66.5 s) | 4 | 1.2 |
| alpine | standard | hard | skilled | 53.2 m @ 16.94 m/s | 53.2 | 13.8 | 0 | 0 | 0 | 0 | escaped (67.4 s) | 4 | 0 |
| alpine | standard | hard | competent | 48.9 m @ 14.48 m/s | 48.9 | 27.2 | 0 | 0 | 0 | 0 | escaped (73.6 s) | 4 | 1.7 |
| alpine | standard | hard | cautious | 43 m @ 11.55 m/s | 2.8 | 13.6 | 7.7 | 3.5 | 1.3 | 1 | caught at 13.6 s | 0 | 7.9 |
| alpine | standard | hard | crash | 53.2 m @ 16.94 m/s | 34.1 | 36.9 | 8.8 | 0 | 0 | 0 | escaped (71.7 s) | 3 | 11 |
| alpine | standard | hard | lateCrash | 53.2 m @ 16.94 m/s | 53.2 | 28.6 | 0 | 0 | 0 | 0 | escaped (69.9 s) | 3 | 5.7 |
| alpine | standard | hard | poorRoute | 40.5 m @ 8.95 m/s | 2.9 | 40.9 | 23.5 | 1.2 | 0.5 | 1 | caught at 40.9 s | 0 | 8.3 |
| alpine | standard | hard | slowArrival | 31.2 m @ 3 m/s | 30.7 | 32.7 | 3.6 | 0 | 0 | 0 | escaped (71 s) | 3 | 3.5 |
| fjord | standard | normal | skilled | 42.5 m @ 15.28 m/s | 42.5 | 73.8 | 1.8 | 0 | 0 | 0 | escaped (83.3 s) | 0 | 8.9 |
| fjord | standard | normal | competent | 38.9 m @ 13.17 m/s | 2.7 | 77.3 | 20.6 | 6 | 3.5 | 2 | caught at 77.2 s | 0 | 27.7 |
| fjord | standard | normal | cautious | 33.6 m @ 10.64 m/s | 2.8 | 15.3 | 11.9 | 4.1 | 1.6 | 1 | caught at 15.3 s | 0 | 9.3 |
| fjord | standard | normal | crash | 42.5 m @ 15.28 m/s | 9.6 | 88.3 | 21 | 11.7 | 4.9 | 2 | escaped (88.3 s) | 0 | 19.2 |
| fjord | standard | normal | lateCrash | 42.5 m @ 15.28 m/s | 40.3 | 89.5 | 9 | 0 | 0 | 0 | escaped (89.5 s) | 0 | 18.2 |
| fjord | standard | normal | poorRoute | 36.2 m @ 13.33 m/s | 2.7 | 56.1 | 24.7 | 10.2 | 0.9 | 1 | caught at 56.1 s | 0 | 13.7 |
| fjord | standard | normal | slowArrival | 22.4 m @ 3 m/s | 22 | 87.3 | 6.8 | 1.2 | 0 | 0 | escaped (87.3 s) | 0 | 9.2 |
| fjord | standard | hard | skilled | 42.5 m @ 15.28 m/s | 2.8 | 75.9 | 13.7 | 4.5 | 1.3 | 1 | caught at 75.9 s | 0 | 26.3 |
| fjord | standard | hard | competent | 38.9 m @ 13.17 m/s | 2.7 | 47.7 | 29.7 | 5.8 | 3 | 1 | caught at 47.7 s | 0 | 22.9 |
| fjord | standard | hard | cautious | 33.6 m @ 10.64 m/s | 2.9 | 13.2 | 10 | 3.2 | 1.1 | 1 | caught at 13.2 s | 0 | 7.2 |
| fjord | standard | hard | crash | 42.5 m @ 15.28 m/s | 2.9 | 12.8 | 7.1 | 3.2 | 1.3 | 1 | caught at 12.8 s | 0 | 6.6 |
| fjord | standard | hard | lateCrash | 42.5 m @ 15.28 m/s | 2.8 | 31.4 | 9.3 | 4.1 | 1.9 | 1 | caught at 31.4 s | 0 | 10.3 |
| fjord | standard | hard | poorRoute | 36.2 m @ 13.33 m/s | 2.8 | 34.4 | 26.7 | 4.6 | 1.1 | 1 | caught at 34.4 s | 0 | 12.9 |
| fjord | standard | hard | slowArrival | 22.4 m @ 3 m/s | 5.9 | 90 | 50.7 | 19 | 11.5 | 4 | escaped (90 s) | 0 | 26.4 |
| whiteout | standard | normal | skilled | 50.4 m @ 16.44 m/s | 50.4 | 57.7 | 0 | 0 | 0 | 0 | escaped (80.3 s) | 1 | 3.3 |
| whiteout | standard | normal | competent | 47.2 m @ 14.47 m/s | 47.2 | 64.8 | 0 | 0 | 0 | 0 | escaped (84.2 s) | 1 | 9.4 |
| whiteout | standard | normal | cautious | 42.3 m @ 12.05 m/s | 2.8 | 16.1 | 10.5 | 4.8 | 1.8 | 1 | caught at 16.1 s | 0 | 10.4 |
| whiteout | standard | normal | crash | 50.4 m @ 16.44 m/s | 25.2 | 69.9 | 11.2 | 0 | 0 | 0 | escaped (84 s) | 1 | 11.1 |
| whiteout | standard | normal | lateCrash | 50.4 m @ 16.44 m/s | 50.4 | 76.9 | 0 | 0 | 0 | 0 | escaped (84.8 s) | 0 | 10.2 |
| whiteout | standard | normal | poorRoute | 43.3 m @ 14.87 m/s | 43.3 | 91.7 | 0.7 | 0 | 0 | 0 | escaped (91.7 s) | 0 | 4.2 |
| whiteout | standard | normal | slowArrival | 32.9 m @ 3 m/s | 31.6 | 65.9 | 12.5 | 0 | 0 | 0 | escaped (84.1 s) | 1 | 6.4 |
| whiteout | standard | hard | skilled | 50.4 m @ 16.44 m/s | 50.4 | 67.2 | 0 | 0 | 0 | 0 | escaped (81.6 s) | 1 | 9 |
| whiteout | standard | hard | competent | 47.2 m @ 14.47 m/s | 16 | 81.5 | 26.7 | 15.3 | 0 | 0 | escaped (86.6 s) | 0 | 31.5 |
| whiteout | standard | hard | cautious | 42.3 m @ 12.05 m/s | 2.9 | 13.6 | 8.2 | 3.6 | 1.4 | 1 | caught at 13.6 s | 0 | 7.9 |
| whiteout | standard | hard | crash | 50.4 m @ 16.44 m/s | 15.2 | 85.9 | 15.2 | 8.3 | 0 | 0 | escaped (85.9 s) | 0 | 19.2 |
| whiteout | standard | hard | lateCrash | 50.4 m @ 16.44 m/s | 38.6 | 87.1 | 29.2 | 0 | 0 | 0 | escaped (87.1 s) | 0 | 16.4 |
| whiteout | standard | hard | poorRoute | 43.3 m @ 14.87 m/s | 2.8 | 75.1 | 27 | 11.3 | 4.6 | 2 | caught at 75.1 s | 0 | 23.5 |
| whiteout | standard | hard | slowArrival | 32.9 m @ 3 m/s | 31.6 | 78.9 | 15.6 | 0 | 0 | 0 | escaped (86.8 s) | 0 | 15.7 |
