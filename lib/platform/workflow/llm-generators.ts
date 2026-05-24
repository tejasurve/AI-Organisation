// lib/platform/workflow/llm-generators.ts
//
// The platform's "real intelligence" layer. Every workflow artefact (HLD,
// LLD, features, stories, code review, QA defects, security audit, dev
// commits, designer prompts) is produced by a Gemini call here — NOT by a
// regex-driven synthesizer.
//
// Each generator:
//   1. Builds a tight system prompt naming the persona + their guardrails.
//   2. Builds a user message containing the brief + every prior artefact +
//      every user revision (so feedback actually propagates).
//   3. Calls Gemini with `json: <schema>` to force strict structured output.
//   4. Validates the response and returns a fully-typed artefact.
//   5. Throws (does NOT silently demo-fall-back) if no key is configured or
//      if the upstream call fails after retries. The caller decides what to
//      show the user.
//
// Why one file: every generator shares (a) the brief→context preamble,
// (b) the "stay inside MVP scope, ignore Future Scope" guardrail, and
// (c) the JSON-schema-defining helpers. Keeping them together is easier to
// audit than scattering them across 9 files.

import { callLLM, NoApiKeyError, UpstreamError, type CallResult } from "../llm/proxy.ts";
import { PERSONAS, type PersonaId } from "../personas/catalog.ts";
import type {
  CodeReviewArtefact,
  Defect,
  DesignArtefact,
  FeaturesArtefact,
  HldArtefact,
  LldArtefact,
  ProjectBrief,
  SecurityAudit,
  UserStory,
} from "./types.ts";

// ---------- Errors re-exported for the engine ----------

export { NoApiKeyError, UpstreamError } from "../llm/proxy.ts";

// ---------- Shared helpers ----------

const PROVIDER = "gemini" as const;
const MODEL_FAST = "gemini-2.5-flash-lite"; // cheap, reliable, JSON-mode OK
const MODEL_PLAN = "gemini-2.5-flash-lite"; // can be bumped to "gemini-2.5-flash" for deeper reasoning (with retry; 503-prone)

