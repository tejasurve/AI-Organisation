"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

interface ModalShellProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
}

export function ModalShell({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children,
  size = "lg",
}: ModalShellProps) {
  const w = size === "xl" ? "w-[980px]" : size === "lg" ? "w-[800px]" : "w-[600px]";
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 16, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className={`${w} max-h-[88vh] max-w-[94vw] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-floor-900 to-floor-950 shadow-2xl flex flex-col`}
          >
            <header className="flex items-start justify-between border-b border-white/10 px-5 py-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                  Boardroom review
                </div>
                <h2 className="mt-1 text-lg font-semibold text-zinc-100">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-1 max-w-[640px] text-[12px] text-zinc-400">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-white/10 px-2 py-1 text-[11px] uppercase tracking-wider text-zinc-300 hover:bg-floor-800"
              >
                Close
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && (
              <footer className="border-t border-white/10 bg-floor-900/60 px-5 py-3">
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ApprovalFooter({
  onApprove,
  onRequestChanges,
  busy,
}: {
  onApprove: (comment?: string) => void;
  onRequestChanges: (comment: string) => void;
  busy?: boolean;
}) {
  return (
    <ApprovalFooterImpl
      onApprove={onApprove}
      onRequestChanges={onRequestChanges}
      busy={busy}
    />
  );
}

import { useState } from "react";

function ApprovalFooterImpl({
  onApprove,
  onRequestChanges,
  busy,
}: {
  onApprove: (comment?: string) => void;
  onRequestChanges: (comment: string) => void;
  busy?: boolean;
}) {
  const [comment, setComment] = useState("");
  return (
    <div className="flex items-center justify-between gap-3">
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment / change request…"
        className="flex-1 rounded-md border border-white/10 bg-floor-950 px-3 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => {
          if (comment.trim().length > 0) onRequestChanges(comment.trim());
          else onApprove();
        }}
        disabled={busy}
        className="rounded-md border border-rose-400/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
      >
        Request changes
      </button>
      <button
        type="button"
        onClick={() => onApprove(comment.trim() || undefined)}
        disabled={busy}
        className="rounded-md bg-emerald-500 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-floor-950 hover:bg-emerald-400 disabled:opacity-40"
      >
        {busy ? "…" : "Approve"}
      </button>
    </div>
  );
}
