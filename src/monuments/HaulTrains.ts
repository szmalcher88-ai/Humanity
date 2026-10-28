/**
 * HaulTrains (2026-10-27) — KHUFU_LATE's sledge teams, ANIMATED. The human:
 * the workers must actually pull the stones on their sledges, "animated and
 * realistic", and bring them to the right place on the pyramid being built.
 *
 * Two closed routes, each driven up loaded and back down empty in the other
 * lane (keep right: a loaded team never meets one head on):
 *  - the quarry's: the ENE face → the transport ramp up to the north lip →
 *    the haul road → D-7's supply ramp → the zigzag's legs, U-turning on
 *    each landing → the drop point on the working platform (local limestone);
 *  - the Tura road's: the causeway's bare foundation, the materials road,
 *    from its foot by the valley up to the plateau (the casing).

 * The canon's chain, quarry → staging yard → ramp → construction platform
 * (MPB:2735-2746); its loading, "the block moves with visible resistance"
 * and "the rope progressively tightens" (VOL_IX:931, :941 — said of the
 * harbour's limestone) — the files lean into their ropes on the way up, walk
 * upright and faster coming down; "animations must correspond to simulation
 * events" (VOL_IX:977) — a team stops at the face while its block is
 * levered onto the sledge, and at the drop while it is levered off.
 *
 * Each team (the Djehutihotep relief's, D): a sledge with its block, two
 * files of eight haulers on two ropes, a water pourer wetting the track
 * ahead of the runners, a man on the block calling the pace (clapping), an
 * overseer with a staff beside the files.
 *
 * All on the GPU, one mesh: every vertex carries its team, its offset along
 * the route from the team's sledge (its anchor) and its local offset from
 * that anchor; the vertex stage reads the route buffer at the team's
 * distance + that offset, so the files follow every turn of the road and
 * the figures' legs swing locked to the distance walked (no skating). Driven
 * by uWorldTime: the tools' ?freeze=1 holds every team still, same frame
 * every run. `?haul=0` (Epoch.hauling) leaves them out — the A/B arm.
 *
 * (2026-10-28, the human: "optimise for fps") Each team is an INSTANCE now:
 * per frame the CPU runs the same timeline, places every team and draws
 * only those inside the view frustum (grown by their shadow's reach) and
 * nearer than CULL_D; past LOD_D a lite geometry (no limbs, no ropes, the
 * same figures' heights) stands in. Three geometry variants per route keep
 * the teams from being clones. The first build drew all 28 teams' 207k
 * vertices in every pass: ≈ 0.4 ms at the harbour panorama, where none of
 * them was even within 1.1 km.
 */