/** Single source of truth for the persona "voice" prefix every prompt opens with. */
function personaSystem(personaId: PersonaId): string {
  const p = PERSONAS[personaId];
  const skills = (p.specialties ?? []).slice(0, 6).join(", ");
  return [
    `You are ${p.title}.`,
    p.bio ? `Background: ${p.bio}` : "",
    p.voice ? `Voice: ${p.voice}` : "",
    p.principles?.length ? `Operating principles:\n- ${p.principles.slice(0, 6).join("\n- ")}` : "",
    skills ? `Core skills: ${skills}.` : "",
    "Reply with strict JSON matching the response schema. No markdown fences, no prose outside the JSON.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * "Anchor block" appended to every user prompt. Includes the brief, MVP
 * scope, and the hard constraint "ignore the Future Scope section". This is
 * the difference between getting a weather app vs. a payments fabrication.
 */
function briefAnchor(brief: ProjectBrief, extra?: string): string {
  return [
    `# Brief — ${brief.name}`,
    brief.audience ? `Audience: ${brief.audience}` : "",
    brief.successMetric ? `Success metric: ${brief.successMetric}` : "",
    "",
    "## Pitch (verbatim)",
    brief.pitch,
    "",
    "## CRITICAL guardrails",
    "- Stay strictly inside the MVP scope. If the brief lists items under \"Avoid\" or \"Out of scope\", you MUST NOT add them anywhere.",
    "- If the brief has a \"Future Scope\" or \"Future Features\" section, those are EXPLICITLY for later sprints — do NOT pull them into the current plan.",
    "- Do not invent capabilities the brief doesn't ask for (e.g. payments, real-time tracking, marketplace, social features) unless the brief explicitly requests them in the MVP section.",
    "- Tech stack picks must match the brief's stated preferences when given. Do not silently substitute.",
    extra ? `\n## Context for this stage\n${extra}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Best-effort JSON cleanup — strips markdown fences, leading/trailing junk. */
function parseJsonLoose<T>(text: string): T {
  let cleaned = text.trim();
  // Strip ```json … ``` fences if the model added them anyway.
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // Find the first { or [ and last } or ] in case there's leading prose.
  const firstObj = cleaned.indexOf("{");
  const firstArr = cleaned.indexOf("[");
  const start =
    firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
  if (start > 0) cleaned = cleaned.slice(start);
  const lastObj = cleaned.lastIndexOf("}");
  const lastArr = cleaned.lastIndexOf("]");
  const end = Math.max(lastObj, lastArr);
  if (end >= 0 && end < cleaned.length - 1) cleaned = cleaned.slice(0, end + 1);
  return JSON.parse(cleaned) as T;
}

/**
 * Wrap a generator call in two retries. If Gemini ever returns invalid JSON
 * (rare with `responseMimeType: application/json`, but it's still LLM
 * output) we retry once with a "your previous response wasn't valid JSON"
 * nudge. Hard failure throws UpstreamError or NoApiKeyError up.
 */
async function callJson<T>(args: {
  persona: PersonaId;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  model?: string;
  temperature?: number;
}): Promise<{ data: T; raw: CallResult }> {
  const r = await callLLM({
    provider: PROVIDER,
    model: args.model ?? MODEL_FAST,
    system: args.system,
    messages: [{ role: "user", content: args.prompt }],
    temperature: args.temperature ?? 0.4,
    json: args.schema,
    allowDemoFallback: false,
    maxRetries: 3,
  });
  let data: T;
  try {
    data = parseJsonLoose<T>(r.text);
  } catch (e) {
    // Single retry with a corrective nudge.
    const retry = await callLLM({
      provider: PROVIDER,
      model: args.model ?? MODEL_FAST,
      system: args.system,
      messages: [
        { role: "user", content: args.prompt },
        { role: "assistant", content: r.text },
        {
          role: "user",
          content:
            "Your previous response was not valid JSON. Reply again with strict JSON only — no markdown fences, no prose. Match the schema exactly.",
        },
      ],
      temperature: 0.1,
      json: args.schema,
      allowDemoFallback: false,
      maxRetries: 3,
    });
    data = parseJsonLoose<T>(retry.text);
    return { data, raw: retry };
  }
  return { data, raw: r };
}

// ============================================================================
// 1. Features — Product Owner
// ============================================================================

const featuresSchema = {
  type: "object",
  properties: {
    personas: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          context: { type: "string" },
          needs: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
        },
        required: ["name", "context", "needs"],
      },
    },
    features: {
      type: "array",
      minItems: 4,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          userJob: { type: "string" },
          valueHypothesis: { type: "string" },
          primaryUser: { type: "string" },
          acceptanceSignals: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
          priority: { type: "string", enum: ["must", "should", "could", "wont"] },
        },
        required: ["name", "userJob", "valueHypothesis", "primaryUser", "acceptanceSignals", "priority"],
      },
    },
    openQuestions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
    outOfScope: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
  },
  required: ["personas", "features", "openQuestions", "outOfScope"],
};

export async function generateFeatures(brief: ProjectBrief): Promise<{
  artefact: FeaturesArtefact;
  llm: CallResult;
}> {
  const system = personaSystem("product-owner");
  const prompt = [
    briefAnchor(brief),
    "",
    "## Your task — Product Discovery",
    "Produce a focused feature catalogue for THIS PRODUCT'S MVP. Specifically:",
    "1. **personas** — 1–3 user personas the MVP serves (name, one-sentence context, 2–4 needs each). Use the audience from the brief; do not invent unrelated personas.",
    "2. **features** — 4–8 features that directly map to capabilities in the brief's MVP section. Each feature must:",
    "   - Have a *short* name (2–4 words).",
    "   - State the user job (\"as a X I want to Y so that Z\" condensed to one sentence).",
    "   - State the value hypothesis (what this proves/enables).",
    "   - Name the primary user (one of the personas above).",
    "   - List 2–3 acceptance signals (observable behaviours / outputs).",
    "   - Have a MoSCoW priority: \"must\" / \"should\" / \"could\" / \"wont\" (most MVP features are \"must\" or \"should\").",
    "3. **openQuestions** — 1–4 questions to clarify with the founder before sprint 1.",
    "4. **outOfScope** — explicit list of things the brief excludes (copy from \"Avoid\" sections + anything in Future Scope that you're deliberately deferring).",
    "",
    "Critical: do not invent generic SaaS features (auth, billing, dashboards) unless the brief asks for them. Read the brief carefully.",
  ].join("\n");

  const { data, raw } = await callJson<FeaturesArtefact>({
    persona: "product-owner",
    system,
    prompt,
    schema: featuresSchema,
  });

  // Assign stable IDs (the LLM doesn't generate them).
  const personas = data.personas.map((p, i) => ({ ...p, id: `persona-${i + 1}` }));
  const features = data.features.map((f, i) => ({
    ...f,
    id: `feat-${i + 1}`,
  }));

  return {
    artefact: {
      personas,
      features,
      openQuestions: data.openQuestions ?? [],
      outOfScope: data.outOfScope ?? [],
    },
    llm: raw,
  };
}

// ============================================================================
// 2. HLD — Solution Architect
// ============================================================================

const hldSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    bullets: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
    contexts: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 },
    diagramMermaid: { type: "string" },
    stack: {
      type: "array",
      minItems: 4,
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          area: { type: "string" },
          choice: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["area", "choice", "rationale"],
      },
    },
    risks: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          risk: { type: "string" },
          mitigation: { type: "string" },
        },
        required: ["risk", "mitigation"],
      },
    },
  },
  required: ["summary", "bullets", "contexts", "diagramMermaid", "stack", "risks"],
};

export async function generateHld(args: {
  brief: ProjectBrief;
  features: FeaturesArtefact;
  /** User feedback rounds, if any. Each pushes a revision through. */
  revisions?: { feedback: string }[];
}): Promise<{ artefact: HldArtefact; llm: CallResult }> {
  const system = personaSystem("solution-architect");
  const featuresBlock = args.features.features
    .map((f) => `- (${f.priority.toUpperCase()}) ${f.name} — ${f.userJob}`)
    .join("\n");
  const revisionBlock = (args.revisions ?? []).length
    ? `\n## User revision requests so far (most recent last)\n${args.revisions!
        .map((r, i) => `${i + 1}. ${r.feedback}`)
        .join("\n")}\n\nIncorporate the LATEST request explicitly into your design — don't just repeat the prior plan.`
    : "";

  const prompt = [
    briefAnchor(
      args.brief,
      `Features the PO has prioritised for MVP:\n${featuresBlock}${revisionBlock}`,
    ),
    "",
    "## Your task — High-Level Design",
    "Design the system for THIS PRODUCT specifically. No generic boilerplate.",
    "",
    "Produce:",
    "1. **summary** — 1–2 sentence executive summary of the architecture.",
    "2. **bullets** — 3–6 key architectural decisions (one line each).",
    "3. **contexts** — 2–6 bounded contexts (DDD-style domains). Each name should be 1–3 words.",
    "4. **diagramMermaid** — a valid Mermaid `flowchart TD` diagram showing user → frontend → bounded contexts → external integrations. Use real component names from this product. Keep it 6–14 nodes.",
    "5. **stack** — 5–10 stack picks (area / choice / rationale). Honour the brief's stated tech preferences (e.g. \"Next.js, Tailwind, Framer Motion\" → use them, don't substitute). Pick external APIs from the brief's \"Suggested integrations\" when it has them.",
    "6. **risks** — 2–4 risks with concrete mitigations specific to this domain.",
    "",
    "Critical:",
    "- Do NOT include payments / Stripe / billing unless the brief asks for them.",
    "- Do NOT include PostGIS / spatial DB unless the brief truly needs geographic search (a weather app with auto-detect location does NOT need PostGIS).",
    "- Do NOT include realtime infrastructure unless the brief asks for it.",
    "- The diagram must NOT have duplicate node IDs and must be valid Mermaid.",
  ].join("\n");

  const { data, raw } = await callJson<HldArtefact>({
    persona: "solution-architect",
    system,
    prompt,
    schema: hldSchema,
    model: MODEL_PLAN,
    temperature: 0.3,
  });

  return { artefact: data, llm: raw };
}

// ============================================================================
// 3. LLD — CTO
// ============================================================================

const lldSchema = {
  type: "object",
  properties: {
    modules: {
      type: "array",
      minItems: 3,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          description: { type: "string" },
          surface: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
        },
        required: ["id", "description", "surface"],
      },
    },
    dataModel: {
      type: "array",
      minItems: 2,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          entity: { type: "string" },
          fields: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 12 },
        },
        required: ["entity", "fields"],
      },
    },
    apis: {
      type: "array",
      minItems: 3,
      maxItems: 14,
      items: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
          path: { type: "string" },
          purpose: { type: "string" },
        },
        required: ["method", "path", "purpose"],
      },
    },
  },
  required: ["modules", "dataModel", "apis"],
};

export async function generateLld(args: {
  brief: ProjectBrief;
  features: FeaturesArtefact;
  hld: HldArtefact;
}): Promise<{ artefact: LldArtefact; llm: CallResult }> {
  const system = personaSystem("cto");
  const ctxList = args.hld.contexts.join(", ");
  const stackList = args.hld.stack.map((s) => `${s.area}: ${s.choice}`).join("; ");
  const featList = args.features.features.map((f) => f.name).join(", ");

  const prompt = [
    briefAnchor(
      args.brief,
      `Solution Architect has set these bounded contexts: ${ctxList}\nStack picks: ${stackList}\nMVP features: ${featList}`,
    ),
    "",
    "## Your task — Low-Level Design",
    "Translate the HLD into concrete modules, data model, and API surface for THIS PRODUCT.",
    "",
    "Produce:",
    "1. **modules** — 3–8 implementation modules (id like \"weather/forecast\" or \"events/discovery\"; one-sentence description; 1–4 public surface items like function/class names).",
    "2. **dataModel** — 2–6 entities with their field lists. Stay grounded in the brief; do not invent entities for capabilities not in scope.",
    "3. **apis** — 4–10 endpoints (method, path, one-sentence purpose). Use real product nouns in the path (\"/api/weather/current\", not \"/api/listings\").",
    "",
    "Critical: do not include endpoints / entities for features the brief excludes.",
  ].join("\n");

  const { data, raw } = await callJson<LldArtefact>({
    persona: "cto",
    system,
    prompt,
    schema: lldSchema,
    model: MODEL_PLAN,
    temperature: 0.3,
  });

  return { artefact: data, llm: raw };
}

