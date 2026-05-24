// scripts/smoke-e2e-backhalf.ts — continue the existing project past
// plan-approval through design-approval, stories, sprint-dev, QA, code
// review, defect-fix, security, deploy, done. Approves automatically and
// reports each stage transition + cost.

const HOST = "http://localhost:3000";

async function fetchJson(path: string, opts?: RequestInit) {
  const r = await fetch(`${HOST}${path}`, opts);
  return { status: r.status, json: (await r.json()) as Record<string, unknown> };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  // Find the active project.
  const list = await fetchJson("/api/project");
  const projects = ((list.json as { projects: Array<{ id: string; stage: string }> }).projects ?? []);
  if (projects.length === 0) {
    console.error("No project. Run smoke-e2e-weather.ts first.");
    process.exitCode = 1;
    return;
  }
  const projectId = projects[0]!.id;
  console.log(`Continuing project: ${projectId}, current stage: ${projects[0]!.stage}`);

  const startedAt = Date.now();
  let lastStage = "";
  let lastChatLen = 0;
  let approvalsSent = 0;

  while (Date.now() - startedAt < 10 * 60 * 1000) {
    const current = (await fetchJson(`/api/project`).then(
      (r) =>
        ((r.json as { projects: Array<Record<string, unknown>> }).projects ?? []).find(
          (p) => p.id === projectId,
        ) as
          | undefined
          | {
              stage: string;
              waitingForUser: boolean;
              chat: Array<{ role: string; speaker?: string; text: string; stage: string }>;
              llmCalls: Array<{ costUsd: number }>;
              totalCostUsd: number;
            },
    ));
    if (!current) {
      await sleep(2000);
      continue;
    }

    if (current.stage !== lastStage) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`[${elapsed}s] stage → ${current.stage} (waiting=${current.waitingForUser})`);
      lastStage = current.stage;
    }

    const newChat = current.chat.slice(lastChatLen);
    for (const turn of newChat) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      const speaker = turn.role === "user" ? "USER" : turn.role === "system" ? "SYSTEM" : (turn.speaker ?? "?").toUpperCase();
      const oneLine = turn.text.split("\n")[0]!.slice(0, 130);
      console.log(`  [${elapsed}s] ${speaker} (${turn.stage}): ${oneLine}`);
    }
    lastChatLen = current.chat.length;

    // Auto-approve at every gate.
    if (current.waitingForUser && approvalsSent < 5) {
      if (current.stage === "plan-approval") {
        console.log("  ↳ Approving plan…");
        await fetchJson(`/api/project/${projectId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved: true }),
        });
        approvalsSent++;
      } else if (current.stage === "design-approval") {
        // Pick the first generated screen and approve.
        console.log("  ↳ Picking the first design + approving…");
        // The /design endpoint accepts { selectedScreenId } per the route.
        const fullR = await fetchJson(`/api/project`);
        const full = ((fullR.json as { projects: Array<{ id: string; design?: { screens?: Array<{ id: string }> } }> }).projects ?? []).find(
          (p) => p.id === projectId,
        );
        const screenId = full?.design?.screens?.[0]?.id;
        if (screenId) {
          await fetchJson(`/api/project/${projectId}/design`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "select", screenId }),
          });
        }
        await fetchJson(`/api/project/${projectId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved: true }),
        });
        approvalsSent++;
      } else if (current.stage === "code-review") {
        console.log("  ↳ Approving code review…");
        await fetchJson(`/api/project/${projectId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved: true }),
        });
        approvalsSent++;
      } else if (current.stage === "done") {
        console.log(`\nReached "done" stage. Total cost: $${current.totalCostUsd.toFixed(4)}`);
        console.log(`LLM calls made: ${current.llmCalls.length}`);
        return;
      }
    }
    await sleep(4000);
  }

  console.error("Backhalf did not reach 'done' within timeout.");
  process.exitCode = 1;
}

main().catch((e) => {
  console.error("Smoke threw:", e);
  process.exitCode = 1;
});