import {
  BufferAttribute,
  BufferGeometry,
  type Camera,
  Frustum,
  InstancedMesh,
  Matrix4,
  type Object3D,
  Sphere,
  Vector3,
} from 'three';
import { MeshPhysicalNodeMaterial, WebGPUCoordinateSystem } from 'three/webgpu';
import {
  attribute,
  cameraPosition,
  clamp,
  cos,
  float,
  floor,
  fract,
  instanceIndex,
  instancedArray,
  max,
  min,
  mix,
  normalLocal,
  positionLocal,
  sin,
  smoothstep,
  step,
  transformNormalToView,
  varying,
  vec3,
} from 'three/tsl';
import type { Rng, WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { NF, NV2, NV3, NV4 } from '../gpu/TSLTypes';
import { uWorldTime } from '../render/WorldClock';
import { giLightMap } from './PyramidBuilder';

/** a route point: x, y, z, the corner radius to round there (0: none), and
 *  whether its height is the ground's (1) or the given deck's (0) */
export type RP = [number, number, number, number, number];

const V_UP = 0.55; // m/s, a loaded sledge on a wetted track, uphill
const V_DOWN = 0.9; // empty, downhill
const DWELL = 50; // s at the face (loading) and at the drop (unloading)
const STRIDE_UP = 0.95; // short, heavy steps
const STRIDE_DOWN = 1.3;
const LANE = 1.8; // each lane's offset from the road's centre line
/** the team: along offsets from the sledge (its anchor), + = ahead */
const FILE_LAT = 0.75;
const FILE_N = 8;
const FILE_A0 = 3.6;
const FILE_STEP = 1.15;
const FADE = [1150, 900] as const;
/** (T3-3) LATE's spacing, its measured loop (2124 m, FIX-27) over its 20
 *  teams — KHUFU_EARLY's shorter loop gets as many teams as fit at it */
export const HAUL_SPACING_M = 106;
/** a team past this is not drawn at all; past LOD_D it is the lite one */
const CULL_D = FADE[0];
const LOD_D = 350;
const VARIANTS = 3;
/** a team's bounding sphere: its middle is this far ahead of the sledge */
const TEAM_MID = 5.5;
const TEAM_R = 10;
const BLOCK_H = 1.04; // the caller stands on it
/** the loading place: east of the transport ramp's run-in, by the ENE
 *  face's west end (m along +x from the run-in) */
const LOAD_EAST = 14;
/** the haul road between the quarry lip and the supply ramp's toe: round the
 *  blocks staged at the lip (quarry-works:stack), clear of the shelters */
const ROAD: [number, number][] = [[68, 286], [24, 258]];

/** parts, written into the `hA` attribute's z and read by the vertex stage */
const P_STATIC = 0;
const P_HAULER = 1;
const P_WALKER = 2;
const P_BLOCK = 3;
const P_CALLER = 4;
/** limb ids (Inhabitants' convention) */
const BODY = 0;
const LEG_A = 1;
const LEG_B = 2;
const ARM_A = 3;
const ARM_B = 4;
/** material ids → colours in the fragment */
const M_SKIN = 0;
const M_LINEN = 1;
const M_HAIR = 2;
const M_WOOD = 3;
const M_STONE = 4;
const M_ROPE = 5;
const M_CLAY = 6;
const M_TURA = 7;

export interface HaulInfo {
  teams: number;
  loopM: number;
  upM: number;
  periodS: number;
  /** the loop every ≈ step m: x, y, z, heading */
  pts: Float32Array;
  step: number;
  /** the tightest turn of the road's centre line (m) — a lane inside a
   *  turn sits LANE m nearer its centre */
  minTurnR: number;
}

/* ------------------------------------------------------------------ */
/* the route                                                           */
/* ------------------------------------------------------------------ */

/** round each corner that asks for it with an arc (its points carry r 0) */
function roundCorners(pts: RP[]): RP[] {
  const out: RP[] = [pts[0] as RP];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i] as RP;
    const a = pts[i - 1] as RP;
    const b = pts[i + 1] as RP;
    const r = p[3];
    const l1 = Math.hypot(p[0] - a[0], p[2] - a[2]);
    const l2 = Math.hypot(b[0] - p[0], b[2] - p[2]);
    if (r <= 0 || l1 < 1e-3 || l2 < 1e-3) {
      out.push(p);
      continue;
    }
    const d1x = (p[0] - a[0]) / l1;
    const d1z = (p[2] - a[2]) / l1;
    const d2x = (b[0] - p[0]) / l2;
    const d2z = (b[2] - p[2]) / l2;
    const phi = Math.acos(Math.max(-1, Math.min(1, d1x * d2x + d1z * d2z)));
    if (phi < 0.02) {
      out.push(p);
      continue;
    }
    // a neighbour that is not rounded itself lends (almost) its whole span
    const k1 = a[3] > 0 ? 0.45 : 0.98;
    const k2 = b[3] > 0 ? 0.45 : 0.98;
    const t = Math.min(r * Math.tan(phi / 2), k1 * l1, k2 * l2);
    const re = t / Math.tan(phi / 2);
    const side = Math.sign(d1x * d2z - d1z * d2x); // + turns toward +N
    const nx = -d1z * side;
    const nz = d1x * side;
    const t1x = p[0] - d1x * t;
    const t1z = p[2] - d1z * t;
    const y1 = p[1] - (p[1] - a[1]) * (t / l1);
    const y2 = p[1] + (b[1] - p[1]) * (t / l2);
    const cx = t1x + nx * re;
    const cz = t1z + nz * re;
    const a0 = Math.atan2(t1z - cz, t1x - cx);
    const n = Math.max(3, Math.ceil((phi * re) / 0.6));
    for (let j = 0; j <= n; j++) {
      const f = j / n;
      const ang = a0 + side * phi * f;
      out.push([cx + Math.cos(ang) * re, y1 + (y2 - y1) * f, cz + Math.sin(ang) * re, 0, p[4]]);
    }
  }
  out.push(pts[pts.length - 1] as RP);
  return out;
}

/** points every ≤ `step` m; a span between two ground points follows the ground */
function densify(pts: RP[], step: number, grd: (x: number, z: number) => number): [number, number, number][] {
  const out: [number, number, number][] = [];
  const yOf = (p: RP): number => (p[4] ? grd(p[0], p[2]) + 0.03 : p[1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i] as RP;
    const b = pts[i + 1] as RP;
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const n = Math.max(1, Math.ceil(L / step));
    const ya = yOf(a);
    const yb = yOf(b);
    for (let j = 0; j < n; j++) {
      const f = j / n;
      const x = a[0] + (b[0] - a[0]) * f;
      const z = a[2] + (b[2] - a[2]) * f;
      out.push([x, a[4] && b[4] ? grd(x, z) + 0.03 : ya + (yb - ya) * f, z]);
    }
  }
  const e = pts[pts.length - 1] as RP;
  out.push([e[0], yOf(e), e[2]]);
  return out.filter((p, i) => i === 0 || Math.hypot(p[0] - (out[i - 1] as number[])[0]!, p[2] - (out[i - 1] as number[])[2]!) > 1e-3);
}

/** headings of a polyline (central differences) */
function headings(p: [number, number, number][]): number[] {
  return p.map((_, i) => {
    const a = p[Math.max(0, i - 1)] as number[];
    const b = p[Math.min(p.length - 1, i + 1)] as number[];
    return Math.atan2(b[2]! - a[2]!, b[0]! - a[0]!);
  });
}

/** the polyline moved `d` m to the right of its direction of travel */
function offsetRight(p: [number, number, number][], d: number): [number, number, number][] {
  const h = headings(p);
  return p.map((q, i) => [q[0] - Math.sin(h[i] as number) * d, q[1], q[2] + Math.cos(h[i] as number) * d]);
}

function arcLen(p: [number, number, number][]): number {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += Math.hypot((p[i] as number[])[0]! - (p[i - 1] as number[])[0]!, (p[i] as number[])[2]! - (p[i - 1] as number[])[2]!);
  return L;
}

