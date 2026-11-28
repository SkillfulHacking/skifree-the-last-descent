# Round-3 candidate

**Frozen SHA:** `46ed200` (branch `pass5-whiteout`, draft PR #9). Commits after it on the branch add evidence and documents only; `git diff 46ed200 <later> -- src tests` is empty.

**Round 2:** `b70a793`. `git diff b70a793 46ed200 -- src` shows every source change since then.

## What changed since round 2
**Defects**
- **Tracker:** `../DEFECTS.md`. Round-2 findings: `../round-2/CONSOLIDATED.md`.
- **W-056, default course unwinnable:** two general weather-placement rules. Measurements: `../balance/w056/README.md`, `at_404ed88/`.
- **W-076, watched and skipped cave cinematic:**
  - one canonical chase start;
  - the cinematic's last beat swings to the forward gameplay camera;
  - presence cues;
  - inset zoom and landing cues.
  - Details: `w076-final/README.md`; earlier focused reviews in `w076-final/REVIEW_*_final.md`.
- **W-077, chase tension:** a fixed Yeti pace for Alpine (×1.10). Rejected alternatives are documented. Measurements: `../balance/w077/README.md`, `../balance/tension/`.
- **W-065, ridge visibility:**
  - the drop-side bank rolls down to the rim;
  - a cloud deck in the valley;
  - rim spires.
  - The racing line is unchanged.
  - Diagnosis and blind art comparison: `w065/`.
- **Round-3 repairs before these:** `../balance/round3/README.md` and the git log.

**Gitar:** approved on the code up to `46ed200` (see the PR). SonarCloud's quality gate reports a D security rating on new code. The issue texts could not be read from this environment. The `/tmp` defaults it flagged in tools and tests were changed in `15d9628`; the gate's state on the latest push is shown on the PR.

## Evidence on `46ed200` (`candidate/`)
- **TypeScript and production build:** `tsc.txt`, `build.txt`.
- **Unit tests:** 489/489, `unit.txt`.
- **Browser suite, all 11 specs pass:** `e2e/*.txt`. This includes Scenic, Poles and Cave Skip (6 cases: Escape and controller Start at four moments; three locations; Normal and Hard; slow arrival; Reduce Camera Motion; held look-back).
- **`game.spec`:** its first run failed under CPU load; it passed when rerun alone. Both logs are kept.
- **Renders:** `candidate/evidence/` (SwiftShader software rendering, so there is no GPU timing):
  - `rim_1366/` and `rim_1920/`: gameplay-camera ridge views, clear and storm;
  - `handoff_strip/`: the cave hand-off, 14.0 s to about 2 s into the chase;
  - `whiteout/`: weather phases, vista, cave, chase, Hard snowballs, the rescue-station victory.
- **CPU frame cost:** `candidate/perf/` (`tools/prod_frames.mjs`, 12 km of Endless per location).
- **Balance:**
  - difficulty ladder and weather reading: `../balance/w056/at_404ed88/` (sim source identical to `46ed200`);
  - chase tension: `../balance/w077/after_404ed88.jsonl`;
  - summaries: `../balance/w056/README.md`, `../balance/w077/README.md`.

## Categories (score each 0–10; mark low confidence outside your speciality)
1. Visual art direction
2. Environmental uniqueness
3. Skiing and hazard mechanics
4. Difficulty and fairness
5. Cinematics
6. Performance and stability
7. Accessibility and controls
8. Overall player experience
