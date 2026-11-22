import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Detailed procedural appliances, drawn at the item's real size (feet). Origin is the item's base centre;
 * the front faces +Z. Geometry that is the same for every instance of a size is built once and merged.
 */

// ---------- oscillating fan ----------

/** Wire guard (front dome, flatter rear dome, rim, rings and curved spokes) as one merged geometry. */
function makeGuardGeometry(R: number): THREE.BufferGeometry {
  const wire = Math.max(0.007, R * 0.012);
  const front = R * 0.32;
  const rear = R * 0.22;
  const parts: THREE.BufferGeometry[] = [];
  const rim = new THREE.TorusGeometry(R, wire * 2, 6, 48);
  parts.push(rim);
  const dome = (r: number, depth: number) => depth * (1 - (r / R) ** 2);
  for (const [depth, sign, rings, spokes] of [[front, 1, [0.25, 0.45, 0.65, 0.84], 22], [rear, -1, [0.4, 0.7], 16]] as const) {
    for (const k of rings) {
      const ring = new THREE.TorusGeometry(R * k, wire, 4, 40);
      ring.translate(0, 0, sign * dome(R * k, depth));
      parts.push(ring);
    }
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      // Spokes sweep slightly as they run out, like a real fan guard
      const points = Array.from({ length: 7 }, (_, j) => {
        const r = R * (0.14 + (0.86 * j) / 6);
        const ang = a + (sign > 0 ? 0.35 : 0) * (j / 6);
        return new THREE.Vector3(Math.cos(ang) * r, Math.sin(ang) * r, sign * dome(r, depth));
      });
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 8, wire, 3, false));
    }
  }
  const merged = mergeGeometries(parts.map(p => (p.index ? p.toNonIndexed() : p)));
  parts.forEach(p => p.dispose());
  return merged;
}

/** One pitched, slightly cupped blade from the hub outward along +Y. */
function makeBladeGeometry(R: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const r0 = R * 0.12;
  const r1 = R * 0.86;
  shape.moveTo(-R * 0.08, r0);
  shape.bezierCurveTo(-R * 0.34, R * 0.35, -R * 0.36, R * 0.75, -R * 0.12, r1);
  shape.quadraticCurveTo(R * 0.1, R * 0.92, R * 0.24, R * 0.7);
  shape.bezierCurveTo(R * 0.3, R * 0.45, R * 0.16, R * 0.25, R * 0.08, r0);
  shape.closePath();
  const g = new THREE.ShapeGeometry(shape, 10);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Pitch across the blade's width plus a little cup along it
    pos.setZ(i, -x * 0.22 + ((x * x) / R) * 0.15 - (y / R) * 0.02 * R);
  }
  g.computeVertexNormals();
  return g;
}

const guardCache = new Map<string, THREE.BufferGeometry>();
const bladeCache = new Map<string, THREE.BufferGeometry>();
const cached = (cache: Map<string, THREE.BufferGeometry>, R: number, make: (R: number) => THREE.BufferGeometry) => {
  const key = R.toFixed(3);
  let g = cache.get(key);
  if (!g) cache.set(key, (g = make(R)));
  return g;
};

/** Rounded motor can behind the blades, drawn along +Z (front at z = 0). */
function useMotorGeometry(R: number) {
  return useMemo(() => {
    const len = R * 0.5;
    const pts = [
      [0, 0], [R * 0.28, 0], [R * 0.33, -len * 0.15], [R * 0.34, -len * 0.55], [R * 0.3, -len * 0.85], [R * 0.2, -len], [0, -len],
    ].map(([r, z]) => new THREE.Vector2(r, z));
    const g = new THREE.LatheGeometry(pts, 28);
    g.rotateX(Math.PI / 2); // lathe runs along Y; turn it to run along Z
    return g;
  }, [R]);
}

