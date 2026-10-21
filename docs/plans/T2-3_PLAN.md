# T2-3 — KHAFRE'S PYRAMID (G2) UNDER KHAFRE_PERIOD (build plan)

> Prepared 2026-10-21 by a read-only side session while T2-2 (the Sphinx)
> lands (base `72fe1fe` T2-1 + the T2-2 working tree: `Sphinx.ts`, the
> epoch block in `GizaControl`, `SPHINX_*`, bookmark 12). Nothing in `src/`
> was touched. Scope (T2_PLAN.md §3.4 step 1, as briefed): G2 at 215.25 m and
> 53.13° on its own stream, a levelled platform under the epoch, the red
> granite lowest course(s) on the near AND the far shell, the G2 enclosure,
> the cost and the measurement that decides per-cell culling, the audit loop,
> the clearances, E7 (the causeway through Khufu's quarry) prepared as a
> decision — G2 must not depend on it — and room for the mortuary temple.
> The human is away: every decision carries a ★ RECOMMENDED DEFAULT.
> Contract unchanged: no `?epoch=` ⇒ bit-identical.

## 1. Verified findings

(Haiku rows folded in after verification — the table is §7. Base now
`735c13b` (T2-2 committed); line numbers are from that tree.)

### 1.1 The ground under G2 (verifier; Haiku B)

1. The terrain under a 215.25 m square centred on the knoll (−330, 350) —
   plane `0.02 · 0.7071 · (z − x)` (cap +12, `GizaControl.ts:272-274`) plus
   the knoll `3.2 · smoothstep(190, 47.5, d)` (`:138`, applied at `:411`);
   G2 is pure plateau — escarpment, floodplain, harbour, canals, river,
   quarry bowl, wadi and the Sphinx enclosure are all 0 there (Haiku B,
   verified: `:315`, `:327`, `:431`); the seed noise ± 1.8 m (`:277`, stream
   `giza-detail-offsets`, `:150`) and the detail ± 0.5 m are not included:

   | point | x, z | plane | knoll | ground (world Y) |
   |---|---|---|---|---|
   | centre | −330, 350 | 9.62 | 3.20 | 12.82 |
   | N mid | −330, 242.4 | 8.10 | 1.97 | 10.07 |
   | E mid | −222.4, 350 | 8.10 | 1.97 | 10.07 |
   | S mid | −330, 457.6 | 11.14 | 1.97 | 13.11 |
   | W mid | −437.6, 350 | 11.14 | 1.97 | 13.11 |
   | NE | −222.4, 242.4 | 6.57 | 0.56 | 7.13 |
   | NW / SE | | 9.62 | 0.56 | 10.17 |
   | SW | −437.6, 457.6 | 12.00 (cap) | 0.56 | 12.56 |

   The nine points under-weight the knoll: the AREA mean (400² grid,
   verifier) is 12.11 under the base and 11.57 under the court square
   (half 133); the highest ground is 14.0 at ≈ (−385, 405), the knoll's SW
   shoulder on the rising plane. Earthwork by level:

   | level | under the base (half 107.6) | under the court (half 133) |
   |---|---|---|
   | +10.0 | cut ≤ 4.0 m, 101k m³; fill ≤ 2.9 m, 3k m³ | cut 128k m³; fill ≤ 4.1 m (NE corner), 17k m³ |
   | +11.0 | cut 61k; fill 10k | cut 77k; fill 37k |
   | +12.0 | cut 30k; fill 24k (≈ balanced) | cut 36k; fill 67k |

   The canon asks only that the "elevation illusion" come from "higher
   natural bedrock, terrain elevation, careful site selection" (VOL_VII.md
   :276-289) — it gives NO figure (the earlier T2 wording "≈ 10 m higher"
   was not the canon's). The common figure — Khafre's base ≈ 10 m above
   Khufu's — is an outside source (C). G1's apex is 146.6; G2's apex at
   +10.0 is 153.5, at +12.0 155.5 — either level shows the illusion.
2. Where a pad goes: AFTER the detail block, with the G1 pad (`:508-509`),
   the queens' pad (`:514`) and the town pads (`:525`) — dead flat; its mask
   joins `worked` (`:585`, as T2-2 did with `sphinxEnc`) so sand transport
   keeps it swept; the T2-2 pattern `x.max(mask)` with `mask = float(0)` by
   default is value-identical (all masks ≥ 0). Precisely: after the town
   pads' loop (ends `:533`), BEFORE `if (!full)` (`:536`) — inside `if (full)`
   the far branch would miss it; before `:500` the shelving and the detail
   would roughen it (Haiku B). The far branch then adds its desert swell on
   top (`:536-552`) — parity only: G2 lies inside the baked grid, the far
   ring starts at `0.952 · WORLD_HALF` (`TerrainTiles.ts:237`).
2b. The pad draws no random numbers (no new stream); inside its core
   `mix(h, L, 1) = L` exactly, so only the blend ring varies with the seed
   (Haiku B). `worked` reaches the sand solve only (`HeightSynthesis.ts:73`
   → `masksB.w`): initial sand × (1 − 0.92·worked) (`SandTransport.ts:102`),
   halved every step (`:189`); no render texture carries it
   (`Heightfield.ts:247-248`; the render's `workedK` is the QUARRY channel,
   `TerrainTiles.ts:147`), so the pad keeps the ± 0.1 m rock
   micro-displacement near the camera exactly as G1's pad does today.
2c. The blend vs the sand's repose (`TAN_REPOSE = 0.65`,
   `SandTransport.ts:53`): a smoothstep's steepest slope is 1.5·Δh/W. At
   +10.0 with a 12 m blend the worst point is the NE outer corner
   (−185, 205), Δh 4.5 → 0.56 — under repose without noise; the ± 1.8 m
   noise can push it to ≈ 0.85 on some seeds, and sand then slides off that
   bank (bedrock is fixed; the ring is partly `worked` and swept anyway). A
   20 m blend (0.35) would put the north edge at z 197 — onto the West
   Field's large tombs (finding 8); so 12 m stays, the NE bank is a risk to
   look at (§4), not a blocker.