/** a half turn round `c` from the right side of heading h to its left, ahead */
function uTurn(c: [number, number, number], h: number, r: number, ahead: number): [number, number, number][] {
  const tx = Math.cos(h);
  const tz = Math.sin(h);
  const nx = -tz;
  const nz = tx;
  const out: [number, number, number][] = [];
  for (let j = 1; j < 12; j++) {
    const th = (j / 12) * Math.PI;
    out.push([c[0] + r * (nx * Math.cos(th) + tx * Math.sin(th) * ahead), c[1], c[2] + r * (nz * Math.cos(th) + tz * Math.sin(th) * ahead)]);
  }
  return out;
}

/**
 * The closed loop, resampled every ≈ 1 m: [x, y, z, heading (unwrapped)],
 * the closing point repeated last; the up lane's length (the drop is there).
 */
function buildLoop(centre: [number, number, number][]): { pts: Float32Array; n: number; step: number; up: number; total: number } {
  const up = offsetRight(centre, LANE);
  const back = offsetRight([...centre].reverse(), LANE);
  const hc = headings(centre);
  const top = uTurn(centre[centre.length - 1] as [number, number, number], hc[hc.length - 1] as number, LANE, 1);
  const bottom = uTurn(centre[0] as [number, number, number], (hc[0] as number) + Math.PI, LANE, 1);
  const upLen = arcLen(up);
  const loop = [...up, ...top, ...back, ...bottom, up[0] as [number, number, number]];
  const total = arcLen(loop);
  const n = Math.round(total);
  const step = total / n;
  // uniform resample
  const res: [number, number, number][] = [];
  let seg = 0;
  let segStart = 0;
  for (let i = 0; i <= n; i++) {
    const s = Math.min(total, i * step);
    for (;;) {
      const a = loop[seg] as number[];
      const b = loop[seg + 1] as number[];
      const L = Math.hypot(b[0]! - a[0]!, b[2]! - a[2]!);
      if (segStart + L >= s - 1e-9 || seg >= loop.length - 2) {
        const f = L > 1e-9 ? Math.max(0, Math.min(1, (s - segStart) / L)) : 0;
        res.push([a[0]! + (b[0]! - a[0]!) * f, a[1]! + (b[1]! - a[1]!) * f, a[2]! + (b[2]! - a[2]!) * f]);
        break;
      }
      segStart += L;
      seg++;
    }
  }
  const pts = new Float32Array((n + 1) * 4);
  let prev = 0;
  for (let i = 0; i <= n; i++) {
    const a = res[i === 0 ? n - 1 : i - 1] as number[];
    const b = res[i === n ? 1 : i + 1] as number[];
    let h = Math.atan2(b[2]! - a[2]!, b[0]! - a[0]!);
    if (i > 0) {
      while (h - prev > Math.PI) h -= Math.PI * 2;
      while (h - prev < -Math.PI) h += Math.PI * 2;
    }
    prev = h;
    const p = res[i] as number[];
    pts.set([p[0]!, p[1]!, p[2]!, h], i * 4);
  }
  return { pts, n, step, up: upLen, total };
}

/* ------------------------------------------------------------------ */
/* the team's geometry, in the route frame (along, up, right)          */
/* ------------------------------------------------------------------ */

class TeamWriter {
  pos: number[] = [];
  hA: number[] = [];
  limb: number[] = [];
  mat: number[] = [];
  tone: number[] = [];
  /** the current element's anchor, team, part, phase, tone */
  ac = 0;
  team = 0;
  part = 0;
  ph = 0;
  t0 = 1;
  t1 = 1;
  /** the far stand-in: every draw the full team makes, a third of the bones */
  lite = false;

