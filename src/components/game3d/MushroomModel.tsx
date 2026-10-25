import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MushroomItem, MushroomSpecies } from '../../types/sim';
import { getMushroomContainerDimensions, getMushroomFruitHeightFt } from '../../utils/spatial';
import { seededRandom } from './coords';
import { getCapGeometry, getLionsManeBlob, getLionsManeSpine, getMushroomGrowth } from './mushroomGeometry';
import { getCapMaterial, getMyceliumTexture, isCapSpecies } from './mushroomTextures';

/**
 * Mushroom container (monotub / grow bag / fruiting block) at true scale, its substrate
 * surface whitening in patches as mycelium colonizes it, and fruit bodies that morph with a
 * 0–1 growth value (lathe caps from mushroomGeometry, Lion's Mane as a spined blob). The
 * tallest fruit matches getMushroomFruitHeightFt. Group origin is the container's base center.
 */

const FRUIT_COUNT: Record<MushroomSpecies, number> = {
  Shiitake: 7,
  Medicinal: 9,
  'Golden Oyster': 12,
  Reishi: 4,
  "Lion's Mane": 3
};

// Later fruits start up to this far behind on the growth scale, so pins appear over time
const MAX_LAG = 0.2;
const SPINES = 150;
// Fruit height relative to the stage's envelope height: oysters stay small in their bouquets,
// reishi are low conks on short stalks
const HEIGHT_SCALE: Partial<Record<MushroomSpecies, number>> = { 'Golden Oyster': 0.55, Reishi: 0.5 };

interface FruitSpot {
  x: number;
  z: number;
  size: number;
  lag: number;
  yaw: number;
  tilt: number;
  seed: number;
}

function layoutFruits(shroom: MushroomItem, length: number, width: number): FruitSpot[] {
  const rand = seededRandom(shroom.id);
  const count = FRUIT_COUNT[shroom.species] ?? 8;
  const spot = () => [(rand() - 0.5) * length * 0.8, (rand() - 0.5) * width * 0.8];
  const oyster = shroom.species === 'Golden Oyster';
  // Oysters grow in two bouquets of caps tilted outward from a shared base
  const clusters = [spot(), spot()].map(([x, z]) => [x * 0.6, z * 0.6]);
  return Array.from({ length: count }, (_, i) => {
    const [x, z] = oyster ? clusters[i % 2] : spot();
    return {
      x,
      z,
      size: 0.65 + rand() * 0.35,
      lag: i === 0 ? 0 : rand() * MAX_LAG,
      yaw: oyster ? (i / count) * Math.PI * 4 + (rand() - 0.5) * 0.6 : rand() * Math.PI * 2,
      tilt: oyster ? 0.55 + rand() * 0.4 : shroom.species === 'Reishi' ? 0.1 + rand() * 0.2 : (rand() - 0.5) * 0.3,
      seed: rand()
    };
  });
}

const BLOB_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
const SPINE_MAT = new THREE.MeshStandardMaterial({ color: '#f1ead6', roughness: 0.9 });
const DOWN = new THREE.Vector3(0, -1, 0);

