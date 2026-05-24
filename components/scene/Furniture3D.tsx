"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { ROOMS } from "@/lib/simulation/layout.ts";
import type { Room, SeatKind } from "@/lib/simulation/types.ts";
import { HEIGHTS, layoutToWorld } from "@/lib/simulation/world3d.ts";

/** All workstations across all rooms. */
export function Furniture3D() {
  return (
    <group>
      {ROOMS.map((room) =>
        room.seats.map((seat) => {
          const [x, z] = layoutToWorld(seat.x, seat.y);
          return (
            <Seat
              key={seat.id}
              kind={seat.kind}
              position={[x, 0, z]}
              accent={room.accent}
              roomFacing={facingDir(room, seat)}
            />
          );
        }),
      )}
    </group>
  );
}

function Seat({
  kind,
  position,
  accent,
  roomFacing,
}: {
  kind: SeatKind;
  position: [number, number, number];
  accent: string;
  roomFacing: number; // rotation in radians around Y
}) {
  switch (kind) {
    case "desk":
      return <Desk position={position} rotation={roomFacing} />;
    case "monitor":
      return <Workstation position={position} rotation={roomFacing} />;
    case "console":
      return <Console position={position} rotation={roomFacing} accent={accent} />;
    case "whiteboard":
      return <Whiteboard position={position} rotation={roomFacing} accent={accent} />;
    case "server-rack":
      return <ServerRack position={position} rotation={roomFacing} />;
    case "vault":
      return <Vault position={position} rotation={roomFacing} accent={accent} />;
  }
}

// ---------- Primitives ----------

function Desk({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Top — warm light wood tone so it reads as a real desk */}
      <mesh position={[0, HEIGHTS.desk, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.12, 1.4]} />
        <meshStandardMaterial color="#c9a87a" roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Legs */}
      {[
        [-1.15, HEIGHTS.desk / 2 - 0.02, -0.55],
        [+1.15, HEIGHTS.desk / 2 - 0.02, -0.55],
        [-1.15, HEIGHTS.desk / 2 - 0.02, +0.55],
        [+1.15, HEIGHTS.desk / 2 - 0.02, +0.55],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <boxGeometry args={[0.1, HEIGHTS.desk - 0.1, 0.1]} />
          <meshStandardMaterial color="#3a4458" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      {/* Chair */}
      <mesh position={[0, 0.45, 1.2]} castShadow>
        <boxGeometry args={[0.7, 0.08, 0.7]} />
        <meshStandardMaterial color="#475573" roughness={0.55} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.85, 1.45]} castShadow>
        <boxGeometry args={[0.7, 0.7, 0.08]} />
        <meshStandardMaterial color="#475573" roughness={0.55} metalness={0.25} />
      </mesh>
      {/* Laptop hint on the desk */}
      <mesh position={[0, HEIGHTS.desk + 0.08, 0]}>
        <boxGeometry args={[0.9, 0.04, 0.6]} />
        <meshStandardMaterial color="#2a3550" roughness={0.4} metalness={0.5} />
      </mesh>
    </group>
  );
}

function Workstation({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: number;
}) {
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (screenMat.current) {
      // Soft breathing glow on monitor — gives "in use" feel even when idle.
      const pulse = 0.55 + Math.sin(t.current * 1.6) * 0.15;
      screenMat.current.emissiveIntensity = pulse;
    }
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Desk under monitor */}
      <Desk position={[0, 0, 0]} rotation={0} />
      {/* Monitor stand */}
      <mesh position={[0, HEIGHTS.monitorBase + 0.05, -0.3]}>
        <boxGeometry args={[0.12, 0.32, 0.12]} />
        <meshStandardMaterial color="#2c3650" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Monitor bezel */}
      <mesh
        position={[0, HEIGHTS.monitorBase + 0.45, -0.3]}
        castShadow
      >
        <boxGeometry args={[1.4, 0.85, 0.1]} />
        <meshStandardMaterial color="#1a2235" roughness={0.45} metalness={0.65} />
      </mesh>
      {/* Screen (emissive — much brighter so it reads as "on") */}
      <mesh position={[0, HEIGHTS.monitorBase + 0.45, -0.245]}>
        <planeGeometry args={[1.3, 0.78]} />
        <meshStandardMaterial
          ref={screenMat}
          color="#143a55"
          emissive="#4dd6ff"
          emissiveIntensity={1.2}
          roughness={0.2}
          metalness={0.0}
          toneMapped={false}
        />
      </mesh>
      {/* Keyboard hint */}
      <mesh position={[0, HEIGHTS.desk + 0.06, 0.2]}>
        <boxGeometry args={[1.1, 0.04, 0.36]} />
        <meshStandardMaterial color="#2a3550" roughness={0.6} metalness={0.45} />
      </mesh>
    </group>
  );
}

