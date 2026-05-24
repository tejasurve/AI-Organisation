// lib/platform/shared/types.ts
//
// Tiny shared-types file so platform modules can import the simulation's
// AgentName and the LLM ProviderId without crossing each other's import
// graphs awkwardly.

export type { AgentName } from "@/lib/simulation/types.ts";
export type { ProviderId } from "../llm/pricing.ts";
