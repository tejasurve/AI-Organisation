# AI Organisation Platform — Hackathon Brief

A no-code, fully visual, autonomous AI company. The user chats with the CEO,
the CEO orchestrates a team of AI personas (CTO, architects, designer, PM,
devs, QA, security), the office floor visualises every move in real-time 3D,
and approval gates ensure the human stays in the loop.

## How to run

```bash
npm install
npm run dev          # http://localhost:3000
```

The Stitch MCP key is pre-seeded into the encrypted vault on first run so the
Designer flow works out-of-the-box. Open **Settings** in the top right to add
your own Gemini / Claude / OpenAI / GitHub keys at any time.

> **Security note:** the bundled Stitch key is for demo only. Rotate it post-event.

## The 90-second demo script

1. **Open `http://localhost:3000`.** You see the 3D office. The CEO chat panel
   is on the right. Click **Start a new project** (or **New project** in the
   header) and paste a brief, e.g. "AI-coached strength training app".

2. **CEO greets and asks two disambiguating questions.** Reply with audience +
   success metric (any text ≥ 20 chars auto-advances).

3. **CTO speaks**, then the **Solution Architect** generates the HLD and the
   **Software Architect** generates the LLD. A **Plan Approval modal** pops
   up automatically — HLD bullets, bounded contexts, stack, risks, Mermaid
   system diagram, LLD modules, data model, APIs.

4. **Approve** the plan. The **Designer** generates **4 Figma concept screens
   via Stitch (Gemini 3 Pro)** — minimal, playful, dense, premium variants.
   Placeholders appear instantly; live Stitch screens swap in as they render
   (Stitch officially takes 2–5 minutes per screen, so the placeholder system
   keeps the demo crisp).

5. **Pick a screen** or click **Redesign** on any card, enter a change
   request, send. The Designer reworks it (uses Stitch `edit_screens` if a
   real Stitch screen is available, demo redesign otherwise).

6. **Approve designs.** The PM generates 5 user stories (Gherkin) → Kanban
   modal accessible from chat attachment. The devs start, the office shows
   movement and "building" status. QA runs tests and files one P2 defect.

7. **Code Review modal** opens with 3 review comments (1 major, 1 minor, 1
   nit) from the CTO/Software Architect. **Approve** to accept the sprint.

8. The dev fixes the defect, security audits with GO verdict, the deploy
   stage fires, the 3D office celebrates, and the sprint completes.

The whole loop runs end-to-end in ~30 seconds in demo mode. With live keys,
the same loop produces real LLM-generated artefacts.

## Where every requirement lives

| User requirement | Implementation |
|---|---|
| "Initially user can create own team, select members" | `components/project/NewProjectWizard.tsx` — brief + audience + success metric + GitHub binding. Persona library at `lib/platform/personas/catalog.ts` defines the 6+ roles (CEO, CTO/Architects, EM/PM, Dev, QA, Security) with distinct system prompts, voices, models, and bios. |
| "Each member can be assigned a particular AI model" | `Persona.recommendedModel` and the `LlmCall` records carry the provider+model. The LLM proxy at `lib/platform/llm/proxy.ts` routes per call. Adding a per-member model picker UI is a 1-day follow-up. |
| "Map them like a tree and change view to office" | The workflow Stage Stepper at the top of the dashboard, plus the existing 3D office view, are linked: stage transitions emit AgentEvents that move the visual agents. Full React-Flow team editor is roadmapped (Phase B follow-up). |
| "Token used by each member must be tracked and time worked" | Every `callLLM` records a `LlmCallRecord` on the project (`persona`, `provider`, `model`, `inTokens`, `outTokens`, `costUsd`, `latencyMs`). The header shows live totals + spend. Per-agent work time = aggregate of "working/thinking/building" status durations from the existing sim store. |
| "Add live API key like Gemini, Claude, OpenAI etc as secret" | `Settings` drawer (top-right). Backed by `lib/platform/vault/` — AES-256-GCM, machine-bound scrypt key, file at `.simulation/secrets.json` with 0o600 perms. Keys never reach the browser after storing. |
| "GitHub repo creation and code maintainance by developer" | GitHub PAT slot in Settings. The Dev persona's capability list includes `github.repo / github.commit / github.open-pr`. Real Octokit wiring is the next slice — slot is already there. |
| "Documentation and report creation by QA" | QA persona produces `Defect` records with severity + repro. Documentation generation is on the persona's capability list. |
| "User story creation by Manager" | The Engineering Manager / PM persona runs the `stories` stage. `parseStoriesOrFallback` ensures Gherkin shape even if the LLM returns malformed JSON. Stories show in the Kanban modal with status columns. |
| "HLD & LLD and system design by Solution + Software Architects" | The `plan-draft` stage runs two separate LLM passes — one with the Solution Architect prompt (produces HLD + Mermaid system context), one with the Software Architect prompt (produces LLD + modules + data model + APIs). |
| "Designer connected with Stitch, 4 Figma screens, Gemini 3 Pro" | `lib/platform/mcp/stitch.ts` speaks the real Stitch MCP HTTP transport. Tools used: `create_project`, `generate_screen_from_text` with `modelId: GEMINI_3_PRO`, `edit_screens` for redesign. Generation is fire-and-forget so the modal is instant; results swap in over minutes. |
| "If redesign needed, redesign selected screen" | Each design card has a **Redesign** button → comment → `Stitch.edit_screens` (live) or demo redesign (fallback). |
| "Top level: user discusses idea with CEO" | The right-hand `CEOChat` panel. CEO is always the first speaker, asks two clarifying questions, then routes to architects. |
| "CEO passes to CTO/Architects for review, plan shown to user for approval" | Stages: `cto-review → plan-draft → plan-approval`. The PlanReviewModal pops automatically when stage = `plan-approval`. |
| "User approves → HLD, LLD, designs prepared and shown" | `plan-approval (gate) → design-draft → design-approval (gate)`. Designs modal carousel. |
| "User can comment on designs or ask to make changes" | `Redesign` button on each screen card → comment textarea → Stitch edit. The general approval footer also accepts free-text change requests that bounce the workflow back to the draft stage. |
| "User story creation, development, testing" | `stories → sprint-dev → qa-review`. Office floor shows devs moving to monitors, building, then QA at consoles reviewing. |
| "Code review per sprint by architects, devs fix comments" | `code-review (gate) → defect-fix`. Comments severity-coded (major/minor/nit). Approving auto-resolves; rejecting bounces back to dev. |
| "QA defects fixed" | Defects modal with severity, status, repro. Defect-fix stage flips status to "fixed". |

