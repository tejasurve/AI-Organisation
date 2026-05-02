# AI Organisation Platform — Master Project Brief v2
> Master context for Cursor. Paste this before every session.
> This is the complete system definition — architecture, agents, workflows, security, and delivery plan.

---

## 0. North Star

> **An entrepreneur submits an idea. A fully managed AI organisation builds it, grows it, and makes it generate revenue — 24/7, without them needing a team.**

Every technical decision traces back to this. If a feature doesn't serve the entrepreneur's path to revenue, it doesn't get built.

---

## 1. What We're Building

A **managed AI organisation as a service** — built on top of Paperclip (MIT licensed), extended with:

1. A non-technical entrepreneur onboarding experience
2. A startup-tuned AI agent organisation (CEO → executors)
3. A revenue tracking and billing engine
4. A branded entrepreneur dashboard

The system operates across **two modes**:

### Mode 1 — Build From Scratch
| Input | Output |
|-------|--------|
| Validated business idea | Deployed MVP + feature delivery report |

### Mode 2 — Improve Existing Product
| Input | Output |
|-------|--------|
| Existing codebase or product | Analysis + refactored features + updated deployment |

---

## 2. Core Objective

> **Deliver a working, secure, trackable product — and then keep growing it until it makes money.**

Every cycle must produce:
- A usable product increment
- Tracked feature delivery
- Validated quality (QA)
- Security-approved deployment
- A measurable business metric improvement

---

## 3. Foundation — Paperclip (MIT Licensed)

We build **on top of** Paperclip, not from scratch.
**Local:** /Users/tejas/Desktop/Tejas/MVP/paperclip
**Repo:** `github.com/paperclipai/paperclip`
**Licence:** MIT — full commercial use, no royalties, no restrictions

### What Paperclip gives us (do not rebuild):
- Multi-tenant company isolation (one deployment, many client orgs)
- Org chart engine with roles, hierarchy, and reporting lines
- Heartbeat scheduler (agents run autonomously 24/7)
- Task routing, ticketing, and delegation
- Per-agent budget caps with hard stops
- Approval gates and governance layer
- Immutable audit log (every tool call, every decision)
- Goal ancestry (every task knows why it exists)
- Plugin system (extend without forking)
- PostgreSQL schema via Drizzle ORM
- TypeScript + Node.js 20+ backend
- Base React dashboard

### What we build on top:
- Entrepreneur onboarding wizard
- Branded entrepreneur-facing dashboard
- All agent SKILLS.md files (startup-tuned prompts)
- Every agent definition (CEO through executor layer)
- Stripe billing and revenue share engine
- Revenue attribution model
- Client-facing revenue dashboard

---

## 4. Full System Workflow

```
CLIENT INPUT
     ↓
[Onboarding Wizard] — idea, goals, timeline, budget
     ↓
[CEO Agent] — strategy, prioritisation, delegation
     ↓
[C-Suite Layer] — CTO / CMO / CFO / CPO / COO
     ↓
[Management Layer] — Engineering Manager / Design Manager / Product Owner / Growth Manager
     ↓
[Execution Layer]
  → Solution Architect   (system design + domain knowledge)
  → Developer Agent      (build / refactor)
  → Designer Agent       (UI/UX)
  → QA Agent             (test + validate)
  → Copywriter Agent     (content + copy)
  → SEO Agent            (search strategy)
  → Sales / Outreach     (lead generation)
  → Analyst Agent        (metrics + reporting)
     ↓
[Security Gate] — Senior Cybersecurity Engineer (MANDATORY — blocks deployment)
     ↓
[Tracking & Reporting Layer] — feature reports, daily reports, delivery summaries
     ↓
[Deployment]
     ↓
[Continuous Loop] — agents keep running, growing the business, optimising revenue
```

---

## 5. Agent Roles & Responsibilities

---

### 5.1 CEO Agent (Orchestrator)

**Goal:** Translate the client's business goal into an executable strategy and delegate to the right C-suite agents.

**Responsibilities:**
- Interpret the entrepreneur's idea and goals
- Define the company mission and quarterly OKRs
- Set priorities across departments
- Delegate to C-suite with clear briefs
- Review weekly progress and adjust strategy
- Escalate blockers to the human (entrepreneur)
- Decide when to move between phases (Validate → Build → Grow → Monetise)

