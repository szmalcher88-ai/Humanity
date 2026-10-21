# T2-6 — MENKAURE'S QUEENS, MORTUARY TEMPLE, CAUSEWAY AND VALLEY TEMPLE UNDER MENKAURE_PERIOD (build plan)

> Prepared 2026-10-21 by a read-only side session on the `15013d2` tree
> (T2-5 committed). Nothing in `src/` or `tools/` was touched. Scope (T2-5
> G3-6, as briefed): the three queens south of G3 on their own terraces; the
> mortuary temple east of G3 with the doorway widened to its flanks; the
> causeway and the valley temple, cleared against the town, the Main Wadi,
> Khafre's terrace and the Sphinx band; the canon's "Construction Areas,
> Stone Stockpiles, Workshops" and whether MENKAURE_PERIOD shows the complex
> unfinished. The human is away: every decision carries a ★.
> Contracts: no `?epoch=` ⇒ bit-identical; `?epoch=KHAFRE_PERIOD` ⇒
> bit-identical (fpdump `--q`). Everything here is gated on
> `atLeast(…, 'MENKAURE_PERIOD')`.
>
> Heights below are the verifier's NOISE-FREE model (plane, knolls,
> escarpment, Main Wadi, the G3 pad). T2-5 measured that model 1–2 m LOW on
> the seeded ground (pad: model fill ≤ 2.9 m, measured fill ≤ 1.9 m and a
> cut ≤ 1.8 m). So every terrace LEVEL here is set at build time by
> `tools/ground.ts --wrect` (cut ≈ fill), and the model only chooses the
> rectangles.

## 1. Verified findings

### 1.1 The canon (Haiku A)

1. District 3 names "Menkaure Pyramid, Three Queen Pyramids, Temple
   Complex, Construction Areas, Stone Stockpiles, Workshops" and "Construction
   progress may vary depending upon selected historical timeline"
   (`MASTER_PROMPT_BIBLE.md:2427-2445`); presets "should dynamically modify
   architecture, population, construction progress" (`:94`). No figure for
   any of it; MENKAURE_PERIOD is "Later Fourth Dynasty royal construction"
   (`VOL_IX.md:124`). "Unfinished", "Shepseskaf" and a mudbrick temple
   appear nowhere in the canon or the repo; the canon's only mudbrick is the
   worker city's (`MASTER_PROMPT_BIBLE.md:2817`).
2. Construction sites: "highly coordinated" with crew leaders, measuring,
   lifting, transport, finishing, inspection (`VOL_VIII.md:250-267`); the
   whole stone supply chain visible (`:446-472`); storage separated by
   material (`:527-548`); workshops "produce visible outputs: dust, smoke,
   waste materials, finished products" (`MASTER_PROMPT_BIBLE.md:2561-2569`);
   "Partially extracted blocks. Failed extraction attempts." (`:2583-2587`).
3. Queens (the Khufu reference section, `MASTER_PROMPT_BIBLE.md:3644-3660`,
   applied here as a principle): "an integrated architectural ensemble",
   "individual dimensions", "Avoid duplicating geometry". D-5 gave Khufu's
   three one base (`DEVIATIONS.md:61-63`) — T2-6 must not.
4. D-19/D-21/D-22/D-23 (`DEVIATIONS.md:273, 315, 351-352, 381`): every
   figure an outside source (C) or a reconstruction (D); all of it gated.

### 1.2 What can be reused (Haiku C)

5. `KhafreComplex.ts` is the template: `buildKhafreComplex(scene, seed, hf,
   gi)` (`:100`) with `grd` for the causeway grade, the `?ktemples=0` switch
   (`:113`), named writers per material (`:116`, `m.name` at `:457`), the
   granite monolith material (`:124`), the doorway rule `gateHalf = MT_NS / 2
   + 0.25` (`:171`), the causeway counters (`:188-190`) and footprints with
   `yFloor` / `cutting` (`:330-332`), evidence on every footprint (`:447`).
6. `buildMenkaureComplex(scene, seed, gi)` (`MenkaureComplex.ts:27`) has NO
   heightfield, two UNNAMED writers (`:34-35`) and `gateHalf = 3` (`:76`);
   its call sits in the `!khufuWorks` branch under MENKAURE
   (`TerrainScene.ts:133, 140-141`).