// ============================================================================
// 4. User Stories — Engineering Manager
// ============================================================================

interface RawStory {
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptance: string[];
  tasks: string[];
  effort: "S" | "M" | "L";
}

const storiesSchema = {
  type: "object",
  properties: {
    stories: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          asA: { type: "string" },
          iWant: { type: "string" },
          soThat: { type: "string" },
          acceptance: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
          tasks: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
          effort: { type: "string", enum: ["S", "M", "L"] },
        },
        required: ["title", "asA", "iWant", "soThat", "acceptance", "tasks", "effort"],
      },
    },
  },
  required: ["stories"],
};

export async function generateStories(args: {
  brief: ProjectBrief;
  features: FeaturesArtefact;
  hld: HldArtefact;
  lld: LldArtefact;
  sprintNumber: number;
  /** Stories from prior sprints that should NOT be repeated. */
  alreadyShipped?: { title: string }[];
  /** Sprint focus the user provided when planning this sprint. */
  focus?: string;
  /** Stories carried over from the previous sprint (still in-progress). */
  carryOver?: UserStory[];
}): Promise<{ stories: UserStory[]; llm: CallResult }> {
  const system = personaSystem("engineering-manager");

  const featBlock = args.features.features
    .map((f) => `- (${f.priority.toUpperCase()}) ${f.name} — ${f.userJob}`)
    .join("\n");
  const moduleBlock = args.lld.modules.map((m) => `- ${m.id}: ${m.description}`).join("\n");
  const shippedBlock = (args.alreadyShipped ?? []).length
    ? `\n## Already shipped in earlier sprints (DO NOT repeat)\n${args.alreadyShipped!
        .map((s) => `- ${s.title}`)
        .join("\n")}`
    : "";
  const carryBlock = (args.carryOver ?? []).length
    ? `\n## Carry-over from previous sprint (must include, may be re-tasked)\n${args.carryOver!
        .map((s) => `- ${s.title}`)
        .join("\n")}`
    : "";
  const focusBlock = args.focus
    ? `\n## User-specified focus for THIS sprint\n${args.focus}`
    : "";

  const prompt = [
    briefAnchor(
      args.brief,
      [
        `Sprint number: ${args.sprintNumber}`,
        `Features available:\n${featBlock}`,
        `LLD modules:\n${moduleBlock}`,
        shippedBlock,
        carryBlock,
        focusBlock,
      ]
        .filter(Boolean)
        .join("\n\n"),
    ),
    "",
    "## Your task — Sprint Backlog",
    `Slice the features into 4–6 vertical user stories for sprint ${args.sprintNumber}. Each story:`,
    "1. Has a *concise* title (3–6 words, naming what the user can do).",
    "2. Uses INVEST format: as-a / I-want / so-that, plus 1–3 acceptance criteria and 2–4 concrete dev tasks (tasks should name real artefacts — e.g. \"OpenWeather API client module\", \"Forecast cache layer\", not generic \"Build\" / \"Test\").",
    "3. Has an effort estimate (S = ½ day, M = 1–2 days, L = 3+ days).",
    "",
    "Sprint 1 should pick the *highest-leverage* MUST features for a usable demo. Later sprints add to that surface.",
    "",
    "Critical:",
    "- Do not invent stories for capabilities not in the brief.",
    "- Tasks must reference real modules / APIs / components — names that would actually appear in a PR.",
    "- Do NOT repeat stories that were already shipped (see list above).",
  ].join("\n");

  const { data, raw } = await callJson<{ stories: RawStory[] }>({
    persona: "engineering-manager",
    system,
    prompt,
    schema: storiesSchema,
    model: MODEL_PLAN,
    temperature: 0.4,
  });

  const stories: UserStory[] = data.stories.map((s, i) => ({
    id: `story-${args.sprintNumber}-${i + 1}`,
    title: s.title,
    asA: s.asA,
    iWant: s.iWant,
    soThat: s.soThat,
    acceptance: s.acceptance ?? [],
    tasks: s.tasks ?? [],
    status: "todo",
    effort: s.effort,
    sprintNumber: args.sprintNumber,
    origin: "fresh",
  }));

  return { stories, llm: raw };
}

// ============================================================================
// 5. Designer prompts — Designer (Stitch input)
// ============================================================================

interface DesignerPromptsRaw {
  aestheticDirection: string;
  /** 3–5 screen prompts the Designer will hand to Stitch. */
  screens: { title: string; prompt: string }[];
}

const designerSchema = {
  type: "object",
  properties: {
    aestheticDirection: { type: "string" },
    screens: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          prompt: { type: "string" },
        },
        required: ["title", "prompt"],
      },
    },
  },
  required: ["aestheticDirection", "screens"],
};

export async function generateDesignerPrompts(args: {
  brief: ProjectBrief;
  features: FeaturesArtefact;
  /** Locked theme from a prior approval, if any. */
  lockedTheme?: string;
}): Promise<{
  aestheticDirection: string;
  screens: { title: string; prompt: string }[];
  llm: CallResult;
}> {
  const system = personaSystem("designer");
  const themeBlock = args.lockedTheme
    ? `\nUser already locked in the **${args.lockedTheme}** aesthetic. Every screen prompt must reinforce that.`
    : "";

  const featList = args.features.features
    .filter((f) => f.priority === "must" || f.priority === "should")
    .map((f) => `- ${f.name}: ${f.userJob}`)
    .join("\n");

  const prompt = [
    briefAnchor(args.brief, `MVP features the screens must cover:\n${featList}${themeBlock}`),
    "",
    "## Your task — Designer brief for Stitch",
    "Plan the screen set the Designer should generate via Stitch.",
    "",
    "Produce:",
    "1. **aestheticDirection** — one paragraph describing the visual direction. Reference the brief's Inspiration block when present (e.g. \"Apple Weather meets Airbnb Experiences — cinematic, glassmorphic, motion-rich\"). Be specific about palette mood, typography, motion language.",
    "2. **screens** — 3–5 screen prompts for Stitch. Each prompt:",
    "   - Has a short title (e.g. \"Weather Dashboard\", \"10-Day Planner\").",
    "   - Has a 2–4 sentence prompt that names the key UI elements, the layout, the data visible, and the motion cues — written as if briefing a designer to mock the screen.",
    "",
    "Critical:",
    "- Screens MUST map to the features above. Don't generate a generic \"Login screen\" unless auth is in scope.",
    "- Reflect the brief's UI requirements (animations, glassmorphism, dynamic weather-based themes, etc.) in the prompts.",
  ].join("\n");

  const { data, raw } = await callJson<DesignerPromptsRaw>({
    persona: "designer",
    system,
    prompt,
    schema: designerSchema,
    temperature: 0.5,
  });

  return {
    aestheticDirection: data.aestheticDirection,
    screens: data.screens,
    llm: raw,
  };
}

// ============================================================================
// 6. Per-story commits — Developer (BATCHED — single LLM call per sprint)
// ============================================================================
//
// Previous design made one LLM call per story (5 stories = 5 sequential
// Gemini calls). Each call had an independent ~5-10% chance of hitting a
// transient 503 ("high demand"), so a 5-story sprint had a >30% chance of
// failing somewhere. With the user well under quota (8/4000 RPM), the
// volume of calls — not the rate — was the problem.
//
// The new design batches all stories into ONE call. The Developer LLM
// plans every story's commit set in a single response, slashing the
// 503-exposure surface 5x and cutting sprint-dev wall time from ~60s to
// ~10s.

