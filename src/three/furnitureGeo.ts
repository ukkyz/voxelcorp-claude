import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FurnitureType } from '../types';

/**
 * Voxel furniture kit — every prop is merged into ONE geometry with baked vertex colours,
 * so each piece costs exactly 1 draw call and all props share a single material.
 */
type Part = [w: number, h: number, d: number, x: number, y: number, z: number, color: string];

function build(parts: Part[]) {
  const geos = parts.map(([w, h, d, x, y, z, color]) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  });
  const merged = mergeGeometries(geos)!;
  merged.computeBoundingSphere();
  return merged;
}

export const WORKSTATION_COMPONENTS = [
  { name: 'Office Desk', icon: '🪵' },
  { name: 'Office Chair', icon: '🪑' },
  { name: 'Office Laptop', icon: '💻' },
  { name: 'Coffee Glass', icon: '☕' },
] as const;

// Shared sub-component builders for workstations (Office Chair, Office Laptop, Coffee Glass)
const officeChair = (seatColor = '#1e293b', frameColor = '#475569'): Part[] => [
  // 5-star wheel base & casters at z = 0.70
  [0.46, 0.04, 0.07, 0, 0.05, 0.70, '#0f172a'],
  [0.07, 0.04, 0.46, 0, 0.05, 0.70, '#0f172a'],
  [0.06, 0.05, 0.06, -0.21, 0.025, 0.70, '#020617'],
  [0.06, 0.05, 0.06, 0.21, 0.025, 0.70, '#020617'],
  [0.06, 0.05, 0.06, 0, 0.025, 0.49, '#020617'],
  [0.06, 0.05, 0.06, 0, 0.025, 0.91, '#020617'],
  // Pneumatic cylinder column
  [0.08, 0.36, 0.08, 0, 0.24, 0.70, frameColor],
  // Seat cushion (top at y = 0.47, centered at z = 0.70)
  [0.48, 0.07, 0.40, 0, 0.435, 0.70, seatColor],
  // Left & right armrests
  [0.05, 0.17, 0.05, -0.26, 0.52, 0.70, frameColor],
  [0.05, 0.17, 0.05, 0.26, 0.52, 0.70, frameColor],
  [0.07, 0.035, 0.24, -0.26, 0.61, 0.68, '#0f172a'],
  [0.07, 0.035, 0.24, 0.26, 0.61, 0.68, '#0f172a'],
  // Backrest spine & ergonomic lumbar cushion
  [0.08, 0.38, 0.05, 0, 0.62, 0.91, frameColor],
  [0.44, 0.42, 0.07, 0, 0.78, 0.89, seatColor],
];

const officeLaptop = (screenColor = '#38bdf8'): Part[] => [
  // Aluminum keyboard deck / base
  [0.46, 0.025, 0.30, 0, 0.802, 0.12, '#cbd5e1'],
  // Dark recessed keyboard keys & trackpad
  [0.38, 0.012, 0.15, 0, 0.816, 0.09, '#1e293b'],
  [0.13, 0.011, 0.07, 0, 0.816, 0.21, '#94a3b8'],
  // Hinge & open display bezel
  [0.32, 0.025, 0.025, 0, 0.82, -0.025, '#334155'],
  [0.46, 0.29, 0.022, 0, 0.96, -0.03, '#1e293b'],
  // Illuminated laptop display + code lines
  [0.42, 0.24, 0.01, 0, 0.96, -0.016, screenColor],
  [0.24, 0.025, 0.008, 0.02, 1.02, -0.01, '#e0f2fe'],
  [0.18, 0.025, 0.008, -0.01, 0.96, -0.01, '#fde047'],
  [0.22, 0.025, 0.008, 0.01, 0.90, -0.01, '#a7f3d0'],
];

const coffeeGlass = (gx = 0.44, gz = 0.12): Part[] => [
  // Cork coaster
  [0.16, 0.014, 0.16, gx, 0.797, gz, '#b45309'],
  // Clear/frosted glass body
  [0.11, 0.15, 0.11, gx, 0.88, gz, '#bae6fd'],
  // Dark roast espresso inside glass + crema foam top
  [0.095, 0.11, 0.095, gx, 0.89, gz, '#451a03'],
  [0.096, 0.02, 0.096, gx, 0.955, gz, '#fef3c7'],
  // Warm thermal sleeve band & glass handle
  [0.12, 0.055, 0.12, gx, 0.88, gz, '#d97706'],
  [0.035, 0.08, 0.025, gx + 0.07, 0.88, gz, '#bae6fd'],
];

