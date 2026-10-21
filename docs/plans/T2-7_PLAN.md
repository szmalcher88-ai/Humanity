# T2-7 — D-20 OPTION A: MOVE THE ESCARPMENT, THE SPHINX AT ITS REAL LEVEL (build plan)

> Prepared 2026-10-21 by a read-only side session on the `c326e21` tree
> (plus the battery reorder in `tools/battery.ts`; the rows checked last
> were read in the working tree at `8479da2`, the HUD epoch switch, and
> match those line numbers). Nothing in `src/` or
> `tools/` was touched. The human decided D-20: option A — the correct
> geography for the Sphinx in ALL epochs. Scope (as briefed): move the
> escarpment's crest west near the Sphinx so its enclosure floor sits at its
> real ≈ 20 m ASL (≈ −40 world); re-site everything of Khafre's tied to it;
> map every DEFAULT-world consequence (this step re-baselines every
> contract); the consequences in KHUFU_LATE and MENKAURE; ★ alternatives
> inside A; a two-pass build with measured levels. Runs BEFORE T3-3.
> The human is away: every remaining choice carries a ★.
>
> All heights below are the verifier's NOISE-FREE port of `gizaTerrain`
> (plane, knolls, escarpment, wadi, floodplain, the knolls, the G1 pad, the
> quarry carve) — measured ground runs 1–2 m off it (T2-5). Pass 1 lands the
> terrain; the main session probes; pass 2 fixes the dependent heights.

## 1. Verified findings

### 1.1 The canon and the record (Haiku A)

1. The Sphinx is cut from "the original limestone ridge" and "should appear
   emerging from the bedrock, not placed upon it"; the enclosure exposes the
   strata and has "vertical quarry walls"; the acceptance check: "The Sphinx
   appears carved from living bedrock rather than placed on terrain"
   (`VOL_VII.md:35, 45, 55, 192, 464`). The plateau "is a natural limestone
   escarpment" (`MASTER_PROMPT_BIBLE.md:1523`); the enclosure "Excavated"
   (`:2455`); the view "elevated plateau perspective with the Khafre Pyramid
   behind the Sphinx" (`VOL_VII.md:402`) needs a rim west of it.
