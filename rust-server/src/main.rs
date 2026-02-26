use axum::{
    extract::{Path, Query, State},
    http::{
        header::{AUTHORIZATION, CONTENT_DISPOSITION, CONTENT_TYPE},
        HeaderMap, HeaderValue, StatusCode,
    },
    response::{IntoResponse, Redirect, Response},
    routing::{delete, get, patch, post, put},
    Json, Router,
};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{
    DateTime, Datelike, Duration as ChronoDuration, Local, NaiveDate, NaiveDateTime, TimeZone, Utc,
};
use rusqlite::{params, types::ValueRef, Connection, OptionalExtension, ToSql};
use rand_core::OsRng;
use serde_json::{json, Map, Number, Value};
use std::{
    collections::{BTreeMap, HashMap},
    env,
    fs,
    path::PathBuf,
    sync::{Arc, Mutex, MutexGuard},
    time::Duration,
};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    db: Arc<Mutex<Connection>>,
}

#[derive(Clone, Debug)]
struct AuthedUser {
    id: i64,
    name: String,
    email: String,
    phone: String,
    role: String,
    token: String,
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let body = Json(json!({ "error": self.message }));
        (self.status, body).into_response()
    }
}

type ApiResult<T> = Result<T, ApiError>;

fn map_db_write_error(err: rusqlite::Error, fallback: &str) -> ApiError {
    match err {
        rusqlite::Error::SqliteFailure(_, maybe_msg) => {
            if let Some(msg) = maybe_msg {
                let lowered = msg.to_lowercase();
                if lowered.contains("constraint")
                    || lowered.contains("references missing")
                    || lowered.contains("must be >=")
                    || lowered.contains("must be")
                {
                    return ApiError::new(StatusCode::BAD_REQUEST, msg);
                }
            }
            ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, fallback)
        }
        _ => ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, fallback),
    }
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn now_date() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn now_datetime_short() -> String {
    Local::now().format("%Y-%m-%d %H:%M").to_string()
}

fn expires_in_7_days_iso() -> String {
    (Utc::now() + ChronoDuration::days(7)).to_rfc3339()
}

fn generate_token() -> String {
    Uuid::new_v4().simple().to_string()
}

fn is_argon2_hash(value: &str) -> bool {
    value.starts_with("$argon2")
}

fn hash_password_raw(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    Ok(Argon2::default()
        .hash_password(password.as_bytes(), &salt)?
        .to_string())
}

fn hash_password_api(password: &str) -> ApiResult<String> {
    hash_password_raw(password)
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Password hashing failed"))
}

fn verify_password(password: &str, stored: &str) -> bool {
    if is_argon2_hash(stored) {
        return PasswordHash::new(stored)
            .ok()
            .and_then(|hash| {
                Argon2::default()
                    .verify_password(password.as_bytes(), &hash)
                    .ok()
            })
            .is_some();
    }
    stored == password
}

fn needs_password_upgrade(stored: &str) -> bool {
    !is_argon2_hash(stored)
}

fn email_needs_update(email: &str) -> bool {
    let lowered = email.trim().to_lowercase();
    lowered.is_empty() || lowered.ends_with("@vk.local") || lowered == "vk_demo@vk.com"
}

fn looks_like_email(email: &str) -> bool {
    let value = email.trim();
    if value.is_empty() || value.contains(' ') {
        return false;
    }
    let (local, domain) = match value.split_once('@') {
        Some(parts) => parts,
        None => return false,
    };
    if local.is_empty() || domain.is_empty() {
        return false;
    }
    if domain.starts_with('.') || domain.ends_with('.') || !domain.contains('.') {
        return false;
    }
    true
}

fn to_json_value(v: ValueRef<'_>) -> Value {
    match v {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => Value::Number(Number::from(i)),
        ValueRef::Real(f) => Number::from_f64(f)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        ValueRef::Text(bytes) => Value::String(String::from_utf8_lossy(bytes).to_string()),
        ValueRef::Blob(bytes) => Value::String(format!("<blob:{}>", bytes.len())),
    }
}

fn query_rows(conn: &Connection, sql: &str, params: &[&dyn ToSql]) -> rusqlite::Result<Vec<Value>> {
    let mut stmt = conn.prepare(sql)?;
    let columns: Vec<String> = stmt
        .column_names()
        .iter()
        .map(|name| name.to_string())
        .collect();
    let mut rows = stmt.query(params)?;
    let mut out = Vec::new();
    while let Some(row) = rows.next()? {
        let mut map = Map::new();
        for (idx, col) in columns.iter().enumerate() {
            let value = row.get_ref(idx)?;
            map.insert(col.clone(), to_json_value(value));
        }
        out.push(Value::Object(map));
    }
    Ok(out)
}

fn query_one(conn: &Connection, sql: &str, params: &[&dyn ToSql]) -> rusqlite::Result<Option<Value>> {
    Ok(query_rows(conn, sql, params)?.into_iter().next())
}

fn value_string(v: &Value, key: &str) -> String {
    v.get(key)
        .and_then(|x| x.as_str().map(|s| s.to_string()))
        .or_else(|| {
            v.get(key).and_then(|x| {
                if x.is_number() || x.is_boolean() {
                    Some(x.to_string())
                } else {
                    None
                }
            })
        })
        .unwrap_or_default()
}

fn value_i64(v: &Value, key: &str) -> i64 {
    if let Some(n) = v.get(key).and_then(Value::as_i64) {
        return n;
    }
    if let Some(s) = v.get(key).and_then(Value::as_str) {
        return s.parse::<i64>().unwrap_or(0);
    }
    0
}

fn value_bool(v: &Value, key: &str) -> bool {
    if let Some(b) = v.get(key).and_then(Value::as_bool) {
        return b;
    }
    if let Some(n) = v.get(key).and_then(Value::as_i64) {
        return n != 0;
    }
    if let Some(s) = v.get(key).and_then(Value::as_str) {
        return matches!(s.to_lowercase().as_str(), "1" | "true" | "yes");
    }
    false
}

fn body_string(body: &Value, key: &str, default: &str) -> String {
    body.get(key)
        .and_then(|x| x.as_str().map(|s| s.to_string()))
        .or_else(|| {
            body.get(key).and_then(|x| {
                if x.is_number() || x.is_boolean() {
                    Some(x.to_string())
                } else {
                    None
                }
            })
        })
        .unwrap_or_else(|| default.to_string())
}

fn body_opt_string(body: &Value, key: &str) -> Option<String> {
    let value = body
        .get(key)
        .and_then(|x| x.as_str().map(|s| s.to_string()))
        .or_else(|| {
            body.get(key).and_then(|x| {
                if x.is_number() || x.is_boolean() {
                    Some(x.to_string())
                } else {
                    None
                }
            })
        });
    value.and_then(|s| {
        let trimmed = s.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn body_i64(body: &Value, key: &str, default: i64) -> i64 {
    if let Some(n) = body.get(key).and_then(Value::as_i64) {
        return n;
    }
    if let Some(s) = body.get(key).and_then(Value::as_str) {
        return s.parse::<i64>().unwrap_or(default);
    }
    default
}

fn body_f64(body: &Value, key: &str, default: f64) -> f64 {
    if let Some(n) = body.get(key).and_then(Value::as_f64) {
        return n;
    }
    if let Some(s) = body.get(key).and_then(Value::as_str) {
        return s.parse::<f64>().unwrap_or(default);
    }
    default
}

fn parse_date(value: &str) -> Option<NaiveDate> {
    if let Ok(d) = NaiveDate::parse_from_str(value, "%Y-%m-%d") {
        return Some(d);
    }
    if let Ok(dt) = NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M") {
        return Some(dt.date());
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(value) {
        return Some(dt.naive_local().date());
    }
    None
}

fn parse_date_time(date: &str, time: &str) -> Option<NaiveDateTime> {
    let composed = format!("{} {}", date, if time.is_empty() { "00:00" } else { time });
    if let Ok(dt) = NaiveDateTime::parse_from_str(&composed, "%Y-%m-%d %H:%M") {
        return Some(dt);
    }
    if let Ok(dt) = NaiveDateTime::parse_from_str(&composed, "%Y-%m-%d %H:%M:%S") {
        return Some(dt);
    }
    None
}

fn is_expired(value: &str) -> bool {
    if let Ok(dt) = DateTime::parse_from_rfc3339(value) {
        return dt.with_timezone(&Utc) < Utc::now();
    }
    if let Ok(dt) = NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S") {
        if let Some(local_dt) = Local.from_local_datetime(&dt).single() {
            return local_dt.with_timezone(&Utc) < Utc::now();
        }
    }
    false
}

fn month_key(date: NaiveDate) -> String {
    format!("{}-{:02}", date.year(), date.month())
}

fn month_label(date: NaiveDate) -> String {
    let labels = [
        "Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
    ];
    labels[(date.month0()) as usize].to_string()
}

fn last_months(count: usize) -> Vec<NaiveDate> {
    let today = Local::now().date_naive();
    let mut year = today.year();
    let mut month = today.month() as i32;
    let mut months = Vec::new();
    for _ in 0..count {
        if let Some(d) = NaiveDate::from_ymd_opt(year, month as u32, 1) {
            months.push(d);
        }
        month -= 1;
        if month == 0 {
            month = 12;
            year -= 1;
        }
    }
    months.reverse();
    months
}

fn format_rub(value: i64) -> String {
    let mut s = value.abs().to_string();
    let mut parts = Vec::new();
    while s.len() > 3 {
        let suffix = s.split_off(s.len() - 3);
        parts.push(suffix);
    }
    if !s.is_empty() {
        parts.push(s);
    }
    parts.reverse();
    let mut rendered = parts.join(" ");
    if value < 0 {
        rendered = format!("-{}", rendered);
    }
    rendered
}

fn lock_db(state: &AppState) -> ApiResult<MutexGuard<'_, Connection>> {
    state
        .db
        .lock()
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "DB lock error"))
}

fn auth_user(headers: &HeaderMap, state: &AppState) -> ApiResult<AuthedUser> {
    let token = headers
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .map(|s| s.to_string())
        .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "Unauthorized"))?;

    let conn = lock_db(state)?;
    let mut stmt = conn
        .prepare(
            "SELECT s.token, s.expiresAt, u.id, u.name, u.email, u.phone, u.role
             FROM sessions s
             JOIN users u ON s.userId = u.id
             WHERE s.token = ?1",
        )
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Auth error"))?;

    let row = stmt
        .query_row(params![token], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                row.get::<_, String>(6)?,
            ))
        })
        .optional()
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Auth error"))?;

    let (token, expires_at, id, name, email, phone, role) =
        row.ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "Unauthorized"))?;

    if let Some(exp) = expires_at {
        if is_expired(&exp) {
            return Err(ApiError::new(StatusCode::UNAUTHORIZED, "Session expired"));
        }
    }

    Ok(AuthedUser {
        id,
        name,
        email,
        phone,
        role,
        token,
    })
}

fn require_roles(user: &AuthedUser, roles: &[&str]) -> ApiResult<()> {
    if roles.iter().any(|role| *role == user.role) {
        Ok(())
    } else {
        Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"))
    }
}

fn table_count(conn: &Connection, table: &str) -> rusqlite::Result<i64> {
    let sql = format!("SELECT COUNT(*) FROM {}", table);
    conn.query_row(&sql, [], |row| row.get(0))
}

fn ensure_migrations_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );",
    )
}

fn migration_exists(conn: &Connection, version: i64) -> rusqlite::Result<bool> {
    let exists: Option<i64> = conn
        .query_row(
            "SELECT version FROM schema_migrations WHERE version = ?1 LIMIT 1",
            params![version],
            |row| row.get(0),
        )
        .optional()?;
    Ok(exists.is_some())
}

fn apply_migration<F>(
    conn: &Connection,
    version: i64,
    name: &str,
    migration: F,
) -> rusqlite::Result<()>
where
    F: FnOnce(&Connection) -> rusqlite::Result<()>,
{
    if migration_exists(conn, version)? {
        return Ok(());
    }

    migration(conn)?;
    conn.execute(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
        params![version, name, now_iso()],
    )?;
    Ok(())
}

fn migrate_v2_hash_existing_passwords(conn: &Connection) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare("SELECT id, password FROM users")?;
    let users = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<String>>(1)?.unwrap_or_default(),
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    for (id, password) in users {
        if password.is_empty() || is_argon2_hash(&password) {
            continue;
        }
        if let Ok(hashed) = hash_password_raw(&password) {
            conn.execute(
                "UPDATE users SET password = ?1 WHERE id = ?2",
                params![hashed, id],
            )?;
        }
    }
    Ok(())
}

fn migrate_v3_create_indexes(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(userId);

        CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
        CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
        CREATE INDEX IF NOT EXISTS idx_members_membership ON members(membership);

        CREATE INDEX IF NOT EXISTS idx_bookings_member ON bookings(member);
        CREATE INDEX IF NOT EXISTS idx_bookings_class_id ON bookings(classId);
        CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
        CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

        CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member);
        CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
        CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
        CREATE INDEX IF NOT EXISTS idx_payments_receipt_id ON payments(receiptId);

        CREATE INDEX IF NOT EXISTS idx_notifications_ref ON notifications(refType, refId);
        CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(createdAt);

        CREATE INDEX IF NOT EXISTS idx_receipts_member_id ON receipts(memberId);
        CREATE INDEX IF NOT EXISTS idx_receipts_created ON receipts(createdAt);

        CREATE INDEX IF NOT EXISTS idx_crm_notes_member_id ON crm_notes(memberId);
        CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
        CREATE INDEX IF NOT EXISTS idx_deals_manager ON deals(manager);
        ",
    )
}

