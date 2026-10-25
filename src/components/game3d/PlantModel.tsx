import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlantItem } from '../../types/sim';
import { getPlantContainerDimensions } from '../../utils/spatial';
import { seededRandom } from './coords';

/**
 * Procedural low-poly plant at true scale (feet): the pot from containerDimensions,
 * foliage sized to heightInches × canopyWidthInches, with species & stage detail.
 * The group origin is the pot's base center.
 */

const LEAF_GREEN: Record<string, string> = {
  Cannabis: '#2f8f3a',
  Tomato: '#3f8a2e',
  'Chili Pepper': '#3b7d2a',
  Basil: '#5cb83a',
  Hops: '#4d8f2c'
};

function moistureSoilColor(moisture: number): string {
  return moisture > 50 ? '#2a1d12' : moisture > 25 ? '#3d2b1f' : '#6b5344';
}

/** Blend leaf color toward a sickly yellow as health drops below 75%. */
function healthTint(base: string, health: number): string {
  const c = new THREE.Color(base);
  const t = Math.max(0, Math.min(1, (75 - health) / 55));
  return '#' + c.lerp(new THREE.Color('#c9b03a'), t).getHexString();
}

function Pot({ plant }: { plant: PlantItem }) {
  const pot = plant.containerDimensions || getPlantContainerDimensions(plant.containerType, plant.containerVolumeGallons);
  const r = pot.length / 2;
  const h = Math.max(0.05, pot.height);
  const soil = moistureSoilColor(plant.soilMoisture);
  const type = plant.containerType || 'fabric_pot';

  if (type === 'raised_bed_cedar' || type === 'flood_drain_tray' || type === 'aeroponic_chamber') {
    const color = type === 'raised_bed_cedar' ? '#8a4b1f' : type === 'flood_drain_tray' ? '#d4d4d8' : '#e4e4e7';
    return (
      <group>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[pot.length, h, pot.width]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
        <mesh position={[0, h + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[pot.length * 0.92, pot.width * 0.92]} />
          <meshStandardMaterial color={type === 'raised_bed_cedar' ? soil : '#9a3412'} roughness={1} />
        </mesh>
      </group>
    );
  }

  if (type === 'in_ground_earth') {
    return (
      <mesh position={[0, 0, 0]} scale={[r, h, pot.width / 2]}>
        <sphereGeometry args={[1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={soil} roughness={1} />
      </mesh>
    );
  }

  const potColor = type === 'terracotta_pot' ? '#c2410c' : type === 'dwc_reservoir_bucket' ? '#18181b' : type === 'plastic_nursery_pot' ? '#1f2937' : '#2a2a2e';
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[r, r * 0.86, h, 20]} />
        <meshStandardMaterial color={potColor} roughness={type === 'fabric_pot' ? 1 : 0.6} />
      </mesh>
      <mesh position={[0, h * 0.94, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r * 0.94, 20]} />
        <meshStandardMaterial color={type === 'dwc_reservoir_bucket' ? '#9a3412' : soil} roughness={1} />
      </mesh>
    </group>
  );
}

interface FoliageProps {
  plant: PlantItem;
  heightFt: number;
  canopyRadiusFt: number;
}

function Stem({ heightFt, radius = 0.03 }: { heightFt: number; radius?: number }) {
  return (
    <mesh position={[0, heightFt / 2, 0]}>
      <cylinderGeometry args={[radius * 0.7, radius, heightFt, 6]} />
      <meshStandardMaterial color="#4d7c0f" roughness={0.9} />
    </mesh>
  );
}

function Sprout({ plant, heightFt }: FoliageProps) {
  const h = Math.max(0.03, heightFt);
  if (plant.stage === 'rooting') {
    // Cutting under a clear humidity dome
    return (
      <group>
        <Stem heightFt={h} radius={0.02} />
        {[0, 1, 2].map(i => (
          <mesh key={i} position={[Math.cos(i * 2.1) * 0.06, h * 0.8, Math.sin(i * 2.1) * 0.06]} scale={[0.09, 0.02, 0.05]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color={healthTint('#3f9a3a', plant.health)} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[Math.max(0.2, h * 0.9), 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#dbeafe" transparent opacity={0.22} roughness={0.1} />
        </mesh>
      </group>
    );
  }
  // Germinating seed: hooked shoot with two cotyledons
  return (
    <group>
      <Stem heightFt={h} radius={0.012} />
      <mesh position={[-0.025, h, 0]} scale={[0.03, 0.01, 0.02]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#84cc16" />
      </mesh>
      <mesh position={[0.025, h, 0]} scale={[0.03, 0.01, 0.02]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#84cc16" />
      </mesh>
    </group>
  );
}

/** Cannabis: tapering conical canopy with fan-leaf tiers, buds/colas once flowering. */
function CannabisFoliage({ plant, heightFt, canopyRadiusFt }: FoliageProps) {
  const leaf = healthTint(LEAF_GREEN.Cannabis, plant.health);
  const tiers = Math.max(2, Math.min(6, Math.round(heightFt * 1.6)));
  const flowering = plant.stage === 'flowering' || plant.stage === 'ripening' || plant.stage === 'ready';
  const budColor = plant.stage === 'flowering' ? '#c8e6b0' : '#e8d9a8';
  const rand = useMemo(() => seededRandom(plant.id), [plant.id]);
  const budOffsets = useMemo(() => Array.from({ length: 6 }, () => [rand() * Math.PI * 2, 0.55 + rand() * 0.35]), [rand]);

  return (
    <group>
      <Stem heightFt={heightFt} radius={Math.max(0.02, canopyRadiusFt * 0.05)} />
      {Array.from({ length: tiers }, (_, i) => {
        const t = i / tiers;
        const tierH = heightFt / tiers;
        const radius = canopyRadiusFt * (1 - t * 0.75);
        return (
          <mesh key={i} position={[0, heightFt * 0.18 + t * heightFt * 0.78 + tierH * 0.4, 0]}>
            <coneGeometry args={[radius, tierH * 1.3, 9]} />
            <meshStandardMaterial color={leaf} roughness={0.8} flatShading />
          </mesh>
        );
      })}
      {flowering && (
        <>
          <mesh position={[0, heightFt * 0.98, 0]} scale={[canopyRadiusFt * 0.18, heightFt * 0.12, canopyRadiusFt * 0.18]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color={budColor} roughness={0.5} />
          </mesh>
          {budOffsets.map(([angle, heightT], i) => (
            <mesh
              key={i}
              position={[Math.cos(angle) * canopyRadiusFt * 0.55 * (1 - heightT * 0.6), heightFt * heightT, Math.sin(angle) * canopyRadiusFt * 0.55 * (1 - heightT * 0.6)]}
              scale={[canopyRadiusFt * 0.1, heightFt * 0.06, canopyRadiusFt * 0.1]}
            >
              <sphereGeometry args={[1, 8, 6]} />
              <meshStandardMaterial color={budColor} roughness={0.5} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

/** Rounded bushes (Tomato, Chili Pepper, Basil) built from foliage clumps, with fruit or flower spikes. */
function BushFoliage({ plant, heightFt, canopyRadiusFt }: FoliageProps) {
  const leaf = healthTint(LEAF_GREEN[plant.species] || '#3f8a2e', plant.health);
  const rand = useMemo(() => seededRandom(plant.id), [plant.id]);
  const clumps = useMemo(() => Array.from({ length: 9 }, () => ({
    angle: rand() * Math.PI * 2,
    radial: 0.35 + rand() * 0.55,
    heightT: 0.25 + rand() * 0.75,
    size: 0.35 + rand() * 0.25
  })), [rand]);
  const fruits = useMemo(() => Array.from({ length: 10 }, () => ({
    angle: rand() * Math.PI * 2,
    radial: 0.6 + rand() * 0.45,
    heightT: 0.2 + rand() * 0.7
  })), [rand]);

  const stage = plant.stage;
  const showFlowers = stage === 'flowering';
  const showFruit = stage === 'ripening' || stage === 'ready';
  const isTomato = plant.species === 'Tomato';
  const isPepper = plant.species === 'Chili Pepper';
  const isBasil = plant.species === 'Basil';
  const fruitColor = isTomato ? '#dc2626' : isPepper ? '#ef4444' : '#f5f5f4';

  return (
    <group>
      <Stem heightFt={heightFt * 0.9} radius={Math.max(0.02, canopyRadiusFt * 0.06)} />
      {isTomato && (
        // Wire tomato cage
        [0.33, 0.66, 0.95].map((t, i) => (
          <mesh key={i} position={[0, heightFt * t, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[canopyRadiusFt * (0.75 + t * 0.2), 0.012, 4, 20]} />
            <meshStandardMaterial color="#a1a1aa" metalness={0.6} roughness={0.4} />
          </mesh>
        ))
      )}
      {clumps.map((c, i) => {
        const radial = canopyRadiusFt * c.radial * (isBasil ? 0.75 : 0.65);
        const clumpR = Math.max(0.05, canopyRadiusFt * c.size * (isBasil ? 0.7 : 0.6));
        return (
          <mesh
            key={i}
            position={[Math.cos(c.angle) * radial, Math.max(clumpR * 0.6, heightFt * c.heightT - clumpR * 0.3), Math.sin(c.angle) * radial]}
            scale={[clumpR, Math.min(clumpR, heightFt * 0.35), clumpR]}
          >
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={leaf} roughness={0.85} flatShading />
          </mesh>
        );
      })}
      {(showFlowers || showFruit) && fruits.map((f, i) => {
        const pos: [number, number, number] = [
          Math.cos(f.angle) * canopyRadiusFt * f.radial * 0.7,
          heightFt * f.heightT,
          Math.sin(f.angle) * canopyRadiusFt * f.radial * 0.7
        ];
        if (showFlowers || isBasil) {
          return (
            <mesh key={i} position={pos} scale={isBasil ? [0.025, 0.08, 0.025] : [0.03, 0.03, 0.03]}>
              <sphereGeometry args={[1, 6, 5]} />
              <meshStandardMaterial color={isBasil ? '#f5f5f4' : '#facc15'} />
            </mesh>
          );
        }
        return isPepper ? (
          <mesh key={i} position={pos} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.035, 0.16, 6]} />
            <meshStandardMaterial color={fruitColor} roughness={0.35} />
          </mesh>
        ) : (
          <mesh key={i} position={pos}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshStandardMaterial color={fruitColor} roughness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Hops: twining bine climbing a trellis string to full height, cones once flowering. */
function HopsFoliage({ plant, heightFt, canopyRadiusFt }: FoliageProps) {
  const leaf = healthTint(LEAF_GREEN.Hops, plant.health);
  const nodes = Math.max(3, Math.min(28, Math.round(heightFt * 1.8)));
  const hasCones = plant.stage === 'flowering' || plant.stage === 'ripening' || plant.stage === 'ready';
  const coneColor = plant.stage === 'flowering' ? '#bef264' : '#d9f99d';

  return (
    <group>
      {/* Trellis twine */}
      <mesh position={[0, heightFt * 0.55, 0]}>
        <cylinderGeometry args={[0.006, 0.006, heightFt * 1.1, 4]} />
        <meshStandardMaterial color="#d6d3d1" />
      </mesh>
      {Array.from({ length: nodes }, (_, i) => {
        const t = (i + 1) / nodes;
        const angle = i * 1.9;
        const spread = canopyRadiusFt * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
        return (
          <group key={i} position={[0, heightFt * t, 0]} rotation={[0, angle, 0]}>
            <mesh position={[spread * 0.5, 0, 0]} scale={[spread * 0.5, 0.05, 0.12]}>
              <sphereGeometry args={[1, 8, 6]} />
              <meshStandardMaterial color={leaf} roughness={0.85} flatShading />
            </mesh>
            {hasCones && i % 2 === 0 && (
              <mesh position={[spread * 0.75, -0.1, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.05, 0.14, 7]} />
                <meshStandardMaterial color={coneColor} roughness={0.6} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function PlantModel({ plant }: { plant: PlantItem }) {
  const pot = plant.containerDimensions || getPlantContainerDimensions(plant.containerType, plant.containerVolumeGallons);
  const soilY = Math.max(0.05, pot.height) * 0.94;
  const heightFt = Math.max(0.03, plant.heightInches / 12);
  const canopyRadiusFt = Math.max(0.03, plant.canopyWidthInches / 24);
  const swayRef = useRef<THREE.Group>(null);
  const phase = useMemo(() => seededRandom(plant.id)() * Math.PI * 2, [plant.id]);

  useFrame(({ clock }) => {
    if (!swayRef.current) return;
    const t = clock.getElapsedTime();
    swayRef.current.rotation.z = Math.sin(t * 0.9 + phase) * 0.025;
    swayRef.current.rotation.x = Math.cos(t * 0.7 + phase) * 0.02;
  });

  const props: FoliageProps = { plant, heightFt, canopyRadiusFt };
  const isSprout = plant.stage === 'germination' || plant.stage === 'rooting';

  return (
    <group>
      <Pot plant={plant} />
      <group ref={swayRef} position={[0, soilY, 0]}>
        {isSprout ? <Sprout {...props} />
          : plant.species === 'Hops' ? <HopsFoliage {...props} />
          : plant.species === 'Cannabis' ? <CannabisFoliage {...props} />
          : <BushFoliage {...props} />}
      </group>
    </group>
  );
}
