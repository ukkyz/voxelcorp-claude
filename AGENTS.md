# AGENTS.md — VoxelCorp Office Sim (read this first, then only the files you touch)

Single-page React 19 + react-three-fiber + Zustand app. A simulated company of 16 voxel bots works
in a 3D office. State lives in SQLite (sql.js) persisted to IndexedDB. Build = one inlined HTML file.

## Commands
| Task | Command | Notes |
|---|---|---|
| install | `npm ci` | lockfile is authoritative |
| dev server | `npm run dev` | `predev` regenerates `src/assets/voxel_bot.glb` |
| production build | `npm run build` | `prebuild` regenerates the GLB; output `dist/index.html` |
| headless sim + migration test | `npm run test:sim` | ~1.5 s for 900 sim-s; `node scripts/sim-smoke.mjs 3600` for an hour |
| typecheck | `npx tsc --noEmit -p .` | must be 0 errors |
| regenerate bot GLB only | `npm run gen:bot` | edit clips in `scripts/generate-voxel-bot.mjs` |

**Definition of done for any change:** typecheck clean + `npm run build` ok + `npm run test:sim` prints PASS.
No browser is available in the sandbox: visual checks must be described as "not visually verified".

## Where things live (change these, not the whole tree)
| If you want to… | Edit |
|---|---|
| add/change a furniture or vehicle prop (footprint, icon, tris, door, sport) | `src/sim/catalog.ts` (CATALOG) **and** `src/three/furnitureGeo.ts` (DEFS geometry) **and** `src/types.ts` (FurnitureType) |
| add a room type | `src/types.ts` (RoomType), `src/sim/pathfinding.ts` (`OPEN_ROOMS` if no walls), `src/ui/LayoutPanel.tsx` (ROOM_TYPES, ROOM_PRESETS) |
| change the world/office layout or default props | `src/db/seed.ts` (ROOMS, FURNITURE) + bump migration in `src/db/database.ts` |
| change world bounds | `src/sim/pathfinding.ts` `WORLD` (nav grid + ground + drag clamp follow it) |
| bot behaviour (idle choices, sport, commute, meetings, tasks) | `src/sim/engine.ts` — see `docs/ARCHITECTURE.md` |
| bot animation clips / new clip | `scripts/generate-voxel-bot.mjs` (clip name) → `Anim` union in `engine.ts` → `ANIMS` + fallback in `src/three/BotAvatar.tsx` |
| bot visuals (bubble, ring, tint, hidden state) | `src/three/BotAvatar.tsx` |
| room floors / walls / parking bay lines | `src/three/Office.tsx` |
| scene, lights, camera, ground | `src/three/Scene.tsx` |
| UI panels | `src/ui/*.tsx` (LayoutPanel = editor palette, BotsPanel, Overlays = bot inspector) |

## Invariants (break these and the app silently misbehaves)
1. **Clip names are a contract.** `Anim` strings == GLB clip names (exact match first). Unknown clips fall back via `FALLBACK` in BotAvatar, so custom GLBs still animate.
2. **Every `FurnitureType` needs entries in three places:** `CATALOG`, `DEFS` (furnitureGeo), the union. TypeScript enforces this; keep it green.
3. **Surfaces are walkable, props/vehicles block nav.** `category: 'surface'` is skipped by `buildNavGrid`. Vehicles keep their footprint blocked; their `entry` point (door side) must sit outside footprint + 0.15 m margin.
4. **Schema changes are append-only migrations.** Existing users keep their saved DB. Add a `migrateAreas`-style function gated on `meta.schema_version`; never re-seed. Seed (`seed.ts`) and migration must produce the same rows (the smoke test checks this).
5. **Hidden bots:** a bot inside a vehicle / off-site has `runtime.hidden = true` and renders nothing (no body, no bubble). Only `start()` clears it, via `a.away`. Talk partners that are hidden are dropped to the desk.
6. **Activities queue.** Idle decisions may push follow-up steps onto `rt.queue`. `kickoff()` strips pending commute steps (`away/show/hide`) before queuing a meeting.
7. **`window` is used by `database.ts persist()`.** Node harnesses must shim it (see `scripts/sim-smoke.mjs`).
8. **GLB is not committed** (`.gitignore`). It is generated from the script; do not hand-edit it.

## Current feature state (schema v2, branch `arena/4f219bb9-voxelcorp-claude`)
- Areas: **Parking Lot** (south strip, 4 vehicles: Luxury MPV, Sporty Sedan, Big Motorcycle, Sport Motorcycle) and **Sport Area** (east, Football Pitch + Basketball Court).
- Bot anims: Idle, Walk, Run, KickRun, DribbleRun, Talk, Typing, EnterCar, ExitCar, EnterBike, ExitBike.
- Idle roll: 10 % sport drill (3–5 sprints, ball action on arrival) · 6 % commute (drive off → off-site 12–22 s → drive back in) · otherwise the original break / 1:1 / routine logic.
- Not done: no visible in-car seating (the bot disappears inside the vehicle), no driving path animation, no ball entity, no browser visual QA.

## Token-saving rules for agents
- Read this file + `docs/ARCHITECTURE.md` first. Do not re-scan the repo.
- `engine.ts` is ~700 lines: find symbols with `grep -n "^  [a-zA-Z]*(" src/sim/engine.ts` and read ranges with `read_file offset/limit`.
- Make multi-line edits with one scripted `python3` replace that asserts `count == 1` (cheaper than many tool calls).
- After any sim change run `npm run test:sim`; after any UI/geo change run `npx tsc --noEmit -p .`.
- Prompt briefs and version history: `docs/prompts/README.md`. Art/asset budgets: `docs/ART_BUDGET.md`.
