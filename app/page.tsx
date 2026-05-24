"use client";

import dynamic from "next/dynamic";
import { useShallow } from "zustand/react/shallow";

import { ActivityFeed } from "@/components/ActivityFeed";
import { AgentDetailPanel } from "@/components/AgentDetailPanel";
import { Legend } from "@/components/Legend";
import { useSimStream } from "@/components/useSimStream";
import { Welcome } from "@/components/Welcome";

import { CEOChat } from "@/components/project/CEOChat";
import { NewProjectWizard } from "@/components/project/NewProjectWizard";
import { ProjectHeader } from "@/components/project/ProjectHeader";
import { SettingsDrawer } from "@/components/project/SettingsDrawer";
import { useProjectSync } from "@/components/project/useProjectSync";
import { ProjectModals } from "@/components/project/modals/ProjectModals";

import { useProjectStore } from "@/stores/project-store.ts";
import { useSimStore } from "@/stores/sim-store.ts";

// 3D scene only runs in the browser (uses WebGL).
const Office3D = dynamic(
  () => import("@/components/scene/Office3D").then((m) => m.Office3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-2xl border border-white/5 bg-floor-900 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        Loading office…
      </div>
    ),
  },
);

export default function HomePage() {
  // Wire up both sync hooks at the root.
  useSimStream();
  useProjectSync();

  const { feed, selectedAgent, selectAgent } = useSimStore(
    useShallow((s) => ({
      feed: s.feed,
      selectedAgent: s.selectedAgentId ? s.agents[s.selectedAgentId] : null,
      selectAgent: s.selectAgent,
    })),
  );
  const project = useProjectStore((s) => s.project);

  return (
    <main className="flex h-screen w-screen flex-col bg-floor-950">
      <ProjectHeader project={project} />

      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        <section className="relative flex-1">
          <Office3D />
          <AgentDetailPanel agent={selectedAgent} onClose={() => selectAgent(null)} />
        </section>

        <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-white/5 bg-floor-900">
          <ActivityFeed entries={feed} />
        </aside>

        <CEOChat project={project} />
      </div>

      <footer className="border-t border-white/5 bg-floor-900/60 px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        Reality engine: lib/runtime · Simulation engine: lib/simulation · Workflow: lib/platform · SSE: /api/events
      </footer>

      {/* Overlays */}
      <Welcome />
      <Legend />
      <NewProjectWizard />
      <SettingsDrawer />
      <ProjectModals project={project} />
    </main>
  );
}
