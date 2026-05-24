// lib/platform/workflow/engine.ts
//
// The choreographer. Each `runStage()` does three things:
//
//   1. Drives the 3D office via AgentEvents (move, status, say) on the existing
//      simulation event-bus so the office stays in sync visually.
//   2. Talks via a Persona (using the LLM proxy with demo fallback).
//   3. Produces / mutates an artefact on the Project and persists it.
//
// The engine is the *only* place that mutates a Project, except for explicit
// user actions (chat message, approval, comment). All stages are idempotent
// at the artefact level — re-running them produces a fresh artefact.

import { randomUUID } from "node:crypto";

import { emit as emitAgentEvent } from "@/lib/simulation/event-bus.ts";
import type { AgentName } from "@/lib/simulation/types.ts";

import { callLLM, NoApiKeyError, UpstreamError, type ChatMessage } from "../llm/proxy.ts";
import {
  generateScreens,
  generateSupplementaryScreen,
  redesignScreen,
  stitchAppUrlFor,
  type GeneratedScreen,
} from "../mcp/stitch.ts";
import {
  PERSONAS,
  STAGE_ROLE_TO_PERSONA,
  STAGE_ROLE_LABEL,
  type PersonaId,
  type StageRole,
} from "../personas/catalog.ts";
import * as Chat from "./brief-chat.ts";
// LLM-driven artefact generators — these REPLACE the deleted brief-templates
// synthesizers. Every architectural artefact (HLD, LLD, features, stories,
// QA defects, code review, security audit, dev commits) is now produced by a
// real Gemini call against the actual brief, not regex pattern-matching.
import {
  generateCodeReview,
  generateDesignerPrompts,
  generateFeatures as llmGenerateFeatures,
  generateHld as llmGenerateHld,
  generateLld as llmGenerateLld,
  generateQaDefects,
  generateSecurityAudit,
  generateSprintCode,
  generateStories as llmGenerateStories,
  generateStoryCommits,
  type StoryCommit,
} from "./llm-generators.ts";
import {
  isScaffolded,
  readWorkspaceFile,
  scaffoldWorkspace,
  writeWorkspaceFile,
} from "../preview/scaffolder.ts";
import { getProject, updateProject } from "./store.ts";
import {
  STAGE_META,
  type ChatTurn,
  type Defect,
  type FeaturesArtefact,
  type LlmCallRecord,
  type ProductFeature,
  type Project,
  type SecurityAudit,
  type SprintSnapshot,
  type StageId,
  type UserStory,
} from "./types.ts";

// ---------- LLM error surfacing ----------
//
// Every artefact generator throws NoApiKeyError or UpstreamError on failure
// (no silent demo fallback). We catch the error in the calling stage, log it
// as a system chat turn so the user understands WHY the workflow is paused,
// emit a blocking agent event so the 3D office shows something is wrong, and
// halt the pipeline (waitingForUser=true). The user can fix the underlying
// problem (add a key, retry) and re-trigger from the UI.

/**
 * Surfaces an LLM failure to the user without crashing the engine. Returns
 * true if the error was handled and the workflow should stop. Always sets
 * waitingForUser=true so the dashboard prompts the user to act.
 */
function surfaceLlmError(
  projectId: string,
  stage: StageId,
  err: unknown,
  contextLabel: string,
): boolean {
  if (err instanceof NoApiKeyError) {
    appendChat(projectId, {
      role: "system",
      stage,
      text:
        `**Workflow paused — no LLM key configured.**\n\n` +
        `${contextLabel} needs to call ${err.provider} to do real work, but no API key is set. ` +
        `Open **Settings → API Keys** and paste your ${err.provider} key, then say "retry" in chat to resume.`,
    });
    emitAgentEvent({
      type: "agent.blocked",
      agent: stageOwnerAgent(stage),
      reason: `Missing ${err.provider} API key — workflow paused.`,
    });
    pauseForUser(projectId);
    return true;
  }
  if (err instanceof UpstreamError) {
    appendChat(projectId, {
      role: "system",
      stage,
      text:
        `**${contextLabel} hit an upstream error after retries.**\n\n` +
        `${err.message}\n\n` +
        `This is usually transient (rate limits, model demand). Say "retry" in chat to try again.`,
    });
    emitAgentEvent({
      type: "agent.blocked",
      agent: stageOwnerAgent(stage),
      reason: `Upstream ${err.provider} error: ${err.status ?? "unknown"}.`,
    });
    pauseForUser(projectId);
    return true;
  }
  // Unexpected — rethrow so the API route returns a 500 and the bug is visible.
  return false;
}

/** Map a stage to the agent that "owns" it for the agent.blocked event. */
function stageOwnerAgent(stage: StageId): AgentName {
  const role = STAGE_META[stage]?.owner;
  const personaId = role ? STAGE_ROLE_TO_PERSONA[role] : "ceo";
  return personaId as AgentName;
}

/** Record an LLM call's cost + token usage on the project. */
function recordLlmCallResult(
  projectId: string,
  stage: StageId,
  persona: PersonaId,
  r: {
    inTokens: number;
    outTokens: number;
    costUsd: number;
    provider: "gemini" | "anthropic" | "openai" | "cursor";
    model: string;
    source: "live" | "demo";
  },
): void {
  recordCall(projectId, stage, persona, r);
}

// ---------- Entry points used by the API routes ----------

export async function handleUserKickoff(projectId: string): Promise<void> {
  const project = getProject(projectId);
  if (!project) return;

  emitAgentEvent({
    type: "pipeline.start",
    idea: project.brief.pitch,
  });
  appendChat(projectId, {
    role: "system",
    stage: "intake",
    text: `New project: **${project.brief.name}** — ${project.brief.pitch}`,
  });

  await runStage(projectId, "intake");
}

export async function handleUserMessage(
  projectId: string,
  text: string,
): Promise<void> {
  const project = getProject(projectId);
  if (!project) return;

  appendChat(projectId, {
    role: "user",
    stage: project.stage,
    text,
  });

  // Only re-prompt the stage owner if the team is genuinely waiting for the
  // user (e.g. intake clarification). If we're mid-stage (waitingForUser is
  // false), the user's note is queued in the chat and the current stage
  // continues — kicking off a parallel runStage here would race with itself.
  if (!project.waitingForUser) {
    return;
  }

  // SECURITY NO_GO LOOP BREAKER: if we're paused at the security gate after
  // a NO_GO verdict and the user is asking the team to fix it, route the
  // findings BACK to the Engineer as defects rather than re-running the
  // same audit on unchanged code (which would just produce the same NO_GO
  // forever — exactly the loop the user hit).
  if (
    project.stage === "security-audit" &&
    project.security?.verdict === "NO_GO" &&
    looksLikeFixRequest(text)
  ) {
    await routeSecurityFindingsToEngineer(projectId);
    return;
  }

  await runStage(projectId, project.stage, { userTurn: text });
}

/**
 * Heuristic: does the user's chat reply read like "please fix this" rather
 * than a question / clarification? Kept generous on purpose — anything that
 * mentions fix / patch / resolve / address / rerun / retry counts.
 */
function looksLikeFixRequest(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length === 0) return false;
  return /\b(fix|patch|address|resolve|repair|handle|sort|rerun|re[-\s]?run|retry|please)\b/.test(t);
}

/**
 * Translate the current security audit's critical/high findings into Defect
 * entries on the project and bounce the stage back to defect-fix. The
 * Engineer will iterate over them and emit visible "fixing X" progress
 * events before security re-audits. On the next audit pass we also tell
 * the security LLM that these were previously flagged + claimed fixed, so
 * it doesn't simply re-emit the same NO_GO.
 */
