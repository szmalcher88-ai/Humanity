/**
 * GizaControl — the AUTHORED terrain control map of the Giza plateau,
 * c. 2550 BCE. Unlike a procedural fantasy world, the macro layout here is
 * FIXED, transcribed from documented topography (Survey of Egypt contours,
 * Lehner & Hawass 2017 maps, Sheisha et al. 2022 palaeo-hydrology):
 *
 *  - Mokattam-formation limestone plateau, surface rising ~2% toward the SW
 *    (G1 base 60 m ASL → Maadi-formation knolls ~102 m ASL to the S–SSW)
 *  - escarpment along the N and E plateau edge dropping to the floodplain
 *  - the Main (Central) Wadi separating the plateau from the Maadi hills —
 *    the ancient transport corridor toward the worker town
 *  - Khufu's horseshoe quarry S–SSE of the pyramid (terraced by QuarryCarve)
 *  - elevated natural bedrock under both pyramid sites (G1 built, G2 empty
 *    in this epoch)
 *  - Old Kingdom floodplain at ~15.5 m ASL with the Khufu branch of the
 *    Nile and the dredged harbor basin at the valley-temple front
 *
 * All heights are WORLD Y (ASL − 60). Functions are TSL graph builders of
 * world position so the same math drives the 4096² bake, the analytic far
 * shell, and later passes needing masks. ?seed only offsets micro-detail
 * noise domains — never the layout (brief: the world is fixed, not seeded).
 */

import {
  abs,
  clamp,
  float,
  min,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  saturate,
  smoothstep,
  vec2,
} from 'three/tsl';
import type { WorldSeed } from '../core/Seed';
import type { NF, NV2 } from '../gpu/TSLTypes';
import {
  G1_CAUSEWAY_AZIMUTH_N_OF_E,
  QUARRY_KHUFU_CENTER,
  VALLEY_TEMPLE_CENTER,
  WORKER_TOWN_CENTER,
} from './CANON_DIMENSIONS';
import { FLOODPLAIN_Y, NILE_BED_Y, HARBOR_BED_Y, aslToY } from './WorldConst';

/* ------------------------------------------------------------------ */
/* Authored anchors (world frame, meters from G1 center; +X E, +Z S)   */
/* ------------------------------------------------------------------ */

/** escarpment crest polyline (NW → E → SE → S), crest ASL at each vertex.
 *  Runs the FULL desert/valley boundary: north edge of the plateau, east
 *  face past the future-Khafre valley area, then south along the eastern
 *  toe of the Maadi hills — everything left-of-travel (N/E) is floodplain. */
const ESCARP: [number, number][] = [
  [-1900, -850],
  [-1250, -700],
  [-600, -560],
  [-100, -430],
  [280, -300],
  [430, -40],
  [490, 330],
  [430, 620],
  [280, 830],
  [150, 1000],
  [180, 1450],
  [420, 1950],
  [800, 2400],
];
const ESCARP_CREST_ASL = [44, 48, 50, 53, 55, 56, 55, 52, 47, 40, 38, 36, 32];

/** slope run-out from crest to floodplain toe (m) */
const ESCARP_RUN = 420;
/** initial cliff share of the total drop (steep upper face, then talus) */

/** Main Wadi centerline (W → E, meets the floodplain by the worker town) */
const WADI: [number, number][] = [
  [-1250, 980],
  [-700, 920],
  [-150, 850],
  [350, 800],
  [700, 810],
  [980, 860],
];
const WADI_FLOOR_ASL = [46, 41, 34, 26, 20, 16];
const WADI_HALF_WIDTH = 150;

/** Maadi-formation knolls south of the wadi: [x, z, radius, peak ASL] */
const KNOLLS: [number, number, number, number][] = [
  [-350, 1500, 520, 102],
  [300, 1650, 420, 88],
  [-950, 1400, 430, 90],
  [850, 1750, 380, 72],
];

/** Khufu-branch channel centerline (N → S; the Nile flows toward −Z) */
const NILE: [number, number][] = [
  [2080, -1900],
  [1960, -1000],
  [1900, -200],
  [1950, 600],
  [2060, 1400],
  [2180, 2250],
];
const NILE_HALF_WIDTH = 130;

