#!/usr/bin/env bash
set -euo pipefail

mkdir -p memory/interviews state logs cache .tokens .secrets

for f in USER MEMORY TOOLS; do
if [[ ! -f "${f}.md" && -f "templates/${f}.template.md" ]]; then
cp "templates/${f}.template.md" "${f}.md"
fi
done

echo "Bootstrap complete."
echo "Next: fill USER.md and MEMORY.md, then commit."
