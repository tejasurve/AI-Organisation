// lib/platform/workflow/types.ts
//
// Project + Workflow data model. A Project is the unit of work; it progresses
// through Stages, accumulating Artefacts. Some stages are gated on a human
// approval — until the user clicks "Approve" the workflow halts.

import type { GeneratedScreen } from "../mcp/stitch.ts";
import type { PersonaId, StageRole } from "../personas/catalog.ts";
import type { ProviderId } from "../shared/types.ts";

// ---------- Stages ----------
//
// Linear pipeline with three approval gates (after plan, after design,
// at the end of each sprint).
//
// Naming notes:
//   - `cto-review` is the **Solution Architect's** HLD stage (the legacy id
//     is retained to keep older project files loadable).
//   - `plan-draft` is the **CTO's** LLD stage (renamed in the UI label).
//   - `product-discovery`, `design-validation`, and `handoff` were added in
//     a later iteration; the store migration backfills these as needed.

export type StageId =
  | "intake"             // user shares idea; CEO greets and clarifies
  | "product-discovery"  // PO drafts features (personas, jobs, MoSCoW)
  | "cto-review"         // Solution Architect drafts HLD
  | "plan-draft"         // CTO drafts LLD on top of the HLD
  | "plan-approval"      // user gates the plan (features + HLD + LLD)
  | "design-draft"       // Stitch generates 4 theme variants
  | "design-approval"    // user picks a theme; others archived
  | "design-validation"  // PO + Designer cross-check features ↔ screens
  | "handoff"            // system surfaces HLD + LLD + Stitch link
  | "stories"            // EM slices features into vertical user stories
  | "sprint-dev"         // devs implement stories
  | "qa-review"          // QA runs tests, raises defects
  | "code-review"        // architects + devs review PRs
  | "defect-fix"         // devs fix defects
  | "security-audit"     // security go / no-go
  | "deploy"             // released to staging / prod
  | "done";              // sprint complete; idle until next iteration

export const STAGE_ORDER: readonly StageId[] = [
  "intake",
  "product-discovery",
  "cto-review",
  "plan-draft",
  "plan-approval",
  "design-draft",
  "design-approval",
  "design-validation",
  "handoff",
  "stories",
  "sprint-dev",
  "qa-review",
  "code-review",
  "defect-fix",
  "security-audit",
  "deploy",
  "done",
];

export const STAGE_META: Record<
  StageId,
  { label: string; owner: StageRole; requiresApproval?: boolean }
> = {
  intake:              { label: "Idea Intake",          owner: "ceo" },
  "product-discovery": { label: "Product · Features",   owner: "product-owner" },
  "cto-review":        { label: "HLD · Solution Architect", owner: "solution-architect" },
  "plan-draft":        { label: "LLD · CTO",            owner: "cto" },
  "plan-approval":     { label: "Plan Approval",        owner: "ceo", requiresApproval: true },
  "design-draft":      { label: "Design (Stitch)",      owner: "designer" },
  "design-approval":   { label: "Design Approval",      owner: "ceo", requiresApproval: true },
  "design-validation": { label: "Feature ↔ Design Check", owner: "designer" },
  handoff:             { label: "Handoff Package",      owner: "ceo" },
  stories:             { label: "User Stories",         owner: "pm" },
  "sprint-dev":        { label: "Sprint · Dev",         owner: "developer" },
  "qa-review":         { label: "QA Review",            owner: "qa" },
  "code-review":       { label: "Code Review",          owner: "solution-architect", requiresApproval: true },
  "defect-fix":        { label: "Defect Fix",           owner: "developer" },
  "security-audit":    { label: "Security Audit",       owner: "security" },
  deploy:              { label: "Deploy",               owner: "cto" },
  done:                { label: "Sprint Done",          owner: "ceo" },
};

// ---------- Artefacts ----------

/**
 * Product Owner's feature catalogue — produced in `product-discovery` and
 * referenced by the SA (every feature must have a context home) and the
 * Designer (every feature must have a validated UI).
 */
export interface ProductFeature {
  id: string;
  name: string;
  userJob: string;
  valueHypothesis: string;
  primaryUser: string;
  acceptanceSignals: string[];
  priority: "must" | "should" | "could" | "wont";
  /**
   * Bounded context this feature lives in. Filled by the Solution Architect
   * stage. Empty until the SA stage has run.
   */
  contextHome?: string;
  /**
   * Designer-validation state. Set in the `design-validation` stage; the
   * Designer either confirms the existing screens cover the feature, or
   * generates a new supplementary screen in the locked theme.
   */
  designValidation?: {
    state: "covered" | "supplemented" | "uncovered";
    screenId?: string;
    note: string;
    at: number;
  };
}

export interface ProductPersonaSpec {
  name: string;
  context: string;
  needs: string[];
}

export interface FeaturesArtefact {
  personas: ProductPersonaSpec[];
  features: ProductFeature[];
  openQuestions: string[];
  outOfScope: string[];
  /** Revision log mirroring HldArtefact.revisions. */
  revisions?: { at: number; feedback: string; changes: string[] }[];
}

export interface HldArtefact {
  summary: string;
  bullets: string[];
  contexts: string[]; // bounded contexts list
  diagramMermaid: string;
  stack: { area: string; choice: string; rationale: string }[];
  risks: { risk: string; mitigation: string }[];
  /**
   * Revision log. Every time the user clicks "Request changes" on the plan,
   * we append an entry here. The PlanReviewModal surfaces this section so
   * the user can SEE that their feedback was registered.
   */
  revisions?: { at: number; feedback: string; changes: string[] }[];
}

