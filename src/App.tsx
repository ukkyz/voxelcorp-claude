import { lazy, Suspense, useEffect } from 'react';
import { Network, Bot as BotIcon, FolderKanban, LayoutGrid, Database } from 'lucide-react';
import { useStore, type Tab } from './store';
import TopBar from './ui/TopBar';
import OrgPanel from './ui/OrgPanel';
import BotsPanel from './ui/BotsPanel';
import ProjectsPanel from './ui/ProjectsPanel';
import LayoutPanel from './ui/LayoutPanel';
import DataPanel from './ui/DataPanel';
import { ActivityFeed, BotInspector, PerfHud } from './ui/Overlays';
import { cn } from './utils/cn';

const Scene = lazy(() => import('./three/Scene'));

const TABS: { id: Tab; label: string; icon: typeof Network }[] = [
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'bots', label: 'Bots', icon: BotIcon },
  { id: 'org', label: 'Org', icon: Network },
  { id: 'layout', label: 'Layout', icon: LayoutGrid },
  { id: 'data', label: 'Data', icon: Database },
];

function Boot({ error }: { error: string | null }) {
  return (
    <div className="grid h-screen place-items-center bg-slate-950 text-slate-300">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-xl border-4 border-sky-500 border-t-transparent" />
        <div className="text-sm font-semibold">{error ? 'Failed to start' : 'Booting VoxelCorp…'}</div>
        <div className="mt-1 text-xs text-slate-500">{error ?? 'Initialising the SQLite (WASM) database & office layout'}</div>
      </div>
    </div>
  );
}

export default function App() {
  const ready = useStore((s) => s.ready);
  const error = useStore((s) => s.error);
  const tab = useStore((s) => s.tab);
  const editMode = useStore((s) => s.editMode);
  const set = useStore((s) => s.set);

  useEffect(() => { useStore.getState().init(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      if (!st.editMode || !st.selection) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selection.kind === 'room') st.deleteRoom(st.selection.id); else st.deleteFurniture(st.selection.id);
      }
      if ((e.key === 'r' || e.key === 'R') && st.selection.kind === 'furniture') {
        const f = st.furniture.find((x) => x.id === st.selection!.id);
        if (f) st.updateFurniture(f.id, { rot: f.rot + (e.shiftKey ? -1 : 1) * Math.PI / 2 });
      }
      if (e.key === 'Escape') st.set({ selection: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ready) return <Boot error={error} />;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[400px] shrink-0 flex-col border-r border-slate-800 bg-slate-950">
          <nav className="flex border-b border-slate-800">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => set({ tab: t.id })}
                className={cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold uppercase tracking-wider transition',
                  tab === t.id ? 'border-b-2 border-sky-500 bg-slate-900 text-sky-300' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-300')}>
                <t.icon size={15} />{t.label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === 'org' && <OrgPanel />}
            {tab === 'bots' && <BotsPanel />}
            {tab === 'projects' && <ProjectsPanel />}
            {tab === 'layout' && <LayoutPanel />}
            {tab === 'data' && <DataPanel />}
          </div>
        </aside>
        <main className="relative min-w-0 flex-1">
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-slate-500">Loading 3D office…</div>}>
            <Scene />
          </Suspense>
          <div className="pointer-events-none absolute inset-0">
            <BotInspector />
            <PerfHud />
            <ActivityFeed />
            {editMode && (
              <div className="pointer-events-auto absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-sky-500/50 bg-sky-950/90 px-4 py-1.5 text-[11px] text-sky-200 shadow-lg">
                ✏️ Layout edit mode: drag rooms and props · <b>R</b> rotate · <b>Del</b> delete · <b>Ctrl+S</b> save to SQLite
              </div>
            )}
            <div className="absolute bottom-3 left-3 rounded-lg bg-slate-950/70 px-2 py-1 text-[10px] text-slate-400">
              🖱️ Drag to orbit · right-drag to pan · scroll to zoom · click a bot to inspect
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
