import { useStore, useSimUi, type BotStatus } from '../store';
import type { Bot, Division, LogEntry, Project, StepAction, Task } from '../types';
import { buildNavGrid, findPath, type NavGrid } from './pathfinding';
import { seatPoints } from './catalog';

export type Anim = 'Idle' | 'Walk' | 'Talk' | 'Typing';
type Spot = { x: number; z: number; faceX: number; faceZ: number };

interface Activity {
  kind: 'desk' | 'talk' | 'meeting' | 'spot';
  action: StepAction | 'approval' | 'kickoff' | 'idle' | 'break' | 'escalate';
  label: string;
  bubble: string;
  duration: number;
  anim: Anim;
  icon: string;
  partnerId?: number;
  partnerReply?: string;
  spot?: Spot;
  stepIndex?: number;
  taskId?: number;
  meetingKey?: string;
}

export interface BotRuntime {
  id: number;
  x: number; z: number; rot: number;
  anim: Anim;
  path: [number, number][];
  phase: 'travel' | 'perform';
  timer: number;
  activity: Activity | null;
  queue: Activity[];
  plan: { label: string; action: string; injected?: boolean }[];
  taskId: number | null;
  stepIndex: number;
  locked: number;
  lockFace: [number, number] | null;
  lockBubble: string;
  bubble: string;
  icon: string;
  state: BotStatus['state'];
  retries: number;
  repathTimer: number;
  face: [number, number] | null;
}

const PR: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const short = (s: string, n = 30) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const WALK_SPEED = 2.4;
const BACKLOG: { name: string; desc: string; tasks: [string, string][] }[] = [
  { name: 'Customer Churn Insights', desc: 'Find the top churn drivers and propose fixes.', tasks: [['Cohort churn analysis', 'Data Analysis'], ['Interview churned customers', 'UX Research'], ['Retention playbook', 'Product Strategy']] },
  { name: 'VFX Overdraw Audit', desc: 'Cap additive particles and ship mobile-safe shader variants.', tasks: [['Overdraw heatmap capture', 'Shader & VFX'], ['Mobile shader variants', 'Shader & VFX'], ['Frame budget regression test', 'QA Testing']] },
  { name: 'Partner Webinar Series', desc: 'Co-marketing webinars with integration partners.', tasks: [['Webinar landing copy', 'Copywriting'], ['Partner outreach', 'Sales'], ['Promo visuals', 'Visual Design']] },
  { name: 'Zero-Trust Rollout', desc: 'Roll out SSO + device posture checks company-wide.', tasks: [['SSO integration', 'Security'], ['Infra policy as code', 'DevOps'], ['Compliance mapping', 'Legal & Compliance']] },
  { name: 'Agent Memory v2', desc: 'Long-term memory for bots with retrieval evaluation.', tasks: [['Vector store service', 'Backend'], ['Retrieval eval suite', 'Machine Learning'], ['Memory inspector UI', 'Frontend']] },
  { name: 'Annual Budget Planning', desc: 'Consolidate division budgets for next fiscal year.', tasks: [['Division budget intake', 'Finance'], ['Headcount plan', 'Operations'], ['Board budget memo', 'Strategy']] },
];

class Simulation {
  runtimes = new Map<number, BotRuntime>();
  overrides = new Set<number>();
  private grid: NavGrid | null = null;
  private gridVersion = -1;
  private pendingLogs: Omit<LogEntry, 'id'>[] = [];
  private uiTimer = 0;
  private dispatchTimer = 0;
  private logTimer = 0;
  private meetingSeats = new Map<string, number>();
  private autoTimer = 0;

  reset() {
    this.runtimes.clear();
    this.meetingSeats.clear();
    this.overrides.clear();
    this.gridVersion = -1;
  }

  get state() { return useStore.getState(); }

  log(kind: LogEntry['kind'], text: string, botId: number | null = null) {
    this.pendingLogs.push({ ts: new Date().toISOString(), bot_id: botId, kind, text });
  }

  bot(id: number | null | undefined) { return id == null ? undefined : this.state.bots.find((b) => b.id === id); }

