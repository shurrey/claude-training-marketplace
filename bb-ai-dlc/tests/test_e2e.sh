#!/usr/bin/env bash
# End-to-end smoke: simulate a workspace edit and verify the hook fires.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WS="$(mktemp -d)"
trap 'rm -rf "$WS"' EXIT

# Materialize a small aidlc-docs workspace
mkdir -p "$WS/aidlc-docs/inception/requirements"
mkdir -p "$WS/aidlc-docs/inception/user-stories"
cat > "$WS/aidlc-docs/inception/requirements/req-001.md" <<EOF
# REQ-001
The system MUST do X.
EOF
cat > "$WS/aidlc-docs/inception/user-stories/stories.md" <<EOF
# US-001 — Implements REQ-001
A user can ...
EOF
touch "$WS/aidlc-docs/audit.md"

# Edit req-001 then fire the hook with the payload Claude Code would send
cat > "$WS/aidlc-docs/inception/requirements/req-001.md" <<EOF
# REQ-001 (revised)
The system MUST do X and Y.
EOF

PAYLOAD="$(cat <<JSON
{
  "hook_event_name": "PostToolUse",
  "tool_name": "Edit",
  "tool_input": {"file_path": "$WS/aidlc-docs/inception/requirements/req-001.md"},
  "tool_response": {"success": true},
  "cwd": "$WS"
}
JSON
)"

# Disable Tier-2 so the e2e test does not depend on `claude` being installed
export AIDLC_TIER2_DISABLED=1

# Capture both stdout and stderr; with TIER2 disabled, Tier-1 candidates appear on stderr.
output="$(echo "$PAYLOAD" | python3 "$REPO_ROOT/hooks/consistency-check.py" 2>&1)"

# Verify audit.md was updated
if ! grep -q "drift-check" "$WS/aidlc-docs/audit.md"; then
  echo "FAIL: audit.md was not updated"
  cat "$WS/aidlc-docs/audit.md"
  exit 1
fi
echo "OK: audit.md updated"

# Verify Tier-1 candidate (stories.md) was surfaced
if ! echo "$output" | grep -q "stories.md"; then
  echo "FAIL: stories.md not surfaced as candidate"
  echo "Hook output was:"
  echo "$output"
  exit 1
fi
echo "OK: candidate surfaced"

echo "E2E PASS"
