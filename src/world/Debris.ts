/**
 * Stone-working debris (Phase 6, brief floor: ≥80k instances on high) —
 * limestone chips, spall and rejected blocks strewn where the work is:
 * the Khufu quarry horseshoe, the ramp corridor toward the plateau, the
 * masons' yards outside the temenos, and the worker-town lanes.
 *
 * One irregular chip geometry, one InstancedMesh per size class (2 draws),
 * per-instance position/yaw/scale/tone in instancedArray buffers. Placement
 * clusters by work-zone anchors, grounded on the CPU height mirror, and
 * thins with distance from each anchor (fresh spoil heaps near the faces).
 */

import {
  BufferAttribute,
  BufferGeometry,
  InstancedMesh,
  type Object3D,
} from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
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
import { QUARRY_KHUFU_CENTER, WORKER_TOWN_CENTER } from './CANON_DIMENSIONS';

const TARGET = { low: 24_000, high: 84_000, ultra: 110_000 } as const;

/** irregular chip: a squashed, sheared octahedron (8 tris, no two alike
 *  after per-instance scale/yaw) */
function chipGeometry(rng: Rng): BufferGeometry {
  const pos: number[] = [];
  const vx = [
    [rng.range(0.7, 1.3), 0, 0], [-rng.range(0.7, 1.3), 0, 0],
    [0, 0, rng.range(0.5, 1.1)], [0, 0, -rng.range(0.5, 1.1)],
    [rng.range(-0.25, 0.25), rng.range(0.5, 0.9), rng.range(-0.25, 0.25)],
    [rng.range(-0.2, 0.2), -0.15, rng.range(-0.2, 0.2)],
  ] as const;
  const F = [
    [0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4],
    [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5],
  ] as const;
  for (const f of F) {
    for (const i of f) pos.push(...(vx[i] as readonly number[]));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return g;
}

interface Anchor {
  x: number;
  z: number;
  r: number; // gaussian spread
  w: number; // relative weight
}

export function buildDebris(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
  preset: 'low' | 'high' | 'ultra' = 'high',
): number {
  const rng = seed.rng('debris');
  const target = TARGET[preset];

  const qx = QUARRY_KHUFU_CENTER.x;
  const qz = QUARRY_KHUFU_CENTER.z;
  const anchors: Anchor[] = [
    // quarry horseshoe: heavy spoil around the working faces
    { x: qx, z: qz, r: 90, w: 3.2 },
    { x: qx - 60, z: qz - 70, r: 45, w: 1.6 },
    { x: qx + 70, z: qz + 60, r: 50, w: 1.4 },
    // ramp corridor quarry → plateau (D-7 south ramp line)
    { x: qx - 30, z: qz - 170, r: 55, w: 1.2 },
    { x: 30, z: 210, r: 45, w: 0.9 },
    // masons' yards outside the SE temenos + east approach
    { x: 185, z: 180, r: 40, w: 0.8 },
    { x: 260, z: 120, r: 35, w: 0.6 },
    // worker-town lanes and dumps
    { x: WORKER_TOWN_CENTER.x - 60, z: WORKER_TOWN_CENTER.z - 210, r: 60, w: 0.8 },
    { x: WORKER_TOWN_CENTER.x + 120, z: WORKER_TOWN_CENTER.z + 40, r: 55, w: 0.5 },
  ];
  const wSum = anchors.reduce((a, b) => a + b.w, 0);

  // two size classes: chips (many, small) and block rubble (few, larger)
  const classes = [
    { share: 0.9, s0: 0.06, s1: 0.28, sink: 0.35 },
    { share: 0.1, s0: 0.3, s1: 0.85, sink: 0.3 },
  ] as const;

  let total = 0;
  for (const cls of classes) {
    const count = Math.floor(target * cls.share);
    const data = new Float32Array(count * 4); // x, y, z, yaw
    const dataB = new Float32Array(count * 4); // scale, tone, squash, 0
    let i = 0;
    let guard = 0;
    while (i < count && guard < count * 20) {
      guard++;
      let pick = rng.float() * wSum;
      let an = anchors[0] as Anchor;
      for (const a of anchors) {
        pick -= a.w;
        if (pick <= 0) { an = a; break; }
      }
      const r = Math.abs(rng.gauss()) * an.r;
      const th = rng.float() * Math.PI * 2;
      const x = an.x + Math.cos(th) * r;
      const z = an.z + Math.sin(th) * r;
      const y = hf.heightAtCpu(x, z);
      if (y < -44) continue; // not in the water/floodplain mud
      const s = rng.range(cls.s0, cls.s1);
      data[i * 4 + 0] = x;
      data[i * 4 + 1] = y - s * cls.sink;
      data[i * 4 + 2] = z;
      data[i * 4 + 3] = rng.float() * Math.PI * 2;
      dataB[i * 4 + 0] = s;
      dataB[i * 4 + 1] = rng.range(0.78, 1.15);
      dataB[i * 4 + 2] = rng.range(0.55, 1.0);
      i++;
    }
    const n = i;
    if (n === 0) continue;

    const bufA = instancedArray(data, 'vec4');
    const bufB = instancedArray(dataB, 'vec4');
    const mat = new MeshPhysicalNodeMaterial();
    const A = bufA.element(instanceIndex);
    const B = bufB.element(instanceIndex);
    const yaw = A.w;
    const cy = cos(yaw);
    const sy = sin(yaw);
    const lp = positionLocal.mul(B.x).mul(vec3(1, B.z, 1));
    const rx = lp.x.mul(cy).sub(lp.z.mul(sy));
    const rz = lp.x.mul(sy).add(lp.z.mul(cy));
    mat.positionNode = vec3(A.x.add(rx), A.y.add(lp.y), A.z.add(rz));
    const nl = normalLocal;
    const nWorld = varying(
      vec3(nl.x.mul(cy).sub(nl.z.mul(sy)), nl.y, nl.x.mul(sy).add(nl.z.mul(cy))),
    ) as unknown as NV3;
    mat.normalNode = transformNormalToView(nWorld);
    const tone = varying(B.y) as unknown as NF;
    // fresh-cut limestone, slightly brighter than the weathered bedrock
    mat.colorNode = mix(vec3(0.78, 0.74, 0.62), vec3(0.68, 0.63, 0.5), tone.sub(0.78).div(0.37))
      .mul(tone);
    mat.roughnessNode = float(0.82);
    mat.metalnessNode = float(0);
    mat.specularIntensity = 0.3;
    giLightMap(mat, gi, nWorld, 1.0);

    const mesh = new InstancedMesh(chipGeometry(rng.fork(`chip-${cls.s0}`)), mat, n);
    mesh.frustumCulled = false;
    mesh.castShadow = cls.s0 > 0.2; // only the big rubble casts (perf)
    mesh.receiveShadow = true;
    scene.add(mesh);
    total += n;
  }
  return total;
}
