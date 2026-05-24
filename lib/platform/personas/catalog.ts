// lib/platform/personas/catalog.ts
//
// Persona catalog. SOURCE OF TRUTH for personas is:
//
//     agents/<role>/config.json#/persona
//
// The build step (`scripts/build-personas.mjs`, run automatically as `predev`
// and `prebuild`) materialises every agent's persona block into
// `personas.generated.ts`. This file imports the generated data and shapes it
// into the `Persona` interface the rest of the platform consumes.
//
// To add or edit a persona:
//   1. Edit agents/<role>/config.json#persona — that is the canonical home.
//   2. Run `npm run personas:build` (or just restart `npm run dev`).
//
// DO NOT add persona constants in this file.

import type { AgentName, ProviderId } from "../shared/types.ts";

import { GENERATED_PERSONAS, type GeneratedPersona } from "./personas.generated.ts";

export type PersonaId = AgentName;

export type Capability =
  | "talk-to-user"
  | "delegate"
  | "draft-hld"
  | "draft-lld"
  | "draft-stories"
  | "design-screens"
  | "redesign-screen"
  | "write-code"
  | "open-pr"
  | "code-review"
  | "test-plan"
  | "raise-defect"
  | "security-audit";

export interface Persona {
  id: PersonaId;
  /** Full display name + role, e.g. "Sarah Chen · Chief Executive Officer". */
  title: string;
  /** Short label used in chat bubbles + headers. */
  shortTitle: string;
  /** Emoji avatar in chat. */
  emoji: string;
  /** Plain-English bio shown in the agent inspector. */
  bio: string;
  /** Vocal style summary (one line). */
  voice: string;
  /** Years of professional experience the persona "represents". */
  years: number;
  /** Three-ish areas this persona is deep in. */
  specialties: readonly string[];
  /** Operating principles — short, sharp rules they follow. */
  principles: readonly string[];
  /** Tools they invoke day-to-day (for the inspector card). */
  tools: readonly string[];
  /** The full system prompt sent to live LLM calls in chat mode. */
  systemPrompt: string;
  /** Recommended provider/model for chat-mode calls. */
  recommendedModel: { provider: ProviderId; model: string };
  /** What this persona can actually do in this platform. */
  capabilities: Capability[];
}

function fromGenerated(g: GeneratedPersona): Persona {
  return {
    id: g.role as PersonaId,
    title: g.displayName,
    shortTitle: g.shortTitle,
    emoji: g.emoji,
    bio: g.bio,
    voice: g.voice,
    years: g.years,
    specialties: g.specialties,
    principles: g.principles,
    tools: g.tools,
    systemPrompt: g.chatSystemPrompt,
    recommendedModel: g.chatModel as { provider: ProviderId; model: string },
    capabilities: g.chatCapabilities as Capability[],
  };
}

function buildCatalog(): Record<PersonaId, Persona> {
  const out: Partial<Record<PersonaId, Persona>> = {};
  for (const g of GENERATED_PERSONAS) {
    out[g.role as PersonaId] = fromGenerated(g);
  }
  return out as Record<PersonaId, Persona>;
}

export const PERSONAS: Record<PersonaId, Persona> = buildCatalog();

export const PERSONA_LIST: readonly Persona[] = Object.values(PERSONAS);

// ---------- Stage roles ----------
//
// Workflow stages reference a "stage role" string; this layer maps the stage
// role to a real persona seat in PERSONAS. Solution Architect and Product
// Owner are now first-class seats (with their own configs), so they map to
// themselves. The legacy "pm" role still maps to engineering-manager, which
// remains the seat that slices stories.

export type StageRole =
  | "ceo"
  | "product-owner"
  | "solution-architect"
  | "software-architect"
  | "cto"
  | "designer"
  | "pm"
  | "developer"
  | "qa"
  | "security";

export const STAGE_ROLE_TO_PERSONA: Record<StageRole, PersonaId> = {
  ceo: "ceo",
  "product-owner": "product-owner",
  "solution-architect": "solution-architect",
  "software-architect": "solution-architect",
  cto: "cto",
  designer: "designer",
  pm: "engineering-manager",
  developer: "developer",
  qa: "qa",
  security: "cybersecurity",
};

export const STAGE_ROLE_LABEL: Record<StageRole, string> = {
  ceo: "CEO",
  "product-owner": "Product Owner",
  "solution-architect": "Solution Architect",
  "software-architect": "Solution Architect",
  cto: "CTO",
  designer: "Product Designer",
  pm: "Engineering Manager",
  developer: "Engineer",
  qa: "QA Engineer",
  security: "Security",
};