// ---------- Parking Lot vehicles (long axis = Z, front = +Z, doors on ±X) ----------
const carLuxuryMpv = (): Part[] => [
  // Body + tall greenhouse + roof rail
  [1.9, 0.55, 4.6, 0, 0.42, 0, '#1e293b'],
  [1.8, 0.5, 3.6, 0, 0.95, -0.1, '#334155'],
  [1.85, 0.08, 3.4, 0, 1.22, -0.1, '#0f172a'],
  // Tinted side glass + chrome door seams
  [0.02, 0.36, 3.2, -0.92, 0.95, -0.1, '#38bdf8'], [0.02, 0.36, 3.2, 0.92, 0.95, -0.1, '#38bdf8'],
  [0.02, 0.04, 3.0, -0.96, 0.55, -0.1, '#cbd5e1'], [0.02, 0.04, 3.0, 0.96, 0.55, -0.1, '#cbd5e1'],
  // Windshield, chrome grille, lamps
  [1.6, 0.4, 0.04, 0, 0.98, 1.68, '#38bdf8'],
  [0.9, 0.2, 0.05, 0, 0.5, 2.4, '#e5e7eb'],
  [0.4, 0.08, 0.05, -0.6, 0.6, 2.4, '#fef9c3'], [0.4, 0.08, 0.05, 0.6, 0.6, 2.4, '#fef9c3'],
  [0.4, 0.08, 0.05, -0.6, 0.6, -2.4, '#ef4444'], [0.4, 0.08, 0.05, 0.6, 0.6, -2.4, '#ef4444'],
  // Wheels (4)
  ...[-1, 1].flatMap((sx) => [-1.5, 1.5].map((z): Part => [0.22, 0.42, 0.42, sx * 0.98, 0.21, z, '#0f172a'])),
];

const carSportSedan = (): Part[] => [
  // Low wedge body, racing stripe, cabin + glass
  [1.9, 0.42, 4.3, 0, 0.36, 0, '#dc2626'],
  [0.3, 0.02, 4.2, 0, 0.58, 0, '#f8fafc'],
  [1.4, 0.36, 2.0, 0, 0.75, -0.2, '#1f2937'],
  [0.02, 0.22, 1.7, -0.71, 0.78, -0.2, '#38bdf8'], [0.02, 0.22, 1.7, 0.71, 0.78, -0.2, '#38bdf8'],
  // Rear spoiler, front splitter, lamps
  [1.7, 0.06, 0.25, 0, 0.78, -2.1, '#111827'],
  [0.06, 0.2, 0.06, -0.6, 0.66, -2.0, '#111827'], [0.06, 0.2, 0.06, 0.6, 0.66, -2.0, '#111827'],
  [1.9, 0.04, 0.2, 0, 0.14, 2.2, '#111827'],
  [0.3, 0.06, 0.05, -0.6, 0.45, 2.17, '#fef9c3'], [0.3, 0.06, 0.05, 0.6, 0.45, 2.17, '#fef9c3'],
  [0.3, 0.06, 0.05, -0.6, 0.45, -2.17, '#ef4444'], [0.3, 0.06, 0.05, 0.6, 0.45, -2.17, '#ef4444'],
  // Wheels with rims (4)
  ...[-1, 1].flatMap((sx) => [-1.4, 1.4].map((z): Part => [0.2, 0.5, 0.5, sx * 0.9, 0.25, z, '#111827'])),
];

const motoBig = (): Part[] => [
  // Wheels, engine, red tank, leather seat, saddlebags, pipes
  [0.12, 0.6, 0.6, 0, 0.3, 0.8, '#0f172a'], [0.14, 0.62, 0.62, 0, 0.31, -0.8, '#0f172a'],
  [0.3, 0.35, 0.9, 0, 0.45, 0, '#4b5563'],
  [0.36, 0.22, 0.6, 0, 0.78, 0.15, '#dc2626'],
  [0.3, 0.1, 0.7, 0, 0.9, -0.25, '#111827'],
  [0.14, 0.3, 0.4, -0.25, 0.55, -0.5, '#1f2937'], [0.14, 0.3, 0.4, 0.25, 0.55, -0.5, '#1f2937'],
  [0.08, 0.08, 0.7, -0.15, 0.22, -0.55, '#9ca3af'], [0.08, 0.08, 0.7, 0.15, 0.22, -0.55, '#9ca3af'],
  // Forks, handlebar, windscreen, headlamp
  [0.06, 0.6, 0.06, 0, 0.6, 0.7, '#9ca3af'],
  [0.7, 0.05, 0.05, 0, 1.1, 0.55, '#9ca3af'],
  [0.3, 0.3, 0.03, 0, 1.05, 0.8, '#7dd3fc'],
  [0.14, 0.14, 0.06, 0, 0.85, 1.0, '#fef9c3'],
];

