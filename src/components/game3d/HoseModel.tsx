import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { EquipmentItem, Room, Tent } from '../../types/sim';
import { tentWorldOrigin, itemWorldPosition } from './coords';

const HOSE_RADIUS_FT = 0.07; // ~1.7" flexible mist hose

/**
 * Flexible mist hose from a room-level humidifier's nozzle to the nearest wall of the tent it is
 * ducted into (entering through a side port at about half the tent's height).
 */
export function HoseModel({ eq, tent, room }: { eq: EquipmentItem; tent: Tent; room: Room }) {
  const [ux, uy, uz] = itemWorldPosition(eq, room);
  const [tx, ty, tz] = tentWorldOrigin(tent, room);
  const { length: tL, width: tW, height: tH } = tent.dimensions;

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
    sag.y = Math.max(HOSE_RADIUS_FT, Math.min(rise.y, port.y) - Math.min(0.8, span * 0.15));
    const approach = port.clone().sub(inward.clone().multiplyScalar(1.2));

    const curve = new THREE.CatmullRomCurve3([nozzle, rise, sag, approach, port, inner]);
    return new THREE.TubeGeometry(curve, Math.max(24, Math.round(span * 12)), HOSE_RADIUS_FT, 8, false);
  }, [ux, uy, uz, tx, ty, tz, tL, tW, tH, eq.dimensions.height]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    // Never intercept pointer events meant for the unit, tent or canopy
    <mesh geometry={geometry} raycast={() => null}>
      <meshStandardMaterial color="#d4d4d8" roughness={0.55} transparent opacity={0.85} />
    </mesh>
  );
}
