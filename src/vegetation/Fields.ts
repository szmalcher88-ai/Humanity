/**
 * Agricultural belt (Phase 5) — emmer/barley parcels as INSTANCED STALK
 * geometry (brief §2 floor: ≥500k visible instances; "fields as green
 * planes" is a banned outcome). Canon Zone B: the belt runs along the
 * river on both banks, parcels aligned to the channel, separated by paths
 * and ditch lines, with per-parcel crop/maturity variation (late-peret
 * green-gold, D-2).
 *
 * One tuft = 5 crossed blades (10 tris). Parcels rejection-tested against
 * the CPU height mirror (dry plain only). Distance handling: tufts beyond
 * FADE_FAR collapse to degenerate triangles in the vertex stage; the
 * parcel-tinted terrain splat underneath carries the far read.
 */

import { BufferAttribute, BufferGeometry, InstancedMesh, Mesh, type Scene } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  attribute,
  cameraPosition,
  clamp,
  cos,
  float,
  hash,
  instancedArray,
  instanceIndex,
  mix,
  normalLocal,
  positionLocal,
  sin,
  smoothstep,
  transformNormalToView,
  varying,
  vec3,
} from 'three/tsl';
import type { WorldSeed } from '../core/Seed';
import type { Heightfield } from '../world/Heightfield';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { giLightMap } from '../monuments/PyramidBuilder';
import type { NF, NV3 } from '../gpu/TSLTypes';
import { NILE_WATER_Y } from '../world/WorldConst';

const TUFTS = 750_000;
const FADE_NEAR = 700;
const FADE_FAR = 1150;

