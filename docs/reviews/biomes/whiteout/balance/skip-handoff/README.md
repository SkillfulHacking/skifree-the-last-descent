# Cave cinematic: watched vs skipped (round 3, W-076)

**Report (product owner):** pressing Escape to skip the Yeti's cave cinematic gave a much bigger head start than watching it.

**Measurement:** `tests/sim/skipHandoff.measure.test.ts`.
- **Courses:** Classic Sprint on Normal, in all three locations.
- **Arrival and input:** the skier arrives at the cave as the deterministic autopilot brings them; the same input follows in every case.
- **The leap:** the cinematic's filmed leap is replayed at 60 fps up to the moment the player leaves the cinematic, then the hand-off starts the chase.
- **Before the fix:** `HANDOFF=legacy` replays the pre-round-3 hand-off, using `tests/support/legacyCaveHandoff.ts`, a copy of the old code.
- **After the fix:** the game's hand-off.
- **Raw rows:** `legacy.json` and `canonical.json`, with every state field for 'skilled' and 'cautious' drivers.

## Before the fix ('skilled' driver)

The table gives the state on the first controllable frame, then the Yeti gap after 1, 3, 5 and 10 s.

| Location | Left the cinematic | Separation | Yeti speed | Yeti | Gap at 1 / 3 / 5 / 10 s | Outcome |
|---|---|---|---|---|---|---|
| Alpine | watched (18.0 s) | 11.5 m | 9 m/s | on the ground, running | 19 / 30 / 35 / 59 | victory |
| Alpine | skipped at 3 s, 9 s or 14.5 s (before the leap event) | 61.1 m | 0 | on the ledge, leap to come | 57 / 64 / 78 / 97 | victory |
| Alpine | skipped mid-leap (+0.4 s) | 55.1 m | 0 | airborne | 50 / 62 / 71 / 92 | victory |
| Alpine | skipped later in the leap (+1.9 s) | 29.5 m | 0 | airborne | 33 / 44 / 47 / 69 | victory |
| Fjord | watched | 6.9 m | 9 m/s | on the ground, running | 15 / 22 / 22 / 36 | victory |
| Fjord | skipped before the leap | 40.3 m | 0 | on the ledge | 38 / 50 / 64 / 78 | victory |
| Whiteout | watched | 6.1 m | 9 m/s | on the ground, running | 13 / 11 / — | **caught** at ~4 s |
| Whiteout | skipped before the leap | 50.8 m | 0 | on the ledge | 44 / 42 / 44 / 32 | caught |

**Cause:**
- Watching, the Yeti leapt, landed and ran on for about 2 s inside the cinematic while the skier stood frozen, and the chase began 6–11 m behind the skier.
- Skipping before the leap beat left the filmed leap unstarted (`Timeline.skip()` fires no events), so `CaveCinematic.finish()` started a fresh leap from the ledge 40–61 m away.
- Skipping during the leap handed over the leap as it was. That gave every head start in between.
- The advantage of skipping was 30–50 m of separation, and on Whiteout it decided the outcome.

**Every balance simulation has always used the skip-before-the-leap start:** `simulate.ts` leapt from the spawn when the chase began. So the balance numbers describe the skipped game, not the watched one.

## The fix: one canonical chase start (`src/cinematic/caveHandoff.ts`)
- **The start:** the generous one the skip gave. The Yeti is on the ledge, and his leap toward the piste begins on the first controllable frame. The AI's usual start delay (0.6 s, from the landing) and the slow-start rules then apply. Speed, Hard modifiers and slow-start are unchanged.
- **Watching:** the cinematic now ends at the leap beat (14.6 s). A shot from behind the skier's position toward the ledge, with the Yeti on it about to leap, leads into it; the camera swings back to third person over the leap's flight (at least 1.2 s) while the AI flies it, and his landing (shake, snow burst, footstep, then the RUN. title and the rear view) is played by the chase. That swing is presentation only, and it is not applied after a skip.
- **Skipping:** at any moment, skipping removes only the presentation. No sound or particle is replayed, the skier's physics is not fast-forwarded, and no distance is awarded.
- **Simulation:** `simulate.ts` calls the same `startCanonicalChase`.

## After the fix
`canonical.json`: for every location, driver and moment, the hand-off state and the gaps at 1, 3, 5 and 10 s are identical to the old skip-before-the-leap row above.

The balance results in `balance/round3/` stand, because they already used this start.

**W-056 is not resolved by this.** `CLASSIC-SPR@WHITE` Normal is still caught: the watched game was previously even harsher, and now it equals the skipped game, which was already measured as caught.

## Regression tests
- **`tests/unit/cave_handoff.test.ts`:**
  - **What it checks:** for each of the eight moments a player could leave the cinematic, the start state and the 10 s trajectories of the Yeti and the skier match the watched run within 1e-6.
  - **Cases:** all three locations; slow (4 m/s) and fast (22 m/s) arrivals; a retry after a completed encounter; Endless encounters 1–3.
  - **Proof it catches the bug:** it runs on the game's hand-off, and it must reject the pre-round-3 one. Pointed at the old hand-off, 8 of its 10 checks fail (`handoff_legacy_run.txt`).
- **`tests/e2e/cave_skip.spec.ts`:**
  - **What it does:** the real keyboard Escape and the controller's Start button, at 1 s, 9 s and just before the leap, against the watched run.
  - **What it checks:** the hand-off frame and 2 s into the chase, both within 1e-3; the first viewing still pauses on Escape; and a skip is not a pause.
  - **Where:** Alpine and Whiteout, in the production build.
