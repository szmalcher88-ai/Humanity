# I5 — THE NECROPOLIS + THE MONUMENT (build plan)

> Prepared 2026-10-21 by a read-only side session while the main session
> landed I4 (`954465f`). Nothing in `src/` was touched. Roadmap row (STATUS.md,
> ROADMAP v1.2+): *family tomb groups sharing walled courts in the mastaba
> fields; D-7 south-face ramp remnants (dismantling debris, staged); quarry
> fine-limestone staging + granite storage.* Every number below is derived from
> the code at `954465f`; every Haiku row was re-read by the verifier (table at
> the end). Three choices are the human's — section 2 — and the design gives a
> recommended default for each.

## 1. Verified findings the design rests on

THE CEMETERIES ARE RIDGES, NOT TOMBS (Haiku B found it; Haiku A missed it):
1. West field (`KhufuComplex.ts:640-683`): x = −170.18 − 31·col ±1.2 (17 cols),
   z = −205 + 16·row ±0.8 (26 rows); each tomb is W = 11·[0.85,1.1] along x and
   L = 24·[0.82,1.1] (92 %) or 24·[1.25,1.6] (8 %) along z (`box(x, gy, z, W,
   H+0.5, L)`, footprint `hz: L/2`). Rows are 16 m apart, tombs 19.7–38.4 m
   long: every pair of built neighbours in a column overlaps by 2–24 m (≈ 8 m
   typical). The 17 columns are continuous N–S ridges broken only by the 16 %
   unbuilt plots. The brief floor says "eastern & western mastaba fields with
   individual mastabas" (BRIEF:87).
2. East field (`:695-725`): rows 22 m apart (`pN + 6`), L = 24–32.4 → overlaps
   0–12 m; the same ridges, 4 columns.
3. The audit never sees it: same-family pairs are skipped
   (`CollisionAudit.ts:94`). The pitches in `CANON_DIMENSIONS.ts:157-158`
   (EW 31, NS 16) fit Reisner's field only with the tombs turned 90° — but
   turning them (31 cols × 16 m, 13 rows × 31 m) would leave 5 m N–S streets
   (no room for chapels or courts), and the obvious alternative of stretching
   the field south (z to +601) runs over the Khafre knoll at (−330, 350), which
   must stay empty in 2550 BCE (`GizaControl.ts:133`).
4. Draw order (`:641-683`): a plot draws x, z, then `chance(0.16)` — an unbuilt
   plot `continue`s BEFORE its other 6–7 draws, so the stream's draw count
   depends on the outcomes; only the slope skip at `:665` is draw-neutral (the
   comment at `:657-658` covers only that one). Anything that changes a
   position-dependent `continue` re-lays the rest of that field. The east loop
   is the same (`chance(0.1)` and the causeway test at `:701-702` precede the
   size draws).
5. `Rng.fork(label)` consumes one u32 of its parent (`Seed.ts:106-108`): the
   complex forks pavement → mt-pillars → causeway → boatpits → mastabas-west →
   mastabas-east in that order. A new fork goes after `:695`, or better a new
   `seed.rng('name')`, which is order-free (`Seed.ts:120-122`).
6. Chapels (west `:673-681`, east `:717-723`) and the eastern boat-shaped pits
   (`:610-618`) have NO footprint.

THE SOUTH SIDE (Haiku C):
7. South face base z = 115.18; the court pavement (passive) runs to 135.38;
   the south temenos wall stands z 133.88–136.88, x −136.84…136.88, 8 m high
   (`:354-372`). Between face and wall: 18.70 m, with the boat pits at x
   −68.25…−35.75 / 28.75…61.25, z 119.38–123.98. Nothing of D-7 is built
   (DEVIATIONS.md:70-72).
8. South of the wall the G1 pad holds Y = 0 to max(|x|,|z|) = 165, blending to
   natural by 190 (`GizaControl.ts:467-468`); natural ground is
   Y ≈ 0.0141·(z − x) ± 1.8 (`:263-268`) — ≈ 2.6 at (0, 186), 3.2 at (10, 236).
   Strip S3 = z 136.88–165, x −165…≈69 is dead flat.
9. Keep-clear neighbours: G1-d x 119.1–140.9, z 140.1–161.9; G1-c x 167–213,
   z 133–179 (base −1.2); the I4 haulers' camp (registry x −56.8…0.9, z
   259.7–280.9; campLine (2,271)→(54,277)); haul road leg 1 (90,390)→(40,215),
   leg 2 (40,215)→(105,120); ox trains at (40,380) (70,300) (20,250) (180,165);
   gang shelters at (150,215) (205,240) (265,150) (60,470) (40,245) — shelters
   and trains are unregistered.
