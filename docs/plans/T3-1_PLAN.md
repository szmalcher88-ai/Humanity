# T3-1 — KHUFU_LATE: THE GREAT PYRAMID UNDER CONSTRUCTION (build plan)

> Prepared 2026-10-21 by a read-only side session on the `980d3ec` tree
> (T2-6 committed; the T2 roadmap done). Nothing in `src/` or `tools/` was
> touched. Scope (as briefed): KHUFU_LATE — the Great Pyramid partly built:
> the height with a ★ grounded in the canon, the ramp system as D-7
> decided, the work on the courses, the casing state, the temple and the
> queens, the quarry at work, and what the existing Khufu world must CHANGE
> in that epoch; split if too large. The human is away: every decision
> carries a ★.
> Contracts: the default world (KHUFU_COMPLETION) bit-identical; KHAFRE and
> MENKAURE bit-identical (`fpdump --q`). Every change here is gated on
> `!atLeast(epoch, 'KHUFU_COMPLETION')` — an EARLIER stage.

## 0. The T3 roadmap (proposed)

| step | what | ★ |
|---|---|---|
| T3-1 | KHUFU_LATE, the pyramid: G1 at mid-height (≈ 98 courses, 73 m), undressed casing, the working platform, the ramp system (D-7's supply ramp + a zigzag on the south face), the court/temenos/remnant swaps, the gangs on the ramp and platform | this plan |
| T3-2 | KHUFU_LATE, the complex and the logistics: the mortuary temple, queens, G1-d, boat pits, causeway and valley temple in their LATE states; the quarry at work; Tura limestone arriving at the harbour ("limestone transport", IX:121) | next |
| T3-3 | KHUFU_EARLY: the levelled platform, the first courses, the supply ramp's early stage, the quarry opening (canon: "Early foundation", "Lower courses under construction") | after |
| T3-4 | the remaining canon state "Several decades after completion" (`MASTER_PROMPT_BIBLE.md` HISTORICAL STATE) as a later KHUFU preset or an EVIDENCE_VIEW option — the human's call (not in IX's preset table) | optional |

## 1. Verified findings

### 1.1 The canon and the recorded decisions (Haiku A)

1. The Bible's presets: "Early Khufu reign / Peak Pyramid Construction /
   Completed Great Pyramid / Khafre Period / Menkaure Period"
   (`MASTER_PROMPT_BIBLE.md:86-92`), and "Each preset should dynamically
   modify architecture, population, construction progress" (`:94`). Its
   HISTORICAL STATE lists "Early foundation. Lower courses under
   construction. Mid-height construction. Near completion." (`:3016-3019`) —
   no course number, height or block count anywhere.
2. IX: KHUFU_LATE "Advanced construction and limestone transport"; but
   KHUFU_COMPLETION is "Great Pyramid approaching OR reaching completion"
   (`VOL_IX.md:121-122`) — "near completion" already belongs to the
   default, so KHUFU_LATE must lie BEFORE it: mid-height.
3. Ramps: "No wheeled transport on construction ramps" (`MASTER_PROMPT_BIBLE
   .md:1356`); the stone flow "Quarry → Staging Yard → Ramp → Construction
   Platform" (`:2735-2749`); "partially dismantled ramps … should gradually
   disappear in later timeline presets" (`:3244-3258`); VIII's "temporary
   ramps" (`VOL_VIII.md:498`). The casing "intact" is the DEFAULT's
   (`MASTER_PROMPT_BIBLE.md:3121`); a pyramidion only if a source supports
   it (`:3140`) — D-9: none (`DEVIATIONS.md:114`).
4. D-7 (`DEVIATIONS.md:87-104`): the remnant of "a supply ramp from the
   quarry (S–SSE) toward the middle of the south face"; its rejected
   alternative "an unfinished gap in the south temenos wall with the ramp
   still reaching the face" was rejected because it "alters the finished
   enclosure (D-3)" — a reason that does not hold BEFORE completion; the
   internal ramp (Houdin) rejected. D-3: the 8 m enclosure wall (`:29`).
5. The default world already shows construction context — "Construction
   infrastructure remains partially present around the monument"
   (`MASTER_PROMPT_BIBLE.md:3011`) — the remnant, the works yard, the SE
   scaffold, the camp (`STATUS.md:780`).

### 1.2 The pyramid pipeline (Haiku B)

