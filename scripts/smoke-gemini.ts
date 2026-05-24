// scripts/smoke-gemini.ts — one-shot connectivity test for the configured
// Gemini key. Run with: npx tsx scripts/smoke-gemini.ts
//
// Sends a structured-output request (the same shape we'll use for HLD/LLD
// generation) and validates we get JSON back.

import { callLLM } from "../lib/platform/llm/proxy.ts";

async function main(): Promise<void> {
  console.log("→ Calling Gemini with a structured-output prompt…");
  const r = await callLLM({
    provider: "gemini",
    model: "gemini-2.5-flash-lite",
    system:
      "You are a Solution Architect. Reply with strict JSON matching the schema. No prose, no markdown fences.",
    messages: [
      {
        role: "user",
        content:
          "Brief: A local-first weather web app with animated visuals, 10-day forecast, and weather-aware activity suggestions (parks if sunny, museums if rainy). Avoid payments, social, global coverage. Identify the product type and list the three most important features.",
      },
    ],
    temperature: 0.2,
    json: {
      type: "object",
      properties: {
        product_type: { type: "string" },
        three_core_features: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 3,
        },
      },
      required: ["product_type", "three_core_features"],
    },
  });

  console.log(`source     : ${r.source}`);
  console.log(`provider   : ${r.provider}`);
  console.log(`model      : ${r.model}`);
  console.log(`in tokens  : ${r.inTokens}`);
  console.log(`out tokens : ${r.outTokens}`);
  console.log(`latency    : ${r.latencyMs}ms`);
  console.log(`cost       : $${r.costUsd.toFixed(6)}`);
  console.log("\n--- raw text ---\n" + r.text);
  console.log("\n--- parse attempt ---");
  try {
    const cleaned = r.text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    console.log("✓ parsed successfully:");
    console.log(JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log("✗ JSON.parse failed:", (e as Error).message);
    process.exitCode = 1;
  }

  if (r.source !== "live") {
    console.log(
      "\n✗ source was '" + r.source + "', not 'live' — Gemini call did not go out. Aborting smoke test.",
    );
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("Smoke test threw:", e);
  process.exitCode = 1;
});
