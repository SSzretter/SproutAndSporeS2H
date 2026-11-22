import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Room, WallSide } from '../../types/sim';
import { createRng, hashString } from '../../utils/rng';
import { itemWorldPosition, tentWorldOrigin } from './coords';
import { AssetSlot } from './AssetModels';
import { useSurfaceMaps, SurfaceKind } from './surfaceTextures';

/**
 * The outdoor garden's surroundings: lawn around the yard, soil under crops, a wood-chip path from the
 * exterior door, scattered grass and weeds, a few props, and simple trees beyond the fence.
 * Plants, rocks and props are Poly Haven CC0 models from public/models/outdoor/ (`npm run build:outdoor`,
 * credits there). Everything is decoration: it never takes clicks, and the layout is seeded by the room's id,
 * so it stays the same between visits and only shifts when crops, tents or gear move.
 */

const M_TO_FT = 3.28084;
const url = (file: string) => `${import.meta.env.BASE_URL}models/outdoor/${file}`;
export const OUTDOOR_URLS = {
  tufts: url('grass_tufts.glb'),
  sprigs: url('grass_sprigs.glb'),
  fern: url('fern.glb'),
  dandelion: url('dandelion.glb'),
  shrub: url('shrub.glb'),
  stump: url('tree_stump.glb'),
  boulder: url('boulder.glb'),
  planter: url('planter_box.glb'),
  sprinkler: url('sprinkler.glb'),
  hoseReel: url('hose_reel.glb'),
  wateringCan: url('watering_can.glb'),
} as const;

const TUFTS = ['grass_medium_01_tall_a_LOD0', 'grass_medium_01_tall_b_LOD0', 'grass_medium_01_tall_c_LOD0', 'grass_medium_01_small_b_LOD0', 'grass_medium_01_mid_b_LOD0'];
const SPRIGS = ['grass_bermuda_01_seedling_a', 'grass_bermuda_01_seedling_d', 'grass_bermuda_01_medium_c', 'grass_bermuda_01_medium_e', 'grass_bermuda_01_medium_f'];
const FERNS = ['fern_02_a', 'fern_02_d', 'fern_02_c'];
const DANDELIONS = ['dandelion_01_c_LOD0', 'dandelion_01_d_LOD0', 'dandelion_01_e_LOD0'];

/** How far beyond the fence the lawn, scatter and trees reach (ft). */
const YARD_MARGIN = 40;
const DOOR_HALF_WIDTH = 1.5;

type Rect = { x0: number; z0: number; x1: number; z1: number };
type Placement = { x: number; z: number; yaw: number; scale: number };

