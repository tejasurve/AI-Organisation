"use client";

import { useState } from "react";

import type { Project } from "@/lib/platform/workflow/types.ts";
import { useProjectStore } from "@/stores/project-store.ts";
import { ApprovalFooter, ModalShell } from "./ModalShell";
import { MermaidDiagram } from "./MermaidDiagram";

interface PlanReviewModalProps {
  project: Project | null;
}

export function PlanReviewModal({ project }: PlanReviewModalProps) {
  const openModal = useProjectStore((s) => s.openModal);
  const setOpenModal = useProjectStore((s) => s.setOpenModal);
  const open = openModal === "plan" && !!project?.hld;
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

  if (!project?.hld) {
    return (
      <ModalShell
        open={open}
        title="Architecture plan"
        onClose={() => setOpenModal(null)}
      >
        <p className="text-zinc-400">Plan not yet generated.</p>
      </ModalShell>
    );
  }

  const hld = project.hld;
  const lld = project.lld;

  return (
    <ModalShell
      open={open}
      title="Architecture plan — sign-off"
      subtitle="Solution Architect + Software Architect have drafted the plan. Approve to start design + stories, or request changes."
      size="xl"
      onClose={() => setOpenModal(null)}
      footer={
        project.stage === "plan-approval" ? (
          <ApprovalFooter
            onApprove={(c) => send(true, c)}
            onRequestChanges={(c) => send(false, c)}
            busy={busy}
          />
        ) : (
          <div className="text-[11px] text-zinc-500">
            Read-only — plan already approved.
          </div>
        )
      }
    >
      {hld.revisions && hld.revisions.length > 0 && (
        <section className="mb-5 rounded-xl border border-amber-400/30 bg-amber-500/[0.06] p-3">
          <SectionTitle className="!text-amber-300">
            Revisions · {hld.revisions.length} round
            {hld.revisions.length === 1 ? "" : "s"} of feedback
          </SectionTitle>
          <ul className="space-y-3">
            {hld.revisions.map((r, i) => (
              <li key={i} className="text-[12px]">
                <div className="text-amber-200">
                  Round {i + 1}:
                  <span className="ml-2 italic text-amber-100">
                    "{r.feedback}"
                  </span>
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-zinc-300">
                  {r.changes.map((c, j) => (
                    <li key={j}>{c}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4">
        <section>
          <SectionTitle>Summary</SectionTitle>
          <p className="text-[13px] leading-relaxed text-zinc-200">{hld.summary}</p>

          <SectionTitle className="mt-5">Key bullets</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-zinc-200">
            {hld.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>

          <SectionTitle className="mt-5">Bounded contexts</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {hld.contexts.map((c) => (
              <span
                key={c}
                className="rounded-md bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-cyan-300 ring-1 ring-cyan-400/30"
              >
                {c}
              </span>
            ))}
          </div>

          <SectionTitle className="mt-5">Stack</SectionTitle>
          <ul className="space-y-1.5 text-[12px]">
            {hld.stack.map((s) => (
              <li key={s.area} className="flex gap-2">
                <span className="w-24 shrink-0 text-zinc-500">{s.area}</span>
                <span className="text-zinc-200">
                  <strong className="text-zinc-100">{s.choice}</strong>
                  <span className="text-zinc-500"> — {s.rationale}</span>
                </span>
              </li>
            ))}
          </ul>

          <SectionTitle className="mt-5">Risks</SectionTitle>
          <ul className="space-y-2 text-[12px]">
            {hld.risks.map((r, i) => (
              <li
                key={i}
                className="rounded-md border border-amber-400/20 bg-amber-500/5 px-2.5 py-1.5"
              >
                <div className="font-medium text-amber-200">{r.risk}</div>
                <div className="text-zinc-400">↳ {r.mitigation}</div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionTitle>System diagram</SectionTitle>
          <MermaidDiagram code={hld.diagramMermaid} />

          {lld && (
            <>
              <SectionTitle className="mt-5">Modules (LLD)</SectionTitle>
              <ul className="space-y-1.5 text-[12px]">
                {lld.modules.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-md border border-white/10 bg-floor-950 px-2.5 py-1.5"
                  >
                    <div className="font-mono text-cyan-300">{m.id}</div>
                    <div className="text-zinc-400">{m.description}</div>
                  </li>
                ))}
              </ul>

              <SectionTitle className="mt-5">Data model</SectionTitle>
              <ul className="space-y-1 text-[12px]">
                {lld.dataModel.map((d) => (
                  <li key={d.entity} className="flex flex-wrap gap-1">
                    <span className="rounded bg-floor-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 ring-1 ring-white/10">
                      {d.entity}
                    </span>
                    {d.fields.map((f) => (
                      <span
                        key={f}
                        className="rounded bg-floor-950 px-1.5 py-0.5 text-[10px] text-zinc-500 ring-1 ring-white/5"
                      >
                        {f}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>

              <SectionTitle className="mt-5">APIs</SectionTitle>
              <ul className="space-y-1 text-[11px]">
                {lld.apis.map((a) => (
                  <li key={a.path} className="flex gap-2">
                    <span className="w-12 shrink-0 rounded bg-cyan-500/10 px-1 text-center font-semibold text-cyan-300 ring-1 ring-cyan-400/20">
                      {a.method}
                    </span>
                    <span className="font-mono text-zinc-200">{a.path}</span>
                    <span className="text-zinc-500">— {a.purpose}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </ModalShell>
  );
}

function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300 ${className ?? ""}`}
    >
      {children}
    </h3>
  );
}
