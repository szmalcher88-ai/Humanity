/**
 * KhufuComplex — the sacred landscape around the pyramid (canon Vol. VI):
 *
 *   temenos wall + Tura court PAVEMENT AS INDIVIDUAL SLABS (Pillar A)
 *   mortuary temple + valley temple (exterior massing w/ real doorways)
 *   walled AND roofed causeway on its embankment, slit-lit (DEVIATIONS D-4)
 *   southern boat pits with limestone cover beams; eastern boat-shaped pits
 *   eastern + western mastaba fields — grid-planned "streets of the dead",
 *   battered walls, per-tomb size/height/tone variation, unbuilt plots
 *
 * All geometry is CPU-merged ONCE at boot into a handful of static draws
 * (per-vertex tone variation; zero per-frame CPU). Dimensions from
 * CANON_DIMENSIONS; the layout logic mirrors published plans (Reisner
 * grids, Lehner complex maps) at massing level.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  Vector3,
  type Object3D,
} from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  attribute,
  clamp,
  float,
  fract,
  hash,
  mix,
  floor as tslFloor,
  normalWorld,
  positionWorld,
  smoothstep,
  transformNormalToView,
  vec2,
  vec3,
} from 'three/tsl';
import type { NF, NV3 } from '../gpu/TSLTypes';
import type { Rng, WorldSeed } from '../core/Seed';
import type { Heightfield } from '../world/Heightfield';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { edPos } from '../debug/EditOverrides';
import { fpReg } from '../debug/Footprints';
import { giLightMap } from './PyramidBuilder';
import {
  G1_BASE_SIDE,
  G1_CAUSEWAY_WIDTH,
  G1_COURT_PAVEMENT_WIDTH,
  G1_MORTUARY_TEMPLE_EW,
  G1_MORTUARY_TEMPLE_NS,
  G1_TEMENOS_DISTANCE,
  G1_TEMENOS_HEIGHT,
  MASTABA_GRID_PITCH_EW,
  MASTABA_GRID_PITCH_NS,
  MASTABA_NUCLEUS_HEIGHT,
  MASTABA_NUCLEUS_LENGTH,
  MASTABA_NUCLEUS_WIDTH,
  VALLEY_TEMPLE_CENTER,
} from '../world/CANON_DIMENSIONS';

/* ------------------------------------------------------------------ */
/* merged-geometry writer                                               */
/* ------------------------------------------------------------------ */

/** (2026-10-27) KHUFU_LATE: the causeway foundation's deck line, this far
 *  over its grade at each segment's centre (the materials road's surface) */
export const CAUSEWAY_LATE_LIFT = 0.3;

export class GeoWriter {
  pos: number[] = [];
  col: number[] = [];

