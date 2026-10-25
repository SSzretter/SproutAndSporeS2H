import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EquipmentItem } from '../../types/sim';

/**
 * Low-poly equipment at true scale (item.dimensions L × W × H in feet).
 * Group origin is the item's base center. `hangFt` is the drop from the item's top to the
 * container ceiling, used to draw hanging cords for ceiling-mounted gear.
 */

function SpinningBlades({ radius, on, axis = 'z' }: { radius: number; on: boolean; axis?: 'x' | 'z' }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current && on) ref.current.rotation[axis] += delta * 14;
  });
  return (
    <group ref={ref}>
      {[0, 1, 2].map(i => (
        <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]} position={[0, 0, 0]}>
          <boxGeometry args={[radius * 0.32, radius * 1.8, 0.01]} />
          <meshStandardMaterial color="#38bdf8" />
        </mesh>
      ))}
    </group>
  );
}

function MistPlume({ topY, on }: { topY: number; on: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.position.y = topY + 0.25 + Math.sin(t * 2) * 0.05;
    ref.current.scale.setScalar(0.18 + (Math.sin(t * 3) + 1) * 0.03);
  });
  if (!on) return null;
  return (
    <mesh ref={ref} position={[0, topY + 0.25, 0]}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshStandardMaterial color="#e0f2fe" transparent opacity={0.35} />
    </mesh>
  );
}

function HangingCords({ length, width, topY, hangFt }: { length: number; width: number; topY: number; hangFt: number }) {
  if (hangFt <= 0.05) return null;
  const corners: Array<[number, number]> = [[-length * 0.4, -width * 0.4], [length * 0.4, -width * 0.4], [-length * 0.4, width * 0.4], [length * 0.4, width * 0.4]];
  return (
    <>
      {corners.map(([x, z], i) => (
        <mesh key={i} position={[x, topY + hangFt / 2, z]}>
          <cylinderGeometry args={[0.008, 0.008, hangFt, 4]} />
          <meshStandardMaterial color="#52525b" />
        </mesh>
      ))}
    </>
  );
}

export function EquipmentModel({ eq, hangFt = 0 }: { eq: EquipmentItem; hangFt?: number }) {
  const { length: L, width: W, height: H } = eq.dimensions;
  const h = Math.max(0.04, H);
  const on = eq.powerOn;

  switch (eq.type) {
    case 'grow_light':
      return (
        <group>
          <HangingCords length={L} width={W} topY={h} hangFt={hangFt} />
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[L, h, W]} />
            <meshStandardMaterial color="#d4d4d8" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[L * 0.94, W * 0.94]} />
            <meshStandardMaterial
              color={on ? '#fff7d6' : '#71717a'}
              emissive={on ? '#ffe9a8' : '#000000'}
              emissiveIntensity={on ? 1.6 : 0}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      );
    case 'exhaust_fan': {
      const r = Math.min(W, h) / 2;
      return (
        <group>
          <HangingCords length={L * 0.5} width={0.01} topY={h} hangFt={hangFt} />
          <mesh position={[0, h / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[r, r, L * 0.6, 16]} />
            <meshStandardMaterial color="#3f3f46" metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, h / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[r * 0.55, r * 0.55, L, 12]} />
            <meshStandardMaterial color="#71717a" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[L * 0.31, h / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[r * 0.18, 10]} />
            <meshStandardMaterial color={on ? '#10b981' : '#52525b'} emissive={on ? '#10b981' : '#000000'} emissiveIntensity={0.8} />
          </mesh>
        </group>
      );
    }
    case 'humidifier':
      return (
        <group>
          <mesh position={[0, h * 0.45, 0]}>
            <cylinderGeometry args={[L * 0.45, L * 0.5, h * 0.9, 18]} />
            <meshStandardMaterial color="#f4f4f5" roughness={0.4} />
          </mesh>
          <mesh position={[0, h * 0.75, 0]}>
            <cylinderGeometry args={[L * 0.42, L * 0.42, h * 0.3, 18]} />
            <meshStandardMaterial color="#7dd3fc" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, h * 0.95, 0]}>
            <cylinderGeometry args={[L * 0.12, L * 0.12, h * 0.1, 10]} />
            <meshStandardMaterial color="#a1a1aa" />
          </mesh>
          <MistPlume topY={h} on={on} />
        </group>
      );
    case 'dehumidifier':
      return (
        <group>
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[L, h, W]} />
            <meshStandardMaterial color="#e4e4e7" roughness={0.5} />
          </mesh>
          {[0.25, 0.4, 0.55, 0.7].map(t => (
            <mesh key={t} position={[0, h * t, W / 2 + 0.002]}>
              <planeGeometry args={[L * 0.7, h * 0.05]} />
              <meshStandardMaterial color="#52525b" />
            </mesh>
          ))}
          <mesh position={[L * 0.3, h * 0.88, W / 2 + 0.003]}>
            <circleGeometry args={[0.04, 10]} />
            <meshStandardMaterial color={on ? '#10b981' : '#52525b'} emissive={on ? '#10b981' : '#000000'} emissiveIntensity={0.8} />
          </mesh>
        </group>
      );
    case 'heater':
      return (
        <group>
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[L, h, W]} />
            <meshStandardMaterial color="#451a03" roughness={0.6} />
          </mesh>
          <mesh position={[0, h * 0.55, W / 2 + 0.002]}>
            <planeGeometry args={[L * 0.7, h * 0.6]} />
            <meshStandardMaterial color={on ? '#f97316' : '#78350f'} emissive={on ? '#f97316' : '#000000'} emissiveIntensity={on ? 1.2 : 0} />
          </mesh>
        </group>
      );
    case 'heat_mat':
      return (
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[L, h, W]} />
          <meshStandardMaterial color={on ? '#3b0d0d' : '#18181b'} emissive={on ? '#7f1d1d' : '#000000'} emissiveIntensity={on ? 0.6 : 0} />
        </mesh>
      );
    case 'oscillating_fan': {
      const headR = Math.min(L, W) * 0.45;
      const poleH = Math.max(0.1, h - headR * 2);
      return (
        <group>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[headR * 0.8, headR * 0.9, 0.06, 16]} />
            <meshStandardMaterial color="#27272a" />
          </mesh>
          <mesh position={[0, poleH / 2, 0]}>
            <cylinderGeometry args={[0.04, 0.04, poleH, 8]} />
            <meshStandardMaterial color="#52525b" metalness={0.5} />
          </mesh>
          <group position={[0, poleH + headR, 0]}>
            <mesh>
              <torusGeometry args={[headR, 0.025, 6, 24]} />
              <meshStandardMaterial color="#a1a1aa" metalness={0.6} />
            </mesh>
            <SpinningBlades radius={headR * 0.5} on={on} />
          </group>
        </group>
      );
    }
    case 'co2_regulator':
      return (
        <group>
          <mesh position={[0, h * 0.42, 0]}>
            <cylinderGeometry args={[L * 0.35, L * 0.35, h * 0.84, 16]} />
            <meshStandardMaterial color="#14532d" roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh position={[0, h * 0.9, 0]}>
            <sphereGeometry args={[L * 0.35, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#14532d" roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh position={[0, h * 0.97, L * 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.04, 12]} />
            <meshStandardMaterial color="#facc15" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      );
    case 'co2_bag':
      return (
        <group>
          <HangingCords length={0.02} width={0.02} topY={h} hangFt={hangFt} />
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[L, h, W]} />
            <meshStandardMaterial color="#d6c7a1" roughness={0.9} />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[L, h, W]} />
          <meshStandardMaterial color="#27272a" />
        </mesh>
      );
  }
}
