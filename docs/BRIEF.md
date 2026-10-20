<!--
Restored verbatim on 2026-10-20 from the first message of the first build
session (Claude Code, 2026-07-10 21:38 UTC) — the brief had never been saved
to the repo. Amendments since then live in STATUS.md, not here: the human
amended the closing hard rule on 2026-10-20 (read-only Haiku sub-agents may
do QA and reconnaissance; all code stays with the main agent). Canon Vols
VII-IX were added to /canon on the same day.
-->

# PROJECT AKHET — v1
### Fully procedural reconstruction of the Giza Plateau, c. 2550 BCE, in the browser — WebGPU
*(akhet — Egyptian: "horizon"; Akhet Khufu — "Horizon of Khufu", the ancient name of the Great Pyramid)*

---

## What this document is

This is the operative brief. It follows the methodology of PROJECT LAAS (Braffolk/fable5-world-demo): the human sets the bar, the floors, and the banned outcomes; the model plans and executes everything else across long autonomous sessions, builds its own verification harness, and maintains its own durable memory in `STATUS.md`.

**Document precedence:** this brief > `/canon` > model judgment. The `/canon` directory contains the "Ancient Egypt Master Prompt Bible" volumes — the content canon: what exists on the plateau, where, and why. Canon governs historical content *within the scope this brief defines*. Canon does NOT govern scope: it describes the full world; this brief defines the Tier 1 subset. Where canon and brief conflict, brief wins. Where canon is silent, published archaeology wins. Record every scholarly choice in `DEVIATIONS.md` with a confidence level.

**Required reading before any code:** (1) this brief, (2) `/canon` volumes in order, (3) the LAAS repository in `/reference-repos/fable5-world-demo` — especially `docs/THREE-NOTES.md` (verified three.js/TSL/WebGPU API notes), `STATUS.md` (how another instance of you ran this methodology), and `tools/` (the verification harness pattern). LAAS is MIT-licensed: engine-level systems (atmosphere LUTs, CSM/PCSS, TAA, GTAO, HUD, Playwright harness, meshlet culling) may be studied and ported with attribution in `LICENSE-THIRD-PARTY`. World generation, materials, and all content must be new — this is a different world.

---

## The bar

The visual target is **current-generation cinematic reconstruction footage** — the class of image produced by high-end documentary CGI and AAA historical open worlds. Reference frames live in `/reference` (provided by the human: plateau geology and light, limestone surfaces, Nile valley, reconstruction artwork of the completed complex). Every phase is judged **against those images**, not against "pretty good for a browser."

You will not fully reach them. That is expected. Close as much of the gap as WebGPU allows, and know precisely how far you got. A result that reads as a 2010 tech demo — a smooth textured cone on a flat sand plane under a skybox — is a **failed task**, no matter how clean the code.

**Reference-delta loop (mandatory, every phase):** render the closest matching shot, place it side-by-side with the relevant reference, write `DELTA.md`: the ten most visually significant differences, ranked by impact. Fix the top three. Re-render. Only then does the phase close.

**The second bar — truth.** This is a reconstruction, not a fantasy. Survey-grade dimensions, true cardinal alignment, archaeological plausibility (canon Vol. V: precision, organization, mathematics, logistics — never mystery). An image that is beautiful but wrong fails exactly like an image that is accurate but ugly.

---

## The six pillars

Every requirement serves one of these. If a decision arises that this document doesn't cover, resolve it in favor of the pillar.

**A. Geometry, not textures.** The pyramid is built of *blocks*, not of a surface. Core masonry shows individual courses at every relevant distance; casing shows joints and hand-finished planarity up close. Mudbrick walls show real courses within 20 m. The causeway is paved with individual slabs. Within 10 m of the camera, bare ground texture may occupy no meaningful screen area — desert floor is stones, ripple geometry, chips and debris; paving is slabs; fields are plants.