export interface StoryCommit {
  storyId: string;
  storyTitle: string;
  branch: string;
  prNumber: number;
  commits: number;
  files: string[];
  linesAdded: number;
  linesRemoved: number;
  notes: string;
}

interface RawCommit {
  storyTitle: string;
  branch: string;
  commits: number;
  files: string[];
  linesAdded: number;
  linesRemoved: number;
  notes: string;
}

const commitsBatchSchema = {
  type: "object",
  properties: {
    commits: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          storyTitle: { type: "string" },
          branch: { type: "string" },
          commits: { type: "number" },
          files: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 10 },
          linesAdded: { type: "number" },
          linesRemoved: { type: "number" },
          notes: { type: "string" },
        },
        required: [
          "storyTitle",
          "branch",
          "commits",
          "files",
          "linesAdded",
          "linesRemoved",
          "notes",
        ],
      },
    },
  },
  required: ["commits"],
};

/**
 * Plan the commit set for EVERY story in the sprint in a single LLM call.
 * Drastically reduces 503-exposure vs. calling per story.
 */
export async function generateStoryCommits(args: {
  brief: ProjectBrief;
  stories: UserStory[];
  lld: LldArtefact;
}): Promise<{ commits: StoryCommit[]; llm: CallResult }> {
  const system = personaSystem("developer");
  const moduleList = args.lld.modules.map((m) => m.id).join(", ");

  const storyBlock = args.stories
    .map(
      (s, i) =>
        `${i + 1}. **${s.title}** (effort=${s.effort})\n   As a ${s.asA} I want to ${s.iWant} so that ${s.soThat}.\n   Tasks:\n${s.tasks.map((t) => `     - ${t}`).join("\n")}`,
    )
    .join("\n\n");

  const prompt = [
    `Product: ${args.brief.name}`,
    "",
    `## Sprint backlog (${args.stories.length} stories)`,
    storyBlock,
    "",
    `## Available LLD modules`,
    moduleList,
    "",
    "## Your task — Plan the commit set for ALL stories",
    "You are the developer who just shipped this sprint. Produce ONE commit-plan object per story, in the SAME ORDER as the backlog above. The `storyTitle` MUST exactly match the title used in the backlog so I can join your output back to the right story.",
    "",
    "For each story produce:",
    "- **storyTitle**: exact match to the story title in the backlog above.",
    "- **branch**: short branch name like `feat/<slug>` derived from the title.",
    "- **commits**: realistic count for this effort (S→2-3, M→3-5, L→5-8).",
    "- **files**: 3–8 file paths actually touched. Use the LLD module IDs in the paths (e.g. `lib/weather/forecast.ts`). Include at least one test file and one component/UI file per story.",
    "- **linesAdded** / **linesRemoved**: realistic numbers. S ~50-100 lines, M ~100-300, L ~300-600. Removed ~15-30% of added.",
    "- **notes**: one sentence on the trickiest part of THIS story's implementation, naming a real task from above.",
    "",
    "Be concrete. Different stories must touch DIFFERENT files (no copy-paste). Do not produce generic placeholders.",
  ].join("\n");

  const { data, raw } = await callJson<{ commits: RawCommit[] }>({
    persona: "developer",
    system,
    prompt,
    schema: commitsBatchSchema,
    temperature: 0.5,
  });

  // Join LLM output back to stories by title match (with falls-back to
  // positional matching if the LLM drifted on the title).
  const byTitle = new Map(args.stories.map((s) => [s.title.toLowerCase().trim(), s]));
  const commits: StoryCommit[] = data.commits.map((c, i) => {
    const matched = byTitle.get(c.storyTitle.toLowerCase().trim()) ?? args.stories[i] ?? args.stories[0]!;
    return {
      storyId: matched.id,
      storyTitle: matched.title,
      branch: c.branch,
      prNumber: 100 + (hashStr(matched.id) % 900),
      commits: c.commits,
      files: c.files,
      linesAdded: c.linesAdded,
      linesRemoved: c.linesRemoved,
      notes: c.notes,
    };
  });

  return { commits, llm: raw };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// ============================================================================
// 7. Code Review — Solution Architect
// ============================================================================

interface RawCodeReview {
  diffSummary: string;
  comments: {
    file: string;
    line: number;
    severity: "nit" | "minor" | "major";
    text: string;
  }[];
}

const codeReviewSchema = {
  type: "object",
  properties: {
    diffSummary: { type: "string" },
    comments: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          line: { type: "number" },
          severity: { type: "string", enum: ["nit", "minor", "major"] },
          text: { type: "string" },
        },
        required: ["file", "line", "severity", "text"],
      },
    },
  },
  required: ["diffSummary", "comments"],
};

export async function generateCodeReview(args: {
  brief: ProjectBrief;
  stories: UserStory[];
  lld: LldArtefact;
  commits: StoryCommit[];
}): Promise<{ artefact: CodeReviewArtefact; llm: CallResult }> {
  const system = personaSystem("solution-architect");
  const filesTouched = [...new Set(args.commits.flatMap((c) => c.files))].slice(0, 16).join("\n");
  const storiesBlock = args.stories.map((s) => `- ${s.title} (${s.effort})`).join("\n");
  const totalLines = args.commits.reduce((sum, c) => sum + c.linesAdded, 0);

  const prompt = [
    `Product: ${args.brief.name}`,
    "",
    "## Sprint output you are reviewing",
    `Stories shipped:\n${storiesBlock}`,
    "",
    `Files touched (truncated):\n${filesTouched}`,
    "",
    `Total: +${totalLines} lines across ${args.commits.length} branches.`,
    "",
    "## Your task — Code Review",
    "Produce a sprint-level code review for THIS PRODUCT. Be specific to the modules and the brief's domain.",
    "",
    "- **diffSummary**: 1–2 sentences summarising what changed and which modules were touched.",
    "- **comments**: 2–6 review comments. Each has a real file path (pick from the files-touched list), a line number, a severity (\"nit\" / \"minor\" / \"major\"), and a concrete review note. Mix severities. Reference real domain concerns from THIS product (e.g. for a weather app: rate-limiting the weather API, caching responses, retry on 429, animation perf on mobile).",
    "",
    "Critical: do not produce generic JS/TS lint nits unless the brief makes them relevant. Comments must be tied to specific files and the actual brief.",
  ].join("\n");

  const { data, raw } = await callJson<RawCodeReview>({
    persona: "solution-architect",
    system,
    prompt,
    schema: codeReviewSchema,
    temperature: 0.4,
  });

  return {
    artefact: {
      reviewerPersona: "solution-architect",
      diffSummary: data.diffSummary,
      comments: data.comments.map((c) => ({ ...c, resolved: false })),
    },
    llm: raw,
  };
}

// ============================================================================
// 8. QA Defects — QA Lead
// ============================================================================

interface RawQaDefects {
  defects: {
    storyTitle: string | null;
    title: string;
    severity: "P1" | "P2" | "P3";
    repro: string;
  }[];
}

