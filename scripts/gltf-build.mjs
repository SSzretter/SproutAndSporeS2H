// Repacks Poly Haven 1K glTF downloads into small GLBs for the game (used by build-equipment and build-outdoor).
// No npm dependencies; textures go through gltf-tools' PowerShell resizers, so it's Windows-only.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadGltf, GlbWriter, resizeTexture } from './gltf-tools.mjs';

const alphaCache = new Map();
/**
 * A colour map with a separate alpha map folded into its alpha channel, as a square PNG (for cut-out foliage).
 * Uses a small compiled C# helper, since a per-pixel loop in PowerShell is far too slow.
 */
export function mergeAlphaTexture(colorSrc, alphaSrc, size) {
  const key = `${colorSrc}|${alphaSrc}|${size}`;
  if (alphaCache.has(key)) return alphaCache.get(key);
  const out = path.join(os.tmpdir(), `ss-asset-alpha-${alphaCache.size}-${path.basename(colorSrc, path.extname(colorSrc))}.png`);
  const ps = `
param([string]$color, [string]$alpha, [string]$dst, [int]$size)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Drawing2D; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class SsAlphaMerge {
  static Bitmap Fit(string file, int size) {
    var src = Image.FromFile(file); var bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(bmp)) { g.InterpolationMode = InterpolationMode.HighQualityBicubic; g.PixelOffsetMode = PixelOffsetMode.HighQuality; g.DrawImage(src, new Rectangle(0, 0, size, size)); }
    src.Dispose(); return bmp;
  }
  public static void Run(string color, string alpha, string dst, int size) {
    var c = Fit(color, size); var a = Fit(alpha, size); var rect = new Rectangle(0, 0, size, size);
    var cd = c.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb); var ad = a.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    var cb = new byte[cd.Stride * size]; var ab = new byte[ad.Stride * size];
    Marshal.Copy(cd.Scan0, cb, 0, cb.Length); Marshal.Copy(ad.Scan0, ab, 0, ab.Length);
    for (int i = 0; i < cb.Length; i += 4) cb[i + 3] = ab[i + 2]; // BGRA: alpha from the alpha map's red channel
    Marshal.Copy(cb, 0, cd.Scan0, cb.Length); c.UnlockBits(cd); a.UnlockBits(ad);
    c.Save(dst, ImageFormat.Png); c.Dispose(); a.Dispose();
  }
}
"@
[SsAlphaMerge]::Run($color, $alpha, $dst, $size)
`;
  const script = path.join(os.tmpdir(), 'ss-merge-alpha.ps1');
  fs.writeFileSync(script, ps);
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, colorSrc, alphaSrc, out, String(size)], { stdio: 'inherit' });
  const result = { bytes: fs.readFileSync(out), mimeType: 'image/png' };
  alphaCache.set(key, result);
  return result;
}

const KEEP_ATTRIBUTES = ['POSITION', 'NORMAL', 'TEXCOORD_0'];

/**
 * Repack one Poly Haven 1K glTF download (`srcRoot/<asset>/`) into a small GLB in `outDir`.
 * spec: { out, asset, nodes, tex, keepPlacement?, cutout? }
 * - nodes: mesh node names to keep. Without keepPlacement each sits at the origin, so the game picks one by name.
 * - tex: texture size in px. Vendor material extensions are dropped for plain metal/rough settings.
 * - Foliage: when the asset has `textures/*_alpha_1k.jpg` and its material is MASK/BLEND (or `cutout` is set), the
 *   alpha map goes into the colour map's alpha channel (PNG) and the material becomes alpha-tested (MASK), which
 *   needs no depth sorting.
 */
export function buildModel(spec, srcRoot, outDir) {
  const dir = path.join(srcRoot, spec.asset);
  const gltfFile = fs.readdirSync(dir).find(n => n.endsWith('.gltf'));
  if (!gltfFile) throw new Error(`No .gltf in ${dir}; download the 1K glTF of ${spec.asset} first`);
  const g = loadGltf(path.join(dir, gltfFile));
  const w = new GlbWriter();
  w.json.materials = [];
  w.json.meshes = [];
  w.json.nodes = [];

  const texDir = path.join(dir, 'textures');
  const alphaFile = fs.existsSync(texDir) ? fs.readdirSync(texDir).find(n => /_alpha_1k\.jpg$/.test(n)) : undefined;

  const textureFor = new Map(); // source image index (+ cut-out flag) -> output texture index
  const outTexture = (texInfo, opts = {}) => {
    if (!texInfo) return undefined;
    const imageIndex = g.json.textures[texInfo.index].source;
    const key = `${imageIndex}|${opts.cutout ? 1 : 0}`;
    if (!textureFor.has(key)) {
      const uri = decodeURIComponent(g.json.images[imageIndex].uri);
      const img = opts.cutout
        ? mergeAlphaTexture(path.join(dir, uri), path.join(texDir, alphaFile), spec.tex)
        : resizeTexture(path.join(dir, uri), spec.tex);
      textureFor.set(key, w.image(img.bytes, img.mimeType, path.basename(uri, path.extname(uri))));
    }
    return { index: textureFor.get(key) };
  };

  const materialFor = new Map();
  const outMaterial = index => {
    if (materialFor.has(index)) return materialFor.get(index);
    const m = g.json.materials[index];
    const pbr = m.pbrMetallicRoughness || {};
    const cutout = !!alphaFile && (!!spec.cutout || m.alphaMode === 'MASK' || m.alphaMode === 'BLEND');
    const out = { name: m.name, doubleSided: !!m.doubleSided, pbrMetallicRoughness: {} };
    const base = outTexture(pbr.baseColorTexture, { cutout });
    if (base) out.pbrMetallicRoughness.baseColorTexture = base;
    if (pbr.baseColorFactor) out.pbrMetallicRoughness.baseColorFactor = pbr.baseColorFactor;
    if (cutout) {
      out.alphaMode = 'MASK';
      out.alphaCutoff = m.alphaCutoff ?? 0.5;
    }
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
  const size = w.write(path.join(outDir, spec.out));
  console.log(`${spec.out.padEnd(28)} ${String(triangles).padStart(6)} tris  ${(size / 1024).toFixed(0)} KB`);
}
