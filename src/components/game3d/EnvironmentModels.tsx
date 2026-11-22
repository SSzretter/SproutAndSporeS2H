import React, { useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import { Room, Tent } from '../../types/sim';
import { Vec3 } from './coords';
import { AssetSlot, BreakerPanel, CagedWorkLight, RollerShutter } from './AssetModels';
import type { WallSide } from '../../types/sim';
import { roomSurfaces, SurfaceKind, useSurfaceMaps } from './surfaceTextures';
import { GardenSurroundings } from './OutdoorModels';

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
  fadedOpacity = 0.04,
  surface
}: {
  center: Vec3;
  width: number;
  height: number;
  normal: [number, number]; // outward normal on the floor plane (x, z)
  color: string;
  opacity: number;
  metalness?: number;
  fadedOpacity?: number;
  surface?: SurfaceKind; // textured finish; `color` is used without one
}) {
  const maps = useSurfaceMaps(surface, width, height);
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
        color={maps ? maps.color : color}
        map={maps?.map ?? null}
        normalMap={maps?.normalMap ?? null}
        normalScale={maps?.normalScale}
        roughnessMap={maps?.roughnessMap ?? null}
        aoMap={maps?.aoMap ?? null}
        transparent
        opacity={opacity}
        metalness={metalness}
        roughness={maps ? 1 : 0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Walls({ length, width, height, color, opacity, metalness, surface }: { length: number; width: number; height: number; color: string; opacity: number; metalness?: number; surface?: SurfaceKind }) {
  const h = height / 2;
  const common = { height, color, opacity, metalness, surface };
  return (
    <>
      <FadingWall center={[length / 2, h, 0]} width={length} normal={[0, -1]} {...common} />
      <FadingWall center={[length / 2, h, width]} width={length} normal={[0, 1]} {...common} />
      <FadingWall center={[0, h, width / 2]} width={width} normal={[-1, 0]} {...common} />
      <FadingWall center={[length, h, width / 2]} width={width} normal={[1, 0]} {...common} />
    </>
  );
}

/** Plain or textured floor plane, `L` × `W` feet centred on the room. */
function RoomFloor({ L, W, color, surface, onClick }: { L: number; W: number; color: string; surface?: SurfaceKind; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const maps = useSurfaceMaps(surface, L, W);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L / 2, 0, W / 2]} onClick={onClick}>
      <planeGeometry args={[L, W]} />
      <meshStandardMaterial
        color={maps ? maps.color : color}
        map={maps?.map ?? null}
        normalMap={maps?.normalMap ?? null}
        normalScale={maps?.normalScale}
        roughnessMap={maps?.roughnessMap ?? null}
        aoMap={maps?.aoMap ?? null}
        roughness={maps ? 1 : 0.95}
      />
    </mesh>
  );
}

/**
 * Ceiling at height `H`, facing down only: from above (the overview camera) it is back-facing and not drawn,
 * so the room stays visible. It never takes clicks.
 */
function RoomCeiling({ L, W, H, surface }: { L: number; W: number; H: number; surface: SurfaceKind }) {
  const maps = useSurfaceMaps(surface, L, W);
  if (!maps) return null;
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[L / 2, H, W / 2]} raycast={() => null}>
      <planeGeometry args={[L, W]} />
      <meshStandardMaterial color={maps.color} map={maps.map} normalMap={maps.normalMap} normalScale={maps.normalScale} roughnessMap={maps.roughnessMap} aoMap={maps.aoMap} roughness={1} />
    </mesh>
  );
}

/**
 * Utility corner of an indoor room: a breaker panel on the back wall near the left corner and a caged work
 * light hanging from the ceiling in front of it. The light runs along the back wall unless a door there would
 * put it in the way, in which case it runs along the left wall.
 */
