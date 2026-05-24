// lib/platform/workflow/brief-chat.ts
//
// Brief-aware *narrative* lines — what each persona "says" in the chat panel
// at each stage. Sibling of brief-templates.ts (which produces structured
// artefacts).
//
// Why a whole file for chat copy?
//   The first version of the workflow had hardcoded strings like
//     "+218 / −47 across 11 files. Touches: identity/, workspace/, orchestration/."
//   …for every project, including a UK tattoo-artist finder. That made the
//   pipeline feel like theatre, not real work. These helpers compose chat
//   lines from the *actual* artefacts (real story titles, real bounded
//   contexts, real category-specific risks) so the chat matches what's
//   actually been produced.

import { classifyBrief, type BriefCategory } from "./brief-templates.ts";
import type {
  CodeReviewArtefact,
  Defect,
  FeaturesArtefact,
  HldArtefact,
  LldArtefact,
  ProductFeature,
  ProjectBrief,
  UserStory,
} from "./types.ts";

interface Hints {
  region?: "uk" | "us" | "eu" | "global";
  payments: boolean;
  geo: boolean;
  media: boolean;
  messaging: boolean;
}

function getHints(brief: ProjectBrief): Hints {
  return classifyBrief(brief).hints;
}

function getCategory(brief: ProjectBrief): BriefCategory {
  return classifyBrief(brief).category;
}

// ---------- CEO intake ----------

/**
 * First CEO turn — greet the founder, name the product, ask the two most
 * disambiguating questions for THIS category. Replaces the generic
 * "Got it — so we're building <pitch>" echo.
 */
export function ceoIntakeKickoff(brief: ProjectBrief): string {
  const c = getCategory(brief);
  const h = getHints(brief);
  const audience = brief.audience?.trim();
  const metric = brief.successMetric?.trim();

  const q1 =
    !audience || audience.length < 5
      ? `**Target user** — who is this for, exactly? "Anyone" never ships.`
      : `**Wedge user** — you said *${audience}*. Is that the wedge to start, or the whole market?`;

  const q2 =
    !metric || metric.length < 5
      ? defaultMetricQuestion(c, h)
      : `**Success metric** — you mentioned *${metric}*. Confirm that's the north-star and we'll instrument it from sprint 1.`;

  return [
    `**${brief.name}** — got it. It's ${oneLinerFor(c, h, brief)}`,
    ``,
    `Two checks before I bring the team in:`,
    ``,
    `1. ${q1}`,
    `2. ${q2}`,
    ``,
    `Answer those and I'll bring the CTO and Solution Architect in to draft a plan.`,
  ].join("\n");
}

/**
 * Second CEO turn — user has replied to the kickoff questions. ACKNOWLEDGE
 * their answer (don't repeat the prompt), then signal delegation. Engine
 * advances to cto-review right after.
 */
export function ceoIntakeAcknowledge(brief: ProjectBrief, userReply: string): string {
  const c = getCategory(brief);
  const h = getHints(brief);
  const reply = userReply.trim().slice(0, 220);

  // Extract the user's two answers if they typed them as a list. Loose match.
  const lines = userReply
    .split(/[\n,;]|(?:\b\d\)\s)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length < 160);
  const haveAudience = /\b(genz|gen z|millenni|age|user|customer|buyer|searcher)\b/i.test(reply);
  const haveMetric = /\b(metric|number|kpi|north[- ]?star|target|none|don'?t (?:have|know)|no data)\b/i.test(reply);

  const audienceLine = haveAudience
    ? `wedge user noted`
    : `audience still loose — we'll instrument behaviour to learn`;
  const metricLine = haveMetric
    ? defaultMetricProxy(c, h)
    : `metric undefined — we'll instrument the obvious proxies and revisit`;

  return [
    `Got it — ${audienceLine}; ${metricLine}.`,
    ``,
    `Bringing in the **Product Owner**, **Solution Architect**, and **CTO** now. The PO will name the features, the SA will draft the high-level design, and the CTO will fill in the low-level details for a ${categoryNoun(c, h)}.`,
  ].join("\n");
}

// ---------- Product Owner (product-discovery stage) ----------

/**
 * Product Owner's "I'm starting" line at the top of product-discovery. Sets
 * the user expectation that the PO is naming the JTBD and MoSCoW set before
 * any architecture work begins.
 */
