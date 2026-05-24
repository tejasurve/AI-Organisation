// lib/simulation/types.ts
//
// Two event surfaces:
//
//   AgentEvent  — neutral, server-side, emitted by lib/runtime instrumentation.
//                 1:1 with real pipeline reality (no theatre, no fakery).
//
//   SimEvent    — visual, client-side, consumed by the office renderer.
//                 Derived from AgentEvents by lib/simulation/mapper.ts.
//
// The store reduces SimEvent only. AgentEvent never reaches React.

export type AgentName =
  | "ceo"
  | "product-owner"
  | "solution-architect"
  | "cto"
  | "engineering-manager"
  | "designer"
  | "developer"
  | "qa"
  | "cybersecurity";

export type PipelineDecision =
  | "WROTE_FILES"
  | "GATE_BLOCKED_QA"
  | "GATE_BLOCKED_SECURITY"
  | "VALIDATION_FAILED"
  | "NO_TASKS"
  | "RUNTIME_ERROR";

// ---------- AgentEvent (server-side, real) ----------

export type AgentEvent =
  | { ts: number; type: "pipeline.start"; idea: string }
  | { ts: number; type: "pipeline.finished"; decision: PipelineDecision; ms: number }
  | { ts: number; type: "agent.started"; agent: AgentName; taskId?: string; note?: string }
  | { ts: number; type: "agent.progress"; agent: AgentName; pct: number; note?: string }
  | { ts: number; type: "agent.completed"; agent: AgentName; taskId?: string; summary?: string }
  | { ts: number; type: "agent.blocked"; agent: AgentName; reason: string }
  | { ts: number; type: "validation.failed"; errors: number; firstError: string }
  | { ts: number; type: "validation.ok"; features: number; tasks: number }
  | { ts: number; type: "qa.verdict"; decision: "PASS" | "FAIL" | "CONDITIONAL"; bugs: number }
  | { ts: number; type: "security.verdict"; decision: "GO" | "NO_GO"; critical: number }
  | { ts: number; type: "files.written"; taskId: string; count: number; bytes: number };

export type AgentEventType = AgentEvent["type"];

/**
 * Distributive `Omit<"ts">` over the AgentEvent union. We need this because
 * `Omit<AgentEvent, "ts">` collapses the discriminated union into an
 * intersection that loses variant-specific fields. Callers emit
 * `AgentEventInput` (no `ts`) and the bus stamps it.
 */
export type AgentEventInput = AgentEvent extends infer E
  ? E extends { ts: number }
    ? Omit<E, "ts">
    : never
  : never;

// ---------- Office layout (immutable) ----------

export type RoomId =
  | "strategy"
  | "engineering"
  | "design"
  | "qa-lab"
  | "security"
  | "growth"
  | "deployment";

export interface Point {
  x: number;
  y: number;
}

export interface Room {
  id: RoomId;
  label: string;
  /** Bounds in the floor-coordinate space (top-left + size). 0..100 per axis. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Subtle ambient hint colour. */
  accent: string;
  /** Workstations / interactive nodes inside the room. */
  seats: { id: string; x: number; y: number; kind: SeatKind }[];
}

export type SeatKind = "desk" | "whiteboard" | "server-rack" | "console" | "monitor" | "vault";

// ---------- Visual agent ----------

export type AgentStatus =
  | "idle"
  | "thinking"
  | "building"
  | "reviewing"
  | "blocked"
  | "deploying";

export interface VisualAgent {
  id: AgentName;
  /** Pretty role label, e.g. "CTO". */
  role: string;
  /** Single-letter monogram for the sprite. */
  monogram: string;
  /** Current room. */
  location: RoomId;
  /** Floor-space coords (0..100). */
  x: number;
  y: number;
  status: AgentStatus;
  /** Currently anchored task id, if any. */
  currentTask: string | null;
  /** 0..1 energy bar. */
  energy: number;
  /** 0..1 efficiency. */
  efficiency: number;
  /** Last update timestamp. */
  updatedAt: number;
}

// ---------- Room state (ambient) ----------

export type RoomState = "normal" | "hot" | "alert" | "success";

// ---------- SimEvent (client-side, visual) ----------

export type SimSeverity = "info" | "warn" | "success" | "danger";

export type SimEvent =
  | { ts: number; type: "move"; agentId: AgentName; toRoom: RoomId; toSeat?: string; durationMs: number }
  | { ts: number; type: "interact"; agentId: AgentName; seatKind: SeatKind; durationMs?: number }
  | { ts: number; type: "status"; agentId: AgentName; status: AgentStatus; currentTask?: string | null }
  | { ts: number; type: "say"; agentId: AgentName; text: string; ttlMs?: number }
  | { ts: number; type: "room.state"; roomId: RoomId; state: RoomState; ttlMs?: number }
  | { ts: number; type: "feed"; severity: SimSeverity; text: string; agentId?: AgentName }
  | { ts: number; type: "metric"; key: MetricKey; value: number }
  | { ts: number; type: "fx"; kind: FxKind; at?: RoomId }
  | { ts: number; type: "cycle"; phase: string; taskId?: string; featureId?: string };

export type MetricKey =
  | "revenue"
  | "deploys"
  | "blockers"
  | "tasks_done"
  | "bugs_open"
  | "mrr";

export type FxKind =
  | "deploy-success"
  | "deploy-fail"
  | "qa-fail"
  | "sec-fail"
  | "revenue-up"
  | "task-done"
  | "alert-burst";

// ---------- Activity feed ----------

export interface ActivityEntry {
  id: string;
  ts: number;
  severity: SimSeverity;
  text: string;
  agentId?: AgentName;
}

// ---------- Conversation bubbles ----------

export interface ConversationBubble {
  id: string;
  agentId: AgentName;
  text: string;
  expiresAt: number;
}

// ---------- Metrics ----------

export interface SimMetrics {
  revenue: number;
  deploys: number;
  blockers: number;
  tasks_done: number;
  bugs_open: number;
  mrr: number;
}

// ---------- Cycle state ----------

export interface CycleState {
  phase: string;
  taskId: string | null;
  featureId: string | null;
  startedAt: number | null;
}
