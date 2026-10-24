import { Item, Dimensions } from '../../types/sim';
import { CANVAS_GRID_SIZE, CANVAS_VERTICAL_PX_PER_FT } from '../../utils/spatial';

/**
 * True-scale sprite rendering for the 2D game world.
 *
 * Sprites are hand-drawn at arbitrary pixel sizes. To draw an item at its real size we
 * measure the sprite's opaque pixel bounds once (offscreen, cached by key) and stretch it so
 * its width = item length (ft × CANVAS_GRID_SIZE) and its height = item height
 * (ft × CANVAS_VERTICAL_PX_PER_FT), with the bottom-center resting on the item's anchor.
 */

type DrawFn = (ctx: CanvasRenderingContext2D) => void;

interface SpriteBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const MEASURE_SIZE = 640;
const MEASURE_ORIGIN_X = MEASURE_SIZE / 2;
const MEASURE_ORIGIN_Y = MEASURE_SIZE * 0.75;
const MIN_SPRITE_PX = 3;

const boundsCache = new Map<string, SpriteBounds | null>();
let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (!measureCtx && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = MEASURE_SIZE;
    canvas.height = MEASURE_SIZE;
    measureCtx = canvas.getContext('2d', { willReadFrequently: true });
  }
  return measureCtx;
}

/** Opaque pixel bounds of a sprite drawn around the origin, relative to that origin. */
export function measureSpriteBounds(key: string, draw: DrawFn): SpriteBounds | null {
  if (boundsCache.has(key)) return boundsCache.get(key)!;
  const ctx = getMeasureContext();
  if (!ctx) return null;

  ctx.clearRect(0, 0, MEASURE_SIZE, MEASURE_SIZE);
  ctx.save();
  ctx.translate(MEASURE_ORIGIN_X, MEASURE_ORIGIN_Y);
  draw(ctx);
  ctx.restore();

  const { data } = ctx.getImageData(0, 0, MEASURE_SIZE, MEASURE_SIZE);
  let minX = MEASURE_SIZE, minY = MEASURE_SIZE, maxX = -1, maxY = -1;
  for (let py = 0; py < MEASURE_SIZE; py++) {
    const row = py * MEASURE_SIZE * 4;
    for (let px = 0; px < MEASURE_SIZE; px++) {
      if (data[row + px * 4 + 3] > 16) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
  }

  const bounds = maxX < 0 ? null : {
    minX: minX - MEASURE_ORIGIN_X,
    minY: minY - MEASURE_ORIGIN_Y,
    maxX: maxX + 1 - MEASURE_ORIGIN_X,
    maxY: maxY + 1 - MEASURE_ORIGIN_Y
  };
  boundsCache.set(key, bounds);
  return bounds;
}

/**
 * Draws a sprite stretched to widthPx × heightPx with its bottom-center at (anchorX, anchorY).
 * `measure` (defaults to `draw`) defines the body that gets fitted, so transient extras such as
 * light cones or glows can extend past the body without shrinking it.
 */
export function drawSpriteToScale(
  ctx: CanvasRenderingContext2D,
  opts: { key: string; draw: DrawFn; measure?: DrawFn; anchorX: number; anchorY: number; widthPx: number; heightPx: number }
): void {
  const bounds = measureSpriteBounds(opts.key, opts.measure || opts.draw);
  if (!bounds) return;
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);

  ctx.save();
  ctx.translate(opts.anchorX, opts.anchorY);
  ctx.scale(Math.max(MIN_SPRITE_PX, opts.widthPx) / bw, Math.max(MIN_SPRITE_PX, opts.heightPx) / bh);
  ctx.translate(-(bounds.minX + bounds.maxX) / 2, -bounds.maxY);
  opts.draw(ctx);
  ctx.restore();
}

export function feetToPx(ft: number): number {
  return ft * CANVAS_GRID_SIZE;
}

export function feetToVerticalPx(ft: number): number {
  return ft * CANVAS_VERTICAL_PX_PER_FT;
}

export interface ItemScreenBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Screen y of the item's base after lifting by its z elevation */
  baseY: number;
}