const rect = (cx: number, cz: number, w: number, d: number): Rect => ({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
const inRect = (r: Rect, x: number, z: number, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

/** Where on the floor a door on `side` sits, and the unit vector pointing into the room from it. */
function doorAnchor(side: WallSide, L: number, W: number) {
  switch (side) {
    case 'left': return { x: 0, z: W / 2, nx: 1, nz: 0 };
    case 'right': return { x: L, z: W / 2, nx: -1, nz: 0 };
    case 'back': return { x: L / 2, z: 0, nx: 0, nz: 1 };
    case 'front': return { x: L / 2, z: W, nx: 0, nz: -1 };
  }
}

type GardenLayout = {
  beds: Rect[]; // soil under each crop
  path: Rect | null; // wood chips from the exterior door toward the middle
  blocked: Rect[]; // beds, path, tents, gear and door thresholds: nothing scattered there
  hoseSpot: { x: number; z: number; yaw: number } | null;
};

function gardenLayout(room: Room, doorSides: WallSide[], outsideDoorSide?: WallSide): GardenLayout {
  const { length: L, width: W } = room.dimensions;
  const beds: Rect[] = [];
  const blocked: Rect[] = [];
  for (const item of room.items) {
    const [x, , z] = itemWorldPosition(item, room);
    if (item.category === 'plant' || item.category === 'mushroom') {
      const c = item.containerDimensions || item.dimensions;
      beds.push(rect(x, z, Math.max(1.5, c.length + 1.2), Math.max(1.5, c.width + 1.2)));
    } else if (item.category === 'equipment') {
      blocked.push(rect(x, z, item.dimensions.length + 0.6, item.dimensions.width + 0.6));
    }
  }
  for (const tent of room.tents) {
    const [ox, , oz] = tentWorldOrigin(tent, room);
    blocked.push({ x0: ox - 0.6, z0: oz - 0.6, x1: ox + tent.dimensions.length + 0.6, z1: oz + tent.dimensions.width + 0.6 });
  }
  for (const side of doorSides) {
    const d = doorAnchor(side, L, W);
    const along = d.nx === 0;
    blocked.push(along ? rect(d.x, d.z + d.nz * 1.5, 2 * DOOR_HALF_WIDTH + 1, 3) : rect(d.x + d.nx * 1.5, d.z, 3, 2 * DOOR_HALF_WIDTH + 1));
  }

  let path: Rect | null = null;
  let hoseSpot: GardenLayout['hoseSpot'] = null;
  if (outsideDoorSide) {
    const d = doorAnchor(outsideDoorSide, L, W);
    const depth = d.nx === 0 ? W : L;
    // Run inward until the path meets a bed or tent (at least 3 ft, at most to the middle)
    let reach = 3;
    const hits = (t: number) => {
      const x = d.x + d.nx * t, z = d.z + d.nz * t;
      return beds.some(b => inRect(b, x, z, 1.4)) || room.tents.some(tent => {
        const [ox, , oz] = tentWorldOrigin(tent, room);
        return x > ox - 1.4 && x < ox + tent.dimensions.length + 1.4 && z > oz - 1.4 && z < oz + tent.dimensions.width + 1.4;
      });
    };
    while (reach < depth / 2 && !hits(reach + 0.5)) reach += 0.5;
    const cx = d.x + d.nx * reach / 2, cz = d.z + d.nz * reach / 2;
    path = d.nx === 0 ? rect(cx, cz, 3, reach) : rect(cx, cz, reach, 3);
    // Hose reel on a post just inside the fence, beside the door, facing along the path
    const side = 3.2;
    hoseSpot = d.nx === 0
      ? { x: d.x + side, z: d.z + d.nz * 0.5, yaw: d.nz > 0 ? 0 : Math.PI }
      : { x: d.x + d.nx * 0.5, z: d.z + side, yaw: d.nx > 0 ? Math.PI / 2 : -Math.PI / 2 };
    blocked.push(rect(hoseSpot.x, hoseSpot.z, 2.5, 2.5));
  }
  return { beds, path, blocked: [...blocked, ...beds, ...(path ? [path] : [])], hoseSpot };
}

/** Up to `count` random spots in `area` that `ok` accepts (rejection sampling, bounded tries). */
function scatter(rng: () => number, count: number, area: Rect, ok: (x: number, z: number) => boolean, scale: [number, number]): Placement[] {
  const out: Placement[] = [];
  for (let tries = 0; out.length < count && tries < count * 6; tries++) {
    const x = area.x0 + rng() * (area.x1 - area.x0);
    const z = area.z0 + rng() * (area.z1 - area.z0);
    if (!ok(x, z)) continue;
    out.push({ x, z, yaw: rng() * Math.PI * 2, scale: scale[0] + rng() * (scale[1] - scale[0]) });
  }
  return out;
}

/** Split placements across a model's variants. */
function byVariant(rng: () => number, placements: Placement[], variants: string[]): Record<string, Placement[]> {
  const out: Record<string, Placement[]> = Object.fromEntries(variants.map(v => [v, []]));
  for (const p of placements) out[variants[Math.floor(rng() * variants.length)]].push(p);
  return out;
}

function meshOf(scene: THREE.Object3D, node: string): THREE.Mesh {
  let found: THREE.Mesh | undefined;
  scene.getObjectByName(node)?.traverse(o => { if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh; });
  if (!found) throw new Error(`outdoor model: no mesh ${node}`);
  return found;
}

/** Every placement of one GLB node in a single draw call, base on the ground, sized in metres → feet. */
function InstancedNode({ src, node, placements }: { src: string; node: string; placements: Placement[] }) {
  const gltf = useGLTF(src) as unknown as { scene: THREE.Group };
  const mesh = useMemo(() => meshOf(gltf.scene, node), [gltf, node]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    mesh.geometry.computeBoundingBox();
    const baseY = mesh.geometry.boundingBox!.min.y;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    placements.forEach((pl, i) => {
      const k = pl.scale * M_TO_FT;
      m.compose(p.set(pl.x, -baseY * k, pl.z), q.setFromAxisAngle(up, pl.yaw), s.set(k, k, k));
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }, [mesh, placements]);
  if (placements.length === 0) return null;
  return <instancedMesh key={placements.length} ref={ref} args={[mesh.geometry, mesh.material as THREE.Material, placements.length]} raycast={() => null} />;
}

function Instanced({ src, groups }: { src: string; groups: Record<string, Placement[]> }) {
  return (
    <AssetSlot fallback={null}>
      {Object.entries(groups).map(([node, list]) => <InstancedNode key={node} src={src} node={node} placements={list} />)}
    </AssetSlot>
  );
}

/** One prop (a node, or the whole file when `node` is omitted) at real size, base on the ground. */
function PropModel({ src, node, scale = 1 }: { src: string; node?: string; scale?: number }) {
  const gltf = useGLTF(src) as unknown as { scene: THREE.Group };
  const obj = useMemo(() => {
    const source = node ? gltf.scene.getObjectByName(node) : gltf.scene;
    if (!source) throw new Error(`${src}: no node ${node}`);
    const o = source.clone(true);
    o.position.set(0, 0, 0);
    o.traverse(c => { c.raycast = () => null; });
    const k = scale * M_TO_FT;
    o.scale.setScalar(k);
    o.updateMatrixWorld(true);
    o.position.y = -new THREE.Box3().setFromObject(o).min.y;
    return o;
  }, [gltf, node, src, scale]);
  return <primitive object={obj} />;
}

function Prop({ src, node, x, z, y = 0, yaw = 0, scale = 1 }: { src: string; node?: string; x: number; z: number; y?: number; yaw?: number; scale?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      <AssetSlot fallback={null}>
        <PropModel src={src} node={node} scale={scale} />
      </AssetSlot>
    </group>
  );
}

/** A flat textured patch on the ground (soil bed, path). `lift` keeps overlapping layers from flickering. */
function GroundPatch({ r, surface, lift }: { r: Rect; surface: SurfaceKind; lift: number }) {
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  const maps = useSurfaceMaps(surface, w, d);
  if (!maps) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(r.x0 + r.x1) / 2, lift, (r.z0 + r.z1) / 2]} raycast={() => null}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial
        color={maps.color}
        map={maps.map}
        normalMap={maps.normalMap}
        normalScale={maps.normalScale}
        roughnessMap={maps.roughnessMap}
        aoMap={maps.aoMap}
        roughness={1}
        polygonOffset
        polygonOffsetFactor={-1 - lift * 100}
      />
    </mesh>
  );
}

/** Lawn reaching past the fence (below the room's own floor). */
function YardLawn({ L, W }: { L: number; W: number }) {
  const size: [number, number] = [L + YARD_MARGIN * 2, W + YARD_MARGIN * 2];
  const maps = useSurfaceMaps('lawn', size[0], size[1]);
  if (!maps) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L / 2, -0.02, W / 2]} raycast={() => null}>
      <planeGeometry args={size} />
      <meshStandardMaterial color="#9fb487" map={maps.map} normalMap={maps.normalMap} normalScale={maps.normalScale} roughnessMap={maps.roughnessMap} aoMap={maps.aoMap} roughness={1} />
    </mesh>
  );
}

