"use client";

// components/project/modals/ProjectModals.tsx
//
// Single mount point for every workflow modal. The Zustand store's
// `openModal` selector decides which one shows; only one can be open at a
// time, but the ModalShell rendering uses AnimatePresence to fade.

import type { Project } from "@/lib/platform/workflow/types.ts";
import { CodeReviewModal } from "./CodeReviewModal";
import { DefectsModal } from "./DefectsModal";
import { DesignsModal } from "./DesignsModal";
import { FeaturesModal } from "./FeaturesModal";
import { HandoffModal } from "./HandoffModal";
import { PlanReviewModal } from "./PlanReviewModal";
import { PreviewModal } from "./PreviewModal";
import { SecurityModal } from "./SecurityModal";
import { StoriesModal } from "./StoriesModal";

export function ProjectModals({ project }: { project: Project | null }) {
  return (
    <>
      <FeaturesModal project={project} />
      <PlanReviewModal project={project} />
      <DesignsModal project={project} />
      <HandoffModal project={project} />
      <StoriesModal project={project} />
      <CodeReviewModal project={project} />
      <DefectsModal project={project} />
      <SecurityModal project={project} />
      <PreviewModal project={project} />
    </>
  );
}
