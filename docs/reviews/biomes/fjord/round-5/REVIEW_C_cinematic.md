# Fjord Coast — Round 5 — Reviewer C: Cinematics

- **Reviewer:** C, cinematics
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `e2ce964` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`)
- **Date:** 2026-11-12

## 1. Evidence used and gaps

- **Images:** every 1920×1080 PNG in `round-5/candidate/` from `07` to `11j`, viewed in full: the cave set `07`, `07b`, `08`–`08d`; the pursuit set `09`–`09d`; the finish `10`, `10b`; the victory set `11d`, `11e`, `11f`, `11f2`, `11g`, `11`, `11b`, `11j`, `11h`, `11i`, `11c`. Compared with `round-4/candidate/` and round 3 (`final/`).
  - Enlarged crops are in `scratch/review-c-r5/` (`crops5.py` → `r5_*.png`; `cmp_*` for earlier rounds).
  - A pixel diff against round 4 (more than 8/255 change) shows the victory beats are essentially unchanged: `11b`, `11d`, `11e`, `11f`, `11f2` and `11g` changed on 0.3–2.4% of pixels, `11j` and `11h` on about 4%. Only `11` (66.6%) and the cave and leap shots changed materially.
- **Missing evidence:**
  - **`round-5/candidate/standard/` was still missing when I finished.** I checked three times, the last check just before writing this report. There are therefore **no shots of the cave cinematic on a Standard course**, which is the default length.
  - **`candidate/EVIDENCE.md` and `candidate/manifest*.json` do not exist** either, although the brief says they do. Shot times come from `tools/biome_evidence.mjs:328–338`.
  - `round-5/TESTS.md` had not appeared.
- **Source read:**
  - the `8d19542..e2ce964` diff of `seaFraming.ts`, `seaCave.ts`, `harbourVictory.ts` and `hazardViews.ts`;
  - `seaCaveCinematic.ts:140–230` (how the sea shots are used);
  - `GameSession.ts:659`;
  - `fjord_r4_integration.test.ts:146–183`.
- **Tests:** `npx vitest run tests/unit/fjord_r4_integration.test.ts tests/unit/fjord_r3.test.ts tests/unit/fjord_art.test.ts` → **21/21 passed**.
- **My own probes** (`scratch/review-c-r5/`):
  - `seashots.test.ts`: my round-4 sea-shot coverage probe, re-run on this build over **22 caves** (the round-4 18 plus 4 new Standard seeds R5A–R5D). For each station it found, it also reports camera distance, field of view, the Yeti's height as a share of frame height (assuming a 2.6 m Yeti) and the camera's downward angle.
  - The same probe on a source snapshot of the parent commit `129110b` (`scratch/review-c-r5/at-129110b/`, output in `seashots_129110b.txt`).
  - `rendered.test.ts` (output in `rendered.txt`): the share of open water in the frame the cinematic **actually renders**, against the share the station search measured.

## 2. Verdict — **FAIL** (Cinematics 8/10 against the 9/10 target)

**Fixed since round 4:**
- The floating hex lintel is gone; the icicles now hang from the brow (`07`, `08c`, `08d`).
- The floating net sheet is gone.
- The column field is sparser.
- The Sprint emergence (`08`) and leap (`08b`) remain good coastal frames.

**Why it still fails:**
- **The main round-4 Major, F-024 (no sea framing on Standard and Endurance), is not fixed.** The tracker's "emerge 15/18" was reached only with 43–45° downward map views from 125–170 m, where the Yeti was 3–4% of the frame. The last commit, `e2ce964`, correctly forbids those angles, and coverage fell straight back:
  - **0 of 15 non-Sprint caves get a sea emergence.**
  - On the default Classic Standard course the leap now cuts to a station 106 m away. In that shot the Yeti is about 4% of frame height and **none of the rendered frame is water**: the cinematic throws away the pitch the station search chose.
  - So the default player gets **no sea in either the emergence or the leap**, and now a speck-sized leap as well.
- **The victory beats are pixel-for-pixel the same as in round 4.** That leaves open:
  - the repeated house model behind the plunge;
  - the ring ski tracks;
  - the box under the sauna and the hanging ladder;
  - the glass-cylinder splash;
  - the terrain above the beacon.
- **The "sea-facing" catch shot (`11`) shows no sea.** It looks across the town to the inland snowfield.
- **The cave dressing in `07` still reads as blockout:** capped hex pencils and shadowless debris on bare snow.

## 3. Scores

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **7.5** | Removing the lintel cleans up the portal (`07`, `08c`). But the column clumps are still uniform capped prisms with no contact shadow, the "wreck" is loose slabs and sticks (`r5_07_wreck.png`), and the reveal walls still show vertical smears and streaks (`11c` lower right). The harbour stills are attractive. |
| Environmental uniqueness | **8** | Sea, islands, harbour, gulls, stockfish racks and the summit-to-sea reveal are clearly not Alpine. But on the default length the cave encounter is a generic hillside cave. |
| Skiing and hazard mechanics | **7** (low confidence) | Stills only. The landing beams and the windsock are legible (`09b`, `09c`). Not my area. |
| Difficulty and fairness | **7** (low confidence) | The per-throw snowball cue is unchanged (`GameSession.ts:659`, `throws === 1` only). The landing marks are very visible. |
| Cinematics | **8** | Not raised. Sprint is good, and the portal cleanup is real. But the default-length cave cinematic still has no sea, the Classic Standard leap is now a 106 m long shot with a tiny Yeti, the victory sequence is unchanged since round 4, and the catch shot still has no sea. |
| Performance and stability | **7** (low confidence) | 21/21 of the related unit tests pass. I did no profiling. `TESTS.md` for round 5 was not yet available. |
| Accessibility and controls | **7** (low confidence) | The gull, roar, footstep, scrape and gag captions are present and legible. The snowball caption still appears only once per run. |
| Overall player experience | **7.5** | The ending (harbour, gag, cannonball, reveal) is memorable. The mid-run encounter that most players see still lacks its coastal identity, and too many known staging blemishes carry over unchanged. |

## 4. Defects

**No Critical defects found in my area.**

### 1. Major — The sea framing is still missing on every Standard and Endurance emergence; the Classic Standard leap is now a speck with no sea (F-024 not fixed; regressed by `e2ce964`)

**Evidence (`scratch/review-c-r5/seashots.test.ts`, 22 caves):**

| Caves | Build `e2ce964` (under review) | Parent `129110b` |
|---|---|---|
| 7 Sprint caves | Emergence with sea 7/7: 15 m, 23° down, Yeti 19% of frame height. Leap with sea 7/7. | — |
| 15 Standard and Endurance caves | **Emergence 0/15.** Leap 4/15, all at **106 m, 39° field of view, Yeti about 4% of frame height**. | Emergence 12/15 and leap 9/15, but every one is a 41–64° downward shot from 61–169 m with the Yeti at 3–4% of frame height. |

- The "15/18" in the tracker counted the `129110b` stations. These are exactly the map views that the `e2ce964` commit message rejects. When they were removed (`seaFraming.ts:106–108`, `maxDropDeg` 24/32), nothing replaced them.
- **The station search's pitch is thrown away when the shot is rendered** (`rendered.test.ts`):
  - `bestSeaPose` scores frames tilted up by `0.55·vf` (`seaFraming.ts:113–125`) and returns the tilted `look`.
  - `seaCaveCinematic.ts:187` and `:212` ignore `look`: they rebuild the aim from `cam` and `yaw` only.
  - **Classic Standard leap:** searched water 0.07, **rendered water 0.00** (the aim differs by 11°).
  - **C4J Endurance z560:** searched 0.07, rendered 0.04.
- **Result on Classic Standard, the default course (`settings.ts:71`):**
  - The emergence falls back to the high three-quarter view (`seaCaveCinematic.ts:192–200`).
  - The leap cuts to a distant shot with no water in which the Yeti is about 45 px tall.
- `fjord_r4_integration.test.ts:182` still discards the count (`void found`).
- **No Standard shot exists in the round-5 evidence** (`candidate/standard/` missing), so the developers have not shown this beat either.

**Fix:**
- Use `SeaPose.look` (or store the pitch) in both shots.
- Add an authored sea-side establishing beat for caves without a near station: about 1.5 s before the emergence, from over the water or from the rim, looking across the cave's hill. Alternatively, accept a near station with no water and put the sea into the roar or post-leap shots.
- Reject leap stations where the Yeti is below about 10% of frame height.
- Turn the discarded count into an assertion: at least 90% of caves on every finite length must render at least 0.10 water, with the Yeti at 10% or more of frame height.

### 2. Major — The catch shot (`11`) still shows no sea (F-025 claimed fixed; partial)

**Evidence:**
- `11` (10.9 s; the new profile shot at `harbourVictory.ts:147–167`) frames the presenter and the skier against the town's houses, a lamp-post, and on the right half an inland snowfield and a mountain flank with trees.
- There is no quay edge, no water and no boat. The new comment claims "the quay and the open fjord fill the background". That is not what renders.
- It is better than round 4's view up the run-out, since the houses are coastal, but it is not the fix that was claimed.

**Fix:**
- Choose the side (`right` versus `-right`) by testing which background ray hits water, using `waterFraction`, as the cave does.
- Or put the camera on the inland side so it looks seaward past the pair.

### 3. Major — The plunge backdrop is still one house model repeated (F-032, open)

**Evidence:** `11j` and `11h` show eight gable-front houses with the same roof pitch and the same centred window column. Their pixels are unchanged from round 4 (3.9% difference, all from the splash and the skier).

**Fix:** as in round 4: mix in the warehouse and side-gable variants, or yaw the 4b camera 15–20° so that the pier or the lighthouse breaks up the row.

### 4. Major — The cave dressing still reads as placed props, not geology (F-023 partial)

**Evidence:**
- `07`: two dense clumps of near-identical capped hexagonal prisms stand on bare snow with no contact shadow, banked drift or rubble.
- `07` and `08`: the "wreck" (`r5_07_wreck.png`) is a snow-capped wedge, a hex drum, two upright beige plank stubs and a lone pale log. In `07` a bent beige plate (x 430–470, y 755–790) appears to hover. Without contact shadows the debris reads as floating in every cave frame (`08` x 260–460, y 850–960; `08b` x 910–1250, y 750–930).
- The lintel and the net are genuinely gone: verified in the code (`seaCave.ts:399–419`, `NET_PLACED = false`) and visually.

**Fix:**
- Add contact AO or blob shadows under the prisms and debris.
- Bank snow drifts against the clump bases.
- Vary prism height steps and lean.
- Replace the stick debris with one identifiable broadside hull.

### 5. Minor — Victory staging blemishes, all unchanged since round 3 or 4

- `11d` and `11`: closed ring ski tracks around the skier.
- `11b`: a pale box under the sauna deck (x 130–500, y 690–820) and ladder rungs hanging below the deck edge (x 1240–1290, y 830–940).
- `11h`: the crown splash has a hard, straight-edged base (a glass cylinder).
- `11c`: the chute groove continues above the beacon to the top of the letterbox (x 870–960, y 120–480; `r5_11c_beacon.png`).
- `11j`: the tucked skier sits exactly on the green house's roof ridge (`r5_11j_skier.png`). The tangent reads as sitting on the roof.
- The plunge water is (103, 116, 126) in both rounds: flat, with no reflections.

### 6. Minor — The fish gag is unchanged

**Evidence:**
- `11f`: the flat olive cut-out cod is still a different colour from the rack fish, and its tail sits over the nostrils.
- `11f2`: the hand is at the belly, not the throat, and the snarl reads as menace, not retching.
- Both images are pixel-identical to round 4 (0.3–0.4% difference).

**Fix:** as in round 4.

### 7. Minor — The presenter's face is still behind the wheel ring

**Evidence:** `11g` (`r5_11g_face.png`) shows one eye and the smile between the spokes. Unchanged.

### 8. Minor — The roar close-up: the open jaw reads as a box behind a fur curtain

**Evidence:**
- `08d` (`r5_08d_mouth.png`): the beard cards hang as a flat sheet in front of the open mouth. The lower jaw shows as a hard-edged dark rectangle (about 80×160 px at 1080p).
- This was already present in round 4 (`cmp_round-4_08d_mouth.png`); I missed it then.

**Fix:** drive the beard cards with the jaw bone, or shorten the beard under the chin for the roar.

### 9. Minor — Other cave-shot blemishes carried over

- `08c`: the gulls read as stick-wings. The frame is roughly 80% bare rock face with the mouth cut off at the bottom.
- `08d`: a pale beige vertical strip down the right-hand column (x 1720–1800).
- `07b`: the straight translucent wedge seam (x 930–1120) remains.
- `08`: still no contact shadow under the Yeti (`r5_08_yeti_feet.png`).

### 10. Minor — The Hard-mode throw cue is unchanged

**Evidence:** `GameSession.ts:659` still captions only `b.throws === 1`, and there is no inset pulse.

### What I could not verify

- **The Standard-length cave cinematic on screen.** No `standard/` shots existed; my verdict on it rests on the headless probes.
- **The Yeti grounded from his first visible frame.** There is no shot before 7.9 s.
- **Motion, camera smoothness and audio sync.**

## 5. What works

- **The Sprint emergence (`08`)** is a strong frame: the Yeti at the mouth, the fjord, the islands and the coloured harbour beyond the flank. It sits at a sensible 23° downward angle.
- **The Sprint leap (`08b`, `r5_08b_leap.png`)** is a clean side-on silhouette leaping off the column stubs, against sky and sea, with the harbour below.
- **The portal is much cleaner without the lintel and the net.** The icicles hang credibly from the brow.
- **The roar (`08d`)** has strong low-angle staging, sea smoke and falling ice. The interior darkness is controlled: 48% near-black, all of it inside the mouth.
- **The pursuit frames (`09`, `09d`)** look down the run toward the sea and the harbour, with the inset showing the Yeti.
- **The harbour establishing shots and the quay (`10`, `10b`, `11d`, `11e`)**, the cannonball silhouette (`11j`), and the reveal (`11i`, `11c`) remain the best images in the build. The title lands over the fjord.

## 6. Round-4 defects and tracker items (my own verification)

| Round-4 C # / tracker | Status | Basis |
|---|---|---|
| #1 / F-004, F-024: no sea framing beyond Sprint | **Not fixed (regressed from the interim fix)** | 0/15 non-Sprint emergences. The leap appears on 4/15 caves, at 106 m with the Yeti at 4% of frame. Classic Standard renders 0.00 water. The tracker's 15/18 counted map views that `e2ce964` removed. |
| #2 / F-023: floating lintel, net, prism grid, wreck | **Partial** | Lintel and net removed (code and `07`, `08c`). The prisms are still uniform, and the debris reads as floating (defect 4). |
| #3 / F-025: catch shot faces inland | **Partial** | `11` now looks across the town, but there is no sea and half the frame is inland snowfield (defect 2). The presenter's hand is still at his head. |
| #4 / F-032: repeated houses behind the plunge | **Not fixed** (open in the tracker) | `11j`, `11h`: pixels unchanged |
| #5 / F-014: gag quality | **Not fixed** | `11f`, `11f2` pixel-identical |
| #6: presenter's face hidden | **Not fixed** | `11g` |
| #7: terrain above the beacon | **Not fixed** | `11c` |
| #8: flat plunge water | **Not fixed** | Mean (103, 116, 126) in both rounds |
| #9: staging blemishes | **Not fixed** | Defects 5 and 9 |
| #10: Hard throw cue | **Not fixed** | `GameSession.ts:659` |
| F-003: black cave | **Still fixed** | Near-black share inside the letterbox unchanged from round 4 (`08` 24%, `08c` 15%, `08d` 48% in the mouth) |
| F-005: plunge water reads as snow | **Still fixed** | Darker than the cobbles |

## 7. Public-preview gate (completion brief §10) — my area

| Gate item | Status | Evidence |
|---|---|---|
| No critical defect or unrecoverable state in the cave cinematic or the victory | **met (as far as stills and unit tests show)** | No Critical found; 21/21 related unit tests pass. Round-5 `TESTS.md` was not available. |
| No major regression in a signature cinematic | **not met** | The Classic Standard leap now cuts to a 106 m shot with the Yeti about 4% of frame height and 0.00 water rendered, where round 4 used the close ledge camera. The default-length emergence still has no sea (defect 1). |
| Cave: natural opening, controlled darkness | **met** | `07`, `08`, `08d` |
| No floating props or clipping in the cave | **not met** (improved) | Defect 4 |
| The Yeti grounded from his first visible frame | **not evidenced** | No shot before 7.9 s; no contact shadow in `08` |
| Coastal reveal in the encounter (sea, cliffs, birds, mist, sound) | **met on Sprint only; not met on the default length** | Defect 1; no Standard shots were provided |
| Water that is not snow | **met** | `11j`, `11h`, `11b` |
| Buildings not floating or repeated | **not met** (repetition) | Defect 3 |
| Trophy staging | **partially met** | `11g` (face behind the ring), `11` |
| No inland-facing shots | **not met** | `11` (defect 2) |
| Fish gag | **met** (minor polish) | `11f`, `11f2` |
| Ending on the ocean and mountain reveal | **met** | `11c`, `11i` |

**Gate result for my area: not met.** No item blocks a preview on the Critical definition. But there are four Majors, and the main encounter on the default length still lacks the coastal framing the brief requires. The gate is not lowered.
