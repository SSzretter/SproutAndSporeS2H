import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlantItem } from '../../types/sim';
import { getPlantContainerDimensions } from '../../utils/spatial';
import { seededRandom } from './coords';
import { buildPlantSkeleton, getPlantGrowth, layoutPlant, LayoutSite } from './plantLSystem';
import { getLeafCard, LEAF_SHAPE } from './leafCards';

/**
 * Procedural plant at true scale (feet): the pot from containerDimensions, then (from the
 * seedling stage on) an L-system skeleton from plantLSystem.ts unfolded by stage progress and
 * fitted to heightInches × canopyWidthInches, drawn as instanced stems, leaf cards and fruit.
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

// Real leaf size caps (ft) so a big plant's skeleton doesn't blow single leaves up
const MAX_LEAF_FT: Record<string, number> = { Cannabis: 0.75, Tomato: 0.6, 'Chili Pepper': 0.3, Basil: 0.25, Hops: 0.4 };

const STEM_GEO = new THREE.CylinderGeometry(0.75, 1, 1, 6, 1).translate(0, 0.5, 0);
const ROUND_GEO = new THREE.SphereGeometry(1, 10, 8);
// Pod hangs from its base at the origin, tip pointing down
const POD_GEO = new THREE.ConeGeometry(1, 1, 8).rotateX(Math.PI).translate(0, -0.5, 0);
const PLAIN_MAT = new THREE.MeshStandardMaterial({ roughness: 0.8 });
const FRUIT_MAT = new THREE.MeshStandardMaterial({ roughness: 0.4 });

const STEM_GREEN = new THREE.Color('#5a8a2a');
const STEM_WOOD = new THREE.Color('#7a5a36');
const YOUNG_LEAF = new THREE.Color('#9bd46a');
const SENESCENT = new THREE.Color('#d4b83a');

interface FruitInstance {
  pos: THREE.Vector3;
  scale: THREE.Vector3;
  color: THREE.ColorRepresentation;
  pod?: boolean;
}

/** Stage-dependent flowers, buds and fruit at the skeleton's sites (feet). */
function buildFruits(plant: PlantItem, sites: LayoutSite[]): FruitInstance[] {
  const stage = plant.stage;
  if (stage !== 'flowering' && stage !== 'ripening' && stage !== 'ready') return [];
  const p = Math.max(0, Math.min(1, (plant.stageProgress || 0) / 100));
  const flowering = stage === 'flowering';
  const ripe = stage === 'ready' ? 1 : stage === 'ripening' ? p : 0;
  // How filled-out buds/cones/spikes are from first flower to ready
  const fill = flowering ? 0.15 + 0.6 * p : stage === 'ripening' ? 0.75 + 0.25 * p : 1;
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const out: FruitInstance[] = [];

  for (const s of sites) {
    const around = (r: number, i: number, n: number) => {
      const a = s.rand * Math.PI * 2 + (i / n) * Math.PI * 2;
      return v(Math.cos(a) * r, 0, Math.sin(a) * r);
    };
    switch (plant.species) {
      case 'Cannabis': {
        if (!s.tip && s.heightT < 0.4) break;
        const k = (s.tip ? 1 : 0.5) * (s.main && s.tip ? 1.7 : 1) * fill;
        const len = 0.06 + 0.24 * k;
        const color = new THREE.Color('#b8dc9c').lerp(new THREE.Color('#d9c08a'), ripe);
        out.push({ pos: s.pos.clone().add(v(0, len * 0.3, 0)), scale: v(0.025 + 0.05 * k, len / 2, 0.025 + 0.05 * k), color });
        break;
      }
      case 'Tomato': {
        if (s.tip) break;
        for (let i = 0; i < 3; i++) {
          const off = around(0.05, i, 3).add(v(0, -0.07 - i * 0.03, 0));
          if (flowering) {
            out.push({ pos: s.pos.clone().add(off), scale: v(0.018, 0.014, 0.018), color: '#facc15' });
          } else {
            const r = 0.05 + 0.025 * ((s.rand * 7 + i) % 1);
            const t = Math.max(0, Math.min(1, ripe * 1.4 - i * 0.2 + s.rand * 0.15));
            out.push({ pos: s.pos.clone().add(off), scale: v(r, r * 0.9, r), color: new THREE.Color('#6aa84f').lerp(new THREE.Color('#dc2626'), t) });
          }
        }
        break;
      }
      case 'Chili Pepper': {
        if (s.tip) break;
        if (flowering) {
          out.push({ pos: s.pos.clone().add(v(0, -0.02, 0)), scale: v(0.016, 0.012, 0.016), color: '#f5f5f4' });
        } else {
          const len = 0.14 + 0.08 * s.rand;
          const t = Math.max(0, Math.min(1, ripe * 1.3 - s.rand * 0.3));
          out.push({ pos: s.pos.clone().add(v(0, -0.01, 0)), scale: v(0.03, len, 0.03), color: new THREE.Color('#3f8a2e').lerp(new THREE.Color('#dc2626'), t), pod: true });
        }
        break;
      }
      case 'Basil': {
        if (!s.tip) break;
        const len = 0.04 + 0.08 * fill;
        out.push({ pos: s.pos.clone().add(v(0, len / 2, 0)), scale: v(0.018, len / 2, 0.018), color: '#ede9fe' });
        break;
      }
      case 'Hops': {
        if (s.tip && s.main) break;
        const r = 0.02 + 0.018 * fill;
        const color = new THREE.Color('#bef264').lerp(new THREE.Color('#e3e8a6'), ripe);
        for (let i = 0; i < 2; i++) {
          out.push({ pos: s.pos.clone().add(around(0.03, i, 2)).add(v(0, -r * 1.6, 0)), scale: v(r, r * 1.7, r), color });
        }
        break;
      }
    }
  }
  return out;
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpVec = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpColor = new THREE.Color();
const xAxis = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function finishInstances(mesh: THREE.InstancedMesh | null, count: number) {
  if (!mesh) return;
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // Culling and raycasts use these, so they must follow the instances
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
}

/** L-system plant: skeleton derived once per plant, unfolded by growth, fitted to its real size. */
function LSystemFoliage({ plant, heightFt, canopyRadiusFt }: FoliageProps) {
  const skeleton = useMemo(
    () => buildPlantSkeleton(plant.species, plant.id, plant.propagationType),
    [plant.species, plant.id, plant.propagationType]
  );
  const growth = getPlantGrowth(plant);
  // Leaves hang lower when the pot dries out or health drops
  const wilt = Math.max(0, (25 - plant.soilMoisture) / 25) * 35 + Math.max(0, (50 - plant.health) / 50) * 25;
  const layout = useMemo(
    () => layoutPlant(skeleton, { growth, heightFt, canopyRadiusFt, maxLeafFt: MAX_LEAF_FT[plant.species] ?? 0.5, droopDeg: wilt }),
    [skeleton, growth, heightFt, canopyRadiusFt, plant.species, wilt]
  );
  const { stage, stageProgress, health, species } = plant;
  const fruits = useMemo(() => buildFruits(plant, layout.sites), [plant, layout]);

  const leafCard = getLeafCard(LEAF_SHAPE[species] || 'ovate');
  const cotyledonCard = getLeafCard('ovate');
  const segmentCapacity = Math.max(1, skeleton.segments.length);
  const leafCapacity = Math.max(1, skeleton.leaves.length);
  const fruitCapacity = Math.max(1, skeleton.sites.length * 3);

  const stemRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const cotyledonRef = useRef<THREE.InstancedMesh>(null);
  const roundRef = useRef<THREE.InstancedMesh>(null);
  const podRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const stemMesh = stemRef.current;
    if (stemMesh) {
      layout.stems.forEach((s, i) => {
        const d = tmpVec.subVectors(s.end, s.start);
        const len = d.length();
        tmpQuat.setFromUnitVectors(Y_AXIS, len > 1e-6 ? d.divideScalar(len) : Y_AXIS);
        tmpMatrix.compose(s.start, tmpQuat, tmpScale.set(s.radius, Math.max(1e-4, len), s.radius));
        stemMesh.setMatrixAt(i, tmpMatrix);
        stemMesh.setColorAt(i, tmpColor.copy(STEM_GREEN).lerp(STEM_WOOD, s.woody * 0.8));
      });
      finishInstances(stemMesh, layout.stems.length);
    }

    // Older leaves yellow as the plant ripens
    const senesce = stage === 'ripening' ? (0.6 * stageProgress) / 100 : stage === 'ready' ? 0.65 : 0;
    const base = new THREE.Color(healthTint(LEAF_GREEN[species] || '#3f8a2e', health));
    let leafCount = 0;
    let cotyledonCount = 0;
    for (const l of layout.leaves) {
      const mesh = l.cotyledon ? cotyledonRef.current : leafRef.current;
      if (!mesh) continue;
      const i = l.cotyledon ? cotyledonCount++ : leafCount++;
      if (i >= mesh.instanceMatrix.count) continue;
      xAxis.crossVectors(l.normal, l.dir);
      tmpMatrix.makeBasis(xAxis, l.normal, l.dir).scale(tmpScale.setScalar(Math.max(1e-4, l.lengthFt))).setPosition(l.pos);
      mesh.setMatrixAt(i, tmpMatrix);
      tmpColor.copy(base).offsetHSL((l.rand - 0.5) * 0.03, 0, (l.rand - 0.5) * 0.08);
      tmpColor.lerp(YOUNG_LEAF, (1 - l.unfold) * 0.5);
      if (senesce > 0) tmpColor.lerp(SENESCENT, senesce * (1 - l.age));
      mesh.setColorAt(i, tmpColor);
    }
    finishInstances(leafRef.current, Math.min(leafCount, leafCapacity));
    finishInstances(cotyledonRef.current, Math.min(cotyledonCount, 2));

    let roundCount = 0;
    let podCount = 0;
    for (const f of fruits) {
      const mesh = f.pod ? podRef.current : roundRef.current;
      if (!mesh) continue;
      const i = f.pod ? podCount++ : roundCount++;
      if (i >= fruitCapacity) continue;
      tmpMatrix.compose(f.pos, tmpQuat.identity(), f.scale);
      mesh.setMatrixAt(i, tmpMatrix);
      mesh.setColorAt(i, tmpColor.set(f.color));
    }
    finishInstances(roundRef.current, Math.min(roundCount, fruitCapacity));
    finishInstances(podRef.current, Math.min(podCount, fruitCapacity));
  }, [layout, fruits, leafCapacity, fruitCapacity, health, stage, stageProgress, species]);

  return (
    <group>
      {/* Keys remount a mesh when its capacity changes (a new skeleton) */}
      <instancedMesh key={`stem-${segmentCapacity}`} ref={stemRef} args={[STEM_GEO, PLAIN_MAT, segmentCapacity]} />
      <instancedMesh key={`leaf-${species}-${leafCapacity}`} ref={leafRef} args={[leafCard.geometry, leafCard.material, leafCapacity]} />
      <instancedMesh ref={cotyledonRef} args={[cotyledonCard.geometry, cotyledonCard.material, 2]} />
      <instancedMesh key={`round-${fruitCapacity}`} ref={roundRef} args={[ROUND_GEO, FRUIT_MAT, fruitCapacity]} />
      <instancedMesh key={`pod-${fruitCapacity}`} ref={podRef} args={[POD_GEO, FRUIT_MAT, fruitCapacity]} />
      {species === 'Tomato' && (
        // Wire tomato cage
        [0.33, 0.66, 0.95].map((t, i) => (
          <mesh key={i} position={[0, heightFt * t, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[canopyRadiusFt * (0.75 + t * 0.2), 0.012, 4, 20]} />
            <meshStandardMaterial color="#a1a1aa" metalness={0.6} roughness={0.4} />
          </mesh>
        ))
      )}
      {species === 'Hops' && (
        // Trellis twine
        <mesh position={[0, heightFt * 0.55, 0]}>
          <cylinderGeometry args={[0.006, 0.006, heightFt * 1.1, 4]} />
          <meshStandardMaterial color="#d6d3d1" />
        </mesh>
      )}
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
          : <LSystemFoliage {...props} />}
      </group>
    </group>
  );
}