**B. Light transport.** The Egyptian sun is the protagonist. No black shadows, ever: shadowed limestone reads blue from skylight; shade under awnings and colonnades is filled with warm bounce off stone and sand. The polished Tura casing is the brightest object in the world and visibly influences the illumination around it (canon Vol. V: the pyramid is the primary lighting reference object of the plateau). Sample any shadowed-stone pixel — if it is desaturated gray, lighting has failed.

**C. Inhabited, not populated.** Tier 1 has no NPCs — but an empty world that reads abandoned is a failure. Every district shows evidence of ten minutes ago: smoke from bakery chimneys, moored and loaded boats shifting on the water, drying linen, stacked offering jars, fresh sled tracks, wet quarry cuts, tool racks, half-dressed blocks with chips around them, foot-polished thresholds. Canon's environmental storytelling sections are the checklist. The player should keep expecting to meet someone around the next corner.

**D. Distance holds — and teaches scale.** The Great Pyramid must dominate from 10 km exactly as canon Vol. IV's visibility hierarchy specifies. Heat haze and dust attenuate but never hide. The green geometry of the floodplain against the desert edge is a hard visual boundary, not a gradient. Distant Cairo-less horizon: desert, escarpment, river. A human-height camera against the 146 m monument must produce the documented vertigo — protect the canon view corridors (harbor→pyramid, floodplain→plateau, causeway→mortuary temple).

**E. Art direction.** A color script exists and is enforced: dawn (cool sand, casing catching first fire), noon (brutal high-contrast, near-white limestone, dense blue sky), golden hour (warm stone against long violet shadows), night (moonlit silhouette, no artificial lighting beyond fire). Value structure per canon: dark foreground frame, lit midground subject, luminous atmospheric background. Showcase viewpoints are composed, not found.

**F. The world moves.** Heat shimmer above stone at noon. Wind-driven sand streamers off ridge lines and ramp edges. Dust from work areas. Palm fronds and field crops in hierarchical wind. The Nile flows; the harbor water reacts to hulls and pilings; irrigation channels run. Smoke columns bend with the wind. Banners and awnings ripple. A frozen frame should feel one second away from motion.

---

## Operating instructions

- Build, don't describe. No plan-approval round-trips inside a phase. Long autonomous stretches.
- Between two approaches, build the more ambitious one.
- Expect **20,000+ LOC** across real modules (`src/gpu/`, `src/world/`, `src/monuments/`, `src/settlement/`, `src/vegetation/`, `src/water/`, `src/render/`, `src/sky/`, `src/debug/`). One giant file = fail.
- No stubs. A `// TODO` in a closed phase fails the phase.
- Never ask the user to reduce scope. Infeasible floor → nearest feasible alternative + entry in `DEVIATIONS.md`.
- Under-rendering is a failure mode: hero shots below the triangle floors mean you are underspending the GPU.
- `STATUS.md` is your durable memory between sessions: current state, measurements, diagnosis logs, decision history. Update it before every session end.
- All load-bearing dimensions go into `src/world/CANON_DIMENSIONS.ts` with source citations, consumed by both the geometry and the audit tests — one source of truth, machine-checked.

## 1. Fixed constraints

| Constraint | Value |
| --- | --- |
| Language | TypeScript, `strict: true`, zero `any` |
| Build | Vite |
| Renderer | three.js (current) **WebGPURenderer + TSL**; raw WGSL compute wherever TSL limits you |
| Fallback | None. No WebGL path. Fail loudly with diagnostics. |
| Assets | **Zero external assets.** Every mesh, texture, LUT, impostor atlas, noise volume: generated by code. |
| Determinism | The world is *fixed*, not seeded: one canonical historical layout. `?seed=N` controls micro-variation only (block jitter, scatter, vegetation individuality). `?T=hours` sets time of day. |
| Epoch | Tier 1 renders one state: **the pyramid newly completed**, construction infrastructure partially present (canon Vol. V preferred state). `?epoch=` presets are Tier 3. |
| Orientation | True cardinal alignment, machine-verified. No artistic rotation (canon Vol. V). |

