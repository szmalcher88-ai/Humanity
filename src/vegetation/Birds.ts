/**
 * Birds (v1.2 — canon "bird colonies" on the river margin). The marsh life
 * of the Old Kingdom tomb walls (Meidum geese, the Saqqara marsh scenes):
 *
 *   WADERS — standing in the papyrus shallows (bed 5-35 cm under water) in
 *            loose colonies: white egrets, grey herons, glossy ibis probing
 *            the mud with the bill down. Static merged geometry, one draw.
 *   FLOCKS — egrets, ibis and geese wheeling in loose rings over the reed
 *            margin, 18-45 m up. Instanced; each bird flies its own radius,
 *            height and phase, wings beating in the vertex stage (a span
 *            weight per wing vertex lifts and folds the wing about the body
 *            axis). Flocks roost at night: hidden once the sun is down.
 *
 * Tiny on purpose — a heron is ~1 m, an egret's span 1.5 m: at the working
 * distances they are a few pixels of white on the reed line, which is the
 * read the canon asks for, not a close-up.
 */

import { BufferAttribute, BufferGeometry, InstancedMesh, Mesh, type Object3D } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  attribute,
  cos,
  float,
  instancedArray,
  instanceIndex,
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
import type { NF, NV3 } from '../gpu/TSLTypes';
import { giLightMap } from '../monuments/PyramidBuilder';
import { uWorldTime } from '../render/WorldClock';
import { NILE_WATER_Y } from '../world/WorldConst';

type V3 = [number, number, number];

/** colonies per preset (waders per colony ~10-18, one flock per colony) */
const COLONIES = { safe: 2, low: 4, high: 7, ultra: 9 } as const;

const EGRET: V3 = [0.86, 0.85, 0.8];
const HERON: V3 = [0.5, 0.52, 0.53];
const IBIS: V3 = [0.12, 0.1, 0.1];
const GOOSE: V3 = [0.45, 0.38, 0.3];
const LEG: V3 = [0.15, 0.13, 0.1];
const BILL: V3 = [0.62, 0.5, 0.2];

/** flat-shaded colour writer (non-indexed, per-face normals) */
class G {
  pos: number[] = [];
  col: number[] = [];
  span: number[] = [];
  quad(a: V3, b: V3, c: V3, d: V3, t: V3, s = [0, 0, 0, 0]): void {
    this.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    const sp = [s[0], s[1], s[2], s[0], s[2], s[3]] as number[];
    for (let i = 0; i < 6; i++) {
      this.col.push(...t);
      this.span.push(sp[i] ?? 0);
    }
  }
  /** both windings: a wing or a membrane seen from either side */
  sheet(a: V3, b: V3, c: V3, d: V3, t: V3, s: number[]): void {
    this.quad(a, b, c, d, t, s);
    this.quad(d, c, b, a, t, [s[3] ?? 0, s[2] ?? 0, s[1] ?? 0, s[0] ?? 0]);
  }
  box(cx: number, y0: number, cz: number, lx: number, h: number, lz: number, t: V3, yaw = 0, pitch = 0): void {
    const hx = lx / 2;
    const hz = lz / 2;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    // pitch about the box's local z (nose up/down), then yaw about y
    const P = (x: number, y: number, z: number): V3 => {
      const xp = x * cp - y * sp;
      const yp = x * sp + y * cp;
      return [cx + xp * cy - z * sy, y0 + yp, cz + xp * sy + z * cy];
    };
    const b0 = P(-hx, 0, -hz);
    const b1 = P(hx, 0, -hz);
    const b2 = P(hx, 0, hz);
    const b3 = P(-hx, 0, hz);
    const t0 = P(-hx, h, -hz);
    const t1 = P(hx, h, -hz);
    const t2 = P(hx, h, hz);
    const t3 = P(-hx, h, hz);
    this.quad(b1, b0, t0, t1, t);
    this.quad(b2, b1, t1, t2, t);
    this.quad(b3, b2, t2, t3, t);
    this.quad(b0, b3, t3, t0, t);
    this.quad(t0, t3, t2, t1, t);
    this.quad(b0, b1, b2, b3, t);
  }
  build(withSpan = false): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('tone', new BufferAttribute(new Float32Array(this.col), 3));
    if (withSpan) g.setAttribute('span', new BufferAttribute(new Float32Array(this.span), 1));
    g.computeVertexNormals();
    return g;
  }
}

