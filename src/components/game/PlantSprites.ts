import { PlantItem, MushroomItem, PlantStage, MushroomStage } from '../../types/sim';
import { getPlantContainerDimensions } from '../../utils/spatial';
import { drawSpriteToScale, feetToPx, feetToVerticalPx } from './scaleRender';

/**
 * Procedural 2D botanical canvas renderer
 * Renders authentic, charming growth stages with procedural details and wind sway animation
 */

export interface RenderPlantOptions {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  scale?: number;
  time?: number; // for wind sway and trichome sparkle
  highlighted?: boolean;
  bodyOnly?: boolean; // Skip ground shadow & floating badges (used by true-scale rendering)
}

/**
 * Draws a plant (Cannabis, Tomato, Pepper, Basil) at its exact lifecycle stage
 */
export function drawPlant(plant: PlantItem, options: RenderPlantOptions) {
  const { ctx, x, y, scale = 1, time = 0, highlighted = false } = options;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const sway = Math.sin(time * 0.003 + x) * 2;
  const isReady = plant.stage === 'ready' || (plant.stage === 'ripening' && plant.stageProgress > 80);

  // Harvest Aura Glow
  if (isReady || highlighted) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -25, 35, 45, 0, 0, Math.PI * 2);
    ctx.fillStyle = isReady ? 'rgba(251, 191, 36, 0.25)' : 'rgba(52, 211, 153, 0.2)';
    ctx.fill();
    ctx.strokeStyle = isReady ? '#f59e0b' : '#10b981';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  }

  // 1. Draw Container Pot (Fabric Grow Bag, Cedar Bed, DWC, Terracotta, etc.)
  drawPot(ctx, plant.soilMoisture, plant.containerType);

  // 2. Draw Plant based on stage & propagation origin
  drawPlantFoliage(ctx, plant, sway, time, isReady);

  // 3. Health & Status Indicators
  drawPlantStatusBadges(ctx, plant, time, isReady, -45, -68);

  ctx.restore();
}

/**
 * Draws a plant at true scale: the pot sized to plant.containerDimensions and the foliage
 * sized to heightInches x canopyWidthInches, standing on (x, y) (the pot's base in screen px).
 */
export function drawPlantToScale(plant: PlantItem, options: RenderPlantOptions) {
  const { ctx, x, y, time = 0 } = options;
  const isReady = plant.stage === 'ready' || (plant.stage === 'ripening' && plant.stageProgress > 80);
  const containerType = plant.containerType;
  const pot = plant.containerDimensions || getPlantContainerDimensions(containerType, plant.containerVolumeGallons);
  const potHeightPx = Math.max(3, feetToVerticalPx(pot.height));

  drawSpriteToScale(ctx, {
    key: `pot|${containerType || 'fabric_pot'}`,
    draw: c => drawPot(c, plant.soilMoisture, containerType, false),
    anchorX: x,
    anchorY: y,
    widthPx: feetToPx(pot.length),
    heightPx: potHeightPx
  });

  // Foliage rises from the soil line, slightly below the rim
  const soilY = y - potHeightPx * 0.85;
  const heightPx = Math.max(3, feetToVerticalPx(plant.heightInches / 12));
  const canopyPx = Math.max(3, feetToPx(plant.canopyWidthInches / 12));
  const sway = Math.sin(time * 0.003 + x) * 2;

  if (isReady) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, soilY - heightPx / 2, canopyPx / 2 + 6, heightPx / 2 + 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
    ctx.fill();
    ctx.restore();
  }

  drawSpriteToScale(ctx, {
    key: `foliage|${plant.species}|${plant.stage}|${Math.round(plant.stageProgress || 0)}|${isReady}`,
    // Native sprites put the soil surface at y = -14; shift it to the origin
    draw: c => { c.translate(0, 14); drawPlantFoliage(c, plant, sway, time, isReady); },
    measure: c => { c.translate(0, 14); drawPlantFoliage(c, plant, 0, 0, isReady); },
    anchorX: x,
    anchorY: soilY,
    widthPx: canopyPx,
    heightPx
  });

  ctx.save();
  ctx.translate(x, soilY);
  drawPlantStatusBadges(ctx, plant, time, isReady, -heightPx * 0.6, -heightPx - 14);
  ctx.restore();
}

