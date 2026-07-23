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
import { NILE_WATER_Y, WIND_X, WIND_Z } from '../world/WorldConst';

const CLUMP_TARGET = { low: 2600, high: 7000, ultra: 8500 } as const;
const TREE_TARGET = { low: 150, high: 380, ultra: 460 } as const;
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

function sycamoreGeometry(rng: Rng): BufferGeometry {
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
  // dense crown shell: tangent leaf-cluster quads on the ellipsoid
  const N = Math.round(rng.range(46, 62));
  for (let i = 0; i < N; i++) {
    const u = rng.float() * Math.PI * 2;
    const v = Math.acos(rng.range(-0.55, 1)); // bias upward — flat shaded base
    const px = Math.sin(v) * Math.cos(u) * crx;
    const py = Math.cos(v) * cry + cy;
    const pz = Math.sin(v) * Math.sin(u) * crx;
    const s = rng.range(0.55, 0.95);
    // tangent basis (approx): azimuthal + polar directions
    const tx = -Math.sin(u) * s;
    const tz = Math.cos(u) * s;
    const bx2 = Math.cos(v) * Math.cos(u) * s;
    const by2 = -Math.sin(v) * (cry / crx) * s;
    const bz2 = Math.cos(v) * Math.sin(u) * s;
    g.quad(
      [px - tx - bx2, py - by2, pz - tz - bz2],
      [px + tx - bx2, py - by2, pz + tz - bz2],
      [px + tx + bx2, py + by2, pz + tz + bz2],
      [px - tx + bx2, py + by2, pz - tz + bz2], 1,
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
    const px = Math.sin(v) * Math.cos(u) * R;
    const py = Math.cos(v) * R * 0.8 + H * 0.72;
    const pz = Math.sin(v) * Math.sin(u) * R;
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

interface ClassSpec {
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

function spawnClass(
  scene: Object3D,
  rng: Rng,
  spots: [number, number, number][],
  spec: ClassSpec,
  gi: ProbeGI | null,
): number {
  const n = spots.length;
  if (n === 0) return 0;
  const per = Math.ceil(n / VARIANTS);
  let total = 0;
  for (let v = 0; v < VARIANTS; v++) {
    const count = Math.min(per, n - v * per);
    if (count <= 0) break;
    const data = new Float32Array(count * 4);
    const dataB = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const s = spots[v * per + i] as [number, number, number];
      data[i * 4 + 0] = s[0];
      data[i * 4 + 1] = s[2] - 0.1;
      data[i * 4 + 2] = s[1];
      data[i * 4 + 3] = rng.float() * Math.PI * 2;
      dataB[i * 4 + 0] = rng.range(-0.05, 0.05);
      dataB[i * 4 + 1] = rng.range(-0.05, 0.05);
      dataB[i * 4 + 2] = rng.range(0.82, 1.12);
      dataB[i * 4 + 3] = rng.range(spec.scale[0], spec.scale[1]);
    }
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
    scene.add(mesh);
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
}

export function buildShore(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
  preset: 'low' | 'high' | 'ultra' = 'high',
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
        placed++;
        break;
      }
    }
  }

  let clumps = 0;
  for (let c = 0; c < classes.length; c++) {
    clumps += spawnClass(
      scene, rng.fork(`class-${c}`),
      clumpSpots[c] as [number, number, number][],
      classes[c] as ClassSpec, gi,
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
  trees += spawnClass(scene, rng.fork('sycamore'), sycSpots, {
    name: 'sycamore',
    grow: sycamoreGeometry,
    stemTone: [0.34, 0.26, 0.17],
    leafTone: [0.15, 0.25, 0.1],
    fit: () => true,
    scale: [0.8, 1.35],
    giLift: 1.6,
    sway: 0.025,
  }, gi);
  trees += spawnClass(scene, rng.fork('tamarisk'), tamSpots, {
    name: 'tamarisk',
    grow: tamariskGeometry,
    stemTone: [0.36, 0.3, 0.22],
    leafTone: [0.32, 0.37, 0.25],
    fit: () => true,
    scale: [0.7, 1.3],
    giLift: 1.4,
    sway: 0.06,
  }, gi);

  return { clumps, trees };
}
