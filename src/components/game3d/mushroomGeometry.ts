import * as THREE from 'three';
import { MushroomItem, MushroomSpecies, MushroomStage } from '../../types/sim';
import { fbm, makeNoise } from './proceduralNoise';

/**
 * Fruit-body geometry. Capped species are a LatheGeometry of one profile curve (stem → gills →
 * cap → crown) that morphs with a 0–1 growth value: a chubby closed pin, a button whose margin
 * is tucked against the stem, an opening cap, and an open (finally upturned) cap. Profiles are
 * in units of the fruit's height (base at the origin, crown at y = 1); the model scales them to
 * feet. Lion's Mane is a noisy blob with spines instead.
 */

interface CapSpec {
  /** Cap flesh thickness at the crown, pin → mature (the stem fills the rest of the height). */
  thick: [number, number];
  capR: [number, number];
  stemR: [number, number];
  /** Crown depression of a funnel-shaped cap once open. */
  funnel: number;
  /** How far the margin lifts when over-mature. */
  upturn: number;
  /** Gills running down the stem. */
  decurrent: number;
  /** Swollen stem base. */
  bulb: number;
  /** Lathe sweep: < 2π gives a shelf with a lateral stalk. */
  phiLength: number;
}

export const CAP_SPECS: Record<Exclude<MushroomSpecies, "Lion's Mane">, CapSpec> = {
  Shiitake: { thick: [0.55, 0.3], capR: [0.32, 0.62], stemR: [0.17, 0.1], funnel: 0, upturn: 0.3, decurrent: 0, bulb: 1.1, phiLength: Math.PI * 2 },
  Medicinal: { thick: [0.5, 0.24], capR: [0.26, 0.5], stemR: [0.13, 0.07], funnel: 0, upturn: 0.15, decurrent: 0, bulb: 1.35, phiLength: Math.PI * 2 },
  'Golden Oyster': { thick: [0.5, 0.26], capR: [0.32, 0.62], stemR: [0.16, 0.1], funnel: 0.5, upturn: 0.5, decurrent: 0.6, bulb: 1, phiLength: Math.PI * 2 },
  Reishi: { thick: [0.6, 0.3], capR: [0.3, 1.25], stemR: [0.2, 0.12], funnel: 0, upturn: 0, decurrent: 0, bulb: 1.15, phiLength: Math.PI * 1.25 }
};

// Fixed point counts per profile section, so each section always lands on the same band of the
// lathe's v texture coordinate (mushroomTextures paints stem / gills / cap into those bands).
const STEM_PTS = 8;
const GILL_PTS = 7;
const CAP_PTS = 14;
const LAST = STEM_PTS + GILL_PTS + CAP_PTS - 1;
export const V_GILL_START = (STEM_PTS - 1) / LAST;
export const V_CAP_START = (STEM_PTS - 1 + GILL_PTS) / LAST;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function capProfile(spec: CapSpec, growth: number): THREE.Vector2[] {
  const size = smooth(0, 0.8, growth);
  const open = smooth(0.3, 0.85, growth);
  const lift = smooth(0.92, 1, growth) * spec.upturn;

  const thick = lerp(spec.thick[0], spec.thick[1], size);
  const capR = lerp(spec.capR[0], spec.capR[1], size);
  const stemR = lerp(spec.stemR[0], spec.stemR[1], size);
  const gillY = 1 - thick;

  // Where gills meet the stem, and the cap margin: tucked in and down while closed
  const sx = stemR * 0.9;
  const sy = gillY - spec.decurrent * 0.25 * open;
  const mx = lerp(stemR * 1.25, capR * 0.98, open);
  const my = gillY - (1 - open) * thick * 0.5 + open * 0.02 + lift * capR * 0.3;
  const crownY = 1 - spec.funnel * open * thick * 0.6;

  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  for (let i = 0; i < STEM_PTS - 1; i++) {
    const t = i / (STEM_PTS - 2);
    const r = stemR * (1 + (spec.bulb - 1) * (1 - t) ** 2) * (1 - 0.1 * t);
    pts.push(new THREE.Vector2(i === STEM_PTS - 2 ? sx : r, t * sy));
  }
  for (let j = 1; j <= GILL_PTS; j++) {
    const t = j / GILL_PTS;
    pts.push(new THREE.Vector2(lerp(sx, mx, t), lerp(sy, my, t) + Math.sin(Math.PI * t) * 0.02));
  }
  // Cap surface: cubic Bézier from the margin, bulging outward, over to the crown
  const c1 = new THREE.Vector2(lerp(capR * 1.05, capR, open), my + (1 - my) * lerp(0.7, 0.35, open));
  const c2 = new THREE.Vector2(capR * lerp(0.75, 0.55, open), 1);
  const curve = new THREE.CubicBezierCurve(new THREE.Vector2(mx, my), c1, c2, new THREE.Vector2(0, crownY));
  for (let k = 1; k <= CAP_PTS; k++) pts.push(curve.getPoint(k / CAP_PTS));
  return pts;
}

