import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import type { Bot, Division } from '../types';
import { Badge, Btn, ColorInput, Field, Input, Section, Select } from './kit';

function OrgNode({ bot, depth }: { bot: Bot; depth: number }) {
  const bots = useStore((s) => s.bots);
  const levels = useStore((s) => s.levels);
  const divisions = useStore((s) => s.divisions);
  const selected = useStore((s) => s.selectedBotId === bot.id);
  const [open, setOpen] = useState(depth < 2);
  const reports = bots.filter((b) => b.manager_id === bot.id && b.id !== bot.id);
  const lv = levels.find((l) => l.id === bot.level_id);
  const dv = divisions.find((d) => d.id === bot.division_id);
  return (
    <div>
      <div className={`group flex items-center gap-1.5 rounded-md px-1 py-1 text-[12px] hover:bg-slate-800 ${selected ? 'bg-sky-500/15' : ''}`} style={{ paddingLeft: depth * 14 + 4 }}>
        <button onClick={() => setOpen(!open)} className={`text-slate-500 transition ${reports.length ? '' : 'invisible'} ${open ? 'rotate-90' : ''}`}><ChevronRight size={12} /></button>
        <span className="h-5 w-1 rounded" style={{ background: dv?.color }} />
        <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => useStore.getState().set({ selectedBotId: bot.id })}>
          <span className="font-semibold text-slate-100">{bot.name}</span>
          <span className="truncate text-slate-500">{bot.title}</span>
        </button>
        <Badge color={lv?.color}>{lv?.name}</Badge>
      </div>
      {open && reports.map((r) => <OrgNode key={r.id} bot={r} depth={depth + 1} />)}
    </div>
  );
}

function DivisionNode({ d, depth, onEdit }: { d: Division; depth: number; onEdit: (d: Division) => void }) {
  const divisions = useStore((s) => s.divisions);
  const bots = useStore((s) => s.bots);
  const children = divisions.filter((x) => x.parent_id === d.id);
  const head = bots.find((b) => b.id === d.head_bot_id);
  const members = bots.filter((b) => b.division_id === d.id).length;
  return (
    <div>
      <button onClick={() => onEdit(d)} className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-[12px] hover:bg-slate-800" style={{ paddingLeft: depth * 14 + 4 }}>
        <span className="h-3 w-3 rounded-sm" style={{ background: d.color }} />
        <span className="font-semibold text-slate-100">{d.name}</span>
        <span className="text-slate-500">· {members} bots</span>
        {head && <span className="ml-auto text-[10px] text-slate-400">Head: {head.name}</span>}
      </button>
      {children.map((c) => <DivisionNode key={c.id} d={c} depth={depth + 1} onEdit={onEdit} />)}
    </div>
  );
}

export default function OrgPanel() {
  const { levels, divisions, bots, saveLevel, deleteLevel, saveDivision, deleteDivision } = useStore();
  const [edit, setEdit] = useState<Partial<Division> | null>(null);
  const roots = bots.filter((b) => b.manager_id == null || !bots.some((x) => x.id === b.manager_id));
  const rootDivs = divisions.filter((d) => d.parent_id == null || !divisions.some((x) => x.id === d.parent_id));

  const move = (i: number, dir: -1 | 1) => {
    const a = levels[i], b = levels[i + dir];
    if (!a || !b) return;
    saveLevel({ ...a, rank: b.rank });
    saveLevel({ ...b, rank: a.rank });
  };

  return (
    <div className="space-y-3">
      <Section title="Management hierarchy levels" right={
        <Btn onClick={() => saveLevel({ name: 'New Level', rank: (levels.at(-1)?.rank ?? 0) + 1, can_create_projects: 0, color: '#94a3b8' })}><Plus size={12} /> Level</Btn>
      }>
        <p className="mb-2 text-[11px] text-slate-500">Rank 0 is the top. Levels flagged <b>PM</b> can create projects and act as project owners.</p>
        <div className="space-y-1">
          {levels.map((l, i) => (
            <div key={l.id} className="flex items-center gap-1.5">
              <span className="w-5 text-center font-mono text-[10px] text-slate-500">{l.rank}</span>
              <input type="color" value={l.color} onChange={(e) => saveLevel({ ...l, color: e.target.value })} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent" />
              <Input value={l.name} onChange={(e) => saveLevel({ ...l, name: e.target.value })} className="py-1 text-xs" />
              <button title="Can create projects" onClick={() => saveLevel({ ...l, can_create_projects: l.can_create_projects ? 0 : 1 })}
                className={`rounded px-1.5 py-1 text-[10px] font-bold ${l.can_create_projects ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}>PM</button>
              <button onClick={() => move(i, -1)} className="text-slate-500 hover:text-white"><ArrowUp size={12} /></button>
              <button onClick={() => move(i, 1)} className="text-slate-500 hover:text-white"><ArrowDown size={12} /></button>
              <button disabled={bots.some((b) => b.level_id === l.id)} title={bots.some((b) => b.level_id === l.id) ? 'In use by bots' : 'Delete'} onClick={() => deleteLevel(l.id)} className="text-slate-500 hover:text-rose-400 disabled:opacity-30"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Business divisions" right={<Btn onClick={() => setEdit({ name: 'New Division', color: '#64748b', parent_id: null, head_bot_id: null, description: '' })}><Plus size={12} /> Division</Btn>}>
        {rootDivs.map((d) => <DivisionNode key={d.id} d={d} depth={0} onEdit={(x) => setEdit(x)} />)}
        {edit && (
          <div className="mt-3 space-y-2 rounded-lg border border-slate-700 bg-slate-950 p-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name"><Input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Color"><ColorInput value={edit.color ?? '#64748b'} onChange={(v) => setEdit({ ...edit, color: v })} /></Field>
              <Field label="Parent division">
                <Select value={edit.parent_id ?? ''} onChange={(e) => setEdit({ ...edit, parent_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">— none (top-level) —</option>
                  {divisions.filter((d) => d.id !== edit.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="Division head">
                <Select value={edit.head_bot_id ?? ''} onChange={(e) => setEdit({ ...edit, head_bot_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">— none —</option>
                  {bots.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.title}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Mandate"><Input value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <div className="flex gap-2">
              <Btn variant="primary" onClick={() => { saveDivision(edit); setEdit(null); }}>Save to SQLite</Btn>
              <Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
              {edit.id && <Btn variant="danger" className="ml-auto" disabled={bots.some((b) => b.division_id === edit.id)} title="Divisions with members cannot be deleted" onClick={() => { deleteDivision(edit.id!); setEdit(null); }}><Trash2 size={12} /></Btn>}
            </div>
          </div>
        )}
      </Section>

      <Section title="Org chart (reporting lines)">
        <div className="max-h-[420px] overflow-y-auto">
          {roots.map((b) => <OrgNode key={b.id} bot={b} depth={0} />)}
        </div>
      </Section>
    </div>
  );
}
