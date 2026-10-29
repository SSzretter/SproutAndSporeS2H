import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Room, Tent, Item, PlantItem, MushroomItem, EquipmentItem, PersonItem, Position3D } from '../../types/sim';
import { ROLE_METADATA } from '../../utils/npcWorker';
import { tentWorldOrigin, itemWorldPosition, isCeilingMounted, Vec3 } from './coords';
import { PlantModel } from './PlantModel';
import { MushroomModel } from './MushroomModel';
import { EquipmentModel, HeatMatMount } from './EquipmentModel';
import { OccupantModel, PlayerAvatar, PlayerState } from './CharacterModels';
import { RoomModel, TentModel, DoorwayModel, Doorway, ITEM_USER_DATA } from './EnvironmentModels';
import { LabelProjector, LabelLayer, WorldLabel, LabelRegistry } from './ScreenLabels';
import { getVpdZone } from '../../utils/physics';
import { getCropIssues, issueBadgeText } from '../../utils/cropIssues';
import { HoseModel, ExhaustDuctModel, FeedLinesModel } from './HoseModel';
import { getEquipmentActivity, EquipmentActivity } from '../../utils/equipmentStatus';
import { getDuctTargetTent, getHeatMatTarget } from '../../utils/equipmentLinks';
import { isLightScheduledOn } from '../../utils/roomThermal';

export type { Doorway } from './EnvironmentModels';
export type { PlayerState } from './CharacterModels';

export type HoverTarget =
  | { kind: 'item'; item: Item; tentId?: string }
  | { kind: 'tent'; tent: Tent }
  | { kind: 'door'; door: Doorway };

/** Short-lived action popup, anchored at room-floor feet (x, y). */
export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  createdAt: number;
}

interface GameSceneProps {
  room: Room;
  simTime: number;
  doorways: Doorway[];
  hoveredId: string | null;
  hoverTarget?: HoverTarget | null;
  // The item / tent picked with a left click; the wheel and middle-drag act on it until it is deselected
  selectedTarget?: HoverTarget | null;
  floatingTexts: FloatingText[];
  playerRef: React.MutableRefObject<PlayerState>;
  cameraYawRef: React.MutableRefObject<number>;
  onHover: (target: HoverTarget | null) => void;
  onClickItem: (item: Item, tentId: string | undefined, worldPos: Vec3) => void;
  onClickTent: (tent: Tent) => void;
  onClickDoor: (door: Doorway) => void;
  onClickFloor: (x: number, y: number) => void;
  onRightClickItem: (item: Item, tentId: string | undefined) => void;
  onRightClickTent: (tent: Tent) => void;
  onDeselect: () => void; // Left click on nothing at all
  onUpdateItemPosition?: (itemId: string, tentId: string | undefined, newPos: Position3D, label: string) => void;
  onUpdateTentPosition?: (tentId: string, newPos: Position3D, label: string) => void;
  tempUnit: 'F' | 'C';
  showTentStats: boolean; // live temp / RH / VPD / CO2 under each tent's name
}

// Clicks that end a camera drag are ignored (pixels moved between pointer down and up)
const DRAG_CLICK_THRESHOLD_PX = 5;
const MAX_GROW_LIGHTS = 4;

function isCropReady(item: Item): boolean {
  if (item.category === 'plant') return item.stage === 'ready' || (item.stage === 'ripening' && item.stageProgress > 80);
  if (item.category === 'mushroom') return item.stage === 'ready' || item.stage === 'mature';
  return false;
}

