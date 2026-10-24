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

**Two views, cross-window sync.** `viewMode` is `dashboard` (`ClimateDashboard`, `InteractiveFloorplan`, `ItemInspector`, `GrowJournal`, modals) or `game` (`components/game/GameWorld.tsx`, a canvas top-down world with sprites from `PlantSprites.ts` and synthesized audio from `AudioEffects.ts`), selected by `#game` hash or `?view=game`. The game can be popped out into a second window; windows stay in sync via `BroadcastChannel` (`src/utils/syncChannel.ts`, falling back to `storage` events). Every state mutation handler calls `broadcastSimulationState(nextState)` after computing the new state — follow that pattern in new handlers, otherwise the other window drifts.

**Spatial model** (`src/utils/spatial.ts`): positions are in feet (`Position3D`) relative to the parent room/tent; for items `(x, y)` is the footprint center and `z` the base elevation (tents use their back-left corner). Every item has `dimensions` (L x W x H ft). Plants and mushrooms also carry `containerDimensions` (pot/bed/monotub), and their `dimensions` is derived: pot + `heightInches`/`canopyWidthInches` for plants, container + stage fruit height for mushrooms. `syncItemGeometry` recomputes it and is applied in the crop tick, in `App` add/update handlers, and in `loadSimulation` migration, so don't hand-set crop `dimensions`. Canvas uses `CANVAS_GRID_SIZE = 40` px/ft on the floor and `CANVAS_VERTICAL_PX_PER_FT = 30` for upright height; use `getSafeTentCanvasPosition` / `getSafeTentItemCanvasPosition` / `getDefaultSpatialPosition` / `clampItemPosition` rather than raw math so things stay inside walls.

**True-scale game rendering** (`components/game/scaleRender.ts`): sprites are hand-drawn at arbitrary pixel sizes; `drawSpriteToScale` measures a sprite's opaque bounds once offscreen (cached by key) and stretches it to the item's real L x H. `GameWorld`'s `getPlacedRoomItems` is the single source of item screen positions for drawing (back-to-front), hover/click hit-testing and proximity actions. Ceiling-mounted items (`isOverheadItem`) are drawn top-down over their footprint in an overhead layer, and floor items win hit-tests over them.

**Outdoor weather** (`src/utils/weatherService.ts`): ZIP lookup via `api.zippopotam.us` and hourly data from Open-Meteo, cached in `localStorage` (`sprout_spore_weather_cache_v3_*`, `sprout_spore_geo_v3_*`) and held in `weatherPackageRef` so ticks never hit the network; falls back to regional climatology normals when offline.

**Catalogs**: tent models in `src/utils/tentCatalog.ts`; equipment/crop presets mostly inline in `AddItemModal.tsx` / `AddRoomModal.tsx`.

## Notes

- Several components are very large (`ItemInspector.tsx` ~4k lines, `GameWorld.tsx` ~2.5k, `AddItemModal.tsx` ~1.7k); grep for the relevant handler instead of reading them whole.
- Internal temperature math is Fahrenheit-first (`tempF`), with `tempC` derived; `state.tempUnit` only affects display.