function RoomFixtures({ room, doorSides }: { room: Room; doorSides: WallSide[] }) {
  const { length: L, width: W, height: H } = room.dimensions;
  if (L < 6 || W < 6 || H < 6.5) return null;
  const lightSpan = 3.9; // the work light's length in feet
  const backBlocked = doorSides.includes('back') && L / 2 - 1.8 < 0.3 + lightSpan;
  const leftBlocked = doorSides.includes('left') && W / 2 - 1.8 < 0.3 + lightSpan;
  const alongLeft = backBlocked && !leftBlocked;
  const lightPos: Vec3 = alongLeft ? [1.4, H, 0.3 + lightSpan / 2] : [0.3 + lightSpan / 2, H, 1.4];
  return (
    <group>
      <group position={[1.3, 4.6, 0]}>
        <AssetSlot fallback={null}>
          <BreakerPanel />
        </AssetSlot>
      </group>
      <group position={lightPos} rotation={[0, alongLeft ? Math.PI / 2 : 0, 0]}>
        <AssetSlot fallback={null}>
          <CagedWorkLight lit />
        </AssetSlot>
      </group>
    </group>
  );
}

/** Low wooden garden fence: posts every 2 ft and two rails, with a 3 ft gap at each doorway. */
function GardenFence({ L, W, doorSides }: { L: number; W: number; doorSides: WallSide[] }) {
  const GAP = 1.6; // half the opening at a door
  const sides: Array<{ side: WallSide; from: [number, number]; to: [number, number] }> = [
    { side: 'back', from: [0, 0], to: [L, 0] },
    { side: 'front', from: [0, W], to: [L, W] },
    { side: 'left', from: [0, 0], to: [0, W] },
    { side: 'right', from: [L, 0], to: [L, W] },
  ];
  const posts: Array<[number, number]> = [];
  const rails: Array<{ c: [number, number]; len: number; alongX: boolean }> = [];
  for (const { side, from, to } of sides) {
    const alongX = from[1] === to[1];
    const len = alongX ? L : W;
    const at = (t: number): [number, number] => (alongX ? [t, from[1]] : [from[0], t]);
    const door = doorSides.includes(side);
    const open = (t: number) => door && Math.abs(t - len / 2) < GAP;
    for (let t = 0; t <= len + 1e-6; t += 2) if (!open(t)) posts.push(at(Math.min(len, t)));
    if (door) posts.push(at(len / 2 - GAP), at(len / 2 + GAP));
    const spans: Array<[number, number]> = door ? [[0, len / 2 - GAP], [len / 2 + GAP, len]] : [[0, len]];
    for (const [t0, t1] of spans) rails.push({ c: at((t0 + t1) / 2), len: t1 - t0, alongX });
  }
  return (
    <group>
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.8, z]}>
          <boxGeometry args={[0.18, 1.6, 0.18]} />
          <meshStandardMaterial color="#7a6048" roughness={0.95} />
        </mesh>
      ))}
      {rails.flatMap(({ c, len, alongX }, i) =>
        [0.55, 1.3].map(y => (
          <mesh key={`${i}-${y}`} position={[c[0], y, c[1]]} raycast={() => null}>
            <boxGeometry args={alongX ? [len, 0.14, 0.06] : [0.06, 0.14, len]} />
            <meshStandardMaterial color="#8a6e52" roughness={0.95} />
          </mesh>
        ))
      )}
    </group>
  );
}

