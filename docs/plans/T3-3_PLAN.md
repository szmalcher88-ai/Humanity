# T3-3 — KHUFU_EARLY: THE FOUNDATION AND THE LOWER COURSES (build plan)

> REFRESHED 2026-10-28 by the read-only side session on `9fbcc9b`
> (v1.2-detail = main). The first version (2026-10-21, `c326e21`) predates
> T2-7, the HUD's epoch switch, FIX-27 and FIX-27b, and several of its
> findings and two of its ★ went stale (§0). Nothing in `src/` or `tools/`
> was touched. Scope as briefed: the canon's "Early foundation / Lower
> courses under construction" (IX's KHUFU_EARLY) — G1's first courses, the
> platform laid out, the supply ramp's early stage, the quarry opening,
> the complex that early, the camp and the harbour. The human is away:
> every decision carries a ★.
> CONTRACTS, bit for bit: default 1142, KHAFRE 1120, MENKAURE 1179,
> LATE 1198 (`shots/fix27/fp-late.json`) and 1200 with `?haul=0`
> (`shots/fix27/fp-late-h0.json`) — `STATUS.md:526-532`. Every EARLY change
> is a JS-level `if` on `early(e)` (true in KHUFU_EARLY only); LATE never
> enters one. Deviation: D-28 (D-27 is FIX-27's, `DEVIATIONS.md:473`).
> Heights marked (model) are the verifier's hand ports: R5 — every one is
> a MEASUREMENT step in §4, never a constant.

## 0. What changed since the first plan

| as built | effect on T3-3 | § |
|---|---|---|
| FIX-27 rewrote `G1Works.ts`: the zigzag PLANNED (`planLegs`), the supply ramp stopping at a junction band (8-step iteration), a top landing, `route[]` | with the built top at or below the ramp's arrival, `planLegs` returns `[]` and `:152` throws — EARLY needs its own no-zigzag path; and the old H-1 (the first course ABOVE the arrival) leaves the ramp short of the platform | 3.2, 3.3 |
| FIX-27: `HaulTrains.ts` (animated teams, `hauling(e)` = `lateWorks` + `?haul≠0`, TRUE in EARLY by inheritance); the quarry loop needs `KhufuLateWorks.rampRoute`, the Tura loop `causewayRoute` | the old plan skipped KhufuLateWorks in EARLY — EARLY now keeps it in an EARLY arm, so both loops have their routes | 3.4, 3.5 |
| T2-7: the escarpment swung west and low; LATE's second face moved to (125, 421) | the bowl's east half stands on the escarpment's edge blend in EVERY epoch (finding 21); EARLY's factors re-checked; the face at (125, 421) lies on EARLY's full-depth floor | 3.4 |
| HUD epoch switch: KHUFU_EARLY listed greyed (`built` false) | flip it (and stop typing the list three times) | 3.9 |
| contracts: LATE 1190 → 1198 (1200 with `?haul=0`); D-27 taken | T3-3 is D-28 | header |

## 1. Verified findings

### 1.1 The canon (carried from the first plan; its key lines re-read at `9fbcc9b`)

1. EARLY is "Khufu's reign, earlier construction activity" (`VOL_IX.md:120`)
   and the Bible's "Early foundation. / Lower courses under construction."
   (`MASTER_PROMPT_BIBLE.md:3016-3017`) — no height, order or date. Presets
   "modify visible construction equipment, workforce distribution, and
   surrounding logistics" (`:3023`, carried).
2. FOUNDATION RECONSTRUCTION: "The foundation should not be represented as
   a perfectly flat artificial platform" (`:3061`) … "leveling trenches"
   (`:3066`); bedrock protruding into the monument preserved
   (`:3058-3067`). The knoll under G1 (`GizaControl.ts`, `BEDROCK_KNOLLS`
   `[0, 0, 170, 2.6]`, `:156`) is erased by the G1 pad in every world.
3. Carried unchanged (not re-read): the quarry's chain opens with "Bedrock
   Survey" (`VOL_VIII.md:448`); the harbour "incompletely established" with
   no quay by default (`VOL_IX.md:505, 567`); D-16's West Field nucleus
   "every second row built" (`DEVIATIONS.md`, D-16).

### 1.2 G1's works under a LOW top (Haiku A)

4. `buildG1Works(scene, seed, hf, gi, builtTop)` (`G1Works.ts:54-56`); the
   supply ramp's axis TOE (10, 236) → HEAD (−8, 147) at 10 % on a 9.5 m
   deck (`:30-33`), `gToe = grd(10, 236)` (`:89`). `rampRun(null)` stops at
   the FACE (`:142`: segment centre − DECK/2 < `zf(y)`), `rampRun(zStop)` at
   the junction band (`:136-147`). Arrival at the face (model): 43 segments,
   deck = gToe + 12.9 m — ≈ 12.3 m with gToe ≈ −0.6 (M1).
5. `planLegs` loops `while (y < builtTop − 0.05 && out.length < 14)` from
   the ramp's deck (`:108`) — with builtTop at or below the deck it returns
   `[]`, and `(legs[0] as Leg).z` THROWS at `:152` (the 8-step iteration);
   `:226` (`l0`, the junction) would too. TerrainScene has no try/catch —
   the whole structures rebuild aborts. All other `legs` uses are guarded
   (`:129-130, 242, 270-271, 312`).
6. The rest of the function: the junction (`:221-240`, id
   `g1-ramp:junction`), legs and open landings (`:242-295`), the top landing
   (`:296-310`, `g1-ramp:top`, TL 9, the drop at `hw(builtTop) − 8`), the
   platform at T (`:315-373`: the half-laid course, the delivered sledges
   at `route[last]` `:344-351`, ten staged blocks, the survey station
   `:363-367`, `g1-works:platform` `:368-372`). Streams `g1-ramp`,
   `g1-works`, `g1-folk` (`:58-60`), no forks. `info.rampTop` is the
   JUNCTION's deck since FIX-27 (`:189`), not the face's.
7. `g1.landingSpareCm` (`TerrainScene.ts:175`) is 60 BY CONSTRUCTION:
   LAND = max(10, R + 5.2) and the stacking rule (`:130`) forces R ≥ 5.25
   (`G1Works.ts:276-280`) — and Infinity with no landing.
8. The built course: the FIRST course whose top is STRICTLY above
   `frac × H` (`PyramidSpec.ts:185-187`); `g1BuiltTop(seed)` repeats the
   solve with the constant `G1_BUILT_FRAC` 0.5 (`Monuments.ts:59, 64-78`),
   on the same pure stream `monument-G1` (its first draw the `courses` fork,
   `PyramidSpec.ts:99, 181`), for the probe GI at `TerrainScene.ts:70`; the
   G1 `add()` passes `G1_BUILT_FRAC` under `building` (`Monuments.ts:149,
   162`). The heightfield is baked before `:70` (`TerrainScene.ts:59`).
9. The header still says "KHUFU_LATE only" (`G1Works.ts:2`); the gate is
   `building`, via `spec.built.top` (`TerrainScene.ts:168-171`).

### 1.3 The haul trains and their routes (Haiku B)

10. Two loops (`TerrainScene.ts:189-199`), both inside `if (lateWorks)`
    (`:180`) and `if (hauling && g1Route)` (`:189`): `'haul-trains'`, 20
    teams on `quarryRoute(lw.rampRoute, g1Route)` (`:191`); `'haul-tura'`, 8
    teams on `lw.causewayRoute` (`:197`). `quarryRoute` (`HaulTrains.ts
    :643-674`): the ramp reversed (floor → lip), a run-in 10 m past its
    foot, the loading place `LOAD_EAST` 14 m east of it (`:111`), the lip
    onto the ROAD (68, 286) → (24, 258) (`:114`), 10 m before G1's toe, then
    `g1Route` — `g1Route[0]` and `[1]` unguarded (`:668-669`).
11. Each loop on its own named stream (`:690`); no footprints; counters
    `late.haulTeams / haulLoopM / haulMinTurnCm / turaTeams / turaLoopM`
    (`TerrainScene.ts:192-199`); a console warning when a turn is under
    LANE + 1.2 = 3.0 m (`HaulTrains.ts:707`). Teams spread evenly in TIME
    round the loop (`:741`); per-frame cull and a lite stand-in past 350 m
    (`:591-636`).
12. KhufuLateWorks (`KhufuLateWorks.ts:57-61`, streams `quarry-late`,
    `tura-yard`, `quarry-folk` `:63-65`): faces `west` (−32, 478) and `ene`
    (125, 421) (`:142, 146`), each with a STATIC sledge team (`:133-135`, not
    gated by `hauling`); the transport ramp from the lip A (70, 306) toward
    B (90, 390), built down at ≤ 12 % and on until its deck meets the floor
    (`:148-178`; `rampRoute` `:177-178`, `rampEndLip` → counter
    `late.rampEndLipCm`, `TerrainScene.ts:185`); `causewayRoute` from the
    complex's `causewayDeck` + `CAUSEWAY_LATE_LIFT` (`:271-279`); the three
    static causeway sledges skipped when hauling (`:280`). The 40 quarrymen
    `khufuLateLines` walk (−20, 474) → (86, 394) (`:39-41`), added under
    `lateWorks` (`TerrainScene.ts:294`).
13. Inhabitants: under `hauling` the trains [1, 2] (`HAUL_ROAD_TRAINS`,
    `Inhabitants.ts:827`) lose their footprints (`:401`) and are drawn into
    scrap writers (`:662-672`) — no stream moves; TRAINS[0] (40, 380) stays.

### 1.4 The quarry and the ground after T2-7 (Haiku C)

14. The bowl: centre (100, 450) (B), RX 210, RZ 145, rot 0.26, depth 13
    (`GizaControl.ts:147-152`); `dq` (`:424`), `bowl = smoothstep(1, 0.35,
    dq)` (`:429`), depth × the SE exit sector (`:430-432`), `quarryMask =
    smoothstep(0.995, 0.9, dq)` (`:433`) → the detail-noise gate (`:537`),
    the fields texture's quarry channel (`Heightfield.ts:247`) → the
    terrain material, micro-displacement, the probe GI's albedo, the sand
    sweep (`SandTransport.ts:97`). `worked` has no quarry term (`:700`). The
    long axis runs ENE: tips (model) E (303, 396), W (−103, 504).
15. The carve (`src/gpu/passes/QuarryCarve.ts`): 1.12 m lifts with sharp
    risers (`:32, 64-71`); a 0.5 m-deep, 0.55 m-wide trench grid at 2.6 m
    pitch wherever the terraced depth is 0.4–9.5 m, full from 1.2 to 6.0 m
    (`:33-35, 74-82`). Both bakes (`Heightfield.ts:113, 137, 141, 144`) take
    `gp.epoch` (`:107`).
16. T2-7: 16 escarpment vertices (`GizaControl.ts:69-95`, the new four at
    `:83-86`); the local run-out (`:322`) and the escarpment profile act
    only east of the crest; but the PLATEAU EDGE BLEND `smoothstep(−160, 0,
    sdE)` (`:334-342`) lowers the pre-quarry surface within 160 m of the
    crest — the bowl's east half (x ≳ 150) in EVERY epoch: ≈ 9 m at
    (201, 423), ≈ 23 m at the east apex (model). The wobble is damped near
    the Sphinx (`:313-318`). The only epoch `if`s are KHAFRE / MENKAURE
    (`:451, 578, 621`) — the bowl is the same in LATE and the default.
17. Everything in or at the bowl stands on `heightAtCpu`: the debris and
    dust anchors (`Debris.ts:91-99`, `Particles.ts:155`), the gangs
    (`Inhabitants.ts:280-286`), TRAINS[0] (40, 380), the shelter (60, 470)
    (`:810-812, 831`), LATE's faces and ramp (`KhufuLateWorks.ts:62`). No
    fixed-Y item but the Sphinx (KHAFRE only).
18. `tools/ground.ts` takes only `--rect` / `--wrect` (`:17-20`) and boots
    the DEFAULT world (`:23`); its siblings take `--q` (`fpdump.ts:32-33`).

### 1.5 The complex, the fields, the life (Haiku D)

19. KhufuComplex's parent stream `khufu-complex` (`KhufuComplex.ts:349`)
    forks, in order: `pavement` (`:381/383`), `mt-pillars` (`:455/483`),
    `causeway` (`:525`), `boatpits` (`:702/704`), `mastabas-west` (`:772`),
    `mastabas-east` (`:865`) — each taken on every path. Draw-free gates:
    the court and temenos (`:381-441`, `underConstruction`), the mortuary
    temple's footings (`:447-461`, the fork at `:455`), the causeway's walls
    and roof (`:619-630`), the valley temple's footings (`:672-674`, its
    footprint's `y1` at `:696`), the queens' chapels (`:750`: under
    `lateWorks` only G1-a's).
20. The West Field: pass 1 draws per plot (`:789-815`; a branch before the
    robbed-plot `continue` at `:793` would move every later plot); pass 2
    (`:818-850`) draws nothing — the clean place to thin (`westTombs.push`
    `:849`). The East twins draw seven values each (`:867-875`), pushed at
    `:900`; the return at `:922`. The family courts roll once per slot and
    skip a slot whose tombs are missing (`Necropolis.ts:189-193`); east
    courts are one per twin (`:253-283`).
21. Monuments: queens with `QUEEN_LATE` under `lateWorks` (`Monuments.ts
    :176-205`), G1-d skipped under `lateWorks` (`:209`), each on its own
    named stream (`:122`).
22. Inhabitants: one shared `extraScale` for all extra gangs (`:72-73`), and
    the parent `inhabitants` stream (`:370`) draws per gang and forks per
    gang (`:442`) — so changing the extras moves the later forks `fig-*`
    (`:636`), `trains` (`:661`), `scaffold` (`:736/742`). Fine for EARLY's
    own world; nothing may be added to LATE's extras.
23. The second Tura barge: `late` parameter of the harbour
    (`src/water/Vessels.ts:1433`, `tura-barge-late` on named streams
    `:1896-1901`), passed `lateWorks` (`TerrainScene.ts:203`). Clearings
    (`src/vegetation/Clearings.ts:16-30`) read only non-passive works
    footprints — `quarry-works:ramp:*` in the building worlds.

### 1.6 The epoch plumbing, the HUD and the tools (Haiku E)

24. `Epoch.ts`: `IMPLEMENTED` (`:36`, not exported) lacks KHUFU_EARLY;
    `FALLBACK` maps it to KHUFU_LATE (`:37-39`); `building` (`:67-70`),
    `lateWorks` (`:76-79`), `hauling` (`:84-87`) each read a URL switch, and
    each is TRUE under Node (`typeof window === 'undefined'`), so the
    audit's gates follow the epoch name alone.
25. The HUD's menu types the list by hand with `built` false for KHUFU_EARLY
    (`HUD.ts:96-103`, `:97`), greys it (`:128-135`) and reloads with the
    pose (`:139-145`); `main.ts:226-228` types the built list a third time.
26. The audit: `--epoch` (`tools/audit.ts:66-71`); the G1 row from
    KHUFU_EARLY (`:82`); the LATE G1 rows under `building` — "built to the
    course passing H/2", "> 30k stones", "no stone above the top"
    (`:135-146`) — would FAIL in EARLY; the queens under `lateWorks`
    (`:147-160`); in the browser part, under `lateWorks`: 37 vessels and
    > 20 face blocks (`:353-355`). Nothing in `tools/` checks the haul
    trains or G1Works' legs. The battery runs the default world only
    (`battery.ts:73`).
27. Tools: `fpdump --q --out --id` (`fpdump.ts:25-33`), `perf --bm --runs
    --q --b` (`perf.ts:47-54`), `tour --out --only --q` (`tour.ts:34-44`),
    `closeup --id --n --q` (`closeup.ts:38-53`); `ground.ts` no `--q`
    (finding 18). bm15 'the rising pyramid' (40, 8, 330) carries
    `epoch: 'KHUFU_LATE'` (`Bookmarks.ts:74`), which only the `=` key reads
    (`:133`); `?bm=15` boots whatever `?epoch=` says.

## 2. Decisions (★ = recommended default — the main session decides)

| # | question | ★ default | alternatives | vs the first plan |
|---|---|---|---|---|
| E-1 | the gate | ★ `early(e) = building(e) && !atLeast(e, 'KHUFU_LATE') && ?kearly ≠ 0`; `building`, `lateWorks`, `hauling` keep their meaning (true in EARLY), so EARLY INHERITS LATE and branches with `early()` at the sites in §3.1 | narrow `lateWorks` (would hand EARLY the finished temple and queens) | kept; now under `building`, so `?klate=0` gives the finished pyramid in EARLY as in LATE |
| H-1 | how high | ★ the LAST course whose top is AT OR BELOW the supply ramp's arrival at the face, computed at boot from the baked ground (no constant): ≈ 10 courses, ≈ 11.7 m (model) | the first course above it (the first plan — the straight ramp then ends below the platform); ≈ 5 courses | CHANGED: below the arrival the straight ramp reaches the platform by itself (G-1) |
| G-1 | G1Works in EARLY | ★ a no-zigzag path: no `planLegs`, no iteration, no junction; the ramp climbs to the built top (its last segment cut short), a level walled top landing to the face, the route toe → ramp end → drop on the platform | catch `[]` in the LATE path (a stub leg at best) | NEW (FIX-27's code throws on `[]`) |
| Q-1 | the quarry terrain | ★ unchanged: the same bowl, `dq / 0.75` (radii × 0.75) and depth × 0.45 (≤ 5.9 m) under `early`; its ENE tip pulls back to ≈ (252, 410) (model), the east half on the edge blend as in every world (finding 16) — measured in M2 | radii only on RX; the full bowl | kept, re-checked against T2-7's ground |
| QW-1 | the quarry works | ★ KhufuLateWorks' EARLY arm: no `west` face; the `ene` face (125, 421) is the OPENING face — on EARLY's full-depth floor (dq ≈ 0.28, model) by the ramp's foot; the transport ramp unchanged (it adapts — built down from the lip until it meets the floor); the stack, the Tura yard, `causewayRoute` as LATE; the 40 quarrymen not added | an EARLY stream `quarry-early` with its own face (the first plan) | CHANGED: the loops need `rampRoute` and `causewayRoute`, and the whole EARLY bowl lies in the trench band (finding 15) — teams cannot run on its bare floor |
| HL-1 | hauling | ★ both loops; the quarry loop on EARLY's routes at LATE's SPACING — teams = round(loop / (LATE's loop / 20)), ≥ 6 (M4); the Tura loop as LATE, 8 teams (the casing goes in course by course) | no teams in EARLY (`hauling` false under `early`) | NEW |
| P-1 | the platform | ★ survey on the platform (stakes, cords, a sighting station, a levelling crew; stream `g1-survey`) + levelling trenches on the apron as dark strips with low spoil lips; the knoll not shown | a hollow core showing the knoll | kept |
| C-1 | the complex | ★ no queens, no chapels, no mortuary temple (its fork kept), the causeway's foundation (as LATE), the valley temple's platform without footings, the West Field's four columns nearest G1 as cores, no East Field | LATE's states | kept (sites refreshed) |
| H-2 | camp, town, harbour | ★ LATE's minus the second barge (`buildHarbor(…, lateWorks && !early)`) | a smaller town (D-6 — the human's) | kept |
| U-1 | the HUD | ★ KHUFU_EARLY built; export `IMPLEMENTED` and derive the HUD's `built` and `main.ts`' list from it | flip the literal | NEW |
| B-1 | a view | ★ none new: `?bm=15&epoch=KHUFU_EARLY`, bm7 | a survey close-up mark | kept |

## 3. Design (★)

### 3.1 The epoch and the branch sites (E-1)

- `Epoch.ts`: `IMPLEMENTED` gains `'KHUFU_EARLY'` and is exported;
  `FALLBACK` becomes `{}` (a typo still falls back to the default, `:51`);
  new `early(e)` as E-1 (`?kearly=0` the A/B arm). The comment at `:33-35`
  updated.
- The sites, each a JS-level `if` LATE never enters:
  - `TerrainScene.ts:70` and `:127`: the EARLY fraction (§3.2) for the probe
    GI's top and the G1 `add()`;
  - `TerrainScene.ts:171`: `buildG1Works(…, top, early(e))` (§3.3); the
    counters `:172-175` (+ `g1.rampFaceCm`, `g1.topLandCm`; the spare only
    when `zigzagLegs > 0`);
  - `TerrainScene.ts:181`: `buildKhufuLateWorks(…, hauling(e), early(e))`
    (§3.4); `:191` the team count (§3.5); `:203` `buildHarbor(…, lateWorks
    && !early)`; `:294` `khufuLateLines` only `lateWorks && !early`;
  - `GizaControl.ts:424, 430-432`: the EARLY bowl (§3.4);
  - `Monuments.ts:176-205`: the queens' `add()`s skipped under `early`
    (named streams — nothing moves); G1-d already absent (`:209`);
  - `buildKhufuComplex(…, early)` (§3.7);
  - `tools/audit.ts`: `:135-146` under `building && !early`, `:147-160`
    and `:353-355` under `lateWorks && !early`; the EARLY rows (§4).

### 3.2 How high (H-1)

- The rule: G1 to the last course whose top is ≤ the deck where the
  straight supply ramp meets the face. Then the ramp reaches the platform
  by itself (G-1) — "lower courses under construction" served by D-7's
  ramp alone, the zigzag not yet begun.
- Mechanism (no constant; the ground decides):
  1. `G1Works.ts` exports `g1RampFace(grd)`: `rampRun(null).deck` without
     building anything (the axis, `zf` and the constants lifted to module
     scope; LATE's path unchanged).
  2. `Monuments.ts` exports `g1EarlyFrac(seed, face)`: `solveCourses` on
     `monument-G1` (pure per name, finding 8), k = the last course with
     top ≤ face, and returns (top of course k − 1) / H — so PyramidSpec's
     strict `>` (`PyramidSpec.ts:185`) picks course k. `g1BuiltTop(seed,
     frac = G1_BUILT_FRAC)` takes the fraction.
  3. `TerrainScene.ts`: `const g1Frac = early(e) ? g1EarlyFrac(seed,
     g1RampFace((x, z) => hf.heightAtCpu(x, z))) : G1_BUILT_FRAC` before
     `:70`; `g1BuiltTop(seed, g1Frac)` at `:70`; `buildMonuments(…, epoch,
     g1Frac)` → `add('G1', …, g1Frac)` (`Monuments.ts:162`), its evidence
     basis "the lower courses; the course by the supply ramp's reach
     (D-28)", epoch tag `khufu-early` (not in the dump).
- Model: arrival 12.3 m, ≈ 10 courses, top ≈ 11.7 m, ≈ 22 % of the volume,
  a ≈ 212 m platform. All of these are READINGS (M1), not inputs.

### 3.3 G1Works in EARLY (G-1)

`buildG1Works(…, builtTop, early = false)`:
- `info.rampFace = rampRun(null).deck` (all building worlds; counter
  `g1.rampFaceCm`).
- `if (!early)`: today's `planLegs`, the iteration, the junction, the legs
  and landings — untouched (`:149-156, 221-312`).
- `if (early)`:
  - the ramp's run stops where the NEXT segment's deck would pass
    `builtTop`; the segment body factored into a helper, draw for draw
    (LATE's dump must not move), plus one short last segment of
    `(builtTop − deck) / GRADE` m, so the deck ends AT the top. It is
    always outside the face: the top is ≤ the arrival (H-1).
  - the TOP LANDING: level at T from the ramp's end to inside the face:
    `piece(xa − JW, xa + JW, T, T, za + 1.6, false)` (`:199-213`), end
    walls on both sides (`:214-217`), footprint `g1-ramp:top`. Length ≈ 9 m
    (model): `g1.topLandCm`.
  - `route`: the toe; the ramp's end (xa, T, za); then ON along the ramp's
    axis to the drop at z = `hw(T) − 8` on the platform. The axis is
    straight, so there is no corner; the delivered sledges follow the drop
    (`:344-351`).
  - `zigzagLegs` 0; `landingSpare` left out of the counters.
- The platform (`:315-373`) as built; T ≈ 11.7 (model).

### 3.4 The quarry (Q-1) and its works (QW-1)

- Terrain: `if (early(gp.epoch))` at the quarry term — `dq` divided by
  0.75 (`:424`), so the bowl, the exit sector and `quarryMask` shrink
  together, and the depth × 0.45 (`:430-432`). It is a JS-level `if`: the
  other worlds' graphs are identical (finding 16), and both bakes follow
  (finding 15).
- What the EARLY bowl is (model, all to M2):
  - ≤ 5.9 m deep: five 1.12 m lifts, and the trench grid over its whole
    floor (full strength from 1.2 to 6.0 m, finding 15). The quarry is
    OPENING: no finished floors.
  - Its east half stands on the escarpment's edge blend (finding 16): the
    floor falls east by ≈ 9 m at (201, 423) before the carve. The tip is
    ≈ (252, 410), 50 m short of LATE's apex.
  - ★ Accept that: it is the same ground every world shows there, and a
    quarry opening downhill is how the blocks went out.
- KhufuLateWorks' EARLY arm (`buildKhufuLateWorks(…, hauling, early =
  false)`):
  - `if (!early)` around `face('west', …)` (`:142`); its rng draws move
    only EARLY's later draws.
  - `face('ene', 125, 421, …)` stays: the opening face, by the ramp's
    foot. EARLY's ramp ends where its deck meets the shallower floor, at
    ≈ (95, 411) (model); LATE's ends at ≈ (96, 416).
  - The transport ramp, the stack, the Tura yard, `causewayRoute` and
    the `hauling` skip of the causeway sledges are as LATE.
  - The ramp's first ≈ 38 m (model) run on the unquarried plateau before
    EARLY's rim, as a 0.3 m embankment, which is accepted.
  - No `khufuLateLines` (they walk to the west face).
- Everything in the bowl follows `heightAtCpu` (finding 17).

### 3.5 Hauling in EARLY (HL-1)

- The quarry loop: `quarryRoute(lw.rampRoute, g1Route)` as built. EARLY's
  `g1Route` is three points (§3.3), and `[0]`/`[1]` exist.
- Teams: `early ? Math.max(6, Math.round(loopM / HAUL_SPACING_M)) : 20`.
  `HAUL_SPACING_M` = LATE's measured `late.haulLoopM` / 20, a constant with
  its measurement in the note (M4). The loop is built before the team
  count is known: build the route, take its length, then the teams.
  `buildHaulTrains` takes TEAMS after `buildLoop`, so the count can be
  derived inside it from an optional spacing argument (LATE passes none).
- The Tura loop: as LATE (8 teams, `'haul-tura'`).
- The static face sledge stays as in LATE (follow-up, §6).

### 3.6 The platform being laid out (P-1)

- On the platform (stream `g1-survey`, EARLY only, appended last): corner
  stakes and cords along the four edges and the two axes, a plumb-and-
  sighting station on the centre (beside G1Works' own, `:363-367`), a
  levelling crew with water trays — static figures (`person`) — canon
  "measuring stations … surveying equipment" (`MASTER_PROMPT_BIBLE.md
  :3244-3256`, carried).
- The apron (pad level 0, `GizaControl` g1Pad): a trench ring 3 m outside
  the base line and a coarse 10 m grid of levelling trenches 6–30 m out —
  dark GeoWriter strips at grade with 0.15 m spoil lips (a terrain carve
  would vanish below the safe preset's texel). The strips stop at every
  footprint, read from `fpAll()`: the supply ramp, the causeway's
  foundation, the queens' terrace edge. Not registered, as flat dressing.
- The knoll: ★ not shown (D) — the 11.7 m solid core encloses it.

### 3.7 The complex (C-1) — `buildKhufuComplex(…, building, lateWorks, early = false)`

| element | LATE | ★ EARLY | where | streams |
|---|---|---|---|---|
| queens G1-a/b/c | done / half / begun | none started | `Monuments.ts:176-205` skip | named — none move |
| queens' chapels | G1-a's | none | `KhufuComplex.ts:750` `lateWorks && (early ∥ qi > 0)` | draw-free |
| mortuary temple | footings | absent | `:447-461`: boxes and footprint under `!early`, the `mt-pillars` fork (`:455`) KEPT | fork kept |
| causeway | foundation | the same | — | — |
| valley temple | platform + footings | platform only | `:672-674` under `!early`; `y1` at `:696` | draw-free |
| West Field | every second row | the same, columns 0–3 only (nearest G1), CORES (no chapel) | pass 2 `:818-850`: `if (early && q.col > 3) continue` after `:820`; chapel under `!early` | pass 2 draws nothing |
| East Field | 8 twins | none | `:867-900`: after the seven draws, `if (early) continue` before geometry and push | fork's draws kept |
| family courts | around the built tombs | around EARLY's cores only (they follow `westTombs`; no twins → no east courts) | `Necropolis.ts:189-193, 253-283` | rolls kept per slot |

### 3.8 Camp, town, harbour (H-2)

- The camp and the works yard as in LATE (`khufuWorks`). The town is the
  default's (D-6). The harbour is LATE's without `tura-barge-late`: the
  vessels count is 36.

### 3.9 The HUD, the notice, the switch, the views (U-1, B-1)

- `HUD.ts:96-103`: `built = IMPLEMENTED.includes(epoch)`, KHUFU_EARLY's
  label "Khufu — the lower courses". `main.ts:226-228`: the list from
  `IMPLEMENTED`.
- `?kearly=0` under `?epoch=KHUFU_EARLY`: `early()` false, which is the
  LATE world (the A/B arm and the leak check, M7).
- No new bookmark. bm15 `?bm=15&epoch=KHUFU_EARLY` (M6) and bm7.

## 4. Measurement, cost, audit (R5: the recon chooses, the build measures)

M0, BEFORE (today's tree):
- `npx tsx tools/fpdump.ts` (1142), with `--q "epoch=KHAFRE_PERIOD"`
  (1120), `"epoch=MENKAURE_PERIOD"` (1179), `"epoch=KHUFU_LATE"` (1198),
  `"epoch=KHUFU_LATE&haul=0"` (1200), against `shots/fix27/fp-*.json`.
- Read `late.haulLoopM` in LATE, which gives `HAUL_SPACING_M` (M4).

THE BUILD in one pass (no level is a constant), then:

| M | what | how | expect (model) / gate |
|---|---|---|---|
| M1 | G1's height and the ramp | `?epoch=KHUFU_EARLY` counters `g1.rampFaceCm`, `g1.builtTopCm`, `g1.zigzagLegs`, `g1.rampSegments`, `g1.topLandCm` | face ≈ 1230, top ≈ 1170 (≈ 10 courses), legs 0, landing ≈ 900; GATE top ≤ face < top + 160 |
| M2 | EARLY's ground | `ground.ts` gains `--q` (2 lines, as `fpdump.ts:32-33`), then `--q "epoch=KHUFU_EARLY"`: `--wrect "60,420,140,480"` (centre floor), `"118,415,132,427"` (the face), `"66,300,100,420"` (the ramp axis), `"150,390,260,440"` (the east half), `"35,375,45,385"` (TRAINS[0]), `"55,465,65,475"` (the shelter) | centre ≈ plateau − 5.9; the face's spread ≤ 1.9 m (LATE's rule) — else move its centre along the floor and record; the east fall recorded (≈ 9 m at x 201) |
| M3 | the EARLY transport ramp | `late.quarryRamp`, `late.rampEndLipCm`; `window.__akhet.haulRoute()` points over the ramp | lip ≤ 5 cm; the deck never rises > 5 cm going down (a trench under a segment centre could bump it — ★ then clamp it monotone under `early`); foot within 10 m of LATE's |
| M4 | the teams | `late.haulLoopM`, `late.haulTeams`, `late.haulMinTurnCm`, the console | teams = round(loop / spacing) ≥ 6 (model ≈ 8); min turn ≥ 300 cm, no warning |
| M5 | the apron and the survey | `audit.ts --epoch KHUFU_EARLY` collisions; `closeup.ts --id g1-ramp:,g1-works: --n 3 --q "epoch=KHUFU_EARLY"` | clean; the strips stop at the ramp and the causeway |
| M6 | bm15 under EARLY | `tour.ts --only 15,7 --q "epoch=KHUFU_EARLY"` | the eye ≥ 1.2 m over EARLY's ground at (40, 330) (it is ≈ 0.8 m higher than LATE's there, model) |
| M7 | the leak check | `fpdump --q "epoch=KHUFU_EARLY&kearly=0"` against LATE's 1198 by id | Δ 0 — every EARLY line sits behind `early()` |

- CONTRACTS after: the five dumps of M0 must match exactly, by id, with
  Δ ≤ 5 cm. Then the first EARLY baseline: `--q "epoch=KHUFU_EARLY" --out
  shots/t33/fp-early.json`. Account for every family by id against LATE's:
  the queens, the chapel, the mortuary temple, the zigzag, the West Field
  columns ≥ 4, the East twins and their courts, the west face, plus
  `g1-ramp:top`.
- A/B: `npx tsx tools/perf.ts --bm 15,7,3 --runs 3 --q "epoch=KHUFU_EARLY"
  --b "kearly=0"`. RULE ★: fps medians A = B or better, scene Δ ≤ 1.5 ms.
  EARLY is the cheapest Khufu world: ≈ 10 of G1's courses, no zigzag,
  fewer tombs and teams.
- The audit (`--epoch KHUFU_EARLY`):
  - the LATE rows are skipped as in §3.1;
  - EARLY rows from the counters:
    - G1 "to the supply ramp's reach": legs 0, top ≤ face < top + 160;
    - "one face, the ramp to the floor": 10 < `late.faceBlocks` ≤ 20, lip ≤ 5;
    - "one Tura barge": `harbor.vessels` === 36;
    - "teams": `late.haulTeams` ≥ 6, `late.turaTeams` === 8, min turn ≥ 300;
  - plus collisions;
  - the other four worlds PASS as today.
- The battery: the default world. No change expected.

## 5. Risks and checklist

1. A LATE leak (1198 / 1200) is the contract that counts. Every EARLY line
   is a JS-level `if` on `early()`, M7 proves it, and LATE's G1Works path
   is not refactored except the segment helper, which is draw for draw.
2. G1Works throwing: EARLY must never reach `planLegs`. The `early` branch
   is taken before `:150`.
3. The extras coupling (finding 22): EARLY drops `khufuLateLines`, so its
   `extraScale` and later forks differ. That affects EARLY only.
4. The bowl's east fall (finding 16): accepted, and M2 records it.
5. The ramp's deck over the trench grid: M3.
6. A short quarry loop: the team count follows the spacing (M4). The drop
   dwell is 50 s.
7. Checklist: M0–M7; the five contracts; the EARLY baseline; the audit for
   all five epochs; the tour under EARLY (bm15, bm7, bm3); perf A/B; the
   HUD switch EARLY ↔ LATE in the browser.

## 6. Docs

- STATUS "T3-3". DEVIATIONS D-28, covering:
  - EARLY's height by the supply ramp's reach (the last course ≤ the arrival);
  - the no-zigzag path and its top landing;
  - the smaller, shallower bowl on T2-7's ground;
  - the opening face;
  - the teams at LATE's spacing;
  - the survey and the levelling trenches;
  - the knoll not shown;
  - the complex's EARLY states;
  - the West Field's four columns of cores.
- README: `?epoch=KHUFU_EARLY`, `?kearly=0`, `ground.ts --q`. The
  G1Works header: "the building worlds".
- From the recon, for later:
  - The lite team variants fork AFTER the full ones (`HaulTrains.ts
    :714-724`; `Seed.ts:106-108`: a fork consumes a parent draw), so a
    team changes figures at 350 m. The comments at `:40-41, 715` say "the
    same draws".
  - `g1.landingSpareCm` is constant (finding 7).
  - The Tura loop is gated on `g1Route` (`TerrainScene.ts:189`), which it
    never uses.
  - The face sledges stand static beside the animated teams
    (`KhufuLateWorks.ts:133-135`).
  - The causeway's envelope footprints under `lateWorks` (`KhufuComplex.ts
    :636-652`) have no walls.
  - Stale comments: the Sphinx enclosure's "daylights at x ≈ 484–495"
    (`GizaControl.ts:458-460`), the "WORKED" quarry floors
    (`TerrainTiles.ts:146`), "eleven bookmarks" (`tour.ts:6`).
  - The trench pitch is copied by hand (`KhufuLateWorks.ts:107-108`).
  - SouthWorks and G1Works use opposite TOE/HEAD axis signs.

## 7. Haiku precision (refresh, `9fbcc9b`)

Five read-only Haiku agents (the `haiku-recon-3d` skill). The verifier
checked every row at its line; model numbers were only checked as
arithmetic.

| agent | task | rows | confirmed | notes |
|---|---|---|---|---|
| A | G1Works under a low top | 30 | 30 | the throw on `[]` legs (`:152`); `landingSpare` 60 by construction; `R` at `:276`, cited `:277` |
| B | the haul trains and their routes | 30 | 29 | ✗ row 19: "`rampEndLip` / `haulLoopM` not in any counter". Both are counters (`TerrainScene.ts:185, 193`). Found the lite variants' forks. |
| C | the quarry and the ground after T2-7 | 29 | 29 | the edge blend under the bowl's east half; `ground.ts` has no `--q`; QuarryCarve's real path |
| D | the complex, the fields, the life | 29 | 29 | the draw-free branch points; the extras' coupling; the second barge's gate |
| E | the epochs, the HUD, the tools | 30 | 30 | the list typed three times; the Node-true gates; the contracts read from the dumps (`tour.ts`'s "eleven" is on `:6`, cited `:5`) |

**Haiku precision: 147/148 (99.3 %).** (The first plan: 149/150.)
