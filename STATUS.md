# PROJECT AKHET — STATUS (source of truth)

> **Rehydration protocol** (for an agent resuming with no context): read this
> file fully, then the brief (the operative spec — binding), then
> `canon/MASTER_PROMPT_BIBLE.md` Vols I–VI, then
> `reference-repos/fable5-world-demo/docs/THREE-NOTES.md` (verified API
> gotchas for the pinned three.js). Never re-plan from scratch; continue from
> "Next actions". Update this file after every meaningful step. Commit per
> milestone. HARD RULE from the human: **no sub-agents** — all work inline.

## Mission (1 paragraph)

Fully procedural reconstruction of the Giza Plateau c. 2550 BCE (epoch: the
Great Pyramid newly completed, construction infrastructure partially
present), ≥4×4 km streamed world in the browser. WebGPU only (three.js
0.184.0 WebGPURenderer + TSL + WGSL compute), TypeScript strict, zero
external assets, world FIXED (?seed = micro-variation only), true cardinal
alignment machine-verified. Visual bar: current-generation cinematic
reconstruction footage. Truth bar: survey dimensions + archaeological
plausibility; every interpretive choice in DEVIATIONS.md. 8 gated phases;
Playwright verification battery; DELTA.md loop per phase; final two-frame
test (dawn from harbor / noon on plateau) + free walk harbor→pyramid.

## Hard rules digest

- Six pillars: geometry-not-textures, light transport (no black shadows —
  machine-enforced), inhabited-not-populated, distance holds, art direction
  (color script), the world moves.
- Floors (brief §2): ≥4096² heightfield; GP block system (courses meshed
  ≤150 m, casing joints ≤30 m, silhouette-true LOD to 10 km); ≥5M tris hero /
  ≥3M vista; worker city massing; ≥12 vessel variants; ≥5k palms; ≥500k field
  instances; ≥80k debris; ≥100k particles; probes+GTAO+SS bounce; CSM 4×2048
  +PCSS+contact; Hillaire atmosphere; raymarched sparse clouds; flowing Nile;
  ≥8 km visibility; no pop <300 m; 60fps@1440p RTX-3060-class.
- Banned (brief §9): smooth pyramid above far silhouette, black/gray shadows,
  bare sand underfoot, clones/grids, skybox sky, anachronisms, broken
  cardinal alignment, MeshBasicMaterial, CPU per-instance updates, one-file
  architecture, asking the user to lower the bar.
- Document precedence: brief > canon > judgment. Canon = content law within
  Tier-1 scope (Khufu complex only; NO Khafre/Menkaure/Sphinx — historically
  correct for 2550 BCE, they don't exist yet).

## Verified environment facts

- Windows 11 Home (win32), PowerShell primary; Git Bash available.
- GPU: **NVIDIA RTX 3050 Laptop 4 GB** (+ Intel UHD — Optimus; adapter
  selection matters for headless shots). CPU i5-11400H 6c, RAM 16 GB.
  This is BELOW the RTX-3060 target class — perf targets stay as specced,
  dev-machine numbers noted as such.
- Node v25.9.0, npm 11.13.0, git 2.36.1.
- three.js pinned **0.184.0** (+@types/three 0.184.1) — matches LAAS's
  verified THREE-NOTES.md (DEVIATIONS D-8). VERIFY unfamiliar TSL APIs
  against node_modules/three before use.
- LAAS repo cloned at `reference-repos/fable5-world-demo` (MIT; attribution
  in LICENSE-THIRD-PARTY). Its STATUS.md is the methodology exemplar; its
  THREE-NOTES.md is binding API reference; its solved-problem log (CSM
  caching, GTAO horizon degeneracy, TRAA velocity for displaced geometry,
  depth-prepass @invariant, shadow-pass hash storm) should be consulted
  BEFORE re-deriving any of those fixes.
- Canon found at `../Ancient_Egipt/Ancient_Egipt.md` → copied to
  `canon/MASTER_PROMPT_BIBLE.md` (Vols I–VI; no Vol VII — Tier 2 blocked as
  expected).
- `/reference` was EMPTY at start (DEVIATIONS D-1) — human to provide frames.
- Dev server: `npm run dev` (port 5173 strict). Shots:
  `npx tsx tools/shoot.ts --scene X --out shots/x.png [--hud 1]`.
  Compare: `npx tsx tools/compare.ts --a ours.png --b ref.png --out cmp.png`;
  pixel sampling: `--sample img.png --px "x,y;x,y"`.

## Phase checklist

- [ ] **Phase 0** — IN PROGRESS (2026-07-10). Scaffold + WebGPU init +
      fail-loud diagnostics + HUD + fly camera + params + CANON_DIMENSIONS
      (cited) + Playwright harness written; sanity scene (compute→storage→
      instanced blocks, StorageTexture, TSL displacement, CPU geometry,
      shadows) written. PENDING: typecheck, first boot, headless shot proof,
      commit.
- [ ] Phase 1 — plateau terrain (control map + geology + sand + quarry cuts)
- [ ] Phase 2 — atmosphere/sun/shadows/volumetrics/clouds/post color script
- [ ] Phase 3 — Great Pyramid block system + casing + LOD; queens + satellite
- [ ] Phase 4 — Khufu complex + sacred axis + mastaba fields
- [ ] Phase 5 — Nile, harbor, vessels, agriculture
- [ ] Phase 6 — worker city, industry, quarry dressing, motion pass
- [ ] Phase 7 — perf, bookmarks, flythrough, full battery, two-frame test

## Key decisions log

- 2026-07-10: three pinned 0.184.0 (D-8). World frame: origin = G1 center,
  +X east, +Z south, Y up (world Y = ASL − 60 m). World extent x[−1200,2800],
  z[−1800,2200]. Epoch = newly completed pyramid (canon Vol V preferred).
  Canonical day = spring equinox (D-2). Tier-1 scope = Khufu complex era —
  no Khafre/Menkaure/Sphinx (not yet built in 2550 BCE).
- Deferred LAAS ports queued for their natural phases: GpuProfiler (per-pass
  timestamps, Phase 2+), ThreePatches material-key memo + VegPrepass
  @invariant (when shadow passes + prepass exist), CsmCached (Phase 2),
  Gtao.ts port with horizon fixes (Phase 2), analytic-reprojection TRAA
  velocity (Phase 2).

## Next actions (always keep current)

1. `npm run typecheck` → fix → boot dev server → verify sanity scene renders
   (headed browser pane first, then headless shot via tools/shoot.ts).
2. Confirm headless WebGPU recipe on THIS machine (Optimus!) — cache flags.
3. Commit Phase-0 milestone; write shots/phase-0 proof images.
4. Phase 0 gate: harness produces side-by-side comparisons; dimension table
   cited. Then Phase 1 terrain.
