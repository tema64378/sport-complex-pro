# Sport Complex Pro

Проект приведен к чистой структуре для демонстрации:

- `frontend/` — интерфейс (React + Vite)
- `backend/` — API (Rust + Axum + SQLite)

## Быстрый запуск

```bash
cd /Users/akovlevartem/Documents/курсовая
bash start-dev.sh
```

## Запуск по отдельности

### Frontend
```bash
cd frontend
npm run dev
```

### Backend
```bash
cd backend
cargo run
```

## Важно

- Node.js используется только для сборки/запуска фронтенда.
- Бэкенд работает только на Rust и SQLite.
- Node.js backend (`server/`) в рабочей структуре больше не используется.
