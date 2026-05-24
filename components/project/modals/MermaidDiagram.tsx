"use client";

// components/project/modals/MermaidDiagram.tsx
//
// Lazy-loaded Mermaid renderer. We import the library only when a Plan modal
// opens, to keep the initial bundle small.

import { useEffect, useRef, useState } from "react";

interface MermaidDiagramProps {
  code: string;
}

let mermaidInitPromise: Promise<typeof import("mermaid").default> | null = null;

async function loadMermaid() {
  if (!mermaidInitPromise) {
    mermaidInitPromise = (async () => {
      const m = (await import("mermaid")).default;
      m.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          background: "#0f1828",
          primaryColor: "#1a2742",
          primaryTextColor: "#e4ebf7",
          primaryBorderColor: "#3b4a72",
          lineColor: "#6b7aa0",
          tertiaryColor: "#10b981",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: "13px",
        },
        securityLevel: "loose",
      });
      return m;
    })();
  }
  return mermaidInitPromise;
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const m = await loadMermaid();
        const id = `mmd-${Math.random().toString(36).slice(2, 8)}`;
        const { svg } = await m.render(id, code);
        if (cancelled) return;
        if (ref.current) ref.current.innerHTML = svg;
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-floor-950/60 p-3">
      {error ? (
        <pre className="overflow-x-auto whitespace-pre-wrap text-[11px] text-rose-300">
          {error}
          {"\n\n"}
          {code}
        </pre>
      ) : (
        <div ref={ref} />
      )}
    </div>
  );
}
