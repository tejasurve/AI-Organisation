"use client";

import type { Project } from "@/lib/platform/workflow/types.ts";
import { useProjectStore } from "@/stores/project-store.ts";
import { ModalShell } from "./ModalShell";

interface DefectsModalProps {
  project: Project | null;
}

const SEV_TINT: Record<"P1" | "P2" | "P3", string> = {
  P1: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  P2: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  P3: "bg-zinc-500/15 text-zinc-300 ring-zinc-400/30",
};

const STATUS_TINT: Record<"open" | "in-progress" | "fixed", string> = {
  open: "text-rose-300",
  "in-progress": "text-cyan-300",
  fixed: "text-emerald-300",
};

export function DefectsModal({ project }: DefectsModalProps) {
  const openModal = useProjectStore((s) => s.openModal);
  const setOpenModal = useProjectStore((s) => s.setOpenModal);
  const open = openModal === "defects" && !!project;
  if (!project) return null;

  return (
    <ModalShell
      open={open}
      title="Defect log"
      subtitle={`${project.defects.length} defect${project.defects.length === 1 ? "" : "s"} raised by QA this sprint.`}
      size="md"
      onClose={() => setOpenModal(null)}
    >
      {project.defects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-[12px] text-zinc-500">
          No defects raised yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {project.defects.map((d) => (
            <li
              key={d.id}
              className="rounded-lg border border-white/10 bg-floor-950 p-3"
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                <span
                  className={`rounded px-1.5 py-0.5 font-semibold ring-1 ${SEV_TINT[d.severity]}`}
                >
                  {d.severity}
                </span>
                <span className={STATUS_TINT[d.status]}>{d.status}</span>
                <span className="font-mono text-zinc-600">{d.id}</span>
              </div>
              <div className="mt-1 text-[13px] font-semibold text-zinc-100">
                {d.title}
              </div>
              <pre className="mt-1 whitespace-pre-wrap rounded-md border border-white/10 bg-floor-900 px-2 py-1.5 text-[11px] text-zinc-300">
                {d.repro}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
}
