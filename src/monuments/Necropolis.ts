/**
 * Family courts of the mastaba fields (v1.2 I5) — canon Vol. IV, the
 * necropolis: "Include: mastabas, family tombs, chapels, courtyards, ritual
 * pathways, offering areas"; "The architecture should communicate social
 * hierarchy through scale and material quality"; the brief's "individual
 * mastabas (massing + dressing, not clones)". Plan: docs/plans/I5_PLAN.md
 * §3.1c (verified recon, 141/144).
 *
 * A low mud-brick court in FRONT of the east faces, where the offering cult
 * happened (Reisner's exterior mud-brick chapels with courts, form C):
 *  - WEST FIELD: pairs of built tombs one row apart in a column share a
 *    court (one roll per slot, so the stream never depends on the layout);
 *    its north and south walls bite 0.4 m into the battered faces (a wall
 *    stopping at the base leaves a slit as the face recedes), a doorway in
 *    the east wall, and a short wall closes the gap between the two tombs
 *  - EAST FIELD: every twin mastaba gets one, its two chapels inside
 *  - inside: each tomb's offering place — its chapel (a dark doorway on the
 *    east face) or a FALSE DOOR laid on the battered face itself — with a
 *    limestone offering table, a basin, loaves, a jar, a bundle of onions
 *  - DEPENDANTS: in one court in three, where the parents' tombs stand ≥ 7 m
 *    apart, a small mastaba fills the gap (the Giza infill pattern)
 *  - ka-priests, offering bearers, a woman with a jar, a child in the courts
 *    nearest the pyramid ("priests conducting rituals")
 */

