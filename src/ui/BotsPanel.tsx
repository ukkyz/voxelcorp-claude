import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2, UserPlus, Crosshair, ShieldCheck, Brain, Wrench } from 'lucide-react';
import { useSimUi, useStore } from '../store';
import type { Bot, Guardrail, StepAction } from '../types';
import { GUARDRAIL_DEFAULTS, SKILL_LIBRARY, WORKFLOW_TEMPLATES, guard, sid, workflowFrom } from '../db/seed';
import { ACTION_META, Badge, Btn, ColorInput, Field, Input, Section, Select } from './kit';
import { cn } from '../utils/cn';

const ACTIONS: StepAction[] = ['think', 'research', 'consult_manager', 'consult_peer', 'meeting', 'execute', 'review', 'report'];

function BotEditor({ bot }: { bot: Bot }) {
  const { levels, divisions, bots, saveBot, deleteBot, set } = useStore();
  const [d, setD] = useState<Bot>(bot);
  const [dirty, setDirty] = useState(false);
  const status = useSimUi((s) => s.status[bot.id]);
  useEffect(() => { setD(bot); setDirty(false); }, [bot]);
  const up = (p: Partial<Bot>) => { setD({ ...d, ...p }); setDirty(true); };

  // prevent reporting cycles
  const descendants = new Set<number>();
  const walk = (id: number) => bots.filter((b) => b.manager_id === id).forEach((b) => { if (!descendants.has(b.id)) { descendants.add(b.id); walk(b.id); } });
  walk(bot.id);

  const unusedGuards = (Object.keys(GUARDRAIL_DEFAULTS) as Guardrail['type'][]).filter((t) => !d.guardrails.some((g) => g.type === t));
  const moveStep = (i: number, dir: -1 | 1) => {
    const w = [...d.workflow];
    const j = i + dir;
    if (j < 0 || j >= w.length) return;
    [w[i], w[j]] = [w[j], w[i]];
    up({ workflow: w });
  };

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/95 px-2 py-2 backdrop-blur">
        <div className="grid h-8 w-8 place-items-center rounded-md font-black text-white" style={{ background: d.shirt_color }}>{d.name[0]}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-white">{d.name}</div>
          <div className="truncate text-[10px] text-slate-400">{status ? `${status.icon} ${status.state}` : ''}</div>
        </div>
        <Btn variant="ghost" title="Follow in 3D" onClick={() => set({ followBot: true, selectedBotId: bot.id })}><Crosshair size={14} /></Btn>
        <Btn variant="primary" disabled={!dirty} onClick={() => { saveBot({ ...d, desk_id: bot.desk_id }); setDirty(false); }}><Save size={12} /> Save</Btn>
        <Btn variant="danger" onClick={() => { if (confirm(`Delete ${d.name}? Reports will move up the hierarchy.`)) deleteBot(bot.id); }}><Trash2 size={12} /></Btn>
      </div>

      <Section title={<span className="flex items-center gap-1"><Wrench size={12} /> Identity & placement</span>}>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Name"><Input value={d.name} onChange={(e) => up({ name: e.target.value })} /></Field>
          <Field label="Title"><Input value={d.title} onChange={(e) => up({ title: e.target.value })} /></Field>
          <Field label="Management level">
            <Select value={d.level_id} onChange={(e) => up({ level_id: Number(e.target.value) })}>
              {levels.map((l) => <option key={l.id} value={l.id}>{l.rank} · {l.name}</option>)}
            </Select>
          </Field>
          <Field label="Division">
            <Select value={d.division_id} onChange={(e) => up({ division_id: Number(e.target.value) })}>
              {divisions.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </Field>
          <Field label="Reports to" hint="Used for approvals, escalations and consult_manager steps.">
            <Select value={d.manager_id ?? ''} onChange={(e) => up({ manager_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">— nobody (top) —</option>
              {bots.filter((b) => b.id !== bot.id && !descendants.has(b.id)).map((b) => <option key={b.id} value={b.id}>{b.name} · {b.title}</option>)}
            </Select>
          </Field>
          <Field label="Persona / system prompt"><Input value={d.persona} onChange={(e) => up({ persona: e.target.value })} /></Field>
          <Field label="Body" hint="Male is the reference body. Female uses the same rig and animations.">
            <Select value={d.body} onChange={(e) => up({ body: e.target.value as Bot['body'] })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </Field>
          <Field label="Shirt (division)"><ColorInput value={d.shirt_color} onChange={(v) => up({ shirt_color: v })} /></Field>
          <Field label="Hair"><ColorInput value={d.hair_color} onChange={(v) => up({ hair_color: v })} /></Field>
          <Field label="Tie / accent"><ColorInput value={d.accent_color} onChange={(v) => up({ accent_color: v })} /></Field>
          <div className="flex items-end"><Btn onClick={() => up({ shirt_color: divisions.find((x) => x.id === d.division_id)?.color ?? d.shirt_color })}>Use division color</Btn></div>
        </div>
      </Section>

      <Section title={<span className="flex items-center gap-1"><Brain size={12} /> AI skills</span>} right={
        <Select className="w-36 py-1 text-xs" value="" onChange={(e) => { if (e.target.value) up({ skills: [...d.skills, { name: e.target.value, level: 3 }] }); }}>
          <option value="">+ Add skill…</option>
          {SKILL_LIBRARY.filter((s) => !d.skills.some((x) => x.name === s)).map((s) => <option key={s}>{s}</option>)}
        </Select>
      }>
        <p className="mb-2 text-[11px] text-slate-500">The dispatcher matches project tasks to bots by skill level, division and current load.</p>
        <div className="space-y-1.5">
          {d.skills.map((s, i) => (
            <div key={s.name} className="flex items-center gap-2 text-xs">
              <span className="w-32 truncate text-slate-200">{s.name}</span>
              <input type="range" min={1} max={5} value={s.level} onChange={(e) => up({ skills: d.skills.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)) })} className="flex-1 accent-sky-500" />
              <span className="w-8 font-mono text-sky-400">L{s.level}</span>
              <button onClick={() => up({ skills: d.skills.filter((_, j) => j !== i) })} className="text-slate-500 hover:text-rose-400"><Trash2 size={12} /></button>
            </div>
          ))}
          {!d.skills.length && <div className="text-xs text-slate-500">No skills — this bot will only receive skill-gap work.</div>}
        </div>
      </Section>

      <Section title={<span className="flex items-center gap-1"><ShieldCheck size={12} /> Guardrails</span>} right={
        unusedGuards.length > 0 && (
          <Select className="w-36 py-1 text-xs" value="" onChange={(e) => { if (e.target.value) up({ guardrails: [...d.guardrails, guard(e.target.value as Guardrail['type'])] }); }}>
            <option value="">+ Add guardrail…</option>
            {unusedGuards.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        )
      }>
        <div className="space-y-2">
          {d.guardrails.map((g, i) => {
            const meta = GUARDRAIL_DEFAULTS[g.type];
            const setG = (p: Partial<Guardrail>) => up({ guardrails: d.guardrails.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <div key={g.id} className={cn('rounded-lg border p-2', g.enabled ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 opacity-60')}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={g.enabled} onChange={(e) => setG({ enabled: e.target.checked })} className="accent-amber-500" />
                  <span className="text-xs font-semibold text-slate-200" title={meta.help}>{meta.label} <span className="cursor-help text-slate-500">ⓘ</span></span>
                  <button onClick={() => up({ guardrails: d.guardrails.filter((_, j) => j !== i) })} className="ml-auto text-slate-500 hover:text-rose-400"><Trash2 size={12} /></button>
                </div>
                <div className="mt-1.5">
                  {g.type === 'approval_priority' ? (
                    <Select value={g.value} onChange={(e) => setG({ value: e.target.value })}>{['low', 'medium', 'high', 'critical'].map((p) => <option key={p}>{p}</option>)}</Select>
                  ) : g.type === 'division_scope' ? (
                    <Select value={g.value} onChange={(e) => setG({ value: e.target.value })}><option>strict</option><option>open</option></Select>
                  ) : g.type === 'peer_review' ? (
                    <Select value={g.value} onChange={(e) => setG({ value: e.target.value })}><option>on</option></Select>
                  ) : (
                    <Input type={g.type === 'budget_limit' || g.type === 'max_concurrent' ? 'number' : 'text'} value={g.value} onChange={(e) => setG({ value: e.target.value })} />
                  )}
                </div>
                <p className="mt-1 text-[10px] leading-snug text-slate-500">{meta.help}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title={<span className="flex items-center gap-1">🧠 Workflow · chain of thought</span>} right={
        <Select className="w-32 py-1 text-xs" value="" onChange={(e) => { if (e.target.value) up({ workflow: workflowFrom(e.target.value as 'Specialist') }); }}>
          <option value="">Apply template…</option>
          {Object.keys(WORKFLOW_TEMPLATES).map((t) => <option key={t}>{t}</option>)}
        </Select>
      }>
        <p className="mb-2 text-[11px] text-slate-500">Executed in order for every task. Guardrails may inject approval / peer-review steps at runtime.</p>
        <ol className="space-y-1.5">
          {d.workflow.map((s, i) => {
            const m = ACTION_META[s.action];
            const live = status?.steps.length && status.stepIndex >= 0 ? status.steps[status.stepIndex]?.label === s.label : false;
            return (
              <li key={s.id} className={cn('rounded-lg border bg-slate-950 p-1.5', live ? 'border-sky-500' : 'border-slate-800')}>
                <div className="flex items-center gap-1.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-bold text-slate-900" style={{ background: m.color }}>{i + 1}</span>
                  <Select className="w-36 py-1 text-xs" value={s.action} onChange={(e) => up({ workflow: d.workflow.map((x, j) => (j === i ? { ...x, action: e.target.value as StepAction } : x)) })}>
                    {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_META[a].icon} {ACTION_META[a].label}</option>)}
                  </Select>
                  <Input type="number" min={1} max={30} className="w-14 py-1 text-xs" title="Duration (sim seconds)" value={s.duration} onChange={(e) => up({ workflow: d.workflow.map((x, j) => (j === i ? { ...x, duration: Math.max(1, Number(e.target.value)) } : x)) })} />
                  <div className="ml-auto flex">
                    <button onClick={() => moveStep(i, -1)} className="p-0.5 text-slate-500 hover:text-white"><ArrowUp size={12} /></button>
                    <button onClick={() => moveStep(i, 1)} className="p-0.5 text-slate-500 hover:text-white"><ArrowDown size={12} /></button>
                    <button onClick={() => up({ workflow: d.workflow.filter((_, j) => j !== i) })} className="p-0.5 text-slate-500 hover:text-rose-400"><Trash2 size={12} /></button>
                  </div>
                </div>
                <Input className="mt-1 py-1 text-xs" value={s.label} onChange={(e) => up({ workflow: d.workflow.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              </li>
            );
          })}
        </ol>
        <Btn className="mt-2 w-full" onClick={() => up({ workflow: [...d.workflow, { id: sid('st'), action: 'think', label: 'New reasoning step', duration: 3 }] })}><Plus size={12} /> Add step</Btn>
      </Section>
    </div>
  );
}

export default function BotsPanel() {
  const { bots, divisions, levels, selectedBotId, set, saveBot } = useStore();
  const status = useSimUi((s) => s.status);
  const [div, setDiv] = useState<number | 'all'>('all');
  const sel = bots.find((b) => b.id === selectedBotId);
  const list = bots.filter((b) => div === 'all' || b.division_id === div);

  const addBot = () => {
    const dv = divisions[0];
    const id = saveBot({
      name: `Bot-${bots.length + 1}`, title: 'Specialist', level_id: levels.at(-1)?.id ?? 1, division_id: dv?.id ?? 1,
      manager_id: divisions.find((x) => x.id === dv?.id)?.head_bot_id ?? null, shirt_color: dv?.color ?? '#3b82f6', hair_color: '#3f2a1d', accent_color: '#ef4444',
      persona: 'Helpful, precise.', skills: [{ name: 'Communication', level: 3 }],
      guardrails: [guard('approval_priority', 'high'), guard('budget_limit', '20000'), guard('division_scope', 'strict'), guard('blocked_keywords'), guard('max_concurrent', '2'), guard('peer_review')],
      workflow: workflowFrom('Specialist'), desk_id: null, body: 'male',
    });
    set({ selectedBotId: id });
  };

  return (
    <div className="space-y-3">
      <Section title={`Bot roster (${bots.length})`} right={<Btn variant="primary" onClick={addBot}><UserPlus size={12} /> New bot</Btn>}>
        <Select value={div} onChange={(e) => setDiv(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="mb-2 py-1 text-xs">
          <option value="all">All divisions</option>
          {divisions.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Select>
        <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto">
          {list.map((b) => {
            const st = status[b.id];
            const lv = levels.find((l) => l.id === b.level_id);
            return (
              <button key={b.id} onClick={() => set({ selectedBotId: b.id })}
                className={cn('flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left', b.id === selectedBotId ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 hover:bg-slate-800')}>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded text-[11px] font-black text-white" style={{ background: b.shirt_color }}>{b.name[0]}</span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-100">{b.name} <span className="text-[10px]">{st?.icon}</span></span>
                  <span className="block truncate text-[10px]" style={{ color: lv?.color }}>{lv?.name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>
      {sel ? <BotEditor key={sel.id} bot={sel} /> : (
        <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">
          Select a bot here or click one in the 3D office to configure its <Badge color="#38bdf8">skills</Badge> <Badge color="#f59e0b">guardrails</Badge> and <Badge color="#a78bfa">chain of thought</Badge>.
        </div>
      )}
    </div>
  );
}