fn migrate_v4_integrity_triggers(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        DROP TRIGGER IF EXISTS trg_sessions_user_fk_insert;
        DROP TRIGGER IF EXISTS trg_sessions_user_fk_update;
        DROP TRIGGER IF EXISTS trg_classes_trainer_fk_insert;
        DROP TRIGGER IF EXISTS trg_classes_trainer_fk_update;
        DROP TRIGGER IF EXISTS trg_bookings_class_fk_insert;
        DROP TRIGGER IF EXISTS trg_bookings_class_fk_update;
        DROP TRIGGER IF EXISTS trg_payments_receipt_fk_insert;
        DROP TRIGGER IF EXISTS trg_payments_receipt_fk_update;
        DROP TRIGGER IF EXISTS trg_crm_notes_member_fk_insert;
        DROP TRIGGER IF EXISTS trg_crm_notes_member_fk_update;
        DROP TRIGGER IF EXISTS trg_receipts_member_fk_insert;
        DROP TRIGGER IF EXISTS trg_receipts_member_fk_update;
        DROP TRIGGER IF EXISTS trg_payments_amount_insert;
        DROP TRIGGER IF EXISTS trg_payments_amount_update;

        CREATE TRIGGER trg_sessions_user_fk_insert
        BEFORE INSERT ON sessions
        FOR EACH ROW
        WHEN NEW.userId IS NULL OR NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.userId)
        BEGIN
            SELECT RAISE(ABORT, 'sessions.userId references missing user');
        END;

        CREATE TRIGGER trg_sessions_user_fk_update
        BEFORE UPDATE OF userId ON sessions
        FOR EACH ROW
        WHEN NEW.userId IS NULL OR NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.userId)
        BEGIN
            SELECT RAISE(ABORT, 'sessions.userId references missing user');
        END;

        CREATE TRIGGER trg_classes_trainer_fk_insert
        BEFORE INSERT ON classes
        FOR EACH ROW
        WHEN NEW.trainerId IS NOT NULL
             AND NEW.trainerId != 0
             AND NOT EXISTS (SELECT 1 FROM trainers WHERE id = NEW.trainerId)
        BEGIN
            SELECT RAISE(ABORT, 'classes.trainerId references missing trainer');
        END;

        CREATE TRIGGER trg_classes_trainer_fk_update
        BEFORE UPDATE OF trainerId ON classes
        FOR EACH ROW
        WHEN NEW.trainerId IS NOT NULL
             AND NEW.trainerId != 0
             AND NOT EXISTS (SELECT 1 FROM trainers WHERE id = NEW.trainerId)
        BEGIN
            SELECT RAISE(ABORT, 'classes.trainerId references missing trainer');
        END;

        CREATE TRIGGER trg_bookings_class_fk_insert
        BEFORE INSERT ON bookings
        FOR EACH ROW
        WHEN NEW.classId IS NOT NULL
             AND NEW.classId != 0
             AND NOT EXISTS (SELECT 1 FROM classes WHERE id = NEW.classId)
        BEGIN
            SELECT RAISE(ABORT, 'bookings.classId references missing class');
        END;

        CREATE TRIGGER trg_bookings_class_fk_update
        BEFORE UPDATE OF classId ON bookings
        FOR EACH ROW
        WHEN NEW.classId IS NOT NULL
             AND NEW.classId != 0
             AND NOT EXISTS (SELECT 1 FROM classes WHERE id = NEW.classId)
        BEGIN
            SELECT RAISE(ABORT, 'bookings.classId references missing class');
        END;

        CREATE TRIGGER trg_payments_receipt_fk_insert
        BEFORE INSERT ON payments
        FOR EACH ROW
        WHEN NEW.receiptId IS NOT NULL
             AND NEW.receiptId != 0
             AND NOT EXISTS (SELECT 1 FROM receipts WHERE id = NEW.receiptId)
        BEGIN
            SELECT RAISE(ABORT, 'payments.receiptId references missing receipt');
        END;

        CREATE TRIGGER trg_payments_receipt_fk_update
        BEFORE UPDATE OF receiptId ON payments
        FOR EACH ROW
        WHEN NEW.receiptId IS NOT NULL
             AND NEW.receiptId != 0
             AND NOT EXISTS (SELECT 1 FROM receipts WHERE id = NEW.receiptId)
        BEGIN
            SELECT RAISE(ABORT, 'payments.receiptId references missing receipt');
        END;

        CREATE TRIGGER trg_crm_notes_member_fk_insert
        BEFORE INSERT ON crm_notes
        FOR EACH ROW
        WHEN NEW.memberId IS NULL
             OR NOT EXISTS (SELECT 1 FROM members WHERE id = NEW.memberId)
        BEGIN
            SELECT RAISE(ABORT, 'crm_notes.memberId references missing member');
        END;

        CREATE TRIGGER trg_crm_notes_member_fk_update
        BEFORE UPDATE OF memberId ON crm_notes
        FOR EACH ROW
        WHEN NEW.memberId IS NULL
             OR NOT EXISTS (SELECT 1 FROM members WHERE id = NEW.memberId)
        BEGIN
            SELECT RAISE(ABORT, 'crm_notes.memberId references missing member');
        END;

        CREATE TRIGGER trg_receipts_member_fk_insert
        BEFORE INSERT ON receipts
        FOR EACH ROW
        WHEN NEW.memberId IS NULL
             OR NEW.memberId = 0
             OR NOT EXISTS (SELECT 1 FROM members WHERE id = NEW.memberId)
        BEGIN
            SELECT RAISE(ABORT, 'receipts.memberId references missing member');
        END;

        CREATE TRIGGER trg_receipts_member_fk_update
        BEFORE UPDATE OF memberId ON receipts
        FOR EACH ROW
        WHEN NEW.memberId IS NULL
             OR NEW.memberId = 0
             OR NOT EXISTS (SELECT 1 FROM members WHERE id = NEW.memberId)
        BEGIN
            SELECT RAISE(ABORT, 'receipts.memberId references missing member');
        END;

        CREATE TRIGGER trg_payments_amount_insert
        BEFORE INSERT ON payments
        FOR EACH ROW
        WHEN NEW.amount IS NULL OR NEW.amount < 0
        BEGIN
            SELECT RAISE(ABORT, 'payments.amount must be >= 0');
        END;

        CREATE TRIGGER trg_payments_amount_update
        BEFORE UPDATE OF amount ON payments
        FOR EACH ROW
        WHEN NEW.amount IS NULL OR NEW.amount < 0
        BEGIN
            SELECT RAISE(ABORT, 'payments.amount must be >= 0');
        END;
        ",
    )
}

fn migrate_v5_vk_accounts(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS vk_accounts (
          vkUserId TEXT PRIMARY KEY,
          userId INTEGER NOT NULL UNIQUE,
          profileJson TEXT NOT NULL DEFAULT '{}',
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_vk_accounts_user_id ON vk_accounts(userId);
        ",
    )
}

fn run_sqlite_backup(
    conn: &Connection,
    backup_dir: &str,
    keep_last: usize,
) -> Result<PathBuf, String> {
    fs::create_dir_all(backup_dir).map_err(|e| format!("backup mkdir failed: {}", e))?;
    let backup_file = PathBuf::from(backup_dir).join(format!(
        "backup_{}.db",
        Local::now().format("%Y%m%d_%H%M%S")
    ));
    let escaped_path = backup_file.to_string_lossy().replace('\'', "''");
    let vacuum_sql = format!("VACUUM INTO '{}';", escaped_path);
    conn.execute_batch(&vacuum_sql)
        .map_err(|e| format!("backup vacuum failed: {}", e))?;

    let mut backups = fs::read_dir(backup_dir)
        .map_err(|e| format!("backup list failed: {}", e))?
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| {
            path.file_name()
                .and_then(|s| s.to_str())
                .map(|name| name.starts_with("backup_") && name.ends_with(".db"))
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();

    backups.sort();
    if keep_last > 0 && backups.len() > keep_last {
        for old in backups.iter().take(backups.len() - keep_last) {
            let _ = fs::remove_file(old);
        }
    }

    Ok(backup_file)
}

fn ensure_notification(
    conn: &Connection,
    ntype: &str,
    title: &str,
    message: &str,
    ref_type: &str,
    ref_id: &str,
) -> rusqlite::Result<()> {
    let exists: Option<i64> = conn
        .query_row(
            "SELECT id FROM notifications WHERE refType = ?1 AND refId = ?2 LIMIT 1",
            params![ref_type, ref_id],
            |row| row.get(0),
        )
        .optional()?;
    if exists.is_some() {
        return Ok(());
    }

    conn.execute(
        "INSERT INTO notifications (type,title,message,createdAt,isRead,refType,refId)
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)",
        params![ntype, title, message, now_datetime_short(), ref_type, ref_id],
    )?;

    Ok(())
}

fn generate_notifications(conn: &Connection) -> rusqlite::Result<()> {
    let today = Local::now().date_naive();
    let now = Local::now().naive_local();

    {
        let mut stmt = conn.prepare("SELECT id, member, amount, date, status FROM payments")?;
        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let id: i64 = row.get(0)?;
            let member: String = row.get::<_, Option<String>>(1)?.unwrap_or_default();
            let amount: i64 = row.get::<_, Option<i64>>(2)?.unwrap_or(0);
            let date: String = row.get::<_, Option<String>>(3)?.unwrap_or_default();
            let status: String = row.get::<_, Option<String>>(4)?.unwrap_or_default();

            if status.to_lowercase() == "оплачен" {
                continue;
            }
            if let Some(pay_date) = parse_date(&date) {
                if pay_date < today {
                    let msg = format!(
                        "Клиент {}: счёт на {} ₽ просрочен",
                        member,
                        format_rub(amount)
                    );
                    ensure_notification(
                        conn,
                        "Оплата",
                        "Просрочен платёж",
                        &msg,
                        "payment",
                        &id.to_string(),
                    )?;
                }
            }
        }
    }

    {
        let mut stmt = conn.prepare("SELECT id, className, date, time, status FROM bookings")?;
        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let id: i64 = row.get(0)?;
            let class_name: String = row.get::<_, Option<String>>(1)?.unwrap_or_default();
            let date: String = row.get::<_, Option<String>>(2)?.unwrap_or_default();
            let time: String = row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "00:00".to_string());
            let status: String = row.get::<_, Option<String>>(4)?.unwrap_or_default();

            if status.to_lowercase() != "подтверждено" {
                continue;
            }

            if let Some(slot_dt) = parse_date_time(&date, &time) {
                let diff = slot_dt - now;
                let minutes = diff.num_minutes();
                if (1..=120).contains(&minutes) {
                    let msg = format!("Тренировка \"{}\" через {} мин.", class_name, minutes);
                    ensure_notification(
                        conn,
                        "Тренировка",
                        "Напоминание",
                        &msg,
                        "booking",
                        &id.to_string(),
                    )?;
                }
            }
        }
    }

    Ok(())
}

fn recalculate_class_enrollment(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "UPDATE classes
         SET enrolled = (
            SELECT COUNT(*)
            FROM bookings b
            WHERE (COALESCE(b.classId, 0) = classes.id OR b.className = classes.name)
              AND COALESCE(b.status, '') IN ('Подтверждено', 'подтверждено', 'ПОДТВЕРЖДЕНО')
         );",
    )?;
    Ok(())
}

