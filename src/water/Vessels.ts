/**
 * Harbor works + vessels (Phase 5, brief §2 floor: ≥12 vessel classes/
 * variants, moored / anchored / beached; Pillar C: boats shifting on the
 * water, cargo on deck — the harbor must read ten-minutes-ago busy).
 *
 * Three hull classes, every vessel individually lofted from seeded params
 * (no two identical):
 *   BARGE    — broad stone-hauler, low freeboard, deck cargo, no mast
 *   TRAVELER — papyriform traveling boat, swept prow/stern, mast + furled
 *              sail + cabin, steering oars
 *   SKIFF    — small papyrus-bundle boat, upswept ends, pale reed tone
 * Plus the stone quay and three wooden piers on piles.
 * All static merged geometry (one draw); bobbing arrives with the Phase-6
 * motion pass.
 */

import { BufferAttribute, BufferGeometry, Mesh, type Scene } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { attribute, float, vec3 } from 'three/tsl';
import type { Rng, WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { giLightMap } from '../monuments/PyramidBuilder';
import type { NV3 } from '../gpu/TSLTypes';
import { NILE_WATER_Y } from '../world/WorldConst';

type V3 = [number, number, number];

class W {
  pos: number[] = [];
  col: number[] = [];
  quad(a: V3, b: V3, c: V3, d: V3, t: V3): void {
    this.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) this.col.push(...t);
  }
  tri(a: V3, b: V3, c: V3, t: V3): void {
    this.pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) this.col.push(...t);
  }
  box(cx: number, y0: number, cz: number, lx: number, h: number, lz: number, t: V3, yaw = 0): void {
    const hx = lx / 2;
    const hz = lz / 2;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const P = (x: number, y: number, z: number): V3 => [
      cx + x * cy - z * sy,
      y0 + y,
      cz + x * sy + z * cy,
    ];
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
  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('tone', new BufferAttribute(new Float32Array(this.col), 3));
    g.computeVertexNormals();
    return g;
  }
}

interface HullParams {
  L: number; // length
  B: number; // beam
  draft: number;
  freeboard: number;
  sweep: number; // prow/stern rise (papyriform ends)
  tone: V3;
}

/** loft a hull at (cx, waterY, cz) rotated by yaw; returns deck height */
function loftHull(w: W, p: HullParams, cx: number, cz: number, yaw: number): number {
  const N = 9;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const P = (x: number, y: number, z: number): V3 => [
    cx + x * cy - z * sy,
    NILE_WATER_Y + y,
    cz + x * sy + z * cy,
  ];
  const half = (f: number): number => (p.B / 2) * Math.pow(Math.sin(Math.PI * f), 0.65);
  const keel = (f: number): number => -p.draft * Math.pow(Math.sin(Math.PI * f), 0.8);
  const deck = (f: number): number =>
    p.freeboard + p.sweep * Math.pow(Math.abs(f - 0.5) * 2, 3.2);
  let prev: { kl: V3; pl: V3; gl: V3; kr: V3; pr: V3; gr: V3 } | null = null;
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    const x = (f - 0.5) * p.L;
    const hb = half(f);
    const yk = keel(f);
    const yd = deck(f);
    const cur = {
      kl: P(x, yk, 0),
      pl: P(x, (yk + yd) * 0.45, -hb),
      gl: P(x, yd, -hb * 0.92),
      kr: P(x, yk, 0),
      pr: P(x, (yk + yd) * 0.45, hb),
      gr: P(x, yd, hb * 0.92),
    };
    if (prev) {
      w.quad(prev.kl, cur.kl, cur.pl, prev.pl, p.tone); // port lower
      w.quad(prev.pl, cur.pl, cur.gl, prev.gl, p.tone); // port upper
      w.quad(cur.kr, prev.kr, prev.pr, cur.pr, p.tone); // starboard lower
      w.quad(cur.pr, prev.pr, prev.gr, cur.gr, p.tone); // starboard upper
      // deck strip between gunwales
      const dt: V3 = [p.tone[0] * 1.15, p.tone[1] * 1.12, p.tone[2] * 1.05];
      w.quad(prev.gl, cur.gl, cur.gr, prev.gr, dt);
    }
    prev = cur;
  }
  return p.freeboard;
}

function barge(w: W, rng: Rng, cx: number, cz: number, yaw: number): void {
  const tone: V3 = [0.45 * rng.range(0.85, 1.1), 0.34 * rng.range(0.85, 1.1), 0.21];
  const L = rng.range(16, 24);
  const B = L * rng.range(0.3, 0.36);
  const deck = loftHull(w, { L, B, draft: 1.1, freeboard: 0.75, sweep: rng.range(0.4, 0.9), tone }, cx, cz, yaw);
  // deck cargo: stone block or jar clusters
  const n = rng.int(4) + 2;
  for (let i = 0; i < n; i++) {
    const fx = rng.range(-0.28, 0.28) * L;
    const t: V3 = rng.chance(0.5) ? [0.72, 0.68, 0.58] : [0.55, 0.4, 0.28];
    const s = rng.range(0.8, 1.7);
    w.box(
      cx + fx * Math.cos(yaw), NILE_WATER_Y + deck, cz + fx * Math.sin(yaw),
      s, rng.range(0.5, 1.1), s * rng.range(0.7, 1.2), t, yaw,
    );
  }
}