6. `solveCourses` normalises ALL 210 raw heights with one `k = height / sum`
   (`PyramidSpec.ts:103`) and tapers each row to the FULL height (`:110`);
   `layCasing` breaks at `faceW < 0.55` (`:126`); the spec asserts the sum
   (`:201`). So: keep the full solve and the full height, stop EMITTING at
   N — rows below N stay bit-identical.
7. The near mesh is sized from `spec.stones.length` (`PyramidBuilder.ts
   :173`); the mitres and taper use the full height (`:217`); the far shell
   is four triangles to an apex (`:366-386`) — the one geometric blocker;
   its colour bands key on world height (`:389`); the bounding sphere
   (`:359`) still encloses a truncated build; the LOD toggles only
   `near.visible` (`:417-421`).
8. BLOCKER: the probe GI's analytic pyramid (`ProbeGI.ts:140-186`, used for
   sun visibility `:191, 219` and GI rays `:288`) is the FULL G1 — four face
   planes and the base, no top plane — so a truncated G1 would still shade
   the sun and bounce light above course N. It needs a top plane, behind a
   JS-level `if` so the default graph does not change.
9. The audit's G1 row (`tools/audit.ts:74-76`, `from: 'KHUFU_EARLY'`) builds
   its OWN full spec: height vs survey (`:109`), courses sum to height
   (`:112`), stone floor > 40k (`:119`) — all pass as long as the audit's
   spec is the full design; a truncated spec would fail `:112` and the
   assertion at `PyramidSpec.ts:201`.
10. No King's Chamber or relieving-chamber height is in the repo
    (`CANON_DIMENSIONS.ts:41-42` cites the King's Chamber only for the
    cubit); "201 survive today, truncated" (`:85`).

### 1.3 Life and logistics (Haiku D)

11. Figures take their height from the TERRAIN only (`Inhabitants.ts:447`);
    a ramp footprint blocks a ground figure and the re-draw drops it
    (`:249-256, 466-469`) — walkers cannot climb a GeoWriter ramp without
    new placement code.
12. The Khufu lines are filtered BY INDEX (`:341`: k ≠ 0, 1, 5) — inserting
    a canon line would silently drop a different gang; the canon budget is
    one shared scale (`:373`), extras have their own pool (`:72`).
13. Construction gangs today: haul road legs k0, k1 (`:280, 283`), the
    quarry faces k2 (`:285`), the temple's SE corner k5 (`:292`, its
    scaffold `:815`), causeway porters k6 (`:296`), the Tura delivery team
    k14 (`:315`); trains, shelters, camp and south works behind
    `khufuWorks`. "Limestone transport" already plays in every epoch: the
    Tura barge unloads at the south-shore slipway (`Vessels.ts:765, 1205,
    1879`). The torch cap of 14 is full (`Torches.ts:130`).

### 1.4 The ground and builders south of G1 (Haiku C; verifier)

