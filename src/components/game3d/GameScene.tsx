import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Room, Tent, Item, PlantItem, MushroomItem, EquipmentItem } from '../../types/sim';
import { tentWorldOrigin, itemWorldPosition, isCeilingMounted, Vec3 } from './coords';
import { PlantModel } from './PlantModel';
import { MushroomModel } from './MushroomModel';
import { EquipmentModel, HeatMatMount } from './EquipmentModel';
import { OccupantModel, PlayerAvatar, PlayerState } from './CharacterModels';
import { RoomModel, TentModel, DoorwayModel, Doorway, ITEM_USER_DATA } from './EnvironmentModels';
import { LabelProjector, LabelLayer, WorldLabel, LabelRegistry } from './ScreenLabels';
import { getVpdZone } from '../../utils/physics';
import { getCropIssues, issueBadgeText } from '../../utils/cropIssues';
import { HoseModel, ExhaustDuctModel } from './HoseModel';
import { getEquipmentActivity, EquipmentActivity } from '../../utils/equipmentStatus';
import { getDuctTargetTent, getHeatMatTarget } from '../../utils/equipmentLinks';

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
  floatingTexts: FloatingText[];
  playerRef: React.MutableRefObject<PlayerState>;
  cameraYawRef: React.MutableRefObject<number>;
  onHover: (target: HoverTarget | null) => void;
  onClickItem: (item: Item, tentId: string | undefined, worldPos: Vec3) => void;
  onClickTent: (tent: Tent) => void;
  onClickDoor: (door: Doorway) => void;
  onClickFloor: (x: number, y: number) => void;
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