10. bm3 'noon court' (265,7,265) is the only bookmark that frames the south
    face. bm7 'quarry' (0,15,560), yaw −0.738, 55° vertical fov: at 16:9 its
    horizontal view spans bearings due N…due E from the eye, i.e. the quadrant
    x ≥ ≈0, z ≤ 560 (the left edge reaches x ≈ −3 at z 200). bm7 read 62 fps
    in the I4 battery with the in-app pane closed (43–46 before); I7 still owes
    the A/B. Anything west of x ≈ −3 is outside bm7.

THE QUARRY (Haiku D):
11. Bowl x −106…306, z 300…600 (centre (100,450), RX 210, RZ 145, ROT 0.26);
    floor ≈ −8 (pre-quarry surface 4.95 at the centre, depth 13 in 1.12 m
    lifts). The graded haul-out points SE (0.64, 0.77); the haul road leaves on
    the deep NW side instead. The north rim near x 45–66 is at z ≈ 302–308.
12. The only granite in the world: 4 beams in the harbour stone yard
    (`HarborDistrict.ts:220-238`; material `[0.6, 0.39, 0.34]`, rough 0.6,
    spec 0.45, `:478`). Tura is staged only at the slipway head (two blocks,
    `Vessels.ts:1219-1226`). No stockpile exists on the plateau.

THE FIGURE BUDGET (Haiku E + verifier):
13. canonWanted = 1253 > 900 (high) → canonScale 0.718: one new `workLines()`
    entry re-scales and re-lays every canon gang. New gangs go into `extra`,
    appended last. Extras today ≈ 153 (threshers 70, reed 30, town 16, orchards
    27, camp 10) against EXTRA_SHARE 0.2 × 900 = 180 → 27 places left.
14. `rng.fork('trains')` (`Inhabitants.ts:608`) is drawn after the per-figure
    tone draws, so any change in figure count re-rolls the ox yaw jitter
    (±0.06) and the shelter yaws. Harmless; know it.
15. Static figures (`person()` in a `ColorWriter`, 3 draws each) cost no
    budget; `addTownsfolk` adds the mesh only if `w.count > 0` — a writer
    holding only props is silently dropped.
16. New structural families must join `STRUCT_FAMILIES`
    (`TerrainScene.ts:85-89`) and be built inside `rebuildStructures`, or
    every Inspector rebuild stacks duplicate footprints.

BUGS FOUND ON THE SIDE (all confirmed by arithmetic; fixes in §3.4):
17. All five ox trains face ~90° off their road: forward is (cos h, sin h)
    (`Inhabitants.ts:612-617`) but h is written `atan2(dx, dz)`
    (`:602-606`). Haiku D noticed the first; the pattern is in all five.
18. The train at (180,165) is inside G1-c (x 167–213, z 133–179): its nearest
    face is 13 m away, so it is buried ~16 m deep — invisible.
19. The SE-corner scaffold ramp (`:684-689`, blocks from (174,43) to (159,36)):
    blocks 0–4 stand inside G1-a (x 167–213, z 29–75), their tops 0.6–1.9 m
    under a face 3–9 m high — the ramp grows out of the queen's west face.
    Its gang (`:287`, (150,33)→(176,41)) ends inside G1-a too.
20. Haul road leg 2 ends at (105,120), inside the court: it crosses the 8 m
    south temenos wall at x ≈ 94.
21. Stale text: `Inhabitants.ts:678` (temple front "x ≈ 145" — mtX is 153.38,
    x 133.4–173.4); `Footprints.ts:19` example id `queen:G1-a` (real:
    `pyramid:G1-a`).
22. Out of scope, logged for later: the causeway is 632 m horizontal against
    D-4 / CANON 825 m (`G1_CAUSEWAY_LENGTH` is not used); the court pavement is
    20.2 m wide (temenos distance + court) against the canon 10.1 m.

## 2. Decisions for the human (defaults recommended)

| # | question | recommended | alternative |
|---|---|---|---|
| Q1 | Fix the ridges in I5? | YES: West = only every second row is built (draw-neutral: ≈175 individual tombs instead of ≈370 merged ones); East = 8 twin mastabas, Tura-cased (re-lays the east field only) | leave both fields; courts only (ridges stay, BRIEF:87 stays unmet) |
| Q2 | D-7 form | A: the enclosure is complete; the remnant stands OUTSIDE the south wall, cut back 8 m from it, dismantled from the quarry end | B: an unfinished 24 m gap in the south temenos wall where the ramp ran, its rubble tongue still reaching the face (literal "against the south face"; changes D-3's wall) |
| Q3 | Staging yard site | strip S3 south of the enclosure, x −122…−52 (dead flat, outside bm7, between the quarry and the monument) | on the quarry's north lip x 85…150, z 228…285 (literal "quarry"; inside bm7's frame at ~300 m; needs a terrace) |

