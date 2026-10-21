# T2-4 — KHAFRE'S MORTUARY TEMPLE, CAUSEWAY, VALLEY TEMPLE (+ SPHINX TEMPLE) UNDER KHAFRE_PERIOD (build plan)

> Prepared 2026-10-21 by a read-only side session on the `2b3dcec` tree
> (T2-3 committed). Nothing in `src/` or `tools/` was touched. Scope (T2_PLAN
> §3.4 step 2 + E7, as briefed): the mortuary temple east of the G2 gate on
> its own terrace; the causeway (E7) with a ★ route; the granite valley temple
> (VII:318-335) at its end, consistent with the Sphinx floor at −12.8 (D-20);
> the Sphinx Temple (VII:211-225) in the same pass if it fits. GeoWriter
> builders in `KhafreComplex.ts`, families, conf/basis/epoch on every
> footprint, own streams, clearances, perf and audit.
> The human is away: every decision carries a ★ RECOMMENDED DEFAULT.
> Contract unchanged: no `?epoch=` ⇒ the world bit-identical.

## 1. Verified findings

Frame: metres, G1 at the origin, +x east, +z south, world Y = ASL − 60.
Heights below are from the code's formulas without the seed noise (± 1.8 m,
`GizaControl.ts:277`), the crest wobble (± 28 m, `:295`) or sand; the
verifier ported them (plane, escarpment, quarry bowl and carve, knolls, the
T2-2 block, the pads) and Haiku B's ten hand-computed samples agree with
that model within 0.3 m.

### 1.1 What the canon asks — and does not say (Haiku A)

1. VII gives NO figures for any of the four buildings — no size, height,
   position or date — and MPB's temple and causeway specs are Khufu's
   (`MASTER_PROMPT_BIBLE.md:2975`). Every number here is an outside figure
   or a reconstruction choice, lettered.
2. The causeway "links: Valley Temple ↓ Sphinx ↓ Mortuary Temple ↓ Pyramid"
   (`VOL_VII.md:290-305`); it should give "progressive elevation" (`:315`)
   and "reveal the pyramid gradually rather than immediately" (`:317`).
3. Valley temple: "megalithic construction, high-quality granite, polished
   surfaces, precise masonry, symmetrical layout, formal entrances"
   (`:318-335`). Sphinx Temple: "massive limestone blocks, granite elements,
   open courtyards, formal geometry, controlled lighting" (`:211-225`), light
   "through open courtyards and roof openings" (`:241`). The palette: local
   limestone, Tura, Aswan granite, basalt paving (`:242-257`); MPB's granite
   is "Pink Aswan granite" (`MASTER_PROMPT_BIBLE.md:210`) — the repo's
   GRANITE `[0.6, 0.39, 0.34]` (`SouthWorks.ts:417`, `PyramidBuilder.ts:49`)
   is that pinkish red.