## 2. Floors — these numbers define the era

| Dimension | Floor |
| --- | --- |
| World | ≥ 4 × 4 km streamed: plateau, desert edge, worker city, quarries, floodplain strip, Nile corridor with harbor basin |
| Terrain | ≥ 4096² heightfield: **authored control map** (documented plateau topography: escarpment, wadis, elevated bedrock under both pyramid sites, quarry depressions) + procedural geology detail (limestone shelving, strata, erosion channels per canon Vol. IV). Wind-driven sand transport/accumulation pass: drifts against every windward wall base. |
| Great Pyramid | Survey dimensions from published sources (base ≈ 230.3 m, original height ≈ 146.6 m, slope ≈ 51°50′ — verify against canon and surveys, cite in `CANON_DIMENSIONS.ts`). **Procedural block system** (canon Vol. V): courses with realistic dimensional variation; individually meshed core blocks within 150 m; casing with visible joints and hand-finishing planarity variation within 30 m; LOD chain preserving exact silhouette to 10 km+. No single-mesh pyramid at any LOD above the far silhouette. |
| Khufu complex | Mortuary temple, valley temple, causeway (walled, roofed per chosen interpretation), 3 queens' pyramids + chapels, satellite pyramid, boat pits with limestone covers, eastern & western mastaba fields with individual mastabas (massing + dressing, not clones). Sacred-axis walk harbor→pyramid must be continuous and gated per canon Vol. VI hierarchy. |
| Rendered triangles | ≥ 5M per frame in complex/settlement hero shots, ≥ 3M in vistas (post-culling, HUD-verified). Ceiling: whatever holds 60 fps. |
| Settlement | Worker city + industrial zone as full exterior massing: streets, courtyards, ovens, granaries per canon Vol. IV District 6–7; near-camera walls show mudbrick courses; ≥ 3 roof states, ≥ 4 wall-age states, per-building variation law. Interiors: Tier 3. |
| Harbor & Nile | Harbor basin with stone docks and wooden piers (individual piles), ≥ 12 vessel classes/variants procedurally built (cargo, ferry, papyrus skiff) — moored, anchored, beached; Nile flowing with current direction; irrigation basins and canals obeying gravity (canon: no decorative water). |
| Vegetation | Date palms with per-instance uniqueness (growth seed: lean, crown asymmetry, frond count) ≥ 5k in floodplain; emmer/barley fields as instanced blade/stalk geometry ≥ 500k visible; sycamores, tamarisk, reeds/papyrus beds along water ≥ 3 classes; field geometry follows canon's agricultural belt. |
| Ground debris | ≥ 80k visible near-field instances in worked areas: stone chips (fresh, angular, concentrated at dressing sites), sand ripple geometry, pottery sherds, mudbrick fragments, rope coils, timber offcuts, sled tracks as displaced geometry. |
| Construction context | Remnant ramp(s) per chosen hypothesis (document in `DEVIATIONS.md`), stone stockpiles staged by size, staging yards, scaffolding where justified — canon Vol. V construction-context list, epoch-consistent. |
| GI | Irradiance probe field (terrain-relative), GTAO, screen-space bounce (sand and limestone bounce is the look of Egypt), no-black-shadows law machine-enforced. |
| Shadows | 4 CSM cascades (≥ 2048², texel-snapped) + PCSS + screen-space contact shadows — every block, brick, and pebble grounded. |
| Atmosphere | Hillaire-style LUT atmosphere; altitude/dust-dependent haze with distinct desert vs. river-valley profiles; heat-shimmer near-surface refraction pass at high sun. |
| Clouds | Sparse fair-weather cumulus + high cirrus (raymarched, temporally accumulated), cloud shadows crossing the plateau. Egyptian sky is mostly clear — clouds are seasoning, not cover. |
| Water | Nile: flowing surface, depth absorption, sediment tint, shore wetting. Harbor: SSR or planar reflections, hull/piling interaction foam, wakes on moored motion. Channels: shallow flow over visible bed geometry. |
| Particles | GPU particles ≥ 100k budget: wind-blown sand (density tied to wind field and surface type), work-site dust, smoke columns, chaff over threshing floors, birds as distant flocking sprites over the river. |
| Visible range | ≥ 8 km to serve the canon visibility hierarchy; far-detail synthesis keeps the escarpment and monuments crisp at range — never fog cutouts. |
| Draw-in | No visible pop within 300 m; transitions dithered. |

