# Architecture cheat-sheet (sim + render + data)

```
SQLite (sql.js, IndexedDB-persisted)  ──loadAll()──►  Zustand store (src/store.ts)
        ▲                                                 │  rooms, furniture, bots, projects, tasks…
        │ repo.* writes (debounced persist 400 ms)        ▼
  src/db/database.ts ◄── src/db/seed.ts            src/sim/engine.ts  (Simulation singleton `sim`)
                                                   │ tick(dt) from R3F useFrame (SimDriver)
                                                   │ runtimes: Map<botId, BotRuntime>   (NOT in store)
                                                   │ flushUi() every 0.25 s ─► useSimUi (BotStatus)
                                                   ▼
  src/three/Scene.tsx ─► Office.tsx (rooms, props) ─ BotAvatar.tsx (reads runtime every frame, UI from useSimUi)
  src/ui/*.tsx (panels; LayoutPanel edits layout → store → layoutVersion++ → nav grid rebuild)
```

## Simulation loop
- `tick(realDt)`: if `ready`, `sync()` (create runtimes, rebuild nav grid when `layoutVersion` changes).
- When `simRunning && !editMode`: `dt = min(realDt,0.1)*simSpeed`; every 1 s: `ensureDesks`, `dispatch` (assign tasks), `autopilot`. Then `update(rt, dt)` for every bot.
- `update()` order: locked (in conversation) → task cleanup → pick next activity (`queue.shift()` or `planNext`) → travel along A* path → `arrive()` → perform timer → `finish()`.

## Activity model
`Activity { kind: 'desk'|'talk'|'meeting'|'spot', action, label, bubble, duration, anim, icon, spot?, partnerId?, moveAnim?, speed?, hide?, show?, away? }`

| Flow | Sequence | Flags |
|---|---|---|
| Routine desk work | desk (Typing) | — |
| Coffee break | spot near coffee/water/sofa (Idle) | `action:'break'` |
| 1:1 | talk with a report | `kind:'talk'` |
| **Sport drill** (10 %) | 3–5 × spot inside a pitch/court: `Run` between points, `KickRun`/`DribbleRun` on arrival | `action:'sport'`, `speed: 4.2` |
| **Commute** (6 %) | park: walk to vehicle door → `EnterCar`/`EnterBike` → **hide** ; away: hidden 12–22 s ; unpark: **show** at door → `ExitCar`/`ExitBike` | `park`/`away`/`unpark`, `hide`, `away`, `show` |
| Task plan | ordered steps (think/research/execute/review/meeting/report …) | `taskId`, `stepIndex` |
| Kickoff | meeting in Boardroom, pushed to front of queue | `kind:'meeting'` |

Hidden state: `rt.hidden` true only while `away` (and between `park` finish and the next start). `start()` clears it for every other activity.

## Render path
- Props: `furnitureGeometry(type)` merges all parts into one vertex-coloured BufferGeometry → 1 draw call per prop, shared material.
- Rooms: floor plane + merged wall segments (`wallSegments` with door gap) + glass (dropped in Low quality) + label texture. Parking rooms add merged `bayLinesGeo`.
- Bots: one cloned GLB per bot, tinted by material name (`Shirt`, `Hair`, `Tie`); `useAnimations` with cross-fade 0.22 s; clip resolved per `Anim` via `resolveClip` (exact → regex → `FALLBACK` chain).
- Shadows only in `quality === 'high'`.

## World & navigation
- `WORLD` (pathfinding.ts) = x[-30,40] z[-17,36] at 0.5 m cells. Obstacles: wall segments (+0.3 pad), props & vehicles (footprint + 0.15), world border.
- `findPath`: 8-way A* with no corner cutting, then string-pulling. Final target is appended even if inside the margin (lets bots stand at seats/doors).
- Layout map (x, z of room centres, size w×d):

```
 z=-17 ┌──────────────┬──────────────┬──────────────┐
       │ Exec Suite   │ Eng Bay      │ AI Lab       │ Boardroom
 z=-5.5│ (-16,-10)12×9│ (0,-10) 14×9 │ (15,-10) 11×9│ (24.5,0) 6×12
       ├──── corridor (z≈0) ─────────────────────────┤
 z= 5.5│ Lounge (-24,0)  │ Product (-16,10) 12×9 │ Sales (0,10) 14×9 │ Ops (15,10) 11×9 │   Sport Area (30,15) 16×16
 z=14.5│                 │                        │                  │                  │
 z=24  ├────────────────────────── Parking Lot (0,29) 56×10 ─────────────────────────────┤
 z=34  └──────────────────────────────────────────────────────────────────────────────────┘
```
(Gaps between rooms at x≈-8.5 and x≈8.25 are the south access routes to the Parking Lot.)

## Persistence & migrations
- `schema_version` in `meta`: `1` = original seed, `2` = Parking Lot + Sport Area (`migrateAreas`). Fresh seed writes `2`.
- Migration appends rows only (ids = max+1); it never rewrites a user's existing layout. `importBytes` also migrates.
- Snapshots (`layouts` table) store `{rooms, furniture}` JSON; old snapshots load fine (new areas simply absent).
