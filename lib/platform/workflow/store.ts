// lib/platform/workflow/store.ts
//
// Singleton, process-wide project store. Backed by a JSON file under
// `.simulation/projects/<id>.json` so demos survive Next.js dev HMR.
//
// For a hackathon-scale build this is good enough; swap for SQLite when
// we go multi-user.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import type { Project, ProjectBrief, ProjectBindings } from "./types.ts";

const DIR = resolve(process.cwd(), ".simulation", "projects");

interface ProjectStoreState {
  projects: Map<string, Project>;
  currentProjectId: string | null;
  initialised: boolean;
}

const G = globalThis as unknown as { __aiOrgProjects?: ProjectStoreState };

function getState(): ProjectStoreState {
  if (!G.__aiOrgProjects) {
    G.__aiOrgProjects = {
      projects: new Map(),
      currentProjectId: null,
      initialised: false,
    };
  }
  return G.__aiOrgProjects;
}

function ensureDir(): void {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
}

function hydrate(): void {
  const s = getState();
  if (s.initialised) return;
  s.initialised = true;
  ensureDir();
  try {
    for (const file of readdirSync(DIR)) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = readFileSync(join(DIR, file), "utf-8");
        const project = migrate(JSON.parse(raw) as Project);
        s.projects.set(project.id, project);
        if (!s.currentProjectId) s.currentProjectId = project.id;
      } catch {
        // skip
      }
    }
  } catch {
    // empty dir
  }
}

/**
 * Backfill any newly-added Project fields with sane defaults so older
 * .simulation/projects/*.json files keep working across schema bumps.
 */
function migrate(p: Project): Project {
  const raw = p as unknown as Record<string, unknown>;
  const m = p as Project;
  if (typeof raw.currentSprint !== "number") m.currentSprint = 1;
  if (!Array.isArray(raw.sprintHistory)) m.sprintHistory = [];
  if (!("features" in raw)) m.features = null;
  for (const story of m.stories) {
    const sm = story as typeof story & { sprintNumber?: number; origin?: string };
    if (typeof sm.sprintNumber !== "number") sm.sprintNumber = 1;
    if (typeof sm.origin !== "string") sm.origin = "fresh";
  }
  return m;
}

function persist(project: Project): void {
  ensureDir();
  writeFileSync(
    join(DIR, `${project.id}.json`),
    JSON.stringify(project, null, 2),
    "utf-8",
  );
}

// ---------- Public API ----------

export function listProjects(): Project[] {
  hydrate();
  return [...getState().projects.values()].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}

export function getCurrentProject(): Project | null {
  hydrate();
  const s = getState();
  if (!s.currentProjectId) return null;
  return s.projects.get(s.currentProjectId) ?? null;
}

export function getProject(id: string): Project | null {
  hydrate();
  return getState().projects.get(id) ?? null;
}

export function setCurrentProject(id: string): void {
  hydrate();
  const s = getState();
  if (s.projects.has(id)) s.currentProjectId = id;
}

export function createProject(
  brief: ProjectBrief,
  bindings: ProjectBindings = {},
): Project {
  hydrate();
  const id = `prj-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  const project: Project = {
    id,
    createdAt: now,
    brief,
    bindings,
    stage: "intake",
    stageStartedAt: now,
    waitingForUser: true,
    currentSprint: 1,
    sprintHistory: [],
    features: null,
    hld: null,
    lld: null,
    design: null,
    stories: [],
    codeReview: null,
    defects: [],
    security: null,
    chat: [],
    llmCalls: [],
    totalCostUsd: 0,
    totalInTokens: 0,
    totalOutTokens: 0,
  };
  const s = getState();
  s.projects.set(id, project);
  s.currentProjectId = id;
  persist(project);
  return project;
}

export function updateProject(
  id: string,
  mutator: (p: Project) => void,
): Project | null {
  hydrate();
  const s = getState();
  const p = s.projects.get(id);
  if (!p) return null;
  mutator(p);
  persist(p);
  return p;
}

export function deleteProject(id: string): void {
  hydrate();
  const s = getState();
  s.projects.delete(id);
  if (s.currentProjectId === id) {
    s.currentProjectId =
      [...s.projects.values()][0]?.id ?? null;
  }
  // Remove the persisted JSON too — otherwise deleted projects zombie
  // back into memory on next hydrate.
  const file = join(DIR, `${id}.json`);
  if (existsSync(file)) {
    try {
      unlinkSync(file);
    } catch {
      // ignore — best-effort cleanup
    }
  }
}

/**
 * Wipe every project (in-memory + on-disk). Used for the "fresh start"
 * reset flow. Does NOT touch `.simulation/secrets.json` (the user's
 * vault — Stitch API key, provider keys) or `.simulation/events.jsonl`.
 *
 * @returns the number of projects removed.
 */
export function deleteAllProjects(): number {
  hydrate();
  const s = getState();
  const ids = [...s.projects.keys()];
  for (const id of ids) {
    const file = join(DIR, `${id}.json`);
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch {
        // ignore
      }
    }
  }
  s.projects.clear();
  s.currentProjectId = null;
  // Also remove any stray *.json that wasn't tracked in memory (e.g.
  // files written by a previous process that we never hydrated).
  if (existsSync(DIR)) {
    try {
      for (const file of readdirSync(DIR)) {
        if (file.endsWith(".json")) {
          try {
            unlinkSync(join(DIR, file));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return ids.length;
}