function HoverRing({ item, elevation = 0, color = '#34d399' }: { item: Item; elevation?: number; color?: string }) {
  const r = Math.max(item.dimensions.length, item.dimensions.width) / 2 + 0.14;
  const isElevated = elevation > 0.4;
  return (
    <group raycast={() => null}>
      {/* Floor projection / shadow footprint ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -elevation + 0.02, 0]}>
        <ringGeometry args={[r * 0.88, r, 36]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} />
      </mesh>
      {/* Fixture highlight ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, item.dimensions.height * 0.5, 0]}>
        <ringGeometry args={[r * 0.92, r * 1.06, 36]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      {/* Vertical guideline between floor and elevated fixture */}
      {isElevated && (
        <mesh position={[0, (-elevation + item.dimensions.height * 0.5) / 2, 0]}>
          <cylinderGeometry args={[0.015, 0.015, elevation, 6]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

const ACTIVITY_COLORS: Record<EquipmentActivity, string> = {
  running: '#22c55e',
  idle: '#f59e0b',
  blocked: '#ef4444',
  off: '#52525b'
};

/** Status LED on a piece of equipment: pulsing green while it works, amber idle, flashing red blocked, grey off. */
function ActivityLight({ activity, y, x }: { activity: EquipmentActivity; y: number; x: number }) {
  const ref = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.opacity = activity === 'running' ? 0.65 + 0.35 * Math.sin(clock.elapsedTime * 4)
      : activity === 'blocked' ? (Math.sin(clock.elapsedTime * 8) > 0 ? 1 : 0.25)
      : activity === 'idle' ? 0.75 : 0.5;
  });
  return (
    <mesh position={[x, y, 0]} raycast={() => null}>
      <sphereGeometry args={[0.07, 12, 10]} />
      <meshBasicMaterial ref={ref} color={ACTIVITY_COLORS[activity]} transparent toneMapped={false} />
    </mesh>
  );
}


function ItemNode({
  item,
  room,
  tent,
  hour,
  hovered,
  selected,
  onHover,
  onClickItem,
  onRightClickItem
}: {
  item: Item;
  room: Room;
  tent?: Tent;
  hour: number;
  hovered: boolean;
  selected: boolean;
  onHover: GameSceneProps['onHover'];
  onClickItem: GameSceneProps['onClickItem'];
  onRightClickItem: GameSceneProps['onRightClickItem'];
}) {
  const position = itemWorldPosition(item, room, tent);
  const containerTopY = tent ? tentWorldOrigin(tent, room)[1] + tent.dimensions.height : room.dimensions.height;
  const ceilingMounted = isCeilingMounted(item, tent ? tent.dimensions.height : room.dimensions.height);
  const hangFt = Math.max(0, containerTopY - (position[1] + item.dimensions.height));

  const handlers = {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > DRAG_CLICK_THRESHOLD_PX) return;
      e.stopPropagation();
      onClickItem(item, tent?.id, position);
    },
    // Right click (not a camera orbit drag) opens the properties panel
    onContextMenu: (e: ThreeEvent<MouseEvent>) => {
      e.nativeEvent.preventDefault();
      if (e.delta > DRAG_CLICK_THRESHOLD_PX) return;
      e.stopPropagation();
      onRightClickItem(item, tent?.id);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover({ kind: 'item', item, tentId: tent?.id }); },
    onPointerOut: () => onHover(null)
  };

  let model: React.ReactNode;
  if (item.category === 'plant') model = <PlantModel plant={item as PlantItem} />;
  else if (item.category === 'mushroom') model = <MushroomModel shroom={item as MushroomItem} />;
  else if (item.category === 'equipment') {
    // Attached heat mats are drawn around / under whatever they're attached to
    const matTarget = getHeatMatTarget(item, tent ? tent.items : room.items, tent);
    const matMount: HeatMatMount | undefined = !matTarget ? undefined
      : matTarget.kind === 'tent_floor' ? { kind: 'under_tray' }
      : matTarget.wrapped ? { kind: 'wrap', radius: matTarget.item.dimensions.length / 2, height: matTarget.item.dimensions.height }
      : undefined;
    model = <EquipmentModel eq={item as EquipmentItem} hangFt={ceilingMounted ? hangFt : 0} matMount={matMount} simHour={hour} />;
  }
  else model = <OccupantModel occ={item} />;

  return (
    <group position={position} userData={ITEM_USER_DATA}>
      {ceilingMounted ? (
        <group {...handlers}>
          {model}
          {/* Top bracket handle */}
          <mesh position={[0, item.dimensions.height + 0.15, 0]}>
            <boxGeometry args={[Math.min(1, item.dimensions.length * 0.5), 0.3, Math.min(1, item.dimensions.width * 0.5)]} />
            <meshStandardMaterial color={hovered ? '#34d399' : '#3f3f46'} transparent opacity={hovered ? 0.9 : 0.6} />
          </mesh>
          {/* Invisible hover hitbox covering fixture body */}
          <mesh position={[0, item.dimensions.height / 2, 0]} visible={false}>
            <boxGeometry args={[item.dimensions.length + 0.3, item.dimensions.height + 0.3, item.dimensions.width + 0.3]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        </group>
      ) : (
        <group {...handlers}>
          {model}
        </group>
      )}
      {selected ? <HoverRing item={item} elevation={position[1]} color="#fbbf24" /> : hovered && <HoverRing item={item} elevation={position[1]} />}
      {item.category === 'equipment' && !(item.type === 'heat_mat' && item.attachedToId) && (() => {
        const activity = getEquipmentActivity(item, hour);
        if (!activity) return null;
        // On top near one end; under ceiling-hung gear so it stays visible from below
        return <ActivityLight activity={activity.activity} x={item.dimensions.length * 0.35} y={ceilingMounted ? -0.1 : item.dimensions.height + 0.1} />;
      })()}
    </group>
  );
}

/**
 * Third-person follow camera around the cultivator. Right-drag orbits, middle-drag pans along
 * the floor, scroll zooms; left button is left free for interacting. While an item or tent is
 * selected, the wheel raises / lowers it and middle-drag slides it instead. A pan offset holds while
 * the cultivator stands still and eases back to center once they walk.
 */
function CameraRig({ 
  playerRef, 
  cameraYawRef,
  room,
  selectedTarget,
  onUpdateItemPosition,
  onUpdateTentPosition
}: { 
  playerRef: GameSceneProps['playerRef']; 
  cameraYawRef: GameSceneProps['cameraYawRef'];
  room: Room;
  selectedTarget?: HoverTarget | null;
  onUpdateItemPosition?: GameSceneProps['onUpdateItemPosition'];
  onUpdateTentPosition?: GameSceneProps['onUpdateTentPosition'];
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, gl } = useThree();
  const desired = useRef(new THREE.Vector3());
  const panOffset = useRef(new THREE.Vector3());
  const panning = useRef(false);
  const lastPlayer = useRef({ x: playerRef.current.x, y: playerRef.current.y });

  const selectedRef = useRef<HoverTarget | null>(selectedTarget || null);
  selectedRef.current = selectedTarget || null;

  const isDraggingItemRef = useRef<{
    itemId: string;
    tentId?: string;
    itemDims: { length: number; width: number; height: number };
    containerDims: { length: number; width: number; height: number };
    tentOrigin: [number, number];
    plane: THREE.Plane;
    offset: THREE.Vector3;
    currentZ: number;
    itemName: string;
  } | null>(null);

  const isDraggingTentRef = useRef<{
    tentId: string;
    tentDims: { length: number; width: number; height: number };
    roomDims: { length: number; width: number; height: number };
    plane: THREE.Plane;
    offset: THREE.Vector3;
    currentZ: number;
    tentName: string;
  } | null>(null);

  useEffect(() => {
    const p = playerRef.current;
    camera.position.set(p.x, 15, p.y + 15);
    controlsRef.current?.target.set(p.x, 2.5, p.y);
    controlsRef.current?.update();
  }, [camera, playerRef]);

  // Pointer & Wheel listeners for item Z-height scrolling and middle-click X,Y panning
  useEffect(() => {
    const el = gl.domElement;

    const onDown = (e: PointerEvent) => {
      if (e.button === 1) {
        // Middle button: slides the selected item / tent, otherwise pans the camera
        const target = selectedRef.current;
        if (target && target.kind === 'item' && onUpdateItemPosition) {
          e.preventDefault();
          e.stopPropagation();

          const item = target.item;
          const tent = target.tentId ? room.tents.find(t => t.id === target.tentId) : undefined;
          const container = tent ? tent.dimensions : room.dimensions;
          const worldPos = itemWorldPosition(item, room, tent);
          const [tx, , tz] = tent ? tentWorldOrigin(tent, room) : [0, 0, 0];

          // Horizontal plane at the item's world elevation Y
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -worldPos[1]);

          const rect = el.getBoundingClientRect();
          const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
          const hitPoint = new THREE.Vector3();
          raycaster.ray.intersectPlane(plane, hitPoint);

          const offset = new THREE.Vector3(worldPos[0] - hitPoint.x, 0, worldPos[2] - hitPoint.z);
          const currentZ = item.position?.z ?? (isCeilingMounted(item, container.height) ? Math.max(0, container.height - item.dimensions.height - 0.2) : 0);

          isDraggingItemRef.current = {
            itemId: item.id,
            tentId: target.tentId,
            itemDims: item.dimensions,
            containerDims: container,
            tentOrigin: [tx, tz],
            plane,
            offset,
            currentZ,
            itemName: item.name
          };

          if (controlsRef.current) {
            controlsRef.current.enablePan = false;
          }
          document.body.style.cursor = 'move';
          return;
        }

        if (target && target.kind === 'tent' && onUpdateTentPosition) {
          e.preventDefault();
          e.stopPropagation();

          const tent = target.tent;
          const tentOrigin = tentWorldOrigin(tent, room);
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -tentOrigin[1]);

          const rect = el.getBoundingClientRect();
          const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
          const hitPoint = new THREE.Vector3();
          raycaster.ray.intersectPlane(plane, hitPoint);

          const offset = new THREE.Vector3(tentOrigin[0] - hitPoint.x, 0, tentOrigin[2] - hitPoint.z);
          const currentZ = tent.position?.z ?? 0;

          isDraggingTentRef.current = {
            tentId: tent.id,
            tentDims: tent.dimensions,
            roomDims: room.dimensions,
            plane,
            offset,
            currentZ,
            tentName: tent.name
          };

          if (controlsRef.current) {
            controlsRef.current.enablePan = false;
          }
          document.body.style.cursor = 'move';
          return;
        }

        panning.current = true;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (isDraggingTentRef.current && onUpdateTentPosition) {
        e.preventDefault();
        const drag = isDraggingTentRef.current;
        const rect = el.getBoundingClientRect();
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
        const hitPoint = new THREE.Vector3();

        if (raycaster.ray.intersectPlane(drag.plane, hitPoint)) {
          const worldX = hitPoint.x + drag.offset.x;
          const worldZ = hitPoint.z + drag.offset.z;

          // Clamp tent footprint within room floor
          const maxX = Math.max(0.5, drag.roomDims.length - drag.tentDims.length - 0.5);
          const maxZ = Math.max(0.5, drag.roomDims.width - drag.tentDims.width - 0.5);
          const clampedX = Math.round(Math.max(0.5, Math.min(maxX, worldX)) * 10) / 10;
          const clampedY = Math.round(Math.max(0.5, Math.min(maxZ, worldZ)) * 10) / 10;

          onUpdateTentPosition(
            drag.tentId,
            { x: clampedX, y: clampedY, z: drag.currentZ },
            `🎪 ${drag.tentName}: (${clampedX.toFixed(1)}, ${clampedY.toFixed(1)}) ft`
          );
        }
        return;
      }

      if (isDraggingItemRef.current && onUpdateItemPosition) {
        e.preventDefault();
        const drag = isDraggingItemRef.current;
        const rect = el.getBoundingClientRect();
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
        const hitPoint = new THREE.Vector3();

        if (raycaster.ray.intersectPlane(drag.plane, hitPoint)) {
          const worldX = hitPoint.x + drag.offset.x;
          const worldZ = hitPoint.z + drag.offset.z;

          // Convert from world to container local
          const localX = worldX - drag.tentOrigin[0];
          const localY = worldZ - drag.tentOrigin[1];

          // Clamp within container
          const halfL = drag.itemDims.length / 2;
          const halfW = drag.itemDims.width / 2;
          const clampedX = Math.round(Math.max(halfL, Math.min(drag.containerDims.length - halfL, localX)) * 100) / 100;
          const clampedY = Math.round(Math.max(halfW, Math.min(drag.containerDims.width - halfW, localY)) * 100) / 100;

          onUpdateItemPosition(
            drag.itemId,
            drag.tentId,
            { x: clampedX, y: clampedY, z: drag.currentZ },
            `✥ ${drag.itemName}: X ${clampedX.toFixed(1)} ft, Y ${clampedY.toFixed(1)} ft`
          );
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      if (e.button === 1) {
        if (isDraggingTentRef.current) {
          isDraggingTentRef.current = null;
          if (controlsRef.current) {
            controlsRef.current.enablePan = true;
          }
          document.body.style.cursor = 'default';
        }
        if (isDraggingItemRef.current) {
          isDraggingItemRef.current = null;
          if (controlsRef.current) {
            controlsRef.current.enablePan = true;
          }
          document.body.style.cursor = 'default';
        }
        panning.current = false;
      }
    };

    // Scroll wheel: raises / lowers the selected item or tent wherever the cursor is (zooms when nothing is selected)
    const onWheel = (e: WheelEvent) => {
      const target = selectedRef.current;
      if (!target) return;

      if (target.kind === 'tent' && onUpdateTentPosition) {
        e.preventDefault();
        e.stopPropagation();

        // Fetch live tent from room so every successive scroll reads the new Z
        const liveTent = room.tents.find(t => t.id === target.tent.id) || target.tent;
        const currentZ = liveTent.position?.z ?? 0;
        const currentX = liveTent.position?.x ?? 1;
        const currentY = liveTent.position?.y ?? 1;

        const step = e.shiftKey ? 0.05 : 0.2;
        const dir = e.deltaY < 0 ? 1 : -1;
        const maxZ = Math.max(0, room.dimensions.height - liveTent.dimensions.height);
        const newZ = Math.round(Math.max(0, Math.min(maxZ, currentZ + dir * step)) * 100) / 100;

        onUpdateTentPosition(
          liveTent.id,
          { x: currentX, y: currentY, z: newZ },
          `🎪 ${liveTent.name} Height: ${newZ.toFixed(2)} ft (Z)`
        );
        return;
      }

      if (target.kind === 'item' && onUpdateItemPosition) {
        e.preventDefault();
        e.stopPropagation();

        // Fetch live item from tent/room so every successive scroll reads the new Z
        const tent = target.tentId ? room.tents.find(t => t.id === target.tentId) : undefined;
        const liveItem = (tent ? tent.items : room.items).find(i => i.id === target.item.id) || target.item;
        const container = tent ? tent.dimensions : room.dimensions;

        const currentZ = liveItem.position?.z ?? (isCeilingMounted(liveItem, container.height) ? Math.max(0, container.height - liveItem.dimensions.height - 0.2) : 0);
        const currentX = liveItem.position?.x ?? container.length / 2;
        const currentY = liveItem.position?.y ?? container.width / 2;

        const step = e.shiftKey ? 0.05 : 0.2;
        const dir = e.deltaY < 0 ? 1 : -1; // scroll up raises height, scroll down lowers height
        const maxZ = Math.max(0, container.height - liveItem.dimensions.height);
        const newZ = Math.round(Math.max(0, Math.min(maxZ, currentZ + dir * step)) * 100) / 100;

        onUpdateItemPosition(
          liveItem.id,
          target.tentId,
          { x: currentX, y: currentY, z: newZ },
          `↕️ ${liveItem.name} Height: ${newZ.toFixed(2)} ft (Z)`
        );
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1 && selectedRef.current?.kind === 'item') {
        e.preventDefault();
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = 'default';
    };
  }, [gl, camera, room, onUpdateItemPosition]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // The wheel belongs to the selected item / tent; with nothing selected it zooms
    controls.enableZoom = !selectedRef.current;
    

    const p = playerRef.current;
    desired.current.set(p.x, 2.5, p.y);

    if (panning.current) {
      panOffset.current.copy(controls.target).sub(desired.current);
    } else {
      const moved = p.x !== lastPlayer.current.x || p.y !== lastPlayer.current.y;
      if (moved) panOffset.current.multiplyScalar(0.92);
      desired.current.add(panOffset.current);
      const delta = desired.current.sub(controls.target).multiplyScalar(0.12);
      controls.target.add(delta);
      camera.position.add(delta);
    }
    lastPlayer.current.x = p.x;
    lastPlayer.current.y = p.y;

    controls.update();
    cameraYawRef.current = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      mouseButtons={{ LEFT: -1 as THREE.MOUSE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }}
      screenSpacePanning={false}
      minDistance={4}
      maxDistance={45}
      maxPolarAngle={Math.PI * 0.46}
      minPolarAngle={0.15}
    />
  );
}

/** Indoor fill + time-of-day sun/sky for outdoor gardens & greenhouses, plus lit grow lights. */
function SceneLighting({ room, simTime }: { room: Room; simTime: number }) {
  const date = new Date(simTime);
  const hour = date.getHours() + date.getMinutes() / 60;
  const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const exposed = room.environmentType === 'outdoor_garden' || room.environmentType === 'greenhouse';
  const { length: L, width: W, height: H } = room.dimensions;

  const growLights: Vec3[] = [];
  const addLights = (items: Item[], tent?: Tent) => {
    for (const it of items) {
      if (growLights.length >= MAX_GROW_LIGHTS) return;
      if (it.category === 'equipment' && it.type === 'grow_light' && it.powerOn && isLightScheduledOn(hour, it.schedule)) {
        const [x, y, z] = itemWorldPosition(it, room, tent);
        growLights.push([x, y - 0.1, z]);
      }
    }
  };
  room.tents.forEach(t => addLights(t.items, t));
  addLights(room.items);

  const sky = exposed
    ? new THREE.Color('#0b1020').lerp(new THREE.Color('#7dd3fc'), daylight)
    : new THREE.Color('#09090b');

  return (
    <>
      <color attach="background" args={[sky]} />
      <hemisphereLight args={['#e0f2fe', '#1c1917', exposed ? 0.25 + daylight * 0.6 : 0.55]} />
      <ambientLight intensity={exposed ? 0.15 + daylight * 0.25 : 0.35} />
      {exposed ? (
        <directionalLight position={[L / 2 + 20, 10 + daylight * 30, W / 2 + 10]} intensity={0.2 + daylight * 1.8} color={daylight > 0.3 ? '#fff7e6' : '#fbbf24'} />
      ) : (
        <directionalLight position={[L / 2, H + 6, W + 8]} intensity={0.9} color="#f4f4f5" />
      )}
      {growLights.map((pos, i) => (
        <pointLight key={i} position={pos} intensity={4} distance={8} decay={1.6} color="#fbfaf5" />
      ))}
    </>
  );
}

/** Every world-anchored label in the room: tent names, doors, harvest-ready badges, action popups. */
function buildWorldLabels(
  room: Room,
  doorways: Doorway[],
  floatingTexts: FloatingText[],
  hoveredId: string | null,
  tempUnit: 'F' | 'C',
  showTentStats: boolean
): WorldLabel[] {
  const labels: WorldLabel[] = [];
  for (const tent of room.tents) {
    const [ox, oy, oz] = tentWorldOrigin(tent, room);
    const { climate } = tent;
    // VPD is coloured by the zone that suits this tent's crop
    const vpdZone = getVpdZone(climate.vpdKpa, tent.items.some(i => i.category === 'mushroom') ? 'mushroom' : 'plant');
    labels.push({
      id: `tent-${tent.id}`,
      position: [ox + tent.dimensions.length / 2, oy + tent.dimensions.height + 0.3, oz + tent.dimensions.width / 2],
      text: `⛺ ${tent.name}`,
      variant: hoveredId === tent.id ? 'tentActive' : 'tent',
      stats: showTentStats ? [
        { icon: '🌡️', value: tempUnit === 'F' ? `${climate.tempF.toFixed(1)}°F` : `${climate.tempC.toFixed(1)}°C`, className: 'text-amber-300' },
        { icon: '💧', value: `${Math.round(climate.rh)}%`, className: 'text-cyan-300' },
        { icon: '🌿', value: `${climate.vpdKpa.toFixed(2)} kPa`, className: vpdZone.color },
        { icon: '🌫️', value: `${Math.round(climate.co2Ppm || 0)} ppm`, className: 'text-purple-300' }
      ] : undefined
    });
  }
  for (const door of doorways) {
    let x: number;
    let z: number;
    if (door.side === 'left') {
      x = 0;
      z = room.dimensions.width / 2;
    } else if (door.side === 'right') {
      x = room.dimensions.length;
      z = room.dimensions.width / 2;
    } else if (door.side === 'back') {
      x = room.dimensions.length / 2;
      z = 0;
    } else {
      x = room.dimensions.length / 2;
      z = room.dimensions.width;
    }
    const isAdd = door.roomId === 'ADD_ROOM';
    labels.push({ 
      id: `door-${door.side}`, 
      position: [x, 7.4, z], 
      text: door.label, 
      variant: isAdd ? 'doorAdd' : 'door' 
    });
  }
  const roomItems = [...room.items, ...room.tents.flatMap(t => t.items)];
  const addBadges = (items: Item[], tent?: Tent) => {
    // Plants in rack trays share one badge per rack (a sown rack holds hundreds of them)
    const rackTallies = new Map<string, { ready: number; issues: Map<string, number>; critical: boolean }>();
    for (const item of items) {
      if (item.category !== 'plant' && item.category !== 'mushroom') continue;
      if (item.category === 'plant' && item.rackSlot) {
        const tally = rackTallies.get(item.rackSlot.rackId) ?? { ready: 0, issues: new Map<string, number>(), critical: false };
        if (isCropReady(item)) tally.ready++;
        const issues = getCropIssues(item, (tent ?? room).climate, items, !tent && room.environmentType === 'outdoor_garden', roomItems);
        if (issues.length > 0) {
          const text = issueBadgeText(issues[0]);
          tally.issues.set(text, (tally.issues.get(text) ?? 0) + 1);
          tally.critical ||= issues[0].severity === 'critical';
        }
        rackTallies.set(item.rackSlot.rackId, tally);
        continue;
      }
      const [x, y, z] = itemWorldPosition(item, room, tent);
      const top = y + item.dimensions.height + 0.4;
      const ready = isCropReady(item);
      if (ready) labels.push({ id: `ready-${item.id}`, position: [x, top, z], text: '✂', variant: 'badge' });
      // Most severe problem first, with a count of any others (all are listed in the hover tooltip)
      const issues = getCropIssues(item, (tent ?? room).climate, items, !tent && room.environmentType === 'outdoor_garden', roomItems);
      if (issues.length > 0) {
        labels.push({
          id: `issue-${item.id}`,
          position: [x, ready ? top + 0.9 : top, z],
          text: `${issues[0].severity === 'critical' ? '⛔' : '⚠'} ${issueBadgeText(issues[0])}${issues.length > 1 ? ` +${issues.length - 1}` : ''}`,
          variant: issues[0].severity === 'critical' ? 'issueCritical' : 'issueWarning'
        });
      }
    }
    for (const [rackId, tally] of rackTallies) {
      const rack = items.find(i => i.id === rackId);
      if (!rack) continue;
      const [x, y, z] = itemWorldPosition(rack, room, tent);
      const top = y + rack.dimensions.height + 0.4;
      if (tally.ready > 0) labels.push({ id: `ready-${rackId}`, position: [x, top, z], text: `✂ ${tally.ready}`, variant: 'badge' });
      if (tally.issues.size > 0) {
        // The most common problem, and how many plants on the rack have any problem
        const [text] = [...tally.issues.entries()].sort((a, b) => b[1] - a[1])[0];
        const affected = [...tally.issues.values()].reduce((a, b) => a + b, 0);
        labels.push({
          id: `issue-${rackId}`,
          position: [x, tally.ready > 0 ? top + 0.9 : top, z],
          text: `${tally.critical ? '⛔' : '⚠'} ${text} · ${affected} plant${affected === 1 ? '' : 's'}`,
          variant: tally.critical ? 'issueCritical' : 'issueWarning'
        });
      }
    }
  };
  room.tents.forEach(t => addBadges(t.items, t));
  addBadges(room.items);

  // Add 3D Overhead Labels for NPCs (Residents & Workers)
  const addPersonLabels = (items: Item[], tent?: Tent) => {
    for (const item of items) {
      if (item.category !== 'person') continue;
      const person = item as PersonItem;
      const [x, y, z] = itemWorldPosition(item, room, tent);
      const top = y + (item.dimensions?.height || 5.8) + 0.6;
      const role = person.role || 'resident';
      const meta = ROLE_METADATA[role] || ROLE_METADATA.resident;
      const roleIcon = meta.badge.split(' ')[0];
      labels.push({
        id: `npc-${item.id}`,
        position: [x, top, z],
        text: `${roleIcon} ${person.name.split(' ')[0]}`,
        subText: person.currentAction || meta.title,
        variant: 'npc'
      });
    }
  };
  room.tents.forEach(t => addPersonLabels(t.items, t));
  addPersonLabels(room.items);

  for (const ft of floatingTexts) {
    labels.push({ id: ft.id, position: [ft.x, 4.5, ft.y], text: ft.text, variant: 'float', color: ft.color });
  }
  return labels;
}

function SceneContent(props: GameSceneProps & { labels: WorldLabel[]; labelRegistry: LabelRegistry }) {
  const { room, simTime, doorways, hoveredId, playerRef, cameraYawRef, onHover, onClickItem, onClickTent, onClickDoor, onClickFloor, onRightClickItem, onRightClickTent, labels, labelRegistry } = props;
  const sel = props.selectedTarget;
  const selectedId = !sel ? null : sel.kind === 'item' ? sel.item.id : sel.kind === 'tent' ? sel.tent.id : null;
  const hour = new Date(simTime).getHours();

  const handleFloorClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > DRAG_CLICK_THRESHOLD_PX) return;
    onClickFloor(e.point.x, e.point.z);
  };

  return (
    <>
      <SceneLighting room={room} simTime={simTime} />
      <CameraRig playerRef={playerRef} cameraYawRef={cameraYawRef} room={room} selectedTarget={props.selectedTarget} onUpdateItemPosition={props.onUpdateItemPosition} onUpdateTentPosition={props.onUpdateTentPosition} />
      <RoomModel room={room} onFloorClick={handleFloorClick} />
      {doorways.map(door => (
        <DoorwayModel
          key={`${door.side}-${door.roomId}`}
          door={door}
          room={room}
          onClick={onClickDoor}
          onHover={d => onHover(d ? { kind: 'door', door: d } : null)}
        />
      ))}
      {room.tents.map(tent => (
        <group key={tent.id}>
          <TentModel
            tent={tent}
            origin={tentWorldOrigin(tent, room)}
            highlighted={hoveredId === tent.id || selectedId === tent.id}
            onClick={onClickTent}
            onRightClick={onRightClickTent}
            onHover={t => onHover(t ? { kind: 'tent', tent: t } : null)}
          />
          {tent.items.map(item => (
            <ItemNode key={item.id} item={item} room={room} tent={tent} hour={hour} hovered={hoveredId === item.id} selected={selectedId === item.id} onHover={onHover} onClickItem={onClickItem} onRightClickItem={onRightClickItem} />
          ))}
          {tent.items.map(item => item.category === 'equipment' && item.type === 'exhaust_fan' && item.exhaustTo === 'outdoors'
            ? <ExhaustDuctModel key={`duct-${item.id}`} eq={item} room={room} tent={tent} />
            : null)}
          {tent.items.map(item => item.category === 'equipment' && item.type === 'nutrient_reservoir'
            ? <FeedLinesModel key={`feed-${item.id}`} eq={item} room={room} tent={tent} />
            : null)}
        </group>
      ))}
      {room.items.map(item => item.category === 'equipment' && item.type === 'exhaust_fan' && item.exhaustTo === 'outdoors'
        ? <ExhaustDuctModel key={`duct-${item.id}`} eq={item} room={room} />
        : null)}
      {room.items.map(item => item.category === 'equipment' && item.type === 'nutrient_reservoir'
        ? <FeedLinesModel key={`feed-${item.id}`} eq={item} room={room} />
        : null)}
      {room.items.map(item => (
        <ItemNode key={item.id} item={item} room={room} hour={hour} hovered={hoveredId === item.id} selected={selectedId === item.id} onHover={onHover} onClickItem={onClickItem} onRightClickItem={onRightClickItem} />
      ))}
      {room.items.map(item => {
        const ductTent = getDuctTargetTent(room, item);
        return ductTent ? <HoseModel key={`hose-${item.id}`} eq={item as EquipmentItem} tent={ductTent} room={room} /> : null;
      })}
      <PlayerAvatar playerRef={playerRef} />
      <LabelProjector labels={labels} registry={labelRegistry} />
    </>
  );
}

export function GameScene(props: GameSceneProps) {
  const labelRegistry: LabelRegistry = useRef(new Map<string, HTMLDivElement>());
  const labels = buildWorldLabels(props.room, props.doorways, props.floatingTexts, props.hoveredId, props.tempUnit, props.showTentStats);
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 50, near: 0.1, far: 400, position: [8, 15, 22] }}
        onPointerMissed={e => {
          props.onHover(null);
          if (e.button === 0) props.onDeselect(); // Left click on empty space
        }}
      >
        <SceneContent {...props} labels={labels} labelRegistry={labelRegistry} />
      </Canvas>
      <LabelLayer labels={labels} registry={labelRegistry} />
    </div>
  );
}
