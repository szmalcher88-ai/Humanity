/**
 * Epoch presets (T2-1) — canon IX §9.3 "Temporal Context": the plateau
 * shown at named moments of the Fourth Dynasty. The DEFAULT, with no
 * `?epoch=`, is the brief's Tier-1 state — Khufu's pyramid newly completed —
 * and is bit-identical to the world before this module existed (the T2
 * contract: every epoch branch is a boot-time `if`, every epoch draw a new
 * named stream). Boot-time only: the terrain is baked once per boot, so a
 * change of epoch is a reload. Plan: docs/plans/T2_PLAN.md §3.1; D-19.
 */

export type Epoch =
  | 'KHUFU_EARLY'
  | 'KHUFU_LATE'
  | 'KHUFU_COMPLETION'
  | 'KHAFRE_PERIOD'
  | 'MENKAURE_PERIOD'
  | 'EVIDENCE_VIEW';

/** the chronological stages (EVIDENCE_VIEW is a view, not a stage) */
export const EPOCH_ORDER: readonly Epoch[] = [
  'KHUFU_EARLY',
  'KHUFU_LATE',
  'KHUFU_COMPLETION',
  'KHAFRE_PERIOD',
  'MENKAURE_PERIOD',
];

export const DEFAULT_EPOCH: Epoch = 'KHUFU_COMPLETION';

/** built so far; the rest fall back to the nearest built stage — and SAY so */
const IMPLEMENTED: readonly Epoch[] = ['KHUFU_COMPLETION', 'KHAFRE_PERIOD', 'EVIDENCE_VIEW'];
const FALLBACK: Partial<Record<Epoch, Epoch>> = {
  KHUFU_EARLY: 'KHUFU_COMPLETION',
  KHUFU_LATE: 'KHUFU_COMPLETION',
  MENKAURE_PERIOD: 'KHAFRE_PERIOD',
};

export interface EpochChoice {
  epoch: Epoch;
  /** what the URL asked for when it was not built (or not a preset at all) */
  asked: string | null;
}

export function parseEpoch(raw: string | null): EpochChoice {
  if (raw === null || raw === '') return { epoch: DEFAULT_EPOCH, asked: null };
  const e = raw.toUpperCase() as Epoch;
  if (IMPLEMENTED.includes(e)) return { epoch: e, asked: null };
  return { epoch: FALLBACK[e] ?? DEFAULT_EPOCH, asked: raw };
}

/** the chronological stage of an epoch (EVIDENCE_VIEW shows the default) */
export function stageOf(e: Epoch): Epoch {
  return e === 'EVIDENCE_VIEW' ? DEFAULT_EPOCH : e;
}

/** true when `e` is at stage `k` or later */
export function atLeast(e: Epoch, k: Epoch): boolean {
  return EPOCH_ORDER.indexOf(stageOf(e)) >= EPOCH_ORDER.indexOf(k);
}
