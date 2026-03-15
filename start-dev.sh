#!/bin/bash
set -e

if [ -n "${BASH_SOURCE[0]:-}" ]; then
  SCRIPT_PATH="${BASH_SOURCE[0]}"
else
  SCRIPT_PATH="$0"
fi
ROOT="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Запуск Sport Complex Pro (локально)...${NC}"

pkill -f "sport-complex-pro-rust-api" 2>/dev/null || true
pkill -f "cargo run" 2>/dev/null || true
sleep 1

echo -e "${YELLOW}📦 Подготавливаю Rust API (backend)...${NC}"
mkdir -p "$ROOT/backend/logs"
cd "$ROOT/backend"

BUILD_LOG="$ROOT/backend/logs/build.log"
echo "(building backend, logs -> $BUILD_LOG)"
cargo build 2>&1 | tee "$BUILD_LOG"

API_LOG="$ROOT/backend/logs/api.log"
echo "(starting API binary, output -> $API_LOG)"
nohup env RUST_LOG=debug ./target/debug/sport-complex-pro-rust-api > "$API_LOG" 2>&1 &
API_PID=$!

sleep 0.5

echo -e "${YELLOW}⏳ Ожидаю готовности API (http://localhost:4000/api/ping)...${NC}"
for i in {1..30}; do
  if curl -s http://localhost:4000/api/ping >/dev/null 2>&1; then
    echo -e "${GREEN}✅ API готов (прошло ${i}s)${NC}"
    break
  fi
  sleep 1
done

if ! curl -s http://localhost:4000/api/ping >/dev/null 2>&1; then
  echo -e "\n❌ API не ответил. Фрагмент логов:\n"
  head -n 200 "$ROOT/backend/logs/api.log" || true
  kill $API_PID 2>/dev/null || true
  exit 1
fi

echo -e "${YELLOW}⚛️  Запускаю фронтенд (frontend)...${NC}"
cd "$ROOT/frontend"
mkdir -p "$ROOT/frontend/logs"

if [ ! -d "node_modules" ]; then
  echo "📥 Устанавливаю npm зависимости..."
  npm install
fi

npm run dev > "$ROOT/frontend/logs/vite.log" 2>&1 &
FRONT_PID=$!

sleep 1

echo -e "\n${GREEN}✅ Готово:${NC}"
echo -e "  ${BLUE}API:${NC}      http://localhost:4000"
echo -e "  ${BLUE}Frontend:${NC} http://localhost:3000 (или 3001, если порт занят)"

echo -e "\nЛоги:"
echo -e "  API:      $ROOT/backend/logs/api.log"
echo -e "  Frontend: $ROOT/frontend/logs/vite.log"

echo -e "\nНажмите Ctrl+C чтобы остановить"

cleanup() {
  echo -e "\n🛑 Останавливаю процессы..."
  kill $API_PID $FRONT_PID 2>/dev/null || true
  wait 2>/dev/null || true
  echo "✅ Остановлено"
  exit 0
}
trap cleanup INT TERM

wait