  private tri(a: number[], b: number[], c: number[], limb: number, m: number): void {
    this.pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) {
      this.hA.push(this.ac, this.team, this.part, this.ph);
      this.limb.push(limb);
      this.mat.push(m);
      this.tone.push(this.t0, this.t1);
    }
  }

  quad(a: number[], b: number[], c: number[], d: number[], limb: number, m: number): void {
    this.tri(a, b, c, limb, m);
    this.tri(a, c, d, limb, m);
  }

  /** a box: along a0..a1, up y0..y1, right l0..l1 (local to the anchor) */
  box(a0: number, a1: number, y0: number, y1: number, l0: number, l1: number, m: number, limb = BODY): void {
    const p = (a: number, y: number, l: number): number[] => [a, y, l];
    const [A, B, C, D] = [p(a0, y0, l0), p(a1, y0, l0), p(a1, y0, l1), p(a0, y0, l1)];
    const [E, F, G, H] = [p(a0, y1, l0), p(a1, y1, l0), p(a1, y1, l1), p(a0, y1, l1)];
    // wound outward for a right-handed (along, up, right) frame
    this.quad(E, H, G, F, limb, m); // top
    this.quad(A, B, C, D, limb, m); // bottom
    this.quad(A, E, F, B, limb, m); // left side (l0)
    this.quad(D, C, G, H, limb, m); // right side (l1)
    this.quad(B, F, G, C, limb, m); // front (a1)
    this.quad(A, D, H, E, limb, m); // back (a0)
  }

  /** a slanted bar along the route, ±h about the anchor, its ends at
   *  (y0, l0) and (y1, l1), half-thickness r — a rope piece */
  bar(h: number, y0: number, y1: number, l0: number, l1: number, r: number, m: number): void {
    const A = [-h, y0 - r, l0 - r];
    const B = [h, y1 - r, l1 - r];
    const C = [h, y1 - r, l1 + r];
    const D = [-h, y0 - r, l0 + r];
    const E = [-h, y0 + r, l0 - r];
    const F = [h, y1 + r, l1 - r];
    const G = [h, y1 + r, l1 + r];
    const H = [-h, y0 + r, l0 + r];
    this.quad(E, H, G, F, BODY, m);
    this.quad(A, B, C, D, BODY, m);
    this.quad(A, E, F, B, BODY, m);
    this.quad(D, C, G, H, BODY, m);
  }

  /** a tapered 4-sided bone between two points of a figure's own frame
   *  (x right of the figure's left… as Inhabitants' FigureWriter: x lateral,
   *  y up, z forward), placed at lateral `lat` from the anchor */
  bone(
    lat: number,
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    w0: number, w1: number, limb: number, m: number,
  ): void {
    // figure frame → route frame: along = z, up = y, right = lat − x (a
    // proper rotation, so the winding holds)
    const map = (x: number, y: number, z: number): number[] => [z, y, lat - x];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dy, dz) || 1e-4;
    const ex = dx / len;
    const ey = dy / len;
    const ez = dz / len;
    const upx = Math.abs(ey) > 0.9 ? 1 : 0;
    const upy = Math.abs(ey) > 0.9 ? 0 : 1;
    let ax = -ez * upy;
    let ay = ez * upx;
    let az = ex * upy - ey * upx;
    const an = Math.hypot(ax, ay, az) || 1;
    ax /= an;
    ay /= an;
    az /= an;
    const bx = ey * az - ez * ay;
    const by = ez * ax - ex * az;
    const bz = ex * ay - ey * ax;
    const ring = (t: number, w: number): number[][] => {
      const cx = x0 + dx * t;
      const cy = y0 + dy * t;
      const cz = z0 + dz * t;
      return [
        map(cx + ax * w, cy + ay * w, cz + az * w),
        map(cx + bx * w, cy + by * w, cz + bz * w),
        map(cx - ax * w, cy - ay * w, cz - az * w),
        map(cx - bx * w, cy - by * w, cz - bz * w),
      ];
    };
    const r0 = ring(0, w0);
    const r1 = ring(1, w1);
    for (let k = 0; k < 4; k++) {
      const n = (k + 1) % 4;
      this.quad(r0[k] as number[], r0[n] as number[], r1[n] as number[], r1[k] as number[], limb, m);
    }
    this.quad(r1[0] as number[], r1[1] as number[], r1[2] as number[], r1[3] as number[], limb, m);
    this.quad(r0[3] as number[], r0[2] as number[], r0[1] as number[], r0[0] as number[], limb, m);
  }

  /** a figure at lateral `lat` (its own anchor = the current `ac`):
   *  'haul' arms reach forward-down to the rope, 'jar' holds a water jar
   *  before the chest, 'staff' a staff in the right hand, 'clap' arms up */
  figure(rng: Rng, lat: number, pose: 'haul' | 'jar' | 'staff' | 'clap'): void {
    const H = rng.range(1.58, 1.74);
    const sh = H * 0.82;
    const hip = H * 0.5;
    const sw = H * 0.115;
    if (this.lite) {
      // legs as one, kilt, torso to the crown: the silhouette at 350 m +
      this.bone(lat, 0, hip, 0, 0, 0.02, 0, 0.1, 0.07, BODY, M_SKIN);
      this.bone(lat, 0, hip + 0.2, 0, 0, hip - 0.16, 0, 0.085, 0.105, BODY, M_LINEN);
      this.bone(lat, 0, hip + 0.16, 0, 0, H, 0, 0.1, sw, BODY, M_SKIN);
      return;
    }
    this.bone(lat, -0.055, hip, 0, -0.06, 0.02, 0, 0.05, 0.032, LEG_A, M_SKIN);
    this.bone(lat, 0.055, hip, 0, 0.06, 0.02, 0, 0.05, 0.032, LEG_B, M_SKIN);
    this.bone(lat, 0, hip + 0.2, 0, 0, hip - 0.16, 0, 0.085, 0.105, BODY, M_LINEN);
    this.bone(lat, 0, hip + 0.16, 0, 0, sh, 0, 0.095, sw, BODY, M_SKIN);
    const [ay, az] = pose === 'haul' ? [sh - 0.5, 0.3] : pose === 'jar' ? [sh - 0.3, 0.28] : pose === 'clap' ? [sh + 0.42, 0.12] : [sh - 0.6, 0.04];
    this.bone(lat, -sw, sh, 0, -sw + (pose === 'clap' ? 0.08 : -0.02), ay, az, 0.036, 0.028, ARM_A, M_SKIN);
    this.bone(lat, sw, sh, 0, sw + (pose === 'clap' ? -0.08 : 0.02), pose === 'staff' ? sh - 0.45 : ay, pose === 'staff' ? 0.22 : az, 0.036, 0.028, ARM_B, M_SKIN);
    this.bone(lat, 0, sh, 0, 0, sh + 0.07, 0, 0.03, 0.035, BODY, M_SKIN);
    this.bone(lat, 0, sh + 0.07, 0, 0, H, 0, 0.062, 0.05, BODY, M_HAIR);
    if (pose === 'jar') this.bone(lat, 0, sh - 0.42, 0.3, 0, sh - 0.14, 0.3, 0.1, 0.07, ARM_A, M_CLAY);
    if (pose === 'staff') this.bone(lat, sw + 0.02, 0.0, 0.24, sw + 0.02, H + 0.15, 0.24, 0.018, 0.016, BODY, M_WOOD);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('hA', new BufferAttribute(new Float32Array(this.hA), 4));
    g.setAttribute('limb', new BufferAttribute(new Float32Array(this.limb), 1));
    g.setAttribute('matid', new BufferAttribute(new Float32Array(this.mat), 1));
    g.setAttribute('tone', new BufferAttribute(new Float32Array(this.tone), 2));
    g.computeVertexNormals();
    return g;
  }
}

