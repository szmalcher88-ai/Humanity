# I7 — POLISH + PERF (build plan)

> Prepared 2026-10-21 by a read-only side session while the main session
> finishes I5 and builds I6 (base `954465f`; files under I5/I6 edit are cited
> as found in the working tree). Nothing in `src/` was touched. Roadmap row
> (STATUS.md, ROADMAP v1.2+): *bm7 (quarry) drift — A/B pane open vs closed
> first, then profile; water as shoreline-polygon meshes instead of two big
> planes (canon IX §9.10.1; fixes OPEN item 3's water edge), OPEN item 1
> (iGPU caster allow-list), the red escarpment rim at night, crop-tuft card
> LOD, a bookmark for the scaffolding tableau* — plus the I5/I6 leftovers
> (causeway length, court pavement width). The human is away and the main
> session decides: every decision in §2 has a SAFE default — the one that
> changes the least, measured first, and revertible by a URL flag. Every
> Haiku row was re-read by the verifier (table at the end).

## 1. Verified findings

### 1.1 The bm7 "drift" (verifier + Haiku A7)

1. The battery's perf sweep (`tools/battery.ts:187-210`) closes the
   1600×900 page, opens one 2560×1440 page, and for bm 1, 3, 7 boots a FRESH
   page each time, waits `settle(90)` frames and reads `stats.fps` ONCE.
   `stats.fps` is an EMA with α 0.05 (`Engine.ts:231-234`) — ~20 frames of
   memory. One number per bookmark per battery; no spread, no repeat.
2. The runtime TDR guard (`Engine.ts:205-216`): 4 consecutive frames over
   250 ms → pixel ratio × 0.6 (floor 0.4, at most 3 cuts), counter
   `perf.dprCuts`. A fresh boot compiles pipelines in its first frames; if
   that trips the guard, the page then renders 0.36× the pixels at bm7 and
   reads far faster. The battery records neither `perf.dprCuts` nor the
   pixel ratio. The tour tool does the same single read (`tools/tour.ts:85`).
3. The record (STATUS.md): bm7 read 44 in v1.0 (WARN), 45–47 idle in v1.1,
   46 in I1 and I1b, **62 in the FIRST I2 run and 44 in the re-run of the
   same build** ("perf bm1 78 / bm3 65 / bm7 44 @1440p (first run 76 / 67 /
   62)", STATUS.md:380-384), 43 in I3, 62 in I4 ("this run had the in-app
   browser pane closed"). A 62 → 44 swing inside one iteration with no code
   change is a MEASUREMENT effect, not content drift — whatever the I4 pane
   note says. Candidate causes, in order: H1 the guard's resolution cut;
   H2 a second live WebGPU context (the in-app pane rendering the dev
   server — the battery's own comment measured −20 fps for that,
   `battery.ts:189-192`); H3 laptop power/thermal state (RTX 3050 Laptop,
   Optimus: AC vs battery, a hot GPU after the boot-heavy checks); H4 real
   content cost.
4. Instruments that exist: per-pass GPU timestamps (`GpuProfiler`, created
   when timestamps are supported, `Engine.ts:123`; `tagGpu` in `PostStack`,
   `HalfResMrt`; timestamp queries are ALWAYS on, `Engine.ts:85`);
   ablations `?ablate=shadows|pcss|cloudshadow` (`ShadowSetup.ts:113-118`),
   `?ablate=clouds,ao,bounce,…` (`PostStack.ts:81-82`), `?hide=<name
   prefixes>` (a visibility toggle after the build: it measures draw and
   caster cost, not build cost), `?cull=0`, `?froxels=0`, `?prepass=1`;
   `shoot.ts --gpusample N` (per-pass medians). CPU timings are stored ×100
   (`cpu.submitMs100` 245 = 2.45 ms, `Engine.ts:182-183`).
4b. The project's own record of how noisy single runs are (Haiku A7,
   verified): "the baseline battery said bm3 82, but `main` re-measured with
   the same protocol in this session gives 50/73/47" (STATUS PERF NOTE);
   bm1 81 in I1 and 51 in I1b on the same tree; an 86 °C GPU in SW thermal
   slowdown with other processes on it read "20/22/16 on code that measured
   50/73/47 an hour earlier" (STATUS PERF CAVEAT). Against that, the I1–I3
   "drift" (46 / 44 / 43) is three single readings inside the noise.