fn migrate_v1_base_schema_and_seed(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL DEFAULT '',
          membership TEXT NOT NULL,
          joinDate TEXT NOT NULL,
          status TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS trainers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          email TEXT,
          phone TEXT,
          specialty TEXT,
          experience TEXT,
          members INTEGER,
          rating REAL
        );

        CREATE TABLE IF NOT EXISTS classes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          trainerId INTEGER,
          trainerName TEXT NOT NULL DEFAULT '',
          schedule TEXT NOT NULL DEFAULT '',
          capacity INTEGER NOT NULL DEFAULT 0,
          enrolled INTEGER NOT NULL DEFAULT 0,
          level TEXT NOT NULL,
          FOREIGN KEY(trainerId) REFERENCES trainers(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          member TEXT NOT NULL,
          classId INTEGER,
          className TEXT NOT NULL,
          date TEXT NOT NULL,
          time TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Подтверждено',
          FOREIGN KEY(classId) REFERENCES classes(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          member TEXT NOT NULL,
          amount INTEGER NOT NULL CHECK(amount >= 0),
          method TEXT NOT NULL,
          date TEXT NOT NULL,
          status TEXT NOT NULL,
          receiptId INTEGER,
          provider TEXT,
          FOREIGN KEY(receiptId) REFERENCES receipts(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          phone TEXT NOT NULL DEFAULT '',
          role TEXT NOT NULL,
          password TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          token TEXT NOT NULL UNIQUE,
          createdAt TEXT NOT NULL,
          expiresAt TEXT NOT NULL,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS services (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          category TEXT,
          price INTEGER,
          unit TEXT,
          description TEXT
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT,
          title TEXT,
          message TEXT,
          createdAt TEXT,
          isRead INTEGER DEFAULT 0,
          refType TEXT,
          refId TEXT
        );

        CREATE TABLE IF NOT EXISTS membership_plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          price INTEGER,
          period TEXT,
          visits TEXT,
          perksJson TEXT
        );

        CREATE TABLE IF NOT EXISTS crm_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memberId INTEGER NOT NULL,
          text TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          FOREIGN KEY(memberId) REFERENCES members(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS calendar_slots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT,
          time TEXT,
          className TEXT,
          trainer TEXT,
          capacity INTEGER,
          booked INTEGER
        );

        CREATE TABLE IF NOT EXISTS receipts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memberId INTEGER NOT NULL,
          memberName TEXT NOT NULL,
          membership TEXT NOT NULL,
          itemsJson TEXT NOT NULL DEFAULT '[]',
          subtotal INTEGER NOT NULL DEFAULT 0 CHECK(subtotal >= 0),
          discount INTEGER NOT NULL DEFAULT 0 CHECK(discount >= 0),
          total INTEGER NOT NULL DEFAULT 0 CHECK(total >= 0),
          createdAt TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          paymentId INTEGER
          ,
          FOREIGN KEY(memberId) REFERENCES members(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS deals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client TEXT,
          offer TEXT,
          value INTEGER,
          stage TEXT,
          probability INTEGER,
          manager TEXT,
          nextStep TEXT,
          date TEXT
        );

        CREATE TABLE IF NOT EXISTS demand_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          month TEXT,
          visits INTEGER,
          pool INTEGER,
          tennis INTEGER
        );

        CREATE TABLE IF NOT EXISTS workout_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          description TEXT,
          category TEXT,
          level TEXT,
          duration INTEGER,
          defaultCapacity INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        ",
    )?;

    if table_count(conn, "members")? == 0 {
        conn.execute(
            "INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                "Мария Иванова",
                "maria.ivanova@mail.ru",
                "+7 (910) 111-01-01",
                "Премиум",
                "2023-01-15",
                "Активный"
            ],
        )?;
        conn.execute(
            "INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                "Сергей Кузнецов",
                "sergey.kuznetsov@mail.ru",
                "+7 (910) 111-02-02",
                "Стандарт",
                "2023-02-20",
                "Активный"
            ],
        )?;
    }

    if table_count(conn, "trainers")? == 0 {
        conn.execute(
            "INSERT INTO trainers (name,email,phone,specialty,experience,members,rating) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![
                "Светлана Смирнова",
                "svetlana.smirnova@mail.ru",
                "+7 (915) 200-01-01",
                "Йога",
                "8 лет",
                24,
                4.8
            ],
        )?;
        conn.execute(
            "INSERT INTO trainers (name,email,phone,specialty,experience,members,rating) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![
                "Иван Иванов",
                "ivan.ivanov@mail.ru",
                "+7 (915) 200-02-02",
                "Кроссфит",
                "6 лет",
                32,
                4.9
            ],
        )?;
    }

    if table_count(conn, "classes")? == 0 {
        conn.execute(
            "INSERT INTO classes (name,trainerId,trainerName,schedule,capacity,enrolled,level) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![
                "Йога для начинающих",
                1,
                "Светлана Смирнова",
                "вт, ср, пт - 09:00",
                20,
                18,
                "Начинающие"
            ],
        )?;
        conn.execute(
            "INSERT INTO classes (name,trainerId,trainerName,schedule,capacity,enrolled,level) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![
                "Кроссфит",
                2,
                "Иван Иванов",
                "Каждый день - 10:00",
                15,
                15,
                "Средние"
            ],
        )?;
    }

    if table_count(conn, "bookings")? == 0 {
        conn.execute(
            "INSERT INTO bookings (member,classId,className,date,time,status) VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                "Мария Иванова",
                1,
                "Йога для начинающих",
                "2024-01-29",
                "09:00",
                "Подтверждено"
            ],
        )?;
        conn.execute(
            "INSERT INTO bookings (member,classId,className,date,time,status) VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                "Сергей Кузнецов",
                2,
                "Кроссфит",
                "2024-01-29",
                "10:00",
                "Подтверждено"
            ],
        )?;
    }

    if table_count(conn, "payments")? == 0 {
        conn.execute(
            "INSERT INTO payments (member,amount,method,date,status) VALUES (?1,?2,?3,?4,?5)",
            params!["Мария Иванова", 9999, "Кредитная карта", "2024-01-28", "Оплачен"],
        )?;
        conn.execute(
            "INSERT INTO payments (member,amount,method,date,status) VALUES (?1,?2,?3,?4,?5)",
            params!["Сергей Кузнецов", 14999, "Банк перевод", "2024-01-27", "Оплачен"],
        )?;
    }

    if table_count(conn, "users")? == 0 {
        let admin_password = hash_password_raw("admin123").unwrap_or_else(|_| "admin123".to_string());
        let coach_password = hash_password_raw("coach123").unwrap_or_else(|_| "coach123".to_string());
        conn.execute(
            "INSERT INTO users (name,email,phone,role,password) VALUES (?1,?2,?3,?4,?5)",
            params![
                "Администратор",
                "admin@sportcomplex.com",
                "+7 (495) 123-45-67",
                "Администратор",
                admin_password
            ],
        )?;
        conn.execute(
            "INSERT INTO users (name,email,phone,role,password) VALUES (?1,?2,?3,?4,?5)",
            params![
                "Тренер Мария",
                "coach.maria@sportcomplex.com",
                "+7 (910) 555-22-11",
                "Тренер",
                coach_password
            ],
        )?;
    }

    if table_count(conn, "services")? == 0 {
        let services = vec![
            (
                "Доступ в тренажерный зал",
                "Фитнес",
                600,
                "посещение",
                "Свободный доступ к тренажерам",
            ),
            (
                "Персональная тренировка",
                "Тренер",
                1800,
                "час",
                "Индивидуальная работа с тренером",
            ),
            (
                "Консультация тренера",
                "Тренер",
                900,
                "сессия",
                "Подбор плана и рекомендаций",
            ),
            (
                "Бассейн",
                "Вода",
                700,
                "час",
                "Доступ в бассейн и сауну",
            ),
            (
                "Теннисный корт",
                "Спорт",
                1200,
                "час",
                "Аренда корта и инвентаря",
            ),
            (
                "Групповое занятие",
                "Группы",
                500,
                "занятие",
                "Йога, пилатес, функционал",
            ),
        ];
        for s in services {
            conn.execute(
                "INSERT INTO services (name,category,price,unit,description) VALUES (?1,?2,?3,?4,?5)",
                params![s.0, s.1, s.2, s.3, s.4],
            )?;
        }
    }

    if table_count(conn, "membership_plans")? == 0 {
        let plans = vec![
            (
                "Базовый",
                1990,
                "месяц",
                "8",
                json!(["Тренажёрный зал", "Групповые занятия"]).to_string(),
            ),
            (
                "Стандарт",
                3490,
                "месяц",
                "16",
                json!(["Зал + бассейн", "Группы", "1 консультация тренера"]).to_string(),
            ),
            (
                "Премиум",
                5990,
                "месяц",
                "Безлимит",
                json!(["Все зоны", "2 персональные тренировки", "Приоритет бронирования"]).to_string(),
            ),
        ];
        for p in plans {
            conn.execute(
                "INSERT INTO membership_plans (name,price,period,visits,perksJson) VALUES (?1,?2,?3,?4,?5)",
                params![p.0, p.1, p.2, p.3, p.4],
            )?;
        }
    }

    if table_count(conn, "calendar_slots")? == 0 {
        let slots = vec![
            ("2026-02-11", "10:00", "Йога", "Светлана Смирнова", 16, 12),
            ("2026-02-11", "12:00", "Кроссфит", "Иван Иванов", 12, 12),
            ("2026-02-12", "09:00", "Пилатес", "Мария Кузнецова", 14, 7),
            ("2026-02-13", "19:00", "Силовая", "Антон Морозов", 10, 8),
        ];
        for slot in slots {
            conn.execute(
                "INSERT INTO calendar_slots (date,time,className,trainer,capacity,booked) VALUES (?1,?2,?3,?4,?5,?6)",
                params![slot.0, slot.1, slot.2, slot.3, slot.4, slot.5],
            )?;
        }
    }

    if table_count(conn, "crm_notes")? == 0 {
        conn.execute(
            "INSERT INTO crm_notes (memberId,text,createdAt) VALUES (?1,?2,?3)",
            params![1, "Предпочитает тренировки утром", "2026-02-01"],
        )?;
        conn.execute(
            "INSERT INTO crm_notes (memberId,text,createdAt) VALUES (?1,?2,?3)",
            params![2, "Аллергия на латекс — избегать резинок", "2026-02-05"],
        )?;
    }

    if table_count(conn, "notifications")? == 0 {
        conn.execute(
            "INSERT INTO notifications (type,title,message,createdAt,isRead,refType,refId) VALUES (?1,?2,?3,?4,0,?5,?6)",
            params![
                "Оплата",
                "Просрочен платёж",
                "Клиент Мария Иванова: счёт на 1 500 ₽ просрочен на 2 дня",
                "2026-02-10 11:20",
                "payment",
                "1"
            ],
        )?;
        conn.execute(
            "INSERT INTO notifications (type,title,message,createdAt,isRead,refType,refId) VALUES (?1,?2,?3,?4,0,?5,?6)",
            params![
                "Тренировка",
                "Напоминание",
                "Тренировка \"Йога для начинающих\" через 2 часа",
                "2026-02-10 09:10",
                "booking",
                "1"
            ],
        )?;
    }

    if table_count(conn, "deals")? == 0 {
        conn.execute(
            "INSERT INTO deals (client,offer,value,stage,probability,manager,nextStep,date) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                "Мария Иванова",
                "Премиум абонемент 6 мес",
                32000,
                "Переговоры",
                60,
                "Ирина",
                "Согласовать скидку",
                "2026-02-01"
            ],
        )?;
        conn.execute(
            "INSERT INTO deals (client,offer,value,stage,probability,manager,nextStep,date) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                "ООО Альфа",
                "Корпоративные тренировки",
                120000,
                "Предложение",
                45,
                "Антон",
                "Отправить договор",
                "2026-01-28"
            ],
        )?;
    }

    if table_count(conn, "workout_templates")? == 0 {
        let templates = vec![
            (
                "Йога для начинающих",
                "Базовые позы йоги для новичков",
                "Йога",
                "Начинающие",
                60,
                20,
            ),
            (
                "Йога продвинутая",
                "Сложные асаны и практики",
                "Йога",
                "Продвинутые",
                90,
                15,
            ),
            (
                "Кроссфит",
                "Функциональный тренинг высокой интенсивности",
                "Функционал",
                "Средние",
                60,
                15,
            ),
            (
                "Кроссфит PRO",
                "Продвинутый кроссфит с тяжелыми весами",
                "Функционал",
                "Продвинутые",
                75,
                12,
            ),
            (
                "Пилатес",
                "Укрепление корпуса и гибкость",
                "Пилатес",
                "Начинающие",
                60,
                18,
            ),
            (
                "Пилатес для продвинутых",
                "Интенсивный пилатес на тренажерах",
                "Пилатес",
                "Продвинутые",
                50,
                12,
            ),
            (
                "Аэробика",
                "Кардио-тренировка под музыку",
                "Кардио",
                "Начинающие",
                45,
                25,
            ),
            (
                "Степ-аэробика",
                "Интенсивная кардио на степ-платформе",
                "Кардио",
                "Средние",
                50,
                20,
            ),
            ("Бокс", "Техника бокса и кардио", "Боевые искусства", "Средние", 60, 12),
            ("Муай-тай", "Таиландский бокс", "Боевые искусства", "Средние", 60, 10),
            (
                "Плавание для начинающих",
                "Обучение плаванию с инструктором",
                "Вода",
                "Начинающие",
                45,
                8,
            ),
            ("Аквааэробика", "Кардио в воде", "Вода", "Все уровни", 50, 15),
            (
                "Растяжка и гибкость",
                "Стретчинг и подвижность",
                "Функционал",
                "Начинающие",
                45,
                20,
            ),
            ("Силовая тренировка", "Работа с тяжелыми весами", "Силовая", "Средние", 60, 12),
            ("TRX подвес", "Функциональный тренинг на подвесах", "Функционал", "Средние", 45, 10),
            (
                "Йога восстановления",
                "Мягкая йога для релаксации и восстановления",
                "Йога",
                "Все уровни",
                75,
                20,
            ),
        ];
        for t in templates {
            conn.execute(
                "INSERT INTO workout_templates (name,description,category,level,duration,defaultCapacity) VALUES (?1,?2,?3,?4,?5,?6)",
                params![t.0, t.1, t.2, t.3, t.4, t.5],
            )?;
        }
    }

    if table_count(conn, "demand_history")? == 0 {
        let history = vec![
            ("Авг", 820, 260, 140),
            ("Сен", 870, 300, 150),
            ("Окт", 910, 320, 160),
            ("Ноя", 980, 340, 180),
            ("Дек", 1020, 360, 200),
            ("Янв", 1100, 390, 220),
        ];
        for h in history {
            conn.execute(
                "INSERT INTO demand_history (month,visits,pool,tennis) VALUES (?1,?2,?3,?4)",
                params![h.0, h.1, h.2, h.3],
            )?;
        }
    }

    recalculate_class_enrollment(conn)?;
    generate_notifications(conn)?;
    Ok(())
}

fn init_db(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        ",
    )?;
    ensure_migrations_table(conn)?;

    apply_migration(
        conn,
        1,
        "base_schema_and_seed",
        migrate_v1_base_schema_and_seed,
    )?;
    apply_migration(
        conn,
        2,
        "hash_existing_passwords",
        migrate_v2_hash_existing_passwords,
    )?;
    apply_migration(conn, 3, "create_indexes", migrate_v3_create_indexes)?;
    apply_migration(
        conn,
        4,
        "integrity_triggers_and_checks",
        migrate_v4_integrity_triggers,
    )?;
    apply_migration(conn, 5, "vk_accounts", migrate_v5_vk_accounts)?;

    recalculate_class_enrollment(conn)?;
    generate_notifications(conn)?;
    Ok(())
}

