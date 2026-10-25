import React, { useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import { Room, Tent } from '../../types/sim';
import { Vec3 } from './coords';

/**
 * A vertical wall panel that fades out whenever the camera is on its outward side,
 * so the camera can always see into rooms and tents.
 */
function FadingWall({
  center,
  width,
  height,
  normal,
  color,
  opacity,
  metalness = 0,
  fadedOpacity = 0.04
}: {
  center: Vec3;
  width: number;
  height: number;
  normal: [number, number]; // outward normal on the floor plane (x, z)
  color: string;
  opacity: number;
  metalness?: number;
  fadedOpacity?: number;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const worldCenter = useRef(new THREE.Vector3());
  const initialized = useRef(false);
  const rotationY = Math.atan2(normal[0], normal[1]);

  useFrame(({ camera }) => {
    if (!matRef.current || !meshRef.current) return;
    meshRef.current.getWorldPosition(worldCenter.current);
    const toCamX = camera.position.x - worldCenter.current.x;
    const toCamZ = camera.position.z - worldCenter.current.z;
    const facesCamera = toCamX * normal[0] + toCamZ * normal[1] > 0;
    const target = facesCamera ? fadedOpacity : opacity;
    // Snap on the first frame so walls never start opaque between the camera and the room
    matRef.current.opacity = initialized.current ? matRef.current.opacity + (target - matRef.current.opacity) * 0.15 : target;
    initialized.current = true;
    matRef.current.depthWrite = matRef.current.opacity > 0.9;
  });

  return (
    <mesh ref={meshRef} position={center} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={opacity}
        metalness={metalness}
        roughness={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Walls({ length, width, height, color, opacity, metalness }: { length: number; width: number; height: number; color: string; opacity: number; metalness?: number }) {
  const h = height / 2;
  return (
    <>
      <FadingWall center={[length / 2, h, 0]} width={length} height={height} normal={[0, -1]} color={color} opacity={opacity} metalness={metalness} />
      <FadingWall center={[length / 2, h, width]} width={length} height={height} normal={[0, 1]} color={color} opacity={opacity} metalness={metalness} />
      <FadingWall center={[0, h, width / 2]} width={width} height={height} normal={[-1, 0]} color={color} opacity={opacity} metalness={metalness} />
      <FadingWall center={[length, h, width / 2]} width={width} height={height} normal={[1, 0]} color={color} opacity={opacity} metalness={metalness} />
    </>
  );
}

export function RoomModel({ room, onFloorClick }: { room: Room; onFloorClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const { length: L, width: W, height: H } = room.dimensions;
  const isOutdoor = room.environmentType === 'outdoor_garden';
  const isGreenhouse = room.environmentType === 'greenhouse';
  const floorColor = isOutdoor ? '#3f6212' : isGreenhouse ? '#57534e' : '#27272a';

  return (
    <group>
      {/* Surrounding ground (yard outside the room) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L / 2, -0.02, W / 2]}>
        <planeGeometry args={[L + 60, W + 60]} />
        <meshStandardMaterial color={isOutdoor || isGreenhouse ? '#365314' : '#0c0c0e'} roughness={1} />
      </mesh>

      {/* Walkable floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L / 2, 0, W / 2]} onClick={onFloorClick}>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial color={floorColor} roughness={0.95} />
      </mesh>
      <Grid
        position={[L / 2, 0.005, W / 2]}
        args={[L, W]}
        cellSize={1}
        cellThickness={0.6}
        cellColor={isOutdoor ? '#4d7c0f' : '#3f3f46'}
        sectionSize={4}
        sectionThickness={1}
        sectionColor={isOutdoor ? '#65a30d' : '#52525b'}
        fadeDistance={80}
        infiniteGrid={false}
      />

      {isOutdoor ? (
        // Low garden fence
        <group>
          {Array.from({ length: Math.ceil(L / 2) + 1 }, (_, i) => Math.min(L, i * 2)).flatMap(x => [[x, 0], [x, W]]).concat(
            Array.from({ length: Math.ceil(W / 2) + 1 }, (_, i) => Math.min(W, i * 2)).flatMap(z => [[0, z], [L, z]])
          ).map(([x, z], i) => (
            <mesh key={i} position={[x, 0.75, z]}>
              <boxGeometry args={[0.15, 1.5, 0.15]} />
              <meshStandardMaterial color="#a16207" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ) : isGreenhouse ? (
        <Walls length={L} width={W} height={H} color="#e0f2fe" opacity={0.18} />
      ) : (
        <Walls length={L} width={W} height={H} color="#3f3f46" opacity={1} />
      )}
    </group>
  );
}

/** Marks a scene-graph subtree as an item, so container hit areas can defer to it. */
export const ITEM_USER_DATA = { isItem: true };

function pointerHitsItem(e: ThreeEvent<MouseEvent | PointerEvent>): boolean {
  return e.intersections.some(hit => {
    for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
      if (o.userData.isItem) return true;
    }
    return false;
  });
}

export interface Doorway {
  roomId: string; // target room id or 'ADD_ROOM'
  label: string;
  side: 'left' | 'right';
}

export function DoorwayModel({
  door,
  room,
  onClick,
  onHover
}: {
  door: Doorway;
  room: Room;
  onClick: (door: Doorway) => void;
  onHover: (door: Doorway | null, e?: ThreeEvent<PointerEvent>) => void;
}) {
  const { length: L, width: W } = room.dimensions;
  const x = door.side === 'left' ? 0.02 : L - 0.02;
  const isAdd = door.roomId === 'ADD_ROOM';
  return (
    <group position={[x, 0, W / 2]} rotation={[0, Math.PI / 2, 0]}>
      <mesh
        position={[0, 3.5, 0]}
        onClick={e => { if (e.delta > 5) return; e.stopPropagation(); onClick(door); }}
        onPointerOver={e => { e.stopPropagation(); onHover(door, e); }}
        onPointerOut={() => onHover(null)}
      >
        <boxGeometry args={[3, 7, 0.2]} />
        <meshStandardMaterial color={isAdd ? '#064e3b' : '#78350f'} emissive={isAdd ? '#10b981' : '#000000'} emissiveIntensity={isAdd ? 0.25 : 0} roughness={0.7} />
      </mesh>
    </group>
  );
}

export function TentModel({
  tent,
  origin,
  highlighted,
  onClick,
  onHover
}: {
  tent: Tent;
  origin: Vec3;
  highlighted: boolean;
  onClick: (tent: Tent) => void;
  onHover: (tent: Tent | null, e?: ThreeEvent<PointerEvent>) => void;
}) {
  const { length: L, width: W, height: H } = tent.dimensions;
  const frameColor = highlighted ? '#34d399' : '#18181b';
  const poles: Array<[number, number]> = [[0, 0], [L, 0], [0, W], [L, W]];
  const topBars: Array<{ pos: Vec3; size: Vec3 }> = [
    { pos: [L / 2, H, 0], size: [L, 0.06, 0.06] },
    { pos: [L / 2, H, W], size: [L, 0.06, 0.06] },
    { pos: [0, H, W / 2], size: [0.06, 0.06, W] },
    { pos: [L, H, W / 2], size: [0.06, 0.06, W] }
  ];

  // The whole tent (floor, frame, mylar walls) is clickable, but it steps aside whenever an
  // item is also under the pointer so plants and gear inside stay clickable through the walls.
  const handlers = {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 5 || pointerHitsItem(e)) return;
      e.stopPropagation();
      onClick(tent);
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (pointerHitsItem(e)) return;
      e.stopPropagation();
      onHover(tent, e);
    },
    onPointerOut: () => onHover(null)
  };

  return (
    <group position={origin} {...handlers}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L / 2, 0.01, W / 2]}>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial color={highlighted ? '#1f3d33' : '#1c1c20'} roughness={0.8} />
      </mesh>
      <group>
        {poles.map(([x, z], i) => (
          <mesh key={i} position={[x, H / 2, z]}>
            <cylinderGeometry args={[0.04, 0.04, H, 6]} />
            <meshStandardMaterial color={frameColor} />
          </mesh>
        ))}
        {topBars.map((bar, i) => (
          <mesh key={i} position={bar.pos}>
            <boxGeometry args={bar.size} />
            <meshStandardMaterial color={frameColor} />
          </mesh>
        ))}
      </group>
      {/* Reflective mylar walls (fade on the camera side) */}
      <group>
        <FadingWall center={[L / 2, H / 2, 0]} width={L} height={H} normal={[0, -1]} color="#d4d4d8" opacity={0.35} metalness={0.8} fadedOpacity={0.06} />
        <FadingWall center={[L / 2, H / 2, W]} width={L} height={H} normal={[0, 1]} color="#d4d4d8" opacity={0.35} metalness={0.8} fadedOpacity={0.06} />
        <FadingWall center={[0, H / 2, W / 2]} width={W} height={H} normal={[-1, 0]} color="#d4d4d8" opacity={0.35} metalness={0.8} fadedOpacity={0.06} />
        <FadingWall center={[L, H / 2, W / 2]} width={W} height={H} normal={[1, 0]} color="#d4d4d8" opacity={0.35} metalness={0.8} fadedOpacity={0.06} />
      </group>
    </group>
  );
}
