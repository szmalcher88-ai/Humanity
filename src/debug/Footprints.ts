/**
 * Footprint registry — every placed structure reports its logical bounding
 * box here so collisions and grounding inconsistencies are MACHINE-checked
 * instead of eyeballed from screenshots (the temple↔G1-a and temenos↔G1-d
 * intersections both shipped because placement was validated on paper only).
 *
 * Consumers:
 *   CollisionAudit  — overlap / float / buried detection (boot + harness)
 *   Inspector       — click-select + move + export patch (?edit=1)
 */

export type GroundPolicy =
  | 'grounded' // must rest on terrain (mastabas, temples, walls…)
  | 'platform' // sits on a leveled pad — checked against terrain too
  | 'afloat' // hull: waterline OR keel-on-bed rules
  | 'none'; // skip ground checks (roofs, lintels, cargo…)

export interface Footprint {
  /** stable id, e.g. 'queen:G1-a', 'mortuary-temple', 'mastaba:w:3:7' */
  id: string;
  /** family: intra-family contact is DESIGN (causeway segments overlap),
   *  cross-family contact is a defect unless allowed */
  family: string;
  x: number;
  z: number;
  /** half extents BEFORE yaw */
  hx: number;
  hz: number;
  /** world-Y span */
  y0: number;
  y1: number;
  yaw?: number;
  ground: GroundPolicy;
  /** afloat only: hull draft (m) */
  draft?: number;
  /** families/ids this footprint may legitimately touch */
  allow?: string[];
  /** passive surfaces (pavement, terraces) — others may overlap them */
  passive?: boolean;
  /** check collisions against same-family siblings too (vessels) */
  intra?: boolean;
  /** editable via the Inspector (has a canon placement to patch) */
  editable?: boolean;
  /** selecting this footprint edits the named placement instead (e.g. a
   *  single mastaba maps to its whole field's grid origin) */
  editGroup?: string;
}

const store: Footprint[] = [];

export function fpReg(fp: Footprint): void {
  store.push(fp);
}

/** drop all footprints of the given families (structure rebuild) */
export function fpClear(families?: string[]): void {
  if (!families) {
    store.length = 0;
    return;
  }
  for (let i = store.length - 1; i >= 0; i--) {
    const f = store[i];
    if (f && families.includes(f.family)) store.splice(i, 1);
  }
}

export function fpAll(): readonly Footprint[] {
  return store;
}

/** world-space AABB of a (possibly yawed) footprint */
export function fpAabb(f: Footprint): { x0: number; x1: number; z0: number; z1: number } {
  const c = Math.abs(Math.cos(f.yaw ?? 0));
  const s = Math.abs(Math.sin(f.yaw ?? 0));
  const ex = f.hx * c + f.hz * s;
  const ez = f.hx * s + f.hz * c;
  return { x0: f.x - ex, x1: f.x + ex, z0: f.z - ez, z1: f.z + ez };
}
