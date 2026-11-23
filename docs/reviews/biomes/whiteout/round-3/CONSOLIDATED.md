# Whiteout Ridge — round 3 consolidation (candidate `46ed200`)

**Result: FAIL.** No owned category reached 9/10. Owned scores: A 6/6, B 7/7, C 7.5, D 8, E 8, F 7.

There are no Critical findings. The W-076 focused verdict is **PASS** from all four focused reviewers (B, C, E, F). The W-065 verdict is **FAIL** from Reviewer A, against the owner's bar "immediately recognizable".

Each reviewer's report (`REVIEW_{A_art,B_physics,C_cinematics,D_tech,E_qa,F_critic}.md`) is the reference. This file merges duplicates and orders the round-4 work. Defect ids continue in `../DEFECTS.md`.

The reviewers are model-based, not human playtesters. Nobody judged motion at 60 fps, audio or rumble, and GPU time is unmeasured (SwiftShader).

Reviewers got no expected scores. The scores below are as written by their owners: nothing was adjusted, averaged or re-asked.

## Scores, round 2 → round 3 (owner's score in bold; other reviewers' scores are low confidence)

| Category | Owner | R1 | R2 | R3 | Others (lc) | Main reason it is not 9 |
|---|---|---|---|---|---|---|
| 1 Visual art direction | A | 5 | 6 | **6** | 6.5–7 | The drop is not recognisable from play; the cloud deck is the colour of shaded piste; the deck's near edge is hard and stepped; a spray puff hides the skier |
| 2 Environmental uniqueness | A | 6 | 6 | **6** | 6.5–8 | The clear-weather ridge still reads as Alpine; no signature vista (Fjord has the sea); spires read as boulders |
| 3 Skiing and hazard mechanics | B | 5 | 7 | **7** | 6–7 | New: the W-065 roll-down leaves a slope break at the drop-side piste edge (crashes for a skier who strays past the edge and steers back: 154 → 481 of 1,422); the blizzard stance changes no outcomes |
| 4 Difficulty and fairness | B | 4 | 6 | **7** | 6–7 | W-077 was never measured on Hard (Alpine Hard Sprint 9/12 → 6/12, Hard Standard 3/12 → 0/12); Whiteout default Hard Sprint is lost by every policy; Hard Standard is about 0 everywhere |
| 5 Cinematics | C | 5 | 6.5 | **7.5** | 6–7.5 | The leap is a smudge in the inset and the landing is never seen; the searchlight-on-Yeti victory beat is unreadable; the set-up shot is weak |
| 6 Performance and stability | D | 6 | 7 | **8** | 7 | A 22 ms cave-dressing slice; the shadow pass is 2× Alpine's; shader programs compile mid-run; the SonarCloud gate is red |
| 7 Accessibility and controls | E | 6 | 7 | **8** | 6–7.5 | 11 of 120 blizzard warnings name the wrong side; no captures of Reduce Weather or UI 150%; Reduce Camera Motion is not live mid-cinematic |
| 8 Overall player experience | F | 5 | 5 | **7** | 6–7.5 | The leap barely shows; Hard on the default course cannot be won; the clear ridge view is the weakest image |

### Focused verdicts

| Item | B | C | E | F | A |
|---|---|---|---|---|---|
| W-076 (watched = skipped, forward camera at control, no automatic look-back, presentation-only tension) | PASS | PASS (final staging) | PASS (forward visibility and the controller independently verified) | PASS | — |
| W-065 (drop immediately recognizable, line unmoved) | line and piste bit-identical, but a new slope break (Major) | — | — | not recognisable (agrees with A) | **FAIL**: 0/8 immediate in the blind review |

E's own probe covered 36 hand-offs across 3 locations, 2 difficulties, 3 arrival speeds and with or without input:
- the first frame looks downhill (dir.z 0.978–0.989);
- dir.z never falls below 0.904 in 6 s;
- the skier is always in frame.

C measured camera turn from the strip manifest:
- at most 1.2° per 0.27 s after control returns;
- the letterbox is open by 15.4 s, before control at 15.8 s.

### Discrepancies recorded (not adjudicated by score)

