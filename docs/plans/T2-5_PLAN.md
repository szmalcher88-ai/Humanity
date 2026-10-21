# T2-5 — THE WORKERS' TOWN AT ITS KHAFRE_PERIOD EXTENT: ASSESSMENT — AND ★ MENKAURE_PERIOD + G3 (build plan)

> Prepared 2026-10-21 by a read-only side session on the `b5cda5f` tree
> (T2-4 committed). Nothing in `src/` or `tools/` was touched. Brief: canon
> IX §9.3's "critical correction" — Heit el-Ghurab belongs mainly to the
> Khafre/Menkaure periods, today's town is the Khufu-era extent (D-6) — so
> grow the town under KHAFRE_PERIOD; "if the canon gives too little for a
> buildable plan, say so and propose the best alternative T2-5 (e.g.
> MENKAURE_PERIOD's G3)". The human is away: every decision carries a ★.
> Contract: no `?epoch=` ⇒ bit-identical; and here also: the KHAFRE world
> unchanged by anything gated on MENKAURE.

**Verdict.** The canon gives the town no layout, no size, no position and
no split by period (§1.1), the repo holds no excavated plan, and the
DEFAULT town already draws every component the brief names except a
Western Town (§1.2). A "Khafre-period extent" would be laid out from memory
(D throughout). ★ T2-5 = **MENKAURE_PERIOD + G3** (§4): the canon names it
(Bible District 3, IX's presets), its form has published survey figures, the
pipeline is proven twice (G2, the Sphinx), and it completes the three-pyramid
skyline at bm4. The town extension stays fully specified as the alternative
T2-5b (§5), and the canon tension it exposes goes to the human (T-0).

## 1. Verified findings

### 1.1 The canon on the town — and on Menkaure (Haiku A)

1. The only town-specific period line: Heit el-Ghurab is "especially
   associated with the Khafre and Menkaure building periods … the complete
   later settlement plan must not be transplanted unchanged into Khufu's
   reign" (`VOL_IX.md:129`); the presets are one-phrase labels
   (`:118-125`); "The simulation must use the relevant archaeological
   timeline to determine which … settlements … appear" (`:127`); the same
   holds for waterfront buildings (`:131`).
2. VIII asks for a planned settlement (`VOL_VIII.md:66`), twelve districts
   (`:85-99`), bakeries (`:303-317`), separated storage (`:528-548`) — with no
   position, area, count or date anywhere. The Bible's District 6 repeats
   the list (`MASTER_PROMPT_BIBLE.md:2501-2533`); its one physical fact is
   "low mudbrick buildings" (`:2817`). "Gallery" in the canon is only the
   Great Pyramid's (`:3088`); "silo", "Western Town", "Eastern Town", "Lost
   City", "Tavares" appear nowhere in canon, src or docs.
3. Presets "should dynamically modify architecture, population,
   construction progress, and environmental state" (`MASTER_PROMPT_BIBLE.md
   :94`) — today the town is identical in every epoch (`STATUS.md:654`;
   `buildWorkerTown` takes no epoch, `TerrainScene.ts:149`).
4. Menkaure: "The southern district represents the transition toward later
   Fourth Dynasty construction" with "Menkaure Pyramid, Three Queen
   Pyramids, Temple Complex, Construction Areas, Stone Stockpiles,
   Workshops" (`MASTER_PROMPT_BIBLE.md:2427-2445`); "Construction progress may
   vary depending upon selected historical timeline" (`:2445`); visible from
   3 km (`:2311`). No G3 anything in the repo; `?epoch=MENKAURE_PERIOD`
   falls back to the KHAFRE world with a notice (`Epoch.ts:31, 35, 48`).
5. Contradictions in the repo: D-6 says the excavated gallery phases "date
   mainly to Khafre/Menkaure" and renders a "Khufu-era extent (smaller
   gallery blocks …)" (`DEVIATIONS.md:68-73`) — "smaller" is unquantified —
   while the builder's header says "shown as the Khufu-era settlement per
   AERA's dating" (`WorkerTown.ts:3`). `WALL_OF_CROW_LENGTH` / `_HEIGHT` (A,
   `CANON_DIMENSIONS.ts:168-169`) are read by nothing; the wall is built
   205 m × 9 m (`WorkerTown.ts:130-132`). STATUS paraphrases "especially
   associated" as "belongs mainly to" (`STATUS.md:1016`). README still says
   "no Menkaure and no Sphinx" (`README.md:239`).

### 1.2 The town as built (Haiku B) — town frame (u east-ish, v south-ish)

6. Frame: centre (560, 860) (B, "AERA site maps", `CANON_DIMENSIONS.ts:311-
   312`), yaw −0.14 (unsourced, `:317`); `townToWorld` (`TownFrame.ts:18`);
   the builder's origin follows `edPos` but the pads, the industry and the
   canon work lines use the raw centre (`EditOverrides.ts:40`,
   `GizaControl.ts:532-534`).
7. Components (all family `worker-town`, stream `worker-town` forks in a
   fixed order — a fork consumes a parent draw, `Seed.ts:107`):
   Wall of the Crow v −175, u ± 102.5, 9.5 × 9 m, gate at u −45
   (`WorkerTown.ts:129-153`); FOUR gallery blocks 78 × 36 m, 16 galleries
   each = 64, centres (−78, −118), (10, −118), (−78, −73), (10, −73)
   (`:156-236`); the Eastern Town, a 7 × 9 grid u 56 … 125, v −133 … −55, ≈ 44
   houses, a public court carved out (`:239-309, 249`); nine bakeries u −99 …
   1, v 29 … 44 (`:311-337`); the RAB 46 × 34 at (96, 30) with six silos
   (`:339-379`); pens and woodpiles (`:381-411`); a low enclosure wall —
   its "south" run actually at v +2 across the middle, west run u −125,
   east run u 127.5, NO north run (`:413-448`); the I3 brewery, physicians,
   scribes, public court and animals on stream `townsfolk` (`:450-664`).
   The industrial quarter (family `industry`, streams `industry`,
   `industry-folk`) lies south: brickyard u 95 … 170, v 95 … 195, pottery,
   copper, rope walk (`IndustryDistrict.ts:8, 38, 55, 66`).
8. Twelve pads (`CANON_DIMENSIONS.ts:329-350`), applied in list order with a
   6 m blend and no epoch condition (`GizaControl.ts:537-544`). Free
   rectangles on or beside them (B; terrain off the pads not verified by
   B): north of the galleries u −100 … 96, v −167 … −151 (keep the gate lane);
   v 4 … 18 across the middle; u 40 … 124, v −16 … 18; u 130 … 150, v 4 … 94;
   the brickyard's west u 64 … 92, v 75 … 190.
9. Verifier: the ground WEST of the enclosure (u −260 … −130, v −60 … +60)
   falls ≈ 1 m in 40 m (world −31 … −35; model, no seed noise) — the only
   large free ground on the town's plateau side.

### 1.3 The people, the lights, the smoke (Haiku D)

10. Budget `{safe 140, low 320, high 900, ultra 1200}` (`Inhabitants.ts:73`)
    for the 25 canon lines (one shared `canonScale`, `:373`); extras share
    `budget × 0.25` (`:72, :374`). Order: canon 0–24, then extras
    (`TerrainScene.ts:237`); EVERY gang spends a draw at `:434`, and the
    skin/kilt/cadence (`:524-526`) and the figure geometry fork (`:628`) come
    after ALL placement — so a gang that exists in a world changes every
    figure of that world. Epoch-only gangs must be absent from the default
    array, not zero-sized.
11. A KHAFRE-only footprint must be registered only under the epoch
    (`Inhabitants.ts:392` is the precedent), or it re-seats default figures
    (`obstacleField`, `:233-256`).
12. Torches: the 14-light cap is already reached in the default world —
    any new lit spot is silently unlit (`Torches.ts:130`); the bakery
    hearths sit on world axes, ≈ 14 m off their rotated bakeries
    (`Torches.ts:63`; a v1.1 bug fixed for smoke only). Particles: one
    weighted source pick per particle (`Particles.ts:144`) — new sources need
    their own spawn.

### 1.4 Around the town (Haiku C; verifier)

- The town sits in the Main Wadi's mouth: the wadi line (350, 800) →
  (700, 810), floor 26 → 20 ASL (`GizaControl.ts:85-94`) runs 5–66 m from the
  gallery pads (verifier's model); the pads were levelled ≈ 1 m above the
  noise-free ground they replace (`CANON_DIMENSIONS.ts:331-349` vs model).
- Distances (verifier): the canals start at x 1205 (`Irrigation.ts:36-39`),
  the harbour basin centres (1077, −135) (`GizaControl.ts:116`), the market
  stands on the harbour's north shore (`HarborDistrict.ts:418`), Khufu's
  valley temple (817, −115) (`CANON_DIMENSIONS.ts:353-356`) — all ≥ 600 m
  away. Khafre's valley temple (405, 500) and its terrace end ≈ 180 m north
  of the Wall of the Crow's west end (world ≈ (434, 701)); a T2-5b Western
  Town (world x 304 … 432, z 835 … 918) would stand ≥ 315 m from it, on the
  wadi floor.
- Haiku C: the town spans world x ≈ 420 … 756, z ≈ 667 … 1062; the wadi line
  passes ≈ 54 m north of its centre (floor ≈ 22 ASL there); no parcels,
  canals or farmsteads west of x 1170 (`Irrigation.ts:59`, `Fields.ts:151`),
  so the plain x 800 … 1150 is empty; the only approach line is the gate
  lane (487, 663) → (494, 718) (`Inhabitants.ts:326`) — keep x 470 … 520,
  z 640 … 720 open; litter and dust gather at (500, 650) and (680, 900)
  (`Debris.ts:105-106`, `Particles.ts:82`). Views: bm5 'town gate' and bm6
  'gallery street' frame it (`Bookmarks.ts:39-40`); bm8 aims at it but the
  plateau rim hides it; bm10 probably occluded by the escarpment.
- Haiku C also found: the gallery-street lamp posts are laid on world axes
  (`Torches.ts:73-74`) — lamp 0 lands at town (−56, −105), INSIDE the NW
  gallery block.

### 1.5 Measuring and auditing (Haiku E)

13. The town is two merged meshes (`mud`, `stone`) plus the townsfolk
    mesh, UNNAMED and casting on every preset (`WorkerTown.ts:671-676`;
    the low/safe drop list matches names only, `ShadowSetup.ts:215-217`); not
    culled per cell; its only counter is `town.rooms` (`TerrainScene.ts:149`);
    `?hide=` cannot target it (`:298`); no town A/B flag exists.
14. `perf.ts` defaults to bm 1, 3, 7 (`tools/perf.ts:47`) — no town view;
    the town views are bm5 'town gate' and bm6 'gallery street'
    (`Bookmarks.ts:39-40`); the only town fps on record is the iGPU's
    (`STATUS.md:1325`).
15. All town footprints are one family — house-vs-house or gallery-vs-wall
    overlaps are never compared (`CollisionAudit.ts:94`); none carries
    conf/basis/epoch and `worker-town` is outside the evidence gate
    (`HarbourEvidence.ts:68, 72, 111`); the gate names `pyramid:G2` by
    literal id (`:111`).

### 1.6 The G3 site (verifier)

16. The WGS84 delta of G3 from G1 is ≈ (−588, 743) (B — the same source
    class as the Sphinx's, `CANON_DIMENSIONS.ts:232-234`). The ground there
    (model; plane, knolls, escarpment, Main Wadi, no seed noise): the
    plateau cap +12.0 (`GizaControl.ts:276`) for z ≤ 743, then the Main
    Wadi's slope — the wadi line runs at z ≈ 906 here with a 150 m band
    (`:85-94`, `:320-325`): +10.6 at z 769, +2.8 at 795, −8.0 at 823,
    −16.8 at 853.
17. Earthwork of a +12.0 pad (base 103.4 m, court + wall + 5 m margin =
    half 76.9) by centre:

    | centre z | under the base | under the pad core | south edge |
    |---|---|---|---|
    | 743 (WGS84) | fill ≤ 11.5 m, 13.9k m³ | fill ≤ 22.6 m, 75.5k m³ | a 27 m drop (slope 3.4) |
    | 713 | ≤ 1.7 m | ≤ 10.8 m, 15.1k m³ | 16.7 m (2.1) |
    | 690 | 0 | ≤ 2.9 m, 1.1k m³ | 7.6 m (0.95) |
    | 680 | 0 | ≤ 0.8 m | 4.2 m (0.53) |

18. Nothing is placed in x −700 … −480, z 600 … 900 (verifier: no
    structure literal there); the G2 pad ends at x −475 and z 495; the West
    Field at z ≈ 199.
19. Bookmarks that frame G3 at (−588, 690) (bearing vs the 85.6° fov,
    verifier): bm4 2.8° off-axis at 1495 m (apex 2.9° up) — the three
    pyramids on one line; bm1 15.5° (2144 m), bm2 19.8°, bm10 16.0°, bm12
    14.3° (1050 m).

## 2. Decisions (★ = recommended default — the main session decides)

| # | question | ★ default | alternatives |
|---|---|---|---|
| T-0 | what T2-5 builds | ★ MENKAURE_PERIOD + G3 (§4) — evidence-backed and the canon's next stage; the town extension waits for a plan source | T2-5b, the town (§5), D throughout |
| T-1 | the canon tension: the DEFAULT (Khufu) town already shows the later plan (IX:129) | ★ the human's call — shrinking the default town is a default-world change; record it in D-6 now (doc only) | shrink it under a KHUFU-only flag later |
| G3-1 | G3's centre | ★ (−588, 690): the WGS84 delta moved 53 m north off the authored Main Wadi's band — at the delta the court would stand on 22.6 m of fill (finding 17); D-23, as G2 moved to its knoll (D-21). The diagonal G2 → G3 turns ≈ 4°; bm4 keeps the three in one frame | (−588, 713), 30 m, a 10.8 m fill terrace; the delta (B) with a 22 m terrace |
| G3-2 | form | ★ base 103.4 (C, mean of the published 102.2 × 104.6), 51.3° (C) → 64.5 m, 92 courses (D, G1 scaled by height), course1 / courseMin as G1, 16 granite courses (C), on +12.0 (D) | the 104.6 side (65.3 m) |
| G3-3 | the granite's finish | ★ UNDRESSED (Menkaure's casing left with its working faces — C): tilt jitter × 3 and roughness 0.78 on the granite rows, near stones only | dressed, as G2's band |
| G3-4 | shadows | ★ `shadowLod` 300 as G2 (11.2k stones — a fifth of G2's; the cascades were G2's whole cost, `STATUS.md:491`) | none |
| G3-5 | the court and wall | ★ as G2's (Khufu's offsets, D), east doorway for the later temple; new `MenkaureComplex.ts` | none until T2-6 |
| G3-6 | the queens, temples, causeway, construction areas | ★ T2-6 (the queens on the wadi slope south need their own terraces) | now |

## 3. What changes where (★ G3)

- `Epoch.ts:31, 35` — implement MENKAURE_PERIOD (§4.1).
- `CANON_DIMENSIONS.ts` — `G3_*` after the T2-4 block (§4.2).
- `GizaControl.ts:550-564` — the G3 pad under MENKAURE (§4.3).
- `PyramidSpec.ts:37`, `PyramidBuilder.ts` — `graniteUndressed` (§4.4).
- `Monuments.ts:145-163` — the G3 `add()` after G2 (§4.4).
- new `MenkaureComplex.ts`; `TerrainScene.ts:91-98, 128-139` — families and
  the build under MENKAURE (§4.5).
- `HarbourEvidence.ts:72, 111`; `tools/audit.ts:63-74`; `tools/fpdump.ts`
  (`--q`) (§4.6).

## 4. ★ Design — MENKAURE_PERIOD + G3

### 4.1 The epoch

- `IMPLEMENTED` gains `'MENKAURE_PERIOD'` (`Epoch.ts:31`), its `FALLBACK`
  row goes (`:35`). Every `atLeast(…, 'KHAFRE_PERIOD')` gate stays true for
  it (`:57-58`): the MENKAURE world = the KHAFRE world + what is gated on
  `atLeast(…, 'MENKAURE_PERIOD')`. `khufuWorks` stays false. Today the URL
  boots the KHAFRE world with a notice (`main.ts:223-225`); afterwards its
  own.

### 4.2 Constants

| constant | value | conf | source / note |
|---|---|---|---|
| `G3_BASE_SIDE` | 103.4 | C | mean of the published 102.2 × 104.6 m (Petrie; Maragioglio & Rinaldi) — `add()` takes a square base; confirm before DEVIATIONS |
| `G3_SLOPE_DEG` | 51.3 | C | ≈ 51°20′ (Petrie) → 64.5 m (≈ 65.5 m is usually cited with the 104.6 side) |
| `G3_COURSE_COUNT` | 92 | D | G1's 210 × 64.5 / 146.6 — an estimate, as G2's |
| `G3_GRANITE_COURSES` | 16 | C | the lowest sixteen courses red granite, widely published |
| `G3_CENTER` | (−588, 690) | D | the WGS84 delta (−588, 743) moved 53 m north — D-23 |
| `G3_PAD_Y` | 12.0 | D | the plateau cap (`GizaControl.ts:276`) |
| `G3_TEMENOS_OFFSET` | 20.2 | D | Khufu's offsets, as `G2_TEMENOS_OFFSET` (`:262`) |

### 4.3 The platform (`GizaControl.ts`)

- After the KHAFRE pad block (`:550-561`), before `if (!full)` (`:564`):
  `let g3Pad = float(0); if (atLeast(gp.epoch, 'MENKAURE_PERIOD')) { d3 =
  |p − G3_CENTER|; g3Pad = smoothstep(88.9, 76.9, max(d3.x, d3.y)); h =
  mix(h, G3_PAD_Y, g3Pad) }` — half 76.9 = 51.7 + 20.2 + 5, blend 12 m; fill
  ≤ 2.9 m on the south strip (finding 17); `worked` (`:613`) gains
  `.max(g3Pad)`. No draw; value-identical in every other world.

### 4.4 The pyramid

- `Monuments.ts`, after the G2 `add()` (`:145-163`): `if (atLeast(epoch,
  'MENKAURE_PERIOD') && q.get('g3') !== '0') add('G3', G3_BASE_SIDE,
  G3_SLOPE_DEG, G3_CENTER.x, G3_PAD_Y, G3_CENTER.z, G3_COURSE_COUNT,
  G1_COURSE1_HEIGHT, G1_COURSE_MIN_HEIGHT, G3_GRANITE_COURSES, { conf 'C',
  basis, epoch 'menkaure' }, 300)` — LAST, stream `monument-G3`.
  ≈ 1.18 × 92 × 103.4 ≈ 11.2k stones (≈ 224k triangles); the granite band
  ≈ 16–17 m high (verifier's port of `solveCourses`, `PyramidSpec.ts:81-108`;
  first course ≈ 1.26 m).
- `PyramidParams.graniteUndressed?: boolean` (after `shadowLod`,
  `PyramidSpec.ts:37`); only when set: the granite rows' drawn `tiltU` /
  `tiltV` (`PyramidSpec.ts:152-153`) × 3 AFTER the draws (no draw moves) and
  their roughness 0.78 in the builder (G2's band 0.6). G2 passes
  nothing — its graph and buffers unchanged. The far shell keeps the colour
  band (`uGraniteTop`) as G2's.

### 4.5 The court and wall (`MenkaureComplex.ts`)

- As `KhafreComplex.ts`'s first block: individual court slabs on stream
  `menkaure-pavement`, the temenos at `G3_TEMENOS_OFFSET` with an east doorway
  (`gateHalf` 3 until the temple), families `menkaure-pavement`,
  `menkaure-temenos`, evidence D / epoch 'menkaure'. Built in
  `rebuildStructures` under `atLeast(epoch, 'MENKAURE_PERIOD')`; the families
  join `STRUCT_FAMILIES` (`TerrainScene.ts:91-98`) and `SELF_TAGGED`
  (`HarbourEvidence.ts:72`). Meshes `menkaure-court`, `menkaure-temenos`.
  Counter `menkaure.slabs`.

### 4.6 Measurement, contract, audit

- `?g3=0` (under MENKAURE only) skips the `add()`; the pad stays.
- Commands:
  1. Default: `npx tsx tools/perf.ts --bm 1,3,7 --runs 3`; `npx tsx
     tools/fpdump.ts` → 1142 / 1142 identical.
  2. KHAFRE unchanged: `npx tsx tools/fpdump.ts --q "epoch=KHAFRE_PERIOD"`
     before and after, identical — `fpdump.ts` has no `--q` today: add it
     (2 lines, as `tour.ts:43-44`).
  3. G3: `npx tsx tools/perf.ts --bm 4,1,12,2 --runs 3 --q
     "epoch=MENKAURE_PERIOD" --b "g3=0"`.
  4. RULE (★, as T2-3/T2-4): fps medians A = B, the scene pass Δ ≤ 1.5 ms; the
     shadow sum reported (≈ 2 ms resolution, `STATUS.md:499-500`).
- Audit: an audit-local G3 row from the `G3_*` constants on the world's
  stream (`tools/audit.ts:63-74` pattern) — and, unlike G2's row (its base
  check compares a constant with a copy of itself, `:65, 80`), check the
  derived height against the published ≈ 65.5 m within 1.5 m; the evidence
  gate's literal `pyramid:G2` (`HarbourEvidence.ts:111`) → `/^pyramid:G[23]$/`;
  `audit.ts --epoch MENKAURE_PERIOD` all PASS (collision: `pyramid:G3`, the
  court and wall).

## 5. T2-5b — the town at its Khafre-period extent (the alternative, D)

If the human prefers it (T-0), this is buildable without touching the
default town:

- What it adds (presence C — AERA's published plan names them; layout D):
  a WESTERN TOWN of large houses west of the enclosure (u −250 … −135,
  v −60 … +40 — finding 9), the Eastern Town's growth onto u 130 … 150,
  v 4 … 94 and u 40 … 124, v −16 … 18 (finding 8), and the population.
- Terrain: new pads under `!khufuWorks`, AFTER the default pad loop
  (`GizaControl.ts:537-544`), inside an epoch `if`; levels from the cut/fill
  mean as the I3 pads (`CANON_DIMENSIONS.ts:341-342`).
- Builder: `buildKhafreTown(scene, seed, hf, gi)` — stream `town-khafre`,
  family `town-khafre` (compared with `worker-town`, so the new pieces are
  audited against the old), evidence D on every footprint, called after
  `buildWorkerTown` (`TerrainScene.ts:149`) under `!khufuWorks`.
- People: new lines appended at the END of the extras array
  (`TerrainScene.ts:237`), present only under `!khufuWorks` (finding 10);
  no new lit torches (finding 12); smoke on its own spawn.
- `?ktown=0`; perf `--bm 5,6,8,10 --q "epoch=KHAFRE_PERIOD" --b "ktown=0"`.

## 6. Risks, checklist, docs

### 6.1 Risks (★ G3)

1. Default and KHAFRE leaks — every line behind `atLeast(…,
   'MENKAURE_PERIOD')`; fpdump both worlds (§4.6).
2. The site move (D-23) — the human may prefer the WGS84 delta with a
   terrace; `G3_CENTER` is one constant, the pad follows it.
3. Undressed granite reads as noise at 1.5 km — check bm4 and a closeup at
   200 m; fall back to G2's band (G3-3 alternative).
4. MENKAURE's notice: the HUD's "not built" path must not fire any more
   (`main.ts:223-225`).

### 6.2 Checklist

1. Default perf step 1, fpdump; KHAFRE fpdump identical.
2. `npx tsx tools/audit.ts --epoch MENKAURE_PERIOD` — all PASS.
3. `npx tsx tools/closeup.ts --id pyramid:G3,menkaure: --n 4 --q
   "epoch=MENKAURE_PERIOD"`.
4. Tour under MENKAURE: bm4 (the three on one line), bm1, bm12.
5. Perf step 3, the rule.

### 6.3 Docs

- STATUS "T2-5"; DEVIATIONS D-23 (G3's site, form, course count, undressed
  granite, court); README: `?epoch=MENKAURE_PERIOD`, `?g3=0`, the stale
  "no Menkaure and no Sphinx" (`README.md:239`).
- D-6 (doc only, T-1): record that the default town shows the later plan,
  and the header contradiction (`WorkerTown.ts:3`).
- Follow-ups from the recon, not this step: the bakery hearth lights ≈ 14 m
  off their bakeries (`Torches.ts:63`), the gallery-street lamp posts inside
  the NW gallery block (`Torches.ts:73-74`) and the gate lamps ≈ 108 m west
  of the gate (`Torches.ts:92`) — all three on world axes instead of
  `townToWorld`; `WALL_OF_CROW_*` unused
  (`CANON_DIMENSIONS.ts:168-169`); the enclosure's "south" run sits at v +2
  and there is no north run (`WorkerTown.ts:424-448`).

## 7. Haiku precision

Five read-only Haiku agents; every row checked against the code or the
text at the cited line by the verifier.

| agent | task | rows | confirmed | notes |
|---|---|---|---|---|
| A | canon and sources (town, Menkaure) | 30 | 30 | "layout facts in canon: 2"; found the D-6 vs header contradiction and the unused `WALL_OF_CROW_*` |
| B | the town as built (u/v map, pads, free ground) | 30 | 30 | the enclosure's "south" run at v +2, no north run; free rectangles are its analysis (terrain off the pads checked by the verifier's model, finding 9) |
| C | around the town (terrain, water, temples, bookmarks) | 29 | 29 | late (≈ 14 min; a replacement was stopped unused); matches the verifier's model; found the lamp posts inside the NW gallery block |
| D | the people, lights, smoke | 30 | 30 | the draw-order hazards (every present gang moves every figure), the 14-light cap, the hearth offset |
| E | perf, audit, epochs | 30 | 29 | one misreading: T2-4's bm7 −1.83 ms called "over the rule" — it is a SAVING (A cheaper than B) |

**Haiku precision: 148/149 (99.3 %).**