Why the defaults: Q1 — the Khufu-era West Field was a set of planned nucleus
cemeteries; most of its later density is 5th–6th-dynasty infill (Reisner
1942), so fewer, individual tombs is closer to 2550 BCE than 370 merged ones
(C); the twin mastabas are THE attested family tomb of Khufu's children in the
Eastern Field (G7000, B for the form). Q2 — A touches nothing canonical and
explains itself: the court is finished and walled, so the ramp's last body
outside the wall is what is still coming down. Q3 — canon puts the yard in
the chain "Quarry ↓ Staging Yard ↓ Ramp ↓ Construction Platform ↓ Monument"
(BIBLE:2737-2753); S3 is that position, flat, and out of the perf-gated bm7.

## 3. Design

### 3.1 I5-1 THE NECROPOLIS — `KhufuComplex.ts` + new `src/monuments/Necropolis.ts`

Canon: "Include: mastabas, family tombs, chapels, courtyards, ritual pathways,
offering areas." (BIBLE:2597-2609); "The architecture should communicate social
hierarchy through scale and material quality." (:2611); brief "individual
mastabas (massing + dressing, not clones)" (BRIEF:87).

1a. WEST FIELD, TWO-PASS (draw-neutral). Pass 1 is the existing loop body
    VERBATIM minus the geometry writes: it pushes a record
    `{col, row, x, z, W, L, H, gy, tone, chapel, chapelDz, slopeSkip}` for every
    plot that passes `chance(0.16)`. Pass 2 resolves and writes:
    - odd rows are not built (rows 0, 2, … 24 remain: z_k = −205 + 32k ±0.8,
      k 0…12 → E–W streets 32 − (L1+L2)/2 ≈ 4–14 m, mean ≈ 9);
    - a large tomb (L 30–38.4) keeps its length; an even-row neighbour in the
      same column whose gap to it is < 3 m is not built (the big tomb wins);
    - slope-skipped plots stay unbuilt (`:665` rule);
    - geometry, footprint and chapel exactly as today (`:666-681`), ids
      unchanged (`mastaba:w:${col}:${row}`), so even-row tombs keep their exact
      positions, sizes and tones.
    Expected ≈ 175 tombs (221 plots − 16 % − slope − ≈10 suppressed).
    Check: dump `__akhet.footprints()` filtered to `mastaba:w:` before and
    after; every surviving id must match to the centimetre.
