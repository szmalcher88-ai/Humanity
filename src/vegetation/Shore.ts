/**
 * Shoreline + tree vegetation (Phase 5 remainder, canon Zone B):
 *
 *   PAPYRUS  — tall umbel-headed clumps standing IN the shallows
 *   REED     — arcing blade clumps with seed plumes on the wet margin
 *   SYCAMORE — broad dense-crowned floodplain tree (fig shade tree)
 *   TAMARISK — feathery grey-green small tree of the desert margin
 *
 * Same per-variant instanced-slice pattern as Palms (instanceIndex restarts
 * per InstancedMesh — never share instance buffers across variants). All
 * placement rejection-samples the CPU height mirror against the waterline:
 * papyrus wants bed slightly BELOW water, reeds the first half-meter above,
 * trees the damp plain. No fixed positions — the shoreline finds itself.
 */

import {
  BufferAttribute,
  BufferGeometry,
  InstancedMesh,
  type Object3D,
} from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  attribute,
  clamp,
  cos,
  float,
  instancedArray,
  instanceIndex,
  mix,
  normalLocal,
  positionLocal,
  sin,
  transformNormalToView,
  varying,
  vec3,
} from 'three/tsl';
import type { Rng, WorldSeed } from '../core/Seed';
import type { Heightfield } from '../world/Heightfield';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { giLightMap } from '../monuments/PyramidBuilder';
import type { NF, NV3 } from '../gpu/TSLTypes';
import { uWorldTime } from '../render/WorldClock';
import { attachCulling, cellSortVec4, geoBounds } from '../render/InstanceCull';
import { NILE_WATER_Y, WIND_X, WIND_Z } from '../world/WorldConst';
import { harborWorksRects } from '../water/Vessels';
import { clearOfWorks } from './Clearings';

const CLUMP_TARGET = { safe: 900, low: 2600, high: 7000, ultra: 8500 } as const;
const TREE_TARGET = { safe: 60, low: 150, high: 380, ultra: 460 } as const;
const VARIANTS = 4;

type Tone = [number, number, number];

/* ------------------------------------------------------------------ */
/* geometry growers (kind attribute: 0 = stem/trunk, 1 = foliage)       */
/* ------------------------------------------------------------------ */

class Grow {
  pos: number[] = [];
  kind: number[] = [];
  quad(
    a: [number, number, number], b: [number, number, number],
    c: [number, number, number], d: [number, number, number], k: number,
  ): void {
    this.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) this.kind.push(k);
  }
  /** thin tapered blade from p0 along dir, drooping */
  blade(
    x: number, y: number, z: number,
    az: number, elev: number, len: number, w0: number, droop: number, k: number,
    segs = 3,
  ): void {
    const ca = Math.cos(az);
    const sa = Math.sin(az);
    let px = x;
    let py = y;
    let pz = z;
    let ang = elev;
    let w = w0;
    for (let s = 0; s < segs; s++) {
      const st = len / segs;
      const nx = px + Math.cos(ang) * st * ca;
      const ny = py + Math.sin(ang) * st;
      const nz = pz + Math.cos(ang) * st * sa;
      const wx = -sa * w;
      const wz = ca * w;
      this.quad(
        [px - wx, py, pz - wz], [px + wx, py, pz + wz],
        [nx + wx, ny, nz + wz], [nx - wx, ny, nz - wz], k,
      );
      px = nx; py = ny; pz = nz;
      ang -= droop / segs;
      w *= 0.72;
    }
  }
  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('kind', new BufferAttribute(new Float32Array(this.kind), 1));
    g.computeVertexNormals();
    return g;
  }
}

function papyrusGeometry(rng: Rng): BufferGeometry {
  const g = new Grow();
  const stems = Math.round(rng.range(8, 13));
  for (let i = 0; i < stems; i++) {
    const az = rng.float() * Math.PI * 2;
    const r = rng.range(0, 0.3);
    const bx = Math.cos(az) * r;
    const bz = Math.sin(az) * r;
    const h = rng.range(2.3, 4.1);
    const leanAz = rng.float() * Math.PI * 2;
    const lean = rng.range(0.02, 0.16);
    const tx = bx + Math.cos(leanAz) * lean * h;
    const tz = bz + Math.sin(leanAz) * lean * h;
    // stem: two crossed tapered quads
    for (const a of [leanAz, leanAz + Math.PI / 2]) {
      const wx = -Math.sin(a) * 0.045;
      const wz = Math.cos(a) * 0.045;
      g.quad(
        [bx - wx, 0, bz - wz], [bx + wx, 0, bz + wz],
        [tx + wx * 0.5, h, tz + wz * 0.5], [tx - wx * 0.5, h, tz - wz * 0.5], 0,
      );
    }
    // umbel: radiating ray quads, drooping
    const rays = Math.round(rng.range(7, 10));
    for (let u = 0; u < rays; u++) {
      const ua = (u / rays) * Math.PI * 2 + rng.range(-0.2, 0.2);
      g.blade(tx, h, tz, ua, rng.range(0.5, 0.9), rng.range(0.34, 0.52), 0.05, 2.6, 1, 2);
    }
  }
  return g.build();
}

