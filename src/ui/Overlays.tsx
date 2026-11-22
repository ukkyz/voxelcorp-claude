import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Crosshair, X } from 'lucide-react';
import { useSimUi, useStore } from '../store';
import { usePerf } from '../three/Scene';
import { ACTION_META, Badge, Progress, STATUS_COLORS } from './kit';
import { cn } from '../utils/cn';

const BUDGET = { calls: 350, tris: 150_000, fps: 60 };

export function PerfHud() {
  const p = usePerf();
  const show = useStore((s) => s.showPerf);
  const quality = useStore((s) => s.quality);
  if (!show) return null;
  const row = (label: string, v: number, budget: number, fmt = (n: number) => n.toLocaleString(), invert = false) => {
    const r = v / budget;
    const bad = invert ? v < budget * 0.75 : r > 1;
    const warn = invert ? v < budget * 0.95 : r > 0.8;
    const color = bad ? '#ef4444' : warn ? '#f59e0b' : '#22c55e';
    return (
      <div>
        <div className="flex justify-between text-[10px]"><span className="text-slate-400">{label}</span><span style={{ color }} className="font-mono">{fmt(v)} / {fmt(budget)}</span></div>
        <div className="h-1 overflow-hidden rounded bg-slate-800"><div className="h-full" style={{ width: `${Math.min(100, r * 100)}%`, background: color }} /></div>
      </div>
    );
  };
  return (
    <div className="pointer-events-auto absolute right-3 top-3 w-56 space-y-1.5 rounded-xl border border-slate-700/70 bg-slate-950/85 p-2.5 text-slate-200 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span>GPU Budget</span><Badge color={quality === 'high' ? '#38bdf8' : '#22c55e'}>{quality === 'high' ? 'PC/Console' : 'Mobile-safe'}</Badge>
      </div>
      {row('FPS', p.fps, BUDGET.fps, (n) => String(n), true)}
      {row('Draw calls', p.calls, BUDGET.calls)}
      {row('Triangles', p.tris, BUDGET.tris)}
      <div className="flex justify-between pt-0.5 font-mono text-[10px] text-slate-500">
        <span>geo {p.geos}</span><span>tex {p.tex}</span><span>sim {p.ms.toFixed(2)}ms</span>
      </div>
    </div>
  );
}