fn build_analytics(conn: &Connection) -> rusqlite::Result<Value> {
    let members = query_rows(conn, "SELECT * FROM members", &[])?;
    let trainers_count: i64 = conn.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0))?;
    let classes_count: i64 = conn.query_row("SELECT COUNT(*) FROM classes", [], |r| r.get(0))?;
    let classes = query_rows(conn, "SELECT * FROM classes", &[])?;
    let bookings = query_rows(conn, "SELECT * FROM bookings", &[])?;
    let payments = query_rows(conn, "SELECT * FROM payments", &[])?;
    let receipts = query_rows(conn, "SELECT * FROM receipts", &[])?;

    let total_members = members.len() as i64;
    let now = Local::now().date_naive();
    let month_now = month_key(now);

    let mut month_revenue: i64 = 0;
    let mut revenue_by_month_map: BTreeMap<String, i64> = BTreeMap::new();
    for p in &payments {
        let amount = value_i64(p, "amount");
        let date = value_string(p, "date");
        if let Some(d) = parse_date(&date) {
            let key = month_key(d);
            *revenue_by_month_map.entry(key.clone()).or_insert(0) += amount;
            if key == month_now {
                month_revenue += amount;
            }
        }
    }

    let new_members_month = members
        .iter()
        .filter(|m| {
            let d = value_string(m, "joinDate");
            parse_date(&d).map(|dd| month_key(dd) == month_now).unwrap_or(false)
        })
        .count() as i64;

    let active_members = members
        .iter()
        .filter(|m| value_string(m, "status").to_lowercase() == "активный")
        .count() as i64;

    let retention_rate = if total_members > 0 {
        ((active_members as f64 / total_members as f64) * 100.0).round() as i64
    } else {
        0
    };

    let months = last_months(6);
    let mut monthly_members = Vec::new();
    let mut cumulative = 0;
    for month_start in &months {
        let key = month_key(*month_start);
        let newcomers = members
            .iter()
            .filter(|m| {
                let d = value_string(m, "joinDate");
                parse_date(&d).map(|dd| month_key(dd) == key).unwrap_or(false)
            })
            .count() as i64;
        cumulative += newcomers;
        monthly_members.push(json!({
            "month": month_label(*month_start),
            "new": newcomers,
            "churn": 0,
            "total": cumulative,
        }));
    }

    let revenue_by_month: Vec<Value> = months
        .iter()
        .map(|m| {
            let key = month_key(*m);
            let revenue = revenue_by_month_map.get(&key).copied().unwrap_or(0);
            json!({
                "month": month_label(*m),
                "revenue": revenue,
            })
        })
        .collect();

    let mut booking_by_class: HashMap<String, i64> = HashMap::new();
    for b in &bookings {
        let key = {
            let cls = value_string(b, "className");
            if cls.is_empty() {
                value_string(b, "class")
            } else {
                cls
            }
        };
        if key.is_empty() {
            continue;
        }
        *booking_by_class.entry(key).or_insert(0) += 1;
    }

    let class_attendance: Vec<Value> = classes
        .iter()
        .map(|c| {
            let name = value_string(c, "name");
            let enrolled = value_i64(c, "enrolled");
            let capacity = value_i64(c, "capacity");
            let booking_count = booking_by_class.get(&name).copied().unwrap_or(0);
            json!({
                "name": name,
                "attendance": enrolled.max(booking_count),
                "capacity": capacity,
            })
        })
        .collect();

    let mut membership_map: BTreeMap<String, i64> = BTreeMap::new();
    for m in &members {
        let key = {
            let v = value_string(m, "membership");
            if v.is_empty() {
                "Без абонемента".to_string()
            } else {
                v
            }
        };
        *membership_map.entry(key).or_insert(0) += 1;
    }
    let colors = ["#16a34a", "#059669", "#22c55e", "#4ade80", "#15803d"];
    let membership_distribution: Vec<Value> = membership_map
        .into_iter()
        .enumerate()
        .map(|(idx, (name, value))| {
            json!({
                "name": name,
                "value": value,
                "color": colors[idx % colors.len()],
            })
        })
        .collect();

    let mut peak_map: BTreeMap<String, i64> = BTreeMap::new();
    for b in &bookings {
        let time = value_string(b, "time");
        let hour = if time.len() >= 2 {
            &time[0..2]
        } else {
            "00"
        };
        let key = format!("{}:00", hour);
        *peak_map.entry(key).or_insert(0) += 1;
    }
    let peak_hours: Vec<Value> = peak_map
        .into_iter()
        .map(|(hour, members)| json!({ "hour": hour, "members": members }))
        .collect();

    let mut daily_map: HashMap<String, i64> = HashMap::new();
    for b in &bookings {
        let date = value_string(b, "date");
        if let Some(d) = parse_date(&date) {
            let key = d.format("%Y-%m-%d").to_string();
            *daily_map.entry(key).or_insert(0) += 1;
        }
    }
    let avg_attendance = if daily_map.is_empty() {
        0
    } else {
        let sum: i64 = daily_map.values().sum();
        (sum as f64 / daily_map.len() as f64).round() as i64
    };

    let mut service_sales: HashMap<String, i64> = HashMap::new();
    let mut service_revenue: HashMap<String, i64> = HashMap::new();
    for r in &receipts {
        let items_json = value_string(r, "itemsJson");
        if items_json.is_empty() {
            continue;
        }
        if let Ok(items) = serde_json::from_str::<Vec<Value>>(&items_json) {
            for item in items {
                let name = value_string(&item, "name");
                if name.is_empty() {
                    continue;
                }
                let qty = value_i64(&item, "qty").max(1);
                let price = value_i64(&item, "price");
                *service_sales.entry(name.clone()).or_insert(0) += qty;
                *service_revenue.entry(name).or_insert(0) += qty * price;
            }
        }
    }

    let mut top_services: Vec<(String, i64)> = service_sales.into_iter().collect();
    top_services.sort_by(|a, b| b.1.cmp(&a.1));
    let top_services: Vec<Value> = top_services
        .into_iter()
        .take(5)
        .map(|(name, sales)| json!({ "name": name, "sales": sales }))
        .collect();

    let mut revenue_by_service: Vec<(String, i64)> = service_revenue.into_iter().collect();
    revenue_by_service.sort_by(|a, b| b.1.cmp(&a.1));
    let revenue_by_service: Vec<Value> = revenue_by_service
        .into_iter()
        .take(8)
        .map(|(name, revenue)| json!({ "name": name, "revenue": revenue }))
        .collect();

    let mut top_trainers: Vec<Value> = classes
        .iter()
        .map(|c| {
            json!({
                "name": value_string(c, "trainerName"),
                "sessions": value_i64(c, "enrolled"),
            })
        })
        .filter(|v| !value_string(v, "name").is_empty())
        .collect();
    top_trainers.sort_by(|a, b| value_i64(b, "sessions").cmp(&value_i64(a, "sessions")));
    top_trainers.truncate(5);

    Ok(json!({
        "metrics": {
            "totalMembers": total_members,
            "totalTrainers": trainers_count,
            "totalClasses": classes_count,
            "activeClasses": classes_count,
            "monthRevenue": month_revenue,
            "newMembersMonth": new_members_month,
            "activeMembers": active_members,
            "avgAttendance": avg_attendance,
            "retentionRate": retention_rate,
        },
        "monthlyMembers": monthly_members,
        "revenueByMonth": revenue_by_month,
        "classAttendance": class_attendance,
        "membershipDistribution": membership_distribution,
        "peakHours": peak_hours,
        "topServices": top_services,
        "topTrainers": top_trainers,
        "revenueByService": revenue_by_service,
    }))
}

fn csv_response(filename: &str, csv: String) -> Response {
    let mut resp = Response::new(axum::body::Body::from(csv));
    *resp.status_mut() = StatusCode::OK;
    resp.headers_mut()
        .insert(CONTENT_TYPE, HeaderValue::from_static("text/csv; charset=utf-8"));
    let dispo = format!("attachment; filename=\"{}\"", filename);
    if let Ok(value) = HeaderValue::from_str(&dispo) {
        resp.headers_mut().insert(CONTENT_DISPOSITION, value);
    }
    resp
}

async fn root() -> Json<Value> {
    Json(json!({
        "message": "Fitness Management API",
        "version": "3.0.0-rust",
        "status": "running",
    }))
}

async fn ping() -> Json<Value> {
    Json(json!({ "ok": true }))
}

async fn auth_register(State(state): State<AppState>, Json(body): Json<Value>) -> ApiResult<Response> {
    let name = body_opt_string(&body, "name")
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"))?;
    let email = body_opt_string(&body, "email")
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"))?;
    let password_plain = body_opt_string(&body, "password")
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"))?;
    let password = hash_password_api(&password_plain)?;
    let phone = body_string(&body, "phone", "");

    let conn = lock_db(&state)?;

    let exists: Option<i64> = conn
        .query_row("SELECT id FROM users WHERE email = ?1", params![email], |r| r.get(0))
        .optional()
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Register failed"))?;
    if exists.is_some() {
        return Err(ApiError::new(StatusCode::CONFLICT, "User already exists"));
    }

    conn.execute(
        "INSERT INTO users (name,email,phone,role,password) VALUES (?1,?2,?3,?4,?5)",
        params![name, email, phone, "Клиент", password],
    )
    .map_err(|e| map_db_write_error(e, "Register failed"))?;

    let user_id = conn.last_insert_rowid();
    let token = generate_token();
    conn.execute(
        "INSERT INTO sessions (userId, token, createdAt, expiresAt) VALUES (?1,?2,?3,?4)",
        params![user_id, token, now_iso(), expires_in_7_days_iso()],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Register failed"))?;

    conn.execute(
        "INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?1,?2,?3,?4,?5,?6)",
        params![
            body_string(&body, "name", ""),
            body_string(&body, "email", ""),
            body_string(&body, "phone", ""),
            "Базовый",
            now_date(),
            "Активный"
        ],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Register failed"))?;

    let user_raw = query_one(
        &conn,
        "SELECT id, name, email, phone, role FROM users WHERE id = ?1",
        &[&user_id],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Register failed"))?
    .unwrap_or_else(|| json!({}));
    let user = user_with_flags(&user_raw);

    Ok((StatusCode::CREATED, Json(json!({ "user": user, "token": token }))).into_response())
}

async fn auth_login(State(state): State<AppState>, Json(body): Json<Value>) -> ApiResult<Json<Value>> {
    let email = body_opt_string(&body, "email")
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"))?;
    let password = body_opt_string(&body, "password")
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"))?;

    let conn = lock_db(&state)?;
    let user = query_one(
        &conn,
        "SELECT id, name, email, phone, role, password FROM users WHERE email = ?1",
        &[&email],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Login failed"))?;

    let user = user.ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "Invalid credentials"))?;
    let stored_password = value_string(&user, "password");
    if !verify_password(&password, &stored_password) {
        return Err(ApiError::new(StatusCode::UNAUTHORIZED, "Invalid credentials"));
    }

    let user_id = value_i64(&user, "id");
    if needs_password_upgrade(&stored_password) {
        if let Ok(new_hash) = hash_password_raw(&password) {
            let _ = conn.execute(
                "UPDATE users SET password = ?1 WHERE id = ?2",
                params![new_hash, user_id],
            );
        }
    }

    let token = generate_token();
    conn.execute(
        "INSERT INTO sessions (userId, token, createdAt, expiresAt) VALUES (?1,?2,?3,?4)",
        params![user_id, token, now_iso(), expires_in_7_days_iso()],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Login failed"))?;

    let safe_user = user_with_flags(&user);

    Ok(Json(json!({ "user": safe_user, "token": token })))
}

#[derive(Debug, Clone)]
struct VkProfileHints {
    vk_user_id: Option<String>,
    name: Option<String>,
    email: Option<String>,
    phone: Option<String>,
    raw: Value,
}

fn normalize_non_empty(input: Option<String>) -> Option<String> {
    input.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn json_path_opt_string(body: &Value, path: &[&str]) -> Option<String> {
    if path.is_empty() {
        return None;
    }
    let mut current = body;
    for key in path {
        current = current.get(*key)?;
    }
    if let Some(s) = current.as_str() {
        return normalize_non_empty(Some(s.to_string()));
    }
    if current.is_number() || current.is_boolean() {
        return normalize_non_empty(Some(current.to_string()));
    }
    None
}

fn first_non_empty(candidates: Vec<Option<String>>) -> Option<String> {
    for candidate in candidates {
        if let Some(value) = normalize_non_empty(candidate) {
            return Some(value);
        }
    }
    None
}

fn extract_vk_profile_hints(body: &Value) -> VkProfileHints {
    let vk_user_id = first_non_empty(vec![
        json_path_opt_string(body, &["vk_user_id"]),
        json_path_opt_string(body, &["user_id"]),
        json_path_opt_string(body, &["sub"]),
        json_path_opt_string(body, &["id"]),
        json_path_opt_string(body, &["user", "vk_user_id"]),
        json_path_opt_string(body, &["user", "user_id"]),
        json_path_opt_string(body, &["user", "id"]),
        json_path_opt_string(body, &["user", "uid"]),
        json_path_opt_string(body, &["user", "sub"]),
        json_path_opt_string(body, &["userInfo", "user_id"]),
        json_path_opt_string(body, &["userInfo", "id"]),
        json_path_opt_string(body, &["userInfo", "user", "user_id"]),
        json_path_opt_string(body, &["userInfo", "user", "id"]),
        json_path_opt_string(body, &["publicInfo", "user", "id"]),
        json_path_opt_string(body, &["public_info", "user", "id"]),
    ]);

    let email = first_non_empty(vec![
        json_path_opt_string(body, &["email"]),
        json_path_opt_string(body, &["user", "email"]),
        json_path_opt_string(body, &["userInfo", "email"]),
        json_path_opt_string(body, &["userInfo", "user", "email"]),
        json_path_opt_string(body, &["publicInfo", "email"]),
        json_path_opt_string(body, &["publicInfo", "user", "email"]),
        json_path_opt_string(body, &["public_info", "email"]),
        json_path_opt_string(body, &["public_info", "user", "email"]),
    ]);

    let phone = first_non_empty(vec![
        json_path_opt_string(body, &["phone"]),
        json_path_opt_string(body, &["phone_number"]),
        json_path_opt_string(body, &["user", "phone"]),
        json_path_opt_string(body, &["user", "phone_number"]),
        json_path_opt_string(body, &["userInfo", "phone"]),
        json_path_opt_string(body, &["userInfo", "phone_number"]),
        json_path_opt_string(body, &["userInfo", "user", "phone"]),
        json_path_opt_string(body, &["userInfo", "user", "phone_number"]),
    ]);

    let first_name = first_non_empty(vec![
        json_path_opt_string(body, &["first_name"]),
        json_path_opt_string(body, &["firstName"]),
        json_path_opt_string(body, &["given_name"]),
        json_path_opt_string(body, &["givenName"]),
        json_path_opt_string(body, &["user", "first_name"]),
        json_path_opt_string(body, &["user", "firstName"]),
        json_path_opt_string(body, &["user", "given_name"]),
        json_path_opt_string(body, &["userInfo", "first_name"]),
        json_path_opt_string(body, &["userInfo", "firstName"]),
        json_path_opt_string(body, &["userInfo", "user", "first_name"]),
        json_path_opt_string(body, &["userInfo", "user", "firstName"]),
        json_path_opt_string(body, &["publicInfo", "user", "first_name"]),
        json_path_opt_string(body, &["publicInfo", "user", "firstName"]),
    ]);

    let last_name = first_non_empty(vec![
        json_path_opt_string(body, &["last_name"]),
        json_path_opt_string(body, &["lastName"]),
        json_path_opt_string(body, &["family_name"]),
        json_path_opt_string(body, &["familyName"]),
        json_path_opt_string(body, &["user", "last_name"]),
        json_path_opt_string(body, &["user", "lastName"]),
        json_path_opt_string(body, &["user", "family_name"]),
        json_path_opt_string(body, &["userInfo", "last_name"]),
        json_path_opt_string(body, &["userInfo", "lastName"]),
        json_path_opt_string(body, &["userInfo", "user", "last_name"]),
        json_path_opt_string(body, &["userInfo", "user", "lastName"]),
        json_path_opt_string(body, &["publicInfo", "user", "last_name"]),
        json_path_opt_string(body, &["publicInfo", "user", "lastName"]),
    ]);

    let display_name = first_non_empty(vec![
        json_path_opt_string(body, &["name"]),
        json_path_opt_string(body, &["display_name"]),
        json_path_opt_string(body, &["displayName"]),
        json_path_opt_string(body, &["user", "name"]),
        json_path_opt_string(body, &["user", "display_name"]),
        json_path_opt_string(body, &["user", "displayName"]),
        json_path_opt_string(body, &["userInfo", "name"]),
        json_path_opt_string(body, &["userInfo", "user", "name"]),
        json_path_opt_string(body, &["publicInfo", "user", "name"]),
    ]);

    let composed_name = match (first_name, last_name) {
        (Some(first), Some(last)) => normalize_non_empty(Some(format!("{} {}", first, last))),
        (Some(first), None) => Some(first),
        (None, Some(last)) => Some(last),
        (None, None) => None,
    };

    let name = composed_name.or(display_name);

    VkProfileHints {
        vk_user_id,
        name,
        email,
        phone,
        raw: body.clone(),
    }
}

fn sanitize_email_local_part(value: &str) -> String {
    let mut out = String::new();
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
        } else if matches!(ch, '_' | '-' | '.') {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    let compact = out.trim_matches('_').to_string();
    if compact.is_empty() {
        "vkuser".to_string()
    } else {
        compact
    }
}

fn vk_fallback_email(vk_user_id: Option<&str>) -> String {
    let local = vk_user_id
        .map(sanitize_email_local_part)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| Uuid::new_v4().simple().to_string());
    format!("vk_{}@vk.local", local)
}

fn find_user_id_by_email(conn: &Connection, email: &str) -> rusqlite::Result<Option<i64>> {
    conn.query_row(
        "SELECT id FROM users WHERE email = ?1 LIMIT 1",
        params![email],
        |row| row.get(0),
    )
    .optional()
}

fn fetch_safe_user(conn: &Connection, user_id: i64) -> rusqlite::Result<Value> {
    Ok(query_one(
        conn,
        "SELECT id, name, email, phone, role FROM users WHERE id = ?1",
        &[&user_id],
    )?
    .unwrap_or_else(|| json!({})))
}

fn user_with_flags(user: &Value) -> Value {
    let email = value_string(user, "email");
    json!({
        "id": value_i64(user, "id"),
        "name": value_string(user, "name"),
        "email": email,
        "phone": value_string(user, "phone"),
        "role": value_string(user, "role"),
        "needsEmail": email_needs_update(&email),
    })
}

fn ensure_member_profile(conn: &Connection, name: &str, email: &str, phone: &str) -> rusqlite::Result<()> {
    if email.trim().is_empty() {
        return Ok(());
    }

    let member_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM members WHERE email = ?1 ORDER BY id DESC LIMIT 1",
            params![email],
            |row| row.get(0),
        )
        .optional()?;

    let safe_name = if name.trim().is_empty() {
        "VK Пользователь"
    } else {
        name
    };

    if let Some(id) = member_id {
        conn.execute(
            "UPDATE members
             SET name = ?1,
                 phone = CASE WHEN ?2 <> '' THEN ?2 ELSE phone END
             WHERE id = ?3",
            params![safe_name, phone.trim(), id],
        )?;
    } else {
        conn.execute(
            "INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?1,?2,?3,?4,?5,?6)",
            params![safe_name, email, phone.trim(), "Базовый", now_date(), "Активный"],
        )?;
    }
    Ok(())
}

fn update_user_profile(
    conn: &Connection,
    user_id: i64,
    name_hint: Option<String>,
    email_hint: Option<String>,
    phone_hint: Option<String>,
) -> rusqlite::Result<()> {
    let current = fetch_safe_user(conn, user_id)?;
    let mut next_name = value_string(&current, "name");
    let mut next_email = value_string(&current, "email");
    let mut next_phone = value_string(&current, "phone");

    if let Some(name) = normalize_non_empty(name_hint) {
        next_name = name;
    }
    if next_name.trim().is_empty() {
        next_name = "VK Пользователь".to_string();
    }

    if let Some(email) = normalize_non_empty(email_hint) {
        if email != next_email {
            let existing = find_user_id_by_email(conn, &email)?;
            if existing.is_none() || existing == Some(user_id) {
                next_email = email;
            }
        }
    }

    if let Some(phone) = normalize_non_empty(phone_hint) {
        next_phone = phone;
    }

    conn.execute(
        "UPDATE users SET name = ?1, email = ?2, phone = ?3 WHERE id = ?4",
        params![next_name, next_email, next_phone, user_id],
    )?;

    let _ = ensure_member_profile(conn, &next_name, &next_email, &next_phone);
    Ok(())
}

fn find_user_by_vk_id(conn: &Connection, vk_user_id: &str) -> rusqlite::Result<Option<Value>> {
    query_one(
        conn,
        "SELECT u.id, u.name, u.email, u.phone, u.role
         FROM vk_accounts va
         JOIN users u ON u.id = va.userId
         WHERE va.vkUserId = ?1
         LIMIT 1",
        &[&vk_user_id],
    )
}

fn upsert_vk_account(
    conn: &Connection,
    vk_user_id: &str,
    user_id: i64,
    raw_profile: &Value,
) -> rusqlite::Result<()> {
    let profile_json = serde_json::to_string(raw_profile).unwrap_or_else(|_| "{}".to_string());
    let now = now_iso();
    conn.execute(
        "DELETE FROM vk_accounts WHERE userId = ?1 AND vkUserId != ?2",
        params![user_id, vk_user_id],
    )?;
    conn.execute(
        "INSERT INTO vk_accounts (vkUserId, userId, profileJson, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(vkUserId) DO UPDATE SET
           userId = excluded.userId,
           profileJson = excluded.profileJson,
           updatedAt = excluded.updatedAt",
        params![vk_user_id, user_id, profile_json, now, now],
    )?;
    Ok(())
}

fn ensure_unique_email(conn: &Connection, preferred: &str) -> rusqlite::Result<String> {
    let (local_raw, domain_raw) = preferred
        .split_once('@')
        .unwrap_or((preferred, "vk.local"));
    let local = sanitize_email_local_part(local_raw);
    let domain = if domain_raw.trim().is_empty() {
        "vk.local".to_string()
    } else {
        domain_raw.trim().to_lowercase()
    };

    let mut candidate = format!("{}@{}", local, domain);
    let mut suffix = 2;
    while find_user_id_by_email(conn, &candidate)?.is_some() {
        candidate = format!("{}+{}@{}", local, suffix, domain);
        suffix += 1;
    }
    Ok(candidate)
}

fn ensure_vk_profile_user(conn: &Connection, hints: &VkProfileHints) -> rusqlite::Result<Value> {
    if let Some(vk_user_id) = hints.vk_user_id.clone() {
        if let Some(user) = find_user_by_vk_id(conn, &vk_user_id)? {
            let user_id = value_i64(&user, "id");
            update_user_profile(
                conn,
                user_id,
                hints.name.clone(),
                hints.email.clone(),
                hints.phone.clone(),
            )?;
            let _ = upsert_vk_account(conn, &vk_user_id, user_id, &hints.raw);
            return fetch_safe_user(conn, user_id);
        }
    }

    if let Some(email) = normalize_non_empty(hints.email.clone()) {
        if let Some(user_id) = find_user_id_by_email(conn, &email)? {
            update_user_profile(
                conn,
                user_id,
                hints.name.clone(),
                Some(email.clone()),
                hints.phone.clone(),
            )?;
            if let Some(vk_user_id) = hints.vk_user_id.clone() {
                let _ = upsert_vk_account(conn, &vk_user_id, user_id, &hints.raw);
            }
            return fetch_safe_user(conn, user_id);
        }
    }

    let name = normalize_non_empty(hints.name.clone()).unwrap_or_else(|| "VK Пользователь".to_string());
    let preferred_email = normalize_non_empty(hints.email.clone())
        .unwrap_or_else(|| vk_fallback_email(hints.vk_user_id.as_deref()));
    let email = ensure_unique_email(conn, &preferred_email)?;
    let phone = normalize_non_empty(hints.phone.clone()).unwrap_or_default();
    let password = hash_password_raw("vk_oauth").unwrap_or_else(|_| generate_token());

    conn.execute(
        "INSERT INTO users (name,email,phone,role,password) VALUES (?1,?2,?3,?4,?5)",
        params![name, email, phone, "Клиент", password],
    )?;

    let user_id = conn.last_insert_rowid();
    if let Some(vk_user_id) = hints.vk_user_id.clone() {
        let _ = upsert_vk_account(conn, &vk_user_id, user_id, &hints.raw);
    }
    let _ = ensure_member_profile(conn, &name, &email, &phone);
    fetch_safe_user(conn, user_id)
}

fn ensure_vk_demo_user(conn: &Connection, name_hint: Option<String>, email_hint: Option<String>) -> rusqlite::Result<Value> {
    let email = email_hint.unwrap_or_else(|| "vk_demo@vk.com".to_string());
    let existing = query_one(
        conn,
        "SELECT id, name, email, phone, role FROM users WHERE email = ?1",
        &[&email],
    )?;

    if let Some(user) = existing {
        return Ok(user);
    }

    let name = name_hint.unwrap_or_else(|| "VK Пользователь".to_string());
    let demo_password = hash_password_raw("vk_oauth").unwrap_or_else(|_| "vk_oauth".to_string());
    conn.execute(
        "INSERT INTO users (name,email,phone,role,password) VALUES (?1,?2,?3,?4,?5)",
        params![name, email, "", "Клиент", demo_password],
    )?;
    let user_id = conn.last_insert_rowid();
    let user = query_one(
        conn,
        "SELECT id, name, email, phone, role FROM users WHERE id = ?1",
        &[&user_id],
    )?
    .unwrap_or_else(|| json!({}));

    conn.execute(
        "INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?1,?2,?3,?4,?5,?6)",
        params![
            value_string(&user, "name"),
            value_string(&user, "email"),
            "",
            "Базовый",
            now_date(),
            "Активный"
        ],
    )
    .ok();

    Ok(user)
}

fn issue_session(conn: &Connection, user_id: i64) -> rusqlite::Result<String> {
    let token = generate_token();
    conn.execute(
        "INSERT INTO sessions (userId, token, createdAt, expiresAt) VALUES (?1,?2,?3,?4)",
        params![user_id, token, now_iso(), expires_in_7_days_iso()],
    )?;
    Ok(token)
}

async fn auth_vk_demo(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let conn = lock_db(&state)?;
    let user_raw = ensure_vk_demo_user(&conn, Some("VK Пользователь".to_string()), Some("vk_demo@vk.com".to_string()))
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "VK demo failed"))?;
    let token = issue_session(&conn, value_i64(&user_raw, "id"))
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "VK demo failed"))?;
    let user = user_with_flags(&user_raw);
    Ok(Json(json!({ "user": user, "token": token, "demo": true })))
}

