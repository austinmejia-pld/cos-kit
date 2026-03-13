#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

INPUT_SCHEMA="$REPO_ROOT/skills/meeting-risk-analysis/schemas/input.schema.json"
OUTPUT_SCHEMA="$REPO_ROOT/skills/meeting-risk-analysis/schemas/output.schema.json"
SAMPLE_INPUT="$REPO_ROOT/skills/meeting-risk-analysis/examples/sample-input.json"
SAMPLE_OUTPUT="$REPO_ROOT/skills/meeting-risk-analysis/examples/sample-output.json"

if ! command -v ajv &>/dev/null; then
  echo "ERROR: ajv CLI not found."
  echo ""
  echo "Install it with:"
  echo "  npm install -g ajv-cli"
  echo ""
  echo "Then re-run:"
  echo "  bash scripts/validate-meeting-risk-analysis.sh"
  exit 1
fi

echo "ajv CLI found"
echo ""

PASS=0
FAIL=0

run_validation() {
  local label="$1"
  local schema="$2"
  local data="$3"

  echo "Validating: $label"
  if ajv validate -s "$schema" -d "$data" --spec=draft7 --validate-formats=false 2>&1; then
    echo "  PASS: $label"
    ((PASS++))
  else
    echo "  FAIL: $label"
    ((FAIL++))
  fi
  echo ""
}

run_validation "sample-input.json  → input.schema.json"  "$INPUT_SCHEMA"  "$SAMPLE_INPUT"
run_validation "sample-output.json → output.schema.json" "$OUTPUT_SCHEMA" "$SAMPLE_OUTPUT"

echo "----------------------------------------"
echo "Results: $PASS passed, $FAIL failed"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
