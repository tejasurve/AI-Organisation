// lib/platform/mcp/stitch.ts
//
// HTTP MCP client for the Stitch MCP server. The real tool surface (verified
// against `tools/list` on https://stitch.googleapis.com/mcp):
//
//   create_project({ title })                                  → { name: "projects/<id>", ... }
//   generate_screen_from_text({ projectId, prompt,
//                              deviceType, modelId,
//                              designSystem? })                → { projectId, sessionId,
//                                                                outputComponents: [
//                                                                  { designSystem: {...} },
//                                                                  { design: { screens: [{
//                                                                      id, name,
//                                                                      title, prompt,
//                                                                      screenshot: { downloadUrl },
//                                                                      htmlCode: { downloadUrl },
//                                                                      theme, designSystem, ...
//                                                                  }], theme } },
//                                                                  { text: "..." },
//                                                                  { suggestion: "..." }, ...
//                                                                ] }
//
//   edit_screens({ projectId, selectedScreenIds[], prompt,
//                  deviceType, modelId })                      → same shape as generate
//
//   list_screens({ projectId })                                → list of screen summaries
//
// Three things were wrong in the previous client:
//   1. Sent `projectName: "projects/<id>"` — Stitch wants `projectId: "<id>"` raw.
//   2. Sent `modelId: "GEMINI_3_PRO"` which is deprecated; must use GEMINI_3_1_PRO or GEMINI_3_FLASH.
//   3. Read `screen.imageUrl` — Stitch returns `screen.screenshot.downloadUrl`.
//
// Important: Stitch generations take 60-120 s per screen. We:
//   1. Return 4 demo placeholder screens IMMEDIATELY so the modal renders.
//   2. Fire `create_project` once + 4 parallel `generate_screen_from_text` calls
//      in the background.
//   3. As each real screen lands (≤ 5 min timeout) we hand it back through
//      `onLiveScreen(index, screen)` so the engine can swap the placeholder.

import { randomUUID } from "node:crypto";

import { getSecret } from "../vault/secrets.ts";

const STITCH_URL = "https://stitch.googleapis.com/mcp";

const LIVE_TIMEOUT_MS = 5 * 60 * 1000;
const STITCH_MODEL_ID = "GEMINI_3_1_PRO";

export interface GeneratedScreen {
  id: string;
  title: string;
  caption: string;
  thumbnailUrl: string;
  /** Canonical Stitch app URL where the user can edit the screen. */
  figmaUrl: string;
  source: "stitch" | "demo";
  /** Raw Stitch screen id (without the "screens/" prefix). */
  stitchScreenId?: string;
  /** Raw Stitch project id (without the "projects/" prefix). */
  stitchProjectId?: string;
  /** URL where the generated HTML can be downloaded. */
  htmlDownloadUrl?: string;
}

export interface GenerateScreensInput {
  brief: string;
  productName: string;
  count?: number;
}

export interface RedesignScreenInput {
  screen: GeneratedScreen;
  prompt: string;
}

const STYLES = ["Minimal", "Playful", "Dense", "Premium"] as const;
type StyleName = (typeof STYLES)[number];

const STYLE_DIRECTIONS: Record<StyleName, string> = {
  Minimal: "Generous whitespace, a single clear CTA, calm typography, light mode.",
  Playful: "Warm colours, soft shapes, friendly micro-copy, illustrative accents.",
  Dense: "Information density, multi-column dashboard layout, pro-user workflows.",
  Premium: "Deep contrast, considered typography, slow motion, editorial dark-mode feel.",
};

// ---------- Public API ----------

/**
 * Returns 4 demo placeholders synchronously so the UI is always interactive,
 * and fires live Stitch generations in the background. Each live screen, when
 * it completes, is passed to `onLiveScreen(index, screen)` so the caller can
 * swap it in. If Stitch isn't configured or fails, placeholders simply stay.
 */
