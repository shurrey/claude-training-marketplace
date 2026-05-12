# Changelog

All notable changes to this plugin are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-05-12

### Added
- Initial plugin scaffold (manifest, license, attribution)
- Five core skills: `aidlc`, `aidlc-common`, `aidlc-inception`, `aidlc-construction`, `aidlc-operations`
- Two extension skills: `aidlc-ext-security-baseline`, `aidlc-ext-testing-property`
- Four slash commands: `/aidlc`, `/aidlc-inception`, `/aidlc-construction`, `/aidlc-operations`
- Cross-doc consistency hook (Tier-1 grep + Tier-2 claude headless)
- Sync script `scripts/sync-upstream.sh` with auto-stub creation for new upstream dirs
- AUTO-REFS regeneration helper `scripts/lib/auto_refs.py`
- Test suite: manifest, skills, sync, hook (Tier-1 + Tier-2 mocked), end-to-end
- CI workflow for validation
