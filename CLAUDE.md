# CLAUDE.md

Sprout & Spore: a client-only React 19 + TypeScript + Vite + Tailwind v4 indoor plant and mushroom grow simulator. It covers climate physics, multi-room and tent management, equipment automation and the crop lifecycle.

Detailed notes are split out and load only when you work in those folders:
- `src/utils/CLAUDE.md`: physics, room heat balance, spatial model, equipment links and water, weather.
- `src/components/game3d/CLAUDE.md`: the 3D scene.

## Tooling & dual-platform compatibility
This repo is shared between Claude Code (desktop) and Google AI Studio (via GitHub). It must keep working when edited from either.

## Commands
- `npm run dev`: Vite dev server on port 3000 (`0.0.0.0`). `DISABLE_HMR=true` turns off HMR and file watching; this is an AI Studio convention in `vite.config.ts`, so leave that block alone.
- `npm run build`: production build to `dist/`.
- `npm run lint`: type-check only (`tsc --noEmit`). There is no ESLint and no test suite.
- `npm run sim -- [hours]`: headless run of the default state through `simulateEnvironmentTick`. It prints room and tent climate plus equipment activity. Use it to check physics changes.
- CI: `.github/workflows/deploy.yml` builds on every push to `main` (`npm install --legacy-peer-deps`, Node 20) and deploys `dist/` to GitHub Pages. Keep `base: './'` in `vite.config.ts`; Pages needs it.

## Architecture essentials
- **Single state tree.** One `SimulationState` (`src/types/sim.ts`), owned by `App.tsx`.
  - Hierarchy: `rooms[] → tents[] → items[]`, plus `room.items[]` for items placed directly in a room.
  - `Item` is a discriminated union on `category` (`plant | mushroom | equipment | person | pet`).
  - `state.room` is a legacy mirror of the active room. Whenever `rooms` changes, keep `room` in sync.
- **Sim loop** (`App.tsx`):
  - A 1 s interval advances `simTime` by `speed` sim-minutes.
  - It runs the pure `simulateEnvironmentTick(room, outside, simTime, elapsedMinutes)` over every room, and turns the returned events into journal entries.
  - `handleSkipTime` does the same in one large step.
  - The loop reads state through `stateRef`.
- **Persistence** (`src/utils/storage.ts`): autosaves to `localStorage` key `sprout_spore_grow_sim_v2`. When you add a state field, add a default in `createDefaultSimulationState()` **and** a backfill in `loadSimulation()`. JSON import goes through the same path.
- **Two views + cross-window sync.**
  - `viewMode` is either `dashboard` (`ClimateDashboard`, `InteractiveFloorplan`, `ItemInspector`, `GrowJournal`) or `game` (`components/game/GameWorld.tsx` + `components/game3d/`).
  - The view comes from the `#game` hash or `?view=game`. `GameWorld` is lazy-loaded so the dashboard skips three.js.
  - Windows sync via `BroadcastChannel` (`src/utils/syncChannel.ts`). **Every state mutation handler calls `broadcastSimulationState(nextState)`.**
- **Where things live** (in `src/utils/`):
  - `physics.ts`: tick, VPD, tent arbitration, crop growth.
  - `roomThermal.ts`: room heat balance.
  - `plantLifecycle.ts`: stages and sizes.
  - `spatial.ts`: positions and geometry.
  - `equipmentLinks.ts`: hoses, heat mats, water, exhaust ducting.
  - `equipmentStatus.ts`: running/idle indicators.
  - `cropIssues.ts`: crop problem badges.
  - `weatherService.ts`: outdoor weather.
  - Catalogs: `tentCatalog.ts`, `equipmentCatalog.ts`, with presets inline in `AddItemModal.tsx` / `AddRoomModal.tsx`.

## Notes
- `ItemInspector.tsx` is a thin shell; its room/tent/item panels and per-equipment cards live in `src/components/inspector/`. Edit the card you need there.
- Some files are still very large: `AddItemModal.tsx` (~2.1k lines), `physics.ts` (~1.7k), `GameWorld.tsx` (~1.5k). Grep for the relevant handler and read slices instead of whole files.
- Temperature math is Fahrenheit-first (`tempF`), with `tempC` derived. `state.tempUnit` only affects display.