const qaSchema = {
  type: "object",
  properties: {
    defects: {
      type: "array",
      minItems: 0,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          // Gemini's responseSchema does not accept type arrays / "null" union;
          // use nullable: true to allow "no story" cross-cutting defects.
          storyTitle: { type: "string", nullable: true },
          title: { type: "string" },
          severity: { type: "string", enum: ["P1", "P2", "P3"] },
          repro: { type: "string" },
        },
        required: ["title", "severity", "repro"],
      },
    },
  },
  required: ["defects"],
};

export async function generateQaDefects(args: {
  brief: ProjectBrief;
  stories: UserStory[];
  hld: HldArtefact;
}): Promise<{ defects: Defect[]; llm: CallResult }> {
  const system = personaSystem("qa");
  const storiesBlock = args.stories
    .map((s) => `- ${s.title} — acceptance: ${s.acceptance.join("; ")}`)
    .join("\n");
  const risksBlock = args.hld.risks.map((r) => `- ${r.risk}`).join("\n");

  const prompt = [
    briefAnchor(args.brief, `Sprint stories:\n${storiesBlock}\n\nKnown architectural risks:\n${risksBlock}`),
    "",
    "## Your task — QA verdict for this sprint",
    "You're the QA Lead. Inspect the stories' acceptance criteria and the architectural risks; decide whether the sprint passes, and if not, file defects.",
    "",
    "Produce **defects** — an array of 0 to 4 issues. Most sprints have 0–2. Each defect has:",
    "- **storyTitle**: the exact title of the story it relates to, or null if it's cross-cutting.",
    "- **title**: 1-line summary of the bug.",
    "- **severity**: P1 (blocking ship), P2 (visible degradation), P3 (small).",
    "- **repro**: 1–2 sentence reproduction steps written like a real bug ticket. Be SPECIFIC to this product's domain (for a weather app: \"On a sunny forecast, hourly chart shows yesterday's data — cache key is missing the date.\" — not \"Search returns 500\").",
    "",
    "Critical: do not invent defects. Only file what's plausible given the stories' acceptance criteria + the known risks. If everything looks clean, return an empty defects array.",
  ].join("\n");

  const { data, raw } = await callJson<RawQaDefects>({
    persona: "qa",
    system,
    prompt,
    schema: qaSchema,
    temperature: 0.4,
  });

  const defects: Defect[] = data.defects.map((d, i) => {
    const matchedStory = d.storyTitle
      ? args.stories.find((s) => s.title === d.storyTitle) ?? null
      : null;
    return {
      id: `defect-${Date.now()}-${i}`,
      storyId: matchedStory?.id ?? null,
      title: d.title,
      severity: d.severity,
      repro: d.repro,
      status: "open",
    };
  });

  return { defects, llm: raw };
}

// ============================================================================
// 9. Security Audit — Cybersecurity
// ============================================================================

interface RawSecurityAudit {
  verdict: "GO" | "NO_GO";
  findings: {
    severity: "critical" | "high" | "low";
    finding: string;
    fix: string;
  }[];
}

const securitySchema = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["GO", "NO_GO"] },
    findings: {
      type: "array",
      minItems: 0,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["critical", "high", "low"] },
          finding: { type: "string" },
          fix: { type: "string" },
        },
        required: ["severity", "finding", "fix"],
      },
    },
  },
  required: ["verdict", "findings"],
};

export async function generateSecurityAudit(args: {
  brief: ProjectBrief;
  hld: HldArtefact;
  lld: LldArtefact;
  stories: UserStory[];
  /**
   * Findings raised in the previous audit pass for this sprint, which the
   * Engineer has since been routed to fix. The auditor MUST verify whether
   * each was credibly addressed (acknowledged in the story tasks / LLD)
   * and drop it from the new findings if so — otherwise we get stuck in a
   * NO_GO loop forever, re-flagging the same item every cycle.
   */
  previouslyRaised?: SecurityAudit["findings"];
}): Promise<{ artefact: SecurityAudit; llm: CallResult }> {
  const system = personaSystem("cybersecurity");
  const apisBlock = args.lld.apis.map((a) => `${a.method} ${a.path} — ${a.purpose}`).join("\n");
  const storiesBlock = args.stories.map((s) => `- ${s.title}`).join("\n");

  const reauditBlock =
    args.previouslyRaised && args.previouslyRaised.length > 0
      ? [
          "",
          "## Previous audit findings (RE-AUDIT MODE)",
          "These items were raised in your last audit and the Engineer has since been tasked to fix them:",
          ...args.previouslyRaised.map(
            (f, i) =>
              `${i + 1}. [${f.severity.toUpperCase()}] ${f.finding}\n   Recommended fix at the time: ${f.fix}`,
          ),
          "",
          "**Strict rules for this pass:**",
          "- The team is iterating in good faith. Assume the previous fix was applied UNLESS the brief / LLD makes it structurally impossible (e.g. the architecture itself violates the principle, not a coding oversight that a defect-fix can address).",
          "- If a previously-raised item is now plausibly addressed, do NOT re-flag it. Drop it.",
          "- Only re-flag a previous item as critical if the LLD has zero evidence of mitigation AND the issue would still prevent ship.",
          "- It is OK and CORRECT to return GO with 0 critical findings on this pass. Do not invent NEW critical findings to compensate.",
        ].join("\n")
      : "";

  const prompt = [
    briefAnchor(args.brief, `Stories in sprint:\n${storiesBlock}\n\nAPI surface:\n${apisBlock}`),
    reauditBlock,
    "",
    "## Your task — Security Audit",
    "Audit THIS PRODUCT's design + sprint output. Surface only issues that genuinely apply given the brief's MVP scope.",
    "",
    "Produce:",
    "- **verdict**: GO or NO_GO. NO_GO is only justified by a critical finding (e.g. unauthenticated admin endpoint, secret in repo, raw HTML injection on user content). For most MVP sprints, verdict is GO with 0–2 low-severity notes.",
    "- **findings**: 0 to 4 items. Each has severity (critical / high / low), a finding (1 sentence), and a fix (1 sentence).",
    "",
    "Critical:",
    "- Findings must be domain-grounded. For a weather app: API-key exposure if the OpenWeather key is referenced client-side, rate-limit on third-party APIs, geolocation consent. For a service-finder: PII exposure in contact flows.",
    "- Do NOT fabricate vague generic findings (e.g. \"Add a CSP\" with no context). Each finding must be tied to something in the brief / HLD / LLD.",
    "- Verdict and finding severities must be consistent (verdict NO_GO only if you list a critical finding).",
  ].join("\n");

  const { data, raw } = await callJson<RawSecurityAudit>({
    persona: "cybersecurity",
    system,
    prompt,
    schema: securitySchema,
    temperature: 0.3,
  });

  // Consistency guard: if no critical findings, the verdict can't be NO_GO.
  const hasCritical = data.findings.some((f) => f.severity === "critical");
  const verdict: "GO" | "NO_GO" = hasCritical ? data.verdict : "GO";

  return {
    artefact: {
      verdict,
      findings: data.findings,
    },
    llm: raw,
  };
}

