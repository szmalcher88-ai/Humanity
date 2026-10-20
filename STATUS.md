# PROJECT AKHET — STATUS (source of truth)

> **Rehydration protocol** (for an agent resuming with no context): read this
> file fully, then the brief (the operative spec — binding), then
> `canon/MASTER_PROMPT_BIBLE.md` Vols I–VI, `canon/VOL_VII.md`, `VOL_VIII.md`,
> `VOL_IX.md` (added 2026-10-20), then
> `reference-repos/fable5-world-demo/docs/THREE-NOTES.md` (verified API
> gotchas for the pinned three.js). Never re-plan from scratch; continue from
> "Next actions". Update this file after every meaningful step. Commit per
> milestone. HARD RULE from the human: **no sub-agents for code** — all code,
> geometry, shaders and decisions inline by the main agent. Amended by the
> human 2026-10-20: read-only sub-agents (Haiku) MAY do QA and reconnaissance
> — screenshot review, code search, canon cross-checks — reporting findings
> with evidence; every finding is verified by the main agent before any change.

## Mission (1 paragraph)

Fully procedural reconstruction of the Giza Plateau c. 2550 BCE (epoch: the
Great Pyramid newly completed, construction infrastructure partially
present), ≥4×4 km streamed world in the browser. WebGPU only (three.js
0.184.0 WebGPURenderer + TSL + WGSL compute), TypeScript strict, zero
external assets, world FIXED (?seed = micro-variation only), true cardinal
alignment machine-verified. Visual bar: current-generation cinematic
reconstruction footage. Truth bar: survey dimensions + archaeological
plausibility; every interpretive choice in DEVIATIONS.md. 8 gated phases;
Playwright verification battery; DELTA.md loop per phase; final two-frame
test (dawn from harbor / noon on plateau) + free walk harbor→pyramid.

## Hard rules digest

- Six pillars: geometry-not-textures, light transport (no black shadows —
  machine-enforced), inhabited-not-populated, distance holds, art direction
  (color script), the world moves.
- Floors (brief §2): ≥4096² heightfield; GP block system (courses meshed
  ≤150 m, casing joints ≤30 m, silhouette-true LOD to 10 km); ≥5M tris hero /
  ≥3M vista; worker city massing; ≥12 vessel variants; ≥5k palms; ≥500k field
  instances; ≥80k debris; ≥100k particles; probes+GTAO+SS bounce; CSM 4×2048
  +PCSS+contact; Hillaire atmosphere; raymarched sparse clouds; flowing Nile;
  ≥8 km visibility; no pop <300 m; 60fps@1440p RTX-3060-class.
- Banned (brief §9): smooth pyramid above far silhouette, black/gray shadows,
  bare sand underfoot, clones/grids, skybox sky, anachronisms, broken
  cardinal alignment, MeshBasicMaterial, CPU per-instance updates, one-file
  architecture, asking the user to lower the bar.
