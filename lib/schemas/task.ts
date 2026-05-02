// lib/schemas/task.ts
//
// System-level Task schema.
// estimatedHours is `number` (per the spec) and constrained to 1..4 inclusive.
// The EM emits integers in {1,2,3,4}; the system schema is more permissive on
// type but enforces the same range, so any conforming downstream value passes.

export const TASK_ROLES = ["developer", "designer", "qa"] as const;
export type TaskRole = (typeof TASK_ROLES)[number];

export const TASK_STATUSES = ["pending", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_ESTIMATED_HOURS_MIN = 1;
export const TASK_ESTIMATED_HOURS_MAX = 4;

export interface Task {
  id: string;
  featureId: string;
  description: string;
  assignedTo: TaskRole;
  estimatedHours: number;
  status: TaskStatus;
}
