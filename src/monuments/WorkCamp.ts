/**
 * The haulers' camp on the plateau (v1.2 I4) — canon Vol. IV, the Khufu
 * district lists "Temporary Worker Camps"; Vol. VIII keeps the workforce
 * itself in the planned town ("a carefully planned settlement rather than a
 * temporary camp") and the Bible warns off "the outdated stereotype of
 * enslaved laborers living in miserable camps". So this is the other thing:
 * a provisioned work-season camp for the gangs on the haul road, a short
 * walk from it, between shifts —
 *  - two rows of reed-mat lean-tos facing a lane, sleeping mats, a jar and a
 *    basket in each, men resting out of the sun
 *  - hearths in the lane, pots on them, a cook at each (their smoke rises —
 *    Particles reads CAMP_HEARTHS)
 *  - a WATER STATION: the plateau has no water, so donkeys bring it up from
 *    the valley in jars; big storage jars on a mud bench under a shade
 *  - a RATION POINT: bread and beer from the town's bakeries and brewery,
 *    baskets of loaves, a seated scribe recording the issue, an overseer, a
 *    queue
 * Site from the Haiku layout sweep (I4-D, candidate F, verified): x −60..0,
 * z 250..290 — plateau rock ~50 m west of the haul road's quarry leg, clear
 * of the quarry bowl (dq ≥ 1.27), the debris fields, the ox trains and the
 * shelters, the temenos and the mastaba fields.
 */

