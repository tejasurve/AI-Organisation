// lib/simulation/layout.ts
//
// Static office floor plan. Coordinates are normalised 0..100 on both axes so
// the renderer can scale to any viewport without recomputing geometry.

import type { AgentName, Room, RoomId, VisualAgent } from "./types.ts";

export const ROOMS: readonly Room[] = [
  {
    id: "strategy",
    label: "Strategy Room",
    x: 2,
    y: 4,
    w: 30,
    h: 28,
    accent: "#60a5fa",
    seats: [
      { id: "ceo-desk", x: 8, y: 12, kind: "desk" },
      { id: "po-desk", x: 24, y: 12, kind: "desk" },
      { id: "cto-desk", x: 8, y: 26, kind: "desk" },
      { id: "sa-desk", x: 24, y: 26, kind: "desk" },
      { id: "strategy-whiteboard", x: 16, y: 18, kind: "whiteboard" },
    ],
  },
  {
    id: "engineering",
    label: "Engineering Floor",
    x: 34,
    y: 4,
    w: 36,
    h: 38,
    accent: "#22d3ee",
    seats: [
      { id: "em-desk", x: 40, y: 12, kind: "desk" },
      { id: "dev-1", x: 50, y: 20, kind: "monitor" },
      { id: "dev-2", x: 60, y: 20, kind: "monitor" },
      { id: "dev-3", x: 50, y: 32, kind: "monitor" },
      { id: "dev-4", x: 60, y: 32, kind: "monitor" },
      { id: "eng-whiteboard", x: 40, y: 32, kind: "whiteboard" },
    ],
  },
  {
    id: "design",
    label: "Design Studio",
    x: 72,
    y: 4,
    w: 26,
    h: 24,
    accent: "#a78bfa",
    seats: [
      { id: "design-desk-1", x: 80, y: 12, kind: "desk" },
      { id: "design-desk-2", x: 92, y: 12, kind: "desk" },
      { id: "prototype-board", x: 86, y: 22, kind: "whiteboard" },
    ],
  },
  {
    id: "qa-lab",
    label: "QA Lab",
    x: 2,
    y: 36,
    w: 30,
    h: 24,
    accent: "#fbbf24",
    seats: [
      { id: "qa-console-1", x: 8, y: 46, kind: "console" },
      { id: "qa-console-2", x: 22, y: 46, kind: "console" },
      { id: "qa-whiteboard", x: 15, y: 54, kind: "whiteboard" },
    ],
  },
  {
    id: "security",
    label: "Security Ops",
    x: 72,
    y: 32,
    w: 26,
    h: 26,
    accent: "#ef4444",
    seats: [
      { id: "sec-console", x: 80, y: 42, kind: "console" },
      { id: "sec-vault", x: 92, y: 42, kind: "vault" },
      { id: "sec-monitor", x: 86, y: 52, kind: "monitor" },
    ],
  },
  {
    id: "growth",
    label: "Growth Room",
    x: 2,
    y: 64,
    w: 30,
    h: 30,
    accent: "#10b981",
    seats: [
      { id: "growth-desk-1", x: 8, y: 74, kind: "desk" },
      { id: "growth-desk-2", x: 22, y: 74, kind: "desk" },
      { id: "growth-dashboard", x: 15, y: 86, kind: "monitor" },
    ],
  },
  {
    id: "deployment",
    label: "Deployment Pipeline",
    x: 34,
    y: 46,
    w: 36,
    h: 48,
    accent: "#34d399",
    seats: [
      { id: "stage-rack", x: 42, y: 60, kind: "server-rack" },
      { id: "prod-rack", x: 62, y: 60, kind: "server-rack" },
      { id: "deploy-console", x: 52, y: 80, kind: "console" },
    ],
  },
];

export const ROOMS_BY_ID: Record<RoomId, Room> = ROOMS.reduce(
  (acc, r) => {
    acc[r.id] = r;
    return acc;
  },
  {} as Record<RoomId, Room>,
);

// ---------- Agent → home room ----------

export const AGENT_HOME: Record<AgentName, { room: RoomId; seat: string }> = {
  ceo: { room: "strategy", seat: "ceo-desk" },
  "product-owner": { room: "strategy", seat: "po-desk" },
  "solution-architect": { room: "strategy", seat: "sa-desk" },
  cto: { room: "strategy", seat: "cto-desk" },
  "engineering-manager": { room: "engineering", seat: "em-desk" },
  designer: { room: "design", seat: "design-desk-1" },
  developer: { room: "engineering", seat: "dev-1" },
  qa: { room: "qa-lab", seat: "qa-console-1" },
  cybersecurity: { room: "security", seat: "sec-console" },
};

export const AGENT_LABELS: Record<AgentName, { role: string; monogram: string }> = {
  ceo: { role: "CEO", monogram: "C" },
  "product-owner": { role: "Product Owner", monogram: "O" },
  "solution-architect": { role: "Solution Architect", monogram: "A" },
  cto: { role: "CTO", monogram: "T" },
  "engineering-manager": { role: "Eng Manager", monogram: "M" },
  designer: { role: "Designer", monogram: "D" },
  developer: { role: "Engineer", monogram: "E" },
  qa: { role: "QA", monogram: "Q" },
  cybersecurity: { role: "Security", monogram: "S" },
};

