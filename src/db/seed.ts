import type { Guardrail, Skill, WorkflowStep } from '../types';

export const SKILL_LIBRARY = [
  'Leadership', 'Strategy', 'Communication', 'Backend', 'Frontend', 'DevOps', 'Security', 'Machine Learning',
  'Data Analysis', 'Product Strategy', 'UX Research', 'Visual Design', 'Sales', 'Marketing', 'Copywriting',
  'Finance', 'Legal & Compliance', 'Operations', 'Shader & VFX', 'QA Testing',
];

let uid = 0;
export const sid = (p = 'x') => `${p}_${Date.now().toString(36)}_${(uid++).toString(36)}`;

export const WORKFLOW_TEMPLATES: Record<string, Omit<WorkflowStep, 'id'>[]> = {
  Specialist: [
    { action: 'think', label: 'Understand the task & constraints', duration: 3 },
    { action: 'research', label: 'Research prior art & internal docs', duration: 4 },
    { action: 'consult_peer', label: 'Clarify edge cases with a peer', duration: 4 },
    { action: 'execute', label: 'Execute the deliverable', duration: 8 },
    { action: 'review', label: 'Self-review against acceptance criteria', duration: 3 },
    { action: 'report', label: 'Report result to manager', duration: 4 },
  ],
  Manager: [
    { action: 'think', label: 'Analyze scope & risks', duration: 3 },
    { action: 'consult_manager', label: 'Align priorities with leadership', duration: 4 },
    { action: 'meeting', label: 'Run team sync in the boardroom', duration: 6 },
    { action: 'execute', label: 'Coordinate & unblock execution', duration: 6 },
    { action: 'review', label: 'Quality gate review', duration: 4 },
    { action: 'report', label: 'Report status to project owner', duration: 4 },
  ],
  Executive: [
    { action: 'think', label: 'Frame strategic objective', duration: 3 },
    { action: 'meeting', label: 'Executive sync in boardroom', duration: 6 },
    { action: 'execute', label: 'Make decision & allocate resources', duration: 5 },
    { action: 'report', label: 'Communicate decision to stakeholders', duration: 4 },
  ],
};

export const workflowFrom = (t: keyof typeof WORKFLOW_TEMPLATES): WorkflowStep[] =>
  WORKFLOW_TEMPLATES[t].map((s) => ({ ...s, id: sid('st') }));

export const GUARDRAIL_DEFAULTS: Record<Guardrail['type'], { label: string; value: string; help: string }> = {
  approval_priority: { label: 'Require manager approval at priority ≥', value: 'critical', help: 'Bot must walk to its manager and get sign-off before executing tasks of this priority or higher.' },
  budget_limit: { label: 'Escalate when project budget exceeds', value: '50000', help: 'Spending authority. Projects above this budget require escalation up the hierarchy.' },
  division_scope: { label: 'Division scope', value: 'strict', help: 'strict = cross-division tasks need approval from own manager. open = allowed freely.' },
  blocked_keywords: { label: 'Refuse tasks containing', value: 'personal data, bypass security, layoffs', help: 'Comma-separated topics. The bot refuses, flags and escalates to its manager.' },
  max_concurrent: { label: 'Max concurrent tasks', value: '2', help: 'Capacity limit — the assignment engine skips this bot when at capacity.' },
  peer_review: { label: 'Mandatory peer review', value: 'on', help: 'Inject a consult_peer review step after every execute step.' },
};

export const guard = (type: Guardrail['type'], value?: string, enabled = true): Guardrail => ({
  id: sid('g'), type, label: GUARDRAIL_DEFAULTS[type].label, value: value ?? GUARDRAIL_DEFAULTS[type].value, enabled,
});

export const LEVELS = [
  { id: 1, name: 'C-Suite', rank: 0, can: 1, color: '#f59e0b' },
  { id: 2, name: 'Vice President', rank: 1, can: 1, color: '#a855f7' },
  { id: 3, name: 'Director', rank: 2, can: 1, color: '#3b82f6' },
  { id: 4, name: 'Manager', rank: 3, can: 1, color: '#14b8a6' },
  { id: 5, name: 'Lead', rank: 4, can: 0, color: '#22c55e' },
  { id: 6, name: 'Specialist', rank: 5, can: 0, color: '#94a3b8' },
];

