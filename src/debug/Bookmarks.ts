/**
 * Bookmarks + flythrough (Phase 7):
 *   1-9,0,-,= — jump to a curated view (poses verified by harness shots); key 0
 *          is bookmark 10 (night harbour), `-` is 11 (temple scaffolding), `=`
 *          is 12 (the Sphinx — KHAFRE_PERIOD: the key reloads into that epoch).
 *          Both also set the hour: a night view is a POSE PLUS AN HOUR.
 *   F    — cinematic flythrough: closed Catmull-Rom loop through the
 *          bookmark positions with eased yaw/pitch, fly input disabled
 *   ?bm=N — boot straight into bookmark N (tooling/screenshots)
 */

import type { Engine } from '../core/Engine';
import type { CamPose } from '../core/Hooks';
import { atLeast, parseEpoch, type Epoch } from '../world/Epoch';

interface Mark {
  name: string;
  p: [number, number, number];
  yaw: number;
  pitch: number;
  /** optional time-of-day: a night view is a POSE PLUS AN HOUR */
  t?: number;
  /** (T2) the epoch the view belongs to: its KEY reloads into it (?bm=N alone
   *  only sets the pose — tooling and the battery stay in their epoch) */
  epoch?: string;
}

/** curated views (all verified as harness framings during Phases 3-6) */
export const MARKS: Mark[] = [
  // (v1.1) re-framed: the old pose looked down at bare silt with neither the
  // harbor nor the pyramids in frame. Now raised over the north fields:
  // magazines, basin, valley temple and causeway, the pyramids beyond.
  { name: 'harbor panorama', p: [1240, -20, -430], yaw: 1.85, pitch: -0.07 },
  { name: 'dawn from the harbor', p: [1160, -41, -80], yaw: 1.64, pitch: 0.1 },
  { name: 'noon court', p: [265, 7, 265], yaw: 0.785, pitch: 0.2 },
  { name: 'causeway descent', p: [620, 0, -190], yaw: 2.25, pitch: -0.06 },
  // 5 + 6 were framed before the town ground settled ~4 m higher and had sunk
  // 3.2 / 3.8 m UNDER the terrain (v1.1: the debris "floating over the town"
  // was the ground seen from below). Re-seated at eye height over the probe.
  { name: 'town gate', p: [491, -25, 668], yaw: -2.94, pitch: -0.12 },
  { name: 'gallery street', p: [462, -30.4, 722], yaw: 3.1, pitch: 0 },
  { name: 'quarry', p: [0, 15, 560], yaw: -0.738, pitch: -0.2 },
  { name: 'queens & temple', p: [140, 30, -20], yaw: -2.678, pitch: -0.26 },
  { name: 'river shore', p: [1800, -42, 250], yaw: -2.6, pitch: -0.12 },
  // 10 (key 0) — night harbour: moonlit basin, the town's fires on the far
  // bank, the casing catching moonlight above the causeway
  { name: 'night harbour', p: [1315, -36, -252], yaw: 2.31, pitch: -0.03, t: 21.4 },
  // 11 (key -) — the construction tableau: timber falsework, block on its sledge and
  // rubble ramp on the mortuary temple's unfinished SE corner. Late afternoon,
  // when the scaffolding throws its own shadow across the court.
  { name: 'temple scaffolding', p: [146, 7, 68], yaw: -0.19, pitch: 0.02, t: 16.2 },
  // 12 (key =) — (T2-2) the Sphinx in its enclosure, from the east, in the
  // morning sun on its face (canon VII's view list). KHAFRE_PERIOD only.
  // (T2-7) the floor at its real level (−40): the eye the same 18.8 m over it
  { name: 'the Sphinx', p: [430, -21.2, 431], yaw: 1.5708, pitch: -0.06, t: 9.0, epoch: 'KHAFRE_PERIOD' },
  // 13 (`?bm=13` only, no key) — (T2-4) "approaching from the Valley Temple"
  // (VII:398): on its roof on the causeway's line, the Sphinx 85 m right of
  // the axis, Khafre's pyramid 734 m left, "behind the Sphinx" (VII:402);
  // eye at Y 7, over the parapet: the causeway climbs west, so from lower
  // down the eye looked up into its open end instead of along its roof
  // to the pyramid (the plan's Y 4 assumed a deck 1.5 m lower). KHAFRE_PERIOD.
  // (T2-7) the same 6.8 m over the valley temple's roof on the real floor
  { name: 'from the valley temple', p: [392, -20.2, 484], yaw: 1.145, pitch: 0.0, t: 8.0, epoch: 'KHAFRE_PERIOD' },
  // 14 (`?bm=14` only) — (T2-6) Menkaure's works at his death, from above
  // the Main Wadi: G3 and its unfinished temple with the casing begun, the
  // temple yard, the causeway's staked track coming down the bank, the
  // queens, G2 beyond. The plan's eye on the bank (−360, 800) looked into
  // the slope; this one stands over the wadi at Y 25. MENKAURE_PERIOD.
  { name: "Menkaure's works", p: [-250, 25, 860], yaw: 0.98, pitch: -0.05, t: 9.0, epoch: 'MENKAURE_PERIOD' },
  // 15 (`?bm=15&epoch=KHUFU_LATE`) — (T3-1) the rising pyramid, from the
  // quarry's north side looking north up D-7's supply ramp and the zigzag on
  // the south face to the working platform at mid-height. KHUFU_LATE (an
  // EARLIER stage: the '=' rule never reloads a later world back into it).
  { name: 'the rising pyramid', p: [40, 8, 330], yaw: 0.12, pitch: 0.12, t: 10.0, epoch: 'KHUFU_LATE' },
];

