"use client";

// components/project/CEOChat.tsx
//
// The slide-out conversation panel. This is the user's primary affordance —
// they always start by talking to the CEO, and the CEO routes to the rest
// of the team. Every persona that speaks in the workflow appears here.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import {
  PERSONAS,
  STAGE_ROLE_LABEL,
  STAGE_ROLE_TO_PERSONA,
  type PersonaId,
} from "@/lib/platform/personas/catalog.ts";
import type { ChatTurn, Project, StageId } from "@/lib/platform/workflow/types.ts";
import { STAGE_META } from "@/lib/platform/workflow/types.ts";
import { useProjectStore } from "@/stores/project-store.ts";

// Human-readable, per-stage "what's happening" line shown next to the
// typing indicator. Keeps the user informed even when the LLM call takes
// a while or runs in demo mode.
const THINKING_BY_STAGE: Partial<Record<StageId, string>> = {
  intake: "is reading your pitch and shaping the brief",
  "cto-review": "is reviewing the brief with the architects",
  "plan-draft": "is drafting the architecture plan",
  "design-draft": "is generating concept screens via Stitch",
  stories: "is slicing the plan into vertical user stories",
  "sprint-dev": "is implementing the stories",
  "qa-review": "is running the test plan",
  "code-review": "is reviewing the pull request",
  "defect-fix": "is addressing the review comments + defects",
  "security-audit": "is running the security audit",
  deploy: "is shipping the sprint to staging",
};

interface CEOChatProps {
  project: Project | null;
}