// ============================================================================
// 9. Real source code emission — Developer
// ============================================================================
//
// This is the generator that turns the planning artefacts (HLD/LLD/stories/
// design) into ACTUAL runnable Next.js source files. The Developer LLM emits
// a JSON envelope { files: [{ path, content }] } and the engine writes each
// file into the project's workspace. Combined with the scaffolder
// (`lib/platform/preview/scaffolder.ts`), this gives the user a real,
// runnable app they can preview in the dashboard.
//
// Design choices:
//
// 1. BATCHED — one LLM call per sprint, NOT one per story. Reduces 503
//    exposure 5x and cuts wall time from minutes → ~15s. We trade some
//    per-story specificity for delivery reliability.
//
// 2. JSON envelope, NOT direct code output — strict JSON mode + a tight
//    schema means we always know how to write the files to disk. The LLM
//    cannot accidentally include "Here's the code:" prose that would land
//    in someone's .tsx file and break the build.
//
// 3. ALLOW-LIST of paths — the LLM may only write into `app/`, `components/`,
//    `lib/`, `public/`, or `styles/`. Configs (`package.json`, `next.config`,
//    `tailwind.config`, `tsconfig`) are owned by the scaffolder; the LLM
//    cannot clobber them. Path traversal (`..`) is rejected.
//
// 4. NO external API calls in generated code — the LLM is instructed to use
//    deterministic mock data so the preview works without OpenWeather /
//    Google Places API keys. (The brief can ask for real APIs in a later
//    iteration; for the demo we want a screen that lights up reliably.)

export interface EmittedFile {
  path: string;
  content: string;
}