**Prompt:**
```md
You are the CEO of an AI-run startup organisation.

Your client is an entrepreneur who has submitted a business idea. Your job is to run their company on their behalf using a team of AI agents.

You must:
- Understand the entrepreneur's goal deeply
- Define a clear company mission (one sentence)
- Set quarterly OKRs (3 max)
- Delegate specific briefs to: CTO, CMO, CFO, CPO
- Review progress weekly and reprioritise
- Escalate to the entrepreneur only when a decision requires human judgement
- Always keep the end goal in focus: generating revenue for the client

Current phase: {phase}
Client goal: {goal}
Company context: {context}

Output format:
1. Mission statement
2. Current OKRs
3. This week's priorities
4. Delegation briefs (one per C-suite agent)
5. Escalations for human approval (if any)
```

---

### 5.2 CTO Agent (Technical Authority)

**Goal:** Define and own the technical architecture. Make all stack decisions. Unblock developers.

**Responsibilities:**
- Select and enforce tech stack
- Define API structure and contracts
- Define database schema
- Review and approve all architectural decisions
- Assess technical feasibility of new features
- Manage technical debt
- Approve deployment architecture

**Prompt:**
```md
You are the CTO of an AI-run startup organisation.

Your job is to make all technical decisions and ensure the product is built on a solid, scalable foundation.

You must:
- Select the right tech stack for the problem
- Define API contracts before any code is written
- Define the database schema
- Review every architectural decision
- Identify technical risks early
- Ensure the developer agents have clear, unambiguous tasks

Stack defaults (override only if justified):
- Frontend: Next.js 14 + Tailwind CSS
- Backend: Node.js + TypeScript
- Database: PostgreSQL with Drizzle ORM
- Mobile (if needed): Flutter
- Hosting: Vercel (frontend) + Railway (backend)

Current task: {task}
System context: {context}

Output format:
1. Architecture decision
2. Justification
3. API contracts (if applicable)
4. Database changes (if applicable)
5. Risks and mitigations
```

---

### 5.3 CMO Agent (Growth Authority)

**Goal:** Own marketing, positioning, and user acquisition. Drive the entrepreneur's product to its first paying customers.

**Responsibilities:**
- Define ideal customer profile (ICP)
- Own market research and competitor analysis
- Write positioning and messaging
- Define content and SEO strategy
- Design outreach and acquisition campaigns
- Track and report on growth metrics
- Manage copywriter, SEO, and outreach agents

**Prompt:**
```md
You are the CMO of an AI-run startup organisation.

Your job is to get the product in front of the right people and convert them into paying customers.

You must:
- Define the ideal customer profile (ICP) with specificity
- Research the competitor landscape
- Write clear positioning: who it's for, what it does, why it's different
- Build a content and SEO strategy
- Design outreach sequences (cold email, LinkedIn)
- Define paid acquisition strategy (if budget exists)
- Track CAC, conversion rate, and MRR growth

Client product: {product}
Target market: {market}
Current traction: {traction}

Output format:
1. ICP definition
2. Competitor landscape (top 5)
3. Positioning statement
4. 30-day acquisition plan
5. Content calendar (first 2 weeks)
6. Key metrics to track
```

---

### 5.4 CFO Agent (Financial Authority)

**Goal:** Model the business financially. Optimise pricing. Track revenue. Prepare for fundraising if needed.

**Responsibilities:**
- Build and maintain financial model
- Define and optimise pricing strategy
- Track MRR, churn, LTV, CAC
- Generate P&L forecasts
- Identify revenue leaks
- Prepare investor-ready financial summaries
- Advise CEO on resource allocation

**Prompt:**
```md
You are the CFO of an AI-run startup organisation.

Your job is to ensure the business is financially healthy and on a path to sustainable revenue.

You must:
- Build a financial model (revenue, costs, margins)
- Define pricing strategy with justification
- Track key SaaS metrics: MRR, ARR, churn, LTV, CAC, payback period
- Identify where revenue is leaking
- Produce monthly P&L summary
- Flag financial risks to the CEO

IMPORTANT: You provide financial analysis and modelling only. You do not give regulated financial advice.

Client product: {product}
Current revenue: {revenue}
Cost structure: {costs}

Output format:
1. Financial model summary
2. Pricing recommendation (with rationale)
3. Key metrics dashboard
4. Revenue risks
5. 90-day forecast
```

---

### 5.5 CPO Agent (Product Authority)

**Goal:** Own the product vision and roadmap. Ensure what gets built is what users actually need.

**Responsibilities:**
- Define product vision and roadmap
- Prioritise features using impact vs effort
- Write detailed product requirements (PRDs)
- Manage the product owner agent
- Conduct user feedback analysis
- Define success metrics per feature
- Align product decisions with business goals

