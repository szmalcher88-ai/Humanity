/**
 * Instance culling (Phase 7 — PERF I).
 *
 * Every scatter system (palms, tufts, shore clumps, debris, particles) is one
 * InstancedMesh spanning the whole 4×4 km world with `frustumCulled = false`:
 * three has no way to cull instances whose positions live in a storage buffer
 * and are applied by a positionNode. Result: 750k tufts ran their vertex stage
 * every frame even when 85% of them sat behind the camera or past their own
 * shader fade distance.
 *
 * Fix, in three-native terms: bucket the instances into spatial CELLS at build
 * time (the buffers are permuted so each cell is a contiguous slice), then draw
 * with WebGPU INDIRECT draws — one indirect entry per cell, `firstInstance` =
 * the cell's slice start. Per frame the CPU tests a few hundred cell AABBs and
 * rewrites `geometry.indirectOffset` (an ARRAY of byte offsets = one draw per
 * visible cell; three re-reads it at encode time, WebGPUBackend.js:1664). The
 * indirect BUFFER itself never changes — no per-frame uploads, no compute pass.
 *
 * Requires the `indirect-first-instance` feature (verified present on this
 * adapter; three requests every adapter-supported feature). WGSL's
 * `@builtin(instance_index)` starts at `firstInstance`, so the storage-buffer
 * lookups land on the right slice with no shader change.
 *
 * SHADOW CORRECTNESS: geometry is shared with the CSM passes, so the same
 * offsets drive shadow rendering. A caster outside the camera frustum can
 * still throw its shadow into view — cells of shadow-casting meshes are tested
 * with their AABB unioned with its own sun-projected copy (`casts: true`).
 */

import {
  Box3,
  Frustum,
  Matrix4,
  Vector3,
  WebGPUCoordinateSystem,
  type Camera,
  type InstancedMesh,
  type Mesh,
} from 'three';
import { IndirectStorageBufferAttribute } from 'three/webgpu';