import { Mesh, type Object3D } from 'three';
import type { WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { Heightfield } from '../world/Heightfield';
import { fpReg } from '../debug/Footprints';
import { GeoWriter, limestoneMaterial, type TwinTomb, type WestTomb } from './KhufuComplex';
import { ColorWriter, addTownsfolk, person, townsfolkMesh, type C3 } from './Townsfolk';

const FAMILY = 'tomb-courts';
const DARK: C3 = [0.11, 0.09, 0.08];
const PALE: C3 = [0.78, 0.73, 0.62];
const OCHRE: C3 = [0.62, 0.36, 0.2];
const BREAD: C3 = [0.66, 0.5, 0.3];
const JAR: C3 = [0.56, 0.34, 0.22];
const ONION: C3 = [0.3, 0.46, 0.18];
const BULB: C3 = [0.86, 0.82, 0.7];
const TOMB_BATTER = 0.16;

export interface CourtInfo {
  courts: number;
  dependants: number;
  offerings: number;
}

/** quad wound so its normal points along `hint` */
function face(w: ColorWriter, a: C3, b: C3, c: C3, d: C3, t: C3, hint: C3): void {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
  if (n[0]! * hint[0] + n[1]! * hint[1] + n[2]! * hint[2] >= 0) w.quad(a, b, c, d, t);
  else w.quad(d, c, b, a, t);
}

export function buildFamilyCourts(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
  west: readonly WestTomb[],
  twins: readonly TwinTomb[],
): CourtInfo {
  const rng = seed.rng('necropolis');
  const folkRng = seed.rng('necropolis-folk');
  // wall tones on their own stream: the court selection (one roll per slot)
  // must not depend on how many pieces a wall is laid in
  const toneRng = seed.rng('necropolis-walls');
  const grd = (x: number, z: number): number => hf.heightAtCpu(x, z);
  const mud = new GeoWriter();
  const stone = new GeoWriter();
  const w = new ColorWriter();
  const folk = new ColorWriter();
  const info: CourtInfo = { courts: 0, dependants: 0, offerings: 0 };

  /** a mud-brick court wall from a to b (0.9 m thick, 2.2 m high), laid in
   *  pieces each seated on its own lowest ground — ≤ 8 m, shorter where the
   *  ground falls (≤ 0.8 m per piece: the east field's NE corner stands on
   *  the plateau's fall) — and a footprint per piece, as built */
  const wallRun = (ax: number, az: number, bx: number, bz: number, id: string, allow: string[]): void => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.6) return;
    const yaw = Math.atan2(bz - az, bx - ax);
    // the ground's total rise and fall along the line, sampled every metre
    // (end to end hides a scarp in the middle)
    let fall = 0;
    const m = Math.max(1, Math.ceil(len));
    for (let i = 0; i < m; i++) {
      fall += Math.abs(grd(ax + ((bx - ax) * (i + 1)) / m, az + ((bz - az) * (i + 1)) / m) - grd(ax + ((bx - ax) * i) / m, az + ((bz - az) * i) / m));
    }
    const n = Math.max(1, Math.ceil(len / 8), Math.ceil(fall / 0.6));
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const x0 = ax + (bx - ax) * t0;
      const z0 = az + (bz - az) * t0;
      const x1 = ax + (bx - ax) * t1;
      const z1 = az + (bz - az) * t1;
      const y = Math.min(grd(x0, z0), grd(x1, z1), grd((x0 + x1) / 2, (z0 + z1) / 2)) - 0.08;
      mud.box((x0 + x1) / 2, y, (z0 + z1) / 2, len / n + (i < n - 1 ? 0.02 : 0), 2.2, 0.9, toneRng.range(0.54, 0.6), 0.03, yaw);
      fpReg({
        id: n > 1 ? `${id}:${i}` : id, family: FAMILY, x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: len / n / 2, hz: 0.45, yaw,
        y0: y, y1: y + 2.2, ground: 'grounded', allow,
      });
    }
  };

  /** the east face of a battered tomb at height y: x(y) */
  const faceAt = (xBase: number, gy: number, batter: number) => (y: number): number => xBase - batter * (y - gy);

  /** a flat panel laid ON a battered east face, `proud` m off it */
  const lean = (fx: (y: number) => number, y0: number, y1: number, zc: number, width: number, proud: number, t: C3): void => {
    const a: C3 = [fx(y0) + proud, y0, zc - width / 2];
    const b: C3 = [fx(y0) + proud, y0, zc + width / 2];
    const c: C3 = [fx(y1) + proud, y1, zc + width / 2];
    const d: C3 = [fx(y1) + proud, y1, zc - width / 2];
    face(w, a, b, c, d, t, [1, 0.16, 0]);
  };

  /** the offering place in front of a face at x0 (+x is the court);
   *  returns the table's x */
  const offering = (x0: number, z: number, id: string): number => {
    const x = x0 + 1.25;
    const g = grd(x, z);
    stone.box(x, g - 0.08, z, 0.38, 0.48, 0.62, 0.98); // the table's foot
    stone.box(x, g + 0.4, z, 0.52, 0.12, 0.92, 1.04); // the hetep slab
    stone.box(x + 0.15, g - 0.05, z + 1.05, 0.55, 0.3, 0.55, 0.96); // the basin
    w.box(x + 0.15, g + 0.24, z + 1.05, 0.4, 0.02, 0.4, DARK);
    // loaves, a jar, a bundle of onions on the slab
    for (let k = 0; k < 3; k++) w.box(x - 0.08, g + 0.52, z - 0.3 + k * 0.2, 0.14, 0.12, 0.14, BREAD, k);
    w.box(x + 0.1, g + 0.52, z + 0.2, 0.16, 0.26, 0.16, JAR, Math.PI / 4);
    for (let k = 0; k < 4; k++) {
      w.box(x + 0.12, g + 0.52, z - 0.18 + k * 0.05, 0.05, 0.05, 0.05, BULB);
      w.box(x + 0.12, g + 0.57, z - 0.18 + k * 0.05, 0.02, 0.22, 0.02, ONION);
    }
    fpReg({ id: `offering:${id}`, family: FAMILY, x: x + 0.07, z: z + 0.45, hx: 0.36, hz: 1.0, y0: g - 0.08, y1: g + 0.8, ground: 'grounded' });
    info.offerings++;
    return x;
  };

  /** a false door on a battered tomb face: a pale frame, the dark niche,
   *  the drum lintel above it */
  const falseDoor = (t: WestTomb, z: number): void => {
    const fx = faceAt(t.x + t.W / 2, t.gy, TOMB_BATTER);
    const g = grd(t.x + t.W / 2 + 0.3, z);
    lean(fx, g - 0.05, g + 2.35, z, 1.5, 0.03, PALE);
    lean(fx, g, g + 1.75, z, 0.55, 0.05, DARK);
    lean(fx, g + 1.82, g + 2.0, z, 0.8, 0.06, [0.7, 0.66, 0.56]);
  };

  /** the chapel's dark doorway on its east face */
  const chapelDoor = (xFace: number, y0: number, z: number): void => {
    const fx = faceAt(xFace, y0, 0.06);
    const g = grd(xFace + 0.3, z);
    lean(fx, g, g + 1.9, z, 0.9, 0.025, DARK);
  };

  /** ka-priest at the offering table (tx, tz), bearers, a woman with a
   *  jar, a child — all facing the tomb (west) */
  const mourners = (tx: number, z: number): void => {
    const px = tx + 0.95;
    person(folk, folkRng, px, grd(px, z), z, Math.PI, 'stand', 1, [0.92, 0.9, 0.82]);
    for (const dz of [-1.1, 1.1]) {
      const bx = tx + 2.2;
      const g = grd(bx, z + dz);
      person(folk, folkRng, bx, g, z + dz, Math.PI, 'kneel');
      folk.box(bx - 0.45, g + 0.78, z + dz, 0.42, 0.03, 0.34, [0.5, 0.38, 0.24]); // the tray
      folk.box(bx - 0.45, g + 0.81, z + dz, 0.14, 0.12, 0.14, BREAD);
    }
    const wx = tx + 3.0;
    const wz = z + 2.2;
    const wg = grd(wx, wz);
    person(folk, folkRng, wx, wg, wz, Math.PI + 0.4, 'stand', 0.97, [0.88, 0.85, 0.76]);
    folk.box(wx, wg + 1.72, wz, 0.26, 0.32, 0.26, OCHRE, 0.7); // a jar on her head
    const cx = tx + 3.3;
    const cz = z - 2.0;
    person(folk, folkRng, cx, grd(cx, cz), cz, Math.PI - 0.3, 'stand', 0.62);
  };

  /* --- west field: pairs in a column ------------------------------------------ */
  const at = new Map(west.map((t) => [`${t.col}:${t.row}`, t]));
  const used = new Set<WestTomb>();
  const westCourts: { col: number; tx: number; tz: number }[] = [];
  for (let c = 0; c < 17; c++) {
    for (let k = 0; k < 12; k++) {
      const roll = rng.float(); // one draw per slot, eligible or not
      const A = at.get(`${c}:${2 * k}`);
      const B = at.get(`${c}:${2 * k + 2}`);
      if (!A || !B || A.large || B.large || used.has(A) || used.has(B)) continue;
      if (roll >= 0.12 || info.courts >= 12) continue;
      used.add(A);
      used.add(B);
      const faceA = A.x + A.W / 2;
      const faceB = B.x + B.W / 2;
      const xE = Math.max(faceA, faceB) + 9;
      // the court runs from 3 m inside each tomb's end, and always takes in
      // the tombs' chapels
      let zN = A.z - A.L / 2 + 3;
      let zS = B.z + B.L / 2 - 3;
      if (A.chapelZ !== null) zN = Math.max(A.z - A.L / 2 + 0.6, Math.min(zN, A.chapelZ - 2.7));
      if (B.chapelZ !== null) zS = Math.min(B.z + B.L / 2 - 0.6, Math.max(zS, B.chapelZ + 2.7));
      const id = `court:w:${c}:${k}`;
      const allow = ['mastabas-west', 'tomb-chapels'];
      wallRun(faceA - 0.4, zN, xE + 0.45, zN, `${id}:n`, allow);
      wallRun(faceB - 0.4, zS, xE + 0.45, zS, `${id}:s`, allow);
      const zm = (zN + zS) / 2;
      wallRun(xE, zN, xE, zm - 0.8, `${id}:e1`, allow);
      wallRun(xE, zm + 0.8, xE, zS, `${id}:e2`, allow);
      // close the street between the two tombs
      const aEnd = A.z + A.L / 2;
      const bEnd = B.z - B.L / 2;
      if (bEnd - aEnd > 0.8) wallRun(faceA - 0.3, aEnd - 0.3, faceB - 0.3, bEnd + 0.3, `${id}:gap`, allow);
      // offering places
      const tables: [number, number][] = [];
      for (const [T, n] of [[A, 'a'], [B, 'b']] as const) {
        const face = T.x + T.W / 2;
        if (T.chapelZ !== null) {
          const cy0 = Math.min(grd(face, T.chapelZ - 2.1), grd(face + 3.2, T.chapelZ - 2.1),
            grd(face + 3.2, T.chapelZ + 2.1), grd(face, T.chapelZ + 2.1)) - 0.3;
          chapelDoor(face + 3.2, cy0, T.chapelZ);
          tables.push([offering(face + 3.2, T.chapelZ, `${id}:${n}`), T.chapelZ]);
        } else {
          const zf = T.z + T.L / 4; // the main, southern niche
          falseDoor(T, zf);
          tables.push([offering(face, zf, `${id}:${n}`), zf]);
        }
      }
      // a dependant's tomb between the parents', one court in three
      const gap = bEnd - aEnd;
      if (info.courts % 3 === 0 && gap >= 7) {
        const dx = (A.x + B.x) / 2;
        const dz = (aEnd + bEnd) / 2;
        const lz = Math.min(6.5, gap - 1.6);
        const lx = 4;
        const dy = Math.min(grd(dx - 2, dz - lz / 2), grd(dx + 2, dz - lz / 2), grd(dx - 2, dz + lz / 2), grd(dx + 2, dz + lz / 2)) - 0.3;
        stone.box(dx, dy, dz, lx, 2.9, lz, 0.9, 0.12);
        fpReg({
          id: `subsid:${c}:${k}`, family: FAMILY, x: dx, z: dz, hx: lx / 2, hz: lz / 2,
          y0: dy, y1: dy + 2.9, ground: 'grounded', allow: ['mastabas-west'],
        });
        info.dependants++;
      }
      westCourts.push({ col: c, tx: tables[0]![0], tz: tables[0]![1] });
      info.courts++;
    }
  }

  /* --- east field: a court before every twin ---------------------------------- */
  const eastCourts: [number, number][] = [];
  for (const T of twins) {
    const face = T.x + T.W / 2;
    const xE = face + 10;
    // the NE twin stands by the plateau's eastern fall (3 m over 6 m at its
    // NE corner): a court wall does not climb down a scarp — it starts
    // where its line lies on level ground
    const fall = (z: number): number => {
      const g = [0, 0.25, 0.5, 0.75, 1].map((t) => grd(face + (xE - face) * t, z));
      return Math.max(...g) - Math.min(...g);
    };
    let zN = T.z - T.L / 2 + 3;
    while (zN < T.z - 8 && fall(zN) > 0.9) zN += 1;
    zN = Math.min(zN, T.chapelZ[0] - 2.9); // the chapels stay inside
    let zS = T.z + T.L / 2 - 3;
    while (zS > T.z + 8 && fall(zS) > 0.9) zS -= 1;
    zS = Math.max(zS, T.chapelZ[1] + 2.9);
    const zm = (zN + zS) / 2;
    const id = `court:${T.id.slice(5)}`; // court:e:c:side
    const allow = ['mastabas-east', 'tomb-chapels'];
    wallRun(face - 0.4, zN, xE + 0.45, zN, `${id}:n`, allow);
    wallRun(face - 0.4, zS, xE + 0.45, zS, `${id}:s`, allow);
    wallRun(xE, zN, xE, zm - 0.8, `${id}:e1`, allow);
    wallRun(xE, zm + 0.8, xE, zS, `${id}:e2`, allow);
    for (const [k, cz] of [['a', T.chapelZ[0]], ['b', T.chapelZ[1]]] as const) {
      const cy0 = Math.min(grd(face, cz - 2.3), grd(face + 3.6, cz - 2.3), grd(face + 3.6, cz + 2.3), grd(face, cz + 2.3)) - 0.3;
      chapelDoor(face + 3.6, cy0, cz);
      const tx = offering(face + 3.6, cz, `${id}:${k}`);
      if (k === 'a' && eastCourts.length < 2) eastCourts.push([tx, cz]);
    }
    info.courts++;
  }

  /* --- people in the courts nearest the pyramid -------------------------------- */
  westCourts.sort((a, b) => a.col - b.col);
  for (const wc of westCourts.slice(0, 4)) mourners(wc.tx, wc.tz);
  for (const [tx, tz] of eastCourts) mourners(tx, tz);

  /* --- materialize ---------------------------------------------------------- */
  const meshes = [
    new Mesh(mud.build(), limestoneMaterial([0.56, 0.46, 0.34], gi, 0.3, 0.45)),
    new Mesh(stone.build(), limestoneMaterial([0.74, 0.68, 0.57], gi, 0.55)),
  ];
  for (const m of meshes) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'necropolis';
    scene.add(m);
  }
  // the props writer holds no figures: addTownsfolk would drop it
  if (w.pos.length > 0) scene.add(townsfolkMesh(w, gi, 'necropolis'));
  addTownsfolk(scene, folk, gi, 'necropolis');
  return info;
}
