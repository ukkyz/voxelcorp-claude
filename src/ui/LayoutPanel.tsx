import { useState } from 'react';
import { Pencil, RotateCcw, RotateCw, Save, Trash2, Undo2, Camera, Upload, Plus } from 'lucide-react';
import { useStore } from '../store';
import type { DoorSide, RoomType } from '../types';
import { CATALOG } from '../sim/catalog';
import { furnitureTris, WORKSTATION_COMPONENTS } from '../three/furnitureGeo';
import { Badge, Btn, ColorInput, Field, Input, Section, Select } from './kit';

const ROOM_TYPES: RoomType[] = ['office', 'executive', 'meeting', 'lab', 'lounge', 'open'];
const ROOM_PRESETS: { label: string; type: RoomType; w: number; d: number; color: string }[] = [
  { label: 'Team Office', type: 'office', w: 10, d: 8, color: '#bae6fd' },
  { label: 'Meeting Room', type: 'meeting', w: 6, d: 6, color: '#e2e8f0' },
  { label: 'Lab', type: 'lab', w: 8, d: 8, color: '#c7d2fe' },
  { label: 'Open Lounge', type: 'lounge', w: 6, d: 6, color: '#fecdd3' },
];
const PROP_BUDGET = { pieces: 120, tris: 15000 };

