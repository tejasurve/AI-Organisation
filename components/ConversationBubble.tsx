"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { ConversationBubble, VisualAgent } from "@/lib/simulation/types.ts";

interface BubbleProps {
  bubbles: ConversationBubble[];
  agents: Record<string, VisualAgent>;
}

export function ConversationBubbles({ bubbles, agents }: BubbleProps) {
  return (
    <AnimatePresence>
      {bubbles.map((b) => {
        const agent = agents[b.agentId];
        if (!agent) return null;
        return (
          <motion.div
            key={b.id}
            className="pointer-events-none absolute z-40"
            style={{
              left: `${agent.x}%`,
              top: `${agent.y}%`,
            }}
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: -32, scale: 1 }}
            exit={{ opacity: 0, y: -42, scale: 0.96 }}
            transition={{ type: "spring", damping: 22, stiffness: 220 }}
          >
            <div className="relative -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-floor-900/95 px-3 py-1.5 text-[11px] leading-tight text-zinc-100 shadow-lg ring-1 ring-white/10 backdrop-blur">
              <span className="mr-1 text-cyan-300/90">{agent.role}:</span>
              {b.text}
              <span
                aria-hidden
                className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-floor-900/95 ring-1 ring-white/10"
              />
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}
