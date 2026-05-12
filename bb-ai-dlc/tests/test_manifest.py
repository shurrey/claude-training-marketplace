"""Validates the plugin manifest.

This plugin lives inside a multi-plugin marketplace (parent repo owns
.claude-plugin/marketplace.json) so the plugin itself only ships plugin.json.
"""
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def test_plugin_json_parses():
    data = json.loads((REPO_ROOT / ".claude-plugin" / "plugin.json").read_text())
    assert data["name"] == "bb-ai-dlc"
    assert "version" in data
    assert "description" in data
    assert data["commands"] == "commands"
    assert data["skills"] == "skills"
    assert data["hooks"] == "hooks/hooks.json"


def test_referenced_directories_exist():
    plugin = json.loads((REPO_ROOT / ".claude-plugin" / "plugin.json").read_text())
    for key in ("commands", "skills"):
        assert (REPO_ROOT / plugin[key]).is_dir(), f"{key} dir missing"
    assert (REPO_ROOT / plugin["hooks"]).is_file(), "hooks.json missing"
