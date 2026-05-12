#!/usr/bin/env bash
# Smoke test for scripts/sync-upstream.sh.
# Runs sync against a frozen upstream SHA, asserts file counts in references/.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FROZEN_SHA="$(cat "${REPO_ROOT}/tests/fixtures/frozen-upstream-sha.txt")"

# Run sync in a clean clone so we don't pollute the working tree
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
git -C "${REPO_ROOT}" archive HEAD | tar -x -C "$WORK"

cd "$WORK"
./scripts/sync-upstream.sh --ref "$FROZEN_SHA"

# Assertions — format: "path:expected_count"
EXPECTED_COUNTS=(
  "skills/aidlc-common/references:11"
  "skills/aidlc-inception/references:7"
  "skills/aidlc-construction/references:6"
  "skills/aidlc-operations/references:1"
  "skills/aidlc/references:1"
  "skills/aidlc-ext-security-baseline/references:2"
  "skills/aidlc-ext-testing-property/references:2"
)

failed=0
for entry in "${EXPECTED_COUNTS[@]}"; do
  path="${entry%%:*}"
  expected="${entry##*:}"
  actual="$(find "$path" -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: $path expected $expected .md files, found $actual"
    failed=1
  else
    echo "OK:   $path ($actual files)"
  fi
done

# .upstream-version should match frozen SHA
actual_sha="$(cat .upstream-version)"
if [[ "$actual_sha" != "$FROZEN_SHA" ]]; then
  echo "FAIL: .upstream-version is $actual_sha, expected $FROZEN_SHA"
  failed=1
fi

if ! grep -q "$FROZEN_SHA" NOTICE; then
  echo "FAIL: NOTICE was not updated with frozen SHA"
  failed=1
else
  echo "OK:   NOTICE updated with $FROZEN_SHA"
fi

exit "$failed"