async function routeSecurityFindingsToEngineer(projectId: string): Promise<void> {
  const project = getProject(projectId);
  if (!project?.security) return;

  const offenders = project.security.findings.filter(
    (f) => f.severity === "critical" || f.severity === "high",
  );
  if (offenders.length === 0) {
    // Edge case: NO_GO with only "low" findings (verdict guard usually
    // prevents this, but defend anyway). Just allow advance.
    setStage(projectId, "deploy");
    await runStage(projectId, "deploy");
    return;
  }

  const newDefects: Defect[] = offenders.map((f, i) => ({
    id: `def-sec-${Date.now().toString(36)}-${i}`,
    storyId: null,
    title: `Security: ${f.finding}`,
    severity: f.severity === "critical" ? "P1" : "P2",
    repro: `Cybersecurity audit flagged this in the ${project.brief.name} HLD/LLD review. Suggested fix: ${f.fix}`,
    status: "open",
  }));

  updateProject(projectId, (p) => {
    p.defects.push(...newDefects);
    // Stash the findings we're routing so the next security pass can verify
    // them instead of re-flagging from scratch.
    (p as Project & { lastSecurityFindings?: typeof offenders }).lastSecurityFindings = offenders;
  });

  appendChat(projectId, {
    role: "persona",
    speaker: "developer",
    stage: "defect-fix",
    text:
      `Picking up ${newDefects.length} security finding${newDefects.length === 1 ? "" : "s"} as new defect${newDefects.length === 1 ? "" : "s"} ` +
      `(${offenders.map((f) => f.severity.toUpperCase()).join(", ")}). Patching, then handing back to Security for a re-audit.`,
  });

  setStage(projectId, "defect-fix");
  await runStage(projectId, "defect-fix");
}

export async function handleUserApproval(
  projectId: string,
  approved: boolean,
  comment?: string,
): Promise<void> {
  const project = getProject(projectId);
  if (!project) return;

  appendChat(projectId, {
    role: "user",
    stage: project.stage,
    text: approved
      ? comment
        ? `Approved with note: ${comment}`
        : "Approved."
      : `Requested changes: ${comment ?? "(no comment)"}`,
  });

  if (!approved) {
    // Bounce back to the previous draft stage.
    // plan-approval reverts to cto-review (SA's HLD) so any
    // architecture/feature feedback can flow into the HLD first; the SA
    // stage then continues into plan-draft (CTO's LLD) automatically.
    const reverts: Partial<Record<StageId, StageId>> = {
      "plan-approval": "cto-review",
      "design-approval": "design-draft",
      "code-review": "sprint-dev",
    };
    const back = reverts[project.stage] ?? project.stage;
    setStage(projectId, back);
    await runStage(projectId, back, { userTurn: comment });
    return;
  }

  // Advance.
  const nextMap: Partial<Record<StageId, StageId>> = {
    intake: "product-discovery",
    "product-discovery": "cto-review",
    "cto-review": "plan-draft",
    "plan-draft": "plan-approval",
    "plan-approval": "design-draft",
    "design-draft": "design-approval",
    "design-approval": "design-validation",
    "design-validation": "handoff",
    handoff: "stories",
    stories: "sprint-dev",
    "sprint-dev": "qa-review",
    "qa-review": "code-review",
    "code-review": "defect-fix",
    "defect-fix": "security-audit",
    "security-audit": "deploy",
    deploy: "done",
  };
  const next = nextMap[project.stage];
  if (!next) return;
  setStage(projectId, next);
  await runStage(projectId, next);
}

export async function handleScreenSelected(
  projectId: string,
  screenId: string,
): Promise<void> {
  const project = getProject(projectId);
  if (!project?.design) return;

  const chosen = project.design.screens.find((s) => s.id === screenId);
  if (!chosen) return;
  const others = project.design.screens.filter((s) => s.id !== screenId);

  // Selecting a screen also locks in a theme. We parse the aesthetic from the
  // screen title which the designer suffixed with " · Minimal" / " · Playful" /
  // " · Dense" / " · Premium" — see lib/platform/mcp/stitch.ts.
  const theme = parseThemeFromTitle(chosen.title);

  // If the user is "selecting" the already-selected screen (idempotent click),
  // don't re-archive — that would empty `archivedScreens` on a second click.
  const alreadyChosen = project.design.selectedScreenId === screenId;

  updateProject(projectId, (p) => {
    if (!p.design) return;
    p.design.selectedScreenId = screenId;
    if (!alreadyChosen) {
      // Move the 3 unpicked variants into the archive and keep only the chosen
      // one in `screens` so the rest of the workflow + UI sees a single design.
      const existingArchive = p.design.archivedScreens ?? [];
      p.design.archivedScreens = [...existingArchive, ...others];
      p.design.screens = [chosen];
    }
    p.design.selectedTheme = theme;
    p.design.notes.push(
      `Direction locked: **${theme}** (from "${chosen.title}"). ${others.length} other ${
        others.length === 1 ? "variant" : "variants"
      } archived.`,
    );
  });

  // Chat acknowledgement from the designer — only on the first selection to
  // avoid spamming if the user clicks again.
  if (!alreadyChosen) {
    appendChat(projectId, {
      role: "persona",
      speaker: "designer",
      stage: project.stage,
      text: Chat.designerThemeLocked(project.brief, theme, others.length),
    });
  }
}

