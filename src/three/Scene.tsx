import { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import { create } from 'zustand';
import { useStore } from '../store';
import { sim } from '../sim/engine';
import { OfficeLayout } from './Office';
import { BotAvatar, botUrlFor } from './BotAvatar';
import { WORLD } from '../sim/pathfinding';

export const usePerf = create<{ fps: number; calls: number; tris: number; geos: number; tex: number; ms: number }>(() => ({ fps: 0, calls: 0, tris: 0, geos: 0, tex: 0, ms: 0 }));

function SimDriver() {
  useFrame((_, dt) => {
    const t0 = performance.now();
    sim.tick(dt);
    simMs = simMs * 0.9 + (performance.now() - t0) * 0.1;
  });
  return null;
}
let simMs = 0;

function PerfProbe() {
  const { gl } = useThree();
  const acc = useRef({ t: 0, frames: 0 });
  useFrame((_, dt) => {
    acc.current.t += dt;
    acc.current.frames++;
    if (acc.current.t >= 0.5) {
      const i = gl.info;
      usePerf.setState({ fps: Math.round(acc.current.frames / acc.current.t), calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, ms: simMs });
      acc.current = { t: 0, frames: 0 };
    }
  });
  return null;
}

function CameraRig() {
  const controls = useThree((s) => s.controls) as unknown as OrbitImpl | null;
  const camera = useThree((s) => s.camera);
  const tmp = useRef(new THREE.Vector3());
  useFrame(() => {
    const st = useStore.getState();
    if (!controls || !st.followBot || st.selectedBotId == null) return;
    const rt = sim.runtimes.get(st.selectedBotId);
    if (!rt) return;
    tmp.current.set(rt.x, 0.8, rt.z);
    const delta = tmp.current.clone().sub(controls.target).multiplyScalar(0.08);
    controls.target.add(delta);
    camera.position.add(delta);
    controls.update();
  });
  return null;
}

function Bots() {
  const bots = useStore((s) => s.bots);
  const levels = useStore((s) => s.levels);
  const custom = useStore((s) => s.customModelUrl);
  return (
    <>
      {bots.map((b) => {
        const url = custom ?? botUrlFor(b.body);
        return (
          <BotAvatar key={`${b.id}-${b.body}-${b.shirt_color}-${b.hair_color}-${b.accent_color}-${url.slice(-24)}`} bot={b} url={url}
            levelColor={levels.find((l) => l.id === b.level_id)?.color ?? '#94a3b8'} />
        );
      })}
    </>
  );
}

function Ground() {
  const w = WORLD.maxX - WORLD.minX, d = WORLD.maxZ - WORLD.minZ;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow position-y={0}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#cbd5e1" roughness={1} />
      </mesh>
      <gridHelper args={[Math.max(w, d), Math.max(w, d), '#94a3b8', '#b6c2d1']} position-y={0.005} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <planeGeometry args={[w + 6, d + 6]} />
        <meshStandardMaterial color="#475569" roughness={1} />
      </mesh>
    </group>
  );
}

function ShadowQuality() {
  const quality = useStore((s) => s.quality);
  const { gl, setDpr } = useThree();
  useEffect(() => {
    gl.shadowMap.enabled = quality === 'high';
    gl.shadowMap.needsUpdate = true;
    setDpr(quality === 'high' ? Math.min(window.devicePixelRatio, 2) : 1);
  }, [quality, gl, setDpr]);
  return null;
}

export default function Scene() {
  const dragging = useStore((s) => s.dragging);
  const quality = useStore((s) => s.quality);
  const showPerf = useStore((s) => s.showPerf);
  return (
    <Canvas
      shadows
      camera={{ position: [0, 46, 50], fov: 45, near: 0.5, far: 300 }}
      onPointerMissed={() => {
        const st = useStore.getState();
        st.set(st.editMode ? { selection: null } : { selection: null, selectedBotId: null, followBot: false });
      }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#0f172a']} />
      <fog attach="fog" args={['#0f172a', 70, 140]} />
      <hemisphereLight args={['#f8fafc', '#334155', 0.9]} />
      <directionalLight
        position={[18, 30, 14]}
        intensity={1.6}
        castShadow={quality === 'high'}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-far={90}
        shadow-bias={-0.0008}
      />
      <ambientLight intensity={0.25} />
      <SimDriver />
      {showPerf && <PerfProbe />}
      <ShadowQuality />
      <Ground />
      <OfficeLayout />
      <Suspense fallback={null}>
        <Bots />
      </Suspense>
      <OrbitControls makeDefault enabled={!dragging} target={[0, 0, 8]} maxPolarAngle={Math.PI / 2.15} minDistance={6} maxDistance={80} enableDamping />
      <CameraRig />
    </Canvas>
  );
}
