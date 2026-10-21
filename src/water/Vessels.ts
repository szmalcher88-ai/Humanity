/**
 * Harbor works + vessels (Phase 5, brief §2 floor: ≥12 vessel classes/
 * variants, moored / anchored / beached; Pillar C: boats shifting on the
 * water, cargo on deck — the harbor must read ten-minutes-ago busy).
 *
 * Three hull classes, every vessel individually lofted from seeded params
 * (no two identical; v1.2 boat pass — see "hulls" below):
 *   BARGE    — broad open stone-hauler, stem heads, Tura blocks on sleepers
 *              or jars in the hold, steering oars, polers; no mast
 *   TRAVELER — papyriform traveling boat: umbel-topped prow post, curled
 *              stern post, deckhouse, bipod mast (sail set heading south,
 *              furled heading north), thwarts, steering oars, rowers
 *   SKIFF    — papyrus-bundle boat, lashed, upturned tied tips
 * Plus the stone quay and three wooden piers on piles.
 * All merged geometry (one draw); each afloat hull heaves and tilts in the
 * vertex stage (bobA/bobB attributes stamped per hull scope), and its crew
 * (v1.2: polers, rowers facing the stern, a steersman, a fisherman per
 * skiff) is built inside the same scope, so they ride with the boat.
 */

import { BufferAttribute, BufferGeometry, Mesh, type Object3D } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  attribute, cos, float, instancedArray, mix, normalLocal, positionLocal, sin, smoothstep,
  transformNormalToView, varying, vec2, vec3,
} from 'three/tsl';
import { uWorldTime } from '../render/WorldClock';
import type { Rng, WorldSeed } from '../core/Seed';
import type { Heightfield } from '../world/Heightfield';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { fpReg } from '../debug/Footprints';
import { giLightMap } from '../monuments/PyramidBuilder';
import type { NV2, NV3, NV4 } from '../gpu/TSLTypes';
import { DT, TrackBuilder, arc, lane, planWater, riverAxis, smooth, type P2, type TrackPoint } from './Navigation';
import { slipwayRamp } from '../monuments/HarborDistrict';
import { GeoWriter, limestoneMaterial } from '../monuments/KhufuComplex';
import { ColorWriter, type C3 } from '../monuments/Townsfolk';
import { earthMaterial } from '../vegetation/Basins';
import { NILE_WATER_Y } from '../world/WorldConst';
import { moverEvidence } from './HarbourEvidence';
import { fpAll, fpAabb } from '../debug/Footprints';

type V3 = [number, number, number];

class W {
  pos: number[] = [];
  col: number[] = [];
  bobA: number[] = []; // per-vertex: hull cx, cz, phase, heave amp
  bobB: number[] = []; // per-vertex: tilt dir x, z, freq, tilt amp
  nav: number[] = []; // per-vertex: moving-hull index (-1 static), cargo threshold (-1 none)
  private curNav: [number, number] = [-1, -1];
  /** everything written next belongs to moving hull `k` (-1: static) */
  setNav(k: number): void {
    this.curNav = [k, -1];
  }
  /** cargo written next goes ashore once the load drops below `thr` */
  setCargo(thr: number): void {
    this.curNav = [this.curNav[0], thr];
  }
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
      this.nav.push(...this.curNav);
    }
  }
  tri(a: V3, b: V3, c: V3, t: V3): void {
    this.pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) {
      this.col.push(...t);
      this.bobA.push(...this.curA);
      this.bobB.push(...this.curB);
      this.nav.push(...this.curNav);
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
  /** vertical polygonal drum (umbels, jars); batter narrows the top radius
   *  by batter·h, negative widens it */
  drum(cx: number, y0: number, cz: number, r: number, h: number, t: V3, batter = 0, sides = 10): void {
    const rt = Math.max(0.01, r - batter * h);
    const B: V3[] = [];
    const T: V3[] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      B.push([cx + Math.cos(a) * r, y0, cz + Math.sin(a) * r]);
      T.push([cx + Math.cos(a) * rt, y0 + h, cz + Math.sin(a) * rt]);
    }
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      this.quad(B[j] as V3, B[i] as V3, T[i] as V3, T[j] as V3, t);
      this.tri([cx, y0 + h, cz], T[j] as V3, T[i] as V3, t);
      this.tri([cx, y0, cz], B[i] as V3, B[j] as V3, t);
    }
  }
  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('tone', new BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute('bobA', new BufferAttribute(new Float32Array(this.bobA), 4));
    g.setAttribute('bobB', new BufferAttribute(new Float32Array(this.bobB), 4));
    g.setAttribute('nav', new BufferAttribute(new Float32Array(this.nav), 2));
    g.computeVertexNormals();
    return g;
  }
}

/* ------------------------------------------------------------------ */
/* crews (v1.1 detail pass)                                             */
/* ------------------------------------------------------------------ */

/** crew figures built in the season's last count — read by the scene HUD */
export let crewCount = 0;

/** a slanted 4-sided beam between two world points (poles, oars) — box()
 *  only yaws; each side quad is wound outward from the axis. `rv` gives a
 *  flat section (oar blades): r across the horizontal, rv in the vertical
 *  plane through the axis */
function beam(w: W, a: V3, b: V3, r: number, t: V3, rv = r): void {
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
      const s = Math.sin((k * Math.PI) / 2) * rv;
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
 * One boatman at hull-local (lx, lz), feet (or seat) at hull-local height
 * `base`, facing hull-local +x rotated by `face` (π = facing the stern, as
 * Egyptian rowers sat). Built of boxes in the hull's own bob scope, so he
 * heaves with the boat. ~1.65 m standing (Old Kingdom male mean).
 */
function boatman(
  w: W, crng: Rng, hull: Hull,
  lx: number, lz: number, baseLocal: number, pose: Pose, face = 0,
): void {
  const [wx, base, wz] = hull.P(lx, baseLocal, lz);
  const fy = hull.yaw + face;
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
    w.box(wx, base + 0.66 * k, wz, 0.27, 0.34 * k, 0.38, LINEN, fy); // kilt (wider than the torso: no coplanar strip)
    w.box(wx, base + 0.98 * k, wz, 0.22, 0.52 * k, 0.36, skin, fy); // torso
    for (const s of [-0.22, 0.22]) {
      const [x, z] = at(0.02, s);
      w.box(x, base + 0.92 * k, z, 0.1, 0.56 * k, 0.1, skin, fy);
    }
  } else {
    const [lxs, lzs] = at(0.22, 0);
    w.box(lxs, base, lzs, 0.5, 0.18, 0.3, skin, fy); // thighs along the deck
    w.box(wx, base, wz, 0.3, 0.34, 0.38, LINEN, fy); // seated kilt
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

/* ------------------------------------------------------------------ */
/* hulls (v1.2 boat pass)                                               */
/* ------------------------------------------------------------------ */
/*
 * v1.1 lofted every hull on 9 stations with ONE chine and a flat lid for a
 * deck: from above every boat was a solid wedge, its "steering oars" were
 * vertical posts, its "bipod mast" one box, its oars blade-less and its
 * papyrus skiff a plank shell. Now:
 *   PLANKED (barge, traveler) — 18 stations; a wet band at the waterline,
 *     two strakes and a heavy dark wale outside; a gunwale cap; an OPEN hull
 *     with bulwarks, floor boards and thwarts inside; stem heads (barge) or
 *     papyriform posts with umbel finials (traveler); steering oars on
 *     crutches over the quarters, blades edge-on in the water.
 *   BUNDLE (skiff) — an oval papyrus bundle flattened on top, tapering into
 *     upturned tied tips, bound with rope lashings, sheaves toned apart.
 * Every face goes through face(): wound by a hint vector, never by hand.
 */

/** 'underway' decides sail or oars by heading; a moving hull is built at
 *  yaw 0, so it is told outright ('sailing' / 'rowing') */
type Mode = 'moored' | 'anchored' | 'underway' | 'sailing' | 'rowing';

const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (p: V3, q: V3): V3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mul3 = (t: V3, k: number): V3 => [t[0] * k, t[1] * k, t[2] * k];
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const WOOD: V3 = [0.4, 0.3, 0.18];
const ROPE: V3 = [0.6, 0.52, 0.36];
const SAILCLOTH: V3 = [0.84, 0.8, 0.68];
const MAT: V3 = [0.66, 0.57, 0.4];

/** a lofted hull: its local frame (x along the keel, bow +x; z across; y up
 *  from the waterline) and its section curves, for fittings and crew */
interface Hull {
  L: number;
  B: number;
  yaw: number;
  /** sheer height at the very ends (the posts start there) */
  end: number;
  tone: V3;
  /** hull-local → world */
  P(x: number, y: number, z: number): V3;
  /** sheer (gunwale top), floor, outer half-beam, inner half-width at x */
  at(x: number): { sheer: number; floor: number; half: number; inner: number };
}

/** one quad in HULL-LOCAL points, wound so its normal agrees with `hint`
 *  (hull-local too) — the lofts emit hundreds of strips, and a hand-wound
 *  one is one sign away from a see-through boat (v1.1) */
function face(w: W, h: Hull, a: V3, b: V3, c: V3, d: V3, t: V3, hint: V3): void {
  let n = cross3(sub3(b, a), sub3(c, a));
  if (dot3(n, n) < 1e-12) n = cross3(sub3(c, a), sub3(d, a));
  const P = (q: V3): V3 => h.P(q[0], q[1], q[2]);
  if (dot3(n, hint) >= 0) w.quad(P(a), P(b), P(c), P(d), t);
  else w.quad(P(d), P(c), P(b), P(a), t);
}

/** hull-local box (y0 = its bottom), yawed with the hull */
function lbox(w: W, h: Hull, x: number, y0: number, z: number, lx: number, ly: number, lz: number, t: V3): void {
  const p = h.P(x, y0, z);
  w.box(p[0], p[1], p[2], lx, ly, lz, t, h.yaw);
}

/** hull-local spar between two points (rv: a second, flat radius) */
function lbeam(w: W, h: Hull, a: V3, b: V3, r: number, t: V3, rv = r): void {
  beam(w, h.P(a[0], a[1], a[2]), h.P(b[0], b[1], b[2]), r, t, rv);
}

interface PlankParams {
  L: number;
  B: number;
  draft: number;
  free: number; // sheer height midships above the waterline
  sweep: number; // rise of the sheer at the ends
  sweepExp: number; // how late the rise starts (higher: a longer flat midbody)
  full: number; // plan-view fullness exponent (lower: fuller ends)
  bulw: number; // bulwark: the sheer above the floor, midships
  post: number; // end-post height above the end sheer (for the footprint)
  tone: V3;
}

let hullSeq = 0;
/** (v1.2 I6) the class of the hull being built — it goes into the footprint
 *  id (`vessel:<class>:<n>`) so the evidence table can tag it */
let hullClass = 'hull';
/** off while a moving hull is built: it has no fixed place to police */
let registerHulls = true;

/** (v1.2 I6) the west shore's works, for the systems built after the
 *  harbour: the lanterns (Torches) and the reed post-filter (Shore) */
export const harborLanterns: [number, number][] = [];
export const harborWorksRects: { x0: number; x1: number; z0: number; z1: number }[] = [];

/** planked river hull: open, with bulwarks and a boarded floor */
function plankHull(w: W, det: Rng, p: PlankParams, cx: number, cz: number, yaw: number, baseY: number): Hull {
  if (registerHulls) fpReg({
    id: `vessel:${hullClass}:${hullSeq++}`, family: 'vessels', x: cx, z: cz,
    hx: p.L / 2 + 0.3, hz: p.B / 2, yaw,
    y0: baseY - p.draft, y1: baseY + p.free + p.sweep + p.post,
    ground: 'afloat', draft: p.draft, intra: true,
  });
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const T = 0.13; // bulwark thickness
  const sinp = (f: number, e: number): number => Math.pow(Math.max(0, Math.sin(Math.PI * f)), e);
  const half = (f: number): number => (p.B / 2) * sinp(f, p.full);
  const rise = (f: number): number => Math.pow(Math.abs(f * 2 - 1), p.sweepExp);
  const sheer = (f: number): number => p.free + p.sweep * rise(f);
  const keel = (f: number): number => -p.draft * sinp(f, 0.8);
  // the floor rises toward the ends a third as fast as the sheer
  const floor = (f: number): number => p.free - p.bulw + p.sweep * rise(f) * 0.35;
  const inner = (f: number): number => Math.max(0, half(f) * 0.96 - T);
  const h: Hull = {
    L: p.L, B: p.B, yaw, end: p.free + p.sweep, tone: p.tone,
    P: (x, y, z) => [cx + x * cy - z * sy, baseY + y, cz + x * sy + z * cy],
    at: (x) => {
      const f = Math.min(Math.max(x / p.L + 0.5, 0), 1);
      return { sheer: sheer(f), floor: floor(f), half: half(f), inner: inner(f) };
    },
  };
  // per-hull strake tones (own stream: the fleet's draws are untouched)
  const kLow = det.range(0.86, 0.96);
  const kUp = det.range(0.97, 1.06);
  const kWale = det.range(0.58, 0.7);
  const tn = (k: number): V3 => mul3(p.tone, k);
  type Pair = [V3, V3];
  interface Sec { K: V3; Bg: Pair; Wt: Pair; Cs: Pair; Wl: Pair; G: Pair; Gi: Pair; Fi: Pair; F1: Pair }
  const sec = (f: number): Sec => {
    const x = (f - 0.5) * p.L;
    const hb = half(f);
    const sh = sheer(f);
    const ii = inner(f);
    const fl = Math.min(floor(f), sh - 0.05);
    const wl = Math.max(0.16, sh - 0.22); // wale bottom
    const wt = Math.min(0.1, wl - 0.04); // the wet line
    const cs = (wt + wl) / 2; // strake seam
    const kl = keel(f);
    const two = (y: number, z: number): Pair => [[x, y, -z], [x, y, z]];
    return {
      K: [x, kl, 0], Bg: two(kl * 0.3, hb * 0.8), Wt: two(wt, hb * 0.97), Cs: two(cs, hb),
      Wl: two(wl, hb), G: two(sh, hb * 0.96), Gi: two(sh, ii), Fi: two(fl, ii * 0.92), F1: two(fl, ii * 0.3),
    };
  };
  const UP: V3 = [0, 1, 0];
  const N = 18;
  let prev = sec(0);
  for (let i = 1; i <= N; i++) {
    const cur = sec(i / N);
    for (const j of [0, 1] as const) {
      const s = j === 0 ? -1 : 1;
      const out: V3 = [0, 0, s];
      face(w, h, prev.K, cur.K, cur.Bg[j], prev.Bg[j], tn(0.5), [0, -0.4, s]); // bottom
      face(w, h, prev.Bg[j], cur.Bg[j], cur.Wt[j], prev.Wt[j], tn(0.6), out); // wet band
      face(w, h, prev.Wt[j], cur.Wt[j], cur.Cs[j], prev.Cs[j], tn(kLow), out); // lower strake
      face(w, h, prev.Cs[j], cur.Cs[j], cur.Wl[j], prev.Wl[j], tn(kUp), out); // upper strake
      face(w, h, prev.Wl[j], cur.Wl[j], cur.G[j], prev.G[j], tn(kWale), out); // the heavy wale
      face(w, h, prev.G[j], cur.G[j], cur.Gi[j], prev.Gi[j], tn(1.1), UP); // gunwale cap
      face(w, h, prev.Gi[j], cur.Gi[j], cur.Fi[j], prev.Fi[j], tn(0.74), [0, 0.2, -s]); // bulwark, inside
      face(w, h, prev.Fi[j], cur.Fi[j], cur.F1[j], prev.F1[j], tn(1.14), UP); // side floor board
    }
    face(w, h, prev.F1[0], cur.F1[0], cur.F1[1], prev.F1[1], tn(1.03), UP); // middle board
    prev = cur;
  }
  // floor timbers across the boards, ~1.7 m apart: the hold reads as built
  const nF = Math.floor(p.L / 1.7);
  for (let i = 1; i < nF; i++) {
    const x = (i / nF - 0.5) * p.L;
    const a = h.at(x);
    if (a.inner > 0.35) lbox(w, h, x, Math.min(a.floor, a.sheer - 0.05) - 0.01, 0, 0.12, 0.07, a.inner * 1.8, tn(0.9));
  }
  return h;
}

/** papyriform end posts (traveling boats): the prow stem rising forward
 *  into a papyrus-umbel finial, the stern post rising and curling inboard —
 *  the bundle boat's ends translated into timber, as on the Khufu ship */
function papyriformPosts(w: W, h: Hull, k = 1): void {
  const e = h.end;
  const L = h.L;
  const t = mul3(h.tone, 0.9);
  const q = (x: number, y: number): V3 => [Math.sign(x) * (L / 2) + (x - Math.sign(x) * (L / 2)) * k, e + y * k, 0];
  const chain = (pts: V3[], r0: number, r1: number): void => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const r = (r0 + ((r1 - r0) * i) / Math.max(1, pts.length - 2)) * Math.sqrt(k);
      lbeam(w, h, pts[i] as V3, pts[i + 1] as V3, r, t);
    }
  };
  chain([q(L / 2 - 0.6, -0.45), q(L / 2 + 0.02, 0.15), q(L / 2 + 0.3, 0.8), q(L / 2 + 0.4, 1.3)], 0.17, 0.09);
  const tip = h.P(...q(L / 2 + 0.4, 1.24));
  w.drum(tip[0], tip[1], tip[2], 0.09 * k, 0.34 * k, mul3(h.tone, 1.04), -0.62, 8); // the umbel flares open
  chain([q(-L / 2 + 0.6, -0.45), q(-L / 2 - 0.08, 0.35), q(-L / 2 - 0.22, 1.15), q(-L / 2 - 0.08, 1.8), q(-L / 2 + 0.35, 2.1)], 0.19, 0.08);
  lbeam(w, h, q(-L / 2 + 0.33, 2.1), q(-L / 2 + 0.6, 2.04), 0.14 * Math.sqrt(k), mul3(h.tone, 1.04)); // curled finial
}