7. `add()` takes 13 positional arguments ending `graniteCourses, evidence,
   shadowLod, graniteUndressed` (`Monuments.ts:62-76`); Khufu's queens pass
   `46, 0.95, 0.5` as courseCount / course1 / courseMin and NO evidence
   (`:129-138`). Undressed rows: facet residual × 15, wave × 1.5
   (`PyramidSpec.ts:120-124`).
8. No stepped pyramid exists anywhere; the nearest primitive is the
   battered mastaba box (`KhufuComplex.ts:742`). Construction props live
   inline in `buildSouthWorks` (stream `south-works`, `SouthWorks.ts:77`):
   size-sorted block stacks (`:313-343`), granite members on sleepers
   (`:269-272`), a sledge (`:392-407`) — Khufu-only (`TerrainScene.ts:146`).
   Mudbrick = `limestoneMaterial([0.6, 0.48, 0.35], gi, 0.3, 0.45)`
   (`WorkerTown.ts:671`). Debris runs in every epoch (`Debris.ts:80, 190`).

### 1.3 Ground (Haiku B; verifier)

13. South of G3 the ground is the Main Wadi's north bank: the wadi line
    (−700, 920) → (−150, 850) → (350, 800), floor 41 → 34 → 26 ASL, a 150 m
    band, carve weight `smoothstep(0, 150, d)^1.7` that only lowers ground
    (`GizaControl.ts:85-96, 320-327`). B's noise-free samples, matching the
    verifier's model within ≈ 0.5 m: (−640, 800) +3.6, (−588, 790) +4.9,
    (−540, 800) −1.8, (−460, 760) +8.8, (−300, 800) −15.4, (−100, 820) −26.4,
    (100, 800) −29.6, (250, 760) −29.8, (300, 700) −15.2. The bank falls
    ≈ 4 m in 10 m between z 780 and 830 (verifier's profiles at x −545 and
    −637).
14. The plateau cap +12 (`:278`) covers everything north of the bank from
    x −700 to ≈ −250 — the mortuary temple's ground; the escarpment crest
    runs at x ≈ 373 (z 700) / 301 (z 800) (`:65-80`), so the valley floor's
    plateau-side edge is the wadi floor west of x ≈ 300; the floodplain
    starts near x 850 (`:331`). The Khafre terrace (`:441`) and the Sphinx
    band lie north of z 531; the town's NW/SW gallery pads cover x ≈ 420 …
    510 (`:545`).
