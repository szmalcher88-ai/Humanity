# T3-2 — KHUFU_LATE: THE COMPLEX AND THE LOGISTICS (build plan)

> Prepared 2026-10-21 by a read-only side session on the `82d5d52` tree
> (T3-1 committed: G1 to 103 courses, 73.94 m; the supply ramp and the
> zigzag; the court, temenos and boat pits absent). Nothing in `src/` or
> `tools/` was touched. Scope (T3 roadmap row 2, as briefed): in
> KHUFU_LATE, the LATE states of the mortuary temple, the queens G1-a/b/c,
> G1-d, the causeway and the valley temple, by the canon's construction
> order and the sources; the quarry at work; IX's "limestone transport"
> (Tura) — decide whether LATE needs more than plays already; and the
> zigzag's "stairs" look. The human is away: every decision carries a ★.
> Contracts: the default (1142), KHAFRE (1120) and MENKAURE (1179) fpdumps
> bit for bit; everything here behind `building(epoch)` (`Epoch.ts:67-70`),
> own streams, appended last. LATE has no contract of its own yet — T3-2
> records its first LATE baseline at the end.

## 1. Verified findings

### 1.1 The canon on order (Haiku A)

1. The canon gives NO construction order for the complex: the presets
   "modify visible construction equipment, workforce distribution, and
   surrounding logistics" (`MASTER_PROMPT_BIBLE.md:3023`); every component
   carries a "construction phase" field but no values (`:3330`); the temple
   is described only as a post-mortem institution (`:3471`); the queens
   only as "an integrated architectural ensemble" (`:3646`); the boat pits
   only by place (`:3688`). "Pits after the funeral" and "court after the
   pyramid" are the repo's own defaults (`DEVIATIONS.md:431-441`, D-25,
   "defaults taken while the human was away").
2. The one canon ORDER: the Tura route's stages end "The block enters the
   pyramid construction sequence" (`VOL_IX.md:828`) — limestone arrives
   WHILE the pyramid rises; the harbour is "One of the busiest locations"
   (`MASTER_PROMPT_BIBLE.md:2473`) and "should feel busy because workers
   perform meaningful tasks" (`VOL_IX.md:871`), communicating "the scale of
   Egyptian logistics" (`:983`); the timeline decides "which harbor
   features, settlements, temples, and monumental structures appear"
   (`:127`). The quarry's "complete stone supply chain" (`VOL_VIII.md:447`)
   and "Transport ramps" (`MASTER_PROMPT_BIBLE.md:2589`).

### 1.2 The complex's builders (Haiku B)

3. `buildKhufuComplex(…, underConstruction)` (`KhufuComplex.ts:320-329`,
   called with `building(epoch)` at `TerrainScene.ts:124`). Parent forks in
   order: pavement `:363`, mt-pillars `:450`, causeway `:491`, boatpits
   `:622`, mastabas-west `:691`, mastabas-east `:784` — each one parent
   draw (`Seed.ts:107`): keep every call, skip only bodies.
4. The temple body (`:425-470`) is draw-free except its pillars on the
   `mt-pillars` child; its footprint (`:465-469`) must go with it. The
   valley temple (`:584-619`) draws nothing. The causeway draws only on its
   child (three per segment); its footprints are every 6th segment
   (`:563-579`) — a shortened or stripped causeway prunes them by the same
   index; `cwEnd` follows `edPos('valley-temple')` (`:474-476`). The queens'
   chapels (`:669-678`) have no fork and no gate.
5. Pyramids are per-name streams (`Monuments.ts:121`); `builtFrac` trims
   the stones AFTER every draw (`PyramidSpec.ts:184-190`); only G1 passes
   it today (`Monuments.ts:59, 120, 148`); the queens (`:177-185`) and G1-d
   (`:188-194`) are always finished.
6. The SE-corner scaffold is gated by `khufuWorks` only (`Inhabitants.ts
   :719`, SCAFFOLD `:815`) — it shows in LATE. Canon gangs k5 and k6 must
   not be dropped (`:292, 296`): the index filter (`:341`) and the shared
   `canonScale` (`:373, 435`) would move every gang. In LATE the extras
   already change (`TerrainScene.ts:263`: `southLines.slice(2)`), and
   SouthWorks' yard re-rolls on `south-works` (`SouthWorks.ts:94`) — LATE
   has no contract of its own.