function HoverRing({ item }: { item: Item }) {
  const r = Math.max(item.dimensions.length, item.dimensions.width) / 2 + 0.12;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[r * 0.9, r, 40]} />
      <meshBasicMaterial color="#34d399" transparent opacity={0.9} />
    </mesh>
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
  onHover,
  onClickItem
}: {
  item: Item;
  room: Room;
  tent?: Tent;
  hour: number;
  hovered: boolean;
  onHover: GameSceneProps['onHover'];
  onClickItem: GameSceneProps['onClickItem'];
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
    model = <EquipmentModel eq={item as EquipmentItem} hangFt={ceilingMounted ? hangFt : 0} matMount={matMount} />;
  }
  else model = <OccupantModel occ={item} />;

  return (
    <group position={position} userData={ITEM_USER_DATA}>
      {ceilingMounted ? (
        <>
          {/* Ceiling gear isn't clickable through its body (it would cover the canopy);
              a slim hit area on top of it is. */}
          {model}
          <mesh position={[0, item.dimensions.height + 0.15, 0]} {...handlers}>
            <boxGeometry args={[Math.min(1, item.dimensions.length * 0.5), 0.3, Math.min(1, item.dimensions.width * 0.5)]} />
            <meshStandardMaterial color={hovered ? '#34d399' : '#3f3f46'} transparent opacity={hovered ? 0.9 : 0.6} />
          </mesh>
        </>
      ) : (
        <group {...handlers}>{model}</group>
      )}
      {hovered && <HoverRing item={item} />}
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
 * the floor, scroll zooms; left button is left free for interacting. A pan offset holds while
 * the cultivator stands still and eases back to center once they walk.
 */
function CameraRig({ playerRef, cameraYawRef }: { playerRef: GameSceneProps['playerRef']; cameraYawRef: GameSceneProps['cameraYawRef'] }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, gl } = useThree();
  const desired = useRef(new THREE.Vector3());
  const panOffset = useRef(new THREE.Vector3());
  const panning = useRef(false);
  const lastPlayer = useRef({ x: playerRef.current.x, y: playerRef.current.y });

  useEffect(() => {
    const p = playerRef.current;
    camera.position.set(p.x, 15, p.y + 15);
    controlsRef.current?.target.set(p.x, 2.5, p.y);
    controlsRef.current?.update();
  }, [camera, playerRef]);

  useEffect(() => {
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => { if (e.button === 1) panning.current = true; };
    const onUp = (e: PointerEvent) => { if (e.button === 1) panning.current = false; };
    // Middle-click would otherwise start the browser's autoscroll
    const onMouseDown = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, [gl]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const p = playerRef.current;
    desired.current.set(p.x, 2.5, p.y);

    if (panning.current) {
      // OrbitControls is moving the target; remember where it is relative to the cultivator
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
      // -1 = no camera action, so left clicks only interact
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
      if (it.category === 'equipment' && it.type === 'grow_light' && it.powerOn) {
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
    const x = door.side === 'left' ? 0 : room.dimensions.length;
    labels.push({ id: `door-${door.side}`, position: [x, 7.4, room.dimensions.width / 2], text: door.label, variant: 'door' });
  }
  const addBadges = (items: Item[], tent?: Tent) => {
    for (const item of items) {
      if (item.category !== 'plant' && item.category !== 'mushroom') continue;
      const [x, y, z] = itemWorldPosition(item, room, tent);
      const top = y + item.dimensions.height + 0.4;
      const ready = isCropReady(item);
      if (ready) labels.push({ id: `ready-${item.id}`, position: [x, top, z], text: '✂', variant: 'badge' });
      // Most severe problem first, with a count of any others (all are listed in the hover tooltip)
      const issues = getCropIssues(item, (tent ?? room).climate, items, !tent && room.environmentType === 'outdoor_garden');
      if (issues.length > 0) {
        labels.push({
          id: `issue-${item.id}`,
          position: [x, ready ? top + 0.9 : top, z],
          text: `${issues[0].severity === 'critical' ? '⛔' : '⚠'} ${issueBadgeText(issues[0])}${issues.length > 1 ? ` +${issues.length - 1}` : ''}`,
          variant: issues[0].severity === 'critical' ? 'issueCritical' : 'issueWarning'
        });
      }
    }
  };
  room.tents.forEach(t => addBadges(t.items, t));
  addBadges(room.items);
  for (const ft of floatingTexts) {
    labels.push({ id: ft.id, position: [ft.x, 4.5, ft.y], text: ft.text, variant: 'float', color: ft.color });
  }
  return labels;
}

function SceneContent(props: GameSceneProps & { labels: WorldLabel[]; labelRegistry: LabelRegistry }) {
  const { room, simTime, doorways, hoveredId, playerRef, cameraYawRef, onHover, onClickItem, onClickTent, onClickDoor, onClickFloor, labels, labelRegistry } = props;
  const hour = new Date(simTime).getHours();

  const handleFloorClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > DRAG_CLICK_THRESHOLD_PX) return;
    onClickFloor(e.point.x, e.point.z);
  };

  return (
    <>
      <SceneLighting room={room} simTime={simTime} />
      <CameraRig playerRef={playerRef} cameraYawRef={cameraYawRef} />
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
            highlighted={hoveredId === tent.id}
            onClick={onClickTent}
            onHover={t => onHover(t ? { kind: 'tent', tent: t } : null)}
          />
          {tent.items.map(item => (
            <ItemNode key={item.id} item={item} room={room} tent={tent} hour={hour} hovered={hoveredId === item.id} onHover={onHover} onClickItem={onClickItem} />
          ))}
          {tent.items.map(item => item.category === 'equipment' && item.type === 'exhaust_fan' && item.exhaustTo === 'outdoors'
            ? <ExhaustDuctModel key={`duct-${item.id}`} eq={item} room={room} tent={tent} />
            : null)}
        </group>
      ))}
      {room.items.map(item => item.category === 'equipment' && item.type === 'exhaust_fan' && item.exhaustTo === 'outdoors'
        ? <ExhaustDuctModel key={`duct-${item.id}`} eq={item} room={room} />
        : null)}
      {room.items.map(item => (
        <ItemNode key={item.id} item={item} room={room} hour={hour} hovered={hoveredId === item.id} onHover={onHover} onClickItem={onClickItem} />
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
        onPointerMissed={() => props.onHover(null)}
      >
        <SceneContent {...props} labels={labels} labelRegistry={labelRegistry} />
      </Canvas>
      <LabelLayer labels={labels} registry={labelRegistry} />
    </div>
  );
}
