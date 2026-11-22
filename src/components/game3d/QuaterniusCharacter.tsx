import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { hashString } from '../../utils/rng';

/**
 * Rigged, animated people built from the Quaternius CC0 packs (see public/models/characters/CREDITS.md).
 * `scripts/build-characters.mjs` bakes the GLBs; this file clones them per person, paints clothes on with a
 * shader (shirt / trousers / shoes by bind-pose height, so no extra meshes), and plays the shared clips.
 */

const BASE = import.meta.env.BASE_URL;
const BODY_URL = { male: `${BASE}models/characters/quaternius_male.glb`, female: `${BASE}models/characters/quaternius_female.glb` } as const;
const ANIMS_URL = `${BASE}models/characters/quaternius_anims.glb`;

export type CharacterSex = 'male' | 'female';
export type CharacterClip =
  | 'Idle_Loop' | 'Walk_Loop' | 'Jog_Fwd_Loop' | 'Idle_Talking_Loop' | 'Interact' | 'PickUp_Table' | 'Fixing_Kneeling'
  | 'Sitting_Idle_Loop' | 'Crouch_Idle_Loop' | 'Farm_Watering' | 'Farm_Harvest' | 'Farm_PlantSeed' | 'Idle_FoldArms_Loop'
  | 'Consume' | 'Walk_Carry_Loop' | 'Idle_TalkingPhone_Loop' | 'Yes';

export const HAIR_STYLES: Record<CharacterSex, string[]> = {
  male: ['Hair_SimpleParted', 'Hair_Buzzed'],
  female: ['Hair_Long', 'Hair_Buns', 'Hair_BuzzedFemale'],
};

export interface CharacterLook {
  sex: CharacterSex;
  skin: string;
  hair: string;
  hairStyle: string;
  beard: boolean;
  shirt: string;
  pants: string;
  shoes: string;
  longSleeves: boolean;
}

const ARM_SLIM = 0.86;
// Tints are relative to the texture's average, under dim grow-room light, so the darkest stays well off black.
const SKIN_TONES = ['#f0d6c4', '#e3bfa3', '#cfa587', '#b88d6d', '#9c735a', '#86604b'];
const HAIR_COLORS = ['#2a1c13', '#3d2818', '#5e3b22', '#8a5a33', '#b8915e', '#151515', '#7a7a7a'];

/** A stable look for a person id: body, skin, hair. Clothing comes from the caller. */
export function lookForId(id: string, clothes: Pick<CharacterLook, 'shirt' | 'pants'> & Partial<CharacterLook>): CharacterLook {
  const h = hashString(id);
  const sex: CharacterSex = h % 2 === 0 ? 'male' : 'female';
  const styles = HAIR_STYLES[sex];
  return {
    sex,
    skin: SKIN_TONES[(h >>> 3) % SKIN_TONES.length],
    hair: HAIR_COLORS[(h >>> 7) % HAIR_COLORS.length],
    hairStyle: styles[(h >>> 11) % styles.length],
    beard: sex === 'male' && (h >>> 15) % 3 === 0,
    shoes: '#2b2420',
    longSleeves: false,
    ...clothes,
  };
}

// ---------- shared, per-sex preparation ----------

interface BodyInfo {
  heightM: number;
  headCenter: THREE.Vector3;
  headRadiusM: number;
  pelvisRest: number;
}

const bodyInfoCache = new WeakMap<object, BodyInfo>();
function getBodyInfo(gltf: { scene: THREE.Object3D; parser: { json: { extras?: { pelvisRest?: number[] } } } }): BodyInfo {
  const cached = bodyInfoCache.get(gltf);
  if (cached) return cached;
  let body: THREE.SkinnedMesh | undefined;
  gltf.scene.traverse(o => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && (m.material as THREE.Material).name === 'Skin') body = m;
  });
  const pos = body!.geometry.attributes.position as THREE.BufferAttribute;
  let top = -Infinity;
  for (let i = 0; i < pos.count; i++) top = Math.max(top, pos.getY(i));
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    if (y < top - 0.24 || Math.abs(x) > 0.15) continue;
    min.min(new THREE.Vector3(x, y, pos.getZ(i)));
    max.max(new THREE.Vector3(x, y, pos.getZ(i)));
  }
  const pelvis = gltf.parser.json.extras?.pelvisRest || [0, 0, 0.93];
  // Hats are sized to the head plus hair, and centred so their crown sits just above the scalp.
  const hatRadius = ((max.x - min.x) / 2) * 1.2;
  const info: BodyInfo = {
    heightM: top,
    headCenter: new THREE.Vector3((min.x + max.x) / 2, top + 0.02 - hatRadius * 0.85, (min.z + max.z) / 2),
    headRadiusM: hatRadius,
    pelvisRest: Math.hypot(pelvis[0], pelvis[1], pelvis[2]),
  };
  bodyInfoCache.set(gltf, info);
  return info;
}