1b. EAST FIELD → 8 TWIN MASTABAS (re-lays only the `mastabas-east` fork).
    Two rows of four, north and south of the causeway (canon list "family
    tombs"; G7000 twins = two cores built as a pair and cased as one):
    - x_c = 255 + 35c + te.range(−1,1), c 0…3 (255/290/325/360);
      z = −82 (north) / +56 (south) + te.range(−1,1);
    - cores L_A, L_B = 24·te.range(1.0,1.15); shared W = 11·te.range(1.15,1.3)
      (12.7–14.3); H = 4.5·te.range(1.05,1.25); tone te.range(0.92,1.02);
      7 draws per twin, 56 in all, fixed count (no position-dependent skip);
    - ONE battered box (batter 0.16) of length L_A + L_B + 3 (51–58 m) into the
      `tura` writer — the royal family's tombs in fine casing, the West Field's
      in local stone (canon :2611);
    - two chapels per twin (3.6 × 3.2 × 4.6 as today) on the east face at the
      two core centres, x = face + 1.8;
    - footprint `twin:e:${c}:${n|s}`, family `mastabas-east`, editGroup
      `mastabas-east` (Inspector unchanged);
    - causeway clearance by construction: the north twins end at z ≈ −53,
      ≥ 18 m from the causeway axis at c = 3 (axis z −34.5 at x 360; footprint
      half-width 5.95 → 12 m clear); the south twins start at z ≈ 27, ≥ 42 m
      from it at c = 0. Keep `distToCauseway` as an assert (console.warn), not
      a skip.
    Footprint z span −111…85 (today −127…83); x 248…367 + courts to 377.
1c. FAMILY COURTS — new `src/monuments/Necropolis.ts`,
    `buildFamilyCourts(scene, seed, hf, gi, tombs)`; `buildKhufuComplex`
    returns `tombs` (west records after pass 2) and `twins` in `ComplexInfo`.
    Form (Reisner's exterior mud-brick chapels with courts, C): a low mud-brick
    court in FRONT of the east faces, where the offering cult happened.
    - WEST: candidates are pairs of built, non-large tombs in one column at
      rows 2k and 2k+2. Walk c 0…16, k 0…11 in order and draw ONE
      `rng.float()` per slot whether or not it is eligible (stable stream);
      take it if eligible and roll < 0.12, no tomb in two courts, cap 12.
      Court: x from x_f = max(face_A, face_B) (face = x + W/2) to x_f + 9;
      z from z_A − L_A/2 + 3 to z_B + L_B/2 − 3 (≈ 49 m). N and S walls run
      from 0.4 m INSIDE the tomb face to x_f + 9 (battered faces recede 0.7 m
      at the top — a wall that stops at the base leaves a slit); E wall with a
      1.6 m doorway at the court's mid; a short yawed wall closes the gap
      between the two tombs from A's SE corner to B's NE corner. Walls 0.9 m
      thick, 2.2 m high, batter 0.03 (WALL RULE: thickness only), seated on
      the lowest corner of each run. Street left to the next column ≈ 31 − W −
      9 ≈ 11 m; column 0's courts (x ≈ −164…−155) leave an 18 m lane to the
      temenos' west face (−136.88).
    - EAST: every twin gets one: x from its face to face + 10, z from its
      north end + 3 to its south end − 3, door at the mid of the E wall.
    - INSIDE: each tomb gets its offering place — the existing chapel (a dark
      0.9 × 1.9 doorway panel 0.03 proud on its east face), or, where the
      record has no chapel, a FALSE-DOOR panel 0.06 proud on the tomb face
      (dark jambs, a drum lintel) at z + L/4 (the main, southern niche); a
      limestone offering table (0.9 × 0.5 × 0.12 on a 0.4 m base) and a basin
      in front; loaves, jars and a bundle of onions on the table.
    - DEPENDANTS: where the inter-tomb gap is ≥ 7 m, in one court in three a
      small mastaba (6.5 × 4 × 2.6, batter 0.12) fills it — the family member
      buried between the parents' tombs (the Giza infill pattern, C).
    - PEOPLE (static, 'necropolis-folk'): in the four west courts nearest the
      pyramid and two east courts: a ka-priest standing at the table, two
      kneeling bearers with trays, a woman with a jar, a child (k 0.62) — ≈ 30
      figures, no budget. Canon: "priests conducting rituals" (BIBLE:62).
    - Writers: `mud` (walls; `limestoneMaterial([0.56,0.46,0.34], gi, 0.3,
      0.45)` as WorkCamp), `stone` (tables, false doors, dependants; the
      complex's local `[0.74,0.68,0.57]`), `ColorWriter` (offerings, people).
      Meshes named `necropolis` (`?hide=necropolis` for the A/B).
1d. Register every mastaba chapel: `chapel:w:${col}:${row}`,
    `chapel:e:${c}:${n|s}:${a|b}`, family `tomb-chapels`, allow
    `['mastabas-west','mastabas-east','tomb-courts']`.

RNG: west keeps `mastabas-west` (draw-neutral); east re-lays inside
`mastabas-east` (deliberate); courts `seed.rng('necropolis')`, people
`seed.rng('necropolis-folk')`. No new fork on the complex's parent stream.
FOOTPRINTS: family `tomb-courts` — `court:w:${col}:${k}:{n,s,e1,e2,gap}`,
`court:e:${c}:${n|s}:{n,s,e1,e2}`, `subsid:${col}:${k}`, `offering:${…}`;
walls touching tombs allow `['mastabas-west'|'mastabas-east','tomb-chapels']`.
COUNTERS: `tombs.west`, `tombs.twins`, `tomb.courts`.

### 3.2 I5-2 D-7: THE RAMP REMNANT (variant A) — new `src/monuments/SouthWorks.ts`

Canon: "partially dismantled ramps, sled tracks" (BIBLE:3248-3249); "Temporary
ramps, stone staging areas, and worker activity may still exist" (:3012);
"Construction Fill — Compacted earth. Ramps." (:1750-1754); "Waste should
appear managed rather than randomly scattered." (VIII:568); brief "Remnant
ramp(s) per chosen hypothesis (document in `DEVIATIONS.md`)" (BRIEF:93); "No
wheeled transport on construction ramps" (BIBLE:1356).

Story: the court is paved and walled, so the ramp inside the enclosure is gone;
its body outside the south wall is being taken down from the QUARRY END, its
fill carried back to the quarry's worked-out north bays (Lehner reports the
Khufu quarry backfilled with construction debris — C), its mud brick
salvaged.
- AXIS: head H = (−8, 147) → toe T = (10, 236); u = (0.1982, 0.9802),
  length 90.8 m, GeoWriter yaw (local x along u) = atan2(0.9802, 0.1982) =
  1.3713. The axis points at the south face at x ≈ −14.5 (Lehner's south
  approach). The head's nearest corner is at z ≈ 145.2, 8.3 m from the wall's
  outer face (a service lane; no contact with `temenos`).
- SECTION: 18 m at the base (fill 15.6 + two mud-brick retaining walls 1.2,
  batter 0.12 on thickness), 15 m across the top.
- PROFILE, s from the head (heights over local ground; ground ≈ 0 at s 0–20,
  ≈ 2.2 at s 40, ≈ 2.9 at s 60, ≈ 3.2 at the toe — measure first):
  - s 0–6 the HEAD: a vertical CUT FACE where the ramp was severed for the
    enclosure, 5.6 m, showing the fill in bands (thin boxes 0.02 proud:
    limestone chips 0.78, tafl 0.55, gypsum debris 0.9) and the brick walls in
    section;
  - s 6–40 INTACT: the old track surface, top 5.4 → 3.0 m, tafl-toned, with
    timber cross-sleepers (0.25 × 0.15 × 10 m every 1.6 m — "sled tracks",
    C: Middle-Kingdom ramps at Lisht show them);
  - s 40–58 the WORKING FRONT: two lifts cut down, treads at 2.0 m (s 40–49)
    and 1.0 m (s 49–58), risers facing the quarry; the retaining walls broken
    in 2–3 gaps of 4–6 m where brick is coming out;
  - s 58–90.8 CLEARED: a low rubble tongue 0.6 → 0.1 m, 22 m wide, and the two
    wall footings (0.4 m) left in the ground.
  Build per segment like the causeway pedestal: y0 = lowest corner − 0.3, top
  = highest corner + h(s).
- MANAGED SPOIL on the east side (toward the haul road), axis-local (s, side):
  4 stacks of salvaged brick 2.0 × 1.2 × 1.0 at (45…55, +12…+14); two sorted
  heaps of stone fragments (drum r 2.0, h 1.1, batter 1.2) at (52, +13),
  (60, +12); a pale tafl/gypsum heap (r 1.8, h 0.9); ten baskets at the front.
  At the quarry lip, the DUMP: a spoil cone (drum r 4, h 2, batter 1.5) and a
  tongue down the first terrace at (45, 302) — dq 1.09, outside the bowl,
  12 m from the rim, west of where the haul road crosses it (66, 308).
- PEOPLE: static on the treads and top — six diggers with copper-bladed hoes,
  four basket fillers kneeling, two carriers with baskets on the head, an
  overseer with a staff, a scribe on a mat at the toe tallying baskets.
  Gangs (extra, appended last): carriers (18,210)→(45,302), n 12, spread 2,
  carry 0.85, still 0.1 (crosses campLine at z ≈ 271–277, x ≈ 36–38 — open
  ground; 7 m from the (40,245) shelter, 7 m from the (20,250) train); front
  gang (14,186)→(20,210), n 8, spread 3, still 0.7.
- DUST: the existing Particles anchors (70,280) and (30,210) already cover the
  front; do not touch the shared stream.
- Clearances: haul leg 1 ≥ 20 m east of the east foot (x ≤ 22 at the toe);
  the (20,250) train's oxen after the heading fix stand at (21.6, 246.8), 12.9
  m from the toe corner (18.6, 234.3); camp ≥ 21 m (z 259.7); the yard 39 m
  west; G1-d 100 m east.
FOOTPRINTS (family `ramp-remnant`, yaw 1.3713, grounded): `ramp:head`,
`ramp:upper:0…3`, `ramp:front:0…1`, `ramp:toe` + `ramp:footing:{w,e}`
(passive — figures may walk the cleared ground), `bricks:0…3`, `spoil:0…2`,
`ramp:dump`.
VARIANT B (only if Q2 = B): split the south temenos run (`:364`) into two runs
leaving x −12…+12 open, add a 1.5 m stub course with blocks staged beside it,
footprints `temenos:south-w|-e`, and carry the remnant's tongue through the
gap to the boat-pit line (z 124) over the passive pavement.

### 3.3 I5-3 THE ROYAL WORKS YARD — fine-limestone staging + granite store (`SouthWorks.ts`)

Canon: "Fine limestone staging. Granite storage. Stone dressing areas."
(BIBLE:2577-2581); "Transport ↓ Staging Area ↓ Final Dressing ↓ Placement"
(VIII:472-484); "Storage architecture should separate materials." (VIII:528);
brief "stone stockpiles staged by size, staging yards" (BRIEF:93); "Pink Aswan
granite." (BIBLE:210); "laborers transporting granite" (:64); "Granite Cutter"
(VIII:211); a scribe records the movement (IX:816).
What it serves: the mortuary temple's unfinished SE corner, the queens'
chapels and the Tura casing of the East Field twins (§3.1b) — Tura for casing
and paving, granite for the temple's pillars and architraves.
- SITE S3: x −122…−52, z 143…167 (70 × 24 m), Y = 0 (G1 pad; z ≤ 165 flat,
  167 at ≥ 0.99 of the pad) — NO NEW TERRAIN PAD. 6.1 m lane to the wall; 38 m
  to the West Field's column-0 chapels (−159.7); 39 m to the remnant; camp
  ≥ 93 m. Bearing from bm7's eye −102° (outside); in bm3 at ≈ 370 m, 27.6°
  left of centre, not occluded by G1-c or G1-d.
- GRANITE STORE (x −122…−100), set apart by a mud-brick fence 0.9 × 1.4 m
  open 2 m to the east: four pillars 1.3 × 1.3 × 5.2 m — the exact size of the
  mortuary temple's pillars (`KhufuComplex.ts:413-422`) — lying E–W on timber
  sleepers at z 147/150/153/156; three architraves 5.2–7.4 × 1.1–1.5 ×
  1.2–1.6 (the harbour class) at z 160–164; lifting bosses 0.35 × 0.4 × 0.35
  on two. A POUNDING STATION at the opening: one pillar half-dressed, two
  pounders squatting, a heap of twelve dark dolerite balls (drum r 0.12–0.15,
  h 0.22, `[0.25,0.25,0.24]`) — granite was dressed by pounding and abrasion,
  not cut with copper (B). Material: the harbour's granite
  (`limestoneMaterial([0.6,0.39,0.34], gi, 0.5, 1.15, {rough 0.6, spec 0.45})`).
- TURA STAGING BY SIZE (x −96…−68), three E–W rows on sleepers at z 148,
  155, 162: casing blocks 2.0–2.4 × 1.1–1.3 × 1.2–1.4; standard blocks
  1.3–1.9 × 0.9–1.3 × 1.0–1.4, 45 % stacked two high (the harbour yard's
  sizes); paving slabs 1.1–1.9 × 0.85–1.3 × 0.14 in stacks of 6–9. Red ochre
  control marks (0.25 × 0.12 × 0.01, `[0.55,0.18,0.12]`) on ≈ 20 % of the
  south faces — gang and control marks in red paint are attested on Giza
  blocks (B). Rows are registered as rows, never one box (the harbour yard
  lesson, STATUS I1 item 7).
- DRESSING + TALLY (x −64…−52): two blocks being dressed (a 2.2 × 1.2 × 1.3
  block, its upper part in a rougher, darker box), masons squatting with
  mallet and chisel, a mason's square (two beams in an L), a chip heap; a reed
  shade (`reedRoof` on four poles) over a seated scribe with a writing board
  and an overseer.
- OUTGOING: a sledge with a Tura block at (−46, 155) heading east, a six-man
  rope team (static), a man pouring water before the runners ("lubricated
  transport paths", VIII:496; the pouring scene is Middle Kingdom — C).
- GANG (extra, appended): (−118,165)→(−56,145), n 8, spread 6, carry 0.3,
  still 0.75.
FOOTPRINTS: family `works-yard` — `yard:ground` (passive), `yard:granite:{0…3}`,
`yard:fence:{n,s,w}`, `yard:tura:{0,1,2}`, `yard:dressing`, `yard:tally`,
`yard:sledge`.
COUNTERS: `works.tura` (blocks), `works.granite` (pieces), `ramp.segments`.
WRITERS for all of SouthWorks: `rubble` (the scaffold-ramp stone
`[0.66,0.62,0.52]`), `mud`, `tura`, `granite`, `wood`, one `ColorWriter`
(people, baskets, marks, balls) — six meshes named `south-works`.
RNG: `seed.rng('south-works')` (props), `seed.rng('south-folk')` (people).

### 3.4 I5-S SIDE FIXES (`Inhabitants.ts`, comments, a tool flag)

S1. TRAINS (`:600-607`): write every heading as atan2(dz, dx) —
    (40,380) atan2(−160,−10); (70,300) atan2(−110,−20); (20,250) atan2(−60,30);
    (700,−150) atan2(−18,−140). Draw-neutral (`tr` draws the same count).
    Move the G1-c train to (110,208), heading atan2(−4, 42) along the re-aimed
    leg 2 (S3 below). Register the trains before `obstacleField()` is built:
    `train:${i}`, family `trains`, grounded (positions need no draws) — the
    audit would then have caught item 18.
S2. SCAFFOLD RAMP (`:684-689`): re-lay the 14 blocks from the foot (151,52)
    to the head (157,34) (direction (6,−18), yaw atan2(−18,6) = −1.249, widths
    7.0 → 5.6 as now): x stays 147.7…160.3, clear of G1-a (167) and of the
    temenos east wall (136.88). Its gang (`:287`) → (140.5,36)→(146,58), n 26
    unchanged. Register `scaffold:ramp:${i}` and `scaffold:frame`, family
    `scaffold`, allow `['temple']` (the falsework stands 0.55 m off the
    temple's south wall). bm11 must still frame it — check the tour.
S3. HAUL LEG 2 (`:279`): (40,215)→(152,204), toward the masons' yards line
    (160,200)→(270,130); n 90 unchanged. Only that gang's figures move.
S4. Register the gang shelters (`shelter:${k}`, family `trains`) and the
    eastern boat-shaped pits (`boatpit:e:${pz}`, family `boatpits`).
S5. Fix the comments of item 21.
S6. `tools/ground.ts` takes TOWN-LOCAL rects only: add `--wrect
    x0,z0,x1,z1` (world frame) before measuring the remnant's axis and the
    yard.

### 3.5 Wiring

- `TerrainScene.ts`: capture `const complex = buildKhufuComplex(…)` (`:107`);
  call `buildFamilyCourts(structures, seed, hf, gi, complex.tombs,
  complex.twins)` and `buildSouthWorks(structures, seed, hf, gi)` inside
  `rebuildStructures`; `STRUCT_FAMILIES` += `tomb-courts`, `tomb-chapels`,
  `ramp-remnant`, `works-yard`, `scaffold`; counters as above; extras
  `[...threshers, ...reeds.lines, ...townLines, ...orchards.lines, ...campLines,
  ...southLines]` — new lines LAST.
- `Inhabitants.ts`: EXTRA_SHARE 0.2 → 0.25. Extras become 153 + 28 = 181 >
  180; at 0.25 the high cap is 225, extraScale stays 1 at high and ultra, so
  no existing extra figure moves there; at low (cap 80, scale 0.42 → 0.44)
  the extras re-lay — accepted.
- `trains` and `scaffold` footprints are registered in `buildInhabitants`,
  which runs once at boot: `trains` must NOT join STRUCT_FAMILIES (fpClear
  would drop them on an Inspector rebuild and nothing would re-register them).
  `scaffold` likewise stays out.

## 4. Risks

1. RNG. West: pass 1 must be the loop body verbatim — any reordering re-lays
   the field (finding 4). East: deliberate re-lay of one fork only. Necropolis
   and SouthWorks: new named streams. Inhabitants: positions of other gangs
   cannot move; dropped figures shift the i%2 variant parity and the
   per-figure tone draws after them, and the `trains` fork (finding 14) —
   cosmetic.
2. Figures vs new footprints. Nothing new sits on a canon gang line except
   the deliberate S2/S3 re-aims; the carriers' line crosses campLine (open
   ground). Expect reseat/drop counts to change only by those. Log the before/
   after line `[akhet] inhabitants: N placed, M moved off structures, K dropped`.
3. Collision audit. Court walls must allow their tombs (the 0.4 m bite into
   the battered face); chapels now registered may flag old chapel-vs-something
   contacts that were always there — treat each as a finding, not noise. The
   audit's yawed footprints are AABBs (over-estimate): the remnant at 11.4°
   inflates by ≈ 0.2·hx — the nearest neighbours are ≥ 8 m away.
4. Ground. The G1 pad's 25 m blend (|x| 165…190, up to ≈ 10 % slope) lies
   under column 0's tombs; column 0's courts (x ≈ −164…−155) are on the flat
   pad and column 1's (≈ −195…−186) on the blend's tail. Seat every wall run
   on its lowest corner; the `sunk` rule (60 % of 2.2 m = 1.32 m) holds for
   ≤ 0.9 m of fall along a run. The remnant's ground rises ≈ 3 m over its
   first 40 m (pad blend) — segment it, don't extrude it.
5. Perf. bm7 sees the remnant's east edge (x > −3), the carriers and the dump
   at ≈ 260–360 m; bm3 sees the remnant and the yard at 250–370 m. All static,
   merged, ≈ 10 meshes added in total; the per-mesh `name` makes the A/B one
   switch: tour `--only 3,7 --q "hide=south-works,necropolis"` alternated twice
   in one sitting, pane CLOSED (the I4 lesson).
6. Interpretive choices → DEVIATIONS (drafts in §6): D-7 rewritten (D), D-16
   the mastaba fields (C/D), D-17 the works yard (D).
7. The brief bans "placement grids" (BRIEF:174, :152). The West Field grid is
   Reisner's documented plan, not a procedural grid; jitter, unbuilt plots,
   size classes, courts and dependants' tombs break it up. Say so in D-16.

## 5. Verification checklist

1. Before any edit: `npx tsx tools/tour.ts` baseline (11 bookmarks) and a
   footprint dump of `mastaba:w:` (for the draw-neutral check).
2. After 1a: the dump again — every surviving `mastaba:w:` id identical; odd
   rows gone; `tombs.west` ≈ 175.
3. `npx tsx tools/closeup.ts --id court:,twin:,chapel:w:,subsid: --n 3`
   (doorways, wall-to-tomb joints, false doors, offering tables);
   `--id ramp:,bricks:,spoil: --n 3` (cut face bands, lifts, footings);
   `--id yard: --n 4` (granite apart from Tura, rows, marks, pounders);
   `--id train:,scaffold:,shelter: --n 5` (S1, S2, S4).
4. `npx tsx tools/audit.ts` — all checks PASS; `collision.issues` 0 at boot.
5. `npx tsx tools/tour.ts` — bm3 (the remnant and yard in frame), bm7, bm8,
   bm11 (scaffold still framed after S2).
6. A/B perf (Risk 5), pane closed.
7. `npm run battery` — no src edits while it runs; 19/19, perf ≥ 45 at
   bm1/bm3/bm7 @1440p.

## 6. Docs to update

- STATUS.md: an "I5 — THE NECROPOLIS + THE MONUMENT" section in the I4 style
  (numbered build items, counts, battery line); roadmap row I5 → DONE; the
  HAIKU — ITERATION I5 table (§7); follow-ups (item 22) under I7 or OPEN.
- DEVIATIONS.md, drafts:
  - D-7 (rewrite): "Chosen (v1.2 I5): the remnant of a supply ramp from the
    quarry (S–SSE) toward the middle of the south face (Lehner's south
    approach). The court is finished and walled, so the ramp inside the
    enclosure is gone; its body outside the south wall is cut back 8 m from it
    and is being dismantled from the quarry end: a cut face showing its fill
    and mud-brick retaining walls, an intact stretch of track with timber
    sleepers, a stepped working front, cleared footings; brick salvaged in
    stacks, fill sorted and carried back to the quarry's worked-out bays.
    Alternatives: an unfinished gap in the enclosure with the ramp still
    reaching the face (rejected: alters the finished temenos, D-3); straight
    east ramp; internal ramp (Houdin). Confidence: D. Code:
    `src/monuments/SouthWorks.ts`."
  - D-16 Mastaba fields at Khufu-era extent: "West: the planned nucleus grid
    with every second row built (≈175 individual tombs; at 16 m row pitch and
    24 m cores the old build fused them into ridges) — the later infill is
    5th–6th dynasty. East: eight twin mastabas cased in Tura (Khufu's
    children and their spouses, G7000 pattern). Family courts: mud-brick
    courts before the east faces with chapels, false doors, offering tables
    and dependants' tombs. Confidence: C (forms), D (layout). Code:
    `KhufuComplex.ts`, `Necropolis.ts`."
  - D-17 The royal works yard: "Canon lists fine-limestone staging and granite
    storage under the quarry district; placed on the court terrace south of
    the enclosure — the staging-yard position in canon's transport chain —
    with the granite apart from the Tura. Confidence: D. Code:
    `SouthWorks.ts`."
- README: new `?hide=` names (`necropolis`, `south-works`), counters.

## 7. Haiku precision (5 agents, read-only, every row re-read by the verifier)

| agent | task | rows | confirmed |
|---|---|---|---|
| A | canon + brief requirements for the three I5 items, built? | 26 | 25 — every quote verbatim at its line; the BRIEF:87 row calls "individual mastabas" built, but both fields' columns fuse into ridges (B + verifier) |
| B | mastaba fields: grid, draws, footprints, free ground | 28 | 27 — found the N–S overlap ("no N–S street") on its own, plus the unregistered chapels and E pits; its "SE ring" holds the unregistered shelter at (205,240); its levels are formula-only (they ignore the G1 pad) |
| C | the south face, D-7, the ground south of the temenos | 30 | 30 — exact geometry for every strip; two side bugs: the scaffold ramp's foot inside G1-a, an ox train inside G1-c |
| D | quarry staging: bowl, haul road, gangs, camp, sites | 30 | 29 — its site C2 (−260…−210, 100…140) lies on the West Field (cols 2–3, rows 19–22); one path typo (`src\debug\Debris.ts`); its "the first train faces west" led the verifier to the swapped atan2 in all five trains |
| E | builders, footprint/audit rules, pads, gangs, RNG, bookmarks | 30 | 30 — the API and rules this plan is written against |

TOTAL 144 rows, 141 confirmed (97.9 %).
VERDICT: the I3/I4 pattern holds — recon briefed with the build question and
"derive every number from the code" stays near 98 %, and it keeps finding
real bugs on the side (ridges, trains, the scaffold ramp). The two misses are
the same class: a candidate site checked against registered footprints only —
unregistered pieces (shelters) and whole fields (the West Field) slipped past.
Next time ask for the check against the CODE that places things, not only
`fpReg`.
