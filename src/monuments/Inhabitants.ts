/**
 * Inhabitants (Phase 7) — the people, the animals and the temporary works
 * that turn a survey model into a construction site.
 *
 * Pillar C is "inhabited, not populated": the point is not a headcount, it is
 * that the site reads as MID-JOB. So the crowds are placed on the actual work
 * lines — the quarry faces, the haul road, the ramp head, the causeway, the
 * quay — in FILES and GANGS, never as an even scatter, and the biggest
 * clusters sit where the biggest job is.
 *
 * Three systems:
 *  1. WORKER GANGS — instanced figures with a real walking gait computed in
 *     the vertex stage (limb id per vertex, hip/shoulder pivots, per-instance
 *     phase). They PING-PONG along their file: a triangle wave with a yaw
 *     flip at each end, so a haul road carries traffic in both directions and
 *     nothing ever teleports (a wrapping loop pops, however small the figure).
 *  2. OX SLEDGE TRAINS — a static tableau: teams yoked to a wooden sledge
 *     with a dressed block on it, ropes running forward to the haul gang.
 *     Static on purpose; the life comes from the gang leaning into the ropes.
 *  3. SCAFFOLDING — timber falsework, a block on its sledge and a rubble construction
 *     ramp on the mortuary temple's SE corner: the one building visibly
 *     unfinished, which is what dates the whole frame.
 *
 * Figures are ~70 tris. At their working distance (40–600 m) they are 2–20 px
 * tall, which is exactly the budget: silhouette, proportion and gait read at
 * that size; faces do not, and are not attempted (the brief's no-close-ups
 * rule for crowds).
 */

import {
  BufferAttribute,
  BufferGeometry,
  InstancedMesh,
  Mesh,
  type Object3D,
} from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  attribute,
  cameraPosition,
  cos,
  float,
  instancedArray,
  instanceIndex,
  mix,
  normalLocal,
  positionLocal,
  sin,
  smoothstep,
  transformNormalToView,
  varying,
  vec2,
  vec3,
} from 'three/tsl';
import type { Rng, WorldSeed } from '../core/Seed';
import type { Heightfield } from '../world/Heightfield';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { giLightMap } from './PyramidBuilder';
import { GeoWriter, limestoneMaterial } from './KhufuComplex';
import type { NF, NV3 } from '../gpu/TSLTypes';
import { uWorldTime } from '../render/WorldClock';
import { attachCulling, cellSortVec4, geoBounds } from '../render/InstanceCull';
import { QUARRY_KHUFU_CENTER, VALLEY_TEMPLE_CENTER, WORKER_TOWN_CENTER } from '../world/CANON_DIMENSIONS';
import { NILE_WATER_Y } from '../world/WorldConst';
import { fpAll, type Footprint } from '../debug/Footprints';
import { townToWorld } from '../world/TownFrame';

/** figures allowed ON TOP of the budget for lines contributed by other
 *  systems (the farmsteads' threshers) */
const EXTRA_SHARE = 0.08;
const FIGURE_BUDGET = { safe: 140, low: 320, high: 900, ultra: 1200 } as const;
/** figures are sub-pixel past this; the shader collapses them there */
const FIG_FADE = [760, 560] as const;

/* ------------------------------------------------------------------ */
/* figure geometry                                                     */
/* ------------------------------------------------------------------ */

/** limb ids, written into the `limb` attribute and read by the gait */
const BODY = 0;
const LEG_A = 1;
const LEG_B = 2;
const ARM_A = 3;
const ARM_B = 4;

class FigureWriter {
  pos: number[] = [];
  limb: number[] = [];
  /** 0 = skin, 1 = linen kilt, 2 = hair/headcloth */
  mat: number[] = [];

