// lib/simulation/index.ts
//
// Public surface of the simulation engine. Re-exports types, layout, mapper,
// and the event bus. Server-only (uses node:fs). Don't import this directly
// from a React component — use the SSE stream instead.

export * from "./types.ts";
export * from "./layout.ts";
export * from "./mapper.ts";
export * from "./event-bus.ts";