4c. Other ways a reading silently changes conditions (A7): the boot GPU bench
   caps the preset when it measures slow (`GpuBench.ts:90`: > 3 ns → `low`,
   > 4.5 ns → `safe`; a loaded GPU measures slow; `?preset=` alone does not
   pin it — `force=1` does) and `low` renders at 0.62 scale; the TDR guard
   (item 2) — `main.ts` waits only `settle(4)` before `ready`, so compile
   stalls land in the measured page's first frames; the battery forwards page
   errors only (`battery.ts:82`), so neither the cap nor the cut leaves a
   trace; every boot loads LIVE `src/` from the dev server — with another
   session editing, two arms can run two builds; bm7 is always the third boot
   on a reused page; the tour shoots bm7 at 9.0 h (`tour.ts:24`), the battery
   at 15 h — their numbers are not comparable; `stats.fps` is seeded at 60 on
   the first frame (`Engine.ts:160-162`).

### 1.2 Water (verifier + Haiku B7)

5. `NileWater.ts:149-177`: the river is one 700 × 4600 plane (8 × 60 segs)
   at (2050, −46.5, 200) → x 1700–2400, z −2100…2500; the harbour one
   950 × 560 plane (12 × 8) at (1330, −130) → x 855–1805, z −410…150; the
   three I4 canal sheets run from each canal's blind end (x0 − 7.4) to the
   river sheet's west edge x 1700, 15.8 m wide. One material factory for all:
   only the flow speed and wavelength differ (river 0.55 / 1, harbour
   0.12 / 0.42, canals 0.035 / 0.3); depth comes from `hf.sampleHeight` (the
   bed), so the material does not care about the sheet's extent.
6. The harbour sheet OVERLAPS the river sheet over x 1700–1805, z −410…150,
   coplanar, both with polygonOffset 2/8: draw order decides which wins, and
   their ripple scales differ ×2.4 — a straight-edged patch of harbour
   chop inside the river. That is the most likely "rectangular edge visible
   from bm10's left margin" (OPEN item 3), not a dry edge: the Nile spline's
   west bank stays east of x ≈ 1716 (spline min x 1900 − 130 − 40 meander −
   ~9 jitter), inside the river sheet. One mesh per body, NO overlaps, fixes
   it by construction.
7. The heightfield is 4096² over 4096 m centred (800, 200): x −1248…2848,
   z −1848…2248; its CPU mirror (`cpuHeights`, read back after the bake) is
   what a CPU shoreline builder walks. `safe` bakes 1024² (≈4 m texels).
   The river sheet reaches 250 m past the heightfield N and S (z −2100,
   2500); the Nile spline ends at z −1900 / 2250.
8. I6 changes NO terrain (I6 plan, finding 11): the shoreline is today's;
   I6's landings and stages are geometry over the water and hide it locally.
8b. (B7) The banks cannot be recomputed on the CPU from the spline: the
   meander and bank jitter are GPU-only TSL noise (`GizaControl.ts:326-337`)
   — the shoreline must come from `cpuHeights`. Waterlines by formula: the
   river at nileDist ≈ 125 m (channel ≈ 250 m wide), the basin at d ≈ 0.96,
   the approach ≈ 52 m off its polyline, each canal ≈ 4.9 m off its
   centreline (the 15.8 m canal sheets are wider than their ≈ 9.8 m water).
   `cpuHeights` texels: 1 m high/ultra, 2 m low, 4 m safe.
8c. (B7) The far shell carves the river beyond the grid but has no water
   (`TerrainTiles.ts:237-246`): the river sheet is what fills the spline's
   caps to z ≈ −2025 and ≈ 2375; a new mesh must too.
