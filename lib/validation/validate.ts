// lib/validation/validate.ts
//
// validateEMOutput(input) — checks an Engineering Manager output (the
// `{ features, tasks }` shape) against the system-level Feature/Task schemas
// and the four cross-array rules from §3 of the Step 4 spec:
//   1. Every task MUST reference a valid featureId
//   2. estimatedHours MUST be between 1–4
//   3. assignedTo MUST be valid role
//   4. Every feature must have at least 1 task
//
// Always returns { valid, errors } — never throws on malformed input.
// Errors are accumulated, not short-circuited, so callers see every problem.

import {
  FEATURE_PRIORITIES,
  FEATURE_STATUSES,
  type FeaturePriority,
  type FeatureStatus,
} from "../schemas/feature.ts";
import {
  TASK_ROLES,
  TASK_STATUSES,
  TASK_ESTIMATED_HOURS_MIN,
  TASK_ESTIMATED_HOURS_MAX,
  type TaskRole,
  type TaskStatus,
} from "../schemas/task.ts";
import type { ValidationError, ValidationResult } from "./errors.ts";

export function validateEMOutput(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    errors.push({ path: "$", rule: "type", message: "expected an object with `features` and `tasks` arrays" });
    return { valid: false, errors };
  }
  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.features)) {
    errors.push({ path: "$.features", rule: "type", message: "expected an array" });
  }
  if (!Array.isArray(obj.tasks)) {
    errors.push({ path: "$.tasks", rule: "type", message: "expected an array" });
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const features = obj.features as unknown[];
  const tasks = obj.tasks as unknown[];

  features.forEach((f, i) => validateFeature(f, `$.features[${i}]`, errors));
  tasks.forEach((t, i) => validateTask(t, `$.tasks[${i}]`, errors));

  // Cross-array rule 1: every task.featureId must reference a real feature.id
  const featureIds = new Set<string>();
  for (const f of features) {
    const fid = readString(f, "id");
    if (fid) featureIds.add(fid);
  }
  tasks.forEach((t, i) => {
    const fid = readString(t, "featureId");
    if (fid && !featureIds.has(fid)) {
      errors.push({
        path: `$.tasks[${i}].featureId`,
        rule: "foreignKey",
        message: `references unknown featureId ${JSON.stringify(fid)}`,
      });
    }
  });

  // Cross-array rule 4: every feature must have at least 1 task
  const taskCountByFeature = new Map<string, number>();
  for (const t of tasks) {
    const fid = readString(t, "featureId");
    if (fid) taskCountByFeature.set(fid, (taskCountByFeature.get(fid) ?? 0) + 1);
  }
  features.forEach((f, i) => {
    const fid = readString(f, "id");
    if (!fid) return; // shape error already reported
    const count = taskCountByFeature.get(fid) ?? 0;
    if (count < 1) {
      errors.push({
        path: `$.features[${i}].id`,
        rule: "minTasks",
        message: `feature ${JSON.stringify(fid)} has 0 tasks (must have at least 1)`,
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

// ---------- per-item validators ----------

function validateFeature(f: unknown, path: string, errors: ValidationError[]): void {
  if (f === null || typeof f !== "object" || Array.isArray(f)) {
    errors.push({ path, rule: "type", message: "expected an object" });
    return;
  }
  const o = f as Record<string, unknown>;

  requireNonEmptyString(o, "id", path, errors);
  requireNonEmptyString(o, "name", path, errors);
  requireNonEmptyString(o, "description", path, errors);
  requireEnum<FeaturePriority>(o, "priority", FEATURE_PRIORITIES, path, errors);
  requireEnum<FeatureStatus>(o, "status", FEATURE_STATUSES, path, errors);
}

function validateTask(t: unknown, path: string, errors: ValidationError[]): void {
  if (t === null || typeof t !== "object" || Array.isArray(t)) {
    errors.push({ path, rule: "type", message: "expected an object" });
    return;
  }
  const o = t as Record<string, unknown>;

  requireNonEmptyString(o, "id", path, errors);
  requireNonEmptyString(o, "featureId", path, errors);
  requireNonEmptyString(o, "description", path, errors);
  requireEnum<TaskRole>(o, "assignedTo", TASK_ROLES, path, errors);
  requireEnum<TaskStatus>(o, "status", TASK_STATUSES, path, errors);

  // estimatedHours: number, in [1..4]
  const eh = o.estimatedHours;
  const ehPath = `${path}.estimatedHours`;
  if (typeof eh !== "number" || Number.isNaN(eh) || !Number.isFinite(eh)) {
    errors.push({ path: ehPath, rule: "type", message: "expected a finite number" });
  } else if (eh < TASK_ESTIMATED_HOURS_MIN || eh > TASK_ESTIMATED_HOURS_MAX) {
    errors.push({
      path: ehPath,
      rule: "range",
      message: `must be between ${TASK_ESTIMATED_HOURS_MIN} and ${TASK_ESTIMATED_HOURS_MAX} (got ${eh})`,
    });
  }
}

// ---------- helpers ----------

function requireNonEmptyString(
  o: Record<string, unknown>,
  key: string,
  parentPath: string,
  errors: ValidationError[],
): void {
  const path = `${parentPath}.${key}`;
  if (!(key in o)) {
    errors.push({ path, rule: "missing", message: `required field "${key}" is missing` });
    return;
  }
  const v = o[key];
  if (typeof v !== "string") {
    errors.push({ path, rule: "type", message: `expected a string, got ${typeName(v)}` });
    return;
  }
  if (v.length === 0) {
    errors.push({ path, rule: "nonempty", message: "must be a non-empty string" });
  }
}

function requireEnum<T extends string>(
  o: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  parentPath: string,
  errors: ValidationError[],
): void {
  const path = `${parentPath}.${key}`;
  if (!(key in o)) {
    errors.push({ path, rule: "missing", message: `required field "${key}" is missing` });
    return;
  }
  const v = o[key];
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    errors.push({
      path,
      rule: "enum",
      message: `expected one of ${JSON.stringify(allowed)}, got ${JSON.stringify(v)}`,
    });
  }
}

function readString(v: unknown, key: string): string | null {
  if (v === null || typeof v !== "object") return null;
  const x = (v as Record<string, unknown>)[key];
  return typeof x === "string" && x.length > 0 ? x : null;
}

function typeName(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