const motoSport = (): Part[] => [
  // Low fairing with orange livery and dark stripe
  [0.12, 0.56, 0.56, 0, 0.28, 0.7, '#0f172a'], [0.14, 0.58, 0.58, 0, 0.29, -0.66, '#0f172a'],
  [0.3, 0.4, 1.0, 0, 0.5, 0.1, '#f97316'],
  [0.26, 0.3, 0.4, 0, 0.46, 0.7, '#f97316'],
  [0.32, 0.04, 0.7, 0, 0.7, 0.1, '#111827'],
  [0.26, 0.08, 0.6, 0, 0.73, -0.35, '#111827'],
  [0.2, 0.12, 0.4, 0, 0.66, -0.7, '#fb923c'],
  [0.26, 0.18, 0.03, 0, 0.78, 0.52, '#7dd3fc'],
  [0.6, 0.04, 0.04, 0, 0.9, 0.45, '#111827'],
];

// ---------- Sport Area surfaces (flat, walkable, line-marked) ----------
const LINE = 0.1;
const LINE_H = 0.03;
const LINE_Y = 0.035;

const football = (): Part[] => {
  const parts: Part[] = [
    [12, 0.02, 8, 0, 0.01, 0, '#16a34a'],
    // Mowing stripes
    ...Array.from({ length: 6 }, (_, i): Part => [2, 0.005, 8, -5 + i * 2, 0.0225, 0, i % 2 ? '#22c55e' : '#16a34a']),
    // Touchlines, goal lines, halfway line, centre spot
    [12, LINE_H, LINE, 0, LINE_Y, -3.95, '#f8fafc'], [12, LINE_H, LINE, 0, LINE_Y, 3.95, '#f8fafc'],
    [LINE, LINE_H, 8, -5.95, LINE_Y, 0, '#f8fafc'], [LINE, LINE_H, 8, 5.95, LINE_Y, 0, '#f8fafc'],
    [LINE, LINE_H, 8, 0, LINE_Y, 0, '#f8fafc'],
    [0.2, LINE_H, 0.2, 0, LINE_Y, 0, '#f8fafc'],
  ];
  // Centre circle (radius 1.0) as 16 voxel dashes
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    parts.push([0.16, LINE_H, 0.16, Math.cos(a) * 1.0, LINE_Y, Math.sin(a) * 1.0, '#f8fafc']);
  }
  // Penalty boxes (2 m deep, 4.4 m wide) and goals on both end lines
  for (const s of [-1, 1]) {
    parts.push([LINE, LINE_H, 4.4, s * 4, LINE_Y, 0, '#f8fafc']);
    parts.push([2, LINE_H, LINE, s * 5, LINE_Y, 2.2, '#f8fafc'], [2, LINE_H, LINE, s * 5, LINE_Y, -2.2, '#f8fafc']);
    parts.push([0.12, 0.6, 0.12, s * 5.9, 0.3, -0.9, '#f8fafc'], [0.12, 0.6, 0.12, s * 5.9, 0.3, 0.9, '#f8fafc']);
    parts.push([0.12, 0.12, 1.92, s * 5.9, 0.6, 0, '#f8fafc']);
  }
  return parts;
};

