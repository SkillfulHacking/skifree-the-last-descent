# Fjord Coast — Round 4 — Reviewer C: Cinematics

- **Reviewer:** C, Cinematic & Animation Director
- **Nature of review:** model-based reviewer (same model family as the developers; not external)
- **Build:** `8d19542` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`)
- **Date:** 2026-11-12

## 1. Evidence used and gaps

- **Images:** every 1920×1080 candidate PNG in `round-4/candidate/`, viewed in full: the cave set `07`, `07b`, `08`, `08b`, `08c`, `08d`; the pursuit set `09`–`09d`; the finish `10`, `10b`; the victory set `11d`, `11e`, `11f`, `11f2`, `11g`, `11`, `11b`, `11j`, `11h`, `11i`, `11c`. I compared them with round 3 `final/`.
- **Shot times:** taken from `tools/biome_evidence.mjs` (lines ~328–340, course `classic:sprint`) and checked against `HARBOUR_BEATS` (`harbourVictory.ts:33`).
- **Evidence gaps, as found on disk:**
  - `round-4/candidate/` has **no `manifest*.json`, no `EVIDENCE.md`, no `res-1366/`, no `res-2560/` and no `perf/`**. The brief and the hand-off note say these exist; they do not.
  - The directory is untracked (`git status`: `?? docs/reviews/biomes/fjord/round-4/candidate/`). The PNG modification times (09:01–11:35) are after the commit time (08:56). That is consistent with the files coming from `8d19542`, but it is not proof.
  - Camera, phase and time per shot are therefore inferred from the capture script, not read from a manifest.
- **Completion brief §10:** the attachment ends at §9, and the review brief does not actually summarise the §10 gate. In §7 I judge the gate against §5 and §7 of the completion brief and the general Critical/Major definitions.
- **Source read:**
  - `seaCaveCinematic.ts`: whole file, plus the diff since `aba21bc`;
  - `seaFraming.ts`: whole file;
  - `seaCave.ts`: the lintel (393–430), the wreck (494–530), the net and the sea-shot computation (614–645);
  - `harbourVictory.ts`: the shot list (100–215), the beacon, the presenter and the fish code, plus the diff;
  - `water.ts`: the diff;
  - `animation.ts`: the new `gag` mode;
  - `SnowballView.ts`: the diff;
  - `GameSession.ts:656`;
  - `settings.ts:71`.
- **Tests:** `npx vitest run tests/unit/fjord_r4_integration.test.ts tests/unit/fjord_r3.test.ts tests/unit/fjord_art.test.ts` → **21/21 passed**.
- **My own measurements** (scratch `scratch/review-c-r4/`):
  - `meas.py`: cave luminance and water colour against round 3;
  - `crops.py`: enlarged crops of the lintel, wreck, leap, presenter face, beacon, fish, gag body and splash;
  - `seashots.test.ts`: **sea-framing coverage across 18 caves on Sprint, Standard and Endurance**. Run with `npx vitest run --config scratch/review-c-r4/vitest.config.ts --reporter=verbose`.

## 2. Verdict — **FAIL** (Cinematics 8/10 against the 9/10 target)

Round 4 fixes the worst round-3 problem and several smaller ones.

**Fixed:**
- The cave is no longer a black void. Near-black pixels inside the letterbox dropped from 82% to 4% in `08c` and from 76% to 26% in `08d`. The chamber crop in `07` went from (6, 7, 7) to (48, 58, 69).
- On the Sprint evidence course the emergence (`08`) and the leap (`08b`) now frame the open sea, islands and the harbour.
- The cod is now a flat fish across the mouth.
- The beacon is now a fire, not a white disc.
- The plunge water no longer reads as snow.

**Why it still fails:**
- **The sea framing exists only on Sprint.** My run over 18 caves found sea stations for the Sprint cave (7/8 emergences, 6/8 leaps) but for **0 of 10** Standard and Endurance caves, Classic Standard included. Standard is the default length (`settings.ts:71`). The default player therefore still gets the round-3 fallback: a three-quarter emergence and the inland ledge leap.
- **The cave props break the "no floating decorations" rule** in every cave frame:
  - the lintel column-ends read as hex blocks stuck on the rock face;
  - the net is a free-standing black mesh sheet.
- **The trophy reverse shot (`11`) faces inland,** up the run-out at the finish arch, with no sea or harbour. The brief explicitly lists inland-facing shots as a defect.
- **The plunge backdrop (`11j`, `11h`) is one house model repeated seven to eight times.** The brief names repetitive harbour buildings.
- **Several round-3 minor defects are untouched:**
  - ring tracks;
  - the box under the sauna and the ladder;
  - the summit with terrain above it;
  - feet cut by the letterbox;
  - stick-winged gulls;
  - the throw-1-only caption.

This is a real step up from 7.5, but not a 9.

## 3. Scores

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **7.5** | The harbour, plunge and reveal are attractive (`10`, `11e`, `11b`, `11i`, `11c`), and the cave is now legible. But the portal dressing is artificial: floating hex lintel blocks, a pencil-box column field and a wreck made of blocks and planks (`07`, `08c`, `08b`). The reveal mountain shows needle crests and vertical smears (`11i` upper right, `11c` lower right). |
| Environmental uniqueness | **8** | The sea, islands, harbour and gulls in the cave beats (Sprint) and a fully coastal victory are distinctly not Alpine. The default-length cave shots fall back to non-sea framings. |
| Skiing and hazard mechanics | **7** (low confidence) | Stills only. The landing beam and the windsock are very legible (`09b`, `09c`). Not my area. |
| Difficulty and fairness | **7** (low confidence) | The snowball is now visible in flight in `09c` (a large grey flat-shaded disc that reads more like a rock than snow). The per-throw cue is unchanged (`GameSession.ts:656`). |
| Cinematics | **8** | Up from 7.5. The cave beats now read, the Sprint emergence and leap show the fjord, the gag lands better and the reveal is excellent. Held back by: no sea framing on Standard/Endurance; floating lintel and net; the inland trophy reverse; repeated houses behind the plunge; and lingering staging blemishes. |
| Performance and stability | **7** (low confidence) | 21/21 of the relevant unit tests pass, and `TESTS.md` reports the full loop including the cave cinematic and the victory passing. I did not profile, and `candidate/perf/` is absent. |
| Accessibility and controls | **7** (low confidence) | The gull, roar, gag, footstep and rock-scrape captions are present and legible. The snowball caption is still once per run. |
| Overall player experience | **7.5** | The ending is genuinely memorable: harbour, gag, cannonball and the summit-to-sea reveal. The mid-run encounter that most players see (Standard) still lacks its coastal framing, and the cave set dressing looks placed rather than geological. |

## 4. Defects

Severities: Critical blocks even a public preview; Major is clearly visible or clearly wrong for a 9/10 target; Minor is polish. **No Critical defects found in my area.**

### 1. Major — The sea framing exists only on Sprint. Every Standard and Endurance cave falls back to the non-sea shots (tracker F-004 understates this).

**Evidence:**
- `scratch/review-c-r4/seashots.test.ts` builds each cave's dressing exactly as `fjord_r4_integration.test.ts` does. Its output:
  - Sprint z260 (Classic plus 6 custom seeds): emergence-with-sea 7/7. Leap-with-sea 6/7 (C4D: none).
  - Standard z960 (Classic, C4G, C4H, C4K, C4L): **emergence none, leap none, 5/5**.
  - Endurance z560, z7267, z13977 (Classic, C4J): **none, 6/6**.
  - Total: 18 caves; only 6 have both shots.
- Even where a station is found, it shows only 0.07 open water (2 of 28 rays) at about 15 m. The sea is a corner of the frame (`08` top-left), not the frame.
- When `sea` is null, `seaCaveCinematic.ts:192–200` uses the high three-quarter fallback and `:207` uses the round-3 ledge camera. Round 3 showed that camera looking inland, with no sea (`final/08b`).
- `settings.ts:71`: `courseLength: 'standard'` is the default.
- The project's own test (`fjord_r4_integration.test.ts:146–183`) asserts sea shots only for Classic Sprint. The count of other caves is computed and then discarded (`void found`).
- The tracker's "custom Standard caves still no sea" is inaccurate: Classic Standard and all Endurance caves have none either.

**Fix:**
- Add stations further out and higher (40–80 m, 20–60 m up), or a station on the rim side looking across the cave's hill to the water.
- Failing that, author a dedicated sea-side establishing beat: before the emergence, cut to the cave's hill from over the water, which always sees sea.
- Turn the test's discarded count into an assertion: at least 90% of caves on every finite length get an emergence with at least 0.15 water.

### 2. Major — Floating and artificial dressing on the cave portal ("no floating decorations or artificial rock stacks", completion brief §5).

**Evidence:**
- `07` (crop `07_lintel.png`): the lintel column-ends are 4–5 separate hex blocks with flat, lit end faces sitting proud of the rock. There is no fracture, no shared face and no shadow seam, so they read as dice glued to the brow, with icicles hanging from them.
- In `08b` (crop `08b_leap.png`) the same cluster sits alone high on the cliff face, clearly detached, at x 1440–1680, y 130–350.
- In `08c` they dominate the frame behind the gulls; in `08d` they hang over the roar.
- Cause: `seaCave.ts:409–416` places each prism with `base = face(al, yUp) − 1.1·out` along a tilted axis. On the irregular face several ends sit wholly in front of it.
- The net (`seaCave.ts:619–628`) is a vertical plane with a dark lattice texture. In `07`, `08` and `08b` it reads as a free-standing black triangular screen (`07_hull.png`).
- The "wreck" in `07` and `08` reads as snow-capped blocks, a slab and pale sticks; the clinker hull is not identifiable.
- The column field right of the mouth in `07` is a dense rectangle of near-identical capped prisms. It reads as a stacked prop block, not a causeway outcrop.

**Fix:**
- Generate the lintel from the portal mesh: displace or extrude the brow into column-end facets, or seat each prism at least 0.6 m into the face with a contact AO band.
- Cull any prism whose base samples are in front of the face.
- Drape the net over a column (vertex-snapped), not as a standing plane.
- Turn the hull broadside to the `07` and `08` cameras.
- Break the column field into 2–3 irregular groups with height steps and drifts banked between them.

### 3. Major — The trophy reverse shot faces inland (completion brief §7: "cinematic shots facing generic inland terrain").

**Evidence:**
- `11` (10.9 s, `HARBOUR_BEATS.toss + 0.4` → `apres`, 1.6–2.3 s on screen): the frame looks up the run-out at the `MÅL · FINISH` arch, the fence lines and the snow slope. There is no sea, no quay and no house.
- The code says so: `harbourVictory.ts:148` describes it as "the skier's face … the descent behind".
- This is the trophy's payoff frame.
- The presenter's pose in it is still both hands at his head holding a dark object (round-3 #5, not fixed).

**Fix:**
- Swing the reverse so that the harbour or the fjord is behind the skier: put the camera on the inland side, looking seaward past the skier's shoulder.
- Or keep the axis and lift the camera so that the quay and boats fill the background.
- Give the presenter a clap or a doffed cap at about 10.9 s.

### 4. Major — The plunge's backdrop is one house model repeated (completion brief §7: "repetitive … harbour buildings").

**Evidence:**
- `11j` and `11h`: 7–8 gable-front houses with the same width, roof pitch, eave trim and a centred column of three dark windows, differing only in paint. Each carries the same small brown beam at the gable.
- This is the frame the comedy beat is staged against, at a low camera that makes the repetition the whole background.
- `10` and `11i` show more variety (sizes, a long warehouse), so the variety exists elsewhere; this strand row does not use it.

**Fix:**
- Mix the warehouse and side-gable variants into the row behind the bathing pier.
- Vary storey count, window pattern and roof pitch per house.
- Alternatively, move the 4b camera 15–20° so the pier, a boat or the lighthouse breaks the row.

### 5. Minor — The gag reads better, but it is still not quite a gag.

**Evidence:**
- `11f` (`11f_fish.png`): the cod is now a flat silhouette across the mouth, a clear improvement. But it is a single flat olive-khaki cut-out with no shading, a different colour from the beige stockfish on the rack behind it, and its tail fin overlaps the nostrils.
- `11f2` (6.75 s, `gag` t ≈ 0.3 s, when `throat` should be about 1): he hunches and holds the fish out, but the left hand is across the belly, not at the throat. The face is a toothy snarl; it reads as menace, not retching.

**Fix:**
- Use the rack fish's material, with a two-tone gradient and an eye.
- Move the fish centre 0.05 m down so the tail sits at the lip corner.
- Raise the `gag` throat IK target to the neck after the hunch offset.
- Add a tongue-out or cheek-puff frame on each retch.

### 6. Minor — The presenter's face is still partly hidden.

**Evidence:** in `11g` (`11g_face.png`) the trophy is now lower and to the side, but the ship's-wheel ring passes across his eye line. Only one eye and his smile show between the spokes.

**Fix:** increase `holdSide` to about 0.25, or shift the over-the-shoulder camera 0.3 m to the skier's left.

### 7. Minor — The reveal's start still has terrain above it (round-3 #7, not fixed).

**Evidence:** in `11c` the chute groove continues above the beacon to the top of the letterbox (x 870–960, y 120–480).

**Fix:** as round 3: raise `endLook` or seat the beacon on a visible shoulder with the skyline above it.

### 8. Minor — The plunge water is fixed in colour but flat in character.

**Evidence:**
- The foreground mean in `11j` and `11h` is (98, 110, 121), against round 3's (133, 142, 150). It is now darker than the cobbles in `11d` (125, 130, 134) and no longer reads as snow.
- It is still noticeably paler and smoother than the water in `11b` (60, 79, 93), with no reflections of the pier or houses.

**Fix:** add a planar reflection or SSR approximation for the 4b camera only, or darken the near-camera graze term further.

### 9. Minor — Leftover staging blemishes (round-3 #11, mostly not fixed).

- `11d` and `11`: closed ring and loop ski tracks around the skier.
- `11b`: the pale box under the sauna deck (x 130–500, y 690–820) and the ladder rungs hanging below the deck edge.
- `11f2`: the Yeti's feet are cut by the letterbox.
- `08c`: the gull wings read as sticks at most flap phases.
- `11h`: the crown splash has a hard, straight-edged base ring, so it reads as a glass cylinder.
- `08d`: a pale beige vertical strip down the right-hand column (x 1680–1780, y 470–960), a texture seam.
- `07b`: a straight-edged translucent wedge (x 930–1120) remains, and the "outlook" still shows only the inland slope. It is no longer a cinematic camera for Fjord, but it is visible to any player who looks out of the mouth.

### 10. Minor — The Hard-mode throw cue is unchanged (round-3 #10).

**Evidence:**
- `GameSession.ts:656`: still `b.throws === 1` only, and there is no inset pulse.
- In `09c` the ball is now visible in the main view, but as a large grey flat-shaded disc against the sky that reads as a rock or moon.

**Fix:** add a throttled per-throw caption, brighten and soften the ball's shading, and pulse the inset border during the wind-up.

### What I could not verify

- **The Yeti grounded from his first visible frame:** the first Yeti frames (before 7.9 s) are not in the shot set. In `08` he stands on the snow beside the pool with no visible contact shadow (`08_yeti_feet.png`).
- **Motion:** gull flight, the icicle fall, the leap arc and landing, the gag retch cycle, the fish fling, the toss, the plunge, and camera smoothness.
- **Audio sync.**
- **The cave's appearance on Standard and Endurance:** the lighting fix should be general, but there is no shot.

## 5. What works

- **The cave is readable.** The basalt face, the irregular, non-tunnel mouth, the controlled dark interior and the ice pool all read in `07`, `08` and `08d`.
- **The Sprint emergence (`08`)** puts the Yeti at the mouth with the fjord, islands and the harbour's coloured houses beyond the cave's flank. The station search is a sound, deterministic approach.
- **The Sprint leap (`08b`)** is now side-on, against sky and open sea with the harbour below, and reads as a leap off the column stubs.
- **The roar (`08d`)** is a strong low angle, with sea smoke and falling ice.
- **The quay and racks (`11d`, `11e`)** are proper harbour images.
- **The fish now reads as a fish** (`11f`).
- **The cannonball tuck (`11j`)** is a good comic silhouette.
- **The reveal (`11i`, `11c`)** remains the best sequence in the build. The beacon is now a small flame with a smoke wisp: brightest pixel (236, 184, 133), zero clipped-white pixels, against fully white in round 3. The title lands after the settle.
- **The harbour finish establishing shots (`10`, `10b`)** are clear and coastal.

## 6. Round-3 defects and tracker items (my own verification)

| # | Round-3 defect / tracker | Status | Basis |
|---|---|---|---|
| 1 / F-003 | Basalt cave a black void | **Fixed** | Near-black share inside the letterbox: `08c` 82→4%, `08d` 76→26% (the mouth interior, which is appropriate), `08` 55→13%. `07` chamber (6, 7, 7)→(48, 58, 69); brow (24, 29, 34)→(55, 66, 78). |
| 2 / F-004 | Signature shots lose the sea | **Partial** (worse than the tracker states) | Sprint: fixed (`08`, `08b`). Standard and Endurance: 0/11 caves have a station (defect 1). The inside-cave branch is still unreachable for Fjord (it is now documented). Evidence notes could not be checked: no manifest. |
| 3 | Leap doesn't read | **Fixed on Sprint; not fixed elsewhere** | `08b` is side-on with sea and harbour. The skier is not in frame and the floating lintel cluster is in shot. Other lengths use the old ledge camera. |
| 4 / F-014 | Cod as a stick in the nose | **Mostly fixed** | `11f`: flat fish across the mouth. Flat cut-out, tail on the nostrils, gag pose weak (defect 5). |
| 5 / F-014 | Trophy hides the presenter's face; post-toss pose | **Partial** | `11g`: one eye and the smile now visible behind the wheel ring. `11`: hands at head again (defect 3). |
| 6 / F-014 | Beacon a white disc | **Fixed** | `11c` and `11i`: an orange flame with smoke, no clipped pixels. |
| 7 | Terrain above the summit in the reveal | **Not fixed** | `11c` |
| 8 / F-005 | Plunge water reads as snow | **Fixed (minor residual)** | (133, 142, 150)→(98, 110, 121); now darker than the cobbles. Flat, with no reflections (defect 8). |
| 9 | Cave props unreadable | **Partial; changed character** | Lit now, but the lintel floats, the net is a standing sheet, and the wreck is blocks and planks (defect 2). |
| 10 | Hard-mode throw cue | **Not fixed** | `GameSession.ts:656`. The ball is now visible in `09c`. |
| 11 | Staging blemishes | **Not fixed** (except the white-disc beacon) | Defect 9 |

## 7. Public-preview gate (my area)

The §10 text was unavailable (see §1). Assessed against the completion brief's §5 and §7 items:

| Gate item | Status | Evidence |
|---|---|---|
| No Critical defect (crash or soft-lock in the cave cinematic or victory) | **met** | No Critical found. `TESTS.md` #2 (full loop incl. cave cinematic and victory) passes. 21/21 related unit tests pass. |
| The cave is not black; controlled darkness | **met** | Defect 1 above fixed (measurements in §6). |
| Natural, irregular opening; not a tunnel | **met** | `07`, `08` |
| No floating decorations or artificial rock stacks | **not met** | Defect 2 |
| The Yeti grounded from his first visible frame | **not evidenced** | No shot before 7.9 s |
| Coastal reveal (sea, cliffs, birds, mist, sound) in the encounter | **not met for the default length** | Met on Sprint (`08`, `08b`, `08c`, `08d`). 0/11 Standard and Endurance caves (defect 1). |
| Water that is not snow | **met** | `11j`, `11h` (§6 #8) |
| Buildings not floating or repeated | **not met** (repetition) | Defect 4. No floating buildings seen. |
| Trophy staging | **partially met** | `11g` improved; `11` pose (defect 3, defect 6) |
| No inland-facing shots | **not met** | `11` (defect 3) |
| Fish gag framed | **met** (minor polish) | `11f`, `11f2` |
| Ending on the ocean and mountain reveal | **met** | `11c` |

**Gate result for my area: not met.** There are four Majors (defects 1–4). None of them blocks a preview on the Critical definition, but the gate is not lowered: for a 9/10 cinematic, items 4, 6, 8 and 10 of that table are open.