export function poDiscoveryThinking(brief: ProjectBrief): string {
  const c = getCategory(brief);
  const h = getHints(brief);
  return [
    `Defining the feature set for **${brief.name}** — who, the job they're hiring it for, and the must/should/could split for a ${categoryNoun(c, h)}.`,
    `Every feature needs an architectural home (Solution Architect) and a UI worth shipping (Designer).`,
  ].join("\n");
}

/**
 * Product Owner's chat turn AFTER the feature catalogue lands. Names how many
 * features are in the must-list, what's out of scope, and what's queued for
 * the Solution Architect to anchor.
 */
export function poFeaturesReady(brief: ProjectBrief, features: FeaturesArtefact): string {
  const must = features.features.filter((f) => f.priority === "must");
  const should = features.features.filter((f) => f.priority === "should");
  const couldOrWont = features.features.filter(
    (f) => f.priority === "could" || f.priority === "wont",
  );
  const personaList = features.personas.map((p) => `**${p.name}**`).join(" / ");
  const mustList = must.slice(0, 4).map((f) => `_${f.name}_`).join(", ");

  const open =
    features.openQuestions.length > 0
      ? `Open questions for you: ${features.openQuestions.slice(0, 2).join(" ")}`
      : `No blocking questions — handing to the Solution Architect.`;

  return [
    `Feature set drafted for **${brief.name}**.`,
    `Personas: ${personaList || "—"}.`,
    `Must (${must.length}): ${mustList || "—"}.${should.length ? ` Should: ${should.length}.` : ""}${couldOrWont.length ? ` Could/Won't: ${couldOrWont.length}.` : ""}`,
    features.outOfScope.length > 0
      ? `Explicitly out of scope: ${features.outOfScope.slice(0, 2).join(" ")}`
      : "",
    ``,
    open,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Designer's chat turn after the user picks one of the 4 concept variants.
 * Confirms what was archived so the user sees the cull was intentional.
 */
export function designerThemeLocked(
  brief: ProjectBrief,
  theme: string,
  archivedCount: number,
): string {
  return [
    `Direction locked: **${theme}** for **${brief.name}**.`,
    `Archived the ${archivedCount} other ${archivedCount === 1 ? "variant" : "variants"} — the team will work against this single design from here.`,
    `Future screens for this project will follow the ${theme} aesthetic.`,
  ].join("\n");
}

export function ceoDone(brief: ProjectBrief, storyCount: number): string {
  const c = getCategory(brief);
  const h = getHints(brief);
  return [
    `Sprint shipped. ${storyCount} ${storyCount === 1 ? "story" : "stories"} live on staging for **${brief.name}**. Next obvious bet: ${nextBetFor(c, h)}.`,
    ``,
    `Ready to plan the next sprint when you are — tell me what to focus on and I'll loop in the PM.`,
  ].join("\n");
}

/**
 * CEO line when the user clicks "Plan next sprint" from the done state.
 * Names the focus, what's carrying over, and signals delegation back to the PM.
 */
export function ceoNextSprintKickoff(
  brief: ProjectBrief,
  sprintNumber: number,
  focus: string,
  carryStoryCount: number,
  openDefectCount: number,
  lowSevSecurityCount: number,
): string {
  const carryParts: string[] = [];
  if (carryStoryCount > 0)
    carryParts.push(
      `**${carryStoryCount}** ${carryStoryCount === 1 ? "story" : "stories"} carrying over`,
    );
  if (openDefectCount > 0)
    carryParts.push(
      `**${openDefectCount}** open ${openDefectCount === 1 ? "defect" : "defects"} to fix`,
    );
  if (lowSevSecurityCount > 0)
    carryParts.push(
      `**${lowSevSecurityCount}** low-sev security ${lowSevSecurityCount === 1 ? "note" : "notes"} to close out`,
    );
  const carryLine =
    carryParts.length > 0
      ? `Carrying over: ${carryParts.join(", ")}.`
      : `Nothing carrying over — we ship sprint ${sprintNumber - 1} clean.`;

  return [
    `Spinning up **sprint ${sprintNumber}** on **${brief.name}**. Focus: _${focus}_.`,
    carryLine,
    ``,
    `Handing off to the **PM** for the backlog draft now.`,
  ].join("\n");
}

/**
 * PM "thinking" indicator at the top of sprint-N planning. Surfaces the
 * focus so the user sees their input was heard.
 */
export function pmSprintPlanningThinking(
  brief: ProjectBrief,
  sprintNumber: number,
  focus: string,
): string {
  return `Drafting sprint ${sprintNumber} backlog for **${brief.name}** — focus: _${focus}_. Pulling in the carry-over and defect-fix items first.`;
}

/**
 * PM chat turn after the sprint-N backlog is assembled. Calls out how the
 * backlog is composed so the user can audit it before sprint-dev runs.
 */
export function pmSprintBacklogReady(
  brief: ProjectBrief,
  sprintNumber: number,
  carryCount: number,
  defectCount: number,
  securityCount: number,
  freshCount: number,
): string {
  const total = carryCount + defectCount + securityCount + freshCount;
  const composition: string[] = [];
  if (carryCount > 0)
    composition.push(`**${carryCount}** carry-over from sprint ${sprintNumber - 1}`);
  if (defectCount > 0)
    composition.push(`**${defectCount}** defect-fix`);
  if (securityCount > 0)
    composition.push(`**${securityCount}** security follow-up`);
  if (freshCount > 0) composition.push(`**${freshCount}** fresh against the new focus`);

  return [
    `Sprint ${sprintNumber} backlog ready for **${brief.name}** — **${total}** ${total === 1 ? "story" : "stories"} total: ${composition.join(", ")}.`,
    `Engineer is picking up the first slice now.`,
  ].join("\n");
}

// ---------- Plan ready ----------

export function planReady(
  brief: ProjectBrief,
  hld: HldArtefact,
  lld: LldArtefact,
): string {
  return `Architecture plan for **${brief.name}** ready — ${hld.contexts.length} bounded contexts (${hld.contexts.join(", ")}), ${lld.modules.length} modules, ${lld.apis.length} APIs. Sent for your approval.`;
}

// ---------- Solution Architect (HLD) ----------

export function saHldThinking(brief: ProjectBrief): string {
  const c = getCategory(brief);
  const h = getHints(brief);
  return `Solution Architect drafting the HLD for **${brief.name}** — bounded contexts, system diagram, integration points, and NFRs for a ${categoryNoun(c, h)}.`;
}

export function saHldReady(brief: ProjectBrief, hld: HldArtefact): string {
  const integrationStack = hld.stack
    .filter((s) => /Geocoding|Media|Payments|Email|Realtime|Moderation|Inference|Spatial/.test(s.area))
    .slice(0, 3)
    .map((s) => `**${s.area}:** ${s.choice}`);
  const topRisk = hld.risks[0];
  const lines = [
    `HLD ready for **${brief.name}**.`,
    `**${hld.contexts.length}** bounded contexts: ${hld.contexts.join(", ")}.`,
  ];
  if (integrationStack.length > 0) {
    lines.push(`Integration picks I'm advocating for: ${integrationStack.join(" · ")}.`);
  }
  if (topRisk) {
    lines.push(`Top risk on my radar: _${topRisk.risk}_ — mitigation: ${topRisk.mitigation}`);
  }
  lines.push(`Handing to the **CTO** to fill in the LLD — modules, schema, API surfaces.`);
  return lines.join("\n");
}

// ---------- CTO (LLD) ----------

export function ctoLldThinking(brief: ProjectBrief): string {
  return `CTO drafting the LLD for **${brief.name}** on top of the SA's HLD — modules, data model, API surfaces, stack picks.`;
}

export function ctoLldReady(
  brief: ProjectBrief,
  hld: HldArtefact,
  lld: LldArtefact,
): string {
  const coreStack = hld.stack
    .filter((s) => /Frontend|Database|Spatial DB|Auth|Hosting/.test(s.area))
    .slice(0, 4)
    .map((s) => `**${s.area}:** ${s.choice}`);
  const sampleApi = lld.apis[0];
  const lines = [
    `LLD ready for **${brief.name}**.`,
    `**${lld.modules.length}** modules · **${lld.dataModel.length}** entities · **${lld.apis.length}** APIs across ${hld.contexts.length} contexts.`,
  ];
  if (coreStack.length > 0) {
    lines.push(`Stack locked in: ${coreStack.join(" · ")}.`);
  }
  if (sampleApi) {
    lines.push(`Example surface: \`${sampleApi.method} ${sampleApi.path}\` — ${sampleApi.purpose}`);
  }
  lines.push(`Plan is ready for your sign-off.`);
  return lines.join("\n");
}

// ---------- Designer · Feature validation ----------

export function designerValidationThinking(
  brief: ProjectBrief,
  featureCount: number,
): string {
  return `Cross-checking the locked design against the **${featureCount}** feature${
    featureCount === 1 ? "" : "s"
  } the PO defined for **${brief.name}** — for each feature, confirming the screen + CTA + state transitions are reachable. Any gaps get a supplementary screen in the locked theme.`;
}

export function designerValidationReport(
  brief: ProjectBrief,
  results: {
    feature: ProductFeature;
    state: "covered" | "supplemented" | "uncovered";
    note: string;
  }[],
): string {
  const covered = results.filter((r) => r.state === "covered");
  const supplemented = results.filter((r) => r.state === "supplemented");
  const uncovered = results.filter((r) => r.state === "uncovered");

  const lines: string[] = [`Validation pass complete on **${brief.name}**.`];
  if (covered.length > 0) {
    lines.push(
      `✓ Covered by the locked design (${covered.length}): ${covered.map((r) => r.feature.name).slice(0, 5).join(", ")}${covered.length > 5 ? "…" : ""}.`,
    );
  }
  if (supplemented.length > 0) {
    lines.push(
      `+ New supplementary screen(s) added for: ${supplemented.map((r) => r.feature.name).join(", ")} — in the locked theme.`,
    );
  }
  if (uncovered.length > 0) {
    lines.push(
      `! Still uncovered — needs your call: ${uncovered.map((r) => r.feature.name).join(", ")}. The PO will reopen these features.`,
    );
  }
  return lines.join("\n");
}

// ---------- CEO · Handoff package ----------

/**
 * CEO's chat turn at the end of design-validation. Names the three artefacts
 * the user is being handed (HLD, LLD, Stitch UI link) and frames sprint 1 as
 * starting next.
 */
export function ceoHandoffPackage(
  brief: ProjectBrief,
  contexts: number,
  modules: number,
  hasStitchLink: boolean,
): string {
  return [
    `Architecture + design approved for **${brief.name}**. Here's the handoff package:`,
    ``,
    `1. **HLD** — Solution Architect's bounded-context map and NFRs (${contexts} contexts).`,
    `2. **LLD** — CTO's modules, schema, and API surfaces (${modules} modules).`,
    `3. ${hasStitchLink ? "**Stitch UI design link**" : "Locked Stitch UI design"} — the screen the team will build against.`,
    ``,
    `Click **Open handoff package** to inspect everything. Then I'll bring in the Engineering Manager to slice sprint 1.`,
  ].join("\n");
}

// ---------- Revisions ----------
//
// When the user clicks "Request changes" with a comment, we map their feedback
// into a list of concrete changes the architect/designer "made" in the new
// draft. The user sees their words quoted + a checklist of changes, so the
// re-draft doesn't feel like the previous one regenerated silently.

/** Turn a user comment into a list of specific change lines. */
export function deriveRevisionChanges(
  brief: ProjectBrief,
  userFeedback: string,
  scope: "plan" | "design",
): string[] {
  const f = userFeedback.toLowerCase();
  const changes: string[] = [];

  // Generic keyword → action mapping. The point is that the user can see
  // the system DID something specific with their words.
  if (/postgres|database|db\b|supabase|planetscale|neon/.test(f))
    changes.push(`Re-evaluated the database choice and rationale in the stack section.`);
  if (/stripe|payment|billing|checkout/.test(f))
    changes.push(`Added payments handling to the bounded contexts + APIs.`);
  if (/auth|login|sign[- ]?up|clerk|auth0/.test(f))
    changes.push(`Tightened the auth flow in the Identity context.`);
  if (/mobile|ios|android|app\b/.test(f))
    changes.push(`Called out mobile-web (iOS Safari + Android Chrome) as a first-class platform.`);
  if (/seo|google|search engine|ranking/.test(f))
    changes.push(`Strengthened the SEO plan — programmatic location pages from day 1.`);
  if (/gdpr|privacy|consent|cookie|dpa\b/.test(f))
    changes.push(`Made GDPR / privacy regulation an explicit risk with a mitigation.`);
  if (/moderation|nsfw|abuse|spam|safety/.test(f))
    changes.push(`Added content-moderation pipeline to the design.`);
  if (/specifi|specific|particular|focused|narrow|only/.test(f))
    changes.push(`Tightened scope to ${nounFor(brief)} specifically — generic affordances dropped.`);
  if (/cheap|cost|budget|free tier/.test(f))
    changes.push(`Swapped towards the free-tier-friendly option where possible.`);
  if (/scale|perf|performance|fast|latency/.test(f))
    changes.push(`Added caching + performance notes to the relevant module(s).`);
  if (/uk\b|british|england/.test(f))
    changes.push(`Pinned the design to UK-specific defaults (Postcodes.io, UK DPA, £, en-GB).`);

  if (scope === "design") {
    if (/empty|onboard|first[- ]?run/.test(f))
      changes.push(`Empty-state and first-run flows redesigned to be the obvious next click.`);
    if (/cta|button|hero/.test(f))
      changes.push(`Primary CTA elevated; hero hierarchy tightened.`);
    if (/dark|light|theme|colou?r/.test(f))
      changes.push(`Theme adjusted per your note.`);
    if (/dense|compact|spacing|breathing/.test(f))
      changes.push(`Information density retuned.`);
  }

  // Fallback when nothing matched: at minimum quote the feedback and promise
  // a re-draft pass.
  if (changes.length === 0) {
    changes.push(`Re-read your note carefully and revised the relevant section(s).`);
  }
  return changes;
}

/** Chat line the architect speaks when responding to a Request-Changes. */
export function planRevisionAck(
  brief: ProjectBrief,
  feedback: string,
  changes: string[],
): string {
  const quoted = feedback.trim().slice(0, 160);
  return [
    `Re-drafted the plan for **${brief.name}** to address your note: *"${quoted}"*.`,
    ``,
    `Specifically:`,
    ...changes.map((c) => `- ${c}`),
    ``,
    `Open the architecture plan to review the revisions log + new draft.`,
  ].join("\n");
}

/** Chat line the designer speaks when responding to a Request-Changes. */
export function designRevisionAck(
  brief: ProjectBrief,
  feedback: string,
  changes: string[],
): string {
  const quoted = feedback.trim().slice(0, 160);
  return [
    `Re-running the four concepts for **${brief.name}** with your note: *"${quoted}"*.`,
    ``,
    `Changes I'm applying this pass:`,
    ...changes.map((c) => `- ${c}`),
    ``,
    `Placeholders are up; live Stitch renders swap in as they complete.`,
  ].join("\n");
}

// ---------- Design ----------

export function designKickoff(brief: ProjectBrief): string {
  const c = getCategory(brief);
  const screens = screenLineup(c);
  return `Designer is generating 4 concept screens for **${brief.name}** via Stitch (Gemini 3 Pro): ${screens
    .map((s, i) => `(${i + 1}) ${s}`)
    .join(", ")}. Placeholders are up so you can react; live screens swap in as they render.`;
}

export function designReady(brief: ProjectBrief): string {
  return `4 concept screens ready for **${brief.name}**. Pick one or request a redesign on any of them.`;
}

export function designRedesign(brief: ProjectBrief, userComment: string): string {
  const c = getCategory(brief);
  const c1 = userComment.trim().slice(0, 160);
  return `Got it — ${c1 ? `"${c1}"` : "noted"}. Rerunning with that brief and leaning further into ${categorySpecificDesignFocus(c, brief)}.`;
}

function screenLineup(c: BriefCategory): string[] {
  switch (c) {
    case "service-finder":
      return [
        "Search by postcode",
        "Results map + list",
        "Profile + portfolio",
        "Contact thread",
      ];
    case "marketplace":
      return ["Discovery", "Listing detail", "Checkout + escrow", "Seller console"];
    case "ecommerce":
      return ["Catalog", "Product detail", "Cart + checkout", "Order detail"];
    case "social":
      return ["Sign-up + handle", "Home feed", "Profile + posts", "Reply thread"];
    case "ai-tool":
      return ["Empty state", "Streaming completion", "Workspace", "Usage / billing"];
    case "content":
      return ["Article reader", "Editor", "Newsletter signup", "Archive"];
    case "saas-tool":
    default:
      return ["Sign-up", "Empty state", "Primary workflow", "Dashboard"];
  }
}

function categorySpecificDesignFocus(c: BriefCategory, brief: ProjectBrief): string {
  switch (c) {
    case "service-finder":
      return `${brief.name}-specific affordances (style filters, portfolio gallery, distance badges, contact gates)`;
    case "marketplace":
      return `marketplace trust signals (seller verified, reviews, escrow state)`;
    case "ecommerce":
      return `commerce essentials (clear pricing, fast add-to-cart, trust badges)`;
    case "social":
      return `social loops (clear follow CTA, instant feed updates)`;
    case "ai-tool":
      return `AI-product polish (streaming feedback, usage transparency)`;
    case "content":
      return `reader experience (typography, dark mode, share affordances)`;
    case "saas-tool":
    default:
      return `the primary workflow being one obvious next click`;
  }
}

// ---------- Stories ----------

export function storiesReady(brief: ProjectBrief, stories: UserStory[]): string {
  const titles = stories
    .slice(0, 5)
    .map((s) => `*${s.title}*`)
    .join(", ");
  return `Backlog drafted for **${brief.name}**: ${stories.length} vertical slices — ${titles}. Devs picking them up now.`;
}

// ---------- Sprint dev ----------
//
// `longPoleReasonFor()` used to live here as the last category switch — same
// bottleneck claim for every project in a category. It's now
// `brief-templates.ts#deriveLongPoleReason`, which reads from the story's own
// tasks (so it names what THIS story is actually pinned on, not "every UK
// service-finder").
//
// `sprintDevProgress()` now takes the synthesized commit set so the chat line
// can reference real branches + PRs + file counts.

export interface SprintDevReport {
  /** Total commits across all stories in this sprint. */
  commits: number;
  /** Total unique files touched. */
  files: number;
  linesAdded: number;
  linesRemoved: number;
  /** Branches opened (one per story). */
  branches: string[];
  /** PR numbers opened. */
  prNumbers: number[];
  /** Long-pole story + the derived reason it's still in-progress. */
  longPole?: { title: string; reason: string };
}

export function sprintDevProgress(
  brief: ProjectBrief,
  stories: UserStory[],
  report: SprintDevReport,
): string {
  const done = stories.filter((s) => s.status === "done");
  const titles = done.slice(0, 5).map((s) => `*${s.title}*`).join(", ");
  const branchList = report.branches.slice(0, 4).map((b) => `\`${b}\``).join(", ");
  const tail = report.branches.length > 4 ? `, +${report.branches.length - 4} more` : "";

  const longPoleLine = report.longPole
    ? `Long pole: *${report.longPole.title}* — ${report.longPole.reason}.`
    : `All stories landed clean.`;

  return [
    `Sprint **${brief.name}**: shipped ${done.length}/${stories.length} stories — ${titles || "—"}.`,
    `${report.commits} commits across ${report.branches.length} branches (${branchList}${tail}), +${report.linesAdded}/−${report.linesRemoved} across ${report.files} files. PRs #${report.prNumbers.slice(0, 4).join(", #")}${report.prNumbers.length > 4 ? " …" : ""} up for review.`,
    longPoleLine,
  ].join("\n");
}

// Per-story progress narration. Picked up by the activity feed; the engine
// emits one of these per story as the developer "works" through the sprint.
export function devStoryStarted(story: UserStory, branch: string): string {
  return `Branch \`${branch}\` up. Starting *${story.title}* — ${story.effort} effort, ${story.tasks?.length ?? 0} tasks.`;
}

export function devStoryShipped(story: UserStory, files: number, lines: number): string {
  return `Shipped *${story.title}* — ${files} files, +${lines} lines.`;
}

// ---------- QA ----------
//
// `qaDefect()` used to live here as a 6-way category switch ("service-finder"
// → postcode bug; "marketplace" → escrow bug; …) so every UK service-finder
// got the SAME P2 defect every sprint. Defect synthesis has moved to
// `brief-templates.ts#synthesizeQaDefects` — capability-driven, returns 0-3
// defects with varying severity, picked by the brief seed.
//
// What remains here is `qaSummary()` — a narrative formatter that just counts
// the already-stored defects, no category lookup.

export function qaSummary(
  brief: ProjectBrief,
  stories: UserStory[],
  defects: Defect[],
): string {
  const passing = stories.length - defects.length;
  if (defects.length === 0) {
    return `Test pass on **${brief.name}**: ${passing}/${stories.length} stories green. No defects.`;
  }
  const sev = defects[0]?.severity ?? "P2";
  return `Test pass on **${brief.name}**: ${passing}/${stories.length} stories green. ${defects.length} defect${defects.length === 1 ? "" : "s"} filed (${sev}).`;
}

// ---------- Code review ----------
//
// `codeReviewSeed()` used to live here as a 6-way category switch. Like the
// QA defect synthesis, it produced the same comments for every brief in the
// same category. It moved to `brief-templates.ts#synthesizeCodeReviewComments`
// — capability-driven (search-by-location → PostGIS index comment, pay-checkout
// → webhook idempotency, ai-generate → retry/backoff, …) with seed-based
// picks so two consecutive sprints don't always see the same comments.
//
// What remains here is `codeReviewChat()` — the narrative-line formatter that
// rolls up whatever comments synthesize* already chose.

export function codeReviewChat(
  brief: ProjectBrief,
  comments: CodeReviewArtefact["comments"],
): string {
  const major = comments.filter((c) => c.severity === "major").length;
  const minor = comments.filter((c) => c.severity === "minor").length;
  const nit = comments.filter((c) => c.severity === "nit").length;
  const headline = comments[0]?.text.split("—")[0]?.trim() ?? "see comments";
  return `Code review on **${brief.name}** left ${comments.length} comment${comments.length === 1 ? "" : "s"} (${major} major, ${minor} minor, ${nit} nit). Headline: *${headline}*. Want me to approve, or do you want to look first?`;
}

// ---------- Defect fix ----------

export function defectFix(brief: ProjectBrief, defects: Defect[]): string {
  if (defects.length === 0) {
    return `No open defects to fix on **${brief.name}** — re-running QA on the latest build for the record.`;
  }
  // Each defect headline is the first clause before ":" or "—". Modules are
  // inferred from where the bug surfaced (the repro text references real
  // capabilities like "postcode", "stripe", "websocket").
  const fixes = defects.map((d) => {
    const headline = d.title.split(/[:—]/)[0]?.trim() ?? d.title;
    const sev = d.severity;
    const mod = inferModuleFromDefect(d);
    return `_${sev}_ ${headline}${mod ? ` (\`${mod}\`)` : ""}`;
  });
  const bySev: Record<"P1" | "P2" | "P3", number> = { P1: 0, P2: 0, P3: 0 };
  for (const d of defects) bySev[d.severity]++;
  const severitySummary = (["P1", "P2", "P3"] as const)
    .filter((s) => bySev[s] > 0)
    .map((s) => `${bySev[s]} ${s}`)
    .join(", ");

  return [
    `Addressed code-review comments and fixed ${defects.length} defect${defects.length === 1 ? "" : "s"} on **${brief.name}** (${severitySummary}):`,
    ...fixes.map((f) => `- ${f}`),
    `Re-running QA on the affected branches.`,
  ].join("\n");
}

function inferModuleFromDefect(d: Defect): string | null {
  const t = `${d.title} ${d.repro}`.toLowerCase();
  if (/postcode|geo|lat\/lng/.test(t)) return "lib/geo/*";
  if (/postgis|knn|radius/.test(t)) return "lib/search/*";
  if (/stripe|webhook|payment|checkout|refund|escrow/.test(t)) return "lib/payments/*";
  if (/booking|slot|availability/.test(t)) return "lib/booking/*";
  if (/upload|thumbnail|portfolio|nsfw|moder/.test(t)) return "lib/media/*";
  if (/websocket|realtime|gps|reconnect/.test(t)) return "lib/realtime/*";
  if (/prompt|streaming|token|budget|llm|inject/.test(t)) return "lib/llm/*";
  if (/contact|message|enquir|inbox/.test(t)) return "lib/messaging/*";
  if (/review|rating/.test(t)) return "lib/reviews/*";
  if (/filter|facet|sort/.test(t)) return "lib/search/*";
  if (/auth|session|token|tenant/.test(t)) return "lib/auth/*";
  if (/dashboard|analytic|chart/.test(t)) return "lib/analytics/*";
  return null;
}

// ---------- Security ----------
//
// `securityAudit()` used to live here as a 5-way category switch. It always
// returned verdict: "GO" + 1-2 low-severity findings for every brief —
// indistinguishable across products. Security synthesis has moved to
// `brief-templates.ts#synthesizeSecurityFindings` — capability-driven, can
// surface critical findings (NO_GO) on payments / AI / multi-tenant briefs,
// and varies the finding count by seed.

// ---------- Deploy ----------

export function deployLine(brief: ProjectBrief, stories: UserStory[]): string {
  const titles = stories
    .filter((s) => s.status === "done")
    .slice(0, 5)
    .map((s) => `*${s.title}*`)
    .join(", ");
  return `Sprint shipped on **${brief.name}** — ${titles} live on staging.${brief.name.toLowerCase().replace(/\s+/g, "")}.${suggestedTld(brief)}.`;
}

function suggestedTld(brief: ProjectBrief): string {
  const h = getHints(brief);
  if (h.region === "uk") return "uk";
  return "app";
}

// ---------- Helpers ----------

function oneLinerFor(c: BriefCategory, h: Hints, brief: ProjectBrief): string {
  switch (c) {
    case "service-finder":
      return `a ${h.region === "uk" ? "UK-focused" : "location-aware"} directory for ${nounFor(brief)}.`;
    case "marketplace":
      return `a two-sided marketplace for ${nounFor(brief)}.`;
    case "ecommerce":
      return `a single-merchant storefront for ${nounFor(brief)}.`;
    case "social":
      return `a feed-based social product around ${nounFor(brief)}.`;
    case "ai-tool":
      return `an AI-first tool for ${nounFor(brief)}.`;
    case "content":
      return `a content + distribution product around ${nounFor(brief)}.`;
    case "saas-tool":
    default:
      return `a SaaS tool around ${nounFor(brief)}.`;
  }
}

function nounFor(brief: ProjectBrief): string {
  const t = brief.pitch.toLowerCase();
  if (/tattoo/.test(t)) return "tattoo artists";
  if (/barber/.test(t)) return "barbers";
  if (/plumber/.test(t)) return "plumbers";
  if (/dentist/.test(t)) return "dentists";
  if (/therapist/.test(t)) return "therapists";
  if (/trainer|coach/.test(t)) return "trainers / coaches";
  return brief.name.toLowerCase();
}

function categoryNoun(c: BriefCategory, h: Hints): string {
  if (c === "service-finder") return `${h.region === "uk" ? "UK service-finder" : "service-finder"}`;
  if (c === "marketplace") return "two-sided marketplace";
  if (c === "ecommerce") return "storefront";
  if (c === "social") return "social product";
  if (c === "ai-tool") return "AI-first tool";
  if (c === "content") return "content + distribution platform";
  return "SaaS tool";
}

function defaultMetricQuestion(c: BriefCategory, h: Hints): string {
  if (c === "service-finder")
    return `**Success metric** — first-contact-per-search? Bookings completed? Or returning searchers in week 2?`;
  if (c === "marketplace")
    return `**Success metric** — first sale within 30 days? Liquidity ratio (buyer/seller)?`;
  if (c === "ecommerce")
    return `**Success metric** — checkout conversion? Average order value? Repeat rate?`;
  if (c === "social")
    return `**Success metric** — D1 retention? Posts-per-user? Time-in-feed?`;
  if (c === "ai-tool")
    return `**Success metric** — completions-per-user? Day-7 retention? Conversion to paid?`;
  if (c === "content")
    return `**Success metric** — paid subscribers? Open rate? Read-through?`;
  return `**Success metric** — what one number tells us this worked?`;
}

function defaultMetricProxy(c: BriefCategory, _h: Hints): string {
  if (c === "service-finder")
    return `we'll instrument **first-contact-per-search** + **return-visit week-2** as proxies`;
  if (c === "marketplace") return `we'll instrument **time-to-first-sale** + **buyer/seller ratio**`;
  if (c === "ecommerce") return `we'll instrument **checkout conversion** + **AOV**`;
  if (c === "social") return `we'll instrument **D1 retention** + **posts-per-DAU**`;
  if (c === "ai-tool") return `we'll instrument **completions-per-user** + **D7 retention**`;
  if (c === "content") return `we'll instrument **open rate** + **paid conversion**`;
  return `we'll instrument the obvious activation + retention metrics`;
}

function nextBetFor(c: BriefCategory, h: Hints): string {
  if (c === "service-finder")
    return h.region === "uk"
      ? "programmatic /tattoo-artists-in/<town> SEO pages + verified-artist badges"
      : "programmatic SEO pages + verified-pro badges";
  if (c === "marketplace") return "seller acquisition campaign + dispute analytics";
  if (c === "ecommerce") return "abandoned-cart flow + a second sales channel (newsletter)";
  if (c === "social") return "creator onboarding + first-week engagement loops";
  if (c === "ai-tool") return "second model + cost-aware routing";
  if (c === "content") return "topical clusters + a referral programme";
  return "second feature wedge + retention loops";
}