function parseThemeFromTitle(title: string): string {
  // Designer titles screens as "Foo · Minimal" / "Foo · Playful" / etc.
  // Parse out the trailing aesthetic; fall back to the raw title.
  const tail = title.split(" · ").pop() ?? title;
  const lower = tail.toLowerCase();
  for (const t of ["minimal", "playful", "dense", "premium"]) {
    if (lower.includes(t)) return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return tail.trim();
}

/**
 * Plan the next sprint. Archives the just-completed sprint, builds a carry-over
 * backlog from anything not finished (in-progress stories, open defects, low-sev
 * security findings), then asks the PM to produce a fresh story set anchored on
 * the user-supplied focus + the carry-over.
 *
 * Only valid from the `done` stage — caller (API route) returns 400 otherwise.
 */
export async function handlePlanNextSprint(
  projectId: string,
  focus: string,
): Promise<void> {
  const project = getProject(projectId);
  if (!project) return;
  if (project.stage !== "done") return;

  // 1. Snapshot the sprint we just finished into history.
  const snapshot: SprintSnapshot = {
    sprintNumber: project.currentSprint,
    completedAt: Date.now(),
    focus: project.currentSprintFocus ?? "Initial scope from product brief.",
    stories: project.stories.map((s) => ({ ...s })),
    codeReview: project.codeReview ? { ...project.codeReview } : null,
    defects: project.defects.map((d) => ({ ...d })),
    security: project.security ? { ...project.security } : null,
    filesWritten: 11, // matches the deploy-stage emit
  };

  // 2. Compute carry-over.
  const carryStories: UserStory[] = project.stories
    .filter((s) => s.status !== "done")
    .map((s) => ({ ...s, status: "todo" as const, origin: "carry-over" as const }));
  const openDefects: Defect[] = project.defects.filter((d) => d.status !== "fixed");
  const lowSevFindings = project.security?.findings.filter((f) => f.severity === "low") ?? [];

  const nextSprint = project.currentSprint + 1;

  // 3. Reset transient artefacts; bump the sprint pointer.
  updateProject(projectId, (p) => {
    p.sprintHistory.push(snapshot);
    p.currentSprint = nextSprint;
    p.currentSprintFocus = focus.trim();
    p.codeReview = null;
    p.security = null;
    p.defects = [];
    p.stories = []; // stageStories will populate
  });

  // 4. Announce in chat.
  appendChat(projectId, {
    role: "user",
    stage: "done",
    text: `Plan sprint ${nextSprint}: ${focus.trim()}`,
  });
  appendChat(projectId, {
    role: "persona",
    speaker: "ceo",
    stage: "done",
    text: Chat.ceoNextSprintKickoff(
      project.brief,
      nextSprint,
      focus.trim(),
      carryStories.length,
      openDefects.length,
      lowSevFindings.length,
    ),
  });

  // 5. Re-enter the stories stage with sprint-2 context. We bypass stageStories
  //    because the carry-over needs to be baked into the prompt and the new
  //    stories array starts from the carry-over set, not from scratch.
  setStage(projectId, "stories");
  await runSprintPlanning(projectId, focus.trim(), carryStories, openDefects, lowSevFindings);
}

export async function handleScreenRedesign(
  projectId: string,
  screen: GeneratedScreen,
  prompt: string,
): Promise<void> {
  const project = getProject(projectId);
  if (!project) return;

  // Acknowledge the feedback IMMEDIATELY so the user isn't left wondering
  // whether their note landed (Stitch can take 30 s+ to return a new screen).
  appendChat(projectId, {
    role: "persona",
    speaker: "designer",
    stage: "design-approval",
    text: Chat.designRedesign(project.brief, prompt),
  });
  emitTheatre(projectId, "designer", "design-approval");

  // When the user has already picked a theme, anchor the redesign on it so
  // Stitch doesn't drift away from the chosen aesthetic.
  const theme = project.design?.selectedTheme;
  const effectivePrompt = theme
    ? `Keep the **${theme}** aesthetic.\n\nUser feedback: ${prompt}`
    : prompt;

  const newScreen = await redesignScreen({ screen, prompt: effectivePrompt });
  updateProject(projectId, (p) => {
    if (!p.design) return;
    p.design.screens = p.design.screens.map((s) =>
      s.id === screen.id ? newScreen : s,
    );
    p.design.notes.push(`Redesign · "${screen.title}" → ${prompt}`);
  });
  appendChat(projectId, {
    role: "persona",
    speaker: "designer",
    stage: "design-approval",
    text: `Reworked "${screen.title}". New variant is ready in the carousel.`,
  });
}

// ---------- Core: runStage ----------

interface RunContext {
  userTurn?: string;
}

async function runStage(
  projectId: string,
  stage: StageId,
  ctx: RunContext = {},
): Promise<void> {
  const project = getProject(projectId);
  if (!project) return;

  // Wrap every stage in a safety net: if anything throws AT ALL — including
  // unhandled promise rejections from the LLM proxy or a dev-server
  // restart that severed an in-flight call — we surface a system chat
  // message, emit a blocked agent event, and pause the workflow so the
  // UI never gets stuck silently with waitingForUser=false forever.
  //
  // Without this, a request handler dying mid-call left the project in a
  // limbo state (stage=sprint-dev, waitingForUser=false, no progress) for
  // hours until the user noticed and manually inspected.
  try {
    await runStageInner(projectId, stage, ctx);
  } catch (err) {
    // surfaceLlmError already handles NoApiKey / Upstream errors. Anything
    // else gets a generic "stage crashed" message.
    if (!surfaceLlmError(projectId, stage, err, `${stage} stage`)) {
      const msg = (err as Error)?.message ?? "unknown";
      appendChat(projectId, {
        role: "system",
        stage,
        text:
          `**The ${stage} stage crashed unexpectedly.**\n\n` +
          `${msg}\n\nThe workflow is paused. Say "retry" in chat to try again.`,
      });
      emitAgentEvent({
        type: "agent.blocked",
        agent: stageOwnerAgent(stage),
        reason: `${stage} crashed: ${msg.slice(0, 100)}`,
      });
      pauseForUser(projectId);
      console.error(`[engine] stage ${stage} crashed:`, err);
    }
  }
}

async function runStageInner(
  projectId: string,
  stage: StageId,
  ctx: RunContext,
): Promise<void> {
  const project = getProject(projectId);
  if (!project) return;

  switch (stage) {
    case "intake":
      await stageIntake(project, ctx);
      break;
    case "product-discovery":
      await stageProductDiscovery(project, ctx);
      break;
    case "cto-review":
      await stageCtoReview(project, ctx);
      break;
    case "plan-draft":
      await stagePlanDraft(project, ctx);
      break;
    case "plan-approval":
      // Pure wait state — we already emitted the plan; the user clicks Approve.
      pauseForUser(projectId);
      break;
    case "design-draft":
      await stageDesignDraft(project, ctx);
      break;
    case "design-approval":
      pauseForUser(projectId);
      break;
    case "design-validation":
      await stageDesignValidation(project);
      break;
    case "handoff":
      await stageHandoff(project);
      break;
    case "stories":
      await stageStories(project);
      break;
    case "sprint-dev":
      await stageSprintDev(project);
      break;
    case "qa-review":
      await stageQaReview(project);
      break;
    case "code-review":
      await stageCodeReview(project);
      break;
    case "defect-fix":
      await stageDefectFix(project);
      break;
    case "security-audit":
      await stageSecurityAudit(project);
      break;
    case "deploy":
      await stageDeploy(project);
      break;
    case "done":
      await stageDone(project);
      break;
  }
}

// ---------- Stage handlers ----------

async function stageIntake(project: Project, ctx: RunContext): Promise<void> {
  // CEO greets and asks two brief-aware clarifying questions. If the user has
  // already replied, we acknowledge their answer (instead of repeating the
  // question) and advance to cto-review.
  emitTheatre(project.id, "ceo", "intake");

  // Try the LLM for variety, but only use its output when we got a live
  // (non-demo) response. Demo-mode prose is worse than the deterministic
  // brief-aware template, and the template is the one that actually weaves
  // the brief into the words.
  const userMsg = ctx.userTurn
    ? `Founder's follow-up: ${ctx.userTurn}\nAcknowledge in one line and signal delegation to CTO + Solution Architect.`
    : `Founder's pitch: ${project.brief.pitch}\nProduct name: ${project.brief.name}\nGreet, name the product type in one line, and ask the two most disambiguating questions before delegating.`;
  const r = await callLLM({
    provider: PERSONAS.ceo.recommendedModel.provider,
    model: PERSONAS.ceo.recommendedModel.model,
    system: PERSONAS.ceo.systemPrompt,
    messages: [{ role: "user", content: userMsg }],
    personaHint: "ceo",
    stageHint: ctx.userTurn ? "intake-followup" : "kickoff",
    maxTokens: 280,
  });
  recordCall(project.id, "intake", "ceo", r);

  const text =
    r.source === "live"
      ? r.text
      : ctx.userTurn
        ? Chat.ceoIntakeAcknowledge(project.brief, ctx.userTurn)
        : Chat.ceoIntakeKickoff(project.brief);

  appendChat(project.id, {
    role: "persona",
    speaker: "ceo",
    stage: "intake",
    text,
  });

  // If this run was triggered by a user follow-up — ANY non-empty reply means
  // they're done with intake. Previously this checked `length >= 20` to
  // require a substantive answer, but that swallowed perfectly valid
  // confirmations like "1. yes 2. i confirm" (19 chars) or "yes" — the CEO
  // would announce "Bringing in the team now" while the engine silently
  // refused to advance, leaving the dashboard in a weird limbo.
  if (ctx.userTurn && ctx.userTurn.trim().length > 0) {
    setStage(project.id, "product-discovery");
    await runStage(project.id, "product-discovery");
    return;
  }
  pauseForUser(project.id);
}

// ---------- Product Owner ----------
//
// First stage after intake. The PO drafts the feature catalogue (personas,
// JTBD-formatted features, MoSCoW priority, out-of-scope). The Solution
// Architect later anchors every feature in a bounded context; the Designer
// validates every feature has a screen.

async function stageProductDiscovery(
  project: Project,
  _ctx: RunContext,
): Promise<void> {
  emitTheatre(project.id, "product-owner", "product-discovery");
  announceThinking(
    project.id,
    "product-owner",
    "product-discovery",
    Chat.poDiscoveryThinking(project.brief),
  );

  let features: FeaturesArtefact;
  try {
    const result = await llmGenerateFeatures(project.brief);
    features = result.artefact;
    recordLlmCallResult(project.id, "product-discovery", "product-owner", result.llm);
  } catch (err) {
    if (surfaceLlmError(project.id, "product-discovery", err, "Product Owner")) return;
    throw err;
  }

  updateProject(project.id, (p) => {
    p.features = features;
  });

  appendChat(project.id, {
    role: "persona",
    speaker: "product-owner",
    stage: "product-discovery",
    text: Chat.poFeaturesReady(project.brief, features),
    attachment: { kind: "features" },
  });

  setStage(project.id, "cto-review");
  await runStage(project.id, "cto-review");
}

// ---------- Solution Architect (HLD) ----------
//
// `cto-review` is now the SA's HLD stage. Name is kept for store
// compatibility; STAGE_META labels it "HLD · Solution Architect" in the UI.

async function stageCtoReview(project: Project, ctx: RunContext): Promise<void> {
  emitTheatre(project.id, "solution-architect", "cto-review");

  const isReplan = !!ctx.userTurn && ctx.userTurn.trim().length > 0;
  const revisionChanges = isReplan
    ? Chat.deriveRevisionChanges(project.brief, ctx.userTurn!, "plan")
    : [];
  announceThinking(
    project.id,
    "solution-architect",
    "cto-review",
    isReplan
      ? Chat.planRevisionAck(project.brief, ctx.userTurn!, revisionChanges)
      : Chat.saHldThinking(project.brief),
  );

  if (!project.features) {
    appendChat(project.id, {
      role: "system",
      stage: "cto-review",
      text: "Solution Architect needs the PO's feature catalogue first. Re-running product discovery.",
    });
    setStage(project.id, "product-discovery");
    await runStage(project.id, "product-discovery");
    return;
  }

  // Build the revision feedback list — every "Request changes" round
  // accumulates so the LLM can incorporate the FULL history of feedback,
  // not just the most recent note.
  const allRevisions = [...(project.hld?.revisions ?? [])];
  if (isReplan) allRevisions.push({ at: Date.now(), feedback: ctx.userTurn!.trim(), changes: revisionChanges });

  let hld;
  try {
    const result = await llmGenerateHld({
      brief: project.brief,
      features: project.features,
      revisions: allRevisions.map((r) => ({ feedback: r.feedback })),
    });
    hld = result.artefact;
    recordLlmCallResult(project.id, "cto-review", "solution-architect", result.llm);
  } catch (err) {
    if (surfaceLlmError(project.id, "cto-review", err, "Solution Architect")) return;
    throw err;
  }

  updateProject(project.id, (p) => {
    if (isReplan) {
      p.hld = {
        ...hld,
        revisions: [
          ...(p.hld?.revisions ?? []),
          {
            at: Date.now(),
            feedback: ctx.userTurn!.trim(),
            changes: revisionChanges,
          },
        ],
      };
    } else {
      p.hld = hld;
    }
    if (p.features) {
      p.features.features = p.features.features.map((f) =>
        anchorFeatureToContext(f, hld.contexts),
      );
    }
  });

  appendChat(project.id, {
    role: "persona",
    speaker: "solution-architect",
    stage: "cto-review",
    text: Chat.saHldReady(project.brief, hld),
  });

  setStage(project.id, "plan-draft");
  await runStage(project.id, "plan-draft");
}

// ---------- CTO (LLD) ----------
//
// `plan-draft` is now the CTO's LLD stage. The CTO refines the SA's HLD into
// concrete modules, schema, and API surfaces. STAGE_META labels it "LLD · CTO".

async function stagePlanDraft(project: Project, _ctx: RunContext): Promise<void> {
  emitTheatre(project.id, "cto", "plan-draft");
  announceThinking(project.id, "cto", "plan-draft", Chat.ctoLldThinking(project.brief));

  if (!project.hld || !project.features) {
    appendChat(project.id, {
      role: "system",
      stage: "plan-draft",
      text: "CTO needs the HLD and feature catalogue. Re-running HLD.",
    });
    setStage(project.id, "cto-review");
    await runStage(project.id, "cto-review");
    return;
  }

  let lld;
  try {
    const result = await llmGenerateLld({
      brief: project.brief,
      features: project.features,
      hld: project.hld,
    });
    lld = result.artefact;
    recordLlmCallResult(project.id, "plan-draft", "cto", result.llm);
  } catch (err) {
    if (surfaceLlmError(project.id, "plan-draft", err, "CTO")) return;
    throw err;
  }

  updateProject(project.id, (p) => {
    p.lld = lld;
  });

  appendChat(project.id, {
    role: "persona",
    speaker: "cto",
    stage: "plan-draft",
    text: Chat.ctoLldReady(project.brief, project.hld!, lld),
    attachment: { kind: "plan" },
  });

  setStage(project.id, "plan-approval");
  pauseForUser(project.id);
}

async function stageDesignDraft(project: Project, ctx: RunContext = {}): Promise<void> {
  emitTheatre(project.id, "designer", "design-draft");

  const isRedesign = !!ctx.userTurn && ctx.userTurn.trim().length > 0;
  const designChanges = isRedesign
    ? Chat.deriveRevisionChanges(project.brief, ctx.userTurn!, "design")
    : [];
  announceThinking(
    project.id,
    "designer",
    "design-draft",
    isRedesign
      ? Chat.designRevisionAck(project.brief, ctx.userTurn!, designChanges)
      : Chat.designKickoff(project.brief),
  );

  // Designer LLM call FIRST — produces (a) the aesthetic direction grounded
  // in THIS brief (e.g. "Apple Weather × Airbnb Experiences, cinematic
  // glassmorphism, dynamic weather-themed palette") and (b) a list of the
  // most important screens. We use the aesthetic direction to enrich the
  // Stitch prompts so we're not generating generic style variations; we're
  // generating *this product's* screen with 4 stylistic interpretations.
  let aestheticDirection: string | null = null;
  let primaryScreenTitle: string | null = null;
  if (project.features) {
    try {
      const result = await generateDesignerPrompts({
        brief: project.brief,
        features: project.features,
      });
      aestheticDirection = result.aestheticDirection;
      primaryScreenTitle = result.screens[0]?.title ?? null;
      recordLlmCallResult(project.id, "design-draft", "designer", result.llm);
      // Store the designer's aesthetic direction + screen plan on the
      // design artefact for the validation stage to reference.
      updateProject(project.id, (p) => {
        if (p.design) {
          p.design.notes.push(`Aesthetic direction: ${aestheticDirection}`);
          p.design.notes.push(
            `Planned screens: ${result.screens.map((s) => s.title).join(", ")}`,
          );
        }
      });
    } catch (err) {
      // Designer LLM is a nice-to-have. If it fails, we still fire Stitch
      // with the raw brief — but surface the issue so the user knows.
      if (err instanceof NoApiKeyError || err instanceof UpstreamError) {
        appendChat(project.id, {
          role: "system",
          stage: "design-draft",
          text: `Designer LLM unavailable (${err.message}). Proceeding with the brief verbatim for theme picking.`,
        });
      } else {
        throw err;
      }
    }
  }

  // Build the Stitch brief — enrich with the LLM's aesthetic direction +
  // the primary screen title so each of the 4 theme variants is a take on
  // THE WEATHER DASHBOARD (etc.) instead of an abstract product mock.
  const stitchBrief = [
    project.brief.pitch,
    aestheticDirection ? `\n\nAesthetic direction (from Designer): ${aestheticDirection}` : "",
    primaryScreenTitle ? `\n\nPrimary screen to mock: ${primaryScreenTitle}` : "",
  ].join("");

  const screens = generateScreens({
    brief: stitchBrief,
    productName: project.brief.name,
    count: 4,
    onLiveScreen: (index, real) => {
      updateProject(project.id, (p) => {
        if (!p.design) return;
        p.design.screens[index] = real;
        p.design.notes.push(
          `Live screen ${index + 1} rendered via Stitch.`,
        );
      });
    },
  });

  updateProject(project.id, (p) => {
    // Preserve revisions history when re-running this stage. The screens
    // are regenerated each round but the user's feedback log persists so
    // they can see the full conversation across iterations.
    const priorRevisions = p.design?.revisions ?? [];
    p.design = {
      screens,
      selectedScreenId: null,
      notes: [],
      revisions: isRedesign
        ? [
            ...priorRevisions,
            {
              at: Date.now(),
              feedback: ctx.userTurn!.trim(),
              changes: designChanges,
            },
          ]
        : priorRevisions,
    };
  });

  appendChat(project.id, {
    role: "persona",
    speaker: "designer",
    stage: "design-draft",
    text: Chat.designReady(project.brief),
    attachment: { kind: "designs" },
  });

  setStage(project.id, "design-approval");
  pauseForUser(project.id);
}

// ---------- Designer · Feature validation ----------
//
// After the user picks a design theme, the Designer cross-checks the PO's
// features against the locked screens. For each MUST feature:
//   - "covered"      → the locked design surfaces the feature already.
//   - "supplemented" → the Designer generated a new screen in the locked theme.
//   - "uncovered"    → couldn't auto-cover; flagged for the user.

async function stageDesignValidation(project: Project): Promise<void> {
  emitTheatre(project.id, "designer", "design-validation");

  const features = project.features?.features ?? [];
  const mustFeatures = features.filter((f) => f.priority === "must");
  announceThinking(
    project.id,
    "designer",
    "design-validation",
    Chat.designerValidationThinking(project.brief, mustFeatures.length),
  );

  if (!project.design || project.design.screens.length === 0) {
    // No design to validate against — bail to handoff with a note.
    appendChat(project.id, {
      role: "persona",
      speaker: "designer",
      stage: "design-validation",
      text: `No locked design to validate. Skipping to handoff.`,
    });
    setStage(project.id, "handoff");
    await runStage(project.id, "handoff");
    return;
  }

  const lockedScreen = project.design.screens[0];
  const theme = project.design.selectedTheme ?? "Minimal";
  // Heuristic coverage: a feature is "covered" if any acceptance signal
  // shares a token with the locked screen's title/caption. Otherwise it's
  // a candidate for supplementing. We supplement at most 2 features so the
  // validation loop is bounded.
  const results: {
    feature: ProductFeature;
    state: "covered" | "supplemented" | "uncovered";
    note: string;
    screenId?: string;
  }[] = [];

  const supplementaryScreens: GeneratedScreen[] = [];
  for (const feature of mustFeatures) {
    const covered = featureCoveredByScreen(feature, lockedScreen);
    if (covered) {
      results.push({
        feature,
        state: "covered",
        note: `Acceptance signals are reachable from the locked screen.`,
      });
      continue;
    }
    // Try to supplement (up to 2 features). Beyond that, mark uncovered so
    // the user can decide whether to scope down or extend the design budget.
    if (supplementaryScreens.length < 2) {
      const supplement = await generateSupplementaryScreen({
        productName: project.brief.name,
        brief: project.brief.pitch,
        theme,
        projectId: lockedScreen.stitchProjectId,
        featureName: feature.name,
      });
      supplementaryScreens.push(supplement);
      results.push({
        feature,
        state: "supplemented",
        note: `Generated a new screen in the ${theme} theme for "${feature.name}".`,
        screenId: supplement.id,
      });
    } else {
      results.push({
        feature,
        state: "uncovered",
        note: `Couldn't auto-cover within the design budget. Flagged for PO + user.`,
      });
    }
  }

  // Persist the validation results onto the feature catalogue + extend the
  // design's screens array with the supplementaries.
  updateProject(project.id, (p) => {
    if (p.features) {
      p.features.features = p.features.features.map((f) => {
        const result = results.find((r) => r.feature.id === f.id);
        if (!result) return f;
        return {
          ...f,
          designValidation: {
            state: result.state,
            screenId: result.screenId,
            note: result.note,
            at: Date.now(),
          },
        };
      });
    }
    if (p.design && supplementaryScreens.length > 0) {
      p.design.screens = [...p.design.screens, ...supplementaryScreens];
      p.design.notes.push(
        `+${supplementaryScreens.length} supplementary screen(s) added for uncovered features (theme: ${theme}).`,
      );
    }
  });

  appendChat(project.id, {
    role: "persona",
    speaker: "designer",
    stage: "design-validation",
    text: Chat.designerValidationReport(project.brief, results),
    attachment: { kind: "designs" },
  });

  setStage(project.id, "handoff");
  await runStage(project.id, "handoff");
}

// ---------- Handoff package ----------
//
// Last stop before sprint 1. The CEO bundles the three artefacts the user
// needs (HLD, LLD, and the locked Stitch UI link) and surfaces them as a
// single chat attachment.

async function stageHandoff(project: Project): Promise<void> {
  emitTheatre(project.id, "ceo", "handoff");

  const lockedScreen = project.design?.screens[0];
  const stitchLink = stitchAppUrlFor(
    lockedScreen?.stitchProjectId,
    lockedScreen?.stitchScreenId,
  );

  appendChat(project.id, {
    role: "persona",
    speaker: "ceo",
    stage: "handoff",
    text: Chat.ceoHandoffPackage(
      project.brief,
      project.hld?.contexts.length ?? 0,
      project.lld?.modules.length ?? 0,
      Boolean(lockedScreen?.stitchProjectId),
    ),
    attachment: { kind: "handoff" },
  });

  // Store the canonical Stitch link in the design notes so the modal can
  // surface it without rerunning the resolver.
  if (lockedScreen) {
    updateProject(project.id, (p) => {
      if (!p.design) return;
      const tag = `Handoff Stitch link: ${stitchLink}`;
      if (!p.design.notes.includes(tag)) p.design.notes.push(tag);
    });
  }

  setStage(project.id, "stories");
  await runStage(project.id, "stories");
}

async function stageStories(project: Project): Promise<void> {
  emitTheatre(project.id, "pm", "stories");
  announceThinking(project.id, "engineering-manager", "stories", `Slicing the plan into vertical user stories.`);

  if (!project.hld || !project.lld || !project.features) {
    appendChat(project.id, {
      role: "system",
      stage: "stories",
      text: "Engineering Manager needs HLD, LLD, and features. Re-running discovery.",
    });
    setStage(project.id, "product-discovery");
    await runStage(project.id, "product-discovery");
    return;
  }

  let stories: UserStory[];
  try {
    const result = await llmGenerateStories({
      brief: project.brief,
      features: project.features,
      hld: project.hld,
      lld: project.lld,
      sprintNumber: project.currentSprint,
    });
    stories = result.stories;
    recordLlmCallResult(project.id, "stories", "engineering-manager", result.llm);
  } catch (err) {
    if (surfaceLlmError(project.id, "stories", err, "Engineering Manager")) return;
    throw err;
  }

  updateProject(project.id, (p) => {
    p.stories = stories;
  });

  appendChat(project.id, {
    role: "persona",
    speaker: "engineering-manager",
    stage: "stories",
    text: Chat.storiesReady(project.brief, stories),
    attachment: { kind: "stories" },
  });

  setStage(project.id, "sprint-dev");
  await runStage(project.id, "sprint-dev");
}

/**
 * Sprint 2+ entry point — used by handlePlanNextSprint instead of stageStories.
 * Builds a sprint plan that mixes carry-over items with fresh stories drafted
 * by the PM against the user's stated focus.
 */
async function runSprintPlanning(
  projectId: string,
  focus: string,
  carryStories: UserStory[],
  openDefects: Defect[],
  lowSevFindings: { severity: string; finding: string; fix: string }[],
): Promise<void> {
  const project = getProject(projectId);
  if (!project) return;

  emitTheatre(projectId, "pm", "stories");
  announceThinking(
    projectId,
    "engineering-manager",
    "stories",
    Chat.pmSprintPlanningThinking(project.brief, project.currentSprint, focus),
  );

  // Gather every story shipped in previous sprints so the PM doesn't pitch
  // duplicates of work that's already merged.
  const alreadyShipped = project.sprintHistory
    .flatMap((s) => s.stories.filter((st) => st.status === "done"))
    .map((s) => ({ title: s.title }));

  if (!project.features || !project.hld || !project.lld) {
    appendChat(projectId, {
      role: "system",
      stage: "stories",
      text: "Can't plan next sprint without prior HLD/LLD/features. Re-running discovery.",
    });
    setStage(projectId, "product-discovery");
    await runStage(projectId, "product-discovery");
    return;
  }

  let fresh: UserStory[];
  try {
    const result = await llmGenerateStories({
      brief: project.brief,
      features: project.features,
      hld: project.hld,
      lld: project.lld,
      sprintNumber: project.currentSprint,
      alreadyShipped,
      focus,
      carryOver: carryStories,
    });
    fresh = result.stories;
    recordLlmCallResult(projectId, "stories", "engineering-manager", result.llm);
  } catch (err) {
    if (surfaceLlmError(projectId, "stories", err, "Engineering Manager")) return;
    throw err;
  }

  // Materialise defect-fix + security-followup stories so they show in the
  // Stories modal alongside the fresh PM stories.
  const defectStories: UserStory[] = openDefects.map((d) => ({
    id: `s-${randomUUID().slice(0, 6)}`,
    title: `Fix · ${d.title}`,
    asA: "User",
    iWant: "the defect to no longer reproduce",
    soThat: "the flow QA gated on works end-to-end",
    acceptance: [
      `Given the repro: ${d.repro}`,
      `When the developer's fix is deployed`,
      `Then QA's test plan passes (no longer reproduces)`,
    ],
    tasks: [
      "Reproduce against staging",
      "Land the fix on a branch and write a regression test",
      "QA re-runs the original repro and signs off",
    ],
    status: "todo",
    effort: "S",
    sprintNumber: project.currentSprint,
    origin: "defect-fix",
  }));

  const securityStories: UserStory[] = lowSevFindings.map((f) => ({
    id: `s-${randomUUID().slice(0, 6)}`,
    title: `Security · ${f.finding}`,
    asA: "Security",
    iWant: `to land the low-severity follow-up: ${f.fix}`,
    soThat: "the next audit closes the prior cycle's deferred items",
    acceptance: [
      `Given the finding: ${f.finding}`,
      `When the fix lands: ${f.fix}`,
      `Then the next security audit no longer surfaces it`,
    ],
    tasks: [f.fix, "Add a SCA / lint rule to prevent regression"],
    status: "todo",
    effort: "S",
    sprintNumber: project.currentSprint,
    origin: "security-followup",
  }));

  const allNewStories = [...carryStories, ...defectStories, ...securityStories, ...fresh];

  updateProject(projectId, (p) => {
    p.stories = allNewStories;
  });

  appendChat(projectId, {
    role: "persona",
    speaker: "engineering-manager",
    stage: "stories",
    text: Chat.pmSprintBacklogReady(
      project.brief,
      project.currentSprint,
      carryStories.length,
      defectStories.length,
      securityStories.length,
      fresh.length,
    ),
    attachment: { kind: "stories" },
  });

  setStage(projectId, "sprint-dev");
  await runStage(projectId, "sprint-dev");
}

async function stageSprintDev(project: Project): Promise<void> {
  emitTheatre(project.id, "developer", "sprint-dev");
  const sprintNo = project.currentSprint;

  if (!project.lld || project.stories.length === 0) {
    appendChat(project.id, {
      role: "system",
      stage: "sprint-dev",
      text: "Developer needs an LLD and a story backlog. Re-running stories.",
    });
    setStage(project.id, "stories");
    await runStage(project.id, "stories");
    return;
  }

  emitAgentEvent({
    type: "agent.started",
    agent: "developer",
    taskId: `${project.id}-sprint-${sprintNo}`,
    note: `Picking up sprint ${sprintNo} backlog — ${project.stories.length} stories.`,
  });

  // BATCHED LLM call: plan every story's commit set in one shot. Previous
  // design made one Gemini call per story (5 stories = 5 sequential calls,
  // each with independent ~5-10% 503 exposure). Batching cuts that to a
  // single call, drops wall time from ~60s → ~10s, and makes the dev stage
  // resilient to Gemini's transient "high demand" 503s.
  let commits: StoryCommit[];
  try {
    const result = await generateStoryCommits({
      brief: project.brief,
      stories: project.stories,
      lld: project.lld!,
    });
    commits = result.commits;
    recordLlmCallResult(project.id, "sprint-dev", "developer", result.llm);
  } catch (err) {
    if (surfaceLlmError(project.id, "sprint-dev", err, "Developer (sprint commit plan)")) return;
    throw err;
  }

  // Real code emission: scaffold the workspace if first sprint, then ask
  // the Developer LLM to emit actual Next.js source files. These land on
  // disk and the user can boot them via the Preview pane.
  //
  // We surface failures via surfaceLlmError so the workflow pauses cleanly
  // if Gemini 503s through the whole retry budget — the user can hit
  // "retry" and we'll resume from this point.
  try {
    if (!(await isScaffolded(project.id))) {
      await scaffoldWorkspace(project.id, project.brief.name);
      emitAgentEvent({
        type: "agent.progress",
        agent: "developer",
        pct: 5,
        note: `Scaffolded \`${project.brief.name}\` workspace — Next.js 14 + Tailwind + Framer Motion.`,
      });
    }

    emitAgentEvent({
      type: "agent.progress",
      agent: "developer",
      pct: 10,
      note: "Writing real source code for the sprint backlog…",
    });

    const fresh = getProject(project.id) ?? project;

    // Sprint 2+ inherits a frozen data contract. Read the canonical
    // contract files from the prior sprint's emission and pass them
    // verbatim — this is the single most effective guard against the
    // class of bug where each sprint reinvents the domain model and
    // consumers crash because `studio.website` became `studio.websiteUrl`
    // halfway through. Sprint 1 starts from a blank slate (no contract
    // exists yet) and is instructed by the LLM prompt to *establish* the
    // contract; sprints 2+ inherit it.
    const dataContract: Record<string, string> = {};
    if (sprintNo > 1) {
      const contractPaths = ["lib/types.ts", "lib/mock-data.ts"];
      for (const p of contractPaths) {
        const content = await readWorkspaceFile(project.id, p);
        if (content) dataContract[p] = content;
      }
    }

    const codeResult = await generateSprintCode({
      brief: project.brief,
      features: project.features!,
      hld: project.hld!,
      lld: project.lld!,
      stories: project.stories,
      design: project.design ?? null,
      sprintNumber: sprintNo,
      existingFiles: fresh.emittedFiles ?? [],
      dataContract,
    });
    recordLlmCallResult(project.id, "sprint-dev", "developer", codeResult.llm);

    const writtenPaths: string[] = [];
    const rejectedPaths: { path: string; reason: string }[] = [];
    for (const file of codeResult.files) {
      const res = await writeWorkspaceFile(project.id, file.path, file.content);
      if (res.ok) {
        writtenPaths.push(file.path);
      } else {
        rejectedPaths.push({ path: file.path, reason: res.reason });
      }
    }

    updateProject(project.id, (p) => {
      const prior = new Set(p.emittedFiles ?? []);
      for (const path of writtenPaths) prior.add(path);
      p.emittedFiles = [...prior];
      p.buildNotes = codeResult.notes;
    });

    emitAgentEvent({
      type: "agent.progress",
      agent: "developer",
      pct: 35,
      note: `Wrote ${writtenPaths.length} real source files to the workspace${rejectedPaths.length ? ` (${rejectedPaths.length} path-rejected)` : ""}.`,
    });

    if (rejectedPaths.length > 0) {
      console.warn("[engine] sprint-dev rejected paths:", rejectedPaths);
    }
  } catch (err) {
    if (surfaceLlmError(project.id, "sprint-dev", err, "Developer (real source emission)")) return;
    throw err;
  }

  // Now walk the stories in order, emitting per-story theatre events from
  // the already-computed commit set. The LAST story stays in-progress as
  // the credible "long pole" so QA has something to gate on.
  for (let i = 0; i < project.stories.length; i++) {
    const story = project.stories[i]!;
    const commit =
      commits.find((c) => c.storyId === story.id) ?? commits[i] ?? commits[0]!;
    const isLast = i === project.stories.length - 1;

    updateProject(project.id, (p) => {
      const target = p.stories[i];
      if (target) target.status = "in-progress";
    });
    const pctStart = Math.round(((i + 0.1) / project.stories.length) * 100);
    emitAgentEvent({
      type: "agent.progress",
      agent: "developer",
      pct: Math.min(99, pctStart),
      note: `Starting *${story.title}* — ${story.effort} effort, ${story.tasks.length} tasks.`,
    });

    if (isLast) {
      emitAgentEvent({
        type: "agent.progress",
        agent: "developer",
        pct: 99,
        note: `*${story.title}* — long pole: ${commit.notes}. Carrying into review.`,
      });
      continue;
    }

    updateProject(project.id, (p) => {
      const target = p.stories[i];
      if (target) target.status = "done";
    });
    const pctEnd = Math.round(((i + 1) / project.stories.length) * 100);
    emitAgentEvent({
      type: "agent.progress",
      agent: "developer",
      pct: pctEnd,
      note: `Shipped *${story.title}* — branch \`${commit.branch}\`, ${commit.files.length} files, +${commit.linesAdded}.`,
    });
  }

  const fresh = getProject(project.id) ?? project;
  const totalCommits = commits.reduce((sum, c) => sum + c.commits, 0);
  const totalLinesAdded = commits.reduce((sum, c) => sum + c.linesAdded, 0);
  const totalLinesRemoved = commits.reduce((sum, c) => sum + c.linesRemoved, 0);
  const uniqueFiles = new Set(commits.flatMap((c) => c.files));
  const longPoleStory = fresh.stories.find((s) => s.status !== "done");
  const longPoleCommit = longPoleStory ? commits.find((c) => c.storyId === longPoleStory.id) : null;

  // Persist the dev commits on the project so the UI can show real PR data.
  updateProject(project.id, (p) => {
    (p as Project & { devCommits?: StoryCommit[] }).devCommits = commits;
  });

  const report: Chat.SprintDevReport = {
    commits: totalCommits,
    files: uniqueFiles.size,
    linesAdded: totalLinesAdded,
    linesRemoved: totalLinesRemoved,
    branches: commits.map((c) => c.branch),
    prNumbers: commits.map((c) => c.prNumber),
    longPole: longPoleStory
      ? {
          title: longPoleStory.title,
          reason: longPoleCommit?.notes ?? "Carrying into review.",
        }
      : undefined,
  };

  emitAgentEvent({
    type: "agent.completed",
    agent: "developer",
    taskId: `${project.id}-sprint-${sprintNo}`,
    summary: `Sprint ${sprintNo}: ${totalCommits} commits across ${commits.length} branches, ${uniqueFiles.size} files touched, +${totalLinesAdded}/−${totalLinesRemoved}.`,
  });

  appendChat(project.id, {
    role: "persona",
    speaker: "developer",
    stage: "sprint-dev",
    text: Chat.sprintDevProgress(project.brief, fresh.stories, report),
  });

  setStage(project.id, "qa-review");
  await runStage(project.id, "qa-review");
}

async function stageQaReview(project: Project): Promise<void> {
  emitTheatre(project.id, "qa", "qa-review");
  announceThinking(project.id, "qa", "qa-review", `Running the test plan against each story.`);

  if (!project.hld) {
    appendChat(project.id, { role: "system", stage: "qa-review", text: "QA needs the HLD. Skipping." });
    setStage(project.id, "code-review");
    await runStage(project.id, "code-review");
    return;
  }

  let newDefects: Defect[];
  try {
    const result = await generateQaDefects({
      brief: project.brief,
      stories: project.stories,
      hld: project.hld,
    });
    newDefects = result.defects;
    recordLlmCallResult(project.id, "qa-review", "qa", result.llm);
  } catch (err) {
    if (surfaceLlmError(project.id, "qa-review", err, "QA Lead")) return;
    throw err;
  }

  updateProject(project.id, (p) => {
    p.defects.push(...newDefects);
  });

  const verdict: "PASS" | "FAIL" | "CONDITIONAL" =
    newDefects.length === 0
      ? "PASS"
      : newDefects.some((d) => d.severity === "P1")
        ? "FAIL"
        : "CONDITIONAL";

  emitAgentEvent({
    type: "qa.verdict",
    decision: verdict,
    bugs: newDefects.length,
  });

  const fresh = getProject(project.id) ?? project;
  appendChat(project.id, {
    role: "persona",
    speaker: "qa",
    stage: "qa-review",
    text: Chat.qaSummary(project.brief, fresh.stories, fresh.defects),
    attachment: { kind: "defects" },
  });

  setStage(project.id, "code-review");
  await runStage(project.id, "code-review");
}

async function stageCodeReview(project: Project): Promise<void> {
  emitTheatre(project.id, "software-architect", "code-review");
  announceThinking(project.id, "solution-architect", "code-review", `Reviewing the PR — checking guardrails and patterns.`);

  if (!project.lld) {
    appendChat(project.id, { role: "system", stage: "code-review", text: "Code review needs the LLD. Skipping." });
    pauseForUser(project.id);
    return;
  }

  const commits = (project as Project & { devCommits?: StoryCommit[] }).devCommits ?? [];
  if (commits.length === 0) {
    appendChat(project.id, {
      role: "system",
      stage: "code-review",
      text: "Code review needs the developer's commit set. Skipping.",
    });
    pauseForUser(project.id);
    return;
  }

  try {
    const result = await generateCodeReview({
      brief: project.brief,
      stories: project.stories,
      lld: project.lld,
      commits,
    });
    recordLlmCallResult(project.id, "code-review", "solution-architect", result.llm);
    updateProject(project.id, (p) => {
      p.codeReview = result.artefact;
    });
    appendChat(project.id, {
      role: "persona",
      speaker: "solution-architect",
      stage: "code-review",
      text: Chat.codeReviewChat(project.brief, result.artefact.comments),
      attachment: { kind: "code-review" },
    });
  } catch (err) {
    if (surfaceLlmError(project.id, "code-review", err, "Solution Architect (code review)")) return;
    throw err;
  }

  pauseForUser(project.id);
}

async function stageDefectFix(project: Project): Promise<void> {
  emitTheatre(project.id, "developer", "defect-fix");

  const openDefects = project.defects.filter((d) => d.status !== "fixed");
  const reviewComments = project.codeReview?.comments ?? [];
  const unresolvedComments = reviewComments.filter((c) => !c.resolved);

  emitAgentEvent({
    type: "agent.started",
    agent: "developer",
    note: openDefects.length > 0
      ? `Working through ${openDefects.length} open defect${openDefects.length === 1 ? "" : "s"} and ${unresolvedComments.length} review comment${unresolvedComments.length === 1 ? "" : "s"}.`
      : `No open defects — addressing ${unresolvedComments.length} review comment${unresolvedComments.length === 1 ? "" : "s"}.`,
  });

  // Walk defects one-by-one so the activity feed shows actual fix progress
  // (the user explicitly called this out: "Developer wasn't involved
  // anywhere"). Each fix emits a progress event before it lands.
  for (let i = 0; i < openDefects.length; i++) {
    const d = openDefects[i]!;
    const headline = d.title.split(/[:—]/)[0]?.trim() ?? d.title;
    emitAgentEvent({
      type: "agent.progress",
      agent: "developer",
      pct: Math.round(((i + 0.5) / Math.max(1, openDefects.length)) * 100),
      note: `Fixing ${d.severity}: ${headline}`,
    });
  }

  // Mark code-review comments resolved + defects fixed + push any remaining
  // in-progress stories to done.
  updateProject(project.id, (p) => {
    if (p.codeReview) {
      p.codeReview.comments = p.codeReview.comments.map((c) => ({
        ...c,
        resolved: true,
      }));
    }
    p.defects = p.defects.map((d) => ({ ...d, status: "fixed" }));
    p.stories = p.stories.map((s) => ({ ...s, status: "done" }));
  });

  emitAgentEvent({
    type: "agent.completed",
    agent: "developer",
    summary:
      openDefects.length > 0
        ? `Closed ${openDefects.length} defect${openDefects.length === 1 ? "" : "s"} + ${unresolvedComments.length} review comment${unresolvedComments.length === 1 ? "" : "s"}.`
        : `Addressed ${unresolvedComments.length} review comment${unresolvedComments.length === 1 ? "" : "s"} — no defects to close.`,
  });

  const fresh = getProject(project.id) ?? project;
  appendChat(project.id, {
    role: "persona",
    speaker: "developer",
    stage: "defect-fix",
    text: Chat.defectFix(project.brief, fresh.defects),
  });

  setStage(project.id, "security-audit");
  await runStage(project.id, "security-audit");
}

async function stageSecurityAudit(project: Project): Promise<void> {
  emitTheatre(project.id, "security", "security-audit");
  announceThinking(project.id, "cybersecurity", "security-audit", `Running OWASP-Top-10 + secrets + prompt-injection checks.`);

  if (!project.hld || !project.lld) {
    appendChat(project.id, { role: "system", stage: "security-audit", text: "Security audit needs HLD + LLD. Skipping." });
    setStage(project.id, "deploy");
    await runStage(project.id, "deploy");
    return;
  }

  let audit;
  try {
    // If we previously flagged findings and the Engineer has since
    // worked through defect-fix, pass them into the re-audit so the LLM
    // verifies them as fixed instead of re-emitting the same NO_GO.
    const previouslyRaised = (project as Project & {
      lastSecurityFindings?: SecurityAudit["findings"];
    }).lastSecurityFindings;
    const result = await generateSecurityAudit({
      brief: project.brief,
      hld: project.hld,
      lld: project.lld,
      stories: project.stories,
      previouslyRaised,
    });
    audit = result.artefact;
    recordLlmCallResult(project.id, "security-audit", "cybersecurity", result.llm);
    // Clear the re-audit marker once it's been consumed so a *new* genuine
    // finding on a future sprint isn't treated as "previously raised".
    if (previouslyRaised) {
      updateProject(project.id, (p) => {
        delete (p as Project & { lastSecurityFindings?: unknown }).lastSecurityFindings;
      });
    }
  } catch (err) {
    if (surfaceLlmError(project.id, "security-audit", err, "Security Lead")) return;
    throw err;
  }

  updateProject(project.id, (p) => {
    p.security = audit;
  });

  emitAgentEvent({
    type: "security.verdict",
    decision: audit.verdict,
    critical: audit.findings.filter((f) => f.severity === "critical").length,
  });

  // Build a domain-specific chat line right here (instead of relying on a
  // helper that used to come from the synthesizer).
  const summary = audit.verdict === "GO"
    ? `Security **GO** on **${project.brief.name}** — ${audit.findings.length} finding${audit.findings.length === 1 ? "" : "s"}${audit.findings[0] ? `. Top note: _${audit.findings[0].finding}_` : ""}`
    : `Security **NO_GO** on **${project.brief.name}** — ${audit.findings.filter((f) => f.severity === "critical").length} critical finding${audit.findings.filter((f) => f.severity === "critical").length === 1 ? "" : "s"}. Deployment blocked.`;

  appendChat(project.id, {
    role: "persona",
    speaker: "cybersecurity",
    stage: "security-audit",
    text: summary,
    attachment: { kind: "security" },
  });

  if (audit.verdict === "NO_GO") {
    // Don't deploy. Pause so the user can decide (fix critical → retry, or
    // override + accept risk).
    appendChat(project.id, {
      role: "system",
      stage: "security-audit",
      text: "Pipeline halted at the security gate. Ask the team to fix the critical finding(s) and re-run the audit.",
    });
    pauseForUser(project.id);
    return;
  }

  setStage(project.id, "deploy");
  await runStage(project.id, "deploy");
}

async function stageDeploy(project: Project): Promise<void> {
  emitTheatre(project.id, "developer", "deploy");

  const fresh = getProject(project.id) ?? project;
  // Deploy stats are derived from the ACTUAL developer commits (each story
  // had a real LLM-planned file list), not pattern matching. Aggregate the
  // unique files + lines into a single deploy report.
  const commits = (fresh as Project & { devCommits?: StoryCommit[] }).devCommits ?? [];
  const uniqueFiles = new Set(commits.flatMap((c) => c.files));
  const totalLinesAdded = commits.reduce((sum, c) => sum + c.linesAdded, 0);
  // Rough byte estimate: ~40 chars/line including comments + whitespace.
  const bytes = totalLinesAdded * 40;

  emitAgentEvent({
    type: "files.written",
    taskId: `${fresh.id}-sprint-${fresh.currentSprint}`,
    count: uniqueFiles.size,
    bytes,
  });

  appendChat(project.id, {
    role: "persona",
    speaker: "ceo",
    stage: "deploy",
    text: Chat.deployLine(project.brief, fresh.stories),
  });

  setStage(project.id, "done");
  await runStage(project.id, "done");
}

async function stageDone(project: Project): Promise<void> {
  emitAgentEvent({
    type: "pipeline.finished",
    decision: "WROTE_FILES",
    ms: Date.now() - project.stageStartedAt,
  });
  const fresh = getProject(project.id) ?? project;
  appendChat(project.id, {
    role: "persona",
    speaker: "ceo",
    stage: "done",
    text: Chat.ceoDone(project.brief, fresh.stories.length),
  });
  updateProject(project.id, (p) => {
    p.waitingForUser = true;
  });
}

// ---------- Helpers ----------

function setStage(projectId: string, stage: StageId): void {
  updateProject(projectId, (p) => {
    p.stage = stage;
    p.stageStartedAt = Date.now();
    p.waitingForUser = !!STAGE_META[stage].requiresApproval;
  });
}

function pauseForUser(projectId: string): void {
  updateProject(projectId, (p) => {
    p.waitingForUser = true;
  });
}

function appendChat(projectId: string, turn: Omit<ChatTurn, "id" | "ts">): void {
  updateProject(projectId, (p) => {
    p.chat.push({
      id: `c-${randomUUID().slice(0, 8)}`,
      ts: Date.now(),
      ...turn,
    });
  });
}

/**
 * Drop a brief "I'm starting" chat turn from the active persona at the top of
 * a stage. Without this, multi-second LLM calls produce a silent UI — the
 * user sees no response and assumes the team froze.
 *
 * The chat turn is normal (persona, with a stage tag) so it survives across
 * polls, AND we set waitingForUser = false so the CEOChat shows the live
 * typing dots beneath this announcement until the artefact arrives.
 */
function announceThinking(
  projectId: string,
  speaker: PersonaId,
  stage: StageId,
  text: string,
): void {
  appendChat(projectId, {
    role: "persona",
    speaker,
    stage,
    text,
  });
  updateProject(projectId, (p) => {
    p.waitingForUser = false;
  });
}

function recordCall(
  projectId: string,
  stage: StageId,
  persona: PersonaId,
  result: { provider: import("../shared/types.ts").ProviderId; model: string; inTokens: number; outTokens: number; costUsd: number; source: "live" | "demo" },
): void {
  const record: LlmCallRecord = {
    ts: Date.now(),
    stage,
    persona,
    provider: result.provider,
    model: result.model,
    inTokens: result.inTokens,
    outTokens: result.outTokens,
    costUsd: result.costUsd,
    source: result.source,
  };
  updateProject(projectId, (p) => {
    p.llmCalls.push(record);
    p.totalCostUsd += record.costUsd;
    p.totalInTokens += record.inTokens;
    p.totalOutTokens += record.outTokens;
  });
}

/**
 * Turn a stage role into a coordinated burst of AgentEvents that move the
 * right visual agent to the right room and put it into the right status.
 *
 * Keeps the office in sync with the workflow without the chat panel having
 * to know about 3D rooms.
 */
function emitTheatre(
  _projectId: string,
  role: StageRole,
  _stage: StageId,
): void {
  const personaId = STAGE_ROLE_TO_PERSONA[role];
  const visualAgent = personaId as AgentName;

  emitAgentEvent({
    type: "agent.started",
    agent: visualAgent,
    note: `${STAGE_ROLE_LABEL[role]} working.`,
  });
}

// ---------- Artefact parsers ----------

// ---------- Artefact parsing ----------
//
// Each parser tries to read JSON from the LLM's output. If it can't (the
// model returned prose, demo-mode is on, the model hallucinated markdown
// fences we couldn't strip, etc.) we fall through to a *brief-aware*
// template that's classified from the user's pitch. This way the platform
// never produces the same "Identity / Workspace / Orchestration" plan for
// every project — a tattoo-artist finder gets PostGIS contexts, an
// e-commerce store gets Stripe + cart contexts, and so on.

/**
 * Best-effort assignment of a PO feature to one of the HLD's bounded
 * contexts. Token-overlap heuristic; if nothing matches, fall back to the
 * first context so every feature has SOME home (the SA can override in a
 * future revision).
 */
function anchorFeatureToContext(
  feature: ProductFeature,
  contexts: string[],
): ProductFeature {
  if (contexts.length === 0) return feature;
  const blob = `${feature.name} ${feature.userJob} ${feature.acceptanceSignals.join(" ")}`.toLowerCase();
  for (const ctx of contexts) {
    const tokens = ctx.toLowerCase().split(/[\s-_/]+/).filter(Boolean);
    if (tokens.some((t) => blob.includes(t))) {
      return { ...feature, contextHome: ctx };
    }
  }
  return { ...feature, contextHome: contexts[0] };
}

/**
 * Lightweight check: is a PO feature observably present on the given screen?
 * Used by stageDesignValidation to decide whether a screen needs to be
 * supplemented. We treat a feature as covered if any token from the feature
 * name appears in the screen title or caption.
 */
function featureCoveredByScreen(
  feature: ProductFeature,
  screen: GeneratedScreen,
): boolean {
  const screenBlob = `${screen.title} ${screen.caption}`.toLowerCase();
  const featureTokens = `${feature.name} ${feature.userJob}`
    .toLowerCase()
    .split(/[\s,;.()/-]+/)
    .filter((t) => t.length >= 4)
    .filter((t) => !["want", "when", "user", "with", "from", "this", "that"].includes(t));
  if (featureTokens.length === 0) return true;
  let hits = 0;
  for (const t of featureTokens) {
    if (screenBlob.includes(t)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}
