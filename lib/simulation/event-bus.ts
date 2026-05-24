// lib/simulation/event-bus.ts
//
// A small, stupid, reliable broker.
//
// What it does:
//   - Accepts AgentEvent emissions from anywhere in the process.
//   - Maps each AgentEvent through `mapper.ts` into 0..N SimEvents.
//   - Persists the canonical SimEvent stream to `.simulation/events.jsonl`.
//   - Broadcasts SimEvents to all live subscribers (the SSE route).
//
// This module is server-side only. It uses `node:fs/promises` and is intended
// to be imported by Next.js Route Handlers (which run on the Node runtime) and
// by `lib/runtime/simulation-logger.ts`.
//
// We deliberately keep events in a single process-wide singleton. Next.js dev
// mode (and serverless prod) may instantiate this module more than once across
// HMR; we guard against that with `globalThis`.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { createMapperState, mapEvent, type MapperState } from "./mapper.ts";
import type { AgentEvent, AgentEventInput, SimEvent } from "./types.ts";

const LOG_DIR = resolve(process.cwd(), ".simulation");
const LOG_FILE = join(LOG_DIR, "events.jsonl");

type Subscriber = (event: SimEvent) => void;

interface BusState {
  events: SimEvent[];                 // ring-bufferable in future; bounded below
  subscribers: Set<Subscriber>;
  mapper: MapperState;
  initialised: boolean;
  writeQueue: Promise<void>;
}

// Singleton across HMR — `globalThis` is the only safe handle.
const G = globalThis as unknown as { __aiOrgBus?: BusState };

function getState(): BusState {
  if (!G.__aiOrgBus) {
    G.__aiOrgBus = {
      events: [],
      subscribers: new Set(),
      mapper: createMapperState(),
      initialised: false,
      writeQueue: Promise.resolve(),
    };
  }
  return G.__aiOrgBus;
}

const MAX_IN_MEMORY = 2000;

// ---------- Public API ----------

/**
 * Emit a single AgentEvent. The mapper turns it into 0..N SimEvents which are
 * persisted to JSONL and broadcast to live subscribers.
 *
 * Caller does not need to await persistence; the write queue serialises them.
 */
export function emit(event: AgentEventInput & { ts?: number }): SimEvent[] {
  const state = getState();
  const stamped = { ...(event as object), ts: (event as { ts?: number }).ts ?? Date.now() } as AgentEvent;
  const sims = mapEvent(state.mapper, stamped);
  if (sims.length === 0) return sims;

  for (const sim of sims) {
    state.events.push(sim);
    for (const sub of state.subscribers) {
      try {
        sub(sim);
      } catch {
        // never break the bus because of one bad subscriber.
      }
    }
  }
  // Bound in-memory log.
  if (state.events.length > MAX_IN_MEMORY) {
    state.events.splice(0, state.events.length - MAX_IN_MEMORY);
  }

  // Persist (serialised through writeQueue).
  state.writeQueue = state.writeQueue.then(() => persist(sims)).catch(() => {});
  return sims;
}

/** Subscribe to live SimEvents. Returns an unsubscribe fn. */
export function subscribe(fn: Subscriber): () => void {
  const state = getState();
  state.subscribers.add(fn);
  return () => state.subscribers.delete(fn);
}

/** Get the in-memory recent events buffer (for SSE replay-on-connect). */
export function recent(): SimEvent[] {
  return getState().events.slice();
}

/** Number of live subscribers — useful for diagnostics. */
export function subscriberCount(): number {
  return getState().subscribers.size;
}

/**
 * Lazily load any persisted events from disk into the in-memory buffer.
 * Called on first SSE connection so we don't pay the cost at module load.
 */
export async function hydrateFromDisk(): Promise<void> {
  const state = getState();
  if (state.initialised) return;
  state.initialised = true;
  try {
    if (!existsSync(LOG_FILE)) return;
    const raw = await readFile(LOG_FILE, "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const tail = lines.slice(-MAX_IN_MEMORY);
    for (const line of tail) {
      try {
        const sim = JSON.parse(line) as SimEvent;
        state.events.push(sim);
      } catch {
        // skip malformed
      }
    }
  } catch {
    // disk read failures are non-fatal — we just have no history.
  }
}

/** Reset the bus (tests + the demo replay endpoint). */
export function reset(): void {
  const state = getState();
  state.events = [];
  state.mapper = createMapperState();
  // Notify subscribers via a sentinel? Keep simple — clients hard-reload on demo.
}

// ---------- helpers ----------

async function persist(sims: SimEvent[]): Promise<void> {
  try {
    if (!existsSync(LOG_DIR)) await mkdir(LOG_DIR, { recursive: true });
    const body = sims.map((s) => JSON.stringify(s)).join("\n") + "\n";
    await appendFile(LOG_FILE, body, "utf-8");
  } catch {
    // disk write failures are non-fatal — the bus is best-effort durable.
  }
}
