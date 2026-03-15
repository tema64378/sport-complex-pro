# Локальный запуск (аккуратная структура)

Проект разделен на:
- `frontend/` — React + Vite
- `backend/` — Rust API (Axum + SQLite)

## 1) Запуск только API (Rust)

```bash
cd /Users/akovlevartem/Documents/курсовая/backend
cargo run
```

API: `http://localhost:4000/api/ping`

## 2) Запуск только фронтенда

```bash
cd /Users/akovlevartem/Documents/курсовая/frontend
npm run dev
```

Frontend: `http://localhost:3000` (или `3001`, если порт занят)

## 3) Полный локальный запуск (API + Frontend)

```bash
cd /Users/akovlevartem/Documents/курсовая
bash start-dev.sh
```

## 4) Продакшен-сборка для проверки

```bash
cd /Users/akovlevartem/Documents/курсовая/frontend
npm run build

cd ../backend
cargo build --release
```
