import React, { useMemo } from 'react';
import { MushroomItem } from '../../types/sim';
import { getMushroomContainerDimensions, getMushroomFruitHeightFt } from '../../utils/spatial';
import { seededRandom } from './coords';

/**
 * Mushroom container (monotub / grow bag / fruiting block) at true scale with fruit bodies
 * whose count and size follow the stage. Group origin is the container's base center.
 */

const CAP_COLORS: Record<string, string> = {
  'Golden Oyster': '#facc15',
  "Lion's Mane": '#f5f5f4',
  Shiitake: '#7c4a2a',
  Reishi: '#9f1d1d',
  Medicinal: '#d6b98c'
};

export function MushroomModel({ shroom }: { shroom: MushroomItem }) {
  const container = shroom.containerDimensions || getMushroomContainerDimensions(shroom.containerType);
  const fruitH = getMushroomFruitHeightFt(shroom);
  const rand = useMemo(() => seededRandom(shroom.id), [shroom.id]);
  const spots = useMemo(() => Array.from({ length: 12 }, () => [rand() - 0.5, rand() - 0.5, 0.7 + rand() * 0.6]), [rand]);

  const count = shroom.stage === 'colonizing' ? 0 : shroom.stage === 'pinning' ? 7 : shroom.stage === 'fruiting' ? 9 : 12;
  const capColor = CAP_COLORS[shroom.species] || '#d6b98c';
  const isLionsMane = shroom.species === "Lion's Mane";

  const bodyColor = shroom.containerType === 'monotub' ? '#d4d4d8' : shroom.containerType === 'grow_bag' ? '#e7e5e4' : '#7c5a3a';
  const isTub = shroom.containerType === 'monotub';
  // Tubs fruit from the substrate surface; bags and blocks fruit from their sides/top
  const fruitBaseY = isTub ? container.height * 0.7 : container.height;
  const colonization = (shroom.myceliumColonization || 80) / 100;

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
      {/* Colonized substrate surface */}
      <mesh position={[0, fruitBaseY - 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[container.length * 0.94, container.width * 0.94]} />
        <meshStandardMaterial color={colonization > 0.6 ? '#f4f4f5' : '#8b6b4a'} roughness={1} />
      </mesh>
      {spots.slice(0, count).map(([sx, sz, sizeVar], i) => {
        const capR = Math.max(0.02, fruitH * 0.45 * sizeVar);
        const x = sx * container.length * 0.8;
        const z = sz * container.width * 0.8;
        if (isLionsMane) {
          return (
            <mesh key={i} position={[x, fruitBaseY + capR, z]} scale={[capR, capR * 1.1, capR]}>
              <icosahedronGeometry args={[1, 1]} />
              <meshStandardMaterial color={capColor} roughness={0.95} flatShading />
            </mesh>
          );
        }
        const stemH = Math.max(0.02, fruitH * 0.55 * sizeVar);
        return (
          <group key={i} position={[x, fruitBaseY, z]}>
            <mesh position={[0, stemH / 2, 0]}>
              <cylinderGeometry args={[capR * 0.18, capR * 0.25, stemH, 6]} />
              <meshStandardMaterial color="#f5f5f4" />
            </mesh>
            <mesh position={[0, stemH, 0]} scale={[capR, capR * 0.4, capR]}>
              <sphereGeometry args={[1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={capColor} roughness={0.7} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
