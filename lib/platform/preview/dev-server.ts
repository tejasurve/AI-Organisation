// lib/platform/preview/dev-server.ts
//
// Manages child `next dev` processes — one per project — that serve the
// user's generated workspace. The parent (the AI Organisation dashboard) is
// itself a Next.js dev server; we spawn a SECOND, isolated dev server per
// project on a separate port so a misbehaving generated page can't crash
// the dashboard.
//
// Lifecycle:
//   1. startPreview(projectId)
//      - Find a free port (scan 5000..5099)
//      - Spawn `node_modules/.bin/next dev -p <port>` in the workspace dir
//      - Wait for the "Ready" log line (with a generous timeout)
//      - Cache { pid, port, status: "ready" } in memory
//      - Return { url, port }
//   2. stopPreview(projectId)
//      - SIGTERM the cached pid, fall back to SIGKILL after 3s
//      - Drop the cache entry
//   3. getPreviewStatus(projectId) — synchronous lookup
//
// On parent process exit we tear down every child so we don't leak servers.

import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs, createWriteStream } from "node:fs";
import net from "node:net";
import path from "node:path";
import { workspaceDir, isScaffolded } from "./scaffolder.ts";

export type PreviewStatus = "idle" | "starting" | "ready" | "errored";

export interface PreviewState {
  projectId: string;
  status: PreviewStatus;
  port?: number;
  url?: string;
  pid?: number;
  startedAt?: number;
  errorMessage?: string;
  logTail?: string;
}

interface RunningServer {
  proc: ChildProcess;
  port: number;
  startedAt: number;
  logTail: string[];
  status: PreviewStatus;
  errorMessage?: string;
}

const servers = new Map<string, RunningServer>();

/** Global teardown — wired once per Node process. */
let teardownInstalled = false;
function ensureTeardown(): void {
  if (teardownInstalled) return;
  teardownInstalled = true;
  const tearDownAll = () => {
    for (const [id, srv] of servers) {
      try {
        srv.proc.kill("SIGTERM");
      } catch (err) {
        console.warn(`[preview] failed to SIGTERM ${id} on parent exit:`, err);
      }
    }
  };
  process.on("exit", tearDownAll);
  process.on("SIGINT", () => {
    tearDownAll();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    tearDownAll();
    process.exit(0);
  });
}

export function getPreviewStatus(projectId: string): PreviewState {
  const srv = servers.get(projectId);
  if (!srv) return { projectId, status: "idle" };
  return {
    projectId,
    status: srv.status,
    port: srv.port,
    url: srv.port ? `http://localhost:${srv.port}` : undefined,
    pid: srv.proc.pid,
    startedAt: srv.startedAt,
    errorMessage: srv.errorMessage,
    logTail: srv.logTail.slice(-30).join(""),
  };
}

/**
 * Boot the preview dev server. If one is already running, this is a no-op
 * that returns the current state. If `starting`, we wait briefly for it to
 * become `ready` before returning.
 */
export async function startPreview(projectId: string): Promise<PreviewState> {
  ensureTeardown();

  const existing = servers.get(projectId);
  if (existing && (existing.status === "ready" || existing.status === "starting")) {
    if (existing.status === "starting") {
      // Wait up to 30s for it to become ready before returning state.
      await waitForReady(projectId, 30_000).catch(() => undefined);
    }
    return getPreviewStatus(projectId);
  }

  // Sanity: workspace must exist. If not, the user is asking to preview
  // before the developer has run; surface that as an error.
  if (!(await isScaffolded(projectId))) {
    return {
      projectId,
      status: "errored",
      errorMessage:
        "Workspace not scaffolded yet — the Developer hasn't started writing code. Wait for sprint-dev to run, then try again.",
    };
  }

  const port = await findFreePort(5000, 5099);
  const dir = workspaceDir(projectId);
  const nextBin = path.join(dir, "node_modules", ".bin", "next");

  // Sanity: next binary visible? (Symlink might have failed.)
  try {
    await fs.access(nextBin);
  } catch {
    return {
      projectId,
      status: "errored",
      errorMessage: `next binary not found at ${nextBin}. The workspace's node_modules symlink may be broken.`,
    };
  }

  // Log file for debugging — written next to the workspace so the user can
  // tail it if the preview misbehaves.
  const logPath = path.join(dir, ".preview.log");
  const logStream = createWriteStream(logPath, { flags: "w" });

  const proc = spawn(nextBin, ["dev", "-p", String(port)], {
    cwd: dir,
    env: {
      ...process.env,
      // Avoid colliding with the parent's `.next` build cache.
      NEXT_TELEMETRY_DISABLED: "1",
      // Don't let child inherit the parent's port hint, etc.
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  const srv: RunningServer = {
    proc,
    port,
    startedAt: Date.now(),
    logTail: [],
    status: "starting",
  };
  servers.set(projectId, srv);

  const onData = (chunk: Buffer | string) => {
    const text = chunk.toString();
    logStream.write(text);
    srv.logTail.push(text);
    if (srv.logTail.length > 80) srv.logTail.splice(0, srv.logTail.length - 80);
    if (/Ready in \d+/.test(text) || /\bcompiled successfully\b/i.test(text)) {
      srv.status = "ready";
    }
    // Common compile errors get surfaced.
    if (/Error:/i.test(text) && srv.status !== "ready") {
      srv.errorMessage = text.split("\n").slice(0, 4).join("\n");
    }
  };
  proc.stdout?.on("data", onData);
  proc.stderr?.on("data", onData);

  proc.on("exit", (code, signal) => {
    logStream.end();
    const cur = servers.get(projectId);
    if (!cur) return;
    if (cur.status !== "ready") {
      cur.status = "errored";
      cur.errorMessage =
        cur.errorMessage ??
        `next dev exited before becoming ready (code=${code}, signal=${signal}).`;
    } else {
      // Process died mid-flight (e.g. user killed it). Drop the entry.
      servers.delete(projectId);
    }
  });

  // Wait up to 60s for the "Ready" log line.
  try {
    await waitForReady(projectId, 60_000);
  } catch (err) {
    srv.errorMessage = (err as Error).message;
    srv.status = "errored";
  }

  return getPreviewStatus(projectId);
}

/** Kill the preview process. Idempotent. */
export async function stopPreview(projectId: string): Promise<PreviewState> {
  const srv = servers.get(projectId);
  if (!srv) return { projectId, status: "idle" };
  try {
    srv.proc.kill("SIGTERM");
    // Fall back to SIGKILL after 3s if still alive.
    await new Promise((r) => setTimeout(r, 3000));
    if (!srv.proc.killed) {
      try {
        srv.proc.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  } catch (err) {
    console.warn(`[preview] kill failed for ${projectId}:`, err);
  }
  servers.delete(projectId);
  return { projectId, status: "idle" };
}

// ---------- helpers ----------

async function waitForReady(projectId: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const srv = servers.get(projectId);
    if (!srv) throw new Error("Server was removed before becoming ready.");
    if (srv.status === "ready") return;
    if (srv.status === "errored") {
      throw new Error(srv.errorMessage ?? "Server errored before becoming ready.");
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for next dev to be ready.`);
}

async function findFreePort(start: number, end: number): Promise<number> {
  for (let port = start; port <= end; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port in ${start}..${end}`);
}

function isPortFree(port: number): Promise<boolean> {
  // Next.js binds to `::` (IPv6 dual-stack) by default, so the same address
  // is what we must probe — otherwise we get false positives where the
  // local 127.0.0.1 bind succeeds but `::` is in use.
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    // No host argument → tester binds to all interfaces (mirrors Next.js).
    tester.listen(port);
  });
}
