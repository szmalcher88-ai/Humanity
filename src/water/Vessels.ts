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
 * All merged geometry (one draw); each afloat hull heaves and tilts in the
 * vertex stage (bobA/bobB attributes stamped per hull scope), and its crew
 * (v1.2: polers, rowers facing the stern, a steersman, a fisherman per
 * skiff) is built inside the same scope, so they ride with the boat.
 */

import { BufferAttribute, BufferGeometry, Mesh, type Object3D } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { attribute, float, positionLocal, sin, vec2, vec3 } from 'three/tsl';
import { uWorldTime } from '../render/WorldClock';
import type { Rng, WorldSeed } from '../core/Seed';
import type { Heightfield } from '../world/Heightfield';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { fpReg } from '../debug/Footprints';
import { giLightMap } from '../monuments/PyramidBuilder';
import type { NV3, NV4 } from '../gpu/TSLTypes';
import { NILE_WATER_Y } from '../world/WorldConst';

type V3 = [number, number, number];

class W {
  pos: number[] = [];
  col: number[] = [];
  bobA: number[] = []; // per-vertex: hull cx, cz, phase, heave amp
  bobB: number[] = []; // per-vertex: tilt dir x, z, freq, tilt amp
  private curA: [number, number, number, number] = [0, 0, 0, 0];
  private curB: [number, number, number, number] = [0, 0, 1, 0];
  /** everything written until endBob() rides THIS hull's motion */
  beginBob(
    cx: number, cz: number, phase: number, amp: number,
    dx: number, dz: number, freq: number, tilt: number,
  ): void {
    this.curA = [cx, cz, phase, amp];
    this.curB = [dx, dz, freq, tilt];
  }
  endBob(): void {
    this.curA = [0, 0, 0, 0];
    this.curB = [0, 0, 1, 0];
  }
  quad(a: V3, b: V3, c: V3, d: V3, t: V3): void {
    this.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) {
      this.col.push(...t);
      this.bobA.push(...this.curA);
      this.bobB.push(...this.curB);
    }
  }
  tri(a: V3, b: V3, c: V3, t: V3): void {
    this.pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) {
      this.col.push(...t);
      this.bobA.push(...this.curA);
      this.bobB.push(...this.curB);
    }
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
    g.setAttribute('bobA', new BufferAttribute(new Float32Array(this.bobA), 4));
    g.setAttribute('bobB', new BufferAttribute(new Float32Array(this.bobB), 4));
    g.computeVertexNormals();
    return g;
  }
}

/* ------------------------------------------------------------------ */
/* crews (v1.1 detail pass)                                             */
/* ------------------------------------------------------------------ */

/** crew figures built in the season's last count — read by the scene HUD */
export let crewCount = 0;

/** deck height above the waterline frame and half-beam at hull-local x —
 *  the same curves loftHull lofts (f = x/L + 0.5) */
function hullAt(L: number, B: number, freeboard: number, sweep: number, x: number): { deck: number; half: number } {
  const f = Math.min(Math.max(x / L + 0.5, 0), 1);
  return {
    deck: freeboard + sweep * Math.pow(Math.abs(f - 0.5) * 2, 3.2),
    half: (B / 2) * Math.pow(Math.sin(Math.PI * f), 0.65),
  };
}

/** a slanted 4-sided beam between two world points (poles, oars) — box()
 *  only yaws; each side quad is wound outward from the axis */
function beam(w: W, a: V3, b: V3, r: number, t: V3): void {
  const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(d[0], d[1], d[2]) || 1;
  const dn: V3 = [d[0] / len, d[1] / len, d[2] / len];
  const ref: V3 = Math.abs(dn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cross = (p: V3, q: V3): V3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const nrm = (p: V3): V3 => {
    const l = Math.hypot(p[0], p[1], p[2]) || 1;
    return [p[0] / l, p[1] / l, p[2] / l];
  };
  const u = nrm(cross(dn, ref));
  const v = nrm(cross(dn, u));
  const ring = (o: V3): V3[] =>
    [0, 1, 2, 3].map((k) => {
      const c = Math.cos((k * Math.PI) / 2) * r;
      const s = Math.sin((k * Math.PI) / 2) * r;
      return [o[0] + u[0] * c + v[0] * s, o[1] + u[1] * c + v[1] * s, o[2] + u[2] * c + v[2] * s] as V3;
    });
  const ra = ring(a);
  const rb = ring(b);
  for (let k = 0; k < 4; k++) {
    const k2 = (k + 1) % 4;
    const p0 = ra[k] as V3;
    const p1 = ra[k2] as V3;
    const p2 = rb[k2] as V3;
    const p3 = rb[k] as V3;
    // outward test: face normal against the offset from the axis
    const n = cross([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]]);
    const mid: V3 = [(p0[0] + p2[0]) / 2 - (a[0] + b[0]) / 2, (p0[1] + p2[1]) / 2 - (a[1] + b[1]) / 2, (p0[2] + p2[2]) / 2 - (a[2] + b[2]) / 2];
    if (n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2] >= 0) w.quad(p0, p1, p2, p3, t);
    else w.quad(p3, p2, p1, p0, t);
  }
}