const basketball = (): Part[] => {
  const parts: Part[] = [
    [8, 0.02, 5, 0, 0.01, 0, '#c2410c'],
    [8, LINE_H, LINE, 0, LINE_Y, -2.45, '#f8fafc'], [8, LINE_H, LINE, 0, LINE_Y, 2.45, '#f8fafc'],
    [LINE, LINE_H, 5, -3.95, LINE_Y, 0, '#f8fafc'], [LINE, LINE_H, 5, 3.95, LINE_Y, 0, '#f8fafc'],
    [LINE, LINE_H, 5, 0, LINE_Y, 0, '#f8fafc'],
  ];
  // Centre circle (radius 0.9) and the two painted keys
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    parts.push([0.14, LINE_H, 0.14, Math.cos(a) * 0.9, LINE_Y, Math.sin(a) * 0.9, '#f8fafc']);
  }
  for (const s of [-1, 1]) {
    parts.push([1.9, LINE_H, LINE, s * 3.05, LINE_Y, -0.8, '#f8fafc'], [1.9, LINE_H, LINE, s * 3.05, LINE_Y, 0.8, '#f8fafc']);
    parts.push([LINE, LINE_H, 1.6, s * 2.1, LINE_Y, 0, '#f8fafc']);
    // Backboard, rim and pole (pole sits just outside the court)
    parts.push([0.05, 0.5, 0.8, s * 3.9, 1.5, 0, '#f8fafc']);
    parts.push([0.5, 0.04, 0.04, s * 3.65, 1.25, 0, '#f97316']);
    parts.push([0.1, 1.25, 0.1, s * 4.3, 0.62, 0, '#64748b']);
  }
  return parts;
};

