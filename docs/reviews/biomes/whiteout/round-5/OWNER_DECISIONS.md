# Round 5: product-owner decisions (from the owner's round-5 brief)

## 1. Hard difficulty targets remain in force
- **Benchmarks for an expert:** Hard Sprint 50–75% wins; Hard Standard 25–50%. The default Classic Hard courses must be winnable with skill, in every location. These are strong balancing objectives, not exact quotas.
- **Method:** several competent driving policies and entirely fresh held-out seeds. Do not tune to one autopilot or to known seeds.
- **Current values too forgiving:** Whiteout 88% / 73% and Alpine 83% / 78%, especially on Standard.
- **Investigate** why longer courses can give higher expert success. Tune Normal and Hard separately.
- **Roles:**
  - Alpine teaches pursuit mastery.
  - Fjord tests precision and obstacle handling.
  - Whiteout tests weather reading, momentum and survival.
- **Not allowed:** a global increase in the Yeti's speed, a change to the canonical hand-off physics, rubber-banding, or invisible player advantages.
- A flawless descent must have a plausible path to victory.

## 2. Whiteout Normal must keep pursuit tension
- A competent, weather-aware player should feel the Yeti chasing them, and a clean expert should still usually escape.
- The chase reacts to the player's performance:
  - clean skiing builds a deserved lead;
  - a recoverable mistake noticeably reduces the gap;
  - poor route choices or excessive braking create pressure;
  - a severe crash or several errors create a real risk of capture;
  - excellent recovery can save the run.
- **Measure:** the gap trajectory, closing rate, proximity cues, catch frequency and recovery opportunities.
- **Method:** reproduce W-095 first, using the full engine with hazard streaming. Compare clean, intermediate, cautious, early-crash, late-crash, poor-route and slow-arrival drivers.
- **Not allowed:** forcing near-catches, or a Yeti that secretly accelerates in response to performance.

## 3. SonarCloud's security gate must pass
- Identify the real issue (key, rule, severity, file, line, trace) through authorised access.
- **If access is unavailable:** report the limitation and keep W-087 BLOCKED pending the details from the owner. Do not assume `tools/tension_summary.py` is responsible.
- **Not allowed:** suppressing the rule, excluding broad directories, or changing the gate.
- **Once identified:** fix the root cause with a security regression test, verify an A rating, and keep Gitar's process.

## Release gate
- 9/10 in every owned category, with no unresolved Critical or release-blocking Major finding.
- Six isolated reviewers on one frozen SHA. Scores are not adjusted. Approval is not manufactured.
- PR #9 stays draft. It is not merged or deployed without the full gate and explicit final owner approval.
