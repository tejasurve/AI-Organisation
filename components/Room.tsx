"use client";

import { motion } from "framer-motion";

import type { Room as RoomShape, RoomState } from "@/lib/simulation/types.ts";

interface RoomProps {
  room: RoomShape;
  state: RoomState;
}

const STATE_STYLES: Record<RoomState, { ring: string; bg: string; label: string }> = {
  normal: {
    ring: "ring-zinc-700/60",
    bg: "bg-floor-800/60",
    label: "text-zinc-400",
  },
  hot: {
    ring: "ring-cyan-400/70 shadow-[0_0_36px_-12px_rgba(34,211,238,0.6)]",
    bg: "bg-cyan-500/[0.06]",
    label: "text-cyan-300",
  },
  alert: {
    ring: "ring-red-500/80 shadow-[0_0_42px_-10px_rgba(239,68,68,0.7)]",
    bg: "bg-red-500/[0.08]",
    label: "text-red-300",
  },
  success: {
    ring: "ring-emerald-400/70 shadow-[0_0_36px_-10px_rgba(16,185,129,0.65)]",
    bg: "bg-emerald-500/[0.06]",
    label: "text-emerald-300",
  },
};

export function Room({ room, state }: RoomProps) {
  const styles = STATE_STYLES[state];

  return (
    <motion.div
      className={`absolute rounded-lg ring-1 backdrop-blur-[1px] ${styles.ring} ${styles.bg}`}
      style={{
        left: `${room.x}%`,
        top: `${room.y}%`,
        width: `${room.w}%`,
        height: `${room.h}%`,
        // Per-room accent shown as a thin top bar.
        borderTop: `2px solid ${room.accent}55`,
      }}
      initial={false}
      animate={{
        opacity: state === "alert" ? [1, 0.85, 1] : 1,
      }}
      transition={{
        duration: state === "alert" ? 1.1 : 0.4,
        repeat: state === "alert" ? Infinity : 0,
      }}
    >
      {/* Label */}
      <div className={`absolute left-3 top-2 text-[10px] font-medium uppercase tracking-[0.18em] ${styles.label}`}>
        {room.label}
      </div>

      {/* Seats — small dots so workstations are visible even when empty */}
      {room.seats.map((seat) => (
        <div
          key={seat.id}
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-zinc-600/70"
          style={{
            left: `${((seat.x - room.x) / room.w) * 100}%`,
            top: `${((seat.y - room.y) / room.h) * 100}%`,
          }}
          title={seat.id}
        />
      ))}

      {/* Subtle scanline when "hot" */}
      {state === "hot" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
          <div className="absolute inset-x-0 h-px bg-cyan-300/40 animate-scanline" />
        </div>
      )}
    </motion.div>
  );
}
