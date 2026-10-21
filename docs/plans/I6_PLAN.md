# I6 — THE HARBOUR PER CANON IX §9.11–9.13 (build plan)

> Prepared 2026-10-21 by a read-only side session while the main session
> builds I5 (base `954465f`; files under I5 edit — `KhufuComplex.ts`,
> `Inhabitants.ts`, `Footprints.ts`, `TerrainScene.ts` — are cited at
> `954465f`, everything else at the working tree). Nothing in `src/` was
> touched. Roadmap row (STATUS.md, ROADMAP v1.2+): *rework the 180 m quay into
> conservative landing surfaces, earthen embankments and timber ramps (piers
> kept — brief §2 floor; D-14), cargo yards and an administrative shelter with
> scribes, confidence tags on every reconstructed piece.* Every Haiku row was
> re-read by the verifier (table at the end). Three choices are the human's
> (§2); the design carries a recommended default for each.

## 1. Verified findings the design rests on

WHAT THE CANON ASKS (Haiku A6, 30/30):
1. §9.12 lists six candidate components — "Low stone structures or prepared
   shore platforms where supported by evidence" (VOL_IX:545), "Compacted earth
   or sediment surfaces used to stabilize movement near the water" (:549),
   "Ramps, planks, braces, or simple landing structures where
   period-appropriate analogies justify them" (:553), cargo yards "sufficiently
   large for temporary material storage and handling" (:557), an
   administrative shelter "if evidence supports its inclusion" (:561), and
   "Dedicated locations for stone, rope, timber, food, and equipment" (:565) —
   and forbids "a long continuous stone quay or forest of timber piers" (:567).
   "Reconstructed elements must receive confidence metadata." (:569)
2. §9.13: slope, draft, turning clearance, unloading space, sledge-path
   access; "No cargo route should cross an impassable embankment" (:591);
   "implement multiple documented hypotheses as selectable alternatives" when
   the unloading method is uncertain (:595).
3. Phase-4 gate: "Every reconstructed feature has a declared confidence level
   and temporal applicability." (:1594); "Never present a reconstructed
   landing area as an excavated structure merely because it appears
   realistic." (:1538); §9.23 storytelling — coiled ropes, "Clay sealings and
   recording materials suggest administrative control", wet silt, worn paths,
   "efficiently organized, not randomly chaotic" (:981-1005).
4. Built today: functions of all five §9.11.1 zones exist (approach, basin,
   landing, cargo, transport); stone yard, magazines, granary, boatyard,
   market, wells, three slipways. Missing: earthen embankment, any timber ramp,
   a rope or equipment store, clay sealings, water-worn stone, an
   administrative structure (the only scribe sits under a mat at the Tura
   slipway, `Vessels.ts:1228-1244`), any confidence data in code.

THE QUAY IS A MOLE ACROSS THE BAY (verifier, from `GizaControl.ts:346-355`
and `Vessels.ts:1407-1425`; Haiku B6 and D6 reached it independently; an
analytic estimate before sand transport — the I5 `tools/ground.ts --wrect`
must confirm it):
5. The quay is one box 14 × 5.6 × 180 m (z −225…−45, y −51…−45.4, top 0.9 m
   BELOW the plain at −44.5), placed at qx = max over z (step 30 m) of
   `shoreX(z, 1.6)` + 2, east face `quayEdgeX` = qx + 7. The basin is an
   ellipse (centre (1077,−135), radii 210 × 150; full depth −50.5 inside
   d = 0.9, plain at d = 1.0), so its west shore CURVES: the 1.6 m-depth line
   lies at x ≈ 924 at z −225/−45 but ≈ 879 at z −165…−105. The max picks the
   ends; the contour there (x 924.1) sits on the probe's 8 m step, so
   qx ≈ 918–926 and quayEdgeX ≈ 925–933. At mid-run the quay body
   (x ≈ 911–933) stands 35–43 m off the bank (waterline x ≈ 874–875 at
   z −135), with 0.5–4 m of water between: a mole closing the bay, with a
   lagoon behind it, touching land only at its ends. Reeds and papyrus root
   inside its ends (Shore reads heights, not footprints — D6).
