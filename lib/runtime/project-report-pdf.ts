// lib/runtime/project-report-pdf.ts
//
// Pure formatter that turns a *set* of pipeline runs (one per task) plus the
// assembled-file inventory into a single consolidated, human-friendly project
// PDF. The per-task PDF (formatReportPdf in report-pdf.ts) is still produced
// by run-pipeline.ts on every run; this consolidates them into one report
// that a non-engineer stakeholder can actually skim.
//
// Layout (one logical page each, no leftover blanks):
//   1. Cover         — project name, big idea, four KPI cards
//   2. What you built — feature cards (one per EM feature) with task progress
//                       and file counts
//   3. Try it now    — numbered user-journey steps + login credentials callout
//   4. Build metrics — horizontal bar charts (files per task, size per task) +
//                       stacked file-type breakdown bar + big totals
//   5. Quality       — pass/fail/security grid + vulnerability summary
//   6. How to run    — copy-paste shell snippet + URL callout
//   7. Appendix      — compact one-row-per-task table (transparency)
//
// Built on PDFKit + the standard Helvetica/Courier core fonts so no extra
// fonts ship with the repo. The pdfSafe sanitiser (re-exported from
// report-pdf.ts) is applied to every text string so non-CP1252 glyphs degrade
// to ASCII fallbacks rather than rendering as boxes.
//
// Footer rendering trick: PDFKit auto-paginates whenever doc.text() would
// place a glyph below page.margins.bottom. We temporarily set the bottom
// margin to 0 inside addFooters() so we can write into the gutter without
// triggering spurious blank pages — this was the bug that produced 66 pages
// instead of 7 in the previous design.

import PDFDocument from "pdfkit";

import type { PipelineResult } from "./pipeline.ts";
import { pdfSafe } from "./report-pdf.ts";

// ---------- public API ----------

export interface ProjectAssemblyFile {
  /** Path inside the assembled app, e.g. `lib/db/store.ts`. */
  path: string;
  /** Size in bytes. */
  bytes: number;
  /** Line count (newline-separated). Optional; falls back to 0. */
  lines?: number;
  /** Originating pipeline task, e.g. `t-data-1`. */
  sourceTaskId: string;
}

export interface ProjectReportInput {
  /** Display name of the project, e.g. "Pharmacy B2B". */
  projectName: string;
  /** The original idea string (1-3 sentences). */
  idea: string;
  /** Pipeline results, one per task. Strategy outputs read from runs[0]. */
  runs: PipelineResult[];
  /** Files in the assembled app, with provenance. */
  assembledFiles: ProjectAssemblyFile[];
  /** Path to the assembled app on disk (relative is fine). */
  outputDir: string;
  /** Lines printed verbatim in the "How to run" code block. */
  howToRun: string[];
  /**
   * Numbered "Try it now" steps. Project-specific; e.g.
   *   ["Open http://localhost:3000", "Sign in with MH-RP-2024-7821", ...]
   */
  userJourney?: string[];
  /** Pre-filled credential / URL pairs surfaced in the "How to run" page. */
  credentials?: Array<{ label: string; value: string }>;
  /**
   * Optional friendly labels for task ids, e.g.
   *   { "t-shell-1": "Project skeleton + login screen" }
   * When provided, replaces raw task ids in every chart, table, and grid.
   * Falls back to the raw task id when a mapping is missing.
   */
  taskLabels?: Record<string, string>;
}

export interface FormatProjectReportPdfOptions {
  /** Inject a clock for testability. Default: new Date(). */
  now?: Date;
  /** PDF stream compression. Tests pass false for searchable bytes. Default true. */
  compress?: boolean;
}

// ---------- visual constants ----------

const C = {
  brand: "#4f46e5",
  brandDark: "#3730a3",
  brandSoft: "#eef2ff",
  text: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
  panel: "#f8fafc",
  code: "#0f172a",
  codeText: "#e2e8f0",
  ok: "#16a34a",
  okSoft: "#dcfce7",
  warn: "#d97706",
  warnSoft: "#fef3c7",
  err: "#dc2626",
  errSoft: "#fee2e2",
  info: "#0284c7",
  infoSoft: "#e0f2fe",
  white: "#ffffff",
  // Chart palette (file types + tasks)
  chartA: "#4f46e5", // .ts/.tsx
  chartB: "#0ea5e9", // .json
  chartC: "#10b981", // .css
  chartD: "#f59e0b", // .mjs
  chartE: "#ec4899", // other
} as const;

const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: { top: 56, right: 48, bottom: 56, left: 48 },
} as const;

const CW = PAGE.width - PAGE.margin.left - PAGE.margin.right;

// ---------- public function ----------

export function formatProjectReportPdf(
  input: ProjectReportInput,
  options: FormatProjectReportPdfOptions = {},
): Promise<Buffer> {
  const now = options.now ?? new Date();
  const compress = options.compress ?? true;
  const m = computeMetrics(input);

  return new Promise((resolvePdf, rejectPdf) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: [PAGE.width, PAGE.height],
      margins: PAGE.margin,
      bufferPages: true,
      compress,
      info: {
        Title: pdfSafe(`${input.projectName} - Project Report`),
        Subject: pdfSafe(input.idea.slice(0, 200)),
        Producer: "AI Organisation",
        Creator: "AI Organisation pipeline runner",
        CreationDate: now,
      },
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolvePdf(Buffer.concat(chunks)));
    doc.on("error", rejectPdf);

    try {
      drawCover(doc, input, m, now);
      doc.addPage();
      drawWhatYouBuilt(doc, input, m);
      doc.addPage();
      drawTryItNow(doc, input);
      doc.addPage();
      drawBuildMetrics(doc, input, m);
      doc.addPage();
      drawQuality(doc, input, m);
      doc.addPage();
      drawHowToRun(doc, input);
      doc.addPage();
      drawAppendix(doc, input, m);

      addFooters(doc, input.projectName, now);
      doc.end();
    } catch (e) {
      rejectPdf(e);
    }
  });
}

// ---------- aggregated metrics ----------

interface FeatureMetric {
  id: string;
  name: string;
  description: string;
  color: string;
  taskCount: number;
  tasksDone: number;
  files: number;
  bytes: number;
  /** Tasks that contribute to this feature, in EM order. */
  taskIds: string[];
}