- Verifier, from the code: the supply ramp's line (10, 236) → (−8, 115.2)
  and the zigzag (x −93.5 … +86.8, z ≈ 58 … 125) meet nothing that stays in
  KHUFU_LATE once the court and temenos are gone: the queens' row is at
  x 190 (`CANON_DIMENSIONS.ts:224-226`), G1-d at x 119 … 141, z 140 … 162
  (`:271-273`) — east of the zigzag's turn at x 86.8; the works yard's gang
  at x −118 … −56, z 145 … 165 (`SouthWorks.ts:67`) ≥ 30 m from the west
  turn; the camp's lean-tos at x −54 … −2, z 262 … 278 (`WorkCamp.ts:122-
  123`) 26 m south of the toe; the haul road k0 ends at (40, 215)
  (`Inhabitants.ts:280`) — beside the toe, as D-7 intends; the shelter at
  (40, 245) (`:810`). The ramp crosses the G1 pad (core |z| ≤ 165, blend
  to 190, `GizaControl.ts:523-524`) — level ground at Y 0 — and the
  plateau beyond (+3 at the toe).

- Haiku C: D-7's remnant runs HEAD (−8, 147) → TOE (10, 236), 90.8 m
  (`SouthWorks.ts:57-58`); its fill 15.6 m wide (`:129`), 5.6 m high at the
  head falling to the toe (`:104-108`), mud-brick retaining walls at ± 8.4 m
  (`:136`) — the template for the INTACT supply ramp. The court pavement is
  a ± 135.38 m square (`KhufuComplex.ts:340, 381`), the south temenos wall
  at z 135.38, 8 m high, with no gap (`:388, 406`). KHUFU'S SOUTH BOAT PITS
  lie in that court strip at z 121.68, x −68 … −36 and 29 … 61 (`:617-641`) —
  the zigzag's first leg passes ≈ 4 m north of the western one; the pits
  were cut after the funeral, so they leave with the court (K-1). The parent
  stream forks in order pavement, mt-pillars, causeway, boatpits,
  mastabas-west, mastabas-east (`:359, 444, 485, 617, 684, 777`) — skipping a
  BODY keeps every stream, skipping a FORK re-rolls everything after it.
  Near the toe: the ox train at (20, 250) and the shelter at (40, 245)
  (`Inhabitants.ts:803, 810`); the haul road k0 ends at (40, 215). The
  quarry's north rim lies at z ≈ 302 (x 100) (`GizaControl.ts:406-411`).

### 1.5 Gates and tools (Haiku E)

14. `!atLeast(e, 'KHUFU_COMPLETION')` is true only for KHUFU_EARLY and
    KHUFU_LATE (`Epoch.ts:57-59`); `khufuWorks` (`TerrainScene.ts:106`)
    stays TRUE there. Today KHUFU_LATE falls back to the default with a
    notice (`Epoch.ts:33-36, 49`; `main.ts:223-228`, whose BUILT LIST is
    hard-coded and must gain KHUFU_LATE). The G1 pad (`GizaControl.ts:520-
    524`) and the G1 `add()` (`Monuments.ts:120`) have no epoch gate.
15. Views of G1: bm1 and bm2 look straight at it from ≈ 1.3 km east, bm3
    'noon court' from the SE at ≈ 375 m (pinned by `test-bookmarks.ts:44-
    45`), bm11 stands on its SE flank (`Bookmarks.ts:33-35, 51`). The '='
    key reloads only when the world is EARLIER than the mark's epoch
    (`:126`) — a mark tagged KHUFU_LATE would not reload a later world, so
    a LATE bookmark stays `?bm=` + `?epoch=` only.
16. Contracts are fpdump counts: default 1142 / 1142, KHAFRE 1120 / 1120
    (`STATUS.md:533`); `tour.ts` captures every mark in the booted epoch
    (`:64`); the battery and `test-bookmarks.ts` run the default.

## 2. Decisions (★ = recommended default — the main session decides)

| # | question | ★ default | alternatives |
|---|---|---|---|
| S-1 | one step or two | ★ TWO: T3-1 the pyramid, ramps and their people; T3-2 the complex and logistics (§0) | one step |
| H-1 | how high | ★ MID-HEIGHT — the course whose top first passes 50 % of H (≈ course 98, ≈ 73 m, 87 % of the volume; canon "Mid-height construction"; "near completion" belongs to the default by IX:122) | two-thirds (≈ 97.5 m); near completion (≈ 124 m) |
| C-1 | the casing on the built courses | ★ UNDRESSED (laid with each course, dressed top-down at the end — C), T2-5's undressed path | dressed as finished |
| R-1 | the ramp system | ★ D-7's supply ramp INTACT (toe (10, 236) → the south face's middle, 10 %, top ≈ 12.3 m) + a 5-leg ZIGZAG on the south face to the platform (Hölscher/Arnold hypothesis, C; geometry D) | a spiral round all four faces (Dunham); a straight ramp alone (≈ 730 m — through the quarry) |
| P-1 | the platform | ★ course 99 ≈ 40 % laid from the corners, sledges, levers, the survey station, static figures; no pyramidion (D-9) | an empty platform |
| K-1 | the court, the temenos, the south and east boat pits | ★ ABSENT in KHUFU_LATE (the court and wall finished after the pyramid; the pits cut after the funeral; the ramp crosses the court's ground); the `pavement` and `boatpits` forks still consumed, their bodies skipped, so nothing after them moves | the temenos built with a gap (D-7's rejected variant) |
| K-2 | the temple, queens, G1-d, causeway, valley temple | ★ unchanged in T3-1 — their states are T3-2 | change now |
| B-1 | a view | ★ bm15 'the rising pyramid' (`?bm=15&epoch=KHUFU_LATE`) | none |
| F-1 | KHUFU_EARLY until T3-3 | ★ falls back to KHUFU_LATE (the nearest built stage) | keep falling back to the default |

## 3. Design (★)

### 3.1 The epoch

- `Epoch.ts`: `IMPLEMENTED` gains `'KHUFU_LATE'`; `FALLBACK.KHUFU_EARLY` →
  `'KHUFU_LATE'` (the nearest built stage — "fall back to the nearest built
  stage", `Epoch.ts` header) until T3-3. One helper beside `atLeast`:
  `building(e) = !atLeast(e, 'KHUFU_COMPLETION')` — true for KHUFU_EARLY /
  KHUFU_LATE, false for the default, KHAFRE, MENKAURE and EVIDENCE_VIEW
  (`stageOf` maps it to the default). `khufuWorks = !atLeast(e,
  'KHAFRE_PERIOD')` stays TRUE in KHUFU_LATE — every Khufu-works builder
  keeps running.

### 3.2 How high (H-1)

- The canon lists the presets "Early foundation · Lower courses under
  construction · Mid-height construction · Near completion · Newly completed
  pyramid · Several decades after completion" (`MASTER_PROMPT_BIBLE.md`
  HISTORICAL STATE) and names KHUFU_LATE "Advanced construction and
  limestone transport" (`VOL_IX.md:121`). No course number anywhere.
- ★ MID-HEIGHT: the first 98 courses (the course whose top passes 50 % of
  146.6 m — verifier's port of `solveCourses`: course 98–99, top ≈ 73 m).
  By VOLUME it is 87 % built — "advanced"; the working platform is 115 m
  square; the King's Chamber and the relieving chambers (≈ 43–69 m) are
  already enclosed, so no interior is exposed; and a zigzag ramp of 5 legs
  reaches it (§3.4). The course index is chosen by height at build time
  (`courses.findIndex(r => r.y0 + r.h > 0.5 · H)`), not hard-coded — the
  solver's draws decide the exact course.
- Alternatives: two-thirds (course ≈ 135, 97.5 m, 96 %, platform 77 m — a 9+
  leg zigzag); near completion (course ≈ 175, 124 m).

### 3.3 G1 under construction

- `PyramidParams.builtCourses?: number` (after `graniteUndressed`,
  `PyramidSpec.ts`): `buildPyramidSpec` keeps the full `solveCourses` and
  `layCasing` (all draws as today) and FILTERS the stones to rows <
  builtCourses afterwards — rows below are bit-for-bit the default's.
- The casing state: the casing blocks went in with every course and their
  faces were dressed from the top down at the end (C) — so the built rows
  are UNDRESSED: `undressedCourses = builtCourses` reusing T2-5's
  undressed path (facet × 15, wave × 1.5, `PyramidSpec.ts:120-124`) for Tura
  rows (no granite band on G1).
- The far shell (`PyramidBuilder.ts:366-386`, 4 triangles to an apex)
  becomes, only when `builtCourses` is set, a FRUSTUM to the built top
  (8 triangles) plus a flat cap quad (2) at the top course's upper face —
  the core under the working platform. The LOD distance, bounding sphere
  and shadow LOD follow the built height.
- The working platform (new builder, family `g1-works`, stream
  `g1-works`): the next course (99) half laid — its casing and backing
  blocks along the four edges inward from the corners, ≈ 40 % of the ring
  (D); sledges with blocks on the south half where the ramp arrives;
  lever teams; a survey station on the centre (the axis marks); a few
  stacks of backing blocks. The pyramidion: none (D-9).
- The probe GI's analytic G1 (`ProbeGI.ts:140-186`, finding 8) gains a
  TOP PLANE at the built height — added inside a JS `if (builtTop !==
  undefined)` when the pass is built, so the default world's shader graph
  is unchanged; `ProbeGI` gets the top from `TerrainScene` at construction.
- Monuments.ts: the G1 row passes `builtCourses` / `undressedCourses` only
  when `building(epoch)`; `pyramid:G1`'s footprint height follows (`y1` =
  the platform), evidence conf D, basis "mid-height construction (canon
  preset); the course index by height".

### 3.4 The ramp system (R-1)

- D-7 chose "a supply ramp from the quarry (S–SSE) toward the middle of the
  south face — Lehner's south-approach reasoning" (`DEVIATIONS.md`, D-7) and
  rejected an internal ramp. A straight ramp from the quarry cannot reach
  73 m: at 10 % it would run 730 m — through the quarry itself.
- ★ D-7's SUPPLY RAMP intact (the remnant's axis HEAD (−8, 147) → TOE
  (10, 236) extended north to the face at ≈ (−14.4, 115.2); toe → face
  ≈ 123 m at 10 %, top ≈ 12.3 m; the remnant's section — 15.6 m of fill
  between mud-brick walls at ± 8.4 m, `SouthWorks.ts:129-136`), feeding a
  ZIGZAG on the south face (the Hölscher/Arnold one-face hypothesis — C for
  the hypothesis, D for our geometry): legs at 10 %, 9.5 m decks, 12 m from
  the arrises, turning on 8 m landings (verifier's layout):

  | leg | x | y (m) | length |
  |---|---|---|---|
  | 1 | −8 → −93.5 | 12.3 → 20.9 | 85.5 |
  | 2 | −93.5 → +86.8 | 20.9 → 38.9 | 180.3 |
  | 3 | +86.8 → −72.6 | 38.9 → 54.8 | 159.4 |
  | 4 | −72.6 → +60.1 | 54.8 → 68.1 | 132.7 |
  | 5 | +60.1 → +9.1 | 68.1 → 73.2 | 51.0 |

  ≈ 609 m of legs + the 123 m supply ramp (the table starts leg 1 at x −8;
  with the axis meeting the face at x ≈ −14.4 every leg shifts ≈ 6 m —
  recompute at build with the same rule: 10 %, 12 m from the arrises,
  ending on the platform's south edge). Each leg's inner edge follows
  the face (z = 115.2 · (1 − y / 146.6)); its body is Khufu's causeway
  pedestal idea — rubble fill between mudbrick retaining walls, down to the
  ground or the leg below — a stepped mass on the south face; three faces
  stay readable. Family `g1-ramp`, stream `g1-ramp`.
- Alternatives: a spiral (enveloping) ramp round all four faces (Dunham;
  hides the pyramid); an internal ramp (Houdin — rejected by D-7).

### 3.5 What changes in the Khufu world (`building(epoch)` gates)

| today (COMPLETION) | KHUFU_LATE (T3-1) |
|---|---|
| G1 complete, dressed | 98 courses, undressed, the platform (§3.3) |
| the court pavement and the temenos walls | NOT YET — the court is the ramp's ground; built after the pyramid (D-3) |
| the boat pits (south and east) | NOT YET — cut after the funeral |
| D-7's ramp REMNANT and the dismantling gangs (`SouthWorks.ts`) | the INTACT supply ramp and the zigzag (§3.4); the works yard stays |
| the SE-corner scaffold ramp (`Inhabitants.ts`) | unchanged in T3-1 (the temple's state is T3-2) |
| temple, queens, G1-d, causeway, valley temple | unchanged in T3-1 — T3-2 |

### 3.6 Life on the ramps (G-1)

- Walkers stand on the terrain only (finding 11), so ★ the people ON the
  ramps and the platform are STATIC figures (Townsfolk's `person()` in a
  ColorWriter, stream `g1-folk`, as the town's I3 figures): sledge teams
  hauling on the legs (a sledge, a block, 8–16 haulers, a water pourer at
  the runners), lever and mason teams on the platform, a scribe at the
  survey station. Walkers: one extra line along the supply ramp's foot,
  appended LAST and present only when `building(epoch)` (finding 12: never
  a canon line — the index filter). No torches (the cap of 14).

### 3.7 Switch, views

- `?klate=0` under KHUFU_LATE: G1 complete and dressed, no ramp, the
  remnant back — the A/B arm (and an escape hatch).
- bm15 'the rising pyramid' (KHUFU_LATE, `?bm=15` only): from the south
  on the quarry's north rim looking north up the zigzag (p and yaw set at
  build from a screenshot; candidate (40, 6, 330), yaw ≈ 0.12 — forward is
  (−sin yaw, −cos yaw), so ≈ 0 looks north; the platform's edge ≈ 12° up at
  ≈ 330 m).
- `main.ts:223-228`: the notice's built list gains KHUFU_LATE.

## 4. Cost, measurement, audit

- Cost: G1 LOSES its upper ≈ 111 courses but keeps ≈ 73 % of its stones
  (the wide lower rows — verifier's port: 99 courses to pass 0.5 H, top
  ≈ 74 m; the code cites ≈ 63k instances for the whole, `PyramidBuilder.ts
  :351` → ≈ 46k built); the ramps ≈ 250 pedestal segments (≈ 1.5k boxes), the platform
  and figures a few hundred — the LATE world should be no dearer than the
  default.
- Commands:
  1. Default: `npx tsx tools/fpdump.ts` → 1142 / 1142 identical; `npx tsx
     tools/perf.ts --bm 1,3,7 --runs 3`.
  2. Later worlds unchanged: `npx tsx tools/fpdump.ts --q
     "epoch=KHAFRE_PERIOD"` (1120) and `--q "epoch=MENKAURE_PERIOD"`, both
     identical to the `980d3ec` dumps.
  3. LATE A/B: `npx tsx tools/perf.ts --bm 3,1,7,11 --runs 3 --q
     "epoch=KHUFU_LATE" --b "klate=0"` (bm3 and bm1 face G1, bm7 the quarry,
     bm11 its SE flank). RULE (★, as before): fps medians A = B, scene Δ ≤
     1.5 ms (negative = a saving), shadow sums reported.
- Audit (`tools/audit.ts --epoch KHUFU_LATE`): the G1 row stays the FULL
  design (finding 9 — unchanged); a new LATE row checks the BUILT part:
  `builtCourses` = the first course whose top passes 0.5 H, the built
  stones' count > 30k, the platform half-width = 115.18 · (1 − yTop / H)
  within 0.05 m, the frustum's top = yTop; the collision audit over
  `g1-ramp` / `g1-works` (the ramp's segments `grounded` with `yFloor`,
  `cutting` where the face rises above the deck) — and `audit.ts` must stop
  parsing an unbuilt epoch silently (`:65`): print the fallback.

## 5. Risks and checklist

1. Default and later-world leaks — every line behind `building(epoch)`;
   the three fpdumps.
2. The GI top plane (finding 8) — without it the truncated G1 is lit as if
   whole; check bm3 at noon against the far shell's shadow.
3. The zigzag's mass hides the south face's casing — intended; screenshot
   bm15 and the south side from bm7.
4. `test-bookmarks.ts` and the battery run the default only — unaffected;
   bm15 is `?bm=15` with `?epoch=KHUFU_LATE` (finding 15).
5. Checklist: fpdumps; `audit.ts --epoch KHUFU_LATE` all PASS;
   `closeup.ts --id pyramid:G1,g1-ramp:,g1-works: --n 4 --q
   "epoch=KHUFU_LATE"`; tour under LATE (bm15, bm3, bm1, bm11); perf step 3.

## 6. Docs

- STATUS "T3-1"; DEVIATIONS D-25 (KHUFU_LATE at mid-height; the undressed
  casing; the flat working top — a new interpretive choice beside D-9; the
  supply ramp + south-face zigzag, extending D-7; the court and temenos
  absent); README `?epoch=KHUFU_LATE`, `?klate=0`, bm15.
- From the recon: STATUS still lists D-9 as pending (`STATUS.md:164`) while
  DEVIATIONS records it chosen.

## 7. Haiku precision

Five read-only Haiku agents; every row checked against the code or the
text at the cited line by the verifier.

| agent | task | rows | confirmed | notes |
|---|---|---|---|---|
| A | canon and recorded decisions | 30 | 30 | IX:122 puts "approaching completion" in the default — the case for mid-height |
| B | the pyramid pipeline, truncation | 30 | 30 | found the probe GI's analytic full G1 (`ProbeGI.ts:140-219`) — the blocker a frustum alone would miss |
| C | the ground and builders south of G1 | 30 | 29 | found the south boat pits beside the ramp; one wrong row: the pottery kilns "inside the court" are TOWN-LOCAL (`IndustryDistrict.ts:40-43`) |
| D | life and logistics | 30 | 29 | walkers cannot climb a ramp (`Inhabitants.ts:447`); one wrong row: the default's construction context is not a conflict — the canon's preferred state keeps it ("Construction infrastructure remains partially present", `MASTER_PROMPT_BIBLE.md:3011`) |
| E | epochs, gates, tools | 30 | 29 | the notice's hard-coded built list; one wrong row: `closeup.ts --id` does split on commas (`:77`) |

**Haiku precision: 147/150 (98.0 %).**
