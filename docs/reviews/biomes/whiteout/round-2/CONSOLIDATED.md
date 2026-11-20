# Whiteout Ridge — round 2 consolidation (candidate `b70a793`)

**Result: FAIL.** No owned category reached 9/10: A 6/6, B 7/6, C 6.5, D 7, E 7, F 5. One Critical (W-056). Each reviewer's report (`REVIEW_{A_art,B_physics,C_cinematic,D_tech,E_qa,F_critic}.md`) is the reference; this file merges duplicates and orders the round-3 work. Defect ids continue in `../DEFECTS.md`. Model-based reviewers, not human playtesters.

## Scores, round 1 → round 2 (owner's score in bold; others low confidence)

| Category | Owner | R1 | R2 | Main reason it is not 9 |
|---|---|---|---|---|
| 1 Visual art direction | A | 5 | **6** | Storm dome vs fogged ground still a horizon step; cave dressing reads as primitives; driven snow not seen |
| 2 Environmental uniqueness | A | 6 | **6** | The gameplay camera never sees the drop (line ≥ 37 m from the rim); cave still Alpine's mesh |
| 3 Skiing and hazard mechanics | B | 5 | **7** | Drift gaps pay; blizzard stance ±0, the lee is negative, a clipped jump is cheaper than ploughing |
| 4 Difficulty and fairness | B | 4 | **6** | Default course (CLASSIC-SPR@WHITE) Normal lost by every policy; Normal Standard a cliff; Hard Standard never won |
| 5 Cinematics | C | 5 | **6.5** | Skier stops ~20 m short of the porch; plinth flies with the lantern; door, beam and flinch don't read; wind doesn't drop |
| 6 Performance and stability | D | 6 | **7** | CPU fixed (median 7.5 → 0.7 ms); ~5× Alpine's triangles from scanned boulders; 53–67 ms cave-dressing hitch in Endless |
| 7 Accessibility and controls | E | 6 | **7** | Blizzard push direction disagrees with the HUD arrow half the time; a warning can be accepted and never shown |
| 8 Overall player experience | F | 5 | **5** | The default first run is a guaranteed loss; the caption coaches the losing move; the storm still reads as overcast |

Regressions reported: the cave-dressing hitch (D N-2, new code); the stale storm caption into CLEARING (A N8); the plinth flying (C N-2, new staging). No save regression in the tested build (E N3: the later `saveSettings` change was never in the tested `dist/` and is reverted, `de74eaa`).

Discrepancies between reviewers and developer documents (recorded, not adjudicated by score):
- E N2/N3: `CANDIDATE.md` said `src` unchanged after `b70a793`; `68aba34` changed `src/core/settings.ts`. The e2e suite served `dist/` built from `b70a793`, so the tested build was the candidate; the `src` change is reverted. `e2e.txt` corrected.
- C N-3/N-5: the door, lantern and searchlight never moved in the captures — the capture harness stepped the session but not the finish (`App` updates it in play). Reviewers judged the captures correctly; the harness was wrong (fixed for round 3).
- A/F: manifest notes that do not match their images (21, 17); the evidence set never used the default course.

## Merged findings

