use super::*;
use sqlx::Connection;
use std::sync::atomic::{AtomicU64, Ordering};

const DATABASE_SCHEMA_VERSION: u32 = 2;
static SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[tauri::command]
pub fn ensure_database_available(app: tauri::AppHandle) -> Result<(), String> {
    if app.path().app_config_dir().map_err(|e| e.to_string())?.join("restore-activation.json").exists() {
        Err("Restore recovery is pending. Restart OshiNote before opening the database.".into())
    } else { Ok(()) }
}

#[derive(Serialize)]
pub struct PreparedRestore {
    token: String,
    database_url: String,
    media_prefix: String,
    created_at: String,
    app_version: Option<String>,
    database_schema_version: u32,
    mode: String,
}

#[derive(Serialize)]
pub struct BackupEntry { name: String, path: String, bytes: u64 }

fn token() -> String { format!("{}-{}", timestamp_id(), SEQUENCE.fetch_add(1, Ordering::Relaxed)) }
fn validate_token(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 80 || !value.bytes().all(|b| b.is_ascii_digit() || b == b'-') {
        return Err("Invalid restore session.".into());
    }
    Ok(())
}
fn paths(app: &tauri::AppHandle, token: &str) -> Result<(PathBuf, PathBuf), String> {
    validate_token(token)?;
    Ok((app.path().app_data_dir().map_err(|e| e.to_string())?.join(format!(".restore-{token}")),
        app.path().app_config_dir().map_err(|e| e.to_string())?.join(format!("restore-{token}.db"))))
}

pub(super) fn database_version(path: &Path) -> Result<u32, String> {
    tauri::async_runtime::block_on(async {
        let mut db = sqlx::SqliteConnection::connect_with(&sqlx::sqlite::SqliteConnectOptions::new().filename(path).read_only(true)).await.map_err(|e| e.to_string())?;
        let value: i64 = sqlx::query_scalar("PRAGMA user_version").fetch_one(&mut db).await.map_err(|e| e.to_string())?;
        db.close().await.map_err(|e| e.to_string())?;
        Ok(value as u32)
    })
}

