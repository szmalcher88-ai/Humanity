/**
 * Townsfolk and animals as static coloured geometry (v1.2 I3, canon Vol VIII
 * "Social life", "Children and families", "Animal management").
 *
 * The instanced gangs (Inhabitants.ts) walk and stand; what they cannot do —
 * sit cross-legged with a writing board, lie on a physician's bed, crouch at
 * a loom, play — and every animal in the town is built here: box figures in
 * the same ~1.65 m language as the boat crews (children at ~0.62 scale),
 * donkeys, goats, hair sheep with horizontal horns, Egyptian geese and tesem
 * dogs, each a dozen boxes. One merged mesh, one plain tone material.
 * Animals stand in pens, at tethers or in flocks — never scattered at random
 * (canon: "Animals should never wander randomly").
 */

import { BufferAttribute, BufferGeometry, Mesh, type Object3D } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { attribute, float, vec3 } from 'three/tsl';
import type { Rng } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { NV3 } from '../gpu/TSLTypes';
import { giLightMap } from './PyramidBuilder';

export type C3 = [number, number, number];

const SKIN: C3 = [0.36, 0.22, 0.13];
const LINEN: C3 = [0.82, 0.79, 0.7];
const HAIR: C3 = [0.11, 0.09, 0.08];

/** flat-shaded colour writer: boxes (yawed) and slanted beams */
export class ColorWriter {
  pos: number[] = [];
  col: number[] = [];
  count = 0;

  quad(a: C3, b: C3, c: C3, d: C3, t: C3): void {
    this.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) this.col.push(...t);
  }

  box(cx: number, y0: number, cz: number, lx: number, h: number, lz: number, t: C3, yaw = 0): void {
    const hx = lx / 2;
    const hz = lz / 2;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const P = (x: number, y: number, z: number): C3 => [cx + x * c - z * s, y0 + y, cz + x * s + z * c];
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

  /** 4-sided spar between two points, each face wound outward */
  beam(a: C3, b: C3, r: number, t: C3): void {
    const d: C3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(d[0], d[1], d[2]) || 1;
    const dn: C3 = [d[0] / len, d[1] / len, d[2] / len];
    const ref: C3 = Math.abs(dn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const cross = (p: C3, q: C3): C3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    const nrm = (p: C3): C3 => {
      const l = Math.hypot(p[0], p[1], p[2]) || 1;
      return [p[0] / l, p[1] / l, p[2] / l];
    };
    const u = nrm(cross(dn, ref));
    const v = nrm(cross(dn, u));
    const ring = (o: C3): C3[] =>
      [0, 1, 2, 3].map((k): C3 => {
        const cc = Math.cos((k * Math.PI) / 2) * r;
        const ss = Math.sin((k * Math.PI) / 2) * r;
        return [o[0] + u[0] * cc + v[0] * ss, o[1] + u[1] * cc + v[1] * ss, o[2] + u[2] * cc + v[2] * ss];
      });
    const ra = ring(a);
    const rb = ring(b);
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      const p0 = ra[k] as C3;
      const p1 = ra[k2] as C3;
      const p2 = rb[k2] as C3;
      const p3 = rb[k] as C3;
      const n = cross([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]]);
      const m: C3 = [(p0[0] + p2[0]) / 2 - (a[0] + b[0]) / 2, (p0[1] + p2[1]) / 2 - (a[1] + b[1]) / 2, (p0[2] + p2[2]) / 2 - (a[2] + b[2]) / 2];
      if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] >= 0) this.quad(p0, p1, p2, p3, t);
      else this.quad(p3, p2, p1, p0, t);
    }
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('tone', new BufferAttribute(new Float32Array(this.col), 3));
    g.computeVertexNormals();
    return g;
  }
}

/** a local frame at (x, y, z) facing yaw: (forward f, up y, side s) → world */
function frame(x: number, y: number, z: number, yaw: number): (f: number, h: number, s: number) => C3 {
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  return (f, h, s) => [x + f * c - s * sn, y + h, z + f * sn + s * c];
}

export type Pose = 'stand' | 'sit' | 'squat' | 'lie' | 'kneel';

/**
 * A person (box figure, ~1.65 m at k = 1; children ~0.62). `sit` is the
 * scribe's cross-legged seat, `squat` the weaver's or potter's crouch,
 * `kneel` the grinder's, `lie` a patient on a bed (feet toward +f).
 */
