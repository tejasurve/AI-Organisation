// lib/runtime/file-writer.ts
//
// Writes Developer-output files to /generated/{taskId}/{file.path} on the
// local filesystem.
//
// Hard safety rules (defence-in-depth):
//   1. taskId must match a strict character set (no path separators, no `.`/`..`).
//   2. file.path must be a relative path (no leading `/`, no drive letters).
//   3. file.path must not contain `..` segments — no traversal allowed.
//   4. The resolved absolute path of every file MUST end up inside the per-task
//      directory, which itself MUST end up inside the rootDir.
//   5. Duplicate file paths in the same write batch are rejected.
//
// The writer never silently sanitises — anything the developer agent produced
// that violates the rules causes a thrown Error so the pipeline records a
// failed write step rather than dropping data.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, normalize, relative, resolve, isAbsolute } from "node:path";

import type { DeveloperFile } from "./types.ts";

export interface WrittenFile {
  taskId: string;
  declaredPath: string;
  absolutePath: string;
  bytes: number;
}

export interface WriteOptions {
  taskId: string;
  files: readonly DeveloperFile[];
  rootDir: string;
}

export async function writeGeneratedFiles(opts: WriteOptions): Promise<WrittenFile[]> {
  if (opts.files.length === 0) {
    throw new Error("writeGeneratedFiles: developer produced no files to write");
  }

  const safeTaskId = sanitizeTaskId(opts.taskId);
  const rootAbs = resolve(opts.rootDir);
  const taskDirAbs = resolve(rootAbs, safeTaskId);

  if (!isInside(taskDirAbs, rootAbs)) {
    throw new Error(
      `writeGeneratedFiles: refusing to write outside rootDir; taskDir=${taskDirAbs}, root=${rootAbs}`,
    );
  }

  await mkdir(taskDirAbs, { recursive: true });

  const seen = new Set<string>();
  const written: WrittenFile[] = [];

  for (const file of opts.files) {
    const safe = sanitizeFilePath(file.path);
    if (seen.has(safe)) {
      throw new Error(
        `writeGeneratedFiles: duplicate file path in developer output: ${JSON.stringify(safe)}`,
      );
    }
    seen.add(safe);

    const fullPath = resolve(taskDirAbs, safe);
    if (!isInside(fullPath, taskDirAbs)) {
      throw new Error(
        `writeGeneratedFiles: refusing path that escapes taskDir; declared=${JSON.stringify(file.path)}, resolved=${fullPath}`,
      );
    }

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.content, "utf-8");

    written.push({
      taskId: opts.taskId,
      declaredPath: file.path,
      absolutePath: fullPath,
      bytes: Buffer.byteLength(file.content, "utf-8"),
    });
  }

  return written;
}

// ---------- sanitizers (exported for testing) ----------

export function sanitizeTaskId(taskId: string): string {
  if (typeof taskId !== "string" || taskId.length === 0) {
    throw new Error("writeGeneratedFiles: empty taskId");
  }
  if (taskId === "." || taskId === "..") {
    throw new Error(`writeGeneratedFiles: unsafe taskId ${JSON.stringify(taskId)}`);
  }
  if (!/^[A-Za-z0-9._-]+$/.test(taskId)) {
    throw new Error(
      `writeGeneratedFiles: unsafe taskId ${JSON.stringify(taskId)} (must match /^[A-Za-z0-9._-]+$/)`,
    );
  }
  return taskId;
}

export function sanitizeFilePath(p: string): string {
  if (typeof p !== "string" || p.length === 0) {
    throw new Error("writeGeneratedFiles: empty file path");
  }
  if (isAbsolute(p)) {
    throw new Error(`writeGeneratedFiles: absolute paths not allowed (got ${JSON.stringify(p)})`);
  }

  // Defence in depth: reject any `..` segment in the ORIGINAL path before
  // normalisation, even if it would resolve to a safe path (e.g. `a/b/..`
  // collapses to `a`). The developer agent's contract requires clean
  // repo-relative paths, so a `..` segment is always a sign of an unsafe or
  // confused output.
  const segments = p.split(/[\\/]+/);
  if (segments.some((s) => s === "..")) {
    throw new Error(
      `writeGeneratedFiles: path traversal not allowed (got ${JSON.stringify(p)})`,
    );
  }

  // Now normalise (collapses `./`, `//`, etc.) and re-verify nothing has
  // surfaced a `..` segment or absolute prefix that we missed above.
  const norm = normalize(p).replace(/\\/g, "/");
  if (norm === ".." || norm.startsWith("../") || norm.includes("/../") || norm.endsWith("/..")) {
    throw new Error(
      `writeGeneratedFiles: path traversal not allowed (got ${JSON.stringify(p)})`,
    );
  }
  if (norm.startsWith("/")) {
    throw new Error(
      `writeGeneratedFiles: absolute paths not allowed (got ${JSON.stringify(p)})`,
    );
  }
  return norm;
}

// ---------- helpers ----------

function isInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  if (rel === "") return true;
  return !rel.startsWith("..") && !isAbsolute(rel);
}

// Re-export `join` for callers building per-task subpaths in tests/CLIs.
export { join };
