import * as THREE from 'three';
import { Room } from '../../types/sim';

/**
 * Wall, floor and ceiling textures (Poly Haven CC0, built by `npm run build:textures`; credits in
 * public/textures/CREDITS.md). Each set is colour + OpenGL normal + ARM (AO, roughness, metalness).
 * Images load once; every surface gets its own clones so it can set its own repeat for true scale.
 */

export type SurfaceKind = 'blockWall' | 'plasterWall' | 'concreteFloor' | 'laminateFloor' | 'ceiling' | 'gravelFloor';

const M_TO_FT = 3.28084;
const BASE = `${import.meta.env.BASE_URL}textures/`;

/** dir: folder in public/textures; tileFt: real size of one repeat; tint multiplies the colour map. */
const SURFACES: Record<SurfaceKind, { dir: string; tileFt: number; tint: string; normalScale: number }> = {
  blockWall: { dir: 'concrete_block_wall', tileFt: 2 * M_TO_FT, tint: '#d9d6cf', normalScale: 0.8 },
  plasterWall: { dir: 'plaster_grey_04', tileFt: 1.5 * M_TO_FT, tint: '#e7e3dc', normalScale: 0.6 },
  concreteFloor: { dir: 'concrete_floor_worn_001', tileFt: 3 * M_TO_FT, tint: '#b8b5ae', normalScale: 1 },
  laminateFloor: { dir: 'laminate_floor_02', tileFt: 1.7 * M_TO_FT, tint: '#d6cbbd', normalScale: 0.7 },
  ceiling: { dir: 'ceiling_interior', tileFt: 2 * M_TO_FT, tint: '#efece6', normalScale: 0.7 },
  gravelFloor: { dir: 'gravel_embedded_concrete_02', tileFt: 2 * M_TO_FT, tint: '#c9c5bd', normalScale: 1 },
};

const loader = new THREE.TextureLoader();
const base = new Map<string, THREE.Texture>();

function baseTexture(url: string, color: boolean): THREE.Texture {
  let t = base.get(url);
  if (!t) {
    t = loader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    base.set(url, t);
  }
  return t;
}

export type SurfaceMaps = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  aoMap: THREE.Texture;
  color: string;
  normalScale: THREE.Vector2;
};

/**
 * Maps for a `widthFt` × `heightFt` surface whose UVs run 0–1 across it (a plane), repeated at true scale.
 * Clones share the loaded image, so they fill in when it arrives. Call `disposeSurfaceMaps` when done.
 */
export function makeSurfaceMaps(kind: SurfaceKind, widthFt: number, heightFt: number): SurfaceMaps {
  const s = SURFACES[kind];
  const repeat = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(widthFt / s.tileFt, heightFt / s.tileFt);
    return c;
  };
  const arm = baseTexture(`${BASE}${s.dir}/arm.jpg`, false);
  return {
    map: repeat(baseTexture(`${BASE}${s.dir}/color.jpg`, true)),
    normalMap: repeat(baseTexture(`${BASE}${s.dir}/normal.jpg`, false)),
    roughnessMap: repeat(arm),
    aoMap: repeat(arm),
    color: s.tint,
    normalScale: new THREE.Vector2(s.normalScale, s.normalScale),
  };
}

export function disposeSurfaceMaps(m: SurfaceMaps) {
  m.map.dispose();
  m.normalMap.dispose();
  m.roughnessMap.dispose();
  m.aoMap.dispose();
}

/**
 * Which surfaces a room gets. Basements, garages and workshops have painted block walls on bare concrete;
 * other indoor rooms (bedrooms, attics) plaster over laminate. Every indoor room gets a painted ceiling.
 * Greenhouses get a gravel-and-concrete floor; outdoor gardens keep their grass.
 */
export function roomSurfaces(room: Room): { wall?: SurfaceKind; floor?: SurfaceKind; ceiling?: SurfaceKind } {
  if (room.environmentType === 'outdoor_garden') return {};
  if (room.environmentType === 'greenhouse') return { floor: 'gravelFloor' };
  const utility = /basement|cellar|garage|workshop|shed|barn|warehouse|utility|closet/i.test(room.name);
  return utility
    ? { wall: 'blockWall', floor: 'concreteFloor', ceiling: 'ceiling' }
    : { wall: 'plasterWall', floor: 'laminateFloor', ceiling: 'ceiling' };
}