  /** tapered box from (x0,y0,z0) to (x1,y1,z1) with half-widths w0/w1 */
  bone(
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    w0: number, w1: number, limb: number, m: number,
  ): void {
    // build a 4-sided prism between the two points; up-ish orientation is
    // enough for a silhouette at range
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dy, dz) || 1e-4;
    // proper orthonormal cross-section basis: d × up, then d × a. (The first
    // version hand-rolled this wrong and every limb splayed out like a
    // tripod — visible the moment a figure came within 40 m.)
    const ex = dx / len;
    const ey = dy / len;
    const ez = dz / len;
    const upx = Math.abs(ey) > 0.9 ? 1 : 0;
    const upy = Math.abs(ey) > 0.9 ? 0 : 1;
    let ax = ey * 0 - ez * upy;
    let ay = ez * upx - ex * 0;
    let az = ex * upy - ey * upx;
    const an = Math.hypot(ax, ay, az) || 1;
    ax /= an;
    ay /= an;
    az /= an;
    const bx = ey * az - ez * ay;
    const by = ez * ax - ex * az;
    const bz = ex * ay - ey * ax;
    const ring = (t: number, w: number): number[][] => {
      const cx = x0 + dx * t;
      const cy = y0 + dy * t;
      const cz = z0 + dz * t;
      return [
        [cx + ax * w, cy + ay * w, cz + az * w],
        [cx + bx * w, cy + by * w, cz + bz * w],
        [cx - ax * w, cy - ay * w, cz - az * w],
        [cx - bx * w, cy - by * w, cz - bz * w],
      ];
    };
    const r0 = ring(0, w0);
    const r1 = ring(1, w1);
    const quad = (a: number[], b: number[], c: number[], d: number[]): void => {
      this.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (let i = 0; i < 6; i++) {
        this.limb.push(limb);
        this.mat.push(m);
      }
    };
    for (let k = 0; k < 4; k++) {
      const n = (k + 1) % 4;
      quad(r0[k] as number[], r0[n] as number[], r1[n] as number[], r1[k] as number[]);
    }
    // caps
    quad(r1[0] as number[], r1[1] as number[], r1[2] as number[], r1[3] as number[]);
    quad(r0[3] as number[], r0[2] as number[], r0[1] as number[], r0[0] as number[]);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('limb', new BufferAttribute(new Float32Array(this.limb), 1));
    g.setAttribute('matid', new BufferAttribute(new Float32Array(this.mat), 1));
    g.computeVertexNormals();
    return g;
  }
}

/**
 * One figure variant, ~1.65 m (Old Kingdom male mean). Proportions matter
 * far more than detail at 4 px: shoulder width, the kilt's hem line and the
 * gap between the legs are the whole silhouette.
 */
function figureGeometry(rng: Rng, carrying: boolean): BufferGeometry {
  const w = new FigureWriter();
  const H = rng.range(1.58, 1.74);
  const sh = H * 0.82; // shoulder height
  const hip = H * 0.5;
  const shoulderW = H * 0.115;
  // legs (skin below the kilt hem)
  w.bone(-0.055, hip, 0, -0.06, 0.02, 0, 0.05, 0.032, LEG_A, 0);
  w.bone(0.055, hip, 0, 0.06, 0.02, 0, 0.05, 0.032, LEG_B, 0);
  // kilt: a short flared block over the hips (the Old Kingdom shendyt)
  w.bone(0, hip + 0.2, 0, 0, hip - 0.16, 0, 0.085, 0.105, BODY, 1);
  // torso, tapering up to the shoulders
  w.bone(0, hip + 0.16, 0, 0, sh, 0, 0.095, shoulderW, BODY, 0);
  // arms — a carrier's arms ride forward and up
  const ay = carrying ? sh - 0.28 : sh - 0.62;
  const az = carrying ? 0.24 : 0.02;
  w.bone(-shoulderW, sh, 0, -shoulderW - 0.02, ay, az, 0.036, 0.028, ARM_A, 0);
  w.bone(shoulderW, sh, 0, shoulderW + 0.02, ay, az, 0.036, 0.028, ARM_B, 0);
  // neck + head, with a headcloth tone
  w.bone(0, sh, 0, 0, sh + 0.07, 0, 0.03, 0.035, BODY, 0);
  w.bone(0, sh + 0.07, 0, 0, H, 0, 0.062, 0.05, BODY, 2);
  if (carrying) {
    // a basket / block on the shoulder — the reason the arms are up
    w.bone(-0.11, sh + 0.05, 0.02, 0.11, sh + 0.05, 0.02, 0.075, 0.075, BODY, 1);
  }
  return w.build();
}

/* ------------------------------------------------------------------ */
/* work lines                                                          */
/* ------------------------------------------------------------------ */

export interface Gang {
  /** file start and end (the figures ping-pong between them) */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** how many figures walk this file */
  n: number;
  /** file half-width (m) — a gang spreads, a rope team is narrow */
  spread: number;
  /** fraction carrying a load */
  carry: number;
  /** 0 = walking the line, 1 = standing/working in place */
  still: number;
}

/**
 * Solid structures a figure may neither stand in nor walk through (v1.1 —
 * files crossed the temenos wall, gallery blocks and the causeway). Built
 * from the footprint registry, which every structure fills before the
 * inhabitants are placed; a 24 m spatial hash keeps ~900 figures × their
 * beat samples cheap. A footprint whose top is below the figure's feet is
 * ground it may walk ON, not an obstacle.
 */