type Pose = 'stand' | 'sit';
const SKIN: V3 = [0.36, 0.22, 0.13];
const LINEN: V3 = [0.82, 0.79, 0.7];
const HAIR: V3 = [0.11, 0.09, 0.08];

/**
 * One boatman at hull-local (lx, lz), feet on the deck at world y = base,
 * facing hull-local +x rotated by `face` (π = facing the stern, as Egyptian
 * rowers sat). Built of boxes in the hull's own bob scope, so he heaves with
 * the boat. ~1.65 m standing (Old Kingdom male mean), seated on the deck.
 */
function boatman(
  w: W, crng: Rng, cx: number, cz: number, yaw: number,
  lx: number, lz: number, base: number, pose: Pose, face = 0,
): void {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const wx = cx + lx * cy - lz * sy;
  const wz = cz + lx * sy + lz * cy;
  const fy = yaw + face;
  const fc = Math.cos(fy);
  const fs = Math.sin(fy);
  /** figure-local (forward f, side s) → world */
  const at = (f: number, s: number): [number, number] => [wx + f * fc - s * fs, wz + f * fs + s * fc];
  const k = crng.range(0.95, 1.06);
  const skin: V3 = [SKIN[0] * crng.range(0.85, 1.15), SKIN[1] * crng.range(0.85, 1.12), SKIN[2]];
  if (pose === 'stand') {
    for (const s of [-0.07, 0.07]) {
      const [x, z] = at(0, s);
      w.box(x, base, z, 0.13, 0.8 * k, 0.12, skin, fy);
    }
    w.box(wx, base + 0.66 * k, wz, 0.27, 0.34 * k, 0.36, LINEN, fy); // kilt
    w.box(wx, base + 0.98 * k, wz, 0.22, 0.52 * k, 0.36, skin, fy); // torso
    for (const s of [-0.22, 0.22]) {
      const [x, z] = at(0.02, s);
      w.box(x, base + 0.92 * k, z, 0.1, 0.56 * k, 0.1, skin, fy);
    }
  } else {
    const [lxs, lzs] = at(0.22, 0);
    w.box(lxs, base, lzs, 0.5, 0.18, 0.3, skin, fy); // thighs along the deck
    w.box(wx, base, wz, 0.3, 0.34, 0.36, LINEN, fy); // seated kilt
    w.box(wx, base + 0.32, wz, 0.22, 0.5 * k, 0.36, skin, fy); // torso
    for (const s of [-0.21, 0.21]) {
      const [x, z] = at(0.2, s);
      w.box(x, base + 0.56 * k, z, 0.42, 0.09, 0.09, skin, fy); // arms forward
    }
  }
  const hy = base + (pose === 'stand' ? 1.5 : 0.82) * k;
  w.box(wx, hy, wz, 0.2, 0.22, 0.19, skin, fy); // head
  w.box(wx, hy + 0.17, wz, 0.21, 0.07, 0.2, HAIR, fy); // hair
  crewCount++;
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
      // (v1.1) wound OUTWARD: all four side strips used to face into the
      // hull, so from outside they were back faces and got culled — every
      // boat showed the inside of its far side through a missing near side
      w.quad(prev.pl, cur.pl, cur.kl, prev.kl, p.tone); // port lower
      w.quad(prev.gl, cur.gl, cur.pl, prev.pl, p.tone); // port upper
      w.quad(cur.pr, prev.pr, prev.kr, cur.kr, p.tone); // starboard lower
      w.quad(cur.gr, prev.gr, prev.pr, cur.pr, p.tone); // starboard upper
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

/** start hull motion scope: heave+tilt when actually afloat, dead still
 *  when seated on the bank/bed */
function bobScope(w: W, rng: Rng, cx: number, cz: number, y: number, amp: number, tilt: number): void {
  const afloat = Math.abs(y - NILE_WATER_Y) < 0.01;
  const dir = rng.float() * Math.PI * 2;
  w.beginBob(
    cx, cz, rng.float() * Math.PI * 2, afloat ? amp : 0,
    Math.cos(dir), Math.sin(dir), rng.range(0.45, 0.75), afloat ? tilt : 0,
  );
}

function barge(
  w: W, rng: Rng, cx: number, cz: number, yaw: number, y: number,
  crew: Rng | null = null, moored = false,
): void {
  bobScope(w, rng, cx, cz, y, 0.045, 0.004);
  const tone: V3 = [0.45 * rng.range(0.85, 1.1), 0.34 * rng.range(0.85, 1.1), 0.21];
  const L = rng.range(16, 24);
  const B = L * rng.range(0.3, 0.36);
  // freeboard raised (0.75 → 1.2): the silty water is opaque at the
  // surface, so a low-riding hull read as swamped — waterline art needs
  // real height above water, not survey-accurate laden trim
  const sweep = rng.range(0.4, 0.9);
  const deck = loftHull(w, { L, B, draft: 0.9, freeboard: 1.2, sweep, tone }, cx, cz, yaw, y);
  // crew (v1.1): polers at bow and stern working their poles into the bed,
  // and a hand or two sitting by the cargo — own rng stream, so a crew
  // never re-lays the fleet. Afloat hulls only.
  if (crew && Math.abs(y - NILE_WATER_Y) < 0.01) {
    const cyw = Math.cos(yaw);
    const syw = Math.sin(yaw);
    const W2 = (lx: number, lz: number, ly: number): V3 => [cx + lx * cyw - lz * syw, ly, cz + lx * syw + lz * cyw];
    for (const end of moored ? [-1] : [-1, 1]) {
      const lx = end * 0.36 * L;
      const h = hullAt(L, B, 1.2, sweep, lx);
      const side = crew.chance(0.5) ? 1 : -1;
      const lz = side * h.half * 0.42;
      boatman(w, crew, cx, cz, yaw, lx, lz, y + h.deck, 'stand', end > 0 ? Math.PI : 0);
      // the pole: from the hands, slanting outboard and aft into the water
      beam(
        w, W2(lx + 0.15, lz + side * 0.25, y + h.deck + 1.45),
        W2(lx - end * 1.6, lz + side * (h.half + 1.2), NILE_WATER_Y - 2.4), 0.05, [0.4, 0.3, 0.18],
      );
    }
    const sitters = crew.int(3);
    for (let i = 0; i < sitters; i++) {
      const lx = (crew.chance(0.5) ? 1 : -1) * crew.range(0.31, 0.34) * L;
      const h = hullAt(L, B, 1.2, sweep, lx);
      boatman(w, crew, cx, cz, yaw, lx, crew.range(-0.3, 0.3) * h.half, y + h.deck, 'sit', crew.float() * Math.PI * 2);
    }
  }
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
  w.endBob();
}

function traveler(
  w: W, rng: Rng, cx: number, cz: number, yaw: number, y: number,
  crew: Rng | null = null, moored = false,
): void {
  bobScope(w, rng, cx, cz, y, 0.06, 0.007);
  const tone: V3 = [0.5 * rng.range(0.85, 1.05), 0.36, 0.22];
  const L = rng.range(13, 19);
  const B = L * 0.24;
  const sweep = rng.range(1.2, 2.2);
  const deck = loftHull(
    w,
    { L, B, draft: 0.6, freeboard: 1.15, sweep, tone },
    cx, cz, yaw, y,
  );
  // crew (v1.1): rowers in pairs forward of the mast, sitting FACING THE
  // STERN as Egyptian rowers did, oars slanting into the water; a
  // steersman standing on the raised stern deck between the steering oars.
  // A moored boat keeps the steersman and one pair. Afloat hulls only.
  if (crew && Math.abs(y - NILE_WATER_Y) < 0.01) {
    const cyw = Math.cos(yaw);
    const syw = Math.sin(yaw);
    const W2 = (lx: number, lz: number, ly: number): V3 => [cx + lx * cyw - lz * syw, ly, cz + lx * syw + lz * cyw];
    const benches = moored ? [0.22] : [0.18, 0.25, 0.32];
    for (const fx of benches) {
      const lx = fx * L;
      const h = hullAt(L, B, 1.15, sweep, lx);
      for (const side of [-1, 1]) {
        const lz = side * h.half * 0.5;
        boatman(w, crew, cx, cz, yaw, lx, lz, y + h.deck, 'sit', Math.PI);
        if (!moored) {
          beam(
            w, W2(lx - 0.25, side * h.half * 0.92, y + h.deck + 0.55),
            W2(lx - 0.9, side * (h.half + 2.6), NILE_WATER_Y - 0.05), 0.04, [0.42, 0.31, 0.19],
          );
        }
      }
    }
    const sx = -0.4 * L;
    const hs = hullAt(L, B, 1.15, sweep, sx);
    boatman(w, crew, cx, cz, yaw, sx, 0, y + hs.deck, 'stand', 0);
  }
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
  w.endBob();
}

/**
 * @param toward  fishing mode (v1.2): the point the seine runs to. The skiff
 *                then carries TWO men — a paddler forward, a hauler aft on the
 *                net side — and returns the hauler's hands for the net line.
 */
function skiff(
  w: W, rng: Rng, cx: number, cz: number, yaw: number, y: number,
  crew: Rng | null = null, toward: [number, number] | null = null,
): V3 | null {
  let hands: V3 | null = null;
  bobScope(w, rng, cx, cz, y, 0.1, 0.012);
  const tone: V3 = [0.6 * rng.range(0.9, 1.1), 0.53 * rng.range(0.9, 1.05), 0.34];
  const L = rng.range(4.5, 7);
  const sweep = rng.range(0.7, 1.2);
  loftHull(
    w,
    { L, B: L * 0.26, draft: 0.2, freeboard: 0.5, sweep, tone },
    cx, cz, yaw, y,
  );
  // crew (v1.1): one fisherman/ferryman — standing with a pole or sitting
  // with a paddle. Afloat only.
  if (crew && Math.abs(y - NILE_WATER_Y) < 0.01) {
    const B = L * 0.26;
    const cyw = Math.cos(yaw);
    const syw = Math.sin(yaw);
    const W2 = (lx: number, lz: number, ly: number): V3 => [cx + lx * cyw - lz * syw, ly, cz + lx * syw + lz * cyw];
    if (toward) {
      // which hull side faces the net: local +z is world (-sin yaw, cos yaw)
      const side = (toward[0] - cx) * -syw + (toward[1] - cz) * cyw >= 0 ? 1 : -1;
      const hp = hullAt(L, B, 0.5, sweep, 0.2 * L);
      boatman(w, crew, cx, cz, yaw, 0.2 * L, 0, y + hp.deck, 'sit', 0);
      beam(w, W2(0.2 * L + 0.25, -side * hp.half * 0.9, y + hp.deck + 0.5), W2(0.2 * L - 0.3, -side * (hp.half + 0.9), NILE_WATER_Y - 0.3), 0.035, [0.42, 0.31, 0.19]);
      const lx = -0.16 * L;
      const hh = hullAt(L, B, 0.5, sweep, lx);
      boatman(w, crew, cx, cz, yaw, lx, side * hh.half * 0.3, y + hh.deck, 'stand', side * Math.PI / 2);
      hands = W2(lx, side * (hh.half * 0.3 + 0.32), y + hh.deck + 0.95);
    } else if (crew.chance(0.55)) {
      const lx = -0.18 * L;
      const h = hullAt(L, B, 0.5, sweep, lx);
      boatman(w, crew, cx, cz, yaw, lx, 0, y + h.deck, 'stand', 0);
      beam(w, W2(lx + 0.12, 0.25, y + h.deck + 1.4), W2(lx - 1.4, h.half + 1.0, NILE_WATER_Y - 1.6), 0.04, [0.4, 0.3, 0.18]);
    } else {
      const h = hullAt(L, B, 0.5, sweep, 0);
      boatman(w, crew, cx, cz, yaw, 0, 0, y + h.deck, 'sit', 0);
      beam(w, W2(0.25, h.half * 0.9, y + h.deck + 0.5), W2(-0.3, h.half + 0.9, NILE_WATER_Y - 0.3), 0.035, [0.42, 0.31, 0.19]);
    }
  }
  w.endBob();
  return hands;
}

/**
 * Seine fishing (v1.2, canon "fishermen" on the reach): two papyrus skiffs
 * drawing a net between them — the scene of every Old Kingdom marsh-life
 * tomb wall. The net hangs from a line of wooden floats in a downstream
 * arc; its skirt drops into the silty water (both windings: seen from
 * either side). Static — the skiffs heave, the floats lie still.
 */
function seine(
  w: W, rng: Rng, crew: Rng, hf: Heightfield,
  floatY: (x: number, z: number, draft: number, yaw?: number, half?: number) => number,
  x0: number, z: number,
): number {
  // probe east from the floodplain into water deep enough for both hulls
  // and the net's sag (1.1 m at the middle of the arc)
  let x = x0;
  for (let p = 0; p < 60 && hf.heightAtCpu(x, z) > NILE_WATER_Y - 1.4; p++) x += 6;
  const gap = rng.range(20, 28);
  const xb = x + gap;
  if (hf.heightAtCpu(x, z) > NILE_WATER_Y - 1.4 || hf.heightAtCpu(xb, z) > NILE_WATER_Y - 1.4) return 0;
  // hulls head upstream (+z), the net trails downstream (-z)
  const yawA = Math.PI / 2 + rng.range(-0.15, 0.15);
  const yawB = Math.PI / 2 + rng.range(-0.15, 0.15);
  const ya = floatY(x, z, 0.2, yawA, 2.6);
  const yb = floatY(xb, z, 0.2, yawB, 2.6);
  const ha = skiff(w, rng, x, z, yawA, ya, crew, [xb, z]);
  const hb = skiff(w, rng, xb, z, yawB, yb, crew, [x, z]);
  if (!ha || !hb) return 2;
  const bulge = gap * rng.range(0.35, 0.5);
  const N = 18;
  const pts: V3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push([
      ha[0] + (hb[0] - ha[0]) * t + rng.range(-0.15, 0.15),
      NILE_WATER_Y + 0.02,
      ha[2] + (hb[2] - ha[2]) * t - bulge * Math.sin(Math.PI * t) - 1.2,
    ]);
  }
  const rope: V3 = [0.6, 0.52, 0.36];
  const netT: V3 = [0.3, 0.26, 0.2];
  // haul lines from the hands down to the first and last float
  beam(w, ha, pts[0] as V3, 0.025, rope);
  beam(w, hb, pts[N] as V3, 0.025, rope);
  for (let i = 0; i <= N; i++) {
    const p = pts[i] as V3;
    w.box(p[0], NILE_WATER_Y - 0.06, p[2], 0.3, 0.14, 0.2, [0.5, 0.38, 0.22], rng.float() * Math.PI);
    if (i === N) break;
    const q = pts[i + 1] as V3;
    beam(w, [p[0], NILE_WATER_Y + 0.03, p[2]], [q[0], NILE_WATER_Y + 0.03, q[2]], 0.02, rope);
    // the net's skirt, sagging deeper toward the middle of the arc
    const da = 0.5 + 0.6 * Math.sin((Math.PI * i) / N);
    const db = 0.5 + 0.6 * Math.sin((Math.PI * (i + 1)) / N);
    const a0: V3 = [p[0], NILE_WATER_Y + 0.02, p[2]];
    const b0: V3 = [q[0], NILE_WATER_Y + 0.02, q[2]];
    const a1: V3 = [p[0], NILE_WATER_Y - da, p[2] + 0.15];
    const b1: V3 = [q[0], NILE_WATER_Y - db, q[2] + 0.15];
    w.quad(a0, b0, b1, a1, netT);
    w.quad(a1, b1, b0, a0, netT);
  }
  return 2;
}