export const DIVISIONS = [
  { id: 1, name: 'Executive Office', color: '#f59e0b', parent: null, desc: 'Corporate strategy, governance and board relations.' },
  { id: 2, name: 'Engineering', color: '#3b82f6', parent: null, desc: 'Builds and operates the product platform.' },
  { id: 3, name: 'Product & Design', color: '#a855f7', parent: null, desc: 'Product discovery, roadmap and experience design.' },
  { id: 4, name: 'Sales & Marketing', color: '#f97316', parent: null, desc: 'Go-to-market, pipeline and brand.' },
  { id: 5, name: 'Operations & Finance', color: '#10b981', parent: null, desc: 'Finance, legal, people operations.' },
  { id: 6, name: 'Platform', color: '#0ea5e9', parent: 2, desc: 'Core services, infrastructure, rendering tech.' },
  { id: 7, name: 'AI Research', color: '#6366f1', parent: 2, desc: 'Applied ML, agents and evaluation.' },
];

const S = (...pairs: [string, number][]): Skill[] => pairs.map(([name, level]) => ({ name, level }));

// room index refers to ROOMS order (1-based ids)
export const BOTS = [
  { name: 'Ava', title: 'Chief Executive Officer', level: 1, div: 1, mgr: null, wf: 'Executive', hair: '#2d1b10', persona: 'Visionary, decisive, concise.', skills: S(['Leadership', 5], ['Strategy', 5], ['Communication', 4]) },
  { name: 'Nora', title: 'Chief of Staff', level: 3, div: 1, mgr: 1, wf: 'Manager', hair: '#b45309', persona: 'Organized operator, keeps execs aligned.', skills: S(['Operations', 4], ['Communication', 5], ['Strategy', 3]) },
  { name: 'Marcus', title: 'Chief Technology Officer', level: 1, div: 2, mgr: 1, wf: 'Executive', hair: '#111827', persona: 'Pragmatic architect, hates tech debt.', skills: S(['Leadership', 4], ['Backend', 4], ['Security', 4], ['Strategy', 4]) },
  { name: 'Kenji', title: 'Platform Engineering Manager', level: 4, div: 6, mgr: 3, wf: 'Manager', hair: '#1f2937', persona: 'Calm, metrics-driven, protects the team.', skills: S(['Leadership', 3], ['DevOps', 4], ['Backend', 4]) },
  { name: 'Theo', title: 'Senior Backend Engineer', level: 6, div: 6, mgr: 4, wf: 'Specialist', hair: '#7c2d12', persona: 'Detail-obsessed, writes tests first.', skills: S(['Backend', 5], ['DevOps', 3], ['Security', 3]) },
  { name: 'Mia', title: 'Technical Artist / Frontend', level: 5, div: 6, mgr: 4, wf: 'Specialist', hair: '#db2777', persona: 'Bilingual in art and code, budget-vigilant.', skills: S(['Frontend', 5], ['Shader & VFX', 5], ['Visual Design', 3]) },
  { name: 'Priya', title: 'AI Research Lead', level: 5, div: 7, mgr: 3, wf: 'Manager', hair: '#0f172a', persona: 'Rigorous, evaluation-first scientist.', skills: S(['Machine Learning', 5], ['Data Analysis', 4], ['Leadership', 3]) },
  { name: 'Omar', title: 'ML Engineer', level: 6, div: 7, mgr: 7, wf: 'Specialist', hair: '#292524', persona: 'Ships models fast, monitors drift.', skills: S(['Machine Learning', 4], ['Backend', 3], ['Data Analysis', 4]) },
  { name: 'Lena', title: 'Chief Product Officer', level: 1, div: 3, mgr: 1, wf: 'Executive', hair: '#facc15', persona: 'Customer-obsessed, data-informed.', skills: S(['Product Strategy', 5], ['Leadership', 4], ['UX Research', 3]) },
  { name: 'Leo', title: 'Product Manager', level: 4, div: 3, mgr: 9, wf: 'Manager', hair: '#57534e', persona: 'Writes crisp specs, loves roadmaps.', skills: S(['Product Strategy', 4], ['Communication', 4], ['Data Analysis', 3]) },
  { name: 'Zoe', title: 'Product Designer', level: 6, div: 3, mgr: 10, wf: 'Specialist', hair: '#7c3aed', persona: 'Empathetic, pixel-precise.', skills: S(['Visual Design', 5], ['UX Research', 4], ['Frontend', 2]) },
  { name: 'Sofia', title: 'Chief Marketing Officer', level: 1, div: 4, mgr: 1, wf: 'Executive', hair: '#991b1b', persona: 'Storyteller, growth-minded.', skills: S(['Marketing', 5], ['Sales', 4], ['Leadership', 4]) },
  { name: 'Ines', title: 'Enterprise Account Executive', level: 6, div: 4, mgr: 12, wf: 'Specialist', hair: '#0c0a09', persona: 'Relationship builder, closes deals.', skills: S(['Sales', 5], ['Communication', 4]) },
  { name: 'Felix', title: 'Content Marketing Lead', level: 5, div: 4, mgr: 12, wf: 'Specialist', hair: '#ea580c', persona: 'Witty writer, SEO nerd.', skills: S(['Copywriting', 5], ['Marketing', 4]) },
  { name: 'Raj', title: 'Chief Operating Officer', level: 1, div: 5, mgr: 1, wf: 'Executive', hair: '#1c1917', persona: 'Process thinker, risk-aware.', skills: S(['Operations', 5], ['Finance', 4], ['Legal & Compliance', 3]) },
  { name: 'Hugo', title: 'Finance & Compliance Analyst', level: 6, div: 5, mgr: 15, wf: 'Specialist', hair: '#78716c', persona: 'Spreadsheet wizard, audit-ready.', skills: S(['Finance', 5], ['Legal & Compliance', 4], ['Data Analysis', 3]) },
];

