# Sport Complex Pro (локальная версия)

Проект подготовлен для локального показа комиссии.

## Структура

- `frontend/` — интерфейс (React + Vite)
- `backend/` — API (Rust + Axum + SQLite)
- `start-dev.sh` — запуск frontend + backend
- `start.sh` — запуск только backend

## Требования

- Node.js 20+
- npm
- Rust (cargo)

## Быстрый запуск

```bash
cd /Users/akovlevartem/Documents/курсовая
bash start-dev.sh
```

Откроются сервисы:
- Frontend: `http://localhost:3000`
- API: `http://localhost:4000`

## Ручной запуск

Терминал 1 (backend):

```bash
cd /Users/akovlevartem/Documents/курсовая/backend
cargo run
```

Терминал 2 (frontend):

```bash
cd /Users/akovlevartem/Documents/курсовая/frontend
npm install
npm run dev
```

## Проверка API

```bash
curl http://localhost:4000/api/ping
```

Ожидаемый ответ:

```json
{"message":"Fitness Management API","status":"running","version":"3.0.0-rust"}
```

## Важно

- Бэкенд только на Rust.
- База данных только SQLite (`backend/data.db`).
- В проекте нет привязки к внешнему серверу/домену.
- Node.js используется только для frontend.

## Полезные команды

Сборка frontend:

```bash
cd /Users/akovlevartem/Documents/курсовая/frontend
npm run build
```

Проверка backend:

```bash
cd /Users/akovlevartem/Documents/курсовая/backend
cargo check
```
