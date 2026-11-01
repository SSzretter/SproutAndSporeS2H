import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { EquipmentItem, Room, Tent } from '../../types/sim';
import { tentWorldOrigin, itemWorldPosition } from './coords';
import { getRackTiers, getTierShelfHeightFt, isGrowRack, TRAY_1020 } from '../../utils/growRacks';

const MIST_HOSE_RADIUS_FT = 0.07; // ~1.7" flexible mist hose
const CO2_TUBE_RADIUS_FT = 0.02; // ~1/4" CO2 injection tubing

/**
 * Hose from a room-level unit to the nearest wall of the tent it feeds (entering through a side
 * port at about half the tent's height): a flexible mist hose for humidifiers, thin clear tubing
 * for CO2 controllers.
 */
export function HoseModel({ eq, tent, room }: { eq: EquipmentItem; tent: Tent; room: Room }) {
  const [ux, uy, uz] = itemWorldPosition(eq, room);
  const [tx, ty, tz] = tentWorldOrigin(tent, room);
  const { length: tL, width: tW, height: tH } = tent.dimensions;
  const isCo2 = eq.type === 'co2_regulator';
  const radius = isCo2 ? CO2_TUBE_RADIUS_FT : MIST_HOSE_RADIUS_FT;

  const geometry = useMemo(() => {
    const nozzle = new THREE.Vector3(ux, uy + eq.dimensions.height, uz);

    // Nearest point on the tent's footprint outline
    let px = Math.min(tx + tL, Math.max(tx, ux));
    let pz = Math.min(tz + tW, Math.max(tz, uz));
    const inside = px === ux && pz === uz;
    if (inside) {
      const edges = [ux - tx, tx + tL - ux, uz - tz, tz + tW - uz];
      const nearest = edges.indexOf(Math.min(...edges));
      if (nearest === 0) px = tx;
      else if (nearest === 1) px = tx + tL;
      else if (nearest === 2) pz = tz;
      else pz = tz + tW;
    }
    const portY = ty + Math.max(tH * 0.5, Math.min(tH - 0.3, nozzle.y));
    const port = new THREE.Vector3(px, portY, pz);
    // Short stub through the wall into the tent
    const inward = new THREE.Vector3(tx + tL / 2 - px, 0, tz + tW / 2 - pz).normalize().multiplyScalar(0.3);
    const inner = port.clone().add(inward);

    const span = nozzle.distanceTo(port);
    const rise = nozzle.clone().add(new THREE.Vector3(0, Math.min(1.2, 0.3 + span * 0.2), 0));
    const sag = nozzle.clone().lerp(port, 0.6);
    sag.y = Math.max(radius, Math.min(rise.y, port.y) - Math.min(0.8, span * 0.15));
    const approach = port.clone().sub(inward.clone().multiplyScalar(1.2));

    const curve = new THREE.CatmullRomCurve3([nozzle, rise, sag, approach, port, inner]);
    return new THREE.TubeGeometry(curve, Math.max(24, Math.round(span * 12)), radius, 8, false);
  }, [ux, uy, uz, tx, ty, tz, tL, tW, tH, eq.dimensions.height, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    // Never intercept pointer events meant for the unit, tent or canopy
    <mesh geometry={geometry} raycast={() => null}>
      <meshStandardMaterial color={isCo2 ? '#e0f2fe' : '#d4d4d8'} roughness={isCo2 ? 0.2 : 0.55} transparent opacity={isCo2 ? 0.6 : 0.85} />
    </mesh>
  );
}

const DUCT_RADIUS_FT: Record<number, number> = { 4: 0.17, 6: 0.25 }; // 4" / 6" flex duct

/**
 * Foil flex duct from an exhaust fan ducted outdoors: up out of the tent's roof port, across to
 * the nearest room wall near ceiling height, ending in a wall vent.
 */
export function ExhaustDuctModel({ eq, room, tent }: { eq: EquipmentItem; room: Room; tent?: Tent }) {
  const [fx, fy, fz] = itemWorldPosition(eq, room, tent);
  const { length: L, height: H } = eq.dimensions;
  const radius = DUCT_RADIUS_FT[eq.ductSizeIn ?? 6] ?? 0.25;
  const { length: rL, width: rW, height: rH } = room.dimensions;
  const tentTop = tent ? tentWorldOrigin(tent, room)[1] + tent.dimensions.height : fy + H;

  const { geometry, vent } = useMemo(() => {
    const outlet = new THREE.Vector3(fx + L / 2, fy + H / 2, fz);
    const runY = Math.min(rH - radius - 0.1, Math.max(tentTop + 0.4, outlet.y + 0.4));
    // Nearest room wall to the fan
    const dists = [fx, rL - fx, fz, rW - fz];
    const wall = dists.indexOf(Math.min(...dists));
    const wallPt = wall === 0 ? new THREE.Vector3(0, runY, fz)
      : wall === 1 ? new THREE.Vector3(rL, runY, fz)
      : wall === 2 ? new THREE.Vector3(fx, runY, 0)
      : new THREE.Vector3(fx, runY, rW);
    const bendOut = outlet.clone().add(new THREE.Vector3(0.35, 0, 0));
    const up = new THREE.Vector3(bendOut.x, runY - 0.3, bendOut.z);
    const top = new THREE.Vector3(bendOut.x, runY, bendOut.z);
    const nearWall = top.clone().lerp(wallPt, 0.9);
    const pts = [outlet, bendOut, up, top, nearWall, wallPt].filter((p, i, a) => i === 0 || p.distanceTo(a[i - 1]) > 0.05);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    return {
      geometry: new THREE.TubeGeometry(curve, Math.max(32, Math.round(curve.getLength() * 10)), radius, 12, false),
      vent: { pos: wallPt, wall }
    };
  }, [fx, fy, fz, L, H, radius, rL, rW, rH, tentTop]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const ventRotation: [number, number, number] = vent.wall < 2 ? [0, Math.PI / 2, 0] : [0, 0, 0];
  return (
    // Never intercept pointer events meant for the fan, tent or canopy
    <group>
      <mesh geometry={geometry} raycast={() => null}>
        <meshStandardMaterial color="#c8ccd2" metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh position={vent.pos} rotation={ventRotation} raycast={() => null}>
        <boxGeometry args={[radius * 3, radius * 3, 0.06]} />
        <meshStandardMaterial color="#e4e4e7" roughness={0.6} />
      </mesh>
    </group>
  );
}

const FEED_LINE_RADIUS_FT = 0.03; // ~3/4" vinyl feed tubing

/** One feed line: up out of the tank lid, arcing over to where it delivers. */
function FeedLine({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const [ax, ay, az] = from;
  const [bx, by, bz] = to;
  const geometry = useMemo(() => {
    const start = new THREE.Vector3(ax, ay, az);
    const end = new THREE.Vector3(bx, by, bz);
    const span = start.distanceTo(end);
    const lift = new THREE.Vector3(ax, ay + 0.3, az);
    const mid = start.clone().lerp(end, 0.5);
    mid.y = Math.max(ay, by) + Math.min(1, 0.25 + span * 0.12);
    const curve = new THREE.CatmullRomCurve3([start, lift, mid, end]);
    return new THREE.TubeGeometry(curve, Math.max(20, Math.round(span * 10)), FEED_LINE_RADIUS_FT, 6, false);
  }, [ax, ay, az, bx, by, bz]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} raycast={() => null}>
      <meshStandardMaterial color="#38bdf8" roughness={0.35} transparent opacity={0.8} />
    </mesh>
  );
}

/**
 * Feed lines from a nutrient reservoir to what it feeds, anywhere in the room: one line per fed rack
 * shelf (to the shelf's tray at the end of the rack nearest the tank) and one per fed plant (to its pot rim).
 */
export function FeedLinesModel({ eq, room, tent }: { eq: EquipmentItem; room: Room; tent?: Tent }) {
  // Targets can stand anywhere in the room: on its floor or in any tent
  const located = [
    ...room.items.map(item => ({ item, host: undefined as Tent | undefined })),
    ...room.tents.flatMap(t => t.items.map(item => ({ item, host: t as Tent | undefined })))
  ];
  const [rx, ry, rz] = itemWorldPosition(eq, room, tent);
  const from: [number, number, number] = [rx, ry + eq.dimensions.height, rz];
  const ends: Array<{ key: string; to: [number, number, number] }> = [];
  for (const target of eq.feedTargets ?? []) {
    const found = located.find(l => l.item.id === target.id);
    if (!found) continue;
    const { item, host } = found;
    const [x, y, z] = itemWorldPosition(item, room, host);
    if (isGrowRack(item)) {
      const shelves = getRackTiers(item).length;
      const endX = rx < x ? x - item.dimensions.length / 2 + 0.15 : x + item.dimensions.length / 2 - 0.15;
      for (let tier = 0; tier < shelves; tier++) {
        if (target.tier !== undefined && target.tier !== tier) continue;
        ends.push({ key: `${item.id}-${tier}`, to: [endX, y + getTierShelfHeightFt(item, tier) + TRAY_1020.heightFt * 0.8, z] });
      }
    } else if (item.category === 'plant') {
      const potH = item.containerDimensions?.height ?? 0.5;
      ends.push({ key: item.id, to: [x, y + potH, z] });
    }
  }
  return (
    <>
      {ends.map(e => <FeedLine key={e.key} from={from} to={e.to} />)}
    </>
  );
}
