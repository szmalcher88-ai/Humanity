# T2 — TIER 2: EPOCHS, THE SPHINX, THE KHAFRE COMPLEX (build plan)

> Prepared 2026-10-21 by a read-only side session while the main session
> runs I6's battery and then builds I7 (base `a09b645` + the I6 working
> tree; files under edit are cited as found). Nothing in `src/` was touched.
> Roadmap row T2 (STATUS.md, ROADMAP v1.2+): *epoch presets first (canon IX
> §9.3), then the Sphinx carved out of its enclosure's strata, the Sphinx
> Temple, Khafre's valley temple, causeway, mortuary temple and pyramid —
> shown only under KHAFRE_PERIOD and later.* Scope agreed with the main
> session: FIRST deliverable = the epoch mechanism; SECOND = the Sphinx
> enclosure and the Sphinx; the rest sketched as later steps. The human is
> away; every decision in §2 has a SAFE default — the default world stays
> bit-identical, and anything that would change it waits for the human.
> Every Haiku row was re-read by the verifier (table at the end).

## 1. Verified findings

### 1.1 What the canon and the brief ask (verifier; Haiku A — §7)

1. Canon IX §9.3 (`VOL_IX.md:116-131`) names six presets — KHUFU_EARLY,
   KHUFU_LATE, KHUFU_COMPLETION, KHAFRE_PERIOD, MENKAURE_PERIOD,
   EVIDENCE_VIEW — and "The simulation must use the relevant archaeological
   timeline to determine which harbor features, settlements, temples, and
   monumental structures appear"; Rule 4 (`:87-91`): the Khufu landscape and
   Khafre's/Menkaure's completed complexes "cannot be represented as if they
   all existed simultaneously at the beginning of Khufu's reign" (STATUS's
   paraphrase is stronger than the canon — Haiku A); the Heit el-Ghurab
   correction (`:129`): the excavated settlement is "especially associated
   with the Khafre and Menkaure building periods"; and a test: "Verify that
   each building and vessel is permitted in the selected historical preset"
   (`:1706`). The Bible itself conditions Khafre on a timeline: "the Khafre
   complex had not yet reached its final form unless a selectable timeline
   is implemented" (`MASTER_PROMPT_BIBLE.md:82`).
1b. PRECEDENCE: the brief files `?epoch=` under Tier 3 (`BRIEF.md:77,191`)
   and outranks the canon; the roadmap pulls the switch into T2 because
   Tier 2's content cannot obey Rule 4 without it. That is a scope
   interpretation and needs its own DEVIATIONS entry (§6).
