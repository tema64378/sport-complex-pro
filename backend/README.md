# Rust API (Axum + SQLite)

Бэкенд проекта теперь только на Rust.

## Структура

- `backend/src/main.rs` — API
- `backend/data.db` — SQLite база
- `backend/backups/` — резервные копии
- `backend/logs/` — логи запуска

## Быстрый старт

```bash
cd /Users/akovlevartem/Documents/курсовая/backend
cargo run
```

API healthcheck:

```bash
curl http://localhost:4000/api/ping
```

## Переменные окружения

- `PORT` (по умолчанию `4000`)
- `RUST_DB_PATH` (по умолчанию `data.db`)
- `RUST_BACKUP_DIR` (по умолчанию `backups`)
- `RUST_BACKUP_KEEP` (по умолчанию `14`)
