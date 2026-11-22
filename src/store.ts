import { create } from 'zustand';
import type {
  Bot, Division, Furniture, FurnitureType, LayoutSnapshot, Level, LogEntry, Project, Room, Task,
} from './types';
import { initDB, loadAll, repo, onPersist, resetDB, importBytes } from './db/database';
import { CATALOG } from './sim/catalog';

export type Tab = 'org' | 'bots' | 'projects' | 'layout' | 'data';
export type Selection = { kind: 'room' | 'furniture'; id: number } | null;

interface State {
  ready: boolean;
  error: string | null;
  levels: Level[];
  divisions: Division[];
  bots: Bot[];
  projects: Project[];
  tasks: Task[];
  rooms: Room[];
  furniture: Furniture[];
  layouts: LayoutSnapshot[];
  logs: LogEntry[];
  layoutDirty: boolean;
  layoutVersion: number; // bump to rebuild nav grid
  saveStatus: 'saved' | 'saving';

  tab: Tab;
  editMode: boolean;
  selection: Selection;
  selectedBotId: number | null;
  followBot: boolean;
  simRunning: boolean;
  simSpeed: number;
  quality: 'high' | 'low';
  showPerf: boolean;
  showBubbles: boolean;
  autopilot: boolean;
  customModelUrl: string | null;
  customModelName: string | null;
  dragging: boolean;

  init: () => Promise<void>;
  reload: () => void;
  set: (p: Partial<State>) => void;

  saveLevel: (l: Partial<Level>) => void;
  deleteLevel: (id: number) => void;
  saveDivision: (d: Partial<Division>) => void;
  deleteDivision: (id: number) => void;
  saveBot: (b: Bot | Omit<Bot, 'id'>) => number;
  deleteBot: (id: number) => void;
  createProject: (p: Omit<Project, 'id' | 'created_at' | 'status'>, tasks: { title: string; skill: string }[]) => number;
  deleteProject: (id: number) => void;
  setProjectStatus: (id: number, s: Project['status']) => void;
  patchTask: (t: Pick<Task, 'id'> & Partial<Task>, persist?: boolean) => void;

  addRoom: (r: Omit<Room, 'id'>) => void;
  updateRoom: (id: number, p: Partial<Room>, moveContents?: boolean) => void;
  deleteRoom: (id: number) => void;
  addFurniture: (type: FurnitureType, x: number, z: number) => void;
  updateFurniture: (id: number, p: Partial<Furniture>) => void;
  deleteFurniture: (id: number) => void;
  assignDesk: (botId: number, deskId: number | null) => void;
  saveLayout: () => void;
  revertLayout: () => void;
  saveSnapshot: (name: string) => void;
  loadSnapshot: (id: number) => void;
  deleteSnapshot: (id: number) => void;

  pushLogs: (entries: Omit<LogEntry, 'id'>[]) => void;
  clearLogs: () => void;
  resetAll: () => Promise<void>;
  importDb: (bytes: Uint8Array) => Promise<void>;
}

let logSeq = 1e9;
const nextId = (arr: { id: number }[]) => arr.reduce((m, a) => Math.max(m, a.id), 0) + 1;