4. Views: "approaching from the Valley Temple" and "elevated plateau
   perspective with the Khafre Pyramid behind the Sphinx" (`VOL_VII.md:398,
   402`); "secondary structures must never obstruct these … vistas" (`:403`).
   Scene hierarchy `KhafreComplex → MortuaryTemple, Causeway, ValleyTemple,
   Sphinx, SphinxTemple` (`:428-434`).
5. Visual hierarchy: causeways "visible from 2 km", valley temples from 1 km
   (`MASTER_PROMPT_BIBLE.md:2314-2323`) — merged GeoWriter meshes have no LOD,
   so they hold at any distance.
6. Gating: D-19 (`DEVIATIONS.md:264`) and the Bible (`MASTER_PROMPT_BIBLE.md
   :82`) — all four only under KHAFRE_PERIOD. D-20 (`DEVIATIONS.md:281-291`):
   the real Sphinx floor ≈ 20 m ASL; ours −12.8 (≈ 47 ASL), provisional.

### 1.2 The ground (verifier; Haiku B)

7. East of the Sphinx the plateau eases down to the escarpment crest:
   polyline `ESCARP` (`GizaControl.ts:63-77`), segment (490, 330)→(430, 620),
   crest 55→52 ASL (`:78`); the crest (sd = 0) lies at x 470 (z 431), 459
   (z 480), 454 (z 505). All temple sites are on the PLATEAU side (sd −9 …
   −63 m); the plateau→crest blend is `smoothstep(-160, 0, sdE)` (`:314`).
8. Ground today under the KHAFRE world (T2-2 floor rise included): at the
   would-be temple fronts x 423 it is −4.7 … −6.4 (z 410 … 522); at x 372
   (z 478 … 522) −2.2 … −2.8; (405, 431) −8.1 (on the T2-2 ramp,
   `fy = mix(floorY, h, smoothstep(58, 100, lx))`, `:435`); (405, 495) −5.0.
   A level floor at −12.8 DAYLIGHTS on the escarpment face at x 495 / 490 /
   484 / 478 / 473 / 468 (z 410 / 431 / 454 / 478 / 500 / 522) — the
   temples' forecourt opens east by itself, no fill needed.
9. The Sphinx enclosure band: `encK = smoothstep(-60.5, -57.5, lx) ·
   smoothstep(39.5, 36.5, |lz|)` (`:432`) — full for |z − 431| ≤ 36.5, zero
   at 39.5, no east limit; its cut faces carry bedding only for lx < 70
   (`sphinxWall`, `:445-446`). The paws reach x 375.2 (`Sphinx.ts:59, 69`).
10. Khufu's quarry: centre (100, 450), RX 210, RZ 145, rot 0.26 (`:131-135`,
   `CANON_DIMENSIONS.ts:212`); `quarryDepth = 13 · bowl · (1 − 0.85 ·
   exitKeep)` (`:404-407`) is NOT in the height — `QuarryCarve` subtracts it
   in 1.12 m lifts after the synthesis (`QuarryCarve.ts:71, 85`;
   `Heightfield.ts:137`). The floor sits at −7.5 … −8.3 along any line
   through the bowl's core (carve ≈ 12.3 m); the bowl's ENE tip lies near
   (303, 504) — the Sphinx site is just outside it (dq 1.09).
11. Mortuary-temple box x −202 … −92, z 325 … 375 (with the G2 pad,
   `:541-545`): ground 10.0 at its west end (G2 pad core to x −197, blend to
   −185), then 7.8 … 5.9 eastward; area mean 7.41.

    | level | cut | fill | max fill |
    |---|---|---|---|
    | +7 | 3.3k m³ | 1.1k m³ | 1.1 m |
    | +8 | 1.3k | 4.6k | 2.1 |
    | +10 | 0 | 14.3k | 4.1 (east front) |

12. `heightAtCpu` (`Heightfield.ts:174-189`) reads back the FINAL height —
   quarry carve and sand included — so a builder's `grd()` sees the quarry
   floor.

### 1.3 What can be reused (Haiku C)

13. `GeoWriter` (`KhufuComplex.ts:67`): `box(cx, y0, cz, lx, h, lz, tone,
   batter = 0, yaw = 0, batterZ?)` (`:86`, the wall rule `:97`), `drum()`
   (`:148`); `limestoneMaterial(base, gi, courseH, blockWm, {rough, spec,
   paveW})` (`:195-204`) — `50, 50` gives a joint-free monolith (`Sphinx.ts:72`,
   `SouthWorks.ts:417`).
14. Khufu's causeway (`KhufuComplex.ts:466-575`) is the template: 180
   segments, a GRADE `max(straight line, grd + 0.35)` smoothed 3 times
   (`:495-504`), an embankment PEDESTAL to `min(ym − 1, gMin − 2)` from four
   ground samples (`:531`), Tura floor, 1.3 × 3.8 m walls, roof slabs with a
   central slit (`:548-553` — the comment says 0.45 m, the arithmetic gives
   0.8 m), a footprint every 6th segment with `yaw`, `yFloor`, `cutting`
   (`:556-572`). Its stream is `rng.fork('causeway')` on `khufu-complex`
   (`:326, :485`) — a fork consumes a parent draw, so Khafre must NOT touch
   that root; and its code must not be refactored (float order → fpdump).
15. Khufu's mortuary temple (`:419-464`): 7 m walls, no roof, basalt court
   floor (`:427`), 14 pillars of local limestone at tone 0.45 (`:443-456`);
   its temenos opening is `G1_MORTUARY_TEMPLE_NS / 2 + 0.25` (`:411`) — the
   wall stops at the temple's flanks. Khafre's wall today has `gateHalf = 3`
   (`KhafreComplex.ts:83`).
16. `buildKhafreComplex(scene, seed, gi)` (`KhafreComplex.ts:30`) has no
   heightfield; `hf` is in scope in `TerrainScene.ts:56` and the call is at
   `:130`. New families must join `STRUCT_FAMILIES` (`:91-98`) or `fpClear`
   leaves stale footprints on Inspector rebuilds, and the evidence gate's
   `SELF_TAGGED` (`HarbourEvidence.ts:72`, checked at `:111` — conf only).
17. The Khafre court is tagged `conf: 'C'` (`KhafreComplex.ts:67`) though
   its width rests on `G2_TEMENOS_OFFSET` (D, `CANON_DIMENSIONS.ts:262`);
   the rule is "the lower of form and place" (`Footprints.ts:56-57`) → D.

### 1.4 What still stands under the epoch (Haiku D)

18. Off when `khufuWorks` is false (`TerrainScene.ts:103`): south works,
   work camp, haul lines 0/1/5 (`Inhabitants.ts:341`), trains (`:654`),
   shelters, scaffold. STILL ON: the Khufu complex (all north of z 195),
   the family courts (south walls ≈ z 185–195), the Sphinx, G2 and its court,
   debris, particles, torches, the extras.
19. In the corridor's way: the quarry-face gang 2 (`Inhabitants.ts:285`:
   x 20–180, z 420–470, n 110, spread 34 — it GROWS under the epoch as the
   Khufu lines drop out of `canonScale`, `:373`) and the debris anchors
   (100, 450) r 90 and (40, 380) r 45 (`Debris.ts:95-96`) — figures and chips
   would stand inside the causeway's pedestal. Gang 3 (`:286`, z 510–525)
   and the dust sources (`Particles.ts:76-79`) are harmless.
20. Far: the harbour basin edge ≈ 750 m (`GizaControl.ts:116-118`), the town
   gate gang ≈ 185 m, the torches' nearest pair (392, 644) ≈ 120 m south of
   the valley temple.
21. Views: bm12 (430, 6, 431) looks due west along z 431 — a Sphinx Temple
   east of the paws stands between it and the Sphinx (`Bookmarks.ts:53`);
   bm7 'quarry' (0, 15, 560, yaw −0.738) looks NE across the quarry — the
   causeway crosses its view near (130, 418) (`:41`); bm4 sees the mortuary
   temple in front of G2's east face (`:35`); bm8 'queens & temple' looks
   across the paws (`:42`).

### 1.5 Measuring and auditing (Haiku E)

22. `perf.ts`: `--q` goes to both arms, `--b` to arm B (`tools/perf.ts:57,
   68`; example `:20`); pins `preset=high&force=1&dpr=1` (`:55`); readings
   with dpr cuts drop out (`:116`); it prints the scene pass and the SUM of
   `r.shadow.*` (`:99`). `?ablate=` knows only clouds, ao, taa, bloom
   (`PostStack.ts:81-82`) — there is no shadow ablation; the shadow sum is
   the signal.
23. Resolution: per-cascade times swing 1.2 ↔ 4.6 ms between rounds of the
   same arm — 3 rounds cannot resolve below ≈ 2 ms (`STATUS.md:499-500`).
24. Collision audit: overlap only past 0.15 m on all axes
   (`CollisionAudit.ts:33, 102`); same-family pairs skipped (`:94`); allow
   lists both ways (`:40`); `platform` and `grounded` both get float
   (> 0.45 m, `:34, 123`), buried (`:125`) and sunk (`:127`, exempt with
   `cutting`); yawed footprints overlap-test their AXIS-ALIGNED box
   (`Footprints.ts:91`).
25. `closeup.ts --id` matches id PREFIXES, first `n` in registry order
   (`tools/closeup.ts:78-80`); `--q` passes through (`:53`).
26. Merged meshes cast to the CSM's `maxFar` 3600 on high (`TerrainScene.ts
   :319-322`); the caster drop list runs on low/safe only
   (`ShadowSetup.ts:215-217`).

## 2. Decisions (★ = recommended default — the main session decides)

| # | question | ★ default | alternatives |
|---|---|---|---|
| K-1 | mortuary temple floor | ★ +10.0 = `G2_PAD_Y`: a second epoch pad, floor continuous with the court through the widened doorway; ALL FILL (≈ 14k m³, ≤ 4.1 m at the east front) — the temple's east end stands on a built podium where the causeway arrives | +7.0 (cut ≈ fill, 3.3k / 1.1k m³) with a 3 m step at the doorway — a stair the plan cannot source |
| K-2 | its size and place | ★ 110 × 50 m, x −202.2 … −92.2 (west wall on the temenos line), z 325 … 375 on the axis — D: rounded, to be checked against Hölscher 1912 before DEVIATIONS | the full published plan when supplied |
| E7 | the causeway's route | ★ TWO LEGS: the temple front (−92.2, 350) → bend (255, 484) → the valley temple's west face (382.5, 484): 372.0 + 127.5 = 499.5 m (the commonly cited length is ≈ 495 m — outside figure, C); leg 1 21.1° S of E across the worked-out quarry on Khufu's PEDESTAL rule (≤ 13.4 m high), leg 2 due east along the enclosure's south side, its north edge at z 479.25 — 9.75 m clear of the band (≤ 469.5) and 6.25 m of its cut face (≤ 473). D: the real one is straight; ours bends because our enclosure (± 38 m) and quarry bowl differ from the real ones | (a) straight to (360, 505) (the T2-3 line): its north edge clips the enclosure's SW corner by ≈ 2.5 m and reaches the temple mid-west; (b) straight and clear: the valley temple 64 m south of the Sphinx Temple; (c) reshape the quarry (default-world change — the human's) |
| K-3 | causeway grade | ★ straight +10.0 → −2.0, lifted to `grd + 0.35`, smoothed SIX passes (Khufu: 3): max grade ≈ 8.3 %, deck +3.1 at the bend, pedestal > 5 m for ≈ 230 m, no cutting (verifier's model). Ending at −3.0 with 3 passes gives 15 % at the lip | Khufu's 3 passes |
| K-4 | causeway section | ★ Khufu's: 9.5 m (`G1_CAUSEWAY_WIDTH`, C), walls 1.3 × 3.8, roofed with the slit — it hides G2 until the temple (VII:317); copied into `KhafreComplex.ts`, Khufu's code untouched (§1.3 14) | a shared helper extracted from Khufu's (fpdump risk) |
| K-5 | temples' floor (D-20) | ★ −12.8 = `SPHINX_FLOOR_Y`: ONE rock-cut terrace for the Sphinx, its temple and the valley temple, as the real three share one level; it daylights on the escarpment (finding 8). Cut (epoch-only): the enclosure floor made level east (≈ 42.6k m³, ≤ 8.4 m) + the valley-temple terrace (≈ 39.3k m³, ≤ 10.7 m) | the current ground (≈ −5): the temples 8 m above the Sphinx's paws — breaks "directly associated"; the floodplain (−44.5): 450 m from the Sphinx |
| K-6 | valley temple | ★ 45 × 45 m centred (405, 500): x 382.5 … 427.5, z 477.5 … 522.5; walls 13 m (top +0.2), granite outside (jointed, large blocks), limestone core; two east doorways (z 488, 512), granite jambs; flat roof; 16 granite pillars of the T-hall; the causeway arrives at the NW (z 479.25 … 488.75) at deck ≈ −2.0, near roof level — the inner descending passage is not modelled. C for the square (outside figure), D for the rest | interior halls modelled |
| K-7 | Sphinx Temple | ★ in THIS pass, as the last step (cut to T2-5 if steps 1–3 miss a gate): 46 × 46 m centred (405, 431): x 382 … 428, z 408 … 454, 6.8 m east of the paw tips; walls 9 m (top −3.8) of massive local limestone; an open court with a granite-pillared colonnade, roofed ambulatory, two east doorways (z 419, 443), niches E and W on the axis. D throughout | sketch only, built in T2-5 |
| K-8 | bm12 vs the Sphinx Temple | ★ bm12 unchanged — the temple in front of the Sphinx IS the relationship; the head and face stay above its walls (the sightline to the chin crosses x 382 at ≈ +2.5), the chest and paws go behind the west wall (sightline to the paw tops ≈ −8.5 there, wall top −3.8). If the frame suffers: raise its eye to Y 12 (the default tour's frame 12 then changes pose — re-baseline that one frame) | move it now |
| K-9 | a view "approaching from the Valley Temple" (VII:398) | ★ bm13 'from the valley temple': p (392, 4.0, 484) on the temple roof (top +0.2) on the causeway's line — 4.0, not eye height, so the causeway's roof (top ≈ +2.3, just west) does not cut G2's base — yaw 1.145, pitch +0.03, t 8.0, epoch KHAFRE_PERIOD; the Sphinx at 85 m 13.8° RIGHT of the axis, G2 at 734 m 13.8° LEFT, its apex 11.5° up — "the Khafre Pyramid behind the Sphinx" (`:402`). `?bm=13` only (no key); appended, so frames 1–12 of the default tour stay | none |
| K-10 | the quarry gang and the debris in the corridor | ★ under the epoch only, reject positions within 9.5 m of the causeway's axis (new `khafreCorridorDist(x, z)` from the route constants) — the gang and the chips re-draw; default draws unchanged | move gang 2's rectangle south |
| K-11 | the court's conf | ★ 'C' → 'D' (finding 17), in the same commit | leave it |

## 3. Design

### 3.1 Constants (`CANON_DIMENSIONS.ts`, after the G2 block `:244-262`)

- `KHAFRE_MT_EW` 110, `KHAFRE_MT_NS` 50 (D, "rounded; Hölscher 1912 to be
  checked"), `KHAFRE_MT_Y = G2_PAD_Y`.
- `KHAFRE_CAUSEWAY: [x, z][]` = `[[-92.2, 350], [255, 484], [382.5, 484]]`
  (D — D-22), `KHAFRE_CAUSEWAY_END_Y` −2.0 (D).
- `KHAFRE_VT_CENTER` (405, 500) (D), `KHAFRE_VT_SIDE` 45 (C, outside
  figure), `KHAFRE_VT_H` 13 (D); `SPHINX_TEMPLE_CENTER` (405, 431) (D),
  `SPHINX_TEMPLE_SIDE` 46 (D), `SPHINX_TEMPLE_H` 9 (D); the temples' floor =
  `SPHINX_FLOOR_Y` (D-20).
- `khafreCorridorDist(x, z)`: distance to the two-leg polyline (for K-10 and
  the audit).

### 3.2 Terrain (`GizaControl.ts`, all inside the existing epoch `if`s)

1. In the T2-2 block (`:426-447`, before the strata so the faces get
   bedding):
   - the enclosure floor LEVEL to the east: `fy = floorY` instead of the
     58 → 100 rise (`:435`) — `h = mix(h, min(h, cut), encK)` (`:443`)
     already cuts only, so the floor runs at −12.8 until it daylights
     (x ≈ 484–495);
   - the valley-temple terrace: `vtK = smoothstep(372, 375, x) ·
     smoothstep(463, 466, z) · smoothstep(531, 528, z)`; `h = mix(h, min(h,
     floorY), vtK)` — cut only; its north edge overlaps the band so no ridge
     stands between them;
   - `sphinxEnc = encK · smoothstep(200, 170, lx)` (was 100 → 70) and a
     `vtEnc = vtK` both join `worked`; the bedding band's east limit
     `smoothstep(70, 55, lx)` (`:446`) → `smoothstep(175, 160, lx)`, plus the
     VT terrace's west and south faces.
2. After the G2 pad (`:541-545`): `mtPad = smoothstep(6, 0, max(|x + 147.2|
   − 59, 0)) · smoothstep(6, 0, max(|z − 350| − 29, 0))` (core x −206.2 …
   −88.2, z 321 … 379, blend 6 m); `h = mix(h, G2_PAD_Y, mtPad)`; joins
   `worked`. Outside the `if`: `float(0)` — value-identical by default.
3. The causeway changes NO terrain (K-4: Khufu's pedestal on `grd()`).

### 3.3 The temenos doorway (`KhafreComplex.ts:80-91`)

- `gateHalf = KHAFRE_MT_NS / 2 + 0.25` = 25.25 (Khufu's rule, `KhufuComplex.
  ts:411`): the east runs z 222.2 … 324.75 and 375.25 … 477.8; the footprints
  `east-n` / `east-s` follow. The court strip (x −222.4 … −202.2) meets the
  temple's west wall — `khafre-temple` allows `khafre-pavement` and
  `khafre-temenos`.

### 3.4 The mortuary temple

- `buildKhafreComplex(scene, seed, hf, gi)` — `hf` added (call at
  `TerrainScene.ts:130`); stream `seed.rng('khafre-mortuary')`.
- Massing on +10.0: outer walls 8 m (D) of local limestone, batter as
  Khufu's; inside, west → east: the offering hall against the court, an open
  court with granite pillars (2 rows of 6, monoliths, the SouthWorks granite
  material), a roofed pillared entrance hall (4 × 2 granite pillars, roof
  slabs — Khufu's has none), the east doorway on the axis where the causeway
  arrives. Floor Tura slabs (the real calcite floor is omitted: not in the
  palette — DEVIATIONS).
- Footprint `khafre:mortuary` (family `khafre-temple`, ground `platform`,
  allow `khafre-temenos`, `khafre-pavement`, `khafre-causeway`).

### 3.5 The causeway

- Two legs, each a copy of Khufu's segment loop (`KhufuComplex.ts:466-575`)
  with its own `yaw`: leg 1 134 segments (2.78 m), leg 2 46 (2.77 m); the
  grade over the WHOLE route (K-3) so the bend has no step; at the bend one
  square block (pedestal + floor + walls, `w + 2.4` on a side) closes the
  mitre gap. Stream `seed.rng('khafre-causeway')`.
- Footprints every 6th segment: `khafre:causeway:<i>`, family
  `khafre-causeway`, ground `grounded`, `yFloor`, `cutting`, `yaw`, allow
  `khafre-temple`, `khafre-temenos`, `khafre-pavement` — and the evidence
  (conf D, basis "route bent round the provisional enclosure; Khufu's
  section", epoch 'khafre'). The yawed AABB (finding 24) meets nothing but
  the two temples it allows.
- Counter `khafre.cwMaxGrade` (‰) and `khafre.cwSegs`.

### 3.6 The valley temple (K-6)

- Stream `seed.rng('khafre-valley')`. Granite walls: `limestoneMaterial(
  GRANITE, gi, 1.6, 2.4, { rough: 0.55, spec: 0.45 })` (D — large polished
  blocks; HarborDistrict's granite is 0.5 / 1.15), batter 0.08 on the outer
  faces; a limestone core box inside each wall (not visible); a flat roof
  of limestone slabs at +0.2 with a low parapet; the two east doorways
  with granite jambs and lintels; 16 granite pillars (1.05 m square, D) in
  a T-hall under the roof; the floor Tura.
- Footprint `khafre:valley` (family `khafre-temple`, ground `platform` on
  −12.8, allow `khafre-causeway`).

### 3.7 The Sphinx Temple (K-7, last step)

- Stream `seed.rng('khafre-sphinx-temple')`. Walls of local limestone with
  LARGE jointing (`courseH` 2.0, `blockWm` 3.0 — "massive limestone
  blocks"); the open court ≈ 26 × 26 m with 24 granite pillars round it under
  a roofed ambulatory whose inner edge leaves the court open (VII:241); two
  east doorways; a niche on the axis west and east.
- Footprint `khafre:sphinx-temple` (family `khafre-temple`, `platform` on
  −12.8). 6.8 m from `sphinx:paws` — different families, compared; no
  allow needed.

### 3.8 Wiring, flags, families, evidence

- `TerrainScene.ts:130`: `buildKhafreComplex(structures, seed, hf, gi)` →
  counters `khafre.slabs`, `khafre.cwSegs`, `khafre.cwMaxGrade`.
- `?ktemples=0` (under the epoch only): skips §3.4–3.7 meshes AND their
  footprints; the terrain (§3.2) and the doorway stay — the A/B switch, as
  `?g2=0` (`Monuments.ts:143-145`).
- `STRUCT_FAMILIES` (`TerrainScene.ts:91-98`) and `SELF_TAGGED`
  (`HarbourEvidence.ts:72`) gain `khafre-temple`, `khafre-causeway`.
- Meshes named `khafre-mortuary-*`, `khafre-causeway-*`, `khafre-valley-*`,
  `khafre-sphinx-temple-*` (per material) — the canon's hierarchy, and
  `?hide=` works on them (merged meshes have no LOD rewriting `visible`).
- K-10: `khafreCorridorDist` in `Inhabitants.ts` (gang placement, under
  `!khufuWorks`) and `Debris.ts` (needs the epoch: `buildDebris` gets it
  from `TerrainScene.ts:213`) — re-draw up to 8 times, then drop.
- Bookmarks: append bm13 (K-9) after `:53`.

## 4. Cost, measurement, audit

### 4.1 Cost

- Boxes: causeway 180 × 6 + the bend ≈ 1.1k; mortuary ≈ 150; valley ≈ 120;
  Sphinx Temple ≈ 150 → ≈ 1.5k boxes ≈ 18k triangles in ≈ 10 merged
  meshes — under 2 % of G2's ≈ 1M stone triangles. Expected: scene pass and
  shadow sum within noise (finding 23).

### 4.2 Commands (pane closed, idle GPU; never `noguard` on one arm)

1. Default untouched: `npx tsx tools/perf.ts --bm 1,3,7 --runs 3`; `npx
   tsx tools/fpdump.ts` → 1142 / 1142 identical; tour frames 1–12 identical
   (13 is new).
2. In the epoch, A = with, B = without: `npx tsx tools/perf.ts --bm
   13,12,7,4,8 --runs 3 --q "epoch=KHAFRE_PERIOD" --b "ktemples=0"` — bm13
   and bm12 face the temples, bm7 the causeway across the quarry, bm4 the
   mortuary temple before G2, bm8 the Sphinx area from G1's east.
3. RULE (★): accept if the fps medians A = B and the scene pass Δ ≤ 1.5 ms at
   every bookmark; the shadow sum is reported, not gated (≈ 2 ms
   resolution). If over: `castShadow = false` on the floor slabs and the
   roofs' inner runs first (flat, self-shadowed), then a coarser causeway
   (90 segments) — not culling.

### 4.3 Audit

- In-app (`audit.ts --epoch KHAFRE_PERIOD` → the collision audit): the new
  families are compared with everything else; must be PASS — float/buried
  on the temples' `platform` footprints (their terraces), sunk on the
  causeway (`cutting` where it applies), no overlap with `sphinx:*`,
  `khafre:temenos:*`, `pyramid:G2`.
- `tools/audit.ts` (pure, under `--epoch KHAFRE_PERIOD`, from the
  constants): (i) every causeway point with lx ∈ [−60.5, 100] keeps |z − 431|
  ≥ 39.5 + 4.75 + 3; (ii) the route length 499.5 ± 1; (iii) the route ends
  on the valley temple's west face inside its north half; (iv) `gateHalf =
  KHAFRE_MT_NS / 2 + 0.25`; (v) the counter `khafre.cwMaxGrade` ≤ 100 ‰ after
  boot; (vi) the evidence gate covers the two new families.

## 5. Risks and verification

### 5.1 Risks

1. Default leaks — every terrain line inside the existing `if`s, every
   builder behind `!khufuWorks`, K-10 behind the epoch; fpdump, the tour
   (1–12), the inhabitants line, battery.
2. The T2-2 floor change moves the Sphinx scene: bm12 and the closeups of
   `sphinx:*` re-shot under the epoch (the floor east of x 383 drops up to
   4.7 m to −12.8).
3. The pedestal across the quarry is a 13 m wall in bm7's view (finding 21)
   — intended (the epoch's world), screenshot it.
4. The VT terrace's 10 m west face (x 372–375) right under the causeway's
   end — the pedestal fills down to the terrace (`gMin − 2`); check the
   closeup that no daylight opens under the last segments.
5. Granite jointing scale (D) — a closeup at 20 m and 200 m.

### 5.2 Checklist

1. Default: perf step 1; fpdump; tour 1–12; inhabitants line.
2. `npx tsx tools/audit.ts --epoch KHAFRE_PERIOD` — all PASS incl. §4.3.
3. `npx tsx tools/closeup.ts --id khafre:mortuary,khafre:causeway:,
   khafre:valley,khafre:sphinx-temple --n 4 --q "epoch=KHAFRE_PERIOD"`.
4. Tour under the epoch: bm13, bm12, bm7, bm4, bm8 — at bm13 the Sphinx and
   G2 in frame; at bm12 the head above the temple wall.
5. Perf step 2, the rule.

## 6. Docs

- STATUS "T2-4"; DEVIATIONS D-22: the bent route, the pedestal across
  Khufu's quarry, the temples on the D-20 terrace and its cut, the sizes
  (D), the calcite floors omitted; README: `?ktemples=0`, bm13, the new
  counters.
- From the recon (follow-ups, not this step): Khufu's mortuary pillars'
  comment says "granite-toned" — they are dark local limestone
  (`KhufuComplex.ts:443-456`); the causeway roof-slit comment says 0.45 m,
  the slit is 0.8 m (`:548-553`); the town's gate lamps stand ≈ 105 m from
  the gate (`Torches.ts:92`).

## 7. Haiku precision

Five read-only Haiku agents; every row checked against the code or the
text at the cited line by the verifier.

| agent | task | rows | confirmed | notes |
|---|---|---|---|---|
| A | canon and sources | 30 | 29 | one wrong implication: the T2-3 E7 line "would change the default world if built" — it is epoch-only |
| B | terrain along the routes, 10 samples | 30 | 28 | samples match the verifier's model (≤ 0.3 m); one row cites `:430` for a quote at `:276`; one claims the quarry's graded haul-out is "not implemented" — it is the `exitKeep` sector falloff (`GizaControl.ts:402-407`) |
| C | builders and patterns | 30 | 28 | the SouthWorks granite pillars lie flat ON SLEEPERS (stored — not a bug); "the comment is wrong" on Khufu's pillars is a misreading (dark tone is what it says) |
| D | clearances under the epoch | 30 | 30 | 15 conflicts against the TEST candidates — the design avoids them (E7 bend, ST moved to x 382, K-10) |
| E | perf, audit, tooling | 30 | 30 | no shadow ablation exists; the resolution limit |

**Haiku precision: 145/150 (96.7 %).**