function Console({
  position,
  rotation,
  accent,
}: {
  position: [number, number, number];
  rotation: number;
  accent: string;
}) {
  const blinkRef = useRef<THREE.MeshStandardMaterial>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (blinkRef.current) {
      blinkRef.current.emissiveIntensity = 1.2 + Math.sin(t.current * 3.2) * 0.3;
    }
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Slanted control panel */}
      <mesh
        position={[0, HEIGHTS.consoleTop / 2, 0]}
        rotation={[-0.5, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[2.0, 0.1, 1.3]} />
        <meshStandardMaterial color="#3a4660" roughness={0.4} metalness={0.55} />
      </mesh>
      {/* Glowing display strip */}
      <mesh
        position={[0, HEIGHTS.consoleTop / 2 + 0.55, -0.25]}
        rotation={[-0.5, 0, 0]}
      >
        <planeGeometry args={[1.6, 0.55]} />
        <meshStandardMaterial
          ref={blinkRef}
          color="#1a3050"
          emissive={accent}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.25, 0.4]} castShadow>
        <boxGeometry args={[1.9, 0.5, 0.4]} />
        <meshStandardMaterial color="#2a3550" roughness={0.55} metalness={0.45} />
      </mesh>
    </group>
  );
}

function Whiteboard({
  position,
  rotation,
  accent,
}: {
  position: [number, number, number];
  rotation: number;
  accent: string;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Stand poles */}
      <mesh position={[-1.2, HEIGHTS.whiteboardBottom + 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, HEIGHTS.whiteboardTop, 8]} />
        <meshStandardMaterial color="#3a4660" roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh position={[+1.2, HEIGHTS.whiteboardBottom + 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, HEIGHTS.whiteboardTop, 8]} />
        <meshStandardMaterial color="#3a4660" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Board — bright white that catches the light */}
      <mesh
        position={[0, (HEIGHTS.whiteboardBottom + HEIGHTS.whiteboardTop) / 2, 0]}
        castShadow
      >
        <boxGeometry args={[2.6, HEIGHTS.whiteboardTop - HEIGHTS.whiteboardBottom, 0.08]} />
        <meshStandardMaterial color="#f8f9fb" roughness={0.6} metalness={0.0} />
      </mesh>
      {/* Sticky notes — brighter, pop more */}
      {[-0.7, -0.1, 0.5, 0.9].map((dx, i) => (
        <mesh
          key={i}
          position={[dx, HEIGHTS.whiteboardBottom + 0.7 + (i % 2) * 0.5, 0.05]}
        >
          <planeGeometry args={[0.32, 0.32]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? "#fde047" : "#a7f3d0"}
            emissive={i % 2 === 0 ? "#fde047" : "#a7f3d0"}
            emissiveIntensity={0.18}
            roughness={0.9}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function ServerRack({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const t = useRef(Math.random() * Math.PI);
  useFrame((_, dt) => {
    t.current += dt;
    if (!groupRef.current) return;
    // Mild fan flicker via emissive lights on the rack
    groupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).userData?.led) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        const ledIndex = (child as THREE.Mesh).userData.led as number;
        mat.emissiveIntensity =
          0.55 + Math.sin(t.current * 4 + ledIndex * 1.3) * 0.4;
      }
    });
  });

  const units = useMemo(() => [0, 1, 2, 3, 4, 5, 6, 7], []);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
      {/* Outer body */}
      <mesh position={[0, HEIGHTS.serverRackTop / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, HEIGHTS.serverRackTop, 1.2]} />
        <meshStandardMaterial color="#2a3550" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* Front blade slits + LEDs */}
      {units.map((u) => {
        const y = 0.4 + u * (HEIGHTS.serverRackTop - 0.6) / units.length;
        return (
          <group key={u} position={[0, y, 0.61]}>
            <mesh>
              <boxGeometry args={[1.05, 0.18, 0.04]} />
              <meshStandardMaterial color="#1a2540" roughness={0.55} metalness={0.65} />
            </mesh>
            <mesh
              userData={{ led: u }}
              position={[-0.4, 0, 0.03]}
            >
              <boxGeometry args={[0.06, 0.06, 0.02]} />
              <meshStandardMaterial
                color="#0a1828"
                emissive="#34d399"
                emissiveIntensity={1.2}
                toneMapped={false}
              />
            </mesh>
            <mesh
              userData={{ led: u + 100 }}
              position={[-0.2, 0, 0.03]}
            >
              <boxGeometry args={[0.06, 0.06, 0.02]} />
              <meshStandardMaterial
                color="#0a1828"
                emissive="#4dd6ff"
                emissiveIntensity={1.2}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Vault({
  position,
  rotation,
  accent,
}: {
  position: [number, number, number];
  rotation: number;
  accent: string;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, HEIGHTS.vaultTop / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, HEIGHTS.vaultTop, 1.0]} />
        <meshStandardMaterial color="#3a4660" roughness={0.35} metalness={0.75} />
      </mesh>
      {/* Glowing seal */}
      <mesh position={[0, HEIGHTS.vaultTop / 2, 0.52]}>
        <circleGeometry args={[0.35, 32]} />
        <meshStandardMaterial
          color="#3a2030"
          emissive={accent}
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ---------- helpers ----------

/** Rotate furniture so it faces inwards from the nearest wall. */
function facingDir(room: Room, seat: { x: number; y: number }): number {
  // Pick the wall closest to the seat's position; face away from that wall.
  const left = seat.x - room.x;
  const right = room.x + room.w - seat.x;
  const top = seat.y - room.y;
  const bottom = room.y + room.h - seat.y;
  const min = Math.min(left, right, top, bottom);
  if (min === top) return 0;                 // back wall → face front (toward +Z)
  if (min === bottom) return Math.PI;        // front wall → face back
  if (min === left) return Math.PI / 2;      // left wall → face right
  return -Math.PI / 2;                       // right wall → face left
}
