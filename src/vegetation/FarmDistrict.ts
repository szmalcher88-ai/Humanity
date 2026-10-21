/**
 * Farmsteads in the agricultural belt (v1.1 detail pass) — canon Vol. IV
 * District 10: "farmhouses, animal enclosures, irrigation basins … farm
 * activity changes seasonally". The belt was 754 crop parcels and nothing
 * else: no one lived in it. At late peret (D-2) the harvest is coming in,
 * so each farmstead shows a THRESHING FLOOR at work.
 *
 * Farmsteads take a share of the FALLOW parcels Fields already leaves bare
 * (a farmstead on standing crop would trample its own field): a mudbrick
 * house and yard with two small beehive granaries, a round threshing floor
 * with grain and straw heaps, and a pen with cattle (who also did the
 * threshing — driven round the floor). Every piece is grounded on the CPU
 * height mirror, built only on dry ground, and registers a footprint so the
 * inhabitants' obstacle field and the audit see it.
 */

import { Mesh, type Object3D } from 'three';
import type { WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { Heightfield } from '../world/Heightfield';
import { NILE_WATER_Y } from '../world/WorldConst';
import { fpReg } from '../debug/Footprints';
import { GeoWriter, limestoneMaterial } from '../monuments/KhufuComplex';
import type { Parcel } from './Fields';

const FAMILY = 'farms';

export interface FarmInfo {
  farms: number;
  cattle: number;
  /** threshing-floor centres — Inhabitants puts the threshers there */
  floors: [number, number][];
  /** (v1.2 I4) the parcel each farmstead stands on — its garden and
   *  orchard take the free south part (Orchards.ts) */
  parcels: Parcel[];
}

export function buildFarmsteads(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
  fallow: readonly Parcel[],
  maxFarms = 14,
): FarmInfo {
  const rng = seed.rng('farmsteads');
  const grd = (x: number, z: number): number => hf.heightAtCpu(x, z);
  const mud = new GeoWriter();
  const earth = new GeoWriter(); // packed threshing floors
  const grain = new GeoWriter();
  const beasts = new GeoWriter();
  const info: FarmInfo = { farms: 0, cattle: 0, floors: [], parcels: [] };

  const lowAt = (x: number, z: number, hx: number, hz: number): number =>
    Math.min(grd(x - hx, z - hz), grd(x + hx, z - hz), grd(x + hx, z + hz), grd(x - hx, z + hz));
  const dryAt = (x: number, z: number, hx: number, hz: number): boolean =>
    lowAt(x, z, hx, hz) > NILE_WATER_Y + 0.6;
  /** round work of diameter d — a true drum (v1.2: crossed boxes made
   *  star-shaped threshing floors and granaries) */
  const octo = (w: GeoWriter, x: number, y: number, z: number, d: number, h: number, tone: number, b = 0): void => {
    w.drum(x, y, z, d / 2, h, tone, b, d > 4 ? 20 : 12);
  };
  const ox = (x: number, z: number, yaw: number): void => {
    const y = grd(x, z);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    beasts.box(x, y + 0.72, z, 2.0, 0.78, 0.78, rng.range(0.45, 0.62), 0.02, yaw);
    for (const [lf, ls] of [[0.7, 0.3], [0.7, -0.3], [-0.7, 0.3], [-0.7, -0.3]] as const) {
      beasts.box(x + c * lf - s * ls, y, z + s * lf + c * ls, 0.16, 0.74, 0.16, 0.4, 0, yaw);
    }
    const hx = x + c * 1.15;
    const hz = z + s * 1.15;
    beasts.box(hx, y + 0.95, hz, 0.62, 0.42, 0.4, 0.44, 0.05, yaw);
    for (const s2 of [-0.22, 0.22]) beasts.box(hx - s * s2, y + 1.34, hz + c * s2, 0.1, 0.3, 0.1, 0.6, 0.15, yaw);
    info.cattle++;
  };

  // spread the farmsteads along the belt: take every k-th fallow parcel
  const step = Math.max(1, Math.floor(fallow.length / maxFarms));
  for (let i = 0; i < fallow.length && info.farms < maxFarms; i += step) {
    const p = fallow[i];
    if (!p) continue;
    // compound in the parcel's north-west quarter, floor and pen beside it
    const hx0 = p.x0 + 12;
    const hz0 = p.z0 + 10;
    if (!dryAt(p.x0 + p.w / 2, p.z0 + p.d / 2, Math.min(p.w, 40) / 2, Math.min(p.d, 34) / 2)) continue;

    /* house + yard */
    {
      const y = lowAt(hx0, hz0, 7, 6) - 0.3;
      // house: two rooms under one roof, a doorway to the yard
      mud.box(hx0, y, hz0 - 2.2, 7.2, 2.9, 4.6, rng.range(0.52, 0.6), 0.025);
      mud.box(hx0, y + 2.9, hz0 - 2.2, 7.6, 0.16, 5.0, 0.66); // roof
      mud.box(hx0 + 1.2, y + 0.3, hz0 + 0.06, 0.9, 1.75, 0.08, 0.12); // door
      // low yard wall with a gate gap on the east
      mud.box(hx0, y, hz0 + 5.6, 14, 1.4, 0.45, 0.56, 0.03);
      mud.box(hx0 - 7, y, hz0 + 1.4, 0.45, 1.4, 8.8, 0.56, 0.03);
      mud.box(hx0 + 7, y, hz0 + 3.6, 0.45, 1.4, 4.4, 0.56, 0.03);
      // two beehive granaries in the yard
      for (const gx of [hx0 - 4, hx0 - 1.2]) {
        const gy = grd(gx, hz0 + 3.2) - 0.15;
        octo(mud, gx, gy, hz0 + 3.2, 2.3, 1.7, 0.72, 0.06);
        octo(mud, gx, gy + 1.65, hz0 + 3.2, 1.5, 0.8, 0.74, 0.14);
      }
      // the compound runs from the roof's north eave (hz0-4.7) to the yard's
      // south wall (hz0+5.83) — v1.2: the box started 2 m south of the house
      fpReg({
        id: `farm:${info.farms}:house`, family: FAMILY, x: hx0, z: hz0 + 0.57, hx: 7.3, hz: 5.3,
        y0: y, y1: y + 3.1, ground: 'grounded',
      });
    }

    /* threshing floor: packed earth, grain heap, straw heap */
    {
      const fx = hx0 + 19;
      const fz = hz0 + 2;
      if (dryAt(fx, fz, 5, 5)) {
        const y = lowAt(fx, fz, 4.6, 4.6) - 0.02;
        octo(earth, fx, y, fz, 9.4, 0.1, rng.range(0.95, 1.05));
        // the crop spread on the floor, the winnowed grain, the straw
        octo(grain, fx, y + 0.08, fz, 6.4, 0.07, 1.05);
        grain.box(fx + 3.6, y, fz - 3.4, 2.0, 0.85, 1.8, 0.92, 0.42); // grain
        grain.box(fx - 4.2, y, fz + 3.2, 3.2, 1.5, 2.6, 1.22, 0.38); // straw
        info.floors.push([fx, fz]);
        const fid = `farm:${info.farms}`;
        // piles and cattle are solid to the threshers' obstacle field (v1.2)
        fpReg({ id: `${fid}:grain`, family: FAMILY, x: fx + 3.6, z: fz - 3.4, hx: 1.0, hz: 0.9, y0: y, y1: y + 0.85, ground: 'grounded' });
        fpReg({ id: `${fid}:straw`, family: FAMILY, x: fx - 4.2, z: fz + 3.2, hx: 1.6, hz: 1.3, y0: y, y1: y + 1.5, ground: 'grounded' });
        // the cattle that tread it out, driven round the floor
        for (let k = 0; k < 2; k++) {
          const a = rng.float() * Math.PI * 2;
          const ox0 = fx + Math.cos(a) * 2.2;
          const oz0 = fz + Math.sin(a) * 2.2;
          ox(ox0, oz0, a + Math.PI / 2);
          fpReg({
            id: `${fid}:ox${k}`, family: FAMILY, x: ox0 + Math.cos(a + Math.PI / 2) * 0.2, z: oz0 + Math.sin(a + Math.PI / 2) * 0.2,
            hx: 1.5, hz: 0.42, yaw: a + Math.PI / 2, y0: grd(ox0, oz0), y1: grd(ox0, oz0) + 1.4, ground: 'grounded',
          });
        }
        fpReg({
          id: `farm:${info.farms}:floor`, family: FAMILY, x: fx, z: fz, hx: 4.7, hz: 4.7,
          y0: y, y1: y + 0.2, ground: 'none', passive: true,
        });
      }
    }

    /* cattle pen */
    {
      const px = hx0 + 2;
      const pz = hz0 + 16;
      if (dryAt(px, pz, 6, 5)) {
        const y = lowAt(px, pz, 5.5, 4.5) - 0.2;
        mud.box(px, y, pz - 4.5, 11, 1.2, 0.4, 0.55, 0.04);
        mud.box(px, y, pz + 4.5, 11, 1.2, 0.4, 0.55, 0.04);
        mud.box(px - 5.5, y, pz, 0.4, 1.2, 9, 0.55, 0.04);
        mud.box(px + 5.5, y, pz + 1.8, 0.4, 1.2, 5.4, 0.55, 0.04);
        const n = 2 + rng.int(3);
        for (let k = 0; k < n; k++) {
          ox(px - 3 + rng.float() * 6, pz - 2.5 + rng.float() * 5, rng.float() * Math.PI * 2);
        }
        fpReg({
          id: `farm:${info.farms}:pen`, family: FAMILY, x: px, z: pz, hx: 5.7, hz: 4.7,
          y0: y, y1: y + 1.3, ground: 'grounded',
        });
      }
    }
    info.parcels.push(p);
    info.farms++;
  }

  const meshes = [
    new Mesh(mud.build(), limestoneMaterial([0.56, 0.46, 0.34], gi, 0.3, 0.45)),
    // threshing floors: beaten silt, lighter and smoother than the plain
    new Mesh(earth.build(), limestoneMaterial([0.6, 0.53, 0.42], gi, 0.5, 1.15, { rough: 0.95 })),
    // ripe emmer and its straw: the gold of late peret
    new Mesh(grain.build(), limestoneMaterial([0.72, 0.6, 0.33], gi, 0.5, 1.15, { rough: 0.92 })),
    new Mesh(beasts.build(), limestoneMaterial([0.42, 0.3, 0.2], gi, 0.5, 1.15, { rough: 0.85 })),
  ];
  for (const m of meshes) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'farms';
    scene.add(m);
  }
  return info;
}