// Geometries are shared by every fruit at the same species and (quantized) growth
const GROWTH_STEPS = 40;
const capCache = new Map<string, THREE.LatheGeometry>();

export function getCapGeometry(species: keyof typeof CAP_SPECS, growth: number): THREE.LatheGeometry {
  const q = Math.round(Math.max(0, Math.min(1, growth)) * GROWTH_STEPS);
  const key = `${species}|${q}`;
  let geo = capCache.get(key);
  if (!geo) {
    const spec = CAP_SPECS[species];
    geo = new THREE.LatheGeometry(capProfile(spec, q / GROWTH_STEPS), 28, -spec.phiLength / 2, spec.phiLength);
    capCache.set(key, geo);
  }
  return geo;
}

let lionsManeBlob: THREE.BufferGeometry | null = null;
let lionsManeSpine: THREE.BufferGeometry | null = null;

/** Unit-radius lumpy blob with baked cream vertex colors. */
export function getLionsManeBlob(): THREE.BufferGeometry {
  if (lionsManeBlob) return lionsManeBlob;
  // Indexed sphere, so displaced vertices still share smooth normals (the lumps tile across the seam)
  const geo = new THREE.SphereGeometry(1, 48, 32);
  const noise = makeNoise(7);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color('#f4efe2');
  const shade = new THREE.Color('#d9cdb0');
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const u = (Math.atan2(v.z, v.x) / (Math.PI * 2) + 0.5) * 8;
    const n = fbm(noise, u, (v.y + 1) * 3, 3, 8);
    v.multiplyScalar(1 + (n - 0.5) * 0.28);
    if (v.y < -0.55) v.y = -0.55 + (v.y + 0.55) * 0.4; // flattened underside
    pos.setXYZ(i, v.x, v.y, v.z);
    c.copy(base).lerp(shade, n * 0.8);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return (lionsManeBlob = geo);
}

/** Spine of length 1 hanging from its base at the origin. */
export function getLionsManeSpine(): THREE.BufferGeometry {
  return (lionsManeSpine ??= new THREE.ConeGeometry(0.04, 1, 4).rotateX(Math.PI).translate(0, -0.5, 0));
}

// Where each stage sits on the 0–1 fruit growth scale; stageProgress interpolates within it
const STAGE_GROWTH: Record<MushroomStage, [number, number]> = {
  colonizing: [0, 0],
  pinning: [0, 0.25],
  fruiting: [0.25, 0.8],
  mature: [0.8, 0.95],
  ready: [0.95, 1]
};

export function getMushroomGrowth(shroom: MushroomItem): number {
  const [from, to] = STAGE_GROWTH[shroom.stage] || [0, 0];
  return from + (to - from) * Math.max(0, Math.min(1, (shroom.stageProgress || 0) / 100));
}
