---
name: aidlc-inception
description: AI-DLC Phase 1 — Inception. Use for requirements analysis, user stories generation, application design, workflow planning, workspace/brownfield detection, and reverse-engineering existing systems. Artifacts land under aidlc-docs/inception/.
---
# AI-DLC — Inception phase

The inception phase translates an idea into a structured set of requirements,
user stories, designs, and execution plans. Artifacts live under
`aidlc-docs/inception/` in the workspace.

## Sub-activities

- **Workspace detection** — is this greenfield or brownfield? Drives whether
  reverse-engineering kicks in (see `references/workspace-detection.md`)
- **Reverse engineering** (brownfield only) — extract current state from existing
  code (see `references/reverse-engineering.md`)
- **Requirements analysis** — produces `aidlc-docs/inception/requirements/`
  (see `references/requirements-analysis.md`)
- **User stories** — produces `aidlc-docs/inception/user-stories/`
  (see `references/user-stories.md`)
- **Application design** — produces `aidlc-docs/inception/application-design/`
  (see `references/application-design.md`)
- **Units generation** — decomposes the system into build units
  (see `references/units-generation.md`)
- **Workflow planning** — produces execution plans under
  `aidlc-docs/inception/plans/` (see `references/workflow-planning.md`)

## When this phase is done

The construction phase can begin when:
- Requirements are validated
- User stories cover the scope
- Application design is approved
- Units are defined with clear boundaries

Apply the `aidlc-common` skill in parallel for cross-cutting discipline rules.

<!-- AUTO-REFS:START -->
For deep guidance, consult:
- [Application Design](references/application-design.md)
- [Requirements Analysis](references/requirements-analysis.md)
- [Reverse Engineering](references/reverse-engineering.md)
- [Units Generation](references/units-generation.md)
- [User Stories](references/user-stories.md)
- [Workflow Planning](references/workflow-planning.md)
- [Workspace Detection](references/workspace-detection.md)
<!-- AUTO-REFS:END -->