/** blunt stem heads (barges) */
function stemHeads(w: W, h: Hull): void {
  const t = mul3(h.tone, 0.85);
  for (const s of [-1, 1]) {
    lbeam(w, h, [s * (h.L / 2 - 0.55), h.end - 0.4, 0], [s * (h.L / 2 + 0.12), h.end + 0.3, 0], 0.16, t);
  }
}

/**
 * A steering oar over each quarter, its loom resting in a crutch on the
 * gunwale and its blade trailing edge-on in the water (4th-dynasty boats
 * steered with big oars worked over the quarters; the tiller on a stanchion
 * is later). The crutch stands where the loom actually crosses the gunwale.
 */
function steeringOars(w: W, h: Hull, scale = 1): void {
  const L = h.L;
  const a = h.at(-0.3 * L);
  const mid = h.at(0);
  for (const s of [-1, 1]) {
    const H: V3 = [-0.3 * L, a.sheer + 1.5 * scale, s * a.inner];
    const E: V3 = [-0.58 * L, -0.5, s * (mid.half * 0.5 + 0.5)];
    lbeam(w, h, H, E, 0.06, WOOD);
    const d = sub3(E, H);
    const len = Math.hypot(d[0], d[1], d[2]);
    const bl = Math.min(1.6, len * 0.3);
    lbeam(w, h, lerp3(H, E, 1 - bl / len), E, 0.03, mul3(WOOD, 1.12), 0.2);
    for (let t = 0.02; t < 0.9; t += 0.02) {
      const c = lerp3(H, E, t);
      const g = h.at(c[0]);
      if (Math.abs(c[2]) < g.half * 0.9) continue;
      if (c[1] > g.sheer + 0.15) lbox(w, h, c[0], g.sheer - 0.05, s * g.half * 0.9, 0.12, c[1] - g.sheer, 0.12, WOOD);
      break;
    }
  }
}

/** a rowing oar worked from the thwart at x, on side s: handle inboard at
 *  chest height, over the gunwale, blade half in the water abeam */
function oar(w: W, h: Hull, x: number, s: number): void {
  const a = h.at(x);
  const H: V3 = [x - 0.45, a.floor + 1.1, s * a.inner * 0.3];
  const E: V3 = [x + 0.3, -0.1, s * (a.half + 3.6)];
  lbeam(w, h, H, E, 0.035, WOOD);
  lbeam(w, h, lerp3(H, E, 0.82), E, 0.018, mul3(WOOD, 1.12), 0.13);
}

/** oars shipped: laid fore-and-aft on the thwarts, blades forward */
function stowedOars(w: W, h: Hull, x0: number, x1: number, n: number): void {
  for (let k = 0; k < n; k++) {
    const s = k % 2 === 0 ? 1 : -1;
    const q = 0.62 + 0.12 * Math.floor(k / 2);
    const a = h.at((x0 + x1) / 2);
    const y = a.floor + 0.47 + 0.04 * Math.floor(k / 2);
    const A: V3 = [x0, y, s * h.at(x0).inner * q];
    const B: V3 = [x1, y, s * h.at(x1).inner * q];
    lbeam(w, h, A, B, 0.035, WOOD);
    lbeam(w, h, lerp3(A, B, 0.8), B, 0.12, mul3(WOOD, 1.12), 0.018);
  }
}

/** light deckhouse of mats on a pole frame under a flat roof (the Khufu
 *  ship's cabin form), its doorway forward */
function deckhouse(w: W, h: Hull, xc: number, len: number): void {
  const a = h.at(xc);
  const f0 = Math.min(h.at(xc - len / 2).floor, a.floor, h.at(xc + len / 2).floor) - 0.02;
  const hw = Math.min(a.inner * 0.9, h.B * 0.31);
  const ht = 1.6;
  for (const px of [-len / 2, 0, len / 2]) {
    for (const s of [-1, 1]) lbox(w, h, xc + px, f0 - 0.08, s * hw, 0.1, ht + 0.08, 0.1, WOOD);
  }
  for (const s of [-1, 1]) lbox(w, h, xc, f0, s * hw, len, ht - 0.1, 0.05, MAT);
  lbox(w, h, xc - len / 2, f0, 0, 0.05, ht - 0.1, hw * 2, MAT);
  const door = 0.8;
  for (const s of [-1, 1]) lbox(w, h, xc + len / 2, f0, s * (hw + door / 2) / 2, 0.05, ht - 0.1, hw - door / 2, MAT);
  lbox(w, h, xc + len / 2 - 0.03, f0, 0, 0.03, ht - 0.3, door, [0.1, 0.08, 0.06]); // the dark doorway
  lbox(w, h, xc, f0 + ht, 0, len + 0.4, 0.09, hw * 2 + 0.36, mul3(MAT, 0.9)); // roof mat
  for (let k = 0; k <= 4; k++) {
    lbox(w, h, xc - len / 2 + (k * len) / 4, f0 + ht + 0.09, 0, 0.07, 0.06, hw * 2 + 0.36, WOOD); // roof poles
  }
}

/**
 * Old Kingdom bipod mast: two legs stepped against the sides, meeting at the
 * head, rungs lashed across like a ladder; a forestay and two backstays.
 * Set: a TALL, NARROW sail between yard and boom, bellied forward by the
 * north wind. Furled: the sail rolled along the yard at the masthead.
 */
function bipodMast(w: W, h: Hull, xm: number, set: boolean): void {
  const L = h.L;
  const a = h.at(xm);
  const mh = 0.48 * L;
  const spread = Math.min(a.inner * 0.8, 0.75);
  const head: V3 = [xm, a.floor + mh, 0];
  const feet: [V3, V3] = [[xm, a.floor, -spread], [xm, a.floor, spread]];
  for (const f of feet) lbeam(w, h, f, head, 0.075, WOOD);
  for (const q of [0.3, 0.52, 0.72, 0.88]) lbeam(w, h, lerp3(feet[0], head, q), lerp3(feet[1], head, q), 0.04, WOOD);
  const fo = h.at(L / 2 - 0.8);
  lbeam(w, h, head, [L / 2 - 0.8, fo.sheer, 0], 0.02, ROPE);
  const q = h.at(-0.3 * L);
  for (const s of [-1, 1]) lbeam(w, h, head, [-0.3 * L, q.sheer, s * q.inner], 0.02, ROPE);
  const yl = 0.26 * L;
  const xs = xm + 0.22; // the sail hangs forward of the legs
  const yy = a.floor + mh - 0.35;
  lbeam(w, h, [xs, yy, -yl / 2], [xs, yy, yl / 2], 0.07, WOOD); // yard
  if (!set) {
    lbeam(w, h, [xs + 0.02, yy - 0.2, -yl * 0.46], [xs + 0.02, yy - 0.2, yl * 0.46], 0.15, SAILCLOTH, 0.13);
    return;
  }
  const yb = a.floor + 1.6;
  lbeam(w, h, [xs + 0.05, yb, -yl * 0.49], [xs + 0.05, yb, yl * 0.49], 0.07, WOOD); // boom
  const belly = 0.12 * yl;
  const pt = (u: number, v: number): V3 => [
    xs + 0.05 + belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.1)),
    yy - (yy - yb) * v,
    -yl / 2 + u * yl,
  ];
  const NU = 4;
  const NV = 5;
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const p00 = pt(i / NU, j / NV);
      const p10 = pt((i + 1) / NU, j / NV);
      const p11 = pt((i + 1) / NU, (j + 1) / NV);
      const p01 = pt(i / NU, (j + 1) / NV);
      face(w, h, p00, p10, p11, p01, SAILCLOTH, [1, 0, 0]);
      face(w, h, p00, p10, p11, p01, mul3(SAILCLOTH, 0.9), [-1, 0, 0]);
    }
  }
  const sh = h.at(-0.2 * L);
  for (const s of [-1, 1]) lbeam(w, h, [xs + 0.05, yb, s * yl * 0.49], [-0.2 * L, sh.sheer, s * sh.inner], 0.015, ROPE); // sheets
}

