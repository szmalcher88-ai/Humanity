/**
 * Global hooks contract between the running app and external tooling
 * (the Playwright verification harness reads/writes `window.__akhet`).
 * Contract shape follows PROJECT LAAS (MIT) — see LICENSE-THIRD-PARTY.
 */

export interface CamPose {
  /** world position (meters; origin = Great Pyramid center, X=east, Z=south) */
  p: [number, number, number];
  /** yaw (rad, around +Y), pitch (rad) */
  yaw: number;
  pitch: number;
  /** optional fov override (deg) */
  fov?: number;
}

export interface EngineStats {
  fps: number;
  frameMs: number;
  frameMsP95: number;
  drawCalls: number;
  triangles: number;
  frame: number;
  /** named counters merged in by subsystems (instances per category, cull stats, vram…) */
  counters: Record<string, number>;
  /** per-pass GPU timings in ms when timestamp-query is available */
  gpuPasses: Record<string, number>;
}

export interface GpuDiagnostics {
  ok: boolean;
  reason?: string;
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
  features: string[];
  limits: Record<string, number>;
}

import type { CollisionIssue } from '../debug/CollisionAudit';

export interface AkhetHooks {
  /** true once the first frames have rendered and the GPU pipeline is verified */
  ready: boolean;
  /** set on fatal error (also rendered as a fail-loud overlay) */
  error: string | null;
  stats: EngineStats | null;
  diag: GpuDiagnostics | null;
  /** world-gen / scene progress 0..1 (boot UI + tooling wait on this) */
  progress: number;
  progressMsg: string;
  /** tooling control surface */
  setPose: ((pose: CamPose) => void) | null;
  getPose: (() => CamPose) | null;
  /** scene-requested spawn pose — main applies it once the camera rig exists */
  initialPose: CamPose | null;
  /** 'walk' only for the default interactive spawn; programmatic poses fly */
  initialPoseMode: 'walk' | 'fly' | null;
  /** terrain/water heights at (x, z) — walk mode + fly soft collision */
  groundProbe: ((x: number, z: number) => { ground: number; water: number }) | null;
  setTimeOfDay: ((t: number) => void) | null;
  /** settle frames (TAA/temporal effects) then resolve — call before screenshots */
  settle: ((frames?: number) => Promise<void>) | null;
  /** enable/disable fly-camera input (flythrough takes the wheel) */
  flyCamEnabled: ((on: boolean) => void) | null;
  /** adapter throughput, ns per invocation (preset gate — core/GpuBench) */
  benchMs: number | null;
  /** walk mode: pin the camera to eye height on the surface (Phase 7) */
  setWalk: ((on: boolean) => void) | null;
  /** surface height under (x,z) INCLUDING structures — walk-mode verification */
  surfaceProbe: ((x: number, z: number, feetY: number) => number) | null;
  /** run the footprint collision/consistency audit (harness gate) */
  collisionAudit: (() => CollisionIssue[]) | null;
  /** baked terrain height at world (x, z) — tooling (tools/ground.ts: pad levels) */
  groundAt: ((x: number, z: number) => number) | null;
  /** set the world-simulation clock (s) — tooling: shoot moving things at a time */
  setWorldClock: ((t: number) => void) | null;
  /** moving vessels where they are now (tooling: tools/closeup.ts --fleet) */
  fleet: (() => Array<{ id: string; kind: string; x: number; z: number; a: number; load: number; conf: string }>) | null;
  /** registered footprints (id, centre, extent) — tooling (tools/closeup.ts) */
  /** (2026-10-27) HaulTrains' loop, every ≈ 1 m: x, y, z, heading flat;
   *  the up lane's length (tooling: route vs. walk surface, closeups) */
  haulRoute: (() => { pts: number[]; up: number; total: number; step: number; minTurnR: number }) | null;
  footprints: (() => Array<{ id: string; family: string; x: number; z: number; y0: number; y1: number; hx: number; hz: number; conf?: string }>) | null;
  /** Inspector: nudge an editable placement by (dx, dz) and rebuild */
  editNudge: ((id: string, dx: number, dz: number) => void) | null;
  /** Inspector: export pending edit deltas as a canon patch string */
  editExport: (() => string) | null;
}

declare global {
  interface Window {
    __akhet: AkhetHooks;
  }
}

export function initHooks(): AkhetHooks {
  const hooks: AkhetHooks = {
    ready: false,
    error: null,
    stats: null,
    diag: null,
    progress: 0,
    progressMsg: 'boot',
    setPose: null,
    getPose: null,
    initialPose: null,
    initialPoseMode: null,
    groundProbe: null,
    setTimeOfDay: null,
    settle: null,
    flyCamEnabled: null,
    benchMs: null,
    setWalk: null,
    surfaceProbe: null,
    collisionAudit: null,
    footprints: null,
    haulRoute: null,
    fleet: null,
    setWorldClock: null,
    groundAt: null,
    editNudge: null,
    editExport: null,
  };
  window.__akhet = hooks;
  return hooks;
}