## 3. GPU systems — enumerated passes

1. Heightfield: authored control map + domain-warped geological detail (limestone shelving, strata)
2. Wind-driven sand transport & accumulation (drift against obstacles, ripple field orientation from wind)
3. Moisture/fertility field from river distance & elevation → floodplain/desert boundary, vegetation density
4. Quarry-cut carving pass (terraced extraction faces, block-scaled steps per canon Vol. IV District 8)
5. Procedural block generation for all masonry: course solver → per-block dimension/tone/finish variation → instance buffers on GPU (canon Vol. V block metadata: source, finish, layer)
6. Mudbrick settlement generator: street/plot layout from canon district plans → building massing → course/plaster/age detail
7. Scatter placement: per-class density functions (district, surface, distance-to-water/work) × clustered Poisson; instance buffers on GPU
8. Meshlet/cluster culling: frustum + Hi-Z occlusion per ~64-tri cluster → compacted indirect draws
9. Procedural texture synthesis (≥ 2048² + mips): Tura limestone, local limestone, granite, mudbrick, plaster, sand, silt, timber, reed — each with macro variation layer (tiling invisible), cavity dirt, moisture response
10. Irradiance probe updates (time-sliced, per-chunk)
11. Volumetric clouds + cloud-shadow projection; dust/haze froxel volumetrics (valley haze, work-site dust plumes)
12. Wind field (global + gust noise) sampled by vegetation, particles, smoke, banners, water
13. GPU particles (sand/dust/smoke/chaff) with wind advection
14. Heat-shimmer refraction pass (surface-temperature-driven, high-sun only)

## 4. Surface, asset & accuracy law

- **Macro–meso–micro rule:** every material shows detail at three frequency bands — silhouette geometry, meso displacement (~2–20 cm: block joints, brick courses, tool marks), micro normal/roughness variance. Single-noise albedo is banned.
- **Per-instance variation law:** every block, brick, palm, boat, jar gets dimension/tone/age jitter; a fraction of every population is worn, repaired, broken, or fresh. Uniformity reads as 2010.
- **Dressing rules (Pillar C), enforced per district:** work sites → chips, dust, tools, tracks, stockpiles; harbor → cargo, rope, wet stone, gulls; settlement → smoke, ovens, jars, laundry, animal pens; temples → offering equipment, incense braziers, fresh pigment; fields → irrigation moisture gradients, paths, field huts. Canon Vols. IV & VI dressing lists are normative.
- **Accuracy law:** no pseudo-archaeology, no fictional mechanisms, no anachronisms (canon Vol. V design philosophy). New-monument weathering only: fresh pigment, sharp masonry, clean pavements; dust accumulates, structures do not decay (canon Vol. VI material aging). Every interpretive choice (ramp form, causeway roofing, pyramidion presence, harbor layout) → `DEVIATIONS.md` with the interpretation chosen, alternatives, and confidence.
- **Specimen gallery** (`?scene=gallery`): block types × finishes on pedestals; mudbrick wall section; palm/sycamore/reed × 3 seeds; boat classes; a 2 m² worked-ground square; a dressed casing-corner section. Primary review surface.

## 5. Lighting, camera, post