export function generateScreens(
  input: GenerateScreensInput & {
    onLiveScreen?: (index: number, screen: GeneratedScreen) => void;
  },
): GeneratedScreen[] {
  const count = input.count ?? 4;
  const placeholders = demoScreens(input.productName, count);
  const key = getSecret("stitch");
  if (!key) return placeholders;

  void (async () => {
    try {
      const projectId = await withTimeout(
        createStitchProject(key, input.productName),
        30_000,
        null,
      );
      if (!projectId) {
        console.warn("[stitch] create_project returned no id; keeping demo placeholders");
        return;
      }
      for (let i = 0; i < count; i++) {
        const idx = i;
        const style = STYLES[idx % STYLES.length];
        void (async () => {
          try {
            const real = await withTimeout(
              generateOneScreen(key, projectId, input.productName, style, input.brief),
              LIVE_TIMEOUT_MS,
              null,
            );
            if (real && input.onLiveScreen) {
              input.onLiveScreen(idx, real);
            }
          } catch (err) {
            console.warn(`[stitch] generate (${style}) failed:`, err);
          }
        })();
      }
    } catch (err) {
      console.warn("[stitch] background generate orchestration failed:", err);
    }
  })();

  return placeholders;
}

/**
 * Generate a single supplementary screen for a feature that the locked design
 * doesn't yet cover. Used by the `design-validation` workflow stage.
 *
 * If the locked screen has a `stitchProjectId`, we add the new screen to the
 * same Stitch project so the user can navigate between them in the Stitch web
 * app. If Stitch isn't configured, we fall back to a labelled placeholder.
 */
export async function generateSupplementaryScreen(input: {
  productName: string;
  brief: string;
  /** Locked aesthetic that the new screen MUST follow (Minimal/Playful/Dense/Premium). */
  theme: string;
  /** Re-use this Stitch projectId if the locked design has one. */
  projectId?: string;
  /** Feature name the supplementary screen is being generated to cover. */
  featureName: string;
}): Promise<GeneratedScreen> {
  const themedStyle = (STYLES.find(
    (s) => s.toLowerCase() === input.theme.toLowerCase(),
  ) ?? "Minimal") as StyleName;
  const key = getSecret("stitch");
  if (!key || !input.projectId) {
    return demoSupplementary(input.productName, input.featureName, themedStyle);
  }
  try {
    const real = await withTimeout(
      generateOneScreen(
        key,
        input.projectId,
        input.productName,
        themedStyle,
        `${input.brief}\n\nSupplementary screen for the feature: ${input.featureName}. Stay strictly within the ${themedStyle} aesthetic of the locked design.`,
      ),
      LIVE_TIMEOUT_MS,
      null,
    );
    if (real) return real;
  } catch (err) {
    console.warn("[stitch] supplementary screen failed:", err);
  }
  return demoSupplementary(input.productName, input.featureName, themedStyle);
}

function demoSupplementary(
  productName: string,
  featureName: string,
  style: StyleName,
): GeneratedScreen {
  return {
    id: `demo-supp-${randomUUID()}`,
    title: `${featureName} · ${style}`,
    caption: `Supplementary screen — ${STYLE_DIRECTIONS[style]}`,
    thumbnailUrl: placeholderImage(featureName, style.length + 7),
    figmaUrl: "https://stitch.withgoogle.com/",
    source: "demo",
  };
}

/**
 * Build a canonical Stitch web-app URL for the project (and optionally a
 * specific screen). Exported for the handoff-package UI.
 */
export function stitchAppUrlFor(
  projectId: string | undefined,
  screenId?: string,
): string {
  if (!projectId) return "https://stitch.withgoogle.com/";
  return stitchAppUrl(projectId, screenId ?? "");
}

