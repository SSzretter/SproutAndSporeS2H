// Builds the outdoor garden's plants, rocks and props from Poly Haven CC0 downloads.
//
//   node scripts/build-outdoor.mjs
//
// Input: Poly Haven 1K glTF downloads under assets-src/polyhaven/<asset>/, plus each foliage asset's 1K Alpha map
// saved as textures/<asset>_alpha_1k.jpg (the glTF bundle leaves it out). See public/models/outdoor/CREDITS.md.
// Output: one GLB per model in public/models/outdoor/. Windows-only, like the other asset scripts.

import fs from 'node:fs';
import path from 'node:path';
import { buildModel } from './gltf-build.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.join(ROOT, 'assets-src', 'polyhaven');
const OUT = path.join(ROOT, 'public', 'models', 'outdoor');

// Foliage keeps only its lighter variants: grass and weeds are drawn hundreds of times.
const MODELS = [
  {
    out: 'grass_tufts.glb',
    asset: 'grass_medium_01',
    nodes: ['grass_medium_01_tall_a_LOD0', 'grass_medium_01_tall_b_LOD0', 'grass_medium_01_tall_c_LOD0', 'grass_medium_01_small_b_LOD0', 'grass_medium_01_mid_b_LOD0'],
    tex: 512,
  },
  {
    out: 'grass_sprigs.glb',
    asset: 'grass_bermuda_01',
    nodes: ['grass_bermuda_01_seedling_a', 'grass_bermuda_01_seedling_d', 'grass_bermuda_01_medium_c', 'grass_bermuda_01_medium_e', 'grass_bermuda_01_medium_f'],
    tex: 256,
    cutout: true,
  },
  { out: 'fern.glb', asset: 'fern_02', nodes: ['fern_02_a', 'fern_02_d', 'fern_02_c'], tex: 512 },
  { out: 'dandelion.glb', asset: 'dandelion_01', nodes: ['dandelion_01_c_LOD0', 'dandelion_01_d_LOD0', 'dandelion_01_e_LOD0'], tex: 256 },
  { out: 'shrub.glb', asset: 'shrub_04', nodes: ['shrub_04'], tex: 512 },
  { out: 'tree_stump.glb', asset: 'tree_stump_01', nodes: ['tree_stump_01'], tex: 512 },
  { out: 'boulder.glb', asset: 'boulder_01', nodes: ['boulder_01'], tex: 512 },
  { out: 'planter_box.glb', asset: 'planter_box_01', nodes: ['planter_box_01'], tex: 512 },
  {
    out: 'sprinkler.glb',
    asset: 'garden_sprinkler_01',
    nodes: ['garden_sprinkler_01_body_main', 'garden_sprinkler_01_wheels', 'garden_sprinkler_01_spinner', 'garden_sprinkler_01_nozel_left', 'garden_sprinkler_01_nozel_right'],
    tex: 256,
    keepPlacement: true,
  },
  { out: 'hose_reel.glb', asset: 'garden_hose_wall_mounted_01', nodes: ['garden_hose_wall_bracket', 'garden_hose'], tex: 512, keepPlacement: true },
  { out: 'watering_can.glb', asset: 'watering_can_metal_01', nodes: ['watering_can_metal_01'], tex: 256 },
];

fs.mkdirSync(OUT, { recursive: true });
for (const spec of MODELS) buildModel(spec, SRC, OUT);