### 1.3 The quarry (Haiku C)

7. The bowl: 210 × 145 m ellipse rotated 0.26 (`GizaControl.ts:136-139`),
   its SE haul-out sector "so sleds could haul blocks out on a graded
   floor" (`:405-411`) — unused by any track or gang; the carve is
   subtractive and one-shot (`QuarryCarve.ts:85`, `Heightfield.ts:137`),
   lifts of 1.12 m (`:32`), the trench grid (2.6 m pitch, 0.55 m wide) only
   on the "working" band 1.2–6 m deep (`:76-77`) — spoil, stacks and blocks
   must be meshes.
8. Gangs: k2 (110, x 20 … 180, z 420 … 470) and k3 (60, its east end on the
   SE haul-out floor) (`Inhabitants.ts:285-286`); the haul road starts on
   the NORTH floor at (90, 390) (`:280`); the ox trains at (40, 380) inside
   the bowl, (70, 300), (20, 250), (110, 208) outside (`:801-804`); a
   shelter on the deepest floor at (60, 470) (`:810`); 18 ramp-foot walkers
   at the supply ramp's toe (`G1Works.ts:39`).
9. Already reusable: freed-but-unhauled blocks and wedge-socket rows in
   every epoch (`Debris.ts:209-236`), block-rubble debris (`:116`), the
   remnant's sleeper track (`SouthWorks.ts:160-163`), the `cutting` flag
   (`:174-177`), the yard's block stacks by size (`:316-345`), the Menkaure
   yard's sledge closure (`MenkaureComplex.ts:416-421`).
10. FREE floors: the west floor x −100 … 14, z 430 … 505 and the ENE arm
    x 190 … 290, z 355 … 405 — nothing registered there.

### 1.4 The harbour and Tura (Haiku D)

11. One `tura-barge`, the only hull with `unloads` (`Vessels.ts:765, 1879`),
    its route to slipway 2 (1045, 44) (`HarborDistrict.ts:59`;
    `Vessels.ts:1215, 1908-1930`), the delivery tableau and its two staged
    blocks as `harbor-works` footprints (`:1205-1246`), its hauling team
    (`Inhabitants.ts:315`). No vessel cap (`Vessels.ts:2001`); newcomers
    via `add()` after the ferry keep every earlier `traffic` draw (`:1453,
    1871-1885`); the delivery tableau draws `crew` / `det` early (`:1801`) —
    a new hull must not draw there. `buildHarbor` takes no epoch
    (`TerrainScene.ts:172`); the evidence dispatch keys on the hull's kind
    (`HarbourEvidence.ts:82`).

### 1.5 The T3-1 code and the tools (Haiku E)

12. G1Works (`G1Works.ts:49-270`): the supply ramp and the zigzag in 3 m
    segments of flat-topped `ColorWriter` boxes stepping 0.3 m
    (`:79-157`) — the "stairs"; footprints on a continuous slope (`:139`);
    the platform passive (`:223-224`); streams `g1-ramp`, `g1-works`,
    `g1-folk`; `building()` carries `?klate=0` (`Epoch.ts:67-70`).
13. Tools: the LATE audit row (`tools/audit.ts:133-144`: built stones
    > 30k, none above the top); `fpdump.ts --q` — no LATE count recorded yet
    (`STATUS.md:458`); `ground.ts` samples the DEFAULT world (`:23`) — the
    same ground as LATE (no LATE terrain change); `test-bookmarks.ts` and
    the battery run the default only. bm15 has no key, and the '=' rule
    never reloads INTO an earlier epoch and hard-codes `bm=12`
    (`Bookmarks.ts:127-134`) — latent, not this step.

## 2. Decisions (★ = recommended default — the main session decides)

