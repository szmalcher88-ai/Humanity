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
  Mesh,
  type Object3D,
} from 'three';
import { GeoWriter, limestoneMaterial } from '../monuments/KhufuComplex';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  cameraPosition,
  cos,
  float,
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
import { attachCulling, cellSortVec4 } from '../render/InstanceCull';
import type { Rng, WorldSeed } from '../core/Seed';
import type { Heightfield } from '../world/Heightfield';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { giLightMap } from '../monuments/PyramidBuilder';
import type { NF, NV3 } from '../gpu/TSLTypes';
import { QUARRY_KHUFU_CENTER, WORKER_TOWN_CENTER } from './CANON_DIMENSIONS';

const TARGET = { safe: 8_000, low: 24_000, high: 84_000, ultra: 110_000 } as const;

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
  preset: 'safe' | 'low' | 'high' | 'ultra' = 'high',
  cull = true,
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

  // two size classes: chips (many, small) and block rubble (few, larger).
  // `fade`: a 0.28 m chip is sub-pixel past ~400 m at 1440p — collapsing it
  // there costs nothing visually, saves the vertex work, and stops the
  // sub-pixel sparkle TRAA has to fight (PERF I).
  const classes = [
    { share: 0.9, s0: 0.06, s1: 0.28, sink: 0.35, fade: [520, 340] },
    { share: 0.1, s0: 0.3, s1: 0.85, sink: 0.3, fade: [1400, 1000] },
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
      // (v1.1) the low side of the chip's footprint, not its centre: big
      // rubble straddling a bench edge or a slope floated on one side
      const reach = s * 0.9;
      const low = Math.min(
        y,
        hf.heightAtCpu(x + reach, z), hf.heightAtCpu(x - reach, z),
        hf.heightAtCpu(x, z + reach), hf.heightAtCpu(x, z - reach),
      );
      data[i * 4 + 0] = x;
      data[i * 4 + 1] = low - s * cls.sink;
      data[i * 4 + 2] = z;
      data[i * 4 + 3] = rng.float() * Math.PI * 2;
      dataB[i * 4 + 0] = s;
      dataB[i * 4 + 1] = rng.range(0.78, 1.15);
      dataB[i * 4 + 2] = rng.range(0.55, 1.0);
      i++;
    }
    const n = i;
    if (n === 0) continue;

    const cells = cull ? cellSortVec4(n, [data, dataB], 128, 700) : [];
    const bufA = instancedArray(data, 'vec4');
    const bufB = instancedArray(dataB, 'vec4');
    const mat = new MeshPhysicalNodeMaterial();
    const A = bufA.element(instanceIndex);
    const B = bufB.element(instanceIndex);
    const yaw = A.w;
    const cy = cos(yaw);
    const sy = sin(yaw);
    const camD = A.xyz.sub(cameraPosition).length();
    const fade = smoothstep(cls.fade[0], cls.fade[1], camD);
    const lp = positionLocal.mul(B.x.mul(fade)).mul(vec3(1, B.z, 1));
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
    mesh.name = `debris-${cls.s0}`;
    scene.add(mesh);
    if (cull) {
      attachCulling(mesh, cells, {
        name: 'debris',
        padXZ: 1,
        padY: 1.5,
        maxDist: cls.fade[0] + 60,
        casts: cls.s0 > 0.2,
      });
    }
    total += n;
  }

  /* --- quarry dressing: the work interrupted mid-stroke ---------------------
   * abandoned blocks freed but never hauled, and rows of wedge sockets
   * (lever/wedge cuttings) along the next extraction lines */
  {
    const w = new GeoWriter();
    const t = rng.fork('dressing');
    for (let i = 0; i < 34; i++) {
      const th = t.float() * Math.PI * 2;
      const r = Math.abs(t.gauss()) * 70;
      const x = qx + Math.cos(th) * r;
      const z = qz + Math.sin(th) * r * 0.8;
      const y = hf.heightAtCpu(x, z);
      if (y < -44) continue;
      const L = t.range(1.2, 2.6);
      const bh = t.range(0.7, 1.25);
      const W2 = L * t.range(0.55, 0.8);
      const tone = t.range(0.88, 1.0);
      const yaw = t.float() * Math.PI;
      // (v1.1) seat on the LOWEST corner: centre-height seating left blocks
      // on the 1.12 m bench edges hanging half in the air
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      let low = y;
      for (const [lx, lz] of [[-L / 2, -W2 / 2], [L / 2, -W2 / 2], [L / 2, W2 / 2], [-L / 2, W2 / 2]] as const) {
        low = Math.min(low, hf.heightAtCpu(x + lx * c - lz * s, z + lx * s + lz * c));
      }
      w.box(x, low - 0.12, z, L, bh + (y - low), W2, tone, 0.01, yaw);
    }
    for (let row = 0; row < 12; row++) {
      const th = t.float() * Math.PI * 2;
      const r = Math.abs(t.gauss()) * 60;
      const x0 = qx + Math.cos(th) * r;
      const z0 = qz + Math.sin(th) * r * 0.8;
      const dir = t.float() * Math.PI;
      const n = 6 + t.int(8);
      for (let k = 0; k < n; k++) {
        const x = x0 + Math.cos(dir) * k * 0.38;
        const z = z0 + Math.sin(dir) * k * 0.38;
        const y = hf.heightAtCpu(x, z);
        if (y < -44) break;
        w.box(x, y - 0.02, z, 0.22, 0.1, 0.16, 0.3, 0, dir);
      }
    }
    const mesh = new Mesh(w.build(), limestoneMaterial([0.72, 0.68, 0.57], gi, 0.5));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  return total;
}
