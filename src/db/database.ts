import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type {
  Bot, Division, Furniture, LayoutSnapshot, Level, LogEntry, Project, Room, Task,
} from '../types';
import {
  BOTS, DIVISIONS, FURNITURE, LEVELS, ROOMS, SAMPLE_PROJECTS, guard, workflowFrom,
} from './seed';

const IDB_NAME = 'enterprise-office-sim';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'main.sqlite';

let db: Database;
let persistTimer: number | undefined;
const listeners = new Set<(s: 'saving' | 'saved') => void>();
export const onPersist = (fn: (s: 'saving' | 'saved') => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// ---------------- IndexedDB persistence ----------------
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(): Promise<Uint8Array | null> {
  try {
    const d = await idb();
    return await new Promise((res) => {
      const tx = d.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY);
      tx.onsuccess = () => res(tx.result ? new Uint8Array(tx.result) : null);
      tx.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}
async function idbPut(bytes: Uint8Array) {
  try {
    const d = await idb();
    await new Promise<void>((res) => {
      const tx = d.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch { /* storage unavailable — in-memory only */ }
}

export function persist(immediate = false) {
  listeners.forEach((l) => l('saving'));
  window.clearTimeout(persistTimer);
  const go = async () => {
    await idbPut(db.export());
    listeners.forEach((l) => l('saved'));
  };
  if (immediate) return go();
  persistTimer = window.setTimeout(go, 400);
}

// ---------------- helpers ----------------
export function all<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}
export function run(sql: string, params: SqlValue[] = [], save = true) {
  db.run(sql, params);
  if (save) persist();
}
const lastId = () => Number(db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
const now = () => new Date().toISOString();

const SCHEMA = `
CREATE TABLE IF NOT EXISTS levels (id INTEGER PRIMARY KEY, name TEXT NOT NULL, rank INTEGER NOT NULL, can_create_projects INTEGER DEFAULT 0, color TEXT);
CREATE TABLE IF NOT EXISTS divisions (id INTEGER PRIMARY KEY, name TEXT NOT NULL, color TEXT, parent_id INTEGER REFERENCES divisions(id), head_bot_id INTEGER, description TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS bots (id INTEGER PRIMARY KEY, name TEXT NOT NULL, title TEXT, level_id INTEGER REFERENCES levels(id), division_id INTEGER REFERENCES divisions(id), manager_id INTEGER REFERENCES bots(id), shirt_color TEXT, hair_color TEXT, accent_color TEXT, persona TEXT, skills TEXT, guardrails TEXT, workflow TEXT, desk_id INTEGER);
CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY, name TEXT, description TEXT, division_id INTEGER, owner_id INTEGER, priority TEXT, budget REAL, status TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, title TEXT, skill TEXT, assignee_id INTEGER, status TEXT, progress REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY, name TEXT, type TEXT, x REAL, z REAL, w REAL, d REAL, color TEXT, division_id INTEGER, door_side TEXT);
CREATE TABLE IF NOT EXISTS furniture (id INTEGER PRIMARY KEY, type TEXT, x REAL, z REAL, rot REAL, room_id INTEGER, color TEXT);
CREATE TABLE IF NOT EXISTS layouts (id INTEGER PRIMARY KEY, name TEXT, created_at TEXT, data TEXT);
CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, ts TEXT, bot_id INTEGER, kind TEXT, text TEXT);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`;

function seed() {
  db.run('BEGIN');
  for (const l of LEVELS) db.run('INSERT INTO levels VALUES (?,?,?,?,?)', [l.id, l.name, l.rank, l.can, l.color]);
  for (const d of DIVISIONS) db.run('INSERT INTO divisions VALUES (?,?,?,?,?,?)', [d.id, d.name, d.color, d.parent, null, d.desc]);
  ROOMS.forEach((r, i) => db.run('INSERT INTO rooms VALUES (?,?,?,?,?,?,?,?,?,?)', [i + 1, r.name, r.type, r.x, r.z, r.w, r.d, r.color, r.div, r.door]));
  const deskOf: Record<number, number> = {};
  FURNITURE.forEach(([type, ri, lx, lz, rot, bi], i) => {
    const r = ROOMS[ri];
    db.run('INSERT INTO furniture VALUES (?,?,?,?,?,?,?)', [i + 1, type, r.x + lx, r.z + lz, rot, ri + 1, '']);
    if (bi >= 0) deskOf[bi] = i + 1;
  });
  BOTS.forEach((b, i) => {
    const div = DIVISIONS.find((d) => d.id === b.div)!;
    const guards = [
      guard('approval_priority', b.level <= 2 ? 'critical' : b.level <= 4 ? 'critical' : 'high', b.level > 1),
      guard('budget_limit', b.level === 1 ? '250000' : b.level <= 4 ? '60000' : '20000'),
      guard('division_scope', b.level <= 2 ? 'open' : 'strict'),
      guard('blocked_keywords'),
      guard('max_concurrent', b.level <= 4 ? '3' : '2'),
      guard('peer_review', 'on', b.wf === 'Specialist'),
    ];
    db.run('INSERT INTO bots VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      i + 1, b.name, b.title, b.level, b.div, b.mgr, div.color, b.hair, ['#ef4444', '#facc15', '#22c55e', '#0ea5e9', '#e11d48'][i % 5],
      b.persona, JSON.stringify(b.skills), JSON.stringify(guards), JSON.stringify(workflowFrom(b.wf as 'Specialist')), deskOf[i] ?? null,
    ]);
  });
  // division heads
  [[1, 1], [2, 3], [3, 9], [4, 12], [5, 15], [6, 4], [7, 7]].forEach(([d, b]) => db.run('UPDATE divisions SET head_bot_id=? WHERE id=?', [b, d]));
  for (const p of SAMPLE_PROJECTS) {
    db.run('INSERT INTO projects (name, description, division_id, owner_id, priority, budget, status, created_at) VALUES (?,?,?,?,?,?,?,?)',
      [p.name, p.desc, p.div, p.owner, p.priority, p.budget, 'active', now()]);
    const pid = lastId();
    for (const [title, skill] of p.tasks) db.run('INSERT INTO tasks (project_id, title, skill, assignee_id, status, progress) VALUES (?,?,?,?,?,?)', [pid, title, skill, null, 'todo', 0]);
  }
  db.run("INSERT INTO meta VALUES ('schema_version','1'),('seeded_at',?)", [now()]);
  db.run('INSERT INTO logs (ts, bot_id, kind, text) VALUES (?,?,?,?)', [now(), null, 'system', 'Database seeded with default enterprise, org chart and office layout.']);
  db.run('COMMIT');
}

let SQL: Awaited<ReturnType<typeof initSqlJs>>;

export async function initDB() {
  const wasmBinary = await fetch(wasmUrl).then((r) => r.arrayBuffer());
  SQL = await initSqlJs({ wasmBinary } as unknown as Parameters<typeof initSqlJs>[0]);
  const saved = await idbGet();
  if (saved) {
    try {
      db = new SQL.Database(saved);
      db.exec('SELECT count(*) FROM bots');
    } catch {
      db = new SQL.Database();
    }
  } else db = new SQL.Database();
  db.run(SCHEMA);
  const count = Number(db.exec('SELECT count(*) FROM levels')[0].values[0][0]);
  if (count === 0) seed();
  await persist(true);
}

export async function resetDB() {
  db.close();
  db = new SQL.Database();
  db.run(SCHEMA);
  seed();
  await persist(true);
}

export function exportBytes() {
  return db.export();
}
export async function importBytes(bytes: Uint8Array) {
  const test = new SQL.Database(bytes);
  test.exec('SELECT count(*) FROM bots; SELECT count(*) FROM rooms;');
  db.close();
  db = test;
  db.run(SCHEMA);
  await persist(true);
}

export function rawQuery(sql: string) {
  const t0 = performance.now();
  const res = db.exec(sql);
  const ms = performance.now() - t0;
  if (/^\s*(insert|update|delete|create|drop|alter)/i.test(sql)) persist();
  return { res, ms };
}

export function tableStats() {
  return ['levels', 'divisions', 'bots', 'projects', 'tasks', 'rooms', 'furniture', 'layouts', 'logs', 'meta'].map((t) => ({
    name: t, rows: Number(db.exec(`SELECT count(*) FROM ${t}`)[0].values[0][0]),
  }));
}

// ---------------- repository ----------------
const parseBot = (r: Record<string, unknown>): Bot => ({
  ...(r as unknown as Bot),
  skills: JSON.parse((r.skills as string) || '[]'),
  guardrails: JSON.parse((r.guardrails as string) || '[]'),
  workflow: JSON.parse((r.workflow as string) || '[]'),
});

export function loadAll() {
  return {
    levels: all<Level>('SELECT * FROM levels ORDER BY rank, id'),
    divisions: all<Division>('SELECT * FROM divisions ORDER BY id'),
    bots: all('SELECT * FROM bots ORDER BY id').map(parseBot),
    projects: all<Project>('SELECT * FROM projects ORDER BY id DESC'),
    tasks: all<Task>('SELECT * FROM tasks ORDER BY id'),
    rooms: all<Room>('SELECT * FROM rooms ORDER BY id'),
    furniture: all<Furniture>('SELECT * FROM furniture ORDER BY id'),
    layouts: all<LayoutSnapshot>('SELECT * FROM layouts ORDER BY id DESC'),
    logs: all<LogEntry>('SELECT * FROM logs ORDER BY id DESC LIMIT 200').reverse(),
  };
}

export const repo = {
  upsertLevel(l: Partial<Level>) {
    if (l.id) run('UPDATE levels SET name=?, rank=?, can_create_projects=?, color=? WHERE id=?', [l.name!, l.rank!, l.can_create_projects!, l.color!, l.id]);
    else run('INSERT INTO levels (name, rank, can_create_projects, color) VALUES (?,?,?,?)', [l.name!, l.rank!, l.can_create_projects ?? 0, l.color ?? '#94a3b8']);
  },
  deleteLevel(id: number) { run('DELETE FROM levels WHERE id=?', [id]); },
  upsertDivision(d: Partial<Division>) {
    if (d.id) run('UPDATE divisions SET name=?, color=?, parent_id=?, head_bot_id=?, description=? WHERE id=?', [d.name!, d.color!, d.parent_id ?? null, d.head_bot_id ?? null, d.description ?? '', d.id]);
    else run('INSERT INTO divisions (name, color, parent_id, head_bot_id, description) VALUES (?,?,?,?,?)', [d.name!, d.color ?? '#64748b', d.parent_id ?? null, d.head_bot_id ?? null, d.description ?? '']);
  },
  deleteDivision(id: number) {
    run('UPDATE divisions SET parent_id=NULL WHERE parent_id=?', [id], false);
    run('DELETE FROM divisions WHERE id=?', [id]);
  },
  saveBot(b: Bot | Omit<Bot, 'id'>): number {
    const vals: SqlValue[] = [b.name, b.title, b.level_id, b.division_id, b.manager_id, b.shirt_color, b.hair_color, b.accent_color, b.persona,
      JSON.stringify(b.skills), JSON.stringify(b.guardrails), JSON.stringify(b.workflow), b.desk_id];
    if ('id' in b && b.id) {
      run('UPDATE bots SET name=?, title=?, level_id=?, division_id=?, manager_id=?, shirt_color=?, hair_color=?, accent_color=?, persona=?, skills=?, guardrails=?, workflow=?, desk_id=? WHERE id=?', [...vals, b.id]);
      return b.id;
    }
    run('INSERT INTO bots (name, title, level_id, division_id, manager_id, shirt_color, hair_color, accent_color, persona, skills, guardrails, workflow, desk_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', vals);
    return lastId();
  },
  deleteBot(id: number) {
    run('UPDATE bots SET manager_id=(SELECT manager_id FROM bots WHERE id=?) WHERE manager_id=?', [id, id], false);
    run("UPDATE tasks SET assignee_id=NULL, status=CASE WHEN status='done' THEN 'done' ELSE 'todo' END WHERE assignee_id=?", [id], false);
    run('DELETE FROM bots WHERE id=?', [id]);
  },
  createProject(p: Omit<Project, 'id' | 'created_at' | 'status'>, tasks: { title: string; skill: string }[]): number {
    run('INSERT INTO projects (name, description, division_id, owner_id, priority, budget, status, created_at) VALUES (?,?,?,?,?,?,?,?)',
      [p.name, p.description, p.division_id, p.owner_id, p.priority, p.budget, 'active', now()], false);
    const pid = lastId();
    for (const t of tasks) run('INSERT INTO tasks (project_id, title, skill, assignee_id, status, progress) VALUES (?,?,?,?,?,?)', [pid, t.title, t.skill, null, 'todo', 0], false);
    persist();
    return pid;
  },
  updateProjectStatus(id: number, status: string) { run('UPDATE projects SET status=? WHERE id=?', [status, id]); },
  deleteProject(id: number) {
    run('DELETE FROM tasks WHERE project_id=?', [id], false);
    run('DELETE FROM projects WHERE id=?', [id]);
  },
  updateTask(t: Pick<Task, 'id' | 'status' | 'progress' | 'assignee_id'>) {
    run('UPDATE tasks SET status=?, progress=?, assignee_id=? WHERE id=?', [t.status, t.progress, t.assignee_id, t.id]);
  },
  saveLayout(rooms: Room[], furniture: Furniture[], bots: Bot[]) {
    db.run('BEGIN');
    db.run('DELETE FROM rooms');
    db.run('DELETE FROM furniture');
    for (const r of rooms) db.run('INSERT INTO rooms VALUES (?,?,?,?,?,?,?,?,?,?)', [r.id, r.name, r.type, r.x, r.z, r.w, r.d, r.color, r.division_id, r.door_side]);
    for (const f of furniture) db.run('INSERT INTO furniture VALUES (?,?,?,?,?,?,?)', [f.id, f.type, f.x, f.z, f.rot, f.room_id, f.color]);
    for (const b of bots) db.run('UPDATE bots SET desk_id=? WHERE id=?', [b.desk_id, b.id]);
    db.run('COMMIT');
    persist();
  },
  saveSnapshot(name: string, data: string) { run('INSERT INTO layouts (name, created_at, data) VALUES (?,?,?)', [name, now(), data]); },
  deleteSnapshot(id: number) { run('DELETE FROM layouts WHERE id=?', [id]); },
  addLogs(entries: Omit<LogEntry, 'id'>[]) {
    if (!entries.length) return;
    db.run('BEGIN');
    for (const e of entries) db.run('INSERT INTO logs (ts, bot_id, kind, text) VALUES (?,?,?,?)', [e.ts, e.bot_id, e.kind, e.text]);
    db.run('DELETE FROM logs WHERE id <= (SELECT max(id) - 1000 FROM logs)');
    db.run('COMMIT');
    persist();
  },
  clearLogs() { run('DELETE FROM logs'); },
};
