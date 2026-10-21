/**
 * Harbour evidence (v1.2 I6) — canon IX §9.12 "Reconstructed elements must
 * receive confidence metadata"; the Phase-4 gate "Every reconstructed
 * feature has a declared confidence level and temporal applicability";
 * "Never present a reconstructed landing area as an excavated structure
 * merely because it appears realistic". The table is §9.30's
 * "Reconstruction Parameters" kept as DATA, apart from the geometry, keyed
 * by footprint-id prefix (vessels by class). The letter is the confidence of
 * the FORM AND PLACE shown — the lower of the two (Bible Levels A–E; D-18).
 * `stampEvidence()` runs after the harbour and its district are built and
 * writes conf / basis / epoch onto their footprints; `runEvidenceAudit()`
 * lists any harbour footprint left untagged (the boot counter must be 0).
 * Shown by `?debug=confidence` and the Inspector's selection line.
 */

import type { Confidence } from '../world/CANON_DIMENSIONS';
import { fpAll, fpReg } from '../debug/Footprints';
import { HARBOR_BASIN } from '../world/GizaControl';

export interface Evidence {
  conf: Confidence;
  basis: string;
  epoch: string;
}

const KHUFU = 'khufu';
const ev = (conf: Confidence, basis: string): Evidence => ({ conf, basis, epoch: KHUFU });

/** first matching prefix wins: specific before general */
const TABLE: [string, Evidence][] = [
  ['basin', ev('C', "a Khufu-era basin at Giza (Sheisha et al. 2022 cores; Merer's 'She-Khufu'); its plan reasoned")],
  ['approach', ev('C', 'a channel linking basin and river is implied by the basin; its line reasoned')],
  ['landing:cargo-stage', ev('D', 'a timber stage after the gangplanks and landing stages of tomb scenes; form reasoned')],
  ['landing:', ev('D', "landings implied by the basin and the valley temple's harbour door; form reasoned")],
  ['plank-ramp:', ev('D', 'plank ramps after the gangplanks of tomb scenes')],
  ['bank:', ev('D', "compacted-earth banks: canon IX §9.12's conservative default")],
  ['pier:', ev('E', 'kept for the brief §2 floor; no Old Kingdom pile pier is known — speculative')],
  ['staging:', ev('C', 'Tura limestone deliveries recorded in the Diary of Merer; sledge haulage attested')],
  ['scribe-shade', ev('C', 'scribes recording deliveries: the Diary of Merer')],
  ['slipway:', ev('D', 'sledge haulage attested; the stone slipway form reasoned')],
  ['stone-yard', ev('D', "Tura and Aswan stone at Giza attested; the yard's form and place reasoned")],
  ['stone-row:', ev('D', "Tura and Aswan stone at Giza attested; the yard's form and place reasoned")],
  ['granite', ev('D', "Aswan granite in Khufu's monuments attested; its store reasoned")],
  ['magazine:', ev('D', 'storage magazines attested elsewhere (Heit el-Ghurab); their place here reasoned')],
  ['granary', ev('D', 'beehive granaries attested in reliefs and models; their place here reasoned')],
  ['hull-on-stocks', ev('C', 'Khufu I and the boat-pit timbers: Old Kingdom hull construction')],
  ['timber', ev('C', 'imported cedar for hulls (Khufu I)')],
  ['saw-frame', ev('C', 'Old Kingdom woodworking scenes')],
  ['shade', ev('C', 'reed shades of the boatyard scenes')],
  ['sledge-levers', ev('C', 'levers and sledges: Old Kingdom haulage scenes')],
  ['stall:', ev('C', 'the Saqqara market reliefs (5th dynasty)')],
  ['well:', ev('D', "wells at the basin's edge reasoned from the water table")],
  ['cargo-yard:', ev('D', "storage by material (canon); the yard's form and place reasoned")],
  ['admin', ev('D', "recording attested (the Diary of Merer); the shelter's form reasoned")],
];

/** vessel classes (footprint ids `vessel:<class>:<n>`, movers by kind) */
const VESSELS: Record<string, Evidence> = {
  traveller: ev('B', 'papyriform travelling boats: Old Kingdom reliefs and models'),
  skiff: ev('B', 'papyrus-bundle skiffs: Old Kingdom marsh scenes'),
  ceremonial: ev('B', "Khufu I, the barque from the pyramid's south boat pit"),
  barge: ev('C', 'stone barges: the Diary of Merer; the hull reconstructed'),
  cargo: ev('C', 'Old Kingdom cargo boats in reliefs; the hull reconstructed'),
  ferry: ev('D', 'a river crossing implied; the raft form reasoned'),
  hull: ev('D', 'a hull of unknown class'),
};

export const EVIDENCE_FAMILIES = ['harbor-works', 'harbor-district', 'vessels'];
/** (T2) families that carry their own evidence (stamped where built, not
 *  from TABLE): the audit holds them to it too — they exist only in a later
 *  epoch, so the default world's audit is unchanged */
const SELF_TAGGED = ['sphinx', 'khafre-temenos', 'khafre-pavement', 'khafre-temple', 'khafre-causeway'];

export function evidenceFor(id: string): Evidence | null {
  if (id.startsWith('vessel:')) return VESSELS[id.split(':')[1] ?? 'hull'] ?? VESSELS['hull']!;
  for (const [pre, e] of TABLE) if (id.startsWith(pre)) return e;
  return null;
}

/** the moving fleet by kind ('tura-barge', 'cargo-north', 'harbour-shuttle'…) */
export function moverEvidence(kind: string): Evidence {
  if (kind.includes('barge')) return VESSELS['barge']!;
  if (kind.includes('traveller')) return VESSELS['traveller']!;
  if (kind.includes('ferry')) return VESSELS['ferry']!;
  if (kind.includes('cargo') || kind.includes('shuttle')) return VESSELS['cargo']!;
  return VESSELS['hull']!;
}

/** register the basin's and the channel's outlines (passive, untouchable)
 *  and stamp every harbour footprint; returns how many were tagged */
export function stampEvidence(): number {
  const b = HARBOR_BASIN;
  fpReg({ id: 'basin', family: 'harbor-works', x: b.x, z: b.z, hx: b.rx, hz: b.rz, y0: -51, y1: -46.5, ground: 'none', passive: true });
  fpReg({ id: 'approach', family: 'harbor-works', x: 1490, z: -140, hx: 410, hz: 55, y0: -52, y1: -46.5, ground: 'none', passive: true });
  let n = 0;
  for (const f of fpAll()) {
    if (!EVIDENCE_FAMILIES.includes(f.family)) continue;
    const e = evidenceFor(f.id);
    if (!e) continue;
    f.conf = e.conf;
    f.basis = e.basis;
    f.epoch = e.epoch;
    n++;
  }
  return n;
}

/** harbour footprints with no declared confidence (must be none) */
export function runEvidenceAudit(): string[] {
  return fpAll()
    .filter((f) => (EVIDENCE_FAMILIES.includes(f.family) || SELF_TAGGED.includes(f.family) || f.id === 'pyramid:G2') && !f.conf)
    .map((f) => f.id);
}
