"use client";

// components/project/StageStepper.tsx
//
// Compact horizontal step indicator for the workflow. We group adjacent
// stages into "phases" so the bar stays readable at 1280px.

import type { StageId } from "@/lib/platform/workflow/types.ts";
import { STAGE_ORDER } from "@/lib/platform/workflow/types.ts";

interface StageStepperProps {
  stage: StageId;
}

interface Phase {
  id: string;
  label: string;
  stages: StageId[];
}

const PHASES: Phase[] = [
  { id: "intake",   label: "Intake",      stages: ["intake"] },
  { id: "product",  label: "Product",     stages: ["product-discovery"] },
  { id: "hld",      label: "HLD",         stages: ["cto-review"] },
  { id: "lld",      label: "LLD",         stages: ["plan-draft", "plan-approval"] },
  { id: "design",   label: "Design",      stages: ["design-draft", "design-approval", "design-validation"] },
  { id: "handoff",  label: "Handoff",     stages: ["handoff"] },
  { id: "stories",  label: "Stories",     stages: ["stories"] },
  { id: "dev",      label: "Sprint",      stages: ["sprint-dev"] },
  { id: "qa",       label: "QA",          stages: ["qa-review"] },
  { id: "review2",  label: "Code review", stages: ["code-review", "defect-fix"] },
  { id: "sec",      label: "Security",    stages: ["security-audit"] },
  { id: "deploy",   label: "Ship",        stages: ["deploy", "done"] },
];

export function StageStepper({ stage }: StageStepperProps) {
  const currentIndex = STAGE_ORDER.indexOf(stage);
  return (
    <ol className="flex items-center gap-1.5">
      {PHASES.map((phase, i) => {
        const phaseStart = STAGE_ORDER.indexOf(phase.stages[0]);
        const phaseEnd = STAGE_ORDER.indexOf(phase.stages[phase.stages.length - 1]);
        const isPast = currentIndex > phaseEnd;
        const isActive = currentIndex >= phaseStart && currentIndex <= phaseEnd;
        return (
          <li key={phase.id} className="flex flex-1 items-center gap-1.5">
            <div
              className={`relative flex h-1.5 w-full overflow-hidden rounded-full ${
                isPast
                  ? "bg-emerald-500"
                  : isActive
                    ? "bg-cyan-500"
                    : "bg-floor-800"
              }`}
            >
              {isActive && (
                <span className="absolute inset-y-0 left-0 w-full animate-pulse bg-gradient-to-r from-cyan-300/30 to-transparent" />
              )}
            </div>
            <span
              className={`shrink-0 text-[9px] font-semibold uppercase tracking-[0.16em] ${
                isPast
                  ? "text-emerald-300"
                  : isActive
                    ? "text-cyan-300"
                    : "text-zinc-600"
              }`}
              title={phase.stages.join(" · ")}
            >
              {phase.label}
            </span>
            {i < PHASES.length - 1 && <span className="text-zinc-700">·</span>}
          </li>
        );
      })}
    </ol>
  );
}