function writeTeam(w: TeamWriter, rng: Rng, team: number, tura: boolean): void {
  w.team = team;
  const fig = (ac: number, part: number): void => {
    w.ac = ac;
    w.part = part;
    w.ph = rng.range(-0.35, 0.35);
    w.t0 = rng.range(0.8, 1.15);
    w.t1 = rng.range(0.85, 1.1);
  };
  // the sledge: two runners turned up at the nose, cross-bearers, a deck
  fig(0, P_STATIC);
  if (w.lite) {
    w.box(-1.8, 1.9, 0, 0.36, -0.78, 0.78, M_WOOD);
  } else {
    for (const l of [-0.6, 0.6]) {
      w.box(-1.8, 1.6, 0, 0.22, l - 0.15, l + 0.15, M_WOOD);
      w.box(1.5, 1.95, 0.12, 0.42, l - 0.15, l + 0.15, M_WOOD);
    }
    for (const a of [-1.3, 0, 1.3]) w.box(a - 0.1, a + 0.1, 0.2, 0.3, -0.8, 0.8, M_WOOD);
    w.box(-1.7, 1.7, 0.28, 0.36, -0.75, 0.75, M_WOOD);
  }
  // the block (levered on at the face, off at the drop)
  w.part = P_BLOCK;
  const bl = rng.range(1.5, 1.9);
  const bh = BLOCK_H;
  const bw = rng.range(1.15, 1.35);
  w.t0 = rng.range(0.92, 1.04);
  w.box(-bl / 2, bl / 2, 0.36, 0.36 + bh, -bw / 2, bw / 2, tura ? M_TURA : M_STONE);
  // the ropes, in 1 m pieces so they follow a curve: from the nose of the
  // sledge up to the hands of the files
  w.part = P_STATIC;
  const a0 = 1.9;
  const a1 = FILE_A0 + (FILE_N - 1) * FILE_STEP + 0.4;
  for (const side of w.lite ? [] : [-1, 1]) {
    for (let a = a0; a < a1 - 1e-6; a += 1) {
      const b = Math.min(a + 1, a1);
      const f0 = (a - a0) / (a1 - a0);
      const f1 = (b - a0) / (a1 - a0);
      const y0 = 0.42 + Math.min(1, f0 * 3) * 0.48;
      const y1 = 0.42 + Math.min(1, f1 * 3) * 0.48;
      const l0 = side * (0.55 + (FILE_LAT + 0.2 - 0.55) * Math.min(1, f0 * 3));
      const l1 = side * (0.55 + (FILE_LAT + 0.2 - 0.55) * Math.min(1, f1 * 3));
      w.ac = (a + b) / 2;
      const h = (b - a) / 2;
      w.bar(h, y0, y1, l0, l1, 0.025, M_ROPE);
    }
  }
  // the haulers, two files
  for (let i = 0; i < FILE_N; i++) {
    for (const side of [-1, 1]) {
      fig(FILE_A0 + i * FILE_STEP + (side > 0 ? 0.18 : 0), P_HAULER);
      w.figure(rng, side * FILE_LAT + side * 0.2, 'haul');
    }
  }
  // the water pourer ahead of the runners, the caller on the block, the
  // overseer beside the files (right: the outside of the lane)
  fig(2.5, P_WALKER);
  w.figure(rng, 0, 'jar');
  fig(0.1, P_CALLER);
  w.figure(rng, 0, 'clap');
  fig(FILE_A0 + 3.5 * FILE_STEP, P_WALKER);
  w.figure(rng, FILE_LAT + 1.25, 'staff');
}

/* ------------------------------------------------------------------ */
/* the per-frame cull                                                  */
/* ------------------------------------------------------------------ */

interface Slot {
  mesh: InstancedMesh;
  ids: Float32Array;
  buf: { value: { needsUpdate: boolean } };
}

interface HaulSystem {
  pts: Float32Array;
  n: number;
  step: number;
  total: number;
  up: number;
  ldn: number;
  TU: number;
  TD: number;
  PERIOD: number;
  teams: number;
  slots: Slot[];
}

const systems: HaulSystem[] = [];
const _frustum = new Frustum();
const _mvp = new Matrix4();
const _sphere = new Sphere();
const _p = new Vector3();

/** before a structure rebuild: the old meshes go with the old scene graph */
export function clearHaulTrains(): void {
  systems.length = 0;
}

/** the route point `s` m along a loop (the shader's lerp) */
function routeAt(h: HaulSystem, s: number, out: Vector3): Vector3 {
  const sv = (((s % h.total) + h.total) % h.total) / h.step;
  const i0 = Math.min(h.n - 1, Math.max(0, Math.floor(sv)));
  const f = sv - i0;
  const a = i0 * 4;
  const b = a + 4;
  const p = h.pts;
  return out.set(
    (p[a] as number) + ((p[b] as number) - (p[a] as number)) * f,
    (p[a + 1] as number) + ((p[b + 1] as number) - (p[a + 1] as number)) * f,
    (p[a + 2] as number) + ((p[b + 2] as number) - (p[a + 2] as number)) * f,
  );
}

