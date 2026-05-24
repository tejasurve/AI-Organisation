"use client";

import { useState } from "react";

import type { CycleState, SimMetrics } from "@/lib/simulation/types.ts";

interface HUDProps {
  metrics: SimMetrics;
  cycle: CycleState;
}

export function HUD({ metrics, cycle }: HUDProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const runDemo = async (flavour: "happy" | "secfail" | "qafail") => {
    if (busy) return;
    setBusy(flavour);
    try {
      await fetch(`/api/demo?flavour=${flavour}`, { method: "POST" });
    } catch {
      // swallow — events stream via SSE
    } finally {
      setTimeout(() => setBusy(null), 1500);
    }
  };

  return (
    <header className="flex items-center justify-between gap-6 border-b border-white/5 bg-floor-900/70 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-cyan-500 to-emerald-500 text-[14px] font-bold text-floor-950">
          AI
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            AI Organisation
          </div>
          <div className="text-sm font-semibold text-zinc-100">Live Office</div>
        </div>
      </div>

      {/* Cycle indicator */}
      <div className="flex items-center gap-2 rounded-md border border-white/5 bg-floor-800/80 px-3 py-1.5 text-[11px]">
        <span
          className={`h-2 w-2 rounded-full ${
            cycle.phase === "idle" ? "bg-zinc-500" : "bg-cyan-400 animate-pulse"
          }`}
        />
        <span className="font-mono uppercase tracking-wide text-zinc-300">
          {cycle.phase}
        </span>
        {cycle.taskId && (
          <span className="ml-2 rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-300">
            {cycle.taskId}
          </span>
        )}
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-4">
        <Metric
          label="Deploys"
          value={metrics.deploys}
          tone="ok"
          hint="Successful releases to staging this session."
        />
        <Metric
          label="Tasks Done"
          value={metrics.tasks_done}
          tone="info"
          hint="Tasks completed end-to-end (built, tested, secured, shipped)."
        />
        <Metric
          label="Open Bugs"
          value={metrics.bugs_open}
          tone={metrics.bugs_open > 0 ? "warn" : "info"}
          hint="Bugs flagged by QA waiting on Developer."
        />
        <Metric
          label="Blocked"
          value={metrics.blockers}
          tone={metrics.blockers > 0 ? "danger" : "info"}
          hint="Agents currently stuck on a gate failure."
        />
      </div>

      {/* Demo controls */}
      <div className="flex items-center gap-2">
        <DemoButton
          onClick={() => runDemo("happy")}
          busy={busy === "happy"}
          variant="default"
        >
          Run Demo
        </DemoButton>
        <DemoButton
          onClick={() => runDemo("qafail")}
          busy={busy === "qafail"}
          variant="warn"
        >
          QA Fail
        </DemoButton>
        <DemoButton
          onClick={() => runDemo("secfail")}
          busy={busy === "secfail"}
          variant="danger"
        >
          Sec Block
        </DemoButton>
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "ok" | "info" | "warn" | "danger";
  hint?: string;
}) {
  const tones: Record<string, string> = {
    ok: "text-emerald-300",
    info: "text-zinc-200",
    warn: "text-amber-300",
    danger: "text-red-300",
  };
  return (
    <div
      className="group relative flex flex-col items-end leading-none"
      title={hint}
    >
      <span className={`font-mono text-base font-semibold tabular-nums ${tones[tone]}`}>
        {value}
      </span>
      <span className="mt-0.5 text-[9px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {hint && (
        <span className="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden w-44 rounded-md bg-floor-900/95 px-2 py-1.5 text-[10px] leading-snug text-zinc-300 ring-1 ring-white/10 shadow group-hover:block">
          {hint}
        </span>
      )}
    </div>
  );
}

function DemoButton({
  children,
  busy,
  variant,
  onClick,
}: {
  children: React.ReactNode;
  busy: boolean;
  variant: "default" | "warn" | "danger";
  onClick: () => void;
}) {
  const variants: Record<string, string> = {
    default:
      "border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15",
    warn: "border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15",
    danger: "border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/15",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`rounded-md border px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-colors disabled:opacity-50 ${variants[variant]}`}
    >
      {busy ? "running…" : children}
    </button>
  );
}