fn check_database(path: &Path, migrated: bool) -> Result<(), String> {
    tauri::async_runtime::block_on(async {
        let mut db = sqlx::SqliteConnection::connect_with(&sqlx::sqlite::SqliteConnectOptions::new().filename(path).read_only(true)).await.map_err(|e| e.to_string())?;
        let version: i64 = sqlx::query_scalar("PRAGMA user_version").fetch_one(&mut db).await.map_err(|e| e.to_string())?;
        if version > DATABASE_SCHEMA_VERSION as i64 || (migrated && version != DATABASE_SCHEMA_VERSION as i64) {
            return Err("Database schema is unsupported. Update OshiNote before restoring.".into());
        }
        let check: String = sqlx::query_scalar("PRAGMA quick_check").fetch_one(&mut db).await.map_err(|e| e.to_string())?;
        if check != "ok" { return Err(format!("Backup database integrity check failed: {check}")); }
        for table in ["oshis", "notes", "settings"] {
            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?").bind(table).fetch_one(&mut db).await.map_err(|e| e.to_string())?;
            if count == 0 { return Err(format!("Backup database is missing table: {table}")); }
        }
        if migrated && !sqlx::query("PRAGMA foreign_key_check").fetch_all(&mut db).await.map_err(|e| e.to_string())?.is_empty() {
            return Err("Backup contains broken database references.".into());
        }
        db.close().await.map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn prepare_backup_restore(app: tauri::AppHandle, archive_path: String) -> Result<PreparedRestore, String> {
    let mut archive = ZipArchive::new(File::open(&archive_path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let manifest = read_manifest(&mut archive)?;
    if manifest.schema_version.unwrap_or(1) > 4 || manifest.database_schema_version.unwrap_or(0) > DATABASE_SCHEMA_VERSION {
        return Err("This backup requires a newer OshiNote version. Update the app first.".into());
    }
    if manifest.database != "database/oshinote.db" { return Err("Invalid backup database path.".into()); }
    if manifest.mode != "complete" { return Err("Select a complete backup. Database-only diagnostic files cannot restore media.".into()); }
    let id = token();
    let (staging, database) = paths(&app, &id)?;
    fs::create_dir_all(&staging).map_err(|e| e.to_string())?;
    let result = (|| {
        extract_backup_file(&mut archive, "database/oshinote.db", &database)?;
        check_database(&database, false)?;
        for name in ["media", "fonts"] {
            // Empty trees are deliberate: do not keep unrelated current files after restoration.
            fs::create_dir_all(staging.join(name)).map_err(|e| e.to_string())?;
            extract_backup_tree(&mut archive, &format!("appdata/{name}/"), &staging.join(name))?;
        }
        validate_backup_media(&database, &staging)?;
        fs::write(staging.join("manifest.json"), serde_json::to_vec(&manifest).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        Ok(PreparedRestore { token: id.clone(), database_url: format!("sqlite:restore-{id}.db"), media_prefix: format!(".restore-{id}"),
            created_at: manifest.created_at, app_version: manifest.app_version, database_schema_version: database_version(&database)?, mode: manifest.mode })
    })();
    if result.is_err() { let _ = discard_prepared_restore(app, id); }
    result
}

#[tauri::command]
pub fn validate_prepared_restore(app: tauri::AppHandle, token: String) -> Result<(), String> {
    let (staging, database) = paths(&app, &token)?;
    if !staging.join("manifest.json").is_file() { return Err("Restore session expired.".into()); }
    check_database(&database, true)?;
    validate_backup_media(&database, &staging)?;
    fs::write(staging.join("validated"), b"ok").map_err(|e| e.to_string())
}

#[derive(Serialize, Deserialize)]
struct Activation { token: String, existed: Vec<bool> }

fn activation_paths(app: &tauri::AppHandle, token: &str) -> Result<Vec<(PathBuf, PathBuf, PathBuf)>, String> {
    let (staging, database) = paths(app, token)?;
    let config = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(vec![(database, config.join("oshinote.db"), config.join(format!("oshinote.db.before-{token}"))),
        (staging.join("media"), data.join("media"), data.join(format!(".media.before-{token}"))),
        (staging.join("fonts"), data.join("fonts"), data.join(format!(".fonts.before-{token}")))])
}
fn remove_path(path: &Path) -> Result<(), String> {
    if path.is_dir() { fs::remove_dir_all(path).map_err(|e| e.to_string()) }
    else if path.exists() { fs::remove_file(path).map_err(|e| e.to_string()) }
    else { Ok(()) }
}
fn rollback(entries: &[(PathBuf, PathBuf, PathBuf)], existed: &[bool]) -> Result<(), String> {
    for ((source, target, previous), had_original) in entries.iter().zip(existed).rev() {
        if previous.exists() {
            remove_path(target)?;
            fs::rename(previous, target).map_err(|e| format!("Could not roll back restore: {e}"))?;
        } else if !had_original && !source.exists() { remove_path(target)?; }
    }
    Ok(())
}

// Called on startup before any database is opened; an interrupted activation is rolled back.
pub fn recover_interrupted_restore(app: &tauri::AppHandle) -> Result<(), String> {
    let journal = app.path().app_config_dir().map_err(|e| e.to_string())?.join("restore-activation.json");
    if !journal.exists() { return Ok(()); }
    let state: Activation = serde_json::from_slice(&fs::read(&journal).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    if state.existed.len() != 3 { return Err("Invalid restore activation record.".into()); }
    rollback(&activation_paths(app, &state.token)?, &state.existed)?;
    fs::remove_file(journal).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn activate_prepared_restore(app: tauri::AppHandle, token: String) -> Result<(), String> {
    let (staging, _) = paths(&app, &token)?;
    if !staging.join("validated").is_file() { return Err("Validate and migrate the backup before restoring.".into()); }
    validate_prepared_restore(app.clone(), token.clone())?;
    let entries = activation_paths(&app, &token)?;
    let config = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let journal = config.join("restore-activation.json");
    if journal.exists() { return Err("An interrupted restore needs recovery. Restart OshiNote.".into()); }
    // The frontend checkpoints and closes both SQLite connections before reaching here.
    for suffix in ["-wal", "-shm"] { remove_path(&config.join(format!("oshinote.db{suffix}")))?; }
    let state = Activation { token: token.clone(), existed: entries.iter().map(|(_, t, _)| t.exists()).collect() };
    let journal_temp = config.join(format!("restore-activation-{token}.writing"));
    let journal_result = (|| {
        let mut file = OpenOptions::new().write(true).create_new(true).open(&journal_temp).map_err(|e| e.to_string())?;
        file.write_all(&serde_json::to_vec(&state).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        fs::rename(&journal_temp, &journal).map_err(|e| e.to_string())
    })();
    if let Err(error) = journal_result { let _ = fs::remove_file(&journal_temp); return Err(error); }
    for (source, target, previous) in &entries {
        let result = (|| {
            if target.exists() { fs::rename(target, previous).map_err(|e| e.to_string())?; }
            fs::rename(source, target).map_err(|e| e.to_string())
        })();
        if let Err(error) = result {
            rollback(&entries, &state.existed)?;
            fs::remove_file(&journal).map_err(|e| e.to_string())?;
            return Err(format!("Restore was rolled back: {error}"));
        }
    }
    // Removing the journal is the commit point. Prior data is kept until that succeeds.
    if let Err(error) = fs::remove_file(&journal) {
        rollback(&entries, &state.existed)?;
        return Err(error.to_string());
    }
    for (_, _, previous) in entries { let _ = remove_path(&previous); }
    let _ = discard_prepared_restore(app, token);
    Ok(())
}

#[tauri::command]
pub fn discard_prepared_restore(app: tauri::AppHandle, token: String) -> Result<(), String> {
    let (staging, database) = paths(&app, &token)?;
    // Never destroy files needed by recovery after a partial activation.
    if app.path().app_config_dir().map_err(|e| e.to_string())?.join("restore-activation.json").exists() { return Ok(()); }
    remove_path(&staging)?;
    remove_path(&database)?;
    for suffix in ["-wal", "-shm"] { remove_path(&PathBuf::from(format!("{}{suffix}", database.display())))?; }
    Ok(())
}

#[tauri::command]
pub fn create_directory_backup(app: tauri::AppHandle, directory: Option<String>, sync_metadata: Option<BackupSyncMetadata>) -> Result<BackupSummary, String> {
    let root = match directory { Some(value) => PathBuf::from(value), None => app.path().app_data_dir().map_err(|e| e.to_string())?.join("backups") };
    if !root.is_absolute() { return Err("Choose an absolute backup directory.".into()); }
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    for tree in ["media", "fonts"] { if root.starts_with(data.join(tree)) { return Err("Choose a backup directory outside the managed media and fonts folders.".into()); } }
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let canonical_root = fs::canonicalize(&root).map_err(|e| e.to_string())?;
    for tree in ["media", "fonts"] {
        if let Ok(managed) = fs::canonicalize(data.join(tree)) {
            if canonical_root.starts_with(managed) { return Err("Choose a backup directory outside managed media and fonts.".into()); }
        }
    }
    let destination = root.join(format!("oshinote-{}.oshi.zip", token()));
    let temporary = destination.with_extension("zip.writing");
    let result = create_backup_archive(&app, &temporary, true, sync_metadata.as_ref());
    match result {
        Ok(mut summary) => { fs::rename(&temporary, &destination).map_err(|e| e.to_string())?; summary.path = destination.display().to_string(); Ok(summary) },
        Err(error) => { let _ = fs::remove_file(temporary); Err(error) }
    }
}

#[tauri::command]
pub fn list_directory_backups(directory: String) -> Result<Vec<BackupEntry>, String> {
    let root = PathBuf::from(directory);
    if !root.is_absolute() { return Err("Choose an absolute backup directory.".into()); }
    let mut entries = Vec::new();
    for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if entry.file_type().map_err(|e| e.to_string())?.is_file() && name.ends_with(".oshi.zip") {
            entries.push(BackupEntry { name, path: entry.path().display().to_string(), bytes: entry.metadata().map_err(|e| e.to_string())?.len() });
        }
    }
    entries.sort_by(|a,b| b.name.cmp(&a.name));
    Ok(entries)
}

#[tauri::command]
pub async fn inspect_legacy_webdav_backup(config: WebDavConfig) -> Result<Option<BackupEntry>, String> {
    let response = webdav_client(&config)?.head(webdav_file_url(&config, WEBDAV_BACKUP_NAME)?).basic_auth(&config.username, Some(&config.password)).send().await.map_err(|e| e.to_string())?;
    if response.status().as_u16() == 404 { return Ok(None); }
    if !response.status().is_success() { return Err(format!("Backup check failed: {}", response.status())); }
    let bytes = response.headers().get("content-length").and_then(|v| v.to_str().ok()).and_then(|v| v.parse().ok()).unwrap_or(0);
    Ok(Some(BackupEntry { name: WEBDAV_BACKUP_NAME.into(), path: WEBDAV_BACKUP_NAME.into(), bytes }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> PathBuf {
        let root = std::env::temp_dir().join(format!("oshinote-restore-test-{}", token()));
        fs::create_dir_all(&root).unwrap(); root
    }
    fn database(path: &Path, version: u32) {
        tauri::async_runtime::block_on(async {
            let mut db = sqlx::SqliteConnection::connect_with(&sqlx::sqlite::SqliteConnectOptions::new().filename(path).create_if_missing(true)).await.unwrap();
            for sql in ["CREATE TABLE oshis(id TEXT PRIMARY KEY)", "CREATE TABLE notes(id TEXT PRIMARY KEY)", "CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)"] {
                sqlx::query(sql).execute(&mut db).await.unwrap();
            }
            sqlx::query(&format!("PRAGMA user_version={version}")).execute(&mut db).await.unwrap();
            db.close().await.unwrap();
        });
    }
    #[test]
    fn rejects_newer_and_corrupt_databases_without_altering_them() {
        let root = fixture(); let path = root.join("newer.db"); database(&path, 999);
        let original = fs::read(&path).unwrap();
        assert!(check_database(&path, false).unwrap_err().contains("unsupported"));
        assert_eq!(fs::read(&path).unwrap(), original);
        fs::write(root.join("broken.db"), b"not a database").unwrap();
        assert!(check_database(&root.join("broken.db"), false).is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn unversioned_backup_must_be_migrated_before_activation() {
        let root = fixture(); let path = root.join("old.db"); database(&path, 0);
        assert!(check_database(&path, false).is_ok());
        assert!(check_database(&path, true).is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn rollback_recovers_each_partial_activation_boundary() {
        // Simulate interruption before/after every old-file and new-file move.
        for moves in 0..=6 {
            let root = fixture();
            let entries: Vec<_> = (0..3).map(|i| {
                let source = root.join(format!("new-{i}")); let target = root.join(format!("active-{i}")); let previous = root.join(format!("previous-{i}"));
                fs::write(&source, format!("new-{i}")).unwrap(); fs::write(&target, format!("old-{i}")).unwrap(); (source,target,previous)
            }).collect();
            let mut moved = 0;
            for (source,target,previous) in &entries {
                if moved == moves { break; } fs::rename(target,previous).unwrap(); moved += 1;
                if moved == moves { break; } fs::rename(source,target).unwrap(); moved += 1;
            }
            rollback(&entries, &[true,true,true]).unwrap();
            for (i,(_,target,_)) in entries.iter().enumerate() { assert_eq!(fs::read_to_string(target).unwrap(), format!("old-{i}")); }
            fs::remove_dir_all(root).unwrap();
        }
    }
    #[test]
    fn rollback_removes_new_trees_when_no_original_existed() {
        let root = fixture(); let source = root.join("source"); let target = root.join("target"); let previous = root.join("previous");
        fs::create_dir_all(&target).unwrap(); fs::write(target.join("new.png"), b"new").unwrap();
        rollback(&[(source,target.clone(),previous)], &[false]).unwrap();
        assert!(!target.exists()); fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn restore_session_ids_cannot_escape_managed_directories() {
        assert!(validate_token("123-0").is_ok());
        for value in ["", "../foo", "C:/data", "123/456"] { assert!(validate_token(value).is_err()); }
    }
}
