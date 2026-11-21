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

const legs = (w: number, d: number, h: number, c: string, t = 0.07): Part[] => [
  [t, h, t, -w / 2 + t, h / 2, -d / 2 + t, c], [t, h, t, w / 2 - t, h / 2, -d / 2 + t, c],
  [t, h, t, -w / 2 + t, h / 2, d / 2 - t, c], [t, h, t, w / 2 - t, h / 2, d / 2 - t, c],
];

const DEFS: Record<FurnitureType, () => Part[]> = {
  desk: () => [
    [1.8, 0.08, 0.9, 0, 0.78, 0, '#d6b48a'], ...legs(1.8, 0.9, 0.74, '#475569'),
    [0.9, 0.5, 0.05, 0, 1.15, -0.25, '#1e293b'], [0.82, 0.42, 0.02, 0, 1.15, -0.22, '#38bdf8'],
    [0.1, 0.25, 0.1, 0, 0.92, -0.3, '#334155'], [0.5, 0.03, 0.18, 0, 0.83, 0.1, '#e2e8f0'],
    [0.42, 0.06, 0.42, 0.75, 0.5, 0.55, '#334155'], [0.08, 0.45, 0.08, 0.75, 0.24, 0.55, '#475569'],
    [0.3, 0.24, 0.1, -0.6, 0.94, -0.2, '#f1f5f9'],
  ],
  exec_desk: () => [
    [2.4, 0.1, 1.1, 0, 0.8, 0, '#7c4a2a'], [2.3, 0.72, 0.1, 0, 0.38, -0.45, '#5b341c'],
    [0.1, 0.72, 1.0, -1.1, 0.38, 0, '#5b341c'], [0.1, 0.72, 1.0, 1.1, 0.38, 0, '#5b341c'],
    [1.0, 0.55, 0.05, -0.3, 1.2, -0.3, '#111827'], [0.92, 0.47, 0.02, -0.3, 1.2, -0.27, '#a78bfa'],
    [0.08, 0.3, 0.08, -0.3, 0.98, -0.35, '#111827'], [0.2, 0.25, 0.2, 0.85, 0.98, -0.2, '#fbbf24'],
    [0.6, 0.08, 0.6, 0.95, 0.55, 0.85, '#111827'], [0.6, 0.7, 0.1, 0.95, 0.95, 1.12, '#111827'], [0.1, 0.5, 0.1, 0.95, 0.27, 0.85, '#374151'],
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
};

const cache = new Map<FurnitureType, THREE.BufferGeometry>();
export function furnitureGeometry(t: FurnitureType) {
  if (!cache.has(t)) cache.set(t, build(DEFS[t]()));
  return cache.get(t)!;
}
export const furnitureMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
export const furnitureTris = (t: FurnitureType) => furnitureGeometry(t).index!.count / 3;
