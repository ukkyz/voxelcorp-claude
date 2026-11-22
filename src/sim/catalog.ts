import type { Furniture, FurnitureType } from '../types';

export interface CatalogItem {
  type: FurnitureType;
  label: string;
  icon: string;
  w: number; // footprint X (unrotated)
  d: number; // footprint Z (unrotated)
  color: string;
  tris: number; // approx triangle cost (tech-art budget)
  seats: [number, number][]; // local seat/standing positions (unrotated)
}

export const CATALOG: Record<FurnitureType, CatalogItem> = {
  desk: { type: 'desk', label: 'Workstation', icon: '💻', w: 1.8, d: 0.9, color: '#c8a77e', tris: 420, seats: [[0, 0.48]] },
  exec_desk: { type: 'exec_desk', label: 'Executive Desk', icon: '🪑', w: 2.4, d: 1.0, color: '#6b4226', tris: 348, seats: [[0, 0.48]] },
  meeting_table: {
    type: 'meeting_table', label: 'Meeting Table', icon: '🤝', w: 4, d: 1.8, color: '#e7dcc8', tris: 220,
    seats: [[-1.3, 1.35], [0, 1.35], [1.3, 1.35], [-1.3, -1.35], [0, -1.35], [1.3, -1.35], [-2.5, 0], [2.5, 0]],
  },
  plant: { type: 'plant', label: 'Plant', icon: '🪴', w: 0.7, d: 0.7, color: '#22c55e', tris: 48, seats: [] },
  sofa: { type: 'sofa', label: 'Sofa', icon: '🛋️', w: 2.2, d: 0.9, color: '#64748b', tris: 60, seats: [[0, 1.0]] },
  server_rack: { type: 'server_rack', label: 'Server Rack', icon: '🗄️', w: 0.9, d: 0.9, color: '#1f2937', tris: 72, seats: [[0, 0.95]] },
  whiteboard: { type: 'whiteboard', label: 'Whiteboard', icon: '📋', w: 2, d: 0.3, color: '#f8fafc', tris: 36, seats: [[0, 0.9]] },
  coffee_machine: { type: 'coffee_machine', label: 'Coffee Bar', icon: '☕', w: 1.4, d: 0.7, color: '#78350f', tris: 60, seats: [[0, 0.9]] },
  bookshelf: { type: 'bookshelf', label: 'Bookshelf', icon: '📚', w: 1.6, d: 0.45, color: '#92400e', tris: 84, seats: [[0, 0.8]] },
  water_cooler: { type: 'water_cooler', label: 'Water Cooler', icon: '🚰', w: 0.6, d: 0.6, color: '#93c5fd', tris: 36, seats: [[0, 0.8]] },
  printer: { type: 'printer', label: 'Printer', icon: '🖨️', w: 0.9, d: 0.7, color: '#d1d5db', tris: 36, seats: [[0, 0.85]] },
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