2. The brief: Tier 1 "renders one state: the pyramid newly completed …
   `?epoch=` presets are Tier 3" (`BRIEF.md:77`); Tier 2 = "Khafre complex,
   the Great Sphinx and enclosure, Menkaure complex, full necropolis"; Tier 3
   = "`?epoch=` construction-timeline presets (foundation → mid-build →
   decades after)" (`:188-191`). The Bible's own timeline list (`MASTER_
   PROMPT_BIBLE.md:3014-3021`: early foundation … newly completed … several
   decades after) is the brief's Tier-3 axis; canon IX's names add the
   dynasties. They map cleanly: KHUFU_EARLY ≈ foundation/lower courses,
   KHUFU_LATE ≈ mid-height, KHUFU_COMPLETION = today's world, KHAFRE_PERIOD ≈
   "several decades after" + Khafre's works. The roadmap already chose to
   pull the switch forward because Tier 2 cannot otherwise obey Rule 4
   (STATUS "CANON VOLS VII–IX", item 1).
3. Canon VII: the Sphinx's default date "Approximately 2520–2500 BCE (or
   aligned with the selected Khafre timeline)" (`VOL_VII.md:81-83`); "The
   Sphinx should appear emerging from the bedrock, not placed upon it"
   (`:45`); "recreate the original limestone ridge from which the Sphinx was
   carved" (`:35`); the enclosure "should visibly expose these geological
   layers" (`:55`) with "vertical quarry walls, geological strata,
   construction ramps, drainage channels, access routes, ritual pathways"
   (`:187-204`); the Khafre pyramid's apparent height must come from "higher
   natural bedrock, terrain elevation, careful site selection" (`:276-289`);
   a modular hierarchy `KhafreComplex › KhafrePyramid, MortuaryTemple,
   Causeway, ValleyTemple, Sphinx, SphinxTemple, Enclosure, GeologicalLayers,
   …` (`:424-441`); optional layers "natural limestone ridge before carving,
   carving phases, completed Sphinx" (`:451-460`); "Metadata includes
   confidence levels" (`:480`).

### 1.2 Geography — what the terrain says at the Tier-2 sites (verifier; Haiku C, D — §7)

4. Real positions in the world frame (the WGS84 deltas of
   `CANON_DIMENSIONS.ts:197-198`): Khafre's pyramid ≈ (−322, 339) — the code's
   empty knoll `[-330, 350, 190, 3.2]` (`GizaControl.ts:135`) is that site;
   the Sphinx ≈ (321–328, 431); Khafre's valley temple just south of it.
5. KHAFRE'S BASE HEIGHT IS RIGHT: plane 0.02·swDot = 9.6 m + knoll 3.2 m ⇒
   ≈ 72.8 m ASL at the knoll centre vs ≈ 70 m real (≈ 10 m above G1's 60) —
   the elevation illusion (VII:276-289) already holds. Across a 215 m square
   centred there the ground varies ≈ 5.4 m (plane 6.6–12.0 — the SW corner
   hits the plane's +12 m cap — plus the knoll 0.6–3.2): G2 needs a levelled
   platform, cut on the SW and built up on the NE — VII's "construction
   terraces".
6. THE SPHINX SITE IS ~40 m TOO HIGH: at (328, 431) the plane gives +1.46 m,
   the escarpment crest at that latitude lies at x ≈ 469 (signed distance
   ≈ −138 m, `GizaControl.ts:192-218`, `:284-308`), so the ground is ≈ +1.2
   world ≈ 61 m ASL (± 1.8 m noise). The Sphinx enclosure floor is ≈ 20 m ASL
   in reality. The code's plateau RISES toward the SW at 2 % (`:265-267`),
   while the canon's own `PLATEAU_DIP_DEG` 4.5° "falls … to the SE"
   (`CANON_DIMENSIONS.ts:187`); G2 (+10) and the Sphinx (−40) relative to G1
   imply a surface falling ≈ 7 % east and ≈ 4 % south. The escarpment polyline
   vertices (490, 330) and (430, 620) put the drop ~200 m east of where the
   Sphinx needs it. A Sphinx at its real elevation needs a DEFAULT-WORLD
   terrain change (the natural slope existed in Khufu's reign too).
6b. The fix cannot be a plane swap (Haiku C, verified): re-tilting the whole
   plateau to the canon's 4.5° SE would put the ground at the worker town
   (560, 860) near −19 m ASL, 37–45 m under its pads; and because the edge
   takes `min(plateauY, crestY)` (`GizaControl.ts:301`), a lower plane would
   erase the escarpment unless the crest heights are re-authored first. The
   quarry term cannot dig it either (max 13 m, `:130`; the site needs 41 m).
   So the correct fix is LOCAL: move the crest polyline west between
   z ≈ 250 and 650 (with its crest heights) and author the Sphinx
   amphitheatre — a default-world change.
6c. In the KHAFRE world the Sphinx would sit inside bm7's frame (≈ 26° right
   of centre at 352 m, Haiku C) — the quarry bookmark becomes a Sphinx view
   too; nothing else of the default framings sees the site.
7. The Sphinx site lies ≈ 20 m outside the east end of Khufu's quarry bowl
   (dq ≈ 1.11 at (328, 431)) — consistent with the reading that the Sphinx is
   a knoll left at the edge of Khufu's quarry, its enclosure quarried under
   Khafre.
8. A straight Khafre causeway from his mortuary temple's front (≈ −112, 350)
   to the valley temple (≈ 345, 470) runs ≈ 300 m THROUGH Khufu's quarry
   bowl (dq < 1 from x ≈ −40 to ≈ 300; full 13 m depth around x 100–200).
   In the code the quarry reaches ~110 m further north than such a line —
   a second geography question, for the causeway step, not for T2-1/T2-2.
9. Clearances (the KHAFRE world): the West Field's last kept row (I5) ends at
   z ≲ 198, 44 m north of a G2 square at z ≥ 242; the I4 camp (x ≥ −57), the
   I5 works yard (z ≤ 167) and ramp remnant (x ≥ −17) are ≥ 100 m from G2;
   a ≈ 110 m mortuary temple east of G2 ends ≈ 55 m west of the camp.

### 1.3 The code's hooks (verifier; Haiku B, E — §7)

10. `Params.ts:60-77` parses every URL switch into one `Params` object
    (`preset` there is the GPU quality preset — a different word); `Scenes.ts`
    registers boot scenes by `?scene=`; tools pass extra params through
    `akhetUrl({ extra })` (`tools/launch.ts:100-112`).
11. Each pyramid draws from its own stream `monument-${name}`
    (`Monuments.ts:57-70`) and registers `pyramid:${name}` via `edPos` — a G2
    is order-free. `PyramidSpec.buildSpec(params)` takes base, height, slope,
    centre, course count/heights and an rng (`PyramidSpec.ts:13-34`, `:154`).
12. I6 left the hooks for temporal applicability: `Footprint.conf/basis/
    epoch` (`Footprints.ts:57-60`), `src/water/HarbourEvidence.ts` (every
    tag `epoch: 'khufu'`, `stampEvidence`, `runEvidenceAudit`,
    `EVIDENCE_FAMILIES`), and `?debug=confidence` (`Inspector.ts:81`).
13. TRAPS for an epoch switch (Haiku B, verified):
    - the terrain function is evaluated by TWO bakes (full-res and sim-res,
      `Heightfield.ts:107-141`; the quarry carve runs twice) and by the far
      shell with its own `'far'` branch (`TerrainTiles.ts:242`) — an epoch
      term must sit in the shared path, carried in `GizaParams`
      (`makeGizaParams(seed)` at `Heightfield.ts:107` is the one place);
    - `hardStrata` reads the running height (`GizaControl.ts:410`): a
      platform pad belongs AFTER the detail block (dead flat, like the G1 pad
      at `:470` and the town pads); the SandTransport keep-swept mask is
      `worked = g1Pad ∨ qPad ∨ townPad` (`:546`) — an epoch pad must join it;
      new detail offsets go after `far` in `giza-detail-offsets` (`:144`);
    - leave the knoll entry `[-330, 350, 190, 3.2]` alone — it is already
      part of the default plateau; Khafre's platform is a separate term;
    - every gang forks `reseat-${gi}` from the shared stream
      (`Inhabitants.ts:426`): epoch gangs go LAST in the extras
      (`TerrainScene.ts:213`, after `harborLines`), never into `workLines()`;
    - `Torches` caps PointLights at 14 (`Torches.ts:130`) and the default
      already fills them — an epoch's lit spot is silently dropped; do not
      raise the cap (it would add a default light);
    - vessel ids come from a module counter (`hullSeq`): epoch hulls after
      the default ones, or their own class;
    - `stampEvidence()` runs mid-build (`TerrainScene.ts:130`) and stamps
      `khufu` unconditionally: epoch pieces in the evidence families must
      register before it and carry their own prefix and epoch;
    - bookmarks are index-based (`MARKS[10]`, `TOUR`): append, never insert;
      a mark cannot switch epoch at runtime;
    - `tools/audit.ts` boots the default only (`:196`); the battery's child
      gates get no epoch and its floors are default-world numbers;
      `shoot.ts` forwards unknown flags (`:79`) and `tour.ts --q` any param —
      tools need no change to reach an epoch;
    - same-family pairs are never overlap-checked (`CollisionAudit.ts:94`):
      Khafre's works get their own families.

## 2. Decisions (safe defaults — the main session decides; ★ = the human's)

| # | question | SAFE DEFAULT | other options |
|---|---|---|---|
| E1 | the default epoch and the contract | no param = KHUFU_COMPLETION = today's world, BIT-IDENTICAL (proven by `tools/diff.ts` on tour shots, `tools/fpdump.ts`, the inhabitants log line, the battery) | — |
| E2 | which presets T2-1 implements | KHUFU_COMPLETION, KHAFRE_PERIOD (§3.2), EVIDENCE_VIEW (= the I6 confidence overlay on today's world); KHUFU_EARLY / LATE and MENKAURE_PERIOD parse and fall back with an on-screen notice | build the Khufu construction phases now (that is the brief's Tier 3) |
| E3 | switching | boot-time (reload), never live — terrain is baked per boot | a live switch (would need a re-bake and a full rebuild) |
| E4 | what KHAFRE_PERIOD removes of Khufu's works | the construction context only: the D-7 ramp remnant, the royal works yard, the SE scaffold, the haulers' camp, the haul-road gangs, trains and gang shelters; the harbour, the town and the cemeteries stay as they are (the Heit el-Ghurab expansion is a later step) | also re-plan the town per §9.3 now |
| E5★ | THE SPHINX'S ELEVATION (finding 6) | do NOT change the default world without the human: build the Sphinx and its enclosure under KHAFRE_PERIOD ONLY, at the real x/z, carved into the CURRENT ground (enclosure ~10 m deep), declared provisional (new DEVIATION: "Sphinx site ~40 m above its real level, pending the escarpment decision") | (A, recommended for the human) move the escarpment crest ~200 m west between z ≈ 250 and 650 (with its crest heights) and author the Sphinx amphitheatre, for ALL epochs — the correct geography; NOT a plane re-tilt, which would bury the town (6b); it changes the default world (Khufu's quarry's east end, bm7, gangs, debris, the Shore loop) and needs a full re-verification iteration; (C) a separate `?scene=sphinx` test scene with no world placement |
| E6 | how the Sphinx is made | rough body massing + enclosure in the heightfield under the epoch (the existing strata shelving reads the walls as bedding planes), head, nemes, forepaws and chest as a sculpted mesh keyed to the same ground — "emerging from the bedrock" | all-mesh (fights the terrain at its base); all-terrain (1 m texels cannot carry a face) |
| E7★ | Khafre's causeway vs Khufu's quarry (finding 8) | decide at the causeway step, not now | an embankment across the worked-out quarry; reshape the quarry bowl (default-world change) |

Why the defaults: E1–E3 make every later epoch impossible to leak into the
default; E4 removes only what canon VIII/V call temporary works; E5 keeps
the human's world untouched while still delivering a carved, lit, testable
Sphinx in the real stack; the correct fix (A) is one GizaControl edit but a
world-wide re-verification, which is the human's call.

## 3. Design

### 3.1 T2-1 — the epoch mechanism

**Contract: no `?epoch=` (or `?epoch=KHUFU_COMPLETION`) produces today's
world bit for bit.** Every new branch is a JS-level `if` evaluated once at
boot, every new random draw comes from a NEW named stream, and the default
path executes no new code that touches an existing stream, footprint or
node graph.

1. `src/world/Epoch.ts` (new): `type Epoch = 'KHUFU_EARLY' | 'KHUFU_LATE' |
   'KHUFU_COMPLETION' | 'KHAFRE_PERIOD' | 'MENKAURE_PERIOD' |
   'EVIDENCE_VIEW'` (canon IX §9.3, verbatim names); `EPOCH_ORDER`;
   `DEFAULT_EPOCH = 'KHUFU_COMPLETION'` (the brief's Tier-1 state, "the
   pyramid newly completed"); `atLeast(e, k)`; `IMPLEMENTED` = {COMPLETION,
   KHAFRE_PERIOD, EVIDENCE_VIEW}; an unimplemented preset falls back to the
   nearest implemented one and SAYS SO on screen (the iGPU-notice pattern) —
   never a silent substitution.
2. `Params.ts`: `epoch: Epoch` from `?epoch=` (default as above), passed
   down like `preset`; nothing else reads the URL for it.
3. A boot-time switch, not a live one: terrain is baked once per boot
   (`Heightfield.generate`), so changing epoch = reloading with the new
   parameter. Bookmarks may carry an `epoch`; jumping to a mark of another
   epoch reloads `?epoch=…&bm=N` (and says so) instead of half-switching.
4. GATING, three kinds:
   - STRUCTURES: a builder is called or not (`rebuildStructures`), or takes
     `epoch` and skips its Khufu-construction pieces. Each builder owns its
     stream, so skipping one moves nothing else.
   - TERRAIN: `makeGizaParams(seed, epoch)` puts the epoch into
     `GizaParams` — the one object both bakes and the far shell read
     (finding 13); `gizaTerrain` adds epoch features inside `if
     (atLeast(gp.epoch, 'KHAFRE_PERIOD'))` at node-construction time, in the
     path BOTH the `'full'` and `'far'` branches run, so the default node
     graph is the same object graph as today. Platform pads go after the
     detail block (next to the G1 and town pads) and join `worked`; the
     Sphinx enclosure cut goes before the strata block so its walls get
     bedding (it changes h only inside the enclosure, so the rest of the
     plateau's bedding is untouched — and only under the epoch).
   - PEOPLE: epoch gangs are appended LAST to the extras, on their own
     streams; removed Khufu gangs simply are not passed (their lines leave
     `workLines()` only under the later epoch — the default canon list is
     untouched).
5. EVIDENCE: the I6 footprint fields (`conf`, `basis`, `epoch`) carry the
   temporal applicability: `epoch` = the first preset a piece exists in
   (the I6 harbour pieces say `khufu`); add an optional `until` for pieces a
   later preset removes. `runEvidenceAudit` widens to every family that a
   later epoch adds or removes; epoch pieces in the harbour/district/vessel
   families register BEFORE `stampEvidence()` (`TerrainScene.ts:130`) with
   their own id prefixes (it stamps `khufu` on any matching prefix).
   EVIDENCE_VIEW = the default world with the I6 `?debug=confidence`
   overlay on (`Inspector.ts:81`) — a first, honest implementation of canon
   IX's evidence preset.
6. TOOLS: `akhetUrl` already forwards `extra` params (`tools/launch.ts:100-
   112`) and the tour takes `--q` — `epoch=KHAFRE_PERIOD` reaches every tool
   with no tool change. The battery's gates and perf sweep stay on the
   default epoch; a second, short pass (`tools/audit.ts` with the epoch
   param: collisions + evidence) covers each implemented later epoch.

7. PROOF OF THE CONTRACT (before any KHAFRE content): build the mechanism
   with an EMPTY KHAFRE_PERIOD (nothing added, nothing removed) and show
   (a) default boot = pre-change boot (`tools/diff.ts` on the tour, footprint
   dump identical, the `[akhet] inhabitants: …` line identical, battery
   19/19), (b) `?epoch=KHAFRE_PERIOD` with nothing gated = the same world.
   Only then start gating.

### 3.2 KHAFRE_PERIOD — the world 25–30 years on (E4)

- REMOVED (not built under the epoch; each owns its stream, nothing else
  moves): `SouthWorks` (ramp remnant + works yard), the SE scaffold, ramp and
  gang in `Inhabitants`, `WorkCamp` + `campLines`, the haul-road lines,
  trains and gang shelters. The temple's SE corner is FINISHED: the
  falsework and the unfinished corner go; the corner is built.
- KEPT: the pyramids, the complex, the cemeteries (I5), the harbour (I6),
  the town, the land (I4). Their tags read `epoch: 'khufu'` — they still
  stand, so their applicability is "from Khufu"; add `until` only to what
  the epoch removes.
- ADDED, step by step: the G2 platform (terrain, under the epoch), the
  Sphinx enclosure and Sphinx (§3.3), then §3.4.
- Expect a different figure layout under the epoch (removed canon lines
  change `canonScale`); the default is unaffected.

### 3.3 T2-2 — the Sphinx enclosure and the Sphinx (E5 default: provisional site)

- SITE: centre of the body (≈ 325, 431), facing due east (Lehner; B for the
  orientation); body ≈ 73 m long, ≈ 19 m wide, ≈ 20 m from floor to head
  (B — general survey figures); the enclosure ≈ 10 m deep into the current
  ground (provisional, E5), its west and north walls vertical quarry faces,
  the east side open toward the Sphinx Temple's site; a drainage fall to the
  east (VII "drainage channels"). Constants in `CANON_DIMENSIONS.ts` with
  confidence and source (`SPHINX_*`), the site behind `edPos('sphinx', …)`
  so the Inspector can move it — and the whole thing stays re-siteable when
  the human decides E5.
- TERRAIN (`GizaControl`, under the epoch): an `ENCLOSURE` rectangle cut to
  the floor level with steep walls (the existing strata shelving turns steep
  rock into bedding benches — finding: `shelfMask` covers scarp faces; the
  enclosure walls must be added to that mask), and the Sphinx's BODY left
  standing as rock in the cut: a lion-body massing (a rounded box with a
  haunch and a back line, ≈ 1 m texels on high) — so the body literally IS
  the bedrock the enclosure was cut from. VII:35 "the original limestone
  ridge" = KHUFU_COMPLETION already (no cut): the knoll at the quarry's lip.
- SCULPTURE (new `src/monuments/Sphinx.ts`, stream `sphinx`): head with
  nemes (lappets, striped folds as low relief), face (brow, eyes, nose,
  mouth, ears — modest, idealised; VII:117-134), uraeus, beard per the
  chosen reconstruction (declared), forepaws with toes, chest; a seam band
  where mesh meets terrain body hidden by a rough "finishing" collar; tool
  marks as normal detail, not geometry (VII:108-116). Paint: an optional
  layer `?pigment=1` (VII:163-186, toggle), off by default.
- MATERIAL: the enclosure walls' bedding planes read through the terrain
  splat's strata; the sculpture uses the local-limestone material with a
  finer course height; the Sphinx's lower body is the softer, more eroded
  member (VII "geological stratification": different beds, different
  weathering) — tone bands by height.
- DATA: footprints `sphinx:body`, `sphinx:head`, `sphinx:enclosure:{w,n,s}`
  (family `sphinx`, `epoch: 'khafre'`, conf B for the form, D for the
  provisional height) — the evidence audit covers the family.
- BOOKMARK 12 (`=` key): "the Sphinx", carrying `epoch: 'KHAFRE_PERIOD'`
  and an hour (VII's view list: from the valley temple, looking north to
  G1, between the paws); outside that epoch it reloads into it.

### 3.4 Later steps (sketch)

1. G2: `Monuments.add('G2', 215.25, 53.13, …)` on its own stream
   `monument-G2` — 53.13° = atan(4/3), the seked of 5¼ palms, which gives
   the 143.5 m height (53.1 would give 143.34; `heightFromSlope`,
   `Monuments.ts:37`) — declared in `CANON_DIMENSIONS` with sources; its
   course count is unsourced (≈ 205 by scaling G1 — label it an estimate);
   ≈ 52k stones (+80 % over today's ≈ 63–65k; ≈ 1.04M near tris; ≈ 2 MB of
   instance data; the 20-tri stone geometry is shared, `PyramidBuilder.ts:
   304`); a levelled platform under the epoch at ≈ 72.8 m ASL (fill up to
   5.7 m NE, finding 5), joining `worked`; red granite on the lowest
   course(s) (VII:265-267) by a course-height threshold on `y0` in the near
   colour node AND the same band on the far shell (`:381`), or the red band
   pops at `lodDist` (1291 m for G2); its enclosure (half ≈ 127.7 m with
   Khufu's offsets). One bounding sphere per pyramid (`:340-343`) submits all
   52k stones whenever any part is in view or a cascade — measure before
   adding per-cell culling. `audit.ts` is G1-specific (course count `:67`,
   shadow scan centre `:123`): loop it over the monuments under the epoch.
2. Khafre's mortuary temple, causeway (E7★ first), valley temple (granite,
   VII:318-335), Sphinx Temple (VII:211-225) — GeoWriter builders as in
   `KhufuComplex`, one module `KhafreComplex.ts` in canon VII's hierarchy.
3. The town per §9.3 (the excavated Khafre/Menkaure extent) under the epoch.
4. MENKAURE_PERIOD; the Khufu construction phases (KHUFU_EARLY/LATE —
   the brief's Tier 3).

## 4. Risks

1. LEAKS INTO THE DEFAULT: any shared stream touched by an epoch branch
   (e.g. a `rng.fork` added before an existing fork, an extra gang inserted
   before the I4/I5 lines, a terrain term added outside the `if`) moves the
   default world. Contract proof (§3.1.7) before and after every step.
2. TERRAIN PER EPOCH: the Shore reed loop (I6 finding) and every
   height-dependent placement re-lay under KHAFRE_PERIOD — expected and
   fine for that world, but the epoch's own placements must be checked there
   (`audit.ts` with the epoch).
3. PERF: G2 adds ≈ 52k stones, near-LOD inside 1291 m — in the KHAFRE
   world that is 7 of 11 bookmarks (bm3, bm7, bm8, bm11, bm4, bm5, bm6;
   bm1 sees only its far shell) — the battery's perf gate stays on the
   default epoch; measure the epoch separately with the I7 `perfab.ts`.
   bm4 'causeway descent' and bm8 'queens & temple' would frame G2 and the
   Khafre valley temple under the epoch: keep them, they show the new
   world, but say so in the tour report.
4. PROVISIONAL HEIGHT: a Sphinx on the plateau top reads wrong from the
   valley-temple view (VII:398); the DEVIATION says so, and the bookmark
   should not pretend otherwise.
5. CONCURRENCY: T2-1 touches `Params`, `TerrainScene`, `GizaControl`,
   `Bookmarks`, `HarbourEvidence` — after I7 is committed.

## 5. Verification checklist

1. Contract (§3.1.7): default boot identical — tour diff, footprint dump,
   inhabitants line, battery 19/19.
2. `?epoch=KHAFRE_PERIOD`: `tools/audit.ts` (collisions + evidence) clean;
   tour 1/3/7/8 — the construction context gone, the corner finished.
3. `?epoch=EVIDENCE_VIEW`: the confidence overlay on; nothing else differs.
4. Fallbacks: `?epoch=KHUFU_EARLY` boots the default with the notice.
5. Sphinx: closeups `--id sphinx: --n 4` under the epoch, at 9 h, 12.4 h,
   16 h and moonlight (VII:404-423), bookmark 12.

## 6. Docs to update

- STATUS.md: a "T2-1 — EPOCHS" and a "T2-2 — THE SPHINX" section; the
  roadmap row split into steps; the Haiku table.
- DEVIATIONS.md: "Epoch presets" (the mapping of §1.1 item 2, which are
  implemented, the fallback rule, and the scope interpretation of item 1b —
  the brief files `?epoch=` under Tier 3); "Sphinx site elevation
  (provisional)" (E5) with alternatives A/C and confidence; later "Khafre
  causeway route" (E7). STATUS's hard-rules line ("NO Khafre/Menkaure/
  Sphinx") gains "in the default epoch".
- README: `?epoch=`, `?pigment=1`, bookmark 12.

## 7. Haiku precision (5 agents, read-only, every row re-read by the verifier)

| agent | task | rows | confirmed |
|---|---|---|---|
| A | canon + brief requirements for epochs, the Sphinx, the Khafre complex | 29 | 29 — Rule 4's exact wording ("at the beginning of Khufu's reign"), the per-preset admissibility test (IX:1706), the Bible's "unless a selectable timeline is implemented", the brief-vs-roadmap precedence question |
| B | the hooks and traps of an `?epoch=` switch | 30 | 30 — the two bakes + far branch, `hardStrata` reading the running height, the `worked` sweep mask, the 14-light cap already full, `stampEvidence` mid-build, index-based bookmarks, the battery's children booting the default |
| C | the ground at the Sphinx site | 30 | 30 — the same ≈ 61 m ASL as the verifier, and the two constraints that shape the fix: a plane re-tilt buries the town, `min(plateau, crest)` erases the escarpment |
| D | the Khafre square, the causeway corridor | 30 | 29 — 362 of 524 m of a straight causeway inside Khufu's quarry bowl; bm4 and bm8 frame the Khafre site; one row calls the dead `causewayAxis()` "the only causeway in code" |
| E | pyramid-builder reuse and cost | 30 | 28 — the 53.13° (atan 4/3) correction, ≈ 52k stones, the granite band on near AND far shells, one bounding sphere per pyramid; two rows call STATUS's Tier-1 scope line and D-16's "must stay empty in 2550 BCE" BLOCKERS for T2 — both describe the default epoch only |

TOTAL 149 rows, 146 confirmed (98.0 %).
VERDICT: the pattern holds. The two misses are one class: a rule written for
the default epoch read as a rule for every epoch — worth one line in every
future brief now that epochs exist ("say which epoch a rule applies to").