  /** one quad as given (a → b → c counter-clockwise seen from its front) */
  quad(a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number], tone: number): void {
    this.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) this.col.push(tone, tone, tone);
  }

  /** axis-aligned battered box: base (cx,cz), dims, batter = inward slope
   *  of walls (m of inset per m of height); rotated by yaw around center */
  box(
    cx: number,
    y0: number,
    cz: number,
    lx: number,
    h: number,
    lz: number,
    tone: number,
    batter = 0,
    yaw = 0,
    /** batter across z (default: the WALL RULE below) — a wall built in
     *  runs must batter its THICKNESS, never its ends, or every joint opens
     *  a V */
    batterZ?: number,
  ): void {
    const hx = lx / 2;
    const hz = lz / 2;
    let bX = batter;
    let bZ = batterZ ?? batter;
    // WALL RULE (v1.1): a run at least 3× longer than it is thick is a wall
    // — it batters its thickness only, with plumb ends. Battering the ends
    // opened a V-gap at every corner, every jamb and every lintel bearing
    // (the valley temple's pylons showed daylight between them and their
    // lintel). Blocky masses (mastabas, pedestals) keep all four faces.
    if (batterZ === undefined && batter > 0) {
      if (lx >= 3 * lz) bX = 0;
      else if (lz >= 3 * lx) bZ = 0;
    }
    const ix = Math.max(0.05, hx - bX * h);
    const iz = Math.max(0.05, hz - bZ * h);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const P = (x: number, y: number, z: number): [number, number, number] => [
      cx + x * cy - z * sy,
      y0 + y,
      cz + x * sy + z * cy,
    ];
    // 8 corners: bottom (±hx, ±hz), top (±ix, ±iz)
    const b0 = P(-hx, 0, -hz);
    const b1 = P(hx, 0, -hz);
    const b2 = P(hx, 0, hz);
    const b3 = P(-hx, 0, hz);
    const t0 = P(-ix, h, -iz);
    const t1 = P(ix, h, -iz);
    const t2 = P(ix, h, iz);
    const t3 = P(-ix, h, iz);
    const quad = (
      a: [number, number, number],
      b: [number, number, number],
      c: [number, number, number],
      d: [number, number, number],
    ): void => {
      this.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (let i = 0; i < 6; i++) this.col.push(tone, tone, tone);
    };
    quad(b1, b0, t0, t1); // north (−z)
    quad(b2, b1, t1, t2); // east
    quad(b3, b2, t2, t3); // south
    quad(b0, b3, t3, t0); // west
    quad(t0, t3, t2, t1); // top
    // (v1.1) the box had no bottom: every raised box — lintels, portico and
    // causeway roofs, the Wall of the Crow's gate beam — was open underneath,
    // and from below you looked through it at the sky
    quad(b0, b1, b2, b3); // bottom
  }

  /**
   * (v1.2) A regular polygonal drum — silos, kilns, furnaces, wells,
   * baskets, threshing floors. Round things used to be two boxes crossed at
   * 45°, whose union is an eight-pointed STAR, not a circle: every kiln,
   * silo and threshing floor read as a cog from above. `batter` narrows the
   * top radius by batter·h, like box(); negative widens it (baskets, bowls).
   */
  drum(
    cx: number, y0: number, cz: number, r: number, h: number, tone: number,
    batter = 0, sides = 12, yaw = 0,
  ): void {
    const rt = Math.max(0.03, r - batter * h);
    type P3 = [number, number, number];
    const ring = (rad: number, y: number): P3[] =>
      Array.from({ length: sides }, (_, i): P3 => {
        const a = yaw + (i / sides) * Math.PI * 2;
        return [cx + Math.cos(a) * rad, y0 + y, cz + Math.sin(a) * rad];
      });
    const B = ring(r, 0);
    const T = ring(rt, h);
    const ct: P3 = [cx, y0 + h, cz];
    const cb: P3 = [cx, y0, cz];
    const push = (...vs: P3[]): void => {
      for (const v of vs) {
        this.pos.push(...v);
        this.col.push(tone, tone, tone);
      }
    };
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const bi = B[i] as P3;
      const bj = B[j] as P3;
      const ti = T[i] as P3;
      const tj = T[j] as P3;
      push(bj, bi, ti, bj, ti, tj); // side, wound outward
      push(ct, tj, ti); // top cap, facing up
      push(cb, bi, bj); // bottom cap, facing down
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

/**
 * Massing limestone with BLOCK-COURSE meso detail (Pillar A: no smooth
 * walls): world-Y course bands (~0.55 m) with jittered per-course tone,
 * vertical joints hashed per course on the wall-tangent coordinate, and a
 * shallow normal dip into each joint line. Reads as coursed masonry from
 * 3-40 m without any per-block geometry.
 */
export function limestoneMaterial(
  base: [number, number, number],
  gi: ProbeGI | null,
  courseH = 0.55,
  blockWm = 1.15, // joint spacing along the wall: 1.15 ashlar, ~0.45 mudbrick
  /** (v1.1) surface finish + paving: `paveW` lays a running-bond slab grid
   *  on HORIZONTAL faces (floors were one flat colour — the basalt court
   *  read as a sheet of water once the sand came off it) */
  opts: { rough?: number; spec?: number; paveW?: number } = {},
): MeshPhysicalNodeMaterial {
  const m = new MeshPhysicalNodeMaterial();
  const tone = attribute('tone', 'vec3') as unknown as NV3;

  const courseIdx = tslFloor(positionWorld.y.div(courseH));
  const courseF = fract(positionWorld.y.div(courseH));
  // wall-tangent coordinate: pick the dominant horizontal axis of the
  // normal; blocks run along the other axis
  const nAbs = normalWorld.xz.abs();
  const alongCoord = nAbs.x.greaterThan(nAbs.y).select(
    positionWorld.z,
    positionWorld.x,
  );
  const blockW = float(blockWm);
  const jitter = hash(courseIdx.add(7.3)).mul(0.73);
  const blockF = fract(alongCoord.div(blockW).add(jitter));
  const blockIdx = tslFloor(alongCoord.div(blockW).add(jitter));

  // joint lines: shallow V in the shading normal near course/joint edges
  const horizJ = smoothstep(0.0, 0.06, courseF).mul(smoothstep(1.0, 0.94, courseF));
  const vertJ = smoothstep(0.0, 0.045, blockF).mul(smoothstep(1.0, 0.955, blockF));
  const jointK = horizJ.mul(vertJ); // 1 on faces, →0 in the joints
  const upright = smoothstep(0.75, 0.45, normalWorld.y.abs()); // walls only

  // per-block tone jitter
  const blockTone = hash(blockIdx.mul(13.7).add(courseIdx.mul(101.3)))
    .mul(0.1)
    .add(0.95) as unknown as NF;

  let col: NV3 = vec3(...base)
    .mul(tone)
    .mul(blockTone)
    .mul(jointK.oneMinus().mul(0.22).mul(upright).oneMinus());
  let paveJ: NF = float(1);
  if (opts.paveW !== undefined) {
    const pw = opts.paveW;
    const flat = smoothstep(0.75, 0.92, normalWorld.y.abs());
    const rowIdx = tslFloor(positionWorld.z.div(pw));
    const rowF = fract(positionWorld.z.div(pw));
    const slabU = positionWorld.x.div(pw * 1.35).add(hash(rowIdx.add(3.1)));
    const slabF = fract(slabU);
    const slabIdx = tslFloor(slabU);
    paveJ = smoothstep(0.0, 0.03, rowF)
      .mul(smoothstep(1.0, 0.97, rowF))
      .mul(smoothstep(0.0, 0.025, slabF))
      .mul(smoothstep(1.0, 0.975, slabF));
    const slabTone = hash(slabIdx.mul(17.3).add(rowIdx.mul(71.9))).mul(0.24).add(0.88);
    col = col.mul(mix(float(1), slabTone.mul(paveJ.oneMinus().mul(0.45).oneMinus()), flat));
    paveJ = mix(float(1), paveJ, flat);
  }
  m.colorNode = col;
  // normal dip toward the joints (cheap meso bevel)
  const dipY = horizJ.oneMinus().mul(courseF.sub(0.5).sign()).mul(0.35);
  const dipA = vertJ.oneMinus().mul(blockF.sub(0.5).sign()).mul(0.3);
  const dipVec = vec3(
    nAbs.x.greaterThan(nAbs.y).select(float(0), dipA),
    dipY,
    nAbs.x.greaterThan(nAbs.y).select(dipA, float(0)),
  ).mul(upright);
  const nDetail = normalWorld.add(dipVec).normalize();
  m.normalNode = transformNormalToView(nDetail);
  m.roughnessNode = clamp(
    float(opts.rough ?? 0.62).add(jointK.oneMinus().mul(0.2)).add(paveJ.oneMinus().mul(0.15)),
    0,
    1,
  );
  m.metalnessNode = float(0);
  m.specularIntensity = opts.spec ?? 0.4;
  giLightMap(m, gi, normalWorld as unknown as NV3, 1.5);
  void vec2;
  return m;
}

/* ------------------------------------------------------------------ */
/* the complex                                                          */
/* ------------------------------------------------------------------ */

/** (v1.2 I5) a built West Field tomb, as the family courts need it */
export interface WestTomb {
  col: number;
  row: number;
  x: number;
  z: number;
  /** along x (E–W) and z (N–S) */
  W: number;
  L: number;
  H: number;
  gy: number;
  large: boolean;
  /** the offering chapel on the east face, if any (its z) */
  chapelZ: number | null;
}

/** (v1.2 I5) an East Field twin mastaba: two cores cased as one */
export interface TwinTomb {
  id: string;
  x: number;
  z: number;
  W: number;
  /** total length (both cores + the 3 m between them) and the two cores */
  L: number;
  LA: number;
  LB: number;
  H: number;
  gy: number;
  /** the two chapels' z (core A north, core B south) */
  chapelZ: [number, number];
}

export interface ComplexInfo {
  causewayStart: Vector3;
  causewayEnd: Vector3;
  westTombs: WestTomb[];
  twins: TwinTomb[];
  /** (T3-2) the causeway's graded deck per segment (the materials road's
   *  sledges stand on it) */
  causewayDeck: Float32Array;
}

export function buildKhufuComplex(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null = null,
  /** (T3-1) the pyramid still being built (KHUFU_LATE): the court, its
   *  temenos and the boat pits are NOT YET — finished after the pyramid,
   *  the pits cut after the funeral (D-25). Their forks are still taken, so
   *  every stream after them draws as in the finished world */
  underConstruction = false,
  /** (T3-2) the rest of the complex at its construction state (KHUFU_LATE):
   *  the mortuary temple at its footing courses, the causeway its bare
   *  foundation (the materials road), the valley temple its platform, only
   *  G1-a's chapel (D-26). Forks still taken; only bodies shortened */
  lateWorks = false,
): ComplexInfo {
  const rng = seed.rng('khufu-complex');
  /** terrain height under a structure — everything off the leveled court
   *  MUST be grounded here (fixed-Y placement floated the mastaba fields
   *  and causeway over undulating ground / buried them on rises) */
  const grd = (x: number, z: number): number => hf.heightAtCpu(x, z);
  const half = G1_BASE_SIDE.value / 2; // 115.18
  const court = G1_COURT_PAVEMENT_WIDTH.value; // 10.1
  const temenosD = G1_TEMENOS_DISTANCE.value; // 10.1

  const tura = new GeoWriter(); // fine Tura: pavement, temples, casing-grade
  const local = new GeoWriter(); // local limestone: temenos, mastabas, causeway
  const basalt = new GeoWriter(); // mortuary temple court floor

  /* --- court pavement: INDIVIDUAL slabs around the pyramid --------------- */
  const paveOuter = half + temenosD + court; // outer edge of paving
  const slab = (
    x: number,
    z: number,
    w: number,
    d: number,
    t: Rng,
  ): void => {
    tura.box(
      x,
      0,
      z,
      w - 0.012,
      0.14 + t.range(-0.006, 0.006),
      d - 0.012,
      t.range(0.93, 1.02),
    );
  };
  if (underConstruction) rng.fork('pavement');
  else {
    const t = rng.fork('pavement');
    // four strips (N/S/E/W) of slab rows between base and temenos+court edge
    for (const [x0, x1, z0, z1] of [
      [-paveOuter, paveOuter, -paveOuter, -half], // north strip
      [-paveOuter, paveOuter, half, paveOuter], // south
      [-paveOuter, -half, -half, half], // west
      [half, paveOuter, -half, half], // east
    ] as const) {
      let z = z0;
      while (z < z1) {
        const d = Math.min(t.range(0.85, 1.3), z1 - z);
        let x = x0;
        while (x < x1) {
          const w = Math.min(t.range(1.1, 1.9), x1 - x);
          slab(x + w / 2, z + d / 2, w, d, t);
          x += w;
        }
        z += d;
      }
    }
    fpReg({
      id: 'court-pavement', family: 'pavement', x: 0, z: 0,
      hx: paveOuter, hz: paveOuter, y0: 0, y1: 0.16,
      ground: 'none', passive: true,
    });
  }

  /* --- temenos wall (gap at the mortuary temple, east) --------------------- */
  if (!underConstruction) {
    const r = half + temenosD + court;
    const h = G1_TEMENOS_HEIGHT.value;
    const th = 3.0;
    // N/S runs batter their ENDS too (explicit batterZ): at the corners
    // their ends must lean with the side walls' outer faces, or a plumb end
    // stands proud of a battered face — a wedge up every corner (v1.1)
    // (and the west run batters its ENDS too, else its plumb end stands
    // proud of the N/S faces at NW/SW; the N/S runs stop 2 cm short of the
    // west wall's outer plane so the corner faces are not coplanar)
    local.box(0.02, 0, -r, 2 * r + th - 0.04, h, th, 0.98, 0.06, 0, 0.06); // north
    local.box(0.02, 0, r, 2 * r + th - 0.04, h, th, 0.97, 0.06, 0, 0.06); // south
    local.box(-r, 0, 0, th, h, 2 * r + th, 0.99, 0.06, 0, 0.06); // west
    const wall = (id: string, x: number, z: number, hx: number, hz: number): void =>
      fpReg({
        id: `temenos:${id}`, family: 'temenos', x, z, hx, hz,
        y0: 0, y1: h, ground: 'platform', allow: ['temple', 'pavement'],
      });
    wall('north', 0, -r, r + th / 2, th / 2);
    wall('south', 0, r, r + th / 2, th / 2);
    wall('west', -r, 0, th / 2, r + th / 2);
    // east wall in two runs that stop AT the mortuary temple's flanks —
    // the temple front fills the opening (a 24 m gate gap left the temple
    // doorway lintel reading as a beam floating over open air)
    const gateHalf = G1_MORTUARY_TEMPLE_NS.value / 2 + 0.25;
    const run = r - gateHalf;
    local.box(r, 0, -(gateHalf + run / 2), th, h, run, 0.98, 0.06);
    local.box(r, 0, gateHalf + run / 2, th, h, run, 0.98, 0.06);
    wall('east-n', r, -(gateHalf + run / 2), th / 2, run / 2);
    wall('east-s', r, gateHalf + run / 2, th / 2, run / 2);
  }

  /* --- mortuary temple (east front, on the axis) --------------------------- */
  const mtW = G1_MORTUARY_TEMPLE_EW.value; // 40 E-W
  const mtL = G1_MORTUARY_TEMPLE_NS.value; // 52.5 N-S
  const mtX = half + temenosD + court + mtW / 2 - 2;
  if (lateWorks) {
    // its footing courses: the plan's outline, ≈ 1 m of local limestone
    const th = 2.2;
    local.box(mtX, 0, -mtL / 2 + th / 2, mtW, 1.0, th, 0.96, 0.02, 0, 0.02);
    local.box(mtX, 0, mtL / 2 - th / 2, mtW, 1.0, th, 0.95, 0.02, 0, 0.02);
    for (const xw of [mtX - mtW / 2 + th / 2 + 0.02, mtX + mtW / 2 - th / 2 - 0.02]) {
      local.box(xw, 0, 0, th, 1.0, mtL - th, 0.96, 0.02, 0, 0);
    }
    rng.fork('mt-pillars');
    fpReg({
      id: 'mortuary-temple', family: 'temple', x: mtX, z: 0,
      hx: mtW / 2, hz: mtL / 2, y0: 0, y1: 1.0,
      ground: 'platform', allow: ['temenos', 'pavement', 'causeway'],
      conf: 'D', basis: 'its footing courses at mid-height construction (D-26)', epoch: 'khufu-late',
    });
  } else {
    const h = 7;
    const th = 2.2;
    // basalt court floor
    basalt.box(mtX, 0.02, 0, mtW - th * 2, 0.16, mtL - th * 2, 1.0);
    // perimeter walls with west + east doorways on the axis
    // end walls batter all four faces so their ends lean with the side
    // walls' outer faces (corner wedges — see the temenos)
    local.box(mtX, 0, -mtL / 2 + th / 2, mtW, h, th, 1.0, 0.04, 0, 0.04);
    local.box(mtX, 0, mtL / 2 - th / 2, mtW, h, th, 0.99, 0.04, 0, 0.04);
    const doorHalf = 2.2;
    // side runs reach half-way into the end walls (corner slits — see the
    // valley temple)
    const sideRun = mtL / 2 - doorHalf - th / 2;
    for (const xw of [mtX - mtW / 2 + th / 2 + 0.02, mtX + mtW / 2 - th / 2 - 0.02]) {
      local.box(xw, 0, -(doorHalf + sideRun / 2), th, h, sideRun, 1.0, 0.04);
      local.box(xw, 0, doorHalf + sideRun / 2, th, h, sideRun, 1.0, 0.04);
      // lintels over the doorways
      local.box(xw, h - 1.4, 0, th - 2 * 0.04 * (h - 1.4), 1.4, doorHalf * 2, 0.98, 0.04, 0, 0);
    }
    // inner statue-court pillars (two rows, granite-toned via dark tone)
    const t = rng.fork('mt-pillars');
    for (let i = 0; i < 2; i++) {
      for (let k = -3; k <= 3; k++) {
        local.box(
          mtX - 6 + i * 12,
          0.18,
          k * 6,
          1.3,
          5.2,
          1.3,
          0.45 + t.range(-0.03, 0.03),
          0.008,
        );
      }
    }
    fpReg({
      id: 'mortuary-temple', family: 'temple', x: mtX, z: 0,
      hx: mtW / 2, hz: mtL / 2, y0: 0, y1: h,
      ground: 'platform', allow: ['temenos', 'pavement', 'causeway'],
    });
  }

  /* --- causeway: embankment + walls + roof, slit-lit ------------------------ */
  // valley temple is a canon placement — editable; the causeway END follows
  const [vtX, vtZ] = edPos('valley-temple', VALLEY_TEMPLE_CENTER.x, VALLEY_TEMPLE_CENTER.z);
  const cwStart = new Vector3(mtX + mtW / 2, 0, 0);
  let cwDeck: Float32Array = new Float32Array(0);
  const cwEnd = new Vector3(vtX - 22, -41.0, vtZ);
  {
    const dir = cwEnd.clone().sub(cwStart);
    const len = Math.hypot(dir.x, dir.z);
    const yaw = Math.atan2(dir.z, dir.x); // rotation of segments around Y
    const w = G1_CAUSEWAY_WIDTH.value; // 9.5 exterior
    const wallTh = 1.3;
    const wallH = 3.8;
    // segment count sets the descent step (len/segN · slope). 60 segments
    // stepped 0.68 m each — daylight slits opened under every roof span.
    // 180 segments (~0.23 m steps) + 60% overlap + walls raised by one
    // step keep the corridor sealed while reading as coursed construction.
    const segN = 180;
    const segL = len / segN;
    const step = Math.abs(dir.y) / segN;
    const t = rng.fork('causeway');
    // corridor GRADE: the straight temple→valley line dives under the
    // escarpment crest around x 320-380 (collision audit: roof buried up
    // to 2.6 m). Real causeways were graded over crests — lift the line
    // to terrain where the ground rises above it, then smooth.
    const ys = new Float32Array(segN);
    for (let i = 0; i < segN; i++) {
      const fm = (i + 0.5) / segN;
      const lx = cwStart.x + dir.x * fm;
      const lz = cwStart.z + dir.z * fm;
      ys[i] = Math.max(cwStart.y + dir.y * fm, grd(lx, lz) + 0.35);
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < segN - 1; i++) {
        const a = ys[i - 1] as number;
        const b = ys[i] as number;
        const c = ys[i + 1] as number;
        ys[i] = (a + 2 * b + c) / 4;
      }
    }
    cwDeck = ys;
    for (let i = 0; i < segN; i++) {
      const f0 = i / segN;
      const f1 = (i + 1) / segN;
      const xm = cwStart.x + dir.x * ((f0 + f1) / 2);
      const zm = cwStart.z + dir.z * ((f0 + f1) / 2);
      const ym = ys[i] as number;
      // seal against the graded neighbors, not just the linear step
      const rise = Math.max(
        step,
        Math.abs((ys[Math.min(i + 1, segN - 1)] as number) - ym),
        Math.abs((ys[Math.max(i - 1, 0)] as number) - ym),
      );
      const L = segL * 1.6;
      // embankment pedestal down to the ACTUAL terrain under this segment
      // (a fixed depth from the corridor line left daylight gaps where the
      // escarpment dips deeper than the allowance — floating wall runs).
      // Sample both ends and both shoulders, seat 2 m below the lowest.
      const ex = Math.cos(yaw);
      const ez = Math.sin(yaw);
      const gs = [
        grd(xm - ex * (L / 2), zm - ez * (L / 2)),
        grd(xm + ex * (L / 2), zm + ez * (L / 2)),
        grd(xm - ez * (w / 2 + 1.2), zm + ex * (w / 2 + 1.2)),
        grd(xm + ez * (w / 2 + 1.2), zm - ex * (w / 2 + 1.2)),
      ];
      const gMin = Math.min(...gs);
      const embBase = Math.min(ym - 1, gMin - 2);
      // Near-zero batter: GeoWriter batter insets BOTH axes with height —
      // at 28 m of pedestal a 0.05 batter tapered each segment ~1.4 m
      // lengthwise and opened a dark colonnade of V-gaps between piers.
      if (lateWorks) {
        // (2026-10-27) under construction the bare foundation is the materials
        // road, and a road is ONE slope from segment to segment: its flat
        // slabs stepped up to 0.8 m where it drops over the escarpment, and
        // no sledge climbs a stair (HaulTrains' Tura teams run it). The deck
        // line runs CAUSEWAY_LATE_LIFT over the grade at each segment's
        // centre; the embankment stops under it.
        const Y = (k: number): number => (ys[Math.max(0, Math.min(segN - 1, k))] as number) + CAUSEWAY_LATE_LIFT;
        const D = (f: number): number => (f < 0 ? Y(i) + (Y(i) - Y(i - 1)) * f : Y(i) + (Y(i + 1) - Y(i)) * f);
        const yA = D(-0.5);
        const yB = D(0.5);
        const embTop = Math.min(D(-0.8), D(0.8)) - 0.15;
        local.box(xm, embBase, zm, L, embTop - embBase, w + 2.4, 0.93, 0.004, yaw);
        const tone = t.range(0.94, 1.0);
        const hw2 = w / 2 - wallTh;
        const s0 = -segL / 2 - 0.02;
        const s1 = segL / 2 + 0.02;
        const at = (s: number, l: number, y: number): [number, number, number] => [xm + ex * s - ez * l, y, zm + ez * s + ex * l];
        // the deck, wound to face up; its two sides down to the embankment
        const up = (a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]): void => {
          const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
          if (ny > 0) tura.quad(a, b, c, d, tone);
          else tura.quad(a, d, c, b, tone);
        };
        up(at(s0, -hw2, yA), at(s0, hw2, yA), at(s1, hw2, yB), at(s1, -hw2, yB));
        for (const l of [-hw2, hw2]) {
          const q: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]] = [at(s0, l, embTop), at(s1, l, embTop), at(s1, l, yB), at(s0, l, yA)];
          // outward: the side at +l faces +l
          const nx = (q[1][1] - q[0][1]) * (q[2][2] - q[0][2]) - (q[1][2] - q[0][2]) * (q[2][1] - q[0][1]);
          const nz = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]);
          const out = nx * -ez + nz * ex;
          if (out * l > 0) tura.quad(q[0], q[1], q[2], q[3], tone);
          else tura.quad(q[0], q[3], q[2], q[1], tone);
        }
      } else {
        local.box(xm, embBase, zm, L, ym - embBase + rise, w + 2.4, 0.93, 0.004, yaw);
        // floor slabs
        tura.box(xm, ym - 0.02, zm, L, 0.16 + rise, w - wallTh * 2, t.range(0.94, 1.0), 0, yaw);
      }
      // side walls (raised by the local grade rise so segments seal)
      const off = (w / 2 - wallTh / 2);
      // (T3-2) under construction the foundation is the materials road: no
      // walls, no roof (their tone draws are on this child only)
      if (!lateWorks) local.box(
        xm - Math.sin(yaw) * off, ym, zm + Math.cos(yaw) * off,
        L, wallH + rise, wallTh, 0.97 + t.range(-0.02, 0.02), 0.03, yaw,
      );
      if (!lateWorks) local.box(
        xm + Math.sin(yaw) * off, ym, zm - Math.cos(yaw) * off,
        L, wallH + rise, wallTh, 0.97 + t.range(-0.02, 0.02), 0.03, yaw,
      );
      // roof slabs with the central light slit (two runs; the 0.45 in the
      // formula is not the gap — the slabs' 0.35 m trim widens it to 0.8 m)
      const roofHalf = (w - 0.45) / 4 + 0.45 / 2;
      for (const s of lateWorks ? [] : [-1, 1]) {
        local.box(
          xm - Math.sin(yaw) * s * roofHalf, ym + wallH, zm + Math.cos(yaw) * s * roofHalf,
          L, 0.5 + rise, (w - 0.45) / 2 - 0.35, 0.96, 0, yaw,
        );
      }
      if (i % 6 === 0) {
        const fhx = (segL * 6) / 2;
        const fhz = (w + 2.4) / 2;
        // the footprint's own corners (it spans six segments), sampled the
        // way the audit samples them
        const corner = (lx: number, lz: number): number =>
          grd(xm + lx * ex - lz * ez, zm + lx * ez + lz * ex);
        const gTop = Math.max(corner(-fhx, -fhz), corner(fhx, -fhz), corner(fhx, fhz), corner(-fhx, fhz));
        fpReg({
          id: `causeway:${i}`, family: 'causeway', x: xm, z: zm,
          hx: fhx, hz: fhz, y0: embBase, y1: ym + wallH + 0.7, yFloor: ym,
          yaw, ground: 'grounded', allow: ['temple', 'temenos', 'pavement'],
          // where the grade crosses the escarpment crest the corridor runs in
          // a cutting: walls stand full height inside, the hillside reaches
          // the roof only on the uphill shoulder (v1.1 `sunk` audit)
          cutting: Math.max(gTop, ...gs) > ym + 1.5,
        });
      }
    }
  }

  /* --- valley temple (massing on its floodplain-edge platform) -------------- */
  {
    const vx = vtX;
    const vz = vtZ;
    const vy = -41.5;
    const h = 8;
    const th = 2.6;
    const W = 42;
    const L = 36;
    // platform pedestal
    local.box(vx, vy - 5, vz, W + 10, 5.2, L + 10, 0.92, 0.04);
    // floor top 2 cm ABOVE the pedestal top (both at vy+0.20 z-fought)
    tura.box(vx, vy + 0.02, vz, W + 8, 0.2, L + 8, 0.97);
    // (T3-2) under construction: its platform and footing courses only
    if (lateWorks) {
      local.box(vx, vy, vz - L / 2 + th / 2, W, 1.0, th, 0.97, 0.02, 0, 0.02);
      local.box(vx, vy, vz + L / 2 - th / 2, W, 1.0, th, 0.96, 0.02, 0, 0.02);
      for (const xw of [vx - W / 2 + th / 2 + 0.02, vx + W / 2 - th / 2 - 0.02]) local.box(xw, vy, vz, th, 1.0, L - th, 0.97, 0.02, 0, 0);
    } else {
      // heavy walls, west door (to causeway) + two east doors (from harbor)
      // end walls batter all four faces (corner wedges — see the temenos)
      local.box(vx, vy, vz - L / 2 + th / 2, W, h, th, 0.99, 0.05, 0, 0.05);
      local.box(vx, vy, vz + L / 2 - th / 2, W, h, th, 0.98, 0.05, 0, 0.05);
      const dHalf = 2.0;
      // (v1.1) side runs reach HALF-WAY into the end walls: stopping at the end
      // wall's inner face left a daylight slit up every corner once that
      // battered face receded 0.4 m at the top. Inset 2 cm so no faces lie
      // coplanar with the end walls' plumb ends.
      const sRun = L / 2 - dHalf - th / 2;
      for (const xw of [vx - W / 2 + th / 2 + 0.02, vx + W / 2 - th / 2 - 0.02]) {
        local.box(xw, vy, vz - (dHalf + sRun / 2), th, h, sRun, 0.99, 0.05);
        local.box(xw, vy, vz + (dHalf + sRun / 2), th, h, sRun, 0.99, 0.05);
        // lintel battered on its faces only, and as thick as the jambs ARE at
        // that height — a plumb lintel stood proud of the leaning wall face
        local.box(xw, vy + h - 1.5, vz, th - 2 * 0.05 * (h - 1.5), 1.5, dHalf * 2, 0.97, 0.05, 0, 0);
      }
    }
    fpReg({
      id: 'valley-temple', family: 'temple', x: vx, z: vz,
      hx: (W + 10) / 2, hz: (L + 10) / 2, y0: vy - 5, y1: vy + (lateWorks ? 1.0 : h),
      ground: 'grounded', allow: ['causeway'], editable: true,
    });
  }

  /* --- boat pits ------------------------------------------------------------- */
  if (underConstruction) rng.fork('boatpits');
  else {
    const t = rng.fork('boatpits');
    // two southern rectangular pits with limestone cover beams
    for (const px of [-52, 45]) {
      const pz = half + 6.5;
      const L = 32.5;
      const W = 3.4;
      let low = Infinity;
      for (let b = 0; b < 22; b++) {
        const bx = px - L / 2 + (b + 0.5) * (L / 22);
        const by = grd(bx, pz) - 0.05; // seated flush on the ground
        low = Math.min(low, by);
        tura.box(
          bx,
          by,
          pz,
          L / 22 - 0.05,
          0.6 + t.range(-0.02, 0.02),
          W + 1.2,
          t.range(0.88, 0.98),
        );
      }
      fpReg({
        id: `boatpit:s:${px}`, family: 'boatpits', x: px, z: pz,
        hx: L / 2, hz: (W + 1.2) / 2, y0: low, y1: low + 0.7,
        ground: 'grounded', allow: ['pavement'],
      });
    }
    // two eastern boat-shaped pits (shallow sunken forms, massing)
    for (const pz of [-72, 72]) {
      const px = half + temenosD + court + 26;
      for (let s = 0; s < 9; s++) {
        const f = s / 8;
        const wl = 3.2 * Math.sin(Math.PI * Math.max(0.08, Math.min(0.92, f)));
        const sz = pz - 20 + f * 40;
        local.box(px, grd(px, sz) - 0.9, sz, 4.5, 0.9, wl + 0.5, 0.8);
      }
      // (v1.2 I5) registered: figures walked through them (Haiku I5-B)
      fpReg({
        id: `boatpit:e:${pz}`, family: 'boatpits', x: px, z: pz, hx: 2.3, hz: 20,
        y0: grd(px, pz) - 0.9, y1: grd(px, pz) + 0.05, ground: 'none',
      });
    }
  }

  /* --- queens' chapels (follow the queens' canon/edited positions) ---------- */
  for (const [qi, qz0] of ([52, 104, 156] as const).entries()) {
    if (lateWorks && qi > 0) continue; // (T3-2) only the finished queen's
    const name = ['G1-a', 'G1-b', 'G1-c'][qi] ?? `q${qi}`;
    const [qcx, qz] = edPos(`pyramid:${name}`, 190, qz0);
    const qx = qcx + 23 + 4.5;
    const qy = Math.min(-1.2, grd(qx, qz) - 0.3);
    local.box(qx, qy, qz, 9, 4.6, 12, 0.96, 0.05);
    fpReg({
      id: `chapel:${name}`, family: 'chapels', x: qx, z: qz,
      hx: 4.5, hz: 6, y0: qy, y1: qy + 4.6, ground: 'grounded',
    });
  }

  /* --- mastaba fields ---------------------------------------------------------- */
  const westTombs: WestTomb[] = [];
  const twins: TwinTomb[] = [];
  /** (v1.2 I5) every tomb chapel registered — they had no footprint */
  const chapelFp = (id: string, x: number, z: number, hx: number, hz: number, y0: number, h: number): void =>
    fpReg({
      id, family: 'tomb-chapels', x, z, hx, hz, y0, y1: y0 + h, ground: 'grounded',
      allow: ['mastabas-west', 'mastabas-east', 'tomb-courts'],
    });
  {
    const t = rng.fork('mastabas-west');
    const pE = MASTABA_GRID_PITCH_EW.value;
    const pN = MASTABA_GRID_PITCH_NS.value;
    // WESTERN field: the great grid cemetery (whole grid movable as one).
    // (v1.2 I5) TWO PASSES. At 16 m row pitch and 24 m cores the old build
    // fused every column into one N–S ridge (Haiku I5-B; the brief floor is
    // "individual mastabas"). Pass 1 is the old loop body draw for draw —
    // the stream must not move — and records each plot; pass 2 builds every
    // SECOND row only (the Khufu-era nucleus cemetery; the infill that later
    // fused the field is 5th–6th dynasty, D-16), and a large tomb keeps its
    // length: a neighbour it would come within 3 m of is not built.
    interface Plot {
      col: number; row: number; x: number; z: number; W: number; L: number; H: number;
      gy: number; tone: number; chapel: boolean; chapelDz: number; large: boolean; slope: boolean;
    }
    const plots: Plot[] = [];
    const [wOx, wOz] = edPos('mastabas-west', -(half + 55), -205);
    for (let col = 0; col < 17; col++) {
      for (let row = 0; row < 26; row++) {
        const x = wOx - col * pE + t.range(-1.2, 1.2);
        const z = wOz + row * pN + t.range(-0.8, 0.8);
        if (t.chance(0.16)) continue; // unbuilt / robbed plots
        const large = t.chance(0.08);
        const scale = large ? t.range(1.25, 1.6) : t.range(0.82, 1.1);
        const L = MASTABA_NUCLEUS_LENGTH.value * scale;
        const W = MASTABA_NUCLEUS_WIDTH.value * t.range(0.85, 1.1);
        const H = MASTABA_NUCLEUS_HEIGHT.value * t.range(0.8, 1.15);
        // seat on the LOWEST corner of the footprint, sunk 0.5 m — a fixed
        // Y floated whole rows over dips and buried them on rises
        const corners = [
          grd(x - W / 2, z - L / 2), grd(x + W / 2, z - L / 2),
          grd(x - W / 2, z + L / 2), grd(x + W / 2, z + L / 2),
        ];
        const gy = Math.min(...corners) - 0.5;
        // every draw below happens whether or not the tomb is built, so a
        // skipped plot never re-lays the rest of the grid
        const tone = t.range(0.82, 1.0);
        const chapel = t.chance(0.4);
        const chapelDz = chapel ? t.range(-L / 3, L / 3) : 0;
        // (v1.1) a plot straddling the court's leveling edge falls more
        // than ~45% of a nucleus across its corners: the uphill face sank
        // to the coping. Such ground was left unbuilt, not dug into.
        const slope = Math.max(...corners) - Math.min(...corners) > 0.45 * H;
        plots.push({ col, row, x, z, W, L, H, gy, tone, chapel, chapelDz, large, slope });
      }
    }
    const at = new Map(plots.map((q) => [`${q.col}:${q.row}`, q]));
    for (const q of plots) {
      if (q.row % 2 === 1 || q.slope) continue;
      // a large neighbour two rows off that this tomb would come within 3 m
      // of wins (two large ones: the northern one wins)
      const crowded = [-2, 2].some((dr) => {
        const o = at.get(`${q.col}:${q.row + dr}`);
        if (!o || o.slope || !o.large || (q.large && dr > 0)) return false;
        return Math.abs(o.z - q.z) - (o.L + q.L) / 2 < 3;
      });
      if (crowded) continue;
      const { col, row, x, z, W, L, H, gy } = q;
      local.box(x, gy, z, W, H + 0.5, L, q.tone, 0.16);
      fpReg({
        id: `mastaba:w:${col}:${row}`, family: 'mastabas-west', x, z,
        hx: W / 2, hz: L / 2, y0: gy, y1: gy + H + 0.5, ground: 'grounded',
        editGroup: 'mastabas-west',
      });
      // ~40%: small offering chapel on the east face
      let chapelZ: number | null = null;
      if (q.chapel) {
        const cx2 = x + W / 2 + 1.6;
        const cz2 = z + q.chapelDz;
        // lowest corner, like the tomb it leans on (centre seating
        // floated one end on the cemetery's slopes)
        const cy2 = Math.min(grd(cx2 - 1.6, cz2 - 2.1), grd(cx2 + 1.6, cz2 - 2.1),
          grd(cx2 + 1.6, cz2 + 2.1), grd(cx2 - 1.6, cz2 + 2.1));
        local.box(cx2, cy2 - 0.3, cz2, 3.2, 3.0, 4.2, 0.9, 0.06);
        chapelFp(`chapel:w:${col}:${row}`, cx2, cz2, 1.6, 2.1, cy2 - 0.3, 3.0);
        chapelZ = cz2;
      }
      westTombs.push({ col, row, x, z, W, L, H, gy, large: q.large, chapelZ });
    }
    // EASTERN field (royal family). (v1.2 I5) The 36-plot grid fused into
    // ridges like the West Field; Khufu's children were buried here in
    // TWIN mastabas — two cores built as a pair and cased as one (G7000
    // series, form B) — so: eight twins, two rows of four north and south of
    // the causeway, cased in fine Tura limestone where the West Field is
    // local stone (canon: hierarchy "through scale and material quality").
    // Seven draws per twin, no skips: the fork re-lays only itself.
    const abx = cwEnd.x - cwStart.x;
    const abz = cwEnd.z - cwStart.z;
    const abL2 = abx * abx + abz * abz;
    const distToCauseway = (px: number, pz: number): number => {
      const tt = Math.max(0, Math.min(1, ((px - cwStart.x) * abx + (pz - cwStart.z) * abz) / abL2));
      return Math.hypot(px - (cwStart.x + abx * tt), pz - (cwStart.z + abz * tt));
    };
    const te = rng.fork('mastabas-east');
    const [eOx, eOz] = edPos('mastabas-east', 255, -110);
    for (let c = 0; c < 4; c++) {
      for (const [side, dz] of [['n', 28], ['s', 166]] as const) {
        const x = eOx + c * 35 + te.range(-1, 1);
        const z = eOz + dz + te.range(-1, 1);
        const LA = MASTABA_NUCLEUS_LENGTH.value * te.range(1.0, 1.15);
        const LB = MASTABA_NUCLEUS_LENGTH.value * te.range(1.0, 1.15);
        const W = MASTABA_NUCLEUS_WIDTH.value * te.range(1.15, 1.3);
        const H = MASTABA_NUCLEUS_HEIGHT.value * te.range(1.05, 1.25);
        const tone = te.range(0.92, 1.02);
        const L = LA + LB + 3;
        const gy =
          Math.min(
            grd(x - W / 2, z - L / 2), grd(x + W / 2, z - L / 2),
            grd(x - W / 2, z + L / 2), grd(x + W / 2, z + L / 2),
          ) - 0.5;
        tura.box(x, gy, z, W, H + 0.5, L, tone, 0.16);
        const id = `twin:e:${c}:${side}`;
        const clear = Math.min(distToCauseway(x, z - L / 2), distToCauseway(x, z + L / 2), distToCauseway(x, z));
        if (clear < 12) console.warn(`[akhet] ${id} within ${clear.toFixed(1)} m of the causeway axis`);
        fpReg({
          id, family: 'mastabas-east', x, z,
          hx: W / 2, hz: L / 2, y0: gy, y1: gy + H + 0.5, ground: 'grounded',
          editGroup: 'mastabas-east',
        });
        // a chapel before each core's centre, on the east face
        const chapelZ: [number, number] = [z - L / 2 + LA / 2, z + L / 2 - LB / 2];
        for (const [k, cz2] of [['a', chapelZ[0]], ['b', chapelZ[1]]] as const) {
          const cx2 = x + W / 2 + 1.8;
          const cy2 = Math.min(grd(cx2 - 1.8, cz2 - 2.3), grd(cx2 + 1.8, cz2 - 2.3),
            grd(cx2 + 1.8, cz2 + 2.3), grd(cx2 - 1.8, cz2 + 2.3));
          local.box(cx2, cy2 - 0.3, cz2, 3.6, 3.2, 4.6, 0.92, 0.06);
          chapelFp(`chapel:e:${c}:${side}:${k}`, cx2, cz2, 1.8, 2.3, cy2 - 0.3, 3.2);
        }
        twins.push({ id, x, z, W, L, LA, LB, H, gy, chapelZ });
      }
    }
  }

  /* --- materialize ------------------------------------------------------------- */
  // pavement slabs get fine 0.35 m "courses" (they are slabs, not walls —
  // upright gate zeroes the joint effect on their tops anyway)
  const turaMesh = new Mesh(tura.build(), limestoneMaterial([0.85, 0.825, 0.77], gi, 0.5));
  const localMesh = new Mesh(local.build(), limestoneMaterial([0.74, 0.68, 0.57], gi, 0.55));
  // honed basalt paving (~1.3 m slabs): rough, low specular — at 0.62 a
  // near-black albedo was all sky reflection and the court read as water
  const basaltMesh = new Mesh(
    basalt.build(),
    limestoneMaterial([0.19, 0.185, 0.18], gi, 0.5, 1.15, { rough: 0.86, spec: 0.25, paveW: 1.3 }),
  );
  for (const m of [turaMesh, localMesh, basaltMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }

  return { causewayStart: cwStart, causewayEnd: cwEnd, westTombs, twins, causewayDeck: cwDeck };
}
