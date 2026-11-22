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

// ---------- shared bits ----------

/** Snaps a heading to the nearest quarter turn. Odd turns swap the model's length and width so the turned model keeps the item's footprint. */
export function quarterTurn(yaw: number): { swap: boolean; rotationY: number } {
  const turns = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
  return { swap: turns % 2 === 1, rotationY: turns * (Math.PI / 2) };
}

/** A row of thin slats (louvres or grille bars) spread along Y, or along X when `vertical`; each tilted by `tilt` about X. */
function Slats({ count, width, height, depth, span, tilt = 0, color, vertical = false }: {
  count: number; width: number; height: number; depth: number; span: number; tilt?: number; color: string; vertical?: boolean;
}) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * span;
        return (
          <mesh key={i} position={vertical ? [t, 0, 0] : [0, t, 0]} rotation={[tilt, 0, 0]}>
            <boxGeometry args={[width, height, depth]} />
            <meshStandardMaterial color={color} roughness={0.45} />
          </mesh>
        );
      })}
    </group>
  );
}

function Casters({ L, W }: { L: number; W: number }) {
  return (
    <>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * L * 0.36, 0.04, sz * W * 0.34]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.035, 12]} />
          <meshStandardMaterial color="#18181b" roughness={0.6} />
        </mesh>
      ))}
    </>
  );
}

/** Dark control strip with a readout and three buttons, lying on a top surface and read from the front. */
function TopControls({ w, d, on, readout }: { w: number; d: number; on: boolean; readout: string }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#18181b" roughness={0.15} metalness={0.2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-w * 0.22, 0.002, 0]}>
        <planeGeometry args={[w * 0.3, d * 0.5]} />
        <meshStandardMaterial color={on ? readout : '#27272a'} emissive={on ? readout : '#000000'} emissiveIntensity={on ? 0.9 : 0} />
      </mesh>
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[w * (0.08 + i * 0.13), 0.004, 0]}>
          <cylinderGeometry args={[d * 0.14, d * 0.14, 0.008, 12]} />
          <meshStandardMaterial color="#a1a1aa" roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- space heater ----------

