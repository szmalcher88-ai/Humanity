/**
 * Industrial quarter (v1.1 detail pass) — canon Vol. IV District 7: "separate
 * noisy production from ceremonial areas … each workshop should produce
 * visible outputs: dust, smoke, waste materials, finished products". It sits
 * south of the worker town, in the town's own frame (+u east-ish, +v
 * south-ish):
 *
 *   brickyard     (u  95..170, v  95..195) on the ALLUVIUM — mudbrick is
 *                 Nile mud + chopped straw: puddling pits by the plain, a
 *                 drying field of laid-out bricks in rows, dried bricks
 *                 stacked in coursed cubes, straw heaps
 *   pottery yard  (terrace u −30..30, v 108..152) — three two-tier kilns with
 *                 dark fire-mouths and soot caps, a clay heap, a potter's
 *                 shed, jars drying in rows
 *   copper works  (terrace u −30..20, v 162..202) — a walled court with
 *                 bowl furnaces, a charcoal heap and a pile of malachite ore
 *                 (the green is the point: it is the only green in the yard)
 *   rope walk     (u 55..65, v 92..212) — a long double row of posts with
 *                 ropes laid along it and finished coils at the end
 *
 * The terraces are WORKER_TOWN_PADS entries (the town's platform mechanism);
 * the brickyard needs none on the dead-flat plain. Smoke from the kilns and
 * furnaces comes from WorkParticles (INDUSTRY_SMOKE), the gangs from
 * Inhabitants — both read the same anchors via townToWorld.
 */

