import { useMemo, useRef, useState } from 'react';
import { Download, Upload, RefreshCw, Play, Trash2, Box } from 'lucide-react';
import { useStore } from '../store';
import { exportBytes, rawQuery, tableStats } from '../db/database';
import { sim } from '../sim/engine';
import { Badge, Btn, Section } from './kit';

const EXAMPLES = [
  'SELECT b.name, l.name AS level, d.name AS division FROM bots b JOIN levels l ON l.id=b.level_id JOIN divisions d ON d.id=b.division_id ORDER BY l.rank',
  "SELECT p.name, count(t.id) tasks, sum(t.status='done') done FROM projects p LEFT JOIN tasks t ON t.project_id=p.id GROUP BY p.id",
  "SELECT kind, count(*) n FROM logs GROUP BY kind ORDER BY n DESC",
  'SELECT type, count(*) n FROM furniture GROUP BY type ORDER BY n DESC',
  'SELECT id, name, type, x, z, w, d, door_side FROM rooms',
];

export default function DataPanel() {
  const s = useStore();
  const [sql, setSql] = useState(EXAMPLES[0]);
  const [result, setResult] = useState<{ columns: string[]; values: unknown[][]; ms: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const glbRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stats = useMemo(() => tableStats(), [tick, s.bots, s.projects, s.tasks, s.rooms, s.furniture, s.layouts, s.logs.length]);

  const runSql = () => {
    try {
      const { res, ms } = rawQuery(sql);
      setErr(null);
      setResult(res[0] ? { columns: res[0].columns, values: res[0].values, ms } : { columns: ['result'], values: [['OK (no rows)']], ms });
      if (/^\s*(insert|update|delete)/i.test(sql)) s.reload();
      setTick((t) => t + 1);
    } catch (e) { setErr(String(e)); setResult(null); }
  };

  const download = () => {
    const blob = new Blob([exportBytes() as BlobPart], { type: 'application/x-sqlite3' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `voxelcorp-office-${new Date().toISOString().slice(0, 10)}.sqlite`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-3">
      <Section title="SQLite database" right={<Badge color="#22c55e">sql.js · IndexedDB</Badge>}>
        <div className="grid grid-cols-2 gap-1">
          {stats.map((t) => (
            <button key={t.name} onClick={() => setSql(`SELECT * FROM ${t.name} LIMIT 50`)} className="flex justify-between rounded-md bg-slate-950 px-2 py-1 text-[11px] hover:bg-slate-800">
              <span className="font-mono text-sky-300">{t.name}</span><span className="text-slate-400">{t.rows}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <Btn onClick={download}><Download size={12} /> Export</Btn>
          <Btn onClick={() => fileRef.current?.click()}><Upload size={12} /> Import</Btn>
          <Btn variant="danger" onClick={async () => { if (confirm('Reset database to the default enterprise? All changes will be lost.')) { sim.reset(); await s.resetAll(); setTick((t) => t + 1); } }}><RefreshCw size={12} /> Reset</Btn>
        </div>
        <input ref={fileRef} type="file" accept=".sqlite,.db,.sqlite3" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try { sim.reset(); await s.importDb(new Uint8Array(await f.arrayBuffer())); setTick((t) => t + 1); } catch (x) { alert('Invalid database: ' + x); }
          e.target.value = '';
        }} />
      </Section>

      <Section title="SQL console">
        <div className="mb-1 flex flex-wrap gap-1">
          {EXAMPLES.map((q, i) => <button key={i} onClick={() => setSql(q)} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700">Example {i + 1}</button>)}
        </div>
        <textarea value={sql} onChange={(e) => setSql(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runSql(); }}
          className="h-24 w-full rounded-md border border-slate-700 bg-slate-950 p-2 font-mono text-[11px] text-emerald-300 outline-none focus:border-sky-500" spellCheck={false} />
        <div className="flex items-center gap-2">
          <Btn variant="primary" onClick={runSql}><Play size={12} /> Run (Ctrl+Enter)</Btn>
          {result && <span className="text-[10px] text-slate-500">{result.values.length} rows · {result.ms.toFixed(2)} ms</span>}
        </div>
        {err && <div className="mt-2 rounded bg-rose-950 p-2 font-mono text-[11px] text-rose-300">{err}</div>}
        {result && (
          <div className="mt-2 max-h-64 overflow-auto rounded border border-slate-800">
            <table className="w-full text-left font-mono text-[10px]">
              <thead className="sticky top-0 bg-slate-900"><tr>{result.columns.map((c) => <th key={c} className="px-1.5 py-1 text-sky-300">{c}</th>)}</tr></thead>
              <tbody>
                {result.values.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-t border-slate-800">{r.map((v, j) => <td key={j} className="max-w-[160px] truncate px-1.5 py-0.5 text-slate-300" title={String(v)}>{String(v)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={<span className="flex items-center gap-1"><Box size={12} /> Bot character asset (GLB)</span>}>
        <div className="space-y-1 text-[11px] text-slate-300">
          <div className="flex justify-between"><span className="text-slate-400">Active model</span><span className="font-mono">{s.customModelName ?? 'voxel_bot.glb (reference)'}</span></div>
          <table className="mt-1 w-full text-[10.5px]">
            <tbody className="[&_td]:py-0.5">
              <tr><td className="text-slate-400">Triangles</td><td className="text-right font-mono">276 <span className="text-emerald-400">(≤ 600)</span></td></tr>
              <tr><td className="text-slate-400">Draw calls / instance</td><td className="text-right font-mono">12 <span className="text-emerald-400">(≤ 16)</span></td></tr>
              <tr><td className="text-slate-400">Materials</td><td className="text-right font-mono">Base (vertex colour) + Shirt / Hair / Tie tint</td></tr>
              <tr><td className="text-slate-400">Textures</td><td className="text-right font-mono">0, so no compression cost</td></tr>
              <tr><td className="text-slate-400">Clips</td><td className="text-right font-mono">Idle · Walk · Talk · Typing</td></tr>
              <tr><td className="text-slate-400">Rig</td><td className="text-right font-mono">Node pivots (no skinning, GPU-cheap)</td></tr>
            </tbody>
          </table>
          <p className="pt-1 text-[10px] leading-snug text-slate-500">Custom GLBs are retargeted by clip name (idle/walk/talk/typing) and normalised to 1.6 m. Materials named Shirt/Hair/Tie get per-bot tints. Uploads last for this session only.</p>
          <div className="flex gap-1.5 pt-1">
            <Btn onClick={() => glbRef.current?.click()}><Upload size={12} /> Upload GLB</Btn>
            {s.customModelUrl && <Btn variant="ghost" onClick={() => s.set({ customModelUrl: null, customModelName: null })}>Use reference bot</Btn>}
          </div>
          <input ref={glbRef} type="file" accept=".glb,.gltf" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            s.set({ customModelUrl: URL.createObjectURL(f), customModelName: f.name });
            e.target.value = '';
          }} />
        </div>
      </Section>

      <Section title="Logs" right={<Btn variant="ghost" onClick={() => s.clearLogs()}><Trash2 size={12} /> Clear</Btn>}>
        <p className="text-[11px] text-slate-500">Bot reasoning, guardrail events and project milestones are written to the <span className="font-mono text-sky-300">logs</span> table in batches every 1.5 s, capped at the latest 1000 rows.</p>
      </Section>
    </div>
  );
}
