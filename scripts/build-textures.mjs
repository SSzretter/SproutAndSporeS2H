// Builds the game's wall, floor and ceiling textures from Poly Haven CC0 downloads.
//
//   node scripts/build-textures.mjs
//
// Input: each texture's 1K JPGs (diff, nor_gl, arm) under assets-src/polyhaven-tex/<asset>/ as diff.jpg,
// nor_gl.jpg and arm.jpg (see public/textures/CREDITS.md).
// Output: public/textures/<asset>/color.jpg (1024 px), normal.jpg and arm.jpg (512 px).
// Windows-only, like the other asset scripts: textures are resized with PowerShell (see gltf-tools.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { resizeTexture } from './gltf-tools.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.join(ROOT, 'assets-src', 'polyhaven-tex');
const OUT = path.join(ROOT, 'public', 'textures');

const ASSETS = ['concrete_block_wall', 'plaster_grey_04', 'concrete_floor_worn_001', 'laminate_floor_02', 'ceiling_interior', 'gravel_embedded_concrete_02'];
const MAPS = [
  { src: 'diff.jpg', out: 'color.jpg', size: 1024 },
  { src: 'nor_gl.jpg', out: 'normal.jpg', size: 512 },
  { src: 'arm.jpg', out: 'arm.jpg', size: 512 },
];

for (const asset of ASSETS) {
  const dir = path.join(OUT, asset);
  fs.mkdirSync(dir, { recursive: true });
  let total = 0;
  for (const m of MAPS) {
    const src = path.join(SRC, asset, m.src);
    if (!fs.existsSync(src)) throw new Error(`Missing ${src}; download the 1K JPGs of ${asset} first`);
    const { bytes } = resizeTexture(src, m.size);
    fs.writeFileSync(path.join(dir, m.out), bytes);
    total += bytes.length;
  }
  console.log(`${asset.padEnd(30)} ${(total / 1024).toFixed(0)} KB`);
}