interface BundleParams {
  L: number;
  B: number;
  draft: number;
  free: number;
  sweep: number;
  tone: V3;
}

/** papyrus-bundle skiff: an oval bundle flattened on top (where the boatman
 *  stands), tapering into upturned tied tips, lashed every ~0.5 m */
function bundleHull(w: W, det: Rng, p: BundleParams, cx: number, cz: number, yaw: number, baseY: number): Hull {
  if (registerHulls) fpReg({
    id: `vessel:${hullClass}:${hullSeq++}`, family: 'vessels', x: cx, z: cz,
    hx: p.L / 2 + 0.2, hz: p.B / 2, yaw,
    y0: baseY - p.draft, y1: baseY + p.free + p.sweep + 0.4,
    ground: 'afloat', draft: p.draft, intra: true,
  });
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const rz = (f: number): number => Math.max(0.05, (p.B / 2) * Math.pow(Math.max(0, Math.sin(Math.PI * f)), 0.5));
  const ry = (f: number): number => Math.min(rz(f) * 0.62, (p.free + p.draft) / 1.55);
  const top = (f: number): number => p.free + p.sweep * Math.pow(Math.abs(f * 2 - 1), 2.2);
  const h: Hull = {
    L: p.L, B: p.B, yaw, end: top(0), tone: p.tone,
    P: (x, y, z) => [cx + x * cy - z * sy, baseY + y, cz + x * sy + z * cy],
    at: (x) => {
      const f = Math.min(Math.max(x / p.L + 0.5, 0), 1);
      return { sheer: top(f), floor: top(f), half: rz(f), inner: rz(f) * 0.8 };
    },
  };
  const M = 8;
  const N = 16;
  const axis = (f: number): V3 => [(f - 0.5) * p.L, top(f) - 0.55 * ry(f), 0];
  const ring = (f: number, k = 1): V3[] => {
    const c = axis(f);
    const r = rz(f) * k;
    const q = ry(f) * k;
    return Array.from({ length: M }, (_, i): V3 => {
      const a = (i / M) * Math.PI * 2;
      const sn = Math.sin(a);
      return [c[0], c[1] + q * sn * (sn > 0 ? 0.55 : 1), r * Math.cos(a)];
    });
  };
  const sheafA = p.tone;
  const sheafB = mul3(p.tone, det.range(0.85, 0.91));
  const tube = (ra: V3[], rb: V3[], c: V3, t: (k: number) => V3): void => {
    for (let k = 0; k < M; k++) {
      const k2 = (k + 1) % M;
      const a0 = ra[k] as V3;
      const b0 = rb[k] as V3;
      const b1 = rb[k2] as V3;
      const a1 = ra[k2] as V3;
      const m: V3 = [(a0[0] + b1[0]) / 2, (a0[1] + b1[1]) / 2, (a0[2] + b1[2]) / 2];
      face(w, h, a0, b0, b1, a1, t(k), sub3(m, c));
    }
  };
  let prev = ring(0);
  for (let i = 1; i <= N; i++) {
    const cur = ring(i / N);
    tube(prev, cur, axis((i - 0.5) / N), (k) => (k % 2 ? sheafB : sheafA));
    prev = cur;
  }
  for (const f of [0, 1]) {
    const r = ring(f);
    const c = axis(f);
    for (let k = 0; k < M; k++) face(w, h, c, r[k] as V3, r[(k + 1) % M] as V3, c, sheafA, [f ? 1 : -1, 0, 0]);
  }
  // rope lashings: a raised band with its two side rings
  const lash: V3 = [0.34, 0.27, 0.17];
  const dx = 0.045 / p.L;
  for (let i = 2; i < N - 1; i += 2) {
    const f = i / N;
    const a = ring(f - dx, 1.08);
    const b = ring(f + dx, 1.08);
    tube(a, b, axis(f), () => lash);
    tube(ring(f - dx), a, [axis(f)[0] + 1, axis(f)[1], 0], () => lash);
    tube(b, ring(f + dx), [axis(f)[0] - 1, axis(f)[1], 0], () => lash);
  }
  // the tied, upturned tips
  for (const s of [-1, 1]) {
    const c = axis(s > 0 ? 1 : 0);
    lbeam(w, h, [c[0] - s * 0.25, c[1] - 0.03, 0], [c[0] + s * 0.12, c[1] + 0.4, 0], 0.05, mul3(p.tone, 0.92));
  }
  return h;
}

/** anchored hulls ride to a stone anchor off the bow */
function anchorLine(w: W, h: Hull): void {
  lbeam(w, h, [h.L / 2 - 0.4, h.end - 0.25, 0], [h.L / 2 + 4.5, -1.6, 0], 0.03, ROPE);
}

/** mooring lines from the bow and stern quarters to bollards on the pier
 *  edge nearest them (static: called after the hull's bob scope closes) */
