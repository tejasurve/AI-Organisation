"use client";

// stores/sim-store.ts
//
// Single Zustand store. All state mutations flow through `apply(event)`.
// Components read narrow slices via selectors to avoid unnecessary re-renders.

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import {
  AGENT_PERSONALITIES,
  initialAgents,
  roomById,
  seatById,
} from "@/lib/simulation/layout.ts";
import type {
  ActivityEntry,
  AgentName,
  ConversationBubble,
  CycleState,
  RoomId,
  RoomState,
  SimEvent,
  SimMetrics,
  VisualAgent,
} from "@/lib/simulation/types.ts";

const FEED_MAX = 200;
const BUBBLE_DEFAULT_TTL = 4000;
const ROOM_STATE_DEFAULT_TTL = 5000;

interface SimStore {
  agents: Record<AgentName, VisualAgent>;
  roomStates: Record<RoomId, RoomState>;
  roomStateExpiry: Record<RoomId, number | null>;
  feed: ActivityEntry[];
  bubbles: ConversationBubble[];
  metrics: SimMetrics;
  cycle: CycleState;
  selectedAgentId: AgentName | null;
  /** Apply a single SimEvent. Pure reducer. */
  apply: (e: SimEvent) => void;
  /** Apply many events deterministically (for replay / hydration). */
  replay: (events: SimEvent[]) => void;
  selectAgent: (id: AgentName | null) => void;
  /** Garbage-collect expired bubbles and room states. Called by the ticker. */
  tick: () => void;
}

export const useSimStore = create<SimStore>()(
  subscribeWithSelector((set) => ({
    agents: initialAgents(),
    roomStates: {
      strategy: "normal",
      engineering: "normal",
      design: "normal",
      "qa-lab": "normal",
      security: "normal",
      growth: "normal",
      deployment: "normal",
    },
    roomStateExpiry: {
      strategy: null,
      engineering: null,
      design: null,
      "qa-lab": null,
      security: null,
      growth: null,
      deployment: null,
    },
    feed: [],
    bubbles: [],
    metrics: {
      revenue: 0,
      deploys: 0,
      blockers: 0,
      tasks_done: 0,
      bugs_open: 0,
      mrr: 0,
    },
    cycle: { phase: "idle", taskId: null, featureId: null, startedAt: null },
    selectedAgentId: null,

    apply(event) {
      set((state) => reduce(state, event));
    },

    replay(events) {
      set((state) => {
        let next = state;
        for (const ev of events) next = reduce(next, ev);
        return next;
      });
    },

    selectAgent(id) {
      set({ selectedAgentId: id });
    },

    tick() {
      set((state) => {
        const now = Date.now();

        let bubblesChanged = false;
        const bubbles = state.bubbles.filter((b) => {
          if (b.expiresAt <= now) {
            bubblesChanged = true;
            return false;
          }
          return true;
        });

        let roomChanged = false;
        const roomStates = { ...state.roomStates };
        const roomStateExpiry = { ...state.roomStateExpiry };
        for (const key of Object.keys(roomStateExpiry) as RoomId[]) {
          const expiry = roomStateExpiry[key];
          if (expiry !== null && expiry <= now && roomStates[key] !== "normal") {
            roomStates[key] = "normal";
            roomStateExpiry[key] = null;
            roomChanged = true;
          }
        }

        // ---- Live energy/efficiency dynamics ----
        // The tick runs ~10x/sec. We integrate per real-time-second by using
        // (now - updatedAt) as the integration window per agent.
        let agentsChanged = false;
        const agents = { ...state.agents };
        for (const id of Object.keys(agents) as (keyof typeof agents)[]) {
          const a = agents[id];
          const p = AGENT_PERSONALITIES[id];
          const dtSec = Math.min(2, Math.max(0, (now - a.updatedAt) / 1000));
          if (dtSec <= 0) continue;

          const isWorking =
            a.status === "thinking" ||
            a.status === "building" ||
            a.status === "reviewing" ||
            a.status === "deploying";

          let nextEnergy = a.energy;
          let nextEff = a.efficiency;

          if (isWorking) {
            nextEnergy = clamp01(a.energy - p.workDrain * dtSec);
            // Efficiency drifts down slightly while energy is low (< 0.3).
            if (a.energy < 0.3) nextEff = clamp01(a.efficiency - 0.004 * dtSec);
          } else if (a.status === "idle") {
            nextEnergy = clamp01(a.energy + p.restRecovery * dtSec);
            // Efficiency recovers slowly when resting and energy is healthy.
            if (a.energy > 0.5) nextEff = clamp01(a.efficiency + 0.002 * dtSec);
          } else if (a.status === "blocked") {
            // Frustration: efficiency degrades faster than energy.
            nextEnergy = clamp01(a.energy - 0.004 * dtSec);
            nextEff = clamp01(a.efficiency - 0.010 * dtSec);
          }

          if (
            Math.abs(nextEnergy - a.energy) > 0.0005 ||
            Math.abs(nextEff - a.efficiency) > 0.0005
          ) {
            agents[id] = {
              ...a,
              energy: nextEnergy,
              efficiency: nextEff,
              updatedAt: now,
            };
            agentsChanged = true;
          }
        }

        if (!bubblesChanged && !roomChanged && !agentsChanged) return state;
        return {
          ...state,
          bubbles: bubblesChanged ? bubbles : state.bubbles,
          roomStates: roomChanged ? roomStates : state.roomStates,
          roomStateExpiry: roomChanged ? roomStateExpiry : state.roomStateExpiry,
          agents: agentsChanged ? agents : state.agents,
        };
      });
    },
  })),
);