function reedGeometry(rng: Rng): BufferGeometry {
  const g = new Grow();
  const blades = Math.round(rng.range(14, 22));
  for (let i = 0; i < blades; i++) {
    const az = rng.float() * Math.PI * 2;
    const r = rng.range(0, 0.34);
    g.blade(
      Math.cos(az) * r, 0, Math.sin(az) * r,
      rng.float() * Math.PI * 2, rng.range(1.05, 1.35),
      rng.range(1.1, 2.0), 0.04, rng.range(0.5, 1.0), 1,
    );
  }
  // seed plumes: straight stalks with a pale head
  const plumes = Math.round(rng.range(3, 6));
  for (let i = 0; i < plumes; i++) {
    const az = rng.float() * Math.PI * 2;
    const r = rng.range(0, 0.22);
    const bx = Math.cos(az) * r;
    const bz = Math.sin(az) * r;
    const h = rng.range(1.7, 2.4);
    const wx = 0.02;
    g.quad([bx - wx, 0, bz], [bx + wx, 0, bz], [bx + wx, h, bz], [bx - wx, h, bz], 1);
    g.blade(bx, h, bz, rng.float() * Math.PI * 2, 1.2, 0.3, 0.06, 1.8, 0, 2);
  }
  return g.build();
}

/** `density` > 1 closes the crown (v1.2 I4: pruned orchard figs read as
 *  hollow rings from above at the wild trees' leaf count); the default
 *  path draws exactly as before */
export function sycamoreGeometry(rng: Rng, density = 1): BufferGeometry {
  const g = new Grow();
  const trunkH = rng.range(2.0, 3.0);
  const R = 0.36;
  // stout trunk: crossed tapered quads (silhouette-cheap)
  for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    const wx = -Math.sin(a) * R;
    const wz = Math.cos(a) * R;
    g.quad(
      [-wx, 0, -wz], [wx, 0, wz],
      [wx * 0.55, trunkH, wz * 0.55], [-wx * 0.55, trunkH, -wz * 0.55], 0,
    );
  }
  const crx = rng.range(3.4, 5.2); // crown radii
  const cry = rng.range(1.9, 2.8);
  const cy = trunkH + cry * 0.55;
  // main limbs reaching into the crown
  const limbs = Math.round(rng.range(5, 7));
  for (let i = 0; i < limbs; i++) {
    const az = (i / limbs) * Math.PI * 2 + rng.range(-0.3, 0.3);
    g.blade(0, trunkH * 0.85, 0, az, rng.range(0.5, 0.9), crx * 0.62, 0.13, 0.5, 0, 2);
  }
  // (2026-10-27) the crown as a CLUSTER of overlapping leaf masses, filled
  // through their volume: the old single shell of tangent cards read as a
  // hollow ring of squares from the side (the human's screenshot). Cards at
  // the core are darker (kind 0.82: the shade inside a crown)
  const lobes: [number, number, number, number, number][] = [[0, cy + cry * 0.25, 0, crx * 0.62, cry * 0.75]];
  const nL = Math.round(rng.range(4, 6));
  for (let l = 0; l < nL; l++) {
    const a = (l / nL) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const d = rng.range(0.35, 0.6) * crx;
    lobes.push([Math.cos(a) * d, cy + rng.range(-0.25, 0.3) * cry, Math.sin(a) * d, rng.range(0.48, 0.66) * crx, rng.range(0.55, 0.8) * cry]);
  }
  const N = Math.round(rng.range(46, 62) * density * 1.7);
  for (let i = 0; i < N; i++) {
    const [lx, ly, lz, rx, ry] = lobes[i % lobes.length] as [number, number, number, number, number];
    const u = rng.float() * Math.PI * 2;
    const cv = rng.range(-0.6, 1); // bias upward — the underside is in shade
    const sv = Math.sqrt(1 - cv * cv);
    const dx = sv * Math.cos(u);
    const dy = cv;
    const dz = sv * Math.sin(u);
    const r = 0.35 + 0.65 * Math.sqrt(rng.float()); // through the volume, denser outside
    const px = lx + dx * rx * r;
    const py = ly + dy * ry * r;
    const pz = lz + dz * rx * r;
    const s = rng.range(0.5, 0.9) * (density > 1 ? 1.1 : 1);
    // a card facing out of its lobe, turned about that normal at random
    let tx = -dz;
    let tz = dx;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const bx = dy * tz;
    const by = dz * tx - dx * tz;
    const bz = -dy * tx;
    const ro = rng.float() * Math.PI;
    const c = Math.cos(ro) * s;
    const sn = Math.sin(ro) * s;
    const ax = tx * c + bx * sn;
    const ay = by * sn;
    const az = tz * c + bz * sn;
    const ex = -tx * sn + bx * c;
    const ey = by * c;
    const ez = -tz * sn + bz * c;
    g.quad(
      [px - ax - ex, py - ay - ey, pz - az - ez],
      [px + ax - ex, py + ay - ey, pz + az - ez],
      [px + ax + ex, py + ay + ey, pz + az + ez],
      [px - ax + ex, py - ay + ey, pz - az + ez], r < 0.62 ? 0.82 : 1,
    );
  }
  return g.build();
}