interface ProjectMetrics {
  totalFiles: number;
  totalBytes: number;
  totalLines: number;
  tasksTotal: number;
  tasksWrote: number;
  tasksBlocked: number;
  features: FeatureMetric[];
  endpoints: number; // CTO apiContracts count
  vulnsBySeverity: { critical: number; high: number; medium: number; low: number };
  testsAuthored: number;
  perTaskFileCount: Map<string, number>;
  perTaskBytes: Map<string, number>;
  fileTypeBreakdown: Array<{ ext: string; bytes: number; color: string }>;
}

// Stable, accessible 6-colour palette. Features are colored by their order in
// the EM output so the same feature gets the same color across all charts.
const FEATURE_PALETTE = [
  "#4f46e5", // indigo
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal (fallback if >6 features)
  "#f97316", // orange
] as const;

function computeMetrics(input: ProjectReportInput): ProjectMetrics {
  const totalFiles = input.assembledFiles.length;
  const totalBytes = input.assembledFiles.reduce((a, f) => a + f.bytes, 0);
  const totalLines = input.assembledFiles.reduce((a, f) => a + (f.lines ?? 0), 0);
  const tasksTotal = input.runs.length;
  const tasksWrote = input.runs.filter((r) => r.decision === "WROTE_FILES").length;
  const tasksBlocked = tasksTotal - tasksWrote;

  // Map taskId -> contributions
  const perTaskFileCount = new Map<string, number>();
  const perTaskBytes = new Map<string, number>();
  for (const f of input.assembledFiles) {
    perTaskFileCount.set(f.sourceTaskId, (perTaskFileCount.get(f.sourceTaskId) ?? 0) + 1);
    perTaskBytes.set(f.sourceTaskId, (perTaskBytes.get(f.sourceTaskId) ?? 0) + f.bytes);
  }

  // Features (read from runs[0].outputs.em). Map each feature to the tasks
  // that contribute to it. Each feature gets a stable color based on its
  // index in the EM output so charts/grids can reference the same color
  // consistently across pages.
  const em = input.runs[0]?.outputs.em;
  const featureMap = new Map<string, FeatureMetric>();
  if (em) {
    em.features.forEach((f, i) => {
      featureMap.set(f.id, {
        id: f.id,
        name: f.name,
        description: f.description,
        color: FEATURE_PALETTE[i % FEATURE_PALETTE.length],
        taskCount: 0,
        tasksDone: 0,
        files: 0,
        bytes: 0,
        taskIds: [],
      });
    });
    for (const t of em.tasks) {
      const feat = featureMap.get(t.featureId);
      if (!feat) continue;
      feat.taskCount++;
      feat.taskIds.push(t.id);
      // a task is "done" if its corresponding pipeline run wrote files
      const run = input.runs.find((r) => r.selectedTask?.id === t.id);
      if (run && run.decision === "WROTE_FILES") {
        feat.tasksDone++;
        feat.files += perTaskFileCount.get(t.id) ?? 0;
        feat.bytes += perTaskBytes.get(t.id) ?? 0;
      }
    }
  }
  const features = Array.from(featureMap.values());

  // CTO endpoints
  const endpoints = input.runs[0]?.outputs.cto?.apiContracts.length ?? 0;

  // Vulnerabilities (across all runs)
  const vulnsBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of input.runs) {
    for (const v of r.outputs.security?.vulnerabilities ?? []) {
      vulnsBySeverity[v.severity]++;
    }
  }

  // Tests authored (sum of developer.tests across runs)
  let testsAuthored = 0;
  for (const r of input.runs) {
    testsAuthored += r.outputs.developer?.tests.length ?? 0;
  }

  // File-type breakdown: count bytes per extension, group small ones into
  // "other".
  const byExt = new Map<string, number>();
  for (const f of input.assembledFiles) {
    const ext = extOf(f.path);
    byExt.set(ext, (byExt.get(ext) ?? 0) + f.bytes);
  }
  const sorted = Array.from(byExt.entries()).sort((a, b) => b[1] - a[1]);
  const palette = [C.chartA, C.chartB, C.chartC, C.chartD, C.chartE];
  const fileTypeBreakdown: ProjectMetrics["fileTypeBreakdown"] = [];
  for (let i = 0; i < sorted.length; i++) {
    const [ext, bytes] = sorted[i];
    if (i < 4) {
      fileTypeBreakdown.push({ ext, bytes, color: palette[i] });
    } else {
      const last = fileTypeBreakdown[fileTypeBreakdown.length - 1];
      if (last && last.ext === "other") {
        last.bytes += bytes;
      } else {
        fileTypeBreakdown.push({ ext: "other", bytes, color: palette[4] });
      }
    }
  }

  return {
    totalFiles,
    totalBytes,
    totalLines,
    tasksTotal,
    tasksWrote,
    tasksBlocked,
    features,
    endpoints,
    vulnsBySeverity,
    testsAuthored,
    perTaskFileCount,
    perTaskBytes,
    fileTypeBreakdown,
  };
}

/**
 * Resolve a task id to a friendly label, falling back to the id itself if no
 * mapping is provided. Used by every per-task chart, grid, and table so the
 * reader never sees raw "t-shell-1" jargon.
 */
function labelFor(taskId: string, taskLabels?: Record<string, string>): string {
  if (!taskLabels) return taskId;
  const v = taskLabels[taskId];
  return v && v.trim() ? v : taskId;
}

function extOf(path: string): string {
  const i = path.lastIndexOf(".");
  if (i === -1) return "other";
  const ext = path.slice(i).toLowerCase();
  if (ext === ".tsx" || ext === ".ts") return ".ts/.tsx";
  return ext;
}

// ---------- 1. Cover ----------

