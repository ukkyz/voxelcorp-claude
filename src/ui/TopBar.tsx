import { useEffect } from 'react';
import { Pause, Play, Pencil, Save, MessageSquare, Gauge, Sparkles, Database, Building2 } from 'lucide-react';
import { useStore } from '../store';
import { Btn } from './kit';
import { cn } from '../utils/cn';

export default function TopBar() {
  const s = useStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (useStore.getState().layoutDirty) useStore.getState().saveLayout();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const activeProjects = s.projects.filter((p) => p.status === 'active').length;
  const doneTasks = s.tasks.filter((t) => t.status === 'done').length;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950 px-4">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 shadow-lg shadow-sky-900/40">
          <Building2 size={18} className="text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">VoxelCorp <span className="text-sky-400">Office Sim</span></div>
          <div className="text-[10px] text-slate-500">Enterprise AI-agent workplace · SQLite-backed</div>
        </div>
      </div>

      <div className="ml-4 hidden items-center gap-3 text-[11px] text-slate-400 lg:flex">
        <span><b className="text-slate-200">{s.bots.length}</b> bots</span>
        <span><b className="text-slate-200">{s.divisions.length}</b> divisions</span>
        <span><b className="text-slate-200">{activeProjects}</b> active projects</span>
        <span><b className="text-emerald-400">{doneTasks}</b>/{s.tasks.length} tasks done</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          <Btn variant={s.simRunning ? 'ghost' : 'success'} onClick={() => s.set({ simRunning: !s.simRunning })} title="Play / pause simulation">
            {s.simRunning ? <Pause size={14} /> : <Play size={14} />}
            {s.simRunning ? 'Pause' : 'Play'}
          </Btn>
          {[0.5, 1, 2, 4].map((sp) => (
            <button key={sp} onClick={() => s.set({ simSpeed: sp })}
              className={cn('rounded px-2 py-1 text-[11px] font-bold', s.simSpeed === sp ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800')}>{sp}×</button>
          ))}
        </div>

        <Btn variant={s.editMode ? 'primary' : 'default'} onClick={() => s.set({ editMode: !s.editMode, tab: !s.editMode ? 'layout' : s.tab, selection: null })} title="Toggle layout edit mode (simulation pauses)">
          <Pencil size={14} /> {s.editMode ? 'Editing Layout' : 'Edit Layout'}
        </Btn>
        {s.layoutDirty && (
          <Btn variant="success" onClick={() => s.saveLayout()} title="Save layout to SQLite (Ctrl+S)">
            <Save size={14} /> Save Layout
          </Btn>
        )}

        <div className="flex items-center gap-1">
          <Btn variant={s.showBubbles ? 'default' : 'ghost'} onClick={() => s.set({ showBubbles: !s.showBubbles })} title="Toggle speech bubbles"><MessageSquare size={14} /></Btn>
          <Btn variant={s.showPerf ? 'default' : 'ghost'} onClick={() => s.set({ showPerf: !s.showPerf })} title="Toggle GPU budget HUD"><Gauge size={14} /></Btn>
          <Btn variant={s.quality === 'high' ? 'default' : 'ghost'} onClick={() => s.set({ quality: s.quality === 'high' ? 'low' : 'high' })} title="Render quality: High = shadows + glass; Low = mobile-safe (no shadow pass, no transparent overdraw, DPR 1)">
            <Sparkles size={14} /> {s.quality === 'high' ? 'High' : 'Low'}
          </Btn>
        </div>

        <div className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-[11px]', s.saveStatus === 'saving' ? 'text-amber-400' : 'text-emerald-400')} title="SQLite persisted to IndexedDB">
          <Database size={12} /> {s.saveStatus === 'saving' ? 'Saving…' : 'Saved'}
        </div>
      </div>
    </header>
  );
}