async fn auth_vk_complete(State(state): State<AppState>, Json(body): Json<Value>) -> ApiResult<Json<Value>> {
    let hints = extract_vk_profile_hints(&body);
    let conn = lock_db(&state)?;
    let user_raw = ensure_vk_profile_user(&conn, &hints)
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "VK auth failed"))?;

    let token = issue_session(&conn, value_i64(&user_raw, "id"))
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "VK auth failed"))?;
    let user = user_with_flags(&user_raw);

    Ok(Json(json!({ "user": user, "token": token })))
}

async fn auth_vk_login(State(state): State<AppState>) -> ApiResult<Redirect> {
    let conn = lock_db(&state)?;
    let user = ensure_vk_demo_user(&conn, Some("VK Пользователь".to_string()), Some("vk_demo@vk.com".to_string()))
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "VK auth failed"))?;
    let token = issue_session(&conn, value_i64(&user, "id"))
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "VK auth failed"))?;
    Ok(Redirect::temporary(&format!("/?vk_token={}", token)))
}

async fn auth_vk_callback(State(state): State<AppState>) -> ApiResult<Redirect> {
    let conn = lock_db(&state)?;
    let user = ensure_vk_demo_user(&conn, Some("VK Пользователь".to_string()), Some("vk_demo@vk.com".to_string()))
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "VK auth failed"))?;
    let token = issue_session(&conn, value_i64(&user, "id"))
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "VK auth failed"))?;
    Ok(Redirect::temporary(&format!("/?vk_token={}", token)))
}

async fn auth_me(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    Ok(Json(json!({
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role,
            "needsEmail": email_needs_update(&user.email),
        }
    })))
}

async fn auth_profile_update(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let authed = auth_user(&headers, &state)?;
    let name_patch = body_opt_string(&body, "name");
    let email_patch = body_opt_string(&body, "email");
    let phone_patch = body_opt_string(&body, "phone");

    if name_patch.is_none() && email_patch.is_none() && phone_patch.is_none() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "No profile fields provided",
        ));
    }

    if let Some(email) = email_patch.as_ref() {
        if !looks_like_email(email) {
            return Err(ApiError::new(StatusCode::BAD_REQUEST, "Invalid email"));
        }
    }

    let conn = lock_db(&state)?;
    let current = fetch_safe_user(&conn, authed.id)
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Profile update failed"))?;
    let current_email = value_string(&current, "email");

    let mut next_name = value_string(&current, "name");
    let mut next_email = current_email.clone();
    let mut next_phone = value_string(&current, "phone");

    if let Some(name) = normalize_non_empty(name_patch) {
        next_name = name;
    }
    if let Some(email) = normalize_non_empty(email_patch) {
        if email != current_email {
            let exists = find_user_id_by_email(&conn, &email)
                .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Profile update failed"))?;
            if exists.is_some() && exists != Some(authed.id) {
                return Err(ApiError::new(StatusCode::CONFLICT, "Email already exists"));
            }
        }
        next_email = email;
    }
    if let Some(phone) = normalize_non_empty(phone_patch) {
        next_phone = phone;
    }

    conn.execute(
        "UPDATE users SET name = ?1, email = ?2, phone = ?3 WHERE id = ?4",
        params![next_name, next_email, next_phone, authed.id],
    )
    .map_err(|err| map_db_write_error(err, "Profile update failed"))?;

    let _ = ensure_member_profile(&conn, &next_name, &next_email, &next_phone);

    let updated = fetch_safe_user(&conn, authed.id)
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Profile update failed"))?;
    Ok(Json(json!({ "user": user_with_flags(&updated) })))
}

async fn auth_logout(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;
    conn.execute("DELETE FROM sessions WHERE token = ?1", params![user.token])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Logout failed"))?;
    Ok(Json(json!({ "success": true })))
}

async fn users_list(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор"])?;
    let conn = lock_db(&state)?;
    let rows = query_rows(
        &conn,
        "SELECT id, name, email, phone, role FROM users ORDER BY id DESC",
        &[],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Users fetch failed"))?;
    Ok(Json(Value::Array(rows)))
}

async fn users_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор"])?;

    let name = body_opt_string(&body, "name")
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"))?;
    let email = body_opt_string(&body, "email")
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"))?;
    let password_plain = body_opt_string(&body, "password")
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"))?;
    let password = hash_password_api(&password_plain)?;
    let phone = body_string(&body, "phone", "");
    let role = body_string(&body, "role", "Клиент");

    let conn = lock_db(&state)?;
    let exists: Option<i64> = conn
        .query_row("SELECT id FROM users WHERE email = ?1", params![email], |r| r.get(0))
        .optional()
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Users create failed"))?;
    if exists.is_some() {
        return Err(ApiError::new(StatusCode::CONFLICT, "User already exists"));
    }

    conn.execute(
        "INSERT INTO users (name,email,phone,role,password) VALUES (?1,?2,?3,?4,?5)",
        params![name, email, phone, role, password],
    )
    .map_err(|e| map_db_write_error(e, "Users create failed"))?;
    let id = conn.last_insert_rowid();

    let created = query_one(
        &conn,
        "SELECT id, name, email, phone, role FROM users WHERE id = ?1",
        &[&id],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Users create failed"))?
    .unwrap_or_else(|| json!({}));

    if value_string(&created, "role") == "Клиент" {
        conn.execute(
            "INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                value_string(&created, "name"),
                value_string(&created, "email"),
                value_string(&created, "phone"),
                "Базовый",
                now_date(),
                "Активный"
            ],
        )
        .ok();
    }

    Ok((StatusCode::CREATED, Json(created)).into_response())
}

