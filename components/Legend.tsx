"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const STATUSES: Array<{ key: string; color: string; label: string; desc: string }> = [
  { key: "idle", color: "#71717a", label: "Idle", desc: "Resting at home seat. Energy recovers." },
  { key: "thinking", color: "#38bdf8", label: "Thinking", desc: "Reasoning about strategy or task breakdown." },
  { key: "building", color: "#22d3ee", label: "Building", desc: "Actively writing or refactoring code." },
  { key: "reviewing", color: "#f59e0b", label: "Reviewing", desc: "Running tests, audits, or evaluating work." },
  { key: "deploying", color: "#10b981", label: "Deploying", desc: "Releasing changes to staging or production." },
  { key: "blocked", color: "#ef4444", label: "Blocked", desc: "Work stopped by a gate failure or schema error." },
];

const ROOMS_LEGEND: Array<{ name: string; color: string; purpose: string }> = [
  { name: "Strategy Room", color: "#60a5fa", purpose: "CEO + CTO set mission and architecture." },
  { name: "Engineering Floor", color: "#22d3ee", purpose: "Eng Manager + Developer build features." },
  { name: "Design Studio", color: "#a78bfa", purpose: "UI / UX work and prototypes." },
  { name: "QA Lab", color: "#fbbf24", purpose: "Test plans and verdicts (PASS/FAIL)." },
  { name: "Security Ops", color: "#ef4444", purpose: "Audit and final GO / NO_GO gate." },
  { name: "Growth Room", color: "#10b981", purpose: "Analytics, campaigns, revenue." },
  { name: "Deployment Pipeline", color: "#34d399", purpose: "Staging + production release path." },
];

/** Help button bottom-left that opens a small legend panel. */
export function Legend() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 left-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-floor-900/90 text-zinc-300 shadow-lg backdrop-blur transition-colors hover:bg-floor-800"
        aria-label={open ? "Close legend" : "Open legend"}
        aria-expanded={open}
      >
        <span className="text-base leading-none">{open ? "×" : "?"}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: -16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -16, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 240 }}
            className="fixed bottom-16 left-4 z-40 w-80 rounded-xl border border-white/10 bg-floor-900/95 p-4 shadow-2xl backdrop-blur"
          >
            <header className="mb-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                Legend
              </div>
              <div className="text-sm font-semibold text-zinc-100">
                How to read the office
              </div>
            </header>

            <section className="mb-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Agent statuses
              </div>
              <ul className="space-y-1.5">
                {STATUSES.map((s) => (
                  <li key={s.key} className="flex items-start gap-2 text-[11px]">
                    <span
                      className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        background: s.color,
                        boxShadow: `0 0 8px ${s.color}`,
                      }}
                    />
                    <span>
                      <span className="font-semibold text-zinc-200">
                        {s.label}
                      </span>{" "}
                      <span className="text-zinc-500">— {s.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Rooms
              </div>
              <ul className="space-y-1">
                {ROOMS_LEGEND.map((r) => (
                  <li key={r.name} className="flex items-start gap-2 text-[11px]">
                    <span
                      className="mt-1 inline-block h-2 w-2 shrink-0 rounded-sm"
                      style={{ background: r.color }}
                    />
                    <span>
                      <span className="font-medium text-zinc-200">{r.name}</span>
                      <span className="text-zinc-500"> — {r.purpose}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="mt-3 border-t border-white/5 pt-2 text-[10px] text-zinc-500">
              Drag to rotate camera · scroll to zoom · click an agent to inspect
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
