// lib/simulation/mapper.ts
//
// Translates the neutral, server-side AgentEvent stream into a richer SimEvent
// sequence that the office UI can render. The mapper is pure and
// deterministic: same AgentEvent list → same SimEvent list (modulo `ts`
// timestamps that are added when the events are emitted to clients).
//
// Design rule: every SimEvent must trace back to a real AgentEvent. The mapper
// *synthesises* small theatrical events (move, interact, say, room.state) to
// give the office life, but it never invents metrics or progress.

import { AGENT_HOME, AGENT_LABELS, roomById } from "./layout.ts";
import type {
  AgentEvent,
  AgentName,
  AgentStatus,
  RoomId,
  SimEvent,
} from "./types.ts";

// ---------- per-agent visual policy ----------
//
// Where does each agent gravitate during which phase?

const ROOM_FOR: Record<AgentName, RoomId> = {
  ceo: "strategy",
  "product-owner": "strategy",
  "solution-architect": "strategy",
  cto: "strategy",
  "engineering-manager": "engineering",
  designer: "design",
  developer: "engineering",
  qa: "qa-lab",
  cybersecurity: "security",
};

const SEAT_FOR_RUN: Record<AgentName, string> = {
  ceo: "strategy-whiteboard",
  "product-owner": "strategy-whiteboard",
  "solution-architect": "strategy-whiteboard",
  cto: "strategy-whiteboard",
  "engineering-manager": "eng-whiteboard",
  designer: "prototype-board",
  developer: "dev-1",
  qa: "qa-console-1",
  cybersecurity: "sec-console",
};

const STATUS_RUNNING: Record<AgentName, AgentStatus> = {
  ceo: "thinking",
  "product-owner": "thinking",
  "solution-architect": "thinking",
  cto: "thinking",
  "engineering-manager": "thinking",
  designer: "building",
  developer: "building",
  qa: "reviewing",
  cybersecurity: "reviewing",
};

const ONE_LINER: Record<AgentName, (note?: string) => string> = {
  ceo: () => "Translating idea → mission, OKRs, delegation briefs.",
  "product-owner": () =>
    "Defining features — user, job, value, acceptance signal, MoSCoW.",
  "solution-architect": () =>
    "Drafting the HLD — bounded contexts, integrations, NFRs, ADRs.",
  cto: () => "Locking the LLD — stack, API contracts, schema.",
  "engineering-manager": () => "Slicing features into vertical user stories.",
  designer: () => "Generating Stitch UI concepts (Gemini 3.1 Pro).",
  developer: (n) => (n ? `Building: ${truncate(n, 56)}` : "Implementing assigned task."),
  qa: () => "Drafting test plan, executing checks.",
  cybersecurity: () => "Auditing for OWASP, secrets, prompt-injection.",
};

// ---------- mapper ----------

export interface MapperState {
  /** Microsecond offset used to space synthesised micro-events. */
  cursor: number;
  /** Track room.state ttls so we can clear them after a window. */
  alertedRooms: Set<RoomId>;
}

export function createMapperState(): MapperState {
  return { cursor: 0, alertedRooms: new Set() };
}

