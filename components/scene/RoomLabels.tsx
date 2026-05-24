"use client";

import { Html } from "@react-three/drei";

import type { Room, RoomId, RoomState } from "@/lib/simulation/types.ts";
import { rectToWorld } from "@/lib/simulation/world3d.ts";

interface RoomLabelsProps {
  rooms: readonly Room[];
  states: Record<RoomId, RoomState>;
}

const STATE_DOT: Record<RoomState, { color: string; label: string }> = {
  normal: { color: "#71717a", label: "" },
  hot: { color: "#22d3ee", label: "ACTIVE" },
  alert: { color: "#ef4444", label: "ALERT" },
  success: { color: "#10b981", label: "SUCCESS" },
};

const ROOM_ICON: Record<RoomId, string> = {
  strategy: "🧭",
  engineering: "⚙️",
  design: "🎨",
  "qa-lab": "🧪",
  security: "🛡️",
  growth: "📈",
  deployment: "🚀",
};

/**
 * Big, readable room name plaques floating above each zone. Always face the
 * camera; size scales with camera distance so they remain legible from
 * full-overview to close-up.
 */
export function RoomLabels({ rooms, states }: RoomLabelsProps) {
  return (
    <>
      {rooms.map((room) => {
        const r = rectToWorld(room.x, room.y, room.w, room.h);
        const state = states[room.id];
        const dot = STATE_DOT[state];
        const icon = ROOM_ICON[room.id];
        return (
          <Html
            key={room.id}
            position={[r.cx, 4.0, r.cz]}
            center
            distanceFactor={9}
            occlude={false}
            zIndexRange={[60, 0]}
          >
            <div className="pointer-events-none -translate-x-1/2 -translate-y-full select-none whitespace-nowrap">
              <div
                className="flex items-center gap-2 rounded-lg bg-floor-900/95 px-3 py-1.5 text-[14px] font-semibold uppercase tracking-[0.14em] text-zinc-100 shadow-xl ring-1 ring-white/20 backdrop-blur"
                style={{
                  borderLeft: `3px solid ${room.accent}`,
                  textShadow: "0 1px 4px rgba(0,0,0,0.6)",
                }}
              >
                <span className="text-base leading-none">{icon}</span>
                <span>{room.label}</span>
                {state !== "normal" && (
                  <span
                    className="ml-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      color: dot.color,
                      background: `${dot.color}22`,
                      boxShadow: `inset 0 0 0 1px ${dot.color}66`,
                    }}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{
                        background: dot.color,
                        boxShadow: `0 0 8px ${dot.color}`,
                      }}
                    />
                    {dot.label}
                  </span>
                )}
              </div>
              {/* Pointer down to the floor */}
              <div
                aria-hidden
                className="mx-auto h-2 w-0.5"
                style={{
                  background: `linear-gradient(to bottom, ${room.accent}aa, transparent)`,
                }}
              />
            </div>
          </Html>
        );
      })}
    </>
  );
}
