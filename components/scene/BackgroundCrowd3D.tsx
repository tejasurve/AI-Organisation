"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

import { layoutToWorld } from "@/lib/simulation/world3d.ts";

/**
 * Wandering background NPCs to populate the office. These are intentionally
 * decorative — they have no labels, no interactivity, no metric impact. They
 * walk between cosmetic waypoints, pause at points of interest, and walk again.
 *
 * Each NPC is a smaller, simpler version of the lead-agent humanoid so they
 * don't visually compete with the real agents (no chest light, no halo ring,
 * smaller scale, muted palette).
 */

interface BackgroundCrowd3DProps {
  count?: number;
}

// Waypoints are points the crowd cycles between. Coords in layout space (0..100).
const WAYPOINTS: Array<[number, number]> = [
  [28, 12], // coffee bar
  [66, 10], // water cooler
  [76, 27], // design studio couch
  [10, 90], // growth couch
  [18, 95], // growth corner plant
  [50, 95], // bottom-centre plant
  [86, 92], // bottom-right corner
  [4, 50],  // qa-lab bookshelf
  [74, 55], // security bookshelf
  [86, 12], // design studio corner
  [42, 50], // hallway between rooms
  [38, 75], // deployment outskirts
];

const PALETTE = [
  { body: "#3a4a6b", skin: "#e6c8a5", hair: "#2a1f10" },
  { body: "#5a4870", skin: "#d6b08e", hair: "#3a2a1c" },
  { body: "#3e6068", skin: "#ecd0b0", hair: "#1a1208" },
  { body: "#6d5a3d", skin: "#dcb89a", hair: "#2f200f" },
  { body: "#4a5b88", skin: "#e8cda8", hair: "#0e0a06" },
  { body: "#506b58", skin: "#d8b58e", hair: "#2a1c10" },
];

interface NPC {
  pos: THREE.Vector2;
  yaw: number;
  targetIdx: number;
  waitUntil: number;
  speed: number;
  palette: { body: string; skin: string; hair: string };
}

export function BackgroundCrowd3D({ count = 5 }: BackgroundCrowd3DProps) {
  const npcs = useRef<NPC[]>([]);

  if (npcs.current.length === 0) {
    npcs.current = Array.from({ length: count }).map((_, i) => {
      const startIdx = i % WAYPOINTS.length;
      const wp = WAYPOINTS[startIdx];
      return {
        pos: new THREE.Vector2(wp[0], wp[1]),
        yaw: Math.random() * Math.PI * 2,
        targetIdx: (startIdx + 1 + Math.floor(Math.random() * 3)) % WAYPOINTS.length,
        waitUntil: 0,
        speed: 0.7 + Math.random() * 0.4, // layout units per second
        palette: PALETTE[i % PALETTE.length],
      };
    });
  }

  return (
    <group>
      {npcs.current.map((npc, i) => (
        <NPCMesh key={i} npc={npc} />
      ))}
    </group>
  );
}

