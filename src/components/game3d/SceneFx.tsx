import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { Item, Room, Tent } from '../../types/sim';
import { getAttachedPosition } from '../../utils/equipmentLinks';
import { isCeilingMounted, itemWorldPosition, tentWorldOrigin } from './coords';

/**
 * Scene-wide rendering effects:
 *  - SceneEnvironment: a small procedural environment map (rendered locally, no HDRI download) that
 *    gives metal, plastic and leaves soft reflections and image-based fill light.
 *  - ShadowManager: decides which meshes cast / receive shadows and re-renders the shadow maps only
 *    when something that casts one moves (at most 10 times a second), so shadows cost almost nothing
 *    on frames where nothing changes.
 *  - ContactShadowDecal: soft darkening baked onto one floor texture under every tent and floor item,
 *    plus along the wall bases, so things look like they sit on the floor.
 */

/** Marks a subtree whose meshes cast shadows even though it isn't an item (the player avatar). */
export const CASTS_SHADOW_USER_DATA = { castsShadow: true };

export function SceneEnvironment({ exposed, daylight }: { exposed: boolean; daylight: number }) {
  // Re-render the environment only when the light changes noticeably (it is drawn once per key)
  const level = Math.round(daylight * 10) / 10;
  const skyColor = exposed ? new THREE.Color('#1e293b').lerp(new THREE.Color('#bae6fd'), level) : new THREE.Color('#2a2a2e');
  return (
    <Environment key={`${exposed}-${level}`} resolution={128} frames={1} environmentIntensity={exposed ? 0.35 + level * 0.5 : 0.55}>
      {/* The surroundings: a dim room (indoors) or the sky (outdoors) */}
      <mesh scale={[100, 100, 100]}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial color={skyColor} side={THREE.BackSide} />
      </mesh>
      {exposed ? (
        <>
          <Lightformer form="circle" intensity={0.5 + level * 3} color="#fff7e6" position={[20, 30, 10]} scale={12} onUpdate={self => self.lookAt(0, 0, 0)} />
          <Lightformer form="rect" intensity={0.4} color="#365314" position={[0, -10, 0]} rotation-x={-Math.PI / 2} scale={[80, 80, 1]} />
        </>
      ) : (
        <>
          {/* Ceiling fixtures: rows of bright strips overhead */}
          {[-12, 0, 12].map(z => (
            <Lightformer key={z} form="rect" intensity={2.2} color="#f4f4f5" position={[0, 12, z]} rotation-x={Math.PI / 2} scale={[24, 2, 1]} />
          ))}
          {/* Warm-white grow light panels at canopy height, and a faint floor bounce */}
          <Lightformer form="rect" intensity={1.4} color="#fde7f3" position={[10, 6, 0]} rotation-y={-Math.PI / 2} scale={[8, 4, 1]} />
          <Lightformer form="rect" intensity={1.4} color="#fde7f3" position={[-10, 6, 0]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} />
          <Lightformer form="rect" intensity={0.25} color="#a1a1aa" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[60, 60, 1]} />
        </>
      )}
    </Environment>
  );
}

function hasFlaggedAncestor(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (p.userData.isItem || p.userData.castsShadow) return true;
  }
  return false;
}

