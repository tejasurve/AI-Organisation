"use client";

// components/project/useProjectSync.ts
//
// Polls /api/project for the current project, syncs into the Zustand store,
// and auto-opens an approval modal whenever the workflow enters a gate stage.
//
// Polling is intentionally simple: 1.2s while active, 4s while idle/done.

import { useEffect, useRef } from "react";

import type { Project } from "@/lib/platform/workflow/types.ts";
import { autoOpenFor, useProjectStore } from "@/stores/project-store.ts";

interface ProjectListResponse {
  current: Project | null;
  projects: Project[];
}

export function useProjectSync(): void {
  const setProject = useProjectStore((s) => s.setProject);
  const setOpenModal = useProjectStore((s) => s.setOpenModal);
  const lastStageRef = useRef<string | null>(null);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const r = await fetch("/api/project", { cache: "no-store" });
        if (!r.ok) throw new Error(`status ${r.status}`);
        const j = (await r.json()) as ProjectListResponse;
        if (cancelled) return;
        const proj = j.current;
        setProject(proj);
        if (proj) {
          // Project changed → reset stage memory so the first modal pops.
          if (lastIdRef.current !== proj.id) {
            lastIdRef.current = proj.id;
            lastStageRef.current = null;
          }
          if (lastStageRef.current !== proj.stage && proj.waitingForUser) {
            const auto = autoOpenFor(proj.stage);
            if (auto) setOpenModal(auto);
          }
          lastStageRef.current = proj.stage;
        }
        const interval =
          proj && proj.stage !== "done" && proj.stage !== "intake"
            ? 1200
            : 2200;
        timer = setTimeout(tick, interval);
      } catch {
        timer = setTimeout(tick, 3000);
      }
    }
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [setProject, setOpenModal]);
}