export interface InstanceCell {
  /** first instance index of this cell's contiguous slice */
  first: number;
  count: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export interface CullOptions {
  /** counter label (`cull.<name>`) */
  name: string;
  /** XZ margin (m) for vertex-stage motion beyond the cell (sway, drift) */
  padXZ?: number;
  /** Y margin (m) above the instance origins (geometry height + rise) */
  padY?: number;
  /** drop cells past this range — matches the shader's own fade-out */
  maxDist?: number;
  /** mesh casts shadows: keep cells whose SHADOW can still reach the frustum */
  casts?: boolean;
}

interface Entry {
  mesh: Mesh;
  cells: InstanceCell[];
  opts: Required<Omit<CullOptions, 'name'>> & { name: string };
  /** mutated in place each frame; `geometry.indirectOffset` points at it */
  offsets: number[];
  byteStride: number;
  total: number;
  twins: Mesh[];
}

const registry: Entry[] = [];

function bucket(
  count: number,
  A: Float32Array,
  cellSize: number,
): { cells: InstanceCell[]; slotOf: Int32Array } {
  const slotOf = new Int32Array(count);
  const key2slot = new Map<number, number>();
  const cells: InstanceCell[] = [];
  for (let i = 0; i < count; i++) {
    const x = A[i * 4] as number;
    const y = A[i * 4 + 1] as number;
    const z = A[i * 4 + 2] as number;
    const cx = Math.floor(x / cellSize);
    const cz = Math.floor(z / cellSize);
    // world extent is ±4 km and cellSize ≥ 32 m ⇒ |c| < 2048, no key collision
    const key = (cx + 2048) * 4096 + (cz + 2048);
    let slot = key2slot.get(key);
    if (slot === undefined) {
      slot = cells.length;
      key2slot.set(key, slot);
      cells.push({
        first: 0, count: 0,
        x0: x, x1: x, y0: y, y1: y, z0: z, z1: z,
      });
    }
    const c = cells[slot] as InstanceCell;
    c.count++;
    if (x < c.x0) c.x0 = x;
    if (x > c.x1) c.x1 = x;
    if (y < c.y0) c.y0 = y;
    if (y > c.y1) c.y1 = y;
    if (z < c.z0) c.z0 = z;
    if (z > c.z1) c.z1 = z;
    slotOf[i] = slot;
  }
  return { cells, slotOf };
}

/**
 * Bucket `count` instances into cells and PERMUTE the given stride-4 buffers
 * so every cell is contiguous. `buffers[0]` supplies the world position
 * (x, y, z in .xyz). Returns the cell table (tight AABBs from the real
 * instance positions, not the grid).
 *
 * `minPerCell` auto-coarsens the grid: one drawIndirect costs ~3 µs of encoder
 * time, so a cell holding a handful of instances is a net LOSS. Sparse systems
 * (a palm variant holds ~700 trees spread over 3.5 km² of river bank) double
 * their cell size until each cell earns its draw.
 */
export function cellSortVec4(
  count: number,
  buffers: Float32Array[],
  cellSize: number,
  minPerCell = 1,
): InstanceCell[] {
  const A = buffers[0] as Float32Array;
  let size = cellSize;
  let r = bucket(count, A, size);
  while (r.cells.length > 2 && count / r.cells.length < minPerCell && size < 2048) {
    size *= 2;
    r = bucket(count, A, size);
  }
  const { cells, slotOf } = r;

  // prefix sums → each cell's slice start
  let acc = 0;
  for (const c of cells) {
    c.first = acc;
    acc += c.count;
  }
  // stable counting-sort permutation
  const cursor = new Int32Array(cells.length);
  const dest = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const s = slotOf[i] as number;
    dest[i] = (cells[s] as InstanceCell).first + (cursor[s] as number);
    cursor[s] = (cursor[s] as number) + 1;
  }
  for (const buf of buffers) {
    const src = buf.slice(0, count * 4);
    for (let i = 0; i < count; i++) {
      const d = (dest[i] as number) * 4;
      const s = i * 4;
      buf[d] = src[s] as number;
      buf[d + 1] = src[s + 1] as number;
      buf[d + 2] = src[s + 2] as number;
      buf[d + 3] = src[s + 3] as number;
    }
  }
  return cells;
}

/**
 * Switch `mesh` to indirect drawing, one entry per cell, and register it for
 * per-frame culling. Extra meshes sharing the geometry (a depth-prepass twin)
 * are driven by the same offsets automatically — pass them so their instance
 * counters stay in sync.
 */
export function attachCulling(
  mesh: Mesh,
  cells: InstanceCell[],
  opts: CullOptions,
  twins: Mesh[] = [],
): void {
  const geo = mesh.geometry;
  const indexed = geo.index !== null;
  const stride = indexed ? 5 : 4;
  const vertexCount = indexed
    ? (geo.index as { count: number }).count
    : (geo.attributes['position'] as { count: number }).count;

  const data = new Uint32Array(cells.length * stride);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i] as InstanceCell;
    const o = i * stride;
    // non-indexed: [vertexCount, instanceCount, firstVertex, firstInstance]
    // indexed:     [indexCount, instanceCount, firstIndex, baseVertex, firstInstance]
    data[o] = vertexCount;
    data[o + 1] = c.count;
    data[o + 2] = 0;
    if (indexed) {
      data[o + 3] = 0;
      data[o + 4] = c.first;
    } else {
      data[o + 3] = c.first;
    }
  }
  const attr = new IndirectStorageBufferAttribute(data, stride);
  const offsets: number[] = [];
  geo.setIndirect(attr, offsets);

  registry.push({
    mesh,
    cells,
    opts: {
      name: opts.name,
      padXZ: opts.padXZ ?? 0,
      padY: opts.padY ?? 0,
      maxDist: opts.maxDist ?? Infinity,
      casts: opts.casts ?? false,
    },
    offsets,
    byteStride: stride * 4,
    total: cells.reduce((a, c) => a + c.count, 0),
    twins,
  });
}