  // ---------------- hierarchy helpers ----------------
  ancestors(divId: number, divs: Division[]): number[] {
    const out: number[] = [];
    let d = divs.find((x) => x.id === divId);
    while (d && d.parent_id != null && !out.includes(d.parent_id)) { out.push(d.parent_id); d = divs.find((x) => x.id === d!.parent_id); }
    return out;
  }
  inFamily(botDiv: number, projDiv: number) {
    const divs = this.state.divisions;
    if (botDiv === projDiv) return true;
    return this.ancestors(botDiv, divs).includes(projDiv) || this.ancestors(projDiv, divs).includes(botDiv);
  }
  guard(b: Bot, type: string) { return b.guardrails.find((g) => g.type === type && g.enabled); }
  load(botId: number) { return this.state.tasks.filter((t) => t.assignee_id === botId && t.status !== 'done' && t.status !== 'blocked').length; }

  // ---------------- spatial helpers ----------------
  home(b: Bot): Spot {
    const desk = this.state.furniture.find((f) => f.id === b.desk_id);
    if (desk) { const s = seatPoints(desk)[0]; if (s) return s; }
    const lounge = this.state.rooms.find((r) => r.type === 'lounge') ?? this.state.rooms[0];
    const x = (lounge?.x ?? 0) + ((b.id * 37) % 5) - 2, z = (lounge?.z ?? 0) + ((b.id * 53) % 5) - 2;
    return { x, z, faceX: x, faceZ: z + 1 };
  }
  ensureDesks() {
    const st = this.state;
    const taken = new Set(st.bots.map((b) => b.desk_id).filter(Boolean));
    for (const b of st.bots) {
      if (b.desk_id && st.furniture.some((f) => f.id === b.desk_id)) continue;
      const desks = st.furniture.filter((f) => (f.type === 'desk' || f.type === 'exec_desk') && !taken.has(f.id));
      const own = desks.find((f) => st.rooms.find((r) => r.id === f.room_id)?.division_id === b.division_id) ?? desks[0];
      if (own) { st.assignDesk(b.id, own.id); taken.add(own.id); this.log('system', `${b.name} was auto-assigned a free desk.`, b.id); }
    }
  }
  roomOf(b: Bot) {
    const desk = this.state.furniture.find((f) => f.id === b.desk_id);
    return this.state.rooms.find((r) => r.id === desk?.room_id);
  }
  researchSpot(b: Bot): Spot | undefined {
    const room = this.roomOf(b);
    const f = this.state.furniture.filter((x) => (x.type === 'bookshelf' || x.type === 'whiteboard' || x.type === 'server_rack') && x.room_id === room?.id);
    const it = f.length ? pick(f) : undefined;
    return it ? seatPoints(it)[0] : undefined;
  }
  breakSpot(): Spot | undefined {
    const f = this.state.furniture.filter((x) => ['coffee_machine', 'water_cooler', 'sofa'].includes(x.type));
    const it = f.length ? pick(f) : undefined;
    if (!it) return undefined;
    const s = seatPoints(it)[0];
    return s ? { ...s, x: s.x + (Math.random() - 0.5) * 0.8, z: s.z + (Math.random() - 0.5) * 0.4 } : undefined;
  }
  meetingSpot(botId: number): { spot: Spot; key: string } | undefined {
    const rooms = this.state.rooms.filter((r) => r.type === 'meeting');
    const tables = this.state.furniture.filter((f) => f.type === 'meeting_table' && rooms.some((r) => r.id === f.room_id));
    const all = (tables.length ? tables : this.state.furniture.filter((f) => f.type === 'meeting_table'));
    for (const t of all) {
      const seats = seatPoints(t);
      for (let i = 0; i < seats.length; i++) {
        const key = `${t.id}:${i}`;
        const occ = this.meetingSeats.get(key);
        if (occ === undefined || occ === botId || !this.runtimes.has(occ)) { this.meetingSeats.set(key, botId); return { spot: seats[i], key }; }
      }
    }
    return undefined;
  }

  // ---------------- lifecycle ----------------
  sync() {
    const st = this.state;
    if (this.gridVersion !== st.layoutVersion) {
      this.grid = buildNavGrid(st.rooms, st.furniture);
      this.gridVersion = st.layoutVersion;
      for (const rt of this.runtimes.values()) if (rt.phase === 'travel' && rt.activity) this.routeTo(rt, this.targetOf(rt));
    }
    const ids = new Set(st.bots.map((b) => b.id));
    for (const id of this.runtimes.keys()) if (!ids.has(id)) this.runtimes.delete(id);
    for (const b of st.bots) {
      if (this.runtimes.has(b.id)) continue;
      const h = this.home(b);
      this.runtimes.set(b.id, {
        id: b.id, x: h.x, z: h.z, rot: Math.atan2(h.faceX - h.x, h.faceZ - h.z), anim: 'Typing', path: [], phase: 'perform', timer: 0,
        activity: null, queue: [], plan: [], taskId: null, stepIndex: -1, locked: 0, lockFace: null, lockBubble: '',
        bubble: '', icon: '💻', state: 'working', retries: 0, repathTimer: 0, face: [h.faceX, h.faceZ],
      });
    }
  }

