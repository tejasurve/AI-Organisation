"use client";

import type { Project, UserStory } from "@/lib/platform/workflow/types.ts";
import { useProjectStore } from "@/stores/project-store.ts";
import { ModalShell } from "./ModalShell";

interface StoriesModalProps {
  project: Project | null;
}

const COLUMNS: { id: UserStory["status"]; label: string; tint: string }[] = [
  { id: "todo",        label: "To-do",       tint: "border-zinc-500/40 bg-zinc-500/5" },
  { id: "in-progress", label: "In progress", tint: "border-cyan-400/40 bg-cyan-500/5" },
  { id: "done",        label: "Done",        tint: "border-emerald-400/40 bg-emerald-500/5" },
];

export function StoriesModal({ project }: StoriesModalProps) {
  const openModal = useProjectStore((s) => s.openModal);
  const setOpenModal = useProjectStore((s) => s.setOpenModal);
  const open = openModal === "stories" && !!project;
  if (!project) return null;

  return (
    <ModalShell
      open={open}
      title="Sprint backlog"
      subtitle={`${project.stories.length} vertical-slice user stories drafted by the PM. The dev team is picking them up.`}
      size="xl"
      onClose={() => setOpenModal(null)}
    >
      <div className="grid grid-cols-3 gap-3">
        {COLUMNS.map((col) => {
          const items = project.stories.filter((s) => s.status === col.id);
          return (
            <section
              key={col.id}
              className={`flex flex-col gap-2 rounded-xl border ${col.tint} p-3`}
            >
              <header className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                <span>{col.label}</span>
                <span className="rounded bg-floor-950 px-1.5 py-0.5 text-zinc-400 ring-1 ring-white/10">
                  {items.length}
                </span>
              </header>
              <ul className="flex flex-col gap-2">
                {items.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-lg border border-white/10 bg-floor-950 p-2.5"
                  >
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                      <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-300 ring-1 ring-cyan-400/20">
                        {s.effort}
                      </span>
                      <span className="font-mono text-[9px] text-zinc-600">
                        {s.id}
                      </span>
                    </div>
                    <div className="mt-1 text-[13px] font-semibold text-zinc-100">
                      {s.title}
                    </div>
                    <div className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                      <span className="text-zinc-500">As a</span>{" "}
                      <strong className="text-zinc-300">{s.asA}</strong>{" "}
                      <span className="text-zinc-500">I want</span>{" "}
                      <strong className="text-zinc-300">{s.iWant}</strong>{" "}
                      <span className="text-zinc-500">so that</span>{" "}
                      {s.soThat}
                    </div>
                    <details className="mt-1.5 text-[10.5px] text-zinc-400">
                      <summary className="cursor-pointer select-none uppercase tracking-wider text-zinc-500 hover:text-zinc-300">
                        Acceptance · {s.acceptance.length}
                      </summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4">
                        {s.acceptance.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="rounded-md border border-dashed border-white/10 px-2 py-3 text-center text-[11px] text-zinc-600">
                    Empty
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </ModalShell>
  );
}
