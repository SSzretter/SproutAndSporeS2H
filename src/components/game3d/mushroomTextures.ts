import * as THREE from 'three';
import { MushroomSpecies } from '../../types/sim';
import { CAP_SPECS, V_CAP_START, V_GILL_START } from './mushroomGeometry';
import { fbm, makeNoise } from './proceduralNoise';

/**
 * Canvas-noise textures, painted once per species and shared. A cap texture covers the whole
 * lathe: u runs around the fruit, v along its profile, so the stem, gill and cap bands line up
 * with V_GILL_START / V_CAP_START from mushroomGeometry.
 */

type CapSpecies = keyof typeof CAP_SPECS;

interface Palette {
  stem: string;
  gill: string;
  /** Cap color at the margin and at the crown. */
  margin: string;
  crown: string;
  roughness: number;
}

const PALETTES: Record<CapSpecies, Palette> = {
  Shiitake: { stem: '#e9dcc4', gill: '#f3ead8', margin: '#a8754a', crown: '#5c3418', roughness: 0.75 },
  Medicinal: { stem: '#efe6d2', gill: '#f1e4c8', margin: '#e0c79c', crown: '#9c7a4c', roughness: 0.7 },
  'Golden Oyster': { stem: '#f7f1dc', gill: '#f6eec4', margin: '#fde68a', crown: '#eab308', roughness: 0.65 },
  Reishi: { stem: '#8a3a20', gill: '#efe2c4', margin: '#f2d9a0', crown: '#4a0f0a', roughness: 0.28 }
};

const W = 128;
const H = 256;
const PERIOD = 8;

function paintCap(species: CapSpecies): HTMLCanvasElement {
  const pal = PALETTES[species];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const img = ctx.createImageData(W, H);
  const noise = makeNoise(species.length * 31 + 5);
  const fleck = makeNoise(species.length * 17 + 3);
  const stem = new THREE.Color(pal.stem);
  const gill = new THREE.Color(pal.gill);
  const margin = new THREE.Color(pal.margin);
  const crown = new THREE.Color(pal.crown);
  const c = new THREE.Color();

  for (let y = 0; y < H; y++) {
    // Canvas top is v = 1 (the crown)
    const v = 1 - (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const n = fbm(noise, u * PERIOD, v * 10, 4, PERIOD);
      if (v < V_GILL_START) {
        // Stem: fibrous lengthwise streaks
        const streak = fbm(noise, u * PERIOD * 4, v * 3, 3, PERIOD * 4);
        c.copy(stem).multiplyScalar(0.86 + 0.18 * streak);
      } else if (v < V_CAP_START) {
        // Underside: fine radial gill lines (Reishi has pores instead, so just mottling)
        const lines = species === 'Reishi' ? 0.5 : 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 90);
        c.copy(gill).multiplyScalar(0.78 + 0.14 * lines + 0.1 * n);
      } else {
        const t = (v - V_CAP_START) / (1 - V_CAP_START); // 0 margin → 1 crown
        c.copy(margin).lerp(crown, Math.pow(t, 0.8)).multiplyScalar(0.82 + 0.3 * n);
        if (species === 'Shiitake') {
          // Pale veil scales scattered toward the margin
          const f = fbm(fleck, u * PERIOD * 3, t * 14, 2, PERIOD * 3);
          if (f > 0.68 && t < 0.7) c.lerp(new THREE.Color('#efe3cc'), Math.min(1, (f - 0.68) * 6));
        } else if (species === 'Golden Oyster') {
          c.multiplyScalar(0.95 + 0.05 * Math.sin(u * Math.PI * 2 * 70));
        } else if (species === 'Reishi') {
          // Lacquered growth bands and a pale, still-growing rim
          c.multiplyScalar(0.85 + 0.15 * Math.sin(t * Math.PI * 9 + n * 2));
          if (t < 0.12) c.lerp(margin, 1 - t / 0.12);
        }
      }
      const i = (y * W + x) * 4;
      img.data[i] = Math.min(255, c.r * 255);
      img.data[i + 1] = Math.min(255, c.g * 255);
      img.data[i + 2] = Math.min(255, c.b * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

const capTextures = new Map<CapSpecies, THREE.Texture>();
const capMaterials = new Map<string, THREE.MeshStandardMaterial>();
const HEALTH_BUCKETS = 4;
const SICKLY = new THREE.Color('#8a7a5a');

/** Shared cap material for a species, dulled toward brown in steps as health drops. */
export function getCapMaterial(species: CapSpecies, health: number): THREE.MeshStandardMaterial {
  const bucket = Math.round((Math.max(0, Math.min(100, health)) / 100) * HEALTH_BUCKETS);
  const key = `${species}|${bucket}`;
  let mat = capMaterials.get(key);
  if (!mat) {
    let tex = capTextures.get(species);
    if (!tex) {
      tex = new THREE.CanvasTexture(paintCap(species));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      capTextures.set(species, tex);
    }
    mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: new THREE.Color('#ffffff').lerp(SICKLY, (1 - bucket / HEALTH_BUCKETS) * 0.6),
      roughness: PALETTES[species].roughness,
      side: THREE.DoubleSide
    });
    capMaterials.set(key, mat);
  }
  return mat;
}

let myceliumTexture: THREE.Texture | null = null;

/** White mycelium whose alpha is patchy noise: alpha-testing at 1 − colonization reveals it in patches. */
export function getMyceliumTexture(): THREE.Texture {
  if (myceliumTexture) return myceliumTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const noise = makeNoise(41);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = fbm(noise, (x / size) * 6, (y / size) * 6, 4, 6);
        const strand = fbm(noise, (x / size) * 24, (y / size) * 24, 2, 24);
        const i = (y * size + x) * 4;
        const shade = 225 + strand * 30;
        img.data[i] = shade;
        img.data[i + 1] = shade;
        img.data[i + 2] = shade - 6;
        // Stretch the fbm (which clusters around 0.5) to cover 0–255 more evenly
        img.data[i + 3] = Math.max(0, Math.min(255, (n - 0.2) / 0.6 * 255));
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  myceliumTexture = new THREE.CanvasTexture(canvas);
  myceliumTexture.colorSpace = THREE.SRGBColorSpace;
  return myceliumTexture;
}

export type { CapSpecies };
export const isCapSpecies = (s: MushroomSpecies): s is CapSpecies => s in CAP_SPECS;