const DEFS: Record<FurnitureType, () => Part[]> = {
  desk: () => [
    // 1. Office Desk (tabletop, frame, modesty panel, legs & side drawer unit)
    [1.8, 0.07, 0.76, 0, 0.755, -0.07, '#d6b48a'],
    [1.74, 0.04, 0.70, 0, 0.70, -0.07, '#334155'],
    [1.66, 0.42, 0.04, 0, 0.50, -0.40, '#475569'],
    [0.06, 0.72, 0.06, -0.84, 0.36, -0.40, '#475569'],
    [0.06, 0.72, 0.06, 0.84, 0.36, -0.40, '#475569'],
    [0.06, 0.72, 0.06, -0.84, 0.36, 0.26, '#475569'],
    [0.06, 0.72, 0.06, 0.84, 0.36, 0.26, '#475569'],
    [0.42, 0.58, 0.62, -0.62, 0.40, -0.07, '#475569'],
    [0.36, 0.22, 0.02, -0.62, 0.53, 0.25, '#64748b'],
    [0.36, 0.22, 0.02, -0.62, 0.27, 0.25, '#64748b'],
    // 2. Office Chair
    ...officeChair('#1e293b', '#475569'),
    // 3. Office Laptop
    ...officeLaptop('#38bdf8'),
    // 4. Coffee Glass
    ...coffeeGlass(0.44, 0.12),
  ],
  exec_desk: () => [
    // 1. Office Desk (executive mahogany desktop & side panels)
    [2.4, 0.08, 0.78, 0, 0.75, -0.08, '#7c4a2a'],
    [2.3, 0.72, 0.08, 0, 0.36, -0.42, '#5b341c'],
    [0.1, 0.72, 0.72, -1.1, 0.36, -0.08, '#5b341c'],
    [0.1, 0.72, 0.72, 1.1, 0.36, -0.08, '#5b341c'],
    // 2. Office Chair (executive leather chair)
    ...officeChair('#111827', '#374151'),
    // 3. Office Laptop
    ...officeLaptop('#a78bfa'),
    // 4. Coffee Glass
    ...coffeeGlass(0.48, 0.12),
  ],
  meeting_table: () => [
    [4, 0.1, 1.8, 0, 0.78, 0, '#efe6d6'], [0.3, 0.74, 0.3, -1.3, 0.37, 0, '#64748b'], [0.3, 0.74, 0.3, 1.3, 0.37, 0, '#64748b'],
    [0.5, 0.04, 0.5, 0, 0.85, 0, '#1e293b'], [0.12, 0.3, 0.12, 0, 0.98, 0, '#1e293b'],
    ...[-1.3, 0, 1.3].flatMap((x): Part[] => [[0.35, 0.02, 0.25, x, 0.84, 0.6, '#f8fafc'], [0.35, 0.02, 0.25, x, 0.84, -0.6, '#f8fafc']]),
  ],
  plant: () => [
    [0.45, 0.4, 0.45, 0, 0.2, 0, '#b45309'], [0.5, 0.06, 0.5, 0, 0.42, 0, '#78350f'],
    [0.55, 0.5, 0.55, 0, 0.75, 0, '#16a34a'], [0.4, 0.4, 0.4, 0.1, 1.15, 0.05, '#22c55e'], [0.25, 0.3, 0.25, -0.12, 1.3, -0.08, '#4ade80'],
  ],
  sofa: () => [
    [2.2, 0.4, 0.9, 0, 0.25, 0, '#64748b'], [2.2, 0.6, 0.25, 0, 0.6, -0.33, '#475569'],
    [0.25, 0.55, 0.9, -1.0, 0.45, 0, '#475569'], [0.25, 0.55, 0.9, 1.0, 0.45, 0, '#475569'],
    [0.85, 0.12, 0.6, -0.45, 0.5, 0.08, '#94a3b8'], [0.85, 0.12, 0.6, 0.45, 0.5, 0.08, '#94a3b8'],
  ],
  server_rack: () => [
    [0.9, 2.1, 0.9, 0, 1.05, 0, '#111827'],
    ...[0.4, 0.75, 1.1, 1.45, 1.8].map((y): Part => [0.78, 0.22, 0.02, 0, y, 0.455, '#1f2937']),
    ...[0.4, 0.75, 1.1, 1.45, 1.8].map((y, i): Part => [0.06, 0.05, 0.02, 0.3, y, 0.47, i % 2 ? '#22c55e' : '#38bdf8']),
  ],
  whiteboard: () => [
    [2, 1.1, 0.06, 0, 1.45, 0, '#f8fafc'], [2.1, 0.06, 0.1, 0, 0.88, 0.02, '#94a3b8'], [2.1, 0.06, 0.08, 0, 2.02, 0, '#94a3b8'],
    [0.5, 0.06, 0.02, -0.5, 1.6, 0.04, '#3b82f6'], [0.7, 0.06, 0.02, 0.2, 1.4, 0.04, '#ef4444'], [0.4, 0.3, 0.02, 0.6, 1.7, 0.04, '#facc15'],
    [0.06, 0.9, 0.06, -0.9, 0.45, 0, '#64748b'], [0.06, 0.9, 0.06, 0.9, 0.45, 0, '#64748b'],
  ],
  coffee_machine: () => [
    [1.4, 0.9, 0.7, 0, 0.45, 0, '#78350f'], [1.45, 0.06, 0.75, 0, 0.93, 0, '#e7e5e4'],
    [0.45, 0.55, 0.4, -0.3, 1.24, -0.05, '#1c1917'], [0.12, 0.12, 0.12, -0.3, 1.02, 0.15, '#f5f5f4'],
    [0.12, 0.12, 0.12, 0.25, 1.02, 0.1, '#ef4444'], [0.12, 0.12, 0.12, 0.45, 1.02, 0.05, '#3b82f6'],
  ],
  bookshelf: () => [
    [1.6, 2.0, 0.45, 0, 1.0, 0, '#92400e'],
    ...[0.45, 0.95, 1.45].flatMap((y, r): Part[] => [0, 1, 2, 3, 4].map((i): Part => [0.22, 0.38, 0.32, -0.55 + i * 0.27, y, 0.08, ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'][(i + r) % 5]])),
  ],
  water_cooler: () => [
    [0.5, 0.9, 0.5, 0, 0.45, 0, '#e2e8f0'], [0.4, 0.5, 0.4, 0, 1.15, 0, '#60a5fa'], [0.1, 0.08, 0.06, 0, 0.75, 0.27, '#1e293b'],
  ],
  printer: () => [
    [0.9, 0.7, 0.7, 0, 0.35, 0, '#9ca3af'], [0.85, 0.3, 0.65, 0, 0.85, 0, '#d1d5db'], [0.6, 0.02, 0.3, 0, 1.01, 0.1, '#f8fafc'], [0.1, 0.05, 0.02, 0.3, 0.9, 0.33, '#22c55e'],
  ],
  car_mpv_luxury: carLuxuryMpv,
  car_sedan_sport: carSportSedan,
  moto_big: motoBig,
  moto_sport: motoSport,
  football_pitch: football,
  basketball_court: basketball,
};

const cache = new Map<FurnitureType, THREE.BufferGeometry>();
export function furnitureGeometry(t: FurnitureType) {
  if (!cache.has(t)) cache.set(t, build(DEFS[t]()));
  return cache.get(t)!;
}
export const furnitureMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
export const furnitureTris = (t: FurnitureType) => furnitureGeometry(t).index!.count / 3;