export function OscillatingFanModel({ L, W, h, on, setting }: { L: number; W: number; h: number; on: boolean; setting: number }) {
  const R = Math.min(L, W) * 0.45; // guard radius
  const guard = cached(guardCache, R, makeGuardGeometry);
  const blade = cached(bladeCache, R, makeBladeGeometry);
  const motor = useMotorGeometry(R);
  const bladesRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const running = on && setting > 0;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    if (running && bladesRef.current) bladesRef.current.rotation.z -= dt * (10 + (setting / 100) * 22);
    if (running) phase.current += dt * 0.45;
    if (headRef.current) headRef.current.rotation.y = Math.sin(phase.current) * 0.6;
  });

  const baseR = Math.min(L, W) * 0.48;
  const baseH = Math.max(0.06, Math.min(0.14, h * 0.04));
  const centerY = h - R;
  const neckTop = centerY - R * 0.42;
  const pedestal = neckTop - baseH > R * 0.9; // tall enough for a stand pole
  const lowerLen = (neckTop - baseH) * 0.55;
  const poleR = Math.max(0.025, R * 0.06);
  const plastic = '#27272a';
  const chrome = { color: '#d4d4d8', metalness: 0.55, roughness: 0.3 } as const;

  return (
    <group>
      {/* Weighted round base with a speed-control pod at the front */}
      <mesh position={[0, baseH / 2, 0]}>
        <cylinderGeometry args={[baseR * 0.82, baseR, baseH, 40]} />
        <meshStandardMaterial color={plastic} roughness={0.45} />
      </mesh>
      <mesh position={[0, baseH + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[baseR * 0.55, baseR * 0.8, 40]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.3} />
      </mesh>
      <group position={[0, baseH, baseR * 0.62]}>
        {[-1, 0, 1].map(i => (
          <mesh key={i} position={[i * baseR * 0.14, 0.01, 0]}>
            <cylinderGeometry args={[baseR * 0.05, baseR * 0.05, 0.02, 12]} />
            <meshStandardMaterial color={running && Math.round((setting / 100) * 2) - 1 === i ? '#34d399' : '#a1a1aa'} emissive={running && Math.round((setting / 100) * 2) - 1 === i ? '#10b981' : '#000000'} emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>

      {/* Telescoping pole with a clamp collar, or a short neck for a table fan */}
      {pedestal ? (
        <>
          <mesh position={[0, baseH + lowerLen / 2, 0]}>
            <cylinderGeometry args={[poleR, poleR, lowerLen, 16]} />
            <meshStandardMaterial {...chrome} />
          </mesh>
          <mesh position={[0, baseH + lowerLen, 0]}>
            <cylinderGeometry args={[poleR * 1.6, poleR * 1.6, poleR * 2.2, 16]} />
            <meshStandardMaterial color={plastic} roughness={0.4} />
          </mesh>
          <mesh position={[poleR * 1.9, baseH + lowerLen, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[poleR * 0.5, poleR * 0.5, poleR * 1.2, 10]} />
            <meshStandardMaterial color={plastic} roughness={0.4} />
          </mesh>
          <mesh position={[0, (baseH + lowerLen + neckTop) / 2, 0]}>
            <cylinderGeometry args={[poleR * 0.7, poleR * 0.7, neckTop - baseH - lowerLen, 14]} />
            <meshStandardMaterial {...chrome} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, (baseH + neckTop) / 2, 0]}>
          <cylinderGeometry args={[poleR, poleR * 1.3, Math.max(0.02, neckTop - baseH), 14]} />
          <meshStandardMaterial color={plastic} roughness={0.45} />
        </mesh>
      )}

      {/* Head: oscillates around the pole, tilted slightly down */}
      <group ref={headRef} position={[0, neckTop, 0]}>
        <mesh position={[0, R * 0.08, 0]}>
          <sphereGeometry args={[poleR * 1.5, 14, 10]} />
          <meshStandardMaterial color={plastic} roughness={0.4} />
        </mesh>
        <group position={[0, centerY - neckTop, 0]} rotation={[0.08, 0, 0]}>
          <mesh geometry={motor} position={[0, 0, -R * 0.24]}>
            <meshStandardMaterial color={plastic} roughness={0.4} />
          </mesh>
          {/* Oscillation knob on top of the motor */}
          <mesh position={[0, R * 0.36, -R * 0.55]}>
            <cylinderGeometry args={[R * 0.05, R * 0.06, R * 0.12, 12]} />
            <meshStandardMaterial color="#52525b" roughness={0.4} />
          </mesh>
          <mesh geometry={guard}>
            <meshStandardMaterial {...chrome} />
          </mesh>
          <group ref={bladesRef}>
            {[0, 1, 2].map(i => (
              <mesh key={i} geometry={blade} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
                <meshStandardMaterial color="#cbd5e1" roughness={0.35} transparent opacity={0.88} side={THREE.DoubleSide} />
              </mesh>
            ))}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, R * 0.04]}>
              <cylinderGeometry args={[R * 0.11, R * 0.14, R * 0.1, 20]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.35} />
            </mesh>
          </group>
          {/* Badge in the middle of the front guard */}
          <mesh position={[0, 0, R * 0.325]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[R * 0.14, R * 0.14, 0.012, 24]} />
            <meshStandardMaterial color="#e4e4e7" metalness={0.3} roughness={0.25} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ---------- humidifier ----------

let mistTexture: THREE.Texture | null = null;
/** Soft round puff, drawn once on a canvas. */
function getMistTexture() {
  if (mistTexture) return mistTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(240,249,255,0.45)');
  g.addColorStop(1, 'rgba(240,249,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  mistTexture = new THREE.CanvasTexture(c);
  mistTexture.colorSpace = THREE.SRGBColorSpace;
  return mistTexture;
}

const PUFFS = 9;

/** Puffs that rise from the nozzle, swell and fade; more and bigger at higher output. */
function MistPuffs({ y, size, strength }: { y: number; size: number; strength: number }) {
  const refs = useRef<Array<THREE.Sprite | null>>([]);
  const tex = useMemo(getMistTexture, []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((s, i) => {
      if (!s) return;
      const life = ((t * 0.45 + i / PUFFS) % 1 + 1) % 1; // 0 → 1 over the puff's life
      const rise = life * size * 3.2;
      s.position.set(Math.sin(i * 2.3 + t * 0.7) * size * 0.25 * life, y + rise, size * 0.35 * life);
      const scale = size * (0.35 + life * 1.5) * (0.6 + strength * 0.4);
      s.scale.set(scale, scale, 1);
      (s.material as THREE.SpriteMaterial).opacity = Math.sin(life * Math.PI) * 0.55 * (0.5 + strength * 0.5);
    });
  });
  return (
    <group>
      {Array.from({ length: PUFFS }, (_, i) => (
        <sprite key={i} ref={el => { refs.current[i] = el; }} raycast={() => null}>
          <spriteMaterial map={tex} transparent depthWrite={false} opacity={0} />
        </sprite>
      ))}
    </group>
  );
}

/**
 * Ultrasonic tower humidifier: white base with a control panel, clear tank showing the real water level,
 * white top with a carry handle and a swivel mist nozzle at the centre (where mist hoses attach).
 */
export function HumidifierModel({ L, W, h, on, fill, empty, misting, setting }: {
  L: number; W: number; h: number; on: boolean; fill: number; empty: boolean; misting: boolean; setting: number;
}) {
  const baseH = h * 0.3;
  const tankH = h * 0.56;
  const topH = h - baseH - tankH;
  const m = Math.min(L, W);
  const white = { color: '#f4f4f5', roughness: 0.32 } as const;
  const waterH = Math.max(0.005, (tankH - 0.04) * fill);
  const panelZ = (W * 0.92) / 2 + 0.003;
  const lowWater = on && empty;

  return (
    <group>
      {/* Base with a dark glossy control panel */}
      <RoundedBox args={[L * 0.92, baseH, W * 0.92]} radius={Math.min(m * 0.12, baseH * 0.3)} smoothness={3} position={[0, baseH / 2, 0]}>
        <meshStandardMaterial {...white} />
      </RoundedBox>
      <mesh position={[0, 0.012, 0]}>
        <boxGeometry args={[L * 0.86, 0.024, W * 0.86]} />
        <meshStandardMaterial color="#a1a1aa" roughness={0.6} />
      </mesh>
      <group position={[0, baseH * 0.55, panelZ]}>
        <mesh>
          <planeGeometry args={[L * 0.6, baseH * 0.42]} />
          <meshStandardMaterial color="#18181b" roughness={0.15} metalness={0.2} />
        </mesh>
        {/* Humidity readout, lit while running */}
        <mesh position={[-L * 0.12, 0, 0.002]}>
          <planeGeometry args={[L * 0.2, baseH * 0.2]} />
          <meshStandardMaterial color={on ? '#67e8f9' : '#27272a'} emissive={on ? '#22d3ee' : '#000000'} emissiveIntensity={on ? 0.9 : 0} />
        </mesh>
        {[0, 1].map(i => (
          <mesh key={i} position={[L * (0.08 + i * 0.1), 0, 0.002]}>
            <circleGeometry args={[m * 0.03, 14]} />
            <meshStandardMaterial color="#d4d4d8" roughness={0.4} />
          </mesh>
        ))}
        {/* Low-water light */}
        <mesh position={[L * 0.25, 0, 0.002]}>
          <circleGeometry args={[m * 0.022, 12]} />
          <meshStandardMaterial color={lowWater ? '#f43f5e' : '#3f3f46'} emissive={lowWater ? '#f43f5e' : '#000000'} emissiveIntensity={lowWater ? 1.2 : 0} />
        </mesh>
      </group>

      {/* Clear tank with the water inside */}
      <RoundedBox args={[L * 0.86, tankH, W * 0.86]} radius={Math.min(m * 0.1, tankH * 0.2)} smoothness={3} position={[0, baseH + tankH / 2, 0]}>
        <meshStandardMaterial color="#dbeafe" transparent opacity={0.26} roughness={0.06} depthWrite={false} />
      </RoundedBox>
      {fill > 0 && (
        <RoundedBox args={[L * 0.8, waterH, W * 0.8]} radius={Math.min(m * 0.08, waterH * 0.45)} smoothness={2} position={[0, baseH + 0.02 + waterH / 2, 0]}>
          <meshStandardMaterial color={fill < 0.2 ? '#fbbf24' : '#38bdf8'} transparent opacity={0.6} roughness={0.1} />
        </RoundedBox>
      )}

      {/* Top cap, carry handle and swivel nozzle */}
      <RoundedBox args={[L * 0.9, topH, W * 0.9]} radius={Math.min(m * 0.1, topH * 0.45)} smoothness={3} position={[0, baseH + tankH + topH / 2, 0]}>
        <meshStandardMaterial {...white} />
      </RoundedBox>
      <mesh position={[0, h, -W * 0.25]} rotation={[0, 0, 0]}>
        <torusGeometry args={[m * 0.16, m * 0.025, 8, 20, Math.PI]} />
        <meshStandardMaterial {...white} />
      </mesh>
      <group position={[0, h, W * 0.08]}>
        <mesh position={[0, m * 0.04, 0]}>
          <cylinderGeometry args={[m * 0.13, m * 0.15, m * 0.08, 24]} />
          <meshStandardMaterial color="#e4e4e7" roughness={0.3} />
        </mesh>
        <mesh position={[0, m * 0.11, m * 0.03]} rotation={[0.45, 0, 0]}>
          <cylinderGeometry args={[m * 0.07, m * 0.1, m * 0.12, 20]} />
          <meshStandardMaterial color="#e4e4e7" roughness={0.3} />
        </mesh>
        <mesh position={[0, m * 0.175, m * 0.06]} rotation={[-Math.PI / 2 + 0.45, 0, 0]}>
          <circleGeometry args={[m * 0.062, 18]} />
          <meshStandardMaterial color="#3f3f46" roughness={0.6} />
        </mesh>
        {misting && <MistPuffs y={m * 0.18} size={m * 0.28} strength={Math.min(1, setting / 100)} />}
      </group>
    </group>
  );
}