export function CEOChat({ project }: CEOChatProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sprintFocus, setSprintFocus] = useState("");
  const [planningSprint, setPlanningSprint] = useState(false);
  const setWizardOpen = useProjectStore((s) => s.setWizardOpen);
  const setOpenModal = useProjectStore((s) => s.setOpenModal);
  const chatCollapsed = useProjectStore((s) => s.chatCollapsed);
  const toggleChatCollapsed = useProjectStore((s) => s.toggleChatCollapsed);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [project?.chat.length, chatCollapsed]);

  if (chatCollapsed) {
    return (
      <button
        type="button"
        onClick={toggleChatCollapsed}
        className="pointer-events-auto fixed right-3 top-1/2 z-30 -translate-y-1/2 rounded-l-xl border border-white/10 bg-floor-900/95 px-2 py-3 text-[11px] uppercase tracking-[0.2em] text-zinc-300 shadow-xl backdrop-blur hover:bg-floor-800"
        style={{ writingMode: "vertical-rl" }}
      >
        Talk to your CEO
      </button>
    );
  }

  async function send() {
    if (!project || !text.trim() || sending) return;
    setSending(true);
    try {
      await fetch(`/api/project/${project.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      setText("");
    } finally {
      setSending(false);
    }
  }

  async function planNextSprint() {
    if (!project || !sprintFocus.trim() || planningSprint) return;
    setPlanningSprint(true);
    try {
      const r = await fetch(`/api/project/${project.id}/next-sprint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: sprintFocus.trim() }),
      });
      if (r.ok) setSprintFocus("");
    } finally {
      setPlanningSprint(false);
    }
  }

  const stageLabel = project ? STAGE_META[project.stage].label : "Idle";

  // The team is "thinking" when we're mid-stage (not paused for the user
  // and not finished). We surface this as a typing indicator beneath the
  // most recent chat turn so the user can SEE that work is in progress.
  const isThinking =
    !!project && !project.waitingForUser && project.stage !== "done";
  const thinkingPersonaId: PersonaId | null = project
    ? STAGE_ROLE_TO_PERSONA[STAGE_META[project.stage].owner]
    : null;
  const thinkingPersona = thinkingPersonaId ? PERSONAS[thinkingPersonaId] : null;
  const thinkingLabel = project
    ? THINKING_BY_STAGE[project.stage] ?? "is working"
    : "";

  return (
    <aside className="pointer-events-auto flex h-full w-[420px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-floor-900/95 to-floor-950/95 shadow-2xl backdrop-blur">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 bg-floor-900/80 px-4 py-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Boardroom
          </div>
          <div className="mt-0.5 text-sm font-semibold text-zinc-100">
            {project ? project.brief.name : "No active project"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-cyan-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-cyan-300 ring-1 ring-cyan-400/30">
            {stageLabel}
          </span>
          <button
            type="button"
            onClick={toggleChatCollapsed}
            className="rounded-md border border-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-400 hover:bg-floor-800"
          >
            Hide
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!project ? (
          <EmptyState onStart={() => setWizardOpen(true)} />
        ) : (
          <ul className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {project.chat.map((turn) => (
                <ChatBubble
                  key={turn.id}
                  turn={turn}
                  onOpenAttachment={() => {
                    if (turn.attachment?.kind === "features") setOpenModal("features");
                    else if (turn.attachment?.kind === "plan") setOpenModal("plan");
                    else if (turn.attachment?.kind === "designs") setOpenModal("designs");
                    else if (turn.attachment?.kind === "handoff") setOpenModal("handoff");
                    else if (turn.attachment?.kind === "stories") setOpenModal("stories");
                    else if (turn.attachment?.kind === "code-review") setOpenModal("code-review");
                    else if (turn.attachment?.kind === "defects") setOpenModal("defects");
                    else if (turn.attachment?.kind === "security") setOpenModal("security");
                  }}
                />
              ))}
            </AnimatePresence>
            {isThinking && thinkingPersona && (
              <ThinkingBubble persona={thinkingPersona} label={thinkingLabel} />
            )}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>

      {/* Footer composer */}
      {project && (
        <footer className="border-t border-white/10 bg-floor-900/80 p-3">
          {isThinking && thinkingPersona && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-2.5 py-1.5 text-[11px] text-amber-200">
              <span className="text-base leading-none">{thinkingPersona.emoji}</span>
              <span className="font-semibold">{thinkingPersona.shortTitle}</span>
              <span className="text-amber-200/80">{thinkingLabel}</span>
              <TypingDots className="ml-0.5" />
              <span className="ml-auto text-[10px] uppercase tracking-wider text-amber-300/70">
                {STAGE_ROLE_LABEL[STAGE_META[project.stage].owner]}
              </span>
            </div>
          )}
          {project.stage === "done" && (
            <div className="mb-2 rounded-lg border border-emerald-400/30 bg-emerald-500/[0.06] p-2.5">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-emerald-300">
                <span className="font-semibold">
                  Sprint {project.currentSprint} shipped
                </span>
                <span className="text-emerald-300/70">
                  Plan sprint {project.currentSprint + 1}
                </span>
              </div>
              {(project.emittedFiles?.length ?? 0) > 0 && (
                <div className="mt-2 flex items-center gap-2 rounded-md border border-cyan-400/30 bg-cyan-500/[0.08] px-2.5 py-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-cyan-300">
                    {project.emittedFiles?.length} files on disk
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenModal("preview")}
                    className="ml-auto rounded-md bg-cyan-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-floor-950 transition-colors hover:bg-cyan-400"
                  >
                    Preview app ↗
                  </button>
                </div>
              )}
              <div className="mt-2 flex items-end gap-2">
                <textarea
                  value={sprintFocus}
                  onChange={(e) => setSprintFocus(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      planNextSprint();
                    }
                  }}
                  rows={2}
                  placeholder="What should we focus on next sprint? (e.g. 'ship messaging + harden the postcode parser')"
                  className="min-h-[44px] flex-1 resize-none rounded-md border border-emerald-400/20 bg-floor-950 px-2.5 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={planNextSprint}
                  disabled={!sprintFocus.trim() || planningSprint}
                  className="rounded-md bg-emerald-500 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-floor-950 transition-colors hover:bg-emerald-400 disabled:opacity-40"
                >
                  {planningSprint ? "Planning…" : `Plan sprint ${project.currentSprint + 1}`}
                </button>
              </div>
              {project.sprintHistory.length > 0 && (
                <div className="mt-1.5 text-[10px] text-emerald-300/60">
                  {project.sprintHistory.length} previous{" "}
                  {project.sprintHistory.length === 1 ? "sprint" : "sprints"} archived
                </div>
              )}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              placeholder={
                project.waitingForUser
                  ? "Reply to the team…"
                  : isThinking && thinkingPersona
                    ? `${thinkingPersona.shortTitle} ${thinkingLabel} — your note will be queued.`
                    : "Leave a note for the team…"
              }
              className="min-h-[44px] flex-1 resize-none rounded-lg border border-white/10 bg-floor-950 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || sending}
              className="rounded-lg bg-cyan-500 px-3 py-2 text-[12px] font-semibold uppercase tracking-wider text-floor-950 transition-colors hover:bg-cyan-400 disabled:opacity-40"
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">
            <span>Enter to send · Shift+Enter for newline</span>
            <span>{project.totalInTokens + project.totalOutTokens} tokens</span>
          </div>
        </footer>
      )}
    </aside>
  );
}