/** harbor basin (dredged, at the valley-temple front) */
const HARBOR_C: [number, number] = [VALLEY_TEMPLE_CENTER.x + 260, VALLEY_TEMPLE_CENTER.z - 20];
const HARBOR_RX = 210;
const HARBOR_RZ = 150;

/** harbor↔river approach channel */
const APPROACH: [number, number][] = [
  [HARBOR_C[0], HARBOR_C[1]],
  [1500, -150],
  [1900, -120],
];
const APPROACH_HALF_WIDTH = 55;

/** quarry bowl (Khufu's horseshoe) — carved into terraces by QuarryCarve */
export const QUARRY_C: [number, number] = [QUARRY_KHUFU_CENTER.x, QUARRY_KHUFU_CENTER.z];
export const QUARRY_RX = 210;
export const QUARRY_RZ = 145;
export const QUARRY_ROT = 0.26; // radians, long axis WSW–ENE
export const QUARRY_DEPTH = 13; // max extraction depth below pre-quarry surface

/** natural elevated bedrock under the two pyramid sites [x, z, r, rise m] */
const BEDROCK_KNOLLS: [number, number, number, number][] = [
  [0, 0, 170, 2.6], // under G1 (built)
  [-330, 350, 190, 3.2], // the knoll Khafre will later choose (empty in 2550 BCE)
];

export interface GizaParams {
  /** micro-detail noise domain offsets (THE ONLY seed influence) */
  off: Record<'detail' | 'strata' | 'plain' | 'dune' | 'hard' | 'far', [number, number]>;
}

