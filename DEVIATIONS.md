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
**(T2-5, recorded — the human's call, T-1):** "smaller" is unquantified, and
the town as built already draws nearly every component of the later plan
(four gallery blocks, the Eastern Town, nine bakeries, the RAB, the Wall of
the Crow) in EVERY epoch — canon IX:129 says the later plan "must not be
transplanted unchanged into Khufu's reign". The builder's header says
"shown as the Khufu-era settlement per AERA's dating" (`WorkerTown.ts:3`).
Shrinking the default town is a default-world change; a Khafre-period
growth (a Western Town) has no layout source in the canon or the repo —
both are left to the human (plan `docs/plans/T2-5_PLAN.md` §5, T2-5b).
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
epoch — canon IX §9.3 names the presets; STATUS's Tier-1 scope line ("NO
Khafre/Menkaure/Sphinx") is our wording, while the Bible's own (the Khafre
complex "had not yet reached its final form", `canon/MASTER_PROMPT_BIBLE.md`
:82) adds "unless a selectable timeline is implemented".
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

## D-20 — The Sphinx site elevation (provisional)
**Conflict:** the Sphinx enclosure floor lies at ≈ 20 m ASL; the code's
plateau at the real site (325, 431) stands at ≈ 61 m ASL (+1.2 world) —
the escarpment crest at that latitude is ≈ 138 m east of the site, about
200 m east of where the real drop is (T2 plan, finding 6). A plateau
re-tilt cannot fix it (it would bury the worker town, and
`min(plateau, crest)` would erase the escarpment — finding 6b); the fix is
a LOCAL terrain change in the default world too (the slope existed in
Khufu's reign).
**Chosen (T2-2, plan default E5, taken while the human was away):** the
Sphinx and its enclosure under KHAFRE_PERIOD only, at the real x/z, the
floor cut 14 m into the CURRENT ground (−12.8 world ≈ 47 m ASL) — deep
enough that the body's back line lies under the old surface and the head
clears the rim. The default world is unchanged (footprint dump identical).
**Alternatives:** (A, recommended for the human) move the escarpment crest
~200 m west between z ≈ 250 and 650 with its crest heights and author the
Sphinx amphitheatre, for ALL epochs — the correct geography; it changes the
default world (the east end of Khufu's quarry, bm7, its gangs and debris,
the Shore loop) and needs a full re-verification iteration; (C) a separate
`?scene=sphinx` test scene with no world placement.
**Confidence:** D (the site height); the form B (Lehner's survey).
**Code:** `src/world/CANON_DIMENSIONS.ts` (`SPHINX_*`),
`src/world/GizaControl.ts` (the KHAFRE_PERIOD block), `src/monuments/Sphinx.ts`.

## D-21 — Khafre's pyramid G2: site, platform, granite course, enclosure, course count
**Conflict:** canon VII describes G2 (its "elevation illusion", its casing,
"Aswan granite" in its material palette) but gives NO figures: no base, no
slope, no course count, no platform level, no court or wall offsets, and no
canon file says "red granite" of the lowest course. The brief requires a
source for every load-bearing dimension (`BRIEF.md:65`).
**Chosen (T2-3, KHAFRE_PERIOD only; plan `docs/plans/T2-3_PLAN.md`, defaults
taken while the human was away):**
- base 215.25 m (Petrie 1883, B); slope 53.1301° — the seked of 5¼ palms,
  rise/run 4/3, giving 143.5 m (Petrie's measured 53°10′ gives ≈ 143.7 m), B;
- the site (−330, 350): the knoll the terrain was authored for, not the
  WGS84 delta (−322, 339), whose platform would reach the West Field's last
  tomb row (C);
- the platform at +10.0 world (70 m ASL): the commonly cited "base ≈ 10 m
  above Khufu's" — an outside figure, the canon gives none (D); a net CUT
  into the knoll's SW shoulder (≤ 4.0 m, ≈ 101k m³ under the base; fill ≤
  2.9 m at the NE corner); apex 153.5 vs G1's 146.6, so the illusion holds;
- 205 courses: G1's 210 scaled by height — an ESTIMATE (D); course 1 and the
  minimum course from G1;
- the lowest course in red granite after Lehner 1997 (C — outside the
  canon), on the near stones AND the far shell (one uniform: no pop at the
  LOD switch);
- the court (individual slabs) and an 8 m temenos at Khufu's offsets (20.2 m
  from the base, D-3's height; D); a doorway on the east axis, to be widened
  to the mortuary temple's flanks at that step.
**Alternatives:** the WGS84 centre with a tighter north court; the platform
at +12.0 (least earthwork, cut ≈ fill) or +11.0; two granite courses, or
all-Tura (canon-literal); a lower wall or a slab-grid material.
**Confidence:** B (base, slope) · C (site, granite) · D (level, courses,
enclosure) — `pyramid:G2` carries C overall.
Method, not evidence: beyond 300 m G2's casing stones cast no shadow — the
far shell, 5 cm inside them, casts alone (the perf A/B, STATUS T2-3).
**Code:** `src/world/CANON_DIMENSIONS.ts` (`G2_*`), `src/world/GizaControl.ts`
(the platform), `src/monuments/Monuments.ts`, `src/monuments/PyramidBuilder.ts`
(the granite band, the shadow LOD), `src/monuments/KhafreComplex.ts`.

## D-22 — Khafre's mortuary temple, causeway, valley temple and Sphinx Temple
**Conflict:** canon VII names the four buildings, their materials and their
order on the route (VII:290-305) but gives NO size, height or position for
any of them; the real causeway runs STRAIGHT from the mortuary temple to the
valley temple beside the Sphinx — and our Sphinx enclosure (provisional,
D-20) and Khufu's quarry bowl are not the real ones.
**Chosen (T2-4, KHAFRE_PERIOD only; plan `docs/plans/T2-4_PLAN.md`, defaults
taken while the human was away):**
- the mortuary temple 110 × 50 m (rounded, D — Hölscher 1912 to be checked)
  on a pad at the court's level, all fill; Tura floors (the real calcite
  floors are not in the palette);
- the causeway in TWO LEGS round our enclosure: (−92.2, 350) → (255, 484) →
  (382.5, 484), 499.7 m (the commonly cited ≈ 495 m, C); Khufu's section
  (9.5 m, roofed, slit-lit) on Khufu's pedestal rule across the worked-out
  quarry; the deck from +10 to −0.5 (D);
- the valley temple a 45 m square (C) of granite-faced walls, 13 m to its
  roof (D), the inner descending passage not modelled; the Sphinx Temple
  46 m (D) of massive limestone with a granite colonnade;
- both temples on ONE rock-cut terrace with the Sphinx at −12.8 (D-20's
  provisional level): the enclosure floor made level east to the escarpment
  and a terrace cut south of it.
**Alternatives:** a straight causeway clipping the enclosure's SW corner
(≈ 2.5 m), or straight and clear with the valley temple 64 m south of the
Sphinx Temple; reshaping Khufu's quarry (a default-world change — the
human's); the temples on the current ground ≈ 8 m above the Sphinx's paws.
**Confidence:** C (the valley temple's square, the route length) · D (the
rest). Every footprint carries conf/basis/epoch.
**Code:** `src/world/CANON_DIMENSIONS.ts` (`KHAFRE_*`, `SPHINX_TEMPLE_*`,
`khafreCorridorDist`), `src/world/GizaControl.ts` (the terraces and the
pad), `src/monuments/KhafreComplex.ts`.

## D-23 — Menkaure's pyramid G3: site, form, course count, undressed granite, court
**Conflict:** the canon names Menkaure's pyramid in the southern district
(the Bible's District 3) but gives no figure; its WGS84 delta from G1,
(−588, 743), falls on the authored Main Wadi's slope — the court there
would stand on ≈ 22 m of fill.
**Chosen (T2-5, MENKAURE_PERIOD only; plan `docs/plans/T2-5_PLAN.md`,
defaults taken while the human was away):** the site moved 53 m north to
(−588, 690) on the plateau cap (+12.0 world), a pad of half 76.9 m —
measured on the seeded ground a cut ≤ 1.8 m with a fill ≤ 1.9 m at its SE
corner; base 103.4 m (the mean of the published 102.2 × 104.6, C), 51.3°
(Petrie, C) → 64.5 m; 92 courses (G1's scaled by height — an ESTIMATE, D);
the lowest sixteen courses red granite, UNDRESSED (C — widely published):
each stone's facet residual ×15 and roughness 0.78 (it reads as a rougher,
faintly faceted face; real bosses would need geometry — a follow-up); the
court (individual slabs) and an 8 m temenos at Khufu's offsets (D) with an
east doorway for the later temple. The shadow LOD as G2's (300 m).
**Alternatives:** the WGS84 delta on a 22 m terrace, or (−588, 713) on a
10.8 m one; the 104.6 m side (65.3 m); G3's granite dressed like G2's band.
**Confidence:** C (form) · D (site, courses, court) — `pyramid:G3` carries D.
**Code:** `src/world/CANON_DIMENSIONS.ts` (`G3_*`), `src/world/GizaControl.ts`
(the pad), `src/world/Epoch.ts`, `src/monuments/Monuments.ts`,
`src/monuments/PyramidSpec.ts` (undressed rows), `src/monuments/MenkaureComplex.ts`.

## D-24 — Menkaure's works shown unfinished, at his death
**Conflict:** the canon names Menkaure's queens, temple complex,
construction areas, stockpiles and workshops and says "construction progress
may vary depending upon selected historical timeline" (MPB:2427-2445) — but
gives no figure, no layout and no state for any of them.
**Chosen (T2-6, MENKAURE_PERIOD only; plan `docs/plans/T2-6_PLAN.md`,
defaults taken while the human was away):** the complex as it stood at the
king's death: G3 and its east queen G3-a (44 m, 52°, C) finished; the two
western queens stepped cores (31 m, four tiers — C for the form, D for the
tiers); the three on their own terraces down the Main Wadi's bank, levels
measured, retaining walls on the fill faces (D); the mortuary temple (70 ×
45 m, D) roofless with its granite casing begun; the causeway (577.6 m — ≈
608 m usually cited, C) laid on its upper 290 m, a graded track below, at
most 12 % (an embankment where the bank falls faster); the valley temple
(50 m, D) on the wadi floor, its foundations and first courses; three
construction yards with staged blocks, a shed, sledges, chips and gangs.
**Alternatives:** Shepseskaf's mudbrick completion (finished, plastered
mudbrick on the stone cores — outside sources, not the canon); all three
queens true pyramids; one row terrace at +4 (cut 8, fill 11.6 m); a
causeway cut to ≤ 8 %.
**Confidence:** C (the forms, the causeway's length) · D (everything else).
**Code:** `src/world/CANON_DIMENSIONS.ts` (`MENKAURE_*`, `G3A_SLOPE_DEG`),
`src/world/GizaControl.ts` (the terraces and pads), `src/monuments/Monuments.ts`
(G3-a), `src/monuments/MenkaureComplex.ts`, `src/debug/TerrainScene.ts` (the
gangs), `src/debug/Bookmarks.ts` (bm14).

## D-25 — KHUFU_LATE: the Great Pyramid at mid-height, its ramps
**Conflict:** the canon names the stage ("Mid-height construction"; IX's
KHUFU_LATE "advanced construction and limestone transport") but gives no
course, height or ramp; D-7 chose a supply ramp from the quarry (S–SSE) to
the middle of the south face and rejected an internal ramp — and a straight
ramp from the quarry cannot reach mid-height (≈ 730 m at 10 %).
**Chosen (T3-1, KHUFU_LATE only; plan `docs/plans/T3-1_PLAN.md`, defaults
taken while the human was away):** built to the first course whose top
passes half the height (103 courses, 73.94 m — D); the casing undressed (C:
dressed top-down at the end); D-7's supply ramp intact (its remnant's axis
and section) feeding a zigzag on the south face to a flat working platform
(the Hölscher/Arnold one-face hypothesis — C; our geometry D); the next
course half laid; no pyramidion (D-9). The court, the temenos and the boat
pits not yet built (D-3's enclosure is finished after the pyramid).
**Alternatives:** two-thirds (≈ 97.5 m) or near completion (≈ 124 m — the
default's "approaching completion"); a spiral ramp round all four faces
(Dunham); the temenos built with a gap (D-7's rejected variant).
**Confidence:** C (the stage, the zigzag's family, the undressed casing) ·
D (the course, the geometry, the platform's state).
**Code:** `src/world/Epoch.ts` (`building`), `src/monuments/PyramidSpec.ts`
(`builtFrac`, `undressedCourses`), `src/monuments/PyramidBuilder.ts` (the
frustum), `src/gpu/passes/ProbeGI.ts` (the top plane),
`src/monuments/Monuments.ts`, `src/monuments/KhufuComplex.ts`,
`src/monuments/SouthWorks.ts`, `src/monuments/G1Works.ts`.
