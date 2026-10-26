import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EquipmentItem } from '../../types/sim';
import { getReservoirLevelL, getReservoirLiters, isReservoirEmpty, getBucketLevelL, getBucketCapacityL, isBucketFull } from '../../utils/equipmentLinks';

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

/** How an attached heat mat is shown: as a band wrapped around a tank, or faintly under a tent's floor tray. */
export type HeatMatMount = { kind: 'wrap'; radius: number; height: number } | { kind: 'under_tray' };

export function EquipmentModel({ eq, hangFt = 0, matMount }: { eq: EquipmentItem; hangFt?: number; matMount?: HeatMatMount }) {
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
      const blowing = on && (eq.effectiveSetting ?? eq.setting) > 0;
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
            <meshStandardMaterial color={blowing ? '#10b981' : '#52525b'} emissive={blowing ? '#10b981' : '#000000'} emissiveIntensity={0.8} />
          </mesh>
        </group>
      );
    }
    case 'humidifier': {
      // Opaque base, clear tank above it showing the real water level
      const baseH = h * 0.3;
      const tankH = h * 0.6;
      const empty = isReservoirEmpty(eq);
      const fill = empty ? 0 : getReservoirLevelL(eq) / getReservoirLiters(eq);
      const waterH = Math.max(0.005, tankH * fill);
      // Mist only while it has water and the controller has it running
      const misting = on && !empty && (eq.effectiveSetting ?? eq.setting) > 0;
      return (
        <group>
          <mesh position={[0, baseH / 2, 0]}>
            <cylinderGeometry args={[L * 0.47, L * 0.5, baseH, 18]} />
            <meshStandardMaterial color="#f4f4f5" roughness={0.4} />
          </mesh>
          <mesh position={[0, baseH + tankH / 2, 0]}>
            <cylinderGeometry args={[L * 0.45, L * 0.47, tankH, 18]} />
            <meshStandardMaterial color="#e0f2fe" transparent opacity={0.25} roughness={0.1} depthWrite={false} />
          </mesh>
          {fill > 0 && (
            <mesh position={[0, baseH + waterH / 2, 0]}>
              <cylinderGeometry args={[L * 0.42, L * 0.44, waterH, 18]} />
              <meshStandardMaterial color={fill < 0.2 ? '#fbbf24' : '#38bdf8'} transparent opacity={0.7} />
            </mesh>
          )}
          <mesh position={[0, h * 0.95, 0]}>
            <cylinderGeometry args={[L * 0.12, L * 0.12, h * 0.1, 10]} />
            <meshStandardMaterial color={empty && on ? '#f43f5e' : '#a1a1aa'} emissive={empty && on ? '#f43f5e' : '#000000'} emissiveIntensity={empty && on ? 0.8 : 0} />
          </mesh>
          <MistPlume topY={h} on={misting} />
        </group>
      );
    }
    case 'dehumidifier': {
      const full = isBucketFull(eq);
      const bucketFill = eq.drainHoseConnected ? 0 : getBucketLevelL(eq) / getBucketCapacityL(eq);
      // Pull-out bucket window along the bottom front, showing the condensate level
      const winH = h * 0.22;
      const winW = L * 0.7;
      const statusColor = !on ? '#52525b' : full ? '#f43f5e' : '#10b981';
      return (
        <group>
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[L, h, W]} />
            <meshStandardMaterial color="#e4e4e7" roughness={0.5} />
          </mesh>
          {[0.45, 0.55, 0.65, 0.75].map(t => (
            <mesh key={t} position={[0, h * t, W / 2 + 0.002]}>
              <planeGeometry args={[L * 0.7, h * 0.04]} />
              <meshStandardMaterial color="#52525b" />
            </mesh>
          ))}
          <mesh position={[0, h * 0.05 + winH / 2, W / 2 + 0.003]}>
            <planeGeometry args={[winW, winH]} />
            <meshStandardMaterial color="#18181b" transparent opacity={0.6} />
          </mesh>
          {bucketFill > 0.01 && (
            <mesh position={[0, h * 0.05 + (winH * bucketFill) / 2, W / 2 + 0.004]}>
              <planeGeometry args={[winW * 0.96, winH * bucketFill]} />
              <meshStandardMaterial color={full ? '#f43f5e' : bucketFill > 0.8 ? '#fbbf24' : '#38bdf8'} transparent opacity={0.8} />
            </mesh>
          )}
          <mesh position={[L * 0.3, h * 0.88, W / 2 + 0.003]}>
            <circleGeometry args={[0.04, 10]} />
            <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={on ? 0.8 : 0} />
          </mesh>
          {eq.drainHoseConnected && (
            // Drain hose out the back, down to the floor drain
            <mesh position={[0, h * 0.06, -W / 2 - 0.35]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.7, 8]} />
              <meshStandardMaterial color="#334155" roughness={0.6} />
            </mesh>
          )}
        </group>
      );
    }
    case 'portable_ac': {
      const cooling = on && (eq.effectiveSetting ?? 0) > 0;
      return (
        <group>
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[L, h, W]} />
            <meshStandardMaterial color="#f4f4f5" roughness={0.45} />
          </mesh>
          {[0.55, 0.65, 0.75].map(t => (
            <mesh key={t} position={[0, h * t, W / 2 + 0.002]}>
              <planeGeometry args={[L * 0.75, h * 0.035]} />
              <meshStandardMaterial color={cooling ? '#38bdf8' : '#71717a'} emissive={cooling ? '#0ea5e9' : '#000000'} emissiveIntensity={cooling ? 0.5 : 0} />
            </mesh>
          ))}
          {/* Exhaust hose stub out the back, toward the window kit */}
          <mesh position={[0, h * 0.6, -W / 2 - 0.25]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.5, 14]} />
            <meshStandardMaterial color="#a1a1aa" roughness={0.6} />
          </mesh>
        </group>
      );
    }
    case 'hvac_register': {
      const blowing = on && (eq.effectiveSetting ?? 0) > 0;
      const heating = blowing && (eq.interlockStatus ?? '').startsWith('Heating');
      const tint = !blowing ? '#d4d4d8' : heating ? '#fb923c' : '#38bdf8';
      return (
        <group>
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[L, h, W]} />
            <meshStandardMaterial color="#e4e4e7" roughness={0.5} />
          </mesh>
          {[-0.3, -0.1, 0.1, 0.3].map(t => (
            <mesh key={t} position={[L * t, -0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[L * 0.12, W * 0.8]} />
              <meshStandardMaterial color={tint} emissive={blowing ? tint : '#000000'} emissiveIntensity={blowing ? 0.6 : 0} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      );
    }
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
    case 'heat_mat': {
      const matColor = on ? '#3b0d0d' : '#18181b';
      const glow = on ? '#7f1d1d' : '#000000';
      if (matMount?.kind === 'wrap') {
        // Wrapped around the lower part of a tank: an open band hugging its side
        const bandH = Math.min(W, matMount.height * 0.5);
        return (
          <mesh position={[0, bandH / 2 + 0.08, 0]}>
            <cylinderGeometry args={[matMount.radius + 0.02, matMount.radius + 0.02, bandH, 24, 1, true]} />
            <meshStandardMaterial color={matColor} emissive={glow} emissiveIntensity={on ? 0.6 : 0} side={THREE.DoubleSide} />
          </mesh>
        );
      }
      return (
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[L, h, W]} />
          <meshStandardMaterial
            color={matColor}
            emissive={glow}
            emissiveIntensity={on ? 0.6 : 0}
            // Under the catch tray it only shows faintly through the tray
            transparent={matMount?.kind === 'under_tray'}
            opacity={matMount?.kind === 'under_tray' ? 0.45 : 1}
          />
        </mesh>
      );
    }
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