// ---------- Agent personalities (distinct base stats + colours) ----------
//
// Each agent is a recognisably different person. Stats are realistic ranges
// for an autonomous worker; they vary live during the day (see store/tick).

export interface AgentPersonality {
  /** Hex colour used for the 3D mesh body. */
  bodyColor: string;
  /** Hex colour for the head. */
  headColor: string;
  /** Starting energy 0..1. */
  baseEnergy: number;
  /** Starting efficiency 0..1. */
  baseEfficiency: number;
  /** Energy drained per second of active work. */
  workDrain: number;
  /** Energy recovered per second when idle. */
  restRecovery: number;
  /** One-line bio shown in the agent inspector. */
  bio: string;
}

export const AGENT_PERSONALITIES: Record<AgentName, AgentPersonality> = {
  ceo: {
    // Brighter, more saturated palette so each character is recognisable at a
    // glance against the lit floor.
    bodyColor: "#4c7dff",
    headColor: "#f4d3b0",
    baseEnergy: 0.78,
    baseEfficiency: 0.94,
    workDrain: 0.012,
    restRecovery: 0.020,
    bio: "Strategic; high-reasoning; sets OKRs and delegates briefs.",
  },
  "product-owner": {
    // Coral / warm so the PO reads as the bridge between the CEO (blue) and
    // the Designer (magenta) in the floor palette.
    bodyColor: "#fb923c",
    headColor: "#f6d2b1",
    baseEnergy: 0.83,
    baseEfficiency: 0.9,
    workDrain: 0.012,
    restRecovery: 0.02,
    bio: "Owns features and the user job they serve; validates the build with the SA and Designer.",
  },
  "solution-architect": {
    // Deep teal — recognisably different from the CTO's lighter cyan; the
    // two architecture roles read as a paired but distinct duo at a glance.
    bodyColor: "#0ea5a4",
    headColor: "#ead4b6",
    baseEnergy: 0.84,
    baseEfficiency: 0.93,
    workDrain: 0.012,
    restRecovery: 0.018,
    bio: "Owns the HLD: bounded contexts, integration patterns, NFRs.",
  },
  cto: {
    bodyColor: "#22c1d8",
    headColor: "#f0c5a3",
    baseEnergy: 0.85,
    baseEfficiency: 0.91,
    workDrain: 0.014,
    restRecovery: 0.018,
    bio: "Owns the LLD: stack picks, schema, API surfaces, technical risk.",
  },
  "engineering-manager": {
    bodyColor: "#b362ff",
    headColor: "#ead1b8",
    baseEnergy: 0.82,
    baseEfficiency: 0.86,
    workDrain: 0.010,
    restRecovery: 0.022,
    bio: "Breaks architecture into features & tasks; unblocks devs.",
  },
  designer: {
    // Magenta / coral palette — visually distinct from the EM purple so the
    // two collaborate-but-different roles read at a glance from across the floor.
    bodyColor: "#ec4899",
    headColor: "#f7d6c2",
    baseEnergy: 0.86,
    baseEfficiency: 0.88,
    workDrain: 0.013,
    restRecovery: 0.020,
    bio: "Ships product surfaces; Figma-via-Stitch native; obsessed with the empty state.",
  },
  developer: {
    bodyColor: "#34d399",
    headColor: "#f3c9a7",
    baseEnergy: 0.95,
    baseEfficiency: 0.78,
    workDrain: 0.022,
    restRecovery: 0.014,
    bio: "Builds and refactors; fast iterator; codes most of the day.",
  },
  qa: {
    bodyColor: "#f59e0b",
    headColor: "#f6d2b1",
    baseEnergy: 0.88,
    baseEfficiency: 0.82,
    workDrain: 0.016,
    restRecovery: 0.020,
    bio: "Designs test plans; catches regressions; gates release.",
  },
  cybersecurity: {
    bodyColor: "#f43f5e",
    headColor: "#ecc3a0",
    baseEnergy: 0.74,
    baseEfficiency: 0.96,
    workDrain: 0.010,
    restRecovery: 0.016,
    bio: "Audits for OWASP, secrets, prompt-injection; final go/no-go.",
  },
};

// ---------- Helpers ----------

export function roomById(id: RoomId): Room {
  return ROOMS_BY_ID[id];
}

export function seatById(id: string): { room: Room; seat: { id: string; x: number; y: number; kind: Room["seats"][number]["kind"] } } | null {
  for (const room of ROOMS) {
    const seat = room.seats.find((s) => s.id === id);
    if (seat) return { room, seat };
  }
  return null;
}

export function initialAgents(): Record<AgentName, VisualAgent> {
  const now = Date.now();
  const result = {} as Record<AgentName, VisualAgent>;
  (Object.keys(AGENT_HOME) as AgentName[]).forEach((id) => {
    const home = AGENT_HOME[id];
    const meta = AGENT_LABELS[id];
    const p = AGENT_PERSONALITIES[id];
    const seat = roomById(home.room).seats.find((s) => s.id === home.seat)!;
    result[id] = {
      id,
      role: meta.role,
      monogram: meta.monogram,
      location: home.room,
      x: seat.x,
      y: seat.y,
      status: "idle",
      currentTask: null,
      energy: p.baseEnergy,
      efficiency: p.baseEfficiency,
      updatedAt: now,
    };
  });
  return result;
}
