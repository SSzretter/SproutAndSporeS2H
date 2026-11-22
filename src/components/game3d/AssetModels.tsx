import React, { Suspense, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Textured Poly Haven (CC0) models from public/models/equipment/ (built by `npm run build:equipment`,
 * credits in that folder). Each one is fitted to the item's real size in feet; wrap it in <AssetSlot>
 * so the procedural model shows while it loads and if it fails to.
 */

const BASE = import.meta.env.BASE_URL;
const url = (file: string) => `${BASE}models/equipment/${file}`;
const M_TO_FT = 3.28084;

export const ASSET_URLS = {
  reservoir: url('reservoir_tote.glb'),
  inlineFan: url('inline_fan.glb'),
  fluorescent: url('light_fluorescent.glb'),
  pendant: url('light_pendant.glb'),
  cagedLight: url('caged_light.glb'),
  breaker: url('breaker_panel.glb'),
  shutter: url('rollershutter_door.glb'),
} as const;

class AssetErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('Equipment model failed to load; using the simple model instead.', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Shows `fallback` while the model loads, and instead of it if loading fails. */
export function AssetSlot({ fallback, children }: { fallback: React.ReactNode; children: React.ReactNode }) {
  return (
    <AssetErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </AssetErrorBoundary>
  );
}

type Fit =
  | { size: [number, number, number]; uniform?: boolean } // stretch (or contain, when uniform) into x × y × z feet
  | { scale: number }; // fixed scale factor
type Anchor = 'bottom' | 'top' | 'center';
/** Where the model's depth (Z) sits: centred on the origin, or with its back face on it (wall-mounted). */
type Depth = 'center' | 'back';

/**
 * A clone of one node (or the whole scene) of a GLB, scaled per `fit` and moved so its base centre
 * (or top centre / centre, per `anchor`) sits at the origin; `depth: 'back'` puts its back face there instead. Geometry is shared between clones; materials
 * are copied only when `ownMaterials` is set, so per-instance changes (glow) don't leak to other items.
 */
function useFittedPart(src: string, node: string | undefined, fit: Fit, anchor: Anchor, depth: Depth, ownMaterials: boolean) {
  const gltf = useGLTF(src) as unknown as { scene: THREE.Group };
  const fitKey = JSON.stringify(fit);
  return useMemo(() => {
    const source = node ? gltf.scene.getObjectByName(node) : gltf.scene;
    if (!source) throw new Error(`${src}: no node ${node}`);
    const part = source.clone(true);
    if (node) {
      part.position.set(0, 0, 0);
      part.quaternion.identity();
      part.scale.set(1, 1, 1);
    }
    if (ownMaterials) {
      part.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.material = (mesh.material as THREE.Material).clone();
      });
    }
    part.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(part);
    const size = box.getSize(new THREE.Vector3());
    let s: THREE.Vector3;
    if ('scale' in fit) {
      s = new THREE.Vector3(fit.scale, fit.scale, fit.scale);
    } else {
      s = new THREE.Vector3(fit.size[0] / Math.max(size.x, 1e-6), fit.size[1] / Math.max(size.y, 1e-6), fit.size[2] / Math.max(size.z, 1e-6));
      if (fit.uniform) s.setScalar(Math.min(s.x, s.y, s.z));
    }
    part.scale.multiply(s);
    const y = anchor === 'bottom' ? box.min.y : anchor === 'top' ? box.max.y : (box.min.y + box.max.y) / 2;
    const z = depth === 'back' ? box.min.z : (box.min.z + box.max.z) / 2;
    part.position.set(-((box.min.x + box.max.x) / 2) * s.x, -y * s.y, -z * s.z);
    const wrapper = new THREE.Group();
    wrapper.add(part);
    return wrapper;
  }, [gltf, node, fitKey, anchor, depth, ownMaterials, src]); // fitKey stands in for `fit`
}

/**
 * Per-instance material settings: the glow of emissive-textured materials, and an optional metalness cap
 * (bare metal reflects the dark room and reads as black, so ducting is toned down).
 */
function useMaterialTweaks(root: THREE.Object3D, glow: number | undefined, metalness: number | undefined) {
  useEffect(() => {
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (glow !== undefined && mat.emissiveMap) {
        mat.emissiveIntensity = glow;
        mat.toneMapped = glow <= 1;
      }
      if (metalness !== undefined) mat.metalness = metalness;
    });
  }, [root, glow, metalness]);
}