  tick(realDt: number) {
    const st = this.state;
    if (!st.ready) return;
    this.sync();
    this.uiTimer += realDt;
    this.logTimer += realDt;
    if (st.simRunning && !st.editMode) {
      const dt = Math.min(realDt, 0.1) * st.simSpeed;
      this.dispatchTimer += dt;
      if (this.dispatchTimer > 1) { this.dispatchTimer = 0; this.ensureDesks(); this.dispatch(); this.autopilot(1); }
      for (const rt of this.runtimes.values()) this.update(rt, dt);
    }
    if (this.uiTimer > 0.25) { this.uiTimer = 0; this.flushUi(); }
    if (this.logTimer > 1.5) { this.logTimer = 0; const l = this.pendingLogs; this.pendingLogs = []; st.pushLogs(l); }
  }

  // ---------------- dispatcher (management assigns work) ----------------
  dispatch() {
    const st = this.state;
    for (const p of st.projects) {
      if (p.status !== 'active') continue;
      const tasks = st.tasks.filter((t) => t.project_id === p.id);
      if (tasks.length && tasks.every((t) => t.status === 'done')) {
        st.setProjectStatus(p.id, 'done');
        this.log('done', `🎉 Project "${p.name}" completed! Owner ${this.bot(p.owner_id)?.name ?? '—'} signs off.`, p.owner_id);
        continue;
      }
      for (const t of tasks) {
        if (t.assignee_id != null || t.status !== 'todo') continue;
        const chosen = this.chooseAssignee(t, p);
        if (!chosen) continue;
        st.patchTask({ id: t.id, assignee_id: chosen.bot.id });
        const owner = this.bot(p.owner_id);
        this.log('project', `📋 ${owner?.name ?? 'Management'} assigned "${short(t.title, 40)}" → ${chosen.bot.name} (${t.skill} L${chosen.lvl}${chosen.lvl === 0 ? ' · skill gap!' : ''})`, chosen.bot.id);
      }
    }
  }
  /** Autopilot: management bots periodically launch new projects from the strategy backlog. */
  autopilot(dt: number) {
    const st = this.state;
    if (!st.autopilot) return;
    this.autoTimer += dt;
    const active = st.projects.filter((p) => p.status === 'active').length;
    if (active >= 2 || this.autoTimer < 40) return;
    this.autoTimer = 0;
    const managers = st.bots.filter((b) => st.levels.find((l) => l.id === b.level_id)?.can_create_projects);
    if (!managers.length) return;
    const owner = pick(managers);
    const tpl = pick(BACKLOG);
    const priority = pick(['low', 'medium', 'high', 'critical'] as const);
    const budget = pick([8000, 15000, 35000, 55000, 90000, 180000]);
    const id = st.createProject({ name: `${tpl.name} ${new Date().getFullYear()}-${(st.projects.length + 1).toString().padStart(2, '0')}`, description: tpl.desc, division_id: owner.division_id, owner_id: owner.id, priority, budget }, tpl.tasks.map(([title, skill]) => ({ title, skill })));
    this.log('project', `🗂️ ${owner.name} (management) created project "${tpl.name}" · ${priority} · $${budget.toLocaleString()}`, owner.id);
    this.kickoff(id);
  }

  chooseAssignee(t: Task, p: Project) {
    let best: { bot: Bot; score: number; lvl: number } | null = null;
    for (const b of this.state.bots) {
      const cap = this.guard(b, 'max_concurrent');
      const load = this.load(b.id);
      if (cap && load >= Number(cap.value)) continue;
      const lvl = b.skills.find((s) => s.name === t.skill)?.level ?? 0;
      const rank = this.state.levels.find((l) => l.id === b.level_id)?.rank ?? 5;
      const score = lvl * 3 + (this.inFamily(b.division_id, p.division_id) ? 4 : 0) - load * 2 + rank * 0.4 - (lvl === 0 ? 20 : 0);
      if (!best || score > best.score) best = { bot: b, score, lvl };
    }
    return best;
  }

