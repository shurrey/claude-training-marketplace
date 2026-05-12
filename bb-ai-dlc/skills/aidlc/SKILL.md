---
name: aidlc
description: AI-Driven Development Lifecycle (AI-DLC) orchestrator. Use when the user says "Using AI-DLC", asks to follow the AI-DLC methodology, or starts a structured three-phase software development workflow. Routes to inception, construction, or operations phase skills as appropriate.
---
# AI-DLC — orchestrator

AI-DLC is a structured methodology for building software with AI coding agents.
It runs in three phases:

1. **Inception** — requirements, user stories, application design, workflow planning
2. **Construction** — functional design, NFRs, infrastructure, code generation, build-and-test
3. **Operations** — deployment and operating the system

User-produced artifacts live under `aidlc-docs/` in the workspace, organized by phase.

## When to activate which phase

- New project or scoping a feature → activate `aidlc-inception`
- Designs are ready, time to build → activate `aidlc-construction`
- Built and tested, time to ship → activate `aidlc-operations`

The cross-cutting `aidlc-common` skill provides discipline rules (depth levels,
overconfidence prevention, question format, etc.) and should be applied alongside
whichever phase is active.

For the canonical workflow specification, see `references/core-workflow.md`.

<!-- AUTO-REFS:START -->
For deep guidance, consult:
- [Core Workflow](references/core-workflow.md)
<!-- AUTO-REFS:END -->

## Cross-references to phase skills

- Phase 1: see the `aidlc-inception` skill
- Phase 2: see the `aidlc-construction` skill
- Phase 3: see the `aidlc-operations` skill
- Discipline: see the `aidlc-common` skill