### 1.2 The pyramid pipeline (verifier; Haiku C)

3. `Monuments.add(name, baseSide, slopeDeg, cx, cy, cz, courseCount, course1,
   courseMin)` (`Monuments.ts:47-88`): height from the slope
   (`heightFromSlope`, `:37`) — 53.13° = atan(4/3) gives exactly 143.5 m;
   its own stream `monument-${name}` (`:70`); its footprint `pyramid:${name}`,
   family `pyramids`, ground `platform` (`:76-87`) — `cy` must be the pad
   level or the audit's float/buried rules fire.
4. `solveCourses` (`PyramidSpec.ts:74-101`): an exponential decay from
   `course1` to `courseMin` with surges, normalised to the height — so the
   first course's height is known after the solve (`rows[0].h`); G1 uses 210
   courses, 1.49 m, 0.52 m (`CANON_DIMENSIONS.ts:86-93`, Petrie). No Khafre
   course count exists in the repo.
5. The near stones' colour is one node: `TURA × tone × mottle × striation`
   (`PyramidBuilder.ts:286-292`), roughness `0.62 + rough` (`:295`); each
   stone's base height `y0` is in `bufA.y` (`:184`); the far shell's colour is
   `TURA × mottle × band jitter` keyed on world `y − cy` (`:370-384`). A
   granite band therefore goes in BOTH, keyed on height — and only behind a
   JS-level `if`, so G1's and the queens' node graphs do not change.
6. LOD: stones visible inside `max(900, 6 × base)` = 1291.5 m for G2
   (`:394`); one bounding sphere per pyramid (`:340-343`) — when any part is
   in the frustum (or a cascade), all its stones are submitted.

### 1.3 Clearances in the KHAFRE world (verifier; Haiku D)

7. Under KHAFRE_PERIOD `TerrainScene` skips the south works, the haulers'
   camp and their gang lists (`khufuWorks`, `TerrainScene.ts:101-149`,
   `:224`); the West Field, the family courts, the harbour, the town and the
   land stay.
