import type { Furniture, Room } from '../types';
import { footprint } from './catalog';

export const WORLD = { minX: -30, maxX: 30, minZ: -17, maxZ: 17 };
const CELL = 0.5;
const COLS = Math.round((WORLD.maxX - WORLD.minX) / CELL);
const ROWS = Math.round((WORLD.maxZ - WORLD.minZ) / CELL);
export const DOOR_WIDTH = 2;

export const hasWalls = (r: Room) => r.type !== 'lounge' && r.type !== 'open';

/** Returns wall segments (with door gap) for a room in world space: [x1,z1,x2,z2]. */
export function wallSegments(r: Room): [number, number, number, number][] {
  if (!hasWalls(r)) return [];
  const x0 = r.x - r.w / 2, x1 = r.x + r.w / 2, z0 = r.z - r.d / 2, z1 = r.z + r.d / 2;
  const sides: Record<string, [number, number, number, number]> = {
    n: [x0, z0, x1, z0], s: [x0, z1, x1, z1], w: [x0, z0, x0, z1], e: [x1, z0, x1, z1],
  };
  const segs: [number, number, number, number][] = [];
  for (const [k, s] of Object.entries(sides)) {
    if (k !== r.door_side) { segs.push(s); continue; }
    const half = DOOR_WIDTH / 2;
    if (k === 'n' || k === 's') {
      segs.push([s[0], s[1], r.x - half, s[3]], [r.x + half, s[1], s[2], s[3]]);
    } else {
      segs.push([s[0], s[1], s[2], r.z - half], [s[0], r.z + half, s[2], s[3]]);
    }
  }
  return segs.filter((s) => Math.abs(s[2] - s[0]) + Math.abs(s[3] - s[1]) > 0.05);
}

export interface NavGrid {
  blocked: Uint8Array;
}

const idx = (c: number, r: number) => r * COLS + c;
const toCell = (x: number, z: number): [number, number] => [
  Math.min(COLS - 1, Math.max(0, Math.floor((x - WORLD.minX) / CELL))),
  Math.min(ROWS - 1, Math.max(0, Math.floor((z - WORLD.minZ) / CELL))),
];
const toWorld = (c: number, r: number): [number, number] => [WORLD.minX + (c + 0.5) * CELL, WORLD.minZ + (r + 0.5) * CELL];

export function buildNavGrid(rooms: Room[], furniture: Furniture[]): NavGrid {
  const blocked = new Uint8Array(COLS * ROWS);
  const mark = (minX: number, maxX: number, minZ: number, maxZ: number) => {
    const [c0, r0] = toCell(minX, minZ);
    const [c1, r1] = toCell(maxX, maxZ);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const [cx, cz] = toWorld(c, r);
      if (cx >= minX && cx <= maxX && cz >= minZ && cz <= maxZ) blocked[idx(c, r)] = 1;
    }
  };
  const pad = 0.3;
  for (const room of rooms) {
    for (const [x1, z1, x2, z2] of wallSegments(room)) {
      mark(Math.min(x1, x2) - pad, Math.max(x1, x2) + pad, Math.min(z1, z2) - pad, Math.max(z1, z2) + pad);
    }
  }
  for (const f of furniture) {
    const { hw, hd } = footprint(f);
    mark(f.x - hw - 0.15, f.x + hw + 0.15, f.z - hd - 0.15, f.z + hd + 0.15);
  }
  // world border
  for (let c = 0; c < COLS; c++) { blocked[idx(c, 0)] = 1; blocked[idx(c, ROWS - 1)] = 1; }
  for (let r = 0; r < ROWS; r++) { blocked[idx(0, r)] = 1; blocked[idx(COLS - 1, r)] = 1; }
  return { blocked };
}

function nearestFree(g: NavGrid, c: number, r: number): [number, number] {
  if (!g.blocked[idx(c, r)]) return [c, r];
  for (let rad = 1; rad < 14; rad++) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || g.blocked[idx(nc, nr)]) continue;
      const d = dc * dc + dr * dr;
      if (d < bd) { bd = d; best = [nc, nr]; }
    }
    if (best) return best;
  }
  return [c, r];
}

function walkable(g: NavGrid, ax: number, az: number, bx: number, bz: number) {
  const dist = Math.hypot(bx - ax, bz - az);
  const steps = Math.ceil(dist / 0.2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const [c, r] = toCell(ax + (bx - ax) * t, az + (bz - az) * t);
    if (g.blocked[idx(c, r)]) return false;
  }
  return true;
}

// Binary min-heap A*
export function findPath(g: NavGrid, sx: number, sz: number, tx: number, tz: number): [number, number][] {
  const [sc0, sr0] = toCell(sx, sz);
  const [tc0, tr0] = toCell(tx, tz);
  const [sc, sr] = nearestFree(g, sc0, sr0);
  const [tc, tr] = nearestFree(g, tc0, tr0);
  const start = idx(sc, sr), goal = idx(tc, tr);
  const N = COLS * ROWS;
  const gScore = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap: [number, number][] = [];
  const push = (n: number, f: number) => {
    heap.push([f, n]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top[1];
  };
  const h = (c: number, r: number) => {
    const dx = Math.abs(c - tc), dy = Math.abs(r - tr);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  gScore[start] = 0;
  push(start, h(sc, sr));
  let found = false;
  while (heap.length) {
    const cur = pop();
    if (cur === goal) { found = true; break; }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cc = cur % COLS, cr = (cur / COLS) | 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nc = cc + dc, nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const n = idx(nc, nr);
      if (g.blocked[n] || closed[n]) continue;
      if (dr && dc && (g.blocked[idx(cc + dc, cr)] || g.blocked[idx(cc, cr + dr)])) continue; // no corner cutting
      const ng = gScore[cur] + (dr && dc ? Math.SQRT2 : 1);
      if (ng < gScore[n]) {
        gScore[n] = ng;
        came[n] = cur;
        push(n, ng + h(nc, nr));
      }
    }
  }
  if (!found) return [[tx, tz]];
  const cells: [number, number][] = [];
  for (let n = goal; n !== -1; n = came[n]) cells.push(toWorld(n % COLS, (n / COLS) | 0));
  cells.reverse();
  // final exact target if reachable
  const lastCell = cells[cells.length - 1];
  if (walkable(g, lastCell[0], lastCell[1], tx, tz)) cells.push([tx, tz]);
  // string pulling
  const out: [number, number][] = [];
  let anchor: [number, number] = [sx, sz];
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !walkable(g, anchor[0], anchor[1], cells[j][0], cells[j][1])) j--;
    out.push(cells[j]);
    anchor = cells[j];
    i = j + 1;
  }
  return out;
}
