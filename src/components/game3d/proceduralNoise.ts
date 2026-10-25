/**
 * Seeded 2D value noise that tiles in x (period in lattice cells), so textures wrapped around a
 * lathe have no seam. Values are in [0, 1].
 */

export type Noise2D = (x: number, y: number, periodX: number) => number;

export function makeNoise(seed: number): Noise2D {
  const hash = (ix: number, iy: number) => {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  return (x, y, periodX) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const p = Math.max(1, Math.round(periodX));
    const wrap = (i: number) => ((i % p) + p) % p;
    const a = hash(wrap(x0), y0);
    const b = hash(wrap(x0 + 1), y0);
    const c = hash(wrap(x0), y0 + 1);
    const d = hash(wrap(x0 + 1), y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/** Fractal sum of `octaves` noise layers; still tiles in x with the base period. */
export function fbm(noise: Noise2D, x: number, y: number, octaves: number, periodX: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * f, y * f, periodX * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}