// ---------- trees (procedural: Poly Haven's trees are 100+ MB) ----------

const TRUNK_GEO = new THREE.CylinderGeometry(0.7, 1, 1, 7);
const BARK_MAT = new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 1 });
const LEAF_MATS = ['#3f5f2a', '#4d6b2f', '#355225', '#5a7434'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true }));

/** A lumpy leaf cluster: an icosphere with its vertices pushed in and out (seeded). */
function crownGeometry(seed: number) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const rng = createRng(seed);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const moved = new Map<string, number>(); // keep shared corners together so the surface stays closed
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!moved.has(key)) moved.set(key, 0.78 + rng() * 0.4);
    v.multiplyScalar(moved.get(key)!);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
const CROWN_GEOS = [11, 23, 37, 41].map(crownGeometry);

function Tree({ x, z, seed }: { x: number; z: number; seed: number }) {
  const parts = useMemo(() => {
    const rng = createRng(seed);
    const height = 9 + rng() * 9; // trunk to crown base
    const girth = 0.35 + rng() * 0.3;
    const crown = 4 + rng() * 4;
    const blobs = Array.from({ length: 5 + Math.floor(rng() * 4) }, () => {
      const a = rng() * Math.PI * 2, r = rng() * crown * 0.55;
      return {
        pos: [Math.cos(a) * r, height + crown * (0.2 + rng() * 0.7), Math.sin(a) * r] as [number, number, number],
        scale: crown * (0.45 + rng() * 0.35),
        geo: CROWN_GEOS[Math.floor(rng() * CROWN_GEOS.length)],
        mat: LEAF_MATS[Math.floor(rng() * LEAF_MATS.length)],
      };
    });
    return { height, girth, blobs, yaw: rng() * Math.PI * 2 };
  }, [seed]);
  return (
    <group position={[x, 0, z]} rotation={[0, parts.yaw, 0]}>
      <mesh geometry={TRUNK_GEO} material={BARK_MAT} position={[0, (parts.height + 2) / 2, 0]} scale={[parts.girth, parts.height + 2, parts.girth]} raycast={() => null} />
      {parts.blobs.map((b, i) => (
        <mesh key={i} geometry={b.geo} material={b.mat} position={b.pos} scale={[b.scale, b.scale * 0.85, b.scale]} raycast={() => null} />
      ))}
    </group>
  );
}