6. The quay gang `(872,−232)→(884,−46)`, n 70, "on the west shore behind the
   stone quay" (`Inhabitants.ts:297` at 954465f): at z −135 its axis (x ≈ 878)
   is in that lagoon (ground ≈ −47.7 by the formula) — the water test drops
   those figures.

WHAT HANGS ON THE QUAY (verifier; Haiku C6 — see §7):
7. `quayEdgeX` feeds: the middle pier's root (`onQuay` for pz −130:
   px0 = quayEdgeX − 0.6, `:1441-1442`); the moored-hull clamps at ALL three
   piers (bx ≥ quayEdgeX + 13.5, tx ≥ quayEdgeX + 11, `:1477-1478`); the royal
   barque (bx = quayEdgeX + 2.16 + 1.2 at zc −80, lines to (quayEdgeX − 1.6,
   −90/−60), gangplank to (quayEdgeX − 0.6, −78), `:1488-1503`); the harbour
   shuttle (dock (quayEdgeX + L/2 + 1, −180), approach +22, `:1645-1646`).
   The ferry, the river lanes, the anchored hulls and the Tura route do not
   use it (the Tura barge docks at slipway 2 on the south shore, `:1617-1640`).
8. `planWater` (A*, 5 m cells, `Navigation.ts:144-170`) treats as obstacles
   the footprints of families `vessels` and `harbor-works` ONLY. It runs
   inside `buildHarbor`; `buildHarborDistrict` runs after it
   (`TerrainScene.ts:108,112`), so district pieces are never obstacles. Any
   new structure in the water must be `harbor-works` and registered in
   `buildHarbor` BEFORE the moving-fleet block (`:1573`).
9. RNG: the `harbor` stream draws per pier `range(46,64)` + clutter + the two
   moored hulls (`:1443-1484`); the quay draws nothing; the barque has its own
   `harbor-royal`; movers `harbor-traffic`. Positions of piers (−230, −130,
   −30), barque (zc −80) and shuttle dock (z −180) are CONSTANTS — moving them
   is draw-neutral. ONE COUPLING (Haiku C6): the `harbor-crews` stream draws
   a hull's crew only `if (crew && afloat)` (`:778`, `:829`, `:1066`, `:1130`,
   `:1155`), and `afloat` comes from `floatY` sampling the bed under the hull
   (`:1386-1389`). A moved hull that flips between afloat and grounded
   changes the crew draw count and re-lays every later crew in the harbour.
   Rule: every moved hull must stay afloat (bed ≤ W − draft − 0.25).
9b. Other things C6 found: `planWater` never checks the shuttle's dock point
   (the `[appr, dock]` leg is a straight segment); both the shuttle and the
   Tura barge fall back SILENTLY to a river lane when A* fails (`:1638`,
   `:1661`); the shuttle's 900 s stop never unloads (load stays 1, the
   comment says "unload"); no test checks moving hulls against structures —
   movers are unregistered (`:1370`); `WalkRig.ts:70` skips ground-`none`
   footprints, so the quay was never walkable although `WalkRig.ts:16` says
   it is.

TERRAIN, PLANTS, PEOPLE (verifier; Haiku D6 — see §7):
10. The water is one 950 × 560 plane at (1330, −130) (x 855–1805, z −410…150,
    `NileWater.ts:155-157`); the shoreline is wherever the terrain dips below
    −46.5. The I4 canals are at z −997/855/1667 and the nearest dykes at
    −530/251 — none reaches the harbour box (`Irrigation.ts:35-55`).
11. RNG HAZARD in `Shore.ts:411-454`: the reed loop draws a fixed 3 values per
    try and stops at a target count, then `rng.fork('class-…')` and the TREE
    loop continue on the same stream. Any terrain change that flips one reed
    sample's depth fit shifts the stop point → re-seeds every clump's jitter
    and RE-LAYS every sycamore and tamarisk along the whole river strip. So:
    NO terrain edits at the harbour in I6 — landings are geometry; reeds that
    would stand in a landing are dropped by a post-filter on `clumpSpots`
    (after the loop, before `spawnClass`: no draw changes for the trees).