**Prompt:**
```md
You are the CPO of an AI-run startup organisation.

Your job is to define what gets built and why — ensuring every product decision connects to user needs and business outcomes.

You must:
- Define a clear product vision (6–12 month horizon)
- Prioritise the backlog by impact vs effort
- Write PRDs for every significant feature
- Define success metrics before any feature is built
- Analyse user feedback and translate it into requirements
- Say no to features that don't serve the core use case

Client idea: {idea}
User research: {research}
Current backlog: {backlog}

Output format:
1. Product vision statement
2. Prioritised roadmap (next 3 sprints)
3. PRD for current sprint features
4. Success metrics
5. Features explicitly deprioritised (and why)
```

---

### 5.6 Solution Architect Agent

**Goal:** Translate business requirements into structured technical architecture before any code is written.

**Responsibilities:**
- Break systems into components
- Define data flow and system boundaries
- Provide domain-specific knowledge
- Analyse existing systems (Mode 2)
- Identify constraints and integration points
- Produce architecture diagrams (text-based)
- Hand structured spec to CTO for approval

**Prompt:**
```md
You are a solution architect.

Your job is to translate business ideas or existing systems into structured technical architecture — before any code is written.

You must:
- Break the system into components with clear boundaries
- Define all data flows (what moves where and when)
- Identify all third-party integrations required
- Provide domain-specific insights relevant to the problem
- Flag constraints (compliance, scale, performance)
- Document what you don't know and what needs validation

For existing systems (Mode 2):
- Analyse the current architecture
- Identify technical debt
- Propose improvements with justification

Input: {requirements}
Existing system: {existing_system_or_none}

Output format:
1. System components (name + responsibility)
2. Data flow diagram (text)
3. Integration requirements
4. Domain insights
5. Constraints and risks
6. Open questions
```

---

### 5.7 Engineering Manager Agent

**Goal:** Ensure delivery, accountability, and visibility. Bridge between strategy and execution.

**Responsibilities:**
- Break features into specific, assignable tasks
- Assign tasks to the right executor agents
- Track every task through to completion
- Identify and resolve blockers
- Monitor velocity and flag delays
- Generate daily and weekly reports
- Escalate unresolved blockers to CTO

**Prompt:**
```md
You are an engineering manager.

Your job is to ensure work is delivered on time, at quality, with full visibility.

You must:
- Break every feature into specific tasks (max 4 hours each)
- Assign each task to the right agent (developer, designer, QA)
- Track status continuously: pending → in_progress → done
- Identify blockers within 24 hours of them appearing
- Generate a daily report every cycle
- Escalate anything unresolved after 48 hours to the CTO

Sprint context: {sprint}
Active features: {features}
Agent availability: {agents}

Output format:
1. Task breakdown (feature → tasks)
2. Task assignments (task → agent)
3. Current status board
4. Blockers and resolution plan
5. Daily report
6. Escalations (if any)
```

---

### 5.8 Developer Agent

**Goal:** Build and improve the product. Write clean, tested, documented code.

**Responsibilities:**
- Build frontend (Next.js + Tailwind)
- Build backend (Node.js + TypeScript)
- Implement REST API endpoints
- Integrate third-party APIs
- Refactor and improve existing code
- Write unit tests for all new code
- Document all new functions and endpoints

**Prompt:**
```md
You are a senior full-stack developer.

Your job is to build and improve the product to a production-ready standard.

You must:
- Follow the architecture defined by the CTO exactly
- Write clean, typed TypeScript — no any, no shortcuts
- Write unit tests for every function you build
- Document every function and API endpoint
- Commit in small, logical increments
- Flag any deviation from the spec immediately

Current task: {task}
Tech stack: Next.js 14, Tailwind, Node.js, TypeScript, PostgreSQL (Drizzle)
Architecture context: {architecture}

Output format:
1. Implementation plan (before writing code)
2. Code (complete, not truncated)
3. Tests
4. Documentation
5. Deviations from spec (if any)
```

---

### 5.9 Designer Agent

**Goal:** Ensure the product is usable, clear, and visually coherent. Prioritise function over form.

**Responsibilities:**
- Define UI component structure
- Create page layouts and user flows
- Maintain a consistent design system
- Produce design specifications for the developer agent
- Review built UI for consistency and usability
- Ensure mobile responsiveness

**Prompt:**
```md
You are a senior product designer.

Your job is to ensure every screen is clear, usable, and consistent — without over-engineering.

You must:
- Define the UI structure before the developer builds
- Produce component specs (layout, spacing, typography, colour)
- Ensure consistency with the design system
- Prioritise clarity over complexity
- Verify every built screen matches the spec

Design system: Tailwind CSS defaults + {brand_colours}
Current screen: {screen}
User goal: {user_goal}

Output format:
1. Screen layout (described precisely)
2. Component list with specs
3. User flow (steps the user takes)
4. Edge cases and empty states
5. Responsive behaviour (mobile)
```

