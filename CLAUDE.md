# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sprout & Spore — a client-only React 19 + TypeScript + Vite + Tailwind v4 indoor plant/mushroom grow simulator (climate physics, multi-room/tent management, equipment automation, crop lifecycle).

## Tooling & Dual-Platform Compatibility
- This repository is shared between Claude Code (desktop) and Google AI Studio (via github) and will be edited and should continue to work from both platforms.

## Commands

- `npm run dev` — Vite dev server on port 3000 (`0.0.0.0`). Setting `DISABLE_HMR=true` turns off HMR and file watching (AI Studio convention in `vite.config.ts`; leave that block alone).
- `npm run build` — production build to `dist/`.
- `npm run lint` — type-check only (`tsc --noEmit`). There is no ESLint and no test suite.
- CI: `.github/workflows/deploy.yml` builds on every push to `main` (`npm install --legacy-peer-deps`, Node 20) and deploys `dist/` to GitHub Pages. `base: './'` in `vite.config.ts` is required for Pages — keep it.

## Architecture

**Single state tree.** All simulation data lives in one `SimulationState` object (`src/types/sim.ts`) owned by `App.tsx`. Hierarchy: `rooms[] → tents[] → items[]`, plus `room.items[]` for items placed directly in a room. `Item` is a discriminated union on `category` (`plant | mushroom | equipment | person | pet`). `state.room` is a legacy mirror of the active room (`activeRoomId`); whenever `rooms` changes, `room` must be kept in sync (see how the tick loop sets both).

**Simulation loop** (`App.tsx`): a 1s `setInterval` advances `simTime` by `speed` sim-minutes, pulls outdoor conditions from a cached weather package, and runs `simulateEnvironmentTick(room, outside, simTime, elapsedMinutes)` (`src/utils/physics.ts`) over every room. That pure function returns a new room plus `SimulationEvent[]`, which `App` converts into `JournalEntry`s. `handleSkipTime` does the same in one large step. The loop reads state through `stateRef` to avoid stale closures.

**physics.ts** holds the core model: SVP/VPD math, room envelope thermodynamics (R-value, ACH, HVAC mode, indoor vs `outdoor_garden` vs `greenhouse`), per-tent climate, `arbitrateEnclosureEquipment` (central controller resolving conflicting equipment by `controllerPriority` and producing `activeInterlocks`), and per-crop growth. Plant stage requirements, durations, stage transitions and cultivar profiles (hops, peppers) live in `src/utils/plantLifecycle.ts`. Plant height/canopy are not incremented directly: each tick eases them toward `getPlantTargetSize` (per-species `STAGE_END_SIZES` interpolated by `stageProgress`, scaled by `getContainerSizeFactor` of pot volume) and never shrinks them; tune sizes in that table.

**Persistence & migrations** (`src/utils/storage.ts`): state autosaves to `localStorage` key `sprout_spore_grow_sim_v2`. `loadSimulation()` backfills missing fields on old saves (multi-room, CO2, construction standard, per-tent `migrateTent`). When adding a field to the state types, add a default in `createDefaultSimulationState()` **and** a backfill in `loadSimulation()` so existing saves keep working. JSON export/import goes through the same path.

**Two views, cross-window sync.** `viewMode` is `dashboard` (`ClimateDashboard`, `InteractiveFloorplan`, `ItemInspector`, `GrowJournal`, modals) or `game` (`components/game/GameWorld.tsx`: header, hotbar, modals, tool/harvest logic and player movement around a 3D scene from `components/game3d/`, plus synthesized audio from `AudioEffects.ts`), selected by `#game` hash or `?view=game`. `App` lazy-loads `GameWorld` so the dashboard bundle doesn't include three.js. The game can be popped out into a second window; windows stay in sync via `BroadcastChannel` (`src/utils/syncChannel.ts`, falling back to `storage` events). Every state mutation handler calls `broadcastSimulationState(nextState)` after computing the new state — follow that pattern in new handlers, otherwise the other window drifts.

**Spatial model** (`src/utils/spatial.ts`): positions are in feet (`Position3D`) relative to the parent room/tent; for items `(x, y)` is the footprint center and `z` the base elevation (tents use their back-left corner). Every item has `dimensions` (L x W x H ft). Plants and mushrooms also carry `containerDimensions` (pot/bed/monotub), and their `dimensions` is derived: pot + `heightInches`/`canopyWidthInches` for plants, container + stage fruit height for mushrooms. `syncItemGeometry` recomputes it and is applied in the crop tick, in `App` add/update handlers, and in `loadSimulation` migration, so don't hand-set crop `dimensions`. Use `getDefaultSpatialPosition` / `clampItemPosition` rather than raw math so things stay inside walls.

**3D game scene** (`components/game3d/`, three.js via `@react-three/fiber` + `@react-three/drei`): one world unit = 1 ft; room-floor `x → X`, `y → Z`, elevation `z → Y`, room back-left corner at the origin. All conversions go through `coords.ts` (`tentWorldOrigin`, `itemWorldPosition`, `isCeilingMounted`). Models are procedural primitives built from the real data (`PlantModel` from `containerDimensions` + `heightInches`/`canopyWidthInches` + stage, `MushroomModel`, `EquipmentModel`, `CharacterModels`, `EnvironmentModels` for room/tent/doorway), so true scale needs no extra mapping. `GameScene` wires R3F pointer events to callbacks; `GameWorld` owns all state changes. Interaction rules: clicks after a camera drag are ignored (`e.delta`); tents are clickable everywhere but defer to any item under the pointer (`ITEM_USER_DATA` + `pointerHitsItem`); ceiling-mounted gear is clickable only via a small hit box on top so it never blocks the canopy. Walls facing the camera fade out (`FadingWall`). World-anchored text (tent/door names, ✂ ready badges, action popups) goes through `ScreenLabels.tsx`: plain DOM in the app's React tree, projected to screen each frame. Don't use drei `<Html>`; it mounts a separate React root per label, and React 19 throws when they unmount with the canvas. The cultivator (`PlayerState`, room feet) is moved by a 60 Hz interval in `GameWorld` (camera-relative WASD via `cameraYawRef`, click-to-walk, tent collision, walk-through doorways); `CameraRig` follows it with orbit/zoom. `PlantSprites.ts` 2D drawings remain only for `PlantVisualizerModal`.

**Outdoor weather** (`src/utils/weatherService.ts`): ZIP lookup via `api.zippopotam.us` and hourly data from Open-Meteo, cached in `localStorage` (`sprout_spore_weather_cache_v3_*`, `sprout_spore_geo_v3_*`) and held in `weatherPackageRef` so ticks never hit the network; falls back to regional climatology normals when offline.

**Catalogs**: tent models in `src/utils/tentCatalog.ts`; equipment/crop presets mostly inline in `AddItemModal.tsx` / `AddRoomModal.tsx`.

## Notes

- Several components are very large (`ItemInspector.tsx` ~4k lines, `GameWorld.tsx` ~1.4k, `AddItemModal.tsx` ~1.7k); grep for the relevant handler instead of reading them whole.
- Internal temperature math is Fahrenheit-first (`tempF`), with `tempC` derived; `state.tempUnit` only affects display.