export async function redesignScreen(
  input: RedesignScreenInput,
): Promise<GeneratedScreen> {
  const key = getSecret("stitch");
  if (!key) return demoRedesign(input);

  const { screen, prompt } = input;

  try {
    if (screen.stitchProjectId && screen.stitchScreenId) {
      const edited = await withTimeout(
        editOneScreen(key, screen.stitchProjectId, screen.stitchScreenId, prompt),
        LIVE_TIMEOUT_MS,
        null,
      );
      if (edited) return edited;
    }
  } catch (err) {
    console.warn("[stitch] edit failed:", err);
  }

  return demoRedesign(input);
}

// ---------- Stitch tool wrappers ----------

async function createStitchProject(
  key: string,
  title: string,
): Promise<string | null> {
  const r = await mcpCall(key, "create_project", { title });
  return extractProjectId(r);
}

async function generateOneScreen(
  key: string,
  projectId: string,
  productName: string,
  style: StyleName,
  brief: string,
): Promise<GeneratedScreen | null> {
  const prompt = [
    `Product: ${productName}`,
    `Brief: ${brief}`,
    `Style direction (${style}): ${STYLE_DIRECTIONS[style]}`,
    `Format: First-glance hero/landing screen of the product — the page a new user sees.`,
    `Always include an empty-state variant for the primary data area; design it before the happy path.`,
  ].join("\n");

  const r = await mcpCall(key, "generate_screen_from_text", {
    projectId,
    prompt,
    deviceType: "DESKTOP",
    modelId: STITCH_MODEL_ID,
  });
  return extractScreen(r, projectId, productName, style);
}

async function editOneScreen(
  key: string,
  projectId: string,
  screenId: string,
  prompt: string,
): Promise<GeneratedScreen | null> {
  const r = await mcpCall(key, "edit_screens", {
    projectId,
    selectedScreenIds: [screenId],
    prompt,
    deviceType: "DESKTOP",
    modelId: STITCH_MODEL_ID,
  });
  return extractScreen(r, projectId, "Revised", "Premium");
}

// ---------- MCP HTTP transport ----------

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: string | number;
  result?: T;
  error?: { code: number; message: string };
}

interface McpToolResult {
  content?: Array<{ type?: string; text?: string; json?: unknown }>;
  structuredContent?: unknown;
  isError?: boolean;
}

