"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

const PIPELINE_STEPS: { label: string; copy: string }[] = [
  { label: "01 → CEO", copy: "Mission, OKRs, priorities, delegation." },
  { label: "02 → CTO", copy: "Architecture, API contracts, DB schema, risks." },
  { label: "03 → Engineering Manager", copy: "Features and atomic 1–4h tasks." },
  { label: "04 → Validation", copy: "Schema and cross-array integrity rules." },
  { label: "05 → Task selection", copy: "Pick the next developer task." },
  { label: "06 → Developer", copy: "Files, tests, implementation plan." },
  { label: "07 → QA", copy: "Test plan, results, decision: PASS / FAIL / CONDITIONAL." },
  { label: "08 → Cybersecurity", copy: "Vulns, prompt-injection risk, GO / NO_GO." },
  { label: "09 → File writer", copy: "Writes generated/{taskId}/ on PASS + GO." },
];

const FEATURES = [
  {
    badge: "bg-indigo-100 text-indigo-600",
    glyph: "●",
    title: "Strategic thinking, baked in",
    body: "CEO and CTO agents define mission, OKRs, architecture, API contracts, and database schema before a single line of code is written.",
  },
  {
    badge: "bg-violet-100 text-violet-600",
    glyph: "◆",
    title: "Atomic, auditable execution",
    body: "The Engineering Manager breaks work into 1–4 hour tasks. Each is validated, executed by a developer agent, gated by QA + Security, then written to disk only on a clean PASS + GO.",
  },
  {
    badge: "bg-pink-100 text-pink-600",
    glyph: "✓",
    title: "Self-contained run reports",
    body: "Every run leaves a Markdown REPORT.md next to the generated code: full agent JSON, decisions, file list, and an end-to-end verification result.",
  },
];

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const submitting = state.kind === "submitting";
  const locked = state.kind === "success";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setState({
        kind: "error",
        message: "That doesn't look like a valid email — try again.",
      });
      return;
    }
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "landing-v1" }),
      });
      const data: { id?: string; status?: string; error?: string } = await res
        .json()
        .catch(() => ({}));

      if (res.ok && data.status === "queued") {
        setState({
          kind: "success",
          message:
            "Thanks — you're on the list. We'll be in touch from hello@Dranzer.dev.",
        });
      } else if (res.ok && data.status === "duplicate") {
        setState({
          kind: "success",
          message:
            "Looks like you're already on the list — we'll be in touch soon.",
        });
      } else {
        setState({
          kind: "error",
          message: data.error || "Something went wrong. Please try again.",
        });
      }
    } catch {
      setState({
        kind: "error",
        message:
          "We couldn't reach the server. Check your connection and try again.",
      });
    }
  }

  return (
    <main>
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white text-sm">
              D
            </span>
            <span>Dranzer</span>
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <a href="#how" className="hover:text-slate-900">
              How it works
            </a>
            <a href="#features" className="hover:text-slate-900">
              Features
            </a>
            <a href="#signup" className="hover:text-slate-900">
              Get access
            </a>
          </nav>
          <a
            href="#signup"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Join waitlist
          </a>
        </div>
      </header>

      <section>
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
            Now in private alpha
          </span>
          <h1 className="mt-6 text-5xl md:text-6xl font-extrabold tracking-tight">
            An entire engineering team.
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">
              Powered by AI.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Submit an idea. An AI organisation — CEO, CTO, Engineering Manager, Developers, QA, and Cybersecurity — turns it into shipped, audited, runnable code. End to end. No prompts to babysit.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#signup"
              className="rounded-md bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Get early access
            </a>
            <a
              href="#how"
              className="rounded-md px-6 py-3 text-base font-semibold text-slate-700 hover:text-slate-900"
            >
              See how it works →
            </a>
          </div>
          <p className="mt-6 text-xs text-slate-500">
            Used by indie founders to go from idea to deployed prototype in under a week.
          </p>
        </div>
      </section>

      <section id="features" className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              A real org, not a single chat window.
            </h2>
            <p className="mt-4 text-slate-600">
              Each agent has a defined role, model, and structured handoff schema. Outputs are gated by automated QA and security audits before any code is written to disk.
            </p>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <div
                  className={
                    "mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg " +
                    f.badge
                  }
                >
                  {f.glyph}
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="bg-slate-50 border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              From idea to running code in 9 steps.
            </h2>
            <p className="mt-4 text-slate-600">
              One pipeline. Real models. Strict JSON handoffs at every boundary.
            </p>
          </div>
          <ol className="mt-12 grid gap-3 md:grid-cols-3 text-sm">
            {PIPELINE_STEPS.map((s) => (
              <li
                key={s.label}
                className="rounded-lg bg-white p-4 border border-slate-200"
              >
                <span className="font-mono text-xs text-indigo-600">
                  {s.label}
                </span>
                <p className="mt-1 text-slate-700">{s.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="signup" className="border-t border-slate-100">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Join the early access list.
          </h2>
          <p className="mt-4 text-slate-600">
            We&apos;re onboarding indie founders one at a time. Drop your email and we&apos;ll be in touch the moment a slot opens up.
          </p>

          <form
            onSubmit={onSubmit}
            noValidate
            className="mt-10 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@startup.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting || locked}
              className="flex-1 rounded-md border border-slate-300 px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={submitting || locked}
              className="rounded-md bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {locked ? "You're in" : submitting ? "Sending…" : "Get access"}
            </button>
          </form>

          <div className="mt-6 min-h-[2rem] text-sm">
            {state.kind === "error" && (
              <p className="text-red-600">{state.message}</p>
            )}
            {state.kind === "success" && (
              <p className="text-emerald-600">{state.message}</p>
            )}
          </div>

          <p className="mt-8 text-xs text-slate-500">
            We&apos;ll only use your email to send a single onboarding message. No marketing, no sharing.
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-indigo-600 text-white text-[10px] font-bold">
              P
            </span>
            <span>© 2026 Dranzer. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#" className="hover:text-slate-700">
              Privacy
            </a>
            <a href="#" className="hover:text-slate-700">
              Terms
            </a>
            <a href="#" className="hover:text-slate-700">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
