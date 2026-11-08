# Yeti round-3 progress notes

(Working notes; survive environment restarts. Newest at the bottom.)

## Scope (from round-2 Reviewer A): A36 face skin/brow/teeth, A35 fur across the open mouth, A15/A17 if time.
- Tooling: /tmp/y3/shots.mjs (copy of /tmp/y2), vite no-HMR on :5344
  (`npx vite --config /tmp/y2/vcfg/vite.nohmr.mjs --port 5344 --strictPort`), `YPORT=5344 node /tmp/y3/shots.mjs W H outdir name=query`
## Session 1
- A36: skin COL.skin 0.165/0.142/0.13 grey-brown (was blue-black .15/.142/.15), lip/nose warm dark, SSS-ish warm term
  in skin shader (vBare, stronger on lips/nose via vColor r-b), grain: pores 1100→420 freq & weight 0.45→0.08,
  260-grain removed, mottle contrast cut; brow ramp: rr y-step smoothstep(3.0,3.06)*0.8 → noisy smoothstep(2.975,3.13)*0.75,
  head bare 0.52..0.72 → 0.5..0.85, shell hmax shortens toward edge (short-hair gradient), coat 0.64..0.8.
  Teeth: seeded per-tooth length/girth/lean/stain, longer fangs, one lower incisor missing (buildHard).
- A35: head mouth-cavity walls (throat, inner cheeks) and jaw inner walls bare (cov=0, fur=0, cards=0) — the grey
  slab inside the roar mouth was SHELL FUR on the carved throat wall; no cards rooted in the jowl/upper-lip/lip-line zone.
- tris after: main 696,067 (shells 474,759) — below 720k; needs top-up.
- cards high 19000→22500 (main 724,067); mouth card exclusion widened smoothstep(1.0,1.6,mz). tsc clean.
- vitest 109/109. Final 1920 evidence via /tmp/y3/final.sh -> /tmp/y3/final.log
- shells were growing from gums/upper-lip underside (strands over the teeth in front view): cov=0 there. Cards: reject roots in / segments through the bind-space mouth slot (retry loop keeps count).
- Final (1920x1080): r3_face_front, r3_face_34, r3_roar, r3_body_front. main tris 722,402 (body 61,500 / shells 473,094 /
  cards 181,680 / hard 4,592 / eyes 1,536); overlay incl. shadow 817,294. groundReport seq=end: worstPenetration 0 cm,
  worstPlantedFloat 0 cm, 12 steps. tsc clean; vitest see report.
- Remaining: 2–3 short fringe locks still hang over the mouth corner in face_34 (buildFringe corner test too small);
  from below in the roar the beard/chin underside fills the lower half of the opening (anatomy, not cards);
  upper incisors are flat-fronted blocks; A15 (flat cheek ribbon cards, mid-distance smoothness) and A17 palms untouched.