function ThinkingBubble({
  persona,
  label,
}: {
  persona: (typeof PERSONAS)[PersonaId];
  label: string;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mr-8 flex items-start gap-2 self-start"
    >
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base shadow-md"
        style={{
          background: "linear-gradient(140deg,#1f2a44,#10182a)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
        title={persona.title}
      >
        {persona.emoji}
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
          {persona.shortTitle}
        </div>
        <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-white/5 bg-floor-900 px-3 py-2 text-[13px] leading-relaxed text-zinc-300 shadow-md">
          <span className="italic text-zinc-400">{label}</span>
          <TypingDots />
        </div>
      </div>
    </motion.li>
  );
}

function TypingDots({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      aria-label="thinking"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
          style={{
            animation: "ceo-chat-dot-pulse 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.18}s`,
            opacity: 0.6,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes ceo-chat-dot-pulse {
          0%,
          80%,
          100% {
            transform: scale(0.6);
            opacity: 0.3;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </span>
  );
}

function ChatBubble({
  turn,
  onOpenAttachment,
}: {
  turn: ChatTurn;
  onOpenAttachment: () => void;
}) {
  if (turn.role === "system") {
    return (
      <motion.li
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="self-center rounded-md border border-white/10 bg-floor-900/60 px-3 py-1.5 text-center text-[11px] text-zinc-400"
      >
        {turn.text}
      </motion.li>
    );
  }
  if (turn.role === "user") {
    return (
      <motion.li
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="ml-8 self-end rounded-2xl rounded-tr-sm bg-cyan-500 px-3 py-2 text-[13px] text-floor-950 shadow-md"
      >
        {turn.text}
      </motion.li>
    );
  }
  const persona = turn.speaker ? PERSONAS[turn.speaker] : null;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mr-8 flex items-start gap-2 self-start"
    >
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base shadow-md"
        style={{
          background: "linear-gradient(140deg,#1f2a44,#10182a)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
        title={persona?.title ?? "Team"}
      >
        {persona?.emoji ?? "🤖"}
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
          {persona?.shortTitle ?? "Team"}
        </div>
        <div className="rounded-2xl rounded-tl-sm border border-white/5 bg-floor-900 px-3 py-2 text-[13px] leading-relaxed text-zinc-200 shadow-md">
          <MarkdownLite text={turn.text} />
        </div>
        {turn.attachment && (
          <button
            type="button"
            onClick={onOpenAttachment}
            className="mt-1 self-start rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/20"
          >
            {attachmentLabel(turn.attachment.kind)}
          </button>
        )}
      </div>
    </motion.li>
  );
}

function attachmentLabel(kind: string): string {
  switch (kind) {
    case "features":
      return "Open feature catalogue ↗";
    case "plan":
      return "Open architecture plan ↗";
    case "designs":
      return "Open design concepts ↗";
    case "handoff":
      return "Open handoff package ↗";
    case "stories":
      return "Open user stories ↗";
    case "code-review":
      return "Open code review ↗";
    case "defects":
      return "Open defect log ↗";
    case "security":
      return "Open security audit ↗";
  }
  return "Open ↗";
}

function MarkdownLite({ text }: { text: string }) {
  // Minimal markdown: **bold**, line breaks, and `code`. Good enough for
  // persona chat without pulling in a full md renderer.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return (
            <strong key={i} className="text-zinc-50">
              {p.slice(2, -2)}
            </strong>
          );
        }
        if (p.startsWith("`") && p.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-floor-950 px-1 py-0.5 text-[12px] text-cyan-300"
            >
              {p.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-2 py-8 text-center">
      <div className="text-4xl">👋</div>
      <div>
        <div className="text-sm font-semibold text-zinc-100">
          Welcome to your AI company.
        </div>
        <div className="mt-1 text-[12px] text-zinc-400">
          Share your idea with the CEO. She'll bring in the rest of the team —
          CTO, architects, designer, PM, devs, QA, security — and they'll build it
          while you watch on the office floor.
        </div>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="mt-2 rounded-lg bg-cyan-500 px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-floor-950 hover:bg-cyan-400"
      >
        Start a new project
      </button>
    </div>
  );
}