export const useStore = create<State>((set, get) => ({
  ready: false,
  error: null,
  levels: [], divisions: [], bots: [], projects: [], tasks: [], rooms: [], furniture: [], layouts: [], logs: [],
  layoutDirty: false,
  layoutVersion: 0,
  saveStatus: 'saved',
  tab: 'projects',
  editMode: false,
  selection: null,
  selectedBotId: null,
  followBot: false,
  simRunning: true,
  simSpeed: 1,
  quality: 'high',
  showPerf: true,
  showBubbles: true,
  autopilot: true,
  customModelUrl: null,
  customModelName: null,
  dragging: false,

  init: async () => {
    try {
      await initDB();
      onPersist((s) => set({ saveStatus: s }));
      set({ ...loadAll(), ready: true });
    } catch (e) {
      console.error(e);
      set({ error: String(e) });
    }
  },
  reload: () => set((s) => ({ ...loadAll(), layoutDirty: false, layoutVersion: s.layoutVersion + 1 })),
  set: (p) => set(p),

  saveLevel: (l) => { repo.upsertLevel(l); set(loadAllPartial(['levels'])); },
  deleteLevel: (id) => { repo.deleteLevel(id); set(loadAllPartial(['levels'])); },
  saveDivision: (d) => { repo.upsertDivision(d); set(loadAllPartial(['divisions'])); },
  deleteDivision: (id) => { repo.deleteDivision(id); set(loadAllPartial(['divisions'])); },
  saveBot: (b) => {
    const id = repo.saveBot(b);
    set(loadAllPartial(['bots']));
    return id;
  },
  deleteBot: (id) => {
    repo.deleteBot(id);
    set({ ...loadAllPartial(['bots', 'tasks']), selectedBotId: get().selectedBotId === id ? null : get().selectedBotId });
  },
  createProject: (p, tasks) => {
    const id = repo.createProject(p, tasks);
    set(loadAllPartial(['projects', 'tasks']));
    return id;
  },
  deleteProject: (id) => { repo.deleteProject(id); set(loadAllPartial(['projects', 'tasks'])); },
  setProjectStatus: (id, s) => {
    repo.updateProjectStatus(id, s);
    set((st) => ({ projects: st.projects.map((p) => (p.id === id ? { ...p, status: s } : p)) }));
  },
  patchTask: (t, persist = true) => {
    const tasks = get().tasks.map((x) => (x.id === t.id ? { ...x, ...t } : x));
    set({ tasks });
    if (persist) {
      const full = tasks.find((x) => x.id === t.id);
      if (full) repo.updateTask(full);
    }
  },

  // ---------- layout editing (in-memory until saved) ----------
  addRoom: (r) => set((s) => {
    const id = nextId(s.rooms);
    return { rooms: [...s.rooms, { ...r, id }], layoutDirty: true, layoutVersion: s.layoutVersion + 1, selection: { kind: 'room', id } };
  }),
  updateRoom: (id, p, moveContents = false) => set((s) => {
    const old = s.rooms.find((r) => r.id === id);
    if (!old) return {};
    let furniture = s.furniture;
    if (moveContents && (p.x !== undefined || p.z !== undefined)) {
      const dx = (p.x ?? old.x) - old.x, dz = (p.z ?? old.z) - old.z;
      furniture = s.furniture.map((f) => (f.room_id === id ? { ...f, x: f.x + dx, z: f.z + dz } : f));
    }
    return { rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...p } : r)), furniture, layoutDirty: true, layoutVersion: s.layoutVersion + 1 };
  }),
  deleteRoom: (id) => set((s) => ({
    rooms: s.rooms.filter((r) => r.id !== id),
    furniture: s.furniture.map((f) => (f.room_id === id ? { ...f, room_id: null } : f)),
    selection: null, layoutDirty: true, layoutVersion: s.layoutVersion + 1,
  })),
  addFurniture: (type, x, z) => set((s) => {
    const id = nextId(s.furniture);
    const room = s.rooms.find((r) => Math.abs(x - r.x) < r.w / 2 && Math.abs(z - r.z) < r.d / 2);
    return {
      furniture: [...s.furniture, { id, type, x, z, rot: 0, room_id: room?.id ?? null, color: CATALOG[type].color }],
      selection: { kind: 'furniture', id }, layoutDirty: true, layoutVersion: s.layoutVersion + 1,
    };
  }),
  updateFurniture: (id, p) => set((s) => ({
    furniture: s.furniture.map((f) => {
      if (f.id !== id) return f;
      const nf = { ...f, ...p };
      if (p.x !== undefined || p.z !== undefined) {
        const room = s.rooms.find((r) => Math.abs(nf.x - r.x) < r.w / 2 && Math.abs(nf.z - r.z) < r.d / 2);
        nf.room_id = room?.id ?? null;
      }
      return nf;
    }),
    layoutDirty: true, layoutVersion: s.layoutVersion + 1,
  })),
  deleteFurniture: (id) => set((s) => ({
    furniture: s.furniture.filter((f) => f.id !== id),
    bots: s.bots.map((b) => (b.desk_id === id ? { ...b, desk_id: null } : b)),
    selection: null, layoutDirty: true, layoutVersion: s.layoutVersion + 1,
  })),
  assignDesk: (botId, deskId) => set((s) => ({
    bots: s.bots.map((b) => (b.id === botId ? { ...b, desk_id: deskId } : b.desk_id === deskId && deskId !== null ? { ...b, desk_id: null } : b)),
    layoutDirty: true, layoutVersion: s.layoutVersion + 1,
  })),
  saveLayout: () => {
    const { rooms, furniture, bots } = get();
    repo.saveLayout(rooms, furniture, bots);
    set({ layoutDirty: false });
  },
  revertLayout: () => set((s) => ({ ...loadAllPartial(['rooms', 'furniture', 'bots']), layoutDirty: false, selection: null, layoutVersion: s.layoutVersion + 1 })),
  saveSnapshot: (name) => {
    const { rooms, furniture, bots } = get();
    repo.saveSnapshot(name, JSON.stringify({ rooms, furniture, desks: bots.map((b) => [b.id, b.desk_id]) }));
    set(loadAllPartial(['layouts']));
  },
  loadSnapshot: (id) => {
    const snap = get().layouts.find((l) => l.id === id);
    if (!snap) return;
    const data = JSON.parse(snap.data) as { rooms: Room[]; furniture: Furniture[]; desks: [number, number | null][] };
    const desks = new Map(data.desks);
    set((s) => ({
      rooms: data.rooms, furniture: data.furniture,
      bots: s.bots.map((b) => ({ ...b, desk_id: desks.has(b.id) ? desks.get(b.id)! : b.desk_id })),
      layoutDirty: true, selection: null, layoutVersion: s.layoutVersion + 1,
    }));
  },
  deleteSnapshot: (id) => { repo.deleteSnapshot(id); set(loadAllPartial(['layouts'])); },

  pushLogs: (entries) => {
    if (!entries.length) return;
    repo.addLogs(entries);
    set((s) => ({ logs: [...s.logs, ...entries.map((e) => ({ ...e, id: logSeq++ }))].slice(-250) }));
  },
  clearLogs: () => { repo.clearLogs(); set({ logs: [] }); },
  resetAll: async () => {
    await resetDB();
    set((s) => ({ ...loadAll(), layoutDirty: false, selection: null, selectedBotId: null, layoutVersion: s.layoutVersion + 1 }));
  },
  importDb: async (bytes) => {
    await importBytes(bytes);
    set((s) => ({ ...loadAll(), layoutDirty: false, selection: null, selectedBotId: null, layoutVersion: s.layoutVersion + 1 }));
  },
}));

function loadAllPartial<K extends keyof ReturnType<typeof loadAll>>(keys: K[]): Pick<ReturnType<typeof loadAll>, K> {
  const all = loadAll();
  const out = {} as Pick<ReturnType<typeof loadAll>, K>;
  for (const k of keys) out[k] = all[k];
  return out;
}

// ---------- Live simulation UI state (low-frequency, 4Hz) ----------
export interface BotStatus {
  state: 'idle' | 'walking' | 'working' | 'talking' | 'meeting' | 'break' | 'sport' | 'commute';
  hidden: boolean; // inside a vehicle / off-site
  bubble: string;
  icon: string;
  taskId: number | null;
  stepIndex: number;
  steps: { label: string; action: string; injected?: boolean }[];
  load: number;
}
export const useSimUi = create<{ status: Record<number, BotStatus>; set: (s: Record<number, BotStatus>) => void }>((set) => ({
  status: {},
  set: (status) => set({ status }),
}));
