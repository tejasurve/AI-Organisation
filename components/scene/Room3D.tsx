"use client";

import { useMemo } from "react";
import * as THREE from "three";

import type { Room, RoomState } from "@/lib/simulation/types.ts";
import { rectToWorld } from "@/lib/simulation/world3d.ts";

interface Room3DProps {
  room: Room;
  state: RoomState;
}

const STATE_TINT: Record<
  RoomState,
  { emissive: string; intensity: number; floor: string; border: string }
> = {
  normal: { emissive: "#000000", intensity: 0, floor: "#4a5775", border: "#5d6c8a" },
  hot: { emissive: "#22d3ee", intensity: 0.55, floor: "#3d5d7a", border: "#22d3ee" },
  alert: { emissive: "#ef4444", intensity: 0.85, floor: "#5a2828", border: "#ff4d4d" },
  success: { emissive: "#10b981", intensity: 0.70, floor: "#2a4d3d", border: "#10e89c" },
};

/**
 * A room rendered as a coloured floor zone with a glowing perimeter border
 * (no walls). This eliminates "characters walking through walls" entirely,
 * matches modern open-plan office aesthetics, and keeps every room visually
 * distinct via:
 *   - tinted floor tile
 *   - glowing perimeter strip
 *   - accent strip along the front edge
 *   - room-coloured overhead light
 */
export function Room3D({ room, state }: Room3DProps) {
  const tint = STATE_TINT[state];
  const r = useMemo(() => rectToWorld(room.x, room.y, room.w, room.h), [room]);
  const borderColor = state === "normal" ? room.accent : tint.border;

  return (
    <group>
      {/* Coloured floor zone */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[r.cx, 0.02, r.cz]}
        receiveShadow
      >
        <planeGeometry args={[r.w, r.d]} />
        <meshStandardMaterial
          color={tint.floor}
          emissive={tint.emissive}
          emissiveIntensity={tint.intensity * 0.4}
          roughness={0.7}
          metalness={0.08}
        />
      </mesh>

      {/* Glowing perimeter border — 4 thin emissive strips on the floor.
          These mark room boundaries without obstructing any movement. */}
      <BorderStrip
        position={[r.cx, 0.045, r.cz - r.d / 2]}
        size={[r.w, 0.18]}
        color={borderColor}
        emissive={state === "normal" ? 1.4 : 2.2}
      />
      <BorderStrip
        position={[r.cx, 0.045, r.cz + r.d / 2]}
        size={[r.w, 0.18]}
        color={borderColor}
        emissive={state === "normal" ? 1.4 : 2.2}
      />
      <BorderStrip
        position={[r.cx - r.w / 2, 0.045, r.cz]}
        size={[0.18, r.d]}
        color={borderColor}
        emissive={state === "normal" ? 1.4 : 2.2}
      />
      <BorderStrip
        position={[r.cx + r.w / 2, 0.045, r.cz]}
        size={[0.18, r.d]}
        color={borderColor}
        emissive={state === "normal" ? 1.4 : 2.2}
      />

      {/* Small corner posts — readable as "this is a defined zone" without
          being walls characters can collide with. */}
      {[
        [r.cx - r.w / 2, r.cz - r.d / 2],
        [r.cx + r.w / 2, r.cz - r.d / 2],
        [r.cx - r.w / 2, r.cz + r.d / 2],
        [r.cx + r.w / 2, r.cz + r.d / 2],
      ].map(([px, pz], i) => (
        <mesh key={i} position={[px, 0.25, pz]} castShadow>
          <cylinderGeometry args={[0.10, 0.10, 0.5, 8]} />
          <meshStandardMaterial
            color="#1a2540"
            emissive={borderColor}
            emissiveIntensity={state === "normal" ? 0.4 : 1.2}
            roughness={0.35}
            metalness={0.6}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Accent stripe along the front edge of each room. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[r.cx, 0.06, r.cz - r.d / 2 + 0.5]}
      >
        <planeGeometry args={[Math.max(r.w - 1.5, 1), 0.22]} />
        <meshStandardMaterial
          color={room.accent}
          emissive={room.accent}
          emissiveIntensity={1.1}
          toneMapped={false}
        />
      </mesh>

      {/* Overhead per-room light */}
      <pointLight
        position={[r.cx, 7, r.cz]}
        intensity={
          state === "alert"
            ? 80
            : state === "success"
              ? 65
              : state === "hot"
                ? 55
                : 32
        }
        color={
          state === "alert"
            ? "#ff7070"
            : state === "success"
              ? "#5ee2b3"
              : state === "hot"
                ? "#6de9ff"
                : "#fff3d6"
        }
        distance={Math.max(r.w, r.d) * 1.8}
        decay={1.5}
        castShadow={false}
      />
    </group>
  );
}

function BorderStrip({
  position,
  size,
  color,
  emissive,
}: {
  position: [number, number, number];
  size: [number, number];
  color: string;
  emissive: number;
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position}>
      <planeGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={new THREE.Color(color)}
        emissiveIntensity={emissive}
        toneMapped={false}
      />
    </mesh>
  );
}