/** Within this many feet of the container ceiling an item counts as ceiling-mounted. */
const OVERHEAD_CLEARANCE_FT = 1.0;

/**
 * Ceiling-mounted items (lights, duct fans) are drawn top-down over their footprint in an
 * overhead layer instead of being lifted, which would push them outside their tent on screen.
 */
export function isOverheadItem(item: Item, containerHeightFt: number): boolean {
  const z = item.position?.z || 0;
  return z > 0 && z + item.dimensions.height >= containerHeightFt - OVERHEAD_CLEARANCE_FT;
}

/**
 * Screen-space box of an item whose footprint is centered at (floorX, floorY):
 * the floor footprint plus the upright sprite rising from its (elevated) base.
 * Overhead items occupy just their footprint.
 */
export function getItemScreenBox(item: Item, floorX: number, floorY: number, overhead: boolean = false): ItemScreenBox {
  const dims: Dimensions = item.dimensions;
  const halfL = feetToPx(dims.length) / 2;
  const halfW = feetToPx(dims.width) / 2;
  if (overhead) {
    return { left: floorX - halfL, right: floorX + halfL, top: floorY - halfW, bottom: floorY + halfW, baseY: floorY };
  }
  const baseY = floorY - feetToVerticalPx(item.position?.z || 0);
  const spriteTop = baseY - Math.max(MIN_SPRITE_PX, feetToVerticalPx(dims.height));
  return {
    left: floorX - halfL,
    right: floorX + halfL,
    top: Math.min(floorY - halfW, spriteTop),
    bottom: Math.max(floorY + halfW, baseY),
    baseY
  };
}

export function isPointInItemBox(box: ItemScreenBox, x: number, y: number, slopPx: number = 4): boolean {
  return x >= box.left - slopPx && x <= box.right + slopPx && y >= box.top - slopPx && y <= box.bottom + slopPx;
}

/** Faint to-scale footprint (L × W) on the floor beneath an item. */
export function drawItemFootprint(
  ctx: CanvasRenderingContext2D,
  item: Item,
  floorX: number,
  floorY: number,
  highlighted: boolean
): void {
  const l = feetToPx(item.dimensions.length);
  const w = feetToPx(item.dimensions.width);
  const isRound = item.category === 'plant' || item.category === 'person' || item.category === 'pet';
  ctx.save();
  ctx.beginPath();
  if (isRound) {
    ctx.ellipse(floorX, floorY, l / 2, w / 2, 0, 0, Math.PI * 2);
  } else {
    ctx.rect(floorX - l / 2, floorY - w / 2, l, w);
  }
  ctx.fillStyle = highlighted ? 'rgba(52, 211, 153, 0.18)' : 'rgba(0, 0, 0, 0.22)';
  ctx.fill();
  ctx.strokeStyle = highlighted ? 'rgba(52, 211, 153, 0.85)' : 'rgba(161, 161, 170, 0.25)';
  ctx.lineWidth = highlighted ? 1.5 : 1;
  ctx.setLineDash(highlighted ? [4, 3] : []);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws a sprite uniformly scaled to fit inside widthPx × heightPx, centered on (cx, cy).
 */
export function drawSpriteFitted(
  ctx: CanvasRenderingContext2D,
  opts: { key: string; draw: DrawFn; measure?: DrawFn; cx: number; cy: number; widthPx: number; heightPx: number }
): void {
  const bounds = measureSpriteBounds(opts.key, opts.measure || opts.draw);
  if (!bounds) return;
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(opts.widthPx / bw, opts.heightPx / bh);
  ctx.save();
  ctx.translate(opts.cx, opts.cy);
  ctx.scale(scale, scale);
  ctx.translate(-(bounds.minX + bounds.maxX) / 2, -(bounds.minY + bounds.maxY) / 2);
  opts.draw(ctx);
  ctx.restore();
}

/** Small name/status label drawn at screen size (never scaled with the sprite). */
export function drawItemLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, highlighted: boolean): void {
  ctx.save();
  ctx.fillStyle = highlighted ? '#e2e8f0' : '#a1a1aa';
  ctx.font = 'bold 7.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  ctx.restore();
}
