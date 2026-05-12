#!/usr/bin/env python3
"""AI-DLC cross-document consistency check (PostToolUse hook).

Tier-1 (always after path filter): grep for cross-references to the edited
file's identifiers in other aidlc-docs/ files. Build a candidate list.

Tier-2 (only if Tier-1 found candidates): invoke `claude -p` to produce a
structured drift report. Inject the report into the next turn via
hookSpecificOutput.additionalContext.

Exit codes: always 0 (non-blocking).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

AIDLC_DIR = "aidlc-docs"
ID_PATTERNS = [
    re.compile(r"\bREQ-\d+\b"),
    re.compile(r"\bUS-\d+\b"),
    re.compile(r"\bNFR-\d+\b"),
    re.compile(r"\bUNIT-[A-Za-z0-9_-]+\b"),
]
HEADING_RE = re.compile(r"^#{1,6}\s+(.+?)\s*$", re.MULTILINE)
try:
    TIMEOUT_SEC = int(os.environ.get("AIDLC_TIER2_TIMEOUT", "30"))
except ValueError:
    TIMEOUT_SEC = 30
TIER2_DISABLED = os.environ.get("AIDLC_TIER2_DISABLED", "0") == "1"


def _read_payload() -> dict:
    try:
        return json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        return {}


def _resolve_cwd(payload: dict) -> Path:
    return Path(payload.get("cwd") or os.getcwd()).resolve()


def _edited_file(payload: dict) -> Path | None:
    fp = (payload.get("tool_input") or {}).get("file_path")
    if not fp:
        return None
    return Path(fp).resolve()


def _is_under_aidlc_docs(path: Path, workspace: Path) -> bool:
    try:
        rel = path.relative_to(workspace)
    except ValueError:
        return False
    return rel.parts and rel.parts[0] == AIDLC_DIR


def _extract_identifiers(text: str, filename: str) -> set[str]:
    ids = set()
    ids.add(Path(filename).stem)
    for pat in ID_PATTERNS:
        ids.update(pat.findall(text))
    for match in HEADING_RE.finditer(text):
        for pat in ID_PATTERNS:
            ids.update(pat.findall(match.group(1)))
    return {i for i in ids if i and len(i) > 2}


def _tier1_candidates(edited: Path, workspace: Path) -> list[dict]:
    """Find aidlc-docs files that reference identifiers from the edited file."""
    try:
        text = edited.read_text()
    except (OSError, UnicodeDecodeError):
        return []
    identifiers = _extract_identifiers(text, edited.name)
    if not identifiers:
        return []

    candidates: dict[Path, dict] = {}
    aidlc_root = workspace / AIDLC_DIR
    for md_path in aidlc_root.rglob("*.md"):
        if md_path.resolve() == edited:
            continue
        try:
            other_text = md_path.read_text()
        except (OSError, UnicodeDecodeError):
            continue
        matched_ids = [i for i in identifiers if i in other_text]
        if not matched_ids:
            continue
        rel = md_path.relative_to(workspace)
        candidates[md_path] = {
            "file": str(rel),
            "reason": f"references identifier(s) {', '.join(sorted(matched_ids))}",
            "confidence": "medium" if len(matched_ids) > 1 else "low",
        }
    return sorted(candidates.values(), key=lambda c: c["file"])


def _build_tier2_prompt(edited_rel: str, edited_text: str, candidates: list[dict],
                        workspace: Path) -> str:
    parts = [
        "You are checking AI-DLC documents for cross-reference drift.",
        f"The user just edited: {edited_rel}",
        "Edited file content (current version):",
        "```markdown",
        edited_text[:4000],
        "```",
        "",
        f"Tier-1 found {len(candidates)} candidate file(s) that may now be stale:",
    ]
    for cand in candidates:
        cand_path = workspace / cand["file"]
        try:
            cand_text = cand_path.read_text()[:2000]
        except OSError:
            cand_text = "<unreadable>"
        parts.extend([
            f"\n## {cand['file']} (Tier-1 reason: {cand['reason']})",
            "```markdown",
            cand_text,
            "```",
        ])
    parts.append("")
    parts.append(
        "Identify which candidates are genuinely inconsistent with the edit. "
        "Return ONLY a JSON object: "
        '{"drift": [{"file": "<path>", "reason": "<one sentence>", '
        '"severity": "low|medium|high"}, ...]}. '
        "If no drift, return {\"drift\": []}. No prose, no markdown fences."
    )
    return "\n".join(parts)


def _run_tier2(prompt: str) -> dict | None:
    try:
        proc = subprocess.run(
            ["claude", "-p", "--output-format", "json", "--max-turns", "1"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SEC,
        )
    except FileNotFoundError:
        print("Tier-2: `claude` not on PATH; skipping smart check.", file=sys.stderr)
        return None
    except subprocess.TimeoutExpired:
        print(f"Tier-2: claude -p timed out after {TIMEOUT_SEC}s; falling back to Tier-1.",
              file=sys.stderr)
        return None
    if proc.returncode != 0:
        print(f"Tier-2: claude -p exited {proc.returncode}; falling back to Tier-1.",
              file=sys.stderr)
        return None
    raw = proc.stdout
    try:
        outer = json.loads(raw)
    except json.JSONDecodeError:
        return _parse_inner_json(raw)
    inner = outer.get("result") if isinstance(outer, dict) else None
    if isinstance(inner, str):
        return _parse_inner_json(inner)
    if isinstance(inner, dict) and "drift" in inner:
        return inner
    if isinstance(outer, dict) and "drift" in outer:
        return outer
    return None


def _parse_inner_json(raw: str) -> dict | None:
    match = re.search(r"\{[^{}]*\"drift\"\s*:\s*\[.*?\]\s*\}", raw, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def _emit_additional_context(report: dict, edited_rel: str) -> None:
    """Emit hookSpecificOutput JSON on stdout for Claude to see next turn."""
    drift = report.get("drift") or []
    if not drift:
        return
    bullets = "\n".join(
        f"- {d.get('file')} ({d.get('severity', 'unknown')}): {d.get('reason', '')}"
        for d in drift
    )
    ctx = (
        f"AI-DLC consistency check: after the edit to `{edited_rel}`, "
        f"the following AI-DLC documents may be stale:\n{bullets}\n"
        "Consider reviewing and updating them before continuing."
    )
    out = {
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": ctx,
        }
    }
    print(json.dumps(out))


def _write_audit(workspace: Path, edited_rel: str, flagged: list[str]) -> None:
    audit_path = workspace / AIDLC_DIR / "audit.md"
    if not audit_path.parent.exists():
        return
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    line = f"- [{ts}] drift-check: edited {edited_rel} → flagged {', '.join(flagged) or 'none'}\n"
    try:
        with audit_path.open("a", encoding="utf-8") as f:
            f.write(line)
    except OSError:
        pass


def main() -> int:
    payload = _read_payload()
    if payload.get("hook_event_name") != "PostToolUse":
        return 0

    workspace = _resolve_cwd(payload)
    edited = _edited_file(payload)
    if edited is None or not _is_under_aidlc_docs(edited, workspace):
        return 0

    candidates = _tier1_candidates(edited, workspace)
    if not candidates:
        return 0

    edited_rel = str(edited.relative_to(workspace))
    candidate_files = [c["file"] for c in candidates]

    print(
        f"AI-DLC Tier-1 drift check: edit to {edited_rel} may affect:\n  - "
        + "\n  - ".join(candidate_files),
        file=sys.stderr,
    )

    if TIER2_DISABLED:
        _write_audit(workspace, edited_rel, candidate_files)
        return 0

    edited_text = edited.read_text(errors="ignore")
    prompt = _build_tier2_prompt(edited_rel, edited_text, candidates, workspace)
    report = _run_tier2(prompt)

    if report is None:
        report = {
            "drift": [
                {"file": c["file"], "reason": c["reason"], "severity": "low"}
                for c in candidates
            ]
        }

    _emit_additional_context(report, edited_rel)
    flagged = [d.get("file", "") for d in (report.get("drift") or [])]
    _write_audit(workspace, edited_rel, flagged)
    return 0


if __name__ == "__main__":
    sys.exit(main())
