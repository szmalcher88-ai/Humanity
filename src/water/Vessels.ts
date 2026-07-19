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

import { BufferAttribute, BufferGeometry, Mesh, type Object3D } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { attribute, float, vec3 } from 'three/tsl';
import type { Rng, WorldSeed } from '../core/Seed';
import type { Heightfield } from '../world/Heightfield';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { fpReg } from '../debug/Footprints';
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

let hullSeq = 0;

/** loft a hull at (cx, baseY, cz) rotated by yaw; returns deck height.
 *  baseY = waterline for afloat hulls, ground+draft for beached ones */
function loftHull(
  w: W,
  p: HullParams,
  cx: number,
  cz: number,
  yaw: number,
  baseY: number,
): number {
  fpReg({
    id: `vessel:${hullSeq++}`, family: 'vessels', x: cx, z: cz,
    hx: p.L / 2, hz: p.B / 2, yaw,
    y0: baseY - p.draft, y1: baseY + p.freeboard + p.sweep,
    ground: 'afloat', draft: p.draft, intra: true,
  });
  const N = 9;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const P = (x: number, y: number, z: number): V3 => [
    cx + x * cy - z * sy,
    baseY + y,
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
      // deck strip between gunwales — wound UPWARD (the first winding faced
      // down and was backface-culled: open hulls showed the water plane
      // inside, reading as swamped boats)
      const dt: V3 = [p.tone[0] * 1.15, p.tone[1] * 1.12, p.tone[2] * 1.05];
      w.quad(prev.gl, prev.gr, cur.gr, cur.gl, dt);
    }
    prev = cur;
  }
  return p.freeboard;
}

function barge(w: W, rng: Rng, cx: number, cz: number, yaw: number, y: number): void {
  const tone: V3 = [0.45 * rng.range(0.85, 1.1), 0.34 * rng.range(0.85, 1.1), 0.21];
  const L = rng.range(16, 24);
  const B = L * rng.range(0.3, 0.36);
  // freeboard raised (0.75 → 1.2): the silty water is opaque at the
  // surface, so a low-riding hull read as swamped — waterline art needs
  // real height above water, not survey-accurate laden trim
  const deck = loftHull(w, { L, B, draft: 0.9, freeboard: 1.2, sweep: rng.range(0.4, 0.9), tone }, cx, cz, yaw, y);
  // deck cargo: stone block or jar clusters
  const n = rng.int(4) + 2;
  for (let i = 0; i < n; i++) {
    const fx = rng.range(-0.28, 0.28) * L;
    const t: V3 = rng.chance(0.5) ? [0.72, 0.68, 0.58] : [0.55, 0.4, 0.28];
    const s = rng.range(0.8, 1.7);
    w.box(
      cx + fx * Math.cos(yaw), y + deck, cz + fx * Math.sin(yaw),
      s, rng.range(0.5, 1.1), s * rng.range(0.7, 1.2), t, yaw,
    );
  }
}

function traveler(w: W, rng: Rng, cx: number, cz: number, yaw: number, y: number): void {
  const tone: V3 = [0.5 * rng.range(0.85, 1.05), 0.36, 0.22];
  const L = rng.range(13, 19);
  const B = L * 0.24;
  const deck = loftHull(
    w,
    { L, B, draft: 0.6, freeboard: 1.15, sweep: rng.range(1.2, 2.2), tone },
    cx, cz, yaw, y,
  );
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  // cabin amidships
  w.box(cx - 0.1 * L * cy, y + deck, cz - 0.1 * L * sy, L * 0.22, 1.15, B * 0.62, [0.66, 0.58, 0.42], yaw);
  // bipod mast + yard + furled sail roll
  const mx = cx + 0.12 * L * cy;
  const mz = cz + 0.12 * L * sy;
  const mh = L * 0.55;
  w.box(mx, y + deck, mz, 0.16, mh, 0.16, [0.42, 0.3, 0.18], yaw);
  w.box(mx, y + deck + mh * 0.88, mz, 0.14, 0.14, L * 0.42, [0.4, 0.29, 0.17], yaw + Math.PI / 2);
  w.box(mx, y + deck + mh * 0.88 - 0.24, mz, 0.3, 0.28, L * 0.4, [0.78, 0.72, 0.58], yaw + Math.PI / 2);
  // twin steering oars at the stern quarter
  for (const s of [-1, 1]) {
    w.box(
      cx - 0.46 * L * cy - s * sy * B * 0.42, y + deck - 0.6,
      cz - 0.46 * L * sy + s * cy * B * 0.42,
      0.12, 2.4, 0.12, [0.4, 0.3, 0.18], yaw,
    );
  }
}

