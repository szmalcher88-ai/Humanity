/**
 * PyramidBuilder — renders a PyramidSpec as:
 *   NEAR: one InstancedMesh of chamfered casing stones (per-stone width/
 *         course height/tone/roughness/planarity-tilt from the spec) —
 *         joints and hand-dressing read at close range (brief §2 floor)
 *   FAR:  an exact-silhouette pyramid mesh whose material carries course
 *         banding + stone jitter analytically (sub-pixel content at range)
 * The LOD switch is distance-based; both LODs share the same exact
 * dimensions so the silhouette never changes.
 *
 * Casing look: freshly dressed Tura limestone — warm white, moderately
 * smooth (never mirror), strong sun response; per-stone facet tilt gives
 * the raking-light sparkle (canon Vol. V casing characteristics).
 */

import { BufferAttribute, BufferGeometry, InstancedMesh, Mesh, Sphere, Vector3 } from 'three';
import { IrradianceNode, MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  clamp,
  cos,
  float,
  floor,
  hash,
  instancedArray,
  instanceIndex,
  mix,
  normalLocal,
  normalWorld,
  positionLocal,
  positionWorld,
  sin,
  transformNormalToView,
  uniform,
  vec2,
  vec3,
  varying,
} from 'three/tsl';
import type { NF, NV3 } from '../gpu/TSLTypes';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { PyramidSpec } from './PyramidSpec';

/**
 * Wire the probe field into a material as its ambient/light-map term.
 * stage 'vertex': irradiance evaluates per-VERTEX and interpolates — for
 * small primitives (stones, blades, fronds, planks) this is visually
 * sub-quantization vs the 16 m probe grid, and it removes 3×texture3D +
 * a 4-tap heightfield bilinear from EVERY FRAGMENT (the iGPU whale:
 * r.scene 65→ms-scale win). Large surfaces (terrain tiles) stay fragment.
 */
export function giLightMap(
  m: MeshPhysicalNodeMaterial,
  gi: ProbeGI | null,
  normal: NV3,
  lift = 2.0,
  stage: 'vertex' | 'fragment' = 'vertex',
): void {
  if (!gi) return;
  let irr = gi.irradiance(positionWorld as unknown as NV3, normal, lift);
  if (stage === 'vertex') irr = varying(irr) as unknown as typeof irr;
  (m as unknown as { setupLightMap: () => unknown }).setupLightMap = () =>
    new IrradianceNode(irr as unknown as ConstructorParameters<typeof IrradianceNode>[0]);
}

const STONE_DEPTH = 0.8;
/** chamfer fractions (of local unit box) — the visible joint read.
 *  Tura casing joints are HAIRLINES (famously <1 mm with mortar); we render
 *  ~6 mm chamfers on a 1.5 m stone — just enough to catch a dark line at
 *  10-30 m. First cut (0.018/0.025) made an egg-crate lattice of glowing
 *  ribs (eye-height shot) — the joint must never out-shine the face. */
const CF = 0.004;
const CD = 0.006;