2. The canon gives the Sphinx NO level: "≈ 20 m ASL" is an outside figure
   (D-20 records its site height as D, `DEVIATIONS.md:314`). The human's
   choice: "alternative A: move the escarpment" (`:292`), A = "move the
   escarpment crest ~200 m west between z ≈ 250 and 650" (`:308-309`);
   both temples share the Sphinx's floor (`:372`); the town stays (D-6,
   2026-10-21). Elevation data: G1's base 60 ASL (B, `CANON_DIMENSIONS.ts
   :176`), the floodplain 15.5 ASL (C, `:179`); the canon's dip "falls ~3–6°
   to the SE" (`:188`) while the code's plane rises to the SW (a standing
   difference, not this step's).

### 1.2 What hangs off the floor (Haiku D)

3. ONE literal carries every Khafre height near the Sphinx:
   `SPHINX_FLOOR_Y` (`CANON_DIMENSIONS.ts:241`) → the enclosure, the body
   (`GizaControl.ts:434, 450-451`), the VT terrace (`:453`), the Sphinx
   mesh (`Sphinx.ts:29-33`, every box F + offset), the temples. Fixed heights
   to re-site: `KHAFRE_CAUSEWAY_END_Y` −0.5 (`:278`, chosen to meet the VT
   roof `F + 12.4`, `KhafreComplex.ts:376`) and the bookmarks' absolute eyes
   (`Bookmarks.ts:54, 61`).
4. Khafre's deck is `max(line, grd + 0.35)`, smoothed (`KhafreComplex.ts
   :275`), its grade counted (`:288`) and gated ≤ 100 ‰ (`tools/audit.ts
   :361`); Menkaure's track has its own 12 % descent clamp
   (`MenkaureComplex.ts:302`) and a MEASURED valley-temple level −28.8
   (`CANON_DIMENSIONS.ts:330`) — not tied to the Sphinx. LATE's quarry
   ramp keeps its 12 % rule on `grd` (`KhufuLateWorks.ts:148`); its causeway
   sledges ride KHUFU's causeway deck (`:247`), not Khafre's.

### 1.3 How the escarpment is coded and read (Haiku B)

8. ESCARP V0–V12 (`GizaControl.ts:67-80`) with one crest ASL per vertex
   (`:82`, interpolated along the nearest segment, `:227`); `ESCARP_RUN`
   420 (`:85`) drives `dropT`, `plainMask` (`:333`) and the CPU mirror;
   `sdE = sd + crestWobble` (± 28 m, full bake only, `:299-301`) drives the
   plateau ease (`:318`), the cliff/talus profile (`:303-307`), `plainMask`
   and the shelving `escFace` (`:476`). Today (325, 431) lies ≈ 141 m WEST of
   the crest (sd −141) on segment V6→V7.
9. Readers: the far shell calls `gizaTerrain(…, 'far')` without the wobble
   (`TerrainTiles.ts:242`); the floodplain mask reaches the material
   (`TerrainMaterial.ts:112`) and the sand (`SandTransport.ts:81`); the
   froxels' sun occlusion samples the baked height (`Froxels.ts:224`);
   palms grow only where y < −38 (`Palms.ts:166`) — the new valley floor by
   the temples (−40 … −44.5) will get palms in every world; debris stops
   at y < −44 (`Debris.ts:139`); `isFloodplainCpu` (`:694`) has NO callers.
   Everything else reads the baked height through `heightAtCpu`.
10. Khufu's causeway lifts its grade over the crest "near x 320–380"
    (`KhufuComplex.ts:517, 602-605`) — at z ≈ −30, north of the new vertex
    (469, 200), so on the UNCHANGED segment (verify in pass 1).

### 1.4 What stands in the default world's zone (Haiku C, x 100 … 550, z 150 … 700)

11. FIXED-Y items in or at the zone: G1-c's base −1.2 (`Monuments.ts:201`) on
    the queens' terrace `qPad` → −1.2 (`GizaControl.ts:530-531`, applied
    after the escarpment block), G1-d's base 0 (`Monuments.ts:214`) on
    `g1Pad` (`:524-525`), bm3's eye Y 7 (`Bookmarks.ts:35`; `clearGround`
    only LIFTS, `:85-88`). All other zone items are ground-seated:
    - the haul-road leg k1 (40, 215) → (152, 204) (`Inhabitants.ts:283`);
    - the quarry gangs k2 (box x 20–180, z 420–470, `:285`) and k3 (60, 510)
      → (150, 525) (`:286`);
    - ox train 3 at (110, 208) (`:809`) and three gang shelters (150, 215),
      (205, 240), (265, 150) (`:815`): their footprints take `y0` from a
      `heightAtCpu` SNAPSHOT with ground 'none' (`:400-407`). The snapshot
      is taken after the bake, so these footprints show the new ground at
      build time and still are not re-seated later;
    - the debris anchors (100, 450) r 90, (170, 510), (185, 180) and the
      town-lane anchor (500, 650) (`Debris.ts:95-105`);
    - the dust sources at the same places (`Particles.ts:76-82`, Y = ground
      + 0.15).
12. Outside the zone, all verified:
    - Khufu's causeway (173.4, 0, 0) → (795, −41, −115) and its valley temple at
      fixed −41.5 (`KhufuComplex.ts:500, 615`): z ≤ 0 everywhere;
    - the East Field twins at z ≈ −82 / +56 (`:820-822`);
    - the mortuary temple and the SE scaffold (z < 60, `:460`,
      `Inhabitants.ts:820`);
    - bm7's eye (0, 15, 560), bm8 (140, 30, −20), bm11 (146, 7, 68)
      (`Bookmarks.ts:42-43, 51`);
    - the work camp (x < 60, `WorkCamp.ts:45, 52`);
    - every town pad (fixed −34.2 … −42.0, nearest corner z ≈ 716,
      `CANON_DIMENSIONS.ts:375-381`).
13. The Wall of the Crow's north run (v −175: (434, 701) → (637, 672),
    `WorkerTown.ts:129`) and the gate gang (487, 663) → (495, 718)
    (`Inhabitants.ts:326`, via `TownFrame.ts:17-19`, centre (560, 860), yaw
    −0.14) graze the zone's south edge. Verifier's model at radius 250/150:
    Δ 0.0 along the lane and the wall, −0.04 at (520, 640), −0.19 at
    (560, 620). There is no "Shore loop" in `src`: the shoreline clumps
    sample x ≥ 850 only (`Shore.ts:404-405`).

### 1.5 Tools and baselines (Haiku E)

5. `fpdump` writes id, family, x, z, y0, y1, hx, hz, conf per footprint
   (`tools/fpdump.ts:42`, `src/core/Hooks.ts:82`) with `--q` per world — and
   NO compare: two dumps are diffed by hand. `diff.ts` compares two PNGs
   (mean, shares over ±2/8/24; "no visible change" = mean < 1.0 and > 8 on
   < 0.5 %, `tools/diff.ts:9-11`). `tour.ts` shoots all 15 marks in the
   booted world (`--q` for the epoch), raw poses, `shots/tour/bmNN-*.png`
   (`:64-89`).
6. The battery runs the default world only (`tools/battery.ts:90`),
   iGPU probe first (`:49, 69`), then `audit.ts` (no epoch), the bookmark
   test, the inspector test, perf bm1/3/7. `test-bookmarks.ts` requires
   EVERY mark's raw eye ≥ 1.2 m above ground or water (`:27-28`) — in the
   default world, so bm12/bm13's new eyes must clear the default ground
   there too; bm3 must read Y 7 ± 1 (`:44`).
7. Baselines: default 1142, KHAFRE 1120, MENKAURE 1179 (`STATUS.md:465`),
   LATE 1190 (`:497`, `shots/t2/fp-late-base.json`); `shots/` is gitignored
   — every baseline must be re-dumped locally BEFORE the change. The T2-1
   precedent judged the tour by hand ("TAA noise only", `:907-908`). The
   audit's Khafre grade gate (`tools/audit.ts:360-361`, ≤ 100 ‰, fail-closed)
   and the LATE vessel gate (`:354`, exactly 37) ride along.

## 2. What the Sphinx needs, and the options (verifier's model)

The Sphinx's BODY is rock left standing in its quarried enclosure — so the
natural ground at the body must reach its back (floor + 12.5 m = −27.5 with
the floor at −40), or the back is cut flat by the ground itself
(`min(h, cut)`). The temples share the floor (T2-4 K-5) and should stand at
the VALLEY's edge. D-20's sketch of A ("crest ~200 m west", finding 2)
read literally keeps the crest's height (55 ASL) — then the Sphinx lands on the
escarpment's FACE and its back is truncated:

| option | crest at z 431 | crest ASL | ground at the Sphinx centre (325, 431) | west wall (267) | paws (375) | temples (405) | Khafre's bend (255, 484) |
|---|---|---|---|---|---|---|---|
| today | x 470 | 55 | +1.2 | +0.1 | −1.9 | −3.9 | +2.4 |
| A1: 200 m west, height kept | 270 | 54 | −21.3 (back cut 6 m) | −8.2 | −29.4 | −30.3 | −6.5 |
| B: crest at the paws | 378 | 34 | −19.0 | −6.3 | −26.0 | −29.2 | −2.3 |
| D: crest x 345 | 345 | 32 | −26.7 | −15.6 | −30.5 | −32.6 | −9.5 |
| ★ E: crest x 300, LOW | 300 | 35 | −27.5 (= the back) | −24.2 | −31.3 | −33.7 | −18.2 |
| ★ E + a 150 m run-out near the Sphinx | 300 | 35 | −27.5 | −24.2 | −33.5 | −36.9 → −40.1 at x 420 | −18.2 |

★ E with a local 150 m run-out: the Sphinx's back is flush with the old
surface, its enclosure's west wall a ≈ 16 m cut face (from −24 to −40), its
east side open, the paws ≈ 7 m above the floor's level ground, and the
valley floor (−40 … −44.5) reached at the temples' east fronts (x ≈ 420 at z
431, ≈ 400 at z 470) — the Sphinx Temple and the valley temple at the
valley's edge, as the real ones stand. The default run-out of 420 m would
leave a −34 talus east of the temples and turn T2-4's "level floor, cut only"
into a 6 m trench 250 m long.

## 3. Design (★)

### 3.1 The terrain (`GizaControl.ts`, ALL worlds)

- ESCARP / ESCARP_CREST_ASL: the vertex (490, 330) / 55 is replaced by four
  (D — the real crest is not surveyed in the repo; the heights follow the
  real Sphinx floor ≈ 20 m ASL, C, and its back ≈ 12.5 m above it). Both
  arrays grow by three IN STEP (13 → 16 entries): the segment loop falls
  back to a 50 ASL crest on a missing entry (`?? 50`, `GizaControl.ts
  :208-213`), so a short height array fails silently:

  | vertex | x, z | crest ASL | why |
  |---|---|---|---|
  | (430, −40) | kept | 56 | — |
  | NEW | (469, 200) | 55.4 | ON the old segment: north of z 200 nothing moves (Khufu's causeway, the queens, the East Field) |
  | NEW | (380, 330) | 45 | the rim north of the Sphinx |
  | NEW | (300, 431) | 35 | the Sphinx's shelf: its back flush with the ground |
  | NEW | (320, 530) | 35 | south of the valley temple |
  | (430, 620) | kept | 52 | — the town (z ≥ 667) keeps its nearest segment |

- A LOCAL RUN-OUT: `run = mix(420, 150, smoothstep(250, 150, |p − (380, 450)|))`
  used by `dropT` and `plainMask` instead of `ESCARP_RUN` — the valley floor
  reached ≈ 150 m from the crest near the Sphinx only. (A wider blend,
  350 → 200 m, lowered the ground under the Wall of the Crow by ≈ 1.5 m and
  north of it by up to 7 m; at 250 → 150 m the town's ground does not move —
  verifier's model.)
- The CREST WOBBLE (± 28 m on `sdE`, full bake) × 0.25 within 150 m of the
  Sphinx, so its shelf does not slide under the body.
- `isFloodplainCpu` (`GizaControl.ts:694`) reads the same ESCARP array but a
  fixed `ESCARP_RUN`, and nothing calls it (finding 9) — ★ delete it (or
  give it the local run-out); a dead mirror only drifts.
- Palms on the new valley floor by the temples (finding 9): ★ allow them in
  the default world (the valley's edge), exclude them from the KHAFRE
  temples' forecourt by the `worked` mask if the tour shows them there.

### 3.2 The Sphinx and Khafre's works (KHAFRE / MENKAURE)

- `SPHINX_FLOOR_Y` −12.8 → −40.0 (C: the real floor ≈ 20 m ASL is an
  OUTSIDE figure — the canon gives the Sphinx no level, finding 2; D-20
  resolved); the Sphinx mesh hangs off it (`Sphinx.ts`), the body block
  (`GizaControl.ts`, KHAFRE) unchanged in shape.
- The T2-4 level floor: east of the temples it now meets the valley floor
  within ≈ 0–5 m (§2) — keep "cut only"; add an EAST limit (`fy = mix(floor,
  h, smoothstep(440, 470, x))`) so a probe-revealed hump never trenches.
- The Sphinx Temple and the valley temple on −40 (their constants follow
  `SPHINX_FLOOR_Y`); the VT terrace (`vtK`) as is.
- Khafre's causeway: start +10 (the MT, unchanged) → end at the valley
  temple's roof, `roofY = F + 12.4` (`KhafreComplex.ts:376`) = −27.6:
  `KHAFRE_CAUSEWAY_END_Y` −0.5 → `SPHINX_FLOOR_Y + 12.4` (derived, no second
  literal). ★ The STRAIGHT grade, (10 + 27.6) / 499.5 = 75 ‰ (under the
  audit's 100 ‰, `tools/audit.ts:361`), a pedestal ≤ 9.8 m where the ground
  falls away and `cutting` (≤ 2.9 m) where it rises (verifier's model):
  today's rule lifts the deck to `grd + 0.35` (`KhafreComplex.ts:275`) and
  would steepen it over the new slope's bumps (the verifier's port gave
  125–161 ‰ with it). Alternative: keep the rule if pass 2's
  `khafre.cwMaxGrade` stays ≤ 100.
- bm12 'the Sphinx' (430, 6, 431) → (430, −21.2, 431): the same 18.8 m above
  the floor as today, so the frame holds; bm13 (392, 7, 484) → (392, −20.2,
  484): the same 7.4 m above the VT roof. Both checked in pass 2.
- MENKAURE: its valley temple (150, 800) on the wadi floor is outside the
  changed zone (§3.3) — unchanged; its causeway ends at x ≤ 121.

### 3.3 The default world: what moves (verifier's model, Δ = new − old)

The ground changes over ≈ 0.25 km², x 160 … 790, z 180 … 640 (Δ > 0.5 m on a
10 m grid), deepest at the old crest (−35 … −38 m around (460, 460)):

| place | Δ | notes |
|---|---|---|
| the quarry's ENE tip (303, 504) | −27 | the bowl's east end now runs down into the Sphinx's shelf |
| LATE's ENE quarry face (236, 378) | −13 | it stands on `grd` and follows (§3.4) |
| gang k2's east end (180, 445) | −4 | walkers stand on `heightAtCpu` |
| debris anchor (170, 510) | −0.9 | scatter on `heightAtCpu` |
| bm3's ground (265, 265) | −1.5 | the eye stays at Y 7 (absolute); `test-bookmarks` still reads 7 ± 1 |
| the town edge (520, 640) / (560, 620) | −0.04 / −0.19 | the local run-out's outer rim; no pad there (finding 12) |
| everything else listed by the brief or by finding 11–13 | 0 | k2's west, k3 to (150, 525), the haul road k0/k1 to (152, 204), ox train 3 (110, 208), the shelters (150, 215), (205, 240), (265, 150), the masons' yard (185, 180), the queens' terrace and G1-c's chapel (222, 162), G1-d, the supply-ramp toe (10, 236), LATE's transport ramp (70, 306)…(90, 390) and west face, the D-7 remnant, bm7's eye, Khufu's causeway at (350, −35), the East Field, the Wall of the Crow (434, 701) and the gate lane (487, 663) … (495, 718), the debris/dust anchor (500, 650), the Menkaure valley temple |

- Khufu's causeway: unchanged — its crest crossing (x 320–380, z ≈ −30) is
  on the kept segment (finding 10); its `cutting` flags stay.
- The harbour approach, the irrigation (x ≥ 1170) and the worker town:
  outside the zone — unchanged.
- No default-world footprint stands on changed ground. The only footprints
  in the zone are ox train 3, the three shelters and the town gate, and
  their snapshot `y0`s (finding 11) sit at Δ 0. The default fpdump should
  therefore show 0 changes; up to 3 `y0` changes ≤ 0.2 m inside the zone
  are acceptable (the model runs 1–2 m off), and any change outside it
  stops the step.
- What a default TOUR diff should show:
  - bm7 'quarry': it looks NE (yaw −0.738). The ENE end is in frame, and the
    Sphinx site sits ≈ 26° right of the axis.
  - bm8 'queens & temple': it looks SSE (yaw −2.678) from (140, −20), and
    its axis runs through (363, 427), the Sphinx site, so the new escarpment
    shows past the queens.
  - bm1/bm2/bm10: the escarpment line west of the Sphinx site, at 1.3–2.1 km.
  - bm12/bm13: their new eyes, in the default world.
  - bm3 'noon court' looks NW to G1 (yaw 0.785), so the changed ground lies
    behind it; it shows TAA noise only, even though the ground under its eye
    falls 1.5 m.
  - All other marks: TAA noise only.

### 3.4 KHUFU_LATE and MENKAURE

- LATE: the ENE quarry face (236, 378) moves down 13 m with the ground
  (blocks on `grd`) — re-check that it still reads as a face on a floor and
  not on the new slope; the transport ramp (70, 306) → (90, 390) and the
  west face are outside the zone; the causeway sledges ride Khufu's causeway
  (unchanged). LATE's baseline 1190 changes only in `quarry-works:face:ene`
  (`KhufuLateWorks.ts:131`; its scatter and team follow `grd`).
- MENKAURE: its own works unchanged; it inherits KHAFRE's changes.

## 4. The two-pass build and the verification

1. BEFORE anything: dump and shoot today's four worlds (KHUFU_EARLY still
   falls back to LATE) — `npx tsx tools/fpdump.ts --out
   shots/t27/fp-<w>-before.json` for default, `--q "epoch=KHAFRE_PERIOD"`,
   `"epoch=MENKAURE_PERIOD"`, `"epoch=KHUFU_LATE"`; `npx tsx tools/tour.ts
   --out shots/t27/tour-<w>-before` per world (same `--q`).
2. PASS 1 — the terrain only (§3.1: vertices, local run-out, wobble
   damping, the dead mirror). Then the main session PROBES the new ground:
   `npx tsx tools/ground.ts --wrect "260,392,440,470"` (the Sphinx strip),
   `--wrect "372,466,500,528"` (the temples), `--wrect "250,474,390,494"`
   (the causeway's leg 2), `--wrect "290,420,360,442"` (the body), LATE's
   ENE face `--wrect "222,366,250,390"` (a floor, not a slope? — else move
   the face's centre along the bowl's floor and record it), and the town
   edge `--wrect "430,660,640,700"` (expect Δ 0).
3. PASS 2 — with the measured ground: `SPHINX_FLOOR_Y` −40 (keep it — the
   real figure — unless the body's shelf reads > 2 m below −27.5, then
   raise the floor by the difference and record it), the causeway's end
   from `F + 12.4`, the straight grade, bm12/bm13 (§3.2).
4. AFTER: the same dumps and tours; a 10-line `tools/fpdiff.ts` (by id:
   added / removed / Δy0 or Δy1 > 0.05) since fpdump has no compare
   (finding 5). EXPECTED: default — 0 (≤ 3 `y0`s within 0.2 m inside x
   160–790, z 180–640; anything outside stops the step); KHAFRE — every
   `sphinx:*`, `khafre:sphinx-temple`, `khafre:valley`, the causeway
   footprints from leg 1's east half on (Δ down to −27); MENKAURE — the same
   set; LATE — `quarry-works:face:ene` only (`KhufuLateWorks.ts:125, 131`);
   counts unchanged (1142 / 1120 / 1179 / 1190) unless the tour shows new
   palms registered as footprints (they are not footprints). Tours: `diff.ts`
   per mark against the expectations in §3.3.
5. `npx tsx tools/audit.ts` and `--epoch <w>` for the other three: PASS — the Khafre grade
   ≤ 100 ‰, the LATE vessel gate 37, the collision audit.
6. Perf: `npx tsx tools/perf.ts --bm 1,3,7 --runs 3` (default) and `--bm 12
   --runs 3 --q "epoch=KHAFRE_PERIOD"` — terrain only, expect A ≈ B
   against the latest sitting (`STATUS.md:504, 632`).
7. The battery (default; iGPU first) — 18/19 or better.

## 5. Risks

1. Every contract re-baselines — the human's decision; the expected diff
   lists (§4) are the guard against UNexpected moves.
2. The crest wobble: damped near the Sphinx (§3.1); elsewhere ± 28 m as
   today.
3. The Sphinx's back: the shelf must reach ≈ −27.5 at the body; pass 2's
   probe decides (§4.3).
4. Palms on the new valley floor (finding 9).
5. T3-3 waits: its line references shift with this step (refresh after).
6. Three more escarpment segments in the unrolled TSL loop
   (`GizaControl.ts:209`; the CPU mirror's `:678` goes with ★ its
   deletion) — the bake and any per-pixel reader pay
   for them; perf (§4.6) watches it.

## 6. Docs

- STATUS "T2-7"; DEVIATIONS D-20 closed (option A as built: the crest
  vertices and heights, the local run-out, the wobble damping — D; the
  floor 20 m ASL — C) with the new baselines; D-22 (the temples on the
  floor, the causeway's end and grade) updated; README: the Sphinx at its
  real level.
- From the recon: `isFloodplainCpu` dead; the literal −44 in `Debris.ts:139`
  beside `FLOODPLAIN_Y` (−44.5); `tour.ts`'s header says "eleven
  bookmarks" (there are 15).

## 7. Haiku precision

Five read-only Haiku agents. The verifier checked every row against the code
or the text at the cited line, and modelled the ground at every position a
row names.

| agent | task | rows | confirmed | notes |
|---|---|---|---|---|
| A | the canon and the record | 30 | 30 | "20 m ASL" is an outside figure (conf C, not B); the temples share the floor (D-22) |
| B | the escarpment code and its readers | 30 | 30 | the far shell has no wobble; the palms' y < −38 gate; `isFloodplainCpu` is dead |
| C | the default world's zone | 30 | 30 | the snapshot `y0` of the trains/shelters; no "Shore loop"; the town frame (checked by hand: centre (560, 860), yaw −0.14) |
| D | what hangs off the floor | 30 | 29 | One wrong row. Its `:273` row puts the causeway's end on the floor (−40), which gives "100.1 ‰ — the route must change". The deck actually ends on the VT roof, F + 12.4 = −27.6 (D's own `:376` row), so the straight grade is 75 ‰. |
| E | the tools and the baselines | 30 | 30 | `fpdump` has no compare; the bookmark test runs in the default world; `shots/` is gitignored |

**Haiku precision: 149/150 (99.3 %).**