| Id | Sev | Theme | Raised by | Evidence (summary) | Direction |
|---|---|---|---|---|---|
| W-056 | **Critical** | Default course unwinnable on Normal | F N1, B N2 | CLASSIC-SPR@WHITE Normal: all 16 policies caught; 580 m at the 11° slope floor where a front holds a tucked skier at 12–14 m/s (< Yeti 16.5) | Course geometry/weather, not the Yeti; gate Classic Normal |
| W-057 | M | Caption coaches the losing move | F N2, B N3, E | Front caption names the lee; informed +lee 17/24 vs 22/24 without (W-055) | Stop advising the lee until it pays |
| W-058 | M | Blizzard alerts consumed 150–233 m out | B N1 | Phase recorded beyond alert range (`environment.ts:363-370`) | Record the phase only inside alert range |
| W-059 | M | Blizzard stance worth ±0 | B N3, F N3 | Driver re-tucked 10 m past the cell centre (knock reaches ~51 m) — a measurement bug — and the stance still did not pay with it fixed | Fix the driver; re-measure; give the stance a measured benefit or stop advising it |
| W-060 | m | Clipped jump cheaper than ploughing | B N4 | Timed (clipping) jump −0.17 s/row vs plough | Clip cost ≥ plough; caption the clip |
| W-061 | m | Opposite-side gaps in close succession | B N5 | W034-05, W2H-18 Relaxed | Same side for rows < 150 m apart |
| W-062 | m | Drift readability/teaching | B N6, F | Skier drawn inside the mound; flags not taught | Clip the skier draw; teach the flags once |
| W-063 | M | Victory staging | C N-1…N-8, A N7 | Skier halts ~20 m short (hockey stop at 22 m); plinth flies; Yeti 16.5 m/s on a walk cycle; victory wind from the live front; Yeti pops out in frame; dead crane frame | Stop on the mark; fly the lantern only; walk-in pace; wind from the staged storm; hide out of view |
| W-064 | M | Horizon value step in a storm | A N1, F | Sky/dome (185,188,190) vs fogged ground (199,208,221) | Dome and fog resolve to the same displayed colour; dome opaque at full storm |
| W-065 | M | Ridge not seen from play (W-041 not fixed) | A N2, F | Line never within 37 m of the rim | Rim stretches near the line; darker void; gameplay-camera evidence |
| W-066 | M | Cave dressing reads as primitives | A N3, F, C | Grid "digital rain", bunting feathers, slab cornice | Non-periodic spindrift, clustered blades, scalloped cornice |
| W-067 | m | Driven snow not visible in stills | A N4 | No streaks in 05/16/28/29 | Isolate and verify; value contrast |
| W-068 | m | Art minors | A N5, N6, N8, R1-8; E E9 | Terrain seam in the reveal; snow "pucks"; storm caption into CLEARING; lamps white and in unison | As listed |
| W-069 | M | Scanned boulders ~5× Alpine's triangles | D N-1, F | 5,000-tri scans in the whole near ring, all casting shadows | LOD per preset; procedural on low; re-measure |
| W-070 | M | Cave-dressing hitch (Endless) | D N-2 | 29 Raycasts on a 41.5k-tri mesh: 75–120 ms | Pre-gathered brow triangles / slice the build |
| W-071 | m | Perf minors | D N-3, N-4 | Clear zones uncached (3–24 ms slices); per-grain allocations; rime not disposed | Cache per band; in-place writes; dispose |
| W-072 | M | Blizzard push direction vs HUD; warnings lost | E N1, E10 | Cell `dir` is a coin flip (half push against the arrow); a warning within ~2.9 s of a front caption is marked warned and never shown | Push follows the front in a storm; mark warned only when shown; longer queue life |
| W-073 | M | QA: candidate/test integrity | E N2, N3, C N-10, F | `src` changed after the candidate; poles/scenic not run; notes vs images | Re-freeze; full suite on the frozen build; notes written from the images |
| W-074 | m | Accessibility minors | E E7, E8, minors | Amber pill 3.8:1; no flash reduction on new effects; no capture of the a11y features | Contrast, flash reduction, captures |
| W-075 | M | Measurement honesty | F N3, B | The driver reads drift rows through any fog at 95–110 m | Perception limited to what the storm shows |

## Order of work (round 3)
1. **Fairness:** W-056 (with Classic gated), W-057, W-058, W-059, W-060, W-072, W-075; re-measure informed vs blind on fresh held-out seeds (W3H) and on Classic, with the fog-limited, fixed driver.
2. **Victory:** W-063, plus the capture harness (finish updates in captures).
3. **Performance:** W-069, W-070, W-071; re-measure frames and triangles.
4. **Art:** W-064 (measured with a gameplay-camera probe), W-066, W-068, W-065, W-067.
5. **QA:** W-073 — a new frozen candidate, the whole e2e suite on that build, evidence with notes written from the images, a default-course capture.