export function RoomModel({ room, onFloorClick, doorSides = [], outsideDoorSide }: { room: Room; onFloorClick: (e: ThreeEvent<MouseEvent>) => void; doorSides?: WallSide[]; outsideDoorSide?: WallSide }) {
  const { length: L, width: W, height: H } = room.dimensions;
  const isOutdoor = room.environmentType === 'outdoor_garden';
  const isGreenhouse = room.environmentType === 'greenhouse';
  const floorColor = isOutdoor ? '#3f6212' : isGreenhouse ? '#57534e' : '#27272a';
  const surfaces = roomSurfaces(room);
  const faintGrid = !!surfaces.floor; // a textured floor only needs a hint of the 1 ft grid

  return (
    <group>
      {/* Surrounding ground (yard outside the room); a garden gets lawn, plants and trees instead */}
      {isOutdoor ? (
        <GardenSurroundings room={room} doorSides={doorSides} outsideDoorSide={outsideDoorSide} />
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L / 2, -0.02, W / 2]}>
          <planeGeometry args={[L + 60, W + 60]} />
          <meshStandardMaterial color={isGreenhouse ? '#365314' : '#0c0c0e'} roughness={1} />
        </mesh>
      )}

      {/* Walkable floor */}
      <RoomFloor L={L} W={W} color={floorColor} surface={surfaces.floor} onClick={onFloorClick} />
      {surfaces.ceiling && <RoomCeiling L={L} W={W} H={H} surface={surfaces.ceiling} />}
      <Grid
        position={[L / 2, 0.005, W / 2]}
        args={[L, W]}
        cellSize={1}
        cellThickness={faintGrid ? 0.25 : 0.6}
        cellColor={isOutdoor ? '#4d7c0f' : '#3f3f46'}
        sectionSize={4}
        sectionThickness={faintGrid ? 0.5 : 1}
        sectionColor={isOutdoor ? '#65a30d' : '#52525b'}
        fadeDistance={faintGrid ? 30 : 80}
        infiniteGrid={false}
      />

      {isOutdoor ? (
        <GardenFence L={L} W={W} doorSides={doorSides} />
      ) : isGreenhouse ? (
        <Walls length={L} width={W} height={H} color="#e0f2fe" opacity={0.18} />
      ) : (
        <>
          <Walls length={L} width={W} height={H} color="#3f3f46" opacity={1} surface={surfaces.wall} />
          <RoomFixtures room={room} doorSides={doorSides} />
        </>
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

export type { Doorway } from '../../utils/roomDoorways';
import { Doorway, OUTSIDE_DOOR_ID } from '../../utils/roomDoorways';

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
  const isAdd = door.roomId === 'ADD_ROOM';
  const isOutside = door.roomId === OUTSIDE_DOOR_ID;
  // A garage opens to the outside through a roll-up shutter
  const isShutter = isOutside && /garage|workshop|shed|barn|warehouse/i.test(room.name);

  let position: Vec3;
  let rotation: [number, number, number];

  if (door.side === 'left') {
    position = [0.04, 0, W / 2];
    rotation = [0, Math.PI / 2, 0];
  } else if (door.side === 'right') {
    position = [L - 0.04, 0, W / 2];
    rotation = [0, -Math.PI / 2, 0];
  } else if (door.side === 'back') {
    position = [L / 2, 0, 0.04];
    rotation = [0, 0, 0];
  } else {
    // 'front'
    position = [L / 2, 0, W - 0.04];
    rotation = [0, Math.PI, 0];
  }

  return (
    <group position={position} rotation={rotation}>
      {/* Outer Door Frame */}
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[3.4, 7.2, 0.22]} />
        <meshStandardMaterial 
          color={isAdd ? '#064e3b' : '#3f3f46'} 
          emissive={isAdd ? '#047857' : '#000000'}
          emissiveIntensity={isAdd ? 0.25 : 0}
          roughness={0.6} 
        />
      </mesh>

      {/* Door Panel (Interactive Click Target) */}
      <mesh
        position={[0, 3.5, 0.02]}
        onClick={e => { if (e.delta > 5) return; e.stopPropagation(); onClick(door); }}
        onPointerOver={e => { e.stopPropagation(); onHover(door, e); }}
        onPointerOut={() => onHover(null)}
      >
        <boxGeometry args={[3.0, 7.0, 0.16]} />
        <meshStandardMaterial 
          color={isAdd ? '#047857' : isShutter ? '#52525b' : isOutside ? '#e7e5e4' : '#991b1b'} 
          emissive={isAdd ? '#10b981' : isOutside ? '#000000' : '#7f1d1d'} 
          emissiveIntensity={isAdd ? 0.35 : isOutside ? 0 : 0.18} 
          roughness={0.5} 
        />
        {isShutter && (
          // Child of the click target, so clicks on the shutter open the door too
          <group position={[0, -3.5, 0.09]}>
            <AssetSlot fallback={null}>
              <RollerShutter width={3.0} height={7.0} />
            </AssetSlot>
          </group>
        )}
      </mesh>

      {/* Visual Door Styling Details */}
      {isAdd ? (
        // Glowing Add Room portal sign (+)
        <group position={[0, 3.8, 0.11]}>
          <mesh>
            <boxGeometry args={[0.28, 1.2, 0.05]} />
            <meshStandardMaterial color="#6ee7b7" emissive="#34d399" emissiveIntensity={0.8} />
          </mesh>
          <mesh>
            <boxGeometry args={[1.2, 0.28, 0.05]} />
            <meshStandardMaterial color="#6ee7b7" emissive="#34d399" emissiveIntensity={0.8} />
          </mesh>
        </group>
      ) : isShutter ? null : isOutside ? (
        // White exterior door with a daylight window and a brass handle
        <group position={[0, 0, 0.11]}>
          <mesh position={[0, 5.2, 0]}>
            <boxGeometry args={[2.0, 1.8, 0.04]} />
            <meshStandardMaterial color="#bae6fd" emissive="#7dd3fc" emissiveIntensity={0.35} roughness={0.1} metalness={0.2} />
          </mesh>
          <mesh position={[0, 2.0, 0]}>
            <boxGeometry args={[2.2, 2.5, 0.04]} />
            <meshStandardMaterial color="#d6d3d1" roughness={0.5} />
          </mesh>
          <mesh position={[1.1, 3.3, 0.05]}>
            <cylinderGeometry args={[0.06, 0.06, 0.38, 8]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      ) : (
        // Red return & passage door with recessed panels and brass handle
        <group position={[0, 0, 0.11]}>
          <mesh position={[0, 5.0, 0]}>
            <boxGeometry args={[2.2, 2.5, 0.04]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.4} />
          </mesh>
          <mesh position={[0, 2.0, 0]}>
            <boxGeometry args={[2.2, 2.5, 0.04]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.4} />
          </mesh>
          <mesh position={[1.1, 3.3, 0.05]}>
            <cylinderGeometry args={[0.06, 0.06, 0.38, 8]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function TentModel({
  tent,
  origin,
  highlighted,
  onClick,
  onRightClick,
  onHover
}: {
  tent: Tent;
  origin: Vec3;
  highlighted: boolean;
  onClick: (tent: Tent) => void;
  onRightClick: (tent: Tent) => void;
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
    // Right click (not a camera orbit drag) opens the tent's properties
    onContextMenu: (e: ThreeEvent<MouseEvent>) => {
      e.nativeEvent.preventDefault();
      if (e.delta > 5 || pointerHitsItem(e)) return;
      e.stopPropagation();
      onRightClick(tent);
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
        <meshStandardMaterial 
          color={highlighted ? '#134e4a' : '#1c1c20'} 
          emissive={highlighted ? '#047857' : '#000000'}
          emissiveIntensity={highlighted ? 0.25 : 0}
          roughness={0.8} 
        />
      </mesh>
      <group>
        {poles.map(([x, z], i) => (
          <mesh key={i} position={[x, H / 2, z]}>
            <cylinderGeometry args={[0.04, 0.04, H, 6]} />
            <meshStandardMaterial 
              color={frameColor} 
              emissive={highlighted ? '#10b981' : '#000000'}
              emissiveIntensity={highlighted ? 0.4 : 0}
            />
          </mesh>
        ))}
        {topBars.map((bar, i) => (
          <mesh key={i} position={bar.pos}>
            <boxGeometry args={bar.size} />
            <meshStandardMaterial 
              color={frameColor} 
              emissive={highlighted ? '#10b981' : '#000000'}
              emissiveIntensity={highlighted ? 0.4 : 0}
            />
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