8d. (B7) Couplings to keep: `RIVER_W_EDGE = 2050 − 700/2`
   (`NileWater.ts:166`) ties the canal sheets to the river plane — replace it
   with the derived join; water must keep its polygonOffset (the bank meets
   it at exactly −46.5); hulls test `afloat` against the constant
   (`Vessels.ts:673`) and A* plans over terrain cells (`Navigation.ts:159`) —
   every navigable cell must lie under a mesh (canon IX:1680 "no dry channels
   marked navigable"); the wet-shore band in `TerrainMaterial.ts:195` is keyed
   to height; `waterYAtCpu` returns the constant. Canon IX:435-437 "Do not
   create a single giant water plane covering the entire map. Water geometry
   must follow the shape of the actual waterways." and the Phase-2 gate
   "Water remains geometrically connected and correctly aligned with the
   terrain" (IX:1570).

### 1.3 Shadow casters (Haiku C7 — see §7)

9. THE TERRAIN DOES NOT CAST: `TerrainTiles.ts:234` sets
   `this.mesh.castShadow = false` (its `castShadowPositionNode` at `:183` is
   inert), and three only draws `castShadow` objects into a cascade. OPEN
   item 1 (STATUS.md:841) and the PERF II comment (`TerrainScene.ts:287`,
   "CASTER-BOUND (terrain patches + palms + every …") name the terrain — that
   clause is stale; the "cheaper terrain shadow position node" lever has
   nothing to recover.
9b. What casts on `low` (2400 palms, 2600 shore clumps + 150 trees, 2400 debris
   rubble blocks, 320 figures, ≈50 waders) — every instanced system with
   `casts: true` and no distance limit except debris (1460 m) and figures
   (840 m) — plus ~25 always-drawn merged meshes: the complex (tura/local/
   basalt), every district (`WorkerTown`, `IndustryDistrict`,
   `HarborDistrict`, `WorkCamp`, `SouthWorks`, `Necropolis`), seven
   `townsfolk` meshes, farm/basin/reed/orchard works, the scaffold, torch
   stands, both vessel meshes, the quarry dressing. Crop tufts, chips,
   particles, flying birds and the depth-prepass twin already opt out — the
   codebase's own policy: fine geometry relies on contact shadows + AO.
9c. On `low`/`safe` the CSM cache saves NOTHING: one cascade, period 1
   (`CsmCached.ts:29`); caster count is the only shadow-pass lever there.
   `isReduced()` is true for both `low` and `safe` (`Params.ts:83`).
9d. Instanced casters share ONE set of indirect offsets with the main pass
   (PERF I: "geometry is shared with the CSM passes"): a `maxDist` cut culls
   the cell from VIEW too, not only from the cascade. A caster-only distance
   cut would need per-pass offsets — not an I7 change.

### 1.4 The red rim at night (verifier + Haiku D7)

10. ROOT CAUSE (Haiku D7, verified): `transmittanceUv` clamps the Bruneton
    mu-coordinate to [0, 1] (`Atmosphere.ts:106-115`) and
    `sampleTransmittance` (`:155-157`) has no ground-hit test — so every sun
    ray that the Earth blocks reads the HORIZON-GRAZING texel: one constant,
    red-dominant transmittance for any sun below the horizon. The sky-view
    bake multiplies it in at every sample (`tSun`, `:310-316`), so the night
    sky-view LUT is a dim red glow; `skyColor()` (`:357-365`) returns it raw.
10b. Where it lands: `aerial()` in-scatter `src` = `skyColor(viewDir)`
    (`:431`), warmed further by the dust tint (`:434`), weighted by (1 − T),
    which grows with distance — the far escarpment; the IBL cube
    (`SunSky.ts:74`, `skyColor`, no night term) on every physical surface;
    the cloud ambient (`Clouds.ts:384`) and the froxel ambient
    (`Froxels.ts:238-241`, ×0.02; valley mist is ON at night, `:187`);
    ProbeGI's gather (held down only by `gain` 0.02). Auto-exposure lifts it
    (gain up to 4×, `PostStack.ts:627`). The water already uses `skyFull()`
    (night terms) and gates its sun glint — the rule written in STATUS
    ("anything that REFLECTS the sky needs the night terms") was never
    applied to the aerial or the IBL cube.
10c. In the dusk band (sun y −0.03…+0.03) the light's colour is the CPU
    transmittance's red (`SunSky.ts:116`) blended toward moonlight only by
    `nk` (`:136`), which is 0.23 at the horizon: a faintly red moonlit key
    for a few minutes after sunset.

### 1.5 Crop tufts (verifier + Haiku E7)

11. `Fields.ts`: TUFT_BUDGET safe 22k / low 70k / high 750k / ultra 900k
    (`:51`), blades per tuft 2/3/5/5 (`:52`), size fade FADE_NEAR 700 →
    FADE_FAR 1150 (low 560, safe 380, `:53-56`), 160 m indirect cells
    (`:274`), `castShadow = false` (`:325`); under them a carpet whose sowing
    rows fade out by 140 m (`:237-258`). Two artifacts: "isolated blades
    inside ~15 m" and thin-blade aliasing beyond ~120 m (STATUS OPEN 3,
    Phase-5 queue).
