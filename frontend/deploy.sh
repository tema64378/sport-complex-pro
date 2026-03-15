#!/usr/bin/env bash
set -euo pipefail

# Frontend deploy wrapper:
# Uses Rust-only backend deploy script from ../backend/deploy.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT_DIR/backend/deploy.sh" "$@"
