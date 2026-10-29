use super::*;
use sqlx::Connection;

pub const MAX_ENTRY_BYTES: u64 = 8 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 32 * 1024 * 1024 * 1024;
const MAX_ENTRIES: usize = 100_000;
pub const MAX_MANIFEST_BYTES: u64 = 1024 * 1024;

pub fn check_archive(archive: &mut ZipArchive<File>) -> Result<(), String> {
    if archive.len() > MAX_ENTRIES { return Err("Backup contains too many entries.".into()); }
    let mut total = 0u64;
    let mut paths = std::collections::HashSet::new();
    for i in 0..archive.len() {
        let file = archive.by_index(i).map_err(|e| e.to_string())?;
        let path = file.name().replace('\\', "/");
        safe_relative_path(&path)?;
        if !paths.insert(path.to_ascii_lowercase()) { return Err("Backup contains duplicate paths.".into()); }
        if file.size() > MAX_ENTRY_BYTES { return Err("Backup entry exceeds the 8 GiB limit.".into()); }
        total = total.checked_add(file.size()).ok_or("Backup size overflow")?;
        if total > MAX_TOTAL_BYTES { return Err("Backup exceeds the 32 GiB extraction limit.".into()); }
    }
    Ok(())
}

pub fn copy_bounded(reader: &mut impl Read, writer: &mut impl Write, limit: u64) -> Result<u64, String> {
    let bytes = std::io::copy(&mut reader.take(limit + 1), writer).map_err(|e| e.to_string())?;
    if bytes > limit { return Err("Backup entry exceeds its extraction budget.".into()); }
    Ok(bytes)
}

// The active DB is read-only. Only the private export copy is sanitized and rebuilt.
pub fn sanitized_copy(source: &Path, output: &Path) -> Result<(), String> {
    tauri::async_runtime::block_on(async {
        let mut source_db = sqlx::SqliteConnection::connect_with(&sqlx::sqlite::SqliteConnectOptions::new().filename(source).read_only(true)).await.map_err(|e| e.to_string())?;
        sqlx::query("VACUUM INTO ?").bind(output.to_string_lossy().as_ref()).execute(&mut source_db).await.map_err(|e| e.to_string())?;
        source_db.close().await.map_err(|e| e.to_string())?;
        let mut copy = sqlx::SqliteConnection::connect_with(&sqlx::sqlite::SqliteConnectOptions::new().filename(output)).await.map_err(|e| e.to_string())?;
        sqlx::query("PRAGMA secure_delete = ON").execute(&mut copy).await.map_err(|e| e.to_string())?;
        // Settings have a closed list of portable UI preferences. Connection locations and credentials are device-local.
        sqlx::query("DELETE FROM settings WHERE key NOT IN ('theme','glassEnabled','customBg','bgFilters','hotkeys','fontSize','uiMotionDuration','textTone','simpleMode','locale','checkUpdatesOnStartup','stampSoundEnabled','ftsIndexRebuilt')").execute(&mut copy).await.map_err(|e| e.to_string())?;
        // Transient sync records may contain previous settings payloads. Restore already starts a fresh association.
        for table in ["sync_state", "sync_conflicts"] {
            let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE name=? AND type='table'").bind(table).fetch_one(&mut copy).await.map_err(|e| e.to_string())?;
            if exists > 0 { sqlx::query(&format!("DELETE FROM {table}")).execute(&mut copy).await.map_err(|e| e.to_string())?; }
        }
        sqlx::query("VACUUM").execute(&mut copy).await.map_err(|e| e.to_string())?;
        copy.close().await.map_err(|e| e.to_string())?;
        Ok(())
    })
}

pub struct TemporaryDatabase(pub PathBuf);
impl Drop for TemporaryDatabase {
    fn drop(&mut self) {
        for suffix in ["", "-wal", "-shm", "-journal"] { let _ = fs::remove_file(format!("{}{suffix}", self.0.display())); }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn export_scrubs_secret_bytes_without_touching_original() {
        let root = std::env::temp_dir().join(format!("oshinote-scrub-{}", timestamp_id())); fs::create_dir_all(&root).unwrap();
        let source = root.join("source.db"); let dest = root.join("copy.db");
        tauri::async_runtime::block_on(async {
            let mut db = sqlx::SqliteConnection::connect_with(&sqlx::sqlite::SqliteConnectOptions::new().filename(&source).create_if_missing(true)).await.unwrap();
            sqlx::raw_sql("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT); INSERT INTO settings VALUES('aiConfig','SYNTHETIC-SECRET-123'),('webdavPassword','SYNTHETIC-DAV-456'),('theme','dark-night'); CREATE TABLE notes(id TEXT); INSERT INTO notes VALUES('preserved');").execute(&mut db).await.unwrap();
            db.close().await.unwrap();
        });
        sanitized_copy(&source, &dest).unwrap();
        let bytes = fs::read(&dest).unwrap();
        assert!(!String::from_utf8_lossy(&bytes).contains("SYNTHETIC-SECRET"));
        assert!(!String::from_utf8_lossy(&bytes).contains("SYNTHETIC-DAV"));
        assert!(String::from_utf8_lossy(&fs::read(&source).unwrap()).contains("SYNTHETIC-SECRET"));
        assert!(String::from_utf8_lossy(&bytes).contains("preserved"));
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn actual_extraction_is_bounded() {
        let mut input = &b"123456"[..]; let mut output = Vec::new();
        assert!(copy_bounded(&mut input, &mut output, 3).is_err()); assert_eq!(output.len(),4);
    }
}
