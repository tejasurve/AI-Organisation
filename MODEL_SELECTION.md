# AI Model Strategy — Usage & Routing Guide

> This file defines how models are used across the AI organisation.
> It ensures optimal performance, cost efficiency, and consistency.

---

# 1. Core Principle

> **Use the right model for the right job.**

* High reasoning → strategic decisions
* Fast models → execution
* Code models → implementation

---

# 2. Model Categories

---

## 🧠 High Reasoning Models

Used for:

* Strategy
* Architecture
* Critical decisions
* Security

### Primary:

* claude-opus-4-7-thinking-xhigh

### Secondary:

* claude-opus-4-7-high

---

## ⚙️ Execution Models

Used for:

* Task breakdown
* Planning
* Structured outputs
* QA

### Primary:

* claude-opus-4-7-high

### Secondary:

* gpt-5.5-medium

---

## 💻 Code Generation Models

Used for:

* Writing code
* Refactoring
* API implementation

### Primary:

* gpt-5.3-codex

### Secondary:

* gpt-5.5-medium

---

# 3. Agent → Model Mapping

| Agent                  | Model                          |
| ---------------------- | ------------------------------ |
| CEO                    | claude-opus-4-7-thinking-xhigh |
| CTO                    | claude-opus-4-7-thinking-xhigh |
| Solution Architect     | claude-opus-4-7-high           |
| Engineering Manager    | claude-opus-4-7-high           |
| Developer              | gpt-5.3-codex                  |
| QA                     | gpt-5.5-medium                 |
| Designer               | claude-opus-4-7-high           |
| Cybersecurity Engineer | claude-opus-4-7-thinking-xhigh |
| CMO                    | claude-opus-4-7-high           |
| CFO                    | claude-opus-4-7-thinking-xhigh |
| Analyst                | claude-opus-4-7-high           |
| Copywriter             | claude-opus-4-7-high           |
| SEO                    | claude-opus-4-7-high           |
| Outreach/Sales         | claude-opus-4-7-high           |

---

# 4. Routing Rules

---

## Rule 1 — Thinking Models Are Expensive

* Use ONLY for:

  * CEO decisions
  * Architecture design
  * Security audits

❌ Never use for:

* repetitive tasks
* simple transformations
* code generation

---

## Rule 2 — Execution Should Be Fast

* Default model: claude-opus-4-7-high
* Must prioritise:

  * speed
  * consistency
  * structured output

---

## Rule 3 — Code Uses Codex

* All code generation:
  → gpt-5.3-codex

* Ensures:

  * better syntax accuracy
  * cleaner implementations
  * fewer hallucinations

---

## Rule 4 — Fallback Strategy

If primary model fails:

| Primary                        | Fallback             |
| ------------------------------ | -------------------- |
| claude-opus-4-7-thinking-xhigh | claude-opus-4-7-high |
| claude-opus-4-7-high           | gpt-5.5-medium       |
| gpt-5.3-codex                  | gpt-5.5-medium       |

---

# 5. Cost Control Strategy

---

## Token Usage Guidelines

* CEO / CTO: High tokens allowed
* Developer: Medium
* QA: Low
* Manager: Low

---

## Cost Enforcement

* Each agent has a max token budget
* Tasks exceeding budget must be:

  * split
  * simplified
  * or rejected

---

# 6. Output Discipline Rules

---

## Mandatory Constraints (ALL MODELS)

* Output must be structured
* No unnecessary explanation
* No hallucinated features
* Follow exact schema when provided

---

## Add this to prompts when needed:

```text
Keep output minimal, structured, and aligned to the spec. Do not over-engineer.
```

---

# 7. When to Upgrade Model

Upgrade to thinking model ONLY if:

* Decision is unclear
* Multiple trade-offs exist
* High business impact
* Security risk involved

---

# 8. When to Downgrade Model

Use cheaper/faster model if:

* Task is repetitive
* Output is predictable
* No strategic reasoning needed

---

# 9. System Rule

> **Bad model selection = bad system performance**

This affects:

* speed
* cost
* reliability

---

# 10. Final Principle

```text
Think with Opus.
Build with Codex.
Execute with speed.
```

---

If this rule is broken:

* system becomes slow
* costs increase
* outputs degrade

---

# END
