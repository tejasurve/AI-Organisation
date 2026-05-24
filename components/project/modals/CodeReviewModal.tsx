"use client";

import { useState } from "react";

import type { Project } from "@/lib/platform/workflow/types.ts";
import { useProjectStore } from "@/stores/project-store.ts";
import { ApprovalFooter, ModalShell } from "./ModalShell";

interface CodeReviewModalProps {
  project: Project | null;
}

const SEV_TINT: Record<"nit" | "minor" | "major", string> = {
  nit: "text-zinc-400 ring-zinc-400/30 bg-zinc-500/10",
  minor: "text-amber-300 ring-amber-400/30 bg-amber-500/10",
  major: "text-rose-300 ring-rose-400/30 bg-rose-500/10",
};

export function CodeReviewModal({ project }: CodeReviewModalProps) {
  const openModal = useProjectStore((s) => s.openModal);
  const setOpenModal = useProjectStore((s) => s.setOpenModal);
  const open = openModal === "code-review" && !!project?.codeReview;
  const [busy, setBusy] = useState(false);

  async function send(approved: boolean, comment?: string) {
    if (!project) return;
    setBusy(true);
    try {
      await fetch(`/api/project/${project.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, comment }),
      });
      setOpenModal(null);
    } finally {
      setBusy(false);
    }
  }

  if (!project?.codeReview) return null;

  const cr = project.codeReview;
  const unresolved = cr.comments.filter((c) => !c.resolved).length;

  return (
    <ModalShell
      open={open}
      title="Code review — sprint sign-off"
      subtitle={cr.diffSummary}
      size="lg"
      onClose={() => setOpenModal(null)}
      footer={
        project.stage === "code-review" ? (
          <ApprovalFooter
            onApprove={(c) => send(true, c)}
            onRequestChanges={(c) => send(false, c)}
            busy={busy}
          />
        ) : (
          <div className="text-[11px] text-zinc-500">
            Read-only — review already completed.
          </div>
        )
      }
    >
      <div className="mb-3 text-[11px] uppercase tracking-wider text-zinc-500">
        Comments · {unresolved} unresolved
      </div>
      <ul className="flex flex-col gap-2">
        {cr.comments.map((c, i) => (
          <li
            key={i}
            className={`rounded-lg border bg-floor-950 p-3 ${
              c.resolved ? "border-emerald-400/30" : "border-white/10"
            }`}
          >
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
              <span className={`rounded px-1.5 py-0.5 ring-1 ${SEV_TINT[c.severity]}`}>
                {c.severity}
              </span>
              <span className="font-mono text-zinc-400">
                {c.file}:{c.line}
              </span>
              {c.resolved && (
                <span className="ml-auto text-emerald-300">resolved</span>
              )}
            </div>
            <div className="mt-1.5 text-[13px] leading-relaxed text-zinc-200">
              {c.text}
            </div>
          </li>
        ))}
      </ul>
    </ModalShell>
  );
}