  // ---------------- planning: workflow + guardrails ----------------
  planNext(rt: BotRuntime): Activity | null {
    const st = this.state;
    const b = this.bot(rt.id);
    if (!b) return null;
    const active = new Set(st.projects.filter((p) => p.status === 'active').map((p) => p.id));
    const mine = st.tasks
      .filter((t) => t.assignee_id === b.id && active.has(t.project_id) && (t.status === 'todo' || t.status === 'in_progress' || t.status === 'review'))
      .sort((a, c) => {
        const pa = st.projects.find((p) => p.id === a.project_id)!, pc = st.projects.find((p) => p.id === c.project_id)!;
        return (c.status !== 'todo' ? 1 : 0) - (a.status !== 'todo' ? 1 : 0) || PR[pc.priority] - PR[pa.priority];
      });
    const task = mine[0];
    if (task) {
      const project = st.projects.find((p) => p.id === task.project_id)!;
      const acts = this.buildPlan(b, task, project, rt);
      if (acts.length) { rt.queue = acts.slice(1); return acts[0]; }
    }
    rt.taskId = null;
    rt.plan = [];
    rt.stepIndex = -1;
    return this.idleActivity(b);
  }

  buildPlan(b: Bot, task: Task, project: Project, rt: BotRuntime): Activity[] {
    const st = this.state;
    const mgr = this.bot(b.manager_id);
    const text = `${task.title} ${project.name} ${project.description}`.toLowerCase();

    // Guardrail: blocked topics
    const kw = this.guard(b, 'blocked_keywords');
    if (kw && !this.overrides.has(task.id)) {
      const hit = kw.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).find((k) => text.includes(k));
      if (hit) {
        st.patchTask({ id: task.id, status: 'blocked' });
        st.setProjectStatus(project.id, 'blocked');
        this.log('guard', `🛑 GUARDRAIL · ${b.name} refused "${short(task.title, 40)}" — touches blocked topic "${hit}". Escalating${mgr ? ` to ${mgr.name}` : ''}.`, b.id);
        rt.taskId = null; rt.plan = [{ label: `Refused: blocked topic "${hit}"`, action: 'escalate', injected: true }]; rt.stepIndex = 0;
        return mgr ? [{
          kind: 'talk', action: 'escalate', partnerId: mgr.id, label: 'Escalate blocked task', duration: 4, anim: 'Talk', icon: '🛑',
          bubble: `${mgr.name}, I can't take "${short(task.title)}" — policy: "${hit}".`, partnerReply: 'Understood. I\'ll review it with compliance.',
        }] : [];
      }
    }

