// app/api/events/route.ts
//
// Server-Sent Events stream of SimEvents. The browser opens a long-lived
// EventSource; we (a) replay the recent buffer on connect, then (b) stream
// each new event as it arrives.
//
// Runs on the Node runtime because the event bus uses node:fs for persistence.

import { recent, subscribe, hydrateFromDisk } from "@/lib/simulation/event-bus.ts";
import type { SimEvent } from "@/lib/simulation/types.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEEPALIVE_MS = 15_000;

export async function GET(): Promise<Response> {
  await hydrateFromDisk();

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: SimEvent) => {
        try {
          controller.enqueue(encoder.encode(formatSse(event)));
        } catch {
          // controller closed — drop
        }
      };

      // Replay recent history so a new browser session lands with full context.
      for (const event of recent()) send(event);
      // Subscribe to live events.
      unsubscribe = subscribe(send);
      // Keep-alive comment so intermediaries don't time out the stream.
      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // ignore
        }
      }, KEEPALIVE_MS);
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (keepalive) clearInterval(keepalive);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function formatSse(event: SimEvent): string {
  return `event: sim\nid: ${event.ts}\ndata: ${JSON.stringify(event)}\n\n`;
}