function tamariskGeometry(rng: Rng): BufferGeometry {
  const g = new Grow();
  const stems = Math.round(rng.range(2, 4));
  const H = rng.range(2.6, 4.2);
  for (let i = 0; i < stems; i++) {
    const az = rng.float() * Math.PI * 2;
    const r = rng.range(0, 0.25);
    g.blade(
      Math.cos(az) * r, 0, Math.sin(az) * r,
      az, rng.range(1.1, 1.4), H * rng.range(0.7, 1.0), 0.07, 0.35, 0, 2,
    );
  }
  // feathery crown puffs on the upper hemisphere
  const R = rng.range(1.5, 2.3);
  const N = Math.round(rng.range(26, 36));
  for (let i = 0; i < N; i++) {
    const u = rng.float() * Math.PI * 2;
    const v = Math.acos(rng.range(0.05, 1));
    // (2026-10-27) through the volume, not on the hemisphere's shell
    const rr = R * (0.35 + 0.65 * Math.sqrt(rng.float()));
    const px = Math.sin(v) * Math.cos(u) * rr;
    const py = Math.cos(v) * rr * 0.8 + H * 0.72;
    const pz = Math.sin(v) * Math.sin(u) * rr;
    const s = rng.range(0.4, 0.75);
    const tx = -Math.sin(u) * s;
    const tz = Math.cos(u) * s;
    g.quad(
      [px - tx, py - s * 0.5, pz - tz], [px + tx, py - s * 0.5, pz + tz],
      [px + tx, py + s * 0.5, pz + tz], [px - tx, py + s * 0.5, pz - tz], 1,
    );
  }
  return g.build();
}

/* ------------------------------------------------------------------ */
/* instanced spawner (palms' per-variant slice pattern)                 */
/* ------------------------------------------------------------------ */

export interface ClassSpec {
  name: string;
  grow: (rng: Rng) => BufferGeometry;
  stemTone: Tone;
  leafTone: Tone;
  /** placement filter on terrain height */
  fit: (y: number) => boolean;
  scale: [number, number];
  giLift: number;
  /** wind sway shear at ~2 m height (reeds flutter, trees barely move) */
  sway: number;
}

