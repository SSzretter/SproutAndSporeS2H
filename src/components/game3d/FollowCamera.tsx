import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Room } from '../../types/sim';
import { tentWorldOrigin } from './coords';
import type { PlayerState } from './CharacterModels';

/**
 * Over-the-shoulder follow camera (world units = feet).
 *
 * - Sits behind the cultivator's right shoulder, nearly level, aimed at chest height.
 * - Drag (left or right button) looks around, the wheel sets the distance, Shift + wheel the aim height, R re-centres
 *   behind the cultivator. Every input moves a target; the camera eases toward it.
 * - Stays inside the room and out of tents: when something is behind it, it pulls in quickly (bounded speed, so it never
 *   snaps) and tilts up to look down over the obstacle, then eases back out slowly once there's room again.
 * - Zoomed out past ROOM_CLIP_MAX it becomes an overview camera that may leave the room (the near walls fade, as before).
 */

export const FOLLOW_CAM = {
  distDefault: 11.8, distMin: 5.2, distMax: 45,
  aimDefault: 3.9, aimMin: 2.9, aimMax: 7.2,
  pitchDefault: 0.1, pitchMin: -0.45, pitchMax: 1.2, boostMax: 0.9, pitchAbsMax: 1.4,
  shoulder: 1.0,
  /** Beyond this distance the camera is an overview camera: no room clipping, no shoulder offset. */
  roomClipMax: 24,
  overviewPitch: 0.8,
  margin: 0.65, hardMargin: 0.3,
  followRate: 14, lookRate: 18, zoomRate: 8, pullOutRate: 3.5, boostRate: 4,
  pullInMaxSpeed: 20,
  /** Smart camera: when cramped and the player hasn't looked around for a moment, swing to the nearest clear heading. */
  smartIdle: 1.2, smartNeed: 7, smartShortfall: 0.35, smartStepDeg: 15,
  /** When pulled in close, the aim drops by up to this much (ft) so feet stay above the bottom toolbar. */
  crampedAimDrop: 1.0,
  dragYawPerPx: 0.0055, dragPitchPerPx: 0.004,
  dragThresholdPx: 5,
} as const;

const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

interface Box { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }

/** Smallest t in [0, 1] where the segment o -> o + d enters the box (Infinity if it doesn't). */
function segmentEntersBox(o: THREE.Vector3, d: THREE.Vector3, b: Box): number {
  let tMin = 0;
  let tMax = 1;
  const axes: [number, number, number, number][] = [[o.x, d.x, b.minX, b.maxX], [o.y, d.y, b.minY, b.maxY], [o.z, d.z, b.minZ, b.maxZ]];
  for (const [p, v, lo, hi] of axes) {
    if (Math.abs(v) < 1e-9) {
      if (p < lo || p > hi) return Infinity;
      continue;
    }
    let t1 = (lo - p) / v;
    let t2 = (hi - p) / v;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return Infinity;
  }
  return tMin;
}

/** Largest t in [0, 1] for which o + t·d stays inside the box. */
function segmentStaysInBox(o: THREE.Vector3, d: THREE.Vector3, b: Box): number {
  let t = 1;
  const axes: [number, number, number, number][] = [[o.x, d.x, b.minX, b.maxX], [o.y, d.y, b.minY, b.maxY], [o.z, d.z, b.minZ, b.maxZ]];
  for (const [p, v, lo, hi] of axes) {
    if (v > 1e-9) t = Math.min(t, (hi - p) / v);
    else if (v < -1e-9) t = Math.min(t, (lo - p) / v);
  }
  return Math.max(0, t);
}

const inside = (p: THREE.Vector3, b: Box) => p.x > b.minX && p.x < b.maxX && p.y > b.minY && p.y < b.maxY && p.z > b.minZ && p.z < b.maxZ;
const inflate = (b: Box, m: number): Box => ({ minX: b.minX - m, maxX: b.maxX + m, minY: b.minY - m, maxY: b.maxY + m, minZ: b.minZ - m, maxZ: b.maxZ + m });

/** How far along head -> camera the camera may go (fraction), against the room shell and the tents. */
function clearFraction(head: THREE.Vector3, d: THREE.Vector3, room: Room, tents: Box[], margin: number, clipRoom: boolean): number {
  let t = 1;
  if (clipRoom) {
    const { length, width, height } = room.dimensions;
    t = Math.min(t, segmentStaysInBox(head, d, { minX: margin, maxX: length - margin, minY: margin, maxY: height - margin, minZ: margin, maxZ: width - margin }));
  }
  for (const box of tents) {
    const b = inflate(box, margin);
    if (inside(head, b)) continue; // standing in / beside this tent: its walls don't push the camera
    t = Math.min(t, segmentEntersBox(head, d, b));
  }
  return Math.max(0, t);
}