8. The West Field's last built row (I5 even-row rule,
   `KhufuComplex.ts:731`) lies at z ≈ 179, its tombs reaching z ≤ 193
   (≤ 198 for the 8 % large class); a G2 pad reaching z 205 (§3.1) is 7–12 m
   clear; the WGS84 centre (−322, 339) would bring the same pad to z 194 —
   onto the last row.
8b. Haiku D (0 conflicts; spot-checked): under KHAFRE the haulers' work
   lines 0, 1 and 5 go (`Inhabitants.ts:341`), the trains (`:654`) and the
   shelters (`:706`) — the camp smoke follows the empty camp hearths. What
   stays near G2: the West Field (built z ≈ −224 … 199: 43–49 m north of the
   base square, ≈ 22–28 m north of the wall's outer face), the family
   courts (south walls ≈ z 192), the Sphinx (x 288–355, 620 m east), the
   quarry rim (≈ 21 m from the mortuary-temple box's SE corner (−90, 380),
   §3.4), the debris anchors (x ≥ 30; their scatter tails may reach west).
   The spawn comment "looking NW" (`TerrainScene.ts:359`) is wrong: yaw
   0.78π looks SW (`:364`) — G2 is ≈ 63° off it, not framed.

### 1.4 Measuring (verifier; Haiku E)

9. `tools/perf.ts` pins `preset=high&force=1&dpr=1`, takes `--bm`, `--runs`,
   `--T`, `--settle`, `--sample` and `--b "<query>"` for arm B only
   (`tools/perf.ts:40-49`) — there is no query for BOTH arms, so an A/B
   INSIDE the epoch needs a 2-line `--q` option; it reads only fps, p10, the
   EMA, triangles, dpr cuts and the bench (`:86-92`) — not the per-pass GPU
   times (`stats.gpuPasses`: `r.<pass>`, `r.shadow.cN`) nor the counters.
9b. `?hide=` CANNOT isolate a pyramid (Haiku E, verified): it is a one-time
   visibility pass by mesh NAME (`TerrainScene.ts:285`), the pyramid meshes
   are unnamed, and the LOD switch rewrites `near.visible` every frame
   (`PyramidBuilder.ts:396`) — a hidden G2 would reappear inside `lodDist`.
   An A/B needs a BUILD-time switch.
9c. Per-cell culling of stones has four blockers (Haiku E, verified):
   `bufA` holds along-face data, not the world positions `cellSortVec4`
   buckets by (`InstanceCull.ts:89`); `bufT` is stride 2 where the sort
   assumes 4 (`:119`); the casters' sun-shadow union uses the cell's own
   height extent, so cells 50–140 m up under-cover their shadows (`:296-305`);
   `clearCulling()` runs AFTER `rebuildStructures()` (`TerrainScene.ts:158,
   165`), wiping any registration made there, and an Inspector rebuild
   re-builds pyramids without unregistering them.
9d. A G2 inside `lodDist` but OFF screen is still drawn into every shadow
   cascade whose box reaches it (one bounding sphere, frustum-tested per
   pass): in the KHAFRE world bm3 (601 m), bm7 (391 m), bm8 (598 m) and
   bm11 (553 m) can pay for G2's shadows without showing it.
10. Bookmark 12 'the Sphinx' (430, 6, 431), yaw π/2 (`Bookmarks.ts:53`)
    looks due west: G2 sits 6° off its axis at 764 m, its apex (153.5) 10.9°
    up from the eye at Y 6 (bookmark `p` is absolute world Y) — inside
    `lodDist`, so G2's stones are drawn there; bm4 'causeway descent'
    (620, 0, −190) sees G2 9.2–9.6° off-axis at 1093 m, apex 8.0° up (near
    stones on). bm4's line of sight crosses the queens' row at x 190
    (z ≈ 55) and G1's south temenos near x ≈ 53 (z ≈ 132, sightline Y ≈ 6
    vs the 8 m wall): G2's lower part may be hidden there — a screenshot
    check (§5), not a claim. bm8 looks 78° away; bm1, bm2 and bm10 see it at
    1.55–1.75 km (far shell only); bm3, bm5–bm9 and bm11 do not frame it
    (verifier: bearings vs the 85.6° horizontal fov at 16:9).

