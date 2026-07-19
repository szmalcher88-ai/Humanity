/**
 * Inspector edit overrides — the bridge between the in-browser editor and
 * the procedural builders. The world stays 100% code-defined (fixed-layout
 * pillar): moves made in the Inspector live here as deltas, builders
 * consult `edPos()` at each canonical placement, and the "export patch"
 * action emits the deltas as JSON for hand-applying to CANON_DIMENSIONS /
 * builder constants. Nothing is ever serialized into a scene file.
 */

export interface EditDelta {
  dx: number;
  dz: number;
}

const KEY = 'akhet-edit-patch';

let overrides: Record<string, EditDelta> = {};

/** load persisted deltas (browser only; harness runs land on defaults) */
export function edLoad(): void {
  try {
    const raw = localStorage.getItem(KEY);
    overrides = raw ? (JSON.parse(raw) as Record<string, EditDelta>) : {};
  } catch {
    overrides = {};
  }
}

export function edSave(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(overrides));
  } catch {
    /* storage unavailable — session-only edits */
  }
}

/** builders call this at every canonical placement they want editable */
export function edPos(id: string, x: number, z: number): [number, number] {
  const d = overrides[id];
  return d ? [x + d.dx, z + d.dz] : [x, z];
}

export function edNudge(id: string, dx: number, dz: number): void {
  const d = overrides[id] ?? { dx: 0, dz: 0 };
  overrides[id] = { dx: d.dx + dx, dz: d.dz + dz };
  edSave();
}

export function edDeltas(): Record<string, EditDelta> {
  return overrides;
}

export function edReset(id?: string): void {
  if (id) delete overrides[id];
  else overrides = {};
  edSave();
}

/** patch text for the chat/PR — world coords, ready to apply to code */
export function edExport(): string {
  const lines = Object.entries(overrides)
    .filter(([, d]) => d.dx !== 0 || d.dz !== 0)
    .map(([id, d]) => `${id}: dx=${d.dx.toFixed(1)} dz=${d.dz.toFixed(1)}`);
  return lines.length === 0
    ? '(no pending edits)'
    : `AKHET edit patch — apply to canon placements:\n${lines.join('\n')}`;
}