import { Mesh, type Object3D } from 'three';
import type { WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { Heightfield } from '../world/Heightfield';
import { fpReg } from '../debug/Footprints';
import { GeoWriter, limestoneMaterial } from './KhufuComplex';
import { ColorWriter, addTownsfolk, donkey, person, reedMat, reedRoof, type C3 } from './Townsfolk';
import type { Gang } from './Inhabitants';

const FAMILY = 'work-camp';
const REED: C3 = [0.63, 0.56, 0.37];
const REED_OLD: C3 = [0.55, 0.49, 0.34];
const POLE: C3 = [0.4, 0.31, 0.2];
const MAT: C3 = [0.56, 0.48, 0.31];
const JAR: C3 = [0.6, 0.4, 0.26];
const STONE: C3 = [0.62, 0.58, 0.5];
const ASH: C3 = [0.3, 0.29, 0.28];
const BREAD: C3 = [0.66, 0.5, 0.3];
const BASKET: C3 = [0.58, 0.48, 0.3];

/** the lane's hearths (world x, z) */
export const CAMP_HEARTHS: [number, number][] = [[-48, 270], [-31, 270.5], [-14, 269.5]];

/** (T2) the hearths that burn: empty when the camp is not built (KHAFRE_PERIOD) */
export const campHearths: [number, number][] = [];

/** the gangs walking camp ↔ haul road */
export const campLines: Gang[] = [
  { x0: 2, z0: 271, x1: 54, z1: 277, n: 10, spread: 2.4, carry: 0.15, still: 0.25 },
];

export function buildWorkCamp(scene: Object3D, seed: WorldSeed, hf: Heightfield, gi: ProbeGI | null): number {
  const rng = seed.rng('work-camp');
  campHearths.length = 0;
  campHearths.push(...CAMP_HEARTHS);
  const grd = (x: number, z: number): number => hf.heightAtCpu(x, z);
  const w = new ColorWriter();
  const mud = new GeoWriter();
  let shelters = 0;

  /** local frame: f toward the lane, s along it */
  const frame = (x: number, z: number, yaw: number) => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return (f: number, sd: number): [number, number] => [x + f * c - sd * s, z + f * s + sd * c];
  };

  /** a reed-mat lean-to (4.2 × 3.4 m), open toward the lane */
  const shelter = (x: number, z: number, yaw: number): void => {
    const L = frame(x, z, yaw);
    const ys = [[-1.6, -2], [-1.6, 2], [1.6, -2], [1.6, 2]].map(([f, s]) => {
      const [px, pz] = L(f!, s!);
      return grd(px, pz);
    });
    const y = Math.min(...ys) - 0.05;
    const old = rng.chance(0.4) ? REED_OLD : REED;
    // posts: tall in front, short at the back
    for (const [f, s, h] of [[-1.6, -2, 1.2], [-1.6, 2, 1.2], [1.6, -2, 1.95], [1.6, 2, 1.95]] as const) {
      const [px, pz] = L(f, s);
      w.box(px, y, pz, 0.1, h + 0.1, 0.1, POLE, yaw);
    }
    // the sloping mat roof (two faces, so it reads from below as well)
    const c0 = L(-1.8, -2.15);
    const c1 = L(-1.8, 2.15);
    const c2 = L(1.8, 2.15);
    const c3 = L(1.8, -2.15);
    const yb = y + 1.28;
    const yf = y + 2.03;
    reedRoof(w, [c0[0], yb, c0[1]], [c1[0], yb, c1[1]], [c2[0], yf, c2[1]], [c3[0], yf, c3[1]], old);
    // back mat and one side mat against the north wind
    const [bx, bz] = L(-1.62, 0);
    reedMat(w, bx, y, bz, 4.1, 1.2, yaw + Math.PI / 2, old);
    const [sx, sz] = L(0, -2.05);
    reedMat(w, sx, y, sz, 3.2, 1.25, yaw, old);
    // sleeping mats, a jar and a basket
    for (const s of [-1.1, 0.1, 1.3]) {
      const [mx, mz] = L(-0.4, s);
      w.box(mx, y + 0.05, mz, 1.85, 0.03, 0.8, MAT, yaw);
    }
    const [jx, jz] = L(-1.2, 1.75);
    w.box(jx, y + 0.05, jz, 0.34, 0.46, 0.34, JAR, yaw + Math.PI / 4);
    const [kx, kz] = L(-1.15, -1.7);
    w.box(kx, y + 0.05, kz, 0.48, 0.28, 0.48, BASKET, yaw);
    // men off shift: one asleep, one sitting in the shade
    const r = rng.float();
    if (r < 0.45) {
      const [px, pz] = L(-0.4, -1.1);
      person(w, rng, px, y + 0.08, pz, yaw + Math.PI / 2, 'lie');
    }
    if (r > 0.3) {
      const [px, pz] = L(0.6, 0.6);
      person(w, rng, px, y + 0.05, pz, yaw, 'sit');
    }
    fpReg({ id: `camp:shelter:${shelters}`, family: FAMILY, x, z, hx: 1.85, hz: 2.2, yaw, y0: y, y1: y + 2.1, ground: 'grounded' });
    shelters++;
  };

  // north row faces south (+z) onto the lane, south row faces north
  for (let i = 0; i < 6; i++) shelter(-54 + i * 8.6 + rng.range(-0.6, 0.6), 262 + rng.range(-0.5, 0.5), Math.PI / 2 + rng.range(-0.06, 0.06));
  for (let i = 0; i < 6; i++) shelter(-50 + i * 8.6 + rng.range(-0.6, 0.6), 278.5 + rng.range(-0.5, 0.5), -Math.PI / 2 + rng.range(-0.06, 0.06));

  /* --- hearths in the lane --------------------------------------------------- */
  for (const [hx, hz] of CAMP_HEARTHS) {
    const y = grd(hx, hz);
    w.box(hx, y - 0.02, hz, 1.1, 0.04, 1.1, ASH, rng.float());
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      w.box(hx + Math.cos(a) * 0.62, y - 0.03, hz + Math.sin(a) * 0.62, 0.22, 0.17, 0.18, STONE, a);
    }
    // the pot on three stones
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      w.box(hx + Math.cos(a) * 0.2, y, hz + Math.sin(a) * 0.2, 0.14, 0.16, 0.14, STONE, a);
    }
    w.box(hx, y + 0.16, hz, 0.4, 0.34, 0.4, [0.36, 0.22, 0.15], Math.PI / 4);
    // the cook squats on the windward side, a stack of fuel beside
    person(w, rng, hx, y, hz - 1.1, Math.PI / 2, 'squat');
    w.box(hx + 1.0, y, hz - 0.9, 0.8, 0.22, 0.4, [0.42, 0.33, 0.2], rng.float());
    fpReg({ id: `camp:hearth:${hx}`, family: FAMILY, x: hx, z: hz, hx: 0.75, hz: 0.75, y0: y - 0.05, y1: y + 0.5, ground: 'grounded', passive: true });
  }

  /* --- the water station: jars brought up by donkey --------------------------- */
  {
    const x = -2.5;
    const z = 262;
    const y = Math.min(grd(x - 2, z - 1.5), grd(x + 2, z + 1.5)) - 0.05;
    for (const [dx, dz] of [[-2, -1.6], [2, -1.6], [-2, 1.6], [2, 1.6]] as const) w.box(x + dx, y, z + dz, 0.12, 2.25, 0.12, POLE);
    reedRoof(w, [x - 2.3, y + 2.25, z - 1.9], [x + 2.3, y + 2.25, z - 1.9], [x + 2.3, y + 2.25, z + 1.9], [x - 2.3, y + 2.25, z + 1.9], REED);
    mud.box(x, y - 0.1, z - 0.6, 3.8, 0.42, 0.9, 0.58, 0.04); // the jar bench
    for (let k = 0; k < 5; k++) {
      const jx = x - 1.5 + k * 0.75;
      w.box(jx, y + 0.32, z - 0.6, 0.52, 0.66, 0.52, JAR, Math.PI / 4);
      w.box(jx, y + 0.98, z - 0.6, 0.24, 0.1, 0.24, JAR);
    }
    w.box(x + 0.5, y, z + 0.9, 0.36, 0.42, 0.36, JAR, 0.3); // a dipper jar on the ground
    // two donkeys just arrived with full panniers, their driver
    donkey(w, rng, x + 6.5, grd(x + 6.5, z + 0.5), z + 0.5, Math.PI + 0.15, true);
    donkey(w, rng, x + 9.2, grd(x + 9.2, z - 1.2), z - 1.2, Math.PI - 0.1, true);
    person(w, rng, x + 5.2, grd(x + 5.2, z - 1.4), z - 1.4, Math.PI, 'stand');
    person(w, rng, x - 0.6, y, z + 1.4, -Math.PI / 2, 'stand'); // drawing water
    fpReg({ id: 'camp:water', family: FAMILY, x, z, hx: 2.3, hz: 1.9, y0: y, y1: y + 2.35, ground: 'grounded' });
  }

  /* --- the ration point: bread and beer from the town, a scribe -------------- */
  {
    const x = -1.5;
    const z = 279;
    const y = Math.min(grd(x - 2, z - 1.5), grd(x + 2, z + 1.5)) - 0.05;
    for (const [dx, dz] of [[-2.1, -1.5], [2.1, -1.5], [-2.1, 1.5], [2.1, 1.5]] as const) w.box(x + dx, y, z + dz, 0.12, 2.2, 0.12, POLE);
    reedRoof(w, [x - 2.4, y + 2.2, z - 1.8], [x + 2.4, y + 2.2, z - 1.8], [x + 2.4, y + 2.2, z + 1.8], [x - 2.4, y + 2.2, z + 1.8], REED_OLD);
    // baskets of conical loaves, sealed beer jars, a grain sack
    for (let k = 0; k < 4; k++) {
      const bx = x - 1.4 + k * 0.9;
      w.box(bx, y + 0.05, z + 0.8, 0.62, 0.3, 0.62, BASKET);
      for (let l = 0; l < 4; l++) {
        w.box(bx - 0.14 + (l % 2) * 0.28, y + 0.35, z + 0.66 + Math.floor(l / 2) * 0.28, 0.16, 0.2, 0.16, BREAD, l);
      }
    }
    for (let k = 0; k < 4; k++) {
      w.box(x - 1.6 + k * 0.5, y + 0.05, z + 1.55, 0.3, 0.5, 0.3, JAR, Math.PI / 4);
      w.box(x - 1.6 + k * 0.5, y + 0.55, z + 1.55, 0.2, 0.08, 0.2, [0.5, 0.45, 0.36]); // mud stopper
    }
    // the scribe tallies the issue; the overseer stands by; a queue
    person(w, rng, x - 1.2, y + 0.05, z - 0.6, -Math.PI / 2, 'sit');
    w.box(x - 1.2, y + 0.42, z - 0.92, 0.36, 0.03, 0.26, [0.72, 0.66, 0.52], 0); // writing board
    person(w, rng, x + 0.9, y + 0.05, z - 0.8, -Math.PI / 2 - 0.4, 'stand', 1, [0.9, 0.87, 0.78]);
    for (let k = 0; k < 4; k++) {
      const qx = x - 1.0 - k * 0.15;
      const qz = z - 2.6 - k * 0.8;
      person(w, rng, qx, grd(qx, qz), qz, Math.PI / 2, 'stand');
    }
    fpReg({ id: 'camp:rations', family: FAMILY, x, z, hx: 2.4, hz: 1.8, y0: y, y1: y + 2.3, ground: 'grounded' });
  }

  /* --- a few in the lane between shifts --------------------------------------- */
  for (const [lx, lz, a] of [[-40, 268.6, 0.4], [-39.2, 269.4, Math.PI + 0.3], [-22, 271.5, -1.2], [-6, 270, Math.PI]] as const) {
    person(w, rng, lx, grd(lx, lz), lz, a, 'stand');
  }

  addTownsfolk(scene, w, gi, 'work-camp');
  const m = new Mesh(mud.build(), limestoneMaterial([0.56, 0.46, 0.34], gi, 0.3, 0.45));
  m.castShadow = true;
  m.receiveShadow = true;
  m.name = 'work-camp';
  scene.add(m);
  return shelters;
}
