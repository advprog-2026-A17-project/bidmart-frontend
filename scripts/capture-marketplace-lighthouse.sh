#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://localhost:5173/}"
OUT_DIR="${2:-artifacts}"
NAME="${3:-lighthouse-marketplace-home}"

mkdir -p "${OUT_DIR}"

npx lighthouse "${URL}" \
  --quiet \
  --chrome-flags="--headless=new" \
  --output=json \
  --output=html \
  --output-path="${OUT_DIR}/${NAME}"

echo "Wrote ${OUT_DIR}/${NAME}.report.json and ${OUT_DIR}/${NAME}.report.html"
