/**
 * Periodic (tileable) noise for baked textures that are sampled with
 * RepeatWrapping.
 *
 * A texture that wraps must hold a field whose value at u = 1 equals its
 * value at u = 0, or every wrap is a flat discontinuity in world space. The
 * MaterialX noises in TSL are not periodic, and the 96³ cloud base texture
 * (3.6 km period) and the 26 km weather map were baked from them — the "pale
 * straight-edged shards" in the sky were cloud masses cut along those planes
 * (v1.1). The usual workaround, blending 2^n unit-shifted copies with corner
 * weights, halves the field's contrast in the middle of each tile; here the
 * lattice itself wraps instead: every cell index is taken modulo the period,
 * so neighbouring tiles share the same corner values and feature points.
 *
 * Cell indices are shifted by +period before the modulo (the -1 neighbour
 * of cell 0 must wrap to period-1 whatever the backend's float-mod rounding).
 * Seeds go through three's PCG `hash()`, which truncates to uint — so cell
 * keys are built from INTEGER multiples only.
 */

import { dot, float, floor, fract, hash, min, mix, mod, sqrt, vec3 } from 'three/tsl';
import type { NF, NV3 } from '../TSLTypes';

/** integer lattice key → [0,1); `salt` decorrelates independent draws */
function cellHash(c: NV3, salt: number): NF {
  const k = c.x.add(c.y.mul(59)).add(c.z.mul(3613));
  return hash(k.mul(4).add(salt + 1)) as unknown as NF;
}

/**
 * Value noise in [0,1], periodic with `period` cells on every axis; `q` is in
 * cell units (a tile spans q ∈ [0, period)). Quintic fade.
 */
export function valueNoiseP(q: NV3, period: number): NF {
  const i = floor(q);
  const f = fract(q);
  const u = f.mul(f).mul(f).mul(f.mul(f.mul(6).sub(15)).add(10));
  const at = (dx: number, dy: number, dz: number): NF =>
    cellHash(mod(i.add(vec3(dx, dy, dz)).add(period), period) as unknown as NV3, 0);
  const x00 = mix(at(0, 0, 0), at(1, 0, 0), u.x);
  const x10 = mix(at(0, 1, 0), at(1, 1, 0), u.x);
  const x01 = mix(at(0, 0, 1), at(1, 0, 1), u.x);
  const x11 = mix(at(0, 1, 1), at(1, 1, 1), u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z) as unknown as NF;
}

/**
 * fBm of periodic value noise in roughly [-1, 1] (unnormalized, like
 * mx_fractal_noise_float): octave k runs at base·2^k cells per tile, so every
 * octave stays periodic over the same tile.
 */
export function fbmP(p01: NV3, baseCells: number, octaves: number, gain: number): NF {
  let sum: NF = float(0);
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    const cells = baseCells * 2 ** o;
    sum = sum.add(valueNoiseP(p01.mul(cells), cells).mul(2).sub(1).mul(amp)) as unknown as NF;
    amp *= gain;
  }
  return sum;
}

/**
 * Worley F1 distance (cell units, ~0..1), periodic with `period` cells on
 * every axis; one jittered feature point per cell, 3×3×3 search.
 */
export function worleyP(q: NV3, period: number): NF {
  const i = floor(q);
  const f = fract(q);
  let dmin: NF = float(8);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const off = vec3(dx, dy, dz);
        // +period first: float mod may truncate toward zero on some backends
        const cw = mod(i.add(off).add(period), period) as unknown as NV3;
        const feat = vec3(cellHash(cw, 1), cellHash(cw, 2), cellHash(cw, 3));
        const r = off.add(feat).sub(f);
        dmin = min(dmin, dot(r, r)) as unknown as NF;
      }
    }
  }
  return sqrt(dmin) as unknown as NF;
}