function drawCover(
  doc: PDFKit.PDFDocument,
  input: ProjectReportInput,
  m: ProjectMetrics,
  now: Date,
): void {
  // Brand band
  doc.save().fillColor(C.brand).rect(0, 0, PAGE.width, 160).fill().restore();
  doc.save().fillColor(C.white);
  doc.font("Helvetica-Bold").fontSize(11);
  doc.text(pdfSafe("YOUR AI ORGANISATION SHIPPED"), PAGE.margin.left, 36, {
    width: CW,
    lineBreak: false,
  });
  doc.font("Helvetica-Bold").fontSize(34);
  doc.text(pdfSafe(input.projectName), PAGE.margin.left, 60, { width: CW, lineBreak: false });
  doc.font("Helvetica").fontSize(11);
  doc.text(
    pdfSafe(`A complete, runnable application built end-to-end by 6 AI agents in ${m.tasksTotal} atomic tasks.`),
    PAGE.margin.left,
    108,
    { width: CW, lineBreak: false },
  );
  doc.restore();

  doc.x = PAGE.margin.left;
  doc.y = 192;

  // Idea callout
  drawCallout(doc, "WHAT YOU ASKED FOR", input.idea);

  doc.moveDown(1.2);

  // 4 KPI cards in a 2x2 grid
  const cards = [
    { label: "Files generated", value: String(m.totalFiles), accent: C.brand, sub: `${prettyBytes(m.totalBytes)} of source code` },
    { label: "Lines of code", value: shortNumber(m.totalLines || estimateLines(m.totalBytes)), accent: C.info, sub: m.totalLines > 0 ? "actual line count" : "estimated" },
    { label: "Tasks succeeded", value: `${m.tasksWrote} / ${m.tasksTotal}`, accent: m.tasksBlocked === 0 ? C.ok : C.warn, sub: m.tasksBlocked === 0 ? "every task passed QA + security" : `${m.tasksBlocked} blocked` },
    { label: "Critical issues", value: String(m.vulnsBySeverity.critical + m.vulnsBySeverity.high), accent: m.vulnsBySeverity.critical + m.vulnsBySeverity.high === 0 ? C.ok : C.err, sub: "from automated security audit" },
  ];
  drawKpiGrid(doc, cards);

  // Bottom strip: build stamp
  const yStamp = PAGE.height - PAGE.margin.bottom - 24;
  doc.font("Helvetica").fontSize(9).fillColor(C.textMuted);
  doc.text(
    pdfSafe(`Built at ${now.toISOString().slice(0, 19).replace("T", " ")} UTC  |  Output: ${input.outputDir}`),
    PAGE.margin.left,
    yStamp,
    { width: CW, lineBreak: false },
  );
}

// ---------- 2. What you built ----------

function drawWhatYouBuilt(
  doc: PDFKit.PDFDocument,
  input: ProjectReportInput,
  m: ProjectMetrics,
): void {
  drawSection(doc, "What you built", "Each feature is a piece of the app a real user can touch.");

  if (m.features.length === 0) {
    doc.font("Helvetica").fontSize(11).fillColor(C.textMuted);
    doc.text("No features were defined.", PAGE.margin.left, doc.y, { width: CW });
    return;
  }

  // Two-column feature cards
  const colW = (CW - 16) / 2;
  const cardH = 110;
  let col = 0;
  let rowY = doc.y;
  for (let i = 0; i < m.features.length; i++) {
    const f = m.features[i];
    const x = PAGE.margin.left + col * (colW + 16);
    drawFeatureCard(doc, x, rowY, colW, cardH, f);
    col++;
    if (col === 2) {
      col = 0;
      rowY += cardH + 12;
    }
  }
  if (col === 1) rowY += cardH + 12;
  doc.y = rowY + 8;

  // Bottom row: API endpoints + tabs delivered
  doc.moveDown(0.4);
  drawCallout(
    doc,
    "ALSO INCLUDED",
    `${m.endpoints} HTTP API endpoint${m.endpoints === 1 ? "" : "s"}, ${input.runs.length} build steps with full QA + security audit, ${m.testsAuthored} automated tests, mock-data seeding so the app works on first run.`,
  );
}

function drawFeatureCard(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  f: ProjectMetrics["features"][number],
): void {
  doc.save();
  doc.fillColor(C.panel).roundedRect(x, y, w, h, 8).fill();
  doc.strokeColor(C.border).lineWidth(1).roundedRect(x, y, w, h, 8).stroke();
  doc.restore();

  // Status badge top-right
  const done = f.tasksDone === f.taskCount && f.taskCount > 0;
  const badgeColor = done ? C.ok : f.tasksDone > 0 ? C.warn : C.textMuted;
  const badgeText = done ? "DELIVERED" : `${f.tasksDone}/${f.taskCount} done`;
  doc.font("Helvetica-Bold").fontSize(8);
  const bw = doc.widthOfString(badgeText) + 10;
  doc.save().fillColor(badgeColor).roundedRect(x + w - bw - 12, y + 12, bw, 16, 3).fill().restore();
  doc.fillColor(C.white).text(pdfSafe(badgeText), x + w - bw - 12, y + 16, { width: bw, align: "center", lineBreak: false });

  // Title
  doc.font("Helvetica-Bold").fontSize(12).fillColor(C.text);
  doc.text(pdfSafe(f.name), x + 14, y + 14, { width: w - bw - 30, lineBreak: false, ellipsis: true });

  // Description
  doc.font("Helvetica").fontSize(9).fillColor(C.textMuted);
  doc.text(pdfSafe(f.description), x + 14, y + 36, {
    width: w - 28,
    height: 50,
    ellipsis: true,
    lineGap: 1,
  });

  // Bottom strip: file count + size
  doc.font("Helvetica").fontSize(8).fillColor(C.textMuted);
  doc.text(
    pdfSafe(`${f.files} file${f.files === 1 ? "" : "s"}  -  ${prettyBytes(f.bytes)}`),
    x + 14,
    y + h - 18,
    { width: w - 28, lineBreak: false },
  );
}

// ---------- 3. Try it now ----------

function drawTryItNow(doc: PDFKit.PDFDocument, input: ProjectReportInput): void {
  drawSection(doc, "Try it right now", "Follow these steps to use the app the AI just built for you.");

  const steps = input.userJourney ?? [
    "Open the app in your browser",
    "Sign in",
    "Explore the dashboard",
    "Place an order",
    "Sign out",
  ];

  let y = doc.y;
  const stepH = 44;
  for (let i = 0; i < steps.length; i++) {
    drawJourneyStep(doc, PAGE.margin.left, y, CW, stepH, i + 1, steps[i]);
    y += stepH + 8;
  }
  doc.y = y + 8;

  // Credentials callout
  if (input.credentials && input.credentials.length > 0) {
    drawCallout(
      doc,
      "PRE-FILLED CREDENTIALS",
      input.credentials.map((c) => `${c.label}: ${c.value}`).join("    "),
    );
  }
}

