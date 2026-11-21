import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export function Section({ title, children, right, className }: { title: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-slate-800 bg-slate-900/60 p-3', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-400" title={hint}>{label}{hint && <span className="ml-1 cursor-help text-slate-500">ⓘ</span>}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500', props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn('w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500', props.className)} />;
}

export function Btn({ variant = 'default', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'success' }) {
  const v = {
    default: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700',
    primary: 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500',
    danger: 'bg-rose-600/90 hover:bg-rose-500 text-white border-rose-500',
    ghost: 'bg-transparent hover:bg-slate-800 text-slate-300 border-transparent',
  }[variant];
  return <button {...p} className={cn('inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40', v, className)} />;
}

export function Badge({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', className)} style={{ background: (color ?? '#64748b') + '33', color: color ?? '#cbd5e1' }}>
      {children}
    </span>
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-700 bg-transparent" />
      <span className="font-mono text-xs text-slate-400">{value}</span>
    </div>
  );
}

export function Progress({ value, color = '#38bdf8' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  );
}

export const PRIORITY_COLORS: Record<string, string> = { low: '#94a3b8', medium: '#38bdf8', high: '#f59e0b', critical: '#ef4444' };
export const STATUS_COLORS: Record<string, string> = { todo: '#94a3b8', in_progress: '#38bdf8', review: '#a855f7', blocked: '#ef4444', done: '#22c55e', active: '#38bdf8', planning: '#94a3b8' };
export const ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
  think: { icon: '🤔', color: '#a78bfa', label: 'Think' },
  research: { icon: '🔎', color: '#60a5fa', label: 'Research' },
  consult_manager: { icon: '🗣️', color: '#f59e0b', label: 'Consult manager' },
  consult_peer: { icon: '💬', color: '#2dd4bf', label: 'Consult peer' },
  meeting: { icon: '📊', color: '#f472b6', label: 'Meeting' },
  execute: { icon: '⚙️', color: '#22c55e', label: 'Execute' },
  review: { icon: '🧐', color: '#e879f9', label: 'Review' },
  report: { icon: '📨', color: '#fb923c', label: 'Report' },
  approval: { icon: '🔐', color: '#facc15', label: 'Approval (guardrail)' },
  escalate: { icon: '🛑', color: '#ef4444', label: 'Escalate' },
  kickoff: { icon: '🚀', color: '#f472b6', label: 'Kickoff' },
};
