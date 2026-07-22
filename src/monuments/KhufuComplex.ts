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

export class GeoWriter {
  pos: number[] = [];
  col: number[] = [];

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
  ): void {
    const hx = lx / 2;
    const hz = lz / 2;
    const ix = Math.max(0.05, hx - batter * h);
    const iz = Math.max(0.05, hz - batter * h);
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
  const blockW = float(1.15);
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

  m.colorNode = vec3(...base)
    .mul(tone)
    .mul(blockTone)
    .mul(jointK.oneMinus().mul(0.22).mul(upright).oneMinus());
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
  m.roughnessNode = clamp(float(0.62).add(jointK.oneMinus().mul(0.2)), 0, 1);
  m.metalnessNode = float(0);
  m.specularIntensity = 0.4;
  giLightMap(m, gi, normalWorld as unknown as NV3, 1.5);
  void vec2;
  return m;
}

/* ------------------------------------------------------------------ */
/* the complex                                                          */
/* ------------------------------------------------------------------ */

export interface ComplexInfo {
  causewayStart: Vector3;
  causewayEnd: Vector3;
}

export function buildKhufuComplex(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null = null,
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
  {
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
  {
    const r = half + temenosD + court;
    const h = G1_TEMENOS_HEIGHT.value;
    const th = 3.0;
    local.box(0, 0, -r, 2 * r + th, h, th, 0.98, 0.06); // north
    local.box(0, 0, r, 2 * r + th, h, th, 0.97, 0.06); // south
    local.box(-r, 0, 0, th, h, 2 * r + th, 0.99, 0.06); // west
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
  {
    const h = 7;
    const th = 2.2;
    // basalt court floor
    basalt.box(mtX, 0.02, 0, mtW - th * 2, 0.16, mtL - th * 2, 1.0);
    // perimeter walls with west + east doorways on the axis
    local.box(mtX, 0, -mtL / 2 + th / 2, mtW, h, th, 1.0, 0.04);
    local.box(mtX, 0, mtL / 2 - th / 2, mtW, h, th, 0.99, 0.04);
    const doorHalf = 2.2;
    const sideRun = mtL / 2 - doorHalf - th;
    for (const xw of [mtX - mtW / 2 + th / 2, mtX + mtW / 2 - th / 2]) {
      local.box(xw, 0, -(doorHalf + sideRun / 2), th, h, sideRun, 1.0, 0.04);
      local.box(xw, 0, doorHalf + sideRun / 2, th, h, sideRun, 1.0, 0.04);
      // lintels over the doorways
      local.box(xw, h - 1.4, 0, th, 1.4, doorHalf * 2, 0.98, 0);
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
      const gMin = Math.min(
        grd(xm - ex * (L / 2), zm - ez * (L / 2)),
        grd(xm + ex * (L / 2), zm + ez * (L / 2)),
        grd(xm - ez * (w / 2 + 1.2), zm + ex * (w / 2 + 1.2)),
        grd(xm + ez * (w / 2 + 1.2), zm - ex * (w / 2 + 1.2)),
      );
      const embBase = Math.min(ym - 1, gMin - 2);
      // Near-zero batter: GeoWriter batter insets BOTH axes with height —
      // at 28 m of pedestal a 0.05 batter tapered each segment ~1.4 m
      // lengthwise and opened a dark colonnade of V-gaps between piers.
      local.box(xm, embBase, zm, L, ym - embBase + rise, w + 2.4, 0.93, 0.004, yaw);
      // floor slabs
      tura.box(xm, ym - 0.02, zm, L, 0.16 + rise, w - wallTh * 2, t.range(0.94, 1.0), 0, yaw);
      // side walls (raised by the local grade rise so segments seal)
      const off = (w / 2 - wallTh / 2);
      local.box(
        xm - Math.sin(yaw) * off, ym, zm + Math.cos(yaw) * off,
        L, wallH + rise, wallTh, 0.97 + t.range(-0.02, 0.02), 0.03, yaw,
      );
      local.box(
        xm + Math.sin(yaw) * off, ym, zm - Math.cos(yaw) * off,
        L, wallH + rise, wallTh, 0.97 + t.range(-0.02, 0.02), 0.03, yaw,
      );
      // roof slabs with the central light slit (two runs, gap 0.45 m)
      const roofHalf = (w - 0.45) / 4 + 0.45 / 2;
      for (const s of [-1, 1]) {
        local.box(
          xm - Math.sin(yaw) * s * roofHalf, ym + wallH, zm + Math.cos(yaw) * s * roofHalf,
          L, 0.5 + rise, (w - 0.45) / 2 - 0.35, 0.96, 0, yaw,
        );
      }
      if (i % 6 === 0) {
        fpReg({
          id: `causeway:${i}`, family: 'causeway', x: xm, z: zm,
          hx: (segL * 6) / 2, hz: (w + 2.4) / 2, y0: embBase, y1: ym + wallH + 0.7,
          yaw, ground: 'grounded', allow: ['temple', 'temenos', 'pavement'],
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
    tura.box(vx, vy + 0.02, vz, W + 8, 0.18, L + 8, 0.97);
    // heavy walls, west door (to causeway) + two east doors (from harbor)
    local.box(vx, vy, vz - L / 2 + th / 2, W, h, th, 0.99, 0.05);
    local.box(vx, vy, vz + L / 2 - th / 2, W, h, th, 0.98, 0.05);
    const dHalf = 2.0;
    const sRun = L / 2 - dHalf - th;
    for (const xw of [vx - W / 2 + th / 2, vx + W / 2 - th / 2]) {
      local.box(xw, vy, vz - (dHalf + sRun / 2), th, h, sRun, 0.99, 0.05);
      local.box(xw, vy, vz + (dHalf + sRun / 2), th, h, sRun, 0.99, 0.05);
      local.box(xw, vy + h - 1.5, vz, th, 1.5, dHalf * 2, 0.97, 0);
    }
    fpReg({
      id: 'valley-temple', family: 'temple', x: vx, z: vz,
      hx: (W + 10) / 2, hz: (L + 10) / 2, y0: vy - 5, y1: vy + h,
      ground: 'grounded', allow: ['causeway'], editable: true,
    });
  }

  /* --- boat pits ------------------------------------------------------------- */
  {
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
    }
  }

  /* --- queens' chapels (follow the queens' canon/edited positions) ---------- */
  for (const [qi, qz0] of ([52, 104, 156] as const).entries()) {
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
  {
    const t = rng.fork('mastabas-west');
    const pE = MASTABA_GRID_PITCH_EW.value;
    const pN = MASTABA_GRID_PITCH_NS.value;
    // WESTERN field: the great grid cemetery (whole grid movable as one)
    const [wOx, wOz] = edPos('mastabas-west', -(half + 55), -205);
    for (let col = 0; col < 17; col++) {
      for (let row = 0; row < 26; row++) {
        const x = wOx - col * pE + t.range(-1.2, 1.2);
        const z = wOz + row * pN + t.range(-0.8, 0.8);
        if (t.chance(0.16)) continue; // unbuilt / robbed plots
        const scale = t.chance(0.08) ? t.range(1.25, 1.6) : t.range(0.82, 1.1);
        const L = MASTABA_NUCLEUS_LENGTH.value * scale;
        const W = MASTABA_NUCLEUS_WIDTH.value * t.range(0.85, 1.1);
        const H = MASTABA_NUCLEUS_HEIGHT.value * t.range(0.8, 1.15);
        // seat on the LOWEST corner of the footprint, sunk 0.5 m — a fixed
        // Y floated whole rows over dips and buried them on rises
        const gy =
          Math.min(
            grd(x - W / 2, z - L / 2), grd(x + W / 2, z - L / 2),
            grd(x - W / 2, z + L / 2), grd(x + W / 2, z + L / 2),
          ) - 0.5;
        local.box(x, gy, z, W, H + 0.5, L, t.range(0.82, 1.0), 0.16);
        fpReg({
          id: `mastaba:w:${col}:${row}`, family: 'mastabas-west', x, z,
          hx: W / 2, hz: L / 2, y0: gy, y1: gy + H + 0.5, ground: 'grounded',
          editGroup: 'mastabas-west',
        });
        // ~40%: small offering chapel on the east face
        if (t.chance(0.4)) {
          const cx2 = x + W / 2 + 1.6;
          const cz2 = z + t.range(-L / 3, L / 3);
          local.box(cx2, grd(cx2, cz2) - 0.4, cz2, 3.2, 3.0, 4.2, 0.9, 0.06);
        }
      }
    }
    // EASTERN field (royal family): fewer, larger, east of the queens.
    // The causeway's right-of-way cuts through this area (collision audit
    // caught tombs straddling the corridor) — skip plots within its margin,
    // like the real cemetery respects the causeway line.
    const abx = cwEnd.x - cwStart.x;
    const abz = cwEnd.z - cwStart.z;
    const abL2 = abx * abx + abz * abz;
    const distToCauseway = (px: number, pz: number): number => {
      const tt = Math.max(0, Math.min(1, ((px - cwStart.x) * abx + (pz - cwStart.z) * abz) / abL2));
      return Math.hypot(px - (cwStart.x + abx * tt), pz - (cwStart.z + abz * tt));
    };
    const te = rng.fork('mastabas-east');
    const [eOx, eOz] = edPos('mastabas-east', 255, -110);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 9; row++) {
        const x = eOx + col * (pE + 4) + te.range(-1, 1);
        const z = eOz + row * (pN + 6) + te.range(-1, 1);
        if (te.chance(0.1)) continue;
        if (distToCauseway(x, z) < 28) continue;
        const L = MASTABA_NUCLEUS_LENGTH.value * te.range(1.0, 1.35);
        const W = MASTABA_NUCLEUS_WIDTH.value * te.range(1.0, 1.3);
        const H = MASTABA_NUCLEUS_HEIGHT.value * te.range(0.95, 1.25);
        const gy =
          Math.min(
            grd(x - W / 2, z - L / 2), grd(x + W / 2, z - L / 2),
            grd(x - W / 2, z + L / 2), grd(x + W / 2, z + L / 2),
          ) - 0.5;
        local.box(x, gy, z, W, H + 0.5, L, te.range(0.85, 1.02), 0.16);
        fpReg({
          id: `mastaba:e:${col}:${row}`, family: 'mastabas-east', x, z,
          hx: W / 2, hz: L / 2, y0: gy, y1: gy + H + 0.5, ground: 'grounded',
          editGroup: 'mastabas-east',
        });
        if (te.chance(0.6)) {
          const cx2 = x + W / 2 + 1.8;
          const cz2 = z + te.range(-L / 3, L / 3);
          local.box(cx2, grd(cx2, cz2) - 0.4, cz2, 3.6, 3.2, 4.6, 0.92, 0.06);
        }
      }
    }
  }

  /* --- materialize ------------------------------------------------------------- */
  // pavement slabs get fine 0.35 m "courses" (they are slabs, not walls —
  // upright gate zeroes the joint effect on their tops anyway)
  const turaMesh = new Mesh(tura.build(), limestoneMaterial([0.85, 0.825, 0.77], gi, 0.5));
  const localMesh = new Mesh(local.build(), limestoneMaterial([0.74, 0.68, 0.57], gi, 0.55));
  const basaltMesh = new Mesh(basalt.build(), limestoneMaterial([0.16, 0.16, 0.17], gi, 0.5));
  for (const m of [turaMesh, localMesh, basaltMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }

  return { causewayStart: cwStart, causewayEnd: cwEnd };
}
