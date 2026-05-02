// lib/schemas/em-output.ts
//
// The shape the Engineering Manager produces (and the shape the validator in
// lib/validation/validate.ts checks against). This is the system-level view —
// arrays of lifecycle Feature/Task objects.

import type { Feature } from "./feature.ts";
import type { Task } from "./task.ts";

export interface EMOutput {
  features: Feature[];
  tasks: Task[];
}