/** 5-blade crossed tuft, ~0.9 m tall, origin at the root */
function tuftGeometry(): BufferGeometry {
  const pos: number[] = [];
  const BLADES = 5;
  for (let b = 0; b < BLADES; b++) {
    const az = (b / BLADES) * Math.PI * 2 + b * 0.7;
    const lean = 0.16 + 0.1 * Math.sin(b * 12.9898);
    const ca = Math.cos(az);
    const sa = Math.sin(az);
    const h = 0.75 + 0.25 * Math.sin(b * 7.13);
    const w = 0.035;
    // two-segment blade, tapering, leaning outward
    const x1 = ca * lean * h * 0.5;
    const z1 = sa * lean * h * 0.5;
    const x2 = ca * lean * h * 1.4;
    const z2 = sa * lean * h * 1.4;
    const wx = -sa * w;
    const wz = ca * w;
    pos.push(-wx, 0, -wz, wx, 0, wz, x1 + wx * 0.6, h * 0.55, z1 + wz * 0.6);
    pos.push(-wx, 0, -wz, x1 + wx * 0.6, h * 0.55, z1 + wz * 0.6, x1 - wx * 0.6, h * 0.55, z1 - wz * 0.6);
    pos.push(x1 - wx * 0.6, h * 0.55, z1 - wz * 0.6, x1 + wx * 0.6, h * 0.55, z1 + wz * 0.6, x2, h, z2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return g;
}

export interface ParcelInfo {
  count: number;
  parcels: number;
}

export function buildFields(
  scene: Scene,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
): ParcelInfo {
  const rng = seed.rng('fields');

  /* --- parcel plan: strips along the river on both banks ------------------ */
  interface Parcel {
    x0: number;
    z0: number;
    w: number;
    d: number;
    tone: [number, number, number];
    density: number;
  }
  const parcels: Parcel[] = [];
  const PATH = 3.5; // path/ditch gap between parcels
  // keep the harbor basin, approach channel and valley-temple forecourt clear
  const inWorksZone = (cx: number, cz: number): boolean =>
    (cx > 830 && cx < 1980 && cz > -360 && cz < 110) ||
    Math.hypot(cx - 817, cz + 115) < 110;
  for (const [bandX0, bandX1] of [
    [1170, 1830], // west bank belt (fills the plain to the desert toe)
    [2270, 2560], // east bank belt
  ] as const) {
    let z = -1780;
    while (z < 2100) {
      const d = rng.range(46, 90);
      let x = bandX0 + rng.range(0, 24);
      while (x < bandX1 - 30) {
        const w = rng.range(38, 78);
        if (inWorksZone(x + w / 2, z + d / 2)) {
          x += w + PATH;
          continue;
        }
        // crop maturity mix: young green → golden emmer (late peret)
        const gold = rng.float();
        const tone: [number, number, number] = [
          0.22 + 0.3 * gold,
          0.34 + 0.12 * gold,
          0.08 + 0.03 * gold,
        ];
        // some parcels fallow (bare silt — the splat shows through)
        const density = rng.chance(0.12) ? 0 : rng.range(0.65, 1);
        parcels.push({ x0: x, z0: z, w: Math.min(w, bandX1 - x), d, tone, density });
        x += w + PATH;
      }
      z += d + PATH;
    }
  }

  /* --- scatter tufts into parcels (CPU, height-mirror validated) ----------- */
  const data = new Float32Array(TUFTS * 4); // x, y, z, yaw
  const dataB = new Float32Array(TUFTS * 4); // r, g, b, scale
  let count = 0;
  let guard = 0;
  const totalDensity = parcels.reduce((a, p) => a + p.w * p.d * p.density, 0);
  while (count < TUFTS && guard < TUFTS * 8) {
    guard++;
    // pick a parcel weighted by area×density
    let pick = rng.float() * totalDensity;
    let par: Parcel | null = null;
    for (const p of parcels) {
      pick -= p.w * p.d * p.density;
      if (pick <= 0) {
        par = p;
        break;
      }
    }
    if (!par || par.density === 0) continue;
    // row structure: crops were sown in rows; jitter within
    const rowPitch = 0.85;
    const row = Math.floor(rng.float() * (par.d / rowPitch));
    const x = par.x0 + rng.float() * par.w;
    const z = par.z0 + row * rowPitch + rng.range(-0.12, 0.12);
    const y = hf.heightAtCpu(x, z);
    if (y < NILE_WATER_Y + 0.25 || y > -40) continue;
    data[count * 4 + 0] = x;
    data[count * 4 + 1] = y;
    data[count * 4 + 2] = z;
    data[count * 4 + 3] = rng.float() * Math.PI * 2;
    dataB[count * 4 + 0] = par.tone[0] * rng.range(0.85, 1.15);
    dataB[count * 4 + 1] = par.tone[1] * rng.range(0.9, 1.1);
    dataB[count * 4 + 2] = par.tone[2];
    dataB[count * 4 + 3] = rng.range(0.95, 1.55);
    count++;
  }

  /* --- parcel carpets: per-parcel toned ground quads ------------------------ */
  // the crop's CLOSED-CANOPY read between the stalk rows; tufts carry the
  // geometry (brief: fields as bare green planes are banned — this is the
  // understory beneath real stalk geometry, and paths stay silt)
  const cpos: number[] = [];
  const ccol: number[] = [];
  for (const p of parcels) {
    if (p.density === 0) continue;
    const t = p.tone;
    // conformal grid: flat quads buried under the plain's ±0.35 m
    // micro-relief (first shots: carpets invisible) — sample the CPU
    // height mirror per vertex and float 12 cm above it
    const GX = Math.max(2, Math.round(p.w / 12));
    const GZ = Math.max(2, Math.round(p.d / 12));
    const yAt = (gx: number, gz: number): number =>
      hf.heightAtCpu(p.x0 + (gx / GX) * p.w, p.z0 + (gz / GZ) * p.d) + 0.12;
    for (let gz = 0; gz < GZ; gz++) {
      for (let gx = 0; gx < GX; gx++) {
        const x0 = p.x0 + (gx / GX) * p.w;
        const x1 = p.x0 + ((gx + 1) / GX) * p.w;
        const z0 = p.z0 + (gz / GZ) * p.d;
        const z1 = p.z0 + ((gz + 1) / GZ) * p.d;
        const a = [x0, yAt(gx, gz), z0];
        const b = [x1, yAt(gx + 1, gz), z0];
        const c = [x1, yAt(gx + 1, gz + 1), z1];
        const d = [x0, yAt(gx, gz + 1), z1];
        // wound UP-facing: (a,b,c/a,c,d) pointed down and was backface-
        // culled from every real viewpoint (the invisible-carpet bug)
        cpos.push(...a, ...c, ...b, ...a, ...d, ...c);
        for (let i = 0; i < 6; i++) ccol.push(t[0] * 0.7, t[1] * 0.75, t[2] * 0.8);
      }
    }
  }
  const carpetGeo = new BufferGeometry();
  carpetGeo.setAttribute('position', new BufferAttribute(new Float32Array(cpos), 3));
  carpetGeo.setAttribute('tone', new BufferAttribute(new Float32Array(ccol), 3));
  carpetGeo.computeVertexNormals();
  const carpetMat = new MeshPhysicalNodeMaterial();
  const ctone = attribute('tone', 'vec3') as unknown as NV3;
  carpetMat.colorNode = ctone;
  carpetMat.roughnessNode = float(0.9);
  carpetMat.metalnessNode = float(0);
  carpetMat.polygonOffset = true;
  carpetMat.polygonOffsetFactor = -1;
  carpetMat.polygonOffsetUnits = -2;
  giLightMap(carpetMat, gi, vec3(0, 1, 0) as unknown as NV3, 1.0);
  const carpet = new Mesh(carpetGeo, carpetMat);
  carpet.receiveShadow = true;
  scene.add(carpet);

  const bufA = instancedArray(data, 'vec4');
  const bufB = instancedArray(dataB, 'vec4');

  const mat = new MeshPhysicalNodeMaterial();
  mat.specularIntensity = 0.18;
  const A = bufA.element(instanceIndex);
  const B = bufB.element(instanceIndex);
  const camD = A.xyz.sub(cameraPosition).length();
  // collapse far tufts to zero size (degenerate tris rasterize nothing)
  const fade = smoothstep(FADE_FAR, FADE_NEAR, camD);
  const scale = B.w.mul(fade);
  const yaw = A.w;
  const cy = cos(yaw);
  const sy = sin(yaw);
  const lp = positionLocal.mul(scale);
  const rx = lp.x.mul(cy).sub(lp.z.mul(sy));
  const rz = lp.x.mul(sy).add(lp.z.mul(cy));
  mat.positionNode = vec3(A.x.add(rx), A.y.add(lp.y), A.z.add(rz));
  const nl = normalLocal;
  const nWorld = vec3(
    nl.x.mul(cy).sub(nl.z.mul(sy)),
    nl.y,
    nl.x.mul(sy).add(nl.z.mul(cy)),
  );
  // blend toward up-normal: swards light like their ground (LAAS lesson)
  const nBlend = mix(nWorld, vec3(0, 1, 0), 0.55).normalize();
  mat.normalNode = transformNormalToView(varying(nBlend) as unknown as NV3);
  const tint = varying(B.xyz) as unknown as NV3;
  // vertical gradient: shaded base → lit tips
  const tipK = clamp(positionLocal.y.mul(1.1), 0, 1) as unknown as NF;
  mat.colorNode = tint.mul(tipK.mul(0.45).add(0.62));
  mat.roughnessNode = float(0.78);
  mat.metalnessNode = float(0);
  mat.side = 2;
  giLightMap(mat, gi, varying(nBlend) as unknown as NV3, 1.2);
  void hash;

  const mesh = new InstancedMesh(tuftGeometry(), mat, count);
  mesh.frustumCulled = false;
  mesh.castShadow = false; // 0.5M casters would swamp the cascades; contact+AO carry it
  mesh.receiveShadow = true;
  scene.add(mesh);

  return { count, parcels: parcels.length };
}
