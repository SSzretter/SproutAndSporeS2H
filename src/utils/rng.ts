/**
 * Deterministic randomness for the simulation tick. A roll is a pure function of its key (sim time,
 * item id, purpose), so the same state run over the same span always produces the same events, and
 * `npm run sim` is reproducible. Use Math.random only for things that don't affect the simulation
 * (ids, sound, cosmetics).
 */

/** 32-bit FNV-1a hash of a string. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: a small, fast PRNG; returns a generator of numbers in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One roll in [0, 1) fixed by its key parts, e.g. tickRandom(simTime, plant.id, 'dome-heat'). */
export function tickRandom(...parts: Array<string | number>): number {
  return createRng(hashString(parts.join('|')))();
}
