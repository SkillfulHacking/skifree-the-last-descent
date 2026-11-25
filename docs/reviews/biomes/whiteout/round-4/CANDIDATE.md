# Round-4 candidate

**Frozen source:** `71c9ceb` (branch `pass5-whiteout`, draft PR #9). Later commits change tests, tools and
documents only: `git diff 71c9ceb <later> -- src` is empty. The evidence manifests record `6ff50f9`
(source identical to `71c9ceb`).

**Round 3:** `46ed200`. `git diff 46ed200 71c9ceb -- src` shows every source change since then.

## What changed since round 3
Tracker: `../DEFECTS.md`. Work order: `../round-3/CONSOLIDATED.md` and the owner's round-4 brief.

- **Priority 1:** W-087 (`d136e18`), W-081 (`b7572e2`), W-078 and B3-2 (`4b2c892`), each with a
  regression test written to fail before the fix.
- **W-089, the simulator streams hazards like the game (`861930f`):** the balance tables were re-run on it.
- **Owner's decision A, Hard (W-079 / W-080, `e1f86dd`):**
  - Alpine pace ×1.05;
  - Whiteout environment changes only: tuck-dependent headwind, the crest lee for wind grip, drift-gap offsets;
  - Fjord headwind;
  - the Yeti's speed is untouched.
  - Method, rejected candidates and data: `../balance/w080/README.md`.
- **Owner's decision B, per-location cave history (`7f0bb19`):**
  - `seenCave` is keyed by location;
  - idempotent migration that keeps unknown fields and does not infer Whiteout from the old flag;
  - unit test `cave_history.test.ts` and browser test `cave_history.spec.ts`.
- **Art, W-065 / W-093 (`3ba0d83`, `71c9ceb`):** far ranges lowered, a rim rock band, a darker valley floor
  under the cloud sea, taller rim wands.
  - Fresh blind reads during development: 4/10, then 5/10 (`dev/art/README.md`).
  - The white puff over the skier in rim captures was the capture tool's, not the game's.
- **Cinematics and QA (`3ba0d83`, `69c4fb5`):** W-082 (inset offset, Low-quality inset during the leap),
  W-083 (searchlight shot, crane, reveal), W-091 (set-up shot), W-085, W-086, W-088 (live Reduce Camera
  Motion, flash reduction, vibration toggle, `aria-live` captions), W-090, W-092, W-084 (manifests record
  SHA, course and the Yeti's distance and on-screen size; the harness fails when a set-up step fails).
- **Gitar:** `a99f388` (measurement output folder) and `e057d6f` (W-065 tracker row).

## Evidence (`candidate/`)
- **Typecheck and build:** `tsc.txt`, `build.txt`.
- **Unit tests:** 61 files, 521/521, `unit.txt`.
- **Browser suites (`e2e/`):** all 11 specs pass on the final run.
  - Three specs failed on their first run, and those logs are kept:
    - `migration_run1_stale_expectation.txt`: the test did not expect the new vibration setting's default to be written. The test was updated.
    - `scenic_run1_clock_race.txt`: the page clock passed the pause target under load. The test now retries.
    - `game_run1_space_released.txt`: the intro-skip key was released before the stepped frames. The test now holds it.
  - Each fix is a test change. The game source is unchanged.
- **Balance re-measure on the frozen tree (`balance/`):** `expert.jsonl` (312 rows) and `sloppy.jsonl` (208 rows).
  - Seeds: Classic plus held-out W4H-01…12.
  - Both files are identical row for row to the validation runs in `../balance/w080/data/val_*.jsonl`.
- **Renders (`evidence/`):** SwiftShader software rendering, so there is no GPU timing.
  - `whiteout/`: 30 shots of course WO-R1 (`SEED-3403625622-SPR@WHITE`) at 1366×768. The manifest records the Yeti's distance, whether he is drawn and in the main view, and his height in pixels.
  - `strip_high/`: hand-off strips for the three locations.
  - `strip_low/`: the Whiteout hand-off strip on Low.
  - `strip_rcm/`: the Whiteout hand-off strip with Reduce Camera Motion.
  - `rim_1366/`: gameplay-camera ridge views.
  - `a11y_reduce_weather/`, `a11y_ui150/` (1280×720) and `a11y_low/`.
- **CPU frame cost (`perf/`):** Whiteout and Alpine on `high` and `low`. Each JSON records the SHA and quality.

## Balance on the frozen tree (expert driver; Whiteout = weather reader)

| | Hard Sprint (12 held-out) | Hard Standard (12 held-out) | Classic Hard Sprint | Classic Hard Standard |
|---|---|---|---|---|
| Alpine | 11/12 | 9/12 | won, min gap 54 m | won, min gap 53 m |
| Fjord | 9/12 | 6/12 | won, **min gap 7 m** | won, min gap 36 m |
| Whiteout, weather reader | 9/12 | 10/12 | won, min gap 20 m | won, min gap 30 m |
| Whiteout, blind | 4/12 | 0/12 | won, min gap 4 m | lost |

- **Normal, expert:** 12/12 everywhere except Whiteout blind Standard (11/12).
- **Relaxed, expert:** 12/12 everywhere except Fjord Standard (11/12).
- **Normal, competent player (`SLOPPY`):**
  - Alpine 11/12 Sprint and 9/12 Standard;
  - Fjord 6/12 Sprint;
  - Classic Fjord Normal Sprint is lost.
- **Relaxed, competent player:** 10–12/12.

**Against the owner's provisional ranges:**
- **Above the range:**
  - Alpine Hard Sprint (92% against 50–75%);
  - Alpine Hard Standard (75% against 25–50%);
  - Whiteout Hard Standard for the reader (83% against 25–50%).
- **Inside the range:** Fjord Hard.
- **Classic Fjord Hard Sprint:** won, but the margin is thin (7 m).
- **Normal is not much more forgiving than Hard for the expert:** 12/12 against 9–11/12.
- **Fjord Normal is harsh for a competent player:** 6/12.

## Known state at freeze
- **SonarCloud:** the quality gate fails with "B Security Rating on New Code" (C in round 3). The issue is not among the 26 annotations on the check (code smells and hotspots), and its text could not be read from this environment.
- **Gitar:** approved with one suggestion (the W-065 row), addressed in `e057d6f`.
- **W-065:** OPEN. The development blind reads were 4/10 and 5/10.