import { Mesh, type Object3D } from 'three';
import type { WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { Heightfield } from '../world/Heightfield';
import { WORKER_TOWN_YAW } from '../world/CANON_DIMENSIONS';
import { townToWorld } from '../world/TownFrame';
import { ColorWriter, addTownsfolk, person } from './Townsfolk';
import { NILE_WATER_Y } from '../world/WorldConst';
import { fpReg } from '../debug/Footprints';
import { GeoWriter, limestoneMaterial } from './KhufuComplex';

const FAMILY = 'industry';
const YAW = WORKER_TOWN_YAW;

/** kiln and furnace mouths, town-local — the smoke sources */
export const INDUSTRY_SMOKE: readonly (readonly [number, number])[] = [
  [-18, 120], [0, 118], [18, 121], // pottery kilns
  // copper furnaces — all inside the court (v1.2: #4 stood outside the east
  // wall at u 12, #3 inside the charcoal heap)
  [-16, 176], [-7, 178], [2, 176], [-2, 186],
];

export function buildIndustryDistrict(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null = null,
): number {
  const rng = seed.rng('industry');
  const mud = new GeoWriter();
  const bricks = new GeoWriter(); // laid-out bricks (horizontal brick grid)
  const stacks = new GeoWriter(); // stacked dried bricks (coursed cubes)
  const dark = new GeoWriter(); // wet mud, soot, charcoal, fire-mouths
  const clay = new GeoWriter();
  const ore = new GeoWriter();
  const wood = new GeoWriter();
  const stone = new GeoWriter(); // (v1.2 I3) the carvers' limestone
  const ash = new GeoWriter(); // (v1.2 I3) the town's ash
  const folk = new ColorWriter(); // weavers, spinners, carvers
  const fr = seed.rng('industry-folk');
  let pieces = 0;

  const W = (u: number, v: number): [number, number] => townToWorld(u, v);
  const grd = (u: number, v: number): number => {
    const [x, z] = W(u, v);
    return hf.heightAtCpu(x, z);
  };
  /** lowest of the footprint's corners (town-local, axis-aligned in u/v) */
  const low = (u: number, v: number, hu: number, hv: number): number =>
    Math.min(grd(u - hu, v - hv), grd(u + hu, v - hv), grd(u + hu, v + hv), grd(u - hu, v + hv));
  const dry = (u: number, v: number, hu: number, hv: number): boolean =>
    low(u, v, hu, hv) > NILE_WATER_Y + 0.6;
  /** town-local box at an explicit base */
  const box = (
    w: GeoWriter, u: number, y: number, v: number, lu: number, h: number, lv: number,
    tone: number, batter = 0, yawExtra = 0, batterV?: number,
  ): void => {
    const [x, z] = W(u, v);
    w.box(x, y, z, lu, h, lv, tone, batter, YAW + yawExtra, batterV);
  };
  /** octagonal prism: two crossed boxes */
  /** round masonry of diameter d (v1.2: a true drum — two crossed boxes
   *  made an eight-pointed star of every kiln and furnace) */
  const octo = (w: GeoWriter, u: number, y: number, v: number, d: number, h: number, tone: number, batter = 0): void => {
    const [x, z] = W(u, v);
    w.drum(x, y, z, d / 2, h, tone, batter, d > 2 ? 14 : 10);
  };
  /** `open`: a surface people work ON (pits, the drying field, the rope
   *  walk) — passive for the audit and the inhabitants' obstacle field */
  const reg = (
    id: string, u: number, v: number, hu: number, hv: number, y0: number, y1: number,
    open = false,
  ): void => {
    const [x, z] = W(u, v);
    fpReg({
      id, family: FAMILY, x, z, hx: hu, hz: hv, y0, y1, yaw: YAW,
      ground: open ? 'none' : 'grounded', passive: open,
    });
    pieces++;
  };

  /* --- brickyard ------------------------------------------------------------ */
  {
    // puddling pits by the plain: wet mud a hand below the ground, low banks
    for (const [k, pv] of [[0, 104], [1, 128], [2, 152], [3, 176]] as const) {
      const pu = 160;
      if (!dry(pu, pv, 4.5, 3.2)) continue;
      const y = low(pu, pv, 4.5, 3.2);
      box(dark, pu, y - 0.4, pv, 7.6, 0.32, 5.2, 0.55);
      for (const [du, dv, lu, lv] of [[0, -2.9, 8.6, 0.6], [0, 2.9, 8.6, 0.6], [-4.0, 0, 0.6, 5.2], [4.0, 0, 0.6, 5.2]] as const) {
        box(mud, pu + du, y - 0.2, pv + dv, lu, 0.45, lv, 0.62, 0.1);
      }
      // water jars to keep the puddle workable
      for (let j = 0; j < 3; j++) box(clay, pu - 5.4, grd(pu - 5.4, pv - 1.6 + j * 1.1) - 0.05, pv - 1.6 + j * 1.1, 0.55, 0.8, 0.55, 0.9, 0.12);
      reg(`mud-pit:${k}`, pu, pv, 4.4, 3.2, y - 0.4, y + 0.3, true);
    }
    // the drying field: bricks laid out flat in long rows (a brick grid on
    // the horizontal faces), paths between rows for the moulders
    for (let col = 0; col < 4; col++) {
      const cu = 104 + col * 11.5;
      for (let row = 0; row < 34; row++) {
        const cv = 100 + row * 2.7;
        if (rng.chance(0.12)) continue; // a row not yet laid
        const L = rng.range(8.6, 10.2);
        if (!dry(cu, cv, L / 2, 0.8)) continue;
        const y = low(cu, cv, L / 2, 0.8) - 0.04;
        box(bricks, cu, y, cv, L, 0.14, 1.5, rng.range(0.92, 1.06));
      }
    }
    reg('drying-field', 121, 145, 25, 47, low(121, 145, 25, 47) - 0.1, low(121, 145, 25, 47) + 0.2, true);
    // dried bricks stacked in coursed cubes along the road, ready to carry
    for (let k = 0; k < 14; k++) {
      const su = 96 + (k % 2) * 2.4;
      const sv = 104 + Math.floor(k / 2) * 12.5 + rng.range(-1, 1);
      if (!dry(su, sv, 0.8, 0.8)) continue;
      const y = low(su, sv, 0.8, 0.8) - 0.05;
      const h = rng.range(1.1, 1.6);
      box(stacks, su, y, sv, 1.5, h, 1.5, rng.range(0.9, 1.05));
      reg(`brick-stack:${k}`, su, sv, 0.8, 0.8, y, y + h);
    }
    // chopped-straw temper heaps
    for (const [k, hu, hv] of [[0, 146, 112], [1, 146, 160], [2, 148, 188]] as const) {
      if (!dry(hu, hv, 1.6, 1.6)) continue;
      const y = grd(hu, hv) - 0.1;
      box(clay, hu, y, hv, 3.0, 1.0, 2.6, 1.25, 0.55);
      reg(`straw:${k}`, hu, hv, 1.5, 1.3, y, y + 1.0);
    }
  }

  /* --- pottery yard (on its terrace) ------------------------------------------ */
  {
    for (const [k, [ku, kv]] of INDUSTRY_SMOKE.slice(0, 3).entries()) {
      const y = grd(ku, kv) - 0.2;
      octo(mud, ku, y, kv, 3.6, 2.2, 0.6, 0.06); // firing chamber
      octo(mud, ku, y + 2.15, kv, 2.6, 0.9, 0.58, 0.12); // dome
      octo(dark, ku, y + 2.95, kv, 1.3, 0.22, 0.4); // soot-black vent
      box(dark, ku, y + 0.2, kv + 1.82, 0.8, 0.75, 0.12, 0.3); // fire-mouth
      // chamber radius 1.8, the fire-mouth reaching 1.88 (v1.1 registered
      // 1.9 for a crossed-box star whose points reached 2.55)
      reg(`kiln:${k}`, ku, kv, 1.95, 1.95, y, y + 3.2);
    }
    // jars drying in rows on the yard
    for (let r = 0; r < 4; r++) {
      for (let j = 0; j < 12; j++) {
        if (rng.chance(0.25)) continue;
        const ju = -22 + j * 3.6 + rng.range(-0.3, 0.3);
        const jv = 132 + r * 2.4;
        const y = grd(ju, jv) - 0.04;
        box(clay, ju, y, jv, 0.6, rng.range(0.55, 0.85), 0.6, rng.range(0.95, 1.12), 0.14);
      }
    }
    reg('jar-rows', -2, 136, 22, 5, grd(-2, 136) - 0.1, grd(-2, 136) + 0.9);
    // potter's shed: three mud walls and a reed roof on posts
    {
      const su = -24;
      const sv = 146;
      const y = low(su, sv, 4, 2.6) - 0.2;
      box(mud, su, y, sv - 2.4, 8.2, 2.5, 0.5, 0.56, 0.02);
      box(mud, su - 3.9, y, sv, 0.5, 2.5, 5.0, 0.56, 0.02);
      box(mud, su + 3.9, y, sv, 0.5, 2.5, 5.0, 0.56, 0.02);
      box(clay, su, y + 2.5, sv, 8.8, 0.12, 5.6, 1.15);
      for (let w0 = 0; w0 < 3; w0++) box(wood, su - 2.5 + w0 * 2.5, y + 0.3, sv + 0.6, 0.5, 0.75, 0.5, 0.8); // tournettes: hand-turned slow wheels (the fast kick wheel is Late Period)
      reg('potter-shed', su, sv, 4.1, 2.8, y, y + 2.7);
    }
    // the clay heap, still wet on its north side
    {
      const y = grd(22, 146) - 0.1;
      box(clay, 22, y, 146, 4.6, 1.2, 3.6, 0.82, 0.45);
      box(dark, 22, y, 147.4, 3.4, 0.7, 1.0, 0.72, 0.4);
      reg('clay-heap', 22, 146, 2.3, 1.8, y, y + 1.2);
    }
  }

  /* --- copper works (walled court, on its terrace) ------------------------------ */
  {
    const cu = -5;
    const cv = 182;
    const hu = 15;
    const hv = 11;
    const y = low(cu, cv, hu, hv) - 0.3;
    const wh = 1.9;
    box(mud, cu, y, cv - hv, hu * 2, wh, 0.7, 0.55, 0.03); // north
    box(mud, cu - hu, y, cv, 0.7, wh, hv * 2, 0.56, 0.03); // west
    box(mud, cu + hu, y, cv, 0.7, wh, hv * 2, 0.55, 0.03); // east
    // south wall with a gate gap
    box(mud, cu - hu / 2 - 1.6, y, cv + hv, hu - 3.2, wh, 0.7, 0.55, 0.03);
    box(mud, cu + hu / 2 + 1.6, y, cv + hv, hu - 3.2, wh, 0.7, 0.55, 0.03);
    // bowl furnaces: low clay rings, charred inside, a tuyère stone by each
    for (const [k, [fu, fv]] of INDUSTRY_SMOKE.slice(3).entries()) {
      const fy = grd(fu, fv) - 0.1;
      octo(mud, fu, fy, fv, 1.4, 0.55, 0.5, 0.08);
      octo(dark, fu, fy + 0.5, fv, 0.8, 0.07, 0.2);
      box(clay, fu + 1.1, fy, fv, 0.45, 0.35, 0.3, 0.8, 0.1);
      reg(`furnace:${k}`, fu + 0.2, fv, 1.2, 1.0, fy, fy + 0.6);
    }
    // charcoal heap and malachite ore
    {
      const hy = grd(cu + 11, cv - 5) - 0.1;
      box(dark, cu + 11, hy, cv - 5, 3.6, 1.0, 2.8, 0.25, 0.42);
      reg('charcoal', cu + 11, cv - 5, 1.8, 1.4, hy, hy + 1.0);
      const oy = grd(cu + 9, cv + 4) - 0.1;
      box(ore, cu + 9, oy, cv + 4, 2.4, 0.6, 2.0, 1.0, 0.4);
      reg('ore', cu + 9, cv + 4, 1.2, 1.0, oy, oy + 0.6);
    }
    // anvil stones
    for (let k = 0; k < 3; k++) {
      const au = cu - 8 + k * 3;
      const av = cv + 5;
      box(clay, au, grd(au, av) - 0.05, av, 0.6, 0.45, 0.5, 0.7, 0.03);
    }
    // the WALLS are solid, the court is a floor the smiths work on (v1.2:
    // one solid box over the whole court kept half the smiths out of it)
    reg('copper-n', cu, cv - hv, hu + 0.35, 0.35, y, y + wh);
    reg('copper-w', cu - hu, cv, 0.35, hv + 0.35, y, y + wh);
    reg('copper-e', cu + hu, cv, 0.35, hv + 0.35, y, y + wh);
    for (const s of [-1, 1]) reg(`copper-s${s}`, cu + s * (hu / 2 + 1.6), cv + hv, (hu - 3.2) / 2, 0.35, y, y + wh);
    reg('copper-court', cu, cv, hu, hv, y, y + 0.1, true);
  }

  /* --- rope walk --------------------------------------------------------------- */
  {
    const u0 = 60;
    for (let v = 92; v <= 212; v += 6) {
      for (const s of [-0.6, 0.6]) {
        const y = grd(u0 + s, v) - 0.3;
        box(wood, u0 + s, y, v, 0.14, 1.35, 0.14, 0.72);
      }
    }
    // ropes laid along the walk at post height, in 30 m lengths
    for (let k = 0; k < 4; k++) {
      const v0 = 95 + k * 29;
      for (const s of [-0.35, 0.35]) {
        for (let seg = 0; seg < 5; seg++) {
          const vm = v0 + seg * 5.5 + 2.75;
          const y = grd(u0 + s, vm) + 0.95;
          box(clay, u0 + s, y, vm, 0.07, 0.07, 5.6, 0.75);
        }
      }
    }
    // finished coils at the south end
    for (let c = 0; c < 4; c++) {
      const cu2 = u0 - 3 + (c % 2) * 6;
      const cv2 = 214 + Math.floor(c / 2) * 2.4;
      const y = grd(cu2, cv2) - 0.05;
      octo(clay, cu2, y, cv2, 1.1, 0.5, 0.78);
      octo(dark, cu2, y + 0.49, cv2, 0.4, 0.03, 0.5);
    }
    reg('rope-walk', u0, 152, 1.2, 61, grd(u0, 152) - 0.3, grd(u0, 152) + 1.2, true);
  }

  /* --- (v1.2 I3) weaving terrace: horizontal ground looms (canon VIII
   *      "Textile production"; the Old Kingdom loom lies on the ground, its
   *      warp and breast beams pegged down, the weavers squatting beside it)
   *      on the flat alluvium south-east of the brickyard --------------------- */
  {
    const linen: [number, number, number] = [0.86, 0.83, 0.74];
    const warp: [number, number, number] = [0.78, 0.74, 0.62];
    const y = low(160.5, 188, 9.5, 7) - 0.02;
    // a reed-mat shade over the north half
    for (const [du, dv] of [[-8.5, -6.2], [0, -6.2], [8.5, -6.2], [-8.5, -0.5], [0, -0.5], [8.5, -0.5]] as const) {
      box(wood, 160.5 + du, y, 188 + dv, 0.12, 2.3, 0.12, 0.72);
    }
    box(clay, 160.5, y + 2.3, 184.65, 17.4, 0.07, 6.4, 1.2);
    for (let k = 0; k < 3; k++) {
      const lu = 154.5 + k * 6;
      // each loom on its own highest ground, so the warp never dips into it
      const yk = Math.max(grd(lu - 0.8, 182.8), grd(lu + 0.8, 182.8), grd(lu, 186.3), grd(lu - 0.8, 189.8), grd(lu + 0.8, 189.8));
      // warp beam and breast beam, each held by two pegs
      for (const lv of [182.8, 189.8]) {
        box(wood, lu, yk + 0.02, lv, 1.7, 0.1, 0.12, 0.8);
        for (const s of [-0.95, 0.95]) box(wood, lu + s, yk - 0.15, lv, 0.07, 0.34, 0.07, 0.75);
      }
      // the stretched warp and the woven web at the breast-beam end
      const [wx0, wz0] = W(lu, 186.3);
      folk.box(wx0, yk + 0.08, wz0, 1.45, 0.012, 6.9, warp, YAW);
      const [wx1, wz1] = W(lu, 188.6);
      folk.box(wx1, yk + 0.09, wz1, 1.45, 0.02, 2.3, linen, YAW);
      for (const s of [-1, 1]) {
        const [px, pz] = W(lu + s * 1.25, 188.4 - (k % 2) * 0.8);
        person(folk, fr, px, y, pz, YAW + (s > 0 ? Math.PI : 0), 'squat', 1, [0.84, 0.81, 0.73]);
      }
    }
    // spinners standing at the open half, drop-spindles hanging
    for (let k = 0; k < 3; k++) {
      const [px, pz] = W(153 + k * 4.5, 193.2);
      person(folk, fr, px, y, pz, YAW - Math.PI / 2, 'stand', 1, [0.84, 0.81, 0.73]);
      const [sx, sz] = W(153 + k * 4.5 - 0.3, 193.2);
      folk.beam([sx, y + 0.95, sz], [sx, y + 0.55, sz], 0.012, [0.45, 0.35, 0.22]);
      folk.box(sx, y + 0.5, sz, 0.09, 0.05, 0.09, [0.45, 0.35, 0.22], YAW); // the whorl
    }
    // flax bundles and finished bolts on a mat
    box(clay, 167, y, 193, 2.4, 0.03, 1.6, 1.1);
    for (let k = 0; k < 3; k++) {
      const [bx, bz] = W(166.3 + k * 0.7, 193);
      folk.box(bx, y + 0.03, bz, 0.5, 0.22, 1.1, linen, YAW);
    }
    reg('weaving', 160.5, 188, 9.6, 7, y, y + 2.4);
  }

  /* --- (v1.2 I3) stone-carving shed on the pottery terrace (canon IV
   *      District 7 "Stone carving"): a seated statue roughed out of a
   *      block, a block half-dressed, chips, chisels and mallets ------------ */
  {
    const cu = -21;
    const cv = 112;
    const y = grd(cu, cv) - 0.02;
    // a lean-to over the back (north) third; the work lies open in front of
    // it in the sun, as carvers worked
    for (const du of [-5.6, 0, 5.6]) for (const dv of [-3.2, -0.6]) box(wood, cu + du, y, cv + dv, 0.14, 2.5, 0.14, 0.72);
    box(clay, cu, y + 2.5, cv - 1.9, 12, 0.08, 3.4, 1.2);
    box(mud, cu, y, cv - 3.3, 12, 1.6, 0.4, 0.56, 0.02); // its back wall
    // the seated statue, roughed out: plinth, body, the head still a block
    box(stone, cu - 2.5, y, cv, 1.4, 0.45, 1.1, 0.98);
    box(stone, cu - 2.6, y + 0.45, cv, 1.0, 0.95, 0.85, 1.02, 0.04);
    box(stone, cu - 2.85, y + 1.4, cv, 0.5, 0.55, 0.52, 1.0, 0.05);
    box(stone, cu - 2.15, y + 0.45, cv, 0.6, 0.5, 0.75, 0.96); // the lap and knees
    // a block half-dressed: the finished face smooth, the rest rough
    box(stone, cu + 2.4, y, cv - 0.6, 1.6, 1.0, 1.2, 0.97);
    box(stone, cu + 3.15, y, cv - 0.6, 0.2, 1.08, 1.32, 1.06, 0.02);
    for (let k = 0; k < 40; k++) {
      const u = cu + fr.range(-4.5, 4.5);
      const v = cv + fr.range(-2.8, 2.8);
      box(stone, u, grd(u, v) - 0.01, v, fr.range(0.06, 0.16), fr.range(0.03, 0.07), fr.range(0.05, 0.12), fr.range(0.92, 1.05), 0, fr.float() * Math.PI);
    }
    // carvers at work, tools on the ground beside them
    for (const [du, dv, a, pose] of [[-1.5, 0.9, Math.PI, 'squat'], [-2.6, -1.1, Math.PI / 2, 'kneel'], [1.4, -0.6, 0, 'kneel']] as const) {
      const [px, pz] = W(cu + du, cv + dv);
      person(folk, fr, px, y, pz, YAW + a, pose);
    }
    for (let k = 0; k < 4; k++) {
      const [tx2, tz2] = W(cu - 0.6 + k * 0.3, cv + 1.8);
      folk.box(tx2, y, tz2, 0.22, 0.03, 0.03, [0.55, 0.35, 0.2], YAW + k); // copper chisels
    }
    const [mx, mz] = W(cu + 0.8, cv + 1.6);
    folk.box(mx, y, mz, 0.16, 0.14, 0.16, [0.42, 0.31, 0.19], YAW); // wooden mallet
    reg('carving-shed', cu, cv, 6.2, 3.6, y, y + 2.6);
  }

  /* --- (v1.2 I3) the town's waste, kept and managed (canon VIII "Waste
   *      management": ash pits, broken-pottery dumps — "managed rather than
   *      randomly scattered"), out on the flat south of the quarter ---------- */
  {
    const au = 76;
    const av = 198;
    const y = grd(au, av) - 0.05;
    const [ax0, az0] = W(au, av);
    dark.drum(ax0, y, az0, 3.2, 0.06, 0.6, 0, 16); // the pit floor, burnt
    ash.drum(ax0, y + 0.05, az0, 2.8, 0.38, 1.0, 5.5, 16); // low ash, raked out
    ash.drum(ax0 + 0.6, y + 0.05, az0 - 0.4, 1.4, 0.55, 0.85, 2.0, 12); // the newest tip
    const su = 86;
    const sv = 199;
    const sy = grd(su, sv) - 0.05;
    const [sx0, sz0] = W(su, sv);
    mud.drum(sx0, sy, sz0, 2.4, 0.7, 0.62, 2.4, 16); // the earth core of the heap
    // the heap's skin: broken pottery lying on the slope, red-brown and buff
    for (let k = 0; k < 260; k++) {
      const a = fr.float() * Math.PI * 2;
      const r = Math.sqrt(fr.float()) * 3.4;
      const u = su + Math.cos(a) * r;
      const v = sv + Math.sin(a) * r;
      const h = r < 2.4 ? 0.7 * (1 - r / 2.4) : 0;
      const t = fr.chance(0.3) ? 1.2 : fr.range(0.82, 1.05);
      box(clay, u, sy + h - 0.02, v, fr.range(0.12, 0.3), fr.range(0.03, 0.06), fr.range(0.08, 0.22), t, 0, fr.float() * Math.PI);
    }
    reg('ash-pit', au, av, 3.2, 3.2, y, y + 0.8);
    reg('sherd-dump', su, sv, 2.6, 2.6, sy, sy + 1.0);
  }

  /* --- materialize ------------------------------------------------------------- */
  const meshes: Mesh[] = [
    new Mesh(mud.build(), limestoneMaterial([0.6, 0.48, 0.35], gi, 0.3, 0.45)),
    // laid-out bricks: grey-brown Nile mud, a running-bond brick grid on top
    new Mesh(bricks.build(), limestoneMaterial([0.42, 0.36, 0.29], gi, 0.3, 0.45, { rough: 0.9, paveW: 0.38 })),
    // dried and stacked: lighter, coursed every brick
    new Mesh(stacks.build(), limestoneMaterial([0.58, 0.48, 0.36], gi, 0.12, 0.36, { rough: 0.9 })),
    new Mesh(dark.build(), limestoneMaterial([0.13, 0.11, 0.1], gi, 0.5, 1.15, { rough: 0.95, spec: 0.2 })),
    new Mesh(clay.build(), limestoneMaterial([0.62, 0.45, 0.32], gi, 0.5, 1.15, { rough: 0.88 })),
    new Mesh(ore.build(), limestoneMaterial([0.22, 0.42, 0.33], gi, 0.5, 1.15, { rough: 0.8 })),
    new Mesh(wood.build(), limestoneMaterial([0.36, 0.27, 0.17], gi, 0.24, 0.32, { rough: 0.8 })),
    // (v1.2 I3) the carvers' fine limestone, and ash
    new Mesh(stone.build(), limestoneMaterial([0.8, 0.76, 0.66], gi, 0.5, 1.15, { rough: 0.7 })),
    new Mesh(ash.build(), limestoneMaterial([0.44, 0.42, 0.39], gi, 0.5, 1.15, { rough: 0.95, spec: 0.15 })),
  ];
  for (const m of meshes) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'industry';
    scene.add(m);
  }
  addTownsfolk(scene, folk, gi, 'industry-folk');
  return pieces;
}
