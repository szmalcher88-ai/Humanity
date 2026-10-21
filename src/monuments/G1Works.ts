/**
 * G1Works (T3-1) — the Great Pyramid under construction, KHUFU_LATE only
 * (D-25): D-7's SUPPLY RAMP standing intact from the quarry side (S–SSE) to
 * the middle of the south face — the remnant's axis and section (SouthWorks)
 * — feeding a ZIGZAG on the south face up to the working platform (the
 * Hölscher/Arnold one-face hypothesis, C; our geometry D): legs at 10 %, a
 * 9.5 m deck whose inner edge follows the face, 12 m from the arrises,
 * turning on landings; rubble fill between mud-brick retaining walls, each
 * leg's body resting on the courses below. On the platform the next course
 * half laid from the corners, sledges with blocks, a survey station on the
 * axis; static figures hauling on the ramp (walkers stand on the terrain
 * only — Inhabitants). No pyramidion (D-9). Plan: docs/plans/T3-1_PLAN.md.
 */

import { Mesh, type Object3D } from 'three';
import type { WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { Heightfield } from '../world/Heightfield';
import { fpReg } from '../debug/Footprints';
import { G1_BASE_SIDE, G1_SLOPE_DEG } from '../world/CANON_DIMENSIONS';
import { earthMaterial } from '../vegetation/Basins';
import { GeoWriter, limestoneMaterial } from './KhufuComplex';
import { addTownsfolk, ColorWriter, person, townsfolkMesh, type C3 } from './Townsfolk';
import type { Gang } from './Inhabitants';

const EV = { conf: 'D' as const, epoch: 'khufu-late' };
const FILL: C3 = [0.62, 0.56, 0.44]; // compacted fill (SouthWorks')
const WOOD: C3 = [0.42, 0.31, 0.19];
const ROPE: C3 = [0.6, 0.52, 0.36];
/** D-7's axis: head (by the court) → toe (toward the quarry) — SouthWorks' */
const HEAD: [number, number] = [-8, 147];
const TOE: [number, number] = [10, 236];
const GRADE = 0.1;
const DECK = 9.5;

/** the walkers along the supply ramp's foot (appended LAST to the extras,
 *  only while the pyramid is being built) */
export const g1WorksLines: Gang[] = [
  { x0: 24, z0: 232, x1: 12, z1: 170, n: 18, spread: 3, carry: 0.6, still: 0.25 },
];

export interface G1WorksInfo {
  rampSegments: number;
  zigzagLegs: number;
  /** the deck's height where the supply ramp meets the face */
  rampTop: number;
}

export function buildG1Works(
  scene: Object3D, seed: WorldSeed, hf: Heightfield, gi: ProbeGI | null, builtTop: number,
): G1WorksInfo {
  const grd = (x: number, z: number): number => hf.heightAtCpu(x, z);
  const rng = seed.rng('g1-ramp');
  const wrk = seed.rng('g1-works');
  const folkRng = seed.rng('g1-folk');
  const H = (G1_BASE_SIDE.value / 2) * Math.tan((G1_SLOPE_DEG.value * Math.PI) / 180);
  const half = G1_BASE_SIDE.value / 2;
  /** the south face's z at height y */
  const zf = (y: number): number => half * (1 - y / H);
  const hw = (y: number): number => half * (1 - y / H); // the half-width at y (square)

  const fill = new ColorWriter();
  const folk = new ColorWriter();
  const props = new ColorWriter();
  const mud = new GeoWriter();
  const tura = new GeoWriter();
  const local = new GeoWriter();
  const wood = new GeoWriter();
  const info: G1WorksInfo = { rampSegments: 0, zigzagLegs: 0, rampTop: 0 };

  /* --- the supply ramp: toe → the face, at 10 % ------------------------------ */
  const LEN0 = Math.hypot(TOE[0] - HEAD[0], TOE[1] - HEAD[1]);
  const ux = (HEAD[0] - TOE[0]) / LEN0; // pointing north, toward the face
  const uz = (HEAD[1] - TOE[1]) / LEN0;
  const YAW = Math.atan2(uz, ux);
  const gToe = grd(TOE[0], TOE[1]);
  let s = 0;
  let deck = gToe;
  const SEG = 3;
  let sx = TOE[0];
  for (;;) {
    const x = TOE[0] + ux * (s + SEG / 2);
    const z = TOE[1] + uz * (s + SEG / 2);
    const y = gToe + GRADE * (s + SEG);
    if (z - DECK / 2 < zf(y)) break; // the deck has reached the face
    const lo = Math.min(grd(x, z), grd(x + uz * 8.4, z - ux * 8.4), grd(x - uz * 8.4, z + ux * 8.4)) - 0.3;
    fill.box(x, lo, z, SEG + 0.04, y - lo, 15.6, FILL, YAW);
    for (const side of [-1, 1]) {
      const wx = x + side * uz * 8.4;
      const wz = z - side * ux * 8.4;
      mud.box(wx, lo, wz, SEG + 0.04, y + 0.6 - lo, 1.2, rng.range(0.52, 0.6), 0, YAW, 0.12);
    }
    if (info.rampSegments % 3 === 0) {
      fpReg({
        id: `g1-ramp:supply:${info.rampSegments}`, family: 'g1-ramp', x, z, hx: SEG * 1.5, hz: 9, yaw: YAW,
        y0: lo, y1: y + 0.6, yFloor: y, ground: 'grounded', allow: ['pyramids', 'g1-works'],
        basis: "D-7's supply ramp, intact: its axis and section (the remnant's)", ...EV,
      });
    }
    s += SEG;
    deck = y;
    sx = x;
    info.rampSegments++;
  }
  info.rampTop = deck;

  /* --- the zigzag on the south face ------------------------------------------ */
  // a leg at height y: the deck's inner edge on the face (0.3 m into it), its
  // outer edge DECK m out; its body down to the courses below (≈ 13 m under
  // the deck at the outer edge) or the ground
  const legBox = (x0: number, x1: number, y: number): void => {
    const zi = zf(y) - 0.3;
    const zo = zi + DECK;
    const base = Math.max(0, y - 13.5);
    fill.box((x0 + x1) / 2, base, (zi + zo) / 2, Math.abs(x1 - x0) + 0.04, y - base, DECK, FILL);
    mud.box((x0 + x1) / 2, base, zo + 0.5, Math.abs(x1 - x0) + 0.04, y + 0.6 - base, 1.0, rng.range(0.52, 0.6), 0, 0, 0.08);
  };
  let x = sx;
  let y = deck;
  let dir = -1; // the first leg runs west
  let legs = 0;
  while (y < builtTop - 0.05 && legs < 12) {
    const turnX = dir * (hw(y + 6) - 12 - 4);
    const x0 = x;
    let lastY = y;
    for (;;) {
      const nx = x + dir * SEG;
      const ny = y + GRADE * SEG;
      if ((dir < 0 ? nx < turnX : nx > turnX) || ny > builtTop) break;
      legBox(x, nx, ny);
      x = nx;
      y = ny;
      lastY = y;
    }
    // the leg's footprints, in 12 m pieces (the face recedes as it climbs:
    // each piece spans its own inner edge at the high end to the outer wall
    // at the low end)
    const yStart = lastY - GRADE * Math.abs(x - x0);
    const yAt = (xp: number): number => yStart + GRADE * Math.abs(xp - x0);
    for (let a = Math.min(x0, x); a < Math.max(x0, x) - 0.5; a += 12) {
      const b = Math.min(a + 12, Math.max(x0, x));
      const yHi = Math.max(yAt(a), yAt(b));
      const yLo = Math.min(yAt(a), yAt(b));
      const zIn = zf(yHi) - 0.3;
      const zOut = zf(yLo) - 0.3 + DECK + 1.0;
      fpReg({
        id: `g1-ramp:leg:${legs}:${Math.round(a)}`, family: 'g1-ramp', x: (a + b) / 2, z: (zIn + zOut) / 2,
        hx: (b - a) / 2, hz: (zOut - zIn) / 2, y0: Math.max(0, yLo - 13.5), y1: yHi + 0.6, ground: 'none',
        allow: ['pyramids', 'g1-works'],
        basis: 'a zigzag on the south face (the Hölscher/Arnold hypothesis, C); our geometry', ...EV,
      });
    }
    if (y >= builtTop - 0.05) break;
    // the landing: a square at the turn, the next leg starts back the other way
    const zi = zf(y) - 0.3;
    fill.box(x + dir * 4, Math.max(0, y - 13.5), zi + DECK / 2, 8, y - Math.max(0, y - 13.5), DECK, FILL);
    mud.box(x + dir * 8.5, Math.max(0, y - 13.5), zi + DECK / 2, 1.0, y + 0.6 - Math.max(0, y - 13.5), DECK + 2, rng.range(0.52, 0.6), 0.08, 0, 0);
    dir = -dir;
    legs++;
  }
  info.zigzagLegs = legs + 1;

  /* --- the working platform -------------------------------------------------- */
  {
    const T = builtTop;
    const ht = hw(T);
    // the next course, half laid: casing and backing rows inward from each
    // corner along all four edges, ≈ 20 % of each edge from either end
    const ch = 0.7;
    for (const [ex, ez] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      // the edge runs along t from one corner to the other, at the face
      const nx = ez === 0 ? ex : 0; // outward normal of this edge
      const nz = ex === 0 ? ez : 0;
      for (const end of [-1, 1]) {
        let t = end * ht;
        const stop = end * ht * 0.6;
        while (end < 0 ? t < stop : t > stop) {
          const w = wrk.range(1.3, 2.1);
          const tc = t - end * w / 2;
          for (const [row, depth, writer] of [[0, 1.3, tura], [1, 1.2, local]] as const) {
            const off = ht - 0.9 - row * 1.4;
            const bx = nx !== 0 ? nx * off : tc;
            const bz = nz !== 0 ? nz * off : tc;
            writer.box(bx, T, bz, nx !== 0 ? depth : w - 0.03, ch, nx !== 0 ? w - 0.03 : depth, wrk.range(0.92, 1.03));
          }
          t -= end * w;
        }
      }
    }
    // sledges with blocks, arriving at the south edge from the ramp
    for (const k of [-1, 0, 1]) {
      const bx = k * 9;
      const bz = ht - 10 + Math.abs(k) * 3;
      for (const dz of [-0.6, 0.6]) wood.box(bx + dz, T, bz, 0.3, 0.22, 3.6, 0.8);
      wood.box(bx, T + 0.2, bz, 1.5, 0.14, 3.4, 0.85);
      local.box(bx, T + 0.34, bz, 1.3, 1.1, 2.0, wrk.range(0.92, 1.03));
      // the team: haulers in two files ahead of it, a water pourer at the runners
      for (let i = 0; i < 8; i++) {
        const px = bx + (i % 2 ? 0.7 : -0.7);
        const pz = bz - 3 - Math.floor(i / 2) * 1.2;
        person(folk, folkRng, px, T, pz, 0, 'stand');
      }
      for (const side of [-0.7, 0.7]) folk.beam([bx + side * 0.6, T + 0.4, bz - 1.7], [bx + side, T + 1.0, bz - 7.8], 0.02, ROPE);
      person(folk, folkRng, bx + 1.2, T, bz + 1.4, Math.PI / 2, 'stand');
    }
    // backing blocks staged on the core, and the lever teams setting them
    for (let k = 0; k < 10; k++) {
      const bx = wrk.range(-ht + 14, ht - 14);
      const bz = wrk.range(-ht + 14, ht - 20);
      local.box(bx, T, bz, wrk.range(1.1, 1.7), wrk.range(0.6, 0.8), wrk.range(0.9, 1.3), wrk.range(0.9, 1.02), 0, wrk.range(0, 1.5));
      if (k % 3 === 0) {
        for (let i = 0; i < 3; i++) person(folk, folkRng, bx + 1.2 + i * 0.6, T, bz + 1.0, Math.PI, 'stand');
        folk.beam([bx + 0.5, T + 0.2, bz + 0.3], [bx + 1.6, T + 1.3, bz + 1.1], 0.03, WOOD);
      }
    }
    // the survey station on the axis: a frame, a plumb line, a scribe
    wood.box(0, T, 0, 0.12, 2.2, 0.12, 0.9);
    wood.box(1.6, T, 0, 0.12, 2.2, 0.12, 0.9);
    wood.box(0.8, T + 2.1, 0, 1.8, 0.1, 0.12, 0.9);
    props.box(0.8, T + 0.4, 0, 0.05, 1.7, 0.05, [0.7, 0.66, 0.6]);
    person(folk, folkRng, 2.6, T, 1.2, Math.PI / 2, 'sit');
    fpReg({
      id: 'g1-works:platform', family: 'g1-works', x: 0, z: 0, hx: ht, hz: ht, y0: T, y1: T + 2.4,
      ground: 'none', passive: true,
      basis: 'the working platform at mid-height; the half-laid course and the teams reconstructed', ...EV,
    });
  }

  /* --- hauling teams on the ramps -------------------------------------------- */
  {
    const team = (cx: number, cy: number, cz: number, yaw: number): void => {
      const fx = Math.cos(yaw);
      const fz = Math.sin(yaw);
      for (const dz of [-0.6, 0.6]) wood.box(cx - fz * dz, cy, cz + fx * dz, 3.6, 0.22, 0.3, 0.8, 0, yaw);
      local.box(cx, cy + 0.22, cz, 2.0, 1.1, 1.3, wrk.range(0.92, 1.03), 0, yaw);
      for (let i = 0; i < 10; i++) {
        const along = 3.2 + Math.floor(i / 2) * 1.2;
        const side = i % 2 ? 0.7 : -0.7;
        const px = cx + fx * along - fz * side;
        const pz = cz + fz * along + fx * side;
        person(folk, folkRng, px, cy + GRADE * along, pz, -yaw - Math.PI / 2, 'stand');
      }
      person(folk, folkRng, cx - fx * 1.8, cy, cz - fz * 1.8, -yaw + Math.PI / 2, 'stand');
    };
    // on the supply ramp, hauling north
    for (const st of [30, 75]) {
      const tx = TOE[0] + ux * st;
      const tz = TOE[1] + uz * st;
      team(tx, gToe + GRADE * st, tz, YAW);
    }
    // on the first zigzag leg, hauling west
    const yL = deck + GRADE * 20;
    team(sx - 20, yL, zf(yL) - 0.3 + DECK / 2, Math.PI);
  }

  /* --- materialize ------------------------------------------------------------- */
  const meshes = [
    new Mesh(fill.build(), earthMaterial(gi)),
    new Mesh(mud.build(), limestoneMaterial([0.56, 0.46, 0.34], gi, 0.3, 0.45)),
    new Mesh(tura.build(), limestoneMaterial([0.85, 0.825, 0.77], gi, 50, 50, { rough: 0.75 })),
    new Mesh(local.build(), limestoneMaterial([0.74, 0.68, 0.57], gi, 50, 50)),
    new Mesh(wood.build(), limestoneMaterial([0.36, 0.27, 0.17], gi, 0.24, 0.32, { rough: 0.8 })),
  ];
  const names = ['g1-ramp-fill', 'g1-ramp-walls', 'g1-works-tura', 'g1-works-blocks', 'g1-works-wood'];
  meshes.forEach((m, i) => {
    m.name = names[i] as string;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  });
  if (props.pos.length > 0) scene.add(townsfolkMesh(props, gi, 'g1-works'));
  addTownsfolk(scene, folk, gi, 'g1-works');
  return info;
}
