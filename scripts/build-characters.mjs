// Builds the game's character assets from the Quaternius CC0 packs.
//
//   node scripts/build-characters.mjs
//
// Input: the three "[Standard]" zips unpacked under assets-src/quaternius/x/ (see public/models/characters/CREDITS.md).
// Output (public/models/characters/):
//   quaternius_male.glb / quaternius_female.glb  body + eyes + eyebrows + that body's hairstyles on one skeleton,
//                                                 base-colour textures only, downsized to JPEG
//   quaternius_anims.glb                          skeleton + the clips the game uses (rotation tracks, plus pelvis
//                                                 translation), constant tracks collapsed to one key
// No npm dependencies; the shared glTF and texture helpers live in gltf-tools.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { loadGltf, accessorBytes, accessorFloats, GlbWriter, resizeTexture } from './gltf-tools.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.join(ROOT, 'assets-src', 'quaternius', 'x');
const UBC = path.join(SRC, 'ubc', 'Universal Base Characters[Standard]');
const OUT = path.join(ROOT, 'public', 'models', 'characters');

const BODIES = {
  male: {
    gltf: path.join(UBC, 'Base Characters', 'Godot - UE', 'Superhero_Male_FullBody.gltf'),
    skinTexture: path.join(UBC, 'Base Characters', 'Textures', 'T_Superhero_Male_Ligh.png'),
    hair: ['Hair_SimpleParted', 'Hair_Buzzed', 'Hair_Beard'],
  },
  female: {
    gltf: path.join(UBC, 'Base Characters', 'Godot - UE', 'Superhero_Female_FullBody.gltf'),
    skinTexture: path.join(UBC, 'Base Characters', 'Textures', 'T_Superhero_Female_Light_BaseColor.png'),
    hair: ['Hair_Long', 'Hair_Buns', 'Hair_BuzzedFemale'],
  },
};
const HAIR_DIR = path.join(UBC, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)');
const HAIR_TEXTURE = path.join(UBC, 'Base Characters', 'Textures', 'T_Hair_2_BaseColor.png');
const BROW_TEXTURE = path.join(UBC, 'Base Characters', 'Textures', 'T_Hair_1_BaseColor.png');
const EYE_TEXTURE = path.join(UBC, 'Base Characters', 'Textures', 'T_Eye_Brown.png');

const ANIM_SOURCES = [
  {
    file: path.join(SRC, 'ual1', 'Universal Animation Library[Standard]', 'Unreal-Godot', 'UAL1_Standard.glb'),
    clips: ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Idle_Talking_Loop', 'Interact', 'PickUp_Table', 'Fixing_Kneeling', 'Sitting_Idle_Loop', 'Crouch_Idle_Loop'],
  },
  {
    file: path.join(SRC, 'ual2', 'Universal Animation Library 2[Standard]', 'Unreal-Godot', 'UAL2_Standard.glb'),
    clips: ['Farm_Watering', 'Farm_Harvest', 'Farm_PlantSeed', 'Idle_FoldArms_Loop', 'Consume', 'Walk_Carry_Loop', 'Idle_TalkingPhone_Loop', 'Yes'],
  },
];

const KEEP_ATTRIBUTES = ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'];

// ---------- bodies ----------

function copyPrimitive(w, g, prim, jointRemap) {
  const attributes = {};
  for (const name of KEEP_ATTRIBUTES) {
    if (prim.attributes[name] === undefined) continue;
    if (name === 'JOINTS_0' && jointRemap) {
      const a = g.json.accessors[prim.attributes[name]];
      const bytes = accessorBytes(g, prim.attributes[name]);
      const arr = a.componentType === 5121 ? new Uint8Array(bytes) : new Uint16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      for (let i = 0; i < arr.length; i++) arr[i] = jointRemap[arr[i]];
      w.json.accessors.push({ bufferView: w.view(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength), 34962), componentType: a.componentType, count: a.count, type: a.type });
      attributes[name] = w.json.accessors.length - 1;
      continue;
    }
    attributes[name] = w.copyAccessor(g, prim.attributes[name], 34962);
  }
  const out = { attributes };
  if (prim.indices !== undefined) out.indices = w.copyAccessor(g, prim.indices, 34963);
  return out;
}

