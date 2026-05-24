"use client";

// components/project/modals/PreviewModal.tsx
//
// The "Preview app" pane. Boots a real `next dev` for the project's
// generated workspace, embeds it in an iframe, and exposes Open-in-tab +
// Stop controls. This is the user's first chance to see the actual app
// the AI Organisation built — not just designs or planning docs.

import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/platform/workflow/types.ts";
import { useProjectStore } from "@/stores/project-store.ts";
import { ModalShell } from "./ModalShell";

type Status = "idle" | "starting" | "ready" | "errored";

interface PreviewState {
  projectId: string;
  status: Status;
  port?: number;
  url?: string;
  pid?: number;
  startedAt?: number;
  errorMessage?: string;
  logTail?: string;
}

interface PreviewModalProps {
  project: Project | null;
}

export function PreviewModal({ project }: PreviewModalProps) {
  const openModal = useProjectStore((s) => s.openModal);
  const setOpenModal = useProjectStore((s) => s.setOpenModal);
  const open = openModal === "preview";

  const [state, setState] = useState<PreviewState | null>(null);
  const [busy, setBusy] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch current status once when the modal opens.
  useEffect(() => {
    if (!open || !project) return;
    void refresh();
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id]);

  // Poll while the server is starting so the UI flips to "ready" promptly.
  useEffect(() => {
    if (!open) return;
    if (state?.status === "starting") {
      pollTimer.current = setInterval(() => void refresh(), 1500);
      return () => {
        if (pollTimer.current) clearInterval(pollTimer.current);
      };
    } else if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, state?.status]);

  if (!project) return null;

  const emittedCount = project.emittedFiles?.length ?? 0;
  const hasWorkspace = emittedCount > 0;

  async function refresh() {
    if (!project) return;
    try {
      const r = await fetch(`/api/project/${project.id}/preview`, { cache: "no-store" });
      const s = (await r.json()) as PreviewState;
      setState(s);
    } catch (err) {
      console.warn("[PreviewModal] fetch failed:", err);
    }
  }

  async function startPreview() {
    if (!project || busy) return;
    setBusy(true);
    setState({ projectId: project.id, status: "starting" });
    try {
      const r = await fetch(`/api/project/${project.id}/preview`, { method: "POST" });
      const s = (await r.json()) as PreviewState;
      setState(s);
      if (s.status === "ready") {
        // Bump iframe key so it forces a reload at the new URL.
        setIframeKey((k) => k + 1);
      }
    } catch (err) {
      setState({
        projectId: project.id,
        status: "errored",
        errorMessage: (err as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function stopPreview() {
    if (!project || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/project/${project.id}/preview`, { method: "DELETE" });
      const s = (await r.json()) as PreviewState;
      setState(s);
    } catch (err) {
      console.warn("[PreviewModal] stop failed:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      open={open}
      size="xl"
      title={`Preview — ${project.brief.name}`}
      subtitle="Boots the real Next.js workspace the Developer agent built. Files are on disk under .simulation/projects/<id>/workspace/."
      onClose={() => setOpenModal(null)}
    >
      {!hasWorkspace ? (
        <div className="rounded-md border border-amber-400/30 bg-amber-500/[0.06] p-4 text-[12px] text-amber-200">
          <div className="font-semibold uppercase tracking-wider">No workspace yet</div>
          <p className="mt-1 text-amber-200/80">
            The Developer agent hasn&apos;t emitted any real source files yet. Once
            sprint-dev runs at least once, the workspace is scaffolded and you
            can preview the app here.
          </p>
        </div>
      ) : (
        <>
          {/* Top control strip */}
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-white/10 bg-floor-950/60 p-3">
            <StatusBadge status={state?.status ?? "idle"} />
            {state?.url && (
              <a
                href={state.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-emerald-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-floor-950 hover:bg-emerald-400"
              >
                Open in new tab ↗
              </a>
            )}
            {(state?.status === "idle" || state?.status === "errored" || !state) && (
              <button
                type="button"
                onClick={startPreview}
                disabled={busy}
                className="rounded-md bg-cyan-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-floor-950 hover:bg-cyan-400 disabled:opacity-40"
              >
                {busy ? "Booting…" : "Boot preview"}
              </button>
            )}
            {state?.status === "starting" && (
              <span className="text-[11px] text-cyan-300">
                Spinning up next dev on port {state.port ?? "…"}…
              </span>
            )}
            {state?.status === "ready" && (
              <button
                type="button"
                onClick={stopPreview}
                disabled={busy}
                className="rounded-md border border-rose-400/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
              >
                {busy ? "…" : "Stop"}
              </button>
            )}
            <button
              type="button"
              onClick={refresh}
              className="ml-auto rounded-md border border-white/10 px-2 py-1 text-[11px] uppercase tracking-wider text-zinc-300 hover:bg-floor-800"
            >
              Refresh
            </button>
          </div>

          {/* Build notes from the Developer LLM */}
          {project.buildNotes && (
            <div className="mt-3 rounded-md border border-violet-400/20 bg-violet-500/[0.05] p-3 text-[12px] text-violet-100/90">
              <div className="text-[10px] uppercase tracking-wider text-violet-300">
                Developer notes
              </div>
              <p className="mt-1 leading-relaxed text-violet-100/85">
                {project.buildNotes}
              </p>
            </div>
          )}

          {/* Iframe — only when ready */}
          {state?.status === "ready" && state.url && (
            <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
              <iframe
                key={iframeKey}
                src={state.url}
                title={`${project.brief.name} preview`}
                className="block h-[560px] w-full"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          )}

          {/* Error / log tail */}
          {state?.status === "errored" && (
            <div className="mt-3 rounded-md border border-rose-400/30 bg-rose-500/[0.06] p-3">
              <div className="text-[10px] uppercase tracking-wider text-rose-300">
                Preview failed
              </div>
              <p className="mt-1 text-[12px] text-rose-200">
                {state.errorMessage ?? "Unknown error."}
              </p>
              {state.logTail && (
                <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-white/5 bg-black/60 p-2 text-[10px] leading-relaxed text-zinc-400 whitespace-pre-wrap">
                  {state.logTail}
                </pre>
              )}
            </div>
          )}

          {/* Files emitted summary */}
          <details className="mt-4 rounded-md border border-white/10 bg-floor-950/60 px-3 py-2 text-[12px]">
            <summary className="cursor-pointer text-zinc-300">
              {emittedCount} file{emittedCount === 1 ? "" : "s"} on disk
            </summary>
            <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-400">
              {(project.emittedFiles ?? []).map((f) => (
                <li key={f} className="font-mono">
                  {f}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </ModalShell>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    idle: { label: "Idle", cls: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300" },
    starting: { label: "Starting", cls: "border-amber-400/40 bg-amber-500/10 text-amber-200" },
    ready: { label: "Ready", cls: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" },
    errored: { label: "Errored", cls: "border-rose-400/40 bg-rose-500/10 text-rose-200" },
  };
  const m = map[status];
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${m.cls}`}
    >
      ● {m.label}
    </span>
  );
}