// ---------- Pure reducer ----------

function reduce(state: SimStore, event: SimEvent): SimStore {
  switch (event.type) {
    case "move": {
      const dest = event.toSeat ? seatById(event.toSeat) : null;
      const fallback = roomById(event.toRoom);
      const target = dest
        ? { x: dest.seat.x, y: dest.seat.y }
        : centroid(fallback);
      const current = state.agents[event.agentId];
      if (!current) return state;
      return {
        ...state,
        agents: {
          ...state.agents,
          [event.agentId]: {
            ...current,
            x: target.x,
            y: target.y,
            location: event.toRoom,
            updatedAt: event.ts,
          },
        },
      };
    }

    case "status": {
      const current = state.agents[event.agentId];
      if (!current) return state;
      const next: VisualAgent = {
        ...current,
        status: event.status,
        currentTask:
          event.currentTask !== undefined ? event.currentTask : current.currentTask,
        updatedAt: event.ts,
      };
      // Update blockers metric (visible count of blocked agents).
      const blockers = countBlockers({ ...state.agents, [event.agentId]: next });
      return {
        ...state,
        agents: { ...state.agents, [event.agentId]: next },
        metrics:
          blockers !== state.metrics.blockers
            ? { ...state.metrics, blockers }
            : state.metrics,
      };
    }

    case "interact":
      // For MVP, `interact` is consumed for visual flourishes by the renderer
      // via subscribe; no store mutation needed.
      return state;

    case "say": {
      const ttl = event.ttlMs ?? BUBBLE_DEFAULT_TTL;
      const bubble: ConversationBubble = {
        id: `${event.agentId}-${event.ts}`,
        agentId: event.agentId,
        text: event.text,
        expiresAt: Date.now() + ttl,
      };
      // Keep at most one bubble per agent; replace older.
      const filtered = state.bubbles.filter((b) => b.agentId !== event.agentId);
      return { ...state, bubbles: [...filtered, bubble] };
    }

    case "room.state": {
      const ttl = event.ttlMs ?? ROOM_STATE_DEFAULT_TTL;
      return {
        ...state,
        roomStates: { ...state.roomStates, [event.roomId]: event.state },
        roomStateExpiry: {
          ...state.roomStateExpiry,
          [event.roomId]: Date.now() + ttl,
        },
      };
    }

    case "feed": {
      const entry: ActivityEntry = {
        id: `f-${event.ts}-${Math.random().toString(36).slice(2, 6)}`,
        ts: event.ts,
        severity: event.severity,
        text: event.text,
        agentId: event.agentId,
      };
      const feed = [...state.feed, entry];
      if (feed.length > FEED_MAX) feed.splice(0, feed.length - FEED_MAX);
      return { ...state, feed };
    }

    case "metric":
      return {
        ...state,
        metrics: { ...state.metrics, [event.key]: event.value },
      };

    case "fx": {
      // The FX kinds also drive small store changes that aren't theatrical:
      if (event.kind === "deploy-success") {
        return {
          ...state,
          metrics: {
            ...state.metrics,
            deploys: state.metrics.deploys + 1,
            tasks_done: state.metrics.tasks_done + 1,
          },
        };
      }
      if (event.kind === "task-done") {
        return state;
      }
      return state;
    }

    case "cycle":
      return {
        ...state,
        cycle: {
          phase: event.phase,
          taskId: event.taskId ?? null,
          featureId: event.featureId ?? null,
          startedAt:
            event.phase === "idle" ? null : (state.cycle.startedAt ?? event.ts),
        },
      };

    default:
      return state;
  }
}

function centroid(r: ReturnType<typeof roomById>): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function countBlockers(agents: Record<AgentName, VisualAgent>): number {
  let n = 0;
  for (const a of Object.values(agents)) if (a.status === "blocked") n++;
  return n;
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
