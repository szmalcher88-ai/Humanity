# PROJECT AKHET — STATUS (source of truth)

> **Rehydration protocol** (for an agent resuming with no context): read this
> file fully, then the brief (the operative spec — binding), then
> `canon/MASTER_PROMPT_BIBLE.md` Vols I–VI, then
> `reference-repos/fable5-world-demo/docs/THREE-NOTES.md` (verified API
> gotchas for the pinned three.js). Never re-plan from scratch; continue from
> "Next actions". Update this file after every meaningful step. Commit per
> milestone. HARD RULE from the human: **no sub-agents** — all work inline.

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
  expected).
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
- [ ] Phase 7 — perf, bookmarks, flythrough, full battery, two-frame test

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
   REMAINING: quarry dressing (drill lines/bench detail), tuft sway,
   Wind/Particles/Froxels ports, smoke, cloud-impostor shard artifact,
   inhabited tests. Quarry/sand still reads near-white at midday —
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