export interface FollowCameraProps {
  playerRef: React.MutableRefObject<PlayerState>;
  cameraYawRef: React.MutableRefObject<number>;
  room: Room;
  /** While true the wheel belongs to something else (raising / lowering the selected object). */
  wheelBlockedRef: React.MutableRefObject<boolean>;
}

export function FollowCamera({ playerRef, cameraYawRef, room, wheelBlockedRef }: FollowCameraProps) {
  const { camera, gl } = useThree();
  const P = FOLLOW_CAM;

  const tents = useMemo<Box[]>(() => room.tents.map(t => {
    const [x, y, z] = tentWorldOrigin(t, room);
    return { minX: x, maxX: x + t.dimensions.length, minY: y, maxY: y + t.dimensions.height, minZ: z, maxZ: z + t.dimensions.width };
  }), [room]);

  // Targets (input) and smoothed current values.
  const rig = useRef<{
    yawIn: number; yaw: number; pitchIn: number; pitch: number; distIn: number; dist: number; aimIn: number; aim: number;
    boost: number; shoulder: number; cur: number; pivot: THREE.Vector3; snap: boolean; lookedAt: number; smartAt: number;
  }>({
    lookedAt: -Infinity, smartAt: 0,
    yawIn: playerRef.current.facing + Math.PI, yaw: playerRef.current.facing + Math.PI,
    pitchIn: P.pitchDefault, pitch: P.pitchDefault,
    distIn: P.distDefault, dist: P.distDefault,
    aimIn: P.aimDefault, aim: P.aimDefault,
    boost: 0, shoulder: P.shoulder, cur: P.distDefault,
    pivot: new THREE.Vector3(playerRef.current.x, P.aimDefault, playerRef.current.y),
    snap: true,
  });
  const roomRef = useRef(room);
  roomRef.current = room;

  // Changing room (walking through a doorway) cuts straight to the new spot instead of sweeping through a wall.
  useEffect(() => { rig.current.snap = true; }, [room.id]);

  useEffect(() => {
    const el = gl.domElement;
    let drag: { id: number; x: number; y: number; sx: number; sy: number; looking: boolean; button: number } | null = null;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, looking: e.button === 2, button: e.button };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.looking && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > P.dragThresholdPx) drag.looking = true;
      if (drag.looking) {
        const r = rig.current;
        r.yawIn -= (e.clientX - drag.x) * P.dragYawPerPx;
        r.pitchIn = THREE.MathUtils.clamp(r.pitchIn + (e.clientY - drag.y) * P.dragPitchPerPx, P.pitchMin, P.pitchMax);
        r.lookedAt = performance.now() / 1000;
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const onUp = (e: PointerEvent) => { if (drag && e.pointerId === drag.id) drag = null; };
    const onWheel = (e: WheelEvent) => {
      if (wheelBlockedRef.current) return;
      e.preventDefault();
      const r = rig.current;
      const dir = Math.sign(e.deltaY);
      if (e.shiftKey) r.aimIn = THREE.MathUtils.clamp(r.aimIn - dir * 0.26, P.aimMin, P.aimMax);
      else r.distIn = THREE.MathUtils.clamp(r.distIn * (1 + dir * 0.12), P.distMin, P.distMax);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.key.toLowerCase() !== 'r') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      // Re-centre: behind the cultivator at the default framing.
      const r = rig.current;
      r.yawIn = r.yaw + wrapAngle(playerRef.current.facing + Math.PI - r.yaw);
      r.pitchIn = P.pitchDefault;
      r.distIn = P.distDefault;
      r.aimIn = P.aimDefault;
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKey);
    };
  }, [gl, playerRef, wheelBlockedRef, P]);

  const tmp = useMemo(() => ({
    head: new THREE.Vector3(), dir: new THREE.Vector3(), d: new THREE.Vector3(), right: new THREE.Vector3(),
    camPos: new THREE.Vector3(), look: new THREE.Vector3(),
  }), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const r = rig.current;
    const p = playerRef.current;
    const currentRoom = roomRef.current;
    const snap = r.snap;
    r.snap = false;

    // Smooth the inputs.
    const k = (rate: number) => (snap ? 1 : ease(rate, dt));
    r.yaw += wrapAngle(r.yawIn - r.yaw) * k(P.lookRate);
    r.pitch += (r.pitchIn - r.pitch) * k(P.lookRate);
    r.dist += (r.distIn - r.dist) * k(P.zoomRate);
    r.aim += (r.aimIn - r.aim) * k(P.zoomRate);
    r.pivot.lerp(tmp.head.set(p.x, r.aim, p.y), k(P.followRate));

    const overview = r.distIn > P.roomClipMax;
    // Zooming out blends into an overview: the camera climbs to at least overviewPitch so it looks down over the tents.
    const ov = THREE.MathUtils.smoothstep(r.dist, P.roomClipMax * 0.7, P.roomClipMax * 1.3);
    const pitch = Math.min(P.pitchAbsMax, Math.max(r.pitch + r.boost, ov * P.overviewPitch));
    const sinY = Math.sin(r.yaw);
    const cosY = Math.cos(r.yaw);
    tmp.dir.set(sinY * Math.cos(pitch), Math.sin(pitch), cosY * Math.cos(pitch));
    tmp.right.set(cosY, 0, -sinY);

    // Shoulder offset, applied to both the camera and its aim so the cultivator sits a little left of centre.
    const head = tmp.head.copy(r.pivot).addScaledVector(tmp.right, r.shoulder);
    const want = r.dist;
    tmp.d.copy(tmp.dir).multiplyScalar(want);
    const free = clearFraction(head, tmp.d, currentRoom, tents, P.margin, !overview) * want;
    const hardFree = clearFraction(head, tmp.d, currentRoom, tents, P.hardMargin, !overview) * want;

    // Distance actually used: pull in fast (bounded speed), ease out slowly, never past the hard margin.
    const goal = Math.min(want, free);
    if (snap) r.cur = goal;
    else if (goal < r.cur) r.cur = Math.max(goal, r.cur - P.pullInMaxSpeed * dt);
    else r.cur += (goal - r.cur) * ease(P.pullOutRate, dt);
    r.cur = Math.max(0.6, Math.min(r.cur, hardFree));

    // Short of room behind: tilt up to look down over the obstacle (and back down when there's room again).
    const shortfall = want > 0 ? THREE.MathUtils.clamp(1 - free / want, 0, 1) : 0;
    // (Square root: even a modest shortfall tilts up noticeably, which is what keeps the whole body in frame.)
    const boostGoal = overview ? 0 : Math.sqrt(shortfall) * P.boostMax;
    r.boost += (Math.min(boostGoal, Math.max(0, P.pitchAbsMax - r.pitch)) - r.boost) * (snap ? 1 : ease(P.boostRate, dt));

    // Smart camera: cramped (a tent or wall right behind) and the player isn't steering the view, so swing to the
    // nearest heading with room to back up, checked a few times a second, nearest first, left before right.
    // Not while walking with the keys: WASD is camera-relative, so a swing would bend the walk.
    const nowS = performance.now() / 1000;
    const keyWalking = p.isMoving && p.targetX === p.x && p.targetY === p.y;
    if (!overview && !snap && !keyWalking && shortfall > P.smartShortfall && nowS - r.lookedAt > P.smartIdle && nowS - r.smartAt > 0.25) {
      r.smartAt = nowS;
      const need = Math.min(want, P.smartNeed);
      const clearanceAt = (yaw: number) => {
        tmp.d.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(want);
        return clearFraction(r.pivot, tmp.d, currentRoom, tents, P.margin, true) * want;
      };
      let best = r.yaw;
      let bestClear = clearanceAt(r.yaw);
      if (bestClear < need) {
        for (let step = 1; step * P.smartStepDeg <= 180; step++) {
          let found = false;
          for (const sign of [1, -1]) {
            const yaw = r.yaw + sign * THREE.MathUtils.degToRad(step * P.smartStepDeg);
            const c = clearanceAt(yaw);
            if (c > bestClear + 0.5) { best = yaw; bestClear = c; }
            if (c >= need) { best = yaw; found = true; break; }
          }
          if (found) break;
        }
        r.yawIn = r.yaw + wrapAngle(best - r.yaw);
      }
    }

    // Shoulder slides to centre when cramped or zoomed out to an overview.
    const shoulderGoal = overview || shortfall > 0.4 ? 0 : P.shoulder;
    r.shoulder += (shoulderGoal - r.shoulder) * (snap ? 1 : ease(3, dt));

    tmp.camPos.copy(head).addScaledVector(tmp.dir, r.cur);
    camera.position.copy(tmp.camPos);
    // Pulled in close, aim a little lower so the cultivator's feet stay in frame.
    const closeness = THREE.MathUtils.clamp(1 - r.cur / Math.max(want, 1e-3), 0, 1);
    tmp.look.copy(head);
    tmp.look.y -= overview ? 0 : closeness * P.crampedAimDrop;
    camera.lookAt(tmp.look);
    cameraYawRef.current = r.yaw;
  });

  return null;
}