export function buildHarbor(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
): number {
  const rng = seed.rng('harbor');
  // crews draw from their OWN stream: the fleet's draws stay as they were
  const crew = seed.rng('harbor-crews');
  crewCount = 0;
  const w = new W();
  let vessels = 0;
  hullSeq = 0;

  /** waterline for an afloat hull — but if the bed is too shallow for the
   *  draft (bank margins, sandbars), seat the keel ON the ground instead.
   *  Fixed-Y placement half-buried the beached skiffs and floated others. */
  const floatY = (x: number, z: number, draft: number, yaw = 0, half = 0): number => {
    const bed = hf.heightAtCpu(x, z);
    if (bed <= NILE_WATER_Y - draft - 0.25) return NILE_WATER_Y;
    return seatY(x, z, yaw, half, bed) + draft * 0.85;
  };
  /** (v1.1) a hull grounded on a shelving bank sat on the bed under its
   *  CENTRE, so bow or stern hung in the air: seat it on the lowest of bow,
   *  midships and stern (the high end digs into the bank, as a beached hull
   *  does) — at most 0.6 m below the centre, the audit's keel tolerance */
  const seatY = (x: number, z: number, yaw: number, half: number, bed = hf.heightAtCpu(x, z)): number => {
    if (half <= 0) return bed;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const low = Math.min(bed, hf.heightAtCpu(x + c * half, z + s * half), hf.heightAtCpu(x - c * half, z - s * half));
    return Math.max(low, bed - 0.6);
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
  let quayEdgeX = 0; // east face — moored hulls must stay seaward of it
  {
    const qz0 = -225;
    const qz1 = -45;
    let qx = 0;
    for (let z = qz0; z <= qz1; z += 30) qx = Math.max(qx, shoreX(z, 1.6));
    qx += 2;
    quayEdgeX = qx + 7;
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
    // moored vessels flanking the pier's outer (deep) half — never inside
    // the quay mole (the bob-scope rng reshuffle parked a barge in it)
    {
      const bx = Math.max(px0 + len - 6 - rng.float() * 18, quayEdgeX + 13.5); // + half barge length
      const tx = Math.max(px0 + len - 8 - rng.float() * 18, quayEdgeX + 11);
      barge(w, rng, bx, pz - 7.5, rng.range(-0.12, 0.12), floatY(bx, pz - 7.5, 0.9), crew, true);
      traveler(w, rng, tx, pz + 7.5, Math.PI + rng.range(-0.12, 0.12), floatY(tx, pz + 7.5, 0.6), crew, true);
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
    if (i % 3 === 0) barge(w, rng, x, z, yawB, floatY(x, z, 0.9, yawB, 9), crew);
    else if (i % 3 === 1) traveler(w, rng, x, z, yawB, floatY(x, z, 0.6, yawB, 7), crew);
    else skiff(w, rng, x, z, yawB, floatY(x, z, 0.2, yawB, 2.6), crew);
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
    if (rng.chance(0.5)) traveler(w, rng, x, z, rng.range(-0.3, 0.3), floatY(x, z, 0.6), crew);
    else barge(w, rng, x, z, rng.range(-0.3, 0.3) + Math.PI, floatY(x, z, 0.9), crew);
    vessels++;
  }
  for (let i = 0; i < 5; i++) {
    // beached on the west bank — walk east across the floodplain to the
    // actual shoreline for THIS z (a fixed x landed skiffs on the river
    // bottom where the channel meanders west; collision audit caught it).
    // Keep clear of the harbor/approach-canal latitudes: the eastward walk
    // there stops at the CANAL and seats the skiff on its bed
    let z = rng.range(-500, 1200);
    for (let g = 0; g < 8 && z > -430 && z < 180; g++) z = rng.range(-500, 1200);
    let sx = 1750;
    while (sx < 1980 && hf.heightAtCpu(sx + 4, z) > NILE_WATER_Y + 0.25) sx += 4;
    const x = sx - 5 + rng.range(-3, 2);
    const yawS = rng.range(0.8, 2.2);
    skiff(w, rng, x, z, yawS, seatY(x, z, yawS, 2.6) + 0.17);
    vessels++;
  }
  // seine fishers on the reach (v1.2) — own stream, after everything else,
  // clear of the harbour/canal latitudes and the traffic hulls
  {
    const frng = seed.rng('harbor-fishers');
    for (const z of [-880, 520, 1100]) vessels += seine(w, frng, crew, hf, floatY, 1760, z);
  }

  const mat = new MeshPhysicalNodeMaterial();
  const tone = attribute('tone', 'vec3') as unknown as NV3;
  // Phase-6 motion: heave + directional tilt per hull (attributes stamped
  // by bobScope; quay/piers/beached hulls carry zero amplitude)
  {
    const A = attribute('bobA', 'vec4') as unknown as NV4;
    const B = attribute('bobB', 'vec4') as unknown as NV4;
    const t = uWorldTime;
    const heave = sin(t.mul(B.z).add(A.z)).mul(A.w);
    const roll = sin(t.mul(B.z.mul(0.63)).add(A.z.mul(1.7))).mul(B.w);
    const lever = positionLocal.xz.sub(vec2(A.x, A.y)).dot(vec2(B.x, B.y));
    mat.positionNode = positionLocal.add(vec3(0, heave.add(lever.mul(roll)), 0));
  }
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
