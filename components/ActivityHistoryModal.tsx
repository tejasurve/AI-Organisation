"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { ActivityEntry, SimSeverity } from "@/lib/simulation/types.ts";

interface Props {
  open: boolean;
  entries: ActivityEntry[];
  onClose: () => void;
}

const SEVERITY_STYLES: Record<SimSeverity, { dot: string; text: string; chip: string }> = {
  info: {
    dot: "bg-sky-400",
    text: "text-zinc-200",
    chip: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
  },
  success: {
    dot: "bg-emerald-400",
    text: "text-emerald-100",
    chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  },
  warn: {
    dot: "bg-amber-400",
    text: "text-amber-100",
    chip: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  },
  danger: {
    dot: "bg-red-500",
    text: "text-red-100",
    chip: "bg-red-500/15 text-red-300 ring-red-400/30",
  },
};

const ALL_SEVERITIES: SimSeverity[] = ["info", "success", "warn", "danger"];

export function ActivityHistoryModal({ open, entries, onClose }: Props) {
  const [filters, setFilters] = useState<Set<SimSeverity>>(
    () => new Set(ALL_SEVERITIES),
  );
  const [query, setQuery] = useState("");

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: ActivityEntry[] = [];
    // Iterate from newest to oldest so the modal lists most-recent first.
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (!filters.has(e.severity)) continue;
      if (q && !e.text.toLowerCase().includes(q)) continue;
      out.push(e);
    }
    return out;
  }, [entries, filters, query]);

  const counts = useMemo(() => {
    const c: Record<SimSeverity, number> = { info: 0, success: 0, warn: 0, danger: 0 };
    for (const e of entries) c[e.severity]++;
    return c;
  }, [entries]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="history-backdrop"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-floor-900/95 shadow-2xl"
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 24, stiffness: 240 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
          >
            {/* Header */}
            <header className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                  Activity History
                </div>
                <h2
                  id="history-title"
                  className="text-base font-semibold text-zinc-100"
                >
                  Full event log
                  <span className="ml-2 text-[11px] font-normal text-zinc-500">
                    {entries.length} event{entries.length === 1 ? "" : "s"}
                  </span>
                </h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                aria-label="Close"
              >
                ✕
              </button>
            </header>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-5 py-3">
              {ALL_SEVERITIES.map((s) => {
                const active = filters.has(s);
                const styles = SEVERITY_STYLES[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setFilters((prev) => {
                        const next = new Set(prev);
                        if (next.has(s)) next.delete(s);
                        else next.add(s);
                        return next;
                      });
                    }}
                    className={`rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-wider ring-1 transition-opacity ${
                      active ? styles.chip : "bg-white/[0.02] text-zinc-500 ring-white/5 opacity-60"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${styles.dot}`}
                    />
                    {s} · {counts[s]}
                  </button>
                );
              })}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="ml-auto w-44 rounded-md border border-white/10 bg-floor-800/80 px-2.5 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-400/40 focus:outline-none"
              />
            </div>

            {/* List */}
            <div className="scroll-thin flex-1 overflow-y-auto px-5 py-3 text-[12px] leading-snug">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-zinc-500">
                  {entries.length === 0
                    ? "No events yet — try Run Demo above."
                    : "No events match the current filters."}
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {filtered.map((e) => {
                    const styles = SEVERITY_STYLES[e.severity];
                    return (
                      <li key={e.id} className="flex items-start gap-2.5">
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`}
                        />
                        <span className={styles.text}>
                          <span className="mr-1.5 font-mono text-[10px] text-zinc-500">
                            {formatTs(e.ts)}
                          </span>
                          {e.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            <footer className="flex items-center justify-between border-t border-white/5 px-5 py-2.5 text-[10px] uppercase tracking-wider text-zinc-500">
              <span>
                Showing {filtered.length} of {entries.length}
              </span>
              <span>Press Esc to close</span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatTs(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