async function mcpCall(
  key: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  const body = {
    jsonrpc: "2.0" as const,
    id: randomUUID(),
    method: "tools/call",
    params: { name: toolName, arguments: args },
  };
  const r = await fetch(STITCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "X-Goog-Api-Key": key,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(`stitch http ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  const j = (await r.json()) as JsonRpcResponse<McpToolResult>;
  if (j.error) throw new Error(`stitch rpc: ${j.error.message}`);
  const result = j.result ?? {};
  if (result.isError) {
    const msg = firstTextBlock(result) ?? "unknown stitch error";
    throw new Error(`stitch tool ${toolName}: ${msg}`);
  }
  return result;
}

function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  return new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

// ---------- Response extractors ----------

function firstTextBlock(r: McpToolResult): string | null {
  if (!Array.isArray(r.content)) return null;
  for (const c of r.content) {
    if (c?.type === "text" && typeof c.text === "string") return c.text;
  }
  return null;
}

/**
 * Returns the raw project id (no "projects/" prefix), or null.
 *
 * Stitch returns: { content: [{type:'text', text:'{"name":"projects/<id>", ...}'}],
 *                   structuredContent: {name: "projects/<id>", ...} }
 */
function extractProjectId(r: McpToolResult): string | null {
  const obj = unwrapStructured(r) as
    | { name?: string; project?: { name?: string }; projectId?: string }
    | null;
  if (!obj) return null;
  if (typeof obj.projectId === "string") return stripPrefix(obj.projectId, "projects/");
  if (typeof obj.name === "string") return stripPrefix(obj.name, "projects/");
  if (obj.project?.name) return stripPrefix(obj.project.name, "projects/");
  return null;
}

interface RawScreen {
  id?: string;
  name?: string;
  title?: string;
  prompt?: string;
  screenshot?: { name?: string; downloadUrl?: string };
  htmlCode?: { name?: string; downloadUrl?: string; mimeType?: string };
}

/**
 * Pull the first screen out of generate_screen_from_text / edit_screens.
 * The relevant data is at:
 *   outputComponents.find(c => c.design).design.screens[0]
 */
function extractScreen(
  r: McpToolResult,
  fallbackProjectId: string,
  fallbackTitle: string,
  style: StyleName,
): GeneratedScreen | null {
  const obj = unwrapStructured(r) as
    | {
        projectId?: string;
        sessionId?: string;
        outputComponents?: Array<{
          design?: { screens?: RawScreen[]; theme?: unknown };
        }>;
      }
    | null;
  if (!obj) return null;

  const projectId = obj.projectId ?? fallbackProjectId;

  let screen: RawScreen | null = null;
  for (const comp of obj.outputComponents ?? []) {
    const screens = comp.design?.screens;
    if (Array.isArray(screens) && screens.length > 0) {
      screen = screens[0];
      break;
    }
  }
  if (!screen) return null;

  const screenId = screen.id ?? stripPrefix(screen.name ?? "", `projects/${projectId}/screens/`);
  const thumbnail = screen.screenshot?.downloadUrl;
  const html = screen.htmlCode?.downloadUrl;

  return {
    id: `stitch-${screenId || randomUUID()}`,
    title: screen.title ? `${screen.title} · ${style}` : `${fallbackTitle} · ${style}`,
    caption: STYLE_DIRECTIONS[style],
    thumbnailUrl: thumbnail ?? placeholderImage(fallbackTitle, style.length),
    figmaUrl: stitchAppUrl(projectId, screenId),
    source: "stitch",
    stitchScreenId: screenId || undefined,
    stitchProjectId: projectId,
    htmlDownloadUrl: html,
  };
}

function unwrapStructured(r: McpToolResult): unknown {
  if (r.structuredContent && typeof r.structuredContent === "object") {
    // Stitch sends `structuredContent: {}` for some responses — fall through if empty.
    if (Object.keys(r.structuredContent as object).length > 0) return r.structuredContent;
  }
  const text = firstTextBlock(r);
  if (text) {
    try {
      return JSON.parse(text);
    } catch {
      // not JSON — return raw text
      return text;
    }
  }
  return null;
}

function stripPrefix(s: string, prefix: string): string {
  return s.startsWith(prefix) ? s.slice(prefix.length) : s;
}

/**
 * Canonical link the user opens to view/edit the design in Stitch's web app.
 * Stitch hosts its UI at https://stitch.withgoogle.com.
 */
function stitchAppUrl(projectId: string, screenId: string): string {
  if (screenId) {
    return `https://stitch.withgoogle.com/projects/${projectId}/screens/${screenId}`;
  }
  return `https://stitch.withgoogle.com/projects/${projectId}`;
}

// ---------- Demo placeholders (always available) ----------

function demoScreens(productName: string, count: number): GeneratedScreen[] {
  const out: GeneratedScreen[] = [];
  for (let i = 0; i < count; i++) {
    const style = STYLES[i % STYLES.length];
    out.push({
      id: `demo-${randomUUID()}`,
      title: `${productName} · ${style}`,
      caption: STYLE_DIRECTIONS[style],
      thumbnailUrl: placeholderImage(productName, i),
      figmaUrl: "https://stitch.withgoogle.com/",
      source: "demo",
    });
  }
  return out;
}

function demoRedesign(input: RedesignScreenInput): GeneratedScreen {
  return {
    id: `demo-${randomUUID()}`,
    title: `${input.screen.title} · Revised`,
    caption: `Revised per: "${truncate(input.prompt, 60)}"`,
    thumbnailUrl: placeholderImage(input.screen.title, 99),
    figmaUrl: input.screen.figmaUrl,
    source: "demo",
  };
}

function placeholderImage(seed: string, index: number): string {
  const s = encodeURIComponent(`${seed}-${index}`);
  return `https://picsum.photos/seed/${s}/640/400`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