const clipCache = new Map<string, THREE.AnimationClip[]>();
/** The shared clips with the pelvis height scaled to this body, so feet stay on the floor. */
function clipsForBody(animClips: THREE.AnimationClip[], animPelvis: number, sex: CharacterSex, bodyPelvis: number) {
  const key = `${sex}:${animClips.length}`;
  const cached = clipCache.get(key);
  if (cached) return cached;
  const ratio = bodyPelvis / animPelvis;
  const clips = animClips.map(clip => {
    const c = clip.clone();
    for (const track of c.tracks) {
      if (track.name === 'pelvis.position') for (let i = 0; i < track.values.length; i++) track.values[i] *= ratio;
    }
    return c;
  });
  clipCache.set(key, clips);
  return clips;
}

// ---------- clothing shader ----------

interface ClothUniforms {
  uSkin: { value: THREE.Color };
  uShirt: { value: THREE.Color };
  uPants: { value: THREE.Color };
  uShoes: { value: THREE.Color };
  uHeight: { value: number };
  uSleeve: { value: number };
  uSkinRef: { value: number };
}

function makeClothMaterial(source: THREE.MeshStandardMaterial, uniforms: ClothUniforms) {
  const mat = source.clone();
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    const regions = /* glsl */ `
      uniform float uHeight;
      uniform float uSleeve;
      float ssShoes(vec3 p) { return 1.0 - smoothstep(0.068, 0.075, p.y / uHeight); }
      float ssPants(vec3 p) {
        float h = p.y / uHeight;
        return (1.0 - ssShoes(p)) * (1.0 - smoothstep(0.565, 0.572, h)) * (1.0 - smoothstep(0.24, 0.26, abs(p.x)));
      }
      float ssShirt(vec3 p) {
        float h = p.y / uHeight;
        // Round neckline hugging the neck (a little lower at the front); out past the neck the shirt
        // covers the shoulder tops.
        float collar = mix(0.822 - 0.014 * smoothstep(0.0, 0.08, p.z), 0.9, smoothstep(0.075, 0.105, abs(p.x)));
        return smoothstep(0.565, 0.572, h) * (1.0 - smoothstep(collar - 0.004, collar, h)) * (1.0 - smoothstep(uSleeve - 0.01, uSleeve, abs(p.x)));
      }
    `;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${regions}\nvarying vec3 vBindPos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vBindPos = position;
        // Cloth sits a few millimetres proud of the skin.
        transformed += normal * (ssShirt(position) * 0.009 + ssPants(position) * 0.007 + ssShoes(position) * 0.012);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${regions}
        varying vec3 vBindPos;
        uniform vec3 uSkin; uniform vec3 uShirt; uniform vec3 uPants; uniform vec3 uShoes; uniform float uSkinRef;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          // Keep the texture's shading and features, recoloured to this person's skin tone.
          // Only part of the texture's light/dark variation is kept, so deep tones stay readable in dim rooms.
          vec3 skin = uSkin * clamp(mix(1.0, lum / uSkinRef, 0.6), 0.55, 1.25);
          float shoes = ssShoes(vBindPos);
          float pants = ssPants(vBindPos);
          float shirt = ssShirt(vBindPos);
          // A little of the body's shading shows through the fabric so folds read.
          float fold = mix(1.0, clamp(lum / uSkinRef, 0.7, 1.15), 0.45);
          vec3 cloth = (uShirt * shirt + uPants * pants + uShoes * shoes) * fold;
          float clothAmt = clamp(shirt + pants + shoes, 0.0, 1.0);
          diffuseColor.rgb = mix(skin, cloth, clothAmt);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.88, clamp(ssShirt(vBindPos) + ssPants(vBindPos), 0.0, 1.0));`);
  };
  mat.customProgramCacheKey = () => 'ss-quaternius-cloth-v1';
  return mat;
}

const skinRefCache = new WeakMap<THREE.Texture, number>();
/** Average luminance of the skin texture's painted pixels (the reference the tint is relative to). */
function skinReference(texture: THREE.Texture | null): number {
  if (!texture?.image) return 0.62;
  const cached = skinRefCache.get(texture);
  if (cached) return cached;
  let ref = 0.62;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(texture.image as CanvasImageSource, 0, 0, 64, 64);
    const { data } = ctx.getImageData(0, 0, 64, 64);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      // sRGB -> linear, matching what the shader sees after decoding.
      const l = (0.299 * (data[i] / 255) ** 2.2) + (0.587 * (data[i + 1] / 255) ** 2.2) + (0.114 * (data[i + 2] / 255) ** 2.2);
      if (l < 0.04) continue; // unused UV space
      sum += l;
      n++;
    }
    if (n > 0) ref = sum / n;
  } catch {
    // keep the default
  }
  skinRefCache.set(texture, ref);
  return ref;
}

// ---------- bone anchors ----------

/**
 * A group parented to a bone that cancels the bone's bind-pose rotation and the model's metre-to-feet scale, so
 * children are authored in feet in the character's own frame (y up, +z forward) yet follow the bone as it animates.
 */
function useBoneAnchor(root: THREE.Object3D, boneName: string, bindPointM: THREE.Vector3, ftPerM: number) {
  return useMemo(() => {
    const bone = root.getObjectByName(boneName);
    if (!bone) return null;
    root.updateMatrixWorld(true);
    const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const boneInRoot = new THREE.Matrix4().multiplyMatrices(rootInv, bone.matrixWorld);
    const anchor = new THREE.Group();
    anchor.name = `anchor:${boneName}`;
    const boneInv = new THREE.Matrix4().copy(boneInRoot).invert();
    // Place the point, and undo the bone's rotation and scale (plus the outer model scale).
    const local = new THREE.Matrix4().multiplyMatrices(boneInv, new THREE.Matrix4().makeTranslation(bindPointM.x, bindPointM.y, bindPointM.z));
    local.decompose(anchor.position, anchor.quaternion, anchor.scale);
    anchor.scale.multiplyScalar(1 / ftPerM);
    bone.add(anchor);
    return anchor;
  }, [root, boneName, bindPointM, ftPerM]);
}

// ---------- the character ----------

export interface QuaterniusCharacterProps {
  heightFt: number;
  look: CharacterLook;
  /** Clip to play; ignored when `getClip` is given. */
  clip?: CharacterClip;
  /** Polled every frame (e.g. the player switching between idle and jog without re-rendering). */
  getClip?: () => { clip: CharacterClip; timeScale?: number };
  /** Seed for the starting phase so a crowd doesn't move in lockstep. */
  phaseSeed?: string;
  /** Rendered on the head, in feet, centred on the head (hats). Receives the head radius in feet. */
  headwear?: (headRadiusFt: number) => React.ReactNode;
  /** Rendered at the right hand, upright in the character's frame, in feet. */
  heldItem?: React.ReactNode;
  /** Rendered at the waist in feet (tool belts, satchels). Receives the waist height in feet. */
  waistwear?: React.ReactNode;
}

function QuaterniusCharacterInner({ heightFt, look, clip = 'Idle_Loop', getClip, phaseSeed, headwear, heldItem, waistwear }: QuaterniusCharacterProps) {
  const body = useGLTF(BODY_URL[look.sex]) as unknown as { scene: THREE.Object3D; parser: { json: { extras?: { pelvisRest?: number[] } } } };
  const anims = useGLTF(ANIMS_URL) as unknown as { animations: THREE.AnimationClip[]; parser: { json: { extras?: { pelvisRest?: number[] } } } };
  const info = getBodyInfo(body);
  const ftPerM = heightFt / info.heightM;

  const animPelvis = useMemo(() => {
    const p = anims.parser.json.extras?.pelvisRest || [0, 0, 0.9167];
    return Math.hypot(p[0], p[1], p[2]);
  }, [anims]);
  const clips = useMemo(() => clipsForBody(anims.animations, animPelvis, look.sex, info.pelvisRest), [anims, animPelvis, look.sex, info.pelvisRest]);

  const uniforms = useMemo<ClothUniforms>(() => ({
    uSkin: { value: new THREE.Color() },
    uShirt: { value: new THREE.Color() },
    uPants: { value: new THREE.Color() },
    uShoes: { value: new THREE.Color() },
    uHeight: { value: info.heightM },
    uSleeve: { value: 0.36 },
    uSkinRef: { value: 0.62 },
  }), [info.heightM]);

  // One skeleton + materials per person; geometry and textures stay shared.
  const { root, hairMaterials } = useMemo(() => {
    const r = cloneSkinned(body.scene);
    // The free bodies are "superhero" proportioned: slim the arms a little (bone Y runs along the bone, and
    // the hands are scaled back so they keep their size). Bone scale is inherited, so the forearm follows the
    // upper arm. Animations only drive rotation, so this sticks.
    for (const side of ['l', 'r']) {
      r.getObjectByName(`upperarm_${side}`)?.scale.set(ARM_SLIM, 1, ARM_SLIM);
      r.getObjectByName(`hand_${side}`)?.scale.set(1 / ARM_SLIM, 1, 1 / ARM_SLIM);
    }
    const hair: THREE.MeshStandardMaterial[] = [];
    r.traverse(o => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      m.frustumCulled = false; // bind-pose bounds don't cover animated poses
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.name === 'Skin') {
        uniforms.uSkinRef.value = skinReference(mat.map);
        m.material = makeClothMaterial(mat, uniforms);
      } else if (mat.name === 'Hair' || mat.name === 'Brows') {
        const hm = mat.clone();
        m.material = hm;
        hair.push(hm);
      }
    });
    return { root: r, hairMaterials: hair };
  }, [body.scene, uniforms]);

  // Colours and hairstyle can change without rebuilding the clone.
  useLayoutEffect(() => {
    uniforms.uSkin.value.set(look.skin).convertSRGBToLinear();
    uniforms.uShirt.value.set(look.shirt).convertSRGBToLinear();
    uniforms.uPants.value.set(look.pants).convertSRGBToLinear();
    uniforms.uShoes.value.set(look.shoes).convertSRGBToLinear();
    uniforms.uSleeve.value = look.longSleeves ? 0.66 : 0.36;
    for (const hm of hairMaterials) hm.color.set(look.hair).multiplyScalar(2.2);
    root.traverse(o => {
      if (!o.name.startsWith('Hair_')) return;
      o.visible = o.name === look.hairStyle || (o.name === 'Hair_Beard' && look.beard);
    });
  }, [look, uniforms, hairMaterials, root]);

  const mixer = useMemo(() => new THREE.AnimationMixer(root), [root]);
  useEffect(() => () => { mixer.stopAllAction(); mixer.uncacheRoot(root); }, [mixer, root]);
  const current = useRef<{ name: CharacterClip; action: THREE.AnimationAction } | null>(null);

  const play = (name: CharacterClip, timeScale = 1) => {
    if (current.current?.name === name) {
      current.current.action.timeScale = timeScale;
      return;
    }
    const c = clips.find(x => x.name === name) || clips.find(x => x.name === 'Idle_Loop');
    if (!c) return;
    const action = mixer.clipAction(c);
    action.reset();
    action.timeScale = timeScale;
    if (!current.current && phaseSeed) action.time = (hashString(phaseSeed) % 1000) / 1000 * c.duration;
    action.play();
    if (current.current) action.crossFadeFrom(current.current.action, 0.25, false);
    current.current = { name, action };
  };

  useEffect(() => {
    if (!getClip) play(clip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip, getClip, clips]);

  const handBone = useMemo(() => root.getObjectByName('hand_r') || null, [root]);
  const heldRef = useRef<THREE.Group>(null);
  const scaledRef = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    if (getClip) {
      const next = getClip();
      play(next.clip, next.timeScale);
    }
    mixer.update(Math.min(dt, 0.1));
    // Held items follow the hand's position but stay upright.
    if (heldRef.current && handBone && scaledRef.current?.parent) {
      handBone.getWorldPosition(tmp);
      scaledRef.current.parent.worldToLocal(tmp);
      heldRef.current.position.copy(tmp);
    }
  });

  const headPoint = info.headCenter;
  const headAnchor = useBoneAnchor(root, 'Head', headPoint, ftPerM);
  const waistPoint = useMemo(() => new THREE.Vector3(0, info.heightM * 0.56, 0), [info.heightM]);
  const waistAnchor = useBoneAnchor(root, 'pelvis', waistPoint, ftPerM);

  return (
    <group>
      <group ref={scaledRef} scale={ftPerM}>
        <primitive object={root} />
      </group>
      {headwear && headAnchor && createPortal(<>{headwear(info.headRadiusM * ftPerM)}</>, headAnchor)}
      {waistwear && waistAnchor && createPortal(<>{waistwear}</>, waistAnchor)}
      {heldItem && <group ref={heldRef}>{heldItem}</group>}
    </group>
  );
}

class ModelErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('Character model failed to load; using the simple figure instead.', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Animated Quaternius person; shows `fallback` while loading or if the models can't be loaded. */
export function QuaterniusCharacter({ fallback, ...props }: QuaterniusCharacterProps & { fallback: React.ReactNode }) {
  return (
    <ModelErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <QuaterniusCharacterInner {...props} />
      </Suspense>
    </ModelErrorBoundary>
  );
}

useGLTF.preload(ANIMS_URL);
useGLTF.preload(BODY_URL.male);
useGLTF.preload(BODY_URL.female);