export function person(
  w: ColorWriter, rng: Rng, x: number, y: number, z: number, yaw: number,
  pose: Pose, k = 1, kilt: C3 = LINEN,
): void {
  const P = frame(x, y, z, yaw);
  const s = rng.range(0.95, 1.05) * k;
  const skin: C3 = [SKIN[0] * rng.range(0.85, 1.15), SKIN[1] * rng.range(0.85, 1.12), SKIN[2]];
  const at = (f: number, h: number, sd: number): C3 => P(f * s, h * s, sd * s);
  const bx = (f: number, h: number, sd: number, lf: number, lh: number, ls: number, t: C3, dy = 0): void => {
    const p = at(f, h, sd);
    w.box(p[0], p[1], p[2], lf * s, lh * s, ls * s, t, yaw + dy);
  };
  if (pose === 'lie') {
    bx(0.45, 0, 0, 0.8, 0.14, 0.3, skin); // legs
    bx(-0.05, 0, 0, 0.3, 0.2, 0.4, kilt);
    bx(-0.45, 0, 0, 0.55, 0.22, 0.38, skin); // torso
    bx(-0.85, 0.02, 0, 0.22, 0.2, 0.2, skin); // head
    bx(-0.85, 0.2, 0, 0.21, 0.06, 0.21, HAIR);
    w.count++;
    return;
  }
  let hip = 0;
  if (pose === 'stand') {
    for (const sd of [-0.07, 0.07]) bx(0, 0, sd, 0.13, 0.8, 0.12, skin);
    hip = 0.66;
  } else if (pose === 'sit') {
    bx(0.12, 0, 0, 0.42, 0.16, 0.5, skin); // crossed shins
    hip = 0;
  } else if (pose === 'squat') {
    for (const sd of [-0.09, 0.09]) bx(0.1, 0, sd, 0.36, 0.38, 0.12, skin);
    hip = 0.18;
  } else {
    bx(-0.12, 0, 0, 0.42, 0.18, 0.32, skin); // kneeling shins
    hip = 0.2;
  }
  bx(0, hip, 0, 0.27, 0.34, 0.38, kilt);
  const torsoY = hip + (pose === 'stand' ? 0.32 : 0.3);
  const lean = pose === 'kneel' ? 0.12 : 0;
  bx(lean, torsoY, 0, 0.22, 0.52, 0.36, skin);
  for (const sd of [-0.21, 0.21]) {
    if (pose === 'stand') bx(0.02, torsoY - 0.06, sd, 0.1, 0.56, 0.1, skin);
    else bx(0.2 + lean, torsoY + 0.2, sd, 0.42, 0.09, 0.09, skin); // arms forward: board, loom, quern
  }
  const hy = torsoY + 0.52;
  bx(lean, hy, 0, 0.2, 0.22, 0.19, skin);
  bx(lean, hy + 0.17, 0, 0.21, 0.07, 0.2, HAIR);
  w.count++;
}

const DONKEY: C3 = [0.43, 0.41, 0.39];
const DONKEY_PALE: C3 = [0.66, 0.63, 0.58];
const GOAT_TONES: C3[] = [[0.26, 0.2, 0.15], [0.12, 0.1, 0.09], [0.55, 0.47, 0.38], [0.7, 0.66, 0.6]];
const SHEEP: C3 = [0.56, 0.44, 0.31];
const HORN: C3 = [0.5, 0.45, 0.36];
const GOOSE: C3 = [0.5, 0.42, 0.33]; // the Egyptian goose's buff-brown
const GOOSE_PALE: C3 = [0.78, 0.74, 0.66];
const BILL: C3 = [0.72, 0.42, 0.2];
const DOG: C3 = [0.58, 0.44, 0.28];

