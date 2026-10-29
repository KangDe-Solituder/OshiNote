//! A migration owns one physical connection for its entire lifetime.
use serde_json::{Value, Map, json};
use sqlx::{Connection, Row, Column, TypeInfo, ValueRef, SqliteConnection};
use std::{collections::HashMap, sync::atomic::{AtomicU64, Ordering}};
use tauri::Manager;
use tauri::async_runtime::Mutex;

#[derive(Default)]
pub struct Sessions(pub Mutex<HashMap<String, SqliteConnection>>);
static SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub fn valid_database(name: &str) -> bool {
    name == "oshinote.db" || name.strip_prefix("restore-").and_then(|s| s.strip_suffix(".db"))
        .is_some_and(|s| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit() || b == b'-'))
}

#[tauri::command]
pub async fn begin_database_migration(app: tauri::AppHandle, sessions: tauri::State<'_, Sessions>, database_url: String) -> Result<String, String> {
    let name = database_url.strip_prefix("sqlite:").ok_or("Invalid database URL")?;
    if !valid_database(name) { return Err("Invalid migration database".into()); }
    let root = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let path = root.join(name);
    let mut active = sessions.0.lock().await;
    if !active.is_empty() { return Err("A database migration is already running. Restart if it was interrupted.".into()); }
    let mut db = SqliteConnection::connect_with(&sqlx::sqlite::SqliteConnectOptions::new().filename(&path).busy_timeout(std::time::Duration::from_secs(10)))
        .await.map_err(|e| e.to_string())?;
    let version: i64 = sqlx::query_scalar("PRAGMA user_version").fetch_one(&mut db).await.map_err(|e| e.to_string())?;
    if version > 2 { return Err("This database requires a newer OshiNote version.".into()); }
    // VACUUM INTO includes committed WAL content and never overwrites an earlier safety copy.
    if name == "oshinote.db" && version < 2 {
        let snapshot = root.join(format!("oshinote.before-v2-{}.db", super::timestamp_id()));
        sqlx::query("VACUUM INTO ?").bind(snapshot.to_string_lossy().as_ref()).execute(&mut db).await.map_err(|e| e.to_string())?;
    }
    start(&mut db).await?;
    let token = format!("migration-{}", SEQUENCE.fetch_add(1, Ordering::Relaxed));
    active.insert(token.clone(), db);
    Ok(token)
}

async fn start(db: &mut SqliteConnection) -> Result<(), String> {
    sqlx::query("PRAGMA foreign_keys = OFF").execute(&mut *db).await.map_err(|e| e.to_string())?;
    sqlx::query("PRAGMA secure_delete = ON").execute(&mut *db).await.map_err(|e| e.to_string())?;
    sqlx::query("BEGIN IMMEDIATE").execute(&mut *db).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn migration_query(sessions: tauri::State<'_, Sessions>, token: String, query: String, values: Vec<Value>, select: bool) -> Result<Value, String> {
    let mut active = sessions.0.lock().await;
    let db = active.get_mut(&token).ok_or("Migration session expired")?;
    let upper = query.trim().to_ascii_uppercase();
    // Transaction boundaries are exclusively owned by finish_database_migration.
    if ["BEGIN", "COMMIT", "ROLLBACK", "END", "ATTACH", "DETACH", "VACUUM"].iter().any(|s| upper.starts_with(s)) {
        return Err("Invalid migration operation".into());
    }
    if upper.starts_with("PRAGMA FOREIGN_KEYS") { return Ok(json!({"rowsAffected":0})); }
    let mut statement = sqlx::query(&query);
    for v in values {
        statement = match v { Value::Null => statement.bind(None::<String>), Value::String(v) => statement.bind(v),
            Value::Number(v) if v.is_i64() => statement.bind(v.as_i64().unwrap()),
            Value::Number(v) => statement.bind(v.as_f64().unwrap_or_default()), Value::Bool(v) => statement.bind(v), other => statement.bind(other.to_string()) };
    }
    if select {
        let rows = statement.fetch_all(db).await.map_err(|e| e.to_string())?;
        let mut result = Vec::new();
        for row in rows {
            let mut object = Map::new();
            for (i, column) in row.columns().iter().enumerate() {
                let raw = row.try_get_raw(i).map_err(|e| e.to_string())?;
                let value = if raw.is_null() { Value::Null } else { match raw.type_info().name() {
                    "INTEGER" | "BOOLEAN" => json!(row.try_get::<i64,_>(i).map_err(|e| e.to_string())?),
                    "REAL" => json!(row.try_get::<f64,_>(i).map_err(|e| e.to_string())?),
                    "BLOB" => json!(row.try_get::<Vec<u8>,_>(i).map_err(|e| e.to_string())?),
                    _ => json!(row.try_get::<String,_>(i).map_err(|e| e.to_string())?),
                }};
                object.insert(column.name().to_string(), value);
            }
            result.push(Value::Object(object));
        }
        Ok(Value::Array(result))
    } else {
        let result = statement.execute(db).await.map_err(|e| e.to_string())?;
        Ok(json!({"rowsAffected":result.rows_affected(),"lastInsertId":result.last_insert_rowid()}))
    }
}

#[tauri::command]
pub async fn finish_database_migration(sessions: tauri::State<'_, Sessions>, token: String, commit: bool) -> Result<(), String> {
    let mut db = sessions.0.lock().await.remove(&token).ok_or("Migration session expired")?;
    let result = finish(&mut db, commit).await;
    // Never return a connection with changed PRAGMAs to the SQL plugin pool.
    let _ = db.close().await;
    result
}
async fn finish(db: &mut SqliteConnection, commit: bool) -> Result<(), String> {
    if commit {
        let violations = sqlx::query("PRAGMA foreign_key_check").fetch_all(&mut *db).await.map_err(|e| e.to_string())?;
        if !violations.is_empty() {
            let _ = sqlx::query("ROLLBACK").execute(&mut *db).await;
            return Err("Migration would leave broken references; changes were rolled back.".into());
        }
    }
    sqlx::query(if commit { "COMMIT" } else { "ROLLBACK" }).execute(db).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn migration_rollback_preserves_table_after_drop() {
        tauri::async_runtime::block_on(async {
            let mut db = SqliteConnection::connect("sqlite::memory:").await.unwrap();
            sqlx::raw_sql("CREATE TABLE original(id TEXT); INSERT INTO original VALUES ('kept');").execute(&mut db).await.unwrap();
            start(&mut db).await.unwrap();
            sqlx::raw_sql("CREATE TABLE replacement AS SELECT * FROM original; DROP TABLE original;").execute(&mut db).await.unwrap();
            assert!(sqlx::query("ALTER TABLE missing RENAME TO original").execute(&mut db).await.is_err());
            finish(&mut db, false).await.unwrap();
            let value: String = sqlx::query_scalar("SELECT id FROM original").fetch_one(&mut db).await.unwrap();
            assert_eq!(value, "kept");
        });
    }
    #[test]
    fn migration_database_names_are_scoped() {
        assert!(valid_database("oshinote.db")); assert!(valid_database("restore-123-4.db"));
        for name in ["../oshinote.db", "restore-../x.db", "other.db", "restore-.db"] { assert!(!valid_database(name)); }
    }
}
