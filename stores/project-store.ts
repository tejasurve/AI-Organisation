"use client";

// stores/project-store.ts
//
// Client-side mirror of the server project state. We poll /api/project/:id
// every ~1.2s while a project is active. Pollings is fine for hackathon:
// the workflow events arrive at human-perceptible rates (every few seconds)
// so polling doesn't impact UX, and SSE plumbing for two streams (sim + project)
// would be more complex than we need today.

import { create } from "zustand";

import type { Project, StageId } from "@/lib/platform/workflow/types.ts";

interface ProjectStore {
  project: Project | null;
  loading: boolean;
  /** Sticky modal open state — the user can dismiss without losing approval ability. */
  openModal:
    | "features"
    | "plan"
    | "designs"
    | "handoff"
    | "stories"
    | "code-review"
    | "defects"
    | "security"
    | "preview"
    | null;
  /** New-project wizard visibility. */
  wizardOpen: boolean;
  /** Settings drawer visibility. */
  settingsOpen: boolean;
  /** CEO chat panel collapse state. */
  chatCollapsed: boolean;

  setProject(p: Project | null): void;
  setOpenModal(m: ProjectStore["openModal"]): void;
  setWizardOpen(open: boolean): void;
  setSettingsOpen(open: boolean): void;
  toggleChatCollapsed(): void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: null,
  loading: false,
  openModal: null,
  wizardOpen: false,
  settingsOpen: false,
  chatCollapsed: false,

  setProject(p) {
    set({ project: p });
  },
  setOpenModal(m) {
    set({ openModal: m });
  },
  setWizardOpen(open) {
    set({ wizardOpen: open });
  },
  setSettingsOpen(open) {
    set({ settingsOpen: open });
  },
  toggleChatCollapsed() {
    set((s) => ({ chatCollapsed: !s.chatCollapsed }));
  },
}));

export function autoOpenFor(stage: StageId): ProjectStore["openModal"] {
  if (stage === "product-discovery") return "features";
  if (stage === "plan-approval") return "plan";
  if (stage === "design-approval") return "designs";
  if (stage === "handoff") return "handoff";
  if (stage === "code-review") return "code-review";
  return null;
}