function obstacleField(): (x: number, z: number, y: number) => boolean {
  const CELL = 24;
  const grid = new Map<number, Footprint[]>();
  const key = (gx: number, gz: number): number => gx * 73856093 + gz * 19349663;
  for (const f of fpAll()) {
    if (f.passive) continue;
    const r = Math.hypot(f.hx, f.hz) + 1;
    for (let gx = Math.floor((f.x - r) / CELL); gx <= Math.floor((f.x + r) / CELL); gx++) {
      for (let gz = Math.floor((f.z - r) / CELL); gz <= Math.floor((f.z + r) / CELL); gz++) {
        const k = key(gx, gz);
        const list = grid.get(k);
        if (list) list.push(f);
        else grid.set(k, [f]);
      }
    }
  }
  const PAD = 0.45; // a body's half-width plus a little air
  return (x, z, y) => {
    const list = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return false;
    for (const f of list) {
      if (f.y1 < y + 0.3 || f.y0 > y + 1.8) continue; // walked on, or overhead
      const c = Math.cos(-(f.yaw ?? 0));
      const s = Math.sin(-(f.yaw ?? 0));
      const dx = x - f.x;
      const dz = z - f.z;
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) < f.hx + PAD && Math.abs(lz) < f.hz + PAD) return true;
    }
    return false;
  };
}

/** a work line given in the worker town's own frame */
function townLine(
  u0: number, v0: number, u1: number, v1: number,
  n: number, spread: number, carry: number, still: number,
): Gang[] {
  const [x0, z0] = townToWorld(u0, v0);
  const [x1, z1] = townToWorld(u1, v1);
  return [{ x0, z0, x1, z1, n, spread, carry, still }];
}

function workLines(): Gang[] {
  const qx = QUARRY_KHUFU_CENTER.x;
  const qz = QUARRY_KHUFU_CENTER.z;
  const tx = WORKER_TOWN_CENTER.x;
  const tz = WORKER_TOWN_CENTER.z;
  const vx = VALLEY_TEMPLE_CENTER.x;
  const vz = VALLEY_TEMPLE_CENTER.z;
  return [
    // the haul road: quarry → ramp head → the pyramid's south-east foot.
    // This is the busiest line on the site and it should look it.
    { x0: qx - 10, z0: qz - 60, x1: 40, z1: 215, n: 150, spread: 5.5, carry: 0.45, still: 0.05 },
    { x0: 40, z0: 215, x1: 105, z1: 120, n: 90, spread: 4.5, carry: 0.5, still: 0.08 },
    // quarry faces: gangs working the benches, mostly standing
    { x0: qx - 80, z0: qz - 30, x1: qx + 80, z1: qz + 20, n: 110, spread: 34, carry: 0.15, still: 0.75 },
    { x0: qx - 40, z0: qz + 60, x1: qx + 50, z1: qz + 75, n: 60, spread: 20, carry: 0.2, still: 0.7 },
    // masons' yards outside the SE temenos
    { x0: 160, z0: 200, x1: 270, z1: 130, n: 70, spread: 16, carry: 0.2, still: 0.72 },
    // the temple's unfinished SE corner — the gang working the falsework and
    // the ramp. Scaffolding with nobody on it reads as abandoned, not mid-job.
    { x0: 150, z0: 33, x1: 176, z1: 41, n: 26, spread: 5, carry: 0.35, still: 0.62 },
    // the causeway: a file of porters climbing to the plateau — on the
    // construction road along its SOUTH flank (v1.1: the file ran down the
    // causeway's own axis, i.e. inside its walled, roofed embankment)
    { x0: vx - 38, z0: vz + 9, x1: 202, z1: -18, n: 90, spread: 3.2, carry: 0.6, still: 0.04 },
    // the quay: unloading, and the road up from the harbour.
    // (v1.1) both lines used to lie IN the basin — one along its east edge,
    // one straight across it — and the water test dropped every figure:
    // the busiest place on the site was empty. Now on the west shore behind
    // the stone quay, and round the north shore past the magazines.
    { x0: 872, z0: -232, x1: 884, z1: -46, n: 70, spread: 7, carry: 0.55, still: 0.35 },
    { x0: 1215, z0: -332, x1: 905, z1: -318, n: 55, spread: 5, carry: 0.5, still: 0.08 },
    { x0: 905, z0: -318, x1: vx + 40, z1: vz - 40, n: 35, spread: 5, carry: 0.5, still: 0.06 },
    // harbor district (v1.1): stone yard, slipway heads, boatyard
    { x0: 893, z0: -292, x1: 940, z1: -262, n: 34, spread: 12, carry: 0.2, still: 0.72 },
    // slipway heads: hauling teams on the FLANKS of the ramps (v1.2: on the
    // ramp axis, inside the runs' footprint, most were shoved or dropped)
    { x0: 1033.6, z0: -310.7, x1: 1038.1, z1: -289.2, n: 16, spread: 3, carry: 0.5, still: 0.4 },
    { x0: 1165.8, z0: -299.1, x1: 1156.0, z1: -279.4, n: 16, spread: 3, carry: 0.5, still: 0.4 },
    { x0: 992, z0: 58, x1: 1116, z1: 74, n: 44, spread: 10, carry: 0.25, still: 0.75 },
    // the market lane on the north-shore road (v1.2): sellers and buyers
    { x0: 926, z0: -334, x1: 992, z1: -334, n: 36, spread: 3.4, carry: 0.35, still: 0.65 },
    { x0: 1035, z0: 90, x1: 1085, z1: 96, n: 14, spread: 4, carry: 0.6, still: 0.2 },
    // town: the gallery street and the bakery yard
    { x0: tx - 110, z0: tz - 96, x1: tx + 60, z1: tz - 92, n: 90, spread: 6, carry: 0.25, still: 0.3 },
    { x0: tx - 95, z0: tz + 34, x1: tx + 10, z1: tz + 40, n: 60, spread: 9, carry: 0.2, still: 0.6 },
    // the Wall of the Crow gate — the whole town funnels through it
    { x0: tx - 168, z0: tz - 230, x1: tx - 168, z1: tz - 190, n: 55, spread: 5, carry: 0.3, still: 0.15 },
    // industrial quarter (v1.1): moulders on the drying field, brick porters
    // up to the town, potters, copper smiths, rope makers walking the walk
    ...townLine(104, 104, 140, 188, 46, 16, 0.2, 0.82),
    ...townLine(96, 110, 40, 60, 30, 3.5, 0.85, 0.05),
    // potters in the lane between the kilns and the jar rows (v1.2: the
    // line ran through the solid jar block)
    ...townLine(-20, 127, 20, 128, 18, 3, 0.25, 0.8),
    ...townLine(-12, 172, 8, 190, 14, 7, 0.15, 0.85),
    // rope makers walk BESIDE the laid rope, east of the post row (v1.2:
    // on the walk's axis they stood in the posts and the rope itself)
    ...townLine(61.3, 98, 61.3, 206, 10, 0.3, 0.1, 0.1),
  ];
}

