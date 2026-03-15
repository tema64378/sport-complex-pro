#!/bin/bash
# Локальный запуск только Rust API

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Запуск Rust API сервера..."
echo "📦 API: http://localhost:4000"

cd "$PROJECT_ROOT/backend"
cargo run