| # | question | ★ default | alternatives |
|---|---|---|---|
| O-1 | the complex's LATE states | ★ §3.1's table: G1-a done, G1-b half, G1-c begun, G1-d absent, temple and valley temple at their footings, causeway foundation as the materials road (all D; the canon gives no order, finding 1) | the T3-1 state (all finished) |
| Q-1 | the quarry at work | ★ extraction faces on the two free floors, a transport ramp to the north lip, stacks, sledges, static teams, one walker line (§3.4) | more gangs only |
| L-1 | limestone transport | ★ yes, MORE: a second Tura barge half a cycle behind, a Tura staging yard at slipway 2, Tura sledges on the causeway's foundation (§3.5) — "limestone transport" is the preset's name and the canon's one order (finding 2) | leave the harbour as it plays |
| Z-1 | the zigzag's stairs | ★ sloped deck quads per segment (§3.3) | leave |
| F-1 | the switch | ★ `?lworks=0` (T3-2 off, T3-1 LATE on); `?klate=0` stays the whole-LATE switch | one switch |
| B-1 | a view | ★ none new — bm15 already frames the rising pyramid and the supply ramp; the quarry is bm7's | a quarry-face mark |

## 3. Design (★)

### 3.1 What stood at mid-height (O-1)

The canon gives no construction order (§1.1). The outside picture (C): a
pyramid complex was finished from the pyramid outward — the temples and
the causeway's masonry in the last phase, the satellite pyramid with the
final works, the boat pits after the funeral (T3-1 removed them); the
queens' pyramids rose during the reign, the first earliest; the
causeway's foundation served as the road up from the harbour for the
materials, and the Tura casing came by boat in the reign's later years
(the Wadi al-Jarf papyri — the Diary of Merer — record Tura limestone
shipped to Giza in Khufu's year 26-27). ★ KHUFU_LATE shows:

| building | default (COMPLETION) | ★ KHUFU_LATE | conf |
|---|---|---|---|
| G1-a | complete | complete (the earliest queen) | D |
| G1-b | complete | half built, casing undressed (`builtFrac` 0.5) | D |
| G1-c | complete | its first courses (`builtFrac` 0.15) | D |
| queens' chapels | built | only G1-a's | D |
| G1-d | complete | absent (the final works) | D |
| mortuary temple | complete, the SE-corner scaffold | its footing courses (≈ 1 m of local limestone, the plan's outline), the basalt not laid; no scaffold | D |
| causeway | walled, roofed, slit-lit | the foundation EMBANKMENT and floor only — the materials road from the harbour: no walls, no roof | C (use) / D (state) |
| valley temple | massing | its platform and footing courses | D |

### 3.2 Mechanisms

- `add()` (`Monuments.ts:96-104`): the boolean `underConstruction` becomes a
  number `builtFrac?` (G1 passes `G1_BUILT_FRAC` — identical values, the
  same LATE world); a queen passes 0.5 or 0.15 with `undressedCourses` =
  its course count; `pyramid:G1-b/c` footprints follow `spec.built.top`
  (`:136`). G1-d's `add()` is skipped when `building(epoch)` (its stream is
  named — nothing moves).
- `buildKhufuComplex(…, underConstruction)` (`KhufuComplex.ts:329`): the
  T3-1 pattern — every FORK still taken (`mt-pillars`, `causeway`), only the
  bodies shortened: the temple writes its footing courses instead of its
  walls and pillars; the causeway writes its pedestal and floor slabs, not
  its walls and roof; the valley temple its platform; the queens' chapels
  only for G1-a. The temple's footprint follows its body (`y1` 1.0); the
  causeway's footprints keep their indices with `y1` = deck + 0.7. The SE
  scaffold and its footprints (`Inhabitants.ts:392-427, 719-742`) gain
  `&& !late` — `buildInhabitants` takes a `late` flag beside `khufuWorks`;
  its gang k5 stays (a foundation gang at the same corner — never remove a
  canon line: finding 6).

### 3.3 The zigzag's deck (Z-1)

- ★ A sloped deck WITHOUT a new primitive: G1Works writes its bodies with
  a `ColorWriter` (`G1Works.ts:62`), which already has `quad(a, b, c, d, t)`
  (`Townsfolk.ts:35`). Per 3 m segment: the body's flat top lowered to
  y − 0.3, then one SLOPED top quad from y − 0.3 to y and its two side
  triangles (a quad with a repeated corner); the vertical step at the high
  end is hidden by the next segment. Both the zigzag (`G1Works.ts:111-157`)
  and the supply ramp (`:78-101`). The footprints already follow the
  continuous slope (`yAt`, `:139`) — visuals only. LATE-only by
  construction (G1Works is).

### 3.4 The quarry at work (Q-1)

- Today the bowl is carved into 1.12 m lifts with a separation-trench grid
  on its "working floor" (`QuarryCarve.ts:32-35, 71-85`), quarried by gang
  k2 (`Inhabitants.ts:285`, x 20 … 180, z 420 … 470, 110 wanted) and k3
  (`:286`), dust at (100, 450) r 80 (`Particles.ts:76`), spoil anchors
  (`Debris.ts:95-99`), trains at its lip (`Inhabitants.ts:802-804`).
- ★ LATE adds, on stream `quarry-late` (family `quarry-works`, grounded by
  `grd` — no terrain change, so no probe needed): EXTRACTION FACES on the
  two FREE floors (§1.3): the west floor (x −100 … 14, z 430 … 505) and the
  ENE arm (x 190 … 290, z 355 … 405) — rows of blocks standing proud of the
  floor in their channels on the trench grid's 2.6 m pitch, one levered out
  on rockers, waste chips at their feet (canon "Partially extracted blocks.
  Failed extraction attempts. Waste piles.", `MASTER_PROMPT_BIBLE.md
  :2583-2587`; Debris already scatters freed blocks and wedge-socket rows
  in every epoch, `Debris.ts:209-236` — the faces are where they come
  from); a rubble TRANSPORT RAMP from the floor at the haul road's start
  (90, 390) up to the north lip (≈ (70, 300), where the ox train already
  stands, `Inhabitants.ts:802`) with timber cross-sleepers (the remnant's
  pattern, `SouthWorks.ts:160-163`; canon "Transport ramps.", `:2589`);
  block stacks by size at its top (`SouthWorks.ts:316-345` pattern); a
  sledge with its block at each face (lift MenkaureComplex's `sledge`
  closure, `MenkaureComplex.ts:416-421`, into a shared helper — its call
  order unchanged) and their teams as static figures (stream
  `quarry-folk`). Walkers: one extra line (≈ 40) between the west faces and
  the ramp, appended last, LATE only.

### 3.5 Limestone transport (L-1)

- Today ONE Tura barge runs the full Merer route — down the river laden,
  the canal, the basin, the south-shore slipway, unloaded block by block,
  out and home (`Vessels.ts:1879, 1897-1915`); its land leg is gang k14
  (`Inhabitants.ts:315`) and the delivery tableau (`Vessels.ts:1205-1215`).
- ★ LATE is "Advanced construction and limestone transport" (`VOL_IX.md
  :121`): a SECOND Tura barge on the same track, phase + 0.5 (the first's
  phase is set so frozen shots catch it half unloaded, `Vessels.ts:1929-
  1930`; the second is then on the river, laden or returning — they never
  meet at the slipway), appended AFTER the ferry (`:1885`) so every earlier
  mover's `traffic` draw stays (`:1453`), its hull built on its OWN streams
  (`harbor-tura-late`, not `det` / `crew`); its kind `tura-barge-late`
  keeps the word "barge" so the evidence dispatch gives it the Merer class
  (`HarbourEvidence.ts:82`); a staging yard of Tura casing blocks by the
  slipway sorted by size (as the works yard, `SouthWorks.ts:310-347`;
  family and stream `tura-yard`, clear of the two staged blocks'
  `harbor-works` footprints, `Vessels.ts:1239-1246`);
  and the CAUSEWAY's foundation used as the materials road (§3.1): sledges
  with Tura blocks and their teams as static figures on its deck.
  `buildHarbor(…, late)` gains the flag (`TerrainScene.ts:172`).

### 3.6 Switch

- `?lworks=0` (under KHUFU_LATE): skips everything T3-2 adds and restores
  the T3-1 LATE world (temple, queens, G1-d, causeway, valley temple as
  default; no quarry works, no second barge) — the A/B arm.

## 4. Cost, measurement, audit, levels

- Cost: LATE gets CHEAPER where buildings shrink (the temple, the valley
  temple and the causeway lose walls and roofs; G1-b/c lose stones; G1-d
  goes) and dearer by the quarry works (≈ 300 boxes + ≈ 60 static figures),
  the second barge (one hull) and the Tura yard (≈ 80 blocks).
- Levels: nothing here changes terrain — every new piece stands on
  `grd()` (the measured ground) as SouthWorks does; no probe needed. If a
  face's blocks must sit on one floor level, read it with `npx tsx
  tools/ground.ts --wrect "-100,430,14,505" --wrect "190,355,290,405"` (the
  default world = LATE's ground, finding 13).
- Commands:
  1. Contracts: `npx tsx tools/fpdump.ts` (1142), `--q "epoch=KHAFRE_PERIOD"`
     (1120), `--q "epoch=MENKAURE_PERIOD"` (1179) — all identical; then the
     FIRST LATE baseline: `npx tsx tools/fpdump.ts --q "epoch=KHUFU_LATE"
     --out shots/fp-late.json`.
  2. A/B: `npx tsx tools/perf.ts --bm 15,7,1,3 --runs 3 --q
     "epoch=KHUFU_LATE" --b "lworks=0"` (bm15 the ramp and the queens'
     side, bm7 the quarry, bm1 the harbour, bm3 the temple side). RULE (★):
     fps medians A = B, scene Δ ≤ 1.5 ms (negative = a saving), shadows
     reported.
- Audit (`tools/audit.ts --epoch KHUFU_LATE`): collision clean over the new
  families (`quarry-works`, `tura-yard`) and the shortened temple/causeway
  footprints; the LATE row gains: G1-b/G1-c built tops = their fractions ×
  height ± one course; G1-d absent; the second barge present
  (`harbor.vessels` + 1 under LATE).

## 5. Risks and checklist

1. Default and later-world leaks: everything behind `building(epoch)`;
   the three fpdumps.
2. A shortened causeway leaves `cwEnd` and its grade unchanged (finding 4)
   — only walls and roof go; check the footprints keep their indices.
3. The second barge's phase: check a frozen shot shows one barge at the
   slipway and one on the river (not both at the dock).
4. Static figures float if the deck heights are off — read them from the
   same `yAt` as the footprints.
5. Checklist: fpdumps (+ the new LATE baseline); `audit.ts --epoch
   KHUFU_LATE` all PASS; `closeup.ts --id quarry-works:,tura-yard:,pyramid:
   G1-b,mortuary-temple --n 3 --q "epoch=KHUFU_LATE"`; tour under LATE
   (bm15, bm7, bm1, bm3, bm8); perf step 2.

## 6. Docs

- STATUS "T3-2"; DEVIATIONS D-26 (the complex's LATE states and their
  order — D, the canon gives none; the quarry works; the second Tura barge
  and the yard; the causeway foundation as the materials road; the sloped
  decks); README `?lworks=0`.
- From the recon (not this step): `PyramidSpec.ts:48` still documents
  "the lowest N courses" while G1 undresses all of them (`Monuments.ts:120`);
  the '=' key's reload rule cannot reach an EARLIER epoch and hard-codes
  `bm=12` (`Bookmarks.ts:127-134`); the `TOE` constant is duplicated in
  `SouthWorks.ts:58` and `G1Works.ts:32`.

## 7. Haiku precision

Five read-only Haiku agents; every row checked against the code or the
text at the cited line by the verifier.

| agent | task | rows | confirmed | notes |
|---|---|---|---|---|
| A | canon on order | 30 | 29 | the canon gives no order; one wrong row: "LATE currently has no Tura arrivals" — the Tura barge plays in EVERY epoch (`TerrainScene.ts:172`, no epoch) |
| B | the complex's builders | 30 | 30 | the fork order and the draw-free bodies; the scaffold shows in LATE |
| C | the quarry at work | 30 | 30 | two free floors; the reusable pieces (Debris' freed blocks, the sledge, the sleepers) |
| D | the harbour and Tura | 30 | 30 | the `traffic` phase draw per mover; the kind-based evidence |
| E | the T3-1 code and tools | 30 | 29 | one wrong row: "a sloped deck needs a new prism method" — `ColorWriter.quad` exists (`Townsfolk.ts:35`) |

**Haiku precision: 148/150 (98.7 %).**
