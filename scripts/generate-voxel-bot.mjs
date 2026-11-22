// Generates the reference voxel cartoon bot (GLB) with 11 clips:
//   Idle, Walk, Run, KickRun, DribbleRun, Talk, Typing, EnterCar, ExitCar, EnterBike, ExitBike
// Tech-art spec: < 600 tris, 8 shared materials, no textures, named pivots for retargetable clips.
// Clip names are the contract with src/three/BotAvatar.tsx (exact match) and src/sim/engine.ts (Anim type).
// Run: node scripts/generate-voxel-bot.mjs   (also wired to predev/prebuild in package.json)
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Node polyfill: GLTFExporter (binary) relies on FileReader ---
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend && this.onloadend({ target: this });
      this.onload && this.onload({ target: this });
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(buf).toString('base64');
      this.onloadend && this.onloadend({ target: this });
      this.onload && this.onload({ target: this });
    });
  }
};

// ---- Materials: 1 vertex-coloured "Base" + 3 runtime-tintable materials (Shirt / Hair / Tie) ----
const mat = (name, color, vertexColors = false) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, vertexColors });
  m.name = name;
  return m;
};
const MAT = {
  Base: mat('Base', 0xffffff, true),
  Shirt: mat('Shirt', 0x3b82f6),
  Hair: mat('Hair', 0x3a2416),
  Tie: mat('Tie', 0xef4444),
};
const C = { skin: 0xf2c79b, pants: 0x2b2f3a, eye: 0x111111, white: 0xffffff, mouth: 0x7a1f2b, shoe: 0x1b1b1f, cheek: 0xf59e9e };

const group = (name, x = 0, y = 0, z = 0) => {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
};

// Collect boxes per pivot+material, then merge => one draw call per (pivot, material).
const parts = new Map();
const addBox = (pivot, matName, w, h, d, x, y, z, color = 0xffffff) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!parts.has(pivot)) parts.set(pivot, {});
  const p = parts.get(pivot);
  (p[matName] ??= []).push(g);
};

// ---------- Build hierarchy ----------
const root = group('VoxelBot');
const hips = group('Hips', 0, 0.75, 0);
root.add(hips);
addBox(hips, 'Shirt', 0.52, 0.56, 0.32, 0, 0.29, 0);
addBox(hips, 'Base', 0.53, 0.07, 0.33, 0, 0.03, 0, C.pants);
addBox(hips, 'Base', 0.26, 0.06, 0.04, 0, 0.54, 0.15, C.white);
addBox(hips, 'Tie', 0.08, 0.32, 0.02, 0, 0.36, 0.17);

const headPivot = group('HeadPivot', 0, 0.58, 0);
hips.add(headPivot);
addBox(headPivot, 'Base', 0.52, 0.48, 0.46, 0, 0.25, 0, C.skin);
addBox(headPivot, 'Hair', 0.56, 0.14, 0.5, 0, 0.52, -0.01);
addBox(headPivot, 'Hair', 0.56, 0.34, 0.1, 0, 0.36, -0.22);
addBox(headPivot, 'Hair', 0.56, 0.08, 0.06, 0, 0.44, 0.22);
addBox(headPivot, 'Base', 0.08, 0.11, 0.02, -0.12, 0.28, 0.235, C.eye);
addBox(headPivot, 'Base', 0.08, 0.11, 0.02, 0.12, 0.28, 0.235, C.eye);
addBox(headPivot, 'Base', 0.03, 0.03, 0.01, -0.105, 0.31, 0.247, C.white);
addBox(headPivot, 'Base', 0.03, 0.03, 0.01, 0.135, 0.31, 0.247, C.white);
addBox(headPivot, 'Base', 0.08, 0.04, 0.01, -0.18, 0.18, 0.235, C.cheek);
addBox(headPivot, 'Base', 0.08, 0.04, 0.01, 0.18, 0.18, 0.235, C.cheek);
const mouthPivot = group('MouthPivot', 0, 0.13, 0.236);
headPivot.add(mouthPivot);
addBox(mouthPivot, 'Base', 0.14, 0.035, 0.02, 0, 0, 0, C.mouth);

for (const side of ['L', 'R']) {
  const s = side === 'L' ? -1 : 1;
  const a = group(`Arm${side}_Pivot`, 0.34 * s, 0.52, 0);
  hips.add(a);
  addBox(a, 'Shirt', 0.15, 0.42, 0.17, 0, -0.19, 0);
  addBox(a, 'Base', 0.14, 0.12, 0.15, 0, -0.46, 0, C.skin);
  const l = group(`Leg${side}_Pivot`, 0.13 * s, 0.75, 0);
  root.add(l);
  addBox(l, 'Base', 0.2, 0.6, 0.22, 0, -0.32, 0, C.pants);
  addBox(l, 'Base', 0.22, 0.12, 0.3, 0, -0.68, 0.04, C.shoe);
}

