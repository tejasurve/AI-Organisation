"use client";

import { motion } from "framer-motion";

import type { AgentStatus, VisualAgent } from "@/lib/simulation/types.ts";

interface AgentSpriteProps {
  agent: VisualAgent;
  selected: boolean;
  onSelect: () => void;
}

const STATUS_STYLES: Record<
  AgentStatus,
  { ring: string; bg: string; glow: string; label: string; pulse: boolean }
> = {
  idle: {
    ring: "ring-zinc-500/60",
    bg: "bg-zinc-700/90",
    glow: "rgba(161, 161, 170, 0.4)",
    label: "Idle",
    pulse: false,
  },
  thinking: {
    ring: "ring-sky-300/80",
    bg: "bg-sky-500",
    glow: "rgba(56, 189, 248, 0.55)",
    label: "Thinking",
    pulse: true,
  },
  building: {
    ring: "ring-cyan-300/80",
    bg: "bg-cyan-500",
    glow: "rgba(34, 211, 238, 0.6)",
    label: "Building",
    pulse: true,
  },
  reviewing: {
    ring: "ring-amber-300/80",
    bg: "bg-amber-500",
    glow: "rgba(251, 191, 36, 0.6)",
    label: "Reviewing",
    pulse: true,
  },
  blocked: {
    ring: "ring-red-400",
    bg: "bg-red-500",
    glow: "rgba(239, 68, 68, 0.7)",
    label: "Blocked",
    pulse: true,
  },
  deploying: {
    ring: "ring-emerald-300/80",
    bg: "bg-emerald-500",
    glow: "rgba(16, 185, 129, 0.6)",
    label: "Deploying",
    pulse: true,
  },
};

export function AgentSprite({ agent, selected, onSelect }: AgentSpriteProps) {
  const s = STATUS_STYLES[agent.status];

  return (
    <motion.button
      className="absolute -translate-x-1/2 -translate-y-1/2 outline-none"
      style={{ zIndex: selected ? 30 : 20 }}
      initial={false}
      animate={{
        left: `${agent.x}%`,
        top: `${agent.y}%`,
      }}
      transition={{
        type: "spring",
        damping: 18,
        stiffness: 90,
        mass: 0.9,
      }}
      onClick={onSelect}
      aria-label={`${agent.role} — ${s.label}`}
    >
      <div className="relative flex flex-col items-center">
        {/* Pulse ring */}
        {s.pulse && (
          <span
            aria-hidden
            className={`absolute h-9 w-9 rounded-full ring-2 ${s.ring} animate-pulseRing`}
            style={{ animationDuration: "1.8s" }}
          />
        )}
        {/* Body */}
        <span
          className={`relative flex h-9 w-9 items-center justify-center rounded-full ring-2 ${s.ring} ${s.bg} status-glow text-[13px] font-semibold text-white transition-transform ${
            selected ? "scale-110" : "hover:scale-105"
          }`}
          style={{ "--glow": s.glow } as React.CSSProperties}
        >
          {agent.monogram}
        </span>
        {/* Role chip */}
        <span className="mt-1 rounded bg-floor-900/85 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-300 ring-1 ring-white/5">
          {agent.role}
        </span>
        {/* Selected dashed ring */}
        {selected && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-2 rounded-full border border-dashed border-cyan-300/70"
          />
        )}
      </div>
    </motion.button>
  );
}
