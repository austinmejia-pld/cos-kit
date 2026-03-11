#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-../cos-kit-template-export}"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

rsync -av \
--exclude '.git' \
--exclude 'memory' \
--exclude 'state' \
--exclude 'logs' \
--exclude 'cache' \
--exclude '.tokens' \
--exclude '.secrets' \
--exclude '.env*' \
--exclude '*.db' \
--exclude '*.sqlite*' \
./ "$OUT_DIR/"

echo "Exported sanitized template to: $OUT_DIR"
