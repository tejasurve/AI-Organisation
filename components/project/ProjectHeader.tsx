"use client";

// components/project/ProjectHeader.tsx
//
// Top bar of the dashboard. Shows project name, current stage, cost meter,
// demo/live indicator, and primary actions (new project, settings).

import type { Project } from "@/lib/platform/workflow/types.ts";
import { STAGE_META } from "@/lib/platform/workflow/types.ts";
import { useProjectStore } from "@/stores/project-store.ts";
import { StageStepper } from "./StageStepper";

interface ProjectHeaderProps {
  project: Project | null;
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  const setWizardOpen = useProjectStore((s) => s.setWizardOpen);
  const setSettingsOpen = useProjectStore((s) => s.setSettingsOpen);

  const liveCalls = project?.llmCalls.filter((c) => c.source === "live").length ?? 0;
  const demoCalls = project?.llmCalls.filter((c) => c.source === "demo").length ?? 0;
  const mostlyLive = liveCalls > demoCalls;

  return (
    <header className="border-b border-white/10 bg-floor-900/85 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">
              AI Organisation
            </div>
            <div className="text-base font-semibold text-zinc-100">
              {project ? project.brief.name : "No active project"}
            </div>
            {project && (
              <div className="text-[11px] text-zinc-500">
                Now: {STAGE_META[project.stage].label}
                {project.waitingForUser && (
                  <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/30">
                    Awaiting you
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {project && (
            <>
              <Stat label="Tokens" value={fmtCount(project.totalInTokens + project.totalOutTokens)} />
              <Stat label="Spend" value={`$${project.totalCostUsd.toFixed(4)}`} />
              <Stat
                label={mostlyLive ? "Live" : "Demo"}
                value={`${liveCalls + demoCalls} calls`}
                accent={mostlyLive ? "emerald" : "amber"}
              />
            </>
          )}
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="rounded-md bg-cyan-500 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-floor-950 hover:bg-cyan-400"
          >
            {project ? "New project" : "Start project"}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-md border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300 hover:bg-floor-800"
          >
            Settings
          </button>
        </div>
      </div>

      {project && (
        <div className="border-t border-white/5 bg-floor-950/40 px-5 py-2">
          <StageStepper stage={project.stage} />
        </div>
      )}
    </header>
  );
}

function Stat({
  label,
  value,
  accent = "cyan",
}: {
  label: string;
  value: string;
  accent?: "cyan" | "emerald" | "amber";
}) {
  const colour =
    accent === "emerald"
      ? "text-emerald-300 ring-emerald-400/30 bg-emerald-500/10"
      : accent === "amber"
        ? "text-amber-300 ring-amber-400/30 bg-amber-500/10"
        : "text-cyan-300 ring-cyan-400/30 bg-cyan-500/10";
  return (
    <div
      className={`flex flex-col items-end rounded-md px-2.5 py-1 text-right ring-1 ${colour}`}
    >
      <span className="text-[9px] uppercase tracking-[0.18em] opacity-80">
        {label}
      </span>
      <span className="text-[12px] font-semibold leading-tight">{value}</span>
    </div>
  );
}

function fmtCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}m`;
}