/** tour order: harbor → river → town → quarry → plateau → causeway → back */
const TOUR = [0, 1, 8, 5, 4, 6, 2, 7, 3];
const LEG_SECONDS = 11;

/** a bookmark never puts the eye below this height over ground or water */
export const MARK_CLEARANCE = 1.5;
/** the flythrough flies higher: its straight legs cross knolls and walls */
const TOUR_CLEARANCE = 4;

/** lift a pose so the eye clears the terrain (and the water) under it */
function clearGround(p: [number, number, number], min: number): [number, number, number] {
  const g = window.__akhet.groundProbe?.(p[0], p[2]);
  if (!g) return p;
  return [p[0], Math.max(p[1], Math.max(g.ground, g.water) + min), p[2]];
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function attachBookmarks(engine: Engine): void {
  let flying = false;
  let flyT = 0;

  const setPose = (pose: CamPose): void => {
    window.__akhet.setPose?.(pose);
  };

  const jump = (m: Mark): void => {
    if (m.t !== undefined) window.__akhet.setTimeOfDay?.(m.t);
    setPose({ p: clearGround([...m.p], MARK_CLEARANCE), yaw: m.yaw, pitch: m.pitch });
  };

  window.addEventListener('keydown', (e) => {
    if (e.code.startsWith('Digit')) {
      const d = Number(e.code.slice(5));
      const n = d === 0 ? 10 : d; // key 0 = bookmark 10 (night harbour)
      const m = MARKS[n - 1];
      if (m) {
        if (flying) {
          flying = false;
          window.__akhet.flyCamEnabled?.(true);
        }
        jump(m);
      }
    } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      const m = MARKS[10]; // bookmark 11 — temple scaffolding
      if (m) jump(m);
    } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      const m = MARKS[11]; // bookmark 12 — the Sphinx (KHAFRE_PERIOD)
      const q = new URLSearchParams(window.location.search);
      // (T2-5) a LATER epoch shows it too (the Sphinx stands in MENKAURE_PERIOD):
      // reload only when the current world is earlier than the mark's
      if (m?.epoch && !atLeast(parseEpoch(q.get('epoch')).epoch, m.epoch as Epoch)) {
        // a view of another epoch: reload into it, never half-switch
        q.set('epoch', m.epoch);
        q.set('bm', '12');
        window.location.search = q.toString();
      } else if (m) jump(m);
    } else if (e.code === 'KeyF' && !e.repeat) {
      flying = !flying;
      window.__akhet.flyCamEnabled?.(!flying);
      if (flying) flyT = 0;
    }
  });

  // ?bm=N boots straight into a bookmark (applied on the first frame,
  // after main has installed the camera rig)
  const bm = Number(new URLSearchParams(window.location.search).get('bm') ?? '0');
  let bmPending = bm >= 1 && bm <= MARKS.length;

  engine.onUpdate((dt) => {
    if (bmPending) {
      const m = MARKS[bm - 1];
      if (m && window.__akhet.setPose) {
        jump(m);
        bmPending = false;
      }
    }
    if (!flying) return;
    flyT += dt / LEG_SECONDS;
    const n = TOUR.length;
    const seg = Math.floor(flyT) % n;
    const f = flyT - Math.floor(flyT);
    // eased Catmull-Rom over positions; eased shortest-arc yaw/pitch
    const ease = f * f * (3 - 2 * f);
    const P = (k: number): Mark => MARKS[TOUR[(seg + k + n) % n] as number] as Mark;
    const p0 = P(-1);
    const p1 = P(0);
    const p2 = P(1);
    const p3 = P(2);
    const cr = (a: number, b: number, c: number, d: number, t: number): number => {
      const t2 = t * t;
      const t3 = t2 * t;
      return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 +
        (3 * b - a - 3 * c + d) * t3);
    };
    setPose({
      p: clearGround([
        cr(p0.p[0], p1.p[0], p2.p[0], p3.p[0], ease),
        cr(p0.p[1], p1.p[1], p2.p[1], p3.p[1], ease),
        cr(p0.p[2], p1.p[2], p2.p[2], p3.p[2], ease),
      ], TOUR_CLEARANCE),
      yaw: lerpAngle(p1.yaw, p2.yaw, ease),
      pitch: p1.pitch + (p2.pitch - p1.pitch) * ease,
    });
  });
}