/**
 * Per frame, from the FINAL camera pose (Engine.onPreRender): place every
 * team on the shader's timeline and hand each instanced mesh the teams it
 * draws — inside the frustum (the sphere also tried where the team's shadow
 * falls, `sunDir` pointing to the sun), nearer than CULL_D, full or lite by
 * LOD_D. `time` is the uWorldTime the frame renders with.
 */
export function updateHaulTrains(camera: Camera, sunDir: Vector3, time: number, counters: Record<string, number>): void {
  if (systems.length === 0) return;
  camera.updateMatrixWorld();
  _mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_mvp, WebGPUCoordinateSystem);
  const cam = camera.position;
  const sy = Math.max(0.15, sunDir.y);
  const shX = (-sunDir.x / sy) * 2;
  const shZ = (-sunDir.z / sy) * 2;
  let near = 0;
  let far = 0;
  for (const h of systems) {
    const counts = h.slots.map(() => 0);
    for (let k = 0; k < h.teams; k++) {
      const tau = ((((time / h.PERIOD + k / h.teams) % 1) + 1) % 1) * h.PERIOD;
      const sUp = Math.min(h.up, Math.max(0, tau * V_UP));
      const sDn = Math.min(h.ldn, Math.max(0, (tau - h.TU - DWELL) * V_DOWN));
      routeAt(h, sUp + sDn + TEAM_MID, _p);
      const d = _p.distanceTo(cam);
      if (d > CULL_D + TEAM_R) continue;
      _sphere.set(_p, TEAM_R);
      if (!_frustum.intersectsSphere(_sphere)) {
        _sphere.center.set(_p.x + shX, _p.y, _p.z + shZ);
        if (!_frustum.intersectsSphere(_sphere)) continue;
      }
      const lite = d > LOD_D;
      const si = (lite ? VARIANTS : 0) + (k % VARIANTS);
      const slot = h.slots[si] as Slot;
      slot.ids[counts[si] as number] = k;
      counts[si] = (counts[si] as number) + 1;
      if (lite) far++;
      else near++;
    }
    for (const [i, slot] of h.slots.entries()) {
      const n = counts[i] as number;
      // an empty slot is hidden, not drawn with no instances (WebGPU warns)
      slot.mesh.visible = n > 0;
      if (n > 0) {
        slot.mesh.count = n;
        slot.buf.value.needsUpdate = true;
      }
    }
  }
  counters['haul.near'] = near;
  counters['haul.far'] = far;
}

/* ------------------------------------------------------------------ */
/* build                                                               */
/* ------------------------------------------------------------------ */

/** the quarry's route, the ENE face → the drop on the platform */
export function quarryRoute(
  /** the transport ramp's deck centre line, the lip → the floor */
  rampRoute: [number, number, number][],
  /** the supply ramp's toe → the drop point (G1Works) */
  g1Route: [number, number, number, number][],
): RP[] {
  const pts: RP[] = [];
  const ramp = [...rampRoute].reverse(); // the floor → the lip
  const f = ramp[0] as [number, number, number];
  const f1 = ramp[1] as [number, number, number];
  // a run-in on the floor, square to the ramp's foot; the loading place east
  // of it, by the face (the turn between them wide enough for both lanes)
  const ux = f[0] - f1[0];
  const uz = f[2] - f1[2];
  const ul = Math.hypot(ux, uz);
  const runIn: [number, number] = [f[0] + (ux / ul) * 10, f[2] + (uz / ul) * 10];
  pts.push([runIn[0] + LOAD_EAST, 0, runIn[1], 0, 1]);
  pts.push([runIn[0], 0, runIn[1], 6, 1]);
  for (const p of ramp) pts.push([p[0], p[1], p[2], 0, 0]);
  // off the lip onto the ground, then the road
  const lip = ramp[ramp.length - 1] as [number, number, number];
  const r0 = ROAD[0] as [number, number];
  const rl = Math.hypot(r0[0] - lip[0], r0[1] - lip[2]);
  pts.push([lip[0] + ((r0[0] - lip[0]) / rl) * 2.5, 0, lip[2] + ((r0[1] - lip[2]) / rl) * 2.5, 0, 1]);
  for (const [x, z] of ROAD) pts.push([x, 0, z, 6, 1]);
  const toe = g1Route[0] as [number, number, number, number];
  const toe1 = g1Route[1] as [number, number, number, number];
  const tl = Math.hypot(toe1[0] - toe[0], toe1[2] - toe[2]);
  pts.push([toe[0] - ((toe1[0] - toe[0]) / tl) * 10, 0, toe[2] - ((toe1[2] - toe[2]) / tl) * 10, 6, 1]);
  for (const [i, p] of g1Route.entries()) pts.push([p[0], p[1], p[2], p[3], i === 0 ? 1 : 0]);
  return pts;
}

/**
 * One route's teams: `teams` of them spread evenly round its loop; `tura`
 * gives them Tura casing (white) instead of the quarry's local stone.
 */
