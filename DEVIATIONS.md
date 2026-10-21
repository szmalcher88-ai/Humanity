# DEVIATIONS — interpretive and scholarly choices (brief mandate)

Every entry: the interpretation chosen, alternatives, confidence (A–E per
canon Vol. II), and where it lives in code.

---

## D-1 — Reference frames missing at project start
**Status:** OPEN — human input needed.
The brief says reference images live in `/reference` (provided by the human).
The directory was empty at project start. The reference-delta loop will run
against (a) written reference criteria distilled from the brief and canon,
and (b) any frames the human drops into `/reference/` later. Stand-in frames,
if generated, go to `/reference/generated/` and are clearly labeled — never
treated as ground truth for historical detail.
**Confidence:** n/a (process deviation).

## D-2 — Canonical day = spring equinox (day 79)
**Chosen:** the fixed epoch renders at the spring equinox: sun rises due east
(cleanest cardinal-alignment shadow audit), noon altitude ≈ 60°, and the
agricultural belt is at late-peret maturity (green-gold fields, non-flood
river stage) consistent with canon's growing season.
**Alternatives:** summer solstice (flood season — would flood the plain and
weaken the field-geometry floor); mid-November (early growth, low sun).
**Confidence:** D (project choice inside canon's seasonal model).
**Code:** `src/world/CANON_DIMENSIONS.ts` CANONICAL_DAY_OF_YEAR.

## D-3 — Temenos wall height 8 m
**Chosen:** 8 m enclosure wall around the pyramid court.
**Alternatives:** footings only survive; published reconstructions range
~6–10 m.
**Confidence:** D.
**Code:** CANON_DIMENSIONS.G1_TEMENOS_HEIGHT.

## D-4 — Causeway: straight, roofed, azimuth 8° north of east
**Chosen:** single straight, walled AND roofed causeway (slit-lit interior
per Herodotus' description and decorated-block evidence), 825 m, bearing 8°
N of E toward the valley temple under Nazlet el-Samman.
**Alternatives:** open-topped corridor; documented slight bend near the
escarpment lip (simplified straight — the bend's exact geometry is
unpublished).
**Confidence:** C (roofing), D (exact bearing/bend).
**Code:** CANON_DIMENSIONS G1_CAUSEWAY_*.

## D-5 — Queens' pyramids: uniform 46 m base pending per-monument sources
**Chosen:** G1-a/b/c at 46.0 m base, 51.75° slope, individualized only by
per-instance masonry variation.
**Alternatives:** published per-pyramid values vary 44–49 m across sources;
adopting one source's triple is deferred until the values can be verified.
**Confidence:** C.
**Code:** CANON_DIMENSIONS.QUEENS_BASE_SIDE.

## D-6 — Worker town at Khufu-era extent
**Chosen:** Heit el-Ghurab is reconstructed as an active, planned settlement
at the epoch of the newly completed pyramid. The excavated gallery phases
date mainly to Khafre/Menkaure; we render a Khufu-era extent (smaller gallery
blocks + bakeries + enclosures) at the documented location.
**Confidence:** D.
**Code:** `src/monuments/WorkerTown.ts` (galleries, eastern town, bakeries, RAB, Wall of
the Crow), on the terraces of `WORKER_TOWN_PADS` in `CANON_DIMENSIONS.ts`.

## D-7 — Remnant construction ramp
**Chosen (Phase 3/6):** partially dismantled ramp remnants against the SOUTH
face, spiraling/zoned per the quarry-to-monument logistics (quarry lies S–SSE)
— consistent with Lehner's south-approach ramp reasoning. No intact full-height
ramp: the monument is complete; only staged dismantling debris remains.
**Alternatives:** straight east ramp; internal ramp (Houdin) — rejected as
speculative for surface rendering.
**Confidence:** D.
**Code:** PARTIAL — the one standing construction ramp is the rubble-and-brick ramp at
the mortuary temple's SE corner (`src/monuments/Inhabitants.ts`). The south-face
remnants this entry chooses are NOT built yet (v1.2 roadmap).

## D-8 — three.js pinned at 0.184.0
The brief says "three.js (current)". LAAS's THREE-NOTES.md verifies the TSL/
WebGPU API surface against 0.184.0 exactly; that verification outweighs a
minor version bump. Revisit only for a blocking bug.
**Confidence:** n/a (engineering).

## D-9 — Pyramidion
**Chosen (Phase 3):** the apex is finished with the same casing course logic,
without a distinct pyramidion block. No pyramidion survives for G1 and the
sources disagree on whether it was gilded, hard stone, or plain Tura; putting
a gold cap on the hero silhouette would be the single most visible unsourced
claim in the build.
**Alternatives:** granite/basalt pyramidion; electrum-sheathed cap.
**Confidence:** C (absence of evidence, not evidence of absence).

## D-10 — Moon ephemeris
**Chosen (Phase 7 night rig):** the moon's position is NOT computed from an
ephemeris. Its hour angle is offset from the sun's by a fixed 137° with a +12°
declination — a waxing gibbous standing high in the south-east at dusk — and
its disc is drawn ~2.2× oversize (the same convention already used for the sun
disc; at true 0.26° it reads as a lens artefact in a 55° frame).
**Why:** the canonical day is an equinox (D-2) and no canon source fixes a
lunar date, so any specific phase is a choice. This one lights the plateau's
east faces and puts the moon where a night frame wants it.
**Confidence:** n/a (art direction, declared).
**Code:** `src/sky/NightSky.ts`.

## D-11 — Moonlight intensity
**Chosen (Phase 7):** moonlight is rendered at ~1.6% of noon sun, not the
physical ~1/400,000. At the true ratio the auto-exposure (gain capped at 4×,
deliberately, so a shadowed interior stays a dark frame) can only deliver mud.
The colour script's night keyframe assumes a readable moonlit blue silhouette.
**Confidence:** n/a (cinematic convention, declared).

## D-12 — Terrain albedo calibration
**Chosen (Phase 7 DELTA):** terrain albedos are set to PHYSICAL reflectances
(dry desert sand 0.35-0.45, weathered limestone 0.30-0.50, fresh-cut Tura
0.55-0.60) rather than to the brighter studio values used through Phases 1-6.
The figures are LUMINANCE (Rec. 709 weights), not per channel: the sand pair
`SAND_WARM`/`SAND_LIGHT` sits at 0.40/0.46 — the light tone is the brightest
dune crest and runs 0.01 over the range by design.
**Why:** measured, the old values put sunlit sand at luminance 194.9 against
the casing's 198.1 — the monument and its ground were the same tone.
**Confidence:** B (published reflectance ranges for the materials).
**Code:** `src/render/TerrainMaterial.ts`.

## D-13 — Night lighting on posts
**Chosen (Phase 7 night rig, declared v1.1):** fire bowls raised on wooden posts
along the gallery street, at the Wall of the Crow gate and at the quay head.
**Why:** a night frame needs a few readable light sources at eye height; the
canon names only "torch lighting", and Old Kingdom evidence is for hand-held
torches, hearths and small oil lamps — not for fixed street lighting. The posts
are a cinematic convention, flagged by the v1.1 canon audit, kept and declared.
**Alternatives:** torches held by figures; hearths and braziers on the ground.
**Confidence:** n/a (art direction, declared).
**Code:** `src/monuments/Torches.ts`.

## D-14 — Harbour quay and piers vs. canon Vol IX
**Conflict:** the brief §2 requires "harbor basin with stone docks and wooden
piers (individual piles)"; canon Vol IX §9.12 (added 2026-10-20) says the
agent "must not automatically generate a long continuous stone quay or forest
of timber piers simply because these features are familiar from later
harbors", and that the Fourth Dynasty harbour plan is incompletely established.
**Chosen:** the brief wins on scope (docks and piers stay); the canon governs
their form. Currently built: one 180 m continuous stone quay and three timber
piers — closer to the later-harbour cliché than Vol IX allows. To be reworked
in roadmap I6 into shorter stone landing surfaces, earthen embankments, timber
ramps and cargo yards, each tagged with a confidence level.
**Alternatives:** keep the continuous quay (rejected by Vol IX); drop the piers
(rejected by the brief floor).
**Confidence:** D (reasoned reconstruction; the plan is not excavated).
**Code:** `src/water/Vessels.ts` (quay and piers in `buildHarbor`).

## D-15 — Irrigation of the west-bank belt in the low-water season
**Conflict:** the brief §2 asks for "irrigation basins and canals obeying
gravity (canon: no decorative water)"; the epoch (D-2) is the spring
equinox, the river at its low stage 2 m below the plain. Basin irrigation
filled the basins from the flood (Akhet); the Old Kingdom basin and canal
layout at Giza is not excavated.
**Chosen:** three main canals cut east–west from the river into the plain
(fixed works, like the harbour approach), their beds 1.1 m below the low
river so they hold its water — still, at the river's own level, nothing
uphill. The basins between the transverse dykes are DRY (drained since the
flood, harvest beginning); their intakes are shut with earth plugs. Water for
orchards and gardens is lifted from the canals by hand, in jars on a yoke —
the shaduf is a New Kingdom device and is not shown. Stone-faced regulators
stand open (stop-planks stacked on the bank). Canal positions follow the
parcel plan's row gaps for the default seed.
**Alternatives:** flooded basins (wrong season, D-2); field ditches with water
at plain level (water uphill — banned by the brief); a shaduf at each canal
(anachronism).
**Confidence:** D (layout reasoned; the practice — basin irrigation, hand
watering of gardens — is attested in Old Kingdom tomb scenes).
**Code:** `src/world/Irrigation.ts` (layout), `src/world/GizaControl.ts`
(the cut), `src/water/NileWater.ts` (canal water), `src/vegetation/Basins.ts`
(earthworks), `src/vegetation/Orchards.ts`.