/** one standing wader at (x, z), feet on the bed, body above the water */
function wader(g: G, rng: Rng, x: number, z: number, bed: number): void {
  const kind = rng.float();
  const heron = kind < 0.22;
  const ibis = kind >= 0.22 && kind < 0.5;
  const tone: V3 = heron ? HERON : ibis ? IBIS : EGRET;
  const k = heron ? rng.range(1.25, 1.45) : ibis ? rng.range(0.85, 0.95) : rng.range(0.9, 1.05);
  const yaw = rng.float() * Math.PI * 2;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const at = (f: number, side: number): [number, number] => [x + f * c - side * s, z + f * s + side * c];
  // legs from the bed (or the shore) to above the water line
  const hip = Math.max(bed, NILE_WATER_Y - 0.3) + 0.42 * k;
  const legBase = Math.min(bed, hip - 0.1);
  for (const sd of [-0.05, 0.05]) {
    const [lx, lz] = at(0, sd * k);
    g.box(lx, legBase, lz, 0.025, hip - legBase, 0.025, LEG, yaw);
  }
  // body: an oval of two boxes, tail a little low
  g.box(x, hip, z, 0.34 * k, 0.17 * k, 0.15 * k, tone, yaw, -0.18);
  const [tx, tz] = at(-0.17 * k, 0);
  g.box(tx, hip + 0.02 * k, tz, 0.14 * k, 0.1 * k, 0.12 * k, tone, yaw, -0.3);
  if (ibis) {
    // ibis: short neck forward and down, long decurved bill probing the mud
    const [nx, nz] = at(0.2 * k, 0);
    g.box(nx, hip + 0.02, nz, 0.18 * k, 0.07 * k, 0.07 * k, tone, yaw, -0.6);
    const [hx, hz] = at(0.3 * k, 0);
    g.box(hx, hip - 0.1 * k, hz, 0.07 * k, 0.07 * k, 0.07 * k, tone, yaw);
    const [bx, bz] = at(0.36 * k, 0);
    g.box(bx, Math.max(bed, hip - 0.36 * k), bz, 0.02, 0.26 * k, 0.02, IBIS, yaw, 0.3);
  } else {
    // egret/heron: the S-neck as two segments, a dagger bill forward
    const up = rng.chance(0.6); // upright, or hunched with the neck drawn in
    const [nx, nz] = at(0.12 * k, 0);
    const nh = up ? 0.32 * k : 0.16 * k;
    g.box(nx, hip + 0.12 * k, nz, 0.05 * k, nh, 0.05 * k, tone, yaw, 0.15);
    const [hx, hz] = at(0.17 * k, 0);
    const hy = hip + 0.12 * k + nh;
    g.box(hx, hy, hz, 0.1 * k, 0.065 * k, 0.065 * k, tone, yaw);
    const [bx, bz] = at(0.28 * k, 0);
    g.box(bx, hy + 0.02 * k, bz, 0.14 * k, 0.018, 0.018, BILL, yaw, -0.15);
  }
}