- HDR, physical units, EV auto-exposure; `?T=hours` — dawn/noon/golden/dusk/night all hold; sun path astronomically plausible for Giza's latitude (cardinal-alignment shadows must behave: casing faces lighting in sequence through the day).
- IBL from LUT sky, refreshed on ToD change; the casing's specular response to the sun is a signature shot — treat it as a feature.
- Post: TAA (required), GTAO, HDR bloom, filmic grade with per-ToD color script, ACES or AgX, restrained vignette/grain; photo-mode DoF.
- **Composition:** ≥ 9 authored bookmarks (`1`–`9`) covering the canon view corridors (harbor→pyramid across water; floodplain→plateau; causeway axis; worker-city street with pyramid looming; quarry face; noon plateau; golden-hour casing; night silhouette; gallery). Cinematic flythrough (`F`) ≥ 90 s: begin over the Nile, cross the harbor, ascend the causeway axis, orbit the summit, end on the desert edge at golden hour.
- Exploration: walk mode (gravity, jump, human eye height 1.7 m — scale is the product), fly mode, `?cam=` pose strings, `?shot=1..9`.

## 6. Performance & instrumentation

- Targets: 60 fps @ 1440p on RTX-3060-class; reduced preset (smaller grids, fewer instances — **not fewer systems**) at 30 fps @ 1080p iGPU.
- HUD (`F3`): fps, frame ms avg/p95, draw calls, triangles rendered (floor-checked), instances per category, cluster cull stats, resident chunks, VRAM estimate, per-pass GPU timings.
- Streaming per canon Vol. IV district model: async residency, priority by camera/destination/occlusion; no main-thread stall > 8 ms (violations logged).
- CPU per-frame per-instance updates: banned. Instance data lives on GPU.

## 7. Verification battery (scripted, Playwright — run at every phase close)

1. **Reference-delta loop** — side-by-sides + `DELTA.md` top-ten + fix top three.
2. **Dimension & alignment audit (programmatic):** monument dimensions vs. `CANON_DIMENSIONS.ts` within tolerance; cardinal alignment via shadow-vector test at solstice/equinox `?T` values.
3. **Silhouette test:** casing faces planar and corners knife-sharp at range; core masonry (where exposed) reads stepped; settlement roofline varied. Smooth low-poly outlines on any hero monument fail.
4. **Shadow-color test:** 16 shadowed-limestone + 16 shadowed-mudbrick pixels; chroma must show sky/bounce tint.
5. **Bare-ground test:** ground-level shots in work site, street, and field; texture-only pixels within 10 m ≈ none.
6. **Scale test:** eye-height frames at documented stations (causeway base, pyramid base, harbor edge) — monument must subtend the vertical FOV consistently with real-world geometry.
7. **Inhabited test:** any random bookmark must contain ≥ 5 distinct evidence-of-life elements (Pillar C) — enumerated by pixel-region annotation in the report.
8. **Repetition flight:** 2 km flight over settlement and mastaba fields; no recognizable clones or placement grids; no pop < 300 m.
9. **Throughput check:** HUD triangle counts vs. §2 floors in hero shots.
10. Contact sheet: the 9 bookmarks + gallery sheet + terrain/quarry split views.

## 8. Phase plan — gated (a phase closes only after: build → run → battery → `DELTA.md` → fix top three → re-shoot → **human review**)

