// Builds the game's equipment and building models from Poly Haven CC0 downloads.
//
//   node scripts/build-equipment.mjs
//
// Input: Poly Haven 1K glTF downloads, one folder per asset, under assets-src/polyhaven/<asset>/
// (see public/models/equipment/CREDITS.md). Output: one small GLB per model in public/models/equipment/.
// Only the nodes the game uses are kept, textures are downsized to JPEG, and vendor material extensions are
// replaced with plain metal/rough settings three.js renders cheaply. No npm dependencies.

import fs from 'node:fs';
import path from 'node:path';
import { buildModel } from './gltf-build.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.join(ROOT, 'assets-src', 'polyhaven');
const OUT = path.join(ROOT, 'public', 'models', 'equipment');

/**
 * out: output file; asset: Poly Haven id; nodes: node names to keep;
 * keepPlacement: keep each node's own transform (parts placed relative to each other),
 * otherwise every node is moved to the origin so the game can pick one by name.
 */
const MODELS = [
  { out: 'reservoir_tote.glb', asset: 'plastic_container', nodes: ['plastic_container'], tex: 512 },
  {
    out: 'inline_fan.glb',
    asset: 'modular_airduct_circular_01',
    nodes: ['modular_airduct_circular_fan', 'modular_airduct_circular_single', 'modular_airduct_circular_smooth_single'],
    tex: 512,
  },
  { out: 'light_fluorescent.glb', asset: 'mounted_fluorescent_lights', nodes: ['mounted_fluorescent_lights_d'], tex: 512 },
  { out: 'light_pendant.glb', asset: 'hanging_industrial_lamp', nodes: ['hanging_industrial_lamp'], tex: 512 },
  { out: 'caged_light.glb', asset: 'caged_hanging_light', nodes: ['caged_hanging_light'], tex: 512 },
  { out: 'breaker_panel.glb', asset: 'power_box_01', nodes: ['power_box_01_box', 'power_box_01_door'], tex: 512, keepPlacement: true },
  { out: 'rollershutter_door.glb', asset: 'rollershutter_door', nodes: ['rollershutter_door'], tex: 512 },
];

fs.mkdirSync(OUT, { recursive: true });
for (const spec of MODELS) buildModel(spec, SRC, OUT);
