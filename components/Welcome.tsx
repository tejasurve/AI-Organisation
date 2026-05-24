"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const STORAGE_KEY = "ai-org:welcome-dismissed-v1";

/**
 * First-time user overlay. Tells the user what they're looking at and how
 * to interact. Dismissable; remembers via localStorage.
 */
export function Welcome() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // ignore
    }
    setShow(true);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="welcome-backdrop"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
        >
          <motion.div
            className="mx-4 w-full max-w-2xl rounded-2xl border border-white/10 bg-floor-900/95 p-7 shadow-2xl"
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 22, stiffness: 220 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
          >
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-300">
              AI Organisation
            </div>
            <h1
              id="welcome-title"
              className="mb-3 text-2xl font-semibold leading-tight text-zinc-100"
            >
              Watch your autonomous AI company at work.
            </h1>
            <p className="mb-6 text-[13px] leading-relaxed text-zinc-400">
              This is a live 3D simulation of an AI startup. A CEO, a CTO, an
              Engineering Manager, a Developer, a QA agent and a Security
              engineer collaborate in real time to build, validate, and ship
              software. Every motion you see traces back to a real backend
              event — no fake metrics.
            </p>

            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <Card
                title="The Office"
                icon="🏢"
                body="Seven rooms — Strategy, Engineering, Design, QA, Security, Growth, Deployment. Each lights up when active."
              />
              <Card
                title="The Agents"
                icon="🤖"
                body="Six distinct personalities. Click any character to inspect their stats, current task and bio."
              />
              <Card
                title="The Cycle"
                icon="⚙️"
                body="One full cycle: idea → strategy → architecture → build → QA → security → ship. Click Run Demo above."
              />
              <Card
                title="The Camera"
                icon="🎥"
                body="Drag to rotate. Scroll to zoom. Click an agent to follow them. Click empty space to deselect."
              />
            </div>

            <div className="mt-7 flex items-center justify-between gap-3">
              <div className="text-[11px] text-zinc-500">
                Try <span className="text-amber-300">QA Fail</span> or{" "}
                <span className="text-red-300">Sec Block</span> in the top bar
                to see the office go red.
              </div>
              <button
                onClick={dismiss}
                className="rounded-md bg-cyan-500/15 px-4 py-2 text-[12px] font-medium uppercase tracking-wider text-cyan-200 ring-1 ring-cyan-400/30 hover:bg-cyan-500/25"
              >
                Enter the office
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Card({ title, body, icon }: { title: string; body: string; icon: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-base leading-none">{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-200">
          {title}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}
