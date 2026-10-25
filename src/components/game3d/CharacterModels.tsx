import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Item } from '../../types/sim';

/** Cultivator avatar state, in room-floor feet (x → world X, y → world Z). */
export interface PlayerState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing: number; // yaw in radians (0 = facing +Z / toward the front wall)
  isMoving: boolean;
  walkFrame: number;
  stepTimer: number;
}

function Figure({ heightFt, shirt, hat }: { heightFt: number; shirt: string; hat?: string }) {
  const legH = heightFt * 0.45;
  const torsoH = heightFt * 0.33;
  const headR = heightFt * 0.075;
  return (
    <group>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * heightFt * 0.045, legH / 2, 0]}>
          <capsuleGeometry args={[heightFt * 0.035, legH - heightFt * 0.07, 4, 8]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      ))}
      <mesh position={[0, legH + torsoH / 2, 0]}>
        <capsuleGeometry args={[heightFt * 0.09, torsoH - heightFt * 0.12, 4, 10]} />
        <meshStandardMaterial color={shirt} />
      </mesh>
      <mesh position={[0, legH + torsoH + headR * 1.1, 0]}>
        <sphereGeometry args={[headR, 14, 10]} />
        <meshStandardMaterial color="#f2c7a0" />
      </mesh>
      {hat && (
        <mesh position={[0, legH + torsoH + headR * 1.9, 0]}>
          <cylinderGeometry args={[headR * 0.9, headR * 1.6, headR * 0.6, 14]} />
          <meshStandardMaterial color={hat} />
        </mesh>
      )}
    </group>
  );
}

export function OccupantModel({ occ }: { occ: Item }) {
  if (occ.category === 'person') {
    return <Figure heightFt={Math.max(3, occ.dimensions.height)} shirt="#7c3aed" />;
  }
  // Pet: four-legged body sized to its dimensions
  const { length: L, width: W, height: H } = occ.dimensions;
  const color = occ.category === 'pet' && occ.petType === 'cat' ? '#f59e0b' : '#a16207';
  const legH = H * 0.4;
  return (
    <group>
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * L * 0.3, legH / 2, sz * W * 0.25]}>
          <cylinderGeometry args={[W * 0.08, W * 0.08, legH, 6]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <mesh position={[0, legH + H * 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[W * 0.3, L * 0.5, 4, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[L * 0.45, legH + H * 0.42, 0]}>
        <sphereGeometry args={[W * 0.3, 12, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

export function PlayerAvatar({ playerRef }: { playerRef: React.MutableRefObject<PlayerState> }) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const p = playerRef.current;
    if (!groupRef.current || !bodyRef.current) return;
    groupRef.current.position.set(p.x, 0, p.y);
    // Turn smoothly toward the walking direction
    const current = groupRef.current.rotation.y;
    let diff = p.facing - current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    groupRef.current.rotation.y = current + diff * 0.25;
    bodyRef.current.position.y = p.isMoving ? Math.abs(Math.sin(p.walkFrame * 1.6)) * 0.08 : 0;
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.6, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} />
      </mesh>
      <group ref={bodyRef}>
        <Figure heightFt={5.6} shirt="#059669" hat="#166534" />
      </group>
    </group>
  );
}
