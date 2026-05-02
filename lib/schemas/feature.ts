// lib/schemas/feature.ts
//
// System-level Feature schema.
// Distinct from the EM agent's outputContract.schema, which only allows the
// "pending" creation status. This is the lifecycle schema: a Feature stored in
// the system can be in any of pending / in_progress / done.

export const FEATURE_PRIORITIES = ["high", "medium", "low"] as const;
export type FeaturePriority = (typeof FEATURE_PRIORITIES)[number];

export const FEATURE_STATUSES = ["pending", "in_progress", "done"] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export interface Feature {
  id: string;
  name: string;
  description: string;
  priority: FeaturePriority;
  status: FeatureStatus;
}
