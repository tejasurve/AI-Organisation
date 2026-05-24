"use client";

// components/project/SettingsDrawer.tsx
//
// BYOK secrets manager + workspace settings. Keys never reach the client in
// plaintext after they're stored; the drawer only shows masked previews.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { SecretKey } from "@/lib/platform/vault/secrets.ts";
import { useProjectStore } from "@/stores/project-store.ts";

interface SecretStatus {
  key: SecretKey;
  configured: boolean;
  preview: string | null;
  updatedAt: number | null;
}

const META: Record<SecretKey, { label: string; help: string }> = {
  gemini:    { label: "Google Gemini",  help: "Used by the Designer and QA personas. Required for live design generation via Stitch." },
  anthropic: { label: "Anthropic Claude", help: "Default for CEO, CTO, Architects, PM, Developer." },
  openai:    { label: "OpenAI",         help: "Optional. Used when a member is assigned a GPT model." },
  cursor:    { label: "Cursor",         help: "Optional. Routes Developer tasks through Cursor's background agents." },
  github:    { label: "GitHub PAT",     help: "Repo scope. Required for repo creation, commits, PRs." },
  stitch:    { label: "Stitch (Figma)",   help: "Used by the Designer for 4-screen concept generation and redesigns." },
};

export function SettingsDrawer() {
  const open = useProjectStore((s) => s.settingsOpen);
  const setOpen = useProjectStore((s) => s.setSettingsOpen);
  const [list, setList] = useState<SecretStatus[]>([]);
  const [pending, setPending] = useState<Partial<Record<SecretKey, string>>>({});
  const [saving, setSaving] = useState<SecretKey | null>(null);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open]);

  async function refresh() {
    try {
      const r = await fetch("/api/secrets", { cache: "no-store" });
      const j = (await r.json()) as { secrets: SecretStatus[] };
      setList(j.secrets);
    } catch {
      // ignore
    }
  }

  async function save(k: SecretKey) {
    const value = pending[k];
    if (!value) return;
    setSaving(k);
    try {
      await fetch(`/api/secrets/${k}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      setPending((p) => ({ ...p, [k]: "" }));
      await refresh();
    } finally {
      setSaving(null);
    }
  }

  async function remove(k: SecretKey) {
    await fetch(`/api/secrets/${k}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.aside
            initial={{ x: 480 }}
            animate={{ x: 0 }}
            exit={{ x: 480 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 flex h-full w-[480px] max-w-[92vw] flex-col overflow-hidden border-l border-white/10 bg-gradient-to-b from-floor-900 to-floor-950 shadow-2xl"
          >
            <header className="border-b border-white/10 px-5 py-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                Workspace settings
              </div>
              <h2 className="mt-1 text-lg font-semibold text-zinc-100">
                API keys & integrations
              </h2>
              <p className="mt-1 text-[12px] text-zinc-400">
                Keys are encrypted on disk with a machine-bound install key.
                They never reach the browser after storing.
              </p>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="flex flex-col gap-3">
                {list.map((s) => (
                  <li
                    key={s.key}
                    className="rounded-xl border border-white/10 bg-floor-950 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-zinc-100">
                          {META[s.key].label}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                          {s.configured ? (
                            <span className="text-emerald-400">
                              Configured · {s.preview}
                            </span>
                          ) : (
                            <span className="text-zinc-500">Not configured</span>
                          )}
                        </div>
                      </div>
                      {s.configured && (
                        <button
                          type="button"
                          onClick={() => remove(s.key)}
                          className="rounded-md border border-rose-400/30 px-2 py-1 text-[10px] uppercase tracking-wider text-rose-300 hover:bg-rose-500/10"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                      {META[s.key].help}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="password"
                        value={pending[s.key] ?? ""}
                        onChange={(e) =>
                          setPending((p) => ({ ...p, [s.key]: e.target.value }))
                        }
                        placeholder={s.configured ? "Rotate key" : "Paste key"}
                        className="flex-1 rounded-md border border-white/10 bg-floor-900 px-2.5 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => save(s.key)}
                        disabled={!pending[s.key] || saving === s.key}
                        className="rounded-md bg-cyan-500 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-floor-950 hover:bg-cyan-400 disabled:opacity-40"
                      >
                        {saving === s.key ? "…" : "Save"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200">
                Stitch ships with a demo key seeded for the hackathon. Rotate it
                in production by saving a new value here. The vault overwrites
                the old encrypted blob in place.
              </div>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] font-medium uppercase tracking-wider text-zinc-300 hover:bg-floor-800"
              >
                Done
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