/** chamfered casing-stone unit geometry (local: x=along, y=up-slope, z=out) */
function stoneGeometry(): BufferGeometry {
  const o = 0.5; // outer extent
  const i = 0.5 - CF; // outer-face inset
  const zf = 0.5; // outer face plane
  const zb = 0.5 - CD; // bevel ring base plane
  // prettier-ignore
  const quads: [number, number, number][][] = [
    // back face (−z)
    [[-o, -o, -o], [-o, o, -o], [o, o, -o], [o, -o, -o]],
    // sides up to the bevel ring start
    [[-o, -o, -o], [o, -o, -o], [o, -o, zb], [-o, -o, zb]], // bottom
    [[-o, o, -o], [-o, o, zb], [o, o, zb], [o, o, -o]], // top
    [[-o, -o, -o], [-o, -o, zb], [-o, o, zb], [-o, o, -o]], // left
    [[o, -o, -o], [o, o, -o], [o, o, zb], [o, -o, zb]], // right
    // bevel ring
    [[-o, -o, zb], [o, -o, zb], [i, -i, zf], [-i, -i, zf]],
    [[-o, o, zb], [-i, i, zf], [i, i, zf], [o, o, zb]],
    [[-o, -o, zb], [-i, -i, zf], [-i, i, zf], [-o, o, zb]],
    [[o, -o, zb], [o, o, zb], [i, i, zf], [i, -i, zf]],
    // outer face
    [[-i, -i, zf], [i, -i, zf], [i, i, zf], [-i, i, zf]],
  ];
  const pos: number[] = [];
  for (const q of quads) {
    const [a, b, c, d] = q as [number, number, number][];
    pos.push(...(a as number[]), ...(b as number[]), ...(c as number[]));
    pos.push(...(a as number[]), ...(c as number[]), ...(d as number[]));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return g;
}

let sharedStoneGeo: BufferGeometry | null = null;

export interface PyramidLod {
  near: InstancedMesh;
  far: Mesh;
  update(camPos: Vector3): void;
  stoneCount: number;
}

export function buildPyramid(spec: PyramidSpec, gi: ProbeGI | null = null): PyramidLod {
  const p = spec.params;
  const n = spec.stones.length;
  const theta = (p.slopeDeg * Math.PI) / 180;
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);

  // --- pack instance buffers --------------------------------------------------
  const dataA = new Float32Array(n * 4); // s, y0, h, w
  const dataB = new Float32Array(n * 4); // face, tone, rough, tiltU
  const dataT = new Float32Array(n * 2); // tiltV, (spare)
  for (let k = 0; k < n; k++) {
    const st = spec.stones[k] as NonNullable<(typeof spec.stones)[0]>;
    dataA[k * 4 + 0] = st.s;
    dataA[k * 4 + 1] = st.y0;
    dataA[k * 4 + 2] = st.h;
    dataA[k * 4 + 3] = st.w;
    dataB[k * 4 + 0] = st.face;
    dataB[k * 4 + 1] = st.tone;
    dataB[k * 4 + 2] = st.rough;
    dataB[k * 4 + 3] = st.tiltU;
    dataT[k * 2 + 0] = st.tiltV;
  }
  const bufA = instancedArray(dataA, 'vec4');
  const bufB = instancedArray(dataB, 'vec4');
  const bufT = instancedArray(dataT, 'vec2');

  const uCenter = uniform(new Vector3(p.cx, p.cy, p.cz));
  const uHalf = uniform(p.baseSide / 2);
  const uHeight = uniform(p.height);

  // --- near material: per-stone transform in the vertex stage ----------------
  const mat = new MeshPhysicalNodeMaterial();
  mat.specularIntensity = 0.55;

  const A = bufA.element(instanceIndex);
  const B = bufB.element(instanceIndex);
  const T = bufT.element(instanceIndex);
  const face = B.x;
  // face outward horizontal dir Nf and tangent Tf (s runs from left corner)
  const isE = face.equal(1).select(float(1), float(0));
  const isS = face.equal(2).select(float(1), float(0));
  const isW = face.equal(3).select(float(1), float(0));
  const isN = face.equal(0).select(float(1), float(0));
  const nfx = isE.sub(isW);
  const nfz = isS.sub(isN);
  const nf = vec2(nfx, nfz);
  const tf = vec2(nfz.negate(), nfx);

  const yMid = A.y.add(A.z.mul(0.5));
  const halfMid = uHalf.mul(float(1).sub(yMid.div(uHeight)));
  const sC = A.x.sub(halfMid); // centered along-face coordinate
  // basis vectors
  const upSlope = vec3(nf.x.negate().mul(cosT), sinT, nf.y.negate().mul(cosT));
  const outN = vec3(nf.x.mul(sinT), cosT, nf.y.mul(sinT));
  const along = vec3(tf.x, 0, tf.y);
  // stone center: on the face plane at (sC, yMid), pushed half-depth inward
  const centerPos = vec3(uCenter)
    .add(along.mul(sC))
    .add(vec3(nf.x.mul(halfMid), yMid, nf.y.mul(halfMid)))
    .sub(outN.mul(STONE_DEPTH / 2));
  const slantH = A.z.div(sinT);
  const local = positionLocal;
  // real joint gap: EXACTLY coplanar neighbor walls z-fight in the depth
  // buffer and GTAO turned that noise into per-stone occlusion blotches
  // (the "waffle" bug) — 1.4 cm of daylight keeps every wall distinct
  const JOINT = 0.014;
  const wpos = centerPos
    .add(along.mul(local.x.mul(A.w.sub(JOINT))))
    .add(upSlope.mul(local.y.mul(slantH.sub(JOINT))))
    .add(outN.mul(local.z.mul(STONE_DEPTH)));
  mat.positionNode = wpos;

  // rotate local normal into the stone basis + per-stone planarity tilt
  const nLocal = normalLocal;
  const nWorld = along
    .mul(nLocal.x)
    .add(upSlope.mul(nLocal.y))
    .add(outN.mul(nLocal.z));
  const tilted = nWorld
    .add(along.mul(B.w))
    .add(upSlope.mul(T.x))
    .normalize();
  mat.normalNode = transformNormalToView(varying(tilted) as unknown as NV3);

  // Tura albedo with per-stone tone + subtle dressing striations
  // (instanceIndex exists only in the vertex stage — carry via varyings)
  const tone = varying(B.y) as unknown as NF;
  const striate = varying(hash(instanceIndex.add(17))) as unknown as NF;
  const baseCol = vec3(0.87, 0.845, 0.79);
  mat.colorNode = baseCol.mul(tone).mul(float(1).sub(striate.mul(0.03)));
  mat.roughnessNode = clamp(float(0.42).add(varying(B.z) as unknown as NF), 0.25, 0.6);
  mat.metalnessNode = float(0);
  // shaded casing faces pick up sand/sky bounce from the probe field —
  // a modest lift keeps base courses sampling above the pavement layer
  giLightMap(mat, gi, varying(tilted) as unknown as NV3, 2.5);

    const plainDebug = new URLSearchParams(window.location.search).get('plainstone') === '1';
  const geo = plainDebug
    ? new (class extends BufferGeometry {})()
    : (sharedStoneGeo ?? (sharedStoneGeo = stoneGeometry()));
  if (plainDebug) {
    // 12-tri unit box (bisect: chamfer construction vs instance transform)
    const b = 0.5;
    const q: number[][][] = [
      [[-b,-b,-b],[-b,b,-b],[b,b,-b],[b,-b,-b]],
      [[-b,-b,b],[b,-b,b],[b,b,b],[-b,b,b]],
      [[-b,-b,-b],[b,-b,-b],[b,-b,b],[-b,-b,b]],
      [[-b,b,-b],[-b,b,b],[b,b,b],[b,b,-b]],
      [[-b,-b,-b],[-b,-b,b],[-b,b,b],[-b,b,-b]],
      [[b,-b,-b],[b,b,-b],[b,b,b],[b,-b,b]],
    ];
    const pos: number[] = [];
    for (const f of q) {
      const [a2, b2, c2, d2] = f as number[][];
      pos.push(...(a2 as number[]), ...(b2 as number[]), ...(c2 as number[]));
      pos.push(...(a2 as number[]), ...(c2 as number[]), ...(d2 as number[]));
    }
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    geo.computeVertexNormals();
  }
  if (new URLSearchParams(window.location.search).get('pyrdbg') === '1') {
    // paint the computed world normal (kills lighting): flat 52°-face
    // normals → one uniform color per face; axis-aligned steps → mixed
    // bright-green tops + dark side colors
    mat.colorNode = vec3(1, 1, 1);
    mat.emissiveNode = varying(nWorld.mul(0.5).add(0.5)) as unknown as NV3;
  }
  // per-pyramid geometry VIEW sharing the same attribute buffers, with an
  // explicit world-space bounding sphere: frustumCulled=false submitted
  // 63k instances (1.3M tris of vertex work) even facing AWAY (iGPU probe)
  const geoView = new BufferGeometry();
  const posAttr = geo.getAttribute('position');
  if (posAttr) geoView.setAttribute('position', posAttr);
  const nrmAttr = geo.getAttribute('normal');
  if (nrmAttr) geoView.setAttribute('normal', nrmAttr);
  geoView.boundingSphere = new Sphere(
    new Vector3(p.cx, p.cy + p.height / 2, p.cz),
    Math.hypot(p.baseSide * 0.7071, p.height / 2) + 8,
  );
  const near = new InstancedMesh(geoView, mat, n);
  near.frustumCulled = true;
  near.castShadow = true;
  near.receiveShadow = true;

  // --- backing pyramid: ALWAYS visible ------------------------------------
  // Inset ~5 cm behind the casing faces: (1) the slot floor behind every
  // joint (GTAO reads shallow joints, not 0.8 m chasms), (2) the exact far
  // silhouette when the stones LOD out. Same dims scaled by an epsilon.
  const H = p.height * (1 - 8e-4);
  const hb = (p.baseSide / 2) * (1 - 8e-4);
  const farGeo = new BufferGeometry();
  const apex = [0, H, 0];
  const c0 = [-hb, 0, -hb];
  const c1 = [hb, 0, -hb];
  const c2 = [hb, 0, hb];
  const c3 = [-hb, 0, hb];
  const fpos = [
    ...c1, ...c0, ...apex, // north face (−z, outward)
    ...c2, ...c1, ...apex, // east
    ...c3, ...c2, ...apex, // south
    ...c0, ...c3, ...apex, // west
  ];
  farGeo.setAttribute('position', new BufferAttribute(new Float32Array(fpos), 3));
  farGeo.computeVertexNormals();

  const farMat = new MeshPhysicalNodeMaterial();
  farMat.specularIntensity = 0.55;
  const avgCourse = H / p.courseCount;
  const fy = positionWorld.y.sub(p.cy);
  const courseIdx = floor(fy.div(avgCourse));
  const bandJ = hash(courseIdx.add(3.7)).mul(0.045);
  // stone-scale jitter from quantized world cells (reads as texture at range)
  const cell = floor(positionWorld.xz.mul(0.65)).add(courseIdx.mul(7.13));
  const stoneJ = hash(cell.x.add(cell.y.mul(113.1))).mul(0.04);
  farMat.colorNode = vec3(0.87, 0.845, 0.79)
    .mul(float(1).sub(bandJ).sub(stoneJ));
  farMat.roughnessNode = float(0.45);
  farMat.metalnessNode = float(0);
  giLightMap(farMat, gi, normalWorld as unknown as NV3, 2.5);
  const far = new Mesh(farGeo, farMat);
  far.position.set(p.cx, p.cy, p.cz);
  far.castShadow = true;
  far.receiveShadow = true;

  // --- LOD switch: backing stays on; stones toggle ---------------------------
  const center = new Vector3(p.cx, p.cy + H / 2, p.cz);
  const lodDist = Math.max(900, p.baseSide * 6);
  const update = (camPos: Vector3): void => {
    near.visible = camPos.distanceTo(center) < lodDist;
  };

  void cos;
  void sin;
  void mix;
  return { near, far, update, stoneCount: n };
}
