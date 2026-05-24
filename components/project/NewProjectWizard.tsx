"use client";

// components/project/NewProjectWizard.tsx
//
// Lightweight 1-screen wizard. Heavier multi-step team-builder lives behind
// the same trigger but ships in a follow-up — here we collect the brief and
// optionally a GitHub repo binding, then fire off project creation.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useProjectStore } from "@/stores/project-store.ts";

const TEMPLATES: { id: string; label: string; pitch: string }[] = [
  {
    id: "blank",
    label: "Blank",
    pitch: "",
  },
  {
    id: "saas-mvp",
    label: "SaaS MVP",
    pitch:
      "A subscription web app with auth, a primary workflow, dashboard, and billing.",
  },
  {
    id: "landing",
    label: "Landing Page",
    pitch:
      "A high-converting marketing site for a new product, with waitlist signup and analytics.",
  },
  {
    id: "ai-feature",
    label: "AI Feature",
    pitch:
      "An AI-powered feature embedded into an existing product: chat, summarisation, or smart automation.",
  },
];

export function NewProjectWizard() {
  const open = useProjectStore((s) => s.wizardOpen);
  const setOpen = useProjectStore((s) => s.setWizardOpen);
  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const [audience, setAudience] = useState("");
  const [successMetric, setSuccessMetric] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!name.trim() || !pitch.trim() || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          pitch: pitch.trim(),
          audience: audience.trim() || undefined,
          successMetric: successMetric.trim() || undefined,
          githubRepo: githubRepo.trim() || undefined,
        }),
      });
      if (r.ok) {
        setOpen(false);
        setName("");
        setPitch("");
        setAudience("");
        setSuccessMetric("");
        setGithubRepo("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 12, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[640px] max-w-[92vw] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-floor-900 to-floor-950 shadow-2xl"
          >
            <header className="border-b border-white/10 px-5 py-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                New project
              </div>
              <h2 className="mt-1 text-lg font-semibold text-zinc-100">
                Brief the team
              </h2>
              <p className="mt-1 text-[12px] text-zinc-400">
                The CEO will read this, ask the disambiguating questions, then
                delegate to the architects, designer, PM, devs, and QA.
              </p>
            </header>

            <div className="grid gap-4 px-5 py-5">
              <Field label="Product name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Atlas Workouts"
                  className="w-full rounded-lg border border-white/10 bg-floor-950 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
                />
              </Field>

              <Field label="One-paragraph pitch">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => t.pitch && setPitch(t.pitch)}
                      className="rounded-md border border-white/10 bg-floor-900 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-400 hover:bg-floor-800"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  rows={4}
                  placeholder="What is it, who is it for, and what does success look like?"
                  className="w-full resize-none rounded-lg border border-white/10 bg-floor-950 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Target audience (optional)">
                  <input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g. desk-bound knowledge workers, 25–45"
                    className="w-full rounded-lg border border-white/10 bg-floor-950 px-3 py-2 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
                  />
                </Field>
                <Field label="Success in one metric (optional)">
                  <input
                    value={successMetric}
                    onChange={(e) => setSuccessMetric(e.target.value)}
                    placeholder="e.g. 1,000 weekly active users"
                    className="w-full rounded-lg border border-white/10 bg-floor-950 px-3 py-2 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
                  />
                </Field>
              </div>

              <Field label="GitHub repo (optional · owner/repo)">
                <input
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="acme/my-product (leave blank to skip)"
                  className="w-full rounded-lg border border-white/10 bg-floor-950 px-3 py-2 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
                />
              </Field>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-white/10 bg-floor-900/50 px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] font-medium uppercase tracking-wider text-zinc-300 hover:bg-floor-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!name.trim() || !pitch.trim() || submitting}
                className="rounded-md bg-cyan-500 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-floor-950 hover:bg-cyan-400 disabled:opacity-40"
              >
                {submitting ? "Starting…" : "Bring in the CEO"}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
