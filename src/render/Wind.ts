/**
 * Global wind state — Phase 2 stub carrying the shared uniforms (clouds
 * drift, later smoke/banners); the full hierarchical wind field (gust
 * fronts, vegetation sway, particles) arrives with Phase 6's motion pass.
 * Direction matches WorldConst WIND_X/WIND_Z (Egyptian etesian NNW wind).
 */

import { Vector2 } from 'three';
import { runiform } from '../gpu/RenderUniform';
import { WIND_X, WIND_Z } from '../world/WorldConst';

export const windU = {
  /** unit horizontal direction the wind BLOWS TOWARD (world xz) */
  dir: runiform(new Vector2(WIND_X, WIND_Z).normalize()),
  /** 0 = still air, 1 = strong breeze */
  strength: runiform(0.4),
};