- **W-056 row count (B3-2):** the developer docs claim 829 of 833 W-056 rows unchanged after W-065; the actual figure is 824. The stated cause of the two driftsOnly outcome flips is wrong: the roll-down reshuffled on-piste obstacles through the per-band random stream, and those runs hit a tree and a boulder well inside the piste.
- **SonarCloud rating (D3-5):** `CANDIDATE.md` says the security rating is D; it is C. The cause is a path-traversal issue at `tools/tension_summary.py:12`, not the `/tmp` defaults that round 3 fixed.
- **W-059 status (B3-5):** "+1/+3 wins alone" predates the W-056 rule. The stance now changes no outcomes (+0/−0); it only cuts knocks by about 4×.
- **W-074 claim:** it says the accessibility captures are in the round-3 evidence. They are not: there are no Reduce Weather or UI-150% captures.
- **Manifest notes (C R3-C10, F7):** the notes still contradict the images.
  - Frame 15 ("the leap") has no Yeti in it.
  - Frame 16 shows YETI 117 m with no inset; the harness logged `gap false` and kept going.
  - Frame 24 claims a searchlight beam that is not in the frame.
- **`cave_skip` test (B):** the unit and sim skip tests would pass even if the game path were wrong. Only the browser test `cave_skip` proves parity.

## Merged findings (new ids continue in `../DEFECTS.md`)

