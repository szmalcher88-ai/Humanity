/**
 * G1Works (T3-1) — the Great Pyramid under construction, KHUFU_LATE only
 * (D-25): D-7's SUPPLY RAMP standing intact from the quarry side (S–SSE) to
 * the middle of the south face — the remnant's axis and section (SouthWorks)
 * — feeding a ZIGZAG on the south face up to the working platform (the
 * Hölscher/Arnold one-face hypothesis, C; our geometry D): legs at 10 % on
 * 9.5 m decks, 12 m from the arrises, U-turning on open landings; rubble
 * fill behind mud-brick retaining walls, each leg's body filled in to the
 * face and down to the courses under it. On the platform the next course
 * half laid from the corners, delivered blocks on their sledges, a survey
 * station on the axis. The teams hauling up the ramps are HaulTrains'
 * (animated, 2026-10-27). No pyramidion (D-9). Plan: docs/plans/T3-1_PLAN.md.
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
  /** (2026-10-27) the centre line a hauling team follows, the supply ramp's
   *  toe → the drop point on the platform: x, y (deck), z and the corner
   *  radius to round there (0: the point is already on a curve) */
  route: [number, number, number, number][];
  /** the narrowest landing's clearance past its U-turn (m) */
  landingSpare: number;
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
  const info: G1WorksInfo = { rampSegments: 0, zigzagLegs: 0, rampTop: 0, route: [], landingSpare: Infinity };
  /** (T3-2) a SLOPED deck quad over a segment whose body tops out 0.3 m
   *  low: a, b at its low end, c, d at its high end — wound to face up (the
   *  flat-topped boxes stepped 0.3 m every 3 m and read as a stair) */
  const slope = (a: C3, b: C3, c: C3, d: C3): void => {
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny > 0) fill.quad(a, b, c, d, FILL);
    else fill.quad(a, d, c, b, FILL);
  };

  /* --- the supply ramp: toe → the zigzag's junction, at 10 % ----------------- */
  const LEN0 = Math.hypot(TOE[0] - HEAD[0], TOE[1] - HEAD[1]);
  const ux = (HEAD[0] - TOE[0]) / LEN0; // pointing north, toward the face
  const uz = (HEAD[1] - TOE[1]) / LEN0;
  const YAW = Math.atan2(uz, ux);
  const gToe = grd(TOE[0], TOE[1]);
  const SEG = 3;

  // (2026-10-27) the zigzag is PLANNED before anything is built: each leg
  // holds one line (constant z) as it climbs, so the face recedes from it,
  // and the legs stack outward from the top down — each at least DECK + 1 m
  // out from the leg above it (their decks never overlap, at any x) and
  // never inside the face at its low end. The old legs started flush with
  // the face where the last one ended: the next leg's body grew straight up
  // out of the deck below, and a team arriving at a turn met a wall (the
  // human's screenshot). The supply ramp then stops at the first leg's band.
  interface Leg { x0: number; x1: number; dir: number; y0: number; y1: number; z: number }
  /** a landing's length past its turn (the U-turn of two stacked decks) */
  const LAND_MAX = 10.5;
  const planLegs = (xs: number, ys: number): Leg[] => {
    const out: Leg[] = [];
    let x = xs;
    let y = ys;
    let dir = -1; // the first leg runs west
    while (y < builtTop - 0.05 && out.length < 14) {
      const x0 = x;
      const y0 = y;
      while (y < builtTop - 1e-6) {
        // the last step is cut short to end AT the built top
        const step = Math.min(SEG, (builtTop - y) / GRADE);
        const nx = x + dir * step;
        // turn where the landing beyond (LAND_MAX, its end wall, 1 m) still
        // ends inside the arris at the turn's own height (the old rule, 16 m
        // in at 6 m above the leg's start, let the wider landings overhang
        // the corner by 3 m)
        if (Math.abs(nx) + LAND_MAX + 2 > hw(y + GRADE * step) && Math.sign(nx) === dir) break;
        x = nx;
        y += GRADE * step;
      }
      if (Math.abs(x - x0) < 0.5) break;
      out.push({ x0, x1: x, dir, y0, y1: y, z: 0 });
      dir = -dir;
    }
    for (let k = out.length - 1; k >= 0; k--) {
      const l = out[k] as Leg;
      const above = out[k + 1];
      l.z = Math.max(zf(l.y0) - 0.3, above ? above.z + DECK + 1 : -Infinity);
    }
    return out;
  };
  /** the supply ramp's run: its segments until the deck reaches the face
   *  (zStop null) or until the next segment would end inside the junction */
  const rampRun = (zStop: number | null): { n: number; s: number; deck: number } => {
    let n = 0;
    let s0 = 0;
    for (;;) {
      const zc = TOE[1] + uz * (s0 + SEG / 2);
      const y = gToe + GRADE * (s0 + SEG);
      if (zStop === null ? zc - DECK / 2 < zf(y) : TOE[1] + uz * (s0 + SEG) < zStop) break;
      s0 += SEG;
      n++;
    }
    return { n, s: s0, deck: gToe + GRADE * s0 };
  };
  const JW = 8.4; // the junction's half-width: the supply ramp's walls
  let run = rampRun(null);
  let legs = planLegs(TOE[0] + ux * run.s - JW, run.deck);
  for (let it = 0; it < 8; it++) {
    const next = rampRun((legs[0] as Leg).z + DECK + 1);
    if (next.n === run.n) break;
    run = next;
    legs = planLegs(TOE[0] + ux * run.s - JW, run.deck);
  }

  let s = 0;
  let deck = gToe;
  for (let seg = 0; seg < run.n; seg++) {
    const x = TOE[0] + ux * (s + SEG / 2);
    const z = TOE[1] + uz * (s + SEG / 2);
    const y = gToe + GRADE * (s + SEG);
    const lo = Math.min(grd(x, z), grd(x + uz * 8.4, z - ux * 8.4), grd(x - uz * 8.4, z + ux * 8.4)) - 0.3;
    fill.box(x, lo, z, SEG + 0.04, y - 0.3 - lo, 15.6, FILL, YAW);
    {
      const px = uz * 7.8;
      const pz = -ux * 7.8;
      const [lx, lz] = [TOE[0] + ux * s, TOE[1] + uz * s];
      const [hx, hz] = [TOE[0] + ux * (s + SEG + 0.04), TOE[1] + uz * (s + SEG + 0.04)];
      slope([lx + px, y - 0.3, lz + pz], [lx - px, y - 0.3, lz - pz], [hx - px, y, hz - pz], [hx + px, y, hz + pz]);
    }
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
    info.rampSegments++;
  }
  info.rampTop = deck;

  /* --- the zigzag on the south face ------------------------------------------ */
  /** where a ramp body's foot rests: the courses under its outer wall, or
   *  the ground past the pyramid's base */
  const footAt = (x: number, z: number): number =>
    z < half - 0.5 ? Math.max(0, H * (1 - z / half) - 0.5) : grd(x, z) - 0.3;
  /** a piece of ramp body from x = a (deck ya) to x = b (deck yb): filled in
   *  to the face and down to its foot, its deck spanning that whole width,
   *  its outer edge at zo (walled when `wall`) */
  const piece = (a: number, b: number, ya: number, yb: number, zo: number, wall: boolean): number => {
    const yLo = Math.min(ya, yb);
    const yHi = Math.max(ya, yb);
    const zi = zf(yLo) - 0.6; // inside the face over the whole rise
    const xm = (a + b) / 2;
    const lx = Math.abs(b - a) + 0.04;
    const base = footAt(xm, zo + 1);
    fill.box(xm, base, (zi + zo) / 2, lx, yLo - base, zo - zi, FILL);
    if (yHi - yLo > 1e-4) {
      const be = b + Math.sign(b - a) * 0.04;
      slope([a, ya, zi], [a, ya, zo], [be, yb, zo], [be, yb, zi]);
    }
    if (wall) mud.box(xm, base, zo + 0.5, lx, yHi + 0.6 - base, 1.0, rng.range(0.52, 0.6), 0, 0, 0.08);
    return base;
  };
  const endWall = (x: number, y: number, zi: number, zo: number): void => {
    const base = footAt(x, zo);
    mud.box(x, base, (zi + zo) / 2, 1.0, y + 0.6 - base, zo - zi, rng.range(0.52, 0.6), 0.08, 0, 0);
  };
  const route = info.route;
  route.push([TOE[0], gToe, TOE[1], 0]);

  // the junction: a level landing where the supply ramp's deck meets the
  // first leg's band, its full width — the teams turn west onto the leg
  {
    const xa = TOE[0] + ux * s; // the ramp's axis at its end
    const za = TOE[1] + uz * s;
    const l0 = legs[0] as Leg;
    const zj = za + 1.6; // over the ramp's last metres (its end edge is skewed)
    piece(xa - JW, xa + JW, deck, deck, zj, false);
    endWall(xa + JW + 0.5, deck, zf(deck) - 0.6, zj);
    endWall(xa - JW - 0.5, deck, l0.z + DECK + 1, zj);
    // up the axis to its end, then round onto the leg's centre line (the
    // corner where the axis would cross it, rounded wide over the junction)
    const zc = l0.z + DECK / 2;
    route.push([xa, deck, za, 0], [xa + (ux * (zc - za)) / uz, deck, zc, 6], [l0.x0, deck, zc, 0]);
    fpReg({
      id: 'g1-ramp:junction', family: 'g1-ramp', x: xa, z: (zf(deck) - 0.6 + zj) / 2, hx: JW + 1, hz: (zj - zf(deck) + 0.6) / 2,
      y0: footAt(xa, zj), y1: deck + 0.6, ground: 'none', allow: ['pyramids', 'g1-works'],
      basis: 'a zigzag on the south face (the Hölscher/Arnold hypothesis, C); our geometry', ...EV,
    });
  }

  for (const [k, l] of legs.entries()) {
    const zo = l.z + DECK;
    const len = Math.abs(l.x1 - l.x0);
    const nSeg = Math.max(1, Math.ceil(len / SEG - 1e-6));
    for (let i = 0; i < nSeg; i++) {
      const a = l.x0 + l.dir * Math.min(len, i * SEG);
      const b = l.x0 + l.dir * Math.min(len, (i + 1) * SEG);
      const ya = l.y0 + GRADE * Math.abs(a - l.x0);
      const yb = l.y0 + GRADE * Math.abs(b - l.x0);
      piece(a, b, ya, yb, zo, true);
    }
    // the leg's footprints, in 12 m pieces
    const yAt = (xp: number): number => l.y0 + GRADE * Math.abs(xp - l.x0);
    for (let a = Math.min(l.x0, l.x1); a < Math.max(l.x0, l.x1) - 0.5; a += 12) {
      const b = Math.min(a + 12, Math.max(l.x0, l.x1));
      const yHi = Math.max(yAt(a), yAt(b));
      const yLo = Math.min(yAt(a), yAt(b));
      const zIn = zf(yLo) - 0.3;
      const zOut = zo + 1.0;
      fpReg({
        id: `g1-ramp:leg:${k}:${Math.round(a)}`, family: 'g1-ramp', x: (a + b) / 2, z: (zIn + zOut) / 2,
        hx: (b - a) / 2, hz: (zOut - zIn) / 2, y0: footAt((a + b) / 2, zOut), y1: yHi + 0.6, ground: 'none',
        allow: ['pyramids', 'g1-works'],
        basis: 'a zigzag on the south face (the Hölscher/Arnold hypothesis, C); our geometry', ...EV,
      });
    }
    const zc = l.z + DECK / 2;
    route.push([l.x1, l.y1, zc, 0]);
    const nxt = legs[k + 1];
    if (nxt) {
      // the landing: level, both decks side by side, open between them, walled
      // only outside and at its far end — the U-turn is ON it (the old landing
      // was one deck wide and its end wall closed the turn)
      const zc2 = nxt.z + DECK / 2;
      const R = (zc - zc2) / 2;
      // past the turn: the U-turn's outer lane (R + 1.8) and the overseer
      // walking outside it (+ 2.3 with his body), then 0.6 m to the wall
      const LAND = Math.max(10, R + 0.5 + 1.8 + 2.3 + 0.6);
      info.landingSpare = Math.min(info.landingSpare, LAND - (R + 0.5 + 1.8 + 2.3));
      piece(l.x1, l.x1 + l.dir * LAND, l.y1, l.y1, zo, true);
      endWall(l.x1 + l.dir * (LAND + 0.5), l.y1, zf(l.y1) - 0.6, zo + 1);
      fpReg({
        id: `g1-ramp:landing:${k}`, family: 'g1-ramp', x: l.x1 + (l.dir * LAND) / 2, z: (zf(l.y1) - 0.6 + zo + 1) / 2,
        hx: LAND / 2 + 0.5, hz: (zo + 1 - zf(l.y1) + 0.6) / 2, y0: footAt(l.x1 + (l.dir * LAND) / 2, zo + 1), y1: l.y1 + 0.6,
        ground: 'none', allow: ['pyramids', 'g1-works'],
        basis: 'a zigzag on the south face (the Hölscher/Arnold hypothesis, C); our geometry', ...EV,
      });
      // the U-turn, a half circle beyond the turn
      const cx = l.x1 + l.dir * 0.5;
      const cz = (zc + zc2) / 2;
      for (let j = 0; j <= 12; j++) {
        const th = Math.PI / 2 - (j / 12) * Math.PI;
        route.push([cx + l.dir * R * Math.cos(th), l.y1, cz + R * Math.sin(th), 0]);
      }
    } else {
      // the top: a level landing at the built top, across to the platform's
      // edge (the last leg runs outside the face by its own recession)
      const TL = 9;
      piece(l.x1, l.x1 + l.dir * TL, l.y1, l.y1, zo, true);
      endWall(l.x1 + l.dir * (TL + 0.5), l.y1, zf(l.y1) - 0.6, zo + 1);
      fpReg({
        id: 'g1-ramp:top', family: 'g1-ramp', x: l.x1 + (l.dir * TL) / 2, z: (zf(l.y1) - 0.6 + zo + 1) / 2,
        hx: TL / 2 + 0.5, hz: (zo + 1 - zf(l.y1) + 0.6) / 2, y0: footAt(l.x1 + (l.dir * TL) / 2, zo + 1), y1: l.y1 + 0.6,
        ground: 'none', allow: ['pyramids', 'g1-works'],
        basis: 'a zigzag on the south face (the Hölscher/Arnold hypothesis, C); our geometry', ...EV,
      });
      const xt = l.x1 + l.dir * 4.5;
      route.push([xt, l.y1, zc, 4], [xt, l.y1, hw(builtTop) - 8, 0]);
    }
  }
  info.zigzagLegs = legs.length;

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
    // blocks delivered on their sledges, waiting to be set — beside the drop
    // point the hauling teams reach (HaulTrains); (2026-10-27) their static
    // teams are gone, the animated ones bring the next
    const drop = route[route.length - 1] as [number, number, number, number];
    for (const k of [-1, 0, 1]) {
      const bx = drop[0] + k * 6 + (k === 0 ? 0 : Math.sign(k) * 2);
      const bz = drop[2] - 9 - Math.abs(k) * 2;
      for (const dz of [-0.6, 0.6]) wood.box(bx + dz, T, bz, 0.3, 0.22, 3.6, 0.8);
      wood.box(bx, T + 0.2, bz, 1.5, 0.14, 3.4, 0.85);
      local.box(bx, T + 0.34, bz, 1.3, 1.1, 2.0, wrk.range(0.92, 1.03));
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