function NPCMesh({ npc }: { npc: NPC }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);

  const t = useRef(Math.random() * Math.PI * 2);
  const lastDist = useRef(0);

  useFrame((state, dt) => {
    t.current += dt;
    if (!group.current || !body.current) return;

    const now = state.clock.elapsedTime * 1000;
    const target = WAYPOINTS[npc.targetIdx];
    const dx = target[0] - npc.pos.x;
    const dy = target[1] - npc.pos.y;
    const dist = Math.hypot(dx, dz_safe(dy));

    // Reached target — pause, then pick a new one.
    if (dist < 0.5) {
      if (npc.waitUntil === 0) {
        // Just arrived.
        npc.waitUntil = now + 4000 + Math.random() * 8000;
      } else if (now >= npc.waitUntil) {
        npc.targetIdx = pickNewTarget(npc.targetIdx);
        npc.waitUntil = 0;
      }
      // Apply idle anim (no walking).
      applyAnim({ walking: false, body: body.current, leftArm: leftArm.current, rightArm: rightArm.current, leftLeg: leftLeg.current, rightLeg: rightLeg.current, t: t.current });
    } else {
      // Move toward target.
      const dir = new THREE.Vector2(dx, dy).normalize();
      const step = npc.speed * dt;
      npc.pos.x += dir.x * step;
      npc.pos.y += dir.y * step;

      // Face direction.
      const [wx, wz] = layoutToWorld(npc.pos.x, npc.pos.y);
      const [tx, tz] = layoutToWorld(target[0], target[1]);
      const targetYaw = Math.atan2(tx - wx, tz - wz);
      npc.yaw = lerpAngle(npc.yaw, targetYaw, 1 - Math.exp(-dt * 5));

      applyAnim({ walking: true, body: body.current, leftArm: leftArm.current, rightArm: rightArm.current, leftLeg: leftLeg.current, rightLeg: rightLeg.current, t: t.current });
    }

    const [wx, wz] = layoutToWorld(npc.pos.x, npc.pos.y);
    group.current.position.set(wx, 0, wz);
    group.current.rotation.y = npc.yaw;
    lastDist.current = dist;
  });

  // Note: NPCs are at ~88% scale vs lead agents, so they read as background.
  return (
    <group ref={group} scale={[0.88, 0.88, 0.88]}>
      {/* Contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <circleGeometry args={[0.65, 24]} />
        <meshBasicMaterial color="#0a0f1a" transparent opacity={0.35} />
      </mesh>

      <group ref={body}>
        {/* Legs */}
        <group ref={leftLeg} position={[-0.12, 0.85, 0]}>
          <mesh position={[0, -0.42, 0]}>
            <cylinderGeometry args={[0.10, 0.10, 0.85, 10]} />
            <meshStandardMaterial color="#202b3e" roughness={0.65} />
          </mesh>
          <mesh position={[0, -0.88, 0.05]}>
            <boxGeometry args={[0.2, 0.09, 0.3]} />
            <meshStandardMaterial color="#101521" roughness={0.5} />
          </mesh>
        </group>
        <group ref={rightLeg} position={[+0.12, 0.85, 0]}>
          <mesh position={[0, -0.42, 0]}>
            <cylinderGeometry args={[0.10, 0.10, 0.85, 10]} />
            <meshStandardMaterial color="#202b3e" roughness={0.65} />
          </mesh>
          <mesh position={[0, -0.88, 0.05]}>
            <boxGeometry args={[0.2, 0.09, 0.3]} />
            <meshStandardMaterial color="#101521" roughness={0.5} />
          </mesh>
        </group>

        {/* Torso */}
        <RoundedBox args={[0.56, 0.72, 0.36]} radius={0.1} smoothness={3} position={[0, 1.26, 0]}>
          <meshStandardMaterial
            color={npc.palette.body}
            emissive={npc.palette.body}
            emissiveIntensity={0.10}
            roughness={0.55}
            metalness={0.08}
            toneMapped={false}
          />
        </RoundedBox>

        {/* Arms */}
        <group ref={leftArm} position={[-0.33, 1.58, 0]}>
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.64, 10]} />
            <meshStandardMaterial color={npc.palette.body} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.66, 0]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshStandardMaterial color={npc.palette.skin} roughness={0.55} />
          </mesh>
        </group>
        <group ref={rightArm} position={[+0.33, 1.58, 0]}>
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.64, 10]} />
            <meshStandardMaterial color={npc.palette.body} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.66, 0]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshStandardMaterial color={npc.palette.skin} roughness={0.55} />
          </mesh>
        </group>

        {/* Neck */}
        <mesh position={[0, 1.72, 0]}>
          <cylinderGeometry args={[0.08, 0.09, 0.1, 10]} />
          <meshStandardMaterial color={npc.palette.skin} roughness={0.55} />
        </mesh>

        {/* Head */}
        <mesh position={[0, 1.92, 0]} scale={[1, 1.05, 0.95]}>
          <sphereGeometry args={[0.24, 22, 22]} />
          <meshStandardMaterial color={npc.palette.skin} roughness={0.5} />
        </mesh>
        {/* Hair */}
        <mesh position={[0, 2.0, 0]} scale={[1.0, 0.55, 1.0]}>
          <sphereGeometry args={[0.24, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={npc.palette.hair} roughness={0.7} />
        </mesh>
        {/* Eyes */}
        <mesh position={[-0.075, 1.92, 0.205]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        <mesh position={[+0.075, 1.92, 0.205]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
      </group>
    </group>
  );
}

// ---------- helpers ----------

function applyAnim({
  walking,
  body,
  leftArm,
  rightArm,
  leftLeg,
  rightLeg,
  t,
}: {
  walking: boolean;
  body: THREE.Group;
  leftArm: THREE.Group | null;
  rightArm: THREE.Group | null;
  leftLeg: THREE.Group | null;
  rightLeg: THREE.Group | null;
  t: number;
}) {
  if (walking) {
    const phase = t * 7;
    body.position.y = Math.abs(Math.sin(phase)) * 0.07;
    body.rotation.z = Math.sin(phase) * 0.025;
    const swing = Math.sin(phase) * 0.65;
    if (leftLeg) leftLeg.rotation.x = swing;
    if (rightLeg) rightLeg.rotation.x = -swing;
    if (leftArm) leftArm.rotation.x = -swing * 0.7;
    if (rightArm) rightArm.rotation.x = swing * 0.7;
  } else {
    body.position.y = Math.sin(t * 0.9) * 0.018;
    body.rotation.z = 0;
    const idle = Math.sin(t * 1.4) * 0.05;
    if (leftArm) leftArm.rotation.x = idle;
    if (rightArm) rightArm.rotation.x = -idle;
    if (leftLeg) leftLeg.rotation.x = 0;
    if (rightLeg) rightLeg.rotation.x = 0;
  }
}

function pickNewTarget(currentIdx: number): number {
  let next = currentIdx;
  // Prefer waypoints that aren't the current one.
  for (let i = 0; i < 6; i++) {
    next = Math.floor(Math.random() * WAYPOINTS.length);
    if (next !== currentIdx) return next;
  }
  return (currentIdx + 1) % WAYPOINTS.length;
}

function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * t;
}

function dz_safe(v: number): number {
  return v;
}
