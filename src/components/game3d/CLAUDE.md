# 3D game scene notes (src/components/game3d)

Built with three.js via `@react-three/fiber` + `@react-three/drei`. `GameWorld.tsx` (in `components/game/`) owns all state changes. `GameScene` only wires R3F pointer events to callbacks.

**Coordinates:** one world unit = 1 ft.
- Room floor `x → X`, `y → Z`, elevation `z → Y`; the room's back-left corner is at the origin.
- All conversions go through `coords.ts` (`tentWorldOrigin`, `itemWorldPosition`, `isCeilingMounted`).

**Models** are procedural primitives built from the real data, so true scale needs no extra mapping:
- `PlantModel` from `containerDimensions`, `heightInches` / `canopyWidthInches` and stage;
- `MushroomModel`, `EquipmentModel`, `CharacterModels`;
- `EnvironmentModels` for the room, tents and doorways;
- `HoseModel` for mist hoses and CO2 tubing, plus `ExhaustDuctModel`, a foil duct from a fan whose `exhaustTo` is `outdoors` to the nearest wall.

Each piece of equipment gets a status LED from `getEquipmentActivity`.

**Textured models** (`AssetModels.tsx`): some gear and room fixtures use Poly Haven CC0 GLBs from `public/models/equipment/` (credits there). Each one is fitted to the item's real size in feet.
- **What uses them:**
  - the nutrient reservoir (a tote);
  - the inline exhaust fan (duct fan housing plus collars);
  - grow lights by name: `growLightStyle` picks fluorescent strips for T5/T8/fluorescent, a pendant lamp for HPS/CMH/MH, else the procedural LED panel;
  - in indoor rooms, a breaker panel and caged work light (`RoomFixtures`), placed to avoid doors;
  - a roll-up shutter for the outside door of a garage, workshop or shed.
- **Fallback:** wrap every use in `<AssetSlot fallback={…}>`. The procedural model shows while the model loads and if it fails to.
- **Materials:** pass `glow` or `metalness` to `Part` for per-instance materials; bare metal reads as black in dark rooms.
- **Assets:** `npm run build:equipment` rebuilds the GLBs from the 1K glTF downloads in git-ignored `assets-src/polyhaven/`. Like the character build it's Windows-only, and its shared helpers are in `scripts/gltf-tools.mjs`.
- **Still procedural:** the humidifier, dehumidifier, heater, oscillating fan, portable AC and LED panels, plus interior doors. No free model fits these.

**Interaction rules:**
- Clicks after a camera drag are ignored (`e.delta`).
- Tents are clickable everywhere but defer to any item under the pointer (`ITEM_USER_DATA` + `pointerHitsItem`).
- Ceiling-mounted gear is clickable only through a small hit box on top, so it never blocks the canopy.
- Hoses and ducts never take pointer events (`raycast={() => null}`).
- Walls facing the camera fade out (`FadingWall`).

**Labels:** world-anchored text (tent and door names, ✂ ready badges, action popups) goes through `ScreenLabels.tsx`: plain DOM in the app's React tree, projected to screen each frame.
- **Don't use drei `<Html>`.** It mounts a separate React root per label, and React 19 throws when they unmount with the canvas.
- `LabelProjector` nudges overlapping labels upward each frame so neighbouring badges stay readable.
- Crops with problems get an issue badge (red critical / amber warning) from `getCropIssues`. Their hover tooltip shows the full list.
- Tent labels can carry live `stats` (temp / RH / VPD coloured by `getVpdZone` / CO2). The game header's Tent Stats button toggles them, remembered in `localStorage` key `sprout_spore_show_tent_stats`.

**Player and camera:** the cultivator (`PlayerState`, in room feet) is moved by a 60 Hz interval in `GameWorld`. It handles camera-relative WASD via `cameraYawRef`, click-to-walk, tent collision and walk-through doorways.

The camera is `FollowCamera` (`FollowCamera.tsx`, tuning in `FOLLOW_CAM`), an over-the-shoulder rig. `CameraRig` hosts it, plus middle-drag / wheel moving of the selected object.
- **Input:** drag with the left or right button to look; the wheel sets distance, Shift + wheel the aim height; R re-centres. Inputs set targets and the camera eases toward them.
- **Collision:** it stays inside the room and out of tent boxes. It pulls in at a bounded speed, eases back out, tilts up when there's no room behind, and lowers its aim when close so the feet stay in frame.
- **Smart heading:** when cramped and not being steered, it swings to the nearest clear heading. It never does this while the player walks with WASD, so the walk doesn't bend.
- **Overview:** zoomed past `roomClipMax`, it rises to an overview that may leave the room.
- **Fading:** `OcclusionFader` fades item groups (`ITEM_USER_DATA`) and tent shells (`TENT_USER_DATA`) that block rays to the cultivator. It swaps in transparent material copies and restores the originals afterwards.

**People** (`QuaterniusCharacter.tsx`): the player and NPCs are rigged, animated Quaternius CC0 models from `public/models/characters/` (credits there).
- **Assets:** `npm run build:characters` rebuilds the three GLBs from the raw packs in the git-ignored `assets-src/quaternius/x/`. It's Windows-only (it resizes textures with PowerShell), and you rarely need it: the built GLBs are committed.
- **One skeleton:** both bodies, the hairstyles and the animation clips share one 65-bone rig, so clips play without retargeting. The pelvis track is scaled per body (`clipsForBody`).
- **Clothes are a shader, not meshes:** `makeClothMaterial` paints shirt, trousers and shoes by bind-pose height and arm distance, and pushes them out slightly along the normal. Skin colour is a tint relative to the texture's average.
- **Looks:** `lookForId` derives body, skin, hair colour and style from the person's id. Role colours come from `ROLE_METADATA`.
- **Animation:** `clipForNpc` maps an NPC's `currentAction` text to a clip. The player switches between idle and jog based on whether `walkFrame` is still advancing.
- **Gear:** hats and belts attach through `useBoneAnchor` (feet, character-aligned, following the bone). Held tools follow the right hand's position but stay upright.
- **Fallback:** the procedural `Figure` shows while the GLBs load and if they fail to.

`PlantSprites.ts` 2D drawings remain only for `PlantVisualizerModal`.

**Lighting and shadows** (`SceneFx.tsx`, wired in `SceneLighting`):
- `SceneEnvironment` is image-based lighting from a procedural drei `<Environment>` (Lightformers, rendered locally, no HDRI download). It re-bakes only when the daylight level changes.
- `KeyLight` (directional) and one `GrowLightSpot` per grow light (max 4) cast shadows. The Canvas uses `shadows="percentage"`: three r186 removed PCFSoftShadowMap.
- `ShadowManager` renders shadow maps on demand (`autoUpdate = false`). Every 100 ms it flags meshes under an `isItem` or `castsShadow` (`CASTS_SHADOW_USER_DATA`) ancestor as casters, and re-renders the maps only when that set or the lights change. Wrap new non-item models in a `CASTS_SHADOW_USER_DATA` group if they should cast.
- `ContactShadowDecal` is one baked canvas texture on the floor (soft blobs under floor items and tents, wall-base darkening). It re-bakes when the layout changes.