function drawPlantStatusBadges(
  ctx: CanvasRenderingContext2D,
  plant: PlantItem,
  time: number,
  isReady: boolean,
  healthDotY: number,
  harvestBadgeY: number
) {
  if (plant.health < 60) {
    // Wilted yellow leaves effect
    ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.beginPath();
    ctx.arc(15, healthDotY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Floating Harvest Indicator
  if (isReady) {
    const bob = Math.sin(time * 0.006) * 3;
    ctx.save();
    ctx.translate(0, harvestBadgeY + bob);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✂', 0, 0);
    ctx.restore();
  }
}

/**
 * Draws only the living plant (no pot), with the soil surface at native y = -14
 */
function drawPlantFoliage(
  ctx: CanvasRenderingContext2D,
  plant: PlantItem,
  sway: number,
  time: number,
  isReady: boolean
) {
  const stage = plant.stage;

  if (plant.species === 'Hops') {
    drawHopsPlant(ctx, plant, sway, time, isReady);
  } else if (stage === 'germination') {
    // Sown Seed / Emerging Sprout
    drawGerminationStage(ctx, plant.stageProgress, time);
  } else if (stage === 'rooting') {
    // Cutting under Humidity Dome
    drawRootingCuttingStage(ctx, plant.stageProgress, time);
  } else if (stage === 'seedling') {
    // Early Seedling / First true leaves
    drawSeedlingStage(ctx, plant.stageProgress, sway);
  } else if (stage === 'mature_seedling') {
    // Mature Seedling / Multiple nodes
    drawMatureSeedlingStage(ctx, plant.stageProgress, sway, plant.species);
  } else if (stage === 'vegetative') {
    // Dense Foliage Vegetative Stage
    drawVegetativeStage(ctx, plant.stageProgress, sway, plant.species);
  } else if (stage === 'flowering') {
    // Floral Bloom Formation & Calyxes
    drawFloweringStage(ctx, plant.stageProgress, sway, plant.species, time);
  } else if (stage === 'ripening' || stage === 'ready') {
    // Heavy Ripened Colas & Trichome Frosting
    drawRipeningStage(ctx, plant.stageProgress, sway, plant.species, time, isReady);
  }
}

/**
 * Draws the container pot with soil moisture depth and vessel type
 */
function drawPot(ctx: CanvasRenderingContext2D, moisture: number, containerType?: string, withShadow: boolean = true) {
  // Pot shadow
  if (withShadow) {
    ctx.beginPath();
    ctx.ellipse(0, 5, 20, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fill();
  }

  if (containerType === 'raised_bed_cedar' || containerType === 'cedar_raised_bed') {
    // Cedar Wood Garden Bed
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-22, -16, 44, 20);
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-22, -16, 44, 20);
    // Plank lines
    ctx.beginPath();
    ctx.moveTo(-22, -9);
    ctx.lineTo(22, -9);
    ctx.moveTo(-22, -2);
    ctx.lineTo(22, -2);
    ctx.stroke();
    // Soil inside bed
    ctx.beginPath();
    ctx.ellipse(0, -15, 20, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = moisture > 50 ? '#1c130d' : moisture > 25 ? '#2e1f14' : '#574132';
    ctx.fill();
    return;
  }

  if (containerType === 'in_ground_earth' || containerType === 'in_ground_bed') {
    // In-ground soil mound with mulch and stones
    ctx.beginPath();
    ctx.ellipse(0, -4, 22, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = moisture > 50 ? '#261b11' : moisture > 25 ? '#3d2b1f' : '#6b5344';
    ctx.fill();
    ctx.strokeStyle = '#574132';
    ctx.lineWidth = 1;
    ctx.stroke();
    // River stones
    ctx.fillStyle = '#71717a';
    ctx.beginPath();
    ctx.arc(-18, 0, 3, 0, Math.PI * 2);
    ctx.arc(-14, 4, 2.5, 0, Math.PI * 2);
    ctx.arc(14, 4, 2.5, 0, Math.PI * 2);
    ctx.arc(18, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (containerType === 'dwc_reservoir_bucket' || containerType === 'dwc_bucket') {
    // DWC Hydroponic Bucket (Black plastic with net pot and hydroton)
    ctx.beginPath();
    ctx.moveTo(-15, -14);
    ctx.lineTo(15, -14);
    ctx.lineTo(12, 4);
    ctx.lineTo(-12, 4);
    ctx.closePath();
    ctx.fillStyle = '#18181b';
    ctx.fill();
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Blue water level indicator tube
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(13, -10);
    ctx.lineTo(11, 2);
    ctx.stroke();

    // Hydroton clay pebbles surface
    ctx.beginPath();
    ctx.ellipse(0, -14, 14, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#9a3412';
    ctx.fill();
    return;
  }

  if (containerType === 'terracotta_pot' || containerType === 'terracotta') {
    // Terracotta Clay Pot
    ctx.beginPath();
    ctx.moveTo(-16, -14);
    ctx.lineTo(16, -14);
    ctx.lineTo(12, 4);
    ctx.lineTo(-12, 4);
    ctx.closePath();
    ctx.fillStyle = '#c2410c';
    ctx.fill();
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Rim
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(-17, -18, 34, 4);

    // Soil Surface
    ctx.beginPath();
    ctx.ellipse(0, -14, 15, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = moisture > 50 ? '#261b11' : moisture > 25 ? '#3d2b1f' : '#6b5344';
    ctx.fill();
    return;
  }

  // Smart fabric pot with charcoal fabric
  ctx.beginPath();
  ctx.moveTo(-16, -14);
  ctx.lineTo(16, -14);
  ctx.lineTo(13, 4);
  ctx.lineTo(-13, 4);
  ctx.closePath();
  ctx.fillStyle = '#27272a';
  ctx.fill();
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Handles / rim
  ctx.beginPath();
  ctx.rect(-17, -18, 34, 4);
  ctx.fillStyle = '#3f3f46';
  ctx.fill();

  // Soil Surface
  ctx.beginPath();
  ctx.ellipse(0, -14, 15, 3.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = moisture > 50 ? '#261b11' : moisture > 25 ? '#3d2b1f' : '#6b5344';
  ctx.fill();
}

/**
 * Draws Hops (Humulus lupulus) twining climbing vine up a vertical trellis twine
 */
function drawHopsPlant(
  ctx: CanvasRenderingContext2D,
  plant: PlantItem,
  sway: number,
  time: number,
  isReady: boolean
) {
  const stage = plant.stage;
  const progress = plant.stageProgress || 0;

  // Trellis twine line reaching up to -78px
  ctx.save();
  ctx.strokeStyle = '#a1a1aa';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 2]);
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(sway * 0.2, -78);
  ctx.stroke();
  ctx.setLineDash([]);

  // Trellis Top Crossbar Wire
  ctx.strokeStyle = '#71717a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-18, -78);
  ctx.lineTo(18, -78);
  ctx.stroke();

  if (stage === 'germination' || stage === 'rooting') {
    // Dormant / waking rhizome shoot
    ctx.strokeStyle = '#84cc16';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.quadraticCurveTo(2, -18, 0, -22);
    ctx.stroke();
    // Shoot tip
    ctx.fillStyle = '#a3e635';
    ctx.beginPath();
    ctx.arc(0, -22, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Bine height based on stage
  let bineHeight = 25;
  if (stage === 'seedling') bineHeight = 25 + (progress / 100) * 12;
  else if (stage === 'mature_seedling') bineHeight = 37 + (progress / 100) * 14;
  else if (stage === 'vegetative') bineHeight = 50 + (progress / 100) * 18;
  else bineHeight = 68; // flowering / ripening / ready

  // Spiral clockwise twining bine
  ctx.strokeStyle = '#4d7c0f';
  ctx.lineWidth = stage === 'flowering' || stage === 'ripening' || stage === 'ready' ? 3.5 : 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -14);

  const turns = Math.floor(bineHeight / 11);
  for (let i = 0; i < turns; i++) {
    const y1 = -14 - i * 11;
    const y2 = -14 - (i + 1) * 11;
    const dir = i % 2 === 0 ? 5 : -5;
    ctx.quadraticCurveTo(dir + sway * 0.3, (y1 + y2) / 2, 0, y2);
  }
  ctx.stroke();

  // Lobed Hop Leaves along nodes
  const nodeCount = Math.floor(bineHeight / 13);
  for (let n = 1; n <= nodeCount; n++) {
    const ny = -14 - n * 13;
    const nSway = (ny / -78) * sway;
    drawHopLeaf(ctx, nSway - 3, ny, -1);
    drawHopLeaf(ctx, nSway + 3, ny, 1);
  }

  // Hop Cones (Strobiles) for flowering & ripening stages
  if (stage === 'flowering' || stage === 'ripening' || stage === 'ready') {
    const coneCount = stage === 'flowering' ? 4 : 8;
    const conePositions = [
      { x: -9, y: -36 },
      { x: 10, y: -44 },
      { x: -11, y: -52 },
      { x: 9, y: -60 },
      { x: -8, y: -66 },
      { x: 8, y: -70 },
      { x: -5, y: -74 },
      { x: 2, y: -76 },
    ];

    for (let c = 0; c < Math.min(coneCount, conePositions.length); c++) {
      const pos = conePositions[c];
      const coneSway = (pos.y / -78) * sway;
      drawHopCone(ctx, pos.x + coneSway, pos.y, stage === 'ripening' || stage === 'ready', time, c);
    }
  }

  ctx.restore();
}

/**
 * Draws a 3-lobed serrated hop leaf
 */
function drawHopLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.fillStyle = '#3f6212';
  
  ctx.beginPath();
  // Central lobe
  ctx.ellipse(7, -1, 6, 3, 0.2, 0, Math.PI * 2);
  // Upper lobe
  ctx.ellipse(5, -3.5, 4.5, 2, -0.4, 0, Math.PI * 2);
  // Lower lobe
  ctx.ellipse(5, 2.5, 4.5, 2, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Stem
  ctx.strokeStyle = '#4d7c0f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(3, 0);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws an authentic papery chartreuse hop cone (strobile) with golden lupulin glands
 */
function drawHopCone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isRipe: boolean,
  time: number,
  seed: number
) {
  ctx.save();
  ctx.translate(x, y);

  // Little stem
  ctx.strokeStyle = '#4d7c0f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(0, 0);
  ctx.stroke();

  // Papery chartreuse bracts (layered cone shape)
  const baseColor = isRipe ? '#84cc16' : '#a3e635';
  const shadowColor = isRipe ? '#65a30d' : '#4d7c0f';

  // Cone body outline
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.ellipse(0, 4, 4.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shadowColor;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Overlapping papery bract scale petals
  ctx.fillStyle = isRipe ? '#bef264' : '#d9f99d';
  for (let r = 0; r < 3; r++) {
    const by = 1.5 + r * 2.5;
    ctx.beginPath();
    ctx.ellipse(-2, by, 2.5, 1.8, -0.2, 0, Math.PI * 2);
    ctx.ellipse(2, by, 2.5, 1.8, 0.2, 0, Math.PI * 2);
    ctx.ellipse(0, by + 1.2, 2.2, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Golden Lupulin gland sparkle (resin glands holding alpha acids!)
  if (isRipe) {
    const lupulinAlpha = (Math.sin(time * 0.007 + seed * 2) + 1) / 2;
    ctx.fillStyle = `rgba(251, 191, 36, ${0.5 + lupulinAlpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(0, 4, 1.4, 0, Math.PI * 2);
    ctx.arc(-1.5, 6, 1.1, 0, Math.PI * 2);
    ctx.arc(1.5, 5, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Sown Seed / Germination
 */
function drawGerminationStage(ctx: CanvasRenderingContext2D, progress: number, time: number) {
  const seedCrack = Math.min(1, progress / 40);
  const sproutHeight = Math.max(0, (progress - 40) / 60) * 12;

  // Seed shell
  ctx.save();
  ctx.translate(0, -15);
  ctx.fillStyle = '#5c4033';
  ctx.beginPath();
  ctx.ellipse(-2, 0, 3.5, 2.5, Math.PI / 6, 0, Math.PI * 2);
  ctx.fill();

  if (seedCrack > 0) {
    ctx.strokeStyle = '#a3e635';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(0, -1);
    ctx.stroke();
  }

  // Emerging green loop / cotyledon arch
  if (sproutHeight > 0) {
    ctx.strokeStyle = '#84cc16';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(2, -sproutHeight * 0.8, 0, -sproutHeight);
    ctx.stroke();

    // Cotyledon seed leaves
    if (progress > 70) {
      ctx.fillStyle = '#a3e635';
      ctx.beginPath();
      ctx.ellipse(-2, -sproutHeight, 2.5, 1.5, -0.4, 0, Math.PI * 2);
      ctx.ellipse(2, -sproutHeight, 2.5, 1.5, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Cutting in rockwool / peat plug under humidity dome
 */
function drawRootingCuttingStage(ctx: CanvasRenderingContext2D, progress: number, time: number) {
  // Humidity dome outline
  ctx.save();
  ctx.beginPath();
  ctx.rect(-14, -40, 28, 25);
  ctx.fillStyle = 'rgba(224, 242, 254, 0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Dome condensation droplets
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(-8, -32, 1, 0, Math.PI * 2);
  ctx.arc(6, -26, 1.2, 0, Math.PI * 2);
  ctx.arc(-4, -20, 1, 0, Math.PI * 2);
  ctx.fill();

  // Root plug
  ctx.fillStyle = '#451a03';
  ctx.fillRect(-6, -18, 12, 6);

  // Clone cutting stem
  ctx.strokeStyle = '#65a30d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(0, -28);
  ctx.stroke();

  // 2 Clipped clone leaves (tips cut off to reduce transpiration!)
  ctx.fillStyle = '#4d7c0f';
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(-8, -32);
  ctx.lineTo(-6, -34);
  ctx.lineTo(0, -28);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(8, -32);
  ctx.lineTo(6, -34);
  ctx.lineTo(0, -28);
  ctx.closePath();
  ctx.fill();

  // White adventitious root primordia poking from base if progress > 50%
  if (progress > 50) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, -13);
    ctx.lineTo(-5, -11);
    ctx.moveTo(2, -13);
    ctx.lineTo(5, -11);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Early Seedling
 */
function drawSeedlingStage(ctx: CanvasRenderingContext2D, progress: number, sway: number) {
  const height = 16 + (progress / 100) * 8;

  // Tender green stalk
  ctx.strokeStyle = '#65a30d';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.quadraticCurveTo(sway * 0.3, -14 - height * 0.5, sway * 0.6, -14 - height);
  ctx.stroke();

  const tipX = sway * 0.6;
  const tipY = -14 - height;

  // Cotyledons (smooth baby leaves)
  ctx.fillStyle = '#84cc16';
  ctx.beginPath();
  ctx.ellipse(tipX - 5, tipY + 4, 4, 2.5, -0.3, 0, Math.PI * 2);
  ctx.ellipse(tipX + 5, tipY + 4, 4, 2.5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // First true serrated fan leaf pair
  ctx.fillStyle = '#4d7c0f';
  ctx.beginPath();
  ctx.ellipse(tipX - 7, tipY, 6, 3, -0.4, 0, Math.PI * 2);
  ctx.ellipse(tipX + 7, tipY, 6, 3, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Center growing tip
  ctx.fillStyle = '#a3e635';
  ctx.beginPath();
  ctx.arc(tipX, tipY - 2, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Mature Seedling (Multiple nodes)
 */
function drawMatureSeedlingStage(ctx: CanvasRenderingContext2D, progress: number, sway: number, species: string) {
  const height = 26 + (progress / 100) * 10;

  // Sturdy Stalk
  ctx.strokeStyle = '#4d7c0f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.quadraticCurveTo(sway * 0.4, -14 - height * 0.5, sway * 0.8, -14 - height);
  ctx.stroke();

  // Tier 1 Branching Node
  drawFanLeafPair(ctx, sway * 0.3, -14 - height * 0.4, 12, '#3f6212', -0.3);

  // Tier 2 Node
  drawFanLeafPair(ctx, sway * 0.6, -14 - height * 0.7, 14, '#4d7c0f', -0.1);

  // Crown foliage
  const topX = sway * 0.8;
  const topY = -14 - height;
  ctx.fillStyle = '#65a30d';
  ctx.beginPath();
  ctx.ellipse(topX - 6, topY - 2, 8, 4, -0.5, 0, Math.PI * 2);
  ctx.ellipse(topX + 6, topY - 2, 8, 4, 0.5, 0, Math.PI * 2);
  ctx.ellipse(topX, topY - 5, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Full Vegetative Bushy Canopy
 */
function drawVegetativeStage(ctx: CanvasRenderingContext2D, progress: number, sway: number, species: string) {
  const height = 36 + (progress / 100) * 12;

  // Thick woody stalk
  ctx.strokeStyle = '#3f6212';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.quadraticCurveTo(sway * 0.4, -14 - height * 0.5, sway * 0.8, -14 - height);
  ctx.stroke();

  // Tiered lateral branches
  drawFanLeafPair(ctx, sway * 0.2, -14 - height * 0.25, 18, '#365314', -0.4);
  drawFanLeafPair(ctx, sway * 0.4, -14 - height * 0.5, 22, '#3f6212', -0.2);
  drawFanLeafPair(ctx, sway * 0.6, -14 - height * 0.75, 20, '#4d7c0f', -0.1);

  // Top lush canopy cluster
  const topX = sway * 0.8;
  const topY = -14 - height;
  ctx.fillStyle = '#4d7c0f';
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    const lx = topX + Math.cos(angle) * 10;
    const ly = topY + Math.sin(angle) * 7;
    ctx.beginPath();
    ctx.ellipse(lx, ly, 9, 5, angle, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Flowering Stage: Buds, white pistils, trichome frost
 */
function drawFloweringStage(
  ctx: CanvasRenderingContext2D,
  progress: number,
  sway: number,
  species: string,
  time: number
) {
  const height = 46;

  // Stalk
  ctx.strokeStyle = '#365314';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.quadraticCurveTo(sway * 0.4, -14 - height * 0.5, sway * 0.8, -14 - height);
  ctx.stroke();

  // Lower support fan leaves
  drawFanLeafPair(ctx, sway * 0.2, -14 - height * 0.3, 19, '#365314', -0.3);
  drawFanLeafPair(ctx, sway * 0.5, -14 - height * 0.6, 17, '#3f6212', -0.2);

  // Lateral Bud Colas
  const budSize = 6 + (progress / 100) * 6;
  drawColaCluster(ctx, sway * 0.3 - 10, -14 - height * 0.5, budSize * 0.85, species, time);
  drawColaCluster(ctx, sway * 0.5 + 10, -14 - height * 0.65, budSize * 0.85, species, time);

  // Main Central Crown Cola
  const topX = sway * 0.8;
  const topY = -14 - height;
  drawColaCluster(ctx, topX, topY - 4, budSize * 1.3, species, time);
}

/**
 * Ripening / Harvest Ready: Swollen trichome-laden colas with autumn fade
 */
function drawRipeningStage(
  ctx: CanvasRenderingContext2D,
  progress: number,
  sway: number,
  species: string,
  time: number,
  isReady: boolean
) {
  const height = 48;

  // Stalk
  ctx.strokeStyle = '#27380f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.quadraticCurveTo(sway * 0.3, -14 - height * 0.5, sway * 0.6, -14 - height);
  ctx.stroke();

  // Autumn fading foliage (purples / yellows)
  drawFanLeafPair(ctx, sway * 0.2, -14 - height * 0.3, 18, '#854d0e', -0.3);
  drawFanLeafPair(ctx, sway * 0.4, -14 - height * 0.55, 16, '#581c87', -0.2);

  // Massive Swollen Calyx Colas
  const budSize = 13;
  drawColaCluster(ctx, sway * 0.3 - 12, -14 - height * 0.48, budSize * 0.9, species, time, true);
  drawColaCluster(ctx, sway * 0.4 + 12, -14 - height * 0.6, budSize * 0.9, species, time, true);

  // Huge Main Crown Spear Cola
  const topX = sway * 0.6;
  const topY = -14 - height;
  drawColaCluster(ctx, topX, topY - 6, budSize * 1.4, species, time, true);
}

/**
 * Helper to render authentic serrated fan leaves
 */
function drawFanLeafPair(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  length: number,
  color: string,
  tilt: number
) {
  ctx.fillStyle = color;
  // Left leaf
  ctx.beginPath();
  ctx.ellipse(cx - length * 0.5, cy, length * 0.5, length * 0.22, -0.3 + tilt, 0, Math.PI * 2);
  ctx.fill();

  // Right leaf
  ctx.beginPath();
  ctx.ellipse(cx + length * 0.5, cy, length * 0.5, length * 0.22, 0.3 + tilt, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Helper to render flowering bud colas with pistils and trichome sparkle
 */
function drawColaCluster(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  species: string,
  time: number,
  isRipe: boolean = false
) {
  ctx.save();
  ctx.translate(x, y);

  if (species === 'Tomato') {
    // Red / orange ripening cherry tomatoes
    ctx.fillStyle = isRipe ? '#dc2626' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
    ctx.arc(-4, 4, size * 0.6, 0, Math.PI * 2);
    ctx.arc(4, 3, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
    // Green tomato cap
    ctx.fillStyle = '#4d7c0f';
    ctx.beginPath();
    ctx.arc(0, -size * 0.7, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Cannabis / Botanical dense bud formation
  ctx.fillStyle = isRipe ? '#2d5a27' : '#3f6212';
  // Central bud mass
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.9, size * 1.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Surrounding calyxes
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const bx = Math.cos(ang) * (size * 0.5);
    const by = Math.sin(ang) * (size * 0.7);
    ctx.beginPath();
    ctx.ellipse(bx, by, size * 0.45, size * 0.45, ang, 0, Math.PI * 2);
    ctx.fill();
  }

  // White / orange pistils (hairs)
  ctx.strokeStyle = isRipe ? '#d97706' : '#fef08a';
  ctx.lineWidth = 1.1;
  for (let j = 0; j < 6; j++) {
    const ang = (j / 6) * Math.PI * 2 + 0.2;
    const px = Math.cos(ang) * (size * 0.7);
    const py = Math.sin(ang) * (size * 0.9);
    ctx.beginPath();
    ctx.moveTo(px * 0.6, py * 0.6);
    ctx.lineTo(px * 1.2, py * 1.2);
    ctx.stroke();
  }

  // Glistening Trichome Shimmer (animated twinkle particles)
  if (isRipe || size > 9) {
    const sparkleCount = isRipe ? 5 : 2;
    for (let k = 0; k < sparkleCount; k++) {
      const sparkleAlpha = (Math.sin(time * 0.008 + k * 1.5) + 1) / 2;
      ctx.fillStyle = `rgba(255, 255, 255, ${sparkleAlpha * 0.9})`;
      const sx = ((k * 37) % 17) - 8;
      const sy = ((k * 43) % 21) - 10;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Draws a mushroom container and fruiting block (Lion's Mane, Oyster, etc.)
 */
export function drawMushroom(shroom: MushroomItem, options: RenderPlantOptions) {
  const { ctx, x, y, scale = 1, time = 0, highlighted = false, bodyOnly = false } = options;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const isReady = shroom.stage === 'ready' || shroom.stage === 'mature';

  // Substrate Block / Monotub container
  if (!bodyOnly) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grow bag / Monotub
  ctx.fillStyle = '#27272a';
  ctx.fillRect(-16, -12, 32, 16);
  ctx.strokeStyle = '#52525b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-16, -12, 32, 16);

  // Sawdust/Grain Substrate Surface
  ctx.fillStyle = '#3f2e1e';
  ctx.fillRect(-14, -10, 28, 5);

  // Mycelium Colonization Layer (dense white threads)
  const colPercent = (shroom.myceliumColonization || 80) / 100;
  ctx.fillStyle = `rgba(244, 244, 245, ${colPercent * 0.95})`;
  ctx.beginPath();
  ctx.ellipse(0, -8, 13 * colPercent, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fungal Stage Growth
  if (shroom.stage === 'colonizing') {
    // Thread-like mycelial hyphae
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    for (let i = -10; i <= 10; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, -8);
      ctx.lineTo(i + 2, -12);
      ctx.stroke();
    }
  } else if (shroom.stage === 'pinning') {
    // Tiny primordia buttons
    ctx.fillStyle = '#ffffff';
    for (let i = -10; i <= 10; i += 4) {
      ctx.beginPath();
      ctx.arc(i, -11, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (shroom.stage === 'fruiting') {
    // Expanding caps
    drawMushroomCaps(ctx, shroom.species, 12, time, false);
  } else if (shroom.stage === 'mature' || shroom.stage === 'ready') {
    // Massive blooming caps with spore halo
    drawMushroomCaps(ctx, shroom.species, 20, time, true);
  }

  // Harvest Bobbing Shears
  if (isReady && !bodyOnly) {
    const bob = Math.sin(time * 0.006) * 3;
    ctx.save();
    ctx.translate(0, -36 + bob);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✂', 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Helper to render authentic species caps (Lion's Mane icicles vs Oyster fan clusters)
 */
function drawMushroomCaps(
  ctx: CanvasRenderingContext2D,
  species: string,
  size: number,
  time: number,
  isMature: boolean
) {
  if (species === "Lion's Mane") {
    // Cascading white icicle pom-pom
    ctx.fillStyle = '#fafaf9';
    ctx.beginPath();
    ctx.ellipse(0, -18, size * 0.9, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cascading tooth spines
    ctx.strokeStyle = '#f5f5f4';
    ctx.lineWidth = 1.2;
    for (let s = -size * 0.7; s <= size * 0.7; s += 2.5) {
      const len = 4 + Math.sin(s) * 3;
      ctx.beginPath();
      ctx.moveTo(s, -12);
      ctx.lineTo(s, -12 + len);
      ctx.stroke();
    }
  } else {
    // Oyster / Shiitake tiered clusters
    const capColor = species === 'Golden Oyster' ? '#eab308' : '#78716c';
    ctx.fillStyle = capColor;

    // Left cluster
    ctx.beginPath();
    ctx.ellipse(-8, -16, size * 0.5, size * 0.35, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Right cluster
    ctx.beginPath();
    ctx.ellipse(8, -18, size * 0.6, size * 0.4, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Center main cap
    ctx.beginPath();
    ctx.ellipse(0, -23, size * 0.8, size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d6d3d1';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Spore cloud drift animation
  if (isMature) {
    const sporeAlpha = (Math.sin(time * 0.004) + 1) / 4;
    ctx.fillStyle = `rgba(255, 255, 255, ${sporeAlpha})`;
    for (let sp = 0; sp < 4; sp++) {
      const sx = Math.sin(time * 0.002 + sp) * 12;
      const sy = -28 - ((time * 0.02 + sp * 8) % 15);
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draws a mushroom container + fruit bodies at true scale (shroom.dimensions), standing on (x, y).
 */
export function drawMushroomToScale(shroom: MushroomItem, options: RenderPlantOptions) {
  const { ctx, x, y, time = 0 } = options;
  const heightPx = Math.max(3, feetToVerticalPx(shroom.dimensions.height));
  const colonizationBucket = Math.round((shroom.myceliumColonization || 80) / 10);

  drawSpriteToScale(ctx, {
    key: `shroom|${shroom.species}|${shroom.stage}|${Math.round(shroom.stageProgress || 0)}|${colonizationBucket}`,
    draw: c => drawMushroom(shroom, { ctx: c, x: 0, y: 0, time, bodyOnly: true }),
    measure: c => drawMushroom(shroom, { ctx: c, x: 0, y: 0, time: 0, bodyOnly: true }),
    anchorX: x,
    anchorY: y,
    widthPx: feetToPx(shroom.dimensions.length),
    heightPx
  });

  if (shroom.stage === 'ready' || shroom.stage === 'mature') {
    const bob = Math.sin(time * 0.006) * 3;
    ctx.save();
    ctx.translate(x, y - heightPx - 12 + bob);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✂', 0, 0);
    ctx.restore();
  }
}
