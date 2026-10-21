/**
 * MenkaureComplex (T2-5, T2-6) — Menkaure's works, MENKAURE_PERIOD on only
 * (D-19, D-23, D-24), shown AT MENKAURE'S DEATH (canon: "Construction
 * Areas, Stone Stockpiles, Workshops", "Construction progress may vary
 * depending upon selected historical timeline" — MASTER_PROMPT_BIBLE
 * :2427-2445): the court of G3 paved in INDIVIDUAL slabs and its temenos;
 * the two western queens as stepped cores (the eastern, G3-a, is a finished
 * true pyramid in `Monuments.ts`) on terraces stepping down the Main Wadi's
 * bank, their fill faces retaining walls; the mortuary temple's core walls,
 * roofless, its granite casing begun on the east front; the causeway laid
 * on its upper part, a graded track below; the valley temple's foundations
 * and first courses; three construction yards. Shepseskaf's mudbrick
 * completion is a later state, not shown.
 * The pyramids are `Monuments.ts`; the platforms and terraces the
 * terrain's (GizaControl, under the epoch). The court block is a copy of
 * KhafreComplex's first block on its own streams — sharing it would risk
 * the KHAFRE world's float order. Plans: docs/plans/T2-5_PLAN.md §4.5,
 * docs/plans/T2-6_PLAN.md §3.
 */

