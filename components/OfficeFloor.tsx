"use client";

import { useShallow } from "zustand/react/shallow";

import { ROOMS } from "@/lib/simulation/layout.ts";
import { useSimStore } from "@/stores/sim-store.ts";
import { Room } from "./Room";
import { AgentSprite } from "./AgentSprite";
import { ConversationBubbles } from "./ConversationBubble";

export function OfficeFloor() {
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

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/5 bg-floor-900 floor-grid grain">
      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_30%,transparent_45%,rgba(0,0,0,0.55)_100%)]" />

      {/* Rooms */}
      {ROOMS.map((room) => (
        <Room key={room.id} room={room} state={roomStates[room.id]} />
      ))}

      {/* Agents */}
      {Object.values(agents).map((agent) => (
        <AgentSprite
          key={agent.id}
          agent={agent}
          selected={selectedAgentId === agent.id}
          onSelect={() =>
            selectAgent(selectedAgentId === agent.id ? null : agent.id)
          }
        />
      ))}

      {/* Conversation bubbles overlay */}
      <ConversationBubbles bubbles={bubbles} agents={agents} />
    </div>
  );
}
