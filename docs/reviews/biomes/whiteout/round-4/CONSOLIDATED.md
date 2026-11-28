# Whiteout Ridge, round 4 consolidation (frozen source `71c9ceb`)

**Result: FAIL.** No owned category reached 9/10.

Owned scores: A 6 / 6.5, B 8.5 / 8, C 8, D 7.5, E 8.5, F 7.5.

There are no Critical findings. There are eight merged Major themes (below). PR #9 stays a draft: it is not merged or deployed.

Each reviewer's report (`REVIEW_{A_art,B_physics,C_cinematics,D_tech,E_qa,F_critic}.md`) is the reference. This file merges duplicates and orders the round-5 work. New ids continue in `../DEFECTS.md`.

The reviewers are model-based, not human playtesters. Nobody judged motion at 60 fps, audio or rumble. GPU time is unmeasured (SwiftShader).

Reviewers got no expected scores. Every score below is as written by its owner: nothing was adjusted, averaged or re-asked. Reviewer F did not read the other round-4 reports. Reviewers ran in isolation on the frozen tree, while evidence captures were still running.

## Scores, round 3 → round 4 (owner's score in bold; others are low confidence)

| Category | Owner | R3 | R4 | Others (lc) | Main reason it is not 9 |
|---|---|---|---|---|---|
| 1 Visual art direction | A | 6 | **6** | 6.5–7.5 | The ridge drop is implied, not shown; the fog sheet at the vanishing point; aerial perspective washes out the dark valley floor |
| 2 Environmental uniqueness | A | 6 | **6.5** | 6.5–8 | The cloud sea is now Whiteout's own, but the foreground reads as Alpine and the spires are unchanged |
| 3 Skiing and hazard mechanics | B | 7 | **8.5** | 6–8 | The stance barely pays; documentation still wrong |
| 4 Difficulty and fairness | B | 7 | **8** | 7–7.5 | Hard overshoots the owner's ranges (Whiteout reader Hard easier than Fjord Hard); Normal is pressure-free for a competent weather reader (F) |
| 5 Cinematics | C | 7.5 | **8** | 6.5–7.5 | The searchlight beat is still unreadable (third round); Alpine's leap is pale on pale |
| 6 Performance and stability | D | 8 | **7.5** | 7–7.5 | W-086 targets never measured; Whiteout `high` got worse (frames over 16 ms 10 → 22; software render 2.10× Alpine) from the rim-band rocks and the cloud-sea shader |
| 7 Accessibility and controls | E | 8 | **8.5** | 6–8 | New accessibility behaviours untested; RUN. probably over the skier at UI 150% (double scaling) |
| 8 Overall player experience | F | 7 | **7.5** | 6.5–8 | Normal has no chase pressure; the Yeti is tiny and only in the inset; the victory frames do not deliver; the ridge does not read |

### Focused verdicts
- **W-065 (drop immediately recognisable): FAIL** (A; F agrees).
  - Clear frames now read as "high above a sea of cloud" after study (5 of 6), but the edge is not drawn.
  - Storm frames give no cue at all.
- **W-093: partial** (A).
- **Owner's decision A: partly met** (B).
  - Every Classic Hard course is won in all three locations.
  - Normal is far more forgiving than Hard for a competent skier.
  - No Yeti speed change, rubber-banding or boost.
  - The weather-reading advantage holds on Hard.
  - Hard overshoots the provisional ranges. On 40 fresh seeds: Whiteout reader 88% Sprint and 73% Standard, Alpine 83% and 78%, Fjord 65% and 50%.
  - No inevitable loss was found: every clean loss had a winning variant. But nothing guards against one.
- **Owner's decision B: meets the decision** (E, C). Minor test gaps remain (pause-menu restart and exit; seed, length and difficulty changes).
- **W-076 parity: holds** (C, E).
- **Verified fixed:**
  - W-078 (edge crashes 481 → 21 of 1,422);
  - W-081 (0 of 728 gusts flip; 0 wrong captions in 66);
  - W-087 (rating C → B);
  - W-089, W-092 (lunge reset), B3-2;
  - the capture-tool spray puff;
  - test changes after the freeze are legitimate (E).

### Discrepancies recorded
- **`dev/art/README.md` says "the game's spray is unchanged".** True only of `71c9ceb`. Earlier round-4 commit `3ba0d83` did change the spray and the landing burst (F4-6). Corrected in that README.
- **`CANDIDATE.md` said every manifest records `6ff50f9`.** Five record `0787168`. The source is identical; the text is corrected.
- **Manifest notes still contradict images (C4-7, E4-7, F4-6):**
  - 15 "the leap": no Yeti in frame;
  - 20 "letterbox": no bars;
  - 21 "skier arriving": no skier;
  - 22 "halo": no halo;
  - 23 "past the skier and lantern": neither in frame;
  - 24 "searchlight beam, flinching": neither visible;
  - victory Yeti distance stale (2,495 m).