for (const [pivot, mats] of parts) {
  for (const [matName, geos] of Object.entries(mats)) {
    const merged = mergeGeometries(geos);
    const mesh = new THREE.Mesh(merged, MAT[matName]);
    mesh.name = `${pivot.name}_${matName}`;
    pivot.add(mesh);
  }
}

// ---------- Animation helpers ----------
const q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)).toArray();
const qTrack = (node, times, eulers) =>
  new THREE.QuaternionKeyframeTrack(`${node}.quaternion`, times, eulers.flatMap((e) => q(...e)));
const vTrack = (node, prop, times, values) =>
  new THREE.VectorKeyframeTrack(`${node}.${prop}`, times, values.flat());

// Idle — 2s standing breathing loop
const idle = new THREE.AnimationClip('Idle', 2, [
  vTrack('Hips', 'position', [0, 1, 2], [[0, 0.75, 0], [0, 0.765, 0], [0, 0.75, 0]]),
  vTrack('LegL_Pivot', 'position', [0, 2], [[-0.13, 0.75, 0], [-0.13, 0.75, 0]]),
  vTrack('LegR_Pivot', 'position', [0, 2], [[0.13, 0.75, 0], [0.13, 0.75, 0]]),
  qTrack('HeadPivot', [0, 1, 2], [[0, 0, 0], [0.04, 0.08, 0], [0, 0, 0]]),
  qTrack('ArmL_Pivot', [0, 1, 2], [[0, 0, -0.05], [0, 0, -0.1], [0, 0, -0.05]]),
  qTrack('ArmR_Pivot', [0, 1, 2], [[0, 0, 0.05], [0, 0, 0.1], [0, 0, 0.05]]),
  qTrack('LegL_Pivot', [0, 2], [[0, 0, 0], [0, 0, 0]]),
  qTrack('LegR_Pivot', [0, 2], [[0, 0, 0], [0, 0, 0]]),
  vTrack('MouthPivot', 'scale', [0, 2], [[1, 1, 1], [1, 1, 1]]),
]);

// Walk — 0.8s cycle
const wt = [0, 0.2, 0.4, 0.6, 0.8];
const walk = new THREE.AnimationClip('Walk', 0.8, [
  vTrack('LegL_Pivot', 'position', [0, 0.8], [[-0.13, 0.75, 0], [-0.13, 0.75, 0]]),
  vTrack('LegR_Pivot', 'position', [0, 0.8], [[0.13, 0.75, 0], [0.13, 0.75, 0]]),
  qTrack('LegL_Pivot', wt, [[0, 0, 0], [0.65, 0, 0], [0, 0, 0], [-0.65, 0, 0], [0, 0, 0]]),
  qTrack('LegR_Pivot', wt, [[0, 0, 0], [-0.65, 0, 0], [0, 0, 0], [0.65, 0, 0], [0, 0, 0]]),
  qTrack('ArmL_Pivot', wt, [[0, 0, -0.05], [-0.7, 0, -0.05], [0, 0, -0.05], [0.7, 0, -0.05], [0, 0, -0.05]]),
  qTrack('ArmR_Pivot', wt, [[0, 0, 0.05], [0.7, 0, 0.05], [0, 0, 0.05], [-0.7, 0, 0.05], [0, 0, 0.05]]),
  vTrack('Hips', 'position', wt, [[0, 0.75, 0], [0, 0.79, 0], [0, 0.75, 0], [0, 0.79, 0], [0, 0.75, 0]]),
  qTrack('HeadPivot', wt, [[0, 0, 0], [0, 0, 0.04], [0, 0, 0], [0, 0, -0.04], [0, 0, 0]]),
  vTrack('MouthPivot', 'scale', [0, 0.8], [[1, 1, 1], [1, 1, 1]]),
]);

