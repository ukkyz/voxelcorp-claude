# Art & performance budgets (tech-art contract)

Owner: Prompt Technical Artist. Numbers marked **measured** come from `scripts/`/geometry checks on the current build; **limit** is the enforced ceiling. Change a limit only with a note here and a `docs/prompts/README.md` changelog entry.

## Characters (voxel bot GLB, `scripts/generate-voxel-bot.mjs`)
| Metric | Measured | Limit | Notes |
|---|---|---|---|
| Triangles | 276 | ≤ 600 | merged per (pivot, material) |
| Draw calls per bot | 12 | ≤ 12 | one merged mesh per pivot×material |
| Materials | 4 (Base, Shirt, Hair, Tie) | ≤ 8 | Shirt/Hair/Tie tinted at runtime (cloned, not shared) |
| Textures | 0 | 0 | vertex colours only |
| Animation clips | 11 | ≤ 12 | Idle, Walk, Run, KickRun, DribbleRun, Talk, Typing, EnterCar, ExitCar, EnterBike, ExitBike |
| Clip duration | 0.5 – 2.0 s, all periodic or one-shot | — | Enter/Exit 1.6 s |
| GLB size | ~93 KB | ≤ 150 KB | keyframes dominate; 16 bots share one asset |
| Pivots | 7 named (Hips, HeadPivot, MouthPivot, ArmL/R_Pivot, LegL/R_Pivot) + root `VoxelBot` | fixed | do not rename: clips target them by name |

## Props & vehicles (`CATALOG` + `furnitureGeo.ts`)
Each prop = **1 draw call**, shared vertex-colour material. Budget: ≤ 120 props, ≤ 15 000 prop triangles (the editor's budget panel shows live totals).

| Type | Category | Tris (measured) | Footprint (m) |
|---|---|---|---|
| desk | prop | 468 | 1.8 × 0.9 |
| exec_desk | prop | 396 | 2.4 × 1.0 |
| meeting_table | prop | 132 | 4 × 1.8 |
| bookshelf | prop | 192 | 1.6 × 0.45 |
| server_rack | prop | 132 | 0.9 × 0.9 |
| whiteboard | prop | 96 | 2 × 0.3 |
| sofa / coffee / plant / water / printer | prop | 72 / 72 / 60 / 36 / 48 | small |
| car_mpv_luxury | vehicle | 204 | 2.2 × 4.9 |
| car_sedan_sport | vehicle | 204 | 2.0 × 4.6 |
| moto_big | vehicle | 156 | 0.9 × 2.3 |
| moto_sport | vehicle | 108 | 0.7 × 2.0 |
| football_pitch | surface (walkable) | 492 | 12 × 8 |
| basketball_court | surface (walkable, hoops inside footprint) | 360 | 9 × 5 |

Default layout today (measured): 52 furniture pieces, **12 084 prop triangles** (limit 15 000 — 80 % used; a few more vehicles or a bigger pitch would exceed it, so check the editor budget panel).

## Rooms & transparency (overdraw)
- Rooms: 1 floor plane + ≤ 3 merged meshes (walls, glass, caps) + 1 label + (parking) 1 bay-line mesh.
- **Transparency audit:** only glass (`opacity 0.16`, `depthWrite:false`) and label/selection overlays are transparent. Glass is removed in **Low** quality. Keep new transparent meshes ≤ 2 per room and never on bots.
- Sport surfaces are opaque; do not add translucent overlays on the pitch (overdraw on mobile).

## Scene & runtime
| Metric | Budget | Where to read it |
|---|---|---|
| Draw calls | ≤ 150 desktop / ≤ 80 mobile target | Perf panel (`showPerf`) → `calls` |
| Triangles on screen | ≤ 300 k desktop | Perf panel → `tris` |
| Sim tick cost | ≤ 2 ms average | Perf panel → `ms` (exponential average) |
| Bot DOM overlays | 1 per bot (≤ 20 bots) | Html bubbles; hidden bots render none |
| Shadow map | 2048², only High quality | Scene.tsx |

Headless proxy: `npm run test:sim` runs 900 sim-seconds with 16 bots in ~1.5 s (measured); use it to catch logic regressions (stalls, out-of-area targets, missing clips).

## Review checklist for art/asset PRs
- [ ] New prop: `tris` field equals measured value; footprint contains all geometry (check bbox).
- [ ] New clip: name matches an `Anim` value; period/duration recorded here; clip count ≤ 12.
- [ ] No new textures, no new materials on bots.
- [ ] Transparent meshes counted above.
- [ ] `npm run build` and `npm run test:sim` pass.