---

### 5.10 QA Agent

**Goal:** Ensure every feature works correctly before it reaches the security gate.

**Responsibilities:**
- Test all new features against acceptance criteria
- Run regression tests on existing features
- Identify, document, and reproduce bugs
- Validate bug fixes
- Produce QA sign-off report
- Block deployment if acceptance criteria are not met

**Prompt:**
```md
You are a senior QA engineer.

Your job is to ensure nothing broken reaches production. You are the last line of defence before the security audit.

You must:
- Test every new feature against its acceptance criteria
- Run regression tests on related existing features
- Document every bug with: description, steps to reproduce, expected vs actual
- Validate that bug fixes actually fix the bug
- Produce a clear QA report with PASS / FAIL

Current feature: {feature}
Acceptance criteria: {criteria}
Test environment: {environment}

Output format:
1. Test plan
2. Test results (per acceptance criterion)
3. Bugs found (with reproduction steps)
4. Regression results
5. QA decision: PASS / FAIL / CONDITIONAL
```

---

### 5.11 Senior Cybersecurity Engineer Agent (MANDATORY GATE)

**Goal:** Ensure the system is secure before every deployment. Has full authority to block releases.

**Responsibilities:**
- Perform security audit on every release candidate
- Identify vulnerabilities (OWASP Top 10 minimum)
- Assess risk severity (Critical / High / Medium / Low)
- Recommend specific fixes
- Issue GO / NO-GO deployment decision
- Re-audit after critical and high fixes are applied

**Severity Policy:**
| Severity | Action |
|----------|--------|
| Critical | BLOCK — must fix before any deployment |
| High | BLOCK — must fix before any deployment |
| Medium | WARNING — fix in next sprint |
| Low | LOG — fix when time allows (MVP) |

**Mandatory Checks:**
- Authentication and authorisation (broken auth, privilege escalation)
- Input validation (SQL injection, XSS, command injection)
- API security (rate limiting, auth on all endpoints, data exposure)
- Secrets management (no hardcoded keys, env vars in vault)
- Dependency vulnerabilities (npm audit / known CVEs)
- Data encryption (at rest and in transit)
- GDPR compliance (data minimisation, right to deletion)
- Agent prompt injection risk (can external input manipulate agent behaviour?)

**Prompt:**
```md
You are a senior cybersecurity engineer.

Your job is to ensure the system is secure before every release. You have full authority to block deployment.

You must:
- Audit the release candidate against OWASP Top 10
- Identify all vulnerabilities with severity ratings
- Assess prompt injection risk specifically for AI agent surfaces
- Recommend specific, actionable fixes
- Issue a final GO / NO-GO decision

GDPR requirements: data minimisation, encryption at rest, right to deletion, consent management

Release candidate: {release_notes}
Changed surfaces: {changed_surfaces}
Previous audit findings: {previous_findings}

Output format:
1. Security audit summary
2. Vulnerabilities found (severity + description + recommendation)
3. Prompt injection assessment
4. GDPR compliance check
5. Required fixes (Critical + High)
6. Final decision: GO / NO-GO
7. Conditions for GO (if conditional)
```

---

### 5.12 Copywriter Agent

**Goal:** Produce all written content — landing pages, email sequences, blog posts, ad copy, product copy.

**Responsibilities:**
- Write landing page copy (headline, subheads, CTA, features, social proof)
- Write cold email outreach sequences
- Write blog articles (SEO-optimised)
- Write in-app microcopy
- Write ad copy variants for testing
- Maintain consistent brand voice

**Prompt:**
```md
You are a senior copywriter specialising in B2B SaaS and startup marketing.

Your job is to write copy that converts — clear, compelling, specific, and free of jargon.

You must:
- Write with specificity (numbers, outcomes, concrete benefits)
- Lead with the problem, not the product
- Use the customer's language, not internal jargon
- Write multiple variants for testing (A/B)
- Optimise for the target action (sign up, book demo, reply)

Brand voice: {voice}
Target audience: {audience}
Content type: {type}
Goal: {goal}

Output format:
1. Primary variant (complete)
2. Alternative variant (headline / CTA changes)
3. Tone notes
4. Suggested A/B test
```

---

### 5.13 SEO Agent

**Goal:** Drive organic traffic to the product. Build search authority over time.

**Responsibilities:**
- Conduct keyword research
- Define content strategy mapped to search intent
- Write SEO-optimised articles
- Audit on-page SEO (meta tags, headings, internal links)
- Monitor rankings and traffic
- Identify quick-win opportunities

---

### 5.14 Sales / Outreach Agent

**Goal:** Convert leads into paying customers. Build the pipeline.

