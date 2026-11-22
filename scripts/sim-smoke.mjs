// Headless smoke test for the simulation: no browser, no DB, no WebGL.
// Loads the REAL store + engine via Vite's SSR loader, seeds state from src/db/seed.ts,
// simulates N seconds and asserts the Sport Area / Parking Lot behaviour.
// Usage: node scripts/sim-smoke.mjs [simSeconds=900]     (exit code 1 on failure)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import fs from 'node:fs';
import initSqlJs from 'sql.js';

globalThis.window ??= globalThis; // database.ts persist() uses window.*Timeout
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIM_SECONDS = Number(process.argv[2] ?? 900);
const DT = 1 / 30;

const server = await createServer({
  root: ROOT, configFile: false, plugins: [], appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { useStore } = await server.ssrLoadModule('/src/store.ts');
  const { sim } = await server.ssrLoadModule('/src/sim/engine.ts');
  const seed = await server.ssrLoadModule('/src/db/seed.ts');
  const { CATALOG, entryPoint } = await server.ssrLoadModule('/src/sim/catalog.ts');

  // ---- build state exactly the way seed() lays it out (ids are 1-based array positions) ----
  const rooms = seed.ROOMS.map((r, i) => ({ id: i + 1, name: r.name, type: r.type, x: r.x, z: r.z, w: r.w, d: r.d, color: r.color, division_id: r.div, door_side: r.door }));
  const deskOf = {};
  const furniture = seed.FURNITURE.map(([type, ri, lx, lz, rot, bi], i) => {
    if (bi >= 0) deskOf[bi] = i + 1;
    return { id: i + 1, type, x: rooms[ri].x + lx, z: rooms[ri].z + lz, rot, room_id: ri + 1, color: '' };
  });
  const bots = seed.BOTS.map((b, i) => ({
    id: i + 1, name: b.name, title: b.title, level_id: b.level, division_id: b.div, manager_id: b.mgr,
    shirt_color: '#3b82f6', hair_color: b.hair, accent_color: '#ef4444', persona: b.persona, skills: b.skills,
    guardrails: [], workflow: seed.workflowFrom(b.wf), desk_id: deskOf[i] ?? null,
  }));
  const noop = () => {};
  useStore.setState({
    ready: true, levels: seed.LEVELS.map((l) => ({ id: l.id, name: l.name, rank: l.rank, can_create_projects: l.can, color: l.color })),
    divisions: seed.DIVISIONS.map((d) => ({ id: d.id, name: d.name, color: d.color, parent_id: d.parent, head_bot_id: null, description: d.desc })),
    bots, rooms, furniture, projects: [], tasks: [], layoutVersion: 1, simRunning: true, simSpeed: 1, autopilot: false, editMode: false,
    patchTask: noop, pushLogs: noop, assignDesk: noop, setProjectStatus: noop, createProject: () => 0, saveLayout: noop,
  });

  const sportRoom = rooms.find((r) => r.type === 'sport');
  const parking = rooms.find((r) => r.type === 'parking');
  const inRoom = (r, x, z) => r && Math.abs(x - r.x) <= r.w / 2 + 0.01 && Math.abs(z - r.z) <= r.d / 2 + 0.01;
  const vehicles = furniture.filter((f) => CATALOG[f.type].vehicle);

  const episodes = {};           // activity.action -> count of distinct activities started
  const anims = new Set();
  const lastAct = new Map();
  const failures = [];
  const checked = new WeakSet();
  const sportLabels = new Set();
  let hiddenTicks = 0, maxHidden = 0;

  for (let t = 0; t < SIM_SECONDS / DT; t++) {
    sim.tick(DT);
    let hidden = 0;
    for (const rt of sim.runtimes.values()) {
      const a = rt.activity;
      anims.add(rt.anim);
      if (rt.hidden) hidden++;
      if (a && lastAct.get(rt.id) !== a) {
        lastAct.set(rt.id, a);
        episodes[a.action] = (episodes[a.action] ?? 0) + 1;
        if (a.action === 'sport') sportLabels.add(a.label);
      }
      if (!a || rt.phase !== 'perform' || checked.has(a)) continue;
      if (a.action === 'sport' || a.action === 'park' || a.action === 'unpark') {
        checked.add(a);
        const d = Math.hypot(rt.x - a.spot.x, rt.z - a.spot.z);
        if (d > 0.6) failures.push(`${rt.id} ${a.action} stalled ${d.toFixed(2)}m from target @${(t * DT).toFixed(0)}s`);
      }
      if (a.action === 'sport' && !inRoom(sportRoom, a.spot.x, a.spot.z)) failures.push(`sport target outside Sport Area: ${a.spot.x.toFixed(1)},${a.spot.z.toFixed(1)}`);
      if ((a.action === 'park' || a.action === 'unpark') && !vehicles.some((v) => { const e = entryPoint(v); return Math.hypot(e.x - a.spot.x, e.z - a.spot.z) < 0.01; })) failures.push(`vehicle spot not on any entry point (${a.action})`);
      if (a.action === 'park' && !inRoom(parking, a.spot.x, a.spot.z)) failures.push('park entry outside Parking Lot');
    }
    hiddenTicks += hidden;
    maxHidden = Math.max(maxHidden, hidden);
  }

  const bySec = (n) => (n / (SIM_SECONDS / DT)).toFixed(2);
  const report = {
    simSeconds: SIM_SECONDS,
    bots: bots.length,
    activityEpisodes: episodes,
    sportDrills: [...sportLabels],
    animationsUsed: [...anims].sort(),
    maxBotsHiddenAtOnce: maxHidden,
    avgBotsHidden: bySec(hiddenTicks),
    botsStillHiddenAtEnd: [...sim.runtimes.values()].filter((r) => r.hidden).length,
    failures: failures.length,
  };
  const required = ['sport', 'park', 'away', 'unpark'];
  for (const k of required) if (!episodes[k]) failures.push(`no "${k}" activity happened — idle roll/areas not wired`);
  for (const anim of ['KickRun', 'DribbleRun', 'Run', 'EnterCar', 'ExitCar']) if (!anims.has(anim)) failures.push(`anim ${anim} never selected`);
  if (!sportLabels.has('Football drill') || !sportLabels.has('Basketball drill')) failures.push('expected both football and basketball drills');
  if (hiddenTicks === 0) failures.push('no bot ever drove off (hidden)');
  // ---- schema migration: a v1 save (pre-areas) must gain Parking Lot + Sport Area exactly once ----
  // initDB() seeds a fresh v2 database in-memory (wasm fetched from disk, IndexedDB absent → memory only).
  globalThis.fetch = async (u) => new Response(await fs.promises.readFile(path.join(ROOT, String(u).split('?')[0].replace(/^\//, ''))));
  const SQL = await initSqlJs({ locateFile: (f) => path.join(ROOT, 'node_modules/sql.js/dist', f) });
  const dbMod = await server.ssrLoadModule('/src/db/database.ts');
  await dbMod.initDB();
  const count = (d, sql) => Number(d.exec(sql)[0].values[0][0]);
  const fresh = new SQL.Database(dbMod.exportBytes());
  const freshCounts = { rooms: count(fresh, 'SELECT count(*) FROM rooms'), vehicles: count(fresh, "SELECT count(*) FROM furniture WHERE type LIKE 'car_%' OR type LIKE 'moto_%'") };
  // Turn that v2 database back into a v1 save: drop the two area rooms + their props, reset the version.
  const v1 = new SQL.Database(dbMod.exportBytes());
  v1.run('DELETE FROM furniture WHERE room_id > ?', [seed.AREA_ROOM_START]);
  v1.run('DELETE FROM rooms WHERE id > ?', [seed.AREA_ROOM_START]);
  v1.run("UPDATE meta SET value='1' WHERE key='schema_version'");
  const before = { rooms: count(v1, 'SELECT count(*) FROM rooms'), furniture: count(v1, 'SELECT count(*) FROM furniture') };

  await dbMod.importBytes(v1.export()); // importBytes → migrateAreas()
  const m1 = new SQL.Database(dbMod.exportBytes());
  const after = {
    rooms: count(m1, 'SELECT count(*) FROM rooms'), furniture: count(m1, 'SELECT count(*) FROM furniture'),
    parking: count(m1, "SELECT count(*) FROM rooms WHERE type='parking'"), sport: count(m1, "SELECT count(*) FROM rooms WHERE type='sport'"),
    vehicles: count(m1, "SELECT count(*) FROM furniture WHERE type LIKE 'car_%' OR type LIKE 'moto_%'"),
    surfaces: count(m1, "SELECT count(*) FROM furniture WHERE type IN ('football_pitch','basketball_court')"),
  };
  await dbMod.importBytes(m1.export()); // a second migration must be a no-op
  const again = count(new SQL.Database(dbMod.exportBytes()), 'SELECT count(*) FROM rooms');
  report.migration = { freshSeed: freshCounts, before, after, roomsAfterSecondRun: again };
  if (freshCounts.rooms !== 10 || freshCounts.vehicles !== 4) failures.push(`fresh seed wrong: ${JSON.stringify(freshCounts)}`);
  if (before.rooms !== 8 || after.rooms !== 10 || after.parking !== 1 || after.sport !== 1) failures.push(`room migration wrong: ${JSON.stringify(report.migration)}`);
  if (after.vehicles !== 4 || after.surfaces !== 2) failures.push(`prop migration wrong: ${JSON.stringify(report.migration)}`);
  if (again !== after.rooms) failures.push('migration is not idempotent');

  report.failures = failures.length;
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) {
    console.error(`FAIL (${failures.length}):\n - ${[...new Set(failures)].slice(0, 20).join('\n - ')}`);
    process.exitCode = 1;
  } else console.log('PASS');
} finally {
  await server.close();
}
