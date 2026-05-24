"use client";

import { useMemo, useRef, useState } from "react";
import { Html, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { AGENT_PERSONALITIES } from "@/lib/simulation/layout.ts";
import type {
  AgentStatus,
  ConversationBubble,
  VisualAgent,
} from "@/lib/simulation/types.ts";
import { layoutToWorld } from "@/lib/simulation/world3d.ts";

interface Agent3DProps {
  agent: VisualAgent;
  bubble: ConversationBubble | undefined;
  selected: boolean;
  onSelect: () => void;
}

const STATUS_COLOR: Record<AgentStatus, { ring: string; halo: number }> = {
  idle: { ring: "#a3b1c8", halo: 0.2 },
  thinking: { ring: "#60d5ff", halo: 1.0 },
  building: { ring: "#5eebff", halo: 1.1 },
  reviewing: { ring: "#fbbf24", halo: 1.1 },
  blocked: { ring: "#ff5a5a", halo: 1.4 },
  deploying: { ring: "#34d399", halo: 1.2 },
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "Idle",
  thinking: "Thinking",
  building: "Building",
  reviewing: "Reviewing",
  blocked: "Blocked",
  deploying: "Deploying",
};

const STATUS_ICON: Record<AgentStatus, string> = {
  idle: "",
  thinking: "💭",
  building: "⌨️",
  reviewing: "🔍",
  blocked: "⚠️",
  deploying: "🚀",
};

/**
 * Humanoid character: torso + head + hair + eyes + 2 arms + 2 legs, with a
 * proper walk cycle. Smoothly interpolates toward the target floor position
 * and faces the direction of motion.
 */
export function Agent3D({ agent, bubble, selected, onSelect }: Agent3DProps) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const head = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);

  const [hovered, setHovered] = useState(false);

  const personality = AGENT_PERSONALITIES[agent.id];
  const statusColor = STATUS_COLOR[agent.status];

  const initial = useMemo(() => layoutToWorld(agent.x, agent.y), []); // eslint-disable-line react-hooks/exhaustive-deps

  const t = useRef(Math.random() * Math.PI * 2);
  const prevPos = useRef<{ x: number; z: number }>({ x: initial[0], z: initial[1] });
  const speed = useRef(0);

  useFrame((_, dt) => {
    t.current += dt;
    if (!group.current || !body.current) return;

    const [targetX, targetZ] = layoutToWorld(agent.x, agent.y);
    const cur = group.current.position;

    // Smooth lerp toward target.
    const lerp = 1 - Math.exp(-dt * 3.0);
    cur.x += (targetX - cur.x) * lerp;
    cur.z += (targetZ - cur.z) * lerp;

    // Instant speed for walk amplitude.
    const dx = cur.x - prevPos.current.x;
    const dz = cur.z - prevPos.current.z;
    const inst = Math.hypot(dx, dz) / Math.max(dt, 0.001);
    speed.current = speed.current * 0.85 + inst * 0.15;
    prevPos.current = { x: cur.x, z: cur.z };

    // Face direction of motion.
    if (inst > 0.2) {
      const targetYaw = Math.atan2(dx, dz);
      const curYaw = group.current.rotation.y;
      group.current.rotation.y = lerpAngle(curYaw, targetYaw, 1 - Math.exp(-dt * 4));
    }

    const walking = speed.current > 0.5;
    const walkPhase = t.current * 7;

    // ---------- Body anim ----------
    if (walking) {
      // Walking bob + lean
      body.current.position.y = Math.abs(Math.sin(walkPhase)) * 0.08;
      body.current.rotation.z = Math.sin(walkPhase) * 0.03;
      body.current.rotation.x = -0.05;
    } else if (agent.status === "blocked") {
      body.current.position.y = Math.abs(Math.sin(t.current * 8)) * 0.025;
      body.current.rotation.z = Math.sin(t.current * 8) * 0.10;
      body.current.rotation.x = 0;
    } else if (agent.status === "thinking" || agent.status === "reviewing") {
      body.current.position.y = Math.sin(t.current * 1.4) * 0.04;
      body.current.rotation.z = Math.sin(t.current * 0.8) * 0.015;
      body.current.rotation.x = 0.04;
    } else if (agent.status === "building") {
      // Slight forward lean + small head/arm twitch when typing
      body.current.position.y = Math.sin(t.current * 6) * 0.025;
      body.current.rotation.z = 0;
      body.current.rotation.x = 0.10;
    } else {
      body.current.position.y = Math.sin(t.current * 0.8) * 0.018;
      body.current.rotation.z = 0;
      body.current.rotation.x = 0;
    }

    // ---------- Limb anim ----------
    if (walking) {
      // Counter-swing arms and legs
      const swing = Math.sin(walkPhase) * 0.7;
      if (leftLeg.current) leftLeg.current.rotation.x = swing;
      if (rightLeg.current) rightLeg.current.rotation.x = -swing;
      if (leftArm.current) leftArm.current.rotation.x = -swing * 0.8;
      if (rightArm.current) rightArm.current.rotation.x = swing * 0.8;
    } else if (agent.status === "building") {
      // Typing: subtle forearm jitter
      const jitter = Math.sin(t.current * 12) * 0.15;
      if (leftArm.current) leftArm.current.rotation.x = 1.0 + jitter;
      if (rightArm.current) rightArm.current.rotation.x = 1.0 - jitter;
      if (leftLeg.current) leftLeg.current.rotation.x = 0;
      if (rightLeg.current) rightLeg.current.rotation.x = 0;
    } else if (agent.status === "thinking") {
      // Hand-on-chin — one arm raised
      if (leftArm.current) leftArm.current.rotation.x = 0.0;
      if (rightArm.current) rightArm.current.rotation.x = 1.5 + Math.sin(t.current * 1.2) * 0.08;
      if (leftLeg.current) leftLeg.current.rotation.x = 0;
      if (rightLeg.current) rightLeg.current.rotation.x = 0;
    } else if (agent.status === "blocked") {
      // Both arms slightly raised, frustrated
      if (leftArm.current) leftArm.current.rotation.x = 0.6;
      if (rightArm.current) rightArm.current.rotation.x = 0.6;
      if (leftLeg.current) leftLeg.current.rotation.x = 0;
      if (rightLeg.current) rightLeg.current.rotation.x = 0;
    } else {
      // Gentle idle sway
      const idle = Math.sin(t.current * 1.4) * 0.06;
      if (leftArm.current) leftArm.current.rotation.x = idle;
      if (rightArm.current) rightArm.current.rotation.x = -idle;
      if (leftLeg.current) leftLeg.current.rotation.x = 0;
      if (rightLeg.current) rightLeg.current.rotation.x = 0;
    }

    // Head: tiny look-around idle motion + nod when thinking
    if (head.current) {
      if (agent.status === "thinking") {
        head.current.rotation.y = Math.sin(t.current * 0.7) * 0.25;
        head.current.rotation.x = 0.15 + Math.sin(t.current * 0.4) * 0.05;
      } else if (agent.status === "building") {
        head.current.rotation.y = 0;
        head.current.rotation.x = 0.25;
      } else {
        head.current.rotation.y = Math.sin(t.current * 0.5) * 0.10;
        head.current.rotation.x = 0;
      }
    }

    // Status ring pulse.
    if (ring.current && ringMat.current) {
      const pulse = (Math.sin(t.current * 2.8) + 1) / 2;
      const scale = 1 + pulse * (statusColor.halo > 0.4 ? 0.45 : 0.1);
      ring.current.scale.set(scale, scale, scale);
      ringMat.current.opacity = 0.5 + pulse * (statusColor.halo > 0.4 ? 0.5 : 0.15);
    }
  });

  const skinColor = personality.headColor;
  const bodyColor = personality.bodyColor;
  const hairColor = "#2a2118";
  const pantsColor = "#202b3e";
  const shoeColor = "#101521";

  return (
    <group
      ref={group}
      position={[initial[0], 0, initial[1]]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Contact shadow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <circleGeometry args={[0.75, 32]} />
        <meshBasicMaterial color="#0a0f1a" transparent opacity={0.45} />
      </mesh>

      {/* Status ring */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.6, 0.82, 32]} />
        <meshBasicMaterial
          ref={ringMat}
          color={statusColor.ring}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>

      {/* Hover/selected outer ring */}
      {(selected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
          <ringGeometry args={[0.92, 1.05, 48]} />
          <meshBasicMaterial
            color={selected ? "#fde68a" : "#ffffff"}
            transparent
            opacity={selected ? 0.95 : 0.55}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* ---- HUMANOID BODY ---- */}
      <group ref={body}>
        {/* Legs anchored at hip (y ≈ 0.85) — rotate at hip, swing forward/back */}
        <group ref={leftLeg} position={[-0.13, 0.85, 0]}>
          <mesh position={[0, -0.42, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.11, 0.85, 14]} />
            <meshStandardMaterial color={pantsColor} roughness={0.6} metalness={0.1} />
          </mesh>
          <mesh position={[0, -0.88, 0.05]}>
            <boxGeometry args={[0.22, 0.1, 0.34]} />
            <meshStandardMaterial color={shoeColor} roughness={0.4} metalness={0.3} />
          </mesh>
        </group>
        <group ref={rightLeg} position={[+0.13, 0.85, 0]}>
          <mesh position={[0, -0.42, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.11, 0.85, 14]} />
            <meshStandardMaterial color={pantsColor} roughness={0.6} metalness={0.1} />
          </mesh>
          <mesh position={[0, -0.88, 0.05]}>
            <boxGeometry args={[0.22, 0.1, 0.34]} />
            <meshStandardMaterial color={shoeColor} roughness={0.4} metalness={0.3} />
          </mesh>
        </group>

        {/* Torso (rounded box) */}
        <RoundedBox
          args={[0.62, 0.78, 0.4]}
          radius={0.12}
          smoothness={4}
          position={[0, 1.28, 0]}
          castShadow
        >
          <meshStandardMaterial
            color={bodyColor}
            emissive={bodyColor}
            emissiveIntensity={0.18}
            roughness={0.45}
            metalness={0.1}
            toneMapped={false}
          />
        </RoundedBox>

        {/* Status chest light — a glowing pill on the torso */}
        <mesh position={[0, 1.40, 0.21]}>
          <boxGeometry args={[0.18, 0.08, 0.02]} />
          <meshStandardMaterial
            color={statusColor.ring}
            emissive={statusColor.ring}
            emissiveIntensity={statusColor.halo > 0.4 ? 2.0 : 0.4}
            toneMapped={false}
          />
        </mesh>

        {/* Arms — anchored at shoulder (y ≈ 1.60), swing at shoulder */}
        <group ref={leftArm} position={[-0.36, 1.60, 0]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <cylinderGeometry args={[0.085, 0.085, 0.68, 12]} />
            <meshStandardMaterial
              color={bodyColor}
              emissive={bodyColor}
              emissiveIntensity={0.15}
              roughness={0.5}
              metalness={0.1}
              toneMapped={false}
            />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.7, 0]}>
            <sphereGeometry args={[0.1, 14, 14]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} metalness={0.05} />
          </mesh>
        </group>
        <group ref={rightArm} position={[+0.36, 1.60, 0]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <cylinderGeometry args={[0.085, 0.085, 0.68, 12]} />
            <meshStandardMaterial
              color={bodyColor}
              emissive={bodyColor}
              emissiveIntensity={0.15}
              roughness={0.5}
              metalness={0.1}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, -0.7, 0]}>
            <sphereGeometry args={[0.1, 14, 14]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} metalness={0.05} />
          </mesh>
        </group>

        {/* Neck */}
        <mesh position={[0, 1.75, 0]}>
          <cylinderGeometry args={[0.09, 0.10, 0.12, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} metalness={0.05} />
        </mesh>

        {/* Head + face (group rotates as one) */}
        <group ref={head} position={[0, 1.96, 0]}>
          {/* Skull (slightly squashed sphere) */}
          <mesh castShadow scale={[1, 1.05, 0.95]}>
            <sphereGeometry args={[0.26, 28, 28]} />
            <meshStandardMaterial
              color={skinColor}
              emissive={skinColor}
              emissiveIntensity={0.12}
              roughness={0.45}
              metalness={0.05}
            />
          </mesh>
          {/* Hair (slightly larger half-sphere offset to top) */}
          <mesh position={[0, 0.08, 0]} scale={[1.05, 0.55, 1.05]}>
            <sphereGeometry args={[0.26, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color={hairColor} roughness={0.6} metalness={0.1} />
          </mesh>
          {/* Eyes — small dark spheres on the front face */}
          <mesh position={[-0.085, 0.0, 0.225]}>
            <sphereGeometry args={[0.028, 12, 12]} />
            <meshStandardMaterial
              color="#0a0a0a"
              emissive="#cfd8e3"
              emissiveIntensity={0.6}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[+0.085, 0.0, 0.225]}>
            <sphereGeometry args={[0.028, 12, 12]} />
            <meshStandardMaterial
              color="#0a0a0a"
              emissive="#cfd8e3"
              emissiveIntensity={0.6}
              roughness={0.2}
            />
          </mesh>
          {/* Tiny mouth hint */}
          <mesh position={[0, -0.09, 0.235]}>
            <boxGeometry args={[0.05, 0.012, 0.002]} />
            <meshStandardMaterial color="#7a3a3a" roughness={0.6} />
          </mesh>
        </group>
      </group>

      {/* Name + status tag floating above */}
      <Html
        position={[0, 2.95, 0]}
        center
        distanceFactor={11}
        zIndexRange={[100, 0]}
        occlude={false}
      >
        <div className="pointer-events-none -translate-x-1/2 select-none whitespace-nowrap text-center">
          <div className="rounded bg-floor-900/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-100 ring-1 ring-white/15 shadow">
            {agent.role}
          </div>
          <div
            className="mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{
              color: statusColor.ring,
              background: hexToRgba(statusColor.ring, 0.16),
              boxShadow: `inset 0 0 0 1px ${hexToRgba(statusColor.ring, 0.45)}`,
            }}
          >
            {STATUS_ICON[agent.status] && (
              <span className="text-[10px]">{STATUS_ICON[agent.status]}</span>
            )}
            {STATUS_LABEL[agent.status]}
          </div>
        </div>
      </Html>

      {/* Speech bubble */}
      {bubble && (
        <Html
          position={[0, 3.55, 0]}
          center
          distanceFactor={9}
          zIndexRange={[200, 0]}
          occlude={false}
        >
          <div className="pointer-events-none -translate-x-1/2">
            <div className="relative max-w-[230px] rounded-md bg-floor-900/95 px-2.5 py-1.5 text-[11px] leading-snug text-zinc-100 shadow-lg ring-1 ring-white/15">
              <span className="mr-1 text-cyan-300/90">{agent.role}:</span>
              {bubble.text}
              <span
                aria-hidden
                className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-floor-900/95 ring-1 ring-white/15"
              />
            </div>
          </div>
        </Html>
      )}

      {/* Hover tooltip — only when not selected (to avoid noise) */}
      {hovered && !selected && (
        <Html
          position={[0, 1.0, 0]}
          center
          distanceFactor={9}
          zIndexRange={[300, 0]}
          occlude={false}
        >
          <div className="pointer-events-none -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-950 shadow">
            Click to inspect
          </div>
        </Html>
      )}
    </group>
  );
}

// ---------- helpers ----------

function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * t;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const bigint = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
