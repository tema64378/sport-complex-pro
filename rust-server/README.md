# Rust API (Axum + SQLite)

## Quick start

1. Install Rust toolchain:
   - macOS/Linux: `curl https://sh.rustup.rs -sSf | sh`
2. Start API:
   - from repo root: `npm run api:dev`
3. Start frontend:
   - from repo root: `npm run dev`

## Environment

- `PORT` (default: `4000`)
- `RUST_DB_PATH` (default: `data.db` in `rust-server/`)
- `RUST_BACKUP_DIR` (default: `backups` in `rust-server/`)
- `RUST_BACKUP_KEEP` (default: `14`, how many latest backups to keep)

Vite proxy is configured to forward `/api` to `http://localhost:4000`.

## Included DB upgrades

- Passwords are stored as Argon2 hashes.
- Versioned migrations are tracked in `schema_migrations`.
- Indexes are created for frequent API queries.
- Integrity checks are enforced via SQLite triggers.
- Daily SQLite backups are created automatically with rotation.
