// Shared glTF helpers for the asset build scripts (build-characters.mjs, build-equipment.mjs).
// No npm dependencies: glTF is repacked by hand and textures are resized with Windows' System.Drawing (PowerShell).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
export const TYPE_SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

// ---------- reading ----------

export function loadGltf(file) {
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
export function accessorBytes(g, index) {
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

export function accessorFloats(g, index) {
  const bytes = accessorBytes(g, index);
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

// ---------- writing ----------

export class GlbWriter {
  constructor() {
    this.json = { asset: { version: '2.0', generator: 'sprout-spore asset build' }, buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [] };
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
/** Resize an image to a square JPEG (or PNG when it has alpha) with System.Drawing. */
export function resizeTexture(src, size, { grayscale = false, keepPng = false } = {}) {
  const key = `${src}|${size}|${grayscale}|${keepPng}`;
  if (resizeCache.has(key)) return resizeCache.get(key);
  const out = path.join(os.tmpdir(), `ss-asset-${resizeCache.size}-${path.basename(src, path.extname(src))}.${keepPng ? 'png' : 'jpg'}`);
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