import { Mesh, type Material, type Object3D } from 'three';
import type { Rng, WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { Heightfield } from '../world/Heightfield';
import { fpReg } from '../debug/Footprints';
import {
  G1_CAUSEWAY_WIDTH,
  G1_TEMENOS_HEIGHT,
  G3_BASE_SIDE,
  G3_CENTER,
  G3_PAD_Y,
  G3_TEMENOS_OFFSET,
  MENKAURE_CAUSEWAY,
  MENKAURE_CAUSEWAY_LAID,
  MENKAURE_MT_EW,
  MENKAURE_MT_NS,
  MENKAURE_QUEENS,
  MENKAURE_VT_CENTER,
  MENKAURE_VT_SIDE,
  MENKAURE_VT_Y,
} from '../world/CANON_DIMENSIONS';
import { earthMaterial } from '../vegetation/Basins';
import { GeoWriter, limestoneMaterial } from './KhufuComplex';
import { enclosure } from './KhafreComplex';
import type { Gang } from './Inhabitants';

const EPOCH = 'menkaure';
const GRANITE: [number, number, number] = [0.6, 0.39, 0.34];
const LOCAL: [number, number, number] = [0.74, 0.68, 0.57];
const TURA: [number, number, number] = [0.85, 0.825, 0.77];
const WOOD: [number, number, number] = [0.36, 0.27, 0.17];
const EV = { conf: 'D' as const, epoch: EPOCH };

export interface MenkaureInfo {
  slabs: number;
  cwSegs: number;
  /** the causeway's steepest grade (‰) and where */
  cwMaxGrade: number;
  cwMaxAt: number;
  /** blocks staged in the yards */
  works: number;
  /** the track's level at the valley temple (cm, for the audit) */
  cwEndCm: number;
}

/** `?mworks=0` (under the epoch): the T2-6 works, their footprints and gangs
 *  are skipped — the perf A/B switch (the terraces stay) */
function worksOn(): boolean {
  return new URLSearchParams(window.location.search).get('mworks') !== '0';
}

/** a point on the causeway at arc length s */
function cwAt(s: number): [number, number] {
  const [ax, az] = MENKAURE_CAUSEWAY[0] as readonly [number, number];
  const [bx, bz] = MENKAURE_CAUSEWAY[1] as readonly [number, number];
  const len = Math.hypot(bx - ax, bz - az);
  return [ax + ((bx - ax) * s) / len, az + ((bz - az) * s) / len];
}

/** the working gangs (appended LAST to the extras, MENKAURE only): the
 *  temple yard, the causeway's working front, the valley temple's site */
export function menkaureLines(): Gang[] {
  if (!worksOn()) return [];
  const laid = MENKAURE_CAUSEWAY_LAID.value;
  const [fx0, fz0] = cwAt(laid - 40);
  const [fx1, fz1] = cwAt(laid + 40);
  const v = MENKAURE_VT_CENTER;
  return [
    { x0: -438, z0: 662, x1: -410, z1: 662, n: 40, spread: 9, carry: 0.3, still: 0.6 },
    { x0: fx0, z0: fz0, x1: fx1, z1: fz1, n: 50, spread: 7, carry: 0.5, still: 0.3 },
    { x0: v.x - 20, z0: v.z - 10, x1: v.x + 20, z1: v.z + 10, n: 30, spread: 10, carry: 0.3, still: 0.65 },
  ];
}

export function buildMenkaureComplex(
  scene: Object3D, seed: WorldSeed, hf: Heightfield, gi: ProbeGI | null,
): MenkaureInfo {
  const grd = (x: number, z: number): number => hf.heightAtCpu(x, z);
  const cx = G3_CENTER.x;
  const cz = G3_CENTER.z;
  const Y = G3_PAD_Y.value;
  const half = G3_BASE_SIDE.value / 2; // 51.7
  const r = half + G3_TEMENOS_OFFSET.value; // the wall's centreline, 71.9

  const meshes: { name: string; w: GeoWriter; mat: () => Material }[] = [];
  const writer = (name: string, mat: () => Material): GeoWriter => {
    const w = new GeoWriter();
    meshes.push({ name, w, mat });
    return w;
  };
  const turaMat = (): Material => limestoneMaterial(TURA, gi, 0.5);
  const localMat = (): Material => limestoneMaterial(LOCAL, gi, 0.55);
  const massiveMat = (): Material => limestoneMaterial(LOCAL, gi, 2.0, 3.0);
  const graniteMono = (): Material => limestoneMaterial(GRANITE, gi, 50, 50, { rough: 0.62, spec: 0.4 });
  const woodMat = (): Material => limestoneMaterial(WOOD, gi, 0.24, 0.32, { rough: 0.8 });
  const tura = writer('menkaure-court', turaMat);
  const local = writer('menkaure-temenos', localMat);

  /* --- the court: individual slabs between the base and the wall --------- */
  let slabs = 0;
  {
    const t: Rng = seed.rng('menkaure-pavement');
    for (const [x0, x1, z0, z1] of [
      [-r, r, -r, -half], // north strip
      [-r, r, half, r], // south
      [-r, -half, -half, half], // west
      [half, r, -half, half], // east
    ] as const) {
      let z = z0;
      while (z < z1) {
        const d = Math.min(t.range(0.85, 1.3), z1 - z);
        let x = x0;
        while (x < x1) {
          const w = Math.min(t.range(1.1, 1.9), x1 - x);
          tura.box(cx + x + w / 2, Y, cz + z + d / 2, w - 0.012, 0.14 + t.range(-0.006, 0.006), d - 0.012, t.range(0.93, 1.02));
          slabs++;
          x += w;
        }
        z += d;
      }
    }
    fpReg({
      id: 'menkaure:court', family: 'menkaure-pavement', x: cx, z: cz, hx: r, hz: r,
      y0: Y, y1: Y + 0.16, ground: 'none', passive: true,
      basis: "a paved court as Khufu's; the width at Khufu's offsets", ...EV,
    });
  }

  /* --- the temenos: Khufu's wall rule; (T2-6) the east wall stops at the
   *     mortuary temple's flanks (Khafre's rule) ---------------------------- */
  {
    const h = G1_TEMENOS_HEIGHT.value;
    const th = 3.0;
    local.box(cx + 0.02, Y, cz - r, 2 * r + th - 0.04, h, th, 0.98, 0.06, 0, 0.06); // north
    local.box(cx + 0.02, Y, cz + r, 2 * r + th - 0.04, h, th, 0.97, 0.06, 0, 0.06); // south
    local.box(cx - r, Y, cz, th, h, 2 * r + th, 0.99, 0.06, 0, 0.06); // west
    const gateHalf = MENKAURE_MT_NS.value / 2 + 0.25;
    const run = r - gateHalf;
    local.box(cx + r, Y, cz - (gateHalf + run / 2), th, h, run, 0.98, 0.06);
    local.box(cx + r, Y, cz + gateHalf + run / 2, th, h, run, 0.98, 0.06);
    const wall = (id: string, x: number, z: number, hx: number, hz: number): void =>
      fpReg({
        id: `menkaure:temenos:${id}`, family: 'menkaure-temenos', x: cx + x, z: cz + z, hx, hz,
        y0: Y, y1: Y + h, ground: 'platform', allow: ['menkaure-pavement'],
        basis: "a wall at Khufu's offsets and height (D-3); no survey in the repo", ...EV,
      });
    wall('north', 0, -r, r + th / 2, th / 2);
    wall('south', 0, r, r + th / 2, th / 2);
    wall('west', -r, 0, th / 2, r + th / 2);
    wall('east-n', r, -(gateHalf + run / 2), th / 2, run / 2);
    wall('east-s', r, gateHalf + run / 2, th / 2, run / 2);
  }

  let cwSegs = 0;
  let cwMaxGrade = 0;
  let cwMaxAt = -1;
  let cwEndY = 0;
  let works = 0;
  if (worksOn()) {
    const qStone = writer('menkaure-queens-cores', massiveMat);
    const tWalls = writer('menkaure-terrace-walls', localMat);
    /* --- the queens' terraces: retaining walls on the fill faces --------- */
    for (const q of MENKAURE_QUEENS) {
      const hw = q.base / 2 + 4;
      const L = q.level;
      // each side in 4 m runs: a run stands where the ground outside the
      // core's edge lies below the terrace — its foot 0.5 m under the lowest
      // ground it spans, its top a 0.5 m parapet over the terrace
      for (const side of ['n', 's', 'w', 'e'] as const) {
        const alongX = side === 'n' || side === 's';
        const sgn = side === 's' || side === 'e' ? 1 : -1;
        const edge = alongX ? q.z + sgn * hw : q.x + sgn * hw;
        const a0 = alongX ? q.x - hw : q.z - hw;
        const n = Math.ceil((2 * hw) / 4);
        const run = (2 * hw) / n;
        let low = Infinity;
        let placed = 0;
        for (let i = 0; i < n; i++) {
          const a = a0 + (i + 0.5) * run;
          const g = (o: number): number => (alongX ? grd(a, edge + sgn * o) : grd(edge + sgn * o, a));
          const gl = Math.min(g(0.4), g(2.5), alongX ? grd(a - run / 2, edge + sgn * 2.5) : grd(edge + sgn * 2.5, a - run / 2));
          if (gl > L - 0.4) continue;
          const foot = gl - 0.5;
          const wx = alongX ? a : edge + sgn * 1.2;
          const wz = alongX ? edge + sgn * 1.2 : a;
          if (alongX) tWalls.box(wx, foot, wz, run + 0.02, L + 0.5 - foot, 2.4, 0.95, 0, 0, 0.06);
          else tWalls.box(wx, foot, wz, 2.4, L + 0.5 - foot, run + 0.02, 0.95, 0.06, 0, 0);
          low = Math.min(low, foot);
          placed++;
        }
        if (placed > 0) {
          fpReg({
            id: `menkaure:terrace:${q.name}:${side}`, family: 'menkaure-terrace',
            x: alongX ? q.x : edge + sgn * 1.2, z: alongX ? edge + sgn * 1.2 : q.z,
            hx: alongX ? hw : 1.2, hz: alongX ? 1.2 : hw, y0: low, y1: L + 0.5, ground: 'none',
            allow: ['menkaure-queens', 'pyramids'],
            basis: 'a retaining wall on the fill face of a terrace cut into the Main Wadi bank', ...EV,
          });
        }
      }
      /* the two western queens: stepped cores, their casing never added */
      if (q.stepped) {
        const t = seed.rng(`menkaure-queen-${q.name}`);
        let side = q.base;
        let y = L;
        for (let k = 0; k < 4; k++) {
          const h = 5 + t.range(-0.5, 0.5);
          qStone.box(q.x, y, q.z, side, h, side, 0.9 + t.range(-0.04, 0.04), 0.12);
          y += h - 0.02;
          side -= 2 * (3.5 + t.range(-0.3, 0.3));
        }
        fpReg({
          id: `menkaure:queen:${q.name}`, family: 'menkaure-queens', x: q.x, z: q.z,
          hx: q.base / 2, hz: q.base / 2, y0: L, y1: y, ground: 'platform',
          basis: 'a stepped core (form C, widely published); the tier heights and the row reconstructed', ...EV,
        });
      }
    }

    /* --- the mortuary temple: roofless core walls of large blocks, the
     *     offering hall's floor laid, granite casing begun on the east front */
    const mWalls = writer('menkaure-temple-walls', massiveMat);
    const mFloor = writer('menkaure-temple-floor', turaMat);
    const mGranite = writer('menkaure-temple-granite', graniteMono);
    const x0 = cx + r; // on the temenos line
    const x1 = x0 + MENKAURE_MT_EW.value;
    const z0 = cz - MENKAURE_MT_NS.value / 2;
    const z1 = cz + MENKAURE_MT_NS.value / 2;
    {
      const h = 7;
      const th = 3.0;
      enclosure(mWalls, x0, x1, z0, z1, Y, h, th, 0.97,
        [{ z: cz, half: 2.2, hgt: 5.0 }], [{ z: cz, half: 2.4, hgt: 5.0 }]);
      mFloor.box(x0 + 14, Y + 0.02, cz, 22, 0.16, z1 - z0 - 2 * th, 1.0);
      // the casing: granite slabs on the east face's lower 3 m, either side of the door
      for (const [za, zb] of [[z0 + 0.6, cz - 2.6], [cz + 2.6, z1 - 0.6]] as const) {
        mGranite.box(x1 + 0.33, Y, (za + zb) / 2, 0.7, 3.0, zb - za, 1.0, 0.02, 0, 0);
      }
      fpReg({
        id: 'menkaure:mortuary', family: 'menkaure-temple', x: (x0 + x1) / 2, z: cz,
        hx: (x1 - x0) / 2 + 0.7, hz: (z1 - z0) / 2, y0: Y, y1: Y + h, ground: 'platform',
        allow: ['menkaure-temenos', 'menkaure-pavement', 'menkaure-causeway', 'menkaure-works'],
        basis: 'a reconstruction (70 × 45 m), left unfinished at the king’s death', ...EV,
      });
    }

    /* --- the causeway: Khufu's pedestal rule on the upper part, a graded
     *     rubble track below, survey stakes every 20 m --------------------- */
    const cWalls = writer('menkaure-causeway-pedestal', localMat);
    const cFloor = writer('menkaure-causeway-floor', turaMat);
    const cTrack = writer('menkaure-causeway-track', () => earthMaterial(gi));
    const wood = writer('menkaure-works-wood', woodMat);
    {
      const t = seed.rng('menkaure-causeway');
      const [ax, az] = MENKAURE_CAUSEWAY[0] as readonly [number, number];
      const [bx, bz] = MENKAURE_CAUSEWAY[1] as readonly [number, number];
      const len = Math.hypot(bx - ax, bz - az);
      const yaw = Math.atan2(bz - az, bx - ax);
      const N = 208;
      const segL = len / N;
      cwSegs = N;
      const w = G1_CAUSEWAY_WIDTH.value;
      const endY = MENKAURE_VT_Y.value + 1.2; // the valley temple's platform top
      const ys = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const f = (i + 0.5) / N;
        ys[i] = Math.max(Y + (endY - Y) * f, grd(ax + (bx - ax) * f, az + (bz - az) * f) + 0.35);
      }
      for (let pass = 0; pass < 6; pass++) {
        for (let i = 1; i < N - 1; i++) ys[i] = ((ys[i - 1] as number) + 2 * (ys[i] as number) + (ys[i + 1] as number)) / 4;
      }
      // the smoothing cuts under the bank's convex knees: never below the
      // ground on the axis (the audit's `sunk`: an open track has no walls
      // to hide a dip)
      for (let i = 0; i < N; i++) {
        const f = (i + 0.5) / N;
        ys[i] = Math.max(ys[i] as number, grd(ax + (bx - ax) * f, az + (bz - az) * f) + 0.2);
      }
      // …and no steeper than 12 % going down: where the bank falls faster the
      // track runs on as an embankment until the ground comes back up to it
      // (it cannot cut — the terrain is not carved under it)
      for (let i = 1; i < N; i++) ys[i] = Math.max(ys[i] as number, (ys[i - 1] as number) - 0.12 * segL);
      cwEndY = ys[N - 1] as number;
      const ex = Math.cos(yaw);
      const ez = Math.sin(yaw);
      for (let i = 0; i < N; i++) {
        const f = (i + 0.5) / N;
        const xm = ax + (bx - ax) * f;
        const zm = az + (bz - az) * f;
        const ym = ys[i] as number;
        const yNext = ys[Math.min(i + 1, N - 1)] as number;
        const yPrev = ys[Math.max(i - 1, 0)] as number;
        if (i + 1 < N && Math.abs(yNext - ym) / segL > cwMaxGrade) {
          cwMaxGrade = Math.abs(yNext - ym) / segL;
          cwMaxAt = i;
        }
        const rise = Math.max(0.02, Math.abs(yNext - ym), Math.abs(yPrev - ym));
        const L = segL * 1.6;
        const gs = [
          grd(xm - ex * (L / 2), zm - ez * (L / 2)),
          grd(xm + ex * (L / 2), zm + ez * (L / 2)),
          grd(xm - ez * (w / 2 + 1.2), zm + ex * (w / 2 + 1.2)),
          grd(xm + ez * (w / 2 + 1.2), zm - ex * (w / 2 + 1.2)),
        ];
        const gMin = Math.min(...gs);
        const laid = f * len <= MENKAURE_CAUSEWAY_LAID.value;
        const base = laid ? Math.min(ym - 1, gMin - 2) : Math.min(ym - 0.4, gMin - 0.5);
        if (laid) {
          cWalls.box(xm, base, zm, L, ym - base + rise, w + 2.4, 0.93, 0.004, yaw);
          cFloor.box(xm, ym - 0.02, zm, L, 0.16 + rise, w - 2.6, t.range(0.94, 1.0), 0, yaw);
        } else {
          cTrack.box(xm, base, zm, L, ym - base + rise * 0.5, w + 1.0, 1.0, 0.02, yaw);
        }
        if (i % 7 === 3) {
          // survey stakes along both edges
          for (const sd of [-1, 1]) {
            const sx = xm - ez * sd * (w / 2 + 2.2);
            const sz = zm + ex * sd * (w / 2 + 2.2);
            wood.box(sx, grd(sx, sz) - 0.2, sz, 0.12, 1.4, 0.12, 0.9);
          }
        }
        if (i % 6 === 0) {
          const fhx = (segL * 6) / 2;
          const fhz = (w + 2.4) / 2;
          const corner = (lx: number, lz: number): number => grd(xm + lx * ex - lz * ez, zm + lx * ez + lz * ex);
          const gTop = Math.max(corner(-fhx, -fhz), corner(fhx, -fhz), corner(fhx, fhz), corner(-fhx, fhz), ...gs);
          fpReg({
            id: `menkaure:causeway:${i}`, family: 'menkaure-causeway', x: xm, z: zm,
            hx: fhx, hz: fhz, y0: base, y1: laid ? ym + 0.3 : ym + 0.15, yFloor: ym,
            yaw, ground: 'grounded', allow: ['menkaure-temple', 'menkaure-temenos', 'menkaure-pavement', 'menkaure-works'],
            // an open, sloping track: where the ground along or beside it stands
            // above its floor it runs in a shallow side-cut (no walls to bury)
            cutting: gTop > ym + 0.1,
            basis: laid ? "Khufu's pedestal rule, the corridor never built" : 'a graded construction track — never laid',
            ...EV,
          });
        }
      }
    }

    /* --- the valley temple: a foundation platform and the first courses -- */
    const vStone = writer('menkaure-valley-stone', localMat);
    {
      const v = MENKAURE_VT_CENTER;
      const S = MENKAURE_VT_SIDE.value;
      const vy = MENKAURE_VT_Y.value;
      vStone.box(v.x, vy, v.z, S, 1.2, S, 0.92, 0.02);
      const top = vy + 1.2;
      const th = 3.0;
      const hh = 2.0; // the first courses
      vStone.box(v.x, top, v.z - S / 2 + th / 2, S, hh, th, 0.95, 0.04, 0, 0.04);
      vStone.box(v.x, top, v.z + S / 2 - th / 2, S, hh, th, 0.94, 0.04, 0, 0.04);
      // west and east runs, a 5 m gap on the axis (the causeway's door, the
      // east entrance), reaching half-way into the end walls
      const run = S / 2 - 2.5 - th / 2;
      for (const xw of [v.x - S / 2 + th / 2 + 0.02, v.x + S / 2 - th / 2 - 0.02]) {
        vStone.box(xw, top, v.z - (2.5 + run / 2), th, hh, run, 0.95, 0.04);
        vStone.box(xw, top, v.z + (2.5 + run / 2), th, hh, run, 0.95, 0.04);
      }
      fpReg({
        id: 'menkaure:valley', family: 'menkaure-temple', x: v.x, z: v.z, hx: S / 2, hz: S / 2,
        y0: vy, y1: top + hh, ground: 'platform', allow: ['menkaure-causeway', 'menkaure-works'],
        basis: 'a reconstruction (50 m); its foundations and first courses only', ...EV,
      });
    }

    /* --- the construction yards: staged blocks, a masons' shed, sledges,
     *     waste chips ------------------------------------------------------- */
    const yStone = writer('menkaure-works-stone', localMat);
    const yGranite = writer('menkaure-works-granite', graniteMono);
    {
      const t = seed.rng('menkaure-works');
      /** a row of staged blocks on sleepers along x from (x, z); returns its far x */
      const stack = (w: GeoWriter, x: number, z: number, n: number, big: boolean): void => {
        const g = grd(x + n, z);
        for (const dz of [-0.5, 0.5]) wood.box(x + n, g - 0.02, z + dz, 2 * n + 1, 0.18, 0.22, 0.8);
        let xx = x;
        for (let k = 0; k < n; k++) {
          const lx = big ? t.range(1.8, 2.4) : t.range(1.1, 1.7);
          const hgt = big ? t.range(1.0, 1.3) : t.range(0.7, 1.0);
          const lz = big ? t.range(1.2, 1.5) : t.range(0.9, 1.2);
          w.box(xx + lx / 2, g + 0.16, z, lx, hgt, lz, t.range(0.92, 1.04), 0.004);
          if (!big && t.chance(0.4)) w.box(xx + lx / 2, g + 0.16 + hgt, z, lx * 0.9, t.range(0.6, hgt), lz * 0.9, t.range(0.92, 1.04), 0.004);
          xx += lx + t.range(0.3, 0.5);
          works++;
        }
      };
      const chips = (x0c: number, z0c: number, x1c: number, z1c: number, n: number): void => {
        for (let k = 0; k < n; k++) {
          const x = t.range(x0c, x1c);
          const z = t.range(z0c, z1c);
          const s = t.range(0.15, 0.5);
          yStone.box(x, grd(x, z) - 0.05, z, s, s * 0.5, s * t.range(0.6, 1.0), t.range(0.95, 1.1), 0.1, t.range(0, Math.PI));
        }
      };
      const sledge = (x: number, z: number): void => {
        const g = grd(x, z);
        for (const dz of [-0.6, 0.6]) wood.box(x, g - 0.02, z + dz, 3.6, 0.22, 0.3, 0.8);
        wood.box(x, g + 0.2, z, 3.4, 0.14, 1.5, 0.85);
        yStone.box(x, g + 0.34, z, 2.2, 1.2, 1.3, 1.0, 0.004);
      };
      const yard = (id: string, x0y: number, z0y: number, x1y: number, z1y: number): void => {
        let lo = Infinity;
        for (const [gx, gz] of [[x0y, z0y], [x1y, z0y], [x1y, z1y], [x0y, z1y]] as const) lo = Math.min(lo, grd(gx, gz));
        fpReg({
          id: `menkaure:works:${id}`, family: 'menkaure-works', x: (x0y + x1y) / 2, z: (z0y + z1y) / 2,
          hx: (x1y - x0y) / 2, hz: (z1y - z0y) / 2, y0: lo - 0.2, y1: lo + 2.5, ground: 'none', passive: true,
          allow: ['menkaure-temple', 'menkaure-causeway'],
          basis: "the canon's construction areas and stone stockpiles (MPB:2437-2443); their layout reconstructed", ...EV,
        });
      };
      // 1. the temple yard, north-east of the temple: granite and limestone
      //    staged for its casing, a masons' shed (posts and a mat roof), sledges
      for (const [k, z] of [650, 656, 662].entries()) stack(k === 0 ? yGranite : yStone, -438, z, 7, k === 0);
      {
        const sx = -418;
        const sz = 670;
        const g = grd(sx, sz);
        for (const [px, pz] of [[-3, -2], [3, -2], [-3, 2], [3, 2]] as const) wood.box(sx + px, g - 0.1, sz + pz, 0.18, 2.6, 0.18, 0.9);
        wood.box(sx, g + 2.45, sz, 6.6, 0.08, 4.6, 1.05);
      }
      sledge(-428, 674);
      sledge(-410, 655);
      chips(-440, 645, -405, 678, 50);
      yard('temple', -441, 646, -405, 678);
      // 2. the causeway's working front: blocks staged north of the axis
      {
        const laid = MENKAURE_CAUSEWAY_LAID.value;
        const [fx, fz] = cwAt(laid);
        const nx = Math.sin(Math.atan2(110, 567.1)); // the north normal (x, −z)
        const nz = -Math.cos(Math.atan2(110, 567.1));
        for (let k = 0; k < 3; k++) stack(yStone, fx - 10 + nx * (11 + k * 4), fz + nz * (11 + k * 4), 6, false);
        chips(fx - 14, fz - 22, fx + 14, fz - 9, 40);
        yard('front', fx - 14, fz - 24, fx + 14, fz - 8);
      }
      // 3. the valley temple's site: blocks on its platform
      {
        const v = MENKAURE_VT_CENTER;
        for (const z of [v.z - 8, v.z + 8]) stack(yStone, v.x - 12, z, 6, true);
        chips(v.x + 26, v.z - 20, v.x + 40, v.z + 20, 30);
        yard('valley', v.x + 25, v.z - 22, v.x + 42, v.z + 22);
      }
    }
  }

  /* --- materialize: one mesh per part and material ------------------------ */
  for (const { name, w, mat } of meshes) {
    if (w.pos.length === 0) continue;
    const m = new Mesh(w.build(), mat());
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  return { slabs, cwSegs, cwMaxGrade: Math.round(cwMaxGrade * 1000), cwMaxAt, works, cwEndCm: Math.round(cwEndY * 100) };
}