/** flying bird, local +x forward; wing vertices carry a span weight 0..1 */
function flyerGeometry(): BufferGeometry {
  const g = new G();
  const W: V3 = [1, 1, 1]; // tinted per instance
  g.box(0, -0.06, 0, 0.5, 0.12, 0.12, W); // body
  g.box(0.3, -0.03, 0, 0.16, 0.07, 0.07, W); // neck + head
  g.box(-0.31, -0.03, 0, 0.14, 0.03, 0.14, W); // tail
  for (const side of [-1, 1]) {
    // inner and outer panel; span weight rises to the tip
    const r0: V3 = [0.12, 0, side * 0.06];
    const r1: V3 = [-0.14, 0, side * 0.06];
    const m0: V3 = [0.1, 0, side * 0.42];
    const m1: V3 = [-0.12, 0, side * 0.42];
    const t0: V3 = [0.02, 0, side * 0.78];
    const t1: V3 = [-0.1, 0, side * 0.78];
    g.sheet(r0, m0, m1, r1, W, [0, 0.55, 0.55, 0]);
    g.sheet(m0, t0, t1, m1, W, [0.55, 1, 1, 0.55]);
  }
  // span carries the side: negative for the left (−z) wing
  const geo = g.build(true);
  const pos = geo.getAttribute('position');
  const span = geo.getAttribute('span');
  for (let i = 0; i < span.count; i++) {
    const zz = pos.getZ(i);
    span.setX(i, Math.sign(zz) * span.getX(i));
  }
  return geo;
}

export interface Birds {
  waders: number;
  flyers: number;
  /** flocks roost at night */
  setNight(n: number): void;
}