function drawJourneyStep(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  n: number,
  text: string,
): void {
  // Step container
  doc.save();
  doc.fillColor(C.panel).roundedRect(x, y, w, h, 6).fill();
  doc.strokeColor(C.border).lineWidth(1).roundedRect(x, y, w, h, 6).stroke();
  doc.restore();

  // Numbered circle
  const cx = x + 22;
  const cy = y + h / 2;
  doc.save().fillColor(C.brand).circle(cx, cy, 14).fill().restore();
  doc.font("Helvetica-Bold").fontSize(12).fillColor(C.white);
  const nStr = String(n);
  const nW = doc.widthOfString(nStr);
  doc.text(nStr, cx - nW / 2, cy - 7, { width: nW + 2, lineBreak: false });

  // Step text
  doc.font("Helvetica").fontSize(11).fillColor(C.text);
  doc.text(pdfSafe(text), x + 48, y + h / 2 - 7, {
    width: w - 60,
    lineBreak: false,
    ellipsis: true,
  });
}

// ---------- 4. Build metrics (charts) ----------

function drawBuildMetrics(
  doc: PDFKit.PDFDocument,
  input: ProjectReportInput,
  m: ProjectMetrics,
): void {
  drawSection(doc, "Build metrics", "How much code each part of the app needed, in plain language.");

  // Headline KPI strip (3 cards)
  const totals = [
    { label: "Total files", value: String(m.totalFiles), accent: C.brand },
    { label: "Total size", value: prettyBytes(m.totalBytes), accent: C.info },
    { label: "Lines of code", value: shortNumber(m.totalLines || estimateLines(m.totalBytes)), accent: C.ok },
  ];
  drawTotalsStrip(doc, totals);
  doc.moveDown(0.6);

  // Code per feature - the headline chart, replaces the old per-task bars.
  drawSubheading(doc, "Code per feature");
  doc.font("Helvetica").fontSize(9).fillColor(C.textMuted);
  doc.text(
    pdfSafe("Each bar is one feature of the app. Bar width shows how much code was generated for it."),
    PAGE.margin.left,
    doc.y,
    { width: CW, lineGap: 1 },
  );
  doc.moveDown(0.4);
  drawFeatureBarChart(doc, m.features);
  doc.moveDown(0.8);

  // Two-column row: file-type donut on the left, donut legend / stats on the right
  drawSubheading(doc, "File-type mix");
  drawTwoColumnDonut(doc, {
    segments: m.fileTypeBreakdown.map((s) => ({ value: s.bytes, color: s.color, label: s.ext })),
    centerLabel: prettyBytes(m.totalBytes),
    centerSub: "total",
    formatValue: (v) => prettyBytes(v),
  });
}

/**
 * Per-feature horizontal bars. Each row shows:
 *   [color swatch] feature name              ████████████████████ 17.8 KB / 2 files / 2 of 2 done
 * The swatch + bar fill use the feature's stable color so charts on later
 * pages can refer back to the same swatch for the same feature.
 */
function drawFeatureBarChart(doc: PDFKit.PDFDocument, features: FeatureMetric[]): void {
  if (features.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor(C.textMuted);
    doc.text("No features to chart.", PAGE.margin.left, doc.y, { width: CW });
    return;
  }
  const swatch = 10;
  const swatchGap = 6;
  const labelW = 200; // Wide enough for 30-35 char feature names without wrap
  const trackW = 140;
  const valueW = CW - swatch - swatchGap - labelW - 4 - trackW - 8;
  const barH = 16;
  const max = Math.max(1, ...features.map((f) => f.bytes));
  let y = doc.y;
  for (const f of features) {
    // Color swatch
    doc.save().fillColor(f.color).roundedRect(PAGE.margin.left, y + 3, swatch, swatch, 2).fill().restore();
    // Feature name (proactively truncated so pdf-parse never sees a soft-wrap)
    doc.font("Helvetica-Bold").fontSize(10).fillColor(C.text);
    doc.text(truncate(f.name, 36), PAGE.margin.left + swatch + swatchGap, y + 1, {
      width: labelW - swatch - swatchGap,
      lineBreak: false,
      ellipsis: true,
    });
    // Track (light bg)
    const trackX = PAGE.margin.left + swatch + swatchGap + labelW + 4;
    doc.save().fillColor(C.panel).roundedRect(trackX, y, trackW, barH, 3).fill().restore();
    // Bar
    const barW = (f.bytes / max) * trackW;
    if (barW > 0.5) {
      doc.save().fillColor(f.color).roundedRect(trackX, y, Math.max(barW, 4), barH, 3).fill().restore();
    }
    // Value: "17.8 KB - 2 files - 2/2"
    const valStr = `${prettyBytes(f.bytes)}  -  ${f.files} file${f.files === 1 ? "" : "s"}  -  ${f.tasksDone}/${f.taskCount}`;
    doc.font("Helvetica").fontSize(9).fillColor(C.textMuted);
    doc.text(pdfSafe(valStr), trackX + trackW + 8, y + 3, { width: valueW, lineBreak: false });
    y += barH + 6;
  }
  doc.y = y;
  doc.x = PAGE.margin.left;
}

/**
 * Two-column donut layout. Left column is the donut + center label; right
 * column is a stacked legend showing color swatch / label / value / percent.
 */
interface DonutLayoutOptions {
  segments: Array<{ value: number; color: string; label: string }>;
  centerLabel: string;
  centerSub: string;
  formatValue: (v: number) => string;
}

function drawTwoColumnDonut(doc: PDFKit.PDFDocument, opts: DonutLayoutOptions): void {
  const blockH = 150;
  const yTop = doc.y;
  const leftColW = 200;
  const rightColX = PAGE.margin.left + leftColW + 16;
  const rightColW = CW - leftColW - 16;

  // Left: donut centered in its column
  const cx = PAGE.margin.left + leftColW / 2;
  const cy = yTop + blockH / 2;
  drawDonut(doc, cx, cy, 60, 36, opts.segments);

  // Center label inside donut
  doc.font("Helvetica-Bold").fontSize(13).fillColor(C.text);
  const lw = doc.widthOfString(opts.centerLabel);
  doc.text(pdfSafe(opts.centerLabel), cx - lw / 2, cy - 12, { width: lw + 4, lineBreak: false });
  doc.font("Helvetica").fontSize(9).fillColor(C.textMuted);
  const sw = doc.widthOfString(opts.centerSub);
  doc.text(pdfSafe(opts.centerSub), cx - sw / 2, cy + 6, { width: sw + 4, lineBreak: false });

  // Right: stacked legend rows
  const total = opts.segments.reduce((a, s) => a + s.value, 0);
  let ry = yTop + 8;
  const rowH = 22;
  for (const s of opts.segments) {
    if (ry + rowH > yTop + blockH) break;
    const pct = total === 0 ? 0 : (s.value / total) * 100;
    doc.save().fillColor(s.color).roundedRect(rightColX, ry + 4, 12, 12, 3).fill().restore();
    doc.font("Helvetica-Bold").fontSize(10).fillColor(C.text);
    doc.text(pdfSafe(s.label), rightColX + 18, ry + 3, { width: rightColW - 100, lineBreak: false, ellipsis: true });
    const valueStr = `${opts.formatValue(s.value)}  (${pct.toFixed(0)}%)`;
    doc.font("Helvetica").fontSize(10).fillColor(C.textMuted);
    doc.text(pdfSafe(valueStr), rightColX + rightColW - 100, ry + 3, {
      width: 100,
      align: "right",
      lineBreak: false,
    });
    ry += rowH;
  }

  doc.y = yTop + blockH + 6;
  doc.x = PAGE.margin.left;
}