function moor(w: W, h: Hull, px0: number, len: number, edgeZ: number, bollZ: number): void {
  const piles = Math.floor(len / 4.2);
  for (const fx of [-0.36, 0.36]) {
    const lx = fx * h.L;
    const a = h.at(lx);
    const o = h.P(lx, 0, 0);
    const zAxis = h.P(lx, 0, 1)[2] - o[2]; // world z of the hull's local +z
    const side = zAxis * (edgeZ - o[2]) >= 0 ? 1 : -1;
    const A = h.P(lx, a.sheer + 0.05, side * a.half * 0.92);
    const k = Math.min(Math.max(Math.round((A[0] - px0) / 4.2), 1), piles - 1);
    const bx = px0 + k * 4.2;
    w.box(bx, NILE_WATER_Y + 1.22, bollZ, 0.24, 0.42, 0.24, WOOD); // bollard
    const tie: V3 = [bx, NILE_WATER_Y + 1.55, bollZ];
    const mid: V3 = [(A[0] + tie[0]) / 2, Math.min(A[1], tie[1]) - 0.3, (A[2] + tie[2]) / 2];
    beam(w, A, mid, 0.025, ROPE);
    beam(w, mid, tie, 0.025, ROPE);
  }
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

/**
 * Stone barge: broad open hull, blunt stem heads, a steering oar per
 * quarter, tie beams fore and aft of the hold; Tura blocks on timber
 * sleepers or jars in the hold (laid out end to end — v1.1 let them
 * interpenetrate); polers at the ends, hands sitting on the stone.
 */
function barge(
  w: W, rng: Rng, det: Rng, cx: number, cz: number, yaw: number, y: number,
  crew: Rng | null = null, mode: Mode = 'anchored',
  opt: { moving?: boolean; unloads?: boolean; out?: { sink: number } } = {},
): Hull {
  bobScope(w, rng, cx, cz, y, 0.045, 0.004);
  // the same two tone draws as v1.1, but coupled: two independent channel
  // jitters swung the hue to salmon pink on some hulls
  const ka = rng.range(0.85, 1.1);
  const kb = rng.range(0.85, 1.1);
  const tone: V3 = [0.45 * ka, 0.34 * (0.7 * ka + 0.3 * kb), 0.21 * (0.85 + 0.15 * ka)];
  const L = rng.range(16, 24);
  // ~1:4 (v1.2; was ~1:3 — from above every barge read as a round tub)
  const B = L * rng.range(0.3, 0.36) * 0.78;
  // freeboard raised (0.75 → 1.2): the silty water is opaque at the
  // surface, so a low-riding hull read as swamped — waterline art needs
  // real height above water, not survey-accurate laden trim
  const sweep = rng.range(0.4, 0.9);
  // the hold: draws in the v1.1 order (fx, stone?, size, height, width) —
  // the hull builders draw nothing from `rng`, so drawing the cargo BEFORE
  // lofting keeps the fleet's stream, and with it the harbour, unchanged
  const n = rng.int(4) + 2;
  const items: Array<{ fx: number; stone: boolean; s: number; hh: number; lz: number }> = [];
  for (let i = 0; i < n; i++) {
    const fx = rng.range(-0.28, 0.28) * L;
    const stone = rng.chance(0.5);
    const s = rng.range(0.8, 1.7);
    const hh = rng.range(0.5, 1.1);
    const lz = s * rng.range(0.7, 1.2);
    items.push({ fx, stone, s, hh, lz });
  }
  // (v1.2 I2, canon IX §9.20) a laden hull sits lower: displacement of the
  // cargo over the waterplane (~0.72·L·B), clamped to the freeboard budget
  let mass = 0;
  for (const it of items) {
    mass += it.stone ? it.s * it.hh * Math.min(it.lz, B * 0.7) * 2300 : Math.round(it.s / 0.52) * Math.round(it.lz / 0.52) * 45;
  }
  const sink = Math.min(0.3, mass / (1000 * 0.72 * L * B));
  if (opt.out) opt.out.sink = sink;
  const afloat = Math.abs(y - NILE_WATER_Y) < 0.01;
  // a moving hull is built unladen-high; its shader lowers it by sink·load
  const yb = afloat && !opt.moving ? y - sink : y;
  hullClass = 'barge';
  const h = plankHull(w, det, {
    L, B, draft: 0.9, free: 1.2, sweep, sweepExp: 3.0, full: 0.5, bulw: 0.45, post: 0.4, tone,
  }, cx, cz, yaw, yb);
  stemHeads(w, h);
  steeringOars(w, h, 0.8);
  for (const fx of [-0.42, -0.34, 0.34, 0.42]) {
    const a = h.at(fx * L);
    if (a.inner > 0.3) lbox(w, h, fx * L, a.sheer - 0.16, 0, 0.22, 0.16, a.half * 1.9, mul3(tone, 1.08));
  }
  items.sort((p, q) => p.fx - q.fx);
  for (let i = 1; i < items.length; i++) {
    const p = items[i - 1] as (typeof items)[number];
    const q = items[i] as (typeof items)[number];
    q.fx = Math.max(q.fx, p.fx + (p.s + q.s) / 2 + 0.3);
  }
  const first = items[0] as (typeof items)[number];
  const last = items[items.length - 1] as (typeof items)[number];
  const shift = (first.fx - first.s / 2 + (last.fx + last.s / 2)) / 2;
  const tops: Array<[number, number]> = [];
  for (const [k, it] of items.entries()) {
    // an unloading barge tags each item with the load at which it goes
    // ashore: the shader hides it once the load drops below (k+½)/n
    if (opt.unloads) w.setCargo((k + 0.5) / items.length);
    const fx = it.fx - shift;
    const a = h.at(fx);
    const lz = Math.min(it.lz, a.inner * 1.7);
    if (it.stone) {
      // a dressed Tura block on two timber sleepers
      for (const qd of [-0.32, 0.32]) lbox(w, h, fx + qd * it.s, a.floor, 0, 0.18, 0.16, lz * 1.06, WOOD);
      lbox(w, h, fx, a.floor + 0.16, 0, it.s, it.hh, lz, [0.78 * det.range(0.95, 1.03), 0.74, 0.63]);
      tops.push([fx, a.floor + 0.16 + it.hh]);
    } else {
      // jars packed upright in the hold
      const nx = Math.max(1, Math.round(it.s / 0.52));
      const nz = Math.max(1, Math.round(lz / 0.52));
      for (let ix = 0; ix < nx; ix++) {
        for (let iz = 0; iz < nz; iz++) {
          const jp = h.P(fx - it.s / 2 + ((ix + 0.5) * it.s) / nx, a.floor, -lz / 2 + ((iz + 0.5) * lz) / nz);
          const jt: V3 = [0.58 * det.range(0.92, 1.06), 0.42, 0.29];
          w.drum(jp[0], jp[1], jp[2], 0.19, it.hh * 0.6, jt, -0.2, 8); // belly
          w.drum(jp[0], jp[1] + it.hh * 0.6, jp[2], 0.31, it.hh * 0.4, jt, 0.45, 8); // shoulder + neck
        }
      }
    }
  }
  if (opt.unloads) w.setCargo(-1);
  if (mode === 'anchored' && afloat) anchorLine(w, h);
  // crew: polers at the ends working poles into the bed, hands on the stone
  // (not on an unloading barge: they would sit on air once the stone is off)
  if (crew && afloat) {
    for (const end of mode === 'moored' ? [-1] : [-1, 1]) {
      const lx = end * 0.38 * L;
      const a = h.at(lx);
      const side = crew.chance(0.5) ? 1 : -1;
      const lz = side * Math.max(0, a.inner - 0.35);
      boatman(w, crew, h, lx, lz, a.floor, 'stand', end > 0 ? Math.PI : 0);
      lbeam(w, h, [lx + 0.12, a.floor + 1.45, lz + side * 0.2], [lx - end * 1.6, -2.4, side * (a.half + 2.5)], 0.05, WOOD);
    }
    const sitters = opt.unloads ? 0 : Math.min(crew.int(3), tops.length);
    for (let i = 0; i < sitters; i++) {
      const [fx, ty] = tops[i] as [number, number];
      boatman(w, crew, h, fx, crew.range(-0.2, 0.2), ty, 'sit', crew.float() * Math.PI * 2);
    }
  }
  w.endBob();
  return h;
}

/**
 * Traveling boat: papyriform posts, deckhouse aft of a bipod mast, thwarts,
 * steering oars. Heading south (upstream) it sails before the north wind;
 * heading north it rows down the current with the sail furled; at rest the
 * oars are shipped on the thwarts.
 */
function traveler(
  w: W, rng: Rng, det: Rng, cx: number, cz: number, yaw: number, y: number,
  crew: Rng | null = null, mode: Mode = 'anchored',
): Hull {
  bobScope(w, rng, cx, cz, y, 0.06, 0.007);
  const tone: V3 = [0.5 * rng.range(0.85, 1.05), 0.36, 0.22];
  const L = rng.range(13, 19);
  const B = L * 0.24;
  const sweep = rng.range(1.2, 2.2);
  hullClass = 'traveller';
  const h = plankHull(w, det, {
    L, B, draft: 0.6, free: 1.15, sweep, sweepExp: 2.6, full: 0.62, bulw: 0.5, post: 2.2, tone,
  }, cx, cz, yaw, y);
  papyriformPosts(w, h);
  const afloat = Math.abs(y - NILE_WATER_Y) < 0.01;
  const sailing = mode === 'sailing' || (mode === 'underway' && Math.sin(yaw) > 0.4);
  const rowing = mode === 'rowing' || (mode === 'underway' && !sailing);
  const benches = [0.18, 0.25, 0.32];
  for (const fx of [...benches, 0.39, -0.27]) {
    const a = h.at(fx * L);
    lbox(w, h, fx * L, a.floor + 0.36, 0, 0.24, 0.07, a.inner * 2, mul3(tone, 1.05));
  }
  deckhouse(w, h, -0.1 * L, 0.2 * L);
  bipodMast(w, h, 0.12 * L, sailing);
  steeringOars(w, h);
  if (!rowing) stowedOars(w, h, 0.15 * L, 0.4 * L, 4);
  if (mode === 'anchored' && afloat) anchorLine(w, h);
  if (crew && afloat) {
    const sx = -0.38 * L;
    if (mode !== 'moored') boatman(w, crew, h, sx, 0, h.at(sx).floor, 'stand', 0); // the steersman
    if (rowing) {
      // paired rowers sitting FACING THE STERN, as Egyptian rowers did
      for (const fx of benches) {
        const a = h.at(fx * L);
        for (const s of [-1, 1]) {
          boatman(w, crew, h, fx * L, s * a.inner * 0.5, a.floor + 0.43, 'sit', Math.PI);
          oar(w, h, fx * L, s);
        }
      }
    } else if (sailing) {
      const m = h.at(0.12 * L - 0.7);
      boatman(w, crew, h, 0.12 * L - 0.7, 0.35, m.floor, 'stand', 0); // on the stays
      const bw = h.at(0.39 * L);
      boatman(w, crew, h, 0.39 * L, 0, bw.floor + 0.43, 'sit', 0); // lookout on the bow thwart
    } else {
      for (const s of [-1, 1]) {
        const a = h.at(0.25 * L);
        boatman(w, crew, h, 0.25 * L, s * a.inner * 0.2, a.floor + 0.43, 'sit', s * Math.PI / 2);
      }
    }
  }
  w.endBob();
  return h;
}

/**
 * Papyrus skiff.
 * @param toward  fishing mode (v1.2): the point the seine runs to. The skiff
 *                then carries TWO men — a paddler forward, a hauler aft on the
 *                net side — and returns the hauler's hands for the net line.
 */
function skiff(
  w: W, rng: Rng, det: Rng, cx: number, cz: number, yaw: number, y: number,
  crew: Rng | null = null, toward: [number, number] | null = null,
): V3 | null {
  let hands: V3 | null = null;
  bobScope(w, rng, cx, cz, y, 0.1, 0.012);
  // dried papyrus: buff with a green cast (v1.1 toned it like planking)
  const tone: V3 = [0.64 * rng.range(0.9, 1.1), 0.6 * rng.range(0.9, 1.05), 0.37];
  const L = rng.range(4.5, 7);
  const sweep = rng.range(0.7, 1.2);
  hullClass = 'skiff';
  const h = bundleHull(w, det, { L, B: L * 0.26, draft: 0.2, free: 0.5, sweep, tone }, cx, cz, yaw, y);
  if (crew && Math.abs(y - NILE_WATER_Y) < 0.01) {
    if (toward) {
      // which side faces the net: local +z is world (-sin yaw, cos yaw)
      const side = (toward[0] - cx) * -Math.sin(yaw) + (toward[1] - cz) * Math.cos(yaw) >= 0 ? 1 : -1;
      const ap = h.at(0.2 * L);
      boatman(w, crew, h, 0.2 * L, 0, ap.floor, 'sit', 0);
      lbeam(w, h, [0.2 * L + 0.25, ap.floor + 0.5, -side * ap.half * 0.9], [0.2 * L - 0.3, -0.3, -side * (ap.half + 0.9)], 0.035, WOOD);
      lbeam(w, h, [0.2 * L - 0.36, -0.12, -side * (ap.half + 0.85)], [0.2 * L - 0.24, -0.48, -side * (ap.half + 0.93)], 0.02, WOOD, 0.1); // blade
      const lx = -0.16 * L;
      const ah = h.at(lx);
      boatman(w, crew, h, lx, side * ah.half * 0.3, ah.floor, 'stand', side * Math.PI / 2);
      hands = h.P(lx, ah.floor + 0.95, side * (ah.half * 0.3 + 0.32));
    } else if (crew.chance(0.55)) {
      const lx = -0.18 * L;
      const a = h.at(lx);
      boatman(w, crew, h, lx, 0, a.floor, 'stand', 0);
      lbeam(w, h, [lx + 0.12, a.floor + 1.4, 0.25], [lx - 1.4, -1.6, a.half + 1.0], 0.04, WOOD);
    } else {
      const a = h.at(0);
      boatman(w, crew, h, 0, 0, a.floor, 'sit', 0);
      lbeam(w, h, [0.25, a.floor + 0.5, a.half * 0.9], [-0.3, -0.3, a.half + 0.9], 0.035, WOOD);
      lbeam(w, h, [-0.36, -0.12, a.half + 0.85], [-0.24, -0.48, a.half + 0.93], 0.02, WOOD, 0.1); // blade
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
  w: W, rng: Rng, det: Rng, crew: Rng, hf: Heightfield,
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
  const ha = skiff(w, rng, det, x, z, yawA, ya, crew, [xb, z]);
  const hb = skiff(w, rng, det, xb, z, yawB, yb, crew, [x, z]);
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


/* ------------------------------------------------------------------ */
/* more vessel classes (v1.2 I2, canon Vol IX §9.14)                    */
/* ------------------------------------------------------------------ */

const SACK: V3 = [0.7, 0.62, 0.47];

/** a reed-mat awning on four poles (crew shade) */
function awning(w: W, h: Hull, x: number, len: number): void {
  const a = h.at(x);
  const hw = Math.max(0.4, a.inner * 0.85);
  const f0 = Math.min(h.at(x - len / 2).floor, h.at(x + len / 2).floor) - 0.03;
  for (const px of [-len / 2, len / 2]) {
    for (const s of [-1, 1]) lbox(w, h, x + px, f0, s * hw, 0.08, 1.75, 0.08, WOOD);
  }
  lbox(w, h, x, f0 + 1.75, 0, len + 0.3, 0.07, hw * 2 + 0.3, mul3(MAT, 0.95));
}

/**
 * General cargo boat (canon IX §9.14 "Cargo Transport: food, timber,
 * equipment"): a mid-size planked hull with modest spoon ends, a reed-mat
 * awning aft over the crew, a hold of grain sacks, cedar baulks or jars and
 * baskets. Sailing south it sets a bipod rig; going north the rig lies
 * unstepped on the cargo and the crew rows down the current.
 */
function cargoBoat(
  w: W, rng: Rng, det: Rng, cx: number, cz: number, yaw: number, y: number,
  crew: Rng | null = null, mode: Mode = 'anchored',
): Hull {
  bobScope(w, rng, cx, cz, y, 0.05, 0.006);
  const L = rng.range(11, 15);
  const B = L * rng.range(0.25, 0.29);
  const tone: V3 = [0.47 * rng.range(0.9, 1.08), 0.35, 0.22];
  const sweep = rng.range(0.7, 1.1);
  const kind = rng.int(3); // 0 grain, 1 timber, 2 jars and baskets
  hullClass = 'cargo';
  const h = plankHull(w, det, {
    L, B, draft: 0.6, free: 1.05, sweep, sweepExp: 2.6, full: 0.55, bulw: 0.45, post: 0.6, tone,
  }, cx, cz, yaw, y);
  stemHeads(w, h);
  steeringOars(w, h, 0.85);
  const sailing = mode === 'sailing' || (mode === 'underway' && Math.sin(yaw) > 0.4);
  const rowing = !sailing && (mode === 'rowing' || mode === 'underway');
  const benches = [0.22, 0.3];
  for (const fx of [...benches, -0.14]) {
    const a = h.at(fx * L);
    lbox(w, h, fx * L, a.floor + 0.36, 0, 0.22, 0.07, a.inner * 2, mul3(tone, 1.05));
  }
  awning(w, h, -0.3 * L, 0.14 * L);
  // the hold, amidships
  const hx0 = -0.17 * L;
  const hx1 = 0.15 * L;
  let cargoTop = h.at(0).floor;
  if (kind === 0) {
    for (let x = hx0 + 0.4; x < hx1 - 0.3; x += 0.78) {
      const a = h.at(x);
      const nz = Math.max(1, Math.floor((a.inner * 1.7) / 0.56));
      for (let j = 0; j < nz; j++) {
        const z = -a.inner * 0.85 + (j + 0.5) * ((a.inner * 1.7) / nz);
        const t: V3 = mul3(SACK, det.range(0.9, 1.06));
        const p = h.P(x, a.floor, z);
        w.drum(p[0], p[1], p[2], 0.27, 0.46, t, 0.18, 8); // a filled sack, tied at the neck
        if ((j + Math.round(x)) % 2 === 0) w.drum(p[0], p[1] + 0.46, p[2], 0.25, 0.4, t, 0.2, 8);
      }
      cargoTop = Math.max(cargoTop, a.floor + 0.86);
    }
  } else if (kind === 1) {
    const a = h.at(0);
    for (let layer = 0; layer < 2; layer++) {
      const nlog = layer === 0 ? 4 : 3;
      for (let k = 0; k < nlog; k++) {
        const z = (k - (nlog - 1) / 2) * 0.42;
        const yy = a.floor + 0.2 + layer * 0.36;
        lbeam(w, h, [hx0, yy, z], [hx1, yy, z], 0.18, mul3([0.5, 0.33, 0.2], det.range(0.9, 1.08)));
      }
    }
    cargoTop = a.floor + 0.92;
  } else {
    for (let x = hx0 + 0.35; x < hx1 - 0.3; x += 0.62) {
      const a = h.at(x);
      for (const z of [-0.45, 0, 0.45]) {
        if (Math.abs(z) > a.inner * 0.8) continue;
        const p = h.P(x, a.floor, z * a.inner);
        const jt: V3 = [0.58 * det.range(0.92, 1.06), 0.42, 0.29];
        if (det.chance(0.6)) {
          w.drum(p[0], p[1], p[2], 0.17, 0.4, jt, -0.2, 8);
          w.drum(p[0], p[1] + 0.4, p[2], 0.25, 0.26, jt, 0.45, 8);
        } else {
          w.drum(p[0], p[1], p[2], 0.26, 0.42, mul3(MAT, 0.9), -0.12, 9); // a basket
        }
      }
      cargoTop = Math.max(cargoTop, a.floor + 0.66);
    }
  }
  if (sailing) {
    bipodMast(w, h, 0.17 * L, true);
  } else {
    // the unstepped bipod lies on the cargo with the yard and the furled sail
    for (const s of [-0.18, 0.18]) lbeam(w, h, [-0.24 * L, cargoTop + 0.08, s], [0.18 * L, cargoTop + 0.08, s * 0.4], 0.07, WOOD);
    lbeam(w, h, [-0.2 * L, cargoTop + 0.24, 0.05], [0.12 * L, cargoTop + 0.24, 0.05], 0.13, SAILCLOTH, 0.11);
  }
  const afloat = Math.abs(y - NILE_WATER_Y) < 0.01;
  if (mode === 'anchored' && afloat) anchorLine(w, h);
  if (crew && afloat) {
    const sx = -0.4 * L;
    boatman(w, crew, h, sx, 0, h.at(sx).floor, 'stand', 0);
    if (rowing) {
      for (const fx of benches) {
        const a = h.at(fx * L);
        for (const s of [-1, 1]) {
          boatman(w, crew, h, fx * L, s * a.inner * 0.5, a.floor + 0.43, 'sit', Math.PI);
          oar(w, h, fx * L, s);
        }
      }
    } else if (sailing) {
      const a = h.at(0.3 * L);
      boatman(w, crew, h, 0.3 * L, 0, a.floor + 0.43, 'sit', 0);
    } else {
      const a = h.at(-0.3 * L);
      boatman(w, crew, h, -0.3 * L, 0.2, a.floor, 'sit', Math.PI / 2);
    }
  }
  w.endBob();
  return h;
}

/** a baldachin on slender columns (papyrus-bundle style), flat mat roof */
function canopy(w: W, h: Hull, x: number, len: number): void {
  const a = h.at(x);
  const hw = Math.min(a.inner * 0.85, h.B * 0.3);
  const f0 = Math.min(h.at(x - len / 2).floor, h.at(x + len / 2).floor) - 0.02;
  for (const px of [-len / 2, 0, len / 2]) {
    for (const s of [-1, 1]) {
      lbox(w, h, x + px, f0, s * hw, 0.12, 2.1, 0.12, mul3(WOOD, 1.1));
      lbox(w, h, x + px, f0 + 1.96, s * hw, 0.2, 0.14, 0.2, mul3(WOOD, 1.2)); // capital
    }
  }
  lbox(w, h, x, f0 + 2.1, 0, len + 0.4, 0.09, hw * 2 + 0.4, [0.78, 0.74, 0.62]); // linen-covered roof
}

/**
 * Ceremonial (royal) barque after the Khufu I vessel (canon IX §9.14;
 * §9.15: Khufu I is evidence of Fourth Dynasty boatbuilding, NOT a cargo
 * barge): long and slender (~1:7.4), tall papyriform ends, a deckhouse with
 * a baldachin forward of it, oars shipped on the thwarts, two pairs of big
 * steering oars, cedar-toned. Moored along the quay north of the middle pier.
 */
function ceremonial(
  w: W, rng: Rng, det: Rng, cx: number, cz: number, yaw: number, y: number, crew: Rng | null,
): Hull {
  bobScope(w, rng, cx, cz, y, 0.03, 0.002);
  const L = rng.range(30, 34);
  const B = L * 0.135;
  const tone: V3 = [0.53 * rng.range(0.95, 1.05), 0.34, 0.22];
  const sweep = rng.range(2.5, 2.9);
  hullClass = 'ceremonial';
  const h = plankHull(w, det, {
    L, B, draft: 0.8, free: 1.35, sweep, sweepExp: 2.2, full: 0.7, bulw: 0.55, post: 3.8, tone,
  }, cx, cz, yaw, y);
  papyriformPosts(w, h, 1.7);
  for (let fx = 0.12; fx <= 0.4; fx += 0.07) {
    const a = h.at(fx * L);
    lbox(w, h, fx * L, a.floor + 0.36, 0, 0.24, 0.07, a.inner * 2, mul3(tone, 1.06));
  }
  deckhouse(w, h, -0.07 * L, 0.26 * L);
  canopy(w, h, 0.1 * L, 0.11 * L);
  steeringOars(w, h, 1.25);
  stowedOars(w, h, 0.14 * L, 0.42 * L, 10);
  if (crew && Math.abs(y - NILE_WATER_Y) < 0.01) {
    for (const s of [-1, 1]) {
      const a = h.at(0.1 * L);
      boatman(w, crew, h, 0.1 * L, s * a.inner * 0.45, a.floor, 'stand', s * Math.PI / 2);
    }
    boatman(w, crew, h, -0.38 * L, 0, h.at(-0.38 * L).floor, 'stand', 0);
  }
  w.endBob();
  return h;
}

/**
 * River ferry: a broad papyrus-bundle raft with a plank deck lashed across
 * it, poled from both ends (double-ended: it never turns, it reverses), a
 * few passengers and their loads.
 */
function ferry(w: W, rng: Rng, det: Rng, cx: number, cz: number, yaw: number, y: number, crew: Rng | null): Hull {
  bobScope(w, rng, cx, cz, y, 0.06, 0.008);
  const tone: V3 = [0.64 * rng.range(0.92, 1.06), 0.6 * rng.range(0.92, 1.04), 0.37];
  const L = rng.range(8, 9.5);
  const sweep = rng.range(0.4, 0.6);
  hullClass = 'ferry';
  const h = bundleHull(w, det, { L, B: L * 0.34, draft: 0.25, free: 0.55, sweep, tone }, cx, cz, yaw, y);
  const d = h.at(0);
  lbox(w, h, 0, d.floor - 0.02, 0, 0.5 * L, 0.07, h.B * 0.78, mul3(WOOD, 1.15)); // the plank deck
  const top = d.floor + 0.05;
  if (crew && Math.abs(y - NILE_WATER_Y) < 0.01) {
    for (const s of [-1, 1]) {
      const lx = s * 0.34 * L;
      const a = h.at(lx);
      boatman(w, crew, h, lx, 0.15 * s, a.floor, 'stand', s > 0 ? Math.PI : 0);
      lbeam(w, h, [lx - s * 0.1, a.floor + 1.42, 0.3 * s], [lx + s * 1.5, -1.8, (a.half + 1.0) * s], 0.045, WOOD);
    }
    for (let k = 0; k < 3; k++) {
      boatman(w, crew, h, (k - 1) * 0.9, crew.range(-0.5, 0.5), top, 'stand', crew.float() * Math.PI * 2);
    }
    const jp = h.P(0.6, top, -0.7);
    w.drum(jp[0], jp[1], jp[2], 0.2, 0.42, [0.58, 0.42, 0.29], -0.2, 8);
    const bp = h.P(-0.7, top, 0.75);
    w.drum(bp[0], bp[1], bp[2], 0.28, 0.4, mul3(MAT, 0.9), -0.12, 9);
  }
  w.endBob();
  return h;
}

/** a hull-like frame on land (figures and props outside any boat) */
function landFrame(x: number, z: number, yaw: number, y: number): Hull {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return {
    L: 0, B: 0, yaw, end: 0, tone: WOOD,
    P: (lx, ly, lz) => [x + lx * c - lz * s, y + ly, z + lx * s + lz * c],
    at: () => ({ sheer: 0, floor: 0, half: 0, inner: 0 }),
  };
}

/**
 * The Tura limestone arriving (canon IX §9.19 stages 6–8, after the Diary of
 * Merer — nothing invented beyond what the stages name): at the south-shore
 * slipway a dressed block sits on its sledge on the ramp with tow ropes run
 * up to the hauling team; two blocks already wait on timber at the ramp head;
 * a scribe sits on a mat with his writing board and palette, recording the
 * delivery, a supervisor with a staff beside him under a mat shade. The barge
 * itself comes and goes on its own track (moving fleet).
 */
function unloadingTableau(w: W, hf: Heightfield, crew: Rng, det: Rng): void {
  const grd = (x: number, z: number): number => hf.heightAtCpu(x, z);
  const r = slipwayRamp(grd, 2);
  const yaw = Math.atan2(r.uz, r.ux); // down the ramp, toward the water
  const along = (t: number, side: number): [number, number] => [
    r.sx0 + r.ux * t - r.uz * side, r.sz0 + r.uz * t + r.ux * side,
  ];
  const west = -r.uz < 0 ? 1 : -1; // the side whose world x is smaller
  const tura: V3 = [0.84, 0.8, 0.7];
  // the sledge with its block, on the ramp tread
  {
    const [bx, bz] = along(Math.min(10, r.tShore * 0.45), 0);
    const ty = grd(bx, bz) + 0.25;
    const f = landFrame(bx, bz, yaw + Math.PI, ty); // nose up the ramp
    for (const s of [-0.62, 0.62]) lbox(w, f, 0, 0, s, 3.8, 0.22, 0.26, WOOD);
    for (let k = 0; k < 5; k++) lbox(w, f, -1.4 + k * 0.7, 0.2, 0, 0.16, 0.1, 1.6, mul3(WOOD, 0.9));
    lbox(w, f, 0, 0.3, 0, 1.9, 1.15, 1.25, mul3(tura, det.range(0.96, 1.02)));
    // tow ropes up the ramp to the hauling team at the head — the far ends
    // at the haulers' hands over the RISING ground, not at sledge height
    const tS = Math.min(10, r.tShore * 0.45);
    for (const s of [-0.5, -0.17, 0.17, 0.5]) {
      const [ex, ez] = along(tS - 14, s * 2.2);
      beam(w, f.P(1.9, 0.28, s), [ex, grd(ex, ez) + 0.95, ez], 0.03, ROPE);
    }
  }
  // two blocks waiting on timber at the ramp head (staging), west side
  for (const [t, side] of [[-3, 5.2], [-6, 5.4]] as const) {
    const [x, z] = along(t, side * west);
    const y = grd(x, z) - 0.05;
    const f = landFrame(x, z, yaw, y);
    for (const s of [-0.55, 0.55]) lbox(w, f, s, 0, 0, 0.22, 0.2, 1.6, WOOD);
    lbox(w, f, 0, 0.2, 0, 1.8, 1.05, 1.2, mul3(tura, det.range(0.95, 1.02)));
    fpReg({ id: `staging:${t}`, family: 'harbor-works', x, z, hx: 1.2, hz: 1.0, yaw, y0: y, y1: y + 1.3, ground: 'grounded' });
  }
  // the scribe and the supervisor under a mat shade, facing the ramp
  {
    const [x, z] = along(-1.5, 9.5 * west);
    const y = grd(x, z) - 0.02;
    const face = Math.atan2(r.sz0 - z, r.sx0 - x); // toward the ramp head
    const f = landFrame(x, z, face, y);
    lbox(w, f, 0, 0, 0, 1.4, 0.03, 1.1, mul3(MAT, 0.9)); // his mat
    boatman(w, crew, f, 0, 0, 0.03, 'sit', 0);
    lbox(w, f, 0.36, 0.52, 0, 0.32, 0.03, 0.42, [0.62, 0.55, 0.4]); // writing board on his lap
    lbox(w, f, 0.22, 0.03, 0.42, 0.24, 0.05, 0.08, [0.5, 0.4, 0.28]); // palette with reed pens
    const jp = f.P(-0.2, 0.03, -0.55);
    w.drum(jp[0], jp[1], jp[2], 0.14, 0.3, [0.58, 0.42, 0.29], -0.2, 8); // water jar
    boatman(w, crew, f, -0.3, 1.0, 0, 'stand', 0); // the supervisor
    lbeam(w, f, [0.05, 0, 1.25], [0.12, 1.75, 1.22], 0.025, WOOD); // his staff
    for (const px of [-1.1, 1.1]) for (const pz of [-1.2, 1.5]) lbox(w, f, px, 0, pz, 0.08, 2.2, 0.08, WOOD);
    lbox(w, f, 0, 2.2, 0.15, 2.5, 0.06, 3.0, mul3(MAT, 0.95));
    fpReg({ id: 'scribe-shade', family: 'harbor-works', x, z, hx: 1.3, hz: 1.7, yaw: face, y0: y, y1: y + 2.3, ground: 'grounded' });
  }
}

/* ------------------------------------------------------------------ */
/* the moving fleet (v1.2 I2, canon Vol IX §9.16–9.19)                  */
/* ------------------------------------------------------------------ */

interface Mover {
  kind: string;
  k: number;
  hull: Hull | null;
  sink: number;
  /** 1: one-way track that grows/shrinks in at its ends (world edge) */
  fade: number;
  phase: number;
  lane?: 'N' | 'S';
  speed?: number;
  track: TrackPoint[];
}

let fleetState: {
  movers: Array<{ kind: string; start: number; count: number; cycle: number; phase: number; L: number; B: number }>;
  track: Float32Array;
} | null = null;

/** moving hulls built in the season's last count — read by the scene HUD */
export let movingCount = 0;

/** CPU replica of the moving-fleet vertex stage: where each hull is at
 *  world time t (tooling: tools/closeup.ts --fleet) */
export function fleetAt(t: number): Array<{ id: string; kind: string; x: number; z: number; a: number; load: number; conf: string }> {
  if (!fleetState) return [];
  const T = fleetState.track;
  return fleetState.movers.map((m, k) => {
    const u = (((t / m.cycle + m.phase) % 1) + 1) % 1;
    const fi = u * (m.count - 1);
    const i0 = Math.min(Math.max(Math.floor(fi), 0), m.count - 2);
    const f = fi - i0;
    const a = (m.start + i0) * 4;
    const b = a + 4;
    const lerp = (o: number): number => (T[a + o] as number) + ((T[b + o] as number) - (T[a + o] as number)) * f;
    return { id: `mover:${k}`, kind: m.kind, x: lerp(0), z: lerp(1), a: lerp(2), load: lerp(3), conf: moverEvidence(m.kind).conf };
  });
}

/**
 * (v1.2 I6) The moving hulls have no footprint, and nothing tested them
 * against the harbour (Haiku I6-C): sample every mover's track every 2 s
 * over its whole cycle and test its hull rectangle (L × B on its heading)
 * against the harbour's solid works and the moored and anchored hulls. The
 * shuttle's contact with the cargo landing it lies alongside is the design.
 */
export function fleetClearance(): { kind: string; id: string; t: number }[] {
  if (!fleetState) return [];
  const solid = fpAll().filter((f) => !f.passive && (f.family === 'harbor-works' || f.family === 'vessels'));
  const boxes = solid.map((f) => ({ f, b: fpAabb(f) }));
  const out: { kind: string; id: string; t: number }[] = [];
  const seen = new Set<string>();
  const corners = (x: number, z: number, a: number, hx: number, hz: number): [number, number][] => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([u, v]) => [x + u! * c - v! * s, z + u! * s + v! * c]);
  };
  const sep = (P: [number, number][], Q: [number, number][]): boolean => {
    for (const poly of [P, Q]) {
      for (let i = 0; i < 4; i++) {
        const [x0, z0] = poly[i]!;
        const [x1, z1] = poly[(i + 1) % 4]!;
        const nx = z1 - z0;
        const nz = x0 - x1;
        let pMin = Infinity;
        let pMax = -Infinity;
        let qMin = Infinity;
        let qMax = -Infinity;
        for (const [x, z] of P) { const d = x * nx + z * nz; pMin = Math.min(pMin, d); pMax = Math.max(pMax, d); }
        for (const [x, z] of Q) { const d = x * nx + z * nz; qMin = Math.min(qMin, d); qMax = Math.max(qMax, d); }
        if (pMax < qMin || qMax < pMin) return true;
      }
    }
    return false;
  };
  const maxCycle = Math.max(...fleetState.movers.map((m) => m.cycle));
  for (let t = 0; t < maxCycle; t += 2) {
    const at = fleetAt(t);
    for (const [k, p] of at.entries()) {
      const m = fleetState.movers[k]!;
      if (t >= m.cycle) continue;
      const R = Math.hypot(m.L, m.B) / 2;
      const P = corners(p.x, p.z, p.a, m.L / 2, m.B / 2);
      for (const { f, b } of boxes) {
        if (p.x + R < b.x0 || p.x - R > b.x1 || p.z + R < b.z0 || p.z - R > b.z1) continue;
        if (m.kind === 'harbour-shuttle' && f.id.startsWith('landing:cargo')) continue;
        if (!sep(P, corners(f.x, f.z, f.yaw ?? 0, f.hx, f.hz))) {
          const key = `${m.kind}|${f.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push({ kind: m.kind, id: f.id, t });
          }
        }
      }
    }
  }
  return out;
}

/**
 * The moving fleet's material: each vertex carries its hull's index and,
 * for cargo, the load below which it has gone ashore. The vertex stage reads
 * the hull's time track (Navigation.ts) — position, heading, load — rotates
 * the hull-local vertex onto it, sinks the hull by sink·load, hides unloaded
 * cargo, and grows/shrinks one-way hulls in at the world edge. Normals are
 * rotated with it (v1.1's static hulls never needed that).
 */
function movingMaterial(track: Float32Array, hullA: Float32Array, hullB: Float32Array, gi: ProbeGI | null): MeshPhysicalNodeMaterial {
  const mat = new MeshPhysicalNodeMaterial();
  const T = instancedArray(track, 'vec4');
  const HAb = instancedArray(hullA, 'vec4');
  const HBb = instancedArray(hullB, 'vec4');
  const nav = attribute('nav', 'vec2') as unknown as NV2;
  const hid = nav.x.max(0).toInt();
  const HA = HAb.element(hid); // track start, sample count, cycle (s), phase
  const HB = HBb.element(hid); // sink, fade flag
  const t = uWorldTime;
  const u = t.div(HA.z).add(HA.w).fract();
  const fi = u.mul(HA.y.sub(1));
  const i0 = fi.floor().clamp(0, HA.y.sub(2));
  const f = fi.sub(i0);
  const base = HA.x.add(i0);
  const P0 = T.element(base.toInt());
  const P1 = T.element(base.add(1).toInt());
  const px = mix(P0.x, P1.x, f);
  const pz = mix(P0.y, P1.y, f);
  const ang = mix(P0.z, P1.z, f);
  const load = mix(P0.w, P1.w, f);
  // heave + tilt about the hull's own origin (it was built at 0,0)
  const A = attribute('bobA', 'vec4') as unknown as NV4;
  const B = attribute('bobB', 'vec4') as unknown as NV4;
  const heave = sin(t.mul(B.z).add(A.z)).mul(A.w);
  const roll = sin(t.mul(B.z.mul(0.63)).add(A.z.mul(1.7))).mul(B.w);
  const lever = positionLocal.xz.sub(vec2(A.x, A.y)).dot(vec2(B.x, B.y));
  const lp0 = positionLocal.sub(vec3(0, NILE_WATER_Y, 0)).add(vec3(0, heave.add(lever.mul(roll)), 0));
  // cargo below its threshold has gone ashore: collapse it inside the hull
  const shown = load.greaterThan(nav.y).select(float(1), float(0));
  const lp1 = mix(vec3(0, 0.3, 0), lp0, shown);
  const lp = lp1.sub(vec3(0, HB.x.mul(load), 0));
  const k = mix(float(1), smoothstep(0, 0.015, u).mul(smoothstep(1, 0.985, u)), HB.y);
  const c = cos(ang);
  const s = sin(ang);
  const rx = lp.x.mul(c).sub(lp.z.mul(s));
  const rz = lp.x.mul(s).add(lp.z.mul(c));
  mat.positionNode = vec3(px.add(rx.mul(k)), lp.y.mul(k).add(NILE_WATER_Y), pz.add(rz.mul(k)));
  const nl = normalLocal;
  const nWorld = varying(vec3(nl.x.mul(c).sub(nl.z.mul(s)), nl.y, nl.x.mul(s).add(nl.z.mul(c)))) as unknown as NV3;
  mat.normalNode = transformNormalToView(nWorld);
  mat.colorNode = attribute('tone', 'vec3') as unknown as NV3;
  mat.roughnessNode = float(0.72);
  mat.metalnessNode = float(0);
  mat.specularIntensity = 0.35;
  giLightMap(mat, gi, nWorld, 1.0);
  return mat;
}

export function buildHarbor(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
  /** (T3-2) KHUFU_LATE, "advanced construction and limestone transport"
   *  (IX:121): a SECOND Tura barge on the Merer route, half a cycle behind */
  late = false,
): number {
  const rng = seed.rng('harbor');
  // crews draw from their OWN stream: the fleet's draws stay as they were
  const crew = seed.rng('harbor-crews');
  // hull detail (strake tones, cargo jitter) likewise: v1.2's richer hulls
  // must not re-roll the harbour's layout
  const det = seed.rng('harbor-detail');
  // the moving fleet's own stream (v1.2 I2): phases and the newcomers
  const traffic = seed.rng('harbor-traffic');
  crewCount = 0;
  movingCount = 0;
  fleetState = null;
  const wm = new W();
  const movers: Mover[] = [];
  /** build a hull at the origin into the moving writer as mover #k */
  const mover = (kind: string, build: (wm: W) => Hull): Mover => {
    const k = movers.length;
    wm.setNav(k);
    registerHulls = false;
    const hull = build(wm);
    registerHulls = true;
    wm.setNav(-1);
    const m: Mover = { kind, k, hull, sink: 0, fade: 1, phase: traffic.float(), track: [] };
    movers.push(m);
    return m;
  };
  const turaOut = { sink: 0 };
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

  /* --- (v1.2 I6) THE WEST SHORE — canon IX §9.12: the agent "must not
   * automatically generate a long continuous stone quay or forest of timber
   * piers". The v1.2 quay was one 180 m box seated at the run's most seaward
   * shore point; the bank curves, so mid-run it stood 35–45 m off the land
   * (measured: waterline x ≈ 876 at z −135, ≈ 920 at z −225) — a mole
   * closing a lagoon, with part of its gang standing in the water. Now the
   * dredged bank itself, rammed and staked, with two short stone landings at
   * the deep-water line, two plank ramps, and the three pile piers kept for
   * the brief §2 floor (D-14; confidence in HarbourEvidence.ts). Positions
   * are constants or probes: the `harbor` stream draws exactly as before.
   * Plan: docs/plans/I6_PLAN.md §3.1. --------------------------------------- */
  const land = seed.rng('harbor-landings');
  const landDet = seed.rng('harbor-landings-det');
  const stoneL = new GeoWriter();
  const wornL = new GeoWriter();
  const bankL = new ColorWriter();
  harborLanterns.length = 0;
  harborWorksRects.length = 0;
  const TOP = NILE_WATER_Y + 1.0; // a landing's top: a boat's sheer
  const TIMBER: V3 = [0.38, 0.28, 0.17];
  const PATH: C3 = [0.5, 0.43, 0.33];
  /** first x (0.5 m steps, out from the plain) where the ground falls to y */
  const contour = (z: number, y: number): number => {
    let x = 840;
    while (x < 1000 && hf.heightAtCpu(x, z) > y) x += 0.5;
    return x;
  };
  const bedUnder = (x0: number, x1: number, z0: number, z1: number): number => {
    let m = Infinity;
    for (let i = 0; i <= 6; i++) {
      for (let j = 0; j <= 6; j++) m = Math.min(m, hf.heightAtCpu(x0 + ((x1 - x0) * i) / 6, z0 + ((z1 - z0) * j) / 6));
    }
    return m;
  };
  /** an up-facing quad laid on the ground (+lift) */
  const up = (a: C3, b: C3, c: C3, d: C3, t: C3): void => {
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny >= 0) bankL.quad(a, b, c, d, t);
    else bankL.quad(d, c, b, a, t);
  };
  /** a trodden earth path over [x0,x1] × [z0,z1], following the ground */
  const trodden = (x0: number, x1: number, z0: number, z1: number): void => {
    const g = (x: number, z: number): C3 => [x, hf.heightAtCpu(x, z) + 0.05, z];
    for (let x = x0; x < x1 - 0.01; x += 1) {
      const xb = Math.min(x + 1, x1);
      up(g(x, z0), g(x, z1), g(xb, z1), g(xb, z0), PATH);
    }
  };
  // the old quay's face, kept ONLY for the moored hulls at piers 1 and 3:
  // the v1.2 formula verbatim, so those hulls stay exactly where they were
  let MOORING_X = 0;
  for (let z = -225; z <= -45; z += 30) MOORING_X = Math.max(MOORING_X, shoreX(z, 1.6));
  MOORING_X += 2 + 7;
  let cargoFaceX = 0;

  /* the ROYAL LANDING on the valley temple's axis ("low stone structures or
   * prepared shore platforms"; "doorways align logically"): let into the
   * bank, its face on the 1.8 m line, a slab-paved top at a boat's sheer,
   * two worn steps down the face to the water */
  let royalX = 0;
  {
    const z0 = -135;
    const z1 = -95;
    let xR = 0;
    let xB = Infinity;
    for (let z = z0; z <= z1; z += 5) {
      xR = Math.max(xR, contour(z, NILE_WATER_Y - 1.8) + 0.5);
      xB = Math.min(xB, contour(z, TOP + 0.05) - 0.4);
    }
    royalX = xR;
    const bed = bedUnder(xB, xR, z0, z1);
    stoneL.box((xB + xR) / 2, bed - 0.3, (z0 + z1) / 2, xR - xB, TOP - bed + 0.3, z1 - z0, 1.0);
    // two steps down the face, smoother and darker where the water works them
    for (const [k, top] of [[0, NILE_WATER_Y + 0.4], [1, NILE_WATER_Y - 0.2]] as const) {
      wornL.box(xR + 0.3 + k * 0.6, bed - 0.3, -115, 0.62, top - bed + 0.3, 12, 0.92);
    }
    // timber fenders along the face, two stone bollards on the top
    for (let z = z0 + 2; z <= z1 - 2; z += 4) {
      if (Math.abs(z + 115) < 6.5) continue; // the steps
      w.box(xR + 0.16, bed, z, 0.26, TOP + 0.35 - bed, 0.26, TIMBER);
    }
    for (const zb of [-125, -105]) stoneL.drum(xR - 1.6, TOP, zb, 0.28, 0.72, 0.96, 0.08, 12);
    // the plain brought down to it: a trodden earth way
    trodden(xB - 8, xB + 0.5, -119, -111);
    harborLanterns.push([xB + 1.2, z0 + 1.5], [xB + 1.2, z1 - 1.5]);
    fpReg({
      id: 'landing:royal', family: 'harbor-works', x: (xB + xR) / 2, z: (z0 + z1) / 2,
      hx: (xR - xB) / 2, hz: (z1 - z0) / 2, y0: bed - 0.3, y1: TOP, ground: 'platform', cutting: true,
    });
    harborWorksRects.push({ x0: xB, x1: xR + 1.5, z0, z1 });
  }

  /* the CARGO LANDING: stone at the bank, a timber stage on piles out to the
   * 1.6 m line where the shuttle lies alongside; rope coils, a sledge */
  {
    const z0 = -200;
    const z1 = -175;
    let xB = Infinity;
    let xS = 0;
    let xC = 0;
    for (let z = z0; z <= z1; z += 5) {
      xB = Math.min(xB, contour(z, TOP + 0.05) - 0.4);
      xS = Math.max(xS, contour(z, NILE_WATER_Y - 1.2));
      xC = Math.max(xC, contour(z, NILE_WATER_Y - 1.6) + 2);
    }
    xS = Math.max(xS, xB + 5);
    xC = Math.max(xC, xS + 4);
    cargoFaceX = xC;
    const bed = bedUnder(xB, xS, z0, z1);
    stoneL.box((xB + xS) / 2, bed - 0.3, (z0 + z1) / 2, xS - xB, TOP - bed + 0.3, z1 - z0, 0.97);
    // the stage: braced piles in three rows, capped, planked
    const sz0 = -196;
    const sz1 = -179;
    for (let x = xS + 1.2; x < xC; x += 3) {
      for (const z of [sz0 + 0.5, (sz0 + sz1) / 2, sz1 - 0.5]) {
        const b = hf.heightAtCpu(x, z);
        w.box(x, b - 0.3, z, 0.3, TOP - 0.2 - b + 0.3, 0.3, TIMBER);
      }
      beam(w, [x, TOP - 0.3, sz0 + 0.5], [x, TOP - 0.3, sz1 - 0.5], 0.09, TIMBER);
    }
    for (let z = sz0 + 0.25; z < sz1; z += 0.5) {
      w.box((xS + xC) / 2, TOP - 0.2, z, xC - xS + 0.2, 0.18, 0.46, mul3(WOOD, land.range(0.92, 1.08)));
    }
    // rope coils and a sledge on the stone, bollards at the stage head
    for (let k = 0; k < 4; k++) {
      const cx = xB + 2.5 + (k % 2) * 1.5;
      const cz = z0 + 3 + Math.floor(k / 2) * 1.5;
      w.drum(cx, TOP, cz, 0.55, 0.16, ROPE, 0, 14);
      w.drum(cx, TOP + 0.16, cz, 0.42, 0.12, mul3(ROPE, 0.92), 0, 14);
    }
    for (const dz of [-0.6, 0.6]) w.box(xB + 6, TOP, z1 - 4 + dz, 3.4, 0.2, 0.26, TIMBER);
    w.box(xB + 6, TOP + 0.2, z1 - 4, 3.1, 0.12, 1.4, TIMBER);
    for (const zb of [sz0 + 1, sz1 - 1]) stoneL.drum(xS - 1.2, TOP, zb, 0.26, 0.7, 0.96, 0.08, 12);
    trodden(xB - 8, xB + 0.5, -191, -183);
    fpReg({
      id: 'landing:cargo', family: 'harbor-works', x: (xB + xS) / 2, z: (z0 + z1) / 2,
      hx: (xS - xB) / 2, hz: (z1 - z0) / 2, y0: bed - 0.3, y1: TOP, ground: 'platform', cutting: true,
    });
    fpReg({
      id: 'landing:cargo-stage', family: 'harbor-works', x: (xS + xC) / 2, z: (sz0 + sz1) / 2,
      hx: (xC - xS) / 2, hz: (sz1 - sz0) / 2, y0: TOP - 0.2, y1: TOP, ground: 'none',
    });
    harborWorksRects.push({ x0: xB, x1: xC + 1, z0, z1 });
  }

  /* two PLANK RAMPS ("Ramps, planks, braces, or simple landing structures"):
   * from the bank top down to a small stage on braced piles 0.35 m above
   * the water, a papyrus skiff nosed in at each */
  for (const [id, z] of [['t1', -70], ['t2', -212]] as const) {
    const xT = contour(z, -44.75);
    const xW = contour(z, NILE_WATER_Y);
    const deck = NILE_WATER_Y + 0.35;
    const s0 = xW - 0.6;
    const s1 = xW + 3.4;
    for (const x of [s0 + 0.2, s1 - 0.2]) {
      for (const dz of [-1.3, 1.3]) {
        const b = hf.heightAtCpu(x, z + dz);
        w.box(x, b - 0.3, z + dz, 0.24, deck - b + 0.3, 0.24, TIMBER);
      }
    }
    beam(w, [s0 + 0.2, deck - 0.1, z - 1.3], [s1 - 0.2, NILE_WATER_Y - 0.4, z + 1.3], 0.05, TIMBER); // brace
    for (let k = 0; k < 7; k++) w.box(s0 + 0.3 + k * 0.57, deck, z, 0.52, 0.1, 3.0, mul3(WOOD, land.range(0.9, 1.08)));
    // the ramp: six planks from the bank top down to the stage
    const yT = hf.heightAtCpu(xT, z) + 0.05;
    for (let k = 0; k < 6; k++) {
      const pz = z - 1.1 + k * 0.44;
      beam(w, [xT, yT, pz], [s0 + 0.3, deck + 0.08, pz], 0.07, mul3(WOOD, land.range(0.9, 1.08)), 0.03);
    }
    trodden(xT - 10, xT, z - 1.6, z + 1.6);
    // nosed in at the stage — no crew: the crew stream must keep its count
    const kx = s1 + 4.0;
    skiff(w, land, landDet, kx, z, Math.PI, floatY(kx, z, 0.2));
    vessels++;
    fpReg({
      id: `plank-ramp:${id}`, family: 'harbor-works', x: (xT + s1) / 2, z, hx: (s1 - xT) / 2, hz: 1.6,
      y0: NILE_WATER_Y - 1, y1: deck + 0.2, ground: 'none',
    });
    harborWorksRects.push({ x0: xT, x1: s1 + 1, z0: z - 2, z1: z + 2 });
  }

  /* --- three timber piers on piles, rooted on the bank ---------------------- */
  // (v1.2 I6) all three spring from the beach now; the middle one moved from
  // z −130 to −150, clear of the royal landing before the temple front
  for (const pz of [-230, -150, -30]) {
    const px0 = shoreX(pz, 1.2) - 10;
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
    // dockside clutter: jars and crates on the deck (same draws as v1.1;
    // the narrower items are now jars, not boxes)
    const n = rng.int(5) + 2;
    for (let i = 0; i < n; i++) {
      const cx2 = px0 + 4 + rng.float() * (len - 8);
      const cz2 = pz + rng.range(-1.4, 1.4);
      const lx = rng.range(0.5, 1);
      const ly = rng.range(0.4, 0.9);
      const lz = rng.range(0.5, 1);
      if (lx < 0.72) {
        const jy = NILE_WATER_Y + 1.22;
        w.drum(cx2, jy, cz2, lx * 0.36, ly * 0.62, [0.6, 0.44, 0.3], -0.25, 9);
        w.drum(cx2, jy + ly * 0.62, cz2, lx * 0.36 + 0.25 * ly * 0.62, ly * 0.38, [0.6, 0.44, 0.3], 0.5, 9);
      } else {
        w.box(cx2, NILE_WATER_Y + 1.22, cz2, lx, ly, lz, [0.6, 0.47, 0.3]);
      }
    }
    // moored vessels flanking the pier's outer (deep) half. Piers 1 and 3
    // keep the v1.2 clamps verbatim (their hulls do not move); the moved
    // pier's hulls stay off the beach and within its reach
    {
      const keep = pz !== -150;
      const bx = Math.max(px0 + len - 6 - rng.float() * 18, keep ? MOORING_X + 13.5 : shoreX(pz - 7.5, 1.6) + 15); // + half barge length
      const tx = Math.max(px0 + len - 8 - rng.float() * 18, keep ? MOORING_X + 11 : shoreX(pz + 7.5, 1.6) + 15);
      const hb = barge(w, rng, det, bx, pz - 7.5, rng.range(-0.12, 0.12), floatY(bx, pz - 7.5, 0.9), crew, 'moored');
      moor(w, hb, px0, len, pz - 2.3, pz - 1.85);
      const ht = traveler(w, rng, det, tx, pz + 7.5, Math.PI + rng.range(-0.12, 0.12), floatY(tx, pz + 7.5, 0.6), crew, 'moored');
      moor(w, ht, px0, len, pz + 2.3, pz + 1.85);
      vessels += 2;
    }
  }

  /* --- the royal barque at the royal landing (v1.2 I2; I6: from z −80 — which
   *      lay SOUTH of the old middle pier, not north — to the temple axis) ---- */
  {
    const royal = seed.rng('harbor-royal');
    const zc = -115;
    const bx = royalX + 32 * 0.135 * 0.5 + 1.2;
    const h = ceremonial(w, royal, det, bx, zc, -Math.PI / 2, floatY(bx, zc, 0.8), crew);
    // two lines to the landing's bollards and a gangplank to its top
    for (const zb of [-125, -105]) {
      const lx = zc - zb; // hull-local x runs north (yaw −π/2): local +x = world −z
      const a = h.at(lx);
      const A = h.P(lx, a.sheer + 0.05, -a.half * 0.92);
      beam(w, A, [royalX - 1.6, TOP + 0.65, zb], 0.025, ROPE);
    }
    const g = h.at(-2);
    beam(w, h.P(-2, g.sheer, -g.half * 0.9), [royalX - 0.6, TOP + 0.12, zc + 2], 0.32, mul3(WOOD, 1.1), 0.04);
    vessels++;
  }

  /* --- the EARTHEN EMBANKMENT along the rest of the west shore ("Compacted
   *      earth or sediment surfaces used to stabilize movement near the
   *      water"): the dredged bank rammed and dressed, a wet band at the
   *      waterline ("wet silt along the riverbank"), mooring stakes; broken
   *      at every landing, ramp and pier root ---------------------------------- */
  {
    const RAMMED: C3 = [0.4, 0.33, 0.25];
    const WET: C3 = [0.25, 0.2, 0.16];
    const gaps: [number, number][] = [[-201, -174], [-136, -94], [-73, -67], [-215, -209], [-233, -227], [-153, -147], [-33, -27]];
    const strip = (za: number, zb: number, ya: number, yb: number, lift: number, t: C3): void => {
      const a0 = contour(za, ya);
      const a1 = contour(za, yb);
      const b0 = contour(zb, ya);
      const b1 = contour(zb, yb);
      if (a1 - a0 < 0.4 || b1 - b0 < 0.4) return;
      const P = (x: number, z: number): C3 => [x, hf.heightAtCpu(x, z) + lift, z];
      for (let i = 0; i < 3; i++) {
        const fa = (v: number): number => a0 + ((a1 - a0) * v) / 3;
        const fb = (v: number): number => b0 + ((b1 - b0) * v) / 3;
        up(P(fa(i), za), P(fa(i + 1), za), P(fb(i + 1), zb), P(fb(i), zb), t);
      }
    };
    let k = 0;
    let lastStake = -999;
    for (let z = -240; z < -20; z += 4) {
      if (gaps.some(([g0, g1]) => z + 4 > g0 && z < g1)) continue;
      strip(z, z + 4, -44.75, NILE_WATER_Y - 0.4, 0.04, RAMMED);
      strip(z, z + 4, NILE_WATER_Y + 0.3, NILE_WATER_Y - 0.3, 0.07, WET);
      if (z - lastStake >= 18) {
        const sx = contour(z + 2, NILE_WATER_Y + 0.15);
        const sy = hf.heightAtCpu(sx, z + 2);
        w.box(sx, sy - 0.4, z + 2, 0.13, 1.5, 0.13, TIMBER);
        lastStake = z;
      }
      if ((z + 240) % 20 === 0) {
        const x0 = contour(z + 10, -44.75);
        const x1 = contour(z + 10, NILE_WATER_Y - 0.4);
        fpReg({
          id: `bank:${k++}`, family: 'harbor-district', x: (x0 + x1) / 2, z: z + 10, hx: Math.max(0.5, (x1 - x0) / 2), hz: 10,
          y0: NILE_WATER_Y - 0.5, y1: -44.6, ground: 'none', passive: true,
        });
      }
    }
  }
  {
    const meshes = [
      new Mesh(stoneL.build(), limestoneMaterial([0.72, 0.66, 0.55], gi, 0.55, 1.15, { paveW: 1.2 })),
      new Mesh(wornL.build(), limestoneMaterial([0.5, 0.47, 0.41], gi, 50, 50, { rough: 0.5, spec: 0.3 })),
      new Mesh(bankL.build(), earthMaterial(gi)),
    ];
    for (const m of meshes) {
      m.castShadow = m !== meshes[2];
      m.receiveShadow = true;
      m.name = 'harbor-landings';
      scene.add(m);
    }
  }
  // the Tura delivery at the south-shore slipway: block on its sledge,
  // staged blocks, the scribe recording (the barge has its own track)
  unloadingTableau(w, hf, crew, det);

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
    if (i % 3 === 0) barge(w, rng, det, x, z, yawB, floatY(x, z, 0.9, yawB, 9), crew, 'anchored');
    else if (i % 3 === 1) traveler(w, rng, det, x, z, yawB, floatY(x, z, 0.6, yawB, 7), crew, 'anchored');
    else skiff(w, rng, det, x, z, yawB, floatY(x, z, 0.2, yawB, 2.6), crew);
    vessels++;
  }

  /* --- on the river: traffic UNDER WAY (v1.2 I2) + beached skiffs --------- */
  // The four river hulls now travel their lanes (tracks laid below). The
  // v1.1 draws are kept in order — type, a heading jitter now unused, then
  // the builders' own — so nothing later in the harbour stream moves.
  // Travellers alternate south under sail before the north wind and north
  // rowing down the current; stone barges come down from Tura, heading north.
  for (let i = 0; i < 4; i++) {
    const south = i % 2 === 0;
    if (rng.chance(0.5)) {
      rng.range(-0.3, 0.3);
      const m = mover(south ? 'traveller-south' : 'traveller-north', (wm) =>
        traveler(wm, rng, det, 0, 0, 0, NILE_WATER_Y, crew, south ? 'sailing' : 'rowing'));
      m.lane = south ? 'S' : 'N';
      m.speed = south ? 2.1 : 1.8;
    } else {
      rng.range(-0.3, 0.3);
      const out = { sink: 0 };
      const m = mover('stone-barge-north', (wm) =>
        barge(wm, rng, det, 0, 0, 0, NILE_WATER_Y, crew, 'underway', { moving: true, out }));
      m.sink = out.sink;
      m.lane = 'N';
      m.speed = 1.25;
    }
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
    skiff(w, rng, det, x, z, yawS, seatY(x, z, yawS, 2.6) + 0.17);
    vessels++;
  }
  // seine fishers on the reach (v1.2) — own stream, after everything else,
  // clear of the harbour/canal latitudes and the traffic hulls
  {
    const frng = seed.rng('harbor-fishers');
    for (const z of [-880, 520, 1100]) vessels += seine(w, frng, det, crew, hf, floatY, 1760, z);
  }

  /* --- the moving fleet: tracks and the moving mesh (v1.2 I2) -------------- */
  {
    // newcomers on their own stream (the harbour's layout stays put)
    const add = (kind: string, build: (wm: W) => Hull, ln?: 'N' | 'S', speed = 1.8): Mover => {
      const m = mover(kind, build);
      if (ln) {
        m.lane = ln;
        m.speed = speed;
      }
      return m;
    };
    const tura = add('tura-barge', (wm) => barge(wm, traffic, det, 0, 0, 0, NILE_WATER_Y, crew, 'underway', { moving: true, unloads: true, out: turaOut }));
    tura.sink = turaOut.sink;
    add('cargo-north', (wm) => cargoBoat(wm, traffic, det, 0, 0, 0, NILE_WATER_Y, crew, 'rowing'), 'N', 1.7);
    add('cargo-south', (wm) => cargoBoat(wm, traffic, det, 0, 0, 0, NILE_WATER_Y, crew, 'sailing'), 'S', 2.0);
    add('traveller-south', (wm) => traveler(wm, traffic, det, 0, 0, 0, NILE_WATER_Y, crew, 'sailing'), 'S', 2.2);
    const shuttle = add('harbour-shuttle', (wm) => cargoBoat(wm, traffic, det, 0, 0, 0, NILE_WATER_Y, crew, 'rowing'));
    const fer = add('ferry', (wm) => ferry(wm, traffic, det, 0, 0, 0, NILE_WATER_Y, crew));
    // (T3-2) appended AFTER the ferry, its hull on its OWN streams: every
    // earlier mover keeps its traffic draw; the kind keeps "barge" for the
    // evidence dispatch (the Merer class)
    const tura2Out = { sink: 0 };
    const tura2 = late
      ? add('tura-barge-late', (wm) => {
          const t2 = seed.rng('harbor-tura-late');
          return barge(wm, t2, t2, 0, 0, 0, NILE_WATER_Y, seed.rng('harbor-tura-late-crew'), 'underway', { moving: true, unloads: true, out: tura2Out });
        })
      : null;
    if (tura2) tura2.sink = tura2Out.sink;

    // the river lanes on the PROBED deep channel (meander noise moves the
    // bank ±40 m off the spline): southbound west of the axis, northbound east
    const axis = riverAxis(hf, -1800, 2200);
    const axisX = (z: number): number => {
      let best = axis[0] as P2;
      for (const p of axis) if (Math.abs(p[1] - z) < Math.abs(best[1] - z)) best = p;
      return best[0];
    };
    const laneS = lane(axis, -35);
    const laneN = lane(axis, 35).reverse();
    for (const m of movers) {
      if (!m.lane) continue;
      m.track = new TrackBuilder().travel(m.lane === 'S' ? laneS : laneN, m.speed ?? 1.8, 1).finish();
    }
    // the approach canal (GizaControl APPROACH, half-width 55): an inbound
    // lane on its south side, an outbound lane on its north side
    const ax = axisX(-80);
    const canalIn: P2[] = [[ax + 25, -60], [ax + 4, -96], [ax - 30, -110], [1500, -138], [1300, -131]];
    const canalOut: P2[] = [[1300, -143], [1500, -162], [ax - 22, -134], [ax - 34, -104], [ax - 35, -60]];
    const basinBox: [number, number, number, number] = [860, -300, 1320, 60];

    // the Tura route (canon IX §9.19, Diary of Merer): down the river laden,
    // into the canal, across the basin to the south-shore slipway, unloaded
    // block by block, back off stern-first, out, and home upstream empty
    {
      const hT = tura.hull as Hull;
      const r = slipwayRamp((x, z) => hf.heightAtCpu(x, z), 2);
      const bowT = r.tShore + 1.5;
      const dock: P2 = [r.sx0 + r.ux * (bowT + hT.L / 2), r.sz0 + r.uz * (bowT + hT.L / 2)];
      const appr: P2 = [dock[0] + r.ux * 16, dock[1] + r.uz * 16];
      const clear = hT.B / 2 + 3;
      const pin = planWater(hf, [1300, -131], appr, { depth: 1.6, clear, box: basinBox });
      const pout = planWater(hf, appr, [1300, -143], { depth: 1.6, clear, box: basinBox });
      const tb = new TrackBuilder();
      tb.travel(smooth([...laneN.filter((p) => p[1] >= -20), ...canalIn], 2), 1.25, 1);
      if (pin && pout) {
        tb.travel(pin, 0.8, 1).travel([appr, dock], 0.4, 1);
        const dockAt = tb.pts.length;
        tb.stop(1500, 1, 0).stop(300, 0, 0);
        tb.travel([dock, appr], 0.4, 0, true).travel(pout, 0.8, 0);
        tb.travel(smooth([...canalOut, ...laneS.filter((p) => p[1] >= -40)], 2), 0.9, 0);
        tura.track = tb.finish();
        // at world time 0 (frozen shots) the barge is half unloaded
        tura.phase = (dockAt + 400) / (tura.track.length - 1);
        // (T3-2) the second barge on the same track, half a cycle behind:
        // on the river laden or returning while the first unloads
        if (tura2) {
          tura2.track = tura.track;
          tura2.phase = (tura.phase + 0.5) % 1;
        }
      } else {
        // no clear water across the basin this seed: it passes downstream
        // (v1.2 I6: no longer silent — Haiku I6-C)
        console.warn('[akhet] Tura barge: no water path across the basin — river lane fallback');
        tura.track = new TrackBuilder().travel(laneN, 1.25, 1).finish();
      }
    }
    // the harbour shuttle: canal → basin → bow-in at the cargo landing →
    // lies alongside → back off → out → U-turn in the river → in again
    {
      const hS = shuttle.hull as Hull;
      // (v1.2 I6) bow-in at the cargo landing's timber stage
      const dock: P2 = [cargoFaceX + hS.L / 2 + 1.0, -188];
      const appr: P2 = [cargoFaceX + hS.L / 2 + 22, -188];
      const clear = hS.B / 2 + 2.5;
      const pin = planWater(hf, [1300, -131], appr, { depth: 1.3, clear, box: basinBox });
      const pout = planWater(hf, appr, [1300, -143], { depth: 1.3, clear, box: basinBox });
      const tb = new TrackBuilder();
      const turn = arc([ax + 15, -120], 12, -Math.PI / 2, Math.PI, 12);
      if (pin && pout) {
        tb.travel(smooth(canalIn.slice(1), 2), 1.4, 1).travel(pin, 0.9, 1).travel([appr, dock], 0.35, 1);
        tb.stop(900, 1, 1);
        tb.travel([dock, appr], 0.35, 1, true).travel(pout, 0.9, 1);
        tb.travel(smooth([...canalOut.slice(0, 3), [ax + 15, -132], ...turn, ...canalIn.slice(0, 2)], 2), 1.2, 1);
        shuttle.track = tb.finish();
        shuttle.fade = 0;
        shuttle.phase = 0.08;
      } else {
        console.warn('[akhet] harbour shuttle: no water path to the cargo landing — river lane fallback');
        shuttle.track = new TrackBuilder().travel(laneN, 1.6, 1).finish();
      }
    }
    // the ferry across the reach at z ≈ 700: poled over, waits, poled back
    // (double-ended: it reverses, it never turns)
    {
      const hF = fer.hull as Hull;
      const zf = 700;
      const axF = axisX(zf);
      let xw = axF - 220;
      while (xw < axF && hf.heightAtCpu(xw, zf) > NILE_WATER_Y - 0.9) xw += 2;
      let xe = axF + 220;
      while (xe > axF && hf.heightAtCpu(xe, zf) > NILE_WATER_Y - 0.9) xe -= 2;
      const pw: P2 = [xw + hF.L / 2 + 0.5, zf];
      const pe: P2 = [xe - hF.L / 2 - 0.5, zf];
      const tb = new TrackBuilder();
      tb.travel([pw, [pw[0] + 0.1, zf]], 0.1, 1).stop(150, 1, 1);
      tb.travel([pw, pe], 1.0, 1).stop(150, 1, 1);
      tb.travel([pe, pw], 1.0, 1, true);
      fer.track = tb.finish(1);
      fer.fade = 0;
      fer.phase = 0.3;
    }

    // every mover needs a usable track
    for (const m of movers) if (m.track.length < 2) m.track = new TrackBuilder().travel(laneN, 1.6, 1).finish();
    const tracks: number[] = [];
    const hA = new Float32Array(movers.length * 4);
    const hB = new Float32Array(movers.length * 4);
    const meta: Array<{ kind: string; start: number; count: number; cycle: number; phase: number; L: number; B: number }> = [];
    for (const m of movers) {
      const start = tracks.length / 4;
      for (const p of m.track) tracks.push(p.x, p.z, p.a, p.load);
      const cycle = Math.max(DT, (m.track.length - 1) * DT);
      hA.set([start, m.track.length, cycle, m.phase], m.k * 4);
      hB.set([m.sink, m.fade, 0, 0], m.k * 4);
      meta.push({ kind: m.kind, start, count: m.track.length, cycle, phase: m.phase, L: m.hull?.L ?? 10, B: m.hull?.B ?? 3 });
    }
    const trk = new Float32Array(tracks);
    fleetState = { movers: meta, track: trk };
    movingCount = movers.length;
    vessels += movers.length - 4; // the four river hulls were counted where they were built
    const mm = new Mesh(wm.build(), movingMaterial(trk, hA, hB, gi));
    mm.name = 'vessels-moving';
    mm.frustumCulled = false; // positions live on the GPU
    mm.castShadow = true;
    mm.receiveShadow = true;
    scene.add(mm);
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
  mesh.name = 'vessels'; // ?hide=vessels for A/B
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return vessels;
}
