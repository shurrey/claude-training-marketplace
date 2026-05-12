"""Tests for hooks/consistency-check.py."""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
HOOK = REPO_ROOT / "hooks" / "consistency-check.py"
FIXTURE_SRC = REPO_ROOT / "tests" / "fixtures" / "aidlc-docs"


@pytest.fixture
def workspace(tmp_path):
    """Materialize a fresh copy of the fixture workspace under tmp_path."""
    dst = tmp_path / "aidlc-docs"
    shutil.copytree(FIXTURE_SRC, dst)
    return tmp_path


def run_hook(payload: dict, cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(HOOK)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=str(cwd),
    )


def _payload(file_path: str) -> dict:
    return {
        "hook_event_name": "PostToolUse",
        "tool_name": "Edit",
        "tool_input": {"file_path": file_path},
        "tool_response": {"success": True},
    }


def test_non_aidlc_path_exits_silently(workspace):
    """Edits outside aidlc-docs/ must be ignored entirely."""
    result = run_hook(
        _payload(str(workspace / "src" / "main.py")),
        cwd=workspace,
    )
    assert result.returncode == 0
    assert result.stdout == ""
    assert result.stderr == ""


def test_aidlc_edit_with_no_candidates_silent(workspace, monkeypatch):
    """If Tier-1 finds no candidates, hook exits silently."""
    new = workspace / "aidlc-docs" / "inception" / "requirements" / "orphan.md"
    new.parent.mkdir(parents=True, exist_ok=True)
    new.write_text("# REQ-999 — Lonely\n\nNobody references this.\n")
    result = run_hook(_payload(str(new)), cwd=workspace)
    assert result.returncode == 0
    assert result.stdout == ""


def test_aidlc_edit_with_candidates_surfaces_them(workspace, monkeypatch):
    """Editing REQ-001 should surface stories.md and auth-design.md as candidates."""
    monkeypatch.setenv("AIDLC_TIER2_DISABLED", "1")
    edited = workspace / "aidlc-docs" / "inception" / "requirements" / "req-001.md"
    edited.write_text("# REQ-001 — Authentication (revised)\n\nNow requires SAML.\n")
    result = run_hook(_payload(str(edited)), cwd=workspace)
    assert result.returncode == 0
    assert "stories.md" in result.stderr or "auth-design.md" in result.stderr


def test_aidlc_edit_writes_audit_line(workspace, monkeypatch):
    """When drift is reported, audit.md gets a one-line entry."""
    monkeypatch.setenv("AIDLC_TIER2_DISABLED", "1")
    edited = workspace / "aidlc-docs" / "inception" / "requirements" / "req-001.md"
    edited.write_text("# REQ-001 changed\n")
    run_hook(_payload(str(edited)), cwd=workspace)
    audit = (workspace / "aidlc-docs" / "audit.md").read_text()
    assert "drift-check" in audit
    assert "req-001.md" in audit


def test_tier2_invocation_mocked(workspace, monkeypatch):
    """When Tier-1 finds candidates and Tier-2 is enabled, claude -p is invoked."""
    stub_dir = workspace / "bin"
    stub_dir.mkdir()
    stub = stub_dir / "claude"
    stub.write_text(
        "#!/usr/bin/env bash\n"
        'echo \'{"drift":[{"file":"aidlc-docs/inception/user-stories/stories.md",'
        '"reason":"references REQ-001 which now requires SAML",'
        '"severity":"high"}]}\'\n'
    )
    stub.chmod(0o755)
    monkeypatch.setenv("PATH", f"{stub_dir}:{os.environ.get('PATH', '')}")
    edited = workspace / "aidlc-docs" / "inception" / "requirements" / "req-001.md"
    edited.write_text("# REQ-001 — Now SAML\n")
    result = run_hook(_payload(str(edited)), cwd=workspace)
    assert result.returncode == 0
    assert "hookSpecificOutput" in result.stdout
    assert "stories.md" in result.stdout


def test_tier2_timeout_degrades_gracefully(workspace, monkeypatch):
    """If `claude -p` hangs past timeout, hook still exits 0 with Tier-1 warnings."""
    stub_dir = workspace / "bin"
    stub_dir.mkdir()
    stub = stub_dir / "claude"
    stub.write_text("#!/usr/bin/env bash\nsleep 60\n")
    stub.chmod(0o755)
    monkeypatch.setenv("PATH", f"{stub_dir}:{os.environ.get('PATH', '')}")
    monkeypatch.setenv("AIDLC_TIER2_TIMEOUT", "2")
    edited = workspace / "aidlc-docs" / "inception" / "requirements" / "req-001.md"
    edited.write_text("# REQ-001 — Now SAML\n")
    result = run_hook(_payload(str(edited)), cwd=workspace)
    assert result.returncode == 0
    assert "timed out" in result.stderr.lower() or "tier-1" in result.stderr.lower()