export const ROOMS = [
  { name: 'Executive Suite', type: 'executive', x: -16, z: -10, w: 12, d: 9, color: '#fde68a', div: 1, door: 's' },
  { name: 'Engineering Bay', type: 'office', x: 0, z: -10, w: 14, d: 9, color: '#bfdbfe', div: 6, door: 's' },
  { name: 'AI Research Lab', type: 'lab', x: 15, z: -10, w: 11, d: 9, color: '#c7d2fe', div: 7, door: 's' },
  { name: 'Product Studio', type: 'office', x: -16, z: 10, w: 12, d: 9, color: '#e9d5ff', div: 3, door: 'n' },
  { name: 'Sales Floor', type: 'office', x: 0, z: 10, w: 14, d: 9, color: '#fed7aa', div: 4, door: 'n' },
  { name: 'Ops & Finance', type: 'office', x: 15, z: 10, w: 11, d: 9, color: '#a7f3d0', div: 5, door: 'n' },
  { name: 'Boardroom', type: 'meeting', x: 24.5, z: 0, w: 6, d: 12, color: '#e2e8f0', div: null, door: 'w' },
  { name: 'Lounge', type: 'lounge', x: -24, z: 0, w: 7, d: 10, color: '#fecdd3', div: null, door: 'e' },
];

