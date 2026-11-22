export interface Level {
  id: number;
  name: string;
  rank: number; // 0 = top of hierarchy
  can_create_projects: number; // 0/1
  color: string;
}

export interface Division {
  id: number;
  name: string;
  color: string;
  parent_id: number | null;
  head_bot_id: number | null;
  description: string;
}

export interface Skill {
  name: string;
  level: number; // 1-5
}

export type GuardrailType =
  | 'approval_priority'
  | 'budget_limit'
  | 'division_scope'
  | 'blocked_keywords'
  | 'max_concurrent'
  | 'peer_review';

export interface Guardrail {
  id: string;
  type: GuardrailType;
  label: string;
  value: string;
  enabled: boolean;
}

export type StepAction =
  | 'think'
  | 'research'
  | 'consult_manager'
  | 'consult_peer'
  | 'meeting'
  | 'execute'
  | 'review'
  | 'report';

export interface WorkflowStep {
  id: string;
  action: StepAction;
  label: string;
  duration: number; // seconds of sim time
}

export type BotBody = 'male' | 'female';

export interface Bot {
  id: number;
  name: string;
  title: string;
  level_id: number;
  division_id: number;
  manager_id: number | null;
  shirt_color: string;
  hair_color: string;
  accent_color: string;
  /** Body model. Same rig and clip names for both; default 'male'. */
  body: BotBody;
  persona: string;
  skills: Skill[];
  guardrails: Guardrail[];
  workflow: WorkflowStep[];
  desk_id: number | null;
}

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type ProjectStatus = 'planning' | 'active' | 'blocked' | 'done';

export interface Project {
  id: number;
  name: string;
  description: string;
  division_id: number;
  owner_id: number;
  priority: Priority;
  budget: number;
  status: ProjectStatus;
  created_at: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done';

export interface Task {
  id: number;
  project_id: number;
  title: string;
  skill: string;
  assignee_id: number | null;
  status: TaskStatus;
  progress: number;
}

export type RoomType = 'office' | 'executive' | 'meeting' | 'lounge' | 'lab' | 'open' | 'parking' | 'sport';
export type DoorSide = 'n' | 's' | 'e' | 'w';

export interface Room {
  id: number;
  name: string;
  type: RoomType;
  x: number;
  z: number;
  w: number;
  d: number;
  color: string;
  division_id: number | null;
  door_side: DoorSide;
}

export type FurnitureType =
  | 'desk'
  | 'exec_desk'
  | 'meeting_table'
  | 'plant'
  | 'sofa'
  | 'server_rack'
  | 'whiteboard'
  | 'coffee_machine'
  | 'bookshelf'
  | 'water_cooler'
  | 'printer'
  | 'car_mpv_luxury'
  | 'car_sedan_sport'
  | 'moto_big'
  | 'moto_sport'
  | 'football_pitch'
  | 'basketball_court';

export interface Furniture {
  id: number;
  type: FurnitureType;
  x: number;
  z: number;
  rot: number; // radians, multiples of PI/2
  room_id: number | null;
  color: string;
}

export interface LogEntry {
  id: number;
  ts: string;
  bot_id: number | null;
  kind: 'info' | 'thought' | 'talk' | 'guard' | 'project' | 'system' | 'done';
  text: string;
}

export interface LayoutSnapshot {
  id: number;
  name: string;
  created_at: string;
  data: string;
}
