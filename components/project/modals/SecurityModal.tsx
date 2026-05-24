"use client";

import type { Project } from "@/lib/platform/workflow/types.ts";
import { useProjectStore } from "@/stores/project-store.ts";
import { ModalShell } from "./ModalShell";

interface SecurityModalProps {
  project: Project | null;
}

const SEV: Record<"critical" | "high" | "low", string> = {
  critical: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  high: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  low: "bg-zinc-500/15 text-zinc-300 ring-zinc-400/30",
};

export function SecurityModal({ project }: SecurityModalProps) {
  const openModal = useProjectStore((s) => s.openModal);
  const setOpenModal = useProjectStore((s) => s.setOpenModal);
  const open = openModal === "security" && !!project?.security;
  if (!project?.security) return null;

  return (
    <ModalShell
      open={open}
      title={`Security audit · ${project.security.verdict}`}
      subtitle="OWASP Top 10, secret hygiene, prompt-injection. Security's final go / no-go before deployment."
      size="md"
      onClose={() => setOpenModal(null)}
    >
      <div
        className={`mb-3 rounded-lg px-3 py-2 text-[12px] font-semibold uppercase tracking-wider ring-1 ${
          project.security.verdict === "GO"
            ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
            : "bg-rose-500/15 text-rose-300 ring-rose-400/30"
        }`}
      >
        Verdict — {project.security.verdict}
      </div>
      <ul className="flex flex-col gap-2">
        {project.security.findings.map((f, i) => (
          <li
            key={i}
            className="rounded-lg border border-white/10 bg-floor-950 p-3"
          >
            <div
              className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ring-1 ${SEV[f.severity]}`}
            >
              {f.severity}
            </div>
            <div className="text-[13px] text-zinc-200">{f.finding}</div>
            <div className="mt-1 text-[11px] text-zinc-500">↳ {f.fix}</div>
          </li>
        ))}
      </ul>
    </ModalShell>
  );
}