export default function LayoutPanel() {
  const s = useStore();
  const [snapName, setSnapName] = useState('');
  const room = s.selection?.kind === 'room' ? s.rooms.find((r) => r.id === s.selection!.id) : undefined;
  const item = s.selection?.kind === 'furniture' ? s.furniture.find((f) => f.id === s.selection!.id) : undefined;
  const selRoomForSpawn = room ?? s.rooms.find((r) => r.id === item?.room_id);
  const totalTris = s.furniture.reduce((a, f) => a + furnitureTris(f.type), 0);

  const spawnAt = () => {
    const r = selRoomForSpawn;
    if (r) return { x: r.x + (Math.random() - 0.5) * (r.w - 3), z: r.z + (Math.random() - 0.5) * (r.d - 3) };
    return { x: 0, z: 0 };
  };

  return (
    <div className="space-y-3">
      <Section title="Layout editor">
        {!s.editMode ? (
          <Btn variant="primary" className="w-full py-2" onClick={() => s.set({ editMode: true })}><Pencil size={14} /> Enter edit mode</Btn>
        ) : (
          <div className="rounded-lg border border-sky-700/50 bg-sky-500/10 p-2 text-[11px] text-sky-200">
            <b>Edit mode on</b> · Simulation paused. Click a room floor or a prop to select it, then <b>drag</b> to move it (snaps to a 0.5 / 0.25 grid). Moving a room moves its contents too. Drag empty space to orbit, right-drag to pan.
            <Btn className="mt-2 w-full" onClick={() => s.set({ editMode: false, selection: null })}>Exit edit mode & resume</Btn>
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <Btn variant="success" className="flex-1" disabled={!s.layoutDirty} onClick={() => s.saveLayout()}><Save size={12} /> Save to SQLite</Btn>
          <Btn className="flex-1" disabled={!s.layoutDirty} onClick={() => s.revertLayout()}><Undo2 size={12} /> Revert</Btn>
        </div>
        {s.layoutDirty && <p className="mt-1 text-[10px] text-amber-400">Unsaved layout changes (Ctrl+S to save)</p>}
      </Section>

      {(room || item) && (
        <Section title={room ? `Room · ${room.name}` : `Prop · ${CATALOG[item!.type].label}`} className="border-yellow-500/40"
          right={<Btn variant="danger" onClick={() => (room ? s.deleteRoom(room.id) : s.deleteFurniture(item!.id))}><Trash2 size={12} /></Btn>}>
          {room && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name"><Input value={room.name} onChange={(e) => s.updateRoom(room.id, { name: e.target.value })} /></Field>
              <Field label="Type" hint="meeting rooms host kickoffs & syncs; lounge/open have no walls.">
                <Select value={room.type} onChange={(e) => s.updateRoom(room.id, { type: e.target.value as RoomType })}>{ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
              </Field>
              <Field label="Width (X)"><Input type="number" step={0.5} min={3} value={room.w} onChange={(e) => s.updateRoom(room.id, { w: Math.max(3, Number(e.target.value)) })} /></Field>
              <Field label="Depth (Z)"><Input type="number" step={0.5} min={3} value={room.d} onChange={(e) => s.updateRoom(room.id, { d: Math.max(3, Number(e.target.value)) })} /></Field>
              <Field label="Center X"><Input type="number" step={0.5} value={room.x} onChange={(e) => s.updateRoom(room.id, { x: Number(e.target.value) }, true)} /></Field>
              <Field label="Center Z"><Input type="number" step={0.5} value={room.z} onChange={(e) => s.updateRoom(room.id, { z: Number(e.target.value) }, true)} /></Field>
              <Field label="Door side">
                <Select value={room.door_side} onChange={(e) => s.updateRoom(room.id, { door_side: e.target.value as DoorSide })}>
                  <option value="n">North (−Z)</option><option value="s">South (+Z)</option><option value="w">West (−X)</option><option value="e">East (+X)</option>
                </Select>
              </Field>
              <Field label="Division">
                <Select value={room.division_id ?? ''} onChange={(e) => s.updateRoom(room.id, { division_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">— shared —</option>
                  {s.divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="Floor color"><ColorInput value={room.color} onChange={(v) => s.updateRoom(room.id, { color: v })} /></Field>
              <div className="flex items-end"><Btn onClick={() => s.updateRoom(room.id, { color: s.divisions.find((d) => d.id === room.division_id)?.color ?? room.color })}>Division tint</Btn></div>
            </div>
          )}
          {item && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Btn onClick={() => s.updateFurniture(item.id, { rot: item.rot + Math.PI / 2 })}><RotateCcw size={12} /> 90°</Btn>
                <Btn onClick={() => s.updateFurniture(item.id, { rot: item.rot - Math.PI / 2 })}><RotateCw size={12} /> 90°</Btn>
                <span className="text-[10px] text-slate-500">{furnitureTris(item.type)} tris · 1 draw</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="X"><Input type="number" step={0.25} value={item.x} onChange={(e) => s.updateFurniture(item.id, { x: Number(e.target.value) })} /></Field>
                <Field label="Z"><Input type="number" step={0.25} value={item.z} onChange={(e) => s.updateFurniture(item.id, { z: Number(e.target.value) })} /></Field>
              </div>
              <div className="text-[11px] text-slate-400">Room: {s.rooms.find((r) => r.id === item.room_id)?.name ?? 'corridor'}</div>
              {(item.type === 'desk' || item.type === 'exec_desk') && (
                <>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Workstation components (merged 1 draw call)</div>
                    <div className="grid grid-cols-2 gap-1">
                      {WORKSTATION_COMPONENTS.map((c) => (
                        <div key={c.name} className="flex items-center gap-1.5 rounded bg-slate-900 px-2 py-1 text-[11px] text-slate-200">
                          <span>{c.icon}</span><span>{c.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Field label="Assigned bot (home desk)">
                    <Select value={s.bots.find((b) => b.desk_id === item.id)?.id ?? ''} onChange={(e) => {
                      const cur = s.bots.find((b) => b.desk_id === item.id);
                      if (e.target.value) s.assignDesk(Number(e.target.value), item.id);
                      else if (cur) s.assignDesk(cur.id, null);
                    }}>
                      <option value="">— unassigned —</option>
                      {s.bots.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.title}</option>)}
                    </Select>
                  </Field>
                </>
              )}
            </div>
          )}
        </Section>
      )}

      <Section title="Prop palette" right={<span className="text-[10px] text-slate-500">{selRoomForSpawn ? `→ ${selRoomForSpawn.name}` : '→ center'}</span>}>
        <div className="grid grid-cols-3 gap-1.5">
          {Object.values(CATALOG).map((c) => (
            <button key={c.type} onClick={() => { const p = spawnAt(); s.addFurniture(c.type, Math.round(p.x * 4) / 4, Math.round(p.z * 4) / 4); s.set({ editMode: true }); }}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-slate-800 bg-slate-950 px-1 py-2 text-[10px] text-slate-300 hover:border-sky-600 hover:bg-slate-900">
              <span className="text-lg">{c.icon}</span>{c.label}
              <span className="text-[9px] text-slate-500">{furnitureTris(c.type)} tris</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Add room">
        <div className="grid grid-cols-2 gap-1.5">
          {ROOM_PRESETS.map((p) => (
            <Btn key={p.label} onClick={() => { s.addRoom({ name: p.label, type: p.type, x: 0, z: 0, w: p.w, d: p.d, color: p.color, division_id: null, door_side: 's' }); s.set({ editMode: true }); }}>
              <Plus size={12} /> {p.label}
            </Btn>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500">New rooms spawn in the central corridor — drag them into place.</p>
      </Section>

      <Section title="Layout snapshots (SQLite `layouts` table)">
        <div className="flex gap-1">
          <Input placeholder="Snapshot name…" value={snapName} onChange={(e) => setSnapName(e.target.value)} className="py-1 text-xs" />
          <Btn variant="primary" onClick={() => { s.saveSnapshot(snapName || `Layout ${new Date().toLocaleString()}`); setSnapName(''); }}><Camera size={12} /> Save</Btn>
        </div>
        <div className="mt-2 space-y-1">
          {s.layouts.length === 0 && <div className="text-[11px] text-slate-500">No snapshots yet.</div>}
          {s.layouts.map((l) => {
            const data = JSON.parse(l.data) as { rooms: unknown[]; furniture: unknown[] };
            return (
              <div key={l.id} className="flex items-center gap-2 rounded-md bg-slate-950 px-2 py-1 text-[11px]">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-200">{l.name}</div>
                  <div className="text-[10px] text-slate-500">{new Date(l.created_at).toLocaleString()} · {data.rooms.length} rooms · {data.furniture.length} props</div>
                </div>
                <Btn className="px-1.5 py-0.5" title="Load into editor (then Save to apply)" onClick={() => s.loadSnapshot(l.id)}><Upload size={11} /></Btn>
                <Btn variant="ghost" className="px-1.5 py-0.5" onClick={() => s.deleteSnapshot(l.id)}><Trash2 size={11} /></Btn>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Prop budget (tech-art)">
        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between"><span className="text-slate-400">Props / draw calls</span><Badge color={s.furniture.length > PROP_BUDGET.pieces ? '#ef4444' : '#22c55e'}>{s.furniture.length} / {PROP_BUDGET.pieces}</Badge></div>
          <div className="flex justify-between"><span className="text-slate-400">Prop triangles</span><Badge color={totalTris > PROP_BUDGET.tris ? '#ef4444' : '#22c55e'}>{totalTris.toLocaleString()} / {PROP_BUDGET.tris.toLocaleString()}</Badge></div>
          <div className="flex justify-between"><span className="text-slate-400">Rooms (≤3 draws each)</span><span className="font-mono text-slate-300">{s.rooms.length}</span></div>
          <p className="pt-1 text-[10px] leading-snug text-slate-500">Every prop is a single merged, vertex-coloured mesh sharing one material. Glass is the only transparent surface, and Low quality strips it to control overdraw.</p>
        </div>
      </Section>
    </div>
  );
}