12. Shore reeds sample the harbour rim (`Shore.ts:403`: x 850–1850, z
    −420…160) and do not read footprints; ReedHarvest and Birds skip
    z −470…220 (`ReedHarvest.ts:69`, `Birds.ts:207`).
13. The two "harbour lanterns at the quay head and the pier root"
    (`Torches.ts:93-95`) stand at (1245,−196) and (1262,−74) — the basin's EAST
    side, 320 m from the quay. By the basin formula (1245,−196) is at d ≈ 0.90,
    bed −50.5: its 2 m post is under water (estimate).
14. Bookmarks: bm2 'dawn from the harbor' (1160,−41,−80), yaw 1.64, looks due
    west at the quay from ~235 m; bm10 'night harbour' (1315,−36,−252) looks
    WSW across the basin at the west shore; bm1 'harbor panorama' (a perf gate)
    looks W–SW over the magazines and basin.

CONFIDENCE DATA (Haiku E6, 30/30):
15. The only confidence fields in code: `CanonEntry.confidence` and
    `CanonPlacement.confidence`, typed `'A'|'B'|'C'|'D'` — no E
    (`CANON_DIMENSIONS.ts:19,199`); the header cites a "Vol. II" file that does
    not exist (the Levels A–E are `MASTER_PROMPT_BIBLE.md:796-814`, and a
    different Tier A–F source scale sits at :963-1057 — name the scheme). No
    file reads `.confidence`. `Footprint` has no confidence, source or epoch
    field; the `footprints()` hook projects only id/position/extent
    (`Hooks.ts:82`, `TerrainScene.ts:235`); `CollisionIssue.kind` is a closed
    union (`CollisionAudit.ts:23`); `tools/audit.ts` skips the world checks
    under `--fast` (`:225-226`); `?debug=collisions` draws edge boxes per issue
    (`Inspector.ts:80-104`) — the hook for a confidence overlay. Vessel ids
    are `vessel:${hullSeq++}` (unstable); HarborDistrict's `reg()` hard-codes
    `grounded` and the slipways and stone yard bypass it.

## 2. Decisions for the human (defaults recommended)

| # | question | recommended | alternative |
|---|---|---|---|
| Q1 | West-shore layout | REMOVE the mole. Two short stone landings at the natural deep-water line — a ROYAL LANDING on the valley temple's axis (z −135…−95; the barque moves there from z −80) and a CARGO LANDING (z −200…−175; the shuttle's dock moves 8 m to −188) — an earthen embankment along the rest, two timber ramps; all three piers rooted on the bank, the middle one moved from z −130 to −150 to clear the temple front | keep the old face line x ≈ 925–933 for both landings (barque and shuttle untouched, but the landings become 35–50 m-deep stone jetties — mole pieces) |
| Q2 | §9.13 "selectable alternatives" | document the alternatives in D-14 now; the switch belongs to the Tier-3 `?epoch` / EVIDENCE_VIEW work | add `?harbour=mole` now, restoring the v1.2 quay as hypothesis E |
| Q3 | Confidence tags — how far | harbour + vessels now (the Phase-4 gate), shown by `?debug=confidence` and the Inspector, enforced by an audit gate | every footprint in the world now (several hundred tags, mostly C/D) |

Why the defaults: Q1 — the mole is exactly the later-harbour cliché §9.12
forbids, and at mid-run it is not even a quay but a breakwater 35–43 m off
the shore; the natural dredged bank with two short landings is the conservative
reading, and a landing before the temple's harbour door follows "Doorways
align logically" (BIBLE:1302). Q2 — the brief files presets under Tier 3; a
second harbour layout doubles the fleet's dock logic. Q3 — the canon gate is
the harbour's; the rest can follow in T2/Tier 3 once the scheme is proven.

