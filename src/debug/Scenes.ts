/**
 * Scene registry — `?scene=` selects which builder boots.
 * Each scene receives the shared WorldContext and populates engine.scene.
 */

import type { Engine } from '../core/Engine';
import type { WorldSeed } from '../core/Seed';

export interface WorldContext {
  engine: Engine;
  seed: WorldSeed;
  /** report boot progress 0..1 with a message (boot UI + harness read it) */
  progress: (p: number, msg: string) => void;
}

export type SceneBuilder = (ctx: WorldContext) => Promise<void>;

const registry = new Map<string, () => Promise<SceneBuilder>>();

registry.set('sanity', async () => (await import('./SanityScene')).buildSanityScene);
registry.set('world', async () => (await import('./TerrainScene')).buildWorldScene);
// 'gallery' arrives with Phase 3; alias to sanity until then
registry.set('gallery', async () => (await import('./SanityScene')).buildSanityScene);

export async function resolveScene(name: string): Promise<SceneBuilder> {
  const loader = registry.get(name) ?? registry.get('sanity');
  if (!loader) throw new Error(`no scene registered for '${name}'`);
  return loader();
}