/**
 * Exact cull pads from a grown geometry: the widest horizontal reach and the
 * tallest point, scaled by the system's largest per-instance scale. Beats
 * guessed constants — a clipped crown is a visible pop.
 */
export function geoBounds(
  geo: { computeBoundingBox(): void; boundingBox: Box3 | null },
  scaleMax = 1,
): { rad: number; top: number } {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (!bb) return { rad: 0, top: 0 };
  const rad = Math.max(
    Math.abs(bb.min.x), Math.abs(bb.max.x),
    Math.abs(bb.min.z), Math.abs(bb.max.z),
  );
  return { rad: rad * scaleMax, top: Math.max(0, bb.max.y) * scaleMax };
}

const _frustum = new Frustum();
const _mvp = new Matrix4();
const _box = new Box3();
const _tally = new Map<string, { vis: number; total: number }>();

/** true when at least one system is registered (culling is opt-in per build) */
export function cullingActive(): boolean {
  return registry.length > 0;
}

export function clearCulling(): void {
  registry.length = 0;
}

/**
 * Per frame: rebuild every registered system's visible-cell offset list.
 * `sunDir` points FROM the surface TO the sun (three's directional convention).
 */
export function updateInstanceCulling(
  camera: Camera,
  sunDir: Vector3,
  counters: Record<string, number>,
): void {
  camera.updateMatrixWorld();
  _mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_mvp, WebGPUCoordinateSystem);
  const cam = camera.position;
  // shadow displacement per metre of caster height
  const sy = Math.max(0.1, sunDir.y);
  const shX = (-sunDir.x / sy) as number;
  const shZ = (-sunDir.z / sy) as number;

  let drawsTotal = 0;
  // several meshes can share a name (palms are 8 variant meshes) — accumulate
  for (const e of registry) {
    _tally.set(e.opts.name, { vis: 0, total: 0 });
  }
  for (const e of registry) {
    const { padXZ, padY, maxDist, casts } = e.opts;
    const offsets = e.offsets;
    let k = 0;
    let vis = 0;
    for (let i = 0; i < e.cells.length; i++) {
      const c = e.cells[i] as InstanceCell;
      let x0 = c.x0 - padXZ;
      let x1 = c.x1 + padXZ;
      let z0 = c.z0 - padXZ;
      let z1 = c.z1 + padXZ;
      const y0 = c.y0 - 1;
      const y1 = c.y1 + padY;
      if (casts) {
        // union with the cell's own sun-projected shadow footprint
        const h = y1 - y0;
        const dx = shX * h;
        const dz = shZ * h;
        if (dx < 0) x0 += dx; else x1 += dx;
        if (dz < 0) z0 += dz; else z1 += dz;
      }
      _box.min.set(x0, y0, z0);
      _box.max.set(x1, y1, z1);
      if (maxDist < Infinity && _box.distanceToPoint(cam) > maxDist) continue;
      if (!_frustum.intersectsBox(_box)) continue;
      offsets[k++] = i * e.byteStride;
      vis += c.count;
    }
    offsets.length = k;
    drawsTotal += k;
    // three reports info.render.triangles from object.count × vertexCount —
    // with indirect draws that number is fiction unless we tell it the truth
    // (mesh.count is otherwise unused on this path; 0 skips the draw entirely)
    (e.mesh as InstancedMesh).count = vis;
    for (const t of e.twins) (t as InstancedMesh).count = vis;
    const t = _tally.get(e.opts.name) as { vis: number; total: number };
    t.vis += vis;
    t.total += e.total;
  }
  for (const [name, t] of _tally) {
    counters[`cull.${name}`] = t.vis;
    counters[`cull.${name}.pct`] = Math.round((t.vis / Math.max(1, t.total)) * 100);
  }
  counters['cull.draws'] = drawsTotal;
}
