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
**Note (v1.2 I7):** the court is paved 10.1 m wide (G1_COURT_PAVEMENT_WIDTH)
and the enclosure wall stands a further 10.1 m out — G1_TEMENOS_DISTANCE is
read as court edge → wall, so the wall's centreline is at 135.38 m from the
centre (the constant's label once said "from the pyramid base", which would
put it at 125.28). The boat pits, the mortuary temple, the queens'
clearances and I5's south works are all keyed to that radius; the label was
fixed, the use was not changed.
**Code:** CANON_DIMENSIONS.G1_TEMENOS_HEIGHT.

## D-4 — Causeway: straight, roofed, azimuth 8° north of east
**Chosen:** single straight, walled AND roofed causeway (slit-lit interior
per Herodotus' description and decorated-block evidence), 825 m, bearing 8°
N of E toward the valley temple under Nazlet el-Samman.
**Alternatives:** open-topped corridor; documented slight bend near the
escarpment lip (simplified straight — the bend's exact geometry is
unpublished).
**Confidence:** C (roofing), D (exact bearing/bend).
**Note (v1.2 I7):** 825 m and 8° are the distance and bearing from the
PYRAMID'S CENTRE to the valley temple (the canon placement, C: hypot(817,
115) = 825.05, atan(115/817) = 8.01°). The walled corridor itself runs 632 m
from the mortuary temple's front at 10.5° N of E. A corridor of 825 m would
put the valley temple ~195 m further east (x ≈ 1012) — rejected while the
harbour basin, the approach channel, the fields' keep-out, the I6 landings
and the fleet are keyed to the placement; an owner decision for later.
**Code:** CANON_DIMENSIONS G1_CAUSEWAY_* (the placement); the corridor in
`src/monuments/KhufuComplex.ts` (cwStart/cwEnd).

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
**Chosen (v1.2 I5, variant A):** the remnant of a supply ramp from the quarry
(S–SSE) toward the middle of the south face — Lehner's south-approach
reasoning. The court is finished and walled, so the ramp inside the enclosure
is gone; its body outside the south wall, cut back 8 m from it, is being
dismantled from the quarry end: a cut face showing its fill (limestone chips,
tafl, gypsum debris) and its mud-brick retaining walls in section, an intact
stretch of track with timber cross-sleepers, a stepped working front, the
cleared toe with the wall footings left in the ground; the brick salvaged in
stacks, the fill sorted into heaps and carried back to the quarry's worked-out
bays (Lehner reports the Khufu quarry backfilled with construction debris — C).
The rubble-and-brick ramp at the mortuary temple's SE corner still stands
(re-laid from the south in I5: its foot stood inside G1-a).
**Alternatives:** an unfinished gap in the south temenos wall with the ramp
still reaching the face (rejected: alters the finished enclosure, D-3);
straight east ramp; internal ramp (Houdin) — rejected as speculative for
surface rendering.
**Confidence:** D.
**Code:** `src/monuments/SouthWorks.ts` (the remnant), `src/monuments/Inhabitants.ts`
(the SE-corner ramp and falsework).

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

## D-14 — The harbour's west shore vs. canon Vol IX
**Conflict:** the brief §2 requires "harbor basin with stone docks and wooden
piers (individual piles)"; canon Vol IX §9.12 says the agent "must not
automatically generate a long continuous stone quay or forest of timber
piers simply because these features are familiar from later harbors", and
that the Fourth Dynasty harbour plan is incompletely established.
**Chosen (v1.2 I6):** no continuous quay. The v1.2 quay — one 180 m stone box
— turned out to be a mole closing a lagoon (the bank curves; mid-run it stood
35–45 m off the land, measured). The west shore is now the dredged earthen
bank, rammed, staked, wet at the waterline, with two short stone landings at
the deep-water line — a ROYAL landing on the valley temple's axis (the royal
barque lies at it) and a CARGO landing with a timber stage (the harbour
shuttle lies alongside) — two plank ramps with skiffs, a cargo yard with bays
by material and an administrative shelter with scribes; the three pile piers
are kept for the brief floor, tagged E.
**Alternatives (§9.13 — documented, not yet selectable; the switch belongs to
the Tier 3 epoch/evidence work):** the v1.2 continuous quay/mole (E); an
all-earth shore without stone (C/D); unloading by slipway and sledge (built,
the Tura barge) vs. straight from the bank over planks (built, at the ramps).
**Confidence:** D overall; per piece in `src/water/HarbourEvidence.ts` (D-18).
**Code:** `src/water/Vessels.ts` (west shore, piers, fleet), `src/monuments/HarborDistrict.ts`
(cargo yard, administrative shelter).

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

