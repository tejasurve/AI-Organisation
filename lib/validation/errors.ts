// lib/validation/errors.ts
//
// Structured error format returned by validateEMOutput.
// Every error has a JSONPath-like `path`, a `rule` name (so callers can group
// or filter by rule), and a human-readable `message`.

export type ValidationRule =
  | "type"        // wrong type at this path
  | "missing"     // required field absent
  | "nonempty"    // string/array required to be non-empty
  | "enum"        // value not in the allowed set
  | "range"       // numeric value outside allowed range
  | "foreignKey"  // task.featureId references a non-existent feature
  | "minTasks"    // feature has fewer than the required number of tasks
  | "json";       // top-level: input was not parseable JSON

export interface ValidationError {
  path: string;
  rule: ValidationRule;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
