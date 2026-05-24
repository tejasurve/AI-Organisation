"use client";

// components/useSimStream.ts
//
// Opens an EventSource against /api/events and pipes each SimEvent into the
// Zustand store. Also runs a soft ticker (10Hz) that GCs expired bubbles and
// room states. One hook, mounted once at the top of the tree.

import { useEffect } from "react";

import { useSimStore } from "@/stores/sim-store.ts";
import type { SimEvent } from "@/lib/simulation/types.ts";

export function useSimStream(): void {
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("sim", (msg) => {
      try {
        const event = JSON.parse((msg as MessageEvent).data) as SimEvent;
        useSimStore.getState().apply(event);
      } catch {
        // ignore malformed
      }
    });

    const tick = setInterval(() => {
      useSimStore.getState().tick();
    }, 100);

    return () => {
      es.close();
      clearInterval(tick);
    };
  }, []);
}