| Phase | Deliverable | Gate |
| --- | --- | --- |
| 0 | Scaffold, WebGPU init + diagnostics, HUD, Playwright harness, reference side-by-side tool, canon ingested, `CANON_DIMENSIONS.ts` drafted | Harness produces comparisons; dimensions table cited |
| 1 | Plateau terrain: authored control + geology, sand transport, quarry carving, desert/floodplain materials | Geology shots; tiling/silhouette checks; floodplain boundary reads |
| 2 | Atmosphere, sun/IBL, shadows (CSM+PCSS+contact), haze/dust volumetrics, clouds, post + color script | Golden-hour vista vs. reference; shadow-color test; heat shimmer at noon |
| 3 | **The Great Pyramid**: block system, casing, survey geometry, LOD chain; satellite & queens' pyramids from the same system | Pyramid hero shots vs. reference; dimension & alignment audit; silhouette test |
| 4 | Khufu complex: temples, causeway, boat pits, mastaba fields, courtyards; sacred-axis walk; dressing per canon Vol. VI | Axis walk harbor-side→pyramid continuous; complex flyover; inhabited test in temple precinct |
| 5 | Nile corridor: river, harbor, vessels, docks; agricultural belt: fields, palms, canals | Harbor dawn shot vs. reference; water tests; vegetation floors |
| 6 | Worker city + industrial zone + quarry dressing + construction context; motion pass (wind, particles, smoke, shimmer) | Street-level shots; inhabited test everywhere; repetition flight |
| 7 | Performance pass, reduced preset, bookmarks + flythrough, final battery | Full battery + final delta loop + **two-frame test** |

## 9. Banned outcomes — instant fail

- The pyramid as a smooth textured cone/box at any LOD above far silhouette; blocks as normal maps.
- Black or gray-ambient shadows; flat-lit colonnades and temple shade.
- Bare sand splat underfoot; streets as textures; fields as green planes.
- Cloned palms/boats/mastabas; placement grids; uniform scatter without clustering.
- Skybox-only sky; billboard sun; distant escarpment as smooth humps or fog cutouts; fog hiding scale.
- Anachronisms and pseudo-archaeology of any kind; decorative fountains; water flowing uphill.
- Broken cardinal alignment; invented dimensions where surveys exist.
- A world that reads abandoned (failing the inhabited test) or a theme park (dressing without logic).
- Single-noise albedo; visible tiling at mid-range; triangle counts under §2 floors in hero shots.
- `MeshBasicMaterial` in the world; CPU per-instance updates; one-file architecture; asking the user to lower the bar.

## 10. Self-score rubric — anchored to references

Per row: 10 = passes a one-second glance against the reference at 1080p; 7 = clearly synthetic but the same class of image; 4 = good hobby demo; 2 = 2010 tech demo. Score after every phase; per row, write "what raises this by 2 points"; implement the two cheapest before proceeding.

Rows: plateau geology · masonry fidelity (casing/core/mudbrick) · monument scale impression · settlement believability · evidence-of-life density · light transport · atmosphere & haze · distance fidelity · water & river life · vegetation & fields · motion · color script & composition · historical plausibility · performance.

## 11. Tier 2 / Tier 3 — only after the battery passes

**Tier 2 (next brief, requires canon Vol. VII):** Khafre complex, the Great Sphinx and enclosure, Menkaure complex, full necropolis.
**Tier 3:** `?epoch=` construction-timeline presets (foundation → mid-build → decades after); NPC population with canon schedules and access levels; pyramid & temple interiors (descending passage, Grand Gallery, King's Chamber); boat-pit educational overlays; metadata/education layer (canon Vol. V metadata fields) with in-world inspection; seasonal Nile flood states; night ceremony lighting.

---

## Final acceptance — the two-frame test

Produce two frames: (1) **dawn from the harbor** — the sun's first light igniting the polished casing above the water, moored vessels in the foreground, the causeway climbing the escarpment, smoke rising from the worker city; and (2) **noon on the plateau** — the complete Khufu complex under brutal vertical light, knife-edged shadows, heat shimmer over the pavement, the green line of the floodplain and the river beyond. Place each beside its reference. If a viewer's eye doesn't snag within one second on a *category* error — flat ground, dead shadows, cloned anything, a cone instead of a monument — the project has done its job. Until then, iterate.

In the end, the human has to be able to freely walk from the harbor to the pyramid at eye height and feel the scale the builders intended. Their feedback is the final requirement, after you are satisfied with the two frames.
One hard rule: Dont use sub-agents
