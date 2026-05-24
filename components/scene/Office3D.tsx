"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { useShallow } from "zustand/react/shallow";

import { ROOMS, ROOMS_BY_ID } from "@/lib/simulation/layout.ts";
import { useSimStore } from "@/stores/sim-store.ts";
import { Floor3D } from "./Floor3D";
import { Room3D } from "./Room3D";
import { Furniture3D } from "./Furniture3D";
import { Agent3D } from "./Agent3D";
import { RoomLabels } from "./RoomLabels";
import { CameraRig, type CameraRigHandle } from "./CameraRig";
import { Decorations3D } from "./Decorations3D";
import { BackgroundCrowd3D } from "./BackgroundCrowd3D";

/** The whole 3D office scene. Mount once at the top level. */
export function Office3D() {
  const { agents, roomStates, bubbles, selectedAgentId, selectAgent } =
    useSimStore(
      useShallow((s) => ({
        agents: s.agents,
        roomStates: s.roomStates,
        bubbles: s.bubbles,
        selectedAgentId: s.selectedAgentId,
        selectAgent: s.selectAgent,
      })),
    );

  // Lookup bubble by agentId (at most one per agent).
  const bubbleByAgent = useMemo(() => {
    const out: Record<string, (typeof bubbles)[number]> = {};
    for (const b of bubbles) out[b.agentId] = b;
    return out;
  }, [bubbles]);

  const focused = selectedAgentId ? agents[selectedAgentId] : null;
  const rigRef = useRef<CameraRigHandle>(null);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-[#1a2742] to-[#0f1828]">
      <Canvas
        shadows={false}
        dpr={[1, 2]}
        camera={{ position: [55, 60, 75], fov: 45, near: 0.1, far: 400 }}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => selectAgent(null)}
      >
        {/* Brighter, slightly blue daylight background — the office is now lit
            like a modern co-working space rather than a night bunker. */}
        <color attach="background" args={["#1a2742"]} />
        <fog attach="fog" args={["#1a2742", 160, 280]} />

        {/* Lighting — boosted across the board so the floor and characters
            are clearly visible without needing per-room hot states. */}
        <hemisphereLight args={["#dce8f5", "#2a3550", 1.6]} />
        <ambientLight intensity={0.55} color="#e6edf7" />
        <directionalLight
          position={[40, 80, 30]}
          intensity={1.8}
          color="#fff5e0"
        />
        <directionalLight
          position={[-40, 60, -20]}
          intensity={0.7}
          color="#8aa8ff"
        />

        <Suspense fallback={null}>
          <Floor3D />
          {ROOMS.map((room) => (
            <Room3D key={room.id} room={room} state={roomStates[room.id]} />
          ))}
          <Furniture3D />
          <Decorations3D />
          <BackgroundCrowd3D count={5} />

          {Object.values(agents).map((agent) => (
            <Agent3D
              key={agent.id}
              agent={agent}
              bubble={bubbleByAgent[agent.id]}
              selected={selectedAgentId === agent.id}
              onSelect={() =>
                selectAgent(selectedAgentId === agent.id ? null : agent.id)
              }
            />
          ))}

          <RoomLabels rooms={ROOMS} states={roomStates} />

          {/* Brighter IBL — gives subtle reflections + lifts mid-tones. */}
          <Environment preset="city" environmentIntensity={0.55} />
        </Suspense>

        <CameraRig ref={rigRef} focusedAgent={focused} />
      </Canvas>

      {/* Compass / camera helper hint */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-floor-900/80 px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500 ring-1 ring-white/5">
        Drag to pan · Right-drag to rotate · Scroll to zoom
      </div>
      {/* Reset View button */}
      <button
        type="button"
        onClick={() => {
          selectAgent(null);
          rigRef.current?.reset();
        }}
        className="absolute right-3 top-3 z-30 rounded-md border border-white/10 bg-floor-900/85 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-300 backdrop-blur transition-colors hover:bg-floor-800"
        title="Reset camera to full office view"
      >
        Reset View
      </button>
      {/* Room state legend chip */}
      <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 rounded-md bg-floor-900/80 px-2.5 py-1 text-[10px] uppercase tracking-wider text-zinc-400 ring-1 ring-white/5">
        <Dot color="#22d3ee" /> Active
        <Dot color="#10b981" /> Success
        <Dot color="#ef4444" /> Alert
      </div>
      {/* Selected agent room hint */}
      {selectedAgentId && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-floor-900/85 px-2.5 py-1 text-[10px] uppercase tracking-wider text-cyan-300 ring-1 ring-cyan-400/30">
          Inspecting {agents[selectedAgentId].role} ·{" "}
          {ROOMS_BY_ID[agents[selectedAgentId].location].label}
        </div>
      )}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
    />
  );
}
