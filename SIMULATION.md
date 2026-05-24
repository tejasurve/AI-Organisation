# Live Office Simulation Layer

A visual, game-like presentation layer that turns the existing AI Organisation
reality engine into a living company you can watch. **No fake metrics, no
fake progress** — every visible signal traces back to a real pipeline event.

---

## What it adds

- **Office floor view** with 7 rooms (Strategy, Engineering, Design, QA Lab,
  Security Ops, Growth, Deployment).
- **6 visible agents** that move, type, talk, and react to real backend state.
- **Activity feed** of real pipeline events.
- **Conversation bubbles** synthesised from agent role + current step (never
  random; always anchored to a real event).
- **Click-to-inspect agent panel** with status, current task, energy,
  efficiency.
- **HUD** with cycle phase, task id, and live KPIs (deploys, tasks done, bugs,
  blockers).
- **Demo replay** — three canned scenarios (`happy`, `qafail`, `secfail`) that
  push real `AgentEvent`s through the exact same bus the live pipeline uses.

---

## Architecture

```
lib/runtime           (reality, untouched)
   └─ pipeline.ts → PipelineLogger
                       ▲
                       │ drop-in via simulationLogger()
                       │
lib/runtime/simulation-logger.ts
                       │ emits AgentEvent
                       ▼
lib/simulation/event-bus.ts ──► JSONL persistence (.simulation/events.jsonl)
   │ mapper.ts: AgentEvent → SimEvent[]
   ▼
app/api/events (SSE) ──► browser EventSource ──► Zustand store ──► React
```

**Key principle:** `SimulationLogger` is a `PipelineLogger` implementation.
Drop it in to `runPipeline({ logger: simulationLogger(consoleLogger()) })`
and every existing pipeline call drives the office. Zero changes to
`pipeline.ts`, agents, or contracts.

---

## Run it

```bash
# Terminal 1 — start the live office
npm run dev
# → open http://localhost:3000
```

Click **Run Demo** in the top-right to fire a canned cycle. Or try **QA Fail**
or **Sec Block** to see the office go red.

---

## Wire it into the real pipeline

```ts
import { runPipeline } from "./lib/runtime/pipeline.ts";
import { simulationLogger } from "./lib/runtime/simulation-logger.ts";
import { consoleLogger } from "./lib/runtime/logger.ts";
import { emit } from "./lib/simulation/event-bus.ts";

const startedAt = Date.now();
const result = await runPipeline(idea, {
  agentRunner,
  generatedDir: "./generated",
  logger: simulationLogger({ inner: consoleLogger(), idea }),
});
emit({ type: "pipeline.finished", decision: result.decision, ms: Date.now() - startedAt });
```

While Next.js is running on `localhost:3000`, those events appear live in the
office because the dev server and the pipeline share the same Node process via
the bus singleton (`globalThis.__aiOrgBus`). For separate processes, point the
pipeline at an HTTP forwarder or stream the `.simulation/events.jsonl` log
(easy follow-up).

---

## Event model

Two distinct surfaces. Read them in this order:

| Surface | Where | Purpose |
|---|---|---|
| `AgentEvent` | `lib/simulation/types.ts` | Neutral, server-side. 1:1 with pipeline reality. |
| `SimEvent` | `lib/simulation/types.ts` | Visual, client-side. Derived by mapper. |

Mapping happens in `lib/simulation/mapper.ts`. The mapper synthesises *small*
theatrical events (move, interact, say, room.state) to give the office life,
but **never** invents metrics or progress.

---

## Folder map

```
app/                  Next.js App Router (UI + SSE/demo endpoints)
components/           React components (OfficeFloor, AgentSprite, etc.)
stores/sim-store.ts   Zustand store — pure reducer, deterministic replay
lib/simulation/       Server-side simulation engine
  ├─ types.ts         AgentEvent + SimEvent + visual types
  ├─ layout.ts        Office floor plan (rooms, seats, home rooms)
  ├─ mapper.ts        AgentEvent → SimEvent[]
  ├─ event-bus.ts     In-memory broker + JSONL persistence
  └─ index.ts         barrel
lib/runtime/simulation-logger.ts   Bridge: PipelineLogger → event bus
```

---

## Next phases

- **Phase 2** — Feature Progress Tracker tied to `EMOutput`; live agent
  one-liners extracted from real model outputs.
- **Phase 3** — Pipeline running in a separate process publishes via HTTP
  (`POST /api/events/ingest`) instead of relying on in-process bus.
- **Phase 4** — Timeline scrubber over `.simulation/events.jsonl` (you can
  already replay any historical cycle deterministically — UI just needs to
  call `useSimStore.getState().replay(events)`).
- **PixiJS upgrade** — swap `<AgentSprite>` for `<PixiAgent>` (same store
  contract). Only needed if you exceed ~50 sprites or want bitmap FX.