12. The reference repo's answer (`reference-repos/fable5-world-demo/src/
    vegetation/GroundRing.ts:13-15`): "Grass LODs: 4-seg blade ≤26 m → 2-seg
    ≤60 m → wide tuft cross beyond (dither-crossfaded)"; crossfade half-width
    `G_BAND = 12` (`:96`), `applyDitherFade` (`VegInstance.ts:112-127`),
    coverage conserved by widening blades by 1/√thin (`grassThin`, `:99-110`),
    and a far super-tuft layer 150–265 m (`:118-124`). Nothing like it exists
    in AKHET's `src/` (no card, impostor or billboard code).
12b. BUG (Haiku E7, verified): on `low` and `safe` the tuft fade runs
    BACKWARDS. `fade = smoothstep(fadeFar, FADE_NEAR, camD)` (`Fields.ts:285`)
    is "1 near, 0 far" only while fadeFar > FADE_NEAR — true on high (1150 >
    700) but not on low (560) or safe (380): there it is 0 inside 560 / 380 m
    and 1 beyond 700, while the cells are culled past fadeFar + 60
    (`:342`). Crop tufts on the iGPU presets are zero-size near the camera and
    culled far — effectively absent, leaving the carpet. Every iGPU number
    since PERF II was measured without them; the Intel adapter always lands on
    `safe` or `low` (`main.ts:128`), so the dev RTX never shows it.
12c. Tuft facts for the LOD (E7): 3 triangles per blade (`Fields.ts:60-77`),
    15 per 5-blade tuft — the header's "10 tris" is stale (11.25M triangles at
    750k); a blade is 0.07 m wide, ONE PIXEL at ≈ 79 m at 1080p and ≈ 105 m at
    1440p (55° vertical fov) — that is where aliasing starts, so a card band
    belongs at 70–100 m, not at 25 m; nothing shrinks tufts between ~100 and
    700 m; the near "isolated blades" read (~15 m) is density and clump shape,
    which a FAR card cannot fix; a card must match the carpet's colour
    (tone × (0.7, 0.75, 0.8), normals 55 % up — `Fields.ts:227`, `:311`) or a
    seam shows.

### 1.6 Bookmark, leftovers (verifier + Haiku E7)

13. bm11 'temple scaffolding' (146, 7, 68), yaw −0.19, exists since v1.0.1
    (STATUS.md:782; key `-`). After I5 the ramp runs foot (151, 52) → head
    (157, 34) (`Inhabitants.ts:804`, `SCAFFOLD`): from bm11 the foot, the head
    and the falsework (158, 30) all lie within 7° of the view centre at 17,
    36 and 40 m — the camera looks straight up the ramp to the falsework. OPEN
    item 5 is DONE; no new bookmark.
14. CAUSEWAY: CANON `G1_CAUSEWAY_LENGTH` 825 m and `G1_CAUSEWAY_AZIMUTH_N_OF_E`
    8° are the line from the PYRAMID CENTRE to the valley temple:
    hypot(817, 115) = 825.05 m, atan(115/817) = 8.01°. `causewayAxis()`
    (`GizaControl.ts:553-558`) builds exactly that line — and nothing calls
    it. The built corridor runs from the mortuary temple's east face
    (173.38, 0) to (795, −115): 632.2 m at 10.5° N of E (`KhufuComplex`
    `cwStart`/`cwEnd`). Not a geometry bug — two definitions of one word.
14b. (E7) Making the corridor 825 m at 8° from (173.38, 0) would put the
    valley temple at x ≈ 1012 (+195 m): the harbour basin follows the
    constant (`GizaControl.ts:111`) but `BASIN_C` (`HarborDistrict.ts:49`),
    the forecourt keep-out and works box in `Fields.ts:121-123` (literal
    (817, −115)), the porters' file (`Inhabitants.ts`, from the constant, not
    `edPos`), I6's landings and every fleet track do not. Stale text on the
    way: `causewayStart()` (`CANON_DIMENSIONS.ts:278-280`, x 155.18 vs the live
    173.38, no callers), `WalkRig.ts:6` ("causeway is 825 m long"), D-4's
    "Code: CANON_DIMENSIONS G1_CAUSEWAY_*".
15. COURT PAVEMENT: `KhufuComplex` paves from the base to radius
    half + temenosD + court = 135.38 (20.2 m = `G1_TEMENOS_DISTANCE` 10.1 +
    `G1_COURT_PAVEMENT_WIDTH` 10.1) and puts the temenos wall's centreline on
    that same radius — i.e. it reads "a 10.1 m court, then 10.1 m more to the
    wall", while the constant's own label ("distance from pyramid base")
    would put the wall at 125.28. The boat pits (half + 6.5), the mortuary
    temple (mtX = half + temenosD + court + mtW/2 − 2), the queens'
    clearances, I5's south works and lanes are all keyed to 135.38 —
    shrinking the ring by 10 m would move the temple and the causeway start
    west while the scaffold (absolute `SCAFFOLD.bx` 158) stays put. The
    ring is ≈ 20,240 m² ≈ 12.6k slabs (STATUS says ~17k — doc drift).

## 2. Decisions (safe defaults — the main session decides)

| # | item | SAFE DEFAULT | not now |
|---|---|---|---|
| D1 | bm7 drift | MEASURE before any code change (§3.1). If it is the measurement (H1–H3), fix the BATTERY, not the content | profiling content without a clean A/B |
| D2 | water meshes | build them, all bodies, NO overlaps; keep the planes behind `?water=planes` for one iteration (A/B and rollback) | deleting the planes in the same commit |
| D3 | caster allow-list | `low` and `safe` ONLY (high/ultra and the battery's perf gate untouched); measured on the Intel UHD with the existing iGPU probe | changing high-preset casters |
| D4 | red rim | the Earth-shadow test in `sampleTransmittance` (the root cause, one place) + the night term in the aerial in-scatter and the IBL cube + the dusk light colour; behind `?earthshadow=0`. Frames with the sun above the horizon are mathematically unchanged | gating only the aerial (leaves the IBL, clouds and froxels red) |
| D5 | tuft LOD | card LOD for `high`/`ultra` beyond ≈ 80 m behind `?tuftlod=0`; near-field density (5 → 8 blades) on high/ultra | touching the tuft placement draws |
| D5b | the inverted low/safe fade (12b) | FIX it (tufts full-size near, fading out by fadeFar), then MEASURE the iGPU and, if the frame got slower than PERF II's, lower `TUFT_BUDGET` low/safe until it is back — the fix restores an intended feature, the budget keeps the iGPU floor | leaving the bug because it is "free" |
| D6 | scaffolding bookmark | none — bm11 already does it; close OPEN item 5, drop it from the roadmap row | a 12th bookmark |
| D7 | causeway 632 vs 825; pavement 20.2 vs 10.1 | DOCS ONLY: say what the numbers measure (D-4, D-3); delete or annotate the dead `causewayAxis()` | moving the valley temple (it carries the whole I6 harbour, the basin, the approach and the fleet) or the temenos (it carries the boat pits, the temple, I5's south works) |

## 3. Design

### 3.1 bm7 — the A/B protocol (do this FIRST, on an idle machine)

1. Instrument before measuring (small, safe): the battery and the tour log,
   per reading, `stats.fps`, frame ms (mean and p95 over a fixed frame
   window), the renderer pixel ratio, `perf.dprCuts`, the preset actually
   running and `benchMs`, triangles, draws, CPU submit ms, and the per-pass
   GPU ms; they forward `[akhet]` console lines. A reading taken after a dpr
   cut or under a bench cap is INVALID and re-taken on a fresh page.
2. A NEW tool `tools/perfab.ts`: one fresh headless browser per ARM, a
   2560×1440 page, deviceScaleFactor 1, URL PINNED to
   `?preset=high&force=1&dpr=1&T=15&hud=0` (force: the bench must not cap the
   preset mid-study — RTX only, never on the iGPU); bm 1/3/7 in a RANDOMISED
   order each round; per bookmark: setPose, settle 120, then 8 s of frame-ms
   samples → median and p10. Three rounds per condition, alternated
   A B A B A B in one sitting. Freeze the build: measure a commit in a
   separate worktree served on its own port, or ask the other sessions not to
   edit `src/` while it runs (the dev server serves live source).
   Before each arm record GPU temperature, clock and utilisation
   (`nvidia-smi --query-gpu=temperature.gpu,clocks.gr,utilization.gpu
   --format=csv`, a read-only query) and the power source; discard an arm
   whose utilisation before boot is not idle.
3. Conditions, one variable at a time:
   - P0 vs P1: the in-app browser pane CLOSED vs OPEN on the dev server
     (the main session controls the pane; nothing else on the GPU; laptop on
     AC; note battery %, power plan, GPU temperature if the HUD shows it).
   - G0 vs G1: guard on vs off (`?noguard=1`, a 3-line param in
     `Engine.guardFrameTime`), pane closed.
   - Cold vs warm: the first round after boot-heavy work vs after 5 min idle.
4. Read the result:
   - P1 − P0 ≈ −15…20 fps → H2: the battery prints "close the in-app browser
     pane" before its perf sweep and STATUS says so next to every perf line.
   - dpr cuts seen on any 62-ish reading → H1: the battery must not measure
     after a cut (step 1).
   - all conditions within ±2 fps and still 43–46 → H4, real cost: go to 5.
5. If H4 — profile, don't guess: (a) per-pass GPU ms at bm7 with `?ablate=`
   for shadows / pcss / clouds / ao / bounce, `?froxels=0`, `?cull=0`, and
   `?hide=` for debris, particles, inhabitants, the I4/I5 meshes
   (`work-camp`, `south-works`, `necropolis`); (b) bisect the commits since
   v1.1 with `perfab.ts --only 7` in a separate git worktree (the main
   session's call — it is a git write); (c) fix the first pass that grew.

### 3.2 Water as shoreline meshes (`NileWater.ts`, new `src/water/WaterMesh.ts`)

Canon: IX §9.10.1 "Do not create a single giant water plane" (and the
§9.10.x shoreline effects — B7 rows in §7).
- BUILD on the CPU from `hf.cpuHeights` after the bake: a cell grid (4 m on
  high/ultra, 8 m on low, 16 m on safe) over each body's box; a cell is water
  if ANY corner is below NILE_WATER_Y + 0.25 (so the mesh runs a little under
  every bank and the terrain's depth test draws the true shoreline); emit one
  quad per water cell at NILE_WATER_Y, merged into ~200 m chunks (spatial
  culling for free). Estimated: river ≈ 280 m × 4.1 km ≈ 72k cells at 4 m,
  basin + approach ≈ 11k, canals ≈ 2.3k → ≈ 170k tris on high (the planes
  were ≈ 1k), ≈ 43k on low, ≈ 11k on safe. Fragment work does not grow: the
  planes already shaded every water pixel; the meshes stop rasterizing the
  hidden parts of the old rectangles.
- BODIES, NO OVERLAP: classify each cell by what made it water — river (the
  Nile spline distance), harbour (basin ellipse + approach), canal (the CANALS
  boxes) — and write a per-vertex `body` attribute; the ONE material blends
  flow speed and wavelength by it, so the approach channel's mouth fades from
  harbour chop to river swell over ~60 m instead of a straight seam.
- BEYOND THE HEIGHTFIELD (8c): the far shell carves the river there with no
  meander or bank jitter and draws no water. Add a coarse strip along the
  spline ± 125 m (the far-branch waterline) from the grid edge to z −2100 /
  2500 (covers the caps at ≈ −2025 / 2375), overlapping the grid mesh by one
  cell row under the 100 m edge blend; at that blend the two banks can differ
  by up to ~40 m — look at it from bm1/bm9 and widen the strip if a dry gap
  shows.
- CANAL JOIN (8d): derive each canal mesh's east end from the cells, not from
  `RIVER_W_EDGE`; the canal cells and the river cells meet in one mesh, so
  there is no join to keep.
- KEEP the material as it is, polygonOffset included (the bank meets the
  water at exactly −46.5), and the meshes in `NileWater.meshes` with `tick()`
  (the scene's only interface to it).
- KEEP `?water=planes` (the old three-sheet code path) for one iteration.
- Consumers: every other system reads the CONSTANT `NILE_WATER_Y` (hulls,
  figures, Shore fits, slipways, the walker) — nothing reads the sheets'
  geometry (B7 lists them).

### 3.3 Caster allow-list (OPEN item 1)

- ONE place: `casterPolicy(preset)` in `ShadowSetup.ts`, applied by a scene
  traversal after the world is built (`TerrainScene`, after
  `buildInhabitants`), keyed on mesh-name prefixes — no builder changes. Name
  the few unnamed meshes it needs (`KhufuComplex` meshes, the debris dressing,
  the scaffold stone/timber, the inhabitants' figure variants) — names also
  serve `?hide=`.
- `low` → castShadow FALSE for: shore clumps (papyrus, reed — `spawnClass`
  meshes by class name; trees keep), debris rubble and the quarry dressing,
  all `townsfolk`-type meshes, `vessels-moving` and `vessels`, waders, the
  scaffold timber, torch stands, the farm/basin/reed-harvest/orchard works
  except the orchard walls. KEEP: pyramids (near stones + backing), the
  complex, the town/industry/harbour/necropolis/south-works BUILDINGS, palms,
  shore trees, figures (already 840 m-gated).
- `safe` → the `low` list + figures + palms beyond the cascade (no — 9d: no
  caster-only distance) → figures only; palms stay.
- `high`/`ultra` → untouched (the battery's perf gate and every reference
  frame stay identical — verify with `tools/diff.ts`).
- Expected: ≈ 5k fewer caster instances on `low` and a dozen fewer merged
  draws per cascade; MEASURE the shadow pass ms (GpuProfiler) on the Intel UHD
  with `tools/probe-igpu.ts` at the quarry and floodplain framings, before
  and after. If the pass is still dominated by the complex's merged meshes,
  the next lever (chunking `KhufuComplex` into spatial cells with
  per-chunk culling) is a follow-up, not I7.
- Fix the stale terrain clause in OPEN item 1 and `TerrainScene.ts:287`.

### 3.4 The red rim — fix the source, then the two missing night terms

1. EARTH SHADOW in `sampleTransmittance(r, mu)`: multiply by
   `smoothstep(muH − 0.004, muH + 0.004, mu)` with
   `muH = −sqrt(max(0, 1 − (RG/r)²))` — the sun ray from radius r hits the
   ground below that cosine (Hillaire's reference zeroes it). Every consumer
   is fixed at once: the sky-view and multi-scatter bakes, `sunRadiance`,
   the sun disc, ProbeGI, clouds. FRAMES WITH THE SUN ABOVE THE HORIZON DO NOT
   CHANGE: every sample point's horizon dips below 0, so mu ≥ 0 never meets
   the test — the battery's day frames stay identical. Twilight survives
   physically (high samples still see the sun). Flag `?earthshadow=0`.
2. `aerial()` in-scatter and the IBL cube compose like `skyFull()`: the LUT
   sky plus `nightSky.radiance(dir)` — distant terrain fades into the night
   sky's blue, not black and not red.
3. Dusk-band light colour: blend toward moonlight by `max(nk, 1 − above)`
   (`SunSky.ts:136`) instead of `nk`.
- Check: bm10 (21.4 h) and a dusk/dawn sweep (T 5.5–6.6, 17.4–18.6, 0.1 h
  steps) — no pop at sunset; `tools/levels.ts` on a far-escarpment box at
  21.4 h: R/G ratio before/after; the noon battery frames pixel-identical
  (`tools/diff.ts`).

### 3.5 Crop tufts (`Fields.ts`)

1. FIRST the inverted fade (12b): `fade = smoothstep(fadeFar,
   min(FADE_NEAR, 0.6 · fadeFar), camD)` — full size near on every preset,
   fading out by fadeFar. Then `tools/probe-igpu.ts` on the Intel UHD
   (floodplain and quarry framings, `low` and `safe`): if the frame is slower
   than the PERF II figures, lower `TUFT_BUDGET` low/safe (and/or blades 3 →
   2 on low) until it is back. Placement draws are untouched (the budget only
   stops the loop earlier — same stream, a shorter prefix).
2. CARD LOD on high/ultra: same instance buffers, same cells, same placement
   draws; a SECOND mesh (three crossed wide quads, LAAS's far tuft) shares
   `bufA/bufB`. The blade mesh collapses instances beyond R + 12 m, the card
   mesh those inside R − 12 m, R ≈ 80 m (1080p blade-pixel distance; 1440p
   could go to ~100), with LAAS's dither crossfade (`G_BAND` 12,
   `applyDitherFade`) in between. The card's fragment draws a procedural comb
   of 7–9 blade silhouettes (fract over u, tapered by v, discard for alpha)
   in the tuft's tint, sways with the same wind term, and its far colour is
   pulled to the carpet's (12c) so card and carpet meet without a seam.
   Beyond ~400 m widen and thin (LAAS's 1/√thin coverage rule) until
   FADE_NEAR.
3. NEAR FIELD (the ~15 m read): 8 blades per tuft on high/ultra
   (`BLADES_BY_PRESET`; `tuftGeometry(n)` already takes the count) — the
   card LOD does not touch it.
- Off-switch `?tuftlod=0`; A/B at bm1 and bm9 (the densest crop framings),
  pane closed; budget: ≤ 1 ms GPU at 1440p for 2 + 3 together.

### 3.6 Leftovers (docs only)

- D-4: "825 m and 8° are the distance and bearing from the pyramid's centre
  to the valley temple (the canon placement, C); the walled corridor itself
  runs 632 m from the mortuary temple's front at 10.5° N of E. A corridor of
  825 m would put the valley temple ~195 m further east (x ≈ 1012) —
  rejected while the harbour, the approach channel, the fields' keep-out and
  the fleet are keyed to the placement; an owner decision for a later
  iteration (14b)." Fix D-4's code pointer. Delete `causewayAxis()` and
  `causewayStart()` (dead, and the latter wrong) or comment them as reference
  lines; fix `WalkRig.ts:6`.
- D-3 (temenos): "the court is paved 10.1 m wide and the enclosure wall
  stands a further 10.1 m out (G1_TEMENOS_DISTANCE read as court-edge to
  wall); everything around it is keyed to that radius." Fix the constant's
  label, not its use.

## 4. Risks

1. PERF TOOLS: a perf number taken after a dpr cut, or with a second WebGPU
   page alive, is worse than none (the battery's own lesson). D1 first.
2. WATER: the mesh must cover every place the planes did (bm1, bm2, bm4,
   bm9, bm10 are water framings) — tour them with `?water=planes` and without
   and diff (`tools/diff.ts`); vertex count on safe (≤ 15k tris); no seam at
   the canal mouths (I4) or the approach mouth; I6's landings sit ON the
   mesh, the reeds still fit by height.
3. CASTERS: reduced presets only; high-preset frames must be pixel-identical
   (`tools/diff.ts`).
4. RED RIM: dusk/dawn transitions — no pop (the test is smoothed over
   ±0.004 in cosine, ≈ ±0.25°); the night look loses its red cast and is
   carried by the moon, the night sky and the torches — check the colour
   script's night keyframe still reads (bm10); the day frames must be
   pixel-identical (`tools/diff.ts`), which is the proof the change is scoped.
5. TUFTS: the crossfade band must not shimmer under TRAA (dither + TAA is the
   LAAS combination that works); vertex cost of drawing both meshes per cell.
6. THE FADE FIX COSTS iGPU TIME: tufts come back on `low`/`safe`, which every
   iGPU figure since PERF II was measured without (12b). Measure casters
   (D3) and the fade fix (D5b) in ONE iGPU sitting: baseline → caster cut →
   fade fix → budget re-tune, one reading table; the iGPU floor (safe ≥ 13
   fps at the quarry, STATUS v1.0.2) is the gate.
7. CONCURRENCY: I7 touches `NileWater`, `Atmosphere`, `Fields`, `Engine`,
   `ShadowSetup`, `TerrainScene`, `battery.ts` — finish I6 (which touches
   `Vessels`, `HarborDistrict`, `Torches`, `Footprints`, `CANON_DIMENSIONS`)
   and commit it first; `TerrainScene` and `CANON_DIMENSIONS` are shared.

## 5. Verification checklist

1. `tools/perfab.ts` P0/P1/G0/G1 table → STATUS before any perf claim.
2. Water: tour 1/2/4/9/10 planes vs meshes + `tools/diff.ts`; closeups of the
   canal mouths and the approach mouth; bm10 left margin.
3. Casters: `tools/probe-igpu.ts` on the Intel UHD, `low` and `safe`, quarry
   and floodplain framings, before/after shadow-pass ms and fps; high preset
   diff identical.
4. Night: bm10 + a far-escarpment framing at 21.4 h, levels before/after.
4b. Tuft fade: a `?preset=low` and a `?preset=safe` floodplain closeup on the
   RTX (`&force=1`) — tufts visible near, gone by fadeFar.
5. Tufts: bm1/bm9 at 1440p, `?tuftlod=0` vs on, GPU ms; a 10 m and a 120 m
   closeup.
6. `npx tsx tools/audit.ts`, `npm run battery` (pane closed, no src edits).

## 6. Docs to update

- STATUS.md: "I7 — POLISH + PERF" with the perfab table, the water counts,
  the iGPU before/after; OPEN items 1 (drop the terrain clause), 3 (water
  edge, red rim, tufts), 5 (bm11) closed or updated; the roadmap row: drop
  "a bookmark for the scaffolding tableau", mark DONE; the Haiku table;
  doc drift: court slabs ≈ 12.6k, not ~17k.
- DEVIATIONS.md: D-3 and D-4 clarifications (§3.6).
- Code comments: `Fields.ts:9` (15 tris per tuft), `TerrainScene.ts:287`
  (terrain casts nothing), `WalkRig.ts:6`, `TerrainScene.ts:5` ("flat stage
  plane").
- README: `?water=planes`, `?tuftlod=0`, `?earthshadow=0`, `?noguard=1`,
  `tools/perfab.ts`.

## 7. Haiku precision (5 agents, read-only, every row re-read by the verifier)

| agent | task | rows | confirmed |
|---|---|---|---|
| A7 | perf history, the measuring tools, what can silently change a reading | 30 | 30 — STATUS line numbers had moved (the main session was editing it), content verified by search; the decisive record: "bm3 82" vs 50 on the same protocol, 20/22/16 at 86 °C, the bench cap, live `src/` per boot, tour vs battery hours |
| B7 | the water sheets and every consumer of water | 30 | 30 — the canal join's hard-coded `RIVER_W_EDGE`, GPU-only bank noise (→ `cpuHeights`), the far shell's dry river caps, the canon gates |
| C7 | every shadow caster and setting | 30 | 29 — the terrain casts nothing, the 1-cascade cache saves nothing; one wrong lever: a `maxDist` on palms would cull them from VIEW too (the offsets are shared with the main pass) |
| D7 | where red enters at night | 30 | 30 — the root cause the verifier had not reached: `transmittanceUv`'s clamp with no Earth-shadow test; the IBL cube, cloud and froxel ambients as further consumers |
| E7 | crop tufts, bm11, the causeway and pavement numbers | 29 | 29 — found the inverted low/safe tuft fade (an iGPU bug since PERF II), the blade-pixel distance that places the card band, the stale `causewayStart()` |

TOTAL 149 rows, 148 confirmed (99.3 %).
VERDICT: the I5/I6 briefing pattern holds. Two of the five (D7, E7) found
the deepest issues of this iteration — a clamp in the atmosphere and an
inverted smoothstep — and A7 turned a "drift" into a measurement question
with the project's own records. The one miss (C7) was a lever proposed
without checking how the offsets are shared: the same class as I5's misses
(a claim checked against one structure, not the code that consumes it).