export function spawnClass(
  scene: Object3D,
  rng: Rng,
  spots: [number, number, number][],
  spec: ClassSpec,
  gi: ProbeGI | null,
  cull: boolean,
  keep?: (x: number, z: number) => boolean,
): number {
  const n = spots.length;
  if (n === 0) return 0;
  const per = Math.ceil(n / VARIANTS);
  let total = 0;
  for (let v = 0; v < VARIANTS; v++) {
    const drawn = Math.min(per, n - v * per);
    if (drawn <= 0) break;
    // (2026-10-27) `keep` drops a spot after its values are drawn: the
    // instances that stay keep their yaw, lean and size
    let count = 0;
    let data = new Float32Array(drawn * 4);
    let dataB = new Float32Array(drawn * 4);
    for (let i = 0; i < drawn; i++) {
      const s = spots[v * per + i] as [number, number, number];
      const yaw = rng.float() * Math.PI * 2;
      const lx = rng.range(-0.05, 0.05);
      const lz = rng.range(-0.05, 0.05);
      const tone = rng.range(0.82, 1.12);
      const sc = rng.range(spec.scale[0], spec.scale[1]);
      if (keep && !keep(s[0], s[1])) continue;
      data.set([s[0], s[2] - 0.1, s[1], yaw], count * 4);
      dataB.set([lx, lz, tone, sc], count * 4);
      count++;
    }
    if (count === 0) {
      rng.fork(`${spec.name}-${v}`); // the fork consumes a parent draw: keep it
      continue;
    }
    if (count < drawn) {
      data = data.slice(0, count * 4);
      dataB = dataB.slice(0, count * 4);
    }
    const cells = cull ? cellSortVec4(count, [data, dataB], 160, 45) : [];
    const bufA = instancedArray(data, 'vec4');
    const bufB = instancedArray(dataB, 'vec4');

    const mat = new MeshPhysicalNodeMaterial();
    mat.specularIntensity = 0.2;
    const A = bufA.element(instanceIndex);
    const B = bufB.element(instanceIndex);
    const yaw = A.w;
    const scale = B.w;
    const cy = cos(yaw);
    const sy = sin(yaw);
    const lp = positionLocal.mul(scale);
    const rx = lp.x.mul(cy).sub(lp.z.mul(sy));
    const rz = lp.x.mul(sy).add(lp.z.mul(cy));
    // wind sway (Phase-6 motion): height-squared downwind shear, gusty
    const ph = A.x.mul(0.41).add(A.z.mul(0.59));
    const gust = sin(uWorldTime.mul(1.1).add(ph))
      .mul(0.55)
      .add(sin(uWorldTime.mul(2.7).add(ph.mul(2.1))).mul(0.45));
    const hh = lp.y.mul(0.5);
    const sway = gust.mul(hh.mul(hh)).mul(spec.sway);
    const wpos = vec3(
      A.x.add(rx).add(B.x.mul(lp.y)).add(sway.mul(WIND_X)),
      A.y.add(lp.y),
      A.z.add(rz).add(B.y.mul(lp.y)).add(sway.mul(WIND_Z)),
    );
    mat.positionNode = wpos;
    const nl = normalLocal;
    const rnx = nl.x.mul(cy).sub(nl.z.mul(sy));
    const rnz = nl.x.mul(sy).add(nl.z.mul(cy));
    const nWorld = varying(vec3(rnx, nl.y, rnz)) as unknown as NV3;
    mat.normalNode = transformNormalToView(nWorld);

    const kind = attribute('kind', 'float') as unknown as NF;
    const tone = varying(B.z) as unknown as NF;
    mat.colorNode = mix(vec3(...spec.stemTone), vec3(...spec.leafTone), clamp(kind, 0, 1)).mul(tone);
    mat.roughnessNode = mix(float(0.8), float(0.62), kind);
    mat.metalnessNode = float(0);
    mat.side = 2;
    giLightMap(mat, gi, nWorld, spec.giLift);

    const geo = spec.grow(rng.fork(`${spec.name}-${v}`));
    const mesh = new InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `${spec.name}-${v}`;
    scene.add(mesh);
    if (cull) {
      // exact pads from the grown geometry × the largest instance scale
      const bb = geoBounds(geo, spec.scale[1]);
      attachCulling(mesh, cells, {
        name: 'shore',
        padXZ: bb.rad + 0.5,
        padY: bb.top + 0.5,
        casts: true,
      });
    }
    total += count;
  }
  return total;
}

/* ------------------------------------------------------------------ */
/* placement + entry                                                    */
/* ------------------------------------------------------------------ */

export interface ShoreCounts {
  clumps: number;
  trees: number;
  /** reed-bed spots (x, z, ground y) — reed-cutting sites are drawn from them */
  reedSpots: [number, number, number][];
}