## 2. Decisions (★ = recommended default — the main session decides)

| # | question | ★ default | alternatives |
|---|---|---|---|
| G-1 | G2's centre | ★ (−330, 350), the authored knoll — the terrain was built for it, and its pad clears the West Field (finding 8); C | (−322, 339), the WGS84 delta (B) — needs a pad tighter than the court on its north side |
| G-2 | platform level | ★ +10.0 world (70 m ASL) — the commonly cited "base ≈ 10 m above Khufu's" (outside source, C; the canon gives no figure, finding 1); apex 153.5 vs G1's 146.6, so the canon's illusion holds; a net CUT platform (≈ 101k m³ cut, 3k fill under the base: the SW shoulder cut down ≤ 4.0 m, the NE corner filled ≤ 2.9 m) | +12.0 (Haiku B: least earthwork, cut ≈ fill under the base; apex 155.5); +11.0 |
| G-3 | pad extent | ★ square, half 133 m (base 107.6 + court and wall 20.2 + 5), 12 m blend → reaches 145 m (z 205 … 495, x −475 … −185); 12 m because the north edge must stay clear of the West Field (finding 2c) | Haiku B's half 127.6 + 25 m blend — rejected: the wall's centreline (127.8) would stand on the blend, and the edge (152.6) reaches z 197, onto the West Field |
| G-4 | granite | ★ the LOWEST course in red granite, DECLARED with an outside source (Lehner 1997 on Khafre's casing; C) in `CANON_DIMENSIONS` and DEVIATIONS — the canon does NOT say it: VII:265-267 speaks of casing, and "Aswan granite" sits only in VII's material palette (VII:249); no canon file contains "red granite" (Haiku A, verified) | two courses; all-Tura (canon-literal) |
| G-5 | course count | ★ 205 — G1's 210 scaled by height (143.5 / 146.6), course1 1.49 m and courseMin 0.52 m reused from G1 — declared as an ESTIMATE (D) | a sourced count when one is supplied |
| G-6 | the enclosure | ★ a wall at Khufu's offsets (centreline 127.8 m from the centre, 3 m thick, 8 m high as D-3), a gate on the east axis for the mortuary temple, the court paved in individual slabs like G1's (Pillar A) on its own stream | a lower wall; a slab-grid material instead of slabs (cheaper) |
| G-7 | per-cell culling of stones | ★ NOT now — measure first (§3.5); it has four blockers (9c) and helps only views where part of the pyramid is off screen | build it with G2 |
| E7 | Khafre's causeway vs Khufu's quarry | ★ decide at the causeway step; G2 does not depend on it. Recommended then: from the mortuary temple's front (≈ −92, 350) straight to a valley temple at ≈ (360, 505) — SOUTH of the Sphinx, the causeway running along the enclosure's south side (at x 325 it lies at z ≈ 493, 62 m off the Sphinx axis); across the worked-out quarry floor on an embankment, under the epoch only, declared (D) | the T2 plan's line to (345, 470) — it runs at z ≈ 465 at x 325, INSIDE the Sphinx enclosure band (\|z − 431\| ≤ 39.5, `GizaControl.ts:430`; Haiku A); a bent route along the quarry's north rim; reshaping the quarry (default-world change — the human's) |

## 3. Design

### 3.1 The platform (`GizaControl.ts`, under the epoch)

- After the town pads (`:525-533`), before `if (!full)` (`:536`), inside
  `if (atLeast(gp.epoch, 'KHAFRE_PERIOD'))`: `g2Pad = smoothstep(145, 133,
  max(|x + 330|, |z − 350|))`; `h = mix(h, float(G2_PAD_Y), g2Pad)` with
  `G2_PAD_Y = 10.0` in `CANON_DIMENSIONS` (D, the earthwork table of
  finding 1 as its note). Outside the `if`, `g2Pad = float(0)`.
- Optional, value-identical: the knoll's literal (`:138`) reads
  `G2_CENTER` so the knoll and the pad share one centre (Haiku B).
- `worked: …max(sphinxEnc).max(g2Pad)` — value-identical by default.
- Both bakes and the far shell read `gp.epoch` already (T2-2), so the pad is
  in all three.

### 3.2 G2 (`Monuments.ts`, `PyramidSpec.ts`, `PyramidBuilder.ts`)

- `CANON_DIMENSIONS.ts` — none of these numbers is in the canon or the
  repo today (Haiku A), and the brief requires a source for every
  load-bearing dimension (`BRIEF.md:65`): `G2_BASE_SIDE` 215.25 (B, Petrie
  1883), `G2_SLOPE_DEG` 53.1301 (B — the seked of 5¼ palms, rise/run 4/3,
  giving 143.5 m; Petrie's 53°10′ would give ≈ 143.7 m — say which),
  `G2_COURSE_COUNT` 205 (D, estimate), `G2_CENTER` (−330, 350) (C, the
  authored knoll), `G2_PAD_Y` 10.0 (D), `G2_GRANITE_COURSES` 1 (C, Lehner),
  `G2_TEMENOS_OFFSET` 20.2 (D — Khufu's offsets reused, no source).
- `buildMonuments(scene, seed, gi, epoch)`: AFTER G1-d, `if (atLeast(epoch,
  'KHAFRE_PERIOD')) add('G2', …, cy = G2_PAD_Y, …)` — last, on stream
  `monument-G2`; nothing earlier moves.
- `PyramidParams.graniteCourses?: number` after `courseMin`
  (`PyramidSpec.ts:29`; default 0 — not read by the solver, so no draw
  changes); `add()` gets it as a 10th argument defaulting to 0. In
  `buildPyramid`, only when it is > 0: a uniform `uGraniteTop =
  spec.courses[graniteCourses].y0` — the base of the first Tura course, read
  from the same array the instances were packed from, so the float32 values
  match; near: the flag `A.y < uGraniteTop` computed in the vertex stage and
  carried by a varying as `tone` is (`PyramidBuilder.ts:288`), colour
  `mix(turaColour, GRANITE × tone, flag)` (granite skips the Tura mottle),
  roughness `mix(0.62 + rough, 0.6, flag)` (`:295`); far shell: the same
  flag on `fy = y − cy` (`:373`) against the same uniform — NOT the
  `courseIdx` band (`:374`), whose average course height does not match the
  real course edges — on colour AND roughness (the far shell is a flat 0.64,
  `:384`), so neither the colour nor the sheen of the red band jumps at
  `lodDist`. All buffers are full (A s/y0/h/w, B face/tone/rough/tiltU, T
  tiltV/mottle, `:177-179`), hence the uniform, not a new channel (Haiku C). GRANITE = the harbour's and the works yard's
  `[0.6, 0.39, 0.34]` (`HarborDistrict.ts:649`, `SouthWorks.ts:417`).
- A BUILD-time switch `?g2=0` (under the epoch only): `buildMonuments`
  skips the G2 `add()` and `GizaControl` keeps its pad — the measurement
  switch (§3.5; `?hide=` cannot do it, 9b). Name the meshes `pyramid-G2`
  anyway (README, the inspector, a future hide-aware LOD).
- Evidence on `pyramid:G2` as `Sphinx.ts` does (`EVIDENCE` constant at
  `Sphinx.ts:20-24`: `conf`, `basis`, `epoch: 'khafre'`): `add()` takes an
  optional evidence object and spreads it into the `fpReg` (the default
  monuments pass none — their footprints do not change).

### 3.3 The enclosure (new `src/monuments/KhafreComplex.ts`)

- Canon VII's hierarchy (`VOL_VII.md:424-441`): one module for Khafre's
  works; now the enclosure, later the temples and the causeway.
- Wall: four runs on the WALL RULE as G1's temenos (`KhufuComplex.ts`), the
  east run split for the gate; the court slabs on stream `khafre-pavement`;
  footprints `khafre:temenos:{n,s,w,e-n,e-s}` (family `khafre-temenos`,
  allow `khafre-pavement`) and `khafre:court` (family `khafre-pavement`,
  passive) — own families (same-family pairs are never compared). Families
  join `STRUCT_FAMILIES`; built in `rebuildStructures` under the epoch.
- Evidence: `conf` and `basis` on every Khafre footprint; `epoch: 'khafre'`;
  `runEvidenceAudit` covers the Khafre families.

### 3.4 Room for the mortuary temple (sketch)

- East of the gate: ≈ 110 × 50 m (x −202 … −92, z 325 … 375) on its own
  terrace later; the ground there by the plane falls from ≈ 7 at x −200 to
  ≈ 6.2 at x −92 (knoll gone): a terrace at ≈ +7, stepping down 3 m from
  the court through the gate — or the pad extended east (a second pad that
  wins where they overlap, as the town pads do). The G-3 pad stops at x −185,
  so the temple's terrace starts 17 m east of the wall line inside the
  blend — leave that to the temple step.

### 3.5 Cost and the measurement that decides per-cell culling

- Expected: ≈ 1.18 × 205 × 215.25 ≈ 52k stones (+80 % of today's ≈ 65k),
  ≈ 1.04M near triangles, ≈ 2 MB of instance data; the 20-tri stone geometry
  is shared.
- `tools/perf.ts` gains (a) `--q "<query>"` merged into BOTH arms (2 lines
  at `:47-49`), and (b) the per-pass GPU times and `monuments.stones` in its
  read-out (`:88-92` + the table) — G2's cost = Δ(main pass) + ΣΔ(`r.shadow.cN`).
- Commands (pane closed, idle GPU, nvidia-smi noted; never `noguard` on one
  arm only):
  1. Default untouched: `npx tsx tools/perf.ts --bm 1,3,7 --runs 3` — within
     noise of the last baseline, and `tools/fpdump.ts` identical.
  2. G2 inside the epoch, in view: `npx tsx tools/perf.ts --bm 12,4,1
     --runs 3 --q "epoch=KHAFRE_PERIOD" --b "g2=0"` — A = with G2, B =
     without; bm12 and bm4 draw its stones, bm1 only its far shell.
  3. G2 inside the epoch, OFF screen (its shadows, 9d): `npx tsx
     tools/perf.ts --bm 3,7,8,11 --runs 3 --q "epoch=KHAFRE_PERIOD" --b "g2=0"`.
  4. If 2 or 3 shows a cost: the same with `&ablate=shadows` added to `--q`
     — how much of it is the cascades.
- RULE (★): accept G2 as built if steps 2–3 cost ≤ 3 fps median (≤ ~1.5 ms)
  everywhere. If OFF-screen frames pay (step 3) and step 4 says it is the
  cascades → the cheapest lever is a SHADOW-ONLY LOD (G2's far shell casts
  beyond ~300 m instead of 52k stones), not per-cell culling. If IN-view
  frames pay (step 2) → fewer, larger courses (the course count is an
  estimate anyway, G-5). Per-cell culling (9c) only for close, partial
  views — a later, separate change.

### 3.6 The audit (`tools/audit.ts`)

- What is there (Haiku C, verified): the spec checks (`tools/audit.ts:39-76`)
  build ONE G1 spec at the origin with `new Rng(1)` (`:51`), not the world's
  `monument-G1` stream; the course-count check (`:67`) is a tautology —
  `solveCourses` always emits exactly `courseCount` rows
  (`PyramidSpec.ts:78-79`); the 40k stone floor and the literals 230.363 /
  1.49 / 40000 are G1's; `--epoch` is parsed only inside `collisionTest`
  (`:196-199`); the shadow test boots Khufu's world (`:108`).
- Change: export the monument rows (name, base, slope, centre, cy, course
  constants, granite courses, stone floor, epoch) from `Monuments.ts` — the
  same table `add()` is called from; hoist the `--epoch` parse; loop the spec
  checks over the rows of that epoch; replace the tautology by real checks
  (the solved height equals `heightFromSlope` within 0.5 % — `PyramidSpec.ts:
  176-178` already computes it; the first course's normalised height; the
  stone floor per row: G1 > 40k, G2 > 45k); the shadow test stays G1's in
  Khufu's world; the collision audit covers `pyramid:G2` and the Khafre
  families by itself.

## 4. Risks

1. Default leaks — the contract proof as in T2-1/T2-2: `fpdump` identical,
   the tour diff, the inhabitants line, battery.
2. The pad meeting the West Field: z 205 vs tombs ≤ 198 (finding 8) — check
   with `audit --epoch KHAFRE_PERIOD` (float/buried on `mastaba:w:*:24`).
3. Granite band continuity across `lodDist` — closeup at 1.2 and 1.4 km.
4. Perf — §3.5 rule.
5. The NE fill bank (finding 2c): up to ≈ 4.5 m (+ noise) over 12 m at
   (−185, 205) — look at it under the default seed; if it reads as a scar,
   a fill terrace (a retaining wall on the pad edge) belongs to the temple
   step, not a wider blend.
6. Level wrong by a few metres (D): G2 shares the plateau plane's bias that
   D-20 found at the Sphinx; `G2_PAD_Y` is one constant — moving it moves
   the pad, the pyramid, the court and the wall together.

## 5. Verification checklist

1. Default: fpdump 1142/1142 (or the new count) identical; perf step 1.
2. `npx tsx tools/audit.ts --epoch KHAFRE_PERIOD` — all PASS, G2 checks in.
3. `npx tsx tools/closeup.ts --id pyramid:G2,khafre: --n 4 --epoch
   KHAFRE_PERIOD` (shoot forwards unknown flags).
4. Tour under the epoch: bm12, bm4, bm1, bm2 — at bm4, whether the queens'
   row or G1's south wall hides G2's lower courses (finding 10); the NE
   fill bank at (−185, 205) (§4.5).
5. Perf steps 2–3; the rule.

## 6. Docs to update

- STATUS.md "T2-3 — G2"; DEVIATIONS: "G2 site, platform, granite course,
  enclosure and course count" (G-1, G-2, G-4, G-5, G-6) and, at the causeway
  step, E7; README: `?g2=0` (under the epoch), `perf.ts --q`.
- Small doc fixes Haiku A found: D-19 attributes "NO Khafre/Menkaure/Sphinx"
  to the Bible — it is STATUS's wording (`STATUS.md:45`); the Bible's own
  words are at `MASTER_PROMPT_BIBLE.md:82`. STATUS's bm12 note says "between
  the paws" (`STATUS.md:480`) — the eye (430, 6, 431) stands ≈ 55 m east of
  the paw tips. The spawn comment "looking NW" (`TerrainScene.ts:359`)
  looks SW (finding 8b).

## 7. Haiku precision

Five read-only Haiku agents; every row checked against the code by the
verifier.

| agent | task | rows | confirmed | notes |
|---|---|---|---|---|
| A | canon and sources: G2 numbers, granite, causeway, D-19/D-20 wording | 28 | 28 | its "no red granite in the canon" moved G-4 to an outside source; its Sphinx-band check moved E7's line south |
| B | the platform terrain: ground, level, insertion point, sand, render | 28 | 27 | one supporting number unsourced (a "terrain centre (800, 200)" in no `src/world` file; the conclusion — G2 inside the baked grid — holds); its level +12.0 and its half 127.6 + 25 m blend are proposals, recorded as alternatives (G-2, G-3) |
| C | the pyramid pipeline and the audit | 30 | 30 | full buffers → the uniform; the audit tautology and `new Rng(1)` |
| D | clearances in the KHAFRE world, bookmarks | 28 | 26 | 0 conflicts; spawn comment wrong — confirmed; its apex angles (bm12 14.6°, bm4 11.6°) are wrong: 10.9° and 8.0° with `p.y` as absolute world Y |
| E | measurement and culling | 28 | 28 | `?hide=` cannot isolate G2 → `?g2=0`; the four culling blockers; off-screen cascades |

**Haiku precision: 139/142 (97.9 %).** The verifier's own corrections from
this pass: the nine-point mean (11.0) replaced by the area mean (12.1) and
the cut bound (3.1 → 4.0 m); "the canon says ≈ 10 m" withdrawn; `?hide=`
replaced by `?g2=0`; line numbers moved by T2-2 (plane `:272-274`, knoll
`:138`/`:411`).