// Talk — 1.2s lip-flap + gesture
const tt = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2];
const talk = new THREE.AnimationClip('Talk', 1.2, [
  vTrack('MouthPivot', 'scale', tt, [[1, 1, 1], [0.8, 3.2, 1], [1, 1, 1], [0.9, 2.4, 1], [1, 1, 1], [0.8, 3.4, 1], [1, 1.2, 1], [0.9, 2.6, 1], [1, 1, 1]]),
  vTrack('LegL_Pivot', 'position', [0, 1.2], [[-0.13, 0.75, 0], [-0.13, 0.75, 0]]),
  vTrack('LegR_Pivot', 'position', [0, 1.2], [[0, 0.75, 0], [0.13, 0.75, 0]].map(() => [0.13, 0.75, 0])),
  qTrack('HeadPivot', [0, 0.3, 0.6, 0.9, 1.2], [[0, 0, 0], [0.08, 0.06, 0], [0, 0, 0], [0.06, -0.06, 0], [0, 0, 0]]),
  qTrack('ArmR_Pivot', [0, 0.3, 0.6, 0.9, 1.2], [[-0.9, 0, 0.25], [-1.2, 0, 0.45], [-0.9, 0, 0.25], [-1.15, 0, 0.1], [-0.9, 0, 0.25]]),
  qTrack('ArmL_Pivot', [0, 0.6, 1.2], [[-0.2, 0, -0.1], [-0.4, 0, -0.2], [-0.2, 0, -0.1]]),
  vTrack('Hips', 'position', [0, 0.6, 1.2], [[0, 0.75, 0], [0, 0.76, 0], [0, 0.75, 0]]),
  qTrack('LegL_Pivot', [0, 1.2], [[0, 0, 0], [0, 0, 0]]),
  qTrack('LegR_Pivot', [0, 1.2], [[0, 0, 0], [0, 0, 0]]),
]);

// Typing — 0.6s seated in office chair typing on laptop loop
const ty = [0, 0.15, 0.3, 0.45, 0.6];
const typing = new THREE.AnimationClip('Typing', 0.6, [
  vTrack('Hips', 'position', [0, 0.3, 0.6], [[0, 0.48, -0.2], [0, 0.486, -0.2], [0, 0.48, -0.2]]),
  vTrack('LegL_Pivot', 'position', [0, 0.6], [[-0.13, 0.48, -0.18], [-0.13, 0.48, -0.18]]),
  vTrack('LegR_Pivot', 'position', [0, 0.6], [[0.13, 0.48, -0.18], [0.13, 0.48, -0.18]]),
  qTrack('LegL_Pivot', [0, 0.6], [[-1.42, 0, 0], [-1.42, 0, 0]]),
  qTrack('LegR_Pivot', [0, 0.6], [[-1.42, 0, 0], [-1.42, 0, 0]]),
  qTrack('ArmL_Pivot', ty, [[-1.28, -0.15, 0.12], [-1.16, -0.15, 0.12], [-1.28, -0.15, 0.12], [-1.34, -0.15, 0.12], [-1.28, -0.15, 0.12]]),
  qTrack('ArmR_Pivot', ty, [[-1.28, 0.15, -0.12], [-1.34, 0.15, -0.12], [-1.28, 0.15, -0.12], [-1.16, 0.15, -0.12], [-1.28, 0.15, -0.12]]),
  qTrack('HeadPivot', [0, 0.3, 0.6], [[0.16, -0.04, 0], [0.18, 0.04, 0], [0.16, -0.04, 0]]),
  vTrack('MouthPivot', 'scale', [0, 0.6], [[1, 1, 1], [1, 1, 1]]),
]);

// ---- Sport & vehicle clips (pose-keyed; three.js slerps between keys) ----
// pose = { hips:[y,z], legs:[y,z], legL:[rx,rz], legR:[rx,rz], aL:[x,y,z], aR:[x,y,z], lean }
const RIG_LEG_X = 0.13;
const STAND = { hips: [0.75, 0], legs: [0.75, 0], legL: [0, 0], legR: [0, 0], aL: [0, 0, -0.05], aR: [0, 0, 0.05], lean: 0 };
const CAR_SIT = { hips: [0.48, -0.2], legs: [0.48, -0.18], legL: [-1.42, 0], legR: [-1.42, 0], aL: [-1.28, -0.15, 0.12], aR: [-1.28, 0.15, -0.12], lean: 0 };
const BIKE_SIT = { hips: [0.56, -0.1], legs: [0.56, -0.1], legL: [-1.25, 0.18], legR: [-1.25, -0.18], aL: [-1.2, 0, 0.08], aR: [-1.2, 0, -0.08], lean: 0.12 };

const mix = (a, b, t) => {
  const L = (u, v) => u.map((x, i) => x + (v[i] - x) * t);
  return { hips: L(a.hips, b.hips), legs: L(a.legs, b.legs), legL: L(a.legL, b.legL), legR: L(a.legR, b.legR), aL: L(a.aL, b.aL), aR: L(a.aR, b.aR), lean: a.lean + (b.lean - a.lean) * t };
};

