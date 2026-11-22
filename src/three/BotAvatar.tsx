import { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, useAnimations, useGLTF } from '@react-three/drei';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import defaultBotUrl from '../assets/voxel_bot.glb?url';
import { useSimUi, useStore } from '../store';
import { sim, type Anim } from '../sim/engine';
import type { Bot } from '../types';

export const DEFAULT_BOT_URL = defaultBotUrl;

const CLIP_PATTERNS: Record<Anim, RegExp> = {
  Idle: /idle|stand|breath/i,
  Walk: /walk|run|locomot/i,
  Talk: /talk|speak|wave|yes|gesture/i,
  Typing: /typ|work|punch|use/i,
};

const ringGeo = new THREE.RingGeometry(0.42, 0.55, 24);

export const BotAvatar = memo(function BotAvatar({ bot, url, levelColor }: { bot: Bot; url: string; levelColor: string }) {
  const { scene, animations } = useGLTF(url);
  const group = useRef<THREE.Group>(null);
  const current = useRef<string | null>(null);
  const selected = useStore((s) => s.selectedBotId === bot.id);
  const showBubbles = useStore((s) => s.showBubbles);
  const status = useSimUi((s) => s.status[bot.id]);

  const model = useMemo(() => {
    const c = skeletonClone(scene) as THREE.Object3D;
    const tint: Record<string, string> = { Shirt: bot.shirt_color, Hair: bot.hair_color, Tie: bot.accent_color };
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && tint[mat.name]) {
        const nm = mat.clone();
        nm.color = new THREE.Color(tint[mat.name]);
        m.material = nm;
      }
    });
    // normalise foreign GLBs to ~1.6 m tall
    const box = new THREE.Box3().setFromObject(c);
    const h = box.max.y - box.min.y;
    if (h > 0 && (h < 1 || h > 2.5)) c.scale.setScalar(1.6 / h);
    return c;
  }, [scene, bot.shirt_color, bot.hair_color, bot.accent_color]);

  const { actions, names } = useAnimations(animations, group);
  const clipFor = useMemo(() => {
    const map: Partial<Record<Anim, string>> = {};
    (Object.keys(CLIP_PATTERNS) as Anim[]).forEach((k) => { map[k] = names.find((n) => CLIP_PATTERNS[k].test(n)); });
    map.Idle = map.Idle ?? names[0];
    map.Typing = map.Typing ?? map.Idle;
    map.Talk = map.Talk ?? map.Idle;
    map.Walk = map.Walk ?? map.Idle;
    return map as Record<Anim, string | undefined>;
  }, [names]);

  useEffect(() => () => { current.current = null; }, [model]);

  const fadeUntil = useRef(0);

  useFrame((_, dt) => {
    const rt = sim.runtimes.get(bot.id);
    const g = group.current;
    if (!rt || !g) return;
    g.position.set(rt.x, 0, rt.z);
    g.rotation.y = rt.rot;
    const st = useStore.getState();
    const isSelected = st.selectedBotId === bot.id;
    const effectiveAnim: Anim = isSelected && rt.anim === 'Typing' ? 'Idle' : rt.anim;
    const clip = clipFor[effectiveAnim];
    if (clip && clip !== current.current) {
      const next = actions[clip];
      const prev = current.current ? actions[current.current] : null;
      if (next) {
        next.reset().setEffectiveWeight(1).fadeIn(0.22).play();
        prev?.fadeOut(0.22);
        current.current = clip;
        fadeUntil.current = 0.3;
      }
    }
    if (fadeUntil.current > 0) fadeUntil.current = Math.max(0, fadeUntil.current - dt);
    const scale = st.simRunning && !st.editMode ? st.simSpeed : fadeUntil.current > 0 || isSelected ? 1 : 0;
    for (const n of names) { const a = actions[n]; if (a) a.timeScale = scale; }
  });

  const bubble = status?.bubble;
  return (
    <group ref={group}>
      <primitive
        object={model}
        onPointerDown={(e: { stopPropagation: () => void }) => {
          const st = useStore.getState();
          if (st.editMode) return;
          e.stopPropagation();
          const Deselect = st.selectedBotId === bot.id;
          st.set({ selectedBotId: Deselect ? null : bot.id, followBot: Deselect ? false : st.followBot, tab: 'bots' });
        }}
      />
      <mesh geometry={ringGeo} rotation-x={-Math.PI / 2} position-y={0.03}>
        <meshBasicMaterial color={selected ? '#facc15' : bot.shirt_color} transparent opacity={selected ? 0.95 : 0.55} depthWrite={false} />
      </mesh>
      <Html position={[0, 2.05, 0]} center distanceFactor={16} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex flex-col items-center gap-1 select-none" style={{ width: 220 }}>
          {showBubbles && bubble ? (
            <div className={`max-w-[210px] rounded-xl px-2.5 py-1.5 text-[12px] leading-snug shadow-lg border ${status?.state === 'talking' || status?.state === 'meeting' ? 'bg-white border-sky-300 text-slate-800' : 'bg-slate-900/85 border-slate-700 text-slate-100'}`}>
              <span className="mr-1">{status?.icon}</span>{bubble}
            </div>
          ) : null}
          <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow ${selected ? 'ring-2 ring-yellow-300' : ''}`} style={{ background: 'rgba(15,23,42,0.85)' }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: levelColor }} />
            {bot.name}
          </div>
        </div>
      </Html>
    </group>
  );
});

useGLTF.preload(defaultBotUrl);
