/**
 * Phase-0 sanity scene — proves the full GPU stack end to end:
 *  1. compute kernel → storage buffers → instanced draw (GPU instance path)
 *  2. compute kernel → storage texture → material sampling
 *  3. TSL vertex displacement (procedural dune ground)
 *  4. CPU procedural geometry (weathered outcrop)
 *  5. lights + shadows + GPU timestamps (via Engine stats)
 * Deterministic from ?seed. The instanced subject is a stepped mound of
 * limestone-toned blocks — a first bow toward Phase 3's course solver.
 */

import {
  BoxGeometry,
  DirectionalLight,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  PlaneGeometry,
  Vector3,
} from 'three';
import { MeshStandardNodeMaterial, StorageTexture } from 'three/webgpu';
import {
  Fn,
  float,
  floor,
  hash,
  instancedArray,
  instanceIndex,
  mix,
  positionLocal,
  texture,
  textureStore,
  uniform,
  uv,
  uvec2,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { fbm3, ridged3 } from '../core/NoiseJS';
import type { WorldContext } from './Scenes';
import { fbm2 } from '../gpu/noise/NoiseTSL';

const TEX_SIZE = 512;

// stepped mound: square courses shrinking with height (CPU counts the
// instances; the GPU computes every transform)
const COURSES = 24;
const BASE_HALF = 30; // blocks per half-side at course 0
const BLOCK = 1.3; // nominal block size (m)

function courseHalf(c: number): number {
  return BASE_HALF - c;
}

function countBlocks(): number {
  let n = 0;
  for (let c = 0; c < COURSES; c++) {
    const h = courseHalf(c);
    n += h * 2 * 4; // perimeter ring of the course (hollow — only visible shell)
  }
  return n;
}

export async function buildSanityScene(ctx: WorldContext): Promise<void> {
  const { engine, seed } = ctx;
  const { scene, renderer } = engine;

  ctx.progress(0.3, 'sanity: compute instance buffers');

  // --- 1. GPU-computed block instances --------------------------------------
  const blockCount = countBlocks();
  const posBuf = instancedArray(blockCount, 'vec4'); // xyz = offset, w = scale jitter
  const colBuf = instancedArray(blockCount, 'vec4');
  const seedU = uniform(seed.sub('sanity-blocks') % 1000);

  // per-course ring bases, uploaded as a second storage buffer the kernel reads
  const ringMeta = instancedArray(COURSES, 'vec4'); // x = firstIndex, y = half, z = course
  {
    const meta = new Float32Array(COURSES * 4);
    let acc = 0;
    for (let c = 0; c < COURSES; c++) {
      const h = courseHalf(c);
      meta[c * 4 + 0] = acc;
      meta[c * 4 + 1] = h;
      meta[c * 4 + 2] = c;
      meta[c * 4 + 3] = h * 2 * 4;
      acc += h * 2 * 4;
    }
    const attr = ringMeta.value;
    (attr.array as Float32Array).set(meta);
  }

  const fillInstances = Fn(() => {
    const i = instanceIndex;
    const fi = float(i);
    // find our course by scanning ring meta (COURSES is tiny)
    const course = float(0).toVar();
    const local = float(0).toVar();
    const half = float(0).toVar();
    for (let c = 0; c < COURSES; c++) {
      const m = ringMeta.element(c);
      const inRing = fi.greaterThanEqual(m.x).and(fi.lessThan(m.x.add(m.w)));
      course.assign(inRing.select(m.z, course));
      local.assign(inRing.select(fi.sub(m.x), local));
      half.assign(inRing.select(m.y, half));
    }
    // walk the square perimeter: side = local / (2*half), t = position on side
    const sideLen = half.mul(2);
    const side = floor(local.div(sideLen));
    const t = local.sub(side.mul(sideLen)).sub(half);
    const h1 = hash(i.add(seedU));
    const h2 = hash(i.add(seedU).add(91283));
    const h3 = hash(i.add(seedU).add(58213));
    // side 0: +x edge varying z; 1: -x; 2: +z varying x; 3: -z
    const isX = side.lessThan(2);
    const sign = mix(float(1), float(-1), side.mod(2));
    const along = t.mul(BLOCK).add(h1.mul(0.08));
    const across = half.mul(BLOCK).mul(sign);
    const x = mix(along, across, isX.select(float(1), float(0)));
    const z = mix(across, along, isX.select(float(1), float(0)));
    const y = course.mul(BLOCK * 0.92).add(BLOCK * 0.46);
    const s = h2.mul(0.14).add(0.94);
    posBuf.element(i).assign(vec4(x, y, z, s));
    // limestone tones: Tura-white → warm local limestone, per-block jitter
    const tura = vec3(0.87, 0.84, 0.78);
    const local_ls = vec3(0.76, 0.68, 0.55);
    const col = mix(tura, local_ls, h3.mul(0.8));
    colBuf.element(i).assign(vec4(col.mul(h1.mul(0.16).add(0.9)), 1));
  })().compute(blockCount);

  await renderer.computeAsync(fillInstances);

  ctx.progress(0.45, 'sanity: synthesize ground texture');

  // --- 2. compute-written storage texture (sand albedo) ---------------------
  const groundTex = new StorageTexture(TEX_SIZE, TEX_SIZE);
  const writeGround = Fn(() => {
    const i = instanceIndex;
    const x = i.mod(TEX_SIZE);
    const y = i.div(TEX_SIZE);
    const p = vec2(float(x), float(y)).div(TEX_SIZE);
    const n = fbm2(p.mul(12), 5);
    const n2 = fbm2(p.mul(53).add(17.3), 4);
    const sandLight = vec3(0.78, 0.68, 0.52);
    const sandDark = vec3(0.58, 0.48, 0.34);
    const col = mix(sandLight, sandDark, n).mul(n2.mul(0.3).add(0.8));
    textureStore(groundTex, uvec2(x, y), vec4(col, 1)).toWriteOnly();
  })().compute(TEX_SIZE * TEX_SIZE);

  await renderer.computeAsync(writeGround);

  ctx.progress(0.6, 'sanity: build meshes');

  // --- 3. ground with TSL displacement (low dunes) --------------------------
  const groundGeo = new PlaneGeometry(500, 500, 240, 240);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new MeshStandardNodeMaterial();
  groundMat.colorNode = texture(groundTex, uv().mul(7).fract());
  const wxz = positionLocal.xz;
  groundMat.positionNode = positionLocal.add(
    vec3(0, fbm2(wxz.mul(0.012), 4).mul(5).sub(2.5), 0),
  );
  groundMat.roughnessNode = float(0.96);
  const ground = new Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  // --- instanced blocks (GPU transforms) ------------------------------------
  const blockGeo = new BoxGeometry(BLOCK * 0.96, BLOCK * 0.92, BLOCK * 0.96);
  const blockMat = new MeshStandardNodeMaterial();
  const inst = posBuf.element(instanceIndex);
  blockMat.positionNode = positionLocal.mul(inst.w).add(inst.xyz);
  blockMat.colorNode = varying(colBuf.element(instanceIndex));
  blockMat.roughnessNode = float(0.88);
  const blocks = new InstancedMesh(blockGeo, blockMat, blockCount);
  blocks.castShadow = true;
  blocks.receiveShadow = true;
  blocks.frustumCulled = false;
  scene.add(blocks);

  // --- 4. CPU procedural outcrop --------------------------------------------
  const rockGeo = new IcosahedronGeometry(7, 40);
  const rockSeed = seed.sub('sanity-outcrop');
  const pos = rockGeo.attributes['position'];
  if (!pos) throw new Error('outcrop geometry missing position attribute');
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().normalize();
    const r =
      7 *
      (1 +
        0.35 * ridged3(dir.x * 1.7, dir.y * 1.7, dir.z * 1.7, rockSeed, 5) +
        0.14 * fbm3(dir.x * 6, dir.y * 6, dir.z * 6, rockSeed ^ 0x5bd1, 5));
    v.copy(dir.multiplyScalar(r));
    pos.setXYZ(i, v.x, v.y * 0.5, v.z);
  }
  rockGeo.computeVertexNormals();
  const rockMat = new MeshStandardNodeMaterial();
  rockMat.colorNode = vec3(0.72, 0.65, 0.52);
  rockMat.roughnessNode = float(0.92);
  const rock = new Mesh(rockGeo, rockMat);
  rock.position.set(-70, 0.5, 35);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);

  // --- 5. lights -------------------------------------------------------------
  const sun = new DirectionalLight(0xfff0d8, 3.4);
  sun.position.set(160, 190, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  // desert skylight: blue sky over warm sand bounce (no-black-shadows law)
  scene.add(new HemisphereLight(0x9db8e0, 0x5a4c36, 0.6));

  engine.camera.position.set(70, 42, 95);
  engine.camera.lookAt(0, 12, 0);

  engine.stats.counters['instances.blocks'] = blockCount;
  ctx.progress(0.9, 'sanity: done');
}