- Document precedence: brief > canon > judgment. Canon = content law within
  Tier-1 scope (Khufu complex only; NO Khafre/Menkaure/Sphinx — historically
  correct for 2550 BCE, they don't exist yet).

## Verified environment facts

- Windows 11 Home (win32), PowerShell primary; Git Bash available.
- GPU: **NVIDIA RTX 3050 Laptop 4 GB** (+ Intel UHD — Optimus; adapter
  selection matters for headless shots). CPU i5-11400H 6c, RAM 16 GB.
  This is BELOW the RTX-3060 target class — perf targets stay as specced,
  dev-machine numbers noted as such.
- Node v25.9.0, npm 11.13.0, git 2.36.1.
- three.js pinned **0.184.0** (+@types/three 0.184.1) — matches LAAS's
  verified THREE-NOTES.md (DEVIATIONS D-8). VERIFY unfamiliar TSL APIs
  against node_modules/three before use.
- LAAS repo cloned at `reference-repos/fable5-world-demo` (MIT; attribution
  in LICENSE-THIRD-PARTY). Its STATUS.md is the methodology exemplar; its
  THREE-NOTES.md is binding API reference; its solved-problem log (CSM
  caching, GTAO horizon degeneracy, TRAA velocity for displaced geometry,
  depth-prepass @invariant, shadow-pass hash storm) should be consulted
  BEFORE re-deriving any of those fixes.
- Canon found at `../Ancient_Egipt/Ancient_Egipt.md` → copied to
  `canon/MASTER_PROMPT_BIBLE.md` (Vols I–VI; no Vol VII — Tier 2 blocked as
  expected). 2026-10-20: the human added `canon/VOL_VII.md` (Sphinx + Khafre
  complex), `VOL_VIII.md` (workers' city, administration, logistics) and
  `VOL_IX.md` (Nile, royal harbour, transport). Vol I–VI line numbers quoted
  in this file and in code comments refer to MASTER_PROMPT_BIBLE.md, which is
  left unchanged on purpose.
- `/reference` was EMPTY at start (DEVIATIONS D-1) — human to provide frames.
- Dev server: `npm run dev` (port 5173 strict). Shots:
  `npx tsx tools/shoot.ts --scene X --out shots/x.png [--hud 1]`.
  Compare: `npx tsx tools/compare.ts --a ours.png --b ref.png --out cmp.png`;
  pixel sampling: `--sample img.png --px "x,y;x,y"`.

## Phase checklist

- [x] **Phase 0** — DONE 2026-07-10 (commit 4ff7717). Scaffold, WebGPU init
      + fail-loud diagnostics, HUD, fly camera, params, Playwright harness
      (headless WebGPU proven), compare tool, CANON_DIMENSIONS (cited,
      self-audit consistent). Sanity: 113 fps, compute→storage→instanced
      blocks + StorageTexture + displacement + shadows + GPU timestamps.
      KEY ENV FACTS: headless Chromium needs --force_high_performance_gpu
      or it picks the Intel iGPU (probe-adapter.ts verified); the Claude
      Browser pane tab is `visibility:hidden` → rAF never fires → app looks
      hung there — USE THE HARNESS, not the pane, for verification.
- [~] **Phase 1** — CORE BUILT 2026-07-11. GizaControl (authored geography:
      tilted Mokattam plateau, full-boundary escarpment polyline, Main Wadi,
      Maadi knolls, Khufu quarry + haul-out, floodplain, Nile + harbor +
      approach channel, bedrock knolls under G1/G2 sites), HeightSynthesis
      (4096² + masks at 2048²), QuarryCarve (1.12 m lifts, bay jitter,
      trench grid), SandTransport (saltation+repose+diffusion — diffusion
      REQUIRED or texel-scale transverse ripples stripe the desert),
      Heightfield orchestrator, CDLOD TerrainTiles + far shell, Giza splat
      material (5 families), world scene + placeholder sun/water.
      SOLVED: reversed-Z depth (classic z-fights at 3 km with 2 m water
      freeboard — reversedDepthBuffer:true; POST PASSES: sky depth = 0!);
      quarry "moonscape" was FRAGMENT NORMAL noise, not geometry (bake
      edits changing nothing = look at the material, not the heightfield);
      sand ripple albedo streaking (now normal-only + distance-faded).
      CARRIED to Phase-2 delta loop (needs real light to judge): escarpment
      face definition, sand drift bands near escarpment, floodplain green
      strength, far-shell look, quarry bench concentration/dressing.
- [ ] Phase 2 — atmosphere/sun/shadows/volumetrics/clouds/post color script
- [ ] Phase 3 — Great Pyramid block system + casing + LOD; queens + satellite
- [ ] Phase 4 — Khufu complex + sacred axis + mastaba fields
- [ ] Phase 5 — Nile, harbor, vessels, agriculture
- [ ] Phase 6 — worker city, industry, quarry dressing, motion pass
- [x] **Phase 7 — CLOSED 2026-07-25 (v1.0).** Perf (indirect-draw instance
      culling, iGPU preset), bookmarks 1-10 + flythrough, walk mode, night
      rig, froxel volumetrics, inhabitants, albedo calibration, full
      verification battery (`npm run battery`, 18 gates: 17 PASS + 1 advisory
      WARN), README + gallery, two-frame test recaptured. Dev-machine perf
      @2560×1440 on the RTX 3050 Laptop (BELOW the 3060 target class):
      bm1 46 / bm3 66 / bm7 44 fps, GPU 18.3 ms. The single WARN is bm7 at
      44 vs the 45 gate — advisory by construction on this GPU.
      BATTERY BUG WORTH REMEMBERING: the first version measured the perf
      sweep with the 1600×900 page still open, and two live WebGPU contexts
      sharing one GPU reported 26-31 fps for framings that measure 44-66
      standalone. A perf gate that measures the harness is worse than none.

- [~] **Phase 2** — CORE BUILT 2026-07-11. Ported from LAAS (attributed):
      Atmosphere LUTs, SunSky (REWRITTEN: astronomical Giza equinox sun,
      warm sand ground-bounce hemisphere), Clouds (coverage 0.22 sparse
      cumulus + cloud shadows), CSM+PCSS+contact shadows, PostStack (aerial,
      GTAO+bilateral, TRAA w/ analytic velocity, bloom, auto-exposure,
      grade), Egyptian ColorScript, GpuProfiler, heat shimmer (new, in
      post; gated by noon-ness × grazing × 40-1400 m band).
      ATMOSPHERE ADAPTED: dry-desert Mie (Beta_M 5.4e-3), dust layer
      0.038/km desert vs 0.065/km valley (valleyK by fragment world-x),
      warm dust spectrum; altitudes are ASL (world Y + 60).
      **CRITICAL FINDING: reversedDepthBuffer is INCOMPATIBLE with
      CSMShadowNode (three 0.184)** — empty cascade maps read fully
      occluded (bisected: stock node, no casters, ablate=pcss). REVERTED
      to classic depth, near=0.7, polygonOffset on water. Revisit = patch
      addon cascade cameras' _reversedDepth before updateProjectionMatrix.
      CARRIED: froxel dust volumetrics (Phase 6 with work-site plumes),
      cirrus layer, exposure/contrast tuning + full DELTA loop once the
      pyramid exists (Phase 3), night sky (stars/moon).

- [~] **Phase 3** — CORE BUILT + AUDIT PASSING 2026-07-11. PyramidSpec
      (pure course solver: Petrie sawtooth profile, 210 courses normalized
      to survey height; casing layout w/ width jitter normalized per course;
      SMOOTH planarity wave field ±0.2° — per-stone random tilts read as
      popcorn/facets) + PyramidBuilder (63k instanced chamfered stones for
      G1+queens+satellite, per-stone tone/rough, always-on backing pyramid
      = far LOD + joint slot floor; stones toggle at ~1.3 km) + Monuments
      assembly from CANON. Terrain platforms leveled in GizaControl (G1
      court Y=0, queens' terrace −1.2). tools/audit.ts: 11 checks PASS —
      canon/spec consistency, course count, stone floor, T=6/12/18 sun
      cardinality, rendered shadow azimuth Δ1.6° (sector-luminance method;
      absolute thresholds fail — sky fill keeps shadows bright).
      **DEBUG SAGA (the "waffle")**: casing read as egg-crate lattice at
      close range. NOT geometry (corner silhouette razor straight), NOT
      chamfers, NOT tilts — it was GTAO: exactly-coplanar neighbor stone
      walls z-fight in the depth buffer → AO turns the noise into
      per-stone blotches. FIX: 1.4 cm real joint gaps + backing 7 cm
      behind faces. LESSON: when bake-side edits change nothing, the
      artifact is in the POST/lighting chain — ablate first, theorize
      second.
      CARRIED: pyramidion decision (D-9 pending), golden-hour hero delta
      loop (needs /reference), gallery scene, gaps at platform edge SE.

- [~] **Phase 4** — CORE BUILT 2026-07-11. KhufuComplex.ts: merged static
      CPU-built geometry (GeoWriter battered boxes + per-vertex tone), 3
      draws (Tura/local/basalt): court pavement as ~17k INDIVIDUAL slabs,
      temenos wall w/ east gate, mortuary temple (basalt court, pillar
      rows, axis doorways), walled+ROOFED causeway on embankment (180
      segments, 60% overlap, walls raised one step — 60 coarse segments
      opened daylight slits; embankment batter ~0 or pier V-gaps appear),
      valley temple on platform, S boat pits w/ cover beams + E boat-shaped
      pits, queens' chapels, WESTERN grid cemetery (~370 mastabas, 16%
      unbuilt plots, size classes, chapels) + EASTERN field (~32 larger).
      GATE ITEMS PENDING: walls read FLAT GRAY in shade (needs SS-bounce
      strengthening / probe GI + block-course meso detail on all massing
      walls); inhabited test needs Phase-6 dressing; axis-walk verify.
      Causeway roof-slab ends read as dashed ticks (minor).

## Key decisions log

- 2026-07-10: three pinned 0.184.0 (D-8). World frame: origin = G1 center,
  +X east, +Z south, Y up (world Y = ASL − 60 m). World extent x[−1200,2800],
  z[−1800,2200]. Epoch = newly completed pyramid (canon Vol V preferred).
  Canonical day = spring equinox (D-2). Tier-1 scope = Khufu complex era —
  no Khafre/Menkaure/Sphinx (not yet built in 2550 BCE).
- Deferred LAAS ports queued for their natural phases: GpuProfiler (per-pass
  timestamps, Phase 2+), ThreePatches material-key memo + VegPrepass
  @invariant (when shadow passes + prepass exist), CsmCached (Phase 2),
  Gtao.ts port with horizon fixes (Phase 2), analytic-reprojection TRAA
  velocity (Phase 2).

## Next actions (always keep current)

### v1.2 — DETAIL PASS II (branch `v1.2-detail`, from 2026-10-20)

v1.1 merged to main (fast-forward, `bd05a3d`). Brief from the human: boat
crews, more detail, "is there a roadmap?" (there was not past v1.0 — see
ROADMAP v1.2+ below), and FIVE read-only Haiku agents on distinct tasks in
EVERY iteration (code recon, not screenshot review — see M7 of v1.1).
New tool: `tools/closeup.ts --id stall:,kiln: --n 2` boots once and shoots
every footprint whose id starts with a prefix through a telephoto lens
(`window.__akhet.footprints()` is the new tooling hook).

I1 — CREWS, FISHERS, MARKET, BIRDS + THE HAIKU GROUNDING SWEEP (done):
1. BOAT CREWS (`src/water/Vessels.ts`): built inside each hull's bob scope,
   so they heave with it; own RNG stream (`harbor-crews`) so the fleet is
   not re-laid. Barges: a poler at bow and stern working a pole into the
   bed + 0-2 hands sitting by the cargo; travel boats: three benches of
   paired rowers sitting FACING THE STERN (as Egyptian rowers did) with
   oars into the water, a steersman on the raised stern; moored hulls keep
   a skeleton crew; skiffs one poler or paddler. `beam()` — a slanted
   4-sided spar between two points (poles, oars, haul lines). 64 boatmen.
2. SEINE FISHERS (canon "fishermen" on the reach): three pairs of skiffs
   on the river drawing a net between them — floats in a downstream arc,
   a sagging skirt into the water, haul lines from the haulers' hands.
3. MARKET (canon District 5 "markets"; Saqqara market reliefs): 19 stalls
   in two rows on the north-shore road, reed-mat shades on poles, flat
   baskets of fish, onions/leeks, loaves, linen; potters' jars and bowls;
   a lane gang of 36 sellers and buyers between them.
4. BIRDS (`src/vegetation/Birds.ts`, canon "bird colonies"): 7 colonies on
   the river margin — 118 egrets, herons and ibis standing in the ankle-deep
   shallows (static), 154 egrets/ibis/geese wheeling over the reeds with a
   vertex-stage wing beat; the flocks roost (hide) at night.
5. ROUND THINGS WERE STARS: every kiln, furnace, silo, well, basket and
   threshing floor was two boxes crossed at 45° — the union is an
   eight-pointed star, a cog from above. `GeoWriter.drum()` (true polygonal
   frustum, outward-wound, capped) replaces all of them; the RAB silos keep
   their RNG draw count so the town is not re-laid.
6. SLIPWAYS: the runs were a straight line from road to bed — over the flat
   shore that line ran UNDERGROUND (pale slabs in mid-plain, never meeting
   the water) and the level skid rails floated 2 m over the lower runs.
   Runs now follow the ground down the dredged edge into the water, rails
   on every tread.
7. Haiku grounding sweep, all confirmed and fixed: the copper court was one
   solid box (half the smiths dropped) → walls registered, court a floor;
   furnace #4 stood OUTSIDE the east wall and #3 inside the charcoal heap →
   re-laid; kiln/well footprints smaller than the geometry; farmstead house
   footprint 2 m south of the house; rope makers walking IN the post row and
   the rope → beside it; stone yard one solid box + a 4th block row through
   the granite beams → three registered rows, granite clear; slipway gangs
   on the ramp axis → flanks; potters in the solid jar block → the lane;
   threshing piles and oxen unregistered; the threshers' `extra` lines shared
   the canon scale, so every new farmstead re-laid every gang on the site →
   canon lines keep their own scale, extras get an 8 % share on top.
8. Docs drift fixed: README URL params (`?clean`, `?hide`, `?seed`, `?edit`,
   `?debug=collisions`, fov in `?cam`), the iGPU preset (low, or safe when
   the bench is slow), gallery chalk frames marked archival, counts; D-6
   code pointer; D-7 marked PARTIAL (south-face ramp remnants not built);
   D-12 reflectances are luminance; Vessels header. The placement inspector
   moved from `E` to `I` — `E` is the fly camera's "up", and every climb
   toggled the inspector.
Counts: 939 figures (161 moved off structures, 24 dropped), 27 vessels,
64 boatmen, 118 waders + 154 in flight. Collision audit clean.
Battery on an idle GPU: 19/19, bm1 81 / bm3 72 / bm7 46 (the v1.1 idle baseline
was 50-53 / 70-73 / 45-47: the new life costs nothing measurable).

HAIKU — ITERATION 1 (5 agents, read-only, every finding verified):
| agent | task | rows | confirmed |
|---|---|---|---|
| 1 | canon gaps (code grep vs canon lines) | 15 | 15 real gaps — 3 built this iteration (fishers, market, birds), the rest are the v1.2+ roadmap |
| 2 | vessel crew data (deck heights, axes, cabin/mast spans, bob-scope RNG) | 8 | 8 — the crews were placed straight from it |
| 3 | grounding / obstacles in the v1.1 code | 12 | 12 (+4 more of the same classes found while fixing: level slipway rails, buried slipway runs, well footprint, furnace inside the charcoal heap) |
| 4 | GPU/CPU perf hotspots from code constants | 12 | 0 material — estimates, not measurements: 271 live terrain tiles not 2048; probe GI is 0.85 ms here (its 14.6 ms is the iGPU figure in the code comment); froxels 0.18 ms. The shadow-caster items duplicate OPEN item 1 |
| 5 | docs vs code drift | 14 | 11 (1 false: "3.5k shore clumps" is the runtime count — 3532 — not the 7000 target; 2 non-defects) |
VERDICT: unchanged from v1.1 M7 and sharper — Haiku is excellent at
exhaustive code reading against a NAMED class with evidence (agents 1-3,
35/35), fine at drift (11/14), and unreliable where the answer needs a
MEASUREMENT (perf 0/12). Next iterations: keep 1-3 style tasks; give perf
recon only together with a measured pass table, or not at all.

I1b — BOAT QUALITY PASS (done; the human: "boats are poor quality — be more
precise and detailed, within the project's style"):
1. HULLS (`src/water/Vessels.ts`, "hulls" block): v1.1 lofted 9 stations with
   one chine and a flat lid — from above every boat was a solid wedge. Now
   18 stations; outside a wet band at the waterline, two strakes and a dark
   heavy wale; a gunwale cap; an OPEN hull — bulwarks, three floor boards,
   floor timbers every ~1.7 m, thwarts. Every face goes through `face()`,
   wound by a hint vector (the v1.1 see-through-boat class cannot recur).
2. TRAVELLERS: papyriform prow post with a flared papyrus-umbel finial,
   stern post curling inboard (Khufu-ship form); mat deckhouse on a pole
   frame with a flat roof and a dark doorway forward; Old Kingdom BIPOD mast
   (two legs, four lashed rungs, forestay, two backstays). Heading south
   (upstream, before the north wind) the sail is SET — tall and narrow
   between yard and boom, bellied forward, sheets to the quarters; heading
   north the crew rows (bladed oars over the gunwale, rowers facing the
   stern) with the sail furled; at rest the oars lie shipped on the thwarts.
3. STEERING OARS: a big oar over each quarter, loom resting in a crutch
   standing where it actually crosses the gunwale, blade edge-on in the
   water (v1.1: two vertical posts hanging in the air, 0.55 m above water).
4. BARGES: ~1:4 instead of ~1:3 (read as round tubs from above); hue jitter
   coupled (some hulls went salmon pink); stem heads; tie beams fore and
   aft of the hold; Tura blocks on timber sleepers and packed jars, laid end
   to end (v1.1 let cargo interpenetrate and sink 0.14 m into the deck);
   polers on the floor working poles that clear the gunwale; hands sitting
   on the stone.
5. SKIFFS are papyrus BUNDLES now: an oval bundle flattened on top,
   tapering into upturned tied tips, rope lashings every ~0.5 m, sheaves
   toned apart, dried-papyrus colour (v1.1: a plank shell in timber tone).
6. HARBOUR: mooring lines from bow and stern quarters to bollards on the
   pier edge; anchor cables off the bow of anchored hulls; pier clutter
   jars as jars; river traffic heads ALONG the river (v1.1 pointed every
   hull east, across the current); the middle pier springs from the quay
   face (its deck ran through the quay body — same family, so the audit
   never compared them); crew kilts 2 cm wider than torsos (coplanar
   strip z-fight).
7. Layout preserved: every new draw comes from a `harbor-detail` stream;
   the fleet's `harbor` draws keep their v1.1 order and count, so no hull,
   pier or skiff moved. Audit clean, bookmarks pass.
Battery 19/19: bm1 51 / bm3 72 / bm7 46 @1440p. The I1 run's bm1 81 was a
one-off: an A/B in ONE sitting at bm1 1440p (`?hide=vessels`, alternated
twice) reads 53 fps with the fleet, 52 without — the whole fleet is ~0.1M
tris in one draw. (The vessel mesh is now named `vessels` for that switch.)

HAIKU — ITERATION I1b (5 agents, read-only, every finding verified):
| agent | task | rows | confirmed |
|---|---|---|---|
| A | canon requirements for vessels (verbatim quotes, built?) | 18 | 18 accurate — quotes spot-checked verbatim; the motion/traffic gaps ("Boats continue sailing", "transport vessels arrive continuously", "dense forest of masts") feed roadmap I2 |
| B | vessel geometry inventory (named defect classes) | 13 flagged | 11 — incl. two the main agent had missed: the middle pier through the quay, the kilt/torso coplanar strip; "dramatic end rise" is taste, the seatY clamp is by design |
| C | constraints a hull rewrite must keep | 19 | 19 — the afloat rule, draft duplication, the RNG-stream re-roll trap and the bob-attribute contract shaped the design directly |
| D | project style conventions for props | 20 | 20 accurate (palettes, roughness, flat shading, budgets) |
| E | Old Kingdom accuracy of the boats | 11 | 10 — single box under a "bipod mast" comment, vertical steering oars, blade-less oars, plank-shell "papyrus" skiff, no papyriform posts; 1 false ("papyriform" names the form, a timber hull is right) |
VERDICT: with recon aimed at a rewrite (constraints, inventory, canon,
style, accuracy) Haiku is at its best: 78/81. Keep this pattern for any
module rewrite.

### CANON VOLS VII–IX (added 2026-10-20) — what they change

Precedence stays: brief > canon > model judgment (brief, "What this
document is"). Read against the build:
1. Vol VII (Sphinx, Khafre complex) unblocks Tier 2 — but Vol IX §9.3/Rule 4
   forbids showing Khafre's works in Khufu's reign. Tier 2 therefore needs the
   epoch presets first (KHUFU_EARLY / KHUFU_LATE / KHUFU_COMPLETION /
   KHAFRE_PERIOD / MENKAURE_PERIOD / EVIDENCE_VIEW); the brief files `?epoch=`
   under Tier 3. The current Khufu-only scene does not conflict (no Khafre,
   Menkaure or Sphinx is built; Khafre/Menkaure appear only as bedrock sites in
   `GizaControl.ts`).
2. Vol IX §9.3 "critical correction": Heit el-Ghurab belongs mainly to the
   Khafre/Menkaure periods — already declared as D-6 (Khufu-era extent).
3. Vol IX §9.12: "must not automatically generate a long continuous stone
   quay or forest of timber piers". We have a 180 m continuous quay and three
   piers. The brief §2 REQUIRES "stone docks and wooden piers (individual
   piles)", and the brief wins on scope — but the canon governs form. Logged as
   D-14; the rework (shorter stone landing surfaces, earthen embankments,
   timber ramps, cargo yards, confidence tags) goes to roadmap I6.
4. Vol IX §9.10.1: "Do not create a single giant water plane" — the river is
   one 700×4600 plane and the harbour one 950×560 plane (its rectangular edge
   is already OPEN item 3). Shoreline-polygon water meshes → I7.
5. Vol IX §9.14–9.20 — vessel library and cargo: our three classes cover
   heavy stone transport (barge), administrative/travel (traveller), small
   river and fishing craft (skiff). Missing: general cargo transport and a
   ceremonial vessel; loaded hulls should sit lower; boats MOVE along a
   navigation graph; the Tura limestone route (Merer's diary) is the flagship
   logistics sequence → I2. The north wind / northward current rule (§9.16)
   is already what the I1b rigging follows.
6. Vol VIII: breweries, medical buildings, textile production, scribal
   offices, waste management, families and children, donkeys/goats/geese —
   most are roadmap I3; profession schedules / ECS NPCs are brief Tier 3.
7. Vol IX §9.5.1 axis convention (X east, Y up, +Z south) matches ours.

### ROADMAP v1.2+ (written 2026-10-20 — the old 10-iteration roadmap is done)

Each iteration: 5 read-only Haiku recon agents (distinct tasks) → verify →
build → closeup/tour/audit → battery (no src edits while it runs) → commit +
push the work branch. Merge to main and any deploy only on the human's word;
GitHub Pages stays OFF until the human calls the project ready.

| it. | theme | content |
|---|---|---|
| I1 | crews + life on the water | DONE (above) |
| I2 | the river at work (canon IX §9.14–9.22) | boats UNDERWAY on a navigation graph (spline-following in the vertex stage, wakes); the Tura limestone route as the flagship sequence (loaded barge arriving, unloading to a staging area, a scribe recording — Merer's diary, nothing invented); loaded hulls sitting lower; a general cargo vessel and a ceremonial vessel class; reed and papyrus cutters with bundles; a ferry crossing |
| I3 | town life (canon VIII) | a brewery beside the bakeries (vats, mash jars), a weaving terrace (ground looms), a stone-carving shed, a public court in the eastern town; a physicians' house, a scribal office, managed ash and sherd dumps; donkeys, goats and geese; children carrying water |
| I4 | the land | orchards (sycomore figs, date rows) at the farmsteads, irrigation basins with dykes and small feeder canals, a temporary workers' camp of reed shelters by the haul road |
| I5 | the necropolis + the monument | family tomb groups sharing walled courts in the mastaba fields; D-7 south-face ramp remnants (dismantling debris, staged); quarry fine-limestone staging + granite storage |
| I6 | the harbour per canon IX §9.11–9.13 | rework the 180 m quay into conservative landing surfaces, earthen embankments and timber ramps (piers kept — brief §2 floor; D-14), cargo yards and an administrative shelter with scribes, confidence tags on every reconstructed piece |
| I7 | polish + perf | water as shoreline-polygon meshes instead of two big planes (canon IX §9.10.1; fixes OPEN item 3's water edge), OPEN item 1 (iGPU caster allow-list), the red escarpment rim at night, crop-tuft card LOD, a bookmark for the scaffolding tableau |
| T2 | Tier 2 (canon VII) | epoch presets first (canon IX §9.3), then the Sphinx carved out of its enclosure's strata, the Sphinx Temple, Khafre's valley temple, causeway, mortuary temple and pyramid — shown only under KHAFRE_PERIOD and later |

### v1.1 — DETAIL + BUG PASS (branch `v1.1-detail`, from 2026-10-20)

Brief from the human: extend the world, add detail, fix bugs. Baseline
before touching anything: battery 19/19, and a NEW tool — `tools/tour.ts`
boots once and captures all eleven bookmarks (~1 min instead of eleven
40 s boots; `--only 5,6`, `--q "cull=0&hide=debris"` for ablations).
`?hide=<name prefixes>` hides scene objects by name (ablation switch).

M1 — THE TOWN WAS UNDERGROUND (done):
1. "Debris floating over the worker town" (bm5/bm6) was not debris: the two
   cameras stood 3.2 / 3.8 m UNDER the terrain (groundProbe), so the world
   rendered from below. Bookmarks re-seated; `jump()` and the flythrough
   now clamp the eye above ground/water; `tools/test-bookmarks.ts` fails on
   any authored mark with < 1.2 m clearance.
2. Lifting the camera exposed the real defect: the galleries had sand at
   ROOF level. Flat-based 78 × 36 m blocks sat on their lowest corner on a
   2-3 % slope, the uphill side buried. The audit passed it because
   `buried` only fires when the WHOLE top is below the lowest ground
   sample. NEW audit rule `sunk`: terrain on the uphill side above 60 % of
   a footprint's height (from `yFloor` when y0 is a buried foundation).
   First run: 10 issues (galleries, east town, bakeries, Wall of the Crow,
   3 causeway runs, 2 mastabas).
3. Fixes: per-district flat terraces in GizaControl at the MEAN natural
   level (`WORKER_TOWN_PADS`, town-local frame, 6 m blend; levels measured
   with groundProbe); `masksB.w` = new `worked` mask (G1 court, queens'
   terrace, town pads) — SandTransport sweeps sand off prepared surfaces
   (the mortuary temple's basalt court is visible again for the first
   time); long walls built by `gwall()` in ~14 m runs grounded one by one,
   battering the THICKNESS only (`GeoWriter.box` batterZ — battered ends
   would notch every joint, the causeway V-gap lesson again); mastaba plots
   whose corners fall > 45 % of a nucleus are left unbuilt (RNG draws kept
   in order so the grid does not re-lay); causeway runs where the grade
   crosses the crest are declared `cutting` (walls full height inside,
   hillside to the roof on the uphill shoulder only).
4. ALSO FOUND: README gallery images live in `shots/`, which is gitignored
   — every image is broken on GitHub. To fix with tracked docs/gallery.

M2 — SURFACES, SKY, BANKS (done):
1. ZIPPER ARRISES: every course's end stone poked its top corners ~0.4 m
   past the arris (stones are laid out at course MID-height width, the face
   narrows with height) — all four pyramid edges read as stitched. Mitred
   in the vertex stage: each vertex's along-face coordinate is clamped to
   the face half-width at that vertex's own height.
2. Casing roughness 0.42 → 0.62 (honed Tura, not polished — edge-on faces
   mirrored the zenith; the queens read as blue steel), far shell matched;
   TURA albedo nudged to cream; "batch mottling" (quarry-batch tone, 5-15 m)
   baked ONCE on the CPU into a 256² texture over the footprint — near
   stones take it per instance, the far shell samples the same texture, so
   the LOD switch cannot pop. The FIRST version evaluated 3D Perlin per
   vertex of 63k stones in every shadow cascade: bm3 lost a quarter of its
   frame rate. Measure before you mottle.
3. HEAT SHIMMER was white noise: hash12(screenUV·k) moved every pixel up to
   ~4 px independently, so every noon edge dissolved into dither. Now smooth
   noise, gated to rays that truly skim the ground (|dir.y| < 0.1, was
   0.25 — the lower half of a pyramid 400 m out shimmered), and evaluated
   only where the gate is live.
4. CLOUD SHARDS, the real cause: the 96³ base noise tiles every 3.6 km via
   RepeatWrapping but was baked from NON-periodic MaterialX noise, so every
   tile edge was a flat plane where density jumped; the weather map the same
   at 26 km. New `gpu/noise/PeriodicNoise.ts` (lattice indices mod period —
   exact wrap, no contrast loss like the shifted-copies blend); base bake
   now banded (885k × 3 Worley searches).
5. Basalt court (exposed by the sand sweep, read as water): rough 0.86,
   spec 0.25, running-bond slab grid on horizontal faces
   (`limestoneMaterial` opts.paveW).
6. Nile banks were a ruled line (210 m meander is straight in any one
   framing): 13-40 m bank irregularity; the bank stays steep.
PERF NOTE: the battery's 1440p numbers drift with GPU thermal state — the
baseline battery said bm3 82, but `main` re-measured with the same protocol
in this session gives 50/73/47, identical to the branch. Compare A/B in one
sitting (scratch perf script = the battery sweep alone), never across runs.

M3 — THE HARBOR DISTRICT + PEOPLE (done):
1. `monuments/HarborDistrict.ts` (canon Vol. IV District 5): the ~1.1 ×
   0.5 km works zone around the basin was bare silt. Now: three storage
   magazine ranges + a beehive-silo granary on the north shore, a stone yard
   by the quay (dressed casing blocks, Aswan granite beams with lifting
   bosses, sledge + levers), three cargo slipways into the basin, a boatyard
   on the south shore (hulls on stocks held by moulds — Khufu-boat logic,
   sewn plank hulls; timber stacks, saw frame, shades) and four wells. Every
   piece is placed only where its whole footprint is dry and registers a
   footprint (family `harbor-district`); audit clean. No shaduf, pulley or
   wheel (Old Kingdom).
2. BUG — the harbor had NO PEOPLE: Inhabitants dropped figures at
   `y < -44` "not in the water", but the floodplain is −44.5, so every
   figure on the plain was silently discarded; and the two harbor lines lay
   IN the basin anyway. Water test is now NILE_WATER_Y + 0.3, walkers keep
   both ends of their beat dry, harbor lines re-routed + 5 new district
   lines. Workers 776 → 879.
3. Field carpets: sowing rows (0.85 m, faded by 140 m before they can
   moiré), stand-density patches and a maturity drift — a parcel no longer
   reads as one green plane at 50-300 m.
4. bm1 "harbor panorama" re-framed (the old pose looked at bare silt with
   neither the harbor nor the pyramids in frame).

M4 — THE PUBLIC GALLERY WAS BROKEN (done):
README pointed every image into gitignored `shots/`. New `tools/gallery.ts`
renders nine curated frames (one boot, `?clean=1` hides the fps chip and
notices — new HUD switch) into TRACKED `docs/gallery/*.jpg` (~0.14 MB each).
M5 — BUGS THE HUMAN FOUND IN THE BROWSER (done):
The human walked the build and reported: figures walking through walls,
floating or sinking into the sand, walking unnaturally fast; floating
blocks; gaps between walls; see-through boats. Every one was real:
1. GAIT: figures drifted along their file at ~11 m/s (40 km/h) while the
   legs swung once per ~3 s, and the "triangle" ping-pong ran −2..1 — a 2·half
   teleport at every wrap and half of every beat walked BACKWARDS. Now a
   speed in m/s (1.0 loaded / ~1.3 free), legs locked to a 1.45 m stride,
   a true −1..1 triangle, idle workers shifting weight instead of marching.
2. FLOAT/SINK: height was sampled once at the beat centre; walkers covering
   ±26 m of rippled sand or ramp waded and hovered. The vertex stage now
   samples `hf.sampleHeight` at the figure's CURRENT position.
3. THROUGH WALLS: files crossed the temenos wall, gallery blocks and the
   causeway (its porters walked down the embankment's axis). New footprint
   obstacle field (24 m hash): spots inside structures are re-drawn on the
   same file (own RNG stream), beats stop 1.2 m short of the first wall or
   waterline. 828 figures (182 re-seated off structures, 53 dropped). The
   causeway porters walk its south flank.
4. SEE-THROUGH BOATS: all four hull side strips were wound INWARD — from
   outside they were back faces, so every boat showed the inside of its far
   side. Re-wound outward.
5. WALL GAPS: `GeoWriter.box` battered BOTH axes, so every jamb, corner and
   lintel bearing opened a V. WALL RULE: a box ≥3× longer than thick batters
   its thickness only (explicit batterZ overrides). End walls of the temples
   and temenos batter all faces so their ends lean WITH the side walls' outer
   faces; side runs reach half-way into the corners; lintels as thick as the
   jambs at their height. The valley temple's corners read clean.
6. FLOATING BLOCKS: abandoned quarry blocks and big rubble were seated at
   their CENTRE height — on the 1.12 m bench edges they hung half in the air.
   Seated on the lowest corner now.
Battery on an idle GPU (53 °C): 19/19, bm1 53 / bm3 70 / bm7 45.

M7 — HAIKU QA PILOT (5 read-only agents, distinct tasks; all findings
verified by the main agent before any change):
| agent | task | reported | confirmed |
|---|---|---|---|
| 1 | centre-height seating / water thresholds (code) | 15 | 14 correct readings, 3 visible defects (beached hulls ×2, mastaba chapels) — it ignored that most pieces stand on flat ground |
| 2 | canon / anachronism audit (code + canon quotes) | 3 | 2.5 — shaduf crane (New Kingdom) replaced; potter's "wheel" → tournette; lamp posts declared D-13 |
| 3 | winding / coplanar / V-gaps (code) | 6 | 6 — GeoWriter.box had NO BOTTOM FACE (see-through lintels and roofs from below), debris chips wound inward, valley-temple floor z-fight, temenos west-run wedge, two coplanar strips |
| 4 | visual QA, 10 frames | 8 | 0 (perspective, occlusion and intended content read as defects) |
| 5 | visual QA, 9 frames | 5 | 0 (+1 valid design note: field rows too contrasty up close → softened) |
VERDICT: Haiku is strong at targeted code reasoning on a NAMED bug class with
evidence required (agents 2-3), weak at open visual QA of 3D frames (0/13).
Keep 1-3 style recon; do not use it for screenshot review.

PERF CAVEAT (2026-10-20 evening): after hours of captures the RTX 3050 sat
at 86 °C with SW thermal slowdown (clock 1410/2100 MHz) and 100 % utilisation
from OTHER processes (Edge, Docker, other agents) — the sweep read 20/22/16
on code that measured 50/73/47 an hour earlier. Re-measure on an idle GPU
before believing any frame-rate number from that window.

### v1.0.1 — BLACK SCREEN AFTER LAUNCH (fixed 2026-07-25)

User report: "a few seconds after launch the monitor goes black, and it wants
the RTX 3050 instead of the Intel graphics."

REPRODUCED, then diagnosed — `tools/probe-igpu-boot.ts --preset high` on the
Intel UHD dies with **`DXGI_ERROR_DEVICE_HUNG (0x887A0006)`**: boot completes,
then the device hangs WHILE RENDERING. That is Windows **TDR** (Timeout
Detection & Recovery): a GPU job past the ~2 s watchdog resets the display
driver, the monitor blanks, the WebGPU device dies, and the page is left
holding its last frame — which is why it reads as "black and never comes back"
rather than "crashed".

ROOT CAUSE — **the preset was chosen from `adapter.info.vendor` containing
"intel"**. Any slow adapter that does not say "intel" (masked, empty, or
differently-named vendor string), or any explicit `?preset=high`, ran the FULL
preset and hung the driver. The heavy boot dispatches were a contributing risk
but NOT the trigger: the hang happens after `ready`.

FIXES, in order of how much they matter:
1. **`src/core/GpuBench.ts` — pick the preset by what the GPU can DO.** Time a
   fixed compute workload and believe the number. Two traps on the way:
   (a) `renderer.computeAsync()` in three 0.184 does NOT wait for the GPU — it
   submits and returns (Renderer.js:2800), and `waitForGPU()` was removed. The
   first probe timed CPU submit and called an Intel UHD a **0.3 ms** adapter.
   `gpuSync()` (`queue.onSubmittedWorkDone()`) is the real fence.
   (b) a SINGLE timing still cannot discriminate: fence + submit latency is a
   fixed few ms everywhere, so the probe read 3.0 ms on the RTX 3050 and 6.4 ms
   on the UHD — 2× for adapters an order of magnitude apart. Timing the same
   kernel at TWO sizes and taking the SLOPE cancels the constant: measured
   **0.8-1.4 ns/invocation on the RTX 3050 vs 6.9-13.0 ns on the Intel UHD**.
   Threshold 3 ns. The gate runs even when `?preset=` is explicit, because the
   failure is a SYSTEM-WIDE display reset, not a bad frame rate; `?force=1`
   opts back in.
2. **Runtime TDR guard** (`Engine.guardFrameTime`): if frames run past 250 ms,
   cut the render scale (×0.6, floor 0.4, three times). First version waited
   for 12 slow frames — at 350 ms each that is four seconds, long past the
   point where the driver has already decided to reset, and the run still
   died. Four frames survives.
3. **`device.lost` is handled** (`installDeviceLostHandler`). A lost device
   used to stop the frame loop in total silence; it now raises the fatal
   overlay naming TDR and what to change.
4. `src/gpu/Banded.ts` — banded compute for the big boot dispatches
   (HeightSynthesis 16.7M at 4096², QuarryCarve, NoiseBake; SandTransport's
   BATCH 8 → 2, since the watchdog times the SUBMIT, not the dispatch).
   Defensive rather than curative — the hang was in rendering — and verified
   output-identical: `?band=33554432` (one dispatch = old behaviour) vs
   `?band=262144` differ by mean **0.014**, 0.003% of pixels >2 (TRAA noise).
   NOTE this only became a real serialization once `gpuSync` existed.
5. The iGPU fallback is an ON-SCREEN notice now, not a console warning nobody
   reads, with the exact Windows/NVIDIA/command-line steps. Chrome IGNORES
   `powerPreference: 'high-performance'` on Windows (crbug 369219127) — no
   page-side switch exists, so saying so plainly IS the fix.
6. The boot bar advances through the long passes (band progress): a frozen bar
   and a hung app look identical.

VERIFIED: `probe-igpu-boot --preset high` now reports `13.0 ns → preset low`
and **PASSES** (boot 7.7 s, 6.8 fps, no device loss) where it previously hung
the driver; the RTX 3050 measures 1.4 ns and keeps the full preset.

ALSO 2026-07-25: **bookmark 11 (key `-`) — "temple scaffolding"**, the
construction tableau at the mortuary temple's unfinished SE corner (T 16.2, so
the falsework throws its own shadow across the court). Two placement bugs found
while framing it: the first camera stood INSIDE queen's pyramid G1-a (the whole
sector east of the corner is G1-a's footprint — the clear approach is from the
south), and the lever crane's mast stood INSIDE the mortuary temple at z 24.4
(temple spans z ±26); the crane moved west of the falsework. A 26-strong gang
now works the corner — scaffolding with nobody on it reads as abandoned, not
mid-job.

### v1.0.2 — SAFE PRESET (2026-07-25)

The v1.0.1 fixes were not enough: the user's session hung the driver **at the
already-reduced `low` preset** on the Intel UHD, with the new overlay
correctly naming `DXGI_ERROR_DEVICE_HUNG` and the integrated adapter. So `low`
is not the floor — there needed to be one below it.

**`safe` preset** (`?preset=safe`, and the type is now
`'safe' | 'low' | 'high' | 'ultra'` so every budget table had to declare its
value — the compiler found all fifteen sites): heightfield 1024²/sim 512
(the 4096² synthesis is 16.7M invocations of the full terrain function; at
1024² it is 1M), tiles 112 @16 segs, tufts 22k/fade 380, palms 900, debris 8k,
particles 6k, figures 140, GI slice 512 every 6th frame, ONE 512² cascade at
700 m, cloud shadow map 320² re-baked every 6 s with an 18-step march, froxels
OFF, render scale 0.5. Measured on the Intel UHD: **13.2 fps vs 8.4 at `low`**,
boot 7.7 s vs 9.6 s, and it still reads as the world (shots/perf/safe-look.png).

THREE BUGS FOUND WHILE BUILDING IT, each invisible without measurement:
1. **The benchmark proposed a preset instead of a CAP.** The vendor check had
   already set `low`, so a measurement saying "this adapter needs safe" could
   not lower it — the iGPU measured 22 ns and still ran `low`. Now the bench
   returns a cap and the more conservative of {cap, current} wins.
2. **Render scale was set where the preset was CHOSEN, not by the preset.**
   `?preset=safe` therefore kept full DPR and rendered 2.6× the pixels of
   `low`, measuring no faster — a safe mode that is not safe. The default now
   lives in `Engine.create` keyed on the preset.
3. The safe threshold is **1.5× SLOW_NS, not 2.2×**: the Intel reading varies
   5.2-22 ns run to run and would have landed on `low` on a slow-measuring
   run. The gap to the discrete GPU is 5-30×, so anywhere in between works,
   and the failure being guarded is a display driver reset — take the
   conservative end. An INTEGRATED adapter that measures slow at all now goes
   straight to `safe`.

**RECOVERY**: a device loss is recorded in localStorage, so the NEXT load comes
up in safe mode by itself and says so; the flag clears once a session survives
to `ready`, so a one-off hiccup does not pin the app. The fatal overlay also
carries a "Reload in safe mode" button — an overlay that only explains is half
a fix.

VERIFIED on the Intel UHD: auto (no preset) → `5.2 ns → cap safe`, PASS at
13.2 fps; `?preset=high` → refused, downgraded, PASS; `?preset=high&force=1`
→ still hangs, which is the documented meaning of `force`. RTX 3050 measures
0.4-1.4 ns and keeps the full preset.

### OPEN AFTER v1.0 (2026-07-25)

1. **iGPU is still short of 30 fps on the two heaviest framings.** After PERF
   II the Intel UHD @1600×900 runs the town gate at ~30 fps and bare desert at
   ~24, but the quarry bowl and the dense floodplain sit at 10-17. The
   remaining whale is the SHADOW pass (caster-bound: terrain patches +
   structures re-rasterized per cascade) and the always-drawn merged complex
   geometry. Next levers, in order: a caster allow-list on `low` (drop shore/
   debris casters), a distance-gated stone LOD switch for the complex, and a
   cheaper terrain shadow position node.
2. **D-1 reference frames still outstanding.** The colour work to date is
   calibrated against WRITTEN criteria plus physical reflectances (D-12). The
   1-3 human photographs, when they arrive, should be run through
   tools/levels.ts with matched framings — the instrument is ready and the
   comparison is now a numbers exercise, not an argument.
3. Known minor artifacts: a faint red rim survives on the far escarpment at
   night (aerial-perspective residual >6 km); the harbour water sheet's
   rectangular edge is visible from bookmark 10's left margin; crop tufts read
   as isolated blades inside ~15 m (a card/far-tuft LOD is the queued fix, and
   it also fixes the >120 m aliasing noted in Phase 5).
4. The depth prepass ships OPT-IN because it measured a loss on this content
   (see PERF I). Re-measure if materials get heavier (e.g. if veg ever gains
   translucency/SSS) — the technique is built and verified, only the trade is
   currently wrong.
5. The scaffolding tableau at the mortuary temple's SE corner deserves its own
   bookmark; it is small in every existing framing.

### ROADMAP — 10 iterations (agreed 2026-07-23, ALL DONE 2026-07-25)
1. **PERF I — DONE 2026-07-24.** `src/render/InstanceCull.ts`: scatter
   systems (palms/tufts/shore/debris/particles) are bucketed into spatial
   CELLS at build time (buffers permuted so each cell is one contiguous
   instance slice) and drawn with WebGPU **indirect draws** — one indirect
   entry per cell, `firstInstance` = slice start; per frame the CPU tests a
   few hundred cell AABBs and rewrites `geometry.indirectOffset` (an ARRAY of
   byte offsets ⇒ one draw per visible cell, re-read at encode time,
   WebGPUBackend.js:1664). The indirect BUFFER never changes: no per-frame
   uploads, no compute pass. Needs `indirect-first-instance` (present on this
   adapter; three requests every adapter-supported feature) — WGSL's
   `@builtin(instance_index)` starts at `firstInstance`, so no shader change.
   RESULT @2560×1440 RTX 3050: GPU **30.0 → 17.9 ms**, fps **25 → 52**,
   tris 24.3M → 14.3M; bm1 27.4→17.2, bm3 25.7→13.7, bm7 (heaviest) 34.1→21.0.
   Output identical to `?cull=0` within TRAA noise (tools/diff.ts: mean 0.035,
   0.11% of px >8, all of it sub-pixel crown overlap at >1 km — the cell sort
   changes rasterization order among coincident thin tris).
   KEY DETAILS: (a) SHADOW CORRECTNESS — geometry is shared with the CSM
   passes, so casters are tested with their AABB unioned with its own
   sun-projected copy (`casts: true`), else groves behind the camera lose the
   shadows they throw into view; (b) `mesh.count` is set to the visible
   instance total so `info.render.triangles` stays truthful (unused by the
   indirect path; 0 skips the draw); (c) `minPerCell` auto-coarsens the grid —
   one drawIndirect costs ~3 µs of encoder time, so sparse systems double
   their cell size until each cell earns its draw (first run: 821 draws =
   +2.7 ms CPU submit; tuned to 137 draws); (d) new `engine.onPreRender()`
   runs after ALL updateFns so culling sees the FINAL camera pose (updateFns
   are registration-ordered and FlyCamera installs after the scene).
   ALSO: small debris chips fade out 520→340 m (sub-pixel at 1440p — costs
   nothing visually, kills sub-pixel sparkle TRAA had to fight).
   DEPTH PREPASS built (`src/render/DepthPrepass.ts`, LAAS port, @invariant
   WGSL patch) and verified visually identical — but **measured a LOSS** on
   this content and therefore ships OPT-IN (`?prepass=1`): r.scene 9.5 on /
   8.6 off from the river shore, 6.22 / 6.14 standing inside the crop belt,
   CPU submit +2.7 ms from the doubled draw stream. Thin blade/frond geometry
   with cheap shading never repays a second full vertex pass.
   NEW TOOL: `tools/diff.ts` (mean/p99/max + >2/>8/>24 pixel shares) — the
   regression metric for "identical output" claims.
2. **PERF II — DONE 2026-07-24** (reduced/`low` preset, verified with
   tools/probe-igpu.ts on the Intel UHD at 1600×900, the adapter Edge picks
   by default). Levers, in order of what they actually bought:
   RENDER SCALE 0.62 on the auto-iGPU path (the UHD is fill-bound; params.dpr
   is still overridable) · TILE BUDGET 256 with the CDLOD recursion visiting
   children NEAREST-FIRST and the budget gating the SPLIT, never the emit —
   over budget a patch stays coarse instead of vanishing (dropping it punches
   a hole in the ground); bare-desert tris 1.9M → 0.3M · PATCH_SEGS 24 ·
   terrain micro-displacement down to ONE vertex noise fetch (3 vertex
   texture fetches × ~440k verts was the second whale) · GI slice 3072 → 1024
   probes AND every 3rd frame (~9× amortized; only cost is a longer converge
   tail after a ToD jump) · shadows 1 cascade @1024, maxFar 1100 (the pass is
   CASTER-bound, not filter-bound: 17.5 ms of a 70 ms frame at 2×768) ·
   tufts 70k/fade 560, particles 22k.
   NOTE on "half-res particles": particles here are ordinary world geometry
   in the scene pass, not a screen-space effect — a particles-only half-res
   pass needs its own depth pyramid plus a soft-particle depth fetch for
   occlusion. The 0.62 render scale delivers the same fill-rate saving for
   every transparent pixel at a fraction of the complexity, so that is what
   shipped; a dedicated pass stays available if the quarry framing ever needs
   it specifically.
3. **WATER — DONE 2026-07-24.** ROOT CAUSE of the dead black dawn water was
   an energy bookkeeping error, not a missing highlight: the sky reflection
   was fed in as `colorNode` (ALBEDO), so it was multiplied AGAIN by the
   scene lighting — invisible at noon, fatal at dawn where the sun term is
   ~0.2 and the hemisphere is dimmed for GI. Reflected radiance is radiance:
   it moved to `emissiveNode`. Added: an analytic Blinn GLINT lobe whose
   width GROWS with distance (sub-pixel ripple variance is lost at range —
   the GGX response to the DirectionalLight can only draw an aliased sliver,
   never a sun road), tinted by `Atmosphere.sunRadiance()` (a white highlight
   in a dawn frame is the tell) and broken up by a fast fine octave so the
   road glitters; a turbidity floor (`body × sky dome`) so water facing away
   from every light is never black; reflection direction now takes 0.75 of
   the ripple while FRESNEL keeps the 0.35-flattened normal (flattening both
   — the LAAS white-sheet fix — had made the river a perfect mirror);
   harbor wavelet scale 0.42× the river's (a sheltered basin has no fetch).
   Recaptured shots/final/dawn-from-harbor.png; shots/water/dawn-sunroad.png
   is the sun-road proof looking east.
4. **CLOUDS — DONE 2026-07-24.** The "pale angular shards" were `.fract()`
   on the density lookups: fract is discontinuous at the wrap, the sampler
   never interpolates ACROSS it, so every 420 m (detail), 3600 m (base) and
   26 km (weather) the field jumped along a perfectly flat plane. Fixed with
   RepeatWrapping + no fract, and the 32³ detail texture is now baked
   PERIODIC (8 unit-shifted copies blended with trilinear corner weights).
   Second shard source: near the horizon the slab chord ran to the 26 km cap,
   so 32 steps meant 800 m per sample — the marched span is now capped at
   tEnter+9 km (step ≤ ~280 m). NEW cirrus deck at 6.2 km: one ray-plane
   sample (thin ice needs no march), anisotropic 5.5:1 domain along the wind,
   large-scale patch mask (canon: OCCASIONAL cirrus), forward-scatter rim
   near the sun, `?cirrus=N` to tune/ablate. Cloud shadows softened to a
   5-tap cross ≈ the real ~11 m penumbra of a 1.3 km-high caster.
5. **NIGHT — DONE 2026-07-24** (src/sky/NightSky.ts + src/monuments/
   Torches.ts). Analytic stars (3 magnitude classes over a 3D CELL HASH —
   an equirect grid clumps at the zenith), horizon-weighted scintillation,
   O/B-to-K colour spread, a dust-mottled Milky Way band, and a moon disc
   with a real terminator (disc-local offset → hemisphere normal → phase from
   the sun direction, flattened by pow(0.45) for the regolith's opposition
   surge) plus a tight aureole. MOONLIGHT RE-AIMS THE SUN'S DirectionalLight
   instead of adding a second one — CSM, PCSS and contact shadows all keep
   working at night for free, cast by the moon. Torches: emissive flame
   tongues (standard material, black albedo + emissive — §9 bans unlit world
   shading, and radiance belongs in emissive anyway) with per-flame hashed
   flicker, over lit post/bowl geometry, plus ≤14 tight PointLights (range 26,
   decay 2) so mudbrick actually catches the fire. Everything gated by
   night-ness, so daylight frames pay nothing.
   THREE BUGS THE FIRST NIGHT FRAME EXPOSED, all the same class — *the
   transmittance LUT still returns a deep-red residual with the sun 40° below
   the horizon*: (a) ProbeGI kept publishing a maroon bounce and painted the
   whole floodplain red → new `ProbeGI.gain`, faded to 0.02 at night; (b) the
   cumulus deck lit like embers at midnight → sun term gated by elevation,
   with a small moon-lit term added; (c) pink cirrus over a midnight sky →
   same gate. Also: anything that REFLECTS the sky needs the night terms or
   it mirrors an empty black dome — `Atmosphere.skyFull()` now adds them, and
   the water uses it. Night hemisphere ambient deliberately bypasses the
   GI dim factor (probe GI is faded out after dusk, so something has to hold
   the shadow floor up — the no-black-shadows law does not clock off at
   sunset). Bookmark 10 (key `0`, `?bm=10`) = "night harbour"; bookmarks can
   now carry a time of day, because a night view is a POSE PLUS AN HOUR.
   KNOWN MINOR: a faint red rim survives on the far escarpment at night
   (aerial-perspective residual at >6 km), and the harbour water sheet's
   rectangular edge is visible from bm10's left margin.
6. **FROXELS — DONE 2026-07-25** (src/gpu/passes/Froxels.ts, LAAS port
   re-aimed at Giza). Camera-frustum froxel grid (144×81×48 high / 96×54×32
   low), exponential slices 2→520 m, jittered per-slice sample, closed-form
   per-slice integral, composited BEFORE the aerial term in PostStack's
   existing `VolumetricsLike` seam. LAAS's canopy shafts + hydrology fog
   became: (a) WORK-SITE DUST — analytic gaussian columns on the SAME anchors
   WorkParticles emits from (the column and the sprite plume have to agree or
   the plume floats in clear air), gated to working hours and hanging above
   the workings rather than at eye level; (b) VALLEY MIST — a 9 m scale-height
   layer gated to the wet floodplain AND to low sun, so it reads as a layer
   you look ACROSS and noon stays clear (the aerial term owns daytime haze;
   stacking fog on it just washes the frame). Sun visibility = 5-probe terrain
   horizon march × cloud shadow map. Cost on the 3050: 0.12 ms scatter +
   0.08 ms integrate. TUNING LOG: dust 1.35 buried the quarry bowl in white,
   0.5 still fogged eye level, 0.28 ships. `?froxels=0`, `?fog=N`, `?dust=N`.
7-8. **INHABITED I+II — DONE 2026-07-25** (src/monuments/Inhabitants.ts).
   ~900 instanced figures (~70 tris, 1.65 m — Old Kingdom male mean) with a
   real WALKING GAIT in the vertex stage: a `limb` attribute per vertex, hip
   (0.82) and shoulder (1.34) pivots, per-instance phase and cadence, knee-bob
   at 2× cadence. They PING-PONG along their file — a triangle wave with an
   eased 180° yaw flip at each end — so a haul road carries traffic both ways
   and NOTHING TELEPORTS (a wrapping loop pops however small the figure).
   Placement is on the real work lines in files and gangs, never an even
   scatter: haul road, ramp head, quarry benches, masons' yards, causeway,
   quay, gallery street, bakery yard, Wall of the Crow gate; `still` fraction
   per line decides who walks and who works in place. Plus 5 ox sledge trains
   (yoked pairs, runners, deck, dressed block, yoke beam and traces), reed-mat
   gang shelters, and a construction tableau on the mortuary temple's SE
   corner: rubble ramp, timber falsework with ledgers and a plank deck, and a
   shaduf-style lever crane with counterweight.
   BUG: the first `bone()` built its cross-section basis by hand and got it
   wrong — every limb splayed like a tripod, invisible past ~80 m and glaring
   inside 40 m. Fixed with a proper d×up / d×a orthonormal basis.
9. **DELTA — DONE 2026-07-25** (run against WRITTEN criteria; human reference
   frames D-1 still outstanding). The finding is the shape of this whole
   build: "midday reads chalky" measured out as sunlit desert luminance
   **194.9** vs Tura casing **198.1** — a **1.6%** separation, i.e. the Great
   Pyramid and the sand it stands on were THE SAME TONE. Not a grading
   problem: an albedo error (sand 0.80 where dry desert sand is 0.35-0.45),
   which AgX's highlight desaturation then flattened into paper. Terrain
   albedos moved to physical values (sand 0.53/0.47, limestone 0.48/0.40,
   gravel 0.38, fresh quarry 0.57); the casing stays the brightest surface on
   the plateau but now EARNS it. Same measurement after: **149.9 vs 198.5**
   (24%), sand saturation 0.113 → 0.166. Both final frames recaptured.
   NEW INSTRUMENT: tools/levels.ts (clipping shares, percentiles, patch means
   + saturation) — the thing the colour argument is settled with.
10. **FINAL — DONE 2026-07-25.** WALK MODE (`G`, `?walk=1`,
   src/core/WalkRig.ts): eye at 1.55 m, horizontal input flattened so pitch
   cannot lift the walker, critically-damped 90 ms vertical follow. The
   walkable surface comes from the FOOTPRINT REGISTRY — it already carries a
   logical OBB with a world-Y span for every structure because the collision
   audit needs one, which makes it exactly a walkable-surface database; the
   causeway, quay, temple platforms and mastaba tops are walkable for free and
   stay correct when the Inspector moves something. Step limit 1.25 m (taller
   is a wall to go around, not up); a >2.5 m horizontal jump is treated as a
   TELEPORT and snaps instead of sliding (bookmarks/setPose used to sink the
   eye into the causeway for a third of a second — caught by the battery).
   BATTERY (tools/battery.ts, `npm run battery`): audits + smoke tests +
   content floors from brief §2 + walk-mode eye-height gate + no-black-shadows
   gate + the midday separation gate + a 1440p perf sweep.
   REGRESSION THE BATTERY CAUGHT: the 14 torch PointLights cost **22 fps** at
   1440p in DAYLIGHT frames (52 → 20-25) — a PointLight at intensity 0 still
   enters every lit material's per-fragment light loop. They are now ADDED and
   REMOVED from the scene at dusk, not dimmed: one shader rebuild at the
   transition in exchange for the daytime frame back. This is the single most
   valuable thing the battery has done so far.
   README.md written with the gallery.


1. **Phase 5 remainder — DONE 2026-07-22** (src/vegetation/Shore.ts):
   papyrus clumps standing IN the shallows (bed W−0.4..W+0.12) + reed
   clumps on the first dry half-meter, ~3.5k instanced clumps rejection-
   sampled off the CPU height mirror (the shoreline finds itself);
   sycamore (dense ellipsoid crown shell) + tamarisk (feathery scrub),
   380 trees damp-plain/margin split; PLANTED palm rows along the harbor
   approach canal (wet-span scan per x station, rows offset ±7 m); WET
   SHORE BAND in TerrainMaterial (albedo ×~0.65 + roughness 0.38 within
   0.6 m of the waterline, masked to plain/harbor/river — first version
   at ×0.55/0.85 read as coal, softened). Counters: veg.reeds, veg.trees.
   Earlier: quay/piers/vessels (Vessels.ts). Vessel bobbing → Phase 6.
2. Phase-5 polish queue: tuft thin-blade aliasing beyond ~120 m (LAAS-style
   card/far-tuft LOD); water sun-glint verify at low sun + wet shoreline
   band; palm crown fullness (2 blade layers per frond); carpet visible
   under sparse-fade transition could use dithering.
2. Phase 6 — worker town DETAIL PASS (v2, 2026-07-22): gallery blocks
   got street porticos on wooden posts, a REAL doorway per gallery
   (wall segments + lintels, ajar door leaves), per-gallery roof strips
   w/ tone+height jitter (v1 monolithic roof read as a parking garage),
   protruding beam ends, parapets, rear vents, jar rows; east town:
   varied heights, doorway insets (dark slab 6 cm proud of the face),
   roof stairs, parapets, rooftop jars, courtyard L-walls; bakeries:
   soot caps + vats; NEW Royal Administrative Building w/ 6 beehive
   silos (3 shrinking octagonal tiers = crossed boxes at 45°); animal
   pens + woodpiles; Wall of the Crow gate reveals. Mudbrick material:
   courses 0.30 m × bricks 0.45 m (limestoneMaterial gained a blockW
   param; 1.15 ashlar grid read as blank concrete), base lifted to
   [0.6,0.48,0.35] (shaded sides crushed to black at 0.55/0.44). Tone
   language: 0.28 wood, 0.1 openings, ~0.74 silo plaster, 0.2 soot.
   KNOWN ARTIFACT (pre-existing, queued): pale angular shards in the
   sky at some angles = cloud impostor artifact (visible in fix-decks
   too), NOT debris.
   Phase 6 originally:
   (src/monuments/WorkerTown.ts — Wall of the Crow w/ great gate + lintel,
   4 gallery blocks w/ ~17 partitions each + roof slabs, eastern town
   jittered-grid rooms, bakery rows w/ hearths, enclosure; mudbrick =
   limestoneMaterial [0.55,0.44,0.31] courseH 0.32; town-local frame
   yaw −0.14, whole town one editable placement 'worker-town'; per-block
   footprints — aggregate fp y-bounds MUST come from sampled terrain, a
   guessed −46..−40 false-positived the buried check). **Debris fields**
   (src/world/Debris.ts — 84k instanced chips/rubble, 2 size classes,
   anchor-weighted gaussian clusters at quarry faces/ramp/masons' yards/
   town lanes, grounded, only big rubble casts shadows). GeoWriter +
   limestoneMaterial now EXPORTED from KhufuComplex for reuse.
   MOTION PASS DONE (2026-07-23): shared world-time uniform
   (src/render/WorldClock.ts, set in the water tick); vessel bobbing via
   per-vertex bobA/bobB attributes stamped by bobScope() around each hull
   build (heave + directional tilt about the hull center; beached/seated
   hulls carry ZERO amplitude — they must not rock on land); vegetation
   wind sway (palms 0.22 crown shear, papyrus 0.13 / reed 0.16 /
   tamarisk 0.06 / sycamore 0.025) as height-squared downwind shear with
   position-hashed gusty phase. VERIFIED by two-phase screenshots
   (settle 24 vs 100): hull heave/tilt visible, palm crowns bend, trunk
   bases still. LESSON: bobScope consumes rng draws BEFORE loftHull →
   the whole harbor RE-LAID OUT (collision gate caught a barge inside
   the quay mole + a "beached" skiff seated on the approach-canal bed
   5 m under water). Fixes: moored hulls clamped seaward of the quay
   edge + half-hull margin; beached skiffs resample z outside the
   harbor/canal latitudes (−430..180).
   PHASE 6 CLOSED (2026-07-23): WorkParticles (src/world/Particles.ts) —
   131,072 world-anchored particles (>=100k floor MET): quarry/ramp/yard
   DUST + bakery/town hearth SMOKE columns; procedural life-loops in the
   vertex stage off the shared world clock (NO compute pass), billboards
   via 2 camera-basis uniforms, lit standard material, alpha dust 0.085
   (0.14 fogged the quarry bowl) / smoke 0.24. Quarry dressing: 34
   abandoned blocks + 12 wedge-socket rows (Debris.ts). Tuft sway wired
   to the clock. REMAINING for later passes: Froxels dust volumetrics,
   cloud-impostor shard artifact, inhabited tests vs reference (D-1).

3b. PHASE 7 CORE (2026-07-23): Bookmarks 1-9 + F flythrough
   (src/debug/Bookmarks.ts — curated poses from verified framings,
   closed Catmull-Rom tour, ?bm=N for tooling; smoke test
   tools/test-bookmarks.ts PASSES). TWO-FRAME TEST captured at 1080p:
   shots/final/dawn-from-harbor.png (T 6.4 across the basin: pyramid trio
   warm-lit, palms, causeway+VT; water sun-glint still queued) and
   shots/final/noon-on-plateau.png (casing blazing vs zenith blue).
   PERF PROTOCOL: 37 fps @2560x1440, 25.9M tris, 147 draws on the
   RTX 3050 Laptop 4GB (BELOW the 3060 target class -> extrapolates
   ~60fps on target hardware). Full perf pass (depth prepass, GPU
   culling, iGPU 30fps) remains open. Quarry/sand still reads near-white at midday —
   DELTA color-script item (needs D-1 reference frames).
3. **DELTA loop under the GI light** (escarpment definition, exposure/
   contrast, quarry benches, casing golden-hour hero) — needs /reference
   frames from the human (D-1); ask again, or run vs written criteria.
4. Bookmarks (1-9) + walk-mode port (LAAS FlyCamera walk rig) + gallery.
5. Sand-transport re-run with monument obstacle masks (drifts vs walls).
6. GI polish queue: probe chroma could go further (shaded-wall sat 0.10 —
   warm hue correct, push saturation via bounce weight/probe albedo);
   mortuary-temple interior court gets no probe line-of-sight nuance
   (probes are terrain-relative — acceptable at massing stage).
7. Camera yaw for shots: yaw = atan2(−dx, −dz).
8. VALIDATE FOOTPRINT OVERLAPS on any placement change: the first queens
   row (z −18/34/86) ran the mortuary temple's SE corner THROUGH G1-a,
   and the south temenos wall (z≈135) through satellite G1-d. Fixed:
   queens z 52/104/156 (row starts south of the temple, per the published
   plan), G1-d z 151 (outside the enclosure), temenos east-wall gate now
   exactly the temple front width (a wider gap floated the temple lintel
   over open air). qPad terrace in GizaControl moved with the row
   (center z 104). Check axis-aligned extents on paper BEFORE building.
9. Afloat hulls need exaggerated freeboard (barge 1.2, traveler 1.15,
   skiff 0.5): the silty water surface is opaque, a survey-accurate laden
   trim reads as a swamped boat.
10. GROUND EVERYTHING: any structure off the leveled G1 court placed at a
   fixed Y will float over dips and bury on rises (user screenshots:
   floating mastaba rows, causeway daylight gaps, half-buried beached
   skiffs). Rule: seat via hf.heightAtCpu — mastabas on the LOWEST
   footprint corner −0.5 m, causeway pedestal to min(4 samples) −2 m,
   harbor works probe their own shoreline (shoreX: first x with enough
   depth), afloat hulls fall back to keel-on-bed when the spot is too
   shallow (floatY). Boat deck strips: winding faced DOWN → culled → the
   water plane showed INSIDE open hulls ("swamped boats") — same class as
   the carpet-winding bug; deck order is (prev.gl, prev.gr, cur.gr, cur.gl).

## DONE this session (2026-07-19) — placement tooling

- **Footprint registry + collision audit + Inspector** (src/debug/
  Footprints.ts, CollisionAudit.ts, Inspector.ts, EditOverrides.ts):
  every structure registers a logical OBB footprint (family, ground
  policy, allow-list); runCollisionAudit() detects overlap / float /
  buried / stranded-hull; runs at boot (console + counters), is a GATE
  in tools/audit.ts (collisionTest boots the world headless), and drives
  a red/yellow box overlay (?debug=collisions).
- **Inspector (Unity-lite)**: E or ?edit=1 → click-select via ray-AABB,
  arrows move ±1 m (Shift ×5, Alt ×0.2), R reset, X export patch,
  Esc deselect. Edits are DELTAS over canon placements (edPos() consulted
  by builders), live rebuild of pyramids+complex+harbor in ~200 ms
  (structures Group disposed + rebuilt), audit re-runs after every move.
  Deltas persist in localStorage; export patch → apply to CODE (fixed-
  layout pillar: the scene is never the source of truth). Harness hooks:
  __akhet.collisionAudit / editNudge / editExport; tools/test-inspector.ts
  is the smoke test (provoke overlap → detect → reset → clean).
- **First catches by the validator** (previously unknown defects): the
  causeway ran THROUGH the eastern mastaba field (7 overlaps) and dove
  under the escarpment crest at x 320-380 (roof buried 2.6 m); beached
  skiffs at fixed x sat on the river bottom under 8 m of water where the
  channel meanders. Fixed: causeway grade lifts over terrain (smoothed
  per-segment ys[], walls sealed by local rise), eastern mastabas skip
  plots within 28 m of the causeway line, beached skiffs walk the
  floodplain east to the actual shoreline for their z.

## DONE this session (2026-07-18) — part 2: Phase 5 core

- **NileWater** (src/water/NileWater.ts): flow-advected two-scale ripple
  normals (northward drift, harbor slower), TRUE sky reflection via
  atmosphere.skyColor(reflect) with fresnel on a FLATTENED normal (LAAS
  white-sheet lesson), depth absorption over the real sampled bed
  (silty shallows → deep blue-green), freeze-safe worldTime advection.
- **Palms** (src/vegetation/Palms.ts): 5,400 procedural date palms, 8
  variants (trunk curve/rings, 15-22 fronds, crown-asymmetry bias), banks/
  harbor/canal-hugging gaussian groves; PER-VARIANT BUFFER SLICES
  (instanceIndex restarts per InstancedMesh — a shared buffer renders all
  variants at the same positions!); per-instance yaw/scale/growth-lean
  (height-shear)/tone.
- **Fields** (src/vegetation/Fields.ts): 537 parcels in two bank belts
  (worksZone-gated), 750k instanced 5-blade tufts in sown rows w/
  per-parcel maturity tone (late-peret green-gold) + 12% fallow; CONFORMAL
  parcel carpets (per-vertex terrain height +12 cm — flat quads buried
  under ±0.35 m micro-relief) for the closed-canopy far read.
  BUG LOG: carpet quads first wound DOWNWARD (backface-culled from every
  view — "invisible carpet"); winding is (a,c,b),(a,d,c) for +Y.
- Perf with everything: 45-56 fps at 1080p, ~14.5M tris in veg-heavy
  frames. Tuft blades alias out beyond ~120 m (queued card LOD).

## DONE this session (2026-07-18) — part 1

- **ProbeGI ported + Giza-adapted** (src/gpu/passes/ProbeGI.ts): 256²×6
  terrain-relative SH-L1 probes, heightfield march, GIZA ALBEDO PROXY
  (sand/limestone/silt/quarry from masks), and an ANALYTIC RAY-PYRAMID
  INTERSECTOR in the gather — the casing is a bounce/occlusion source
  (canon Vol. V "primary lighting reference object" made literal); the
  pyramid also blocks sun on bounce sources (its shadow darkens probes).
  Wired via IrradianceNode setupLightMap into terrain tiles, casing
  (lift 2.5), far pyramids, complex; hemisphere dimmed 0.15×; SS bounce
  0.16→0.3; gi.invalidate() on ToD jumps. VERIFIED: shaded wall pixels
  rgb(68,71,74) → rgb(101,96,91) (cool dead gray → warm, +40% value);
  67 fps with probe tick.
- **Block-course meso detail** on all complex massing (limestoneMaterial):
  world-Y courses ~0.55 m, per-course joint jitter, per-block tone hash,
  joint darkening + normal dip, upright-gated (slab tops stay clean).
  Walls now read as coursed masonry at 3-40 m.