function buildBody(sex) {
  const spec = BODIES[sex];
  const g = loadGltf(spec.gltf);
  const w = new GlbWriter();

  const skinTex = resizeTexture(spec.skinTexture, 1024);
  const hairTex = resizeTexture(HAIR_TEXTURE, 512, { grayscale: true });
  const browTex = resizeTexture(BROW_TEXTURE, 256, { grayscale: true });
  const eyeTex = resizeTexture(EYE_TEXTURE, 256, { keepPng: true });
  const tex = {
    skin: w.image(skinTex.bytes, skinTex.mimeType, 'skin'),
    hair: w.image(hairTex.bytes, hairTex.mimeType, 'hair'),
    brow: w.image(browTex.bytes, browTex.mimeType, 'brow'),
    eye: w.image(eyeTex.bytes, eyeTex.mimeType, 'eye'),
  };
  const material = (name, texture, roughness) => ({ name, pbrMetallicRoughness: { baseColorTexture: { index: texture }, metallicFactor: 0, roughnessFactor: roughness } });
  w.json.materials = [material('Skin', tex.skin, 0.62), material('Eyes', tex.eye, 0.3), material('Brows', tex.brow, 0.85), material('Hair', tex.hair, 0.75)];
  const materialFor = srcName => (/eye/i.test(srcName) ? 1 : /hair_1/i.test(srcName) ? 2 : /hair/i.test(srcName) ? 3 : 0);

  // Nodes: same hierarchy and bone transforms as the source.
  w.json.nodes = g.json.nodes.map(n => {
    const out = { name: n.name };
    for (const k of ['translation', 'rotation', 'scale', 'children', 'skin']) if (n[k] !== undefined) out[k] = n[k];
    return out;
  });
  w.json.meshes = [];
  g.json.nodes.forEach((n, i) => {
    if (n.mesh === undefined) return;
    const mesh = g.json.meshes[n.mesh];
    w.json.meshes.push({ name: n.name, primitives: mesh.primitives.map(p => ({ ...copyPrimitive(w, g, p), material: materialFor(g.json.materials[p.material]?.name || '') })) });
    w.json.nodes[i].mesh = w.json.meshes.length - 1;
  });

  const srcSkin = g.json.skins[0];
  w.json.skins = [{ joints: srcSkin.joints, inverseBindMatrices: w.copyAccessor(g, srcSkin.inverseBindMatrices), ...(srcSkin.skeleton !== undefined ? { skeleton: srcSkin.skeleton } : {}) }];
  const jointNames = srcSkin.joints.map(j => g.json.nodes[j].name);

  // Hairstyles: same joint order by name, positions already in this body's bind space.
  const bodyMeshNodeIndex = g.json.nodes.findIndex(n => n.mesh !== undefined && n.skin !== undefined);
  const parent = w.json.nodes.find(n => n.children?.includes(bodyMeshNodeIndex));
  const parentList = parent ? parent.children : (w.json.scenes = [{ nodes: [...(g.json.scenes[0].nodes)] }], w.json.scenes[0].nodes);
  for (const style of spec.hair) {
    const h = loadGltf(path.join(HAIR_DIR, `${style}.gltf`));
    const hSkin = h.json.skins[0];
    const remap = hSkin.joints.map(j => {
      const idx = jointNames.indexOf(h.json.nodes[j].name);
      if (idx < 0) throw new Error(`${style}: joint ${h.json.nodes[j].name} missing from ${sex} skeleton`);
      return idx;
    });
    const hMeshNode = h.json.nodes.find(n => n.mesh !== undefined);
    const hMesh = h.json.meshes[hMeshNode.mesh];
    w.json.meshes.push({ name: style, primitives: hMesh.primitives.map(p => ({ ...copyPrimitive(w, h, p, remap), material: 3 })) });
    w.json.nodes.push({ name: style, mesh: w.json.meshes.length - 1, skin: 0 });
    parentList.push(w.json.nodes.length - 1);
  }
  if (!w.json.scenes) w.json.scenes = [{ nodes: g.json.scenes[0].nodes }];
  w.json.scene = 0;

  const pelvis = g.json.nodes.find(n => n.name === 'pelvis');
  w.json.extras = { pelvisRest: pelvis.translation, hairStyles: spec.hair, source: 'Quaternius Universal Base Characters [Standard], CC0 1.0' };
  const size = w.write(path.join(OUT, `quaternius_${sex}.glb`));
  console.log(`quaternius_${sex}.glb`, (size / 1024).toFixed(0), 'KB');
}

