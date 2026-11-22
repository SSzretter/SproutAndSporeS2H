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
import { loadGltf, GlbWriter, resizeTexture } from './gltf-tools.mjs';

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

const KEEP_ATTRIBUTES = ['POSITION', 'NORMAL', 'TEXCOORD_0'];

function build(spec) {
  const dir = path.join(SRC, spec.asset);
  const gltfFile = fs.readdirSync(dir).find(n => n.endsWith('.gltf'));
  if (!gltfFile) throw new Error(`No .gltf in ${dir}; download the 1K glTF of ${spec.asset} first`);
  const g = loadGltf(path.join(dir, gltfFile));
  const w = new GlbWriter();
  w.json.materials = [];
  w.json.meshes = [];
  w.json.nodes = [];

  const textureFor = new Map(); // source image index -> output texture index
  const outTexture = (texInfo, opts = {}) => {
    if (!texInfo) return undefined;
    const imageIndex = g.json.textures[texInfo.index].source;
    const key = `${imageIndex}`;
    if (!textureFor.has(key)) {
      const uri = decodeURIComponent(g.json.images[imageIndex].uri);
      const img = resizeTexture(path.join(dir, uri), spec.tex, opts);
      textureFor.set(key, w.image(img.bytes, img.mimeType, path.basename(uri, path.extname(uri))));
    }
    return { index: textureFor.get(key) };
  };

  const materialFor = new Map();
  const outMaterial = index => {
    if (materialFor.has(index)) return materialFor.get(index);
    const m = g.json.materials[index];
    const pbr = m.pbrMetallicRoughness || {};
    const out = { name: m.name, doubleSided: !!m.doubleSided, pbrMetallicRoughness: {} };
    const base = outTexture(pbr.baseColorTexture);
    if (base) out.pbrMetallicRoughness.baseColorTexture = base;
    if (pbr.baseColorFactor) out.pbrMetallicRoughness.baseColorFactor = pbr.baseColorFactor;
    const arm = outTexture(pbr.metallicRoughnessTexture);
    if (arm) {
      // Poly Haven ARM: R = ambient occlusion, G = roughness, B = metalness
      out.pbrMetallicRoughness.metallicRoughnessTexture = arm;
      out.occlusionTexture = { index: arm.index };
    }
    if (pbr.metallicFactor !== undefined) out.pbrMetallicRoughness.metallicFactor = pbr.metallicFactor;
    if (pbr.roughnessFactor !== undefined) out.pbrMetallicRoughness.roughnessFactor = pbr.roughnessFactor;
    const normal = outTexture(m.normalTexture);
    if (normal) out.normalTexture = normal;
    const emissive = outTexture(m.emissiveTexture);
    if (emissive) {
      out.emissiveTexture = emissive;
      out.emissiveFactor = [1, 1, 1];
    }
    if (m.extensions?.KHR_materials_transmission) {
      // Glass: plain see-through instead of transmission (an extra render pass)
      out.alphaMode = 'BLEND';
      out.pbrMetallicRoughness.baseColorFactor = [0.9, 0.92, 0.9, 0.3];
      out.pbrMetallicRoughness.metallicFactor = 0;
      out.pbrMetallicRoughness.roughnessFactor = 0.08;
    }
    w.json.materials.push(out);
    materialFor.set(index, w.json.materials.length - 1);
    return w.json.materials.length - 1;
  };

  let triangles = 0;
  for (const name of spec.nodes) {
    const node = g.json.nodes.find(n => n.name === name);
    if (!node || node.mesh === undefined) throw new Error(`${spec.asset}: no mesh node named ${name}`);
    const mesh = g.json.meshes[node.mesh];
    const primitives = mesh.primitives.map(prim => {
      const attributes = {};
      for (const attr of KEEP_ATTRIBUTES) if (prim.attributes[attr] !== undefined) attributes[attr] = w.copyAccessor(g, prim.attributes[attr], 34962);
      triangles += g.json.accessors[prim.indices].count / 3;
      return { attributes, indices: w.copyAccessor(g, prim.indices, 34963), material: outMaterial(prim.material) };
    });
    w.json.meshes.push({ name: mesh.name, primitives });
    const outNode = { name, mesh: w.json.meshes.length - 1 };
    if (spec.keepPlacement) {
      for (const k of ['translation', 'rotation', 'scale']) if (node[k]) outNode[k] = node[k];
    }
    w.json.nodes.push(outNode);
  }
  w.json.scenes = [{ nodes: w.json.nodes.map((_, i) => i) }];
  w.json.scene = 0;
  const size = w.write(path.join(OUT, spec.out));
  console.log(`${spec.out.padEnd(24)} ${String(triangles).padStart(6)} tris  ${(size / 1024).toFixed(0)} KB`);
}

fs.mkdirSync(OUT, { recursive: true });
for (const spec of MODELS) build(spec);