// ---------- the garden ----------

export function GardenSurroundings({ room, doorSides, outsideDoorSide }: { room: Room; doorSides: WallSide[]; outsideDoorSide?: WallSide }) {
  const { length: L, width: W } = room.dimensions;
  // Re-plan only when something that affects the layout moves (the room object changes every sim tick)
  const layoutKey = JSON.stringify([
    L, W, doorSides, outsideDoorSide,
    room.items.map(i => [i.id, i.category, i.position?.x, i.position?.y, i.dimensions.length, i.dimensions.width]),
    room.tents.map(t => [t.id, t.position?.x, t.position?.y, t.dimensions.length, t.dimensions.width]),
  ]);
  const plan = useMemo(() => {
    const layout = gardenLayout(room, doorSides, outsideDoorSide);
    const rng = createRng(hashString(room.id));
    const free = (x: number, z: number, pad = 0) => !layout.blocked.some(r => inRect(r, x, z, pad));
    const inYard = (x: number, z: number) => x > 0.4 && x < L - 0.4 && z > 0.4 && z < W - 0.4;
    const lawnArea = { x0: 0, z0: 0, x1: L, z1: W };
    const outer = { x0: -YARD_MARGIN * 0.6, z0: -YARD_MARGIN * 0.6, x1: L + YARD_MARGIN * 0.6, z1: W + YARD_MARGIN * 0.6 };
    const beyondFence = (x: number, z: number) => x < -0.6 || x > L + 0.6 || z < -0.6 || z > W + 0.6;
    const area = L * W;

    const tuftsIn = scatter(rng, Math.round(area * 0.45), lawnArea, (x, z) => inYard(x, z) && free(x, z), [1.1, 1.8]);
    const sprigsIn = scatter(rng, Math.round(area * 0.6), lawnArea, (x, z) => inYard(x, z) && free(x, z), [1, 1.6]);
    const ringArea = (outer.x1 - outer.x0) * (outer.z1 - outer.z0) - area;
    const tuftsOut = scatter(rng, Math.round(ringArea * 0.07), outer, beyondFence, [1.2, 2.2]);
    const dandelions = scatter(rng, Math.round(area * 0.02) + 3, lawnArea, (x, z) => inYard(x, z) && free(x, z, 0.3), [1, 1.3]);

    // Ferns along the inside of the fence, shrubs in its corners
    const fenceBand = (x: number, z: number) => inYard(x, z) && (x < 1.4 || x > L - 1.4 || z < 1.4 || z > W - 1.4) && free(x, z, 0.8);
    const ferns = scatter(rng, Math.round((L + W) * 0.25), lawnArea, fenceBand, [0.8, 1.2]);
    const shrubs = ([[1.2, 1.2], [L - 1.2, 1.2], [1.2, W - 1.2], [L - 1.2, W - 1.2]] as const)
      .filter(([x, z]) => free(x, z, 0.8))
      .map(([x, z]) => ({ x, z, yaw: rng() * Math.PI * 2, scale: 1.6 + rng() * 0.6 }));

    // Two planter boxes along the wall opposite the exterior door, where free
    const planters: Placement[] = [];
    if (outsideDoorSide) {
      const opposite = { left: 'right', right: 'left', back: 'front', front: 'back' }[outsideDoorSide] as WallSide;
      const d = doorAnchor(opposite, L, W);
      for (const off of [-5, 5]) {
        const x = d.nx === 0 ? d.x + off : d.x + d.nx * 1.4;
        const z = d.nx === 0 ? d.z + d.nz * 1.4 : d.z + off;
        if (inYard(x, z) && free(x, z, 1.6)) planters.push({ x, z, yaw: d.nx === 0 ? 0 : Math.PI / 2, scale: 1 });
      }
    }
    const sprinkler = scatter(rng, 1, { x0: L * 0.25, z0: W * 0.25, x1: L * 0.75, z1: W * 0.75 }, (x, z) => free(x, z, 1.2), [1, 1])[0];

    // Landmarks and trees beyond the fence
    const corners = [[-4, -5], [L + 5, -3.5], [-3.5, W + 4.5], [L + 4, W + 5]] as const;
    const pick = (i: number) => corners[(hashString(room.id) + i) % 4];
    const trees = scatter(rng, 9, { x0: -YARD_MARGIN, z0: -YARD_MARGIN, x1: L + YARD_MARGIN, z1: W + YARD_MARGIN },
      (x, z) => {
        const dx = Math.max(-x, x - L, 0), dz = Math.max(-z, z - W, 0);
        const gap = Math.hypot(dx, dz);
        return gap > 9 && gap < YARD_MARGIN - 6;
      }, [1, 1]).map((p, i) => ({ ...p, seed: hashString(`${room.id}|tree|${i}`) }));

    return {
      layout,
      tufts: byVariant(rng, [...tuftsIn, ...tuftsOut], TUFTS),
      sprigs: byVariant(rng, sprigsIn, SPRIGS),
      dandelions: byVariant(rng, dandelions, DANDELIONS),
      ferns: byVariant(rng, ferns, FERNS),
      shrubs,
      planters,
      sprinkler,
      boulder: pick(0),
      stump: pick(2),
      trees,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  const { layout } = plan;
  return (
    <group>
      <YardLawn L={L} W={W} />
      {layout.path && <GroundPatch r={layout.path} surface="woodChips" lift={0.006} />}
      {layout.beds.map((b, i) => <GroundPatch key={i} r={b} surface="gardenSoil" lift={0.01} />)}

      <Instanced src={OUTDOOR_URLS.tufts} groups={plan.tufts} />
      <Instanced src={OUTDOOR_URLS.sprigs} groups={plan.sprigs} />
      <Instanced src={OUTDOOR_URLS.dandelion} groups={plan.dandelions} />
      <Instanced src={OUTDOOR_URLS.fern} groups={plan.ferns} />
      <Instanced src={OUTDOOR_URLS.shrub} groups={{ shrub_04: plan.shrubs }} />

      {plan.planters.map((p, i) => <Prop key={i} src={OUTDOOR_URLS.planter} x={p.x} z={p.z} yaw={p.yaw} />)}
      {plan.sprinkler && <Prop src={OUTDOOR_URLS.sprinkler} x={plan.sprinkler.x} z={plan.sprinkler.z} yaw={plan.sprinkler.yaw} />}
      {layout.hoseSpot && (
        <group position={[layout.hoseSpot.x, 0, layout.hoseSpot.z]} rotation={[0, layout.hoseSpot.yaw, 0]}>
          {/* Wooden post carrying the hose reel */}
          <mesh position={[0, 1.75, 0]} raycast={() => null}>
            <boxGeometry args={[0.32, 3.5, 0.32]} />
            <meshStandardMaterial color="#7c5a3a" roughness={0.95} />
          </mesh>
          <Prop src={OUTDOOR_URLS.hoseReel} x={0} z={0.16} y={1.5} yaw={-Math.PI / 2} />
          <Prop src={OUTDOOR_URLS.wateringCan} x={0.9} z={0.5} yaw={0.6} />
        </group>
      )}

      <Prop src={OUTDOOR_URLS.boulder} x={plan.boulder[0]} z={plan.boulder[1]} yaw={1.1} scale={0.7} />
      <Prop src={OUTDOOR_URLS.stump} x={plan.stump[0]} z={plan.stump[1]} yaw={2.3} />
      {plan.trees.map((t, i) => <Tree key={i} x={t.x} z={t.z} seed={t.seed} />)}
    </group>
  );
}