export function mapEvent(state: MapperState, ev: AgentEvent): SimEvent[] {
  const out: SimEvent[] = [];
  // Spread synthesised events ~150ms apart so multiple actions per agent
  // appear sequentially rather than all on the same frame.
  const stamp = () => {
    state.cursor += 150;
    return ev.ts + state.cursor;
  };

  switch (ev.type) {
    case "pipeline.start":
      state.cursor = 0;
      state.alertedRooms.clear();
      out.push({ ts: ev.ts, type: "cycle", phase: "strategising", taskId: undefined, featureId: undefined });
      out.push({
        ts: ev.ts,
        type: "feed",
        severity: "info",
        text: `New cycle: "${truncate(ev.idea, 80)}"`,
      });
      // CLEAR STALE STATUSES from any previous project. The event bus persists
      // across cycles, so without this every new project inherited the prior
      // run's "developer blocked", "designer building" etc., misleading the
      // user about what's currently happening.
      for (const agentId of [
        "product-owner",
        "solution-architect",
        "cto",
        "engineering-manager",
        "designer",
        "developer",
        "qa",
        "cybersecurity",
      ] as const) {
        out.push({ ts: ev.ts, type: "status", agentId, status: "idle", currentTask: null });
      }
      // CEO marches to the whiteboard.
      out.push({
        ts: stamp(),
        type: "move",
        agentId: "ceo",
        toRoom: "strategy",
        toSeat: "strategy-whiteboard",
        durationMs: 1200,
      });
      out.push({ ts: stamp(), type: "status", agentId: "ceo", status: "thinking" });
      out.push({
        ts: stamp(),
        type: "say",
        agentId: "ceo",
        text: ONE_LINER.ceo(),
        ttlMs: 5000,
      });
      break;

    case "agent.started": {
      state.cursor = 0;
      const room = ROOM_FOR[ev.agent];
      const seat = SEAT_FOR_RUN[ev.agent];
      out.push({
        ts: ev.ts,
        type: "move",
        agentId: ev.agent,
        toRoom: room,
        toSeat: seat,
        durationMs: 1400,
      });
      out.push({
        ts: stamp(),
        type: "status",
        agentId: ev.agent,
        status: STATUS_RUNNING[ev.agent],
        currentTask: ev.taskId ?? null,
      });
      out.push({
        ts: stamp(),
        type: "interact",
        agentId: ev.agent,
        seatKind: kindForAgent(ev.agent),
      });
      out.push({
        ts: stamp(),
        type: "say",
        agentId: ev.agent,
        text: ONE_LINER[ev.agent](ev.note),
        ttlMs: 4500,
      });
      out.push({
        ts: stamp(),
        type: "feed",
        severity: "info",
        agentId: ev.agent,
        text: `${AGENT_LABELS[ev.agent].role} started${ev.taskId ? ` task ${ev.taskId}` : ""}.`,
      });
      break;
    }

    case "agent.progress":
      // Keep this lightweight — just a status refresh and (optionally) a feed
      // line at meaningful milestones.
      if (ev.pct === 100) break;
      if (ev.pct % 25 === 0) {
        out.push({
          ts: ev.ts,
          type: "feed",
          severity: "info",
          agentId: ev.agent,
          text: `${AGENT_LABELS[ev.agent].role} ${ev.pct}% — ${ev.note ?? "in progress"}`,
        });
      }
      break;

    case "agent.completed":
      out.push({
        ts: ev.ts,
        type: "status",
        agentId: ev.agent,
        status: "idle",
        currentTask: null,
      });
      out.push({
        ts: stamp(),
        type: "feed",
        severity: "success",
        agentId: ev.agent,
        text: `${AGENT_LABELS[ev.agent].role} done${ev.summary ? `: ${truncate(ev.summary, 80)}` : "."}`,
      });
      // Drift back toward home seat.
      out.push({
        ts: stamp(),
        type: "move",
        agentId: ev.agent,
        toRoom: AGENT_HOME[ev.agent].room,
        toSeat: AGENT_HOME[ev.agent].seat,
        durationMs: 1400,
      });
      break;

    case "agent.blocked":
      out.push({
        ts: ev.ts,
        type: "status",
        agentId: ev.agent,
        status: "blocked",
      });
      out.push({
        ts: stamp(),
        type: "room.state",
        roomId: ROOM_FOR[ev.agent],
        state: "alert",
        ttlMs: 6000,
      });
      out.push({
        ts: stamp(),
        type: "say",
        agentId: ev.agent,
        text: truncate(ev.reason, 100),
        ttlMs: 6000,
      });
      out.push({
        ts: stamp(),
        type: "feed",
        severity: "danger",
        agentId: ev.agent,
        text: `${AGENT_LABELS[ev.agent].role} blocked — ${truncate(ev.reason, 80)}`,
      });
      out.push({ ts: stamp(), type: "fx", kind: "alert-burst", at: ROOM_FOR[ev.agent] });
      break;

    case "validation.ok":
      out.push({
        ts: ev.ts,
        type: "feed",
        severity: "success",
        text: `EM output validated: ${ev.features} feature(s), ${ev.tasks} task(s).`,
      });
      break;

    case "validation.failed":
      out.push({
        ts: ev.ts,
        type: "room.state",
        roomId: "engineering",
        state: "alert",
        ttlMs: 8000,
      });
      out.push({
        ts: stamp(),
        type: "feed",
        severity: "danger",
        text: `EM output failed validation (${ev.errors} error${ev.errors === 1 ? "" : "s"}): ${truncate(ev.firstError, 80)}`,
      });
      out.push({
        ts: stamp(),
        type: "say",
        agentId: "engineering-manager",
        text: "Schema rejected — regenerating breakdown.",
        ttlMs: 5500,
      });
      break;

    case "qa.verdict":
      if (ev.decision === "PASS") {
        out.push({ ts: ev.ts, type: "room.state", roomId: "qa-lab", state: "success", ttlMs: 4000 });
        out.push({
          ts: stamp(),
          type: "feed",
          severity: "success",
          agentId: "qa",
          text: `QA PASS — ${ev.bugs} bug${ev.bugs === 1 ? "" : "s"} flagged.`,
        });
        out.push({ ts: stamp(), type: "metric", key: "bugs_open", value: ev.bugs });
      } else {
        out.push({ ts: ev.ts, type: "room.state", roomId: "qa-lab", state: "alert", ttlMs: 8000 });
        out.push({ ts: stamp(), type: "fx", kind: "qa-fail", at: "qa-lab" });
        out.push({
          ts: stamp(),
          type: "say",
          agentId: "qa",
          text: `${ev.bugs} bug${ev.bugs === 1 ? "" : "s"} — blocking release.`,
          ttlMs: 6000,
        });
        out.push({
          ts: stamp(),
          type: "feed",
          severity: "danger",
          agentId: "qa",
          text: `QA ${ev.decision} — ${ev.bugs} bug${ev.bugs === 1 ? "" : "s"}.`,
        });
        out.push({ ts: stamp(), type: "metric", key: "bugs_open", value: ev.bugs });
        // Developer pushed into blocked while QA returns the work.
        out.push({ ts: stamp(), type: "status", agentId: "developer", status: "blocked" });
      }
      break;

    case "security.verdict":
      if (ev.decision === "GO") {
        out.push({ ts: ev.ts, type: "room.state", roomId: "security", state: "success", ttlMs: 4000 });
        out.push({
          ts: stamp(),
          type: "feed",
          severity: "success",
          agentId: "cybersecurity",
          text: `Security GO — ${ev.critical} critical issue${ev.critical === 1 ? "" : "s"} resolved.`,
        });
      } else {
        out.push({ ts: ev.ts, type: "room.state", roomId: "security", state: "alert", ttlMs: 10000 });
        out.push({ ts: stamp(), type: "fx", kind: "sec-fail", at: "security" });
        out.push({
          ts: stamp(),
          type: "say",
          agentId: "cybersecurity",
          text: `NO_GO — ${ev.critical} critical finding${ev.critical === 1 ? "" : "s"}.`,
          ttlMs: 7000,
        });
        out.push({
          ts: stamp(),
          type: "feed",
          severity: "danger",
          agentId: "cybersecurity",
          text: `Security NO_GO — deployment blocked.`,
        });
        // CEO learns about it.
        out.push({
          ts: stamp(),
          type: "say",
          agentId: "ceo",
          text: "Deployment blocked by security — reviewing.",
          ttlMs: 5000,
        });
      }
      break;

    case "files.written":
      out.push({ ts: ev.ts, type: "room.state", roomId: "deployment", state: "success", ttlMs: 5000 });
      out.push({ ts: stamp(), type: "fx", kind: "deploy-success", at: "deployment" });
      out.push({
        ts: stamp(),
        type: "feed",
        severity: "success",
        text: `Released to staging: ${ev.count} file${ev.count === 1 ? "" : "s"} (${Math.round(ev.bytes / 1024)} KB) under ${ev.taskId}.`,
      });
      // Cheer from the team — short, distinct lines.
      out.push({ ts: stamp(), type: "say", agentId: "ceo", text: "Ship it.", ttlMs: 3000 });
      out.push({ ts: stamp(), type: "say", agentId: "developer", text: "Pushed.", ttlMs: 3000 });
      // Bump the visible deploy counter; revenue is *not* synthesised — that is
      // a real backend signal we'll wire up in phase 4.
      out.push({ ts: stamp(), type: "fx", kind: "task-done" });
      break;

    case "pipeline.finished":
      out.push({
        ts: ev.ts,
        type: "feed",
        severity: ev.decision === "WROTE_FILES" ? "success" : "warn",
        text: `Cycle finished in ${Math.round(ev.ms / 100) / 10}s → ${ev.decision}`,
      });
      out.push({ ts: stamp(), type: "cycle", phase: "idle", taskId: undefined, featureId: undefined });
      // Everyone drifts home.
      (Object.keys(AGENT_HOME) as AgentName[]).forEach((a) => {
        out.push({
          ts: stamp(),
          type: "move",
          agentId: a,
          toRoom: AGENT_HOME[a].room,
          toSeat: AGENT_HOME[a].seat,
          durationMs: 1600,
        });
        out.push({ ts: stamp(), type: "status", agentId: a, status: "idle" });
      });
      break;
  }

  return out;
}

// ---------- helpers ----------

function kindForAgent(a: AgentName): "desk" | "whiteboard" | "console" | "monitor" {
  switch (a) {
    case "developer":
      return "monitor";
    case "qa":
    case "cybersecurity":
      return "console";
    case "designer":
      return "whiteboard";
    case "ceo":
    case "product-owner":
    case "solution-architect":
    case "cto":
    case "engineering-manager":
      return "whiteboard";
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

// Sanity: ensure SEAT_FOR_RUN points at real seats. Throws at module load
// if anyone breaks the layout / mapper invariant.
for (const [agent, seatId] of Object.entries(SEAT_FOR_RUN) as [AgentName, string][]) {
  const room = roomById(ROOM_FOR[agent]);
  const seat = room.seats.find((s) => s.id === seatId);
  if (!seat) {
    throw new Error(
      `mapper: SEAT_FOR_RUN[${agent}] = ${JSON.stringify(seatId)} not found in room ${JSON.stringify(room.id)}`,
    );
  }
}
