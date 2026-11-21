import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useStore } from '../store';
import type { Furniture, Room } from '../types';
import { wallSegments, WORLD } from '../sim/pathfinding';
import { footprint } from '../sim/catalog';
import { furnitureGeometry, furnitureMaterial } from './furnitureGeo';

const WALL_H = 0.9;
const GLASS_H = 1.5;
const WALL_T = 0.16;
const wallMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: '#bae6fd', transparent: true, opacity: 0.16, depthWrite: false, roughness: 0.1 });
const capMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.6 });

function segGeo(segs: [number, number, number, number][], y0: number, h: number, t: number) {
  if (!segs.length) return null;
  const geos = segs.map(([x1, z1, x2, z2]) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const horizontal = Math.abs(z2 - z1) < 1e-3;
    const g = new THREE.BoxGeometry(horizontal ? len + t : t, h, horizontal ? t : len + t);
    g.translate((x1 + x2) / 2, y0 + h / 2, (z1 + z2) / 2);
    return g;
  });
  return mergeGeometries(geos);
}

function labelTexture(text: string, color: string) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(15,23,42,0.0)';
  ctx.fillRect(0, 0, 512, 96);
  ctx.font = 'bold 54px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fillText(text.toUpperCase(), 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// -------- drag helper --------
function useDragger() {
  const { camera, gl } = useThree();
  const controls = useThree((st) => st.controls) as unknown as { enabled: boolean } | null;
  return (e: ThreeEvent<PointerEvent>, origin: { x: number; z: number }, snap: number, apply: (x: number, z: number) => void) => {
    e.stopPropagation();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ray = new THREE.Raycaster();
    const toWorld = (ev: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const p = new THREE.Vector3();
      return ray.ray.intersectPlane(plane, p) ? p : null;
    };
    const start = toWorld(e.nativeEvent);
    if (!start) return;
    const ox = origin.x - start.x, oz = origin.z - start.z;
    if (controls) controls.enabled = false;
    useStore.getState().set({ dragging: true });
    const move = (ev: PointerEvent) => {
      const p = toWorld(ev);
      if (!p) return;
      const nx = Math.round((p.x + ox) / snap) * snap;
      const nz = Math.round((p.z + oz) / snap) * snap;
      apply(Math.max(WORLD.minX + 1, Math.min(WORLD.maxX - 1, nx)), Math.max(WORLD.minZ + 1, Math.min(WORLD.maxZ - 1, nz)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (controls) controls.enabled = true;
      useStore.getState().set({ dragging: false });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
}

// -------- Room --------
export const RoomMesh = memo(function RoomMesh({ room, selected, editMode, lowQuality }: { room: Room; selected: boolean; editMode: boolean; lowQuality: boolean }) {
  const drag = useDragger();
  const segs = useMemo(() => wallSegments(room), [room]);
  const base = useMemo(() => segGeo(segs, 0, WALL_H, WALL_T), [segs]);
  const glass = useMemo(() => segGeo(segs, WALL_H, GLASS_H, 0.06), [segs]);
  const cap = useMemo(() => segGeo(segs, WALL_H + GLASS_H, 0.06, 0.12), [segs]);
  const tex = useMemo(() => labelTexture(room.name, '#334155'), [room.name]);
  const labelPos = useMemo<[number, number, number]>(() => {
    const inset = 0.9;
    switch (room.door_side) {
      case 'n': return [room.x, 0.03, room.z - room.d / 2 + inset];
      case 's': return [room.x, 0.03, room.z + room.d / 2 - inset];
      case 'w': return [room.x - room.w / 2 + inset, 0.03, room.z];
      default: return [room.x + room.w / 2 - inset, 0.03, room.z];
    }
  }, [room]);
  const labelRot = room.door_side === 'w' || room.door_side === 'e' ? Math.PI / 2 : 0;
  const lw = Math.min(room.door_side === 'w' || room.door_side === 'e' ? room.d : room.w, 7) * 0.8;

  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[room.x, 0.012, room.z]}
        receiveShadow
        onPointerDown={editMode ? (e) => {
          if (e.button !== 0) return;
          useStore.getState().set({ selection: { kind: 'room', id: room.id } });
          drag(e, room, 0.5, (x, z) => useStore.getState().updateRoom(room.id, { x, z }, true));
        } : undefined}
      >
        <planeGeometry args={[room.w, room.d]} />
        <meshStandardMaterial color={room.color} roughness={0.95} />
      </mesh>
      {base && <mesh geometry={base} material={wallMat} castShadow receiveShadow />}
      {glass && !lowQuality && <mesh geometry={glass} material={glassMat} />}
      {cap && <mesh geometry={cap} material={capMat} />}
      <mesh rotation={[-Math.PI / 2, 0, labelRot]} position={labelPos}>
        <planeGeometry args={[lw, lw * (96 / 512)]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} />
      </mesh>
      {selected && (
        <mesh position={[room.x, 0.05, room.z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[room.w + 0.3, room.d + 0.3]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.18} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
});

// -------- Furniture --------
export const FurnitureMesh = memo(function FurnitureMesh({ item, selected, editMode }: { item: Furniture; selected: boolean; editMode: boolean }) {
  const drag = useDragger();
  const geo = furnitureGeometry(item.type);
  const fp = footprint(item);
  return (
    <group>
      <mesh
        geometry={geo}
        material={furnitureMaterial}
        position={[item.x, 0, item.z]}
        rotation-y={item.rot}
        castShadow
        receiveShadow
        onPointerDown={editMode ? (e) => {
          if (e.button !== 0) return;
          useStore.getState().set({ selection: { kind: 'furniture', id: item.id } });
          drag(e, item, 0.25, (x, z) => useStore.getState().updateFurniture(item.id, { x, z }));
        } : undefined}
      />
      {selected && (
        <mesh position={[item.x, 0.04, item.z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[fp.hw * 2 + 0.3, fp.hd * 2 + 0.3]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
});

export function OfficeLayout() {
  const rooms = useStore((s) => s.rooms);
  const furniture = useStore((s) => s.furniture);
  const selection = useStore((s) => s.selection);
  const editMode = useStore((s) => s.editMode);
  const low = useStore((s) => s.quality === 'low');
  return (
    <group>
      {rooms.map((r) => (
        <RoomMesh key={r.id} room={r} editMode={editMode} lowQuality={low} selected={selection?.kind === 'room' && selection.id === r.id} />
      ))}
      {furniture.map((f) => (
        <FurnitureMesh key={f.id} item={f} editMode={editMode} selected={selection?.kind === 'furniture' && selection.id === f.id} />
      ))}
    </group>
  );
}