## Architecture at a glance

```
Browser
 ├─ ProjectHeader  (stage stepper · token+cost meter · live/demo badge)
 ├─ Office3D       (react-three-fiber · driven by SimEvents)
 ├─ ActivityFeed   (rotating last-12 with full-history modal)
 ├─ CEOChat        (slide-out · personas with emojis · attachment buttons)
 └─ Modals         (Plan · Designs · Stories · CodeReview · Defects · Security)

Server (Next.js Route Handlers, Node runtime)
 ├─ /api/secrets/*           Encrypted vault — AES-256-GCM with machine-bound key
 ├─ /api/project             Project CRUD + chat + approvals
 ├─ /api/project/:id/*       message · approve · design (select/redesign)
 ├─ /api/events              SSE stream of SimEvents → 3D office
 └─ /api/demo                Pre-existing scripted scenarios
       │
       └─ lib/platform/
            ├─ vault/        crypto.ts · secrets.ts (file-backed, encrypted)
            ├─ llm/          proxy.ts (Gemini/Anthropic/OpenAI/Cursor) · pricing.ts · demo.ts (scripted fallback)
            ├─ mcp/          stitch.ts (HTTP MCP client · GEMINI_3_PRO · async live generation)
            ├─ personas/     catalog.ts (6 personas with system prompts + voices + models)
            └─ workflow/     types.ts · store.ts · engine.ts (14 stages, 3 approval gates)
                                  │
                                  └─ emits AgentEvents → lib/simulation/event-bus
                                                              │
                                                              └─ SimEvents → 3D office
```

### Two event surfaces, one truth

- `AgentEvent` — raw, neutral, server-side. Anything from real LLM calls to
  workflow transitions. The workflow engine emits these; the existing
  pipeline can also emit them in parallel.
- `SimEvent` — visual, client-side. Derived from `AgentEvent` by
  `lib/simulation/mapper.ts`. The 3D office only consumes `SimEvent`.

This separation means the office is automatically in sync with whatever the
workflow does, without the workflow knowing 3D geometry.

### Why the demo always works

- **No-key demo mode** in `lib/platform/llm/demo.ts` produces persona-aware,
  stage-aware scripted lines. The CEO sounds like a CEO, the architects
  sound like architects, the QA writes proper bug reports. Same workflow,
  same artefacts, no credit-card warm-ups before the pitch.
- **Stitch placeholders ship instantly** while real generation runs in
  background. Judges never wait 5 minutes for the design modal to open.
- **Vault auto-seeds the Stitch key** on first run so the integration is
  visibly wired without anyone typing on stage.

## Counter-questions you might be asked