## D-16 — The mastaba fields at their Khufu-era extent
**Conflict:** the West Field grid is Reisner's documented nucleus plan (31 m
E–W, 16 m N–S pitches, CANON_DIMENSIONS); built with every plot at 16 m row
pitch and 24 m cores, every column fused into one N–S ridge — the brief floor
asks for "individual mastabas". The East Field's 36-plot grid fused the same
way. Much of the West Field's later density is 5th–6th-dynasty infill
(Reisner 1942).
**Chosen (v1.2 I5):** WEST — the nucleus grid with every second row built
(175 individual tombs, ~9 m streets between them; the survivors keep their
exact positions, sizes and tones — the build is draw-neutral); a large tomb
suppresses a neighbour it would come within 3 m of. EAST — eight twin
mastabas (two cores built as a pair and cased as one, G7000 pattern — the
tombs of Khufu's children; form B), cased in fine Tura limestone where the
West Field is local stone. FAMILY COURTS — low mud-brick courts before the
east faces (12 in the West Field, one per twin), with chapels, false doors,
offering tables and, in one court in three, a dependant's small tomb filling
the gap between the parents' tombs. The grid is the excavated plan, not a
procedural placement grid (brief bans those): unbuilt plots, size classes,
courts and dependants break it.
**Alternatives:** keep every plot (ridges); turn the tombs 90° to fit the
pitches (5 m streets, no room for courts); stretch the field south over the
Khafre knoll (must stay empty in 2550 BCE).
**Confidence:** C (forms), D (layout).
**Code:** `src/monuments/KhufuComplex.ts` (fields), `src/monuments/Necropolis.ts`
(courts).

## D-17 — The royal works yard south of the enclosure
**Chosen (v1.2 I5):** canon lists "Fine limestone staging. Granite storage.
Stone dressing areas." under the quarry district, and puts the staging yard
in the chain "Quarry → Staging Yard → Ramp → Construction Platform →
Monument". The yard stands on the flat court terrace south of the enclosure,
between the quarry and the monument: granite fenced apart from the Tura
(four pillars the exact size of the mortuary temple's, three architraves, a
pillar half-dressed at the pounding station — granite dressed by pounding
with dolerite balls, B), Tura limestone in three rows by size with red
control marks (B), the dressing area, the scribe's tally, a block leaving on
its sledge with water poured before the runners (the pouring is a Middle
Kingdom scene — C).
**Alternatives:** the quarry's north lip (literal "quarry"; inside the
perf-gated quarry bookmark, needs a terrace).
**Confidence:** D (siting), B–C (contents).
**Code:** `src/monuments/SouthWorks.ts`.

## D-18 — Confidence tags
**Chosen (v1.2 I6):** the Bible's Levels A–E ("Every reconstructed asset
should internally include a confidence classification": A direct evidence,
B strong consensus, C evidence-based reconstruction, D reasoned
extrapolation, E clearly marked speculative), with canon IX's Phase-4 gate
("a declared confidence level and temporal applicability"). The letter is the
confidence of the FORM AND PLACE shown — the lower of the two. Tags live as
data in `src/water/HarbourEvidence.ts` (keyed by footprint id; vessels by
class), are stamped onto the footprints after the harbour is built (conf,
basis, epoch), audited (`evidence.untagged` must be 0), and shown by
`?debug=confidence` (A green … E red outlines) and the Inspector's selection
line. Scope now: the harbour and its fleet (canon IX's gate); the rest of the
world follows in T2/Tier 3 once the scheme is proven.
**Confidence:** n/a (method).
**Code:** `src/water/HarbourEvidence.ts`, `src/debug/Footprints.ts`, `src/debug/Inspector.ts`.

## D-19 — Epoch presets ahead of the brief's tier
**Conflict:** the brief files `?epoch=` presets under Tier 3; the roadmap
(v1.2+) takes them first in T2, because the Tier-2 monuments (the Sphinx,
Khafre's complex) did not exist in 2550 BCE and may only appear in a later
epoch — canon IX §9.3 names the presets, and the Bible's Tier-1 rule
("NO Khafre/Menkaure/Sphinx") holds "unless a selectable timeline is
implemented".
**Chosen (T2-1):** the mechanism first, with the default epoch
(KHUFU_COMPLETION, the brief's Tier-1 state) bit-identical to the world
before it; built: KHAFRE_PERIOD (Khufu's construction context cleared),
EVIDENCE_VIEW (the default world with the confidence overlay); the other
named presets fall back to the nearest built stage with an on-screen notice.
Boot-time only.
**Alternatives:** wait for Tier 3 (no Tier-2 content could be shown at all);
a live switch (the terrain is baked per boot — a re-bake and a full rebuild).
**Confidence:** n/a (method).
**Code:** `src/world/Epoch.ts`, `src/core/Params.ts`, `src/debug/TerrainScene.ts`.
