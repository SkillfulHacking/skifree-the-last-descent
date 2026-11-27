# Round 6: product-owner rulings (from the owner's round-6 brief)

## 1. Difficulty labels
- Normal and Hard must describe the actual overall experience.
- On Whiteout, Normal and Hard use nearly identical Yeti pace multipliers, so the labels must not imply a major difference in the Yeti's speed.
- Present the difference honestly, through weather intensity, hazards, terrain and the skill required.
- Do not alter physics merely to justify a label.

## 2. Hidden catch-up is not an acceptable long-term design
**Investigate** replacing it with predictable, deterministic pursuit behaviour:
- Establish the existing speed-versus-distance behaviour.
- Run controlled comparisons with the catch-up disabled.
- Evaluate fixed per-encounter pacing, terrain-based pursuit, and a visibly and audibly telegraphed sprint.
- Use several skill policies and mistakes.
- Verify watch/skip parity.
- Compare all locations and difficulties, including Endless.

**Outcomes the owner wants:**
- A clean expert ordinarily escapes Normal.
- Mistakes create danger.
- A skilful recovery has a measurable chance to rebuild the lead.

**Not allowed:**
- A global speed increase, invisible boosts, teleports or guaranteed near-catches.
- Quietly restoring the old catch-up under another name.

**If removal causes significant regressions:** document the exact cause and pursue a fair replacement.

**Risk:** a shared-engine change is high-risk and needs independent gameplay review.

## 3. Human playtesting is required
**Before final release approval:** a structured playtest with about 6–8 real players.
- Novice, intermediate and experienced players.
- Keyboard and controller.
- Real-time gameplay, audio and responsiveness.

**Tasks:**
- Start a Whiteout Normal course without coaching.
- Identify the next weather hazard.
- Choose and execute a route through a drift row.
- Survive the cave-to-chase transition.
- Recover from a mistake.
- Try Hard.
- Watch the rescue ending.

**Record:** fairness, frustration, weather comprehension, camera clarity, pursuit tension and enjoyment.

**Rules:**
- Consent for all recordings and instrumentation.
- No coaching by the developer or the AI reviewers.
- The model reviews do not substitute for human feedback.

## 4. The SonarCloud security gate is mandatory
- An A rating on new-code security is required.
- No suppressing, dismissing, broad exclusions or weakening the gate.
- Do not claim a candidate is the issue without matching evidence. W-087 stays blocked until the vulnerability is reproduced and remediated.

**Owner's issue list** (the owner provided it mid-round, 2026-11-27, as SonarCloud screenshots): 26 open issues on new code.
- 8 Security (Low): "PATH variable", at `handoff_strip.mjs:17`, `prod_frames.mjs:16`, `rim_view.mjs:16` and `whiteout_evidence.mjs:21`, two at each.
- 8 Blocker: "add at least one assertion" in the `tests/sim` runners.
- 2 High: async work in a constructor (`Vegetation.ts:111`, `ridgeRocks.ts:266`).
- 8 `Number.NaN` / `Number.isNaN`.

## Priorities 1–5 and the release gate
These are as in the brief.

**Release is blocked until:**
- all eight category owners award at least 9/10;
- no Critical or release-blocking Major defects remain;
- the engineering and security checks pass;
- the human playtest has informed the overall-experience evaluation.

PR #9 is not merged or deployed without explicit final owner approval.
