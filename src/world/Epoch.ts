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
// (T2-5) MENKAURE_PERIOD = the KHAFRE world (every `atLeast(…, 'KHAFRE_PERIOD')`
// holds for it) + what is gated on `atLeast(…, 'MENKAURE_PERIOD')`: G3
// (T3-1) KHUFU_LATE = the Khufu world with the pyramid under construction:
// every change gated on `building(e)`
// (T3-3) KHUFU_EARLY = the LATE world (it inherits `building`, `lateWorks`,
// `hauling`) + what is gated on `early(e)`: the lower courses, no zigzag,
// the quarry opening, the complex not yet begun (D-28)
export const IMPLEMENTED: readonly Epoch[] = ['KHUFU_EARLY', 'KHUFU_LATE', 'KHUFU_COMPLETION', 'KHAFRE_PERIOD', 'MENKAURE_PERIOD', 'EVIDENCE_VIEW'];
const FALLBACK: Partial<Record<Epoch, Epoch>> = {};

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

/** (T3-1) the Great Pyramid still being built — KHUFU_EARLY / KHUFU_LATE;
 *  false for the default, the later stages and EVIDENCE_VIEW. `?klate=0`
 *  shows the finished pyramid in those epochs (the A/B arm) */
export function building(e: Epoch): boolean {
  if (atLeast(e, 'KHUFU_COMPLETION')) return false;
  return typeof window === 'undefined' || new URLSearchParams(window.location.search).get('klate') !== '0';
}

/** (T3-2) the rest of the complex in its construction state and the
 *  logistics (the queens rising, the temples at their footings, the quarry
 *  and the Tura transport at work) — under `building`; `?lworks=0` turns
 *  only these off (back to the T3-1 world) */
export function lateWorks(e: Epoch): boolean {
  if (!building(e)) return false;
  return typeof window === 'undefined' || new URLSearchParams(window.location.search).get('lworks') !== '0';
}

/** (2026-10-27) the sledge teams hauling the quarry's blocks up to the
 *  platform, animated (HaulTrains) — under `lateWorks`; `?haul=0` turns
 *  only these off (the A/B arm) */
export function hauling(e: Epoch): boolean {
  if (!lateWorks(e)) return false;
  return typeof window === 'undefined' || new URLSearchParams(window.location.search).get('haul') !== '0';
}

/** (T3-3) KHUFU_EARLY's own state — the lower courses under construction:
 *  true in KHUFU_EARLY only, under `building` (so `?klate=0` shows the
 *  finished pyramid there as in LATE); `?kearly=0` gives the LATE world back
 *  (the A/B arm and the leak check). LATE never enters an `early` branch */
export function early(e: Epoch): boolean {
  if (!building(e) || atLeast(e, 'KHUFU_LATE')) return false;
  return typeof window === 'undefined' || new URLSearchParams(window.location.search).get('kearly') !== '0';
}