/** Lion's Mane: lumpy blob (unit radius, scaled by the parent) with spines lengthening as it grows. */
function LionsManeFruit({ growth, seed }: { growth: number; seed: number }) {
  const spineRef = useRef<THREE.InstancedMesh>(null);
  const spines = useMemo(() => {
    const rand = seededRandom(`mane-${seed}`);
    return Array.from({ length: SPINES }, () => {
      // Spines cover all but the crown and hang in a cascade, longest underneath
      const theta = rand() * Math.PI * 2;
      const y = 0.45 - rand() * 1.0;
      const ring = Math.sqrt(1 - y * y) * 0.9;
      const pos = new THREE.Vector3(Math.cos(theta) * ring, Math.max(-0.5, y), Math.sin(theta) * ring);
      const dir = new THREE.Vector3(pos.x * 0.35, -1, pos.z * 0.35).normalize();
      return { pos, quat: new THREE.Quaternion().setFromUnitVectors(DOWN, dir), len: (0.5 + rand() * 0.5) * (1.3 - y * 0.6) };
    });
  }, [seed]);

  const stepped = Math.round(growth * 40) / 40;
  useLayoutEffect(() => {
    const mesh = spineRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const s = new THREE.Vector3();
    const reach = 0.04 + 0.5 * stepped;
    spines.forEach((sp, i) => mesh.setMatrixAt(i, m.compose(sp.pos, sp.quat, s.set(1, sp.len * reach, 1))));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [spines, stepped]);

  return (
    <group>
      <mesh geometry={getLionsManeBlob()} material={BLOB_MAT} />
      <instancedMesh ref={spineRef} args={[getLionsManeSpine(), SPINE_MAT, SPINES]} />
    </group>
  );
}

export function MushroomModel({ shroom }: { shroom: MushroomItem }) {
  const container = shroom.containerDimensions || getMushroomContainerDimensions(shroom.containerType);
  const fruitH = getMushroomFruitHeightFt(shroom);
  const growth = getMushroomGrowth(shroom);
  const fruits = useMemo(
    () => layoutFruits(shroom, container.length, container.width),
    // Placement only depends on identity and container footprint, not on every tick's state
    [shroom.id, shroom.species, container.length, container.width]
  );

  const bodyColor = shroom.containerType === 'monotub' ? '#d4d4d8' : shroom.containerType === 'grow_bag' ? '#e7e5e4' : '#7c5a3a';
  const isTub = shroom.containerType === 'monotub';
  // Tubs fruit from the substrate surface; bags and blocks fruit from their sides/top
  const fruitBaseY = isTub ? container.height * 0.7 : container.height;
  // Inside a tub the substrate is the fruiting surface; on a bag or block it covers the top
  const surfaceY = isTub ? fruitBaseY - 0.01 : container.height + 0.003;
  const colonization = Math.max(0, Math.min(1, (shroom.myceliumColonization ?? 80) / 100));

  const myceliumMat = useMemo(() => new THREE.MeshStandardMaterial({ map: getMyceliumTexture(), alphaTest: 0.5, roughness: 1 }), []);
  useEffect(() => () => myceliumMat.dispose(), [myceliumMat]);
  myceliumMat.alphaTest = Math.max(0.02, 1 - colonization);

  return (
    <group>
      <mesh position={[0, container.height / 2, 0]}>
        <boxGeometry args={[container.length, container.height, container.width]} />
        <meshStandardMaterial
          color={bodyColor}
          transparent={shroom.containerType !== 'fruiting_block'}
          opacity={isTub ? 0.55 : shroom.containerType === 'grow_bag' ? 0.75 : 1}
          roughness={0.6}
        />
      </mesh>
      {/* Substrate, with mycelium spreading over it in patches */}
      <mesh position={[0, surfaceY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[container.length * 0.94, container.width * 0.94]} />
        <meshStandardMaterial color="#7a5a3c" roughness={1} />
      </mesh>
      {colonization > 0.02 && (
        <mesh position={[0, surfaceY + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} material={myceliumMat}>
          <planeGeometry args={[container.length * 0.94, container.width * 0.94]} />
        </mesh>
      )}
      {fruitH > 0 && fruits.map((f, i) => {
        const g = Math.max(0, Math.min(1, (growth - f.lag) / (1 - f.lag)));
        if (g <= 0) return null;
        // Laggards are smaller as well as less developed
        const h = fruitH * (HEIGHT_SCALE[shroom.species] ?? 1) * f.size * (0.55 + 0.45 * Math.min(1, g / Math.max(growth, 1e-3)));
        if (shroom.species === "Lion's Mane") {
          const r = h * 0.5;
          return (
            <group key={i} position={[f.x, fruitBaseY + r * 0.5, f.z]} rotation={[0, f.yaw, 0]} scale={r}>
              <LionsManeFruit growth={g} seed={f.seed} />
            </group>
          );
        }
        if (!isCapSpecies(shroom.species)) return null;
        return (
          <mesh
            key={i}
            geometry={getCapGeometry(shroom.species, g)}
            material={getCapMaterial(shroom.species, shroom.health)}
            position={[f.x, fruitBaseY, f.z]}
            rotation={[f.tilt, f.yaw, 0, 'YXZ']}
            scale={h}
          />
        );
      })}
    </group>
  );
}