export function buildHaulTrains(
  scene: Object3D,
  seed: WorldSeed,
  grd: (x: number, z: number) => number,
  gi: ProbeGI | null,
  name: string,
  TEAMS: number,
  pts: RP[],
  tura = false,
  /** (T3-3) teams from the loop's length at this spacing (≥ 6) instead */
  spacing?: number,
): HaulInfo {

  const centre = densify(roundCorners(pts), 0.5, grd);
  const loop = buildLoop(centre);
  let minTurnR = Infinity;
  {
    const h = headings(centre);
    for (let i = 2; i < centre.length - 2; i++) {
      let dh = (h[i + 1] as number) - (h[i - 1] as number);
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const a = centre[i - 1] as number[];
      const b = centre[i + 1] as number[];
      const chord = Math.hypot(b[0]! - a[0]!, b[2]! - a[2]!);
      if (Math.abs(dh) > 1e-3) minTurnR = Math.min(minTurnR, chord / (2 * Math.sin(Math.abs(dh) / 2)));
    }
  }
  if (minTurnR < LANE + 1.2) console.warn(`[akhet] ${name}: a turn of ${minTurnR.toFixed(1)} m — the inner lane folds`);

  if (spacing !== undefined) TEAMS = Math.max(6, Math.round(loop.total / spacing));

  /* --- the timeline -------------------------------------------------------- */
  const LDN = loop.total - loop.up;
  const TU = loop.up / V_UP;
  const TD = LDN / V_DOWN;
  const PERIOD = TU + DWELL + TD + DWELL;

  /* --- geometry: VARIANTS teams, each full and lite (the same draws) -------- */
  const geos: BufferGeometry[] = [];
  for (const lite of [false, true]) {
    for (let v = 0; v < VARIANTS; v++) {
      const w = new TeamWriter();
      w.lite = lite;
      writeTeam(w, seed.rng(`${name}-team-${v}`), 0, tura);
      geos.push(w.build());
    }
  }

  /* --- the vertex stage, one material per instanced mesh (its team list) --- */
  const route = instancedArray(loop.pts, 'vec4');
  const makeMaterial = (teamOf: NF): MeshPhysicalNodeMaterial => {
  const hA = attribute('hA', 'vec4') as unknown as NV4;
  const ac = hA.x;
  const team = teamOf;
  const part = hA.z;
  const ph = hA.w;
  const isPart = (p: number): NF => step(p - 0.5, part).mul(step(part, p + 0.5)) as unknown as NF;
  const hauler = isPart(P_HAULER);
  const walker = isPart(P_WALKER);
  const block = isPart(P_BLOCK);
  const caller = isPart(P_CALLER);

  // where this team is on its loop now
  const tau = fract(uWorldTime.div(PERIOD).add(team.div(TEAMS))).mul(PERIOD);
  const sUp = clamp(tau.mul(V_UP), 0, loop.up);
  const sDn = clamp(tau.sub(TU + DWELL).mul(V_DOWN), 0, LDN);
  const s = sUp.add(sDn);
  const inUp = float(1).sub(step(TU, tau));
  const inTop = step(TU, tau).mul(float(1).sub(step(TU + DWELL, tau)));
  const inBot = step(TU + DWELL + TD, tau);
  const ft = clamp(tau.sub(TU).div(DWELL), 0, 1);
  const fb = clamp(tau.sub(TU + DWELL + TD).div(DWELL), 0, 1);
  const moveUp = clamp(min(tau, float(TU).sub(tau)).div(1.5), 0, 1);
  const moveDn = clamp(min(tau.sub(TU + DWELL), float(TU + DWELL + TD).sub(tau)).div(1.5), 0, 1);
  const walk = max(moveUp, moveDn);
  // each team its own pace within the step and its own tones (the variants
  // are shared by several teams)
  const tHash = fract(sin(team.mul(12.9898).add(4.1)).mul(43758.5453));
  const gait = sUp.div(STRIDE_UP).add(sDn.div(STRIDE_DOWN)).mul(Math.PI * 2).add(ph).add(tHash.mul(6.28));

  // the route at this vertex's anchor
  const sv = fract(s.add(ac).div(loop.total)).mul(loop.total);
  const fi = sv.div(loop.step);
  const i0 = clamp(floor(fi), 0, loop.n - 1);
  const fr = fi.sub(i0);
  const pA = route.element(i0.toInt()) as unknown as NV4;
  const pB = route.element(i0.toInt().add(1)) as unknown as NV4;
  const P = mix(pA, pB, fr);
  const hd = P.w;

  // the block: levered off at the drop, on at the face — it slides aside
  // onto the ground, then the next gang takes it (it goes)
  const slide = inTop.mul(smoothstep(0.2, 0.6, ft)).add(inBot.mul(float(1).sub(smoothstep(0.4, 0.8, fb))));
  const blockOn = inUp.add(inTop.mul(step(ft, 0.75))).add(inBot.mul(step(0.25, fb)));
  const onBlock = inUp.add(inTop.mul(step(ft, 0.2))).add(inBot.mul(step(0.8, fb)));

  // the figure's limbs: legs and arms swing on the walked distance; the
  // haulers lean into the ropes while loaded; the caller claps
  const limb = attribute('limb', 'float') as unknown as NF;
  const isL = (id: number): NF => step(id - 0.5, limb).mul(step(limb, id + 0.5)) as unknown as NF;
  const legSgn = isL(LEG_A).sub(isL(LEG_B));
  const armSgn = isL(ARM_B).sub(isL(ARM_A));
  const figK = hauler.add(walker).add(caller);
  const swingK = walk.mul(hauler.add(walker));
  const idle = sin(uWorldTime.mul(0.7).add(ph.mul(23.1)));
  const clap = sin(uWorldTime.mul(7.5).add(ph.mul(5))).mul(0.35).mul(caller).mul(onBlock);
  const legAmp = mix(float(0.5), float(0.4), hauler.mul(inUp));
  const armAmp = mix(float(0.38), float(0.1), hauler);
  const ang = sin(gait)
    .mul(swingK)
    .add(idle.mul(float(1).sub(swingK)).mul(0.1).mul(figK))
    .mul(legSgn.mul(legAmp).add(armSgn.mul(armAmp)))
    .add(clap.mul(armSgn.abs()))
    // the caller off his block (riding back, or while it is levered): his
    // raised arms come down to his sides
    .add(armSgn.abs().mul(caller).mul(float(1).sub(onBlock)).mul(2.9));
  const pivot = legSgn.abs().mul(0.82).add(armSgn.abs().mul(1.34));
  const pl = positionLocal;
  const dyv = pl.y.sub(pivot);
  const ca = cos(ang);
  const sa = sin(ang);
  // rotate (along, up) about the pivot — the figure frame's (z, y)
  const la = dyv.mul(sa).add(pl.x.mul(ca));
  const ly = dyv.mul(ca).sub(pl.x.mul(sa)).add(pivot);
  // the lean, about the ankles
  const lean = hauler.mul(inUp).mul(mix(float(0.12), float(0.3), walk));
  const cl = cos(lean);
  const sl = sin(lean);
  const la2 = la.mul(cl).add(ly.mul(sl));
  const ly2 = ly.mul(cl).sub(la.mul(sl));
  // the block's slide and the caller's footing
  const lr = pl.z.sub(slide.mul(block).mul(2.3));
  const yBase = ly2
    .sub(slide.mul(block).mul(0.34))
    .add(caller.mul(mix(float(0.36), float(0.36 + BLOCK_H), onBlock)));
  // collapse: a block not on its sledge, anything past the fade
  const camD = P.xyz.sub(cameraPosition).length();
  const keep = smoothstep(FADE[0], FADE[1], camD).mul(float(1).sub(block.mul(float(1).sub(blockOn))));
  const ch = cos(hd);
  const shd = sin(hd);
  const wx = la2.mul(ch).sub(lr.mul(shd));
  const wz = la2.mul(shd).add(lr.mul(ch));

  const mat = new MeshPhysicalNodeMaterial();
  mat.positionNode = vec3(P.x.add(wx.mul(keep)), P.y.add(yBase.mul(keep)), P.z.add(wz.mul(keep)));
  const nl = normalLocal;
  const nWorld = varying(vec3(nl.x.mul(ch).sub(nl.z.mul(shd)), nl.y, nl.x.mul(shd).add(nl.z.mul(ch)))) as unknown as NV3;
  mat.normalNode = transformNormalToView(nWorld);

  const m = attribute('matid', 'float') as unknown as NF;
  const tone = attribute('tone', 'vec2') as unknown as NV2;
  const tv = varying(mix(float(0.9), float(1.1), tHash)) as unknown as NF;
  const t0 = (varying(tone.x) as unknown as NF).mul(tv);
  const t1 = varying(tone.y) as unknown as NF;
  let c = vec3(0.36, 0.22, 0.13).mul(t0) as unknown as NV3; // skin
  c = mix(c, vec3(0.82, 0.79, 0.7).mul(t1), step(M_LINEN - 0.5, m)) as unknown as NV3;
  c = mix(c, vec3(0.11, 0.09, 0.08), step(M_HAIR - 0.5, m)) as unknown as NV3;
  c = mix(c, vec3(0.36, 0.27, 0.17), step(M_WOOD - 0.5, m)) as unknown as NV3;
  c = mix(c, vec3(0.74, 0.68, 0.57).mul(t0), step(M_STONE - 0.5, m)) as unknown as NV3;
  c = mix(c, vec3(0.6, 0.52, 0.36), step(M_ROPE - 0.5, m)) as unknown as NV3;
  c = mix(c, vec3(0.55, 0.33, 0.2), step(M_CLAY - 0.5, m)) as unknown as NV3;
  c = mix(c, vec3(0.86, 0.835, 0.78).mul(t0), step(M_TURA - 0.5, m)) as unknown as NV3;
  mat.colorNode = c;
  mat.roughnessNode = float(0.8);
  mat.metalnessNode = float(0);
  mat.specularIntensity = 0.25;
  giLightMap(mat, gi, nWorld, 1.0);
  return mat;
  };

  /* --- the instanced meshes: [full v0 … v2, lite v0 … v2] ------------------- */
  const slots: Slot[] = geos.map((geo, i) => {
    const v = i % VARIANTS;
    const cap = Math.ceil((TEAMS - v) / VARIANTS);
    const ids = new Float32Array(Math.max(1, cap));
    const buf = instancedArray(ids, 'float');
    const mesh = new InstancedMesh(geo, makeMaterial(buf.element(instanceIndex) as unknown as NF), Math.max(1, cap));
    mesh.name = `${name}-${i < VARIANTS ? 'near' : 'far'}-${v}`;
    mesh.frustumCulled = false; // culled per team in updateHaulTrains
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData['figures'] = true; // small casters: ShadowSetup's low/safe policy
    mesh.visible = false; // until the first cull
    scene.add(mesh);
    return { mesh, ids, buf };
  });
  systems.push({ pts: loop.pts, n: loop.n, step: loop.step, total: loop.total, up: loop.up, ldn: LDN, TU, TD, PERIOD, teams: TEAMS, slots });
  return { teams: TEAMS, loopM: loop.total, upM: loop.up, periodS: PERIOD, pts: loop.pts, step: loop.step, minTurnR };
}
