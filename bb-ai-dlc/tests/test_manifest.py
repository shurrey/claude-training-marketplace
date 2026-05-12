"""Validates the plugin manifest.

This plugin lives inside a multi-plugin marketplace (parent repo owns
.claude-plugin/marketplace.json) so the plugin itself only ships plugin.json.

Claude Code auto-discovers commands/, skills/, and hooks/hooks.json from
conventional paths; the manifest does not declare them explicitly.
"""
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def test_plugin_json_parses():
    data = json.loads((REPO_ROOT / ".claude-plugin" / "plugin.json").read_text())
    assert data["name"] == "bb-ai-dlc"
    assert "version" in data
    assert "description" in data
    assert isinstance(data["author"], dict)
    assert data["author"].get("name")


def test_conventional_dirs_exist():
    """Auto-discovered directories must be present for the plugin to function."""
    for path in ("commands", "skills", "hooks/hooks.json"):
        assert (REPO_ROOT / path).exists(), f"missing {path}"