async fn users_update(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор"])?;
    let conn = lock_db(&state)?;

    let existing = query_one(&conn, "SELECT * FROM users WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Users update failed"))?;
    let existing = existing.ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "User not found"))?;

    let next_name = body_opt_string(&body, "name").unwrap_or_else(|| value_string(&existing, "name"));
    let next_email = body_opt_string(&body, "email").unwrap_or_else(|| value_string(&existing, "email"));
    let next_phone = body_opt_string(&body, "phone").unwrap_or_else(|| value_string(&existing, "phone"));
    let existing_role = value_string(&existing, "role");
    let next_role = body_opt_string(&body, "role").unwrap_or_else(|| existing_role.clone());
    let next_password = if let Some(password) = body_opt_string(&body, "password") {
        Some(hash_password_api(&password)?)
    } else {
        None
    };

    conn.execute(
        "UPDATE users SET name = ?1, email = ?2, phone = ?3, role = ?4, password = COALESCE(?5, password) WHERE id = ?6",
        params![next_name, next_email, next_phone, next_role, next_password, id],
    )
    .map_err(|e| map_db_write_error(e, "Users update failed"))?;

    if existing_role != "Клиент" && next_role == "Клиент" {
        conn.execute(
            "INSERT OR IGNORE INTO members (name,email,phone,membership,joinDate,status) VALUES (?1,?2,?3,?4,?5,?6)",
            params![next_name, next_email, next_phone, "Базовый", now_date(), "Активный"],
        )
        .ok();
    }

    let updated = query_one(
        &conn,
        "SELECT id, name, email, phone, role FROM users WHERE id = ?1",
        &[&id],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Users update failed"))?
    .unwrap_or_else(|| json!({}));

    Ok(Json(updated))
}

async fn members_list(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;
    let rows = if user.role == "Клиент" {
        query_rows(
            &conn,
            "SELECT * FROM members WHERE email = ?1 ORDER BY id DESC",
            &[&user.email],
        )
    } else {
        query_rows(&conn, "SELECT * FROM members ORDER BY id DESC", &[])
    }
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Fetch failed"))?;

    Ok(Json(Value::Array(rows)))
}