function Part({ src, node, fit, anchor = 'bottom', depth = 'center', glow, metalness, ...group }: {
  src: string;
  node?: string;
  fit: Fit;
  anchor?: Anchor;
  depth?: Depth;
  glow?: number;
  metalness?: number;
} & Pick<React.ComponentProps<'group'>, 'position' | 'rotation'>) {
  const obj = useFittedPart(src, node, fit, anchor, depth, glow !== undefined || metalness !== undefined);
  useMaterialTweaks(obj, glow, metalness);
  return (
    <group {...group}>
      <primitive object={obj} />
    </group>
  );
}

// ---------- equipment ----------

/** Black tote with a red lid, stretched to the reservoir's footprint and height. */
export function ReservoirTote({ L, W, h }: { L: number; W: number; h: number }) {
  return <Part src={ASSET_URLS.reservoir} node="plastic_container" fit={{ size: [L, h, W] }} />;
}

/**
 * Inline duct fan along X: a fan housing with a guard in the middle and a galvanised duct collar on
 * each side, centred at height `y`. `r` is the housing radius.
 */
export function InlineFan({ L, r, y }: { L: number; r: number; y: number }) {
  const housing = Math.min(L * 0.4, r * 1.2);
  const collar = Math.max(0.05, (L - housing) / 2);
  const collarD = r * 2 * 0.68;
  const turn: [number, number, number] = [0, Math.PI / 2, 0]; // duct pieces run along Z
  return (
    <group position={[0, y, 0]}>
      <Part src={ASSET_URLS.inlineFan} node="modular_airduct_circular_fan" anchor="center" rotation={turn} fit={{ size: [r * 2, r * 2, housing] }} metalness={0.35} />
      {[-1, 1].map(side => (
        <Part
          key={side}
          src={ASSET_URLS.inlineFan}
          node="modular_airduct_circular_single"
          anchor="center"
          rotation={turn}
          position={[side * (housing / 2 + collar / 2), 0, 0]}
          fit={{ size: [collarD, collarD, collar] }}
          metalness={0.35}
        />
      ))}
    </group>
  );
}

/** T5 / fluorescent fixture: a white reflector plate with tube strips across it. Top at `h`. */
export function FluorescentFixture({ L, W, h, lit }: { L: number; W: number; h: number; lit: boolean }) {
  const strips = Math.max(2, Math.min(8, Math.round(W / 0.28)));
  const pitch = (W * 0.9) / strips;
  const plate = Math.min(0.06, h * 0.3);
  return (
    <group>
      <mesh position={[0, h - plate / 2, 0]}>
        <boxGeometry args={[L, plate, W]} />
        <meshStandardMaterial color="#e7e5e4" metalness={0.6} roughness={0.35} />
      </mesh>
      {Array.from({ length: strips }, (_, i) => (
        <Part
          key={i}
          src={ASSET_URLS.fluorescent}
          node="mounted_fluorescent_lights_d"
          anchor="top"
          position={[0, h - plate, -W * 0.45 + pitch * (i + 0.5)]}
          fit={{ size: [L * 0.96, Math.min(h - plate, 0.11), Math.min(pitch * 0.85, 0.14)] }}
          glow={lit ? 2.2 : 0}
        />
      ))}
    </group>
  );
}

/** Pendant lamp (HPS / CMH-style): sized to the fixture's footprint, lamp face at the base. */
export function PendantLamp({ L, W, lit }: { L: number; W: number; lit: boolean }) {
  const d = Math.min(L, W);
  return <Part src={ASSET_URLS.pendant} node="hanging_industrial_lamp" fit={{ size: [d, 1e3, d], uniform: true }} glow={lit ? 3 : 0} />;
}

// ---------- room fixtures ----------

/** Breaker panel at true scale; origin at the panel's centre on the wall surface, facing +Z. */
export function BreakerPanel() {
  return <Part src={ASSET_URLS.breaker} fit={{ scale: M_TO_FT }} anchor="center" depth="back" />;
}

/** Caged utility light hanging from the ceiling at true scale; origin at the ceiling mount. */
export function CagedWorkLight({ lit }: { lit: boolean }) {
  return <Part src={ASSET_URLS.cagedLight} node="caged_hanging_light" fit={{ scale: M_TO_FT }} anchor="top" glow={lit ? 1.6 : 0} />;
}

/** Roll-up shutter filling a `width` × `height` opening; origin at the bottom centre of the curtain, roll box toward +Z. */
export function RollerShutter({ width, height }: { width: number; height: number }) {
  return <Part src={ASSET_URLS.shutter} node="rollershutter_door" fit={{ size: [width, height, 0.55] }} depth="back" />;
}