export interface LldArtefact {
  modules: { id: string; description: string; surface: string[] }[];
  dataModel: { entity: string; fields: string[] }[];
  apis: { method: string; path: string; purpose: string }[];
}

export interface DesignArtefact {
  screens: GeneratedScreen[];
  selectedScreenId: string | null;
  /**
   * The aesthetic the user locked in (parsed from the selected screen's
   * caption/title — e.g. "Minimal"). Once set, every future Stitch
   * generation for this project follows this theme.
   */
  selectedTheme?: string;
  /**
   * Screens that were generated but discarded when the user picked one.
   * Kept as a thin archive so the demo can show "we generated 4, the user
   * chose 1, here are the other 3 we threw away." Read-only after archive.
   */
  archivedScreens?: GeneratedScreen[];
  notes: string[];
  /**
   * Revision log mirroring HldArtefact.revisions — appended on every
   * "Request changes" round so the user sees their feedback acknowledged.
   */
  revisions?: { at: number; feedback: string; changes: string[] }[];
}

export interface UserStory {
  id: string;
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptance: string[];
  tasks: string[];
  status: "todo" | "in-progress" | "done";
  effort: "S" | "M" | "L";
  /**
   * Sprint this story was scheduled into. Sprint 1 is the first cycle that
   * runs after the user approves the plan + designs.
   */
  sprintNumber: number;
  /** "carry-over" stories were rolled over from a previous sprint. */
  origin?: "fresh" | "carry-over" | "defect-fix" | "security-followup";
}

export interface CodeReviewArtefact {
  reviewerPersona: PersonaId;
  comments: {
    file: string;
    line: number;
    severity: "nit" | "minor" | "major";
    text: string;
    resolved: boolean;
  }[];
  diffSummary: string;
}

export interface Defect {
  id: string;
  storyId: string | null;
  title: string;
  severity: "P1" | "P2" | "P3";
  repro: string;
  status: "open" | "in-progress" | "fixed";
}

export interface SecurityAudit {
  verdict: "GO" | "NO_GO";
  findings: { severity: "critical" | "high" | "low"; finding: string; fix: string }[];
}

// ---------- Chat ----------

export interface ChatTurn {
  id: string;
  ts: number;
  role: "user" | "persona" | "system";
  /** Persona that spoke (for "persona" turns). */
  speaker?: PersonaId;
  /** Stage at which this turn happened. */
  stage: StageId;
  text: string;
  /** When the turn corresponds to an artefact, surface it for UI affordances. */
  attachment?:
    | { kind: "features" }
    | { kind: "plan" }
    | { kind: "designs" }
    | { kind: "handoff" }
    | { kind: "stories" }
    | { kind: "code-review" }
    | { kind: "defects" }
    | { kind: "security" };
}

// ---------- Cost / token tracking ----------

export interface LlmCallRecord {
  ts: number;
  stage: StageId;
  persona: PersonaId;
  provider: ProviderId;
  model: string;
  inTokens: number;
  outTokens: number;
  costUsd: number;
  source: "live" | "demo";
}

// ---------- Project ----------

export interface ProjectBrief {
  name: string;
  pitch: string;
  audience?: string;
  successMetric?: string;
}

export interface ProjectBindings {
  github?: { owner: string; repo: string; createNew: boolean };
}

/**
 * Snapshot of a completed sprint, archived into Project.sprintHistory before
 * the next sprint begins. Each snapshot is read-only after archive.
 */
export interface SprintSnapshot {
  sprintNumber: number;
  completedAt: number;
  focus: string;
  stories: UserStory[];
  codeReview: CodeReviewArtefact | null;
  defects: Defect[];
  security: SecurityAudit | null;
  filesWritten: number;
}

export interface Project {
  id: string;
  createdAt: number;
  brief: ProjectBrief;
  bindings: ProjectBindings;

  /** Current stage of the workflow. */
  stage: StageId;
  /** When stage entered (for elapsed time display). */
  stageStartedAt: number;
  /** Is the workflow currently paused waiting for the user? */
  waitingForUser: boolean;

  /**
   * Which sprint number we are currently executing. Increments when the user
   * clicks "Plan next sprint" from the `done` stage.
   */
  currentSprint: number;
  /** Optional sprint-level focus, captured when planning the next sprint. */
  currentSprintFocus?: string;
  /** Read-only archive of previous sprints' work products. */
  sprintHistory: SprintSnapshot[];

  // Artefacts (always scoped to the *current* sprint)
  /**
   * Product Owner's feature catalogue. Drives the SA (every feature → context)
   * and the Designer (every feature → screen). Null until the PO stage runs.
   */
  features: FeaturesArtefact | null;
  hld: HldArtefact | null;
  lld: LldArtefact | null;
  design: DesignArtefact | null;
  stories: UserStory[];
  codeReview: CodeReviewArtefact | null;
  defects: Defect[];
  security: SecurityAudit | null;

  // Conversation history (CEO chat panel) — accumulates across sprints
  chat: ChatTurn[];

  // Cost meter — accumulates across sprints
  llmCalls: LlmCallRecord[];
  totalCostUsd: number;
  totalInTokens: number;
  totalOutTokens: number;

  /**
   * Real source files emitted by the Developer agent into the project's
   * workspace dir (`.simulation/projects/<id>/workspace/`). Paths are
   * workspace-relative. The platform spawns `next dev` from that workspace
   * when the user opens the Preview pane.
   */
  emittedFiles?: string[];
  /**
   * Optional one-line note from the Developer LLM about the sprint's build
   * (e.g. "mocked weather API, hooked Framer Motion entrance anims"). Shown
   * in the Preview pane so the user knows what's real vs mocked.
   */
  buildNotes?: string;
}