**"How is this different from just calling ChatGPT 7 times?"**
Each persona has a distinct system prompt + voice + assigned model.
The workflow enforces handoffs (architect can't skip plan-draft → design),
approval gates keep the human in the loop, and the 3D office makes the
hierarchy and the work visible in a way no chat thread can. Tokens, cost,
and active-work-time are tracked per persona for governance.

**"What happens if the LLM goes down mid-workflow?"**
The proxy at `lib/platform/llm/proxy.ts` catches every provider error and
falls through to demo-mode for that single call. The workflow continues.
Each `LlmCall` record carries `source: live | demo` so the dashboard always
shows the truth.

**"How do you keep keys safe?"**
AES-256-GCM, key derived via `scrypt(installPassphrase, salt, 32)` where
`installPassphrase = hostname::uid::username`. File mode `0o600`. The
plaintext key only exists in memory inside the Node process, never crosses
the network to the browser. For multi-tenant cloud we'd swap the install
passphrase for an AWS/GCP KMS envelope.

**"Why polling and not SSE for project state?"**
SimEvents (high-frequency, theatre) use SSE. Project state (low-frequency,
≤1 mutation per ~2 seconds) uses a 1.2-second poll on `/api/project`. Less
plumbing, no zombie connections in dev mode, totally adequate at human
scale. We can swap to SSE in 30 minutes when we need it.

**"Where's the React-Flow team editor you talked about?"**
Phase B follow-up. The Persona library + per-stage role mapping is in
place so adding the editor is just a UI shell on top of the existing data
model. We focused on a vertical demo: idea → plan → design → stories →
dev → QA → review → ship, end-to-end, with real Stitch wired in.

**"Does it actually call Stitch?"**
Yes — `lib/platform/mcp/stitch.ts` speaks the real JSON-RPC HTTP transport
against `https://stitch.googleapis.com/mcp`. The probe in the repo
showed the live `tools/list` round-trip; the four generation calls use
`generate_screen_from_text` with `modelId: GEMINI_3_PRO`. Generation
genuinely takes 2–5 minutes per Google's own docs, so we render
placeholders immediately and swap in real screens via the project store as
they complete.

**"What if a judge wants to run with their own Gemini key?"**
They paste it in Settings, hit Save. Within 1.2 seconds the next stage's
LLM call goes through Gemini, the dashboard's live-vs-demo badge flips to
green, and the cost meter starts ticking real dollars.

## Future enhancements (well-defined slices)

1. **React-Flow team editor** — node-based team builder, per-member model
   picker, save as template, "Launch from this team".
2. **Cursor SDK integration** — Developer persona's "implement story" maps
   to `Agent.create` in a worktree; stream output as `AgentEvent`s.
3. **Real GitHub** — Octokit-backed `repo.create / commit / pr.open` on
   sprint events.
4. **Replay scrubber** — every project's `chat` + `llmCalls` is already
   persisted; scrub back through time to debug or showcase a finished run.
5. **PR-style approval modals** — code-review modal already has the bones;
   add inline diff rendering and per-comment approve.
6. **Budget guardrails** — `Project.budgetUsd` field exists; just need a
   UI gauge and an auto-throttle in the proxy.
7. **Persona marketplace** — Personas are plain JSON; an Import/Export +
   per-user storage is one afternoon's work.
8. **Voice synthesis** — opt-in TTS so each persona has a voice when their
   bubble appears in the 3D office.
9. **Multi-project switching** — projects are already stored per-id; the
   header just needs a dropdown.

## Files of interest

```
lib/platform/                 # All new platform code lives here
├── vault/crypto.ts           # AES-256-GCM helpers
├── vault/secrets.ts          # File-backed encrypted store
├── llm/proxy.ts              # callLLM() — single entry point
├── llm/pricing.ts            # Per-model USD/1M-token tables
├── llm/demo.ts               # Persona-aware scripted fallback
├── mcp/stitch.ts             # Real Stitch MCP HTTP client
├── personas/catalog.ts       # 6 personas with prompts + models
├── workflow/types.ts         # Project, Stage, Artefact, ChatTurn, LlmCallRecord
├── workflow/store.ts         # In-memory + JSON-persisted store
└── workflow/engine.ts        # The choreographer — runStage per stage

app/api/
├── secrets/                  # GET list + PUT/DELETE per key
└── project/                  # CRUD + message + approve + design

components/project/
├── CEOChat.tsx               # Right-hand chat panel
├── NewProjectWizard.tsx      # Brief intake modal
├── SettingsDrawer.tsx        # BYOK manager
├── ProjectHeader.tsx         # Top bar w/ stage stepper + cost meter
├── StageStepper.tsx          # Horizontal phase progress
├── useProjectSync.ts         # 1.2s polling + auto-open modal hook
└── modals/                   # Plan / Designs / Stories / CodeReview / Defects / Security
```