function materialsOf(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

const SHADOW_CHECK_MS = 100;

export function ShadowManager() {
  const { gl, scene } = useThree();
  const lastCheck = useRef(0);
  const lastSignature = useRef(NaN);

  useEffect(() => {
    // Shadow maps are rendered on demand (below), not every frame
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => { gl.shadowMap.autoUpdate = true; };
  }, [gl]);

  useFrame(() => {
    const now = performance.now();
    if (now - lastCheck.current < SHADOW_CHECK_MS) return;
    lastCheck.current = now;

    // Items and the avatar cast; walls, tents, floors and labels don't (the room has no ceiling, so a
    // wall or tent roof would shade everything inside it). Glows, rings and see-through parts never cast.
    let signature = 0;
    let n = 0;
    scene.traverse(o => {
      if ((o as THREE.Light).isLight && (o as THREE.Light).castShadow) {
        const e = o.matrixWorld.elements;
        signature += (e[12] * 2.3 + e[13] * 4.1 + e[14] * 6.7) * (o.visible ? 1 : -1);
        return;
      }
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = materialsOf(mesh);
      const lit = mats.every(m => !(m as THREE.MeshBasicMaterial).isMeshBasicMaterial);
      const opaque = mats.every(m => !m.transparent || m.alphaTest > 0);
      mesh.receiveShadow = lit;
      mesh.castShadow = lit && opaque && mesh.visible && hasFlaggedAncestor(mesh);
      if (!mesh.castShadow) return;
      n++;
      const e = mesh.matrixWorld.elements;
      signature += (e[12] * 1.7 + e[13] * 3.1 + e[14] * 5.3 + e[0] * 7.1 + e[2] * 11.3 + e[5] * 13.7) * ((n % 7) + 1);
      if ((mesh as THREE.InstancedMesh).isInstancedMesh) signature += (mesh as THREE.InstancedMesh).count * 0.37;
    });
    signature += n * 1000;
    if (signature !== lastSignature.current) {
      lastSignature.current = signature;
      gl.shadowMap.needsUpdate = true;
    }
  });
  return null;
}

/** A light's target, kept in the scene at a world position (directional and spot lights aim at it). */
export function useLightTarget(light: React.RefObject<THREE.DirectionalLight | THREE.SpotLight | null>, target: [number, number, number]) {
  const { scene } = useThree();
  const [x, y, z] = target;
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(x, y, z);
    scene.add(l.target);
    l.target.updateMatrixWorld();
    return () => { scene.remove(l.target); };
  }, [light, scene, x, y, z]);
}

/** A grow light: a downward spotlight whose shadows give each canopy a bright pool and a darker understory. */
export function GrowLightSpot({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.SpotLight>(null);
  useLightTarget(ref, [position[0], position[1] - 6, position[2]]);
  return (
    <spotLight
      ref={ref}
      position={position}
      intensity={7}
      distance={12}
      decay={1.6}
      angle={1.0}
      penumbra={0.7}
      color="#fbf3f7"
      castShadow
      shadow-mapSize={[512, 512]}
      shadow-bias={-0.0006}
      shadow-normalBias={0.03}
      shadow-camera-near={0.2}
      shadow-camera-far={12}
    />
  );
}

/** The room's main shadow-casting light: daylight outdoors, near-vertical ceiling fixtures indoors. */
export function KeyLight({ room, exposed, daylight }: { room: Room; exposed: boolean; daylight: number }) {
  const ref = useRef<THREE.DirectionalLight>(null);
  const { length: L, width: W, height: H } = room.dimensions;
  useLightTarget(ref, [L / 2, 0, W / 2]);
  const half = Math.max(L, W) * 0.62 + 4;
  const position: [number, number, number] = exposed
    ? [L / 2 + 20, 10 + daylight * 30, W / 2 + 10]
    : [L / 2 + 3, H + 24, W / 2 + 5]; // above the room, slightly off vertical so shadows have a direction
  return (
    <directionalLight
      ref={ref}
      position={position}
      intensity={exposed ? 0.2 + daylight * 1.8 : 0.85}
      color={exposed ? (daylight > 0.3 ? '#fff7e6' : '#fbbf24') : '#f4f4f5'}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.04}
      shadow-camera-left={-half}
      shadow-camera-right={half}
      shadow-camera-top={half}
      shadow-camera-bottom={-half}
      shadow-camera-near={1}
      shadow-camera-far={H + 80}
    />
  );
}

interface Footprint { x: number; z: number; l: number; w: number; kind: 'item' | 'tent' }

const PX_PER_FT = 16;
const MAX_TEXTURE_PX = 1024;