- **The Whiteout tension run was not repeated after decision A** (F4-1). The tension data is Alpine only.
- **SonarCloud's B rating:** the single vulnerability is still unidentified. The proxy blocks sonarcloud.io, and none of the 26 annotations is a vulnerability. D's unverified guess is `tools/tension_summary.py`.

## Merged findings → Round 5 work order

Order: release blockers for the gate first, then cost and polish.

| New id | Sev | Theme | Raised by | Evidence (summary) | Direction |
|---|---|---|---|---|---|
| W-065 | **M** (open) | Ridge drop not shown | A4-1, A4-2, A4-3, A4-4, F4-4 | 0/11 gameplay frames immediate; wands, flags and rim band invisible from the camera (bank hides them; orange pixel search finds none); the fog sheet at the vanishing point reads as a glitch; aerial perspective makes the floor (130–160) lighter than the shaded piste | A dark icy band and a spindrift plume at the lip, a dark gulf just past it; place cues where the camera sees them (verify by render, not geometry); fix or redesign the blizzard telegraph sheet; keep the floor dark at line distances; capture the closest approach |
| W-094 | **M** | Hard overshoots provisional ranges | B4-1, F4-5 | 40 fresh seeds: Whiteout reader 88% / 73%; Alpine 83% / 78% (targets 50–75% / 25–50%); Whiteout Standard easier than Sprint | Owner decides whether the ranges hold. If so, scale back the Whiteout package and Alpine ×1.05 on Hard only (Hard-specific environment strength), validate on fresh seeds with several drivers, and keep Classic Hard winning with margin |
| W-095 | **M** | Normal pressure-free for a competent weather reader | F4-1 | Before/after: Normal Standard 7/13 → 13/13; tension re-run caught 0/7, CLOSING 0 s | Re-run Whiteout tension; owner decides whether Normal should carry pressure; if so make the decision-A environment changes difficulty-scoped |
| W-083 | **M** (open, third round) | Searchlight beat unreadable | C4-1, F4-3 | No beam after contrast stretch; "flinch" is the disgust pose | Darken around the light during the beat; beam with normal blending or lit snow; a hard pool at his feet; a real recoil animation; `toneMapped:false` on warm materials (C4-4) |
| W-082 | **M** (open) | Yeti legibility | C4-2, F4-2 | Alpine leap about 15 px on pale rock; storm chase 15 px at 28 m, 3–4 px at 75 m; never in the main view; no inset after the leap on Low | Longer inset lens (≥ 40 px inside 60 m), an outline or rim, a cheap inset on Low, a backdrop check per cave |
| W-096 | **M** | Whiteout `high` perf regressed; W-086 unmeasured | D4-1, D4-2, D4-3 | Frames over 16 ms 10 → 22; render 2.10× Alpine; rim rocks 641 → 1,316 full scans, no LOD on any preset; cloud-sea noise doubled | LOD or impostor for the rim band; cheaper cloud-sea noise; measure triangles, shader links and the largest dressing slice against the W-086 targets in a perf README |
| W-097 | m | Evidence notes and harness | C4-7, E4-7, F4-6, A4-8 | Notes listed above; stale victory distance; no capture at the rim's closest approach | Write notes from the image (or generate them from manifest facts); fail on a missing subject; add a closest-approach shot |
| W-098 | m | Accessibility follow-ups | E4-1 to E4-6, E4-8 | RUN. double-scaled at UI 150%; no tests for vibration, flash reduction, aria-live, live Reduce Camera Motion or FRONT_QUIET; Reduce Camera Motion gaps; Reduce Weather weak at peak; lamps pulse with reduce-flashes on; `cave_skip` measured against world +Z; sub-frame Space tap dropped | As listed in REVIEW_E |
| W-099 | m | Code health and perf minors | D4-4 to D4-7, D4-9, D4-10 | No `try/finally` in storm-cave generators; shared spindrift scroll double speed; mid-run compiles; no perf README | As listed in REVIEW_D |
| W-087 | m (reopened) | SonarCloud B | D4-8 | One unidentified vulnerability | Owner opens it in SonarCloud; then fix (drop the argument-to-file mapping) or exclude `tools/**` with a written rationale. No dismissal |
| W-059 / W-091 / misc | m | Carried minors | B4-3, B4-4, B4-5, C4-3, C4-5, C4-6, A4-5–7, A4-10, F4-7 | Stance barely pays; stale comments; set-up skier cropped (test measures an upright head); pole in the lantern hand; small reveal; saucer-shaped peaks; sawtooth card; kerb cornice; spires; cave primitives | As listed in the reports |

## Owner questions
1. **Hard ranges (W-094):** are the provisional ranges firm? If so, the round-4 Whiteout package and Alpine's pace are too strong on Hard.
2. **Normal pressure (W-095):** should a competent weather reader feel the Yeti on Whiteout Normal? Round 4 removed all pressure there.
3. **SonarCloud (W-087):** please open the remaining vulnerability on SonarCloud. It cannot be read from this environment.
