"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { ActivityEntry, SimSeverity } from "@/lib/simulation/types.ts";
import { ActivityHistoryModal } from "./ActivityHistoryModal";

interface ActivityFeedProps {
  entries: ActivityEntry[];
}

/** How many recent events to show in the side panel before old ones fall off. */
const VISIBLE_COUNT = 12;

const SEVERITY_STYLES: Record<
  SimSeverity,
  { dot: string; text: string; bar: string }
> = {
  info: {
    dot: "bg-sky-400",
    text: "text-zinc-200",
    bar: "border-sky-400/60",
  },
  success: {
    dot: "bg-emerald-400",
    text: "text-emerald-100",
    bar: "border-emerald-400/60",
  },
  warn: {
    dot: "bg-amber-400",
    text: "text-amber-100",
    bar: "border-amber-400/60",
  },
  danger: {
    dot: "bg-red-500",
    text: "text-red-100",
    bar: "border-red-400/60",
  },
};

export function ActivityFeed({ entries }: ActivityFeedProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  // Newest first, capped at VISIBLE_COUNT. Older items disappear naturally
  // (animated out) as fresh ones arrive at the top.
  const visible = useMemo(() => {
    if (entries.length <= VISIBLE_COUNT) {
      // Show newest at the top.
      return entries.slice().reverse();
    }
    return entries.slice(-VISIBLE_COUNT).reverse();
  }, [entries]);

  const olderCount = Math.max(0, entries.length - VISIBLE_COUNT);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-white/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
              Live Activity
            </h2>
            <span className="font-mono text-[10px] text-zinc-500">
              {entries.length} total
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            Real events from the reality engine.
          </p>
        </header>

        {/* Fixed-N feed — no scroll, no layout jumps. */}
        <div className="flex-1 overflow-hidden px-3 py-2">
          {visible.length === 0 ? (
            <div className="flex h-full items-center justify-center px-3 text-center text-[12px] text-zinc-600">
              Waiting for the first cycle to start…
            </div>
          ) : (
            <ul className="space-y-1">
              <AnimatePresence initial={false}>
                {visible.map((e) => {
                  const styles = SEVERITY_STYLES[e.severity];
                  return (
                    <motion.li
                      key={e.id}
                      layout
                      initial={{ opacity: 0, x: 8, height: 0 }}
                      animate={{ opacity: 1, x: 0, height: "auto" }}
                      exit={{ opacity: 0, x: -8, height: 0 }}
                      transition={{
                        type: "spring",
                        damping: 24,
                        stiffness: 280,
                        opacity: { duration: 0.18 },
                      }}
                      className="overflow-hidden"
                    >
                      <div
                        className={`flex items-start gap-2 rounded border-l-2 bg-white/[0.015] px-2 py-1.5 text-[11.5px] leading-snug ${styles.bar}`}
                      >
                        <span
                          className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`}
                        />
                        <span className={`min-w-0 flex-1 ${styles.text}`}>
                          <span className="mr-1 font-mono text-[10px] text-zinc-500">
                            {formatTs(e.ts)}
                          </span>
                          <span className="break-words">{e.text}</span>
                        </span>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {/* Footer button — opens full history modal. */}
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          disabled={entries.length === 0}
          className="group flex shrink-0 items-center justify-between border-t border-white/5 bg-floor-800/30 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-zinc-300 transition-colors hover:bg-floor-800/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>View full history</span>
          <span className="flex items-center gap-2 text-[10px] text-zinc-500">
            {olderCount > 0 && (
              <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-cyan-300 ring-1 ring-cyan-400/20">
                +{olderCount} older
              </span>
            )}
            <span className="opacity-60 transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </button>
      </div>

      <ActivityHistoryModal
        open={historyOpen}
        entries={entries}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  );
}

function formatTs(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
