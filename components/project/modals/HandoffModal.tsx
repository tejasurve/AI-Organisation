"use client";

// components/project/modals/HandoffModal.tsx
//
// Surfaces the three artefacts the user gets after architecture + design
// approval: the HLD (Solution Architect), the LLD (CTO), and the locked Stitch
// UI link. Each item is a direct link into the existing modal/external app so
// the user can audit before sprint 1 begins.

import type { Project } from "@/lib/platform/workflow/types.ts";
import { useProjectStore } from "@/stores/project-store.ts";
import { ModalShell } from "./ModalShell";

interface HandoffModalProps {
  project: Project | null;
}

export function HandoffModal({ project }: HandoffModalProps) {
  const openModal = useProjectStore((s) => s.openModal);
  const setOpenModal = useProjectStore((s) => s.setOpenModal);
  const open = openModal === "handoff";

  if (!project) return null;

  const hld = project.hld;
  const lld = project.lld;
  const lockedScreen = project.design?.screens[0];
  const stitchUrl =
    lockedScreen?.figmaUrl &&
    !lockedScreen.figmaUrl.endsWith("/")
      ? lockedScreen.figmaUrl
      : null;
  const features = project.features;
  const validatedMust = features?.features
    .filter((f) => f.priority === "must" && f.designValidation)
    ?? [];
  const supplemented = validatedMust.filter(
    (f) => f.designValidation?.state === "supplemented",
  );
  const uncovered = validatedMust.filter(
    (f) => f.designValidation?.state === "uncovered",
  );

  return (
    <ModalShell
      open={open}
      title={`Handoff package — ${project.brief.name}`}
      subtitle="Everything the team needs to start sprint 1. Three artefacts: the HLD from the Solution Architect, the LLD from the CTO, and the locked Stitch UI design."
      size="xl"
      onClose={() => setOpenModal(null)}
    >
      <div className="flex flex-col gap-4">
        {/* 1. HLD card */}
        <button
          type="button"
          onClick={() => setOpenModal("plan")}
          className="group flex items-start justify-between gap-4 rounded-xl border border-cyan-400/30 bg-cyan-500/[0.06] p-4 text-left transition hover:border-cyan-300/50 hover:bg-cyan-500/[0.1]"
        >
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300">
              1 · High-Level Design — Solution Architect
            </div>
            <h3 className="mt-1 text-base font-semibold text-zinc-100">
              {hld?.summary ?? "HLD pending"}
            </h3>
            {hld && (
              <p className="mt-1 text-[12px] text-zinc-400">
                {hld.contexts.length} bounded context
                {hld.contexts.length === 1 ? "" : "s"}:{" "}
                <span className="text-cyan-300">
                  {hld.contexts.join(", ")}
                </span>
                . {hld.risks.length} risk
                {hld.risks.length === 1 ? "" : "s"} with mitigations.
              </p>
            )}
          </div>
          <span className="self-center text-[12px] uppercase tracking-wider text-cyan-300 group-hover:text-cyan-200">
            Open ↗
          </span>
        </button>

        {/* 2. LLD card */}
        <button
          type="button"
          onClick={() => setOpenModal("plan")}
          className="group flex items-start justify-between gap-4 rounded-xl border border-violet-400/30 bg-violet-500/[0.06] p-4 text-left transition hover:border-violet-300/50 hover:bg-violet-500/[0.1]"
        >
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[0.18em] text-violet-300">
              2 · Low-Level Design — CTO
            </div>
            <h3 className="mt-1 text-base font-semibold text-zinc-100">
              {lld
                ? `${lld.modules.length} modules · ${lld.dataModel.length} entities · ${lld.apis.length} APIs`
                : "LLD pending"}
            </h3>
            {lld && (
              <p className="mt-1 text-[12px] text-zinc-400">
                Modules: {lld.modules.slice(0, 4).map((m) => m.id).join(", ")}
                {lld.modules.length > 4 ? "…" : ""}
              </p>
            )}
          </div>
          <span className="self-center text-[12px] uppercase tracking-wider text-violet-300 group-hover:text-violet-200">
            Open ↗
          </span>
        </button>

        {/* 3. Stitch UI card */}
        <div className="flex items-stretch gap-4 rounded-xl border border-pink-400/30 bg-pink-500/[0.06] p-4">
          {lockedScreen?.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lockedScreen.thumbnailUrl}
              alt={lockedScreen.title}
              className="h-24 w-32 shrink-0 rounded-md border border-white/10 object-cover"
            />
          )}
          <div className="flex flex-1 flex-col">
            <div className="text-[10px] uppercase tracking-[0.18em] text-pink-300">
              3 · UI Design — Stitch (Gemini 3.1 Pro)
            </div>
            <h3 className="mt-1 text-base font-semibold text-zinc-100">
              {lockedScreen?.title ?? "Design pending"}
            </h3>
            {project.design?.selectedTheme && (
              <p className="mt-1 text-[12px] text-zinc-400">
                Locked theme:{" "}
                <span className="text-pink-300">
                  {project.design.selectedTheme}
                </span>
                {project.design.archivedScreens && project.design.archivedScreens.length > 0
                  ? ` — ${project.design.archivedScreens.length} other variants archived.`
                  : "."}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOpenModal("designs")}
                className="rounded-md border border-pink-400/30 px-2.5 py-1 text-[11px] uppercase tracking-wider text-pink-200 hover:bg-pink-500/[0.1]"
              >
                Open in app ↗
              </button>
              {stitchUrl && (
                <a
                  href={stitchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-pink-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-floor-950 hover:bg-pink-400"
                >
                  Open in Stitch ↗
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Feature ↔ design validation summary */}
        {validatedMust.length > 0 && (
          <section className="rounded-xl border border-white/10 bg-floor-950/60 p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-zinc-400">
              Feature ↔ design validation
            </h3>
            <p className="mt-1 text-[12px] text-zinc-300">
              The Designer checked every <span className="text-zinc-100">must</span>{" "}
              feature against the locked design:
            </p>
            <ul className="mt-2 space-y-1 text-[12px]">
              {validatedMust.map((f) => (
                <li
                  key={f.id}
                  className="flex items-start gap-2 rounded-md border border-white/5 bg-floor-900/60 px-2.5 py-1.5"
                >
                  <span
                    className={
                      f.designValidation?.state === "covered"
                        ? "text-emerald-400"
                        : f.designValidation?.state === "supplemented"
                          ? "text-amber-400"
                          : "text-rose-400"
                    }
                  >
                    {f.designValidation?.state === "covered"
                      ? "✓"
                      : f.designValidation?.state === "supplemented"
                        ? "+"
                        : "!"}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium text-zinc-100">{f.name}</span>
                    <span className="ml-2 text-zinc-500">
                      — {f.designValidation?.note}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {(supplemented.length > 0 || uncovered.length > 0) && (
              <p className="mt-2 text-[11px] text-zinc-500">
                {supplemented.length > 0
                  ? `${supplemented.length} feature${supplemented.length === 1 ? "" : "s"} got a supplementary screen in the locked theme. `
                  : ""}
                {uncovered.length > 0
                  ? `${uncovered.length} feature${uncovered.length === 1 ? "" : "s"} still uncovered — flagged for PO + you.`
                  : ""}
              </p>
            )}
          </section>
        )}

        <div className="rounded-md border border-emerald-400/30 bg-emerald-500/[0.06] px-3 py-2 text-[12px] text-emerald-200">
          Ready to slice sprint 1? The Engineering Manager picks this up next —
          the user stories will reference the bounded contexts above.
        </div>

        {(project.emittedFiles?.length ?? 0) > 0 && (
          <div className="rounded-md border border-cyan-400/30 bg-cyan-500/[0.06] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-cyan-300">
                Workspace ready · {project.emittedFiles?.length} files
              </span>
              <button
                type="button"
                onClick={() => setOpenModal("preview")}
                className="ml-auto rounded-md bg-cyan-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-floor-950 transition-colors hover:bg-cyan-400"
              >
                Preview app ↗
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