/** donkey (the Old Kingdom pack animal; panniers optional) */
export function donkey(w: ColorWriter, rng: Rng, x: number, y: number, z: number, yaw: number, panniers = false): void {
  const P = frame(x, y, z, yaw);
  const k = rng.range(0.92, 1.06);
  const t: C3 = [DONKEY[0] * rng.range(0.9, 1.1), DONKEY[1] * rng.range(0.9, 1.08), DONKEY[2]];
  const bx = (f: number, h: number, s: number, lf: number, lh: number, ls: number, c: C3): void => {
    const p = P(f * k, h * k, s * k);
    w.box(p[0], p[1], p[2], lf * k, lh * k, ls * k, c, yaw);
  };
  for (const [f, s] of [[0.42, 0.13], [0.42, -0.13], [-0.42, 0.13], [-0.42, -0.13]] as const) bx(f, 0, s, 0.08, 0.66, 0.08, t);
  bx(0, 0.62, 0, 1.1, 0.44, 0.4, t);
  bx(0, 0.62, 0, 0.9, 0.08, 0.3, DONKEY_PALE); // pale belly
  w.beam(P(0.5 * k, 0.98 * k, 0), P(0.74 * k, 1.28 * k, 0), 0.09 * k, t); // neck
  bx(0.84, 1.16, 0, 0.42, 0.2, 0.18, t);
  bx(1.02, 1.12, 0, 0.12, 0.14, 0.15, DONKEY_PALE); // muzzle
  for (const s of [-0.05, 0.05]) w.beam(P(0.72 * k, 1.34 * k, s * k), P(0.66 * k, 1.62 * k, s * 2.4 * k), 0.025 * k, t); // long ears
  w.beam(P(-0.55 * k, 0.98 * k, 0), P(-0.66 * k, 0.6 * k, 0), 0.025 * k, t); // tail
  if (panniers) {
    for (const s of [-0.32, 0.32]) bx(0, 0.62, s, 0.56, 0.42, 0.24, [0.6, 0.5, 0.32]);
    bx(0, 1.06, 0, 0.6, 0.06, 0.5, [0.5, 0.42, 0.28]);
  }
  w.count++;
}

/** goat: small, upright tail, swept-back horns */
export function goat(w: ColorWriter, rng: Rng, x: number, y: number, z: number, yaw: number): void {
  const P = frame(x, y, z, yaw);
  const k = rng.range(0.85, 1.05);
  const t = GOAT_TONES[rng.int(GOAT_TONES.length)] as C3;
  const bx = (f: number, h: number, s: number, lf: number, lh: number, ls: number, c: C3): void => {
    const p = P(f * k, h * k, s * k);
    w.box(p[0], p[1], p[2], lf * k, lh * k, ls * k, c, yaw);
  };
  for (const [f, s] of [[0.24, 0.09], [0.24, -0.09], [-0.24, 0.09], [-0.24, -0.09]] as const) bx(f, 0, s, 0.06, 0.44, 0.06, t);
  bx(0, 0.42, 0, 0.66, 0.3, 0.26, t);
  w.beam(P(0.3 * k, 0.62 * k, 0), P(0.42 * k, 0.78 * k, 0), 0.06 * k, t);
  bx(0.5, 0.7, 0, 0.24, 0.13, 0.12, t);
  for (const s of [-0.04, 0.04]) w.beam(P(0.46 * k, 0.83 * k, s * k), P(0.32 * k, 0.98 * k, s * 1.6 * k), 0.018 * k, HORN);
  w.beam(P(-0.33 * k, 0.66 * k, 0), P(-0.38 * k, 0.8 * k, 0), 0.025 * k, t); // tail up
  w.count++;
}

/** hair sheep (Ovis longipes): long legs, horizontal twisted horns */
export function sheep(w: ColorWriter, rng: Rng, x: number, y: number, z: number, yaw: number): void {
  const P = frame(x, y, z, yaw);
  const k = rng.range(0.9, 1.05);
  const t: C3 = [SHEEP[0] * rng.range(0.85, 1.12), SHEEP[1] * rng.range(0.85, 1.1), SHEEP[2]];
  const bx = (f: number, h: number, s: number, lf: number, lh: number, ls: number, c: C3): void => {
    const p = P(f * k, h * k, s * k);
    w.box(p[0], p[1], p[2], lf * k, lh * k, ls * k, c, yaw);
  };
  for (const [f, s] of [[0.26, 0.1], [0.26, -0.1], [-0.26, 0.1], [-0.26, -0.1]] as const) bx(f, 0, s, 0.06, 0.5, 0.06, t);
  bx(0, 0.48, 0, 0.74, 0.32, 0.3, t);
  w.beam(P(0.34 * k, 0.7 * k, 0), P(0.44 * k, 0.82 * k, 0), 0.07 * k, t);
  bx(0.53, 0.74, 0, 0.26, 0.14, 0.13, t);
  for (const s of [-1, 1]) w.beam(P(0.48 * k, 0.86 * k, 0.03 * s * k), P(0.46 * k, 0.86 * k, 0.24 * s * k), 0.022 * k, HORN);
  w.count++;
}