export function buildShore(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
  preset: 'safe' | 'low' | 'high' | 'ultra' = 'high',
  cull = true,
): ShoreCounts {
  const rng = seed.rng('shore');
  const W = NILE_WATER_Y;

  const classes: ClassSpec[] = [
    {
      name: 'papyrus',
      grow: papyrusGeometry,
      stemTone: [0.23, 0.36, 0.14],
      leafTone: [0.3, 0.44, 0.17],
      fit: (y) => y > W - 0.4 && y < W + 0.12, // standing in the shallows
      scale: [0.75, 1.25],
      giLift: 1.2,
      sway: 0.13,
    },
    {
      name: 'reed',
      grow: reedGeometry,
      stemTone: [0.5, 0.46, 0.3],
      leafTone: [0.33, 0.42, 0.19],
      fit: (y) => y > W + 0.02 && y < W + 0.6, // the first dry half-meter
      scale: [0.7, 1.3],
      giLift: 1.2,
      sway: 0.16,
    },
  ];

  // shoreline sampling regions: river strip + harbor/approach + basin rim
  const regions: [number, number, number, number, number][] = [
    // x0, x1, z0, z1, weight
    [1520, 2440, -1780, 2180, 0.62],
    [850, 1850, -420, 160, 0.38],
  ];
  const clumpTarget = CLUMP_TARGET[preset];
  const clumpSpots: [number, number, number][][] = [[], []];
  const reedSpots: [number, number, number][] = [];
  let tries = 0;
  let placed = 0;
  while (placed < clumpTarget && tries < clumpTarget * 60) {
    tries++;
    const reg = (rng.float() < 0.62 ? regions[0] : regions[1]) as
      [number, number, number, number, number];
    const x = rng.range(reg[0], reg[1]);
    const z = rng.range(reg[2], reg[3]);
    const y = hf.heightAtCpu(x, z);
    for (let c = 0; c < classes.length; c++) {
      if ((classes[c] as ClassSpec).fit(y)) {
        (clumpSpots[c] as [number, number, number][]).push([x, z, Math.max(y, W - 0.15)]);
        if (c === 1) reedSpots.push([x, z, y]);
        placed++;
        break;
      }
    }
  }

  // (v1.2 I6) no reed or papyrus rooted inside a landing, stage, ramp or
  // (2026-10-27) pier: dropped after the sampling loop, so the trees' draws
  // below stay put. The test grows each rect by a clump's reach (≈ 2.5 m —
  // a root just outside a deck still leaned its leaves over it)
  const REACH = 2.5;
  for (let c = 0; c < classes.length; c++) {
    clumpSpots[c] = (clumpSpots[c] as [number, number, number][]).filter(
      ([x, z]) => !harborWorksRects.some((r) => x > r.x0 - REACH && x < r.x1 + REACH && z > r.z0 - REACH && z < r.z1 + REACH),
    );
  }

  let clumps = 0;
  for (let c = 0; c < classes.length; c++) {
    clumps += spawnClass(
      scene, rng.fork(`class-${c}`),
      clumpSpots[c] as [number, number, number][],
      classes[c] as ClassSpec, gi, cull,
    );
  }

  /* --- trees: sycamore on the damp plain, tamarisk on the dry margin ------- */
  const treeTarget = TREE_TARGET[preset];
  const sycSpots: [number, number, number][] = [];
  const tamSpots: [number, number, number][] = [];
  tries = 0;
  while (sycSpots.length + tamSpots.length < treeTarget && tries < treeTarget * 80) {
    tries++;
    const x = rng.range(1050, 2350);
    const z = rng.range(-1650, 2250);
    // keep clear of the future worker-town works zone (Phase 6)
    if (x > 300 && x < 900 && z > 600 && z < 1100) continue;
    const y = hf.heightAtCpu(x, z);
    if (y > W + 0.4 && y < W + 2.6 && rng.chance(0.42)) {
      sycSpots.push([x, z, y]); // damp floodplain: shade trees
    } else if (y > W + 1.8 && y < W + 5.5) {
      tamSpots.push([x, z, y]); // drier margin: tamarisk scrub
    }
  }
  let trees = 0;
  const clear = clearOfWorks(3);
  trees += spawnClass(scene, rng.fork('sycamore'), sycSpots, {
    name: 'sycamore',
    grow: sycamoreGeometry,
    stemTone: [0.34, 0.26, 0.17],
    leafTone: [0.15, 0.25, 0.1],
    fit: () => true,
    scale: [0.8, 1.35],
    giLift: 1.6,
    sway: 0.025,
  }, gi, cull, clear);
  trees += spawnClass(scene, rng.fork('tamarisk'), tamSpots, {
    name: 'tamarisk',
    grow: tamariskGeometry,
    stemTone: [0.36, 0.3, 0.22],
    leafTone: [0.32, 0.37, 0.25],
    fit: () => true,
    scale: [0.7, 1.3],
    giLift: 1.4,
    sway: 0.06,
  }, gi, cull, clear);

  return { clumps, trees, reedSpots };
}
