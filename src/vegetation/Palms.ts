/**
 * Date palms (Phase 5) — fully procedural, per-instance uniqueness
 * (brief §2 floor: ≥5k with growth-seed lean, crown asymmetry, frond
 * count). K base variants share geometry; every INSTANCE gets lean axis/
 * angle, yaw, scale and tone from a GPU-read buffer — no clones law.
 *
 * Placement: groves hug the water table — river banks, harbor rim, canal
 * lines and the wet floodplain, thinning inland (canon Zone B).
 */

import {
  BufferAttribute,
  BufferGeometry,
  InstancedMesh,
  Vector2,
  type Scene,
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

const VARIANTS = 8;
const TARGET = { low: 2400, high: 5400, ultra: 6500 } as const;

/** one palm variant: trunk + frond crown, grown from a seed */
function palmGeometry(rng: Rng): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = []; // r: 0 = trunk, 1 = frond (material tints)
  const H = rng.range(6.5, 11);
  const SEG = 7;
  const SIDES = 7;
  // trunk: tapered, gently curved column with ring bulges
  const curve = rng.range(-0.14, 0.14);
  const ring: Vector2[] = [];
  for (let s = 0; s <= SEG; s++) {
    const f = s / SEG;
    const r = 0.18 * (1 - 0.4 * f) * (1 + 0.13 * Math.sin(f * 19 + rng.float() * 7));
    ring.push(new Vector2(curve * f * f * H, f * H).setX(curve * f * f * H));
    void r;
  }
  const radAt = (f: number): number =>
    0.18 * (1 - 0.4 * f) * (1 + 0.13 * Math.sin(f * 19));
  for (let s = 0; s < SEG; s++) {
    const f0 = s / SEG;
    const f1 = (s + 1) / SEG;
    const y0 = f0 * H;
    const y1 = f1 * H;
    const x0 = curve * f0 * f0 * H;
    const x1 = curve * f1 * f1 * H;
    const r0 = radAt(f0);
    const r1 = radAt(f1);
    for (let k = 0; k < SIDES; k++) {
      const a0 = (k / SIDES) * Math.PI * 2;
      const a1 = ((k + 1) / SIDES) * Math.PI * 2;
      const p00 = [x0 + r0 * Math.cos(a0), y0, r0 * Math.sin(a0)];
      const p10 = [x0 + r0 * Math.cos(a1), y0, r0 * Math.sin(a1)];
      const p01 = [x1 + r1 * Math.cos(a0), y1, r1 * Math.sin(a0)];
      const p11 = [x1 + r1 * Math.cos(a1), y1, r1 * Math.sin(a1)];
      pos.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
      for (let i = 0; i < 6; i++) col.push(0);
    }
  }
  // crown: fronds arc out from the top; asymmetric distribution
  const topX = curve * H;
  const frondN = Math.round(rng.range(15, 22));
  const biasA = rng.float() * Math.PI * 2;
  for (let fi = 0; fi < frondN; fi++) {
    const az = (fi / frondN) * Math.PI * 2 + rng.range(-0.14, 0.14);
    // crown asymmetry: fronds on the bias side droop lower
    const droopBias = 0.35 * Math.cos(az - biasA);
    const len = rng.range(2.6, 3.9);
    const droop = rng.range(0.55, 0.95) + droopBias;
    const FS = 4;
    let px = topX;
    let py = H;
    let pz = 0;
    let ang = rng.range(0.65, 0.95); // launch elevation
    const ca = Math.cos(az);
    const sa = Math.sin(az);
    let w = 0.3;
    for (let s = 0; s < FS; s++) {
      const step = len / FS;
      const nx = px + Math.cos(ang) * step * ca;
      const nz = pz + Math.cos(ang) * step * sa;
      const ny = py + Math.sin(ang) * step;
      // blade quad perpendicular-ish to the arc
      const wx = -sa * w;
      const wz = ca * w;
      pos.push(px - wx, py, pz - wz, px + wx, py, pz + wz, nx + wx, ny, nz + wz);
      pos.push(px - wx, py, pz - wz, nx + wx, ny, nz + wz, nx - wx, ny, nz - wz);
      for (let i = 0; i < 6; i++) col.push(1);
      px = nx;
      py = ny;
      pz = nz;
      ang -= droop / FS + s * 0.09;
      w *= 0.78;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('kind', new BufferAttribute(new Float32Array(col), 1));
  g.computeVertexNormals();
  return g;
}

export function buildPalms(
  scene: Scene,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
  preset: 'low' | 'high' | 'ultra' = 'high',
): number {
  const rng = seed.rng('palms');
  const target = TARGET[preset];

  // --- placement: cluster along water ---------------------------------------
  // grove anchors near banks/harbor/canal-side; rejection-sample on the CPU
  // height mirror: keep spots on the plain, dry, below +2 m world Y
  const spots: [number, number, number][] = []; // x, z, groveTightness
  const anchors: [number, number, number][] = [];
  for (let a = 0; a < 90; a++) {
    // bank-hugging anchors: offset west/east of the channel centerline
    const z = rng.range(-1750, 2100);
    const side = rng.chance(0.72) ? -1 : 1;
    const x = 1965 + rng.range(30, 65) * 0 + side * rng.range(160, 420) + rng.range(-40, 40);
    anchors.push([x, z, rng.range(14, 42)]);
  }
  for (let a = 0; a < 26; a++) {
    // harbor + approach-canal fringe
    anchors.push([rng.range(950, 1750), rng.range(-330, 80), rng.range(10, 26)]);
  }
  let tries = 0;
  while (spots.length < target && tries < target * 30) {
    tries++;
    const an = anchors[rng.int(anchors.length)] as [number, number, number];
    const r = Math.abs(rng.gauss()) * an[2];
    const th = rng.float() * Math.PI * 2;
    const x = an[0] + Math.cos(th) * r;
    const z = an[1] + Math.sin(th) * r * 1.6; // groves stretch along the river
    const y = hf.heightAtCpu(x, z);
    if (y < NILE_WATER_Y + 0.4 || y > -38) continue; // wet or off the plain
    spots.push([x, z, y]);
  }

  // --- PLANTED rows along the harbor approach canal --------------------------
  // regular spacing reads as human planting (Zone B canal lines). The canal
  // edges are found by scanning the height mirror at each x station for the
  // wet span; skip stations inside the basin (span too wide) or the river.
  for (let x = 1310; x < 1795; x += 13) {
    let z0 = NaN;
    let z1 = NaN;
    for (let z = -370; z <= 130; z += 3) {
      const wet = hf.heightAtCpu(x, z) < NILE_WATER_Y - 0.15;
      if (wet && Number.isNaN(z0)) z0 = z;
      if (wet) z1 = z;
    }
    if (Number.isNaN(z0) || z1 - z0 < 6 || z1 - z0 > 95) continue;
    for (const ze of [z0 - 7, z1 + 7]) {
      const zj = ze + rng.range(-1.2, 1.2);
      const xj = x + rng.range(-1.2, 1.2);
      const y = hf.heightAtCpu(xj, zj);
      if (y > NILE_WATER_Y + 0.3 && y < -39) spots.push([xj, zj, y]);
    }
  }

  // --- per-variant instance slices -------------------------------------------
  // each variant mesh owns its own buffers: instanceIndex restarts at 0 per
  // InstancedMesh, so a shared buffer would render every variant at the
  // SAME first N positions
  const n = spots.length;
  const per = Math.ceil(n / VARIANTS);
  let total = 0;
  for (let v = 0; v < VARIANTS; v++) {
    const count = Math.min(per, n - v * per);
    if (count <= 0) break;
    const data = new Float32Array(count * 4); // x, y, z, yaw
    const dataB = new Float32Array(count * 4); // leanX, leanZ, tone, scale
    for (let i = 0; i < count; i++) {
      const s = spots[v * per + i] as [number, number, number];
      data[i * 4 + 0] = s[0];
      data[i * 4 + 1] = s[2] - 0.15;
      data[i * 4 + 2] = s[1];
      data[i * 4 + 3] = rng.float() * Math.PI * 2;
      dataB[i * 4 + 0] = rng.range(-0.09, 0.09);
      dataB[i * 4 + 1] = rng.range(-0.09, 0.09);
      dataB[i * 4 + 2] = rng.range(0.85, 1.12);
      dataB[i * 4 + 3] = rng.range(0.74, 1.22);
    }
    const bufA = instancedArray(data, 'vec4');
    const bufB = instancedArray(dataB, 'vec4');

    const mat = new MeshPhysicalNodeMaterial();
    mat.specularIntensity = 0.25;
    const A = bufA.element(instanceIndex);
    const B = bufB.element(instanceIndex);
    const yaw = A.w;
    const scale = B.w;
    const cy = cos(yaw);
    const sy = sin(yaw);
    const lp = positionLocal.mul(scale);
    const rx = lp.x.mul(cy).sub(lp.z.mul(sy));
    const rz = lp.x.mul(sy).add(lp.z.mul(cy));
    // lean: shear with height (growth lean, not rigid tilt)
    // + WIND SWAY (Phase-6 motion): downwind shear that grows quadratically
    // with height (trunk base still, crown moves), per-instance phase/rate
    const ph = A.x.mul(0.37).add(A.z.mul(0.53)); // position-hashed phase
    const gust = sin(uWorldTime.mul(0.9).add(ph))
      .mul(0.6)
      .add(sin(uWorldTime.mul(2.3).add(ph.mul(1.7))).mul(0.4));
    const hN = lp.y.mul(0.11); // ~1 at crown height
    const sway = gust.mul(hN.mul(hN)).mul(0.22);
    const wpos = vec3(
      A.x.add(rx).add(B.x.mul(lp.y)).add(sway.mul(WIND_X)),
      A.y.add(lp.y),
      A.z.add(rz).add(B.y.mul(lp.y)).add(sway.mul(WIND_Z)),
    );
    mat.positionNode = wpos;
    const nl = normalLocal;
    const rnx = nl.x.mul(cy).sub(nl.z.mul(sy));
    const rnz = nl.x.mul(sy).add(nl.z.mul(cy));
    const nWorld = vec3(rnx, nl.y, rnz);
    mat.normalNode = transformNormalToView(varying(nWorld) as unknown as NV3);

    const kind = attribute('kind', 'float') as unknown as NF;
    const tone = varying(B.z) as unknown as NF;
    const trunk = vec3(0.42, 0.33, 0.22);
    const frond = vec3(0.24, 0.36, 0.13);
    mat.colorNode = mix(trunk, frond, clamp(kind, 0, 1)).mul(tone);
    mat.roughnessNode = mix(float(0.85), float(0.62), kind);
    mat.metalnessNode = float(0);
    mat.side = 2; // fronds are thin — light both sides
    giLightMap(mat, gi, varying(nWorld) as unknown as NV3, 1.5);

    const geo = palmGeometry(rng.fork(`variant-${v}`));
    const mesh = new InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    total += count;
  }
  return total;
}