15. The seeded ground adds crest wobble ± 28 m (`:297`), plateau noise
    ± 1.8 m and detail (`HeightSynthesis.ts:67`) and sand (`Heightfield.ts
    :212`) — measured levels differ from these by 1–2 m (T2-5's lesson).

### 1.4 Clearances and life (Haiku D; verifier)

- Verifier, from the constants: the causeway line (−446.1, 690) → (121,
  800) stays ≥ 313 m from the Wall of the Crow's west end (434, 701), ≥ 160 m
  south of Khafre's terrace (z ≤ 531) and the Sphinx band (z ≤ 473), and
  outside Khufu's quarry bowl (dq ≈ 2.3 at (100, 796); bowl `GizaControl.ts
  :131-135`). The valley temple (125 … 175, 775 … 825) is ≥ 270 m from the
  town's NW gallery pad (world x ≈ 424) and the gate lane (487 … 494,
  663 … 718); the nearest debris and dust anchors — (170, 510) r 50 and the
  town's (500, 650) r 60 (`Debris.ts:97, 105`) — and the quarry gang
  (x 60 … 150, z 510 … 525, `Inhabitants.ts:286`) lie ≥ 240 m away. Nothing is
  placed around G3's south side (T2-5 finding 18).

- Haiku D (3 conflicts against the TEST candidates, all resolved by the
  design): the temple's west face on the temenos east wall (x −517.6 …
  −514.6, `MenkaureComplex.ts:78`) — by design: the doorway widens to the
  temple's flanks (T-2), so the wall's runs end at z 667.25 / 712.75 and the
  temple (z 667.5 … 712.5) stands in the gap, `menkaure-temple` allowing
  `menkaure-temenos`; the queens' test squares graze G3's pad blend (z ≤
  778.9, `GizaControl.ts:572`) — the terraces are applied AFTER it and win;
  the causeway runs into its valley temple — by design (it ends there).
  The temenos' south wall (z 760.4 … 763.4, `MenkaureComplex.ts:72`) is
  ≥ 9.6 m from the queens' cores. Under MENKAURE `khufuWorks` is false: the
  town, industry, debris, particles, torches and necropolis stand
  (`TerrainScene.ts:105, 124-250`); the town's west edge (the gallery and
  pen pads, x ≥ 415, `CANON_DIMENSIONS.ts:350-359`) and the Wall of the
  Crow (west end (434, 701)) are ≥ 290 m from the valley temple. The quarry
  debris' gaussian tails are unclamped (`Debris.ts:134`) but at the
  causeway's lower end they are > 3.5 σ out. Views: bm4 looks across the
  whole site at 1.2–1.7 km (`Bookmarks.ts:36`); bm12 and bm13 see its
  northern band at the edge of the frame (`:54, 61`).

### 1.5 Measuring and auditing (Haiku E)

9. `tools/ground.ts --wrect x0,z0,x1,z1` samples a 5 × 5 grid through
   `window.__akhet.groundAt` and prints min/max/mean (`tools/ground.ts:9-12,
   36`) — it has NO `--q`, so it measures the DEFAULT world; the queens' and
   the valley temple's rectangles lie outside every epoch's pads there
   (G3's pad blend reaches z 778.9 only), so the default ground IS the
   ground they replace. `fpdump.ts --q` exists (`:33`).
10. The audit's G3 row (`tools/audit.ts:84-100`) checks the height against
    65.5 m ± 1.5 (the base check is a tautology, `:99`) on `WorldSeed(1)`
    (`:89`) — the default seed is 1 (`Params.ts:72`), so it is the world's.
    The evidence gate matches `/^pyramid:G[23]$/` (`HarbourEvidence.ts:111`)
    — `pyramid:G3-a` would ESCAPE it; `SELF_TAGGED` (`:72`) and
    `STRUCT_FAMILIES` (`TerrainScene.ts:92-100`) need every new family.
11. Same-family pairs are never compared (`CollisionAudit.ts:94`) — G2 and
    G3 are both `pyramids`, and so would G3-a be.
12. Inspector edits: a pyramid follows `edPos` (`Monuments.ts:77`, editable
    unless G1, `:108`); the pads (`GizaControl.ts:554, 571`) and the courts
    (`KhafreComplex.ts:104`, `MenkaureComplex.ts:28`) read constants, and an
    Inspector rebuild never re-bakes terrain. Moving the courts onto `edPos`
    is identity without a delta (`EditOverrides.ts:40`) but would leave a
    moved wall floating off its fixed pad — no cheap fix (E-1).

## 2. Decisions (★ = recommended default — the main session decides)

| # | question | ★ default | alternatives |
|---|---|---|---|
| M-1 | what MENKAURE_PERIOD shows | ★ AT MENKAURE'S DEATH: G3 and G3-a built, G3-b/c stepped cores, the temples' limestone cores unfinished, the causeway half-laid, construction yards and gangs (§3.1) — the canon's "Construction Areas, Stone Stockpiles, Workshops" and "progress may vary" (finding 1) | Shepseskaf's mudbrick completion (finished, plastered mudbrick on the stone cores — outside sources, not the canon) |
| Q-1 | the queens' forms and sizes | ★ G3-a (east) a true pyramid 44 m, 52° (C: Reisner; Maragioglio & Rinaldi); G3-b, G3-c stepped cores 31 m, four tiers (C for the forms, D for tier heights) — two sizes, two forms, the stepped pair drawn on their own streams so their tiers differ (finding 3) | all three true pyramids |
| Q-2 | their row | ★ centred on G3's axis, gaps 12 m, cores' north edges at z 773 (their blends clear G3's pad core and temenos) — D | the row hard against the temenos |
| Q-3 | their ground | ★ PER-QUEEN terraces stepping down to the east (model levels −1.1 / +3.9 / +5.8; max cut/fill ≈ 11 / 8 / 8 m), levels MEASURED (§3.2), retaining walls on the fill sides | one row terrace at +4 (cut 8, fill 11.6 m) |
| T-1 | mortuary temple | ★ 70 × 45 m (D), its west wall on the temenos line, on the plateau cap (+12, the G3 pad extended east); unfinished core walls 7 m, granite casing begun on the east front | Khafre's 110 × 50 |
| T-2 | the doorway | ★ `gateHalf = 45 / 2 + 0.25` = 22.75 (Khafre's rule, finding 5) | — |
| C-1 | causeway route | ★ (−446.1, 690) → (121, 800): 577.6 m, 11.0° S of E, down the wadi's north bank (C: ≈ 608 m usually cited) | a route along the bank's foot to lower the grade (longer) |
| C-2 | causeway state and grade | ★ Khufu's rule, 6 passes (model max ≈ 14 %); unfinished: pedestal + floor slabs on the upper 290 m, a graded track below; audit cap 150 ‰ | a cutting to hold ≤ 8 % |
| V-1 | valley temple | ★ on the wadi floor at (150, 800), 50 × 50 m (D), terrace at the measured mean (model −30.1, cut ≤ 3.8 / fill ≤ 1.2 m); foundations and first courses only | on the bank at (150, 760) (model −24, ± 8 m) |
| W-1 | construction areas | ★ three yards (temple, causeway front, valley temple) with stacks, a masons' shed, sledges, waste chips, partly extracted blocks; gangs appended last; own dust spawn; no torches | none |
| B-1 | a view | ★ bm14 'Menkaure's works' (§3.7), `?bm=14` only | none |
| E-1 | Inspector edits of G2/G3 (logged) | ★ leave as logged — courts on `edPos` would float off their fixed pads (finding 12) | make G2/G3 non-editable (Inspector-only change) |

## 3. Design (★)

### 3.1 What MENKAURE_PERIOD shows (M-1)

★ The complex AT MENKAURE'S DEATH: G3 built (its granite already left
undressed, T2-5); G3-a finished; G3-b and G3-c as stepped cores (their
casing never added); the mortuary temple's local-limestone core walls
standing, roofless, its granite casing begun on the east front; the
causeway's foundation embankment laid on its upper half, the lower half a
graded track with block stacks; the valley temple a foundation platform
and the first courses of its core walls. Around them the canon's
"Construction Areas, Stone Stockpiles, Workshops" (`MASTER_PROMPT_BIBLE.md
:2437-2443`) and working gangs — "Construction progress may vary depending
upon selected historical timeline" (`:2445`). Shepseskaf's mudbrick
completion is a LATER state (an alternative, or a future preset).

### 3.2 The queens (Q-1 … Q-3)

| queen | form | centre (x, z) | base | terrace core (x0 … x1, z0 … z1) | model level | model max cut / fill |
|---|---|---|---|---|---|---|
| G3-a (east) | true pyramid, `Monuments.add` | (−545, 799) | 44 | −571 … −519, 773 … 825 | −1.1 | 11.3 / 11.0 |
| G3-b | stepped core, GeoWriter | (−594.5, 792.5) | 31 | −614 … −575, 773 … 812 | +3.9 | 7.2 / 8.2 |
| G3-c (west) | stepped core, GeoWriter | (−637.5, 792.5) | 31 | −657 … −618, 773 … 812 | +5.8 | 5.8 / 7.7 |

- Row: centred on G3's axis, gaps 12 m, the true pyramid east (D for the
  layout; C for "east one true, two western stepped"). North edges of the
  cores at z 773 so their 6 m blends (z 767 …) clear G3's pad core (z ≤ 766.9)
  and the temenos' outer face (763.4).
- The ground falls ≈ 4 m in 10 m here (the Main Wadi's north bank): per-
  queen terraces stepping DOWN to the east (the bedrock's fall) keep the
  extremes ≈ 11 / 8 / 8 m; one shared row terrace would need cut 8 and fill
  11.6 m at +4 (verifier's model). The fill sides (south) get a battered
  retaining wall of local limestone from the terrace edge down to the
  measured ground (`grd` − 0.5), family `menkaure-terrace` — a 6 m blend
  over 11 m of fill would be a 2.75 slope, far past the sand's repose 0.65.
- Levels: `npx tsx tools/ground.ts --wrect "-571,773,-519,825" --wrect
  "-614,773,-575,812" --wrect "-657,773,-618,812"` (the default world —
  finding 9) → each level = its mean; the 5 × 5 grid is coarse on a 0.4
  slope, so also read min/max and keep the retaining wall's foot at
  `grd − 0.5` per run, not at the mean.
- G3-a: `add('G3-a', 44, 52, x, level, z, 44, 0.95, 0.5, 0, evidence D)`
  after G3 — Khufu's queens' course parameters (`Monuments.ts:129-138`),
  ≈ 2.3k stones. G3-b, G3-c: four battered tiers of local limestone (tier
  heights ≈ 5 m, insets ≈ 3.5 m — D), family `menkaure-queens`.

### 3.3 The mortuary temple (T-1, T-2)

- 70 × 45 m (D), x −516.1 … −446.1 (its west wall on the temenos line),
  z 667.5 … 712.5, on the plateau cap: the ground there is +12 in the model
  (T2-5 measured up to ≈ 1.8 m above) — the G3 pad extended east over it
  (core x −520 … −442, z 663 … 717, 6 m blend, +12), as Khafre's temple pad.
- The temenos' east doorway → `gateHalf = 45 / 2 + 0.25` = 22.75
  (`MenkaureComplex.ts`, Khafre's rule).
- Unfinished: core walls 7 m of LARGE local-limestone blocks (jointing 2 m ×
  3 m), no roof; granite casing on the east front's lower 3 m only; an
  offering hall's floor laid; the rest open. Family `menkaure-temple`.

### 3.4 The causeway (C-1, C-2)

- ★ From the temple's front (−446.1, 690) to the valley temple's west face
  (121, 800): 577.6 m, 11.0° S of E — the commonly cited length ≈ 608 m
  (outside figure, C). It runs down the Main Wadi's north bank: the model
  ground falls from +12 (x ≤ −256) to −30 (wadi floor); Khufu's grade rule
  (`max(straight, grd + 0.35)`, 6 passes) gives a max ≈ 14 % on the bank
  (verifier) — steep for a finished causeway, plausible for an unfinished
  construction track (D); audit cap 150 ‰.
- Unfinished (M-1): upper 290 m — Khufu's pedestal + floor slabs, NO walls
  or roof; lower part — a graded track (no masonry), survey stakes every
  20 m, block stacks at the working front. Family `menkaure-causeway`.

### 3.5 The valley temple (V-1)

- ★ On the Main Wadi's floor at (150, 800), 50 × 50 m (D): a terrace core
  58 × 58 at the measured mean (model −30.1, cut ≤ 3.8 / fill ≤ 1.2 m); a
  1.2 m limestone foundation platform, core walls 2 m high (first courses),
  block stacks inside. Family `menkaure-temple`.

### 3.6 Construction areas (W-1)

- Three yards, family `menkaure-works`, stream `menkaure-works`: the temple
  yard east of the mortuary temple (granite and limestone block stacks,
  a masons' shed, two sledges), the causeway's working front, the valley
  temple site. Gangs appended LAST to the extras, present only under
  MENKAURE (`TerrainScene.ts:237`); a dust spawn of their own; no lit
  torches (the 14-light cap).

### 3.7 Switch, views

- `?mworks=0` (under MENKAURE): skips §3.2–3.6 meshes, footprints and gangs;
  the terraces stay — the A/B switch.
- bm14 'Menkaure's works' (MENKAURE_PERIOD, `?bm=14` only): p (−360, −8, 800)
  on the wadi bank (model ground −12.1 — set Y from `surfaceProbe` + 1.7 at
  build), yaw 1.212, pitch +0.12, t 9.0: G3 5° off-axis (apex 19° up), the
  temple 22°, G3-a 20°, G3-c 19°.

### 3.8 Wiring, streams, families, evidence

- `buildMenkaureComplex(scene, seed, hf, gi)` (hf added, call at
  `TerrainScene.ts:141`) returns `{ slabs, cwSegs, cwMaxGrade, cwMaxAt,
  works }`; named writers per part and material (`menkaure-temple-*`,
  `menkaure-causeway-*`, `menkaure-queens-*`, `menkaure-valley-*`,
  `menkaure-works-*`) as `KhafreComplex.ts:116`.
- Streams, all `seed.rng(name)` (order-free): `menkaure-temple`,
  `menkaure-causeway`, `menkaure-valley`, `menkaure-queen-b`,
  `menkaure-queen-c`, `menkaure-works`, `menkaure-dust`; G3-a on its own
  `monument-G3-a`, its `add()` LAST after G3.
- Families: `menkaure-temple`, `menkaure-causeway`, `menkaure-queens`,
  `menkaure-terrace`, `menkaure-works` → `STRUCT_FAMILIES` and `SELF_TAGGED`;
  the gate's id regex → `/^pyramid:G(2|3|3-a)$/`; every footprint conf D (C
  only where both form and place are C — none here) with a basis and
  epoch 'menkaure'.
- Terrain (`GizaControl.ts`, inside the MENKAURE `if` at `:570`, after the
  G3 pad): the temple pad (core x −520 … −442, z 663 … 717, +12), the three
  queen terraces, the valley-temple terrace; all join `worked`.
- Gangs: `menkaureWorks = atLeast(epoch, 'MENKAURE_PERIOD')` in
  `TerrainScene.ts`; three lines (yard 40, causeway front 50, valley site
  30) appended at the END of the extras array (`:237`) only when it is true.

## 4. Cost, measurement, audit

- Cost: G3-a ≈ 2.3k stones (≈ 46k triangles); the stepped queens,
  temples, causeway (≈ 100 pedestal segments), terraces' walls and yards
  ≈ 2k boxes ≈ 25k triangles; ≈ 120 figures from the extras' share.
- Commands (pane closed, idle GPU):
  1. Default: `npx tsx tools/fpdump.ts` → 1142 / 1142 identical; `npx tsx
     tools/perf.ts --bm 1,3,7 --runs 3`.
  2. KHAFRE unchanged: `npx tsx tools/fpdump.ts --q "epoch=KHAFRE_PERIOD"`
     identical to the `15013d2` dump.
  3. Levels: `npx tsx tools/ground.ts --wrect "-571,773,-519,825" --wrect
     "-614,773,-575,812" --wrect "-657,773,-618,812" --wrect
     "121,771,179,829" --wrect "-520,663,-442,717"` (queens, valley temple,
     mortuary temple).
  4. MENKAURE A/B: `npx tsx tools/perf.ts --bm 14,4,12,1 --runs 3 --q
     "epoch=MENKAURE_PERIOD" --b "mworks=0"`. RULE (★, as before): fps
     medians A = B, scene Δ ≤ 1.5 ms (a NEGATIVE Δ is a saving, not a
     breach), shadow sums reported.
- Audit (`tools/audit.ts --epoch MENKAURE_PERIOD`): the collision audit
  over the new families (float / buried on the terraces' footprints; sunk
  with `yFloor` / `cutting` on the causeway); a G3-a row (height from 52°
  vs ≈ 28 m published, ± 1.5); the causeway counter `menkaure.cwMaxGrade`
  ≤ 150 ‰; route checks from the constants — the causeway's distance to
  the Wall of the Crow's west end (434, 701) ≥ 250 m, to Khufu's quarry bowl
  dq > 1.1, to the Khafre terrace (z ≤ 531) ≥ 200 m.

## 5. Risks and checklist

1. Default and KHAFRE leaks — every line behind MENKAURE; both fpdumps.
2. The queens' terraces on a 0.4 slope: the 5 × 5 `ground.ts` grid is
   coarse — the retaining walls' feet from `grd` per run, and closeups of
   each fill face.
3. The causeway's ≈ 14 % on the bank reads steep — acceptable for an
   unfinished track (C-2); if not, the cutting alternative.
4. Figures on the yards: `obstacleField` re-seats around the new
   footprints (MENKAURE only — the KHAFRE gangs never see them).
5. Checklist: fpdumps; ground levels → constants; `audit.ts --epoch
   MENKAURE_PERIOD` all PASS; `closeup.ts --id pyramid:G3-a,menkaure: --n 4
   --q "epoch=MENKAURE_PERIOD"`; tour under MENKAURE (bm14, bm4, bm12);
   perf step 4.

## 6. Docs

- STATUS "T2-6"; DEVIATIONS D-24 (the queens' sizes/forms/row/terraces,
  the temples' sizes and unfinished state, the causeway's route and grade,
  the valley temple on the wadi floor, the yards; Shepseskaf's mudbrick
  not shown); README `?mworks=0`, bm14.
- From the recon (not this step): the audit's G3 base check is a tautology
  (`tools/audit.ts:99`); "Queen Pyramids … individual dimensions" vs D-5's
  single base for Khufu's queens (`DEVIATIONS.md:61-63`).

## 7. Haiku precision

Five read-only Haiku agents; every row checked against the code or the
text at the cited line by the verifier.

| agent | task | rows | confirmed | notes |
|---|---|---|---|---|
| A | canon and sources | 30 | 30 | District 3's list, the construction-site rules, the queens' "individual dimensions" (a Khufu section, applied as a principle) |
| B | ground south and east of G3, 9 samples | 29 | 29 | samples within ≈ 0.5 m of the verifier's model; `ground.ts` measures the default world only |
| C | builders to reuse | 30 | 29 | one row cites `src/monuments/TerrainScene.ts` — the file is `src/debug/` |
| D | clearances and life | 30 | 29 | late (≈ 10 min); one wrong row: "the causeway's start cap clips the temenos' east face" — its start (x −446) is 70 m east of the wall |
| E | perf, audit, tools | 30 | 28 | `closeup.ts --id` DOES split on commas (`:77`); repeats the "bm7 −1.83 ms over the rule" misreading (it is a saving) |

**Haiku precision: 145/149 (97.3 %).**
