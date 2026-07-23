/**
 * Bookmarks + flythrough (Phase 7):
 *   1-9  — jump to a curated view (poses verified by harness shots)
 *   F    — cinematic flythrough: closed Catmull-Rom loop through the
 *          bookmark positions with eased yaw/pitch, fly input disabled
 *   ?bm=N — boot straight into bookmark N (tooling/screenshots)
 */

import type { Engine } from '../core/Engine';
import type { CamPose } from '../core/Hooks';

interface Mark {
  name: string;
  p: [number, number, number];
  yaw: number;
  pitch: number;
}

/** curated views (all verified as harness framings during Phases 3-6) */
export const MARKS: Mark[] = [
  { name: 'harbor panorama', p: [1150, -38, -420], yaw: Math.PI, pitch: -0.33 },
  { name: 'dawn from the harbor', p: [1160, -41, -80], yaw: 1.64, pitch: 0.1 },
  { name: 'noon court', p: [265, 7, 265], yaw: 0.785, pitch: 0.2 },
  { name: 'causeway descent', p: [620, 0, -190], yaw: 2.25, pitch: -0.06 },
  { name: 'town gate', p: [491, -30, 668], yaw: -2.94, pitch: -0.12 },
  { name: 'gallery street', p: [462, -36, 722], yaw: 3.1, pitch: 0 },
  { name: 'quarry', p: [0, 15, 560], yaw: -0.738, pitch: -0.2 },
  { name: 'queens & temple', p: [140, 30, -20], yaw: -2.678, pitch: -0.26 },
  { name: 'river shore', p: [1800, -42, 250], yaw: -2.6, pitch: -0.12 },
];

/** tour order: harbor → river → town → quarry → plateau → causeway → back */
const TOUR = [0, 1, 8, 5, 4, 6, 2, 7, 3];
const LEG_SECONDS = 11;

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

  window.addEventListener('keydown', (e) => {
    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      const m = MARKS[n - 1];
      if (m) {
        if (flying) {
          flying = false;
          window.__akhet.flyCamEnabled?.(true);
        }
        setPose({ p: [...m.p], yaw: m.yaw, pitch: m.pitch });
      }
    } else if (e.code === 'KeyF' && !e.repeat) {
      flying = !flying;
      window.__akhet.flyCamEnabled?.(!flying);
      if (flying) flyT = 0;
    }
  });

  // ?bm=N boots straight into a bookmark (applied on the first frame,
  // after main has installed the camera rig)
  const bm = Number(new URLSearchParams(window.location.search).get('bm') ?? '0');
  let bmPending = bm >= 1 && bm <= 9;

  engine.onUpdate((dt) => {
    if (bmPending) {
      const m = MARKS[bm - 1];
      if (m && window.__akhet.setPose) {
        setPose({ p: [...m.p], yaw: m.yaw, pitch: m.pitch });
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
      p: [
        cr(p0.p[0], p1.p[0], p2.p[0], p3.p[0], ease),
        cr(p0.p[1], p1.p[1], p2.p[1], p3.p[1], ease),
        cr(p0.p[2], p1.p[2], p2.p[2], p3.p[2], ease),
      ],
      yaw: lerpAngle(p1.yaw, p2.yaw, ease),
      pitch: p1.pitch + (p2.pitch - p1.pitch) * ease,
    });
  });
}
