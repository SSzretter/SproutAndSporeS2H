import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Item, PersonItem, PersonRole } from '../../types/sim';
import { ROLE_METADATA } from '../../utils/npcWorker';

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

export interface FigureProps {
  heightFt: number;
  shirt: string;
  pants?: string;
  hat?: string;
  hatStyle?: 'straw' | 'hardhat' | 'cap' | 'cylinder';
  hasToolbelt?: boolean;
  hasSatchel?: boolean;
  heldTool?: 'watering_can' | 'mister' | 'shears' | 'wrench' | 'mug';
  isWorking?: boolean;
}

/**
 * Procedural 3D humanoid figure with animated joints, specialized uniforms, hats, and tools.
 */
export function Figure({
  heightFt,
  shirt,
  pants = '#1e293b',
  hat,
  hatStyle = 'cap',
  hasToolbelt,
  hasSatchel,
  heldTool,
  isWorking
}: FigureProps) {
  const legH = heightFt * 0.45;
  const torsoH = heightFt * 0.33;
  const headR = heightFt * 0.075;
  const armL = heightFt * 0.32;
  const armR = heightFt * 0.03;

  const rightArmRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (isWorking && rightArmRef.current) {
      // Tending / working action motion
      rightArmRef.current.rotation.x = -Math.PI / 3 + Math.sin(t * 3.5) * 0.25;
      rightArmRef.current.rotation.z = -0.15 + Math.cos(t * 3.5) * 0.1;
    } else if (rightArmRef.current) {
      // Gentle idle sway
      rightArmRef.current.rotation.x = Math.sin(t * 1.5) * 0.05;
      rightArmRef.current.rotation.z = -0.08;
    }

    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = -Math.sin(t * 1.5) * 0.05;
      leftArmRef.current.rotation.z = 0.08;
    }

    if (headRef.current) {
      // Subtle natural glance
      headRef.current.rotation.y = Math.sin(t * 0.6) * 0.15;
    }
  });

  return (
    <group>
      {/* Legs (trouser cuffs) */}
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * heightFt * 0.045, legH / 2, 0]}>
          <capsuleGeometry args={[heightFt * 0.035, legH - heightFt * 0.07, 4, 8]} />
          <meshStandardMaterial color={pants} roughness={0.7} />
        </mesh>
      ))}

      {/* Torso / Shirt */}
      <mesh position={[0, legH + torsoH / 2, 0]}>
        <capsuleGeometry args={[heightFt * 0.09, torsoH - heightFt * 0.12, 4, 10]} />
        <meshStandardMaterial color={shirt} roughness={0.6} />
      </mesh>

      {/* Toolbelt (if equipped) */}
      {hasToolbelt && (
        <group position={[0, legH + torsoH * 0.15, 0]}>
          <mesh>
            <cylinderGeometry args={[heightFt * 0.1, heightFt * 0.1, heightFt * 0.05, 12]} />
            <meshStandardMaterial color="#27272a" />
          </mesh>
          {/* Tool pouches */}
          <mesh position={[heightFt * 0.09, 0, 0]}>
            <boxGeometry args={[heightFt * 0.04, heightFt * 0.06, heightFt * 0.05]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
          <mesh position={[-heightFt * 0.09, 0, 0]}>
            <boxGeometry args={[heightFt * 0.04, heightFt * 0.06, heightFt * 0.05]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
        </group>
      )}

      {/* Satchel (Harvest / Grower pouch) */}
      {hasSatchel && (
        <mesh position={[heightFt * 0.08, legH + torsoH * 0.25, heightFt * 0.04]} rotation={[0, 0, -0.2]}>
          <boxGeometry args={[heightFt * 0.09, heightFt * 0.1, heightFt * 0.06]} />
          <meshStandardMaterial color="#854d0e" />
        </mesh>
      )}

      {/* Head Group */}
      <group ref={headRef} position={[0, legH + torsoH + headR * 1.1, 0]}>
        {/* Face / Head */}
        <mesh>
          <sphereGeometry args={[headR, 14, 10]} />
          <meshStandardMaterial color="#f2c7a0" roughness={0.5} />
        </mesh>

        {/* Eyes (stylized dots) */}
        <mesh position={[-headR * 0.35, headR * 0.1, headR * 0.88]}>
          <sphereGeometry args={[headR * 0.1, 8, 8]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh position={[headR * 0.35, headR * 0.1, headR * 0.88]}>
          <sphereGeometry args={[headR * 0.1, 8, 8]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>

        {/* Hats based on role / style */}
        {hat && hatStyle === 'straw' && (
          <group position={[0, headR * 0.4, 0]}>
            {/* Wide brim */}
            <mesh rotation={[-0.05, 0, 0]}>
              <cylinderGeometry args={[headR * 2.1, headR * 2.2, headR * 0.1, 16]} />
              <meshStandardMaterial color={hat} roughness={0.9} />
            </mesh>
            {/* Crown */}
            <mesh position={[0, headR * 0.45, 0]}>
              <cylinderGeometry args={[headR * 1.0, headR * 1.1, headR * 0.8, 14]} />
              <meshStandardMaterial color={hat} roughness={0.9} />
            </mesh>
          </group>
        )}

        {hat && hatStyle === 'hardhat' && (
          <group position={[0, headR * 0.45, 0]}>
            <mesh>
              <sphereGeometry args={[headR * 1.1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshStandardMaterial color={hat} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, headR * 0.4]} rotation={[-0.15, 0, 0]}>
              <boxGeometry args={[headR * 1.8, headR * 0.1, headR * 0.5]} />
              <meshStandardMaterial color={hat} roughness={0.4} />
            </mesh>
          </group>
        )}

        {hat && (hatStyle === 'cap' || hatStyle === 'cylinder') && (
          <group position={[0, headR * 0.5, 0]}>
            <mesh>
              <cylinderGeometry args={[headR * 0.95, headR * 1.05, headR * 0.6, 14]} />
              <meshStandardMaterial color={hat} roughness={0.6} />
            </mesh>
            {/* Cap visor */}
            <mesh position={[0, -headR * 0.15, headR * 0.8]} rotation={[-0.2, 0, 0]}>
              <boxGeometry args={[headR * 1.4, headR * 0.08, headR * 0.6]} />
              <meshStandardMaterial color={hat} roughness={0.6} />
            </mesh>
          </group>
        )}
      </group>

      {/* Left Arm */}
      <group ref={leftArmRef} position={[-heightFt * 0.11, legH + torsoH * 0.85, 0]}>
        <mesh position={[0, -armL * 0.45, 0]}>
          <capsuleGeometry args={[armR, armL * 0.7, 4, 8]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        <mesh position={[0, -armL * 0.9, 0]}>
          <sphereGeometry args={[armR * 1.1, 8, 8]} />
          <meshStandardMaterial color="#f2c7a0" />
        </mesh>
      </group>

      {/* Right Arm (holds tools!) */}
      <group ref={rightArmRef} position={[heightFt * 0.11, legH + torsoH * 0.85, 0]}>
        <mesh position={[0, -armL * 0.45, 0]}>
          <capsuleGeometry args={[armR, armL * 0.7, 4, 8]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        <mesh position={[0, -armL * 0.9, 0]}>
          <sphereGeometry args={[armR * 1.1, 8, 8]} />
          <meshStandardMaterial color="#f2c7a0" />
        </mesh>

        {/* Held Tool in Hand */}
        {heldTool === 'watering_can' && (
          <group position={[0, -armL * 0.95, heightFt * 0.05]} rotation={[0.4, 0, 0]}>
            {/* Can Body */}
            <mesh>
              <cylinderGeometry args={[heightFt * 0.05, heightFt * 0.06, heightFt * 0.12, 10]} />
              <meshStandardMaterial color="#10b981" roughness={0.4} />
            </mesh>
            {/* Spout */}
            <mesh position={[0, heightFt * 0.03, heightFt * 0.08]} rotation={[-0.6, 0, 0]}>
              <cylinderGeometry args={[heightFt * 0.012, heightFt * 0.02, heightFt * 0.12, 8]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Handle */}
            <mesh position={[0, heightFt * 0.04, -heightFt * 0.04]} rotation={[0.5, 0, 0]}>
              <torusGeometry args={[heightFt * 0.04, heightFt * 0.008, 6, 12, Math.PI]} />
              <meshStandardMaterial color="#059669" />
            </mesh>
          </group>
        )}

        {heldTool === 'mister' && (
          <group position={[0, -armL * 0.95, heightFt * 0.04]} rotation={[0.2, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[heightFt * 0.03, heightFt * 0.035, heightFt * 0.1, 8]} />
              <meshStandardMaterial color="#38bdf8" transparent opacity={0.8} />
            </mesh>
            <mesh position={[0, heightFt * 0.06, 0]}>
              <boxGeometry args={[heightFt * 0.02, heightFt * 0.03, heightFt * 0.04]} />
              <meshStandardMaterial color="#0284c7" />
            </mesh>
          </group>
        )}

        {heldTool === 'shears' && (
          <group position={[0, -armL * 0.95, heightFt * 0.03]} rotation={[0.3, 0, 0]}>
            <mesh position={[0, 0, heightFt * 0.04]}>
              <boxGeometry args={[heightFt * 0.01, heightFt * 0.015, heightFt * 0.08]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, -heightFt * 0.02]}>
              <boxGeometry args={[heightFt * 0.02, heightFt * 0.03, heightFt * 0.04]} />
              <meshStandardMaterial color="#f43f5e" />
            </mesh>
          </group>
        )}

        {heldTool === 'wrench' && (
          <group position={[0, -armL * 0.95, heightFt * 0.03]} rotation={[0.3, 0, 0]}>
            <mesh>
              <boxGeometry args={[heightFt * 0.015, heightFt * 0.02, heightFt * 0.12]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        )}

        {heldTool === 'mug' && (
          <group position={[0, -armL * 0.95, heightFt * 0.04]}>
            <mesh>
              <cylinderGeometry args={[heightFt * 0.025, heightFt * 0.025, heightFt * 0.06, 8]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

/**
 * Animated 3D NPC Character Model representing a resident or worker in the facility.
 */
export function NpcCharacterModel({ person }: { person: PersonItem }) {
  const groupRef = useRef<THREE.Group>(null);
  const role: PersonRole = person.role || 'resident';
  const meta = ROLE_METADATA[role] || ROLE_METADATA.resident;

  const heightFt = Math.max(3.2, person.dimensions?.height || 5.8);
  const shirtColor = person.shirtColor || meta.shirtColor;
  const hatColor = person.hatColor || meta.hatColor;

  const hatStyle = 
    role === 'grower' ? 'straw' :
    role === 'technician' ? 'hardhat' :
    role === 'caretaker' ? 'cap' : 'cap';

  const action = (person.currentAction || '').toLowerCase();
  const isWorking = action.includes('water') || action.includes('mist') || action.includes('refill') || action.includes('harvest') || action.includes('feed');

  // Determine which tool to display in hand based on action and role
  const heldTool: FigureProps['heldTool'] = 
    action.includes('water') ? 'watering_can' :
    action.includes('mist') ? 'mister' :
    action.includes('harvest') ? 'shears' :
    action.includes('refill') || action.includes('empty') || role === 'technician' ? 'wrench' :
    role === 'grower' ? 'watering_can' :
    role === 'harvester' ? 'shears' :
    role === 'resident' ? 'mug' : 'wrench';

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    // Gentle idle bob
    groupRef.current.position.y = Math.sin(t * 1.8) * 0.02;
  });

  return (
    <group ref={groupRef}>
      {/* Ground soft shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[0.65, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>

      <Figure
        heightFt={heightFt}
        shirt={shirtColor}
        pants={role === 'technician' ? '#1e3a8a' : role === 'grower' ? '#78716c' : '#1e293b'}
        hat={hatColor}
        hatStyle={hatStyle}
        hasToolbelt={role === 'technician' || role === 'caretaker'}
        hasSatchel={role === 'harvester' || role === 'grower'}
        heldTool={heldTool}
        isWorking={isWorking}
      />
    </group>
  );
}

export function OccupantModel({ occ }: { occ: Item }) {
  if (occ.category === 'person') {
    return <NpcCharacterModel person={occ as PersonItem} />;
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
        <Figure heightFt={5.6} shirt="#059669" hat="#166534" hatStyle="cap" />
      </group>
    </group>
  );
}
