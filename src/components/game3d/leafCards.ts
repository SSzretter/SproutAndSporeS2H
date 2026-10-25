import * as THREE from 'three';
import { PlantSpecies } from '../../types/sim';

/**
 * Alpha-tested leaf cards: a leaf silhouette drawn once per shape onto a canvas (white with
 * grey veins, so per-instance colors tint it), on a slightly curled plane. Card space: the
 * petiole base is at the origin, the leaf runs along +Z (length 1), its face is roughly +Y.
 * Geometries, textures and materials are module-level and shared by every plant.
 */

export type LeafShape = 'palmate' | 'compound' | 'lanceolate' | 'ovate' | 'lobed';

export const LEAF_SHAPE: Record<PlantSpecies, LeafShape> = {
  Cannabis: 'palmate',
  Tomato: 'compound',
  'Chili Pepper': 'lanceolate',
  Basil: 'ovate',
  Hops: 'lobed'
};

// Card width relative to its length
const ASPECT: Record<LeafShape, number> = { palmate: 1, compound: 0.75, lanceolate: 0.45, ovate: 0.7, lobed: 0.95 };

const TEX_PX = 256;

type Ctx = CanvasRenderingContext2D;

/** One blade from (bx, by), `angle` radians off +Y, widest about where t^shape = 0.5. */
function blade(ctx: Ctx, bx: number, by: number, angle: number, len: number, width: number, teeth: number, shape = 0.75) {
  const dx = Math.sin(angle), dy = Math.cos(angle);
  const px = Math.cos(angle), py = -Math.sin(angle);
  const steps = Math.max(12, teeth * 2);
  const edge = (t: number, side: number) => {
    let w = (width / 2) * Math.pow(Math.sin(Math.PI * Math.pow(t, shape)), 0.85);
    let along = t * len;
    if (teeth > 0 && t > 0.08 && t < 0.97) {
      const tooth = Math.round(t * steps) % 2 === 0;
      w *= tooth ? 1.1 : 0.9;
      if (tooth) along += len * 0.015;
    }
    return [bx + dx * along + px * w * side, by + dy * along + py * w * side];
  };
  ctx.beginPath();
  ctx.moveTo(bx, by);
  for (let i = 1; i <= steps; i++) ctx.lineTo(...(edge(i / steps, 1) as [number, number]));
  for (let i = steps - 1; i >= 1; i--) ctx.lineTo(...(edge(i / steps, -1) as [number, number]));
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  // Midrib plus a few side veins
  ctx.strokeStyle = '#c3cfbf';
  ctx.lineWidth = Math.max(0.004, width * 0.05);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + dx * len * 0.96, by + dy * len * 0.96);
  ctx.stroke();
  ctx.lineWidth *= 0.5;
  for (let t = 0.2; t < 0.85; t += 0.16) {
    const [ex, ey] = edge(Math.min(0.95, t + 0.12), 1);
    const [fx, fy] = edge(Math.min(0.95, t + 0.12), -1);
    const cx = bx + dx * len * t, cy = by + dy * len * t;
    ctx.beginPath();
    ctx.moveTo(ex * 0.75 + cx * 0.25, ey * 0.75 + cy * 0.25);
    ctx.lineTo(cx, cy);
    ctx.lineTo(fx * 0.75 + cx * 0.25, fy * 0.75 + cy * 0.25);
    ctx.stroke();
  }
}

function stalk(ctx: Ctx, length: number, width: number) {
  ctx.strokeStyle = '#e4ebe0';
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, length);
  ctx.stroke();
}

const DRAW: Record<LeafShape, (ctx: Ctx) => void> = {
  palmate: ctx => {
    stalk(ctx, 0.37, 0.02);
    const leaflets: [number, number, number][] = [[0, 0.62, 0.13], [28, 0.55, 0.12], [58, 0.42, 0.1], [92, 0.22, 0.06]];
    for (const [deg, len, w] of leaflets.slice().reverse()) {
      for (const side of deg === 0 ? [1] : [1, -1]) blade(ctx, 0, 0.36, side * deg * Math.PI / 180, len, w, 11, 0.7);
    }
  },
  compound: ctx => {
    stalk(ctx, 0.9, 0.018);
    for (const [y, len] of [[0.24, 0.3], [0.47, 0.28], [0.68, 0.22]] as [number, number][]) {
      for (const side of [1, -1]) blade(ctx, 0, y, side * 62 * Math.PI / 180, len, 0.15, 6, 0.7);
    }
    blade(ctx, 0, 0.7, 0, 0.28, 0.16, 6, 0.7);
  },
  lanceolate: ctx => {
    stalk(ctx, 0.14, 0.02);
    blade(ctx, 0, 0.1, 0, 0.88, 0.38, 0, 0.66);
  },
  ovate: ctx => {
    stalk(ctx, 0.14, 0.02);
    blade(ctx, 0, 0.12, 0, 0.86, 0.62, 0, 0.75);
  },
  lobed: ctx => {
    stalk(ctx, 0.2, 0.022);
    for (const side of [1, -1]) blade(ctx, 0, 0.18, side * 50 * Math.PI / 180, 0.48, 0.34, 8, 0.7);
    blade(ctx, 0, 0.18, 0, 0.8, 0.45, 11, 0.7);
  }
};

function makeTexture(shape: LeafShape): THREE.Texture {
  const aspect = ASPECT[shape];
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(TEX_PX * aspect);
  canvas.height = TEX_PX;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Leaf units: x across (±aspect/2), y from base (0) to tip (1)
    ctx.setTransform(TEX_PX, 0, 0, -TEX_PX, canvas.width / 2, TEX_PX);
    DRAW[shape](ctx);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeGeometry(shape: LeafShape): THREE.BufferGeometry {
  const aspect = ASPECT[shape];
  const geo = new THREE.PlaneGeometry(aspect, 1, 4, 6);
  geo.translate(0, 0.5, 0);
  geo.rotateX(Math.PI / 2);
  // Tip arches down, edges cup up a little
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (aspect / 2);
    const z = pos.getZ(i);
    pos.setY(i, -0.2 * z * z + 0.06 * x * x * Math.min(1, z * 2));
  }
  geo.computeVertexNormals();
  return geo;
}

const cards = new Map<LeafShape, { geometry: THREE.BufferGeometry; material: THREE.Material }>();

export function getLeafCard(shape: LeafShape) {
  let card = cards.get(shape);
  if (!card) {
    card = {
      geometry: makeGeometry(shape),
      material: new THREE.MeshStandardMaterial({ map: makeTexture(shape), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.72 })
    };
    cards.set(shape, card);
  }
  return card;
}