/** Egyptian goose, grazing or standing */
export function goose(w: ColorWriter, rng: Rng, x: number, y: number, z: number, yaw: number): void {
  const P = frame(x, y, z, yaw);
  const pale = rng.chance(0.3);
  const t = pale ? GOOSE_PALE : GOOSE;
  const graze = rng.chance(0.4);
  for (const s of [-0.04, 0.04]) {
    const p = P(0, 0, s);
    w.box(p[0], p[1], p[2], 0.03, 0.17, 0.03, BILL, yaw);
  }
  const b = P(0, 0.17, 0);
  w.box(b[0], b[1], b[2], 0.4, 0.2, 0.2, t, yaw);
  const neckTop: C3 = graze ? P(0.3, 0.06, 0) : P(0.2, 0.5, 0);
  w.beam(P(0.16, 0.3, 0), neckTop, 0.03, t);
  w.box(neckTop[0], neckTop[1] - 0.04, neckTop[2], 0.1, 0.08, 0.07, [0.36, 0.3, 0.24], yaw);
  const bill = P(graze ? 0.38 : 0.28, graze ? 0.02 : 0.47, 0);
  w.box(bill[0], bill[1], bill[2], 0.07, 0.03, 0.04, BILL, yaw);
  w.count++;
}

/** tesem hunting dog: slim, pricked ears, tail curled over the back */
export function dog(w: ColorWriter, rng: Rng, x: number, y: number, z: number, yaw: number, lying = false): void {
  const P = frame(x, y, z, yaw);
  const t: C3 = [DOG[0] * rng.range(0.85, 1.12), DOG[1] * rng.range(0.85, 1.1), DOG[2]];
  if (lying) {
    const b = P(0, 0, 0);
    w.box(b[0], b[1], b[2], 0.62, 0.2, 0.24, t, yaw);
    const h = P(0.36, 0.06, 0);
    w.box(h[0], h[1], h[2], 0.22, 0.13, 0.13, t, yaw);
    for (const s of [-0.04, 0.04]) w.beam(P(0.34, 0.19, s), P(0.33, 0.29, s), 0.016, t);
    w.count++;
    return;
  }
  for (const [f, s] of [[0.24, 0.07], [0.24, -0.07], [-0.24, 0.07], [-0.24, -0.07]] as const) {
    const p = P(f, 0, s);
    w.box(p[0], p[1], p[2], 0.05, 0.4, 0.05, t, yaw);
  }
  const b = P(0, 0.38, 0);
  w.box(b[0], b[1], b[2], 0.62, 0.2, 0.2, t, yaw);
  w.beam(P(0.28, 0.52, 0), P(0.36, 0.66, 0), 0.05, t);
  const h = P(0.46, 0.6, 0);
  w.box(h[0], h[1], h[2], 0.26, 0.11, 0.11, t, yaw);
  for (const s of [-0.035, 0.035]) w.beam(P(0.38, 0.71, s), P(0.37, 0.82, s), 0.016, t);
  w.beam(P(-0.3, 0.52, 0), P(-0.22, 0.72, 0), 0.02, t); // the curled tail
  w.beam(P(-0.22, 0.72, 0), P(-0.08, 0.68, 0), 0.02, t);
  w.count++;
}

/** the merged townsfolk mesh: plain tones, figures' roughness */
export function townsfolkMesh(w: ColorWriter, gi: ProbeGI | null, name: string): Mesh {
  const mat = new MeshPhysicalNodeMaterial();
  mat.colorNode = attribute('tone', 'vec3') as unknown as NV3;
  mat.roughnessNode = float(0.8);
  mat.metalnessNode = float(0);
  mat.specularIntensity = 0.25;
  giLightMap(mat, gi, vec3(0, 1, 0) as unknown as NV3, 1.1);
  const m = new Mesh(w.build(), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.name = name;
  return m;
}

/** add to a scene only if anything was written */
export function addTownsfolk(scene: Object3D, w: ColorWriter, gi: ProbeGI | null, name: string): number {
  if (w.count === 0) return 0;
  scene.add(townsfolkMesh(w, gi, name));
  return w.count;
}