// ---------- occlusion fading ----------

const FADE = { hard: 0.28, soft: 0.55, rate: 9, hold: 0.35, scanHz: 8 };

type FadeEntry = { alpha: number; target: number; seenAt: number };

/**
 * Fades items and tents that stand between the camera and the cultivator (rays to feet, chest and head), so the
 * cultivator is never lost behind a rack or a tent. Faded meshes get a transparent copy of their material; the
 * original goes back once they're clear. Room walls already fade on their own (`FadingWall`).
 */
export function OcclusionFader({ playerRef }: { playerRef: React.MutableRefObject<PlayerState> }) {
  const { camera, scene } = useThree();
  const entries = useRef(new Map<THREE.Object3D, FadeEntry>());
  const originals = useRef(new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>());
  const scan = useRef(0);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pts = useMemo(() => [[0.8, FADE.soft], [3.6, FADE.hard], [5.3, FADE.hard]] as const, []);
  const v = useMemo(() => new THREE.Vector3(), []);

  const owner = (o: THREE.Object3D | null): THREE.Object3D | null => {
    for (let n = o; n; n = n.parent) {
      if (n.userData.castsShadow) return null; // the cultivator's own group
      if (n.userData.isItem || n.userData.isTent) return n;
    }
    return null;
  };

  const apply = (root: THREE.Object3D, alpha: number) => {
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
      const store = originals.current;
      if (alpha >= 0.999) {
        const orig = store.get(mesh);
        if (!orig) return;
        const faded = mesh.material;
        mesh.material = orig;
        store.delete(mesh);
        (Array.isArray(faded) ? faded : [faded]).forEach(m => m.dispose());
        return;
      }
      if (!store.has(mesh)) {
        store.set(mesh, mesh.material);
        const clone = (m: THREE.Material) => {
          const c = m.clone();
          c.userData.baseOpacity = m.opacity;
          c.transparent = true;
          c.depthWrite = false;
          return c;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
      }
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => { m.opacity = (m.userData.baseOpacity ?? 1) * alpha; });
    });
  };

  useEffect(() => () => {
    for (const root of entries.current.keys()) apply(root, 1);
    entries.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const now = state.clock.elapsedTime;
    const p = playerRef.current;

    scan.current -= dt;
    if (scan.current <= 0) {
      scan.current = 1 / FADE.scanHz;
      const hits = new Map<THREE.Object3D, number>();
      for (const [h, alpha] of pts) {
        v.set(p.x, h, p.y);
        const dist = camera.position.distanceTo(v);
        raycaster.set(camera.position, v.sub(camera.position).normalize());
        raycaster.far = Math.max(0, dist - 0.4);
        for (const hit of raycaster.intersectObjects(scene.children, true)) {
          const root = owner(hit.object);
          if (root) hits.set(root, Math.min(hits.get(root) ?? 1, alpha));
        }
      }
      for (const [root, alpha] of hits) {
        const e = entries.current.get(root) || { alpha: 1, target: 1, seenAt: now };
        e.target = alpha;
        e.seenAt = now;
        entries.current.set(root, e);
      }
    }

    for (const [root, e] of entries.current) {
      if (!root.parent) { entries.current.delete(root); continue; } // unmounted
      if (now - e.seenAt > FADE.hold) e.target = 1;
      const before = e.alpha;
      e.alpha += (e.target - e.alpha) * ease(FADE.rate, dt);
      if (e.target === 1 && e.alpha > 0.995) e.alpha = 1;
      if (Math.abs(e.alpha - before) > 1e-4 || e.alpha === 1) apply(root, e.alpha);
      if (e.alpha === 1 && e.target === 1) entries.current.delete(root);
    }
  });

  return null;
}

export const TENT_USER_DATA = { isTent: true };
