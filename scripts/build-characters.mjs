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
// No npm dependencies: glTF is repacked by hand and textures are resized with Windows' System.Drawing (PowerShell).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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
const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

// ---------- reading ----------

function loadGltf(file) {
  const raw = fs.readFileSync(file);
  if (file.endsWith('.glb')) {
    const jsonLen = raw.readUInt32LE(12);
    const json = JSON.parse(raw.subarray(20, 20 + jsonLen).toString('utf8'));
    const binStart = 20 + jsonLen + 8;
    const binLen = raw.readUInt32LE(20 + jsonLen);
    return { json, buffers: [raw.subarray(binStart, binStart + binLen)] };
  }
  const json = JSON.parse(raw.toString('utf8'));
  const buffers = (json.buffers || []).map(b => fs.readFileSync(path.join(path.dirname(file), decodeURIComponent(b.uri))));
  return { json, buffers };
}

/** Tightly packed bytes of an accessor (strides removed). */
function accessorBytes(g, index) {
  const a = g.json.accessors[index];
  const bv = g.json.bufferViews[a.bufferView];
  const elemBytes = COMPONENT_BYTES[a.componentType] * TYPE_SIZE[a.type];
  const stride = bv.byteStride || elemBytes;
  const buf = g.buffers[bv.buffer];
  const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const out = Buffer.alloc(elemBytes * a.count);
  for (let i = 0; i < a.count; i++) buf.copy(out, i * elemBytes, start + i * stride, start + i * stride + elemBytes);
  return out;
}

function accessorFloats(g, index) {
  const bytes = accessorBytes(g, index);
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

// ---------- writing ----------

class GlbWriter {
  constructor() {
    this.json = { asset: { version: '2.0', generator: 'sprout-spore build-characters' }, buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [] };
    this.chunks = [];
    this.length = 0;
  }
  view(bytes, target) {
    const pad = (4 - (this.length % 4)) % 4;
    if (pad) { this.chunks.push(Buffer.alloc(pad)); this.length += pad; }
    const view = { buffer: 0, byteOffset: this.length, byteLength: bytes.length };
    if (target) view.target = target;
    this.chunks.push(bytes);
    this.length += bytes.length;
    this.json.bufferViews.push(view);
    return this.json.bufferViews.length - 1;
  }
  /** Copy an accessor from a source glTF, tightly packed. */
  copyAccessor(g, index, target) {
    const a = g.json.accessors[index];
    const out = { ...a, bufferView: this.view(accessorBytes(g, index), target) };
    delete out.byteOffset;
    delete out.sparse;
    this.json.accessors.push(out);
    return this.json.accessors.length - 1;
  }
  floatAccessor(values, type, withBounds) {
    const n = TYPE_SIZE[type];
    const out = { bufferView: this.view(Buffer.from(values.buffer, values.byteOffset, values.byteLength)), componentType: 5126, count: values.length / n, type };
    if (withBounds) {
      out.min = Array.from({ length: n }, (_, c) => { let m = Infinity; for (let i = c; i < values.length; i += n) m = Math.min(m, values[i]); return m; });
      out.max = Array.from({ length: n }, (_, c) => { let m = -Infinity; for (let i = c; i < values.length; i += n) m = Math.max(m, values[i]); return m; });
    }
    this.json.accessors.push(out);
    return this.json.accessors.length - 1;
  }
  image(bytes, mimeType, name) {
    this.json.images = this.json.images || [];
    this.json.images.push({ name, mimeType, bufferView: this.view(bytes) });
    this.json.textures = this.json.textures || [];
    this.json.samplers = this.json.samplers || [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
    this.json.textures.push({ sampler: 0, source: this.json.images.length - 1 });
    return this.json.textures.length - 1;
  }
  write(file) {
    const bin = Buffer.concat(this.chunks);
    const binPadded = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
    this.json.buffers[0].byteLength = binPadded.length;
    let jsonBuf = Buffer.from(JSON.stringify(this.json), 'utf8');
    jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binPadded.length, 8);
    const chunk = (buf, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(buf.length, 0); h.writeUInt32LE(type, 4); return Buffer.concat([h, buf]); };
    fs.writeFileSync(file, Buffer.concat([header, chunk(jsonBuf, 0x4e4f534a), chunk(binPadded, 0x004e4942)]));
    return fs.statSync(file).size;
  }
}

// ---------- textures ----------

const resizeCache = new Map();
/** Resize a PNG to a square JPEG (or PNG when it has alpha) with System.Drawing. */
function resizeTexture(src, size, { grayscale = false, keepPng = false } = {}) {
  const key = `${src}|${size}|${grayscale}|${keepPng}`;
  if (resizeCache.has(key)) return resizeCache.get(key);
  const out = path.join(os.tmpdir(), `ss-char-${resizeCache.size}-${path.basename(src, '.png')}.${keepPng ? 'png' : 'jpg'}`);
  const ps = `
param([string]$src, [string]$dst, [int]$size, [int]$gray, [int]$png)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($src)
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$attr = New-Object System.Drawing.Imaging.ImageAttributes
if ($gray -eq 1) {
  $rows = @(
    [single[]](0.299, 0.299, 0.299, 0, 0),
    [single[]](0.587, 0.587, 0.587, 0, 0),
    [single[]](0.114, 0.114, 0.114, 0, 0),
    [single[]](0, 0, 0, 1, 0),
    [single[]](0, 0, 0, 0, 1))
  $attr.SetColorMatrix((New-Object System.Drawing.Imaging.ColorMatrix(,$rows)))
}
$attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
$g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $size, $size), 0, 0, $img.Width, $img.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
if ($png -eq 1) { $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png) } else {
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $params = New-Object System.Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]85)
  $bmp.Save($dst, $codec, $params)
}
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
`;
  const script = path.join(os.tmpdir(), 'ss-resize-texture.ps1');
  fs.writeFileSync(script, ps);
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, src, out, String(size), grayscale ? '1' : '0', keepPng ? '1' : '0'], { stdio: 'inherit' });
  const result = { bytes: fs.readFileSync(out), mimeType: keepPng ? 'image/png' : 'image/jpeg' };
  resizeCache.set(key, result);
  return result;
}

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