export function buildBirds(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
  preset: 'safe' | 'low' | 'high' | 'ultra' = 'high',
): Birds {
  const rng = seed.rng('birds');
  const W = NILE_WATER_Y;
  /** ankle-deep water or the wet mud at its edge — where waders feed */
  const shallow = (y: number): boolean => y > W - 0.45 && y < W + 0.04;

  /* --- colonies: shallow reed-margin spots on the river strip ------------- */
  const colonies: [number, number][] = [];
  for (let tries = 0; tries < 4000 && colonies.length < COLONIES[preset]; tries++) {
    const x = rng.range(1520, 2440);
    const z = rng.range(-1700, 2100);
    if (z > -470 && z < 220) continue; // the harbour / canal latitudes
    if (!shallow(hf.heightAtCpu(x, z))) continue;
    if (colonies.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 260)) continue;
    colonies.push([x, z]);
  }

  /* --- waders ------------------------------------------------------------- */
  const g = new G();
  let waders = 0;
  for (const [cx, cz] of colonies) {
    const n = rng.int(12) + 14;
    let placed = 0;
    for (let t = 0; t < n * 80 && placed < n; t++) {
      const x = cx + rng.range(-55, 55);
      const z = cz + rng.range(-55, 55);
      const bed = hf.heightAtCpu(x, z);
      if (!shallow(bed)) continue;
      wader(g, rng, x, z, bed);
      placed++;
    }
    waders += placed;
  }
  const wmat = new MeshPhysicalNodeMaterial();
  wmat.colorNode = attribute('tone', 'vec3') as unknown as NV3;
  wmat.roughnessNode = float(0.8);
  wmat.metalnessNode = float(0);
  wmat.specularIntensity = 0.3;
  giLightMap(wmat, gi, vec3(0, 1, 0) as unknown as NV3, 1.2);
  const wmesh = new Mesh(g.build(), wmat);
  wmesh.castShadow = true;
  wmesh.receiveShadow = true;
  wmesh.name = 'birds-waders';
  scene.add(wmesh);

  /* --- flocks ------------------------------------------------------------- */
  const per = 22;
  const nFly = colonies.length * per;
  const A = new Float32Array(Math.max(1, nFly) * 4); // cx, cy, cz, radius
  const B = new Float32Array(Math.max(1, nFly) * 4); // omega, phase, wobble, flap rate
  const C = new Float32Array(Math.max(1, nFly) * 4); // r, g, b, scale
  let i = 0;
  for (const [cx, cz] of colonies) {
    const kind = rng.float();
    const tone = kind < 0.5 ? EGRET : kind < 0.78 ? IBIS : GOOSE;
    const scale = tone === GOOSE ? 1.15 : tone === IBIS ? 0.9 : 1.0;
    const fx = cx + rng.range(-30, 30);
    const fz = cz + rng.range(-30, 30);
    const fy = W + rng.range(18, 34);
    const R = rng.range(22, 42);
    const dir = rng.chance(0.5) ? 1 : -1;
    const speed = rng.range(9, 12); // m/s — egret/ibis cruising flight
    for (let k = 0; k < per; k++, i++) {
      const r = R * rng.range(0.7, 1.25);
      A.set([fx + rng.range(-4, 4), fy + rng.range(-5, 5), fz + rng.range(-4, 4), r], i * 4);
      // a loose flock: phases bunched in an arc, not spread round the ring
      B.set([(dir * speed) / r, rng.range(0, 1.6) + (rng.chance(0.3) ? Math.PI : 0), rng.range(1, 3.5), rng.range(2.8, 3.6)], i * 4);
      C.set([tone[0] * rng.range(0.94, 1.04), tone[1] * rng.range(0.94, 1.04), tone[2] * rng.range(0.94, 1.04), scale * rng.range(0.92, 1.08)], i * 4);
    }
  }
  const bufA = instancedArray(A, 'vec4');
  const bufB = instancedArray(B, 'vec4');
  const bufC = instancedArray(C, 'vec4');
  const a = bufA.element(instanceIndex);
  const b = bufB.element(instanceIndex);
  const c = bufC.element(instanceIndex);
  const fmat = new MeshPhysicalNodeMaterial();
  const span = attribute('span', 'float') as unknown as NF;
  const t = uWorldTime;
  // wing beat: lift and fold the panel about the body axis (z = span)
  const beat = sin(t.mul(b.w.mul(Math.PI * 2)).add(b.y.mul(7.3))).mul(0.75);
  const lift = span.abs().mul(beat).mul(0.55);
  const lp0 = positionLocal.mul(c.w);
  const lp = vec3(lp0.x, lp0.y.add(lift.mul(c.w)), lp0.z.mul(float(1).sub(beat.abs().mul(span.abs()).mul(0.25))));
  // the ring: angle θ, heading along the tangent (local +x forward)
  const th = t.mul(b.x).add(b.y);
  const ct = cos(th);
  const st = sin(th);
  const sg = b.x.sign();
  const yaw = th.add(sg.mul(Math.PI / 2));
  const cy = cos(yaw);
  const sy = sin(yaw);
  const rx = lp.x.mul(cy).sub(lp.z.mul(sy));
  const rz = lp.x.mul(sy).add(lp.z.mul(cy));
  const bob = sin(t.mul(0.6).add(b.y.mul(3.1))).mul(b.z);
  fmat.positionNode = vec3(
    a.x.add(a.w.mul(ct)).add(rx),
    a.y.add(bob).add(lp.y),
    a.z.add(a.w.mul(st)).add(rz),
  );
  const nl = normalLocal;
  const nWorld = varying(vec3(nl.x.mul(cy).sub(nl.z.mul(sy)), nl.y, nl.x.mul(sy).add(nl.z.mul(cy)))) as unknown as NV3;
  fmat.normalNode = transformNormalToView(nWorld);
  fmat.colorNode = varying(vec3(c.x, c.y, c.z)) as unknown as NV3;
  fmat.roughnessNode = float(0.8);
  fmat.metalnessNode = float(0);
  fmat.specularIntensity = 0.3;
  giLightMap(fmat, gi, nWorld, 1.2);
  const fmesh = new InstancedMesh(flyerGeometry(), fmat, Math.max(1, nFly));
  fmesh.frustumCulled = false; // positions live on the GPU
  fmesh.castShadow = false;
  fmesh.receiveShadow = false;
  fmesh.visible = nFly > 0;
  fmesh.name = 'birds-flocks';
  scene.add(fmesh);

  // eslint-disable-next-line no-console
  console.log(
    `[akhet] birds: ${colonies.length} colonies, ${waders} waders, ${nFly} in flight — ` +
      colonies.map(([x, z]) => `(${x.toFixed(0)}, ${z.toFixed(0)})`).join(' '),
  );
  return {
    waders,
    flyers: nFly,
    setNight(n: number): void {
      fmesh.visible = nFly > 0 && n < 0.5;
    },
  };
}