    // Guardrail: approvals
    const approvals: { partner: Bot; reason: string }[] = [];
    const pg = this.guard(b, 'approval_priority');
    if (pg && PR[project.priority] >= PR[pg.value] && mgr) approvals.push({ partner: mgr, reason: `${project.priority} priority` });
    const bg = this.guard(b, 'budget_limit');
    if (bg && project.budget > Number(bg.value)) {
      const chain: string[] = [`${b.name} ($${Number(bg.value).toLocaleString()})`];
      let cur = mgr;
      let approver: Bot | undefined;
      const seen = new Set<number>();
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        const g = this.guard(cur, 'budget_limit');
        const ok = !g || Number(g.value) >= project.budget;
        chain.push(`${cur.name} (${g ? '$' + Number(g.value).toLocaleString() : '∞'}) ${ok ? '✓' : '✗'}`);
        if (ok) { approver = cur; break; }
        approver = cur;
        cur = this.bot(cur.manager_id);
      }
      this.log('guard', `💰 GUARDRAIL · Budget $${project.budget.toLocaleString()} exceeds ${b.name}'s authority. Escalation chain: ${chain.join(' → ')}`, b.id);
      if (approver) approvals.push({ partner: approver, reason: `budget $${project.budget.toLocaleString()}` });
    }
    const dg = this.guard(b, 'division_scope');
    if (dg && dg.value === 'strict' && !this.inFamily(b.division_id, project.division_id) && mgr) {
      const dn = st.divisions.find((d) => d.id === project.division_id)?.name ?? 'another division';
      approvals.push({ partner: mgr, reason: `cross-division work for ${dn}` });
      this.log('guard', `🧭 GUARDRAIL · ${b.name} needs ${mgr.name}'s OK for cross-division work (${dn}).`, b.id);
    }
    const merged = new Map<number, string[]>();
    for (const a of approvals) merged.set(a.partner.id, [...(merged.get(a.partner.id) ?? []), a.reason]);
    const peerReview = !!this.guard(b, 'peer_review');

    const acts: Activity[] = [];
    let approvalsInserted = false;
    const addApprovals = () => {
      if (approvalsInserted) return;
      approvalsInserted = true;
      for (const [pid, reasons] of merged) {
        const p = this.bot(pid)!;
        acts.push({
          kind: 'talk', action: 'approval', partnerId: pid, label: `Get approval from ${p.name} (${reasons.join(', ')})`, duration: 4, anim: 'Talk', icon: '🔐',
          bubble: `${p.name}, need sign-off: ${reasons.join(' + ')}.`, partnerReply: pick(['Approved ✅', 'Signed off — proceed.', 'OK, keep me posted 👍']), taskId: task.id,
        });
      }
    };
    for (const step of b.workflow) {
      if (step.action === 'execute') addApprovals();
      const a = this.stepActivity(b, step.action, step.label, step.duration, task, project);
      if (a) acts.push({ ...a, taskId: task.id });
      if (step.action === 'execute' && peerReview) {
        const pr = this.stepActivity(b, 'consult_peer', 'Peer review (guardrail)', 3, task, project);
        if (pr) acts.push({ ...pr, label: 'Peer review (guardrail)', taskId: task.id, icon: '👥', partnerReply: pick(['LGTM ✔', 'Approved with one nit.', 'Ship it!']) });
      }
    }
    addApprovals();
    acts.forEach((a, i) => { a.stepIndex = i; });
    rt.taskId = task.id;
    rt.stepIndex = 0;
    rt.plan = acts.map((a) => ({ label: a.label, action: a.action, injected: a.action === 'approval' || a.label.includes('guardrail') }));
    if (task.status === 'todo') st.patchTask({ id: task.id, status: 'in_progress' });
    this.log('thought', `🧠 ${b.name} planned "${short(task.title, 40)}" in ${acts.length} steps: ${acts.map((a) => a.label.split(' ')[0]).join(' → ')}`, b.id);
    return acts;
  }

  peerFor(b: Bot, skill: string): Bot | undefined {
    const others = this.state.bots.filter((x) => x.id !== b.id);
    const same = others.filter((x) => x.division_id === b.division_id);
    return same.find((x) => x.skills.some((s) => s.name === skill)) ?? same[0]
      ?? others.find((x) => x.skills.some((s) => s.name === skill)) ?? this.bot(b.manager_id);
  }

  stepActivity(b: Bot, action: StepAction, label: string, duration: number, task: Task, project: Project): Activity | null {
    const t = short(task.title);
    const lvl = b.skills.find((s) => s.name === task.skill)?.level ?? 0;
    const mgr = this.bot(b.manager_id);
    const base = { action, label, duration };
    switch (action) {
      case 'think':
        return { ...base, kind: 'desk', anim: 'Typing', icon: '🤔', bubble: pick([`Breaking "${t}" into sub-problems…`, `What does "done" look like for "${t}"?`, `Mapping constraints & risks…`]) };
      case 'research': {
        const spot = this.researchSpot(b);
        return { ...base, kind: spot ? 'spot' : 'desk', spot, anim: spot ? 'Idle' : 'Typing', icon: '🔎', bubble: pick([`Researching ${task.skill} best practices…`, `Reviewing prior art for "${t}"`, `Reading internal docs…`]) };
      }
      case 'execute':
        return { ...base, kind: 'desk', anim: 'Typing', icon: '⚙️', bubble: pick([`Building "${t}" (${task.skill} L${lvl})`, `Heads-down on "${t}"…`, `Implementing… ${lvl >= 4 ? 'this is my jam' : 'learning as I go'}`]) };
      case 'review':
        return { ...base, kind: 'desk', anim: 'Typing', icon: '🧐', bubble: pick(['Validating against acceptance criteria…', 'Profiling & checking budgets…', 'Running the test suite…']) };
      case 'consult_manager':
        if (!mgr) return { ...base, kind: 'desk', anim: 'Typing', icon: '🤔', bubble: 'Top of hierarchy — self-aligning on priorities.' };
        return { ...base, kind: 'talk', partnerId: mgr.id, anim: 'Talk', icon: '🗣️', bubble: `${mgr.name}, quick alignment on "${t}"?`, partnerReply: pick(['Aligned — proceed 👍', 'Keep scope tight.', 'Prioritize the critical path.']) };
      case 'consult_peer': {
        const peer = this.peerFor(b, task.skill);
        if (!peer) return { ...base, kind: 'desk', anim: 'Typing', icon: '🤔', bubble: 'No peer available — rubber-ducking it.' };
        return { ...base, kind: 'talk', partnerId: peer.id, anim: 'Talk', icon: '💬', bubble: `${peer.name}, can you sanity-check my approach?`, partnerReply: pick(['Watch the edge cases!', 'Try caching that.', 'Looks solid to me.']) };
      }
      case 'meeting':
        return { ...base, kind: 'meeting', anim: 'Talk', icon: '📊', bubble: `Syncing on "${short(project.name, 26)}"` };
      case 'report': {
        let to = this.bot(project.owner_id);
        if (!to || to.id === b.id) to = mgr;
        if (!to) return { ...base, kind: 'desk', anim: 'Typing', icon: '📨', bubble: 'Publishing status memo to all-hands.' };
        return { ...base, kind: 'talk', partnerId: to.id, anim: 'Talk', icon: '📨', bubble: `${to.name}, "${t}" is done ✅`, partnerReply: pick(['Great work 🎉', 'Logged — thanks!', 'Excellent, ship it.']) };
      }
    }
    return null;
  }

  idleActivity(b: Bot): Activity {
    const rank = this.state.levels.find((l) => l.id === b.level_id)?.rank ?? 5;
    const r = Math.random();
    const reports = this.state.bots.filter((x) => x.manager_id === b.id);
    if (rank <= 3 && reports.length && r < 0.18) {
      const rep = pick(reports);
      return { kind: 'talk', action: 'idle', partnerId: rep.id, label: '1:1 check-in', duration: 4, anim: 'Talk', icon: '🤝', bubble: `${rep.name}, how's your workload?`, partnerReply: pick(['All good!', 'A bit swamped 😅', 'Need a decision on scope.']) };
    }
    if (r < 0.4) {
      const spot = this.breakSpot();
      if (spot) return { kind: 'spot', action: 'break', spot, label: 'Coffee break', duration: 5, anim: 'Idle', icon: '☕', bubble: pick(['☕ Recharging…', 'Coffee first.', 'Quick stretch break']) };
    }
    return {
      kind: 'desk', action: 'idle', label: 'Routine work', duration: 4 + Math.random() * 3, anim: 'Typing', icon: '💻',
      bubble: rank <= 1 ? pick(['Reviewing company KPIs…', 'Reading board memo…', 'Thinking about strategy']) : pick(['Clearing inbox…', 'Refactoring old code…', 'Updating docs…', 'Waiting for new tasks']),
    };
  }

  /** Management created a project → kickoff meeting in the boardroom. */
  kickoff(projectId: number) {
    window.setTimeout(() => {
      this.dispatch();
      const st = this.state;
      const p = st.projects.find((x) => x.id === projectId);
      if (!p) return;
      const ids = new Set<number>([p.owner_id, ...st.tasks.filter((t) => t.project_id === p.id && t.assignee_id != null).map((t) => t.assignee_id!)]);
      this.log('project', `🚀 Kickoff: "${p.name}" — ${[...ids].map((i) => this.bot(i)?.name).filter(Boolean).join(', ')} heading to the boardroom.`, p.owner_id);
      for (const id of ids) {
        const rt = this.runtimes.get(id);
        if (!rt) continue;
        rt.queue.unshift({ kind: 'meeting', action: 'kickoff', label: `Kickoff: ${short(p.name, 24)}`, duration: 7, anim: 'Talk', icon: '🚀', bubble: id === p.owner_id ? `Welcome! Goal: ${short(p.description || p.name, 40)}` : `Excited to work on ${short(p.name, 24)}!` });
        if (rt.activity && (rt.activity.action === 'idle' || rt.activity.action === 'break')) { rt.activity = null; }
      }
    }, 50);
  }

  // ---------------- per-bot update ----------------
  targetOf(rt: BotRuntime): [number, number] {
    const a = rt.activity!;
    if (a.kind === 'talk') {
      const p = this.runtimes.get(a.partnerId!);
      if (p) {
        const dx = rt.x - p.x, dz = rt.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        return [p.x + (dx / d) * 1.1, p.z + (dz / d) * 1.1];
      }
    }
    if (a.spot) return [a.spot.x, a.spot.z];
    const b = this.bot(rt.id);
    const h = b ? this.home(b) : { x: rt.x, z: rt.z };
    return [h.x, h.z];
  }
  routeTo(rt: BotRuntime, [tx, tz]: [number, number]) {
    rt.path = this.grid && Math.hypot(tx - rt.x, tz - rt.z) > 0.3 ? findPath(this.grid, rt.x, rt.z, tx, tz) : [];
  }

  start(rt: BotRuntime, a: Activity) {
    const b = this.bot(rt.id)!;
    rt.activity = a;
    rt.retries = 0;
    rt.face = null;
    if (a.kind === 'meeting') {
      const m = this.meetingSpot(rt.id);
      if (m) { a.spot = m.spot; a.meetingKey = m.key; }
    }
    if (a.kind === 'desk') { const h = this.home(b); a.spot = h; }
    if (a.kind === 'talk' && !this.runtimes.has(a.partnerId!)) { a.kind = 'desk'; a.spot = this.home(b); a.anim = 'Typing'; }
    if (a.stepIndex !== undefined && a.taskId) {
      rt.stepIndex = a.stepIndex;
      this.log('thought', `${a.icon} ${b.name} · Step ${a.stepIndex + 1}/${rt.plan.length} · ${a.label} — "${a.bubble}"`, b.id);
      if (a.action === 'review') this.state.patchTask({ id: a.taskId, status: 'review' });
    }
    this.routeTo(rt, this.targetOf(rt));
    rt.phase = 'travel';
    rt.repathTimer = 0;
    if (!rt.path.length) this.arrive(rt);
    else { rt.anim = 'Walk'; rt.state = 'walking'; rt.icon = '🚶'; rt.bubble = a.kind === 'talk' ? `→ ${this.bot(a.partnerId)?.name}` : a.kind === 'meeting' ? '→ Boardroom' : a.action === 'break' ? '→ Lounge' : ''; }
  }

  arrive(rt: BotRuntime) {
    const a = rt.activity!;
    if (a.kind === 'talk') {
      const p = this.runtimes.get(a.partnerId!);
      if (p && Math.hypot(p.x - rt.x, p.z - rt.z) > 2.0 && rt.retries < 6) {
        rt.retries++;
        this.routeTo(rt, this.targetOf(rt));
        if (rt.path.length) return;
      }
      if (p) {
        p.locked = a.duration;
        p.lockFace = [rt.x, rt.z];
        p.lockBubble = a.partnerReply ?? '👍';
        rt.face = [p.x, p.z];
      }
    } else if (a.spot) {
      if (a.kind === 'desk') { rt.x = a.spot.x; rt.z = a.spot.z; }
      rt.face = [a.spot.faceX, a.spot.faceZ];
    }
    rt.phase = 'perform';
    rt.timer = a.duration;
    rt.anim = a.anim;
    rt.icon = a.icon;
    rt.bubble = a.bubble;
    rt.state = a.kind === 'talk' ? 'talking' : a.kind === 'meeting' ? 'meeting' : a.action === 'break' ? 'break' : a.anim === 'Typing' ? 'working' : 'idle';
  }

  finish(rt: BotRuntime) {
    const a = rt.activity!;
    if (a.meetingKey) this.meetingSeats.delete(a.meetingKey);
    if (a.kind === 'talk' && a.action === 'approval') this.log('guard', `✅ ${this.bot(a.partnerId)?.name} approved ${this.bot(rt.id)?.name}'s request.`, a.partnerId ?? null);
    if (a.taskId && a.stepIndex !== undefined) {
      const total = rt.plan.length;
      const done = a.stepIndex + 1;
      const task = this.state.tasks.find((t) => t.id === a.taskId);
      if (task) {
        if (done >= total) {
          this.state.patchTask({ id: task.id, status: 'done', progress: 1 });
          this.log('done', `✅ ${this.bot(rt.id)?.name} completed "${short(task.title, 44)}"`, rt.id);
          rt.taskId = null;
        } else this.state.patchTask({ id: task.id, progress: done / total });
      }
    }
    rt.activity = null;
  }

  update(rt: BotRuntime, dt: number) {
    if (rt.locked > 0) {
      rt.locked -= dt;
      rt.anim = 'Talk';
      rt.state = 'talking';
      rt.bubble = rt.lockBubble;
      rt.icon = '💬';
      if (rt.lockFace) rt.face = rt.lockFace;
      this.turn(rt, dt);
      if (rt.locked <= 0) {
        rt.lockFace = null;
        if (rt.activity) {
          if (rt.phase === 'travel') { rt.anim = 'Walk'; rt.state = 'walking'; this.routeTo(rt, this.targetOf(rt)); }
          else { rt.anim = rt.activity.anim; rt.bubble = rt.activity.bubble; rt.icon = rt.activity.icon; rt.face = rt.activity.spot ? [rt.activity.spot.faceX, rt.activity.spot.faceZ] : rt.face; }
        }
      }
      return;
    }
    if (rt.taskId != null) {
      const st = this.state;
      const t = st.tasks.find((x) => x.id === rt.taskId);
      const p = t && st.projects.find((x) => x.id === t.project_id);
      if (!t || !p || t.assignee_id !== rt.id || p.status !== 'active' || t.status === 'blocked') {
        rt.queue = rt.queue.filter((a) => !a.taskId);
        if (rt.activity?.taskId) { if (rt.activity.meetingKey) this.meetingSeats.delete(rt.activity.meetingKey); rt.activity = null; }
        rt.taskId = null; rt.plan = []; rt.stepIndex = -1;
      }
    }
    if (!rt.activity) {
      const next = rt.queue.shift() ?? this.planNext(rt);
      if (!next) return;
      this.start(rt, next);
      return;
    }
    const a = rt.activity;
    if (rt.phase === 'travel') {
      if (a.kind === 'talk') {
        rt.repathTimer += dt;
        const p = this.runtimes.get(a.partnerId!);
        if (p && Math.hypot(p.x - rt.x, p.z - rt.z) < 1.6) { rt.path = []; }
        else if (rt.repathTimer > 1.2) { rt.repathTimer = 0; this.routeTo(rt, this.targetOf(rt)); }
      }
      let move = WALK_SPEED * dt;
      while (move > 0 && rt.path.length) {
        const [tx, tz] = rt.path[0];
        const dx = tx - rt.x, dz = tz - rt.z;
        const d = Math.hypot(dx, dz);
        if (d <= move) { rt.x = tx; rt.z = tz; rt.path.shift(); move -= d; }
        else { rt.x += (dx / d) * move; rt.z += (dz / d) * move; move = 0; rt.face = [tx, tz]; }
      }
      this.turn(rt, dt);
      if (!rt.path.length) this.arrive(rt);
      return;
    }
    if (a.kind === 'talk') {
      const p = this.runtimes.get(a.partnerId!);
      if (p) { p.locked = Math.max(p.locked, Math.min(rt.timer, 0.3)); p.lockFace = [rt.x, rt.z]; rt.face = [p.x, p.z]; }
    }
    // When clicked/selected by the user while working at their workstation, the bot stands up
    if (a.kind === 'desk') {
      if (this.state.selectedBotId === rt.id) {
        rt.anim = 'Idle';
        rt.timer = Math.max(rt.timer, 1.5);
      } else {
        rt.anim = a.anim;
      }
    }
    this.turn(rt, dt);
    rt.timer -= dt;
    if (rt.timer <= 0) this.finish(rt);
  }

  turn(rt: BotRuntime, dt: number) {
    if (!rt.face) return;
    const dx = rt.face[0] - rt.x, dz = rt.face[1] - rt.z;
    if (Math.abs(dx) + Math.abs(dz) < 0.01) return;
    const target = Math.atan2(dx, dz);
    let diff = target - rt.rot;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    rt.rot += diff * Math.min(1, dt * 10);
  }

  flushUi() {
    const out: Record<number, BotStatus> = {};
    for (const rt of this.runtimes.values()) {
      out[rt.id] = { state: rt.state, bubble: rt.bubble, icon: rt.icon, taskId: rt.taskId, stepIndex: rt.stepIndex, steps: rt.plan, load: this.load(rt.id) };
    }
    useSimUi.getState().set(out);
  }
}

export const sim = new Simulation();