## 3. Design (Q1–Q3 defaults)

All new geometry is static and merged; no terrain edits (finding 11). New
streams: `harbor-landings` (structures, props) and `harbor-folk` (figures).
Positions are constants or derived from `shoreX` / `hf.heightAtCpu` — the
`harbor` stream's draws are untouched, so no hull re-rolls.

### 3.1 The west shore (`Vessels.ts`, `buildHarbor`, where the quay block was)

Layout N→S (z): pier 1 −230 (barge −237.5, traveller −222.5) · timber ramp T2
−212 · CARGO LANDING −200…−175 (shuttle dock −188) · pier 2 −150 (moved from
−130; its hulls move with it: −157.5 / −142.5) · ROYAL LANDING −135…−95 on the
temple axis (barque zc −115, hull −131…−99) · timber ramp T1 −70 · pier 3 −30
(−37.5 / −22.5). Every piece is ≥ 7 m from its neighbours.

a. REMOVE the quay box, its six bollards and the `quay` footprint
   (`:1418-1434`). Keep one number, `MOORING_X` = the old `quayEdgeX` formula
   verbatim, ONLY for the moored-hull clamps at piers 1 and 3 — their hulls
   then stay exactly where they are.
b. PIERS: every pier roots on the bank (`px0 = shoreX(pz, 1.2) − 10`, the
   rule piers 1 and 3 already use; drop `onQuay`). Pier 2 moves to z −150
   (≈ px0 866, end 912–930, estimate); its clamp becomes
   `max(…, shoreX(pz ∓ 7.5, 1.6) + 15)` (hull off the beach, inside the
   pier's reach) — its old `quayEdgeX + 13.5` clamp would put its hulls past
   the pier's end. Same draws; only pier 2's group moves.
c. ROYAL LANDING (stone; "low stone structures or prepared shore platforms"):
   face line x_R = max over z −135…−95 (step 10) of `shoreX(z, 1.8)` + 2
   (≈ 886, measure); top at NILE_WATER_Y + 1.0 (−45.5, the old quay top: a
   boat's sheer). The bank is narrow — by the basin formula at z −115 the
   plain's edge (−44.5) is at x ≈ 869, the −45.5 contour at ≈ 874, the
   waterline at ≈ 877 — so the platform runs from x ≈ 872 (let 0.3–0.5 m
   into the bank at its back) to x_R, ≈ 14 m deep, on a footing to the bed;
   a 6 m earth ramp (geometry, `earthMaterial`) brings the plain down to its
   top; two steps down the face (−46.1, −46.7) in a separate "water-worn"
   writer (smoother, darker — §9.27 "Smoother contact surfaces and localized
   discoloration"); slab paving on the top (the complex's `paveW` paving);
   timber fender posts every 4 m along the face; bollards at (x_R − 1.6,
   −125/−105); two lanterns on posts at its landward corners (moved from
   finding 13). Footprint `landing:royal` (`harbor-works` — a `planWater`
   obstacle; ground `platform` so the walk mode can stand on it — `none` is
   skipped by `WalkRig.ts:70`; `cutting: true`, because it is let into the
   bank and the audit's `sunk` rule would flag its back; NON-passive, so the
   gang figures, which stand on terrain, keep off the stone).
   BARQUE: zc −115 (was −80), bx = x_R + 3.36, lines to the two bollards,
   gangplank to (x_R − 0.6, −113).
d. CARGO LANDING (stone + timber): a stone platform (top −45.5, an earth
   ramp up to the plain behind it) from the −45.5 contour to the 1.2 m line
   (≈ x 880–892 at z −188), then a timber stage on piles to x_C = max over
   z −200…−175 of `shoreX(z, 1.6)` + 2 (≈ 902, measure), deck at −45.5; rope coils and a
   sledge on the stone part. SHUTTLE: dock (x_C + L/2 + 1, −188), approach
   +22 — `planWater` re-plans it. Footprints `landing:cargo`,
   `landing:cargo-stage` (`harbor-works`).
e. TIMBER RAMPS T1 (z −70) and T2 (z −212): a 3 m plank ramp from the bank
   top down to a 4 × 3 m stage on braced piles, deck 0.35 m above the water,
   1.2 m deep; a papyrus skiff nosed in at each (static, `harbor-landings`
   stream; the skiff builder from `:863`). §9.12 "Ramps, planks, braces".
   Footprints `ramp:t1|t2` (`harbor-works`).
f. EARTHEN EMBANKMENT (z −240…−20, the rest of the shore): the dredged bank
   left as it is, DRESSED — a rammed-silt revetment of ColorWriter quads
   0.04 m over the terrain, in 4 m stations from the bank top to 0.4 m below
   the waterline (`earthMaterial` from `Basins.ts:79`), a darker wet band at
   −46.5 ± 0.3 ("wet silt along the riverbank"), mooring stakes every ~18 m,
   two short mud-brick toe walls (0.6 m) where the bank is steepest, worn
   paths down to the water at T1/T2. Broken at every landing, ramp and pier
   root. Footprints `bank:${k}` per 20 m, family `harbor-district`, passive
   — figures may walk it, and it stays OUT of `planWater` (the depth test
   already keeps hulls off the shore; a `harbor-works` bank would add the
   hull clearance in front of every stretch and could shut the shuttle out of
   the cargo landing).
g. GANG: the quay line becomes `(856,−228)→(860,−62)`, n 70 unchanged —
   landward of the landings, clear of the cargo yard (x ≤ 850) and the
   temple platform (x ≤ 843). Position-only.

### 3.2 Cargo yard, rope store, administrative shelter (`HarborDistrict.ts`)

Canon: §9.12 cargo yards / administrative shelter / material storage; §9.21
"Scribes — Record cargo movements, supplies, and assignments"; §9.23 clay
sealings, coiled ropes; IX:816 "A scribe or supervisor records the movement of
materials where historically justified"; BIBLE:2489-2493 administrative
offices, customs checkpoints.
- CARGO YARD x 800…850, z −235…−165 (50 × 70 m) behind the cargo landing:
  10 m from the porters' road `(905,−318)→(857,−155)` (x 860–881 there),
  27 m north of the valley temple platform (z ≥ −138), west of the re-aimed
  quay gang. The ground is the escarpment toe (plainMask < 1 at x 800–850 by
  the formula) — no pad: every row seats on its own lowest corner (the
  harbour yard rule). Bays separated by 0.9 × 1.2 m mud-brick walls
  ("Storage architecture should separate materials", VIII:528): FOOD (grain
  sacks on mats, jar rows with mud stoppers, baskets), ROPE (coils as flat
  drums with a dark core, stacked, and two rope-makers coiling), EQUIPMENT
  (sledges, levers, mallets, water jars for the sledge paths), TIMBER
  (cedar baulks; the boatyard keeps its own). Footprints `cargo-yard:ground`
  (passive), `cargo-yard:${bay}:${row}` rows.
- ADMINISTRATIVE SHELTER at (842,−172), the yard's corner on the road from the
  cargo landing: a 4 × 5 m mud-brick room with a doorway, a reed-roofed
  portico (`reedRoof`) over a mud bench, three scribes seated cross-legged
  with writing boards and palettes (`person 'sit'` — the WorkCamp ration-point
  pattern), an overseer with a staff, sealed jars and a basket of clay
  sealings, a tally board; a donkey with panniers waiting. It doubles as the
  landing's checkpoint (BIBLE "customs checkpoints" — in Old-Kingdom terms, a
  recording post). Footprint `admin`. Figures on `harbor-folk`.
- WORN PATHS: thin compacted-earth strips from each landing and ramp to the
  porters' road (passive geometry) — "Paths worn between unloading areas and
  inland transport routes" (§9.23).
- Extra gangs (appended LAST to the extras): yard handlers (806,−228)→(846,
  −170), n 8, still 0.7; landing ↔ yard carriers (870,−188)→(848,−200), n 6,
  carry 0.8. EXTRA_SHARE is already 0.25 in the I5 tree (cap 225 at high);
  extras ≈ 181 after I5, so these 14 fit with extraScale still 1.

### 3.3 Confidence tags (Q3 default: harbour + vessels)

a. `CANON_DIMENSIONS.ts`: `export type Confidence = 'A'|'B'|'C'|'D'|'E'`
   (widen `CanonEntry.confidence` to it), header re-pointed to the Bible's
   Levels A–E (`MASTER_PROMPT_BIBLE.md:796-814`), E = "Clearly marked
   speculative reconstruction".
b. `Footprints.ts`: optional `conf?: Confidence; basis?: string;
   epoch?: string` (epoch = temporal applicability, e.g. `'khufu'` — the
   Phase-4 gate's second half).
c. NEW `src/water/HarbourEvidence.ts`: the table, keyed by footprint-id
   prefix and by vessel class — canon §9.30's "Reconstruction Parameters"
   kept as data, apart from the geometry. A post-pass `stampEvidence()` runs
   after `buildHarbor` + `buildHarborDistrict` (inside `rebuildStructures`)
   and writes `conf/basis/epoch` onto the matching footprints. Vessel
   footprints become `vessel:${cls}:${n}` so the class is in the id
   (closeup's `vessel:` prefix still works). Two passive, ground-`none`
   footprints `basin` and `approach` carry the basin's and the channel's
   tags (outline only). Proposed letters — the rule: the letter is the
   confidence of the FORM AND PLACE shown, the lower of the two:

   | piece (id prefix) | conf | basis |
   |---|---|---|
   | basin, approach | C | a Khufu-era basin and channel at Giza (Sheisha et al. 2022 cores; Merer's "She-Khufu"); plan reasoned |
   | landing:royal, landing:cargo | D | landings implied by the basin and the valley temple's harbour door; form reasoned |
   | bank: (earthen embankment) | D | compacted-earth banks: the conservative default of §9.12 |
   | ramp:t1/t2, landing:cargo-stage | D | plank ramps after the gangplanks of tomb scenes |
   | pier: | E | kept for the brief §2 floor; no Old-Kingdom pile pier known — speculative |
   | staging:, scribe-shade | C | recorded Tura deliveries (Merer); sledge haulage attested |
   | slipway: | D | sledge haulage attested; the stone slipway form reasoned |
   | stone-yard, stone-row:, granite | D | |
   | magazine:, granary | D | storage forms attested elsewhere; location reasoned |
   | hull-on-stocks:, timber:, saw-frame, shade: | C | Khufu I construction evidence |
   | stall: (market) | C | Saqqara market reliefs (5th dyn.) |
   | well: | D | |
   | cargo-yard:, admin | D | recording attested (Merer), the shelter's form reasoned |
   | vessel classes | traveller B, skiff (papyrus) B, ceremonial B (Khufu I), barge C, cargo C, ferry D | per I1b/I2 notes |
   The main session should review the letters against its sources; the
   mechanism is the deliverable.
d. AUDIT: a pure `runEvidenceAudit()` beside the collision audit — kind
   `untagged` for any footprint of `harbor-works`, `harbor-district` or
   `vessels` without `conf`; counter `evidence.untagged` (must be 0);
   `tools/audit.ts` gains the check inside `collisionTest` (note: `--fast`
   skips it).
e. SHOW IT: `?debug=confidence` draws an edge box per tagged footprint, one
   colour per letter (A green → E red; canon :1536 "subtle outlines or
   optional overlay colors"); the Inspector's selection line prints
   `conf D · khufu · <basis>`; the `footprints()` hook and its type gain
   `family`, `conf` (tools can then list them).
f. The moving hulls have no footprint: `fleetAt()` gains `conf` from the class
   table.

### 3.4 Side fixes

S1. Torches (`Torches.ts:93-95`): the two harbour lanterns move to the royal
    landing (§3.1c); position-only (the per-spot yaw draw is unchanged).
S2. `Inspector.ts:253` help line says "E exit" — the key is I.
S3. `HarborDistrict.ts` `reg()` takes an optional ground policy, so the
    slipways and the stone yard stop bypassing it.
S4. Stale comments: `Vessels.ts:1109` and `:1487` moor the barque "north of
    the middle pier" — z −80 is SOUTH of −130 (+z is south; Haiku B6). Both
    go with the barque's move; the `HarborDistrict.ts:194` "by the quay" and
    `Inhabitants.ts` "behind the stone quay" comments too.

FOLLOW-UPS (found, not I6): the basin centre (`GizaControl.ts:111`) and
`BASIN_C` (`HarborDistrict.ts:49`) are hard-coded from the canon temple, while
`edPos('valley-temple')` moves only the temple and the causeway end — an
Inspector nudge desyncs the harbour (B6); bm2 'dawn from the harbor' has no
`t`, so it is not dawn (D6); sycamores and tamarisks sample x 1050–2350 with
no footprint check and can root inside harbour works (D6); the movers, pier
piles, bollards and the tableau's sledge are unregistered (B6).

## 4. Risks

1. FLEET. Pier 2, the barque and the shuttle dock move by design; check each
   with `fleetAt()` and closeups. The shuttle's `planWater` legs run through
   what was the lagoon — open water now, which only adds routes; if A*
   returns null the shuttle or the Tura barge silently falls back to a river
   lane (`:1638`, `:1661`): turn both fallbacks into console.warn and look.
   The Tura route (south shore) and the anchored hulls (x 1050–1240) cannot be
   affected. Moored hulls at piers 1 and 3 must be bit-identical
   (`MOORING_X`). CREWS (finding 9): pier 2's hulls (x ≥ 891 at z −157.5 /
   −142.5) and the barque (x ≈ 889, z −131…−99) sit at basin-formula depth
   d ≤ 0.9 → bed −50.5, 4 m of water — afloat before and after, so the crew
   stream keeps its draw count; assert `afloat` for every moved hull. MOVERS
   are unregistered and untested against structures (9b): add a check that
   samples `fleetAt(t)` every 2 s over each cycle and tests the hull's
   L × B box against the `harbor-works` footprints (allow the dock contact).
2. RNG. No `harbor` draw changes; new streams only; no terrain edit (Shore,
   finding 11). The reed post-filter changes only the clump COUNT of one
   class, hence that class's instance jitter (`spawnClass` draws per spot) —
   cosmetic.
3. FIGURES. Landings are non-passive (their tops are above the terrain under
   them): figures keep off them; the quay gang is re-aimed (§3.1g); expect the
   dropped count to FALL (the lagoon figures come back on dry ground). Log
   `[akhet] inhabitants: …` before/after.
4. AUDIT. `landing:*` (`platform`, `cutting`) vs `bank:*` (passive): no
   overlap reports; `float` and `buried` still apply to the landings — seat
   y0 on the bed under the face. The royal landing's earth ramp touches the
   plain only. Pier roots on the bank vs `bank:*` passive: fine. Check the
   stages and their piles against the moored hulls' `vessels` footprints and
   the skiffs nosed in at T1/T2 (`vessels`, `intra`).
5. PERF. bm1 (gate) frames the basin at distance; bm2 and bm10 frame the west
   shore. Net geometry ≈ the removed mole plus a few hundred boxes; A/B with
   `?hide=vessels,harbor-district` in one sitting, pane closed.
6. CANON. Never present a reconstructed landing as excavated (:1538): the
   tags and DEVIATIONS carry it; the visuals stay modest (low, short,
   earth-dominated).

## 5. Verification checklist

1. Before: `npx tsx tools/tour.ts --only 1,2,10`, `window.__akhet.fleet()` at
   t = 0 and t = 600 (save), the footprint dump (`tools/fpdump.ts` from I5)
   for `vessel:` and `pier:`.
2. Measure first (`tools/ground.ts --wrect`, I5's flag): ground along z −240…
   −20 at x 850…930 (step 10) — the bank line, x_R, x_C; confirm finding 5.
3. After: `tools/closeup.ts --id landing:,ramp:,bank:,pier: --n 3`;
   `--id cargo-yard:,admin --n 3`; `--id vessel: --n 8`.
4. `window.__akhet.fleet()` again: piers 1/3 hulls identical; barque at
   zc −115; shuttle cycling (dock reached, not the lane fallback); the
   mover-vs-structure sweep (Risk 1) clean; the crew count (`harbor.crew`)
   unchanged.
5. `npx tsx tools/audit.ts` — PASS incl. the new evidence check; at boot
   `collision.issues` 0, `evidence.untagged` 0; `?debug=confidence` screenshot.
6. Tour bm1/bm2/bm10 (night: lanterns on the royal landing).
7. A/B perf (Risk 5); `npm run battery` — no src edits while it runs.

## 6. Docs to update

- STATUS.md: "I6 — THE HARBOUR" section in the I4/I5 style, roadmap row
  DONE, the Haiku table (§7), counts (landings 2, ramps 2, embankment metres,
  yard bays, scribes, tagged footprints).
- DEVIATIONS.md — D-14 rewritten: "Chosen (v1.2 I6): no continuous quay. The
  west shore is the dredged earthen bank, dressed and staked, with two short
  stone landings at the deep-water line — the royal landing before the valley
  temple's harbour door, a cargo landing with a timber stage — two plank
  ramps, and the three pile piers kept for the brief §2 floor (tagged E).
  Alternatives (§9.13, documented, not selectable yet): the v1.2 continuous
  quay/mole (E); an all-earth shore without stone (C/D); unloading by
  slipway and sledge (built) vs. straight from the bank over planks
  (smaller cargo, built at T1/T2). Confidence: D overall; per piece in
  `src/water/HarbourEvidence.ts`."
  New D-18 "Confidence tags": the Level A–E scheme (BIBLE:796-814), the
  form-and-place rule, where tags live, how they show.
- README: `?debug=confidence`, the new counters.
- CANON_DIMENSIONS header (finding 15).

## 7. Haiku precision (5 agents, read-only, every row re-read by the verifier)

| agent | task | rows | confirmed |
|---|---|---|---|
| A6 | canon IX §9.11–9.13, 9.21–9.27, Phase-4 gate, brief, D-14 — built? | 30 | 30 — quotes verbatim (one is a heading, its added full stop aside); the gap list (no embankment, ramp, rope store, sealings, water-worn stone, tags, selectable hypotheses) is §3's checklist |
| B6 | the harbour's built inventory, positions from the code | 30 | 30 — independently found the mole (quay off the shore except at its ends) and pinned quayEdgeX to the probe's borderline step (925–933); the wrong "north of the middle pier" comment; the temple-vs-basin desync |
| C6 | the fleet's dependence on the quay; planWater; streams | 30 | 30 — the one geometry-coupled stream (crews via `afloat`), the silent A* fallbacks, unregistered movers with no clearance test, `WalkRig` skipping the quay |
| D6 | water, ground, plants, people, lanterns, bookmarks | 29 | 29 — the waterline contour (x ≈ 875 mid-run, 919 at the ends), the drowned lantern, reeds inside the quay's ends, the gang in the lagoon; its numbers are analytic and say so |
| E6 | confidence mechanisms and conventions | 30 | 30 — A–D only in code, no reader, no Footprint field, the overlay hook, `--fast` skipping world checks, the two Level/Tier scales |

TOTAL 149 rows, 149 confirmed (100 %).
VERDICT: briefed with the I5 lesson ("check against the CODE that places
things, not only fpReg"), the five agents made no site error this time; the
two that had to reason about terrain (B6, D6) labelled their numbers analytic
and converged on the same contour as the verifier. The I5 pattern — the build
question, distinct tasks, numbers derived from code — holds at 98–100 %.