const poseClip = (name, duration, keys) => {
  const T = keys.map(([t]) => t);
  const P = keys.map(([, p]) => p);
  return new THREE.AnimationClip(name, duration, [
    new THREE.VectorKeyframeTrack('Hips.position', T, P.flatMap((p) => [0, p.hips[0], p.hips[1]])),
    new THREE.VectorKeyframeTrack('LegL_Pivot.position', T, P.flatMap((p) => [-RIG_LEG_X, p.legs[0], p.legs[1]])),
    new THREE.VectorKeyframeTrack('LegR_Pivot.position', T, P.flatMap((p) => [RIG_LEG_X, p.legs[0], p.legs[1]])),
    qTrack('Hips', T, P.map((p) => [p.lean, 0, 0])),
    qTrack('LegL_Pivot', T, P.map((p) => [p.legL[0], 0, p.legL[1]])),
    qTrack('LegR_Pivot', T, P.map((p) => [p.legR[0], 0, p.legR[1]])),
    qTrack('ArmL_Pivot', T, P.map((p) => p.aL)),
    qTrack('ArmR_Pivot', T, P.map((p) => p.aR)),
  ]);
};

/** Periodic clip: n+1 keys sampled from fn(phase) with phase in [0, 2π]. */
const cycleClip = (name, duration, fn, n = 8) =>
  poseClip(name, duration, Array.from({ length: n + 1 }, (_, i) => [(duration * i) / n, fn((2 * Math.PI * i) / n)]));

const runPose = (phi, A = 0.95, B = 1.0) => ({
  hips: [0.75 + (0.04 * (1 - Math.cos(2 * phi))) / 2, 0], legs: [0.75, 0],
  legL: [A * Math.sin(phi), 0], legR: [-A * Math.sin(phi), 0],
  aL: [-B * Math.sin(phi), 0, -0.05], aR: [B * Math.sin(phi), 0, 0.05], lean: 0.1,
});

// Run — 0.5 s stride, forward lean, opposite arm/leg swing
const run = cycleClip('Run', 0.5, (phi) => runPose(phi));

// KickRun (football) — 0.7 s jog; right leg whips forward through a kick at phase 1.5π
const KICK_PHASE = 1.5 * Math.PI;
const kickRun = cycleClip('KickRun', 0.7, (phi) => {
  const p = runPose(phi, 0.8, 0.8);
  const d = Math.atan2(Math.sin(phi - KICK_PHASE), Math.cos(phi - KICK_PHASE));
  const bump = Math.exp(-(d * d) / 0.08);
  p.legR = [p.legR[0] * (1 - bump) + -1.4 * bump, 0];
  p.lean = 0.14;
  return p;
}, 12);

// DribbleRun (basketball) — 0.5 s run; right hand pumps a ball at 2× stride frequency, left arm cradles
const dribbleRun = cycleClip('DribbleRun', 0.5, (phi) => {
  const p = runPose(phi, 0.9, 0.6);
  p.aR = [-0.9 + 0.55 * Math.cos(2 * phi), 0, 0.1];
  p.aL = [-0.9, 0, -0.15];
  return p;
});

// Enter / Exit vehicle — 1.6 s; 'in' = stand → seated, 'out' = seated → stand; right hand reaches for the door
const vehicleClip = (name, sit, dir) => {
  const [a, b] = dir === 'in' ? [STAND, sit] : [sit, STAND];
  const reach = { ...mix(a, b, 0.45), aR: [-1.3, 0, 0.2] };
  return poseClip(name, 1.6, [[0, a], [0.5, reach], [1.1, mix(a, b, 0.9)], [1.6, b]]);
};
const enterCar = vehicleClip('EnterCar', CAR_SIT, 'in');
const exitCar = vehicleClip('ExitCar', CAR_SIT, 'out');
const enterBike = vehicleClip('EnterBike', BIKE_SIT, 'in');
const exitBike = vehicleClip('ExitBike', BIKE_SIT, 'out');

const scene = new THREE.Scene();
scene.add(root);

let tris = 0, draws = 0;
root.traverse((o) => { if (o.isMesh) { draws++; tris += o.geometry.index.count / 3; } });

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clips = [idle, walk, run, kickRun, dribbleRun, talk, typing, enterCar, exitCar, enterBike, exitBike];
const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (result) => {
    const out = path.join(ROOT, 'src/assets/voxel_bot.glb');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(result));
    console.log(`Wrote ${out} (${result.byteLength} bytes, ${tris} tris, ${draws} draw calls, ${clips.length} clips: ${clips.map((c) => c.name).join(', ')})`);
  },
  (err) => { console.error(err); process.exit(1); },
  { binary: true, animations: clips }
);
