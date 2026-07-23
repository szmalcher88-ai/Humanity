/**
 * Work-site particles (Phase 6, brief floor ≥100k; Pillar C "the world
 * moves"): quarry/ramp DUST kicked up where stone is worked, and hearth
 * SMOKE columns over the bakeries and town.
 *
 * Unlike LAAS's camera-toroidal weather particles, these are WORLD-ANCHORED
 * plumes: each particle belongs to a source and lives a procedural loop
 * computed entirely in the vertex stage from the shared world clock —
 * no compute pass, freeze-safe, zero CPU per frame except two camera-basis
 * uniforms for billboarding. Lit standard material (§9 bans MeshBasic),
 * soft radial alpha, no depth write.
 */

import {
  DoubleSide,
  InstancedMesh,
  PlaneGeometry,
  Vector3,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  clamp,
  float,
  fract,
  instancedArray,
  instanceIndex,
  positionLocal,
  sin,
  smoothstep,
  uniform,
  uv,
  vec3,
} from 'three/tsl';
import type { Rng, WorldSeed } from '../core/Seed';
import type { Heightfield } from './Heightfield';
import { QUARRY_KHUFU_CENTER, WORKER_TOWN_CENTER } from './CANON_DIMENSIONS';
import { uWorldTime } from '../render/WorldClock';
import { WIND_X, WIND_Z } from './WorldConst';

const BUDGET = { low: 40_000, high: 131_072, ultra: 160_000 } as const;

interface Src {
  x: number;
  z: number;
  r: number; // emission radius
  w: number; // weight
}

export class WorkParticles {
  readonly meshes: InstancedMesh[] = [];
  private readonly uCamRight = uniform(new Vector3(1, 0, 0));
  private readonly uCamUp = uniform(new Vector3(0, 1, 0));

  constructor(
    scene: Object3D,
    seed: WorldSeed,
    hf: Heightfield,
    preset: 'low' | 'high' | 'ultra' = 'high',
  ) {
    const rng = seed.rng('particles');
    const total = BUDGET[preset];
    const qx = QUARRY_KHUFU_CENTER.x;
    const qz = QUARRY_KHUFU_CENTER.z;
    const tx = WORKER_TOWN_CENTER.x;
    const tz = WORKER_TOWN_CENTER.z;

    // DUST — where stone is quarried, hauled and dressed
    const dustSrc: Src[] = [
      { x: qx, z: qz, r: 80, w: 3 },
      { x: qx - 60, z: qz - 70, r: 40, w: 1.5 },
      { x: qx + 70, z: qz + 60, r: 45, w: 1.2 },
      { x: qx - 30, z: qz - 170, r: 50, w: 1.2 }, // ramp corridor
      { x: 30, z: 210, r: 40, w: 0.9 },
      { x: 185, z: 180, r: 35, w: 0.8 }, // masons' yards
      { x: tx - 60, z: tz - 210, r: 50, w: 0.7 }, // town lanes
    ];
    // SMOKE — bakery chimneys + town hearths (thin, rising columns)
    const smokeSrc: Src[] = [];
    for (let i = 0; i < 9; i++) {
      smokeSrc.push({ x: tx - 95 + i * 11.5, z: tz + 32 + (i % 2) * 9, r: 1.2, w: 1 });
    }
    for (let i = 0; i < 6; i++) {
      smokeSrc.push({
        x: tx + 60 + rng.range(0, 60), z: tz - 120 + rng.range(0, 70), r: 1.5, w: 0.6,
      });
    }

    this.spawn(scene, rng.fork('dust'), hf, dustSrc, Math.floor(total * 0.86), {
      tone: [0.74, 0.66, 0.5], rise: [2, 7], drift: [10, 34], size: [0.22, 0.65],
      rate: [0.02, 0.05], alpha: 0.085, spread: 1.6,
    });
    this.spawn(scene, rng.fork('smoke'), hf, smokeSrc, Math.floor(total * 0.14), {
      tone: [0.4, 0.39, 0.38], rise: [9, 22], drift: [6, 16], size: [0.35, 0.9],
      rate: [0.03, 0.06], alpha: 0.24, spread: 0.5,
    });
  }

