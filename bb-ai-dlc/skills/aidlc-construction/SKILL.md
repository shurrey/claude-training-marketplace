---
name: aidlc-construction
description: AI-DLC Phase 2 — Construction. Use for functional design, NFR (non-functional requirement) requirements and design, infrastructure design, code generation, and build-and-test of a unit defined in inception. Artifacts land under aidlc-docs/construction/<unit-name>/.
---
# AI-DLC — Construction phase

The construction phase builds a unit from the inception artifacts. Each unit
goes through functional design, NFR requirements, NFR design, infrastructure
design, code generation, and build-and-test. Artifacts live under
`aidlc-docs/construction/<unit-name>/`.

## Sub-activities per unit

- **Functional design** — translates requirements/stories into functional
  specification (see `references/functional-design.md`)
- **NFR requirements** — non-functional needs (perf, security, scaling,
  see `references/nfr-requirements.md`)
- **NFR design** — how NFRs are met (see `references/nfr-design.md`)
- **Infrastructure design** — deployment topology (see `references/infrastructure-design.md`)
- **Code generation** — actual implementation (see `references/code-generation.md`)
- **Build and test** — validation (see `references/build-and-test.md`)

## Important constraints

- Application code lives at workspace root, NEVER inside `aidlc-docs/`
- `aidlc-docs/construction/<unit-name>/code/` contains only Markdown summaries
  of generated code, not the code itself
- The cross-doc consistency hook will flag drift if construction artifacts
  conflict with inception artifacts — surface and resolve before continuing

Apply the `aidlc-common` skill in parallel for cross-cutting discipline rules.

<!-- AUTO-REFS:START -->
For deep guidance, consult:
- [Build And Test](references/build-and-test.md)
- [Code Generation](references/code-generation.md)
- [Functional Design](references/functional-design.md)
- [Infrastructure Design](references/infrastructure-design.md)
- [Nfr Design](references/nfr-design.md)
- [Nfr Requirements](references/nfr-requirements.md)
<!-- AUTO-REFS:END -->