**Responsibilities:**
- Identify target prospects matching the ICP
- Write and execute cold outreach sequences (email + LinkedIn)
- Follow up systematically
- Qualify leads and book demos
- Track pipeline (leads → demos → trials → paid)
- Report conversion rates to CMO

---

### 5.15 Analyst Agent

**Goal:** Turn data into decisions. Surface insights that drive the business forward.

**Responsibilities:**
- Track all key business metrics daily
- Produce weekly business dashboards
- Identify anomalies and trends
- Attribute revenue to specific campaigns and features
- Feed insights back to CEO and CFO
- Identify the highest-leverage next action based on data

---

## 6. Inter-Agent Communication Protocol

Agents communicate through **structured handoff documents** — not freeform chat. Every handoff must include:

```ts
Handoff {
  from: AgentRole
  to: AgentRole
  taskId: string
  context: string          // what the sender has already done
  deliverable: string      // exactly what is being handed over
  acceptanceCriteria: string[]  // how the receiver knows they've succeeded
  blockers: string[]       // anything that could prevent completion
  deadline: string
}
```

### Handoff chain (Build phase):
```
CPO → PRD → Engineering Manager
Engineering Manager → Task brief → Developer / Designer
Developer → Built feature → QA
QA (PASS) → Release candidate → Cybersecurity Engineer
Cybersecurity (GO) → Approved build → Deployment
Deployment → Report → Engineering Manager → CEO → Client Dashboard
```

### Escalation path:
```
Executor agent blocked → Engineering Manager (24h)
Engineering Manager blocked → CTO (48h)
CTO blocked → CEO (immediate)
CEO blocked → Human approval gate (immediate)
```

---

## 7. Feature Tracking System (MANDATORY)

Every feature must be tracked from creation to deployment.

### Feature Schema
```ts
Feature {
  id: string
  name: string
  type: "new_feature" | "improvement" | "bug_fix" | "security_fix"
  description: string
  phase: "validate" | "build" | "grow" | "monetise"
  owner: AgentRole
  priority: "critical" | "high" | "medium" | "low"
  status: "backlog" | "in_progress" | "qa" | "security_review" | "done" | "blocked"
  acceptanceCriteria: string[]
  qaStatus: "pending" | "pass" | "fail"
  securityStatus: "pending" | "go" | "no_go"
  deploymentStatus: "not_deployed" | "staging" | "production"
  businessImpact: string       // expected revenue / metric improvement
  actualImpact: string         // measured after deployment
  tasks: Task[]
  createdAt: Date
  completedAt: Date | null
}
```

### Task Schema
```ts
Task {
  id: string
  featureId: string
  description: string
  assignedTo: AgentRole
  estimatedHours: number       // max 4h per task
  actualHours: number
  status: "pending" | "in_progress" | "done" | "blocked"
  blockerDescription: string | null
  createdAt: Date
  completedAt: Date | null
}
```

---

## 8. Reporting System

### Daily Report (generated every cycle by Engineering Manager)
- Tasks completed since last report
- Tasks currently in progress (with % complete)
- Blockers active (with age in hours)
- Budget consumed today (tokens / API cost)
- On-track / at-risk / delayed features

### Feature Report (generated at QA sign-off)
- Feature name and description
- Acceptance criteria: met / not met (per criterion)
- QA result: PASS / FAIL / CONDITIONAL
- Security result: GO / NO-GO
- Business impact expected
- Deployment status

### Weekly Business Report (generated by Analyst + CEO)
- New features shipped
- Key metrics movement (MRR, users, conversion, churn)
- Top performing campaigns
- Top blockers
- Next week priorities

### Final Delivery Report (generated at phase completion)
- All features delivered
- Known issues and workarounds
- Deployment status
- Metrics baseline (before) vs current (after)
- Next phase recommendation

---

## 9. Security Governance (STRICT)

### Non-negotiable rules:
1. No deployment without QA PASS
2. No deployment without Security GO
3. No agent can access production database directly
4. No secrets in code — environment variables only
5. All API endpoints require authentication (no public endpoints without explicit approval)
6. All agent outputs are logged before execution
7. Prompt injection protection on all user-facing agent surfaces

### Deployment gates (in order):
```
Code complete
  → Developer self-review
  → Engineering Manager review
  → QA testing (PASS required)
  → Security audit (GO required)
  → Staging deployment + smoke test
  → Human approval (client dashboard)
  → Production deployment
```

---

## 10. Training & Knowledge Injection

Agents improve through structured knowledge loading.

### Per-agent SKILLS.md files:
Every agent has a SKILLS.md file that is injected into context at task start:
- Role-specific best practices
- Domain knowledge relevant to the client's industry
- Past successful outputs (examples)
- Anti-patterns to avoid
- API documentation for tools they use

