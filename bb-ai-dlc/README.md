# bb-ai-dlc

A Claude Code plugin for the **AI-Driven Development Lifecycle (AI-DLC)** methodology.

Derived from [`awslabs/aidlc-workflows`](https://github.com/awslabs/aidlc-workflows)
(Apache-2.0). Upstream rules are mirrored verbatim into per-skill `references/`
directories; the plugin adds slash commands, skill orchestration metadata, and
a cross-document consistency hook on top.

The `bb-` prefix is the Blackboard namespace, to avoid collision if AWS Labs
publishes their own first-party plugin in the future.

## What you get

- **Skills** that auto-activate when the user says "Using AI-DLC" or otherwise
  signals AIDLC intent: `aidlc` (router), `aidlc-inception`, `aidlc-construction`,
  `aidlc-operations`, `aidlc-common` (cross-cutting discipline), plus extension
  skills for security baseline and property-based testing.
- **Slash commands** for direct phase activation: `/aidlc`, `/aidlc-inception`,
  `/aidlc-construction`, `/aidlc-operations`.
- **Consistency hook** that fires on `Write`/`Edit`/`MultiEdit` to any
  `aidlc-docs/` artifact, surfaces cross-document drift (Tier-1 grep, Tier-2
  optional `claude -p` headless drift check), and injects findings into the
  next turn so Claude can address them without manual user intervention.

## Install

```
/plugin marketplace add shurrey/claude-training-marketplace
/plugin install bb-ai-dlc
```

## Use

Either say "Using AI-DLC, let's scope feature X" (skills auto-activate) or run
`/aidlc-inception`, etc. Artifacts produced by AIDLC land under `aidlc-docs/`
in your workspace.

## Updating from upstream

Maintainer runs:

```
./scripts/sync-upstream.sh
```

This shallow-clones `awslabs/aidlc-workflows`, mirrors the rule files into
`skills/*/references/`, regenerates AUTO-REFS sections, and updates the
upstream SHA in `NOTICE` and `.upstream-version`. New extension or phase
directories trigger auto-stub creation with `STUB CREATED` warnings — polish
the auto-stub `SKILL.md` before tagging a release.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
