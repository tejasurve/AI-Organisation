"use client";

// components/project/modals/FeaturesModal.tsx
//
// Surfaces the Product Owner's feature catalogue — personas, MoSCoW-prioritised
// features, open questions, explicit out-of-scope. Read-only review modal;
// no approval gate here (the PO output rolls into the SA/CTO stages
// automatically, with feedback loops handled by the plan-approval modal).

import type { Project } from "@/lib/platform/workflow/types.ts";
import { useProjectStore } from "@/stores/project-store.ts";
import { ModalShell } from "./ModalShell";

interface FeaturesModalProps {
  project: Project | null;
}

const PRIORITY_LABEL: Record<"must" | "should" | "could" | "wont", string> = {
  must: "Must",
  should: "Should",
  could: "Could",
  wont: "Won't",
};

const PRIORITY_STYLE: Record<"must" | "should" | "could" | "wont", string> = {
  must: "border-rose-400/40 bg-rose-500/10 text-rose-200",
  should: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  could: "border-sky-400/40 bg-sky-500/10 text-sky-200",
  wont: "border-zinc-400/40 bg-zinc-500/10 text-zinc-300",
};

export function FeaturesModal({ project }: FeaturesModalProps) {
  const openModal = useProjectStore((s) => s.openModal);
  const setOpenModal = useProjectStore((s) => s.setOpenModal);
  const open = openModal === "features" && !!project?.features;

  if (!project?.features) {
    return (
      <ModalShell
        open={open}
        title="Product · Feature catalogue"
        onClose={() => setOpenModal(null)}
      >
        <p className="text-zinc-400">
          The Product Owner hasn't drafted features yet.
        </p>
      </ModalShell>
    );
  }

  const f = project.features;
  const must = f.features.filter((x) => x.priority === "must");
  const should = f.features.filter((x) => x.priority === "should");
  const couldOrWont = f.features.filter(
    (x) => x.priority === "could" || x.priority === "wont",
  );

  return (
    <ModalShell
      open={open}
      title="Product · Feature catalogue"
      subtitle="Drafted by the Product Owner. Every feature needs an architectural home (Solution Architect) and a validated UI (Designer)."
      size="xl"
      onClose={() => setOpenModal(null)}
    >
      <div className="flex flex-col gap-6">
        {/* Personas */}
        <section>
          <h3 className="mb-2 text-[11px] uppercase tracking-wider text-zinc-400">
            Personas
          </h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {f.personas.map((p) => (
              <li
                key={p.name}
                className="rounded-lg border border-white/10 bg-floor-950/60 p-3"
              >
                <div className="text-[13px] font-semibold text-zinc-100">
                  {p.name}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
                  {p.context}
                </p>
                <ul className="mt-2 space-y-0.5 text-[12px] text-zinc-300">
                  {p.needs.map((n, i) => (
                    <li key={i} className="before:mr-1 before:text-cyan-400 before:content-['·']">
                      {n}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        {/* Features grouped by MoSCoW */}
        {([
          { label: "Must — committed for this cycle", group: must },
          { label: "Should — ships if must finishes early", group: should },
          { label: "Could / Won't — explicit deferral", group: couldOrWont },
        ] as const)
          .filter(({ group }) => group.length > 0)
          .map(({ label, group }) => (
            <section key={label}>
              <h3 className="mb-2 text-[11px] uppercase tracking-wider text-zinc-400">
                {label}
              </h3>
              <ul className="flex flex-col gap-3">
                {group.map((feature) => (
                  <li
                    key={feature.id}
                    className="rounded-lg border border-white/10 bg-floor-950/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${PRIORITY_STYLE[feature.priority]}`}
                        >
                          {PRIORITY_LABEL[feature.priority]}
                        </span>
                        <span className="text-[13px] font-semibold text-zinc-100">
                          {feature.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500">
                        {feature.id}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] italic text-zinc-300">
                      {feature.userJob}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                      <span>
                        <span className="text-zinc-400">User:</span> {feature.primaryUser}
                      </span>
                      {feature.contextHome && (
                        <span>
                          <span className="text-zinc-400">Context:</span>{" "}
                          <span className="text-cyan-300">{feature.contextHome}</span>
                        </span>
                      )}
                      {feature.designValidation && (
                        <span
                          className={
                            feature.designValidation.state === "covered"
                              ? "text-emerald-400"
                              : feature.designValidation.state === "supplemented"
                                ? "text-amber-400"
                                : "text-rose-400"
                          }
                        >
                          <span className="text-zinc-400">UI:</span>{" "}
                          {feature.designValidation.state}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[12px] text-zinc-400">
                      <span className="text-zinc-500">Value: </span>
                      {feature.valueHypothesis}
                    </p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300">
                        Acceptance signals
                      </summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12px] text-zinc-300">
                        {feature.acceptanceSignals.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          ))}

        {/* Open questions */}
        {f.openQuestions.length > 0 && (
          <section>
            <h3 className="mb-2 text-[11px] uppercase tracking-wider text-zinc-400">
              Open questions for you
            </h3>
            <ul className="space-y-1 text-[12px] text-zinc-200">
              {f.openQuestions.map((q, i) => (
                <li
                  key={i}
                  className="rounded-md border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2"
                >
                  {q}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Out of scope */}
        {f.outOfScope.length > 0 && (
          <section>
            <h3 className="mb-2 text-[11px] uppercase tracking-wider text-zinc-400">
              Explicitly out of scope
            </h3>
            <ul className="space-y-1 text-[12px] text-zinc-300">
              {f.outOfScope.map((s, i) => (
                <li
                  key={i}
                  className="rounded-md border border-zinc-500/20 bg-zinc-500/[0.06] px-3 py-1.5"
                >
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        {f.revisions && f.revisions.length > 0 && (
          <section>
            <h3 className="mb-2 text-[11px] uppercase tracking-wider text-zinc-400">
              Revisions log
            </h3>
            <ol className="space-y-2 text-[12px] text-zinc-300">
              {f.revisions.map((r, i) => (
                <li key={i} className="rounded-md border border-cyan-500/20 bg-cyan-500/[0.04] px-3 py-2">
                  <div className="text-[11px] text-zinc-500">
                    {new Date(r.at).toLocaleString()}
                  </div>
                  <div className="mt-1 italic text-zinc-200">"{r.feedback}"</div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-zinc-300">
                    {r.changes.map((c, j) => (
                      <li key={j}>{c}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </ModalShell>
  );
}