export interface InhabitantCounts {
  figures: number;
  oxen: number;
  sledges: number;
}

export function buildInhabitants(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
  preset: 'safe' | 'low' | 'high' | 'ultra' = 'high',
  cull = true,
  /** work lines contributed by other systems (the farmsteads' threshers) */
  extra: readonly Gang[] = [],
): InhabitantCounts {
  const rng = seed.rng('inhabitants');
  const budget = FIGURE_BUDGET[preset];
  // extra lines go LAST and are scaled from their OWN share of the budget,
  // so the canon lines keep their counts and random draws however many
  // extras arrive (v1.2: one shared scale meant adding a farmstead
  // re-laid every gang on the site)
  const canon = workLines();
  const gangs = [...canon, ...extra];
  const canonWanted = canon.reduce((a, g) => a + g.n, 0);
  const extraWanted = extra.reduce((a, g) => a + g.n, 0);
  const canonScale = Math.min(1, budget / canonWanted);
  const extraScale = extraWanted > 0 ? Math.min(1, (budget * EXTRA_SHARE) / extraWanted) : 0;

  /* --- gather the figures ------------------------------------------------- */
  interface Fig {
    x: number; z: number;   // file anchor (mid point of this figure's beat)
    dx: number; dz: number; // unit direction of the file
    half: number;           // half the beat length (0 = standing)
    phase: number;
    yaw: number;
    h: number;              // per-figure height scale
    carry: boolean;
  }
  const figs: Fig[] = [];
  const blocked = obstacleField();
  let reseated = 0;
  let dropped = 0;
  for (const [gi, g] of gangs.entries()) {
    // retries draw from their own stream, so a figure moved off a wall
    // never re-lays the rest of the file
    const retry = rng.fork(`reseat-${gi}`);
    const n = Math.round(g.n * (gi < canon.length ? canonScale : extraScale));
    const len = Math.hypot(g.x1 - g.x0, g.z1 - g.z0);
    const ux = (g.x1 - g.x0) / (len || 1);
    const uz = (g.z1 - g.z0) / (len || 1);
    // perpendicular, for the file's spread
    const px = -uz;
    const pz = ux;
    for (let i = 0; i < n; i++) {
      const t = rng.float();
      const off = rng.gauss() * g.spread * 0.5;
      let x = g.x0 + ux * len * t + px * off;
      let z = g.z0 + uz * len * t + pz * off;
      let y = hf.heightAtCpu(x, z);
      // a spot inside a structure is re-drawn elsewhere on the same file
      // (v1.1: a quarter of all figures stood inside walls and footprints)
      for (let k = 0; k < 6 && Number.isFinite(y) && blocked(x, z, y); k++) {
        const t2 = retry.float();
        const off2 = retry.gauss() * g.spread * 0.5;
        x = g.x0 + ux * len * t2 + px * off2;
        z = g.z0 + uz * len * t2 + pz * off2;
        y = hf.heightAtCpu(x, z);
        if (!blocked(x, z, y)) reseated++;
      }
      // not in the water. (v1.1: this was `y < -44` — but the whole
      // floodplain lies at −44.5, so every figure on the plain, the harbour
      // included, was silently dropped)
      if (!Number.isFinite(y) || y < NILE_WATER_Y + 0.3) continue;
      const still = rng.chance(g.still);
      let half = still ? 0 : rng.range(9, 26);
      // nobody stands inside a wall (the draws above are made either way,
      // so a dropped figure never re-lays the rest of its file)
      if (blocked(x, z, y)) {
        dropped++;
        continue;
      }
      // a walker's beat must stay on dry, open ground: walk it out in 1 m
      // steps each way and stop short of the first wall or waterline
      if (half > 0) {
        const clear = (sgn: number): number => {
          for (let d = 1; d <= half; d += 1) {
            const px2 = x + ux * d * sgn;
            const pz2 = z + uz * d * sgn;
            const py2 = hf.heightAtCpu(px2, pz2);
            if (py2 < NILE_WATER_Y + 0.3 || blocked(px2, pz2, py2)) return d - 1.2;
          }
          return half;
        };
        half = Math.min(clear(1), clear(-1));
        if (half < 3) half = 0;
      }
      figs.push({
        x, z,
        dx: ux, dz: uz,
        // a walker beats up and down a short stretch of its own file
        half,
        phase: rng.float(),
        yaw: Math.atan2(ux, uz) + (still ? rng.range(-3, 3) : 0),
        h: rng.range(0.94, 1.06),
        carry: rng.chance(g.carry),
      });
    }
  }

  console.log(`[akhet] inhabitants: ${figs.length} placed, ${reseated} moved off structures, ${dropped} dropped`);

  /* --- instancing: two variant classes (free-handed / carrying) ----------- */
  const VARIANTS = 4;
  let figureCount = 0;
  for (let v = 0; v < VARIANTS; v++) {
    const carrying = v >= 2;
    const mine = figs.filter((_, i) => i % VARIANTS === v);
    if (mine.length === 0) continue;
    const data = new Float32Array(mine.length * 4); // x, y, z, yaw
    const dataB = new Float32Array(mine.length * 4); // dx, dz, half, phase
    const dataC = new Float32Array(mine.length * 4); // height, skinTone, kiltTone, cadence
    for (let i = 0; i < mine.length; i++) {
      const f = mine[i] as Fig;
      data[i * 4 + 0] = f.x;
      data[i * 4 + 1] = hf.heightAtCpu(f.x, f.z);
      data[i * 4 + 2] = f.z;
      data[i * 4 + 3] = f.yaw;
      dataB[i * 4 + 0] = f.dx;
      dataB[i * 4 + 1] = f.dz;
      dataB[i * 4 + 2] = f.half;
      dataB[i * 4 + 3] = f.phase;
      dataC[i * 4 + 0] = f.h;
      dataC[i * 4 + 1] = rng.range(0.8, 1.15);
      dataC[i * 4 + 2] = rng.range(0.85, 1.1);
      dataC[i * 4 + 3] = rng.range(0.85, 1.2);
    }
    const cells = cull ? cellSortVec4(mine.length, [data, dataB, dataC], 128, 40) : [];
    const bufA = instancedArray(data, 'vec4');
    const bufB = instancedArray(dataB, 'vec4');
    const bufC = instancedArray(dataC, 'vec4');

    const mat = new MeshPhysicalNodeMaterial();
    const A = bufA.element(instanceIndex);
    const B = bufB.element(instanceIndex);
    const C = bufC.element(instanceIndex);

    // --- gait (v1.1): a SPEED in m/s, the legs locked to it -----------------
    // The first gait drifted figures along their file at ~11 m/s (40 km/h)
    // while the legs swung once every ~3 s — skating — and its "triangle"
    // wave ran −2..1, so every walker teleported 2·half at the wrap and
    // walked backwards for half its beat. Old Kingdom porters: ~1.3 m/s
    // free, ~1.0 m/s under a load, one full leg cycle per ~1.45 m.
    const speed = C.w.mul(carrying ? 1.0 : 1.22); // C.w ∈ 0.85..1.2
    const STRIDE = 1.45;
    const legRate = speed.div(STRIDE).mul(Math.PI * 2);
    const tt = uWorldTime.mul(legRate).add(B.w.mul(11.3));
    // ping-pong lap = out and back = 4·half metres; tri −1 → +1 → −1
    const lap = B.z.max(0.5).mul(4);
    const cyc = uWorldTime.mul(speed).div(lap).add(B.w).fract();
    const tri = float(1).sub(cyc.sub(0.5).abs().mul(4));
    const forward = cyc.lessThan(0.5);
    const swing = sin(tt);

    const limb = attribute('limb', 'float') as unknown as NF;
    const isLegA = limb.greaterThan(LEG_A - 0.5).and(limb.lessThan(LEG_A + 0.5));
    const isLegB = limb.greaterThan(LEG_B - 0.5).and(limb.lessThan(LEG_B + 0.5));
    const isArmA = limb.greaterThan(ARM_A - 0.5).and(limb.lessThan(ARM_A + 0.5));
    const isArmB = limb.greaterThan(ARM_B - 0.5).and(limb.lessThan(ARM_B + 0.5));
    const legSgn = isLegA.select(float(1), isLegB.select(float(-1), float(0)));
    const armSgn = isArmA.select(float(-1), isArmB.select(float(1), float(0)));
    // standing figures (half = 0) only sway; walkers swing a full stride
    const walkK = smoothstep(0.5, 6, B.z);
    const pivot = legSgn.abs().mul(0.82).add(armSgn.abs().mul(1.34));
    // walkers swing a full stride; standing workers only shift their weight
    // slowly (at stride rate they read as marching on the spot)
    const idle = sin(uWorldTime.mul(0.7).add(B.w.mul(23.1)));
    const ang = swing
      .mul(walkK)
      .add(idle.mul(walkK.oneMinus()).mul(0.12))
      .mul(legSgn.mul(0.52).add(armSgn.mul(0.4)));

    const lp0 = positionLocal.mul(C.x);
    const dy = lp0.y.sub(pivot);
    const ca = cos(ang);
    const sa = sin(ang);
    const lp = vec3(
      lp0.x,
      dy.mul(ca).sub(lp0.z.mul(sa)).add(pivot),
      dy.mul(sa).add(lp0.z.mul(ca)),
    );

    // facing: yaw flips 180° on the return leg, eased over the turn so a
    // near figure pivots rather than snapping
    const turn = smoothstep(0.46, 0.5, cyc).sub(smoothstep(0.96, 1.0, cyc));
    const yaw = A.w.add(turn.mul(Math.PI));
    const cy = cos(yaw);
    const sy = sin(yaw);
    const rx = lp.x.mul(cy).sub(lp.z.mul(sy));
    const rz = lp.x.mul(sy).add(lp.z.mul(cy));

    // distance collapse: a 1.65 m figure is sub-pixel past ~700 m
    const camD = A.xyz.sub(cameraPosition).length();
    const fade = smoothstep(FIG_FADE[0], FIG_FADE[1], camD);
    const travel = tri.mul(B.z).mul(walkK);
    // vertical bob twice per leg cycle — the give in the knees
    const bob = sin(tt).abs().mul(0.026).mul(walkK);
    void forward;
    // FEET ON THE GROUND (v1.1): the height was sampled once at the beat's
    // centre, so a walker covering ±26 m of rippled sand or a ramp waded
    // into it on the rises and floated over the dips. Sample the same
    // height buffer the terrain is built from, at the figure's position NOW.
    const gx = A.x.add(B.x.mul(travel));
    const gz = A.z.add(B.y.mul(travel));
    const ground = hf.sampleHeight(vec2(gx, gz));
    mat.positionNode = vec3(
      gx.add(rx.mul(fade)),
      ground.add(lp.y.mul(fade)).add(bob),
      gz.add(rz.mul(fade)),
    );
    const nl = normalLocal;
    const nWorld = varying(
      vec3(nl.x.mul(cy).sub(nl.z.mul(sy)), nl.y, nl.x.mul(sy).add(nl.z.mul(cy))),
    ) as unknown as NV3;
    mat.normalNode = transformNormalToView(nWorld);

    const matid = attribute('matid', 'float') as unknown as NF;
    const skin = vec3(0.36, 0.22, 0.13).mul(varying(C.y) as unknown as NF);
    const linen = vec3(0.82, 0.79, 0.7).mul(varying(C.z) as unknown as NF);
    const hair = vec3(0.11, 0.09, 0.08);
    mat.colorNode = mix(mix(skin, linen, matid.clamp(0, 1)), hair, matid.sub(1).clamp(0, 1));
    mat.roughnessNode = float(0.78);
    mat.metalnessNode = float(0);
    mat.specularIntensity = 0.25;
    giLightMap(mat, gi, nWorld, 1.0);

    const geo = figureGeometry(rng.fork(`fig-${v}`), carrying);
    const mesh = new InstancedMesh(geo, mat, mine.length);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `workers-${v}`;
    scene.add(mesh);
    if (cull) {
      const bb = geoBounds(geo, 1.1);
      attachCulling(mesh, cells, {
        name: 'workers',
        padXZ: bb.rad + 28, // the beat length: a walker leaves its cell
        padY: bb.top + 0.5,
        maxDist: FIG_FADE[0] + 80,
        casts: true,
      });
    }
    figureCount += mine.length;
  }

  /* --- ox sledge trains + gang shelters (static tableau) ------------------ */
  const w = new GeoWriter();
  const wood = new GeoWriter();
  let oxen = 0;
  let sledges = 0;
  const trains: [number, number, number][] = [
    // x, z, heading (rad) — on the haul road, nose toward the ramp
    [40, 380, Math.atan2(-10, -160)],
    [70, 300, Math.atan2(-20, -110)],
    [20, 250, Math.atan2(30, -60)],
    [180, 165, Math.atan2(60, -40)],
    [700, -150, Math.atan2(-140, -18)], // the causeway grade
  ];
  const tr = rng.fork('trains');
  for (const [tx0, tz0, head] of trains) {
    const gy = hf.heightAtCpu(tx0, tz0);
    if (!Number.isFinite(gy) || gy < -44) continue;
    const ch = Math.cos(head);
    const sh = Math.sin(head);
    const at = (fwd: number, side: number): [number, number] => [
      tx0 + ch * fwd - sh * side,
      tz0 + sh * fwd + ch * side,
    ];
    // the sledge: two runners, a deck, and a dressed block riding on it
    const [sx, sz] = at(0, 0);
    const sy = hf.heightAtCpu(sx, sz);
    for (const side of [-0.62, 0.62]) {
      const [rx0, rz0] = at(0, side);
      wood.box(rx0, sy + 0.02, rz0, 3.6, 0.22, 0.3, 0.3, 0, head);
    }
    wood.box(sx, sy + 0.22, sz, 3.4, 0.14, 1.5, 0.34, 0, head);
    w.box(sx, sy + 0.36, sz, 2.2, 1.15, 1.35, tr.range(0.86, 0.98), 0.012, head);
    sledges++;
    // two yoked oxen ahead of it
    for (const side of [-0.75, 0.75]) {
      const [ox0, oz0] = at(3.6, side);
      const oy = hf.heightAtCpu(ox0, oz0);
      if (!Number.isFinite(oy)) continue;
      const oxYaw = head + tr.range(-0.06, 0.06);
      const oc = Math.cos(oxYaw);
      const os = Math.sin(oxYaw);
      // body
      w.box(ox0, oy + 0.72, oz0, 2.0, 0.78, 0.78, 0.5, 0.02, oxYaw);
      // legs
      for (const [lf, ls] of [[0.7, 0.3], [0.7, -0.3], [-0.7, 0.3], [-0.7, -0.3]] as const) {
        w.box(ox0 + oc * lf - os * ls, oy, oz0 + os * lf + oc * ls, 0.16, 0.74, 0.16, 0.42, 0, oxYaw);
      }
      // head + horns
      const hx = ox0 + oc * 1.15;
      const hz = oz0 + os * 1.15;
      w.box(hx, oy + 0.95, hz, 0.62, 0.42, 0.4, 0.46, 0.05, oxYaw);
      for (const s2 of [-0.22, 0.22]) {
        w.box(hx - os * s2, oy + 1.34, hz + oc * s2, 0.1, 0.3, 0.1, 0.62, 0.15, oxYaw);
      }
      oxen++;
    }
    // yoke beam + traces back to the sledge
    const [yx, yz] = at(2.9, 0);
    wood.box(yx, hf.heightAtCpu(yx, yz) + 1.15, yz, 0.2, 0.14, 2.0, 0.28, 0, head);
    for (const side of [-0.5, 0.5]) {
      const [rx1, rz1] = at(1.7, side);
      wood.box(rx1, hf.heightAtCpu(rx1, rz1) + 0.55, rz1, 2.4, 0.07, 0.07, 0.26, 0, head);
    }
  }

  // gang shelters: reed-mat sunshades where the gangs rest, at the yards
  const shelters: [number, number][] = [
    [150, 215], [205, 240], [265, 150], [qxSafe(), 470], [40, 245], [1225, -180],
  ];
  for (const [hx, hz] of shelters) {
    const gy = hf.heightAtCpu(hx, hz);
    if (!Number.isFinite(gy) || gy < -44) continue;
    const yaw = tr.range(0, Math.PI);
    for (const [px, pz] of [[-2.4, -1.6], [2.4, -1.6], [-2.4, 1.6], [2.4, 1.6]] as const) {
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      wood.box(hx + c * px - s * pz, gy, hz + s * px + c * pz, 0.14, 2.1, 0.14, 0.26, 0, yaw);
    }
    wood.box(hx, gy + 2.1, hz, 5.6, 0.12, 4.0, 0.44, 0, yaw);
  }

  /* --- scaffolding: the mortuary temple's SE corner, mid-build ------------ */
  {
    // the temple front sits at x ≈ 145, the SE corner near z ≈ +26
    const bx = 158;
    const bz = 30;
    const gy = hf.heightAtCpu(bx, bz);
    const sc = rng.fork('scaffold');
    // construction ramp of rubble and mud brick, running up to the corner
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const rx = bx + 16 - t * 15;
      const rz = bz + 13 - t * 7;
      w.box(rx, gy - 0.2, rz, 3.0, 0.6 + t * 4.2, 7.0 - t * 1.4, 0.62, 0.14, 0.42);
    }
    // timber falsework: uprights, ledgers and a working platform
    for (let i = 0; i < 5; i++) {
      const px = bx - 2 + i * 1.9;
      for (const pz of [bz - 3.2, bz + 1.4]) {
        const py = hf.heightAtCpu(px, pz);
        wood.box(px, py, pz, 0.17, 6.2 + (i % 2) * 0.5, 0.17, 0.3, 0.012, 0.06);
      }
      if (i < 4) {
        for (const lvl of [2.2, 4.4, 6.0]) {
          wood.box(px + 0.95, gy + lvl, bz - 3.2, 1.9, 0.12, 0.12, 0.26, 0, 0);
          wood.box(px + 0.95, gy + lvl, bz + 1.4, 1.9, 0.12, 0.12, 0.26, 0, 0);
        }
      }
      wood.box(px, gy + 4.4, bz - 0.9, 0.12, 0.12, 4.6, 0.26, 0, 0);
    }
    // plank deck at the top
    for (let i = 0; i < 7; i++) {
      wood.box(bx - 2.2 + i * 1.6, gy + 6.1, bz - 0.9, 1.5, 0.09, 4.4, 0.34, 0, 0);
    }
    // (v1.1) the block arrives the Old Kingdom way: on a sledge at the
    // foot of the rubble ramp, tow ropes laid out ahead of it, and a stack of
    // timber levers for the last centimetres. This replaced a "shaduf-style
    // lever crane" — the shaduf is New Kingdom, and canon says "no fantasy
    // cranes" (Haiku canon audit). Same spot: WEST of the falsework and
    // SOUTH of z=26 (z 24.4 stood inside the mortuary temple).
    const mx = bx - 6.5;
    const mz = bz + 2;
    const my = hf.heightAtCpu(mx, mz);
    for (const s of [-0.6, 0.6]) wood.box(mx, my - 0.02, mz + s, 3.4, 0.22, 0.26, 0.3, 0, 0.3);
    wood.box(mx, my + 0.2, mz, 3.1, 0.12, 1.4, 0.34, 0, 0.3);
    w.box(mx, my + 0.32, mz, 1.9, 1.05, 1.2, 0.9, 0.012, 0.3);
    for (const s of [-0.35, 0.35]) {
      // tow ropes running ahead up the ramp line
      wood.box(mx + 3.6, my + 0.05, mz + s, 4.2, 0.06, 0.06, 0.62, 0, 0.3);
    }
    for (let k = 0; k < 4; k++) {
      wood.box(mx - 2.6, my + k * 0.13, mz - 1.4 + k * 0.1, 3.2, 0.12, 0.14, 0.28, 0, 0.3 + (k % 2) * 0.2);
    }
    void sc;
  }

  const stone = new Mesh(w.build(), limestoneMaterial([0.66, 0.62, 0.52], gi, 0.5));
  stone.castShadow = true;
  stone.receiveShadow = true;
  scene.add(stone);
  const timber = new Mesh(wood.build(), limestoneMaterial([0.31, 0.24, 0.16], gi, 0.24, 0.32));
  timber.castShadow = true;
  timber.receiveShadow = true;
  scene.add(timber);

  return { figures: figureCount, oxen, sledges };
}

function qxSafe(): number {
  return QUARRY_KHUFU_CENTER.x - 40;
}
