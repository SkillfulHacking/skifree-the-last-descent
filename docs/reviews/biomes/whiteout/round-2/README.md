# Whiteout Ridge — review round 2

**Candidate:** see `CANDIDATE.md`. Six isolated, model-based reviewers (A–F as in round 1), each comparing round 1 with round 2. They are not human playtesters.

## Evidence (all on the candidate)
| What | Where |
|---|---|
| Visual suite, 1280×720 SwiftShader, every run's course id verified (`manifest.json` → `runs[].verified`). Weather phases, vistas, **gameplay-camera rim shots (27–29)**, cave, storm chase, Hard snowball in fog, station, victory beats | `evidence/` |
| The whole rescue cinematic, one frame a second, 0.5–23.5 s (960×540) | `strip/` |
| Balance, round 2: tuning and held-out seeds, every policy, Alpine/Fjord with the same driver | `../balance/round2/README.md` and its `.jsonl` |
| Per-drift-row measurement (gap line vs plough vs jumps) | `tests/sim/driftRow.measure.test.ts` (figures in the balance README) |
| Course matrix with the Relaxed outcome gate | `courses.json` |
| Browser suite | `e2e.txt` |
| CPU frame cost vs Alpine/Fjord (R1 → R2), scene census, Endless memory, audio (GPU timing unavailable) | `perf/README.md` and `audio.json` |
| Defect tracker (developer claims) | `../DEFECTS.md` |

## Frame notes, as checked against the images by the developer
The manifest's notes say what each shot was *framed* to show. These corrections and observations come from looking at the frames themselves:
- **16_storm_chase** — storm light and the blizzard caption are on screen, but the Yeti is 114 m back, not 18–34 m (the manifest's own `gap false`). **17** therefore shows no close silhouette either.
- **23_v_yeti_white / 24 / strip 9.5–12.5** — the Yeti in the white past the hut and close in the light. No visible searchlight beam on him at this resolution.
- **25_v_break** — the Yeti is still visible, leaving, at 16 s.
- **26_v_reveal** — station in the lower right, ridge and course behind it. HUD and title are hidden by the capture tool (it hides the HUD), so the title and letterbox are **not** shown in the stills.
- **12_cave_mouth** — the new wind cornice sits over the opening, rime feathers below it, a spindrift sheet in the mouth.
- **05_storm / 28** — grey, flat storm light, horizon lost. Near terrain and markers are still readable.
- **29** — two orange gap panels at the row ~95 m ahead in a storm.

## Limits of this evidence
- SwiftShader at about 1 fps: motion, pacing and audio are not visible in stills.
- The headless driver sees through fog, so the human cost of low visibility is not measured.
- No GPU timing.
