import type { Furniture, FurnitureType } from '../types';

export interface CatalogItem {
  type: FurnitureType;
  label: string;
  icon: string;
  w: number; // footprint X (unrotated)
  d: number; // footprint Z (unrotated)
  color: string;
  tris: number; // measured triangle count of the merged mesh (see docs/ART_BUDGET.md)
  seats: [number, number][]; // local seat/standing positions (unrotated)
  /** 'prop' (default) blocks navigation; 'surface' is walkable floor; 'vehicle' blocks nav and has a door. */
  category?: 'prop' | 'surface' | 'vehicle';
  /** Vehicles: local point beside the door where a bot stands to enter/exit. */
  entry?: [number, number];
  /** Vehicles: drives the Enter/Exit clip family. */
  vehicle?: 'car' | 'bike';
  /** Sport surfaces: which sport bots play/run on it. */
  sport?: 'football' | 'basketball';
}

export const CATALOG: Record<FurnitureType, CatalogItem> = {
  desk: { type: 'desk', label: 'Workstation', icon: '💻', w: 1.8, d: 0.9, color: '#c8a77e', tris: 468, seats: [[0, 0.48]] },
  exec_desk: { type: 'exec_desk', label: 'Executive Desk', icon: '🪑', w: 2.4, d: 1.0, color: '#6b4226', tris: 396, seats: [[0, 0.48]] },
  meeting_table: {
    type: 'meeting_table', label: 'Meeting Table', icon: '🤝', w: 4, d: 1.8, color: '#e7dcc8', tris: 132,
    seats: [[-1.3, 1.35], [0, 1.35], [1.3, 1.35], [-1.3, -1.35], [0, -1.35], [1.3, -1.35], [-2.5, 0], [2.5, 0]],
  },
  plant: { type: 'plant', label: 'Plant', icon: '🪴', w: 0.7, d: 0.7, color: '#22c55e', tris: 60, seats: [] },
  sofa: { type: 'sofa', label: 'Sofa', icon: '🛋️', w: 2.2, d: 0.9, color: '#64748b', tris: 72, seats: [[0, 1.0]] },
  server_rack: { type: 'server_rack', label: 'Server Rack', icon: '🗄️', w: 0.9, d: 0.9, color: '#1f2937', tris: 132, seats: [[0, 0.95]] },
  whiteboard: { type: 'whiteboard', label: 'Whiteboard', icon: '📋', w: 2, d: 0.3, color: '#f8fafc', tris: 96, seats: [[0, 0.9]] },
  coffee_machine: { type: 'coffee_machine', label: 'Coffee Bar', icon: '☕', w: 1.4, d: 0.7, color: '#78350f', tris: 72, seats: [[0, 0.9]] },
  bookshelf: { type: 'bookshelf', label: 'Bookshelf', icon: '📚', w: 1.6, d: 0.45, color: '#92400e', tris: 192, seats: [[0, 0.8]] },
  water_cooler: { type: 'water_cooler', label: 'Water Cooler', icon: '🚰', w: 0.6, d: 0.6, color: '#93c5fd', tris: 36, seats: [[0, 0.8]] },
  printer: { type: 'printer', label: 'Printer', icon: '🖨️', w: 0.9, d: 0.7, color: '#d1d5db', tris: 48, seats: [[0, 0.85]] },

  // ---- Parking Lot vehicles (long axis = Z, doors on +X side) ----
  car_mpv_luxury: {
    type: 'car_mpv_luxury', label: 'Luxury MPV', icon: '🚐', w: 2.2, d: 4.9, color: '#1e293b', tris: 204,
    seats: [], category: 'vehicle', vehicle: 'car', entry: [1.65, 0],
  },
  car_sedan_sport: {
    type: 'car_sedan_sport', label: 'Sporty Sedan', icon: '🏎️', w: 2.0, d: 4.6, color: '#dc2626', tris: 204,
    seats: [], category: 'vehicle', vehicle: 'car', entry: [1.55, 0],
  },
  moto_big: {
    type: 'moto_big', label: 'Big Motorcycle', icon: '🏍️', w: 0.9, d: 2.3, color: '#374151', tris: 156,
    seats: [], category: 'vehicle', vehicle: 'bike', entry: [0.85, 0],
  },
  moto_sport: {
    type: 'moto_sport', label: 'Sport Motorcycle', icon: '🛵', w: 0.7, d: 2.0, color: '#f97316', tris: 108,
    seats: [], category: 'vehicle', vehicle: 'bike', entry: [0.75, 0],
  },

  // ---- Sport Area surfaces (walkable, drawn with line markings) ----
  football_pitch: {
    type: 'football_pitch', label: 'Football Pitch', icon: '⚽', w: 12, d: 8, color: '#16a34a', tris: 492,
    seats: [], category: 'surface', sport: 'football',
  },
  basketball_court: {
    type: 'basketball_court', label: 'Basketball Court', icon: '🏀', w: 9, d: 5, color: '#c2410c', tris: 360, // w includes the hoops
    seats: [], category: 'surface', sport: 'basketball',
  },
};

/** World-space footprint half extents for a rotated piece. */
export function footprint(f: Pick<Furniture, 'type' | 'rot'>) {
  const c = CATALOG[f.type];
  const quarter = Math.round(f.rot / (Math.PI / 2)) % 2 !== 0;
  return { hw: (quarter ? c.d : c.w) / 2, hd: (quarter ? c.w : c.d) / 2 };
}

/** Rotate a local offset by furniture rotation (Y axis). */
export function localToWorld(f: Pick<Furniture, 'x' | 'z' | 'rot'>, lx: number, lz: number): [number, number] {
  const c = Math.cos(f.rot);
  const s = Math.sin(f.rot);
  return [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
}

export function seatPoints(f: Furniture): { x: number; z: number; faceX: number; faceZ: number }[] {
  return CATALOG[f.type].seats.map(([lx, lz]) => {
    const [x, z] = localToWorld(f, lx, lz);
    return { x, z, faceX: f.x, faceZ: f.z };
  });
}

/** Vehicle door spot in world space (bot stands here to enter / exit). */
export function entryPoint(f: Furniture): { x: number; z: number; faceX: number; faceZ: number } | undefined {
  const e = CATALOG[f.type].entry;
  if (!e) return undefined;
  const [x, z] = localToWorld(f, e[0], e[1]);
  return { x, z, faceX: f.x, faceZ: f.z };
}
