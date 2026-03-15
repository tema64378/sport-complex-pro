#!/bin/bash
# Quick start: запуск только Rust API

set -e
cd "$(dirname "$0")"

command -v cargo >/dev/null || { echo "❌ Требуется Rust. Установите: https://rustup.rs/"; exit 1; }

echo "🚀 Запуск Sport Complex Pro (Rust API)..."
cd backend
cargo run