export function makeGizaParams(seed: WorldSeed): GizaParams {
  const rng = seed.rng('giza-detail-offsets');
  const off = (): [number, number] => [rng.range(-500, 500), rng.range(-500, 500)];
  return {
    off: {
      detail: off(),
      strata: off(),
      plain: off(),
      dune: off(),
      hard: off(),
      far: off(),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Spline helpers                                                       */
/* ------------------------------------------------------------------ */

function segDist(p: NV2, a: [number, number], b: [number, number]): { d: NF; t: NF } {
  const av = vec2(a[0], a[1]);
  const ab = vec2(b[0] - a[0], b[1] - a[1]);
  const len2 = ab.dot(ab);
  const t = saturate(p.sub(av).dot(ab).div(len2));
  const d = p.sub(av.add(ab.mul(t))).length();
  return { d, t };
}

/** distance to polyline + interpolated per-vertex value at nearest point */
function splineField(p: NV2, pts: [number, number][], vals: number[]): { dist: NF; val: NF } {
  let bestD: NF = float(1e9);
  let bestV: NF = float(vals[0] ?? 0);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i] as [number, number];
    const b = pts[i + 1] as [number, number];
    const v0 = vals[i] ?? 0;
    const v1 = vals[i + 1] ?? 0;
    const { d, t } = segDist(p, a, b);
    const v = t.mul(v1 - v0).add(v0);
    const closer = d.lessThan(bestD);
    bestV = closer.select(v, bestV);
    bestD = min(bestD, d);
  }
  return { dist: bestD, val: bestV };
}

/** signed distance to the escarpment crest: >0 on the floodplain side.
 *  Uses the nearest segment's outward normal (crest runs NW→SE, plateau
 *  on its SW side). */
function escarpSigned(p: NV2): { sd: NF; crest: NF } {
  let bestD: NF = float(1e9);
  let bestSd: NF = float(0);
  let bestCrest: NF = float(ESCARP_CREST_ASL[0] ?? 50);
  for (let i = 0; i < ESCARP.length - 1; i++) {
    const a = ESCARP[i] as [number, number];
    const b = ESCARP[i + 1] as [number, number];
    const c0 = ESCARP_CREST_ASL[i] ?? 50;
    const c1 = ESCARP_CREST_ASL[i + 1] ?? 50;
    const { d, t } = segDist(p, a, b);
    // outward normal: rotate segment dir (dx,dz) by −90° → (dz,−dx) points
    // LEFT of travel; crest travels NW→SE so left = NE = floodplain side
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const inv = 1 / Math.hypot(dx, dz);
    const nx = dz * inv;
    const nz = -dx * inv;
    const side = p
      .sub(vec2(a[0], a[1]))
      .dot(vec2(nx, nz));
    const closer = d.lessThan(bestD);
    bestSd = closer.select(side.sign().mul(d), bestSd);
    bestCrest = closer.select(t.mul(c1 - c0).add(c0), bestCrest);
    bestD = min(bestD, d);
  }
  return { sd: bestSd, crest: bestCrest };
}

/* ------------------------------------------------------------------ */
/* Field bundles                                                        */
/* ------------------------------------------------------------------ */

export interface GizaMasks {
  /** 1 on the alluvial plain (east of the escarpment toe) */
  floodplain: NF;
  /** 1 inside the Nile channel */
  river: NF;
  /** 1 inside harbor basin or approach channel */
  harbor: NF;
  /** 1 on the wadi floor */
  wadi: NF;
  /** 1 inside the quarry bowl */
  quarry: NF;
  /** 0..1 exposed-bedrock tendency (plateau top, scarp faces) */
  bedrockExposure: NF;
  /** analytic moisture proxy 0..1 (distance to water, low ground) */
  moisture: NF;
}

export interface GizaNodes extends GizaMasks {
  /** terrain height, world Y (before sand transport + quarry terracing) */
  height: NF;
  /** rock hardness 0..1 (strata banding — drives shelving + material) */
  hardness: NF;
  /** quarry extraction depth potential (m) — QuarryCarve terraces this */
  quarryDepth: NF;
}

/**
 * Build the Giza terrain graph at p (world meters).
 * detail: 'full' for the bake; 'far' for the analytic vista shell (fewer
 * octaves, plus the valley's east bank and distant desert relief).
 */
export function gizaTerrain(p: NV2, gp: GizaParams, detail: 'full' | 'far'): GizaNodes {
  const full = detail === 'full';
  const o = gp.off;

  /* --- plateau body: tilted Mokattam surface ---------------------------- */
  // rises toward SW: dirSW = (−0.707, +0.707); ~2.0% grade. The plane caps
  // at +12 m (≈72 ASL) — higher ground belongs to the Maadi knolls below.
  const swDot = p.x.mul(-0.7071).add(p.y.mul(0.7071));
  const plateauAsl = float(60)
    .add(swDot.mul(0.02).clamp(-14, 12))
    // long-wavelength undulation of the rock surface (±1.8 m)
    .add(
      mx_noise_float(p.div(640).add(vec2(o.detail[0], o.detail[1]))).mul(1.8),
    );

  /* --- Maadi knolls (south of the wadi) --------------------------------- */
  // blend toward each knoll's documented peak above the capped plane
  let knolls: NF = float(0);
  for (const [kx, kz, kr, peakAsl] of KNOLLS) {
    const d = p.sub(vec2(kx, kz)).length();
    const t = smoothstep(kr, kr * 0.15, d);
    knolls = knolls.max(t.pow(1.4).mul(Math.max(0, peakAsl - 72)));
  }

  /* --- escarpment: plateau → floodplain drop ----------------------------- */
  const esc = escarpSigned(p);
  // edge meander so the crest is not a ruler line (small — real crest is sharp)
  const crestWobble = full
    ? mx_noise_float(p.div(120).add(vec2(o.detail[0] + 37, o.detail[1] - 91))).mul(28)
    : float(0);
  const sdE = esc.sd.add(crestWobble);
  // profile: first 90 m = steep cliff (60% of drop), then talus to the toe
  const dropT = clamp(sdE.div(ESCARP_RUN), 0, 1);
  const cliffT = clamp(sdE.div(90), 0, 1);
  const profile = cliffT.pow(0.8).mul(0.6).add(
    smoothstep(0.18, 1, dropT).mul(0.4),
  );
  const crestY = esc.crest.sub(60); // ASL → world Y
  const floodY = float(FLOODPLAIN_Y);

  // plateau-side: the tilted surface eases down to the crest as it nears
  // the edge; floodplain-side: descend from that SAME height (no seam)
  const plateauY = plateauAsl.sub(60).add(knolls);
  const edgeY = min(plateauY, crestY);
  const plateauSide = mix(
    plateauY,
    edgeY,
    smoothstep(-160, 0, sdE),
  );
  const escSide = mix(edgeY, floodY, profile);
  let h: NF = sdE.greaterThan(0).select(escSide, plateauSide);

  /* --- Main Wadi (transport corridor) ------------------------------------ */
  const wadi = splineField(p, WADI, WADI_FLOOR_ASL);
  const wadiFloorY = wadi.val.sub(60);
  const uWadi = smoothstep(0, WADI_HALF_WIDTH, wadi.dist).pow(1.7);
  // carve only where the wadi floor is BELOW the current surface
  const wadiCarved = wadiFloorY.add(h.sub(wadiFloorY).mul(uWadi));
  h = min(h, wadiCarved.max(wadiFloorY));

  /* --- floodplain flattening --------------------------------------------- */
  // everything at/below the plain level east of the toe settles to alluvium
  const plainMask = smoothstep(ESCARP_RUN * 0.92, ESCARP_RUN * 1.15, sdE);
  h = mix(h, floodY, plainMask);

  /* --- Nile channel ------------------------------------------------------- */
  // STEEP banks (~35 m of run): a wide half-carved fringe hovers around the
  // water stage and renders as shoreline speckle (found in the first
  // top-down) — the real Nile cuts its floodplain banks near-vertically
  const nile = splineField(p, NILE, NILE.map(() => 0));
  const meander = full
    ? mx_noise_float(p.div(210).add(vec2(o.plain[0] - 61, o.plain[1] + 43))).mul(34)
    : float(0);
  const nileDist = nile.dist.add(meander);
  const riverMask = smoothstep(NILE_HALF_WIDTH + 5, NILE_HALF_WIDTH - 30, nileDist);
  const bedY = float(NILE_BED_Y).sub(riverMask.mul(1.5));
  h = mix(h, bedY, riverMask.pow(0.9));
  // low natural levees just back from the bank crest
  const leveeBand = smoothstep(NILE_HALF_WIDTH + 75, NILE_HALF_WIDTH + 25, nileDist)
    .mul(smoothstep(NILE_HALF_WIDTH + 2, NILE_HALF_WIDTH + 20, nileDist));
  h = h.add(leveeBand.mul(0.7).mul(plainMask));

  /* --- harbor basin + approach channel (steep dredged edges) --------------- */
  const dHarbor = p
    .sub(vec2(HARBOR_C[0], HARBOR_C[1]))
    .div(vec2(HARBOR_RX, HARBOR_RZ))
    .length();
  const harborMask = smoothstep(1.0, 0.9, dHarbor);
  const app = splineField(p, APPROACH, [HARBOR_BED_Y, aslToY(9.0), aslToY(8.0)]);
  const appMask = smoothstep(APPROACH_HALF_WIDTH + 6, APPROACH_HALF_WIDTH - 18, app.dist);
  const harborAll = harborMask.max(appMask);
  const harborBedY = mix(app.val, float(HARBOR_BED_Y), harborMask);
  h = mix(h, harborBedY, harborAll.mul(plainMask.max(harborMask)));

  /* --- floodplain micro-relief, suppressed near water edges ---------------- */
  if (full) {
    const nearWater = riverMask
      .max(harborAll)
      .max(smoothstep(NILE_HALF_WIDTH + 60, NILE_HALF_WIDTH + 5, nileDist));
    const plainMicro = mx_noise_float(p.div(90).add(vec2(o.plain[0], o.plain[1])))
      .mul(0.35)
      .mul(plainMask)
      .mul(nearWater.oneMinus());
    h = h.add(plainMicro);
  }

  /* --- quarry bowl (pre-terracing depth potential) ------------------------ */
  const ca = Math.cos(QUARRY_ROT);
  const sa = Math.sin(QUARRY_ROT);
  const pq = p.sub(vec2(QUARRY_C[0], QUARRY_C[1]));
  const pqr = vec2(
    pq.x.mul(ca).sub(pq.y.mul(sa)).div(QUARRY_RX),
    pq.x.mul(sa).add(pq.y.mul(ca)).div(QUARRY_RZ),
  );
  const dq = pqr.length();
  // horseshoe: bowl open toward the SE (transport exit) — depth fades in a
  // sector so sleds could haul blocks out on a graded floor
  const exitDir = pq.normalize().dot(vec2(0.64, 0.77));
  const exitKeep = smoothstep(0.55, 0.95, exitDir).mul(smoothstep(1.35, 0.7, dq));
  const bowl = smoothstep(1.0, 0.35, dq);
  const quarryDepth = bowl
    .mul(QUARRY_DEPTH)
    .mul(exitKeep.mul(0.85).oneMinus());
  const quarryMask = smoothstep(0.995, 0.9, dq);

  /* --- natural bedrock knolls under the pyramid sites --------------------- */
  for (const [bx, bz, br, rise] of BEDROCK_KNOLLS) {
    const d = p.sub(vec2(bx, bz)).length();
    h = h.add(smoothstep(br, br * 0.25, d).mul(rise));
  }


  /* --- geology detail: limestone shelving + surface roughness ------------- */
  const hardStrata = mx_noise_float(
    vec2(h.mul(0.13), mx_noise_float(p.div(700)).mul(1.7)).add(
      vec2(o.hard[0], o.hard[1]),
    ),
  )
    .mul(0.5)
    .add(0.5);
  if (full) {
    // strata shelving: quantize height into Mokattam bedding benches — but
    // ONLY on genuinely sloping rock (scarp faces, wadi walls, knoll
    // flanks). Blanket application turned the near-flat plateau into
    // 50 m-wide contour stripes (first top-down finding).
    const escFace = smoothstep(-30, 30, sdE).mul(smoothstep(280, 120, sdE));
    const wadiWall = smoothstep(WADI_HALF_WIDTH + 40, WADI_HALF_WIDTH - 20, wadi.dist)
      .mul(smoothstep(WADI_HALF_WIDTH * 0.35, WADI_HALF_WIDTH * 0.7, wadi.dist));
    // narrow band on the STEEP mid-flank only — wide bands printed bench
    // contour "fingerprints" across gentle sandy slopes (ToD sweep finding)
    let knollFlank: NF = float(0);
    for (const [kx, kz, kr] of KNOLLS) {
      const d = p.sub(vec2(kx, kz)).length();
      knollFlank = knollFlank.max(
        smoothstep(kr * 0.78, kr * 0.6, d).mul(smoothstep(kr * 0.28, kr * 0.45, d)),
      );
    }
    const shelfMask = escFace.max(wadiWall).max(knollFlank)
      .mul(plainMask.oneMinus())
      .mul(riverMask.oneMinus())
      .mul(harborAll.oneMinus());
    const band = float(1.15); // bench spacing (m) — Mokattam bedding scale
    const cell = h.div(band);
    const riser = cell.fract();
    const shelfK = smoothstep(0.12, 0.5, hardStrata);
    const shelf = smoothstep(shelfK.mul(0.72), 1, riser).add(cell.floor()).mul(band);
    h = mix(h, shelf, shelfMask.mul(0.7));
    // fine surface detail (±0.5 m fbm — the seed's only visible influence);
    // suppressed on shelved benches (worked/bedded rock reads clean, not
    // salt-and-pepper) and on the alluvial plain
    const bedrockK = plainMask.max(riverMask).max(harborAll).oneMinus();
    const det = mx_fractal_noise_float(
      p.div(46).add(vec2(o.detail[0], o.detail[1])),
      4,
      2.05,
      0.5,
      1,
    ).mul(0.5);
    // quarry floors are WORKED surfaces — no natural lump noise there
    h = h.add(
      det
        .mul(bedrockK.mul(0.8).add(0.2))
        .mul(shelfMask.mul(0.75).oneMinus())
        .mul(quarryMask.oneMinus()),
    );
  }

  /* --- prepared construction platforms (Phase 3+) -------------------------
   * Applied AFTER all natural detail: worked surfaces are dead flat.
   * G1 court leveled at Y=0 (baseline within 2.1 cm — CANON tolerance);
   * covers pyramid + court + satellite corner. Queens' row gets its own
   * terrace cut into the east slope. */
  const dG1 = p.abs();
  const g1Pad = smoothstep(190, 165, dG1.x.max(dG1.y));
  h = mix(h, float(0), g1Pad);
  // centered on the queens' row (z 52..156 after the collision fix) and
  // wide enough that the 46 m bases sit fully on the terrace, not corners
  // hanging off the east slope
  const dQ = p.sub(vec2(190, 104)).abs();
  const qPad = smoothstep(34, 25, dQ.x).mul(smoothstep(102, 84, dQ.y));
  h = mix(h, float(-1.2), qPad.mul(g1Pad.oneMinus()));

  /* --- far shell relief (beyond the grid, 'far' branch only) --------------- */
  if (!full) {
    // western/southern desert: long dune-sheet undulation + far scarp lines;
    // eastern valley: the plain continues, then the east-bank desert rises
    const farDesert = mx_fractal_noise_float(
      p.div(2400).add(vec2(o.far[0], o.far[1])),
      4,
      2.1,
      0.5,
      1,
    )
      .mul(0.5)
      .add(0.5);
    const westness = smoothstep(400, -2200, p.x); // grows west of the plateau
    h = h.add(farDesert.mul(38).mul(westness));
    const eastBank = smoothstep(2700, 5200, p.x); // east-bank desert rise
    h = h.add(farDesert.mul(30).add(14).mul(eastBank));
  }

  /* --- masks + fields ------------------------------------------------------ */
  const bedrockExposure = clamp(
    plainMask.oneMinus().mul(hardStrata.mul(0.5).add(0.5)),
    0,
    1,
  );
  // analytic moisture: river/harbor proximity + low plain; the flood basins
  // and canals refine this in Phase 5
  const moisture = clamp(
    riverMask
      .mul(1.0)
      .max(harborAll.mul(0.9))
      .max(smoothstep(320, 40, nileDist).mul(0.55))
      .max(plainMask.mul(0.3)),
    0,
    1,
  );

  return {
    height: h,
    hardness: clamp(float(0.3).add(hardStrata.mul(0.55)), 0.1, 0.95),
    quarryDepth,
    floodplain: plainMask,
    river: riverMask,
    harbor: harborAll,
    wadi: smoothstep(WADI_HALF_WIDTH, WADI_HALF_WIDTH * 0.45, wadi.dist),
    quarry: quarryMask,
    bedrockExposure,
    moisture,
  };
}

/**
 * Causeway corridor helper (Phase 4 consumes this; declared here because the
 * terrain must keep the corridor viable): straight line from the mortuary
 * temple front to the valley temple at the authored azimuth.
 */
export function causewayAxis(): { ax: number; az: number; bx: number; bz: number } {
  const az = (G1_CAUSEWAY_AZIMUTH_N_OF_E.value * Math.PI) / 180;
  const bx = VALLEY_TEMPLE_CENTER.x;
  const bz = VALLEY_TEMPLE_CENTER.z;
  return { ax: bx - Math.cos(az) * 825, az: bz + Math.sin(az) * 825, bx, bz };
}

/** worker-town anchor re-export for scenes/tools */
export const WORKER_TOWN: [number, number] = [WORKER_TOWN_CENTER.x, WORKER_TOWN_CENTER.z];

/** convenience: does |p| sit east of the escarpment toe (analytic, CPU)? */
export function isFloodplainCpu(x: number, z: number): boolean {
  // cheap CPU mirror: beyond the toe of the nearest escarpment segment
  let bestD = Infinity;
  let side = 0;
  for (let i = 0; i < ESCARP.length - 1; i++) {
    const a = ESCARP[i] as [number, number];
    const b = ESCARP[i + 1] as [number, number];
    const abx = b[0] - a[0];
    const abz = b[1] - a[1];
    const len2 = abx * abx + abz * abz;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * abx + (z - a[1]) * abz) / len2));
    const px = a[0] + abx * t;
    const pz = a[1] + abz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < bestD) {
      bestD = d;
      const inv = 1 / Math.hypot(abx, abz);
      side = (x - a[0]) * (abz * inv) + (z - a[1]) * (-abx * inv);
    }
  }
  return side > ESCARP_RUN;
}

// keep unused-import lint honest: abs used in far branch variants
void abs;