/** Floor footprints of tents and of items standing on the floor (not hung, carried or attached). */
function floorFootprints(room: Room): Footprint[] {
  const out: Footprint[] = [];
  const add = (items: Item[], tent?: Tent) => {
    const containerH = tent ? tent.dimensions.height : room.dimensions.height;
    for (const item of items) {
      if (item.category === 'person' || item.category === 'pet') continue;
      if (item.category === 'plant' && item.rackSlot) continue; // the rack's own footprint covers it
      if (getAttachedPosition(item, tent ? tent.items : room.items, tent)) continue; // heat mats under something
      if ((item.position?.z || 0) > 0.5 || isCeilingMounted(item, containerH)) continue;
      const [x, , z] = itemWorldPosition(item, room, tent);
      out.push({ x, z, l: item.dimensions.length, w: item.dimensions.width, kind: 'item' });
    }
  };
  for (const tent of room.tents) {
    const [ox, , oz] = tentWorldOrigin(tent, room);
    out.push({ x: ox + tent.dimensions.length / 2, z: oz + tent.dimensions.width / 2, l: tent.dimensions.length, w: tent.dimensions.width, kind: 'tent' });
    add(tent.items, tent);
  }
  add(room.items);
  return out;
}

function bakeContactShadows(L: number, W: number, footprints: Footprint[], wallBases: boolean): THREE.CanvasTexture {
  const scale = Math.min(PX_PER_FT, MAX_TEXTURE_PX / Math.max(L, W));
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.ceil(L * scale));
  c.height = Math.max(2, Math.ceil(W * scale));
  const g = c.getContext('2d')!;
  // Soft shapes without ctx.filter (not everywhere): draw off canvas, let the blurred shadow land in place
  const OFF = c.width + 1000;
  const soft = (draw: () => void, blurFt: number, alpha: number) => {
    g.save();
    g.shadowColor = `rgba(0,0,0,${alpha})`;
    g.shadowBlur = blurFt * scale;
    g.shadowOffsetX = OFF;
    g.translate(-OFF, 0);
    draw();
    g.restore();
  };
  for (const f of footprints) {
    const x0 = (f.x - f.l / 2) * scale, z0 = (f.z - f.w / 2) * scale;
    if (f.kind === 'tent') {
      // The tent's own floor covers its inside: only darken where its walls meet the floor
      soft(() => { g.lineWidth = 0.35 * scale; g.strokeStyle = '#000'; g.strokeRect(x0, z0, f.l * scale, f.w * scale); }, 0.5, 0.55);
    } else {
      const blur = Math.min(1.2, 0.25 + 0.2 * Math.min(f.l, f.w));
      // Wide soft halo plus a darker core right under the footprint
      soft(() => { g.fillStyle = '#000'; g.fillRect(x0, z0, f.l * scale, f.w * scale); }, blur, 0.38);
      soft(() => { g.fillStyle = '#000'; g.fillRect(x0 + 0.1 * scale, z0 + 0.1 * scale, (f.l - 0.2) * scale, (f.w - 0.2) * scale); }, 0.15, 0.3);
    }
  }
  if (wallBases) {
    // Corner where walls meet the floor collects a little darkness
    const band = 1.1 * scale;
    const edges: Array<[number, number, number, number, number, number, number, number]> = [
      [0, 0, c.width, band, 0, 0, 0, band],
      [0, c.height - band, c.width, band, 0, c.height, 0, c.height - band],
      [0, 0, band, c.height, 0, 0, band, 0],
      [c.width - band, 0, band, c.height, c.width, 0, c.width - band, 0]
    ];
    for (const [x, y, w, h, gx0, gy0, gx1, gy1] of edges) {
      const grad = g.createLinearGradient(gx0, gy0, gx1, gy1);
      grad.addColorStop(0, 'rgba(0,0,0,0.42)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x, y, w, h);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function ContactShadowDecal({ room }: { room: Room }) {
  const { length: L, width: W } = room.dimensions;
  const indoor = !room.environmentType || room.environmentType === 'indoor';
  const footprints = floorFootprints(room);
  // Rebake only when the layout changes (not every tick)
  const key = `${L}x${W}|${indoor}|${footprints.map(f => `${f.kind}${f.x.toFixed(2)},${f.z.toFixed(2)},${f.l},${f.w}`).join(';')}`;
  const texture = useMemo(() => bakeContactShadows(L, W, footprints, indoor), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L / 2, 0.02, W / 2]} raycast={() => null} renderOrder={1}>
      <planeGeometry args={[L, W]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  );
}