function traveler(w: W, rng: Rng, cx: number, cz: number, yaw: number): void {
  const tone: V3 = [0.5 * rng.range(0.85, 1.05), 0.36, 0.22];
  const L = rng.range(13, 19);
  const B = L * 0.24;
  const deck = loftHull(
    w,
    { L, B, draft: 0.8, freeboard: 0.85, sweep: rng.range(1.2, 2.2), tone },
    cx, cz, yaw,
  );
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  // cabin amidships
  w.box(cx - 0.1 * L * cy, NILE_WATER_Y + deck, cz - 0.1 * L * sy, L * 0.22, 1.15, B * 0.62, [0.66, 0.58, 0.42], yaw);
  // bipod mast + yard + furled sail roll
  const mx = cx + 0.12 * L * cy;
  const mz = cz + 0.12 * L * sy;
  const mh = L * 0.55;
  w.box(mx, NILE_WATER_Y + deck, mz, 0.16, mh, 0.16, [0.42, 0.3, 0.18], yaw);
  w.box(mx, NILE_WATER_Y + deck + mh * 0.88, mz, 0.14, 0.14, L * 0.42, [0.4, 0.29, 0.17], yaw + Math.PI / 2);
  w.box(mx, NILE_WATER_Y + deck + mh * 0.88 - 0.24, mz, 0.3, 0.28, L * 0.4, [0.78, 0.72, 0.58], yaw + Math.PI / 2);
  // twin steering oars at the stern quarter
  for (const s of [-1, 1]) {
    w.box(
      cx - 0.46 * L * cy - s * sy * B * 0.42, NILE_WATER_Y + deck - 0.6,
      cz - 0.46 * L * sy + s * cy * B * 0.42,
      0.12, 2.4, 0.12, [0.4, 0.3, 0.18], yaw,
    );
  }
}

function skiff(w: W, rng: Rng, cx: number, cz: number, yaw: number): void {
  const tone: V3 = [0.6 * rng.range(0.9, 1.1), 0.53 * rng.range(0.9, 1.05), 0.34];
  const L = rng.range(4.5, 7);
  loftHull(
    w,
    { L, B: L * 0.26, draft: 0.28, freeboard: 0.35, sweep: rng.range(0.7, 1.2), tone },
    cx, cz, yaw,
  );
}

export function buildHarbor(
  scene: Scene,
  seed: WorldSeed,
  gi: ProbeGI | null,
): number {
  const rng = seed.rng('harbor');
  const w = new W();
  let vessels = 0;

  /* --- stone quay along the harbor's west rim ------------------------------ */
  const quayX = 880;
  w.box(quayX, NILE_WATER_Y - 2.5, -135, 14, 3.6, 300, [0.68, 0.62, 0.5]);
  // mooring bollards
  for (let i = 0; i < 9; i++) {
    w.box(quayX + 5.4, NILE_WATER_Y + 1.1, -270 + i * 34, 0.4, 0.7, 0.4, [0.5, 0.45, 0.36]);
  }

  /* --- three timber piers on piles ----------------------------------------- */
  for (const pz of [-230, -130, -30]) {
    const len = rng.range(46, 64);
    for (let x = 0; x < len; x += 4.2) {
      for (const s of [-1, 1]) {
        w.box(quayX + 8 + x, NILE_WATER_Y - 2.2, pz + s * 1.7, 0.34, 3.4, 0.34, [0.38, 0.28, 0.17]);
      }
    }
    w.box(quayX + 8 + len / 2, NILE_WATER_Y + 1.0, pz, len, 0.22, 4.6, [0.5, 0.38, 0.24]);
    // dockside clutter: crates/jars on the deck
    const n = rng.int(5) + 2;
    for (let i = 0; i < n; i++) {
      w.box(
        quayX + 10 + rng.float() * (len - 6), NILE_WATER_Y + 1.22, pz + rng.range(-1.4, 1.4),
        rng.range(0.5, 1), rng.range(0.4, 0.9), rng.range(0.5, 1), [0.6, 0.47, 0.3],
      );
    }
    // moored vessels flanking each pier
    barge(w, rng, quayX + 12 + rng.float() * 24, pz - 7.5, rng.range(-0.12, 0.12));
    traveler(w, rng, quayX + 14 + rng.float() * 24, pz + 7.5, Math.PI + rng.range(-0.12, 0.12));
    vessels += 2;
  }

  /* --- anchored in the basin ------------------------------------------------ */
  for (let i = 0; i < 6; i++) {
    const x = rng.range(1050, 1240);
    const z = rng.range(-230, -40);
    const yawB = rng.float() * Math.PI * 2;
    if (i % 3 === 0) barge(w, rng, x, z, yawB);
    else if (i % 3 === 1) traveler(w, rng, x, z, yawB);
    else skiff(w, rng, x, z, yawB);
    vessels++;
  }

  /* --- on the river: traffic + beached skiffs ------------------------------- */
  for (const [x, z] of [
    [1985, -650], [1930, 240], [2010, 820], [1950, 1400],
  ] as const) {
    if (rng.chance(0.5)) traveler(w, rng, x, z, rng.range(-0.3, 0.3));
    else barge(w, rng, x, z, rng.range(-0.3, 0.3) + Math.PI);
    vessels++;
  }
  for (let i = 0; i < 5; i++) {
    // beached on the west bank margin
    const z = rng.range(-500, 1200);
    skiff(w, rng, 1830 + rng.range(-14, 6), z, rng.range(0.8, 2.2));
    vessels++;
  }

  const mat = new MeshPhysicalNodeMaterial();
  const tone = attribute('tone', 'vec3') as unknown as NV3;
  mat.colorNode = vec3(1, 1, 1).mul(tone);
  mat.roughnessNode = float(0.72);
  mat.metalnessNode = float(0);
  mat.specularIntensity = 0.35;
  giLightMap(mat, gi, vec3(0, 1, 0) as unknown as NV3, 1.0);
  const mesh = new Mesh(w.build(), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return vessels;
}
