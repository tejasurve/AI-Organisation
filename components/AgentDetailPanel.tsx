"use client";

import { AnimatePresence, motion } from "framer-motion";

import { AGENT_PERSONALITIES, ROOMS_BY_ID } from "@/lib/simulation/layout.ts";
import type { VisualAgent } from "@/lib/simulation/types.ts";
import { PERSONAS } from "@/lib/platform/personas/catalog.ts";

interface PanelProps {
  agent: VisualAgent | null;
  onClose: () => void;
}

const STATUS_TONE: Record<VisualAgent["status"], string> = {
  idle: "bg-zinc-700 text-zinc-300",
  thinking: "bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/30",
  building: "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/30",
  reviewing: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30",
  blocked: "bg-red-500/20 text-red-300 ring-1 ring-red-400/30",
  deploying: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30",
};

export function AgentDetailPanel({ agent, onClose }: PanelProps) {
  return (
    <AnimatePresence>
      {agent && (
        <motion.aside
          key={agent.id}
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 24, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 240 }}
          className="absolute right-4 top-4 z-50 flex max-h-[calc(100vh-2rem)] w-80 flex-col overflow-hidden rounded-xl border border-white/10 bg-floor-900/95 shadow-2xl backdrop-blur-md"
        >
          <PanelBody agent={agent} onClose={onClose} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function PanelBody({
  agent,
  onClose,
}: {
  agent: VisualAgent;
  onClose: () => void;
}) {
  const persona = PERSONAS[agent.id];
  return (
    <>
      <header className="flex items-start justify-between border-b border-white/5 px-4 pb-3 pt-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Agent · {persona.years} yrs
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-xl leading-none">{persona.emoji}</span>
            <div>
              <div className="text-[14px] font-semibold leading-tight text-zinc-100">
                {persona.title.split(" · ")[0]}
              </div>
              <div className="text-[11px] text-zinc-500">
                {persona.title.split(" · ")[1] ?? persona.shortTitle}
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
          aria-label="Close"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-3 flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_TONE[agent.status]}`}
          >
            {agent.status}
          </span>
          <span className="text-[11px] text-zinc-500">
            {ROOMS_BY_ID[agent.location].label}
          </span>
        </div>

        <p className="mb-3 rounded-md bg-white/[0.03] p-2 text-[11px] leading-relaxed text-zinc-300 ring-1 ring-white/5">
          {persona.bio}
        </p>

        <SectionLabel>Specialties</SectionLabel>
        <div className="mb-3 flex flex-wrap gap-1">
          {persona.specialties.map((s) => (
            <span
              key={s}
              className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-300 ring-1 ring-cyan-400/20"
            >
              {s}
            </span>
          ))}
        </div>

        <SectionLabel>Operating principles</SectionLabel>
        <ul className="mb-3 list-disc space-y-0.5 pl-4 text-[11px] text-zinc-300">
          {persona.principles.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>

        <SectionLabel>Tools</SectionLabel>
        <div className="mb-3 flex flex-wrap gap-1">
          {persona.tools.map((t) => (
            <span
              key={t}
              className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-300 ring-1 ring-white/10"
            >
              {t}
            </span>
          ))}
        </div>

        <SectionLabel>Default model</SectionLabel>
        <div className="mb-3 text-[11px] text-zinc-300">
          <span className="font-mono">{persona.recommendedModel.provider}</span>
          <span className="mx-1 text-zinc-500">·</span>
          <span className="font-mono">{persona.recommendedModel.model}</span>
        </div>

        {agent.currentTask && (
          <div className="mb-3 rounded-md bg-white/[0.03] p-2 ring-1 ring-white/5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Current task
            </div>
            <div className="font-mono text-[12px] text-zinc-200">
              {agent.currentTask}
            </div>
          </div>
        )}

        <Stat
          label="Energy"
          value={agent.energy}
          tone="emerald"
          hint="Drains while working, recovers at rest."
        />
        <Stat
          label="Efficiency"
          value={agent.efficiency}
          tone="cyan"
          hint="Falls when blocked or exhausted."
        />

        <div className="mt-2 text-[10px] text-zinc-600">
          Last update {timeAgo(agent.updatedAt)} ago ·{" "}
          <span title={AGENT_PERSONALITIES[agent.id].bio}>vibe</span>
        </div>
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "emerald" | "cyan";
  hint?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const fill = tone === "emerald" ? "bg-emerald-400" : "bg-cyan-400";
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">
        <span>{label}</span>
        <span className="font-mono text-zinc-300">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className={`h-full ${fill}`}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "tween", duration: 0.3 }}
        />
      </div>
      {hint && <div className="mt-1 text-[9px] text-zinc-600">{hint}</div>}
    </div>
  );
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}