const codeSchema = {
  type: "object",
  properties: {
    files: {
      type: "array",
      minItems: 2,
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
    notes: { type: "string" },
  },
  required: ["files"],
};

interface RawCodePayload {
  files: EmittedFile[];
  notes?: string;
}

/**
 * Generate the real source files for an entire sprint in a single LLM call.
 *
 * The Developer LLM gets the brief + every prior artefact and produces a
 * batch of `{ path, content }` files. We do NOT call this per-story because
 * (a) modern Gemini handles 20-file emissions in one response just fine,
 * (b) it lets the model think holistically about file dependencies (one
 * component imports another), and (c) it slashes the 503-exposure surface.
 */
export async function generateSprintCode(args: {
  brief: ProjectBrief;
  features: FeaturesArtefact;
  hld: HldArtefact;
  lld: LldArtefact;
  stories: UserStory[];
  design?: DesignArtefact | null;
  /** Sprint number, used for tone (sprint 1 = build the spine, 2+ = add features). */
  sprintNumber: number;
  /**
   * Files already emitted by previous sprints (path only, no content). Lets
   * the LLM know what already exists so it can extend / refactor rather than
   * blindly recreate.
   */
  existingFiles?: string[];
  /**
   * Map of `relativePath → file contents` for files that should be treated
   * as the **binding data contract** for this sprint. The Developer LLM is
   * instructed to import types from these files verbatim (not redefine
   * them) and to use the exact field names they declare. Any feature that
   * needs a new field must also patch the contract file in the same
   * response. This is the single biggest defence against cross-sprint
   * type drift (the bug where sprint 1 calls a field `website` and
   * sprint 2 calls it `websiteUrl`).
   *
   * Typically populated with `lib/types.ts` and `lib/mock-data.ts` from
   * the prior sprint's emission.
   */
  dataContract?: Record<string, string>;
}): Promise<{ files: EmittedFile[]; notes: string; llm: CallResult }> {
  const system = personaSystem("developer");

  // STRICT DESIGN ANCHORING:
  // 1. Filter the design.screens[] to only the LOCKED theme. Previously we
  //    passed every theme variant (Minimal/Playful/Dense/Premium) which
  //    sent the Developer LLM contradicting visual signals — it tried to
  //    please all four and ended up producing generic Tailwind that
  //    matched none of them.
  // 2. Pick the single canonical screen for vision input. Stitch returns a
  //    PNG thumbnail per screen; we fetch it and pass it inline so Gemini
  //    can actually SEE the design and replicate the layout/palette/type.
  //    This is the strongest possible "match the design" anchor.
  const lockedScreens = pickLockedScreens(args.design ?? undefined);
  const heroScreen = lockedScreens[0] ?? null;
  const heroImage = heroScreen ? await tryFetchImage(heroScreen.thumbnailUrl) : null;

  const designSummary = (() => {
    if (!args.design) return "No design artefact yet — pick sensible defaults that match the brief.";
    const theme = args.design.selectedTheme ? `**Locked aesthetic: ${args.design.selectedTheme}.**` : "";
    const screens = lockedScreens
      .slice(0, 6)
      .map((s, i) => `${i + 1}. ${s.title}${s.description ? ` — ${s.description}` : ""}${s.figmaUrl ? `\n   Stitch link: ${s.figmaUrl}` : ""}`)
      .join("\n");
    const imageNote = heroImage
      ? "\n\n**An actual screenshot of the locked design is attached to this message.** Inspect it pixel-by-pixel and replicate its layout, colour palette, typography, spacing, and component patterns in your Tailwind code. Do NOT improvise a different aesthetic."
      : "";
    return [theme, "Screens to honour visually:", screens, imageNote].filter(Boolean).join("\n");
  })();

  const storyBlock = args.stories
    .map(
      (s, i) =>
        `${i + 1}. **${s.title}** (effort=${s.effort})\n   As a ${s.asA} I want to ${s.iWant} so that ${s.soThat}.\n   Tasks:\n${s.tasks.map((t) => `     - ${t}`).join("\n")}`,
    )
    .join("\n\n");

  const moduleBlock = args.lld.modules
    .slice(0, 12)
    .map((m) => `- ${m.id}: ${m.responsibility ?? ""}`)
    .join("\n");

  const featureBlock = args.features.features
    .filter((f) => f.priority === "must" || f.priority === "should")
    .map((f) => `- **${f.name}** — ${f.userJob}`)
    .join("\n");

  const existingBlock = (args.existingFiles ?? []).length
    ? `\n## Files that already exist in the workspace from prior sprints\nYou MAY rewrite these to add new functionality, but try to keep them consistent.\n${(args.existingFiles ?? []).map((p) => `- ${p}`).join("\n")}\n`
    : "";

  // BINDING DATA CONTRACT (sprint 2+ only):
  // The biggest cross-sprint failure mode we hit in this platform was the
  // Developer LLM rediscovering a different shape for the same domain
  // model on every sprint — sprint 1 says `Studio.website`, sprint 2 says
  // `Studio.websiteUrl`, sprint 3 deletes it entirely, and consumers
  // crash. Fix: every sprint after the first echoes the canonical
  // `lib/types.ts` (and `lib/mock-data.ts`) into the prompt verbatim and
  // instructs the LLM to import from them, not re-declare them.
  const contractEntries = Object.entries(args.dataContract ?? {});
  const contractBlock = contractEntries.length
    ? [
        "",
        "## BINDING DATA CONTRACT — DO NOT BREAK",
        "",
        "The files below are the **canonical source of truth** for the project's data model. They were emitted by an earlier sprint and other components in the workspace already rely on them.",
        "",
        "Rules:",
        "1. In every component you emit, IMPORT types from these files. Do NOT redeclare `Studio`, `Review`, `FilterOptions`, etc. inline.",
        "2. Reference field names EXACTLY as they appear. If the contract says `website`, do not write `websiteUrl`. If it says `isOpen`, do not write `isOpenNow`. If it says `styles: string[]`, do not write `tattooStyles: TattooStyle[]`.",
        "3. If you genuinely need a field that doesn't exist yet (e.g. a new feature requires `studio.priceRange`), you MUST include an updated version of the contract file IN THIS SAME RESPONSE with the field added. Never reference a field that exists in neither the contract nor your own emitted patch.",
        "4. When you patch a contract file, ADD fields — never rename or delete existing ones. Other components depend on them.",
        "",
        ...contractEntries.map(([p, content]) => [
          `### ${p}`,
          "```tsx",
          content.trim(),
          "```",
          "",
        ].join("\n")),
      ].join("\n")
    : "";

  const prompt = [
    briefAnchor(args.brief),
    "",
    `## Sprint ${args.sprintNumber} — implementation`,
    "",
    "### Must/Should features in scope",
    featureBlock,
    "",
    "### Architecture context (HLD)",
    `Bounded contexts: ${args.hld.contexts.join(", ")}.`,
    `Tech stack picks: ${(args.hld.stack ?? []).map((s) => `${s.layer}=${s.choice}`).join(", ")}.`,
    "",
    "### LLD modules to honour",
    moduleBlock,
    "",
    "### Locked design direction",
    designSummary,
    "",
    "### Sprint backlog (your work this sprint)",
    storyBlock,
    existingBlock,
    contractBlock,
    "",
    "## Your task — emit a batch of REAL Next.js 14 source files",
    "",
    "Workspace contract (CRITICAL — read carefully):",
    "- The workspace is a **fresh Next.js 14 app router project** with React 18, TypeScript, Tailwind v3, and framer-motion@11 already available.",
    "- `app/layout.tsx`, `app/globals.css`, `package.json`, `next.config.js`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js` ALREADY EXIST — DO NOT regenerate them.",
    "- You may ONLY write files under these paths: `app/`, `components/`, `lib/`, `public/`, `styles/`. Any other path will be rejected.",
    "- Every file must be COMPLETE and SELF-CONTAINED. No `// ...` placeholders, no `// TODO`, no truncation.",
    "- Use `\"use client\"` at the top of any component that uses hooks, framer-motion, browser APIs, or interactivity. Server components by default.",
    "- Use Tailwind classes for styling. Do not import CSS files (other than `app/globals.css` which is already wired in layout).",
    "- For external APIs (weather, places, events): generate a `lib/mock-data.ts` with realistic mock data and use it. The preview must light up WITHOUT API keys. Mention in `notes` what to swap in for production.",
    "- TypeScript: use simple types, avoid exotic generics. The scaffold has `strict: false` so don't over-type.",
    "- DO NOT import packages that aren't installed. You have: `react`, `react-dom`, `next`, `framer-motion`. That's it. Don't import `lucide-react`, `swr`, `clsx`, etc.",
    "- For icons: use inline SVG OR emoji. No icon libraries.",
    args.sprintNumber === 1
      ? "- **Sprint 1 is responsible for setting the data contract.** Emit `lib/types.ts` with every domain type you'll need (`Studio`, `Review`, filters, etc.) AND `lib/mock-data.ts` with mock data + tiny `fetch*` helpers. Every other file in this sprint and every future sprint will be required to import types from `lib/types.ts` and use those field names verbatim. Pick names you'd be happy to keep for the life of the project."
      : "- **This is sprint " + args.sprintNumber + ", which inherits a frozen data contract** (see `BINDING DATA CONTRACT` above). Import types from `lib/types.ts`; do NOT redeclare them. If you need new fields, patch `lib/types.ts` AND `lib/mock-data.ts` in this same response so the contract stays in sync.",
    "",
    "Required output:",
    "- **files**: 4–8 files for this sprint (keep it tight; ~600 lines TOTAL is plenty). At minimum: a real `app/page.tsx`, 2–4 components in `components/`, 1–2 lib files (mock data, helpers).",
    "- Each file's `content` is the complete file text, ready to write to disk verbatim.",
    "- Prefer fewer, denser files over many tiny ones — the JSON response has a hard size budget and your reply WILL be truncated if you exceed ~24k output tokens.",
    "- **VISUAL FIDELITY IS NON-NEGOTIABLE**: If a screenshot is attached, your `app/page.tsx` (and any other directly-pictured component) must visually match it. Lift the actual colour palette, typography, spacing, button shapes, card shadows, and overall composition from the image. Do NOT default to your usual Tailwind palette; sample from the screenshot.",
    "- Polish matters: use framer-motion for entrance animations, glassmorphism (`backdrop-blur-xl bg-white/5`) WHERE THE DESIGN SHOWS IT, responsive layout (`md:` / `lg:` breakpoints). The user will judge the platform by how closely `app/page.tsx` matches the locked design.",
    "- **notes**: one paragraph explaining what you built this sprint and what's mocked vs real.",
    "",
    "Be specific to THIS brief. A weather app should look like a beautiful weather app; a service-finder like a beautiful service-finder. No lorem ipsum, no generic placeholders.",
  ].join("\n");

  // Code generation is the heaviest call we make — give it the bigger
  // model (flash, not flash-lite) and a generous output budget since each
  // file can be 50-200 lines. When we have a Stitch screenshot of the
  // locked design we attach it as an inline image; Gemini multimodal
  // sees the pixels and replicates layout/palette/typography much more
  // reliably than text descriptions alone.
  const userMessage = heroImage
    ? {
        role: "user" as const,
        content: prompt,
        images: [{ data: heroImage.data, mimeType: heroImage.mimeType }],
      }
    : { role: "user" as const, content: prompt };

  // 32k tokens of output is the upper end of Gemini-2.5-flash's window —
  // a 12-file sprint at ~150 lines each can land around 24k tokens of
  // JSON-encoded source, so 32k gives real headroom.
  const r = await callLLM({
    provider: PROVIDER,
    model: "gemini-2.5-flash",
    system,
    messages: [userMessage],
    temperature: 0.5,
    json: codeSchema,
    maxTokens: 32768,
    allowDemoFallback: false,
    maxRetries: 5,
  });
  let data: RawCodePayload;
  try {
    data = parseJsonLoose<RawCodePayload>(r.text);
  } catch (e) {
    // First: try truncation recovery. If Gemini ran out of tokens mid-file
    // we can usually salvage the complete files that came before — better
    // than throwing the entire sprint's work away over the last incomplete
    // file.
    const salvaged = recoverTruncatedCodePayload(r.text);
    if (salvaged && salvaged.files.length >= 2) {
      console.warn(
        `[llm-generators] code response truncated; salvaged ${salvaged.files.length} complete file(s).`,
      );
      return {
        files: sanitiseFiles(salvaged.files),
        notes: salvaged.notes ?? "(response was truncated; partial salvage used)",
        llm: r,
      };
    }
    // Last resort: corrective retry with a smaller-payload nudge so the
    // LLM doesn't blow the budget again.
    const retry = await callLLM({
      provider: PROVIDER,
      model: "gemini-2.5-flash",
      system,
      messages: [
        { role: "user", content: prompt },
        { role: "assistant", content: r.text.slice(0, 4000) },
        {
          role: "user",
          content:
            "Your previous response was invalid JSON (likely truncated). Reply again with strict JSON only — and KEEP THE TOTAL UNDER ~24k TOKENS by emitting fewer / shorter files (5-8 files max, each focused).",
        },
      ],
      temperature: 0.2,
      json: codeSchema,
      maxTokens: 32768,
      allowDemoFallback: false,
      maxRetries: 3,
    });
    data = parseJsonLoose<RawCodePayload>(retry.text);
    return {
      files: sanitiseFiles(data.files),
      notes: data.notes ?? "",
      llm: retry,
    };
  }

  return {
    files: sanitiseFiles(data.files),
    notes: data.notes ?? "",
    llm: r,
  };
}

/**
 * Try to recover a partial code payload from a truncated JSON response.
 *
 * Gemini's `responseMimeType: application/json` mode will happily emit
 * something like:
 *   {
 *     "files": [
 *       { "path": "app/page.tsx", "content": "...complete..." },
 *       { "path": "components/Card.tsx", "content": "...complete..." },
 *       { "path": "lib/api.ts", "content": "function foo() { retu  ← cut here
 *
 * The naive parser throws "Unterminated string in JSON" and we lose ALL
 * the work. This recovery walks the response character-by-character with
 * a tiny string-aware state machine, finds the last *complete* file
 * object inside the `files` array, and constructs a valid JSON tail
 * (`]`, `}`) so we can parse the partial set.
 *
 * Returns null if the response is too broken to salvage (e.g. truncated
 * before the first complete file).
 */
function recoverTruncatedCodePayload(
  text: string,
): { files: EmittedFile[]; notes?: string } | null {
  // 1. Strip any markdown fences the model added.
  let s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // 2. Find the start of the JSON object.
  const objStart = s.indexOf("{");
  if (objStart < 0) return null;
  s = s.slice(objStart);
  // 3. Find the "files" array opening bracket.
  const filesKey = s.search(/"files"\s*:\s*\[/);
  if (filesKey < 0) return null;
  // Index just AFTER the `[`.
  const arrStart = s.indexOf("[", filesKey) + 1;

  // 4. Walk the characters from arrStart, tracking string/escape state and
  //    object-brace depth, and remembering the position right after each
  //    fully-closed top-level array element.
  let i = arrStart;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let lastGoodEnd = arrStart; // position right after the last complete `{...}` element (exclusive)
  while (i < s.length) {
    const c = s[i];
    if (escaped) {
      escaped = false;
    } else if (inString) {
      if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
    } else {
      if (c === '"') inString = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          // Just closed a top-level element. Skip any whitespace + the
          // following comma (if any) so the next element doesn't dangle.
          let j = i + 1;
          while (j < s.length && /\s/.test(s[j]!)) j++;
          if (s[j] === ",") j++;
          lastGoodEnd = j;
        }
      } else if (c === "]" && depth === 0) {
        // Array closed before we hit truncation — the response is just
        // malformed elsewhere; fall through to caller's other recovery.
        return null;
      }
    }
    i++;
  }

  if (lastGoodEnd <= arrStart) return null; // no complete element

  // 5. Build a synthetic, parseable JSON: everything up to lastGoodEnd
  //    + array close + object close.
  let truncatedSlice = s.slice(0, lastGoodEnd).trimEnd();
  // Trim a trailing comma if the last char is one.
  if (truncatedSlice.endsWith(",")) truncatedSlice = truncatedSlice.slice(0, -1);
  const synthetic = `${truncatedSlice}]}`;

  try {
    const parsed = JSON.parse(synthetic) as { files: EmittedFile[]; notes?: string };
    if (!Array.isArray(parsed.files) || parsed.files.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Last-line defence against pathological LLM output: strip surrounding
 * markdown fences from individual file contents, normalise leading
 * whitespace, and drop any file whose path looks fishy. The scaffolder's
 * `writeWorkspaceFile` does the real allow-list check; this is just a
 * convenience clean-up.
 */
function sanitiseFiles(raw: EmittedFile[]): EmittedFile[] {
  return raw
    .filter((f) => f && typeof f.path === "string" && typeof f.content === "string")
    .map((f) => ({
      path: f.path.trim().replace(/^\/+/, ""),
      content: f.content.replace(/^```(?:tsx?|jsx?|typescript|javascript|ts|js)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim() + "\n",
    }));
}

/**
 * Filter the design's screens[] down to just the LOCKED theme.
 *
 * Two real failure modes this fixes:
 *
 *  - Pre-lock: screens[] contains all 4 theme variants (Minimal / Playful /
 *    Dense / Premium). If we pass all 4 to the Developer LLM, it tries to
 *    please contradictory aesthetics and ships generic Tailwind.
 *  - Post-lock: the archive logic stores the unselected 3 in archivedScreens
 *    and keeps the selected one in screens[]. But if the design-validation
 *    stage runs AFTER lock, it may add supplementary screens for uncovered
 *    features — usually in the locked theme, but Stitch can drift. We trust
 *    selectedTheme as the source of truth and filter by suffix.
 *
 * If the theme isn't recognisable in any screen title, we fall back to the
 * first screen — better to anchor on something than confuse the LLM with
 * everything.
 */
function pickLockedScreens(
  design: DesignArtefact | undefined,
): Array<{ title: string; description?: string; figmaUrl?: string; thumbnailUrl?: string }> {
  if (!design || !design.screens?.length) return [];
  const theme = design.selectedTheme;
  if (!theme) return design.screens;
  // Title suffix convention: " · Minimal" / " · Playful" / " · Dense" / " · Premium"
  // (see lib/platform/mcp/stitch.ts where Stitch labels each variant).
  const matching = design.screens.filter((s) =>
    new RegExp(`·\\s*${theme}\\b`, "i").test(s.title ?? ""),
  );
  if (matching.length > 0) return matching;
  // Fallback: respect the explicit selection if set, else first screen.
  const selectedId = design.selectedScreenId;
  const byId = selectedId ? design.screens.find((s) => s.id === selectedId) : null;
  return byId ? [byId] : design.screens.slice(0, 1);
}

/**
 * Fetch a Stitch thumbnail URL and return base64-encodable bytes ready for
 * inline-data attachment to Gemini. Returns null on any failure — we never
 * want vision-fetching to crash the whole sprint-dev stage. The Developer
 * LLM degrades gracefully to text-only design context.
 *
 * Size guard: Gemini accepts up to ~20 MB per image. Stitch thumbnails are
 * typically 60-200 KB so we have headroom. We still bail if the response
 * is suspiciously large (>8 MB) — almost certainly a CDN error page.
 */
async function tryFetchImage(
  url: string | undefined,
): Promise<{ data: Buffer; mimeType: string } | null> {
  if (!url) return null;
  if (!/^https?:\/\//.test(url)) return null;
  try {
    // 10s timeout — Stitch CDN is usually <500ms, anything longer is a
    // sign of trouble and we'd rather skip the image than block the
    // whole code-emit call.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    const r = await fetch(url, { signal: ac.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return null;
    // Trust the content-type header; default to PNG (Stitch's standard).
    const mimeType = r.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    if (!mimeType.startsWith("image/")) return null;
    return { data: buf, mimeType };
  } catch (err) {
    console.warn(`[llm-generators] vision fetch failed for ${url}:`, (err as Error).message);
    return null;
  }
}