function skiff(w: W, rng: Rng, cx: number, cz: number, yaw: number, y: number): void {
  const tone: V3 = [0.6 * rng.range(0.9, 1.1), 0.53 * rng.range(0.9, 1.05), 0.34];
  const L = rng.range(4.5, 7);
  loftHull(
    w,
    { L, B: L * 0.26, draft: 0.2, freeboard: 0.5, sweep: rng.range(0.7, 1.2), tone },
    cx, cz, yaw, y,
  );
}

export function buildHarbor(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
): number {
  const rng = seed.rng('harbor');
  const w = new W();
  let vessels = 0;
  hullSeq = 0;

  /** waterline for an afloat hull — but if the bed is too shallow for the
   *  draft (bank margins, sandbars), seat the keel ON the ground instead.
   *  Fixed-Y placement half-buried the beached skiffs and floated others. */
  const floatY = (x: number, z: number, draft: number): number => {
    const bed = hf.heightAtCpu(x, z);
    return bed > NILE_WATER_Y - draft - 0.25 ? bed + draft * 0.85 : NILE_WATER_Y;
  };

  /** eastward probe for the REAL waterline: first x with `depth` m of water.
   *  The harbor works used a fixed x=880 — after sand transport the actual
   *  bank lies further east there, which left quay runs and moored boats
   *  sitting on dry beach. */
  const shoreX = (z: number, depth: number): number => {
    let x = 860;
    while (x < 1400 && hf.heightAtCpu(x + 8, z) > NILE_WATER_Y - depth) x += 8;
    return x;
  };

  /* --- stone quay: ONE straight run on the west bank ------------------------ */
  // seated at the most seaward shoreline point of its run, so the whole
  // face stands in water (reads as a built mole; stepped per-z segments
  // scattered into disconnected slabs along the curved bank)
  {
    const qz0 = -225;
    const qz1 = -45;
    let qx = 0;
    for (let z = qz0; z <= qz1; z += 30) qx = Math.max(qx, shoreX(z, 1.6));
    qx += 2;
    w.box(qx, NILE_WATER_Y - 4.5, (qz0 + qz1) / 2, 14, 5.6, qz1 - qz0, [0.68, 0.62, 0.5]);
    for (let i = 0; i < 6; i++) {
      w.box(qx + 5.4, NILE_WATER_Y + 1.1, qz0 + 15 + i * 30, 0.4, 0.7, 0.4, [0.5, 0.45, 0.36]);
    }
    fpReg({
      id: 'quay', family: 'harbor-works', x: qx, z: (qz0 + qz1) / 2,
      hx: 7, hz: (qz1 - qz0) / 2, y0: NILE_WATER_Y - 4.5, y1: NILE_WATER_Y + 1.1,
      ground: 'none',
    });
  }

  /* --- three timber piers on piles, rooted at the local shoreline ----------- */
  for (const pz of [-230, -130, -30]) {
    const px0 = shoreX(pz, 1.2) - 10; // start on the beach, run out to depth
    const len = rng.range(46, 64);
    for (let x = 0; x < len; x += 4.2) {
      for (const s of [-1, 1]) {
        const bed = hf.heightAtCpu(px0 + x, pz);
        const py = Math.min(NILE_WATER_Y - 2.2, bed - 0.4);
        w.box(px0 + x, py, pz + s * 1.7, 0.34, NILE_WATER_Y + 1.2 - py, 0.34, [0.38, 0.28, 0.17]);
      }
    }
    w.box(px0 + len / 2, NILE_WATER_Y + 1.0, pz, len, 0.22, 4.6, [0.5, 0.38, 0.24]);
    fpReg({
      id: `pier:${pz}`, family: 'harbor-works', x: px0 + len / 2, z: pz,
      hx: len / 2, hz: 2.3, y0: NILE_WATER_Y + 1.0, y1: NILE_WATER_Y + 1.9,
      ground: 'none',
    });
    // dockside clutter: crates/jars on the deck
    const n = rng.int(5) + 2;
    for (let i = 0; i < n; i++) {
      w.box(
        px0 + 4 + rng.float() * (len - 8), NILE_WATER_Y + 1.22, pz + rng.range(-1.4, 1.4),
        rng.range(0.5, 1), rng.range(0.4, 0.9), rng.range(0.5, 1), [0.6, 0.47, 0.3],
      );
    }
    // moored vessels flanking the pier's outer (deep) half
    {
      const bx = px0 + len - 6 - rng.float() * 18;
      const tx = px0 + len - 8 - rng.float() * 18;
      barge(w, rng, bx, pz - 7.5, rng.range(-0.12, 0.12), floatY(bx, pz - 7.5, 0.9));
      traveler(w, rng, tx, pz + 7.5, Math.PI + rng.range(-0.12, 0.12), floatY(tx, pz + 7.5, 0.6));
      vessels += 2;
    }
  }

  /* --- anchored in the basin (rejection-sampled: no overlapping hulls) ------ */
  const anchored: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 12; tries++) {
      x = rng.range(1050, 1240);
      z = rng.range(-230, -40);
      if (anchored.every(([ax, az]) => Math.hypot(ax - x, az - z) > 26)) break;
    }
    anchored.push([x, z]);
    const yawB = rng.float() * Math.PI * 2;
    if (i % 3 === 0) barge(w, rng, x, z, yawB, floatY(x, z, 0.9));
    else if (i % 3 === 1) traveler(w, rng, x, z, yawB, floatY(x, z, 0.6));
    else skiff(w, rng, x, z, yawB, floatY(x, z, 0.2));
    vessels++;
  }

  /* --- on the river: traffic + beached skiffs ------------------------------- */
  for (const [x0, z] of [
    [1985, -650], [1930, 240], [2010, 820], [1950, 1400],
  ] as const) {
    // snap to deep water: probe eastward for a spot with real depth so the
    // meandering channel never leaves a hull sitting on a sandbar
    let x = x0;
    for (let p = 0; p < 8 && hf.heightAtCpu(x, z) > NILE_WATER_Y - 2.2; p++) x += 12;
    if (rng.chance(0.5)) traveler(w, rng, x, z, rng.range(-0.3, 0.3), floatY(x, z, 0.6));
    else barge(w, rng, x, z, rng.range(-0.3, 0.3) + Math.PI, floatY(x, z, 0.9));
    vessels++;
  }
  for (let i = 0; i < 5; i++) {
    // beached on the west bank — walk east across the floodplain to the
    // actual shoreline for THIS z (a fixed x landed skiffs on the river
    // bottom where the channel meanders west; collision audit caught it)
    const z = rng.range(-500, 1200);
    let sx = 1750;
    while (sx < 1980 && hf.heightAtCpu(sx + 4, z) > NILE_WATER_Y + 0.25) sx += 4;
    const x = sx - 5 + rng.range(-3, 2);
    skiff(w, rng, x, z, rng.range(0.8, 2.2), hf.heightAtCpu(x, z) + 0.17);
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