export function ActivityFeed() {
  const logs = useStore((s) => s.logs);
  const bots = useStore((s) => s.bots);
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const ref = useRef<HTMLDivElement>(null);
  const shown = logs.filter((l) => filter === 'all' || l.kind === filter).slice(-80);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [shown.length, open]);
  const kindColor: Record<string, string> = { thought: '#a78bfa', talk: '#2dd4bf', guard: '#f59e0b', project: '#38bdf8', done: '#22c55e', system: '#94a3b8', info: '#cbd5e1' };
  return (
    <div className="pointer-events-auto absolute bottom-3 right-3 w-[420px] max-w-[calc(100%-1.5rem)] rounded-xl border border-slate-700/70 bg-slate-950/90 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Activity & Reasoning Feed</span>
        <div className="ml-auto flex gap-1">
          {['all', 'thought', 'guard', 'project', 'done'].map((k) => (
            <button key={k} onClick={() => setFilter(k)} className={cn('rounded px-1.5 py-0.5 text-[10px] capitalize', filter === k ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300')}>{k}</button>
          ))}
        </div>
        <button onClick={() => setOpen(!open)} className="text-slate-400 hover:text-white">{open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button>
      </div>
      {open && (
        <div ref={ref} className="h-52 space-y-1 overflow-y-auto px-3 py-2 text-[11.5px] leading-snug">
          {shown.length === 0 && <div className="text-slate-500">No activity yet…</div>}
          {shown.map((l) => {
            const b = bots.find((x) => x.id === l.bot_id);
            return (
              <div key={l.id} className="flex gap-2">
                <span className="shrink-0 font-mono text-[10px] text-slate-600">{new Date(l.ts).toLocaleTimeString([], { hour12: false })}</span>
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: kindColor[l.kind] }} />
                <span className="text-slate-300">
                  {b && <button className="mr-1 font-semibold hover:underline" style={{ color: b.shirt_color }} onClick={() => useStore.getState().set({ selectedBotId: b.id })}>{b.name}</button>}
                  {l.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BotInspector() {
  const id = useStore((s) => s.selectedBotId);
  const bot = useStore((s) => s.bots.find((b) => b.id === id));
  const level = useStore((s) => s.levels.find((l) => l.id === bot?.level_id));
  const division = useStore((s) => s.divisions.find((d) => d.id === bot?.division_id));
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const follow = useStore((s) => s.followBot);
  const st = useSimUi((s) => (id != null ? s.status[id] : undefined));
  if (!bot) return null;
  const task = tasks.find((t) => t.id === st?.taskId);
  const project = projects.find((p) => p.id === task?.project_id);
  return (
    <div className="pointer-events-auto absolute left-3 top-3 w-80 rounded-xl border border-slate-700/70 bg-slate-950/90 p-3 text-slate-200 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-lg text-lg font-black text-white" style={{ background: bot.shirt_color }}>{bot.name[0]}</div>
        <div className="min-w-0 flex-1">
          <div className="font-bold">{bot.name}</div>
          <div className="truncate text-[11px] text-slate-400">{bot.title}</div>
          <div className="mt-1 flex flex-wrap gap-1"><Badge color={level?.color}>{level?.name}</Badge><Badge color={division?.color}>{division?.name}</Badge></div>
        </div>
        <button title="Follow camera" onClick={() => useStore.getState().set({ followBot: !follow })} className={cn('rounded p-1', follow ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800')}><Crosshair size={14} /></button>
        <button onClick={() => useStore.getState().set({ selectedBotId: null, followBot: false })} className="rounded p-1 text-slate-400 hover:bg-slate-800"><X size={14} /></button>
      </div>
      <div className="mt-2 rounded-lg bg-slate-900 p-2 text-[12px]">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500">
          <span>State</span>
          <span className="font-semibold text-sky-400">{st?.state === 'working' ? '🧍 standing (selected)' : (st?.state ?? '—')} · load {st?.load ?? 0}</span>
        </div>
        <div className="mt-1 text-slate-200">{st?.icon} {st?.bubble || '…'}</div>
        {st?.state === 'working' && (
          <div className="mt-1.5 flex items-center justify-between border-t border-slate-800 pt-1.5 text-[11px] text-amber-300">
            <span>Stood up from workstation</span>
            <button onClick={() => useStore.getState().set({ selectedBotId: null, followBot: false })} className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-700">
              🪑 Sit & resume typing
            </button>
          </div>
        )}
      </div>
      {task ? (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Current task · {project?.name}</div>
          <div className="mb-1 flex items-center justify-between gap-2 text-[12px] font-semibold"><span className="truncate">{task.title}</span><Badge color={STATUS_COLORS[task.status]}>{task.status}</Badge></div>
          <Progress value={task.progress} />
        </div>
      ) : <div className="mt-2 text-[11px] text-slate-500">No assigned task — idle behaviours active.</div>}
      {st && st.steps.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Chain of thought</div>
          <ol className="space-y-0.5">
            {st.steps.map((s, i) => {
              const m = ACTION_META[s.action] ?? ACTION_META.think;
              const state = i < st.stepIndex ? 'done' : i === st.stepIndex ? 'now' : 'todo';
              return (
                <li key={i} className={cn('flex items-center gap-2 rounded px-1.5 py-0.5 text-[11.5px]', state === 'now' && 'bg-sky-500/15 ring-1 ring-sky-500/40', state === 'done' && 'text-slate-500 line-through', state === 'todo' && 'text-slate-300')}>
                  <span>{state === 'done' ? '✓' : m.icon}</span>
                  <span className="truncate">{s.label}</span>
                  {s.injected && <span className="ml-auto text-[9px] font-bold text-amber-400">GUARD</span>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
