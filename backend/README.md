# Backend (Rust + SQLite)

Локальный API для Sport Complex Pro.

## Состав

- `src/main.rs` — сервер Axum
- `data.db` — база SQLite
- `logs/` — логи
- `backups/` — резервные копии

## Запуск

```bash
cd /Users/akovlevartem/Documents/курсовая/backend
cargo run
```

Порт по умолчанию: `4000`.

## Проверка

```bash
curl http://localhost:4000/api/ping
```

## Переменные окружения

- `PORT` — порт API (по умолчанию `4000`)
- `RUST_DB_PATH` — путь к SQLite (по умолчанию `./data.db`)
- `RUST_BACKUP_DIR` — каталог бэкапов (по умолчанию `./backups`)
- `RUST_BACKUP_KEEP` — срок хранения бэкапов в днях (по умолчанию `14`)