// ---------- animations ----------

function buildAnims() {
  const w = new GlbWriter();
  let nodesBuilt = false;
  const nodeIndexByName = new Map();
  w.json.animations = [];
  let pelvisRest = null;

  for (const src of ANIM_SOURCES) {
    const g = loadGltf(src.file);
    if (!nodesBuilt) {
      // Skeleton only: every node that isn't a mesh, same hierarchy.
      const keep = g.json.nodes.map((n, i) => (n.mesh === undefined ? i : -1)).filter(i => i >= 0);
      const remap = new Map(keep.map((src, dst) => [src, dst]));
      w.json.nodes = keep.map(i => {
        const n = g.json.nodes[i];
        const out = { name: n.name };
        for (const k of ['translation', 'rotation', 'scale']) if (n[k] !== undefined) out[k] = n[k];
        const children = (n.children || []).filter(c => remap.has(c)).map(c => remap.get(c));
        if (children.length) out.children = children;
        return out;
      });
      w.json.nodes.forEach((n, i) => nodeIndexByName.set(n.name, i));
      w.json.scenes = [{ nodes: g.json.scenes[0].nodes.filter(i => remap.has(i)).map(i => remap.get(i)) }];
      w.json.scene = 0;
      pelvisRest = g.json.nodes.find(n => n.name === 'pelvis').translation;
      nodesBuilt = true;
    }
    for (const clipName of src.clips) {
      const anim = g.json.animations.find(a => a.name === clipName);
      if (!anim) throw new Error(`clip ${clipName} not found in ${path.basename(src.file)}`);
      const out = { name: clipName, samplers: [], channels: [] };
      const inputCache = new Map();
      for (const ch of anim.channels) {
        const nodeName = g.json.nodes[ch.target.node].name;
        if (/_leaf_/.test(nodeName)) continue;
        const keep = ch.target.path === 'rotation' || (ch.target.path === 'translation' && nodeName === 'pelvis');
        if (!keep) continue;
        const s = anim.samplers[ch.sampler];
        const times = accessorFloats(g, s.input);
        const values = accessorFloats(g, s.output);
        const n = ch.target.path === 'rotation' ? 4 : 3;
        // Collapse tracks that never change to one key.
        let constant = true;
        for (let i = n; i < values.length && constant; i++) if (Math.abs(values[i] - values[i % n]) > 1e-4) constant = false;
        let input;
        let output;
        if (constant) {
          input = w.floatAccessor(new Float32Array([0]), 'SCALAR', true);
          output = w.floatAccessor(values.slice(0, n), n === 4 ? 'VEC4' : 'VEC3');
        } else {
          if (!inputCache.has(s.input)) inputCache.set(s.input, w.floatAccessor(times, 'SCALAR', true));
          input = inputCache.get(s.input);
          output = w.floatAccessor(values, n === 4 ? 'VEC4' : 'VEC3');
        }
        out.samplers.push({ input, output, interpolation: s.interpolation || 'LINEAR' });
        out.channels.push({ sampler: out.samplers.length - 1, target: { node: nodeIndexByName.get(nodeName), path: ch.target.path } });
      }
      w.json.animations.push(out);
    }
  }
  w.json.extras = { pelvisRest, source: 'Quaternius Universal Animation Library 1 + 2 [Standard], CC0 1.0' };
  const size = w.write(path.join(OUT, 'quaternius_anims.glb'));
  console.log('quaternius_anims.glb', (size / 1024).toFixed(0), 'KB', w.json.animations.map(a => a.name).join(', '));
}

fs.mkdirSync(OUT, { recursive: true });
buildBody('male');
buildBody('female');
buildAnims();