// [type, roomIndex(0-based), localX, localZ, rot, botIndex(0-based)|-1]
export const FURNITURE: [string, number, number, number, number, number][] = [
  // Executive Suite
  ['exec_desk', 0, -2.5, -2, 0, 0], ['desk', 0, 2.5, -2, 0, 1], ['bookshelf', 0, -4, -4.1, 0, -1],
  ['plant', 0, 5.3, -3.8, 0, -1], ['plant', 0, -5.3, 3.8, 0, -1], ['sofa', 0, 3, 3.2, Math.PI, -1],
  // Engineering Bay
  ['exec_desk', 1, -3.5, -2.3, 0, 2], ['desk', 1, 0.5, -2.3, 0, 3], ['desk', 1, 3.8, -2.3, 0, 4],
  ['desk', 1, -3.5, 1, 0, 5], ['desk', 1, 3.8, 1, 0, -1], ['whiteboard', 1, 0, -4.2, 0, -1],
  ['server_rack', 1, 6.2, 3.7, Math.PI, -1], ['plant', 1, -6.3, 3.8, 0, -1],
  // AI Lab
  ['desk', 2, -2.5, -2.3, 0, 6], ['desk', 2, 2, -2.3, 0, 7], ['server_rack', 2, 4.8, 1.5, -Math.PI / 2, -1],
  ['server_rack', 2, 4.8, 2.6, -Math.PI / 2, -1], ['whiteboard', 2, -2, 1.5, 0, -1], ['plant', 2, -4.8, 3.8, 0, -1],
  // Product Studio
  ['exec_desk', 3, -2.5, -2, 0, 8], ['desk', 3, 2.2, -2, 0, 9], ['desk', 3, 2.2, 1.4, 0, 10],
  ['whiteboard', 3, -2.5, 1.6, 0, -1], ['plant', 3, 5.3, 3.8, 0, -1], ['bookshelf', 3, -4, 4.1, Math.PI, -1],
  // Sales Floor
  ['exec_desk', 4, -3.5, -2, 0, 11], ['desk', 4, 0.5, -2, 0, 12], ['desk', 4, 3.8, -2, 0, 13],
  ['desk', 4, 0.5, 1.4, 0, -1], ['printer', 4, 6.2, 3.8, Math.PI, -1], ['plant', 4, -6.3, 3.8, 0, -1],
  // Ops & Finance
  ['exec_desk', 5, -2.5, -2, 0, 14], ['desk', 5, 2, -2, 0, 15], ['bookshelf', 5, 2, 4.1, Math.PI, -1],
  ['printer', 5, -4.8, 3.8, Math.PI, -1], ['plant', 5, 4.8, 3.8, 0, -1],
  // Boardroom
  ['meeting_table', 6, 0, 0, Math.PI / 2, -1], ['whiteboard', 6, 2.75, 0, -Math.PI / 2, -1], ['plant', 6, -2.3, 5.3, 0, -1], ['plant', 6, -2.3, -5.3, 0, -1],
  // Lounge
  ['sofa', 7, -2.4, 0, Math.PI / 2, -1], ['coffee_machine', 7, 0, -4.3, 0, -1], ['water_cooler', 7, 2.5, -4.3, 0, -1],
  ['plant', 7, 2.8, 4.3, 0, -1], ['plant', 7, -2.8, 4.3, 0, -1],
];

export const SAMPLE_PROJECTS = [
  {
    name: 'Voxel Office Rendering Optimization', owner: 3, div: 6, priority: 'high', budget: 40000,
    desc: 'Cut draw calls 40% via instancing + texture atlasing; ship mobile-safe shader variants.',
    tasks: [['Atlas UI and prop textures (ASTC 6x6)', 'Shader & VFX'], ['Implement GPU instancing for props', 'Frontend'], ['Profile frame budget on target devices', 'DevOps']],
  },
  {
    name: 'Agent Evaluation Harness', owner: 7, div: 7, priority: 'critical', budget: 75000,
    desc: 'Automated eval suite for bot reasoning quality and guardrail adherence.',
    tasks: [['Build eval dataset of workflow traces', 'Data Analysis'], ['Train guardrail classifier', 'Machine Learning'], ['Expose eval API endpoint', 'Backend']],
  },
  {
    name: 'Q3 Enterprise Launch Campaign', owner: 12, div: 4, priority: 'medium', budget: 30000,
    desc: 'Coordinated launch across content, sales enablement and finance sign-off.',
    tasks: [['Write launch blog & landing copy', 'Copywriting'], ['Prepare enterprise pitch deck', 'Sales'], ['Design hero visuals', 'Visual Design'], ['Approve campaign budget', 'Finance']],
  },
];