| Id | Sev | Theme | Raised by | Evidence (summary) | Direction |
|---|---|---|---|---|---|
| W-065 | **M** (open) | Ridge drop not recognisable | A 1–4, F4 | Blind review: 0/8 immediate, 2/8 after study, storms 0/4. Deck ≈ (114,131,158) vs shaded piste (107–133,126–153,153–181). Stepped "cut paper" near edge. Rim wands 1–2 px at 40–50 m; cornice hidden behind the lip | Sunlit billow tops lighter than the snow, a dark gulf or spindrift plume between lip and deck, a soft deck edge, a visible cornice or edge band. Capture frames at the line's closest approach; re-review blind |
| W-078 | **M** (new, regression) | Slope break at the drop-side piste edge | B3-1 | Edge probe, 1,422 cases per build: crashes 154 → 481; even 0–1 m past the edge 3 → 28 of 195. The slope changes ~14° at the edge vs ~4° before. The balance drivers never get within 5 m of the edge | Make the transition into the roll-down smooth (no slope break); edge-probe regression test in `tests/sim` |
| W-079 | **M** (new) | W-077 pace not checked on Hard | B3-3 | Alpine Hard Sprint 9/12 → 6/12, Hard Standard 3/12 → 0/12 (skilled driver, 12 held-out seeds). ×1.10 also misses its own Standard late-crash target (46 m); ×1.05 gives the same Normal Sprint crash result with less damage on Hard | Re-run the alternatives across both difficulties; choose the smallest pace that meets the Normal targets without collapsing Hard. Decide the Hard target first (W-080) |
| W-080 | **M** (new) | Hard is not winnable | B3-4, F2, F6 | Whiteout default Hard Sprint: every policy caught; a flawless reader averages 15.1 m/s vs the Yeti's 17.7. Hard Standard ≈ 0 everywhere (Alpine 0/12, Fjord 1/12, Whiteout 0/12). Clean reader caught 5/7 on Whiteout seeds vs 1/7 on Fjord and Alpine | **Owner decision needed:** what a clean, expert Hard run should achieve. Then tune Whiteout Hard storm cost (not the Yeti) to match |
| W-081 | **M** (new; supersedes the rest of W-072) | Blizzard push vs caption direction | E F1, B3-6 | 11/120 warnings name the wrong side; in 3 cells the push reverses inside the cell. The push is recomputed every step and flips at 30% storm strength. The HUD arrow agrees 63/64 | Latch one direction per cell at first warning; use it for the caption, push, HUD and wind. Unit test across storm thresholds |
| W-082 | **M** (new; from C R3-C1, carried) | The Yeti's leap is not legible | C R3-C1, R3-C5, F1 | In the inset he reads only against the cave mouth (frames 07–08), then is a pale 8–12 px smudge on Alpine and Whiteout. The landing (~2.1 s) is in no frame. No image of the leap on Low quality or with the inset off | Offset the inset camera from the leap line; rim or outline the airborne Yeti; drop the inset fade-in; a landing beat visible in the main view or an inset on all presets. Extend the strip to 3 s |
| W-083 | **M** (W-063 remainder) | Victory beats still unreadable | C R3-C7, R3-C9 | Fixed and confirmed: porch stop, lantern only. Still open: no beam, pool or rim light on the Yeti (24); the crane opens on a roof corner (25); the final reveal shows the back of the station with no characters (26); flat beige doorway; snow pucks; pole in the lantern hand | As listed; frames judged against their notes |
| W-084 | **M** (new; QA and evidence) | Evidence harness integrity and coverage | C R3-C10, F7, E F2, D3-6 | Notes contradict images (15, 16, 21, 24); the harness continues after `gap false`; no Yeti position or visibility recorded; no storm frame with the Yeti inside 40 m; no Reduce Camera Motion, Reduce Weather, UI-150% or other-resolution captures; perf JSON lacks SHA and preset; no `low` perf run | Fail the harness when a set-up step fails; record Yeti distance and on-screen size; write notes from the image; add the accessibility captures and a `low` perf run |
| W-085 | m | Crowded opening; presence cues | C R3-C3, R3-C4, F5, F8 | On the default seed a storm front arrives at the hand-off: RUN., the inset, a STORM IN 3 s chip and a two-clause caption at once. RUN. overlaps the inset by 12–18 px at 1280×720 and 1366×768 with UI 1.5. CLOSING shows for 21.5 s on a clean run; the distant-call caption is dropped under another caption | Hold front alerts for ~3 s after control (alerts only, not the weather); move RUN. clear of the inset at every UI scale; review the CLOSING hysteresis |
| W-086 | m | Perf residuals | D3-1, D3-2, D3-3 | Storm-cave dressing ~22 ms in one slice. Shadow pass 2.05× Alpine on `high` (ridge rocks and spires are full 5k-triangle scans, all casting; `ultra` keeps full scans). 13 program links in 12 km | Slice `dressSteps`; coarse LOD and fewer shadow casters; warm materials at load. Targets in REVIEW_D |
| W-087 | m | SonarCloud gate red | D3-5 | "C Security Rating on New Code": path traversal at `tools/tension_summary.py:12` | Resolve under a fixed root (basename + constant directory), or exclude `tools/**` with a recorded rationale. No dismissing |
| W-088 | m | Accessibility minors | E F3, F4, F7, F2 | Reduce Camera Motion toggled mid-cinematic has no effect until the next one; it leaves the opening crane and rear-view zoom untouched. "Reduce flashes" is ignored by the beacon, light bar and storm eye glow. No vibration toggle (new landing rumble). No `aria-live` on captions. Reduce Weather Effects no stronger than in round 2 | As listed |
| W-089 | m | Weather-reading value and measurement gaps | B3-5, B3-7, B3-8 | Stance +0/−0 (W-059 stale). W-056 drops ~30% of blizzard cells undocumented (3.10 → 2.25 per run). The headless sim never streams hazards ahead (`env.stream(z)` missing); with streaming W-058 passes in game (min warning 4.3 s) | Give the stance a measured payoff or stop advising it; document the cell drop; add hazard streaming to `simulate.ts` and re-run the published tables |
| W-090 | m | Test strength | E F5, F6, C R3-C2, R3-C6, B, D3-7 | `game.spec` intro check depends on a live frame (flake under load). `cave_skip` treats dir.z > 0.3 as forward (passes 72° off) and logs no measurements. The set-up test checks a fixed 1.5 m head on a crouched skier. The set-up lift is not tested. The unit and sim skip tests are blind to the game path | `framesLive`; dir.z ≥ 0.9 with logged values; test the posed skier's head; test the lift; a game-path parity unit test |
| W-091 | m | Set-up shot weak | C R3-C2, R3-C6 | Skier a thin red sliver on the bottom bar (helmet touches it on Fjord); Yeti 27–47 px and just stands; the terrain-clearance lift aims at the old target | Aim lower or FOV 32–34; frozen crouch at the gather; fix the lift aim |
| W-092 | m | Doc errors and small code issues | B3-2, B3-9, D3-5 | 829 vs 824; wrong flip explanation; SonarCloud D vs C; comments still false after three rounds; the Yeti lunge cooldown is not reset between chases | Correct the docs; reset the lunge cooldown in the encounter start, with a test |
| W-093 | M | Clear-weather uniqueness | A uniqueness, A6, F4, C (cave) | Clear frames read as Alpine (rocky, tree-dotted slope plus a bowl). Spires read as low boulders and vanish in storms. "Breaking wave" fog shape; sawtooth far ranges; cave rime like crumpled paper and a slab cornice | A signature clear-weather ridge vista that only Whiteout has; spires tall enough to read as towers; carry W-066 into the cave close-ups |