/**
 * Draw a donut chart using SVG arc paths.
 *
 * Geometry: PDF coordinate space has Y growing downwards, so we start the
 * first segment at -PI/2 (12 o'clock visually) and sweep CLOCKWISE (positive
 * angle increment). The outer arc uses sweep flag 1 (clockwise), the inner
 * arc returns counter-clockwise with sweep flag 0.
 *
 * Edge cases:
 *  - All segments zero (or empty)  : draws an empty grey ring
 *  - Exactly one non-zero segment  : draws a full annulus (no arcs)
 *  - Otherwise                     : one arc-shaped wedge per segment
 */
function drawDonut(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  segments: Array<{ value: number; color: string; label: string }>,
): void {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  if (total === 0) {
    doc.save()
      .fillColor(C.border).circle(cx, cy, outerR).fill()
      .fillColor(C.white).circle(cx, cy, innerR).fill()
      .restore();
    return;
  }
  const active = segments.filter((s) => s.value > 0);
  if (active.length === 1) {
    doc.save()
      .fillColor(active[0].color).circle(cx, cy, outerR).fill()
      .fillColor(C.white).circle(cx, cy, innerR).fill()
      .restore();
    return;
  }
  let startAngle = -Math.PI / 2;
  for (const s of active) {
    const sweep = (s.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sweep;
    const largeArc = sweep > Math.PI ? 1 : 0;
    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);
    const x3 = cx + innerR * Math.cos(endAngle);
    const y3 = cy + innerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(startAngle);
    const y4 = cy + innerR * Math.sin(startAngle);
    const path =
      `M ${x1.toFixed(2)} ${y1.toFixed(2)} ` +
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} ` +
      `L ${x3.toFixed(2)} ${y3.toFixed(2)} ` +
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
    doc.save().fillColor(s.color).path(path).fill().restore();
    startAngle = endAngle;
  }
}

// ---------- 5. Quality scorecard ----------

function drawQuality(
  doc: PDFKit.PDFDocument,
  input: ProjectReportInput,
  m: ProjectMetrics,
): void {
  drawSection(doc, "Quality scorecard", "Every feature went through Build → QA → Security checks. All numbers below are automated.");

  drawHeadlineBanner(doc, m);
  doc.moveDown(0.6);

  // Per-feature delivery: one row per feature with progress bar + status pill
  drawSubheading(doc, "Per-feature delivery");
  doc.font("Helvetica").fontSize(9).fillColor(C.textMuted);
  doc.text(
    pdfSafe("Each row is one feature. The bar shows how many of its tasks finished with QA + Security passing."),
    PAGE.margin.left,
    doc.y,
    { width: CW, lineGap: 1 },
  );
  doc.moveDown(0.4);
  drawFeatureDeliveryGrid(doc, m.features);
  doc.moveDown(0.6);

  // Security findings: donut + count list (more visual than the old card row)
  drawSubheading(doc, "Security audit findings");
  doc.font("Helvetica").fontSize(9).fillColor(C.textMuted);
  doc.text(
    pdfSafe("All findings are flagged automatically by the security agent. Critical / high block the build; medium / low are recorded for follow-up."),
    PAGE.margin.left,
    doc.y,
    { width: CW, lineGap: 1 },
  );
  doc.moveDown(0.4);
  drawSecurityDonut(doc, m);
  doc.moveDown(0.4);

  // Tests summary
  drawCallout(
    doc,
    "AUTOMATED TESTS",
    `${m.testsAuthored} test scenario${m.testsAuthored === 1 ? "" : "s"} authored across ${m.tasksTotal} build step${m.tasksTotal === 1 ? "" : "s"}. QA reviewed every developer output before code was written to disk.`,
  );
}

function drawHeadlineBanner(doc: PDFKit.PDFDocument, m: ProjectMetrics): void {
  const allOk = m.tasksWrote === m.tasksTotal && m.vulnsBySeverity.critical + m.vulnsBySeverity.high === 0;
  const color = allOk ? C.ok : C.warn;
  const soft = allOk ? C.okSoft : C.warnSoft;
  const headline = allOk ? "All gates green - shipped." : `${m.tasksBlocked} of ${m.tasksTotal} task(s) blocked`;
  const sub = allOk
    ? `${m.tasksWrote}/${m.tasksTotal} tasks wrote files. 0 critical or high security findings.`
    : `Review the per-task gates below for blocked items.`;
  const x = PAGE.margin.left;
  const y = doc.y;
  const h = 60;
  doc.save().fillColor(soft).roundedRect(x, y, CW, h, 8).fill().restore();
  doc.save().strokeColor(color).lineWidth(2).roundedRect(x, y, CW, h, 8).stroke().restore();
  // Left bar
  doc.save().fillColor(color).rect(x, y, 6, h).fill().restore();
  doc.font("Helvetica-Bold").fontSize(14).fillColor(color);
  doc.text(pdfSafe(headline), x + 22, y + 12, { width: CW - 36, lineBreak: false });
  doc.font("Helvetica").fontSize(10).fillColor(C.text);
  doc.text(pdfSafe(sub), x + 22, y + 32, { width: CW - 36, lineBreak: false });
  doc.y = y + h + 6;
  doc.x = PAGE.margin.left;
}

/**
 * One row per feature. Layout:
 *   [colored swatch]  Feature name              [progress track ████░░░] 2 / 2 tasks   [PASS pill]
 * The progress fill uses the feature's color; the pill is green when 100% of
 * the feature's tasks shipped, amber when partially shipped, grey when none.
 */
function drawFeatureDeliveryGrid(doc: PDFKit.PDFDocument, features: FeatureMetric[]): void {
  if (features.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor(C.textMuted);
    doc.text("No features to display.", PAGE.margin.left, doc.y, { width: CW });
    return;
  }
  const swatch = 10;
  const swatchGap = 6;
  const labelW = 200;
  const trackW = 130;
  const taskCountW = 64;
  const pillW = CW - swatch - swatchGap - labelW - 4 - trackW - 8 - taskCountW - 6;
  const rowH = 22;
  let y = doc.y;
  for (const f of features) {
    const pct = f.taskCount === 0 ? 0 : f.tasksDone / f.taskCount;
    const allDone = f.tasksDone === f.taskCount && f.taskCount > 0;
    const pillColor = allDone ? C.ok : f.tasksDone > 0 ? C.warn : C.textMuted;
    const pillText = allDone ? "DELIVERED" : f.tasksDone > 0 ? "PARTIAL" : "PENDING";
    // Swatch
    doc.save().fillColor(f.color).roundedRect(PAGE.margin.left, y + 6, swatch, swatch, 2).fill().restore();
    // Name (truncate at source for clean pdf-parse output)
    doc.font("Helvetica-Bold").fontSize(10).fillColor(C.text);
    doc.text(truncate(f.name, 36), PAGE.margin.left + swatch + swatchGap, y + 4, {
      width: labelW - swatch - swatchGap,
      lineBreak: false,
      ellipsis: true,
    });
    // Progress track + fill
    const trackX = PAGE.margin.left + swatch + swatchGap + labelW + 4;
    doc.save().fillColor(C.panel).roundedRect(trackX, y + 4, trackW, 14, 3).fill().restore();
    if (pct > 0) {
      const fillW = Math.max(4, pct * trackW);
      doc.save().fillColor(f.color).roundedRect(trackX, y + 4, fillW, 14, 3).fill().restore();
    }
    // Task count text
    const taskCountText = `${f.tasksDone} / ${f.taskCount} task${f.taskCount === 1 ? "" : "s"}`;
    doc.font("Helvetica").fontSize(9).fillColor(C.textMuted);
    doc.text(pdfSafe(taskCountText), trackX + trackW + 8, y + 6, {
      width: taskCountW,
      lineBreak: false,
    });
    // Status pill
    const pillX = trackX + trackW + 8 + taskCountW + 6;
    doc.save().fillColor(pillColor).roundedRect(pillX, y + 4, pillW, 14, 3).fill().restore();
    doc.font("Helvetica-Bold").fontSize(8).fillColor(C.white);
    doc.text(pdfSafe(pillText), pillX, y + 7, { width: pillW, align: "center", lineBreak: false });
    y += rowH;
  }
  doc.y = y;
  doc.x = PAGE.margin.left;
}

/**
 * Two-column layout: severity donut on the left, severity row breakdown
 * (with color swatch / count / impact note) on the right. When all four
 * counts are zero, the donut renders as an "all clear" empty grey ring with
 * a green check note.
 */
function drawSecurityDonut(doc: PDFKit.PDFDocument, m: ProjectMetrics): void {
  const segments = [
    { label: "Critical", value: m.vulnsBySeverity.critical, color: C.err },
    { label: "High", value: m.vulnsBySeverity.high, color: "#f97316" }, // orange
    { label: "Medium", value: m.vulnsBySeverity.medium, color: C.warn },
    { label: "Low", value: m.vulnsBySeverity.low, color: C.info },
  ];
  const total = segments.reduce((a, s) => a + s.value, 0);
  const blockH = 142;
  const yTop = doc.y;
  const leftColW = 200;
  const rightColX = PAGE.margin.left + leftColW + 16;
  const rightColW = CW - leftColW - 16;
  const cx = PAGE.margin.left + leftColW / 2;
  const cy = yTop + blockH / 2;

  drawDonut(doc, cx, cy, 56, 34, segments);

  // Center label
  doc.font("Helvetica-Bold").fontSize(18).fillColor(C.text);
  const lw = doc.widthOfString(String(total));
  doc.text(String(total), cx - lw / 2, cy - 14, { width: lw + 4, lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor(C.textMuted);
  const sub = total === 0 ? "all clear" : "findings";
  const sw = doc.widthOfString(sub);
  doc.text(pdfSafe(sub), cx - sw / 2, cy + 6, { width: sw + 4, lineBreak: false });

  // Right column: severity rows with impact text
  const impacts: Record<string, string> = {
    Critical: "blocks build",
    High: "blocks build",
    Medium: "logged - not blocking",
    Low: "informational",
  };
  let ry = yTop + 8;
  const rowH = 28;
  for (const s of segments) {
    if (ry + rowH > yTop + blockH) break;
    // swatch
    doc.save().fillColor(s.value === 0 ? C.border : s.color).roundedRect(rightColX, ry + 6, 12, 12, 3).fill().restore();
    // label + count line
    doc.font("Helvetica-Bold").fontSize(10).fillColor(s.value === 0 ? C.textMuted : C.text);
    doc.text(pdfSafe(s.label), rightColX + 18, ry + 4, { width: 80, lineBreak: false });
    // count (right aligned)
    doc.font("Helvetica-Bold").fontSize(13).fillColor(s.value === 0 ? C.textMuted : C.text);
    doc.text(String(s.value), rightColX + 100, ry, { width: 30, lineBreak: false });
    // impact line under label
    doc.font("Helvetica").fontSize(8).fillColor(C.textMuted);
    doc.text(pdfSafe(impacts[s.label] ?? ""), rightColX + 18, ry + 16, { width: rightColW - 30, lineBreak: false });
    ry += rowH;
  }

  doc.y = yTop + blockH + 6;
  doc.x = PAGE.margin.left;
}

// ---------- 6. How to run ----------

function drawHowToRun(doc: PDFKit.PDFDocument, input: ProjectReportInput): void {
  drawSection(doc, "How to run", "Open a terminal and run these commands.");

  // Code block
  const blockLines = input.howToRun.length === 0 ? ["(no steps provided)"] : input.howToRun;
  const lineH = 16;
  const blockH = blockLines.length * lineH + 24;
  const x = PAGE.margin.left;
  const y = doc.y;
  doc.save().fillColor(C.code).roundedRect(x, y, CW, blockH, 6).fill().restore();
  doc.font("Courier").fontSize(11).fillColor(C.codeText);
  let ly = y + 14;
  for (const line of blockLines) {
    doc.text(pdfSafe(line), x + 16, ly, { width: CW - 32, lineBreak: false });
    ly += lineH;
  }
  doc.y = y + blockH + 12;
  doc.x = PAGE.margin.left;

  // Credentials box
  if (input.credentials && input.credentials.length > 0) {
    drawCallout(
      doc,
      "PRE-FILLED CREDENTIALS",
      input.credentials.map((c) => `${c.label}: ${c.value}`).join("    "),
    );
    doc.moveDown(0.4);
  }

  // Output dir
  drawCallout(doc, "WHERE THE CODE LIVES", input.outputDir);
}

// ---------- 7. Appendix ----------

function drawAppendix(
  doc: PDFKit.PDFDocument,
  input: ProjectReportInput,
  m: ProjectMetrics,
): void {
  drawSection(
    doc,
    "Appendix - what shipped, by feature",
    "Each feature lists the build steps that delivered it. Open _reports/ for the full developer / QA / security writeup of any step.",
  );

  if (m.features.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor(C.textMuted);
    doc.text("No features to display.", PAGE.margin.left, doc.y, { width: CW });
    return;
  }

  for (const f of m.features) {
    drawFeatureBlock(doc, input, m, f);
    doc.moveDown(0.4);
  }
}

/**
 * One block per feature: colored stripe + name + headline stats + indented
 * task rows underneath. Each task row uses the friendly label (taskLabels[id]
 * if provided, falling back to the raw id) so a non-engineer never sees
 * "t-shell-1".
 */
function drawFeatureBlock(
  doc: PDFKit.PDFDocument,
  input: ProjectReportInput,
  m: ProjectMetrics,
  f: FeatureMetric,
): void {
  // Header band
  const xLeft = PAGE.margin.left;
  const headerH = 26;
  const yHead = doc.y;
  doc.save().fillColor(C.panel).roundedRect(xLeft, yHead, CW, headerH, 4).fill().restore();
  doc.save().fillColor(f.color).rect(xLeft, yHead, 5, headerH).fill().restore();
  doc.font("Helvetica-Bold").fontSize(11).fillColor(C.text);
  doc.text(pdfSafe(f.name), xLeft + 14, yHead + 7, { width: CW - 200, lineBreak: false, ellipsis: true });
  // Right-aligned stats
  const statText = `${f.tasksDone}/${f.taskCount} step${f.taskCount === 1 ? "" : "s"}  -  ${f.files} file${f.files === 1 ? "" : "s"}  -  ${prettyBytes(f.bytes)}`;
  doc.font("Helvetica").fontSize(9).fillColor(C.textMuted);
  doc.text(pdfSafe(statText), xLeft + CW - 200, yHead + 9, { width: 192, align: "right", lineBreak: false });
  doc.y = yHead + headerH + 4;

  // Task rows under header
  if (f.taskIds.length === 0) {
    doc.font("Helvetica").fontSize(9).fillColor(C.textMuted);
    doc.text("(no build steps)", xLeft + 18, doc.y, { width: CW - 18, lineBreak: false });
    doc.moveDown(0.3);
    return;
  }
  for (const taskId of f.taskIds) {
    drawTaskRow(doc, input, m, taskId);
  }
}

function drawTaskRow(
  doc: PDFKit.PDFDocument,
  input: ProjectReportInput,
  m: ProjectMetrics,
  taskId: string,
): void {
  const run = input.runs.find((r) => r.selectedTask?.id === taskId);
  const files = m.perTaskFileCount.get(taskId) ?? 0;
  const bytes = m.perTaskBytes.get(taskId) ?? 0;
  const ok = run ? run.decision === "WROTE_FILES" : false;
  const xLeft = PAGE.margin.left;
  const rowH = 18;
  const y = doc.y;
  // Bullet dot
  doc.save().fillColor(ok ? C.ok : C.err).circle(xLeft + 14, y + 9, 3).fill().restore();
  // Label (friendly)
  doc.font("Helvetica").fontSize(10).fillColor(C.text);
  doc.text(pdfSafe(labelFor(taskId, input.taskLabels)), xLeft + 22, y + 4, {
    width: CW - 22 - 200,
    lineBreak: false,
    ellipsis: true,
  });
  // Right-aligned stats
  const stats = `${files} file${files === 1 ? "" : "s"}  -  ${prettyBytes(bytes)}  -  ${ok ? "shipped" : "blocked"}`;
  doc.font("Helvetica").fontSize(9).fillColor(ok ? C.textMuted : C.err);
  doc.text(pdfSafe(stats), xLeft + CW - 200, y + 5, { width: 192, align: "right", lineBreak: false });
  doc.y = y + rowH;
  doc.x = PAGE.margin.left;
}

// ---------- low-level building blocks ----------

function drawSection(doc: PDFKit.PDFDocument, title: string, subtitle?: string): void {
  doc.x = PAGE.margin.left;
  doc.y = PAGE.margin.top;
  doc.font("Helvetica-Bold").fontSize(22).fillColor(C.brandDark);
  doc.text(pdfSafe(title), PAGE.margin.left, doc.y, { width: CW, lineBreak: false });
  // Underline
  const ly = doc.y + 4;
  doc.save().strokeColor(C.brand).lineWidth(2).moveTo(PAGE.margin.left, ly).lineTo(PAGE.margin.left + 70, ly).stroke().restore();
  doc.y = ly + 8;
  if (subtitle) {
    doc.font("Helvetica").fontSize(11).fillColor(C.textMuted);
    doc.text(pdfSafe(subtitle), PAGE.margin.left, doc.y, { width: CW, lineGap: 2 });
    doc.moveDown(0.6);
  } else {
    doc.moveDown(0.4);
  }
}

function drawSubheading(doc: PDFKit.PDFDocument, text: string): void {
  doc.font("Helvetica-Bold").fontSize(11).fillColor(C.text);
  doc.text(pdfSafe(text), PAGE.margin.left, doc.y, { width: CW, lineBreak: false });
  doc.moveDown(0.4);
}

function drawCallout(doc: PDFKit.PDFDocument, label: string, body: string): void {
  const x = PAGE.margin.left;
  const y = doc.y;
  // Measure: label one line + body wrapped
  doc.font("Helvetica").fontSize(10);
  const textHeight = doc.heightOfString(pdfSafe(body), { width: CW - 28, lineGap: 2 });
  const h = 18 + 6 + textHeight + 14;
  doc.save().fillColor(C.brandSoft).roundedRect(x, y, CW, h, 6).fill().restore();
  doc.save().strokeColor(C.brand).lineWidth(1).roundedRect(x, y, CW, h, 6).stroke().restore();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.brandDark);
  doc.text(pdfSafe(label), x + 14, y + 10, { width: CW - 28, lineBreak: false });
  doc.font("Helvetica").fontSize(10).fillColor(C.text);
  doc.text(pdfSafe(body), x + 14, y + 28, { width: CW - 28, lineGap: 2 });
  doc.y = y + h + 8;
  doc.x = PAGE.margin.left;
}

function drawKpiGrid(doc: PDFKit.PDFDocument, cards: Array<{ label: string; value: string; accent: string; sub: string }>): void {
  const colW = (CW - 16) / 2;
  const cardH = 90;
  const startY = doc.y;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = PAGE.margin.left + col * (colW + 16);
    const y = startY + row * (cardH + 14);

    doc.save().fillColor(C.white).roundedRect(x, y, colW, cardH, 8).fill().restore();
    doc.save().strokeColor(C.border).lineWidth(1).roundedRect(x, y, colW, cardH, 8).stroke().restore();
    // Accent stripe
    doc.save().fillColor(c.accent).rect(x, y, 6, cardH).fill().restore();

    doc.font("Helvetica-Bold").fontSize(9).fillColor(c.accent);
    doc.text(pdfSafe(c.label.toUpperCase()), x + 18, y + 14, { width: colW - 28, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(28).fillColor(C.text);
    doc.text(pdfSafe(c.value), x + 18, y + 30, { width: colW - 28, lineBreak: false });
    doc.font("Helvetica").fontSize(9).fillColor(C.textMuted);
    doc.text(pdfSafe(c.sub), x + 18, y + cardH - 22, { width: colW - 28, lineBreak: false, ellipsis: true });
  }
  const rows = Math.ceil(cards.length / 2);
  doc.y = startY + rows * (cardH + 14);
  doc.x = PAGE.margin.left;
}

function drawTotalsStrip(doc: PDFKit.PDFDocument, totals: Array<{ label: string; value: string; accent: string }>): void {
  const cardW = (CW - 16) / totals.length;
  const cardH = 56;
  const y = doc.y;
  for (let i = 0; i < totals.length; i++) {
    const t = totals[i];
    const x = PAGE.margin.left + i * (cardW + 8);
    doc.save().fillColor(C.white).roundedRect(x, y, cardW, cardH, 6).fill().restore();
    doc.save().strokeColor(C.border).lineWidth(1).roundedRect(x, y, cardW, cardH, 6).stroke().restore();
    doc.save().fillColor(t.accent).rect(x, y, 4, cardH).fill().restore();
    doc.font("Helvetica-Bold").fontSize(8).fillColor(t.accent);
    doc.text(pdfSafe(t.label.toUpperCase()), x + 14, y + 10, { width: cardW - 22, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(20).fillColor(C.text);
    doc.text(pdfSafe(t.value), x + 14, y + 24, { width: cardW - 22, lineBreak: false });
  }
  doc.y = y + cardH + 8;
  doc.x = PAGE.margin.left;
}

function drawTableHeader(doc: PDFKit.PDFDocument, headers: string[], widths: number[]): void {
  const x = PAGE.margin.left;
  const y = doc.y;
  doc.save().fillColor(C.brandSoft).rect(x, y, sum(widths), 22).fill().restore();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.brandDark);
  let xx = x;
  for (let i = 0; i < headers.length; i++) {
    doc.text(pdfSafe(headers[i]), xx + 8, y + 7, { width: widths[i] - 16, lineBreak: false });
    xx += widths[i];
  }
  doc.y = y + 22;
  doc.x = PAGE.margin.left;
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  cells: string[],
  widths: number[],
  colors: string[],
): void {
  const x = PAGE.margin.left;
  const y = doc.y;
  doc.save().strokeColor(C.border).lineWidth(0.5).moveTo(x, y + 20).lineTo(x + sum(widths), y + 20).stroke().restore();
  let xx = x;
  for (let i = 0; i < cells.length; i++) {
    doc.font("Helvetica").fontSize(10).fillColor(colors[i] ?? C.text);
    doc.text(pdfSafe(cells[i]), xx + 8, y + 5, { width: widths[i] - 16, lineBreak: false, ellipsis: true });
    xx += widths[i];
  }
  doc.y = y + 20;
  doc.x = PAGE.margin.left;
}

// ---------- footer (with the page-overflow fix) ----------

function addFooters(doc: PDFKit.PDFDocument, projectName: string, now: Date): void {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);

    // CRITICAL: PDFKit triggers an auto-page-break whenever doc.text() would
    // place a glyph below page.margins.bottom. We deliberately want to write
    // INTO the bottom gutter, so we zero the bottom margin for the duration
    // of this footer write and restore it after. Without this fix every
    // footer call adds a fresh blank page (the bug that turned a 7-page
    // report into a 66-page one).
    const origBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    try {
      const yLine = PAGE.height - 28;
      // Top divider
      doc.save().strokeColor(C.border).lineWidth(0.5).moveTo(PAGE.margin.left, yLine - 8).lineTo(PAGE.width - PAGE.margin.right, yLine - 8).stroke().restore();
      // Left text
      doc.font("Helvetica").fontSize(8).fillColor(C.textMuted);
      doc.text(
        pdfSafe(`${projectName}  -  AI Organisation Project Report`),
        PAGE.margin.left,
        yLine,
        { width: CW * 0.65, lineBreak: false },
      );
      // Right text
      doc.text(
        pdfSafe(`Page ${i + 1} of ${total}  -  ${now.toISOString().slice(0, 10)}`),
        PAGE.margin.left + CW * 0.65,
        yLine,
        { width: CW * 0.35, align: "right", lineBreak: false },
      );
    } finally {
      doc.page.margins.bottom = origBottom;
    }
  }
}

// ---------- misc helpers ----------

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function shortNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function estimateLines(bytes: number): number {
  // ~30 bytes per line on average for our generated TS/TSX/JSON.
  return Math.round(bytes / 30);
}

/**
 * Hard-truncate a string to maxLen characters, appending an ASCII ellipsis
 * when truncated. Used for chart labels where PDFKit's ellipsis option does
 * not always engage cleanly inside a single text box, so we proactively
 * shorten the source text to guarantee no soft-wrapping.
 */
function truncate(s: string, maxLen: number): string {
  const safe = pdfSafe(s);
  if (safe.length <= maxLen) return safe;
  return safe.slice(0, Math.max(1, maxLen - 3)) + "...";
}