  private spawn(
    scene: Object3D,
    rng: Rng,
    hf: Heightfield,
    sources: Src[],
    count: number,
    o: {
      tone: [number, number, number];
      rise: [number, number];
      drift: [number, number];
      size: [number, number];
      rate: [number, number];
      alpha: number;
      spread: number;
    },
  ): void {
    const wSum = sources.reduce((a, b) => a + b.w, 0);
    const A = new Float32Array(count * 4); // ax, ay, az, phase
    const B = new Float32Array(count * 4); // rate, drift, rise, size
    for (let i = 0; i < count; i++) {
      let pick = rng.float() * wSum;
      let s = sources[0] as Src;
      for (const c of sources) {
        pick -= c.w;
        if (pick <= 0) { s = c; break; }
      }
      const r = Math.abs(rng.gauss()) * s.r * 0.5;
      const th = rng.float() * Math.PI * 2;
      const x = s.x + Math.cos(th) * r;
      const z = s.z + Math.sin(th) * r;
      A[i * 4 + 0] = x;
      A[i * 4 + 1] = hf.heightAtCpu(x, z) + 0.15;
      A[i * 4 + 2] = z;
      A[i * 4 + 3] = rng.float();
      B[i * 4 + 0] = rng.range(o.rate[0], o.rate[1]);
      B[i * 4 + 1] = rng.range(o.drift[0], o.drift[1]);
      B[i * 4 + 2] = rng.range(o.rise[0], o.rise[1]);
      B[i * 4 + 3] = rng.range(o.size[0], o.size[1]);
    }
    const bufA = instancedArray(A, 'vec4');
    const bufB = instancedArray(B, 'vec4');

    const mat = new MeshStandardNodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false;
    mat.side = DoubleSide;
    mat.metalness = 0;
    mat.roughness = 0.95;

    const pa = bufA.element(instanceIndex);
    const pb = bufB.element(instanceIndex);
    // life loop 0..1
    const tau = fract(uWorldTime.mul(pb.x).add(pa.w));
    // downwind travel + gusty lateral wander, widening with age
    const wander = sin(uWorldTime.mul(0.7).add(pa.w.mul(41.7)))
      .mul(o.spread)
      .mul(tau);
    const px = pa.x
      .add(tau.mul(pb.y).mul(WIND_X))
      .add(wander.mul(-WIND_Z));
    const pz = pa.z
      .add(tau.mul(pb.y).mul(WIND_Z))
      .add(wander.mul(WIND_X));
    const py = pa.y.add(tau.pow(0.85).mul(pb.z));
    // billboard, growing with age
    const sizeM = pb.w.mul(tau.mul(2.2).add(0.6));
    const world = vec3(px, py, pz)
      .add(vec3(this.uCamRight).mul(positionLocal.x.mul(sizeM)))
      .add(vec3(this.uCamUp).mul(positionLocal.y.mul(sizeM)));
    mat.positionNode = world;

    const r2c = uv().sub(0.5).length().mul(2);
    const soft = smoothstep(1, 0.15, r2c);
    const lifeK = smoothstep(0, 0.12, tau).mul(smoothstep(1, 0.6, tau));
    mat.opacityNode = clamp(soft.mul(lifeK).mul(o.alpha), 0, 1);
    mat.colorNode = vec3(...o.tone).mul(float(1).sub(tau.mul(0.25)));

    const mesh = new InstancedMesh(new PlaneGeometry(1, 1), mat, count);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 5;
    scene.add(mesh);
    this.meshes.push(mesh);
  }

  /** per-frame: billboard basis from the camera (2 uniform writes) */
  tick(camera: PerspectiveCamera): void {
    const e = camera.matrixWorld.elements;
    (this.uCamRight.value as Vector3).set(e[0] as number, e[1] as number, e[2] as number);
    (this.uCamUp.value as Vector3).set(e[4] as number, e[5] as number, e[6] as number);
  }
}