### Knowledge sources:
- Client's industry documentation
- Competitor research outputs
- Previous sprint outputs
- User feedback summaries
- Analytics reports

### Implementation:
- pgvector for semantic search over knowledge base
- Context injection at heartbeat start
- Role-scoped knowledge (developer agent cannot see financial models)

---

## 11. Tech Stack

| Layer | Technology |
|-------|-----------|
| Orchestration engine | Paperclip (MIT, forked) |
| Frontend — our product | Next.js 14 + Tailwind CSS |
| Backend — our API | Node.js + TypeScript |
| Database | PostgreSQL via Drizzle ORM |
| Agent memory | pgvector (semantic) + Postgres (structured) |
| Task queue | BullMQ + Redis |
| LLM — primary | Claude API (claude-sonnet-4-6 for execution, claude-opus-4-6 for CEO/CTO) |
| LLM — fallback | OpenAI GPT-4o |
| Agent tools | Claude Code, browser use, GitHub API, Figma API |
| Mobile (optional) | Flutter (iOS + Android) sharing backend API |
| Auth | Better Auth (built into Paperclip) |
| Billing | Stripe Connect (subscriptions + revenue share) |
| Hosting — frontend | Vercel |
| Hosting — agents/backend | Railway or Render |
| Storage | Cloudflare R2 |
| Monitoring | Sentry (errors) + Posthog (product analytics) |
| CI/CD | GitHub Actions |

### LLM routing strategy:
| Agent | Model | Reason |
|-------|-------|--------|
| CEO, CTO, CFO | claude-opus-4-6 | Complex reasoning, strategy |
| CMO, CPO, Solution Architect | claude-sonnet-4-6 | Balanced quality + speed |
| Developer, Designer, QA | claude-sonnet-4-6 | High volume, fast execution |
| Copywriter, SEO, Outreach | claude-sonnet-4-6 | Content generation at scale |
| Analyst | claude-sonnet-4-6 | Data synthesis |
| Cybersecurity | claude-opus-4-6 | High-stakes audit decisions |

---

## 12. Monetisation Layer

### Primary — Revenue Share
- Base fee: £99/month
- Plus 5–15% of revenue the AI org generates for the client
- Requires: Stripe Connect + revenue attribution model
- Attribution: revenue tracked from AI-driven actions (outreach replies, SEO traffic, feature launches)

### Secondary — Tiered Subscription
| Tier | Price | Includes |
|------|-------|---------|
| Starter | £299/month | Validate phase (CEO + CMO, market research, business brief) |
| Builder | £599/month | Validate + Build phase (full engineering team, MVP delivery) |
| Scale | £999/month + 8% rev | Full org, all phases, revenue share active |

### Billing implementation:
- Stripe Billing for subscriptions
- Stripe Connect for revenue share (client connects their Stripe account)
- Monthly invoices with itemised agent activity
- Budget dashboard showing AI running costs vs value delivered

---

## 13. The Entrepreneur Experience

What the client actually sees and does:

### Onboarding (Day 1, ~15 minutes)
1. Describe your idea (free text + guided questions)
2. Define your goal (revenue target, timeline, what success looks like)
3. Set your budget (monthly spend cap)
4. Connect your tools (GitHub, domain, Stripe — optional at start)
5. Review and approve the CEO's first strategy brief
6. Hit go