async fn members_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;
    let conn = lock_db(&state)?;

    conn.execute(
        "INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?1,?2,?3,?4,?5,?6)",
        params![
            body_string(&body, "name", ""),
            body_string(&body, "email", ""),
            body_string(&body, "phone", ""),
            body_string(&body, "membership", "Базовый"),
            body_string(&body, "joinDate", &now_date()),
            body_string(&body, "status", "Активный")
        ],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?;
    let id = conn.last_insert_rowid();

    let created = query_one(&conn, "SELECT * FROM members WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?
        .unwrap_or_else(|| json!({}));

    Ok((StatusCode::CREATED, Json(created)).into_response())
}

async fn members_update(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    conn.execute(
        "UPDATE members SET name = ?1, email = ?2, phone = ?3, membership = ?4, joinDate = ?5, status = ?6 WHERE id = ?7",
        params![
            body_string(&body, "name", ""),
            body_string(&body, "email", ""),
            body_string(&body, "phone", ""),
            body_string(&body, "membership", "Базовый"),
            body_string(&body, "joinDate", ""),
            body_string(&body, "status", "Активный"),
            id
        ],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?;

    let updated = query_one(&conn, "SELECT * FROM members WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?
        .unwrap_or_else(|| json!({}));

    Ok(Json(updated))
}

async fn members_delete(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;
    let conn = lock_db(&state)?;
    conn.execute("DELETE FROM members WHERE id = ?1", params![id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;
    Ok(Json(json!({ "success": true })))
}

async fn trainers_list(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;
    let conn = lock_db(&state)?;
    let rows = query_rows(&conn, "SELECT * FROM trainers ORDER BY id DESC", &[])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Fetch failed"))?;
    Ok(Json(Value::Array(rows)))
}

async fn trainers_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор"])?;
    let conn = lock_db(&state)?;

    conn.execute(
        "INSERT INTO trainers (name,email,phone,specialty,experience,members,rating) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![
            body_string(&body, "name", ""),
            body_string(&body, "email", ""),
            body_string(&body, "phone", ""),
            body_string(&body, "specialty", ""),
            body_string(&body, "experience", ""),
            body_i64(&body, "members", 0),
            body_f64(&body, "rating", 0.0)
        ],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?;

    let id = conn.last_insert_rowid();
    let created = query_one(&conn, "SELECT * FROM trainers WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?
        .unwrap_or_else(|| json!({}));
    Ok((StatusCode::CREATED, Json(created)).into_response())
}

async fn trainers_update(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор"])?;

    let conn = lock_db(&state)?;
    conn.execute(
        "UPDATE trainers SET name = ?1, email = ?2, phone = ?3, specialty = ?4, experience = ?5, members = ?6, rating = ?7 WHERE id = ?8",
        params![
            body_string(&body, "name", ""),
            body_string(&body, "email", ""),
            body_string(&body, "phone", ""),
            body_string(&body, "specialty", ""),
            body_string(&body, "experience", ""),
            body_i64(&body, "members", 0),
            body_f64(&body, "rating", 0.0),
            id
        ],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?;

    let updated = query_one(&conn, "SELECT * FROM trainers WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?
        .unwrap_or_else(|| json!({}));

    Ok(Json(updated))
}

async fn trainers_delete(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор"])?;

    let conn = lock_db(&state)?;
    conn.execute("DELETE FROM trainers WHERE id = ?1", params![id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;
    Ok(Json(json!({ "success": true })))
}

async fn workout_templates_list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let _user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;
    let rows = query_rows(
        &conn,
        "SELECT * FROM workout_templates ORDER BY category ASC, name ASC",
        &[],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Fetch templates failed"))?;
    Ok(Json(Value::Array(rows)))
}

async fn workout_template_get(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let _user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;
    let tpl = query_one(&conn, "SELECT * FROM workout_templates WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Fetch template failed"))?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Template not found"))?;
    Ok(Json(tpl))
}

async fn classes_list(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let _user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;
    let rows = query_rows(&conn, "SELECT * FROM classes ORDER BY id DESC", &[])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Fetch failed"))?;
    Ok(Json(Value::Array(rows)))
}

async fn classes_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    conn.execute(
        "INSERT INTO classes (name,trainerId,trainerName,schedule,capacity,enrolled,level) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![
            body_string(&body, "name", ""),
            body_i64(&body, "trainerId", 0),
            body_string(&body, "trainerName", ""),
            body_string(&body, "schedule", ""),
            body_i64(&body, "capacity", 0),
            body_i64(&body, "enrolled", 0),
            body_string(&body, "level", "")
        ],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?;

    let id = conn.last_insert_rowid();
    let created = query_one(&conn, "SELECT * FROM classes WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?
        .unwrap_or_else(|| json!({}));
    Ok((StatusCode::CREATED, Json(created)).into_response())
}

async fn classes_update(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    conn.execute(
        "UPDATE classes SET name = ?1, trainerId = ?2, trainerName = ?3, schedule = ?4, capacity = ?5, enrolled = ?6, level = ?7 WHERE id = ?8",
        params![
            body_string(&body, "name", ""),
            body_i64(&body, "trainerId", 0),
            body_string(&body, "trainerName", ""),
            body_string(&body, "schedule", ""),
            body_i64(&body, "capacity", 0),
            body_i64(&body, "enrolled", 0),
            body_string(&body, "level", ""),
            id
        ],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?;

    let updated = query_one(&conn, "SELECT * FROM classes WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?
        .unwrap_or_else(|| json!({}));
    Ok(Json(updated))
}

async fn classes_delete(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    conn.execute("DELETE FROM classes WHERE id = ?1", params![id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;
    Ok(Json(json!({ "success": true })))
}

async fn bookings_list(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;

    let rows = if user.role == "Клиент" {
        query_rows(
            &conn,
            "SELECT * FROM bookings WHERE member = ?1 ORDER BY id DESC",
            &[&user.name],
        )
    } else {
        query_rows(&conn, "SELECT * FROM bookings ORDER BY id DESC", &[])
    }
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Fetch failed"))?;

    Ok(Json(Value::Array(rows)))
}

async fn bookings_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    let member = if user.role == "Клиент" {
        user.name
    } else {
        body_string(&body, "member", "")
    };

    let conn = lock_db(&state)?;
    conn.execute(
        "INSERT INTO bookings (member,classId,className,date,time,status) VALUES (?1,?2,?3,?4,?5,?6)",
        params![
            member,
            body_i64(&body, "classId", 0),
            body_string(&body, "className", ""),
            body_string(&body, "date", ""),
            body_string(&body, "time", ""),
            body_string(&body, "status", "Подтверждено")
        ],
    )
    .map_err(|e| map_db_write_error(e, "Create failed"))?;
    let id = conn.last_insert_rowid();

    recalculate_class_enrollment(&conn).ok();
    generate_notifications(&conn).ok();

    let created = query_one(&conn, "SELECT * FROM bookings WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?
        .unwrap_or_else(|| json!({}));

    Ok((StatusCode::CREATED, Json(created)).into_response())
}

async fn bookings_update(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;

    let existing = query_one(&conn, "SELECT * FROM bookings WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Booking not found"))?;

    if user.role == "Клиент" && value_string(&existing, "member") != user.name {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
    }

    let member = if user.role == "Клиент" {
        user.name
    } else {
        body_opt_string(&body, "member").unwrap_or_else(|| value_string(&existing, "member"))
    };

    let class_id = if body.get("classId").is_some() {
        body_i64(&body, "classId", 0)
    } else {
        value_i64(&existing, "classId")
    };

    let class_name = body_opt_string(&body, "className").unwrap_or_else(|| value_string(&existing, "className"));
    let date = body_opt_string(&body, "date").unwrap_or_else(|| value_string(&existing, "date"));
    let time = body_opt_string(&body, "time").unwrap_or_else(|| value_string(&existing, "time"));
    let status = body_opt_string(&body, "status").unwrap_or_else(|| value_string(&existing, "status"));

    conn.execute(
        "UPDATE bookings SET member = ?1, classId = ?2, className = ?3, date = ?4, time = ?5, status = ?6 WHERE id = ?7",
        params![member, class_id, class_name, date, time, status, id],
    )
    .map_err(|e| map_db_write_error(e, "Update failed"))?;

    recalculate_class_enrollment(&conn).ok();
    generate_notifications(&conn).ok();

    let updated = query_one(&conn, "SELECT * FROM bookings WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?
        .unwrap_or_else(|| json!({}));
    Ok(Json(updated))
}

async fn bookings_delete(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;

    if user.role == "Клиент" {
        let row = query_one(&conn, "SELECT * FROM bookings WHERE id = ?1", &[&id])
            .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;
        if let Some(r) = row {
            if value_string(&r, "member") != user.name {
                return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
            }
        } else {
            return Err(ApiError::new(StatusCode::NOT_FOUND, "Booking not found"));
        }
    }

    conn.execute("DELETE FROM bookings WHERE id = ?1", params![id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;
    recalculate_class_enrollment(&conn).ok();
    generate_notifications(&conn).ok();
    Ok(Json(json!({ "success": true })))
}

async fn payments_list(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;
    let rows = if user.role == "Клиент" {
        query_rows(
            &conn,
            "SELECT * FROM payments WHERE member = ?1 ORDER BY id DESC",
            &[&user.name],
        )
    } else {
        query_rows(&conn, "SELECT * FROM payments ORDER BY id DESC", &[])
    }
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Fetch failed"))?;

    Ok(Json(Value::Array(rows)))
}

async fn payments_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    let member = if user.role == "Клиент" {
        user.name
    } else {
        body_string(&body, "member", "")
    };

    let conn = lock_db(&state)?;
    conn.execute(
        "INSERT INTO payments (member,amount,method,date,status,receiptId,provider) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![
            member,
            body_i64(&body, "amount", 0),
            body_string(&body, "method", ""),
            body_string(&body, "date", &now_date()),
            body_string(&body, "status", "Оплачен"),
            body_i64(&body, "receiptId", 0),
            body_opt_string(&body, "provider")
        ],
    )
    .map_err(|e| map_db_write_error(e, "Create failed"))?;

    let id = conn.last_insert_rowid();
    generate_notifications(&conn).ok();

    let created = query_one(&conn, "SELECT * FROM payments WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?
        .unwrap_or_else(|| json!({}));

    Ok((StatusCode::CREATED, Json(created)).into_response())
}

async fn payments_update(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;

    let existing = query_one(&conn, "SELECT * FROM payments WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Payment not found"))?;

    if user.role == "Клиент" && value_string(&existing, "member") != user.name {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
    }

    let member = if user.role == "Клиент" {
        user.name
    } else {
        body_opt_string(&body, "member").unwrap_or_else(|| value_string(&existing, "member"))
    };

    let amount = if body.get("amount").is_some() {
        body_i64(&body, "amount", 0)
    } else {
        value_i64(&existing, "amount")
    };

    let method = body_opt_string(&body, "method").unwrap_or_else(|| value_string(&existing, "method"));
    let date = body_opt_string(&body, "date").unwrap_or_else(|| value_string(&existing, "date"));
    let status = body_opt_string(&body, "status").unwrap_or_else(|| value_string(&existing, "status"));

    let receipt_id = if body.get("receiptId").is_some() {
        body_i64(&body, "receiptId", 0)
    } else {
        value_i64(&existing, "receiptId")
    };

    let provider = body_opt_string(&body, "provider").unwrap_or_else(|| value_string(&existing, "provider"));

    conn.execute(
        "UPDATE payments SET member = ?1, amount = ?2, method = ?3, date = ?4, status = ?5, receiptId = ?6, provider = ?7 WHERE id = ?8",
        params![member, amount, method, date, status, receipt_id, provider, id],
    )
    .map_err(|e| map_db_write_error(e, "Update failed"))?;

    generate_notifications(&conn).ok();

    let updated = query_one(&conn, "SELECT * FROM payments WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?
        .unwrap_or_else(|| json!({}));

    Ok(Json(updated))
}

async fn payments_delete(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;

    if user.role == "Клиент" {
        let row = query_one(&conn, "SELECT * FROM payments WHERE id = ?1", &[&id])
            .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;
        if let Some(r) = row {
            if value_string(&r, "member") != user.name {
                return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
            }
        } else {
            return Err(ApiError::new(StatusCode::NOT_FOUND, "Payment not found"));
        }
    }

    conn.execute("DELETE FROM payments WHERE id = ?1", params![id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;
    generate_notifications(&conn).ok();
    Ok(Json(json!({ "success": true })))
}

async fn payment_providers(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let _user = auth_user(&headers, &state)?;
    Ok(Json(json!({
        "providers": [
            { "id": "yookassa", "name": "YooKassa" },
            { "id": "cloudpayments", "name": "CloudPayments" },
            { "id": "tinkoff", "name": "Тинькофф" },
            { "id": "sberpay", "name": "СберPay" },
            { "id": "sbp", "name": "СБП" }
        ]
    })))
}

async fn payment_mock_link(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let _user = auth_user(&headers, &state)?;
    let provider = body_string(&body, "provider", "provider");
    let amount = body_i64(&body, "amount", 0);
    let order_id = format!("ORD-{}", Uuid::new_v4().simple());
    let url = format!(
        "https://pay.demo/{}?amount={}&order={}",
        provider, amount, order_id
    );
    Ok(Json(json!({
        "url": url,
        "orderId": order_id,
        "provider": provider,
        "description": body_string(&body, "description", "Оплата услуг"),
    })))
}

async fn notifications_list(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let _user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;
    let rows = query_rows(&conn, "SELECT * FROM notifications ORDER BY id DESC", &[])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Fetch failed"))?;

    let mapped = rows
        .into_iter()
        .map(|mut row| {
            let read = value_bool(&row, "isRead");
            if let Some(obj) = row.as_object_mut() {
                obj.insert("read".to_string(), Value::Bool(read));
            }
            row
        })
        .collect::<Vec<_>>();

    Ok(Json(Value::Array(mapped)))
}

async fn notifications_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let title = body_opt_string(&body, "title")
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"))?;
    let message = body_opt_string(&body, "message")
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"))?;

    let conn = lock_db(&state)?;
    conn.execute(
        "INSERT INTO notifications (type,title,message,createdAt,isRead,refType,refId) VALUES (?1,?2,?3,?4,0,?5,?6)",
        params![
            body_string(&body, "type", "Система"),
            title,
            message,
            now_datetime_short(),
            "manual",
            format!("{}", Local::now().timestamp_millis())
        ],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?;

    let id = conn.last_insert_rowid();
    let mut created = query_one(&conn, "SELECT * FROM notifications WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?
        .unwrap_or_else(|| json!({}));
    let read = value_bool(&created, "isRead");
    if let Some(obj) = created.as_object_mut() {
        obj.insert("read".to_string(), Value::Bool(read));
    }

    Ok((StatusCode::CREATED, Json(created)).into_response())
}

async fn notifications_patch(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let _user = auth_user(&headers, &state)?;
    let read = value_bool(&body, "read");

    let conn = lock_db(&state)?;
    conn.execute(
        "UPDATE notifications SET isRead = ?1 WHERE id = ?2",
        params![if read { 1 } else { 0 }, id],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?;

    let mut updated = query_one(&conn, "SELECT * FROM notifications WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?
        .unwrap_or_else(|| json!({}));
    let read = value_bool(&updated, "isRead");
    if let Some(obj) = updated.as_object_mut() {
        obj.insert("read".to_string(), Value::Bool(read));
    }
    Ok(Json(updated))
}

async fn notifications_delete(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;
    let conn = lock_db(&state)?;
    conn.execute("DELETE FROM notifications WHERE id = ?1", params![id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;
    Ok(Json(json!({ "success": true })))
}

async fn memberships_list(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let _user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;
    let rows = query_rows(&conn, "SELECT * FROM membership_plans ORDER BY id DESC", &[])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Fetch failed"))?;

    let mapped = rows
        .into_iter()
        .map(|mut row| {
            let perks_json = value_string(&row, "perksJson");
            let perks = serde_json::from_str::<Value>(&perks_json).unwrap_or_else(|_| json!([]));
            if let Some(obj) = row.as_object_mut() {
                obj.insert("perks".to_string(), perks);
            }
            row
        })
        .collect::<Vec<_>>();

    Ok(Json(Value::Array(mapped)))
}

async fn memberships_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let name = body_opt_string(&body, "name")
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"))?;
    let price = body_i64(&body, "price", 0);
    if price <= 0 {
        return Err(ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"));
    }

    let perks = body
        .get("perks")
        .cloned()
        .unwrap_or_else(|| Value::Array(Vec::new()));

    let conn = lock_db(&state)?;
    conn.execute(
        "INSERT INTO membership_plans (name,price,period,visits,perksJson) VALUES (?1,?2,?3,?4,?5)",
        params![
            name,
            price,
            body_string(&body, "period", "месяц"),
            body_string(&body, "visits", "—"),
            perks.to_string()
        ],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?;

    let id = conn.last_insert_rowid();
    let mut created = query_one(&conn, "SELECT * FROM membership_plans WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?
        .unwrap_or_else(|| json!({}));
    let perks_json = value_string(&created, "perksJson");
    let perks_value = serde_json::from_str::<Value>(&perks_json).unwrap_or_else(|_| json!([]));
    if let Some(obj) = created.as_object_mut() {
        obj.insert("perks".to_string(), perks_value);
    }

    Ok((StatusCode::CREATED, Json(created)).into_response())
}

async fn memberships_update(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let perks = body
        .get("perks")
        .cloned()
        .unwrap_or_else(|| Value::Array(Vec::new()));

    let conn = lock_db(&state)?;
    conn.execute(
        "UPDATE membership_plans SET name = ?1, price = ?2, period = ?3, visits = ?4, perksJson = ?5 WHERE id = ?6",
        params![
            body_string(&body, "name", ""),
            body_i64(&body, "price", 0),
            body_string(&body, "period", "месяц"),
            body_string(&body, "visits", "—"),
            perks.to_string(),
            id
        ],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?;

    let mut updated = query_one(&conn, "SELECT * FROM membership_plans WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?
        .unwrap_or_else(|| json!({}));
    let perks_json = value_string(&updated, "perksJson");
    let perks_value = serde_json::from_str::<Value>(&perks_json).unwrap_or_else(|_| json!([]));
    if let Some(obj) = updated.as_object_mut() {
        obj.insert("perks".to_string(), perks_value);
    }

    Ok(Json(updated))
}

async fn memberships_delete(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    conn.execute("DELETE FROM membership_plans WHERE id = ?1", params![id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;

    Ok(Json(json!({ "success": true })))
}

async fn crm_notes_list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    let rows = if let Some(member_id) = query.get("memberId") {
        query_rows(
            &conn,
            "SELECT * FROM crm_notes WHERE memberId = ?1 ORDER BY id DESC",
            &[member_id as &dyn ToSql],
        )
    } else {
        query_rows(&conn, "SELECT * FROM crm_notes ORDER BY id DESC", &[])
    }
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Fetch failed"))?;

    Ok(Json(Value::Array(rows)))
}

async fn crm_notes_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let member_id = body_i64(&body, "memberId", 0);
    let text = body_opt_string(&body, "text")
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"))?;
    if member_id <= 0 {
        return Err(ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"));
    }

    let conn = lock_db(&state)?;
    conn.execute(
        "INSERT INTO crm_notes (memberId,text,createdAt) VALUES (?1,?2,?3)",
        params![member_id, text, body_string(&body, "createdAt", &now_date())],
    )
    .map_err(|e| map_db_write_error(e, "Create failed"))?;

    let id = conn.last_insert_rowid();
    let created = query_one(&conn, "SELECT * FROM crm_notes WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?
        .unwrap_or_else(|| json!({}));

    Ok((StatusCode::CREATED, Json(created)).into_response())
}

async fn crm_notes_delete(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    conn.execute("DELETE FROM crm_notes WHERE id = ?1", params![id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;

    Ok(Json(json!({ "success": true })))
}

async fn calendar_slots_list(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    let rows = query_rows(
        &conn,
        "SELECT * FROM calendar_slots ORDER BY date ASC, time ASC",
        &[],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Fetch failed"))?;

    Ok(Json(Value::Array(rows)))
}

async fn calendar_slots_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    if body_opt_string(&body, "date").is_none()
        || body_opt_string(&body, "time").is_none()
        || body_opt_string(&body, "className").is_none()
    {
        return Err(ApiError::new(StatusCode::BAD_REQUEST, "Missing fields"));
    }

    let conn = lock_db(&state)?;
    conn.execute(
        "INSERT INTO calendar_slots (date,time,className,trainer,capacity,booked) VALUES (?1,?2,?3,?4,?5,?6)",
        params![
            body_string(&body, "date", ""),
            body_string(&body, "time", ""),
            body_string(&body, "className", ""),
            body_string(&body, "trainer", ""),
            body_i64(&body, "capacity", 0),
            body_i64(&body, "booked", 0)
        ],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?;

    let id = conn.last_insert_rowid();
    let created = query_one(&conn, "SELECT * FROM calendar_slots WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?
        .unwrap_or_else(|| json!({}));

    Ok((StatusCode::CREATED, Json(created)).into_response())
}

async fn calendar_slots_delete(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    conn.execute("DELETE FROM calendar_slots WHERE id = ?1", params![id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;

    Ok(Json(json!({ "success": true })))
}

async fn services_list(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let _user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;
    let rows = query_rows(&conn, "SELECT * FROM services ORDER BY id ASC", &[])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Fetch failed"))?;
    Ok(Json(Value::Array(rows)))
}

async fn receipts_list(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;

    let rows = if user.role == "Клиент" {
        query_rows(
            &conn,
            "SELECT * FROM receipts WHERE memberName = ?1 ORDER BY id DESC",
            &[&user.name],
        )
    } else {
        query_rows(&conn, "SELECT * FROM receipts ORDER BY id DESC", &[])
    }
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Fetch failed"))?;

    let mapped = rows
        .into_iter()
        .map(|mut row| {
            let items_json = value_string(&row, "itemsJson");
            let items = serde_json::from_str::<Value>(&items_json).unwrap_or_else(|_| json!([]));
            if let Some(obj) = row.as_object_mut() {
                obj.insert("items".to_string(), items);
            }
            row
        })
        .collect::<Vec<_>>();

    Ok(Json(Value::Array(mapped)))
}

async fn receipts_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;

    let (member_id, member_name, membership) = if user.role == "Клиент" {
        let profile = query_one(
            &conn,
            "SELECT * FROM members WHERE email = ?1 ORDER BY id DESC LIMIT 1",
            &[&user.email],
        )
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Member profile not found"))?;
        (
            value_i64(&profile, "id"),
            user.name,
            value_string(&profile, "membership"),
        )
    } else {
        (
            body_i64(&body, "memberId", 0),
            body_string(&body, "memberName", ""),
            body_string(&body, "membership", ""),
        )
    };

    let items = body.get("items").cloned().unwrap_or_else(|| Value::Array(Vec::new()));

    conn.execute(
        "INSERT INTO receipts (memberId,memberName,membership,itemsJson,subtotal,discount,total,createdAt,note,paymentId) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            member_id,
            member_name,
            membership,
            items.to_string(),
            body_i64(&body, "subtotal", 0),
            body_i64(&body, "discount", 0),
            body_i64(&body, "total", 0),
            body_string(&body, "createdAt", &now_iso()),
            body_string(&body, "note", ""),
            body_i64(&body, "paymentId", 0)
        ],
    )
    .map_err(|e| map_db_write_error(e, "Create failed"))?;

    let id = conn.last_insert_rowid();
    let mut created = query_one(&conn, "SELECT * FROM receipts WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?
        .unwrap_or_else(|| json!({}));
    let items_json = value_string(&created, "itemsJson");
    let parsed = serde_json::from_str::<Value>(&items_json).unwrap_or_else(|_| json!([]));
    if let Some(obj) = created.as_object_mut() {
        obj.insert("items".to_string(), parsed);
    }

    Ok((StatusCode::CREATED, Json(created)).into_response())
}

async fn receipts_update(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    let conn = lock_db(&state)?;

    let existing = query_one(&conn, "SELECT * FROM receipts WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Receipt not found"))?;

    if user.role == "Клиент" && value_string(&existing, "memberName") != user.name {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Forbidden"));
    }

    let payment_id = if body.get("paymentId").is_some() {
        body_i64(&body, "paymentId", 0)
    } else {
        value_i64(&existing, "paymentId")
    };
    let note = body_opt_string(&body, "note").unwrap_or_else(|| value_string(&existing, "note"));

    conn.execute(
        "UPDATE receipts SET paymentId = ?1, note = ?2 WHERE id = ?3",
        params![payment_id, note, id],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?;

    let mut updated = query_one(&conn, "SELECT * FROM receipts WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?
        .unwrap_or_else(|| json!({}));
    let items_json = value_string(&updated, "itemsJson");
    let parsed = serde_json::from_str::<Value>(&items_json).unwrap_or_else(|_| json!([]));
    if let Some(obj) = updated.as_object_mut() {
        obj.insert("items".to_string(), parsed);
    }

    Ok(Json(updated))
}

async fn deals_list(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    let rows = query_rows(&conn, "SELECT * FROM deals ORDER BY id DESC", &[])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Fetch failed"))?;

    Ok(Json(Value::Array(rows)))
}

async fn deals_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    conn.execute(
        "INSERT INTO deals (client,offer,value,stage,probability,manager,nextStep,date) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![
            body_string(&body, "client", ""),
            body_string(&body, "offer", ""),
            body_i64(&body, "value", 0),
            body_string(&body, "stage", "Лид"),
            body_i64(&body, "probability", 0),
            body_string(&body, "manager", ""),
            body_string(&body, "nextStep", ""),
            body_string(&body, "date", &now_date())
        ],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?;

    let id = conn.last_insert_rowid();
    let created = query_one(&conn, "SELECT * FROM deals WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Create failed"))?
        .unwrap_or_else(|| json!({}));

    Ok((StatusCode::CREATED, Json(created)).into_response())
}

async fn deals_update(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    conn.execute(
        "UPDATE deals SET client = ?1, offer = ?2, value = ?3, stage = ?4, probability = ?5, manager = ?6, nextStep = ?7, date = ?8 WHERE id = ?9",
        params![
            body_string(&body, "client", ""),
            body_string(&body, "offer", ""),
            body_i64(&body, "value", 0),
            body_string(&body, "stage", "Лид"),
            body_i64(&body, "probability", 0),
            body_string(&body, "manager", ""),
            body_string(&body, "nextStep", ""),
            body_string(&body, "date", ""),
            id
        ],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?;

    let updated = query_one(&conn, "SELECT * FROM deals WHERE id = ?1", &[&id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?
        .unwrap_or_else(|| json!({}));

    Ok(Json(updated))
}

async fn deals_delete(
    Path(id): Path<i64>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    conn.execute("DELETE FROM deals WHERE id = ?1", params![id])
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;

    Ok(Json(json!({ "success": true })))
}

async fn analytics_overview(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    let data = build_analytics(&conn)
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Analytics failed"))?;
    Ok(Json(data))
}

async fn forecast(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let conn = lock_db(&state)?;
    let rows = query_rows(
        &conn,
        "SELECT month, visits, pool, tennis FROM demand_history ORDER BY id ASC",
        &[],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Forecast failed"))?;

    Ok(Json(json!({ "history": rows })))
}

async fn search_all(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор", "Тренер"])?;

    let q = query.get("q").cloned().unwrap_or_default().to_lowercase();
    if q.trim().is_empty() {
        return Ok(Json(json!({
            "members": [],
            "trainers": [],
            "classes": [],
            "deals": [],
            "receipts": [],
        })));
    }

    let like = format!("%{}%", q);
    let conn = lock_db(&state)?;
    let members = query_rows(
        &conn,
        "SELECT * FROM members WHERE LOWER(name) LIKE ?1 OR LOWER(email) LIKE ?1 OR LOWER(membership) LIKE ?1",
        &[&like],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Search failed"))?;

    let trainers = query_rows(
        &conn,
        "SELECT * FROM trainers WHERE LOWER(name) LIKE ?1 OR LOWER(specialty) LIKE ?1",
        &[&like],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Search failed"))?;

    let classes = query_rows(
        &conn,
        "SELECT * FROM classes WHERE LOWER(name) LIKE ?1 OR LOWER(level) LIKE ?1",
        &[&like],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Search failed"))?;

    let deals = query_rows(
        &conn,
        "SELECT * FROM deals WHERE LOWER(client) LIKE ?1 OR LOWER(offer) LIKE ?1 OR LOWER(manager) LIKE ?1",
        &[&like],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Search failed"))?;

    let receipts = query_rows(
        &conn,
        "SELECT * FROM receipts WHERE LOWER(memberName) LIKE ?1 OR LOWER(membership) LIKE ?1 OR LOWER(note) LIKE ?1",
        &[&like],
    )
    .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Search failed"))?
    .into_iter()
    .map(|mut r| {
        let items_json = value_string(&r, "itemsJson");
        let items = serde_json::from_str::<Value>(&items_json).unwrap_or_else(|_| json!([]));
        if let Some(obj) = r.as_object_mut() {
            obj.insert("items".to_string(), items);
        }
        r
    })
    .collect::<Vec<_>>();

    Ok(Json(json!({
        "members": members,
        "trainers": trainers,
        "classes": classes,
        "deals": deals,
        "receipts": receipts,
    })))
}

async fn reports_members(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор"])?;

    let membership = query.get("membership").cloned().unwrap_or_default();
    let status = query.get("status").cloned().unwrap_or_default();
    let format = query.get("format").cloned().unwrap_or_else(|| "json".to_string());

    let conn = lock_db(&state)?;
    let mut sql = "SELECT * FROM members WHERE 1=1".to_string();
    let mut params_vec: Vec<String> = Vec::new();
    if !membership.is_empty() {
        sql.push_str(" AND membership = ?");
        params_vec.push(membership.clone());
    }
    if !status.is_empty() {
        sql.push_str(" AND status = ?");
        params_vec.push(status.clone());
    }

    let dyn_params: Vec<&dyn ToSql> = params_vec.iter().map(|s| s as &dyn ToSql).collect();
    let rows = query_rows(&conn, &sql, &dyn_params)
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Report failed"))?;

    if format == "csv" {
        let mut csv = String::from("ID,Имя,Email,Телефон,Абонемент,Дата,Статус\n");
        for r in &rows {
            csv.push_str(&format!(
                "{},\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
                value_i64(r, "id"),
                value_string(r, "name"),
                value_string(r, "email"),
                value_string(r, "phone"),
                value_string(r, "membership"),
                value_string(r, "joinDate"),
                value_string(r, "status")
            ));
        }
        return Ok(csv_response("members_report.csv", csv));
    }

    Ok(Json(json!({
        "data": rows,
        "count": rows.len(),
        "timestamp": now_iso(),
    }))
    .into_response())
}

async fn reports_payments(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор"])?;

    let status = query.get("status").cloned().unwrap_or_default();
    let format = query.get("format").cloned().unwrap_or_else(|| "json".to_string());

    let conn = lock_db(&state)?;
    let (sql, params_vec) = if status.is_empty() {
        (
            "SELECT * FROM payments WHERE 1=1".to_string(),
            Vec::<String>::new(),
        )
    } else {
        (
            "SELECT * FROM payments WHERE 1=1 AND status = ?".to_string(),
            vec![status.clone()],
        )
    };

    let dyn_params: Vec<&dyn ToSql> = params_vec.iter().map(|s| s as &dyn ToSql).collect();
    let rows = query_rows(&conn, &sql, &dyn_params)
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Report failed"))?;

    let total: i64 = rows.iter().map(|r| value_i64(r, "amount")).sum();

    if format == "csv" {
        let mut csv = String::from("ID,Клиент,Сумма,Метод,Дата,Статус\n");
        for r in &rows {
            csv.push_str(&format!(
                "{},\"{}\",{},\"{}\",\"{}\",\"{}\"\n",
                value_i64(r, "id"),
                value_string(r, "member"),
                value_i64(r, "amount"),
                value_string(r, "method"),
                value_string(r, "date"),
                value_string(r, "status")
            ));
        }
        csv.push_str(&format!("\n\nОбщая сумма:,{}", total));
        return Ok(csv_response("payments_report.csv", csv));
    }

    Ok(Json(json!({
        "data": rows,
        "total": total,
        "count": rows.len(),
        "timestamp": now_iso(),
    }))
    .into_response())
}

async fn reports_bookings(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> ApiResult<Response> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор"])?;

    let status = query.get("status").cloned().unwrap_or_default();
    let format = query.get("format").cloned().unwrap_or_else(|| "json".to_string());

    let conn = lock_db(&state)?;
    let (sql, params_vec) = if status.is_empty() {
        (
            "SELECT * FROM bookings WHERE 1=1".to_string(),
            Vec::<String>::new(),
        )
    } else {
        (
            "SELECT * FROM bookings WHERE 1=1 AND status = ?".to_string(),
            vec![status.clone()],
        )
    };

    let dyn_params: Vec<&dyn ToSql> = params_vec.iter().map(|s| s as &dyn ToSql).collect();
    let rows = query_rows(&conn, &sql, &dyn_params)
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Report failed"))?;

    if format == "csv" {
        let mut csv = String::from("ID,Клиент,Тренировка,Дата,Время,Статус\n");
        for r in &rows {
            csv.push_str(&format!(
                "{},\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
                value_i64(r, "id"),
                value_string(r, "member"),
                value_string(r, "className"),
                value_string(r, "date"),
                value_string(r, "time"),
                value_string(r, "status")
            ));
        }
        return Ok(csv_response("bookings_report.csv", csv));
    }

    Ok(Json(json!({
        "data": rows,
        "count": rows.len(),
        "timestamp": now_iso(),
    }))
    .into_response())
}

async fn reports_summary(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let user = auth_user(&headers, &state)?;
    require_roles(&user, &["Администратор"])?;

    let conn = lock_db(&state)?;
    let total_members: i64 = conn
        .query_row("SELECT COUNT(*) FROM members", [], |r| r.get(0))
        .unwrap_or(0);
    let total_trainers: i64 = conn
        .query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0))
        .unwrap_or(0);
    let total_classes: i64 = conn
        .query_row("SELECT COUNT(*) FROM classes", [], |r| r.get(0))
        .unwrap_or(0);
    let total_revenue: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'Оплачен'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let confirmed_bookings: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM bookings WHERE status = 'Подтверждено'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    Ok(Json(json!({
        "summary": {
            "totalMembers": total_members,
            "totalTrainers": total_trainers,
            "totalClasses": total_classes,
            "totalRevenue": total_revenue,
            "confirmedBookings": confirmed_bookings,
        },
        "timestamp": now_iso(),
    })))
}

async fn yookassa_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let _user = auth_user(&headers, &state)?;
    let amount = body_f64(&body, "amount", 0.0);
    let payment_id = format!("yk_{}", Uuid::new_v4().simple());
    Ok(Json(json!({
        "id": payment_id,
        "status": "pending",
        "amount": { "value": format!("{:.2}", amount), "currency": "RUB" },
        "confirmation": {
            "type": "redirect",
            "confirmation_url": format!(
                "https://pay.demo/yookassa/confirm?paymentId={}",
                Uuid::new_v4().simple()
            )
        }
    })))
}

async fn tinkoff_init(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let _user = auth_user(&headers, &state)?;
    let order_id = body_opt_string(&body, "orderId")
        .unwrap_or_else(|| format!("ORD-{}", Local::now().timestamp_millis()));
    let payment_id = format!("tk_{}", Uuid::new_v4().simple());
    Ok(Json(json!({
        "Success": true,
        "OrderId": order_id,
        "PaymentId": payment_id,
        "PaymentURL": format!("https://pay.demo/tinkoff/pay?paymentId={}", Uuid::new_v4().simple()),
    })))
}

fn demo_svg(label: &str) -> String {
    format!(
        "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><rect width='220' height='220' fill='#ffffff' stroke='#111827' stroke-width='2'/><text x='110' y='100' text-anchor='middle' font-size='14' fill='#111827'>{}</text><text x='110' y='125' text-anchor='middle' font-size='12' fill='#374151'>DEMO QR</text></svg>",
        label
    )
}

async fn tinkoff_sbp_qr(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(_body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let _user = auth_user(&headers, &state)?;
    Ok(Json(json!({ "Success": true, "QrCode": demo_svg("СБП") })))
}

async fn tinkoff_sberpay_qr(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(_body): Json<Value>,
) -> ApiResult<Json<Value>> {
    let _user = auth_user(&headers, &state)?;
    Ok(Json(json!({ "Success": true, "QrCode": demo_svg("SberPay") })))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db_path = env::var("RUST_DB_PATH").unwrap_or_else(|_| "data.db".to_string());
    let port = env::var("PORT")
        .ok()
        .and_then(|s| s.parse::<u16>().ok())
        .unwrap_or(4000);
    let backup_dir = env::var("RUST_BACKUP_DIR").unwrap_or_else(|_| "backups".to_string());
    let backup_keep = env::var("RUST_BACKUP_KEEP")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(14);

    let conn = Connection::open(db_path)?;
    init_db(&conn)?;

    let state = AppState {
        db: Arc::new(Mutex::new(conn)),
    };

    if let Ok(conn) = state.db.lock() {
        match run_sqlite_backup(&conn, &backup_dir, backup_keep) {
            Ok(path) => println!("Initial DB backup created at {}", path.to_string_lossy()),
            Err(err) => eprintln!("Initial DB backup failed: {}", err),
        }
    }

    let scheduler_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(15 * 60));
        loop {
            interval.tick().await;
            if let Ok(conn) = scheduler_state.db.lock() {
                let _ = generate_notifications(&conn);
            }
        }
    });

    let backup_state = state.clone();
    let backup_dir_for_task = backup_dir.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(24 * 60 * 60));
        interval.tick().await;
        loop {
            interval.tick().await;
            if let Ok(conn) = backup_state.db.lock() {
                match run_sqlite_backup(&conn, &backup_dir_for_task, backup_keep) {
                    Ok(path) => println!("Daily DB backup created at {}", path.to_string_lossy()),
                    Err(err) => eprintln!("Daily DB backup failed: {}", err),
                }
            }
        }
    });

    let app = Router::new()
        .route("/", get(root))
        .route("/api/ping", get(ping))
        .route("/api/auth/register", post(auth_register))
        .route("/api/auth/login", post(auth_login))
        .route("/api/auth/vk-demo", post(auth_vk_demo))
        .route("/api/auth/vk/complete", post(auth_vk_complete))
        .route("/api/auth/vk/login", get(auth_vk_login))
        .route("/api/auth/vk/callback", get(auth_vk_callback))
        .route("/api/auth/me", get(auth_me))
        .route("/api/auth/profile", patch(auth_profile_update).post(auth_profile_update))
        .route("/api/auth/logout", post(auth_logout))
        .route("/api/users", get(users_list).post(users_create))
        .route("/api/users/:id", put(users_update))
        .route(
            "/api/members",
            get(members_list).post(members_create),
        )
        .route(
            "/api/members/:id",
            put(members_update).delete(members_delete),
        )
        .route(
            "/api/trainers",
            get(trainers_list).post(trainers_create),
        )
        .route(
            "/api/trainers/:id",
            put(trainers_update).delete(trainers_delete),
        )
        .route("/api/workout-templates", get(workout_templates_list))
        .route("/api/workout-templates/:id", get(workout_template_get))
        .route("/api/classes", get(classes_list).post(classes_create))
        .route(
            "/api/classes/:id",
            put(classes_update).delete(classes_delete),
        )
        .route("/api/bookings", get(bookings_list).post(bookings_create))
        .route(
            "/api/bookings/:id",
            put(bookings_update).delete(bookings_delete),
        )
        .route("/api/payments", get(payments_list).post(payments_create))
        .route(
            "/api/payments/:id",
            put(payments_update).delete(payments_delete),
        )
        .route("/api/payments/providers", get(payment_providers))
        .route("/api/payments/mock-link", post(payment_mock_link))
        .route(
            "/api/notifications",
            get(notifications_list).post(notifications_create),
        )
        .route(
            "/api/notifications/:id",
            patch(notifications_patch).delete(notifications_delete),
        )
        .route(
            "/api/memberships",
            get(memberships_list).post(memberships_create),
        )
        .route(
            "/api/memberships/:id",
            put(memberships_update).delete(memberships_delete),
        )
        .route("/api/crm/notes", get(crm_notes_list).post(crm_notes_create))
        .route("/api/crm/notes/:id", delete(crm_notes_delete))
        .route(
            "/api/calendar/slots",
            get(calendar_slots_list).post(calendar_slots_create),
        )
        .route("/api/calendar/slots/:id", delete(calendar_slots_delete))
        .route("/api/services", get(services_list))
        .route("/api/receipts", get(receipts_list).post(receipts_create))
        .route("/api/receipts/:id", put(receipts_update))
        .route("/api/deals", get(deals_list).post(deals_create))
        .route("/api/deals/:id", put(deals_update).delete(deals_delete))
        .route("/api/analytics/overview", get(analytics_overview))
        .route("/api/forecast", get(forecast))
        .route("/api/search", get(search_all))
        .route("/api/reports/members", get(reports_members))
        .route("/api/reports/payments", get(reports_payments))
        .route("/api/reports/bookings", get(reports_bookings))
        .route("/api/reports/summary", get(reports_summary))
        .route("/api/payments/yookassa/create", post(yookassa_create))
        .route("/api/payments/tinkoff/init", post(tinkoff_init))
        .route("/api/payments/tinkoff/sbp-qr", post(tinkoff_sbp_qr))
        .route("/api/payments/tinkoff/sberpay-qr", post(tinkoff_sberpay_qr))
        .with_state(state)
        .layer(CorsLayer::very_permissive());

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    println!("Rust API server listening on http://{}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}
