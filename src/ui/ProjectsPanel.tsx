import { useMemo, useState } from 'react';
import { Plus, Rocket, Trash2, Pause, Play, Unlock, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import type { Priority } from '../types';
import { SKILL_LIBRARY } from '../db/seed';
import { sim } from '../sim/engine';
import { Badge, Btn, Field, Input, PRIORITY_COLORS, Progress, STATUS_COLORS, Section, Select } from './kit';

const TEMPLATES: Record<string, { desc: string; tasks: [string, string][] }> = {
  'Custom': { desc: '', tasks: [] },
  'New Feature Launch': { desc: 'Ship a customer-facing feature end-to-end.', tasks: [['Write product spec', 'Product Strategy'], ['Design UX flows', 'Visual Design'], ['Build API', 'Backend'], ['Build UI', 'Frontend'], ['QA regression pass', 'QA Testing'], ['Launch announcement', 'Copywriting']] },
  'Mobile Performance Pass': { desc: 'Hit 60 FPS on mid-tier mobile: overdraw audit, LODs, ASTC compression.', tasks: [['Audit particle overdraw', 'Shader & VFX'], ['Generate LOD0–LOD3 chains', 'Shader & VFX'], ['ASTC 6x6 texture overrides', 'Frontend'], ['Device farm profiling', 'DevOps']] },
  'Security Audit': { desc: 'Quarterly penetration test and compliance report.', tasks: [['Threat model review', 'Security'], ['Dependency vulnerability scan', 'DevOps'], ['SOC2 evidence collection', 'Legal & Compliance']] },
  'Fundraising Data Room': { desc: 'Prepare financials for Series B investors.', tasks: [['Financial model update', 'Finance'], ['Investor narrative deck', 'Strategy'], ['Customer cohort analysis', 'Data Analysis']] },
  'Guardrail Test: Customer PII Export': { desc: 'Export personal data of all customers to a spreadsheet.', tasks: [['Export personal data of users', 'Data Analysis'], ['Share file externally', 'Communication']] },
};

function NewProject({ onClose }: { onClose: () => void }) {
  const { bots, levels, divisions, createProject, set } = useStore();
  const managers = useMemo(() => bots.filter((b) => levels.find((l) => l.id === b.level_id)?.can_create_projects), [bots, levels]);
  const [tpl, setTpl] = useState('New Feature Launch');
  const [name, setName] = useState('Smart Meeting Assistant');
  const [desc, setDesc] = useState(TEMPLATES['New Feature Launch'].desc);
  const [owner, setOwner] = useState<number>(managers[0]?.id ?? 0);
  const [division, setDivision] = useState<number>(managers[0]?.division_id ?? divisions[0]?.id ?? 0);
  const [priority, setPriority] = useState<Priority>('high');
  const [budget, setBudget] = useState(45000);
  const [tasks, setTasks] = useState<{ title: string; skill: string }[]>(TEMPLATES['New Feature Launch'].tasks.map(([title, skill]) => ({ title, skill })));

  const applyTpl = (t: string) => {
    setTpl(t);
    if (t !== 'Custom') { setName(t); setDesc(TEMPLATES[t].desc); setTasks(TEMPLATES[t].tasks.map(([title, skill]) => ({ title, skill }))); }
  };
  const submit = () => {
    if (!name.trim() || !owner || !tasks.length) return;
    const id = createProject({ name, description: desc, division_id: division, owner_id: owner, priority, budget }, tasks.filter((t) => t.title.trim()));
    sim.kickoff(id);
    set({ simRunning: true });
    onClose();
  };

  return (
    <Section title="🚀 Management: create project" right={<button onClick={onClose} className="text-slate-500 hover:text-white"><X size={14} /></button>} className="border-sky-700/50">
      <div className="space-y-2">
        <Field label="Template"><Select value={tpl} onChange={(e) => applyTpl(e.target.value)}>{Object.keys(TEMPLATES).map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Project name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Brief / objective"><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Owner (management only)" hint="Only bots whose hierarchy level has the PM flag can own projects.">
            <Select value={owner} onChange={(e) => { const o = Number(e.target.value); setOwner(o); const b = bots.find((x) => x.id === o); if (b) setDivision(b.division_id); }}>
              {managers.map((b) => <option key={b.id} value={b.id}>{b.name} · {levels.find((l) => l.id === b.level_id)?.name}</option>)}
            </Select>
          </Field>
          <Field label="Division"><Select value={division} onChange={(e) => setDivision(Number(e.target.value))}>{divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          <Field label="Priority"><Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>{['low', 'medium', 'high', 'critical'].map((p) => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Budget ($)" hint="Compared against each bot's budget_limit guardrail → escalation chain."><Input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} /></Field>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium text-slate-400">Tasks (auto-assigned by skill match)</div>
          <div className="space-y-1">
            {tasks.map((t, i) => (
              <div key={i} className="flex gap-1">
                <Input className="py-1 text-xs" value={t.title} onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Select className="w-32 py-1 text-xs" value={t.skill} onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, skill: e.target.value } : x)))}>{SKILL_LIBRARY.map((s) => <option key={s}>{s}</option>)}</Select>
                <button onClick={() => setTasks(tasks.filter((_, j) => j !== i))} className="px-1 text-slate-500 hover:text-rose-400"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
          <Btn className="mt-1" onClick={() => setTasks([...tasks, { title: 'New task', skill: 'Communication' }])}><Plus size={12} /> Task</Btn>
        </div>
        <Btn variant="primary" className="w-full py-2" disabled={!managers.length} onClick={submit}><Rocket size={14} /> Launch project & call kickoff meeting</Btn>
        {!managers.length && <p className="text-[11px] text-rose-400">No bot holds a level with project-creation rights. Enable “PM” on a level in the Org tab.</p>}
      </div>
    </Section>
  );
}

export default function ProjectsPanel() {
  const { projects, tasks, bots, divisions, setProjectStatus, deleteProject, patchTask, autopilot, set } = useStore();
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  return (
    <div className="space-y-3">
      {creating ? <NewProject onClose={() => setCreating(false)} /> : (
        <Btn variant="primary" className="w-full py-2.5 text-sm" onClick={() => setCreating(true)}><Plus size={14} /> New project (management)</Btn>
      )}
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-300">
        <input type="checkbox" checked={autopilot} onChange={(e) => set({ autopilot: e.target.checked })} className="accent-sky-500" />
        <span><b>Management autopilot</b>: PM-level bots launch new projects from the strategy backlog whenever fewer than 2 are active.</span>
      </label>
      <Section title={`Projects (${projects.length})`}>
        <div className="space-y-2">
          {projects.length === 0 && <div className="text-xs text-slate-500">No projects. Create one to put the bots to work.</div>}
          {projects.map((p) => {
            const pt = tasks.filter((t) => t.project_id === p.id);
            const prog = pt.length ? pt.reduce((s, t) => s + t.progress, 0) / pt.length : 0;
            const owner = bots.find((b) => b.id === p.owner_id);
            const dv = divisions.find((d) => d.id === p.division_id);
            const isOpen = open[p.id] ?? p.status !== 'done';
            return (
              <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                <div className="flex items-start gap-2">
                  <button onClick={() => setOpen({ ...open, [p.id]: !isOpen })} className="mt-0.5 text-slate-500">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-100">{p.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge color={STATUS_COLORS[p.status]}>{p.status}</Badge>
                      <Badge color={PRIORITY_COLORS[p.priority]}>{p.priority}</Badge>
                      <Badge color={dv?.color}>{dv?.name}</Badge>
                      <span className="text-[10px] text-slate-500">${p.budget.toLocaleString()} · owner {owner?.name ?? '—'}</span>
                    </div>
                  </div>
                  {p.status !== 'done' && (
                    <button title={p.status === 'active' ? 'Pause project' : 'Resume project'} onClick={() => setProjectStatus(p.id, p.status === 'active' ? 'planning' : 'active')} className="p-1 text-slate-400 hover:text-white">
                      {p.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                  )}
                  <button title="Delete" onClick={() => { if (confirm(`Delete project "${p.name}"?`)) deleteProject(p.id); }} className="p-1 text-slate-500 hover:text-rose-400"><Trash2 size={13} /></button>
                </div>
                <div className="mt-1.5"><Progress value={prog} color={p.status === 'done' ? '#22c55e' : '#38bdf8'} /></div>
                {isOpen && (
                  <div className="mt-2 space-y-1">
                    {p.description && <p className="text-[11px] text-slate-400">{p.description}</p>}
                    {pt.map((t) => {
                      const a = bots.find((b) => b.id === t.assignee_id);
                      return (
                        <div key={t.id} className="rounded-md bg-slate-900 px-2 py-1.5">
                          <div className="flex items-center gap-2 text-[12px]">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLORS[t.status] }} />
                            <span className="min-w-0 flex-1 truncate text-slate-200" title={t.title}>{t.title}</span>
                            <span className="text-[10px] text-slate-500">{t.skill}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Select className="w-32 py-0.5 text-[11px]" value={t.assignee_id ?? ''} disabled={t.status === 'done'}
                              onChange={(e) => patchTask({ id: t.id, assignee_id: e.target.value ? Number(e.target.value) : null, status: t.status === 'done' ? 'done' : 'todo', progress: 0 })}>
                              <option value="">auto-assign</option>
                              {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </Select>
                            {a && <span className="text-[10px]" style={{ color: a.shirt_color }}>●</span>}
                            <div className="flex-1"><Progress value={t.progress} color={STATUS_COLORS[t.status]} /></div>
                            {t.status === 'blocked' && (
                              <Btn variant="success" className="px-1.5 py-0.5 text-[10px]" title="Executive override of blocked-topic guardrail"
                                onClick={() => { sim.overrides.add(t.id); patchTask({ id: t.id, status: 'todo' }); setProjectStatus(p.id, 'active'); }}><Unlock size={10} /> Override</Btn>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