/** Ceramic tower heater: charcoal body on an oval plinth, front grille over an element that glows while heating. */
export function HeaterModel({ L, W, h, heating }: { L: number; W: number; h: number; heating: boolean }) {
  const plinthH = Math.min(0.12, h * 0.08);
  const bodyH = h - plinthH;
  const bodyW = L * 0.8;
  const bodyD = W * 0.62;
  const grilleH = bodyH * 0.62;
  const grilleY = plinthH + bodyH * 0.44;
  const frontZ = bodyD / 2;
  return (
    <group>
      <mesh position={[0, plinthH / 2, 0]} scale={[1, 1, W / L]}>
        <cylinderGeometry args={[L * 0.46, L * 0.5, plinthH, 32]} />
        <meshStandardMaterial color="#27272a" roughness={0.5} />
      </mesh>
      <RoundedBox args={[bodyW, bodyH, bodyD]} radius={Math.min(bodyD * 0.45, bodyW * 0.3)} smoothness={4} position={[0, plinthH + bodyH / 2, 0]}>
        <meshStandardMaterial color="#3f3f46" roughness={0.38} />
      </RoundedBox>
      {/* Heating element behind the grille */}
      <mesh position={[0, grilleY, frontZ + 0.004]}>
        <planeGeometry args={[bodyW * 0.62, grilleH]} />
        <meshStandardMaterial color={heating ? '#f97316' : '#1c1917'} emissive={heating ? '#ea580c' : '#000000'} emissiveIntensity={heating ? 1.4 : 0} />
      </mesh>
      <group position={[0, grilleY, frontZ + 0.02]}>
        <Slats count={Math.max(5, Math.round(bodyW / 0.05))} width={Math.min(0.02, bodyW * 0.03)} height={grilleH} depth={0.03} span={bodyW * 0.62} vertical color="#52525b" />
      </group>
      {/* Brushed band, top controls and carry slot */}
      <mesh position={[0, plinthH + bodyH * 0.1, frontZ + 0.004]}>
        <planeGeometry args={[bodyW * 0.7, bodyH * 0.04]} />
        <meshStandardMaterial color="#a1a1aa" metalness={0.6} roughness={0.3} />
      </mesh>
      <group position={[0, h + 0.002, bodyD * 0.12]}>
        <TopControls w={bodyW * 0.62} d={bodyD * 0.38} on={heating} readout="#fb923c" />
      </group>
      <mesh position={[0, h + 0.002, -bodyD * 0.26]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[bodyW * 0.4, bodyD * 0.12]} />
        <meshStandardMaterial color="#09090b" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ---------- dehumidifier ----------

/**
 * Compressor dehumidifier on casters: top exhaust louvres and control strip, front intake grille, a pull-out
 * bucket with a window showing the condensate level, and a drain hose out the back when one is connected.
 */
export function DehumidifierModel({ L, W, h, on, full, bucketFill, drainHose }: {
  L: number; W: number; h: number; on: boolean; full: boolean; bucketFill: number; drainHose: boolean;
}) {
  const lift = 0.08;
  const bodyH = h - lift;
  const frontZ = W / 2;
  const statusColor = !on ? '#52525b' : full ? '#f43f5e' : '#10b981';
  const bucketH = bodyH * 0.34;
  const winW = L * 0.5;
  const winH = bucketH * 0.55;
  return (
    <group>
      <Casters L={L} W={W} />
      <RoundedBox args={[L, bodyH, W]} radius={Math.min(L, W) * 0.08} smoothness={3} position={[0, lift + bodyH / 2, 0]}>
        <meshStandardMaterial color="#e4e4e7" roughness={0.4} />
      </RoundedBox>
      {/* Bucket drawer with a grip and the level window */}
      <mesh position={[0, lift + bucketH / 2 + 0.02, frontZ + 0.003]}>
        <planeGeometry args={[L * 0.86, bucketH]} />
        <meshStandardMaterial color="#d4d4d8" roughness={0.45} />
      </mesh>
      <mesh position={[0, lift + bucketH * 0.86, frontZ + 0.02]}>
        <boxGeometry args={[L * 0.4, bucketH * 0.08, 0.03]} />
        <meshStandardMaterial color="#a1a1aa" roughness={0.5} />
      </mesh>
      <mesh position={[0, lift + 0.05 + winH / 2, frontZ + 0.005]}>
        <planeGeometry args={[winW, winH]} />
        <meshStandardMaterial color="#18181b" transparent opacity={0.65} />
      </mesh>
      {bucketFill > 0.01 && (
        <mesh position={[0, lift + 0.05 + (winH * bucketFill) / 2, frontZ + 0.006]}>
          <planeGeometry args={[winW * 0.96, winH * bucketFill]} />
          <meshStandardMaterial color={full ? '#f43f5e' : bucketFill > 0.8 ? '#fbbf24' : '#38bdf8'} transparent opacity={0.85} />
        </mesh>
      )}
      {/* Front intake grille */}
      <mesh position={[0, lift + bodyH * 0.62, frontZ + 0.003]}>
        <planeGeometry args={[L * 0.74, bodyH * 0.36]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.7} />
      </mesh>
      <group position={[0, lift + bodyH * 0.62, frontZ + 0.012]}>
        <Slats count={9} width={L * 0.74} height={0.018} depth={0.02} span={bodyH * 0.32} color="#d4d4d8" />
      </group>
      {/* Top exhaust louvres and control strip */}
      <mesh position={[0, h + 0.002, -W * 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[L * 0.74, W * 0.5]} />
        <meshStandardMaterial color="#27272a" roughness={0.7} />
      </mesh>
      <group position={[0, h + 0.012, -W * 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
        <Slats count={7} width={L * 0.72} height={0.02} depth={0.02} span={W * 0.44} tilt={0.5} color="#e4e4e7" />
      </group>
      <group position={[0, h + 0.002, W * 0.3]}>
        <TopControls w={L * 0.6} d={W * 0.2} on={on} readout="#67e8f9" />
      </group>
      <mesh position={[L * 0.36, h + 0.006, W * 0.3]}>
        <cylinderGeometry args={[0.035, 0.035, 0.01, 12]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={on ? 0.9 : 0} />
      </mesh>
      {drainHose && (
        // Drain hose out the back, down to the floor drain
        <mesh position={[0, 0.1, -W / 2 - 0.35]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.7, 8]} />
          <meshStandardMaterial color="#334155" roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}

// ---------- portable air conditioner ----------

/**
 * Single-hose portable AC on casters: front air outlet with angled louvres (tinted while cooling), a lower
 * intake grille, a top control strip, and a ribbed exhaust hose out the back toward the window kit.
 */
export function PortableAcModel({ L, W, h, on, cooling }: { L: number; W: number; h: number; on: boolean; cooling: boolean }) {
  const lift = 0.08;
  const bodyH = h - lift;
  const frontZ = W / 2;
  const hoseR = Math.min(0.2, L * 0.14);
  return (
    <group>
      <Casters L={L} W={W} />
      <RoundedBox args={[L, bodyH, W]} radius={Math.min(L, W) * 0.12} smoothness={4} position={[0, lift + bodyH / 2, 0]}>
        <meshStandardMaterial color="#f4f4f5" roughness={0.35} />
      </RoundedBox>
      {/* Air outlet near the top */}
      <mesh position={[0, lift + bodyH * 0.82, frontZ + 0.003]}>
        <planeGeometry args={[L * 0.7, bodyH * 0.16]} />
        <meshStandardMaterial color="#27272a" roughness={0.6} emissive={cooling ? '#0ea5e9' : '#000000'} emissiveIntensity={cooling ? 0.35 : 0} />
      </mesh>
      <group position={[0, lift + bodyH * 0.82, frontZ + 0.02]}>
        <Slats count={5} width={L * 0.68} height={0.022} depth={0.05} span={bodyH * 0.12} tilt={-0.5} color={cooling ? '#bae6fd' : '#d4d4d8'} />
      </group>
      {/* Accent seam and lower intake grille */}
      <mesh position={[0, lift + bodyH * 0.66, frontZ + 0.003]}>
        <planeGeometry args={[L * 0.86, 0.02]} />
        <meshStandardMaterial color="#a1a1aa" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, lift + bodyH * 0.18, frontZ + 0.003]}>
        <planeGeometry args={[L * 0.6, bodyH * 0.2]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.7} />
      </mesh>
      <group position={[0, lift + bodyH * 0.18, frontZ + 0.01]}>
        <Slats count={7} width={L * 0.6} height={0.016} depth={0.015} span={bodyH * 0.18} color="#e4e4e7" />
      </group>
      <group position={[0, h + 0.002, W * 0.15]}>
        <TopControls w={L * 0.55} d={W * 0.22} on={on} readout={cooling ? '#7dd3fc' : '#a5f3fc'} />
      </group>
      {/* Ribbed exhaust hose out the back */}
      <group position={[0, lift + bodyH * 0.6, -W / 2 - 0.27]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[hoseR, hoseR, 0.55, 18, 1, true]} />
          <meshStandardMaterial color="#d4d4d8" roughness={0.55} side={THREE.DoubleSide} />
        </mesh>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} position={[0, -0.24 + i * 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[hoseR, 0.012, 6, 20]} />
            <meshStandardMaterial color="#e4e4e7" roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------- LED grow light ----------

const diodeTiles: Partial<Record<'map' | 'glow', THREE.Texture>> = {};
/** One diode on a white board as a repeating tile; `glow` is the emissive version (dark board, bright diode). */
function getDiodeTile(kind: 'map' | 'glow') {
  const existing = diodeTiles[kind];
  if (existing) return existing;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = kind === 'map' ? '#f5f5f4' : '#000000';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = kind === 'map' ? '#fde68a' : '#ffffff';
  ctx.beginPath();
  ctx.arc(16, 16, 6, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  diodeTiles[kind] = tex;
  return tex;
}

/** Diode board underside, `w` × `d` feet, about one diode per inch; glows warm white when lit. */
function DiodeFace({ w, d, lit }: { w: number; d: number; lit: boolean }) {
  const maps = useMemo(() => {
    const repeat = (t: THREE.Texture) => {
      const c = t.clone();
      c.repeat.set(Math.max(1, Math.round(w * 12)), Math.max(1, Math.round(d * 12)));
      c.needsUpdate = true;
      return c;
    };
    return { map: repeat(getDiodeTile('map')), glow: repeat(getDiodeTile('glow')) };
  }, [w, d]);
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.003, 0]}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial
        map={maps.map}
        emissiveMap={maps.glow}
        color={lit ? '#ffffff' : '#a1a1aa'}
        emissive={lit ? '#fff1cc' : '#000000'}
        emissiveIntensity={lit ? 2.2 : 0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * LED fixture with its light face at the base: parallel aluminium bars on rails when `bars`, otherwise a
 * quantum board (diode board in an aluminium frame with heat-sink fins). A finned driver box sits on top.
 */
export function LedFixtureModel({ L, W, h, lit, bars }: { L: number; W: number; h: number; lit: boolean; bars: boolean }) {
  const alu = { color: '#d4d4d8', metalness: 0.6, roughness: 0.35 } as const;
  const driverH = Math.min(h * 0.45, 0.12);
  const bodyH = Math.max(0.03, h - driverH);
  const driverL = Math.min(L * 0.35, 0.9);
  const driverD = Math.min(W * 0.3, 0.35);
  const driver = (
    <group position={[0, bodyH + driverH / 2, 0]}>
      <mesh>
        <boxGeometry args={[driverL, driverH, driverD]} />
        <meshStandardMaterial color="#18181b" roughness={0.5} />
      </mesh>
      <group position={[0, driverH / 2, 0]}>
        <Slats count={6} width={0.008} height={driverH * 0.4} depth={driverD} span={driverL * 0.85} vertical color="#27272a" />
      </group>
    </group>
  );
  if (bars) {
    const count = Math.max(2, Math.min(10, Math.round(W / 0.28)));
    const pitch = W / count;
    const barW = Math.min(0.16, pitch * 0.6);
    return (
      <group>
        {[-1, 1].map(side => (
          <mesh key={side} position={[side * L * 0.42, bodyH * 0.75, 0]}>
            <boxGeometry args={[0.05, bodyH * 0.5, W]} />
            <meshStandardMaterial color="#27272a" roughness={0.5} />
          </mesh>
        ))}
        {Array.from({ length: count }, (_, i) => (
          <group key={i} position={[0, 0, -W / 2 + pitch * (i + 0.5)]}>
            <mesh position={[0, bodyH * 0.3, 0]}>
              <boxGeometry args={[L, bodyH * 0.6, barW]} />
              <meshStandardMaterial {...alu} />
            </mesh>
            <DiodeFace w={L * 0.98} d={barW * 0.8} lit={lit} />
          </group>
        ))}
        {driver}
      </group>
    );
  }
  const finCount = Math.max(4, Math.min(16, Math.round(W / 0.12)));
  return (
    <group>
      <mesh position={[0, bodyH * 0.3, 0]}>
        <boxGeometry args={[L, bodyH * 0.6, W]} />
        <meshStandardMaterial {...alu} />
      </mesh>
      <group position={[0, bodyH * 0.75, 0]}>
        {Array.from({ length: finCount }, (_, i) => (
          <mesh key={i} position={[0, 0, -W * 0.45 + (W * 0.9 * i) / (finCount - 1)]}>
            <boxGeometry args={[L * 0.9, bodyH * 0.3, 0.012]} />
            <meshStandardMaterial {...alu} />
          </mesh>
        ))}
      </group>
      <DiodeFace w={L * 0.94} d={W * 0.94} lit={lit} />
      {driver}
    </group>
  );
}