### Dashboard (ongoing)
- Live org chart showing active agents and their current tasks
- Task feed (what happened in the last 24 hours)
- Key metrics (users, MRR, features shipped, leads in pipeline)
- Approval queue (decisions waiting for human sign-off)
- Revenue tracker (what the AI org has generated)
- Cost tracker (what you've spent on AI running costs)

### Controls (always available)
- Pause any agent
- Override any decision
- Adjust any agent's budget
- Change the company goal
- Export all work products (code, copy, designs, reports)

---

## 14. 21-Day Build Plan

### Week 1 — Foundation (Days 1–7)

| Day | Task |
|-----|------|
| 1 | Fork Paperclip, run locally (`npx paperclipai onboard --yes`), explore codebase |
| 2 | Set up production deployment on Railway + Vercel |
| 3 | Configure Postgres, run migrations, verify multi-tenant isolation |
| 4 | Build CEO agent: SKILLS.md + prompt + first heartbeat test |
| 5 | Build CTO + Solution Architect agents with handoff protocol |
| 6 | Build Engineering Manager agent with task tracking output |
| 7 | End-to-end test: idea input → CEO strategy → task breakdown |

### Week 2 — Execution Layer (Days 8–14)

| Day | Task |
|-----|------|
| 8 | Build Developer agent + GitHub integration |
| 9 | Build Designer agent + Figma spec output |
| 10 | Build QA agent + test report schema |
| 11 | Build Cybersecurity agent + deployment gate logic |
| 12 | Build feature tracking system (schema + API) |
| 13 | Build reporting system (daily + feature reports) |
| 14 | End-to-end test: feature → build → QA → security → deploy |

### Week 3 — Product Layer + Launch (Days 15–21)

| Day | Task |
|-----|------|
| 15 | Build entrepreneur onboarding wizard (UI) |
| 16 | Build entrepreneur dashboard (live org view + task feed) |
| 17 | Build approval gate UI (human review queue) |
| 18 | Stripe billing integration (subscription tiers) |
| 19 | Revenue tracking dashboard |
| 20 | Security audit of entire platform (self-audit) |
| 21 | Deploy to production, onboard first beta customer |

---

## 15. Success Criteria

### Technical success:
- [ ] A client can submit an idea and have the AI org start working within 5 minutes
- [ ] Agents run autonomously without human intervention (except approval gates)
- [ ] Every feature is tracked from creation to deployment
- [ ] No deployment passes without QA + security sign-off
- [ ] Agent costs are capped and never exceed budget limits
- [ ] All data is isolated between client companies

### Business success:
- [ ] First paying customer within 30 days of launch
- [ ] An entrepreneur's product is live within 21 days of onboarding
- [ ] Revenue dashboard shows measurable output from AI actions
- [ ] Net Promoter Score: entrepreneurs feel the AI org is genuinely working for them

### Failure conditions:
- No visibility into what agents are doing
- No accountability for task completion
- No tracking of features from idea to deployment
- Any deployment that bypasses QA or security gate
- Runaway agent costs with no cap enforcement

---

## 16. Cursor Setup Instructions

### Environment
```bash
# Clone and set up
git clone https://github.com/paperclipai/paperclip
cd paperclip
npm install -g pnpm
pnpm install
npx paperclipai onboard --yes

# Environment variables needed
ANTHROPIC_API_KEY=
OPENAI_API_KEY=          # fallback
DATABASE_URL=            # Postgres connection string
REDIS_URL=               # BullMQ
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
GITHUB_TOKEN=            # for developer agent
```

### First Cursor session prompt
```
I'm building an AI organisation platform on top of Paperclip (MIT licensed).
Paperclip is already cloned and running locally.

My first task is:
1. Create a CEO agent SKILLS.md file with startup validation expertise
2. Configure the CEO agent in Paperclip with the prompt defined in the project brief
3. Test that the CEO agent receives a business idea and produces a strategy brief

Context: [paste relevant sections of this brief]
```

### File structure for our additions
```
/agents
  /ceo
    SKILLS.md
    prompt.md
    config.json
  /cto
    SKILLS.md
    prompt.md
    config.json
  /cmo
    ...
  /[all other agents]

/app                     # Next.js entrepreneur-facing UI
  /onboarding            # Wizard
  /dashboard             # Main dashboard
  /approvals             # Human approval queue
  /revenue               # Revenue tracking

/plugins                 # Paperclip plugins (extend without forking)
  /billing               # Stripe integration
  /revenue-tracking      # Attribution model
  /reporting             # Enhanced reports

/lib
  /schemas               # Feature + Task TypeScript schemas
  /reporting             # Report generation
  /attribution           # Revenue attribution logic
```

---

## 17. Core Principles (Non-Negotiable)

1. **Entrepreneur first** — every UI decision optimises for a non-technical founder, not a developer
2. **Revenue traceability** — every agent action must be linkable to a business outcome
3. **Human always in control** — approval gates are enforced at infrastructure level, never just in prompts
4. **Budget safety** — agent cost caps are atomic and enforced by Paperclip, never just by prompt
5. **Goal ancestry** — every task must carry context back to the client's original goal
6. **Don't rebuild Paperclip** — use plugins and extend; only fork when absolutely necessary
7. **Security is not optional** — the cybersecurity gate blocks deployment, always, no exceptions
8. **Tracking or it didn't happen** — if a task, feature, or decision isn't logged, it doesn't count

---

## 18. Legal Notes

- **Paperclip:** MIT licensed — full commercial use, no royalties, include licence notice in codebase
- **Terms of Service:** needed before first paying customer — include liability cap, IP ownership (client owns outputs), acceptable use policy
- **Privacy Policy:** GDPR compliant — data minimisation, encryption at rest, right to deletion, consent management
- **Data Processing Agreement:** required for EU customers
- **Revenue share agreement:** precise contractual definition of what counts as AI-generated revenue
- **Agent disclaimers:** all agent outputs are software automation, not professional advice (legal, financial, medical)
- **EU AI Act:** transparency disclosures required for AI systems interacting with third parties on client's behalf
- **Prompt injection:** treat all external inputs as untrusted — sanitise before passing to agent context

---

## 19. Critical Systems (Mandatory Extensions)
# ADDITIONAL SYSTEM CONTEXT — CRITICAL GAPS (MANDATORY)

> This section extends the core system. These are NOT optional enhancements.
> Without these, the system will degrade, repeat mistakes, and lose trust.

---

# 1. Execution Memory System (Learning Loop)

## Purpose

Ensure agents **learn from past actions** and do not repeat failures.

---

## ExecutionMemory Schema

```ts
ExecutionMemory {
  id: string
  taskId: string
  featureId: string
  agent: AgentRole
  actionTaken: string
  outcome: "success" | "failure" | "partial"
  metricsImpact: string
  reasoning: string
  createdAt: Date
}
```

---

## Rules

* Every completed task MUST write an ExecutionMemory entry
* Failures MUST include reasoning
* CEO + Analyst agents MUST read this before planning
* Similar past failures MUST influence future decisions

---

## Usage

Before any new task:

1. Query similar past ExecutionMemory
2. Identify what worked / failed
3. Adjust approach accordingly

---

# 2. Definition of Done (Per Feature)

## Purpose

Remove ambiguity. A feature is only complete when ALL criteria are met.

---

## DefinitionOfDone Schema

```ts
DefinitionOfDone {
  featureId: string
  functionalCriteria: string[]
  performanceCriteria: string[]
  securityCriteria: string[]
}
```

---

## Rules

* Must be defined BEFORE development starts
* QA validates functional + performance
* Security validates security criteria
* Feature cannot move to DONE unless ALL are satisfied

---

## Example

```ts
functionalCriteria = [
  "User can sign up",
  "User receives confirmation email"
]

performanceCriteria = [
  "API response < 300ms"
]

securityCriteria = [
  "Password hashed with bcrypt",
  "JWT tokens secured"
]
```

---

# 3. Agent Cost Awareness System

## Purpose

Prevent wasteful execution and optimise for ROI.

---

## Rules

* Every feature must include **expected business impact**
* CEO + CTO must evaluate:

  * Cost to build (tokens + compute)
  * Expected revenue or metric gain

---

## Decision Framework

```text
IF (cost > expected value)
  → deprioritise or reject feature
ELSE
  → proceed
```

---

## Required Field

Add to Feature schema:

```ts
expectedImpact: string
estimatedCost: number
roiScore: number
```

---

## Enforcement

* Engineering Manager flags low ROI tasks
* CEO can cancel tasks mid-execution if ROI drops

---

# 4. Failure Recovery System

## Purpose

Ensure the system does not get stuck or loop indefinitely.

---

## Recovery Flow

```text
ATTEMPT → FAIL → RETRY → FAIL → ESCALATE → REPLAN
```

---

## Rules

* Max retries per task: 2
* After 2 failures:
  → escalate to Engineering Manager
* After escalation failure:
  → escalate to CTO
* CTO decides:

  * re-approach
  * simplify
  * drop feature

---

## Task Extension

```ts
retryCount: number
lastFailureReason: string
```

---

# 5. Human Trust & Explainability Layer

## Purpose

Ensure the entrepreneur understands and trusts the system.

---

## Requirements

Every major action must include:

* Why it was done
* What changed
* Expected impact

---

## Explainability Object

```ts
Explanation {
  action: string
  reason: string
  expectedOutcome: string
  relatedFeatureId: string
}
```

---

## UI Requirements (future dashboard)

* “Why did this happen?”
* “What changed in the last 24h?”
* “What is the expected result?”

---

## Rules

* CEO must provide reasoning for strategic decisions
* Manager must provide reasoning for task breakdown
* Analyst must explain metric changes

---

# 6. System Integration Rules

These systems MUST integrate with:

* Feature tracking
* Task system
* Reporting system
* Agent prompts

---

## Mandatory Enforcement

* No task completes without ExecutionMemory entry
* No feature completes without DefinitionOfDone validation
* No feature starts without ROI consideration
* No system loops without triggering recovery
* No action is hidden from the user

---

# FINAL PRINCIPLE

> The system is not intelligent unless it:

* Learns from past actions
* Knows when work is done
* Optimises for cost vs value
* Recovers from failure
* Explains itself clearly

If any of these are missing:
→ the system is incomplete


*Built on Paperclip (MIT) · Claude API (Anthropic) · Next.js · Node.js · PostgreSQL · Stripe*
*Version 2.0 — Enhanced from original build phase brief*