### Owner questions raised by reviewers

1. **Hard target (W-080):** should a clean expert win Hard Sprint and Hard Standard on Whiteout's default course? Round 2 measured Fjord Hard Standard at 0/24 too. The answer sets the target for W-079 and W-080.
2. **Cinematic "seen" flag (E):** the flag is shared by all locations. A player who has seen Alpine's cave can skip Whiteout's storm-cave version on its first showing, because Escape pauses only on a never-seen cinematic. Is that intended?

## Status changes recorded in `../DEFECTS.md`

- **W-076:** VERIFIED (B, C, E, F, on `46ed200`).
- **W-056, W-057, W-060:** VERIFIED on Normal (B).
- **W-058:** VERIFIED in the game (B, with streaming); the sim gap is tracked in W-089.
- **W-069, W-070, W-071:** W-069 and W-070 largely fixed, W-071 VERIFIED; residuals in W-086 (D).
- **W-072:** the HUD half is verified (63/64); the rest moves to W-081.
- **W-077:** VERIFIED on Normal; Hard is reopened as W-079.
- **W-063:** partly verified; the remainder moves to W-083.
- **W-074:** contrast VERIFIED; the captures are missing (W-084).
- **W-059:** OPEN (stale).
- **W-065:** FAILED review.

## Round 4 work order (prioritised)

The standing constraints still apply:
- no global Yeti speed change, no catch-up retuning, no rubber-banding;
- the canonical start and the W-076 camera decisions stay;
- no moving the racing line;
- no destructive Git;
- PR #9 stays a draft and is neither merged nor deployed.

1. **Fix the round-3 regressions first, each with a regression test:**
   - W-078: smooth the transition into the roll-down; an edge-probe sim test with B's 1,422-case probe as the baseline. Then re-verify that W-056 holds and that the line is bit-identical.
   - W-081: latch the blizzard direction per cell.
   - W-087: make the SonarCloud gate green by fixing the path handling.
2. **Get the owner's decision on the Hard target (W-080).** Then re-run the W-077 alternatives (×1.05 / ×1.10 / others) across Normal and Hard together (W-079), and tune Whiteout Hard storm cost only if the decision requires it. Publish before/after tables for 3 locations × Normal/Hard × Sprint/Standard, on held-out seeds, with hazard streaming in the sim (W-089).
3. **W-065 ridge drop, then W-093 uniqueness:**
   - the deck's colour against the snow (lighter billow tops over a dark gulf), a soft near edge, a visible edge band or cornice, and a fix for the spray puff;
   - frames at the line's closest approach, clear and storm, at 1366 and 1920;
   - a fresh blind art review (a new reviewer instance, key withheld).
4. **W-082 leap legibility and W-083 victory beats.** Capture the strip to 3 s so the landing is in frame, and the victory with notes written from the images. C reassesses.
5. **W-084 evidence and QA:**
   - the harness fails on set-up errors and records Yeti distance and visibility;
   - accessibility captures (Reduce Camera Motion, Reduce Weather, UI 150%, Low quality);
   - a `low` perf run, with SHA and preset in the perf JSON;
   - the W-090 test fixes.
6. **W-086 perf residuals** (slice the dressing, LOD and shadow casters, warm shaders), then re-measure against D's targets.
7. **Minors:** W-085, W-088, W-089 (stance), W-091, W-092, plus the open older items (W-055, W-059, W-061, W-062, W-064, W-066, W-067, W-068).
8. **Re-freeze, run the full suite and all six reviewers** on one SHA, each owning their score; gate 9/10 in all 8 categories.
