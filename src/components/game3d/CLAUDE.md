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

**Player and camera:** the cultivator (`PlayerState`, in room feet) is moved by a 60 Hz interval in `GameWorld`. It handles camera-relative WASD via `cameraYawRef`, click-to-walk, tent collision and walk-through doorways. `CameraRig` follows it with orbit and zoom.

`PlantSprites.ts` 2D drawings remain only for `PlantVisualizerModal`.
