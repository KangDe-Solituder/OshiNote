mod data_sync;
mod database_session;
mod backup_flow;
mod backup_safety;
mod credentials;

use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const BACKUP_FORMAT: &str = "oshinote-backup";
const BACKUP_VERSION: u32 = 2;
const WEBDAV_BACKUP_NAME: &str = "oshinote-latest-full.oshi.zip";

const MAX_ILLUSTRATION_MEDIA_BYTES: u64 = 25 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize)]
struct BackupManifest {
    format: String,
    version: u32,
    mode: String,
    created_at: String,
    database: String,
    included_paths: Vec<String>,
    #[serde(default)]
    repository_id: Option<String>,
    #[serde(default)]
    head_commit: Option<String>,
    #[serde(default)]
    schema_version: Option<u32>,
    #[serde(default)]
    app_version: Option<String>,
    #[serde(default)]
    database_schema_version: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct BackupSyncMetadata {
    repository_id: Option<String>,
    head_commit: Option<String>,
    schema_version: Option<u32>,
}

#[derive(Debug, Serialize)]
struct BackupSummary {
    mode: String,
    path: String,
    included_paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct WebDavConfig {
    base_url: String,
    username: String,
    password: String,
    remote_path: String,
    allow_invalid_cert: bool,
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !(trimmed.starts_with("https://") || trimmed.starts_with("http://")) {
        return Err("Only http:// and https:// links can be opened.".to_string());
    }

    #[cfg(target_os = "windows")]
    let status = Command::new("rundll32.exe")
        .args(["url.dll,FileProtocolHandler", trimmed])
        .status();
    #[cfg(target_os = "macos")]
    let status = Command::new("open").arg(trimmed).status();
    #[cfg(all(unix, not(target_os = "macos")))]
    let status = Command::new("xdg-open").arg(trimmed).status();

    status.map_err(|error| error.to_string()).and_then(|exit| {
        if exit.success() {
            Ok(())
        } else {
            Err("Could not open the system browser.".to_string())
        }
    })
}

#[tauri::command]
fn read_illustration_media_file(
    app: tauri::AppHandle,
    relative_path: String,
) -> Result<Vec<u8>, String> {
    let normalized_path = relative_path.replace('\\', "/");
    if !normalized_path.starts_with("media/illustrations/")
        || normalized_path.starts_with('/')
        || normalized_path.contains("../")
        || normalized_path.contains(':')
    {
        return Err("Invalid illustration media path.".to_string());
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let media_path = app_data_dir.join(Path::new(&normalized_path));
    let metadata = fs::metadata(&media_path).map_err(|error| {
        format!("Could not access illustration media file {normalized_path}: {error}")
    })?;
    if !metadata.is_file() || metadata.len() > MAX_ILLUSTRATION_MEDIA_BYTES {
        return Err("Illustration media file is invalid or too large.".to_string());
    }
    fs::read(media_path).map_err(|error| {
        format!("Could not read illustration media file {normalized_path}: {error}")
    })
}

#[tauri::command]
async fn download_stamp_font(
    app: tauri::AppHandle,
    url: String,
    relative_path: String,
) -> Result<(), String> {
    let trimmed_url = url.trim();
    if !trimmed_url.starts_with("https://raw.githubusercontent.com/google/fonts/") {
        return Err("Only bundled stamp font sources can be downloaded.".to_string());
    }

    let normalized_path = relative_path.replace('\\', "/");
    if !normalized_path.starts_with("fonts/stamps/") || normalized_path.contains("..") {
        return Err("Invalid stamp font path.".to_string());
    }

    let response = Client::builder().connect_timeout(std::time::Duration::from_secs(15)).timeout(std::time::Duration::from_secs(180)).build().map_err(|e| e.to_string())?.get(trimmed_url).send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Font download failed: {}", response.status()));
    }
    let bytes = data_sync::bounded_response(response, 64 * 1024 * 1024).await?;

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let target_path = app_data_dir.join(Path::new(&normalized_path));
    if let Some(parent) = target_path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    std::fs::write(target_path, bytes).map_err(|error| error.to_string())
}

fn create_backup_archive(
    app: &tauri::AppHandle,
    destination: &Path,
    include_media: bool,
    sync_metadata: Option<&BackupSyncMetadata>,
) -> Result<BackupSummary, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let app_config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    let database_path = app_config_dir.join("oshinote.db");
    if !database_path.exists() {
        return Err("The OshiNote database does not exist yet.".to_string());
    }
    if include_media { validate_backup_media(&database_path, &app_data_dir)?; }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let mode = if include_media { "complete" } else { "data" };
    let included_paths = if include_media {
        ["media", "fonts"].into_iter().map(String::from).collect()
    } else {
        Vec::new()
    };
    let manifest = BackupManifest {
        format: BACKUP_FORMAT.to_string(),
        version: BACKUP_VERSION,
        mode: mode.to_string(),
        created_at: format_timestamp(),
        database: "database/oshinote.db".to_string(),
        included_paths: included_paths.clone(),
        repository_id: sync_metadata.and_then(|metadata| metadata.repository_id.clone()),
        head_commit: sync_metadata.and_then(|metadata| metadata.head_commit.clone()),
        schema_version: sync_metadata.and_then(|metadata| metadata.schema_version),
        app_version: Some(env!("CARGO_PKG_VERSION").to_string()),
        database_schema_version: Some(backup_flow::database_version(&database_path)?),
    };

    let file =
        File::create(destination).map_err(|error| format!("Could not create backup: {error}"))?;
    let mut writer = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    writer
        .start_file("manifest.json", options)
        .map_err(|error| error.to_string())?;
    let manifest_json = serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?;
    writer
        .write_all(&manifest_json)
        .map_err(|error| error.to_string())?;
    let clean_database = backup_safety::TemporaryDatabase(destination.with_extension(format!("sanitized-{}.db", timestamp_id())));
    backup_safety::sanitized_copy(&database_path, &clean_database.0)?;
    add_file_to_archive(&mut writer, &clean_database.0, "database/oshinote.db", options)?;

    if include_media {
        for path in &included_paths {
            let source = app_data_dir.join(path);
            if source.exists() {
                add_tree_to_archive(
                    &mut writer,
                    &source,
                    &format!("appdata/{path}"),
                    options,
                    destination,
                )?;
            }
        }
    }
    writer.finish().map_err(|error| error.to_string())?;
    Ok(BackupSummary {
        mode: mode.to_string(),
        path: destination.display().to_string(),
        included_paths,
    })
}

fn add_file_to_archive(
    writer: &mut ZipWriter<File>,
    source: &Path,
    archive_name: &str,
    options: SimpleFileOptions,
) -> Result<(), String> {
    let mut file = File::open(source).map_err(|error| error.to_string())?;
    writer
        .start_file(archive_name, options)
        .map_err(|error| error.to_string())?;
    std::io::copy(&mut file, writer).map_err(|error| error.to_string())?;
    Ok(())
}

fn add_tree_to_archive(
    writer: &mut ZipWriter<File>,
    root: &Path,
    archive_root: &str,
    options: SimpleFileOptions,
    destination: &Path,
) -> Result<(), String> {
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if entry.file_type().map_err(|e| e.to_string())?.is_symlink() { return Err("Backup media cannot contain symbolic links.".into()); }
        if path == destination {
            continue;
        }
        let name = format!("{archive_root}/{}", entry.file_name().to_string_lossy());
        if path.is_dir() {
            add_tree_to_archive(writer, &path, &name, options, destination)?;
        } else if path.is_file() {
            add_file_to_archive(writer, &path, &name, options)?;
        }
    }
    Ok(())
}

fn read_manifest(archive: &mut ZipArchive<File>) -> Result<BackupManifest, String> {
    backup_safety::check_archive(archive)?;
    let mut file = archive
        .by_name("manifest.json")
        .map_err(|_| "Backup manifest is missing.".to_string())?;
    let mut json = String::new();
    if file.size() > backup_safety::MAX_MANIFEST_BYTES { return Err("Backup manifest is too large.".into()); }
    (&mut file).take(backup_safety::MAX_MANIFEST_BYTES + 1).read_to_string(&mut json)
        .map_err(|error| error.to_string())?;
    if json.len() as u64 > backup_safety::MAX_MANIFEST_BYTES { return Err("Backup manifest is too large.".into()); }
    let manifest: BackupManifest =
        serde_json::from_str(&json).map_err(|error| format!("Invalid backup manifest: {error}"))?;
    if manifest.format != BACKUP_FORMAT
        || !(manifest.version == 1 || manifest.version == BACKUP_VERSION)
    {
        return Err("Unsupported OshiNote backup format.".to_string());
    }
    if manifest.mode != "data" && manifest.mode != "complete" {
        return Err("Unsupported backup mode.".to_string());
    }
    Ok(manifest)
}

fn extract_backup_file(
    archive: &mut ZipArchive<File>,
    archive_name: &str,
    destination: &Path,
) -> Result<(), String> {
    let mut file = archive
        .by_name(archive_name)
        .map_err(|_| "Backup database is missing.".to_string())?;
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let mut output = File::create(destination).map_err(|error| error.to_string())?;
    let budget = file.size().min(backup_safety::MAX_ENTRY_BYTES);
    backup_safety::copy_bounded(&mut file, &mut output, budget)?;
    Ok(())
}

fn extract_backup_tree(
    archive: &mut ZipArchive<File>,
    archive_prefix: &str,
    destination: &Path,
) -> Result<(), String> {
    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|error| error.to_string())?;
        let name = file.name().replace('\\', "/");
        if !name.starts_with(archive_prefix) || name.ends_with('/') {
            continue;
        }
        let relative = name.trim_start_matches(archive_prefix);
        let safe_relative = safe_relative_path(relative)?;
        let target = destination.join(safe_relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut output = File::create(target).map_err(|error| error.to_string())?;
        let budget = file.size().min(backup_safety::MAX_ENTRY_BYTES);
    backup_safety::copy_bounded(&mut file, &mut output, budget)?;
    }
    Ok(())
}

fn safe_relative_path(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if value.is_empty() || value.contains(':') || value.contains('\\') || path.is_absolute()
        || path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("Backup contains an unsafe path.".to_string());
    }
    Ok(path.to_path_buf())
}

// Check dependencies before replacing the active database or publishing a backup.
fn validate_backup_media(database: &Path, root: &Path) -> Result<(), String> {
    use sqlx::Connection;
    tauri::async_runtime::block_on(async {
        let options = sqlx::sqlite::SqliteConnectOptions::new().filename(database).read_only(true);
        let mut connection = sqlx::SqliteConnection::connect_with(&options).await.map_err(|e| e.to_string())?;
        for (table, column) in [("illustrations", "original_path"), ("journal_images", "file_path"), ("resource_versions", "file_path")] {
            let present: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?")
                .bind(table).fetch_one(&mut connection).await.map_err(|e| e.to_string())?;
            if present == 0 { continue; }
            let paths: Vec<String> = sqlx::query_scalar(&format!("SELECT DISTINCT {column} FROM {table} WHERE {column} IS NOT NULL AND {column} != ''"))
                .fetch_all(&mut connection).await.map_err(|e| e.to_string())?;
            for path in paths {
                let relative = safe_relative_path(&path)?;
                if !path.replace('\\', "/").starts_with("media/") || !root.join(relative).is_file() {
                    return Err(format!("Backup is missing required media: {path}"));
                }
            }
        }
        connection.close().await.map_err(|e| e.to_string())?;
        Ok(())
    })
}

fn webdav_client(config: &WebDavConfig) -> Result<Client, String> {
    validate_test_webdav_path(&config.base_url, &config.remote_path)?;
    Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        .read_timeout(std::time::Duration::from_secs(60))
        .timeout(std::time::Duration::from_secs(1800))
        .danger_accept_invalid_certs(config.allow_invalid_cert)
        .build()
        .map_err(|error| error.to_string())
}

pub(crate) fn validate_test_webdav_path(base_url: &str, remote_path: &str) -> Result<(), String> {
    validate_test_webdav_target(base_url, remote_path, option_env!("OSHINOTE_RESOURCE_TEST") == Some("1"))
}

fn validate_test_webdav_target(base_url: &str, remote_path: &str, isolated: bool) -> Result<(), String> {
    if !isolated { return Ok(()); }
    let url = Url::parse(base_url).map_err(|error| error.to_string())?;
    if url.path().trim_matches('/') != "" || remote_path.trim_matches('/') != "BackUp/OshiNote-ResourceTest" {
        return Err("Resource test builds only use BackUp/OshiNote-ResourceTest at the WebDAV root.".into());
    }
    Ok(())
}

#[cfg(test)]
mod resource_backup_tests {
    use super::*;
    use sqlx::{Connection, Executor};

    #[test]
    fn test_build_rejects_production_and_embedded_remote_paths() {
        assert!(validate_test_webdav_target("https://nas:5006", "BackUp/OshiNote", true).is_err());
        assert!(validate_test_webdav_target("https://nas:5006/BackUp/OshiNote", "BackUp/OshiNote-ResourceTest", true).is_err());
        assert!(validate_test_webdav_target("https://nas:5006", "BackUp/OshiNote-ResourceTest/../OshiNote", true).is_err());
        assert!(validate_test_webdav_target("https://nas:5006", "BackUp/OshiNote-ResourceTest", true).is_ok());
    }

    #[test]
    fn complete_backup_requires_retained_version_files() {
        let root = std::env::temp_dir().join(format!("oshinote-resource-backup-test-{}", timestamp_id()));
        fs::create_dir_all(root.join("media/resources")).unwrap();
        let database = root.join("oshinote.db");
        tauri::async_runtime::block_on(async {
            let options = sqlx::sqlite::SqliteConnectOptions::new().filename(&database).create_if_missing(true);
            let mut connection = sqlx::SqliteConnection::connect_with(&options).await.unwrap();
            connection.execute("CREATE TABLE resource_versions (file_path TEXT)").await.unwrap();
            connection.execute("INSERT INTO resource_versions VALUES ('media/resources/retained.png')").await.unwrap();
            connection.close().await.unwrap();
        });
        assert!(validate_backup_media(&database, &root).unwrap_err().contains("retained.png"));
        fs::write(root.join("media/resources/retained.png"), b"retained-version").unwrap();
        assert!(validate_backup_media(&database, &root).is_ok());
        fs::remove_dir_all(root).unwrap();
    }
}

fn webdav_directory_url(config: &WebDavConfig) -> Result<Url, String> {
    let mut url = Url::parse(config.base_url.trim_end_matches('/'))
        .map_err(|error| format!("Invalid WebDAV URL: {error}"))?;
    append_webdav_path(&mut url, &config.remote_path, None)?;
    Ok(url)
}

fn webdav_file_url(config: &WebDavConfig, file_name: &str) -> Result<Url, String> {
    let mut url = webdav_directory_url(config)?;
    append_webdav_path(&mut url, "", Some(file_name))?;
    Ok(url)
}

fn append_webdav_path(url: &mut Url, path: &str, file_name: Option<&str>) -> Result<(), String> {
    let mut segments = url
        .path_segments_mut()
        .map_err(|_| "Invalid WebDAV URL path.".to_string())?;
    for segment in path.split('/').filter(|segment| !segment.is_empty()) {
        segments.push(segment);
    }
    if let Some(file_name) = file_name {
        segments.push(file_name);
    }
    Ok(())
}

fn timestamp_id() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string()
}

fn format_timestamp() -> String {
    timestamp_id()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(database_session::Sessions::default())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            backup_flow::recover_interrupted_restore(app.handle()).map_err(std::io::Error::other)?;
            let window = app.get_webview_window("main").unwrap();
            // Choose the native/WebView backdrop before showing the window.
            // HTML takes over with the user's saved OshiNote theme afterwards.
            let background = match window.theme().unwrap_or(tauri::Theme::Dark) {
                tauri::Theme::Light => tauri::window::Color(250, 248, 244, 255),
                _ => tauri::window::Color(31, 26, 36, 255),
            };
            window.set_background_color(Some(background))?;
            window.show()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            download_stamp_font,
            open_external_url,
            read_illustration_media_file,
            credentials::protect_connection_secret,
            credentials::unprotect_connection_secret,
            database_session::begin_database_migration,
            database_session::migration_query,
            database_session::finish_database_migration,
            backup_flow::prepare_backup_restore,
            backup_flow::ensure_database_available,
            backup_flow::validate_prepared_restore,
            backup_flow::activate_prepared_restore,
            backup_flow::discard_prepared_restore,
            backup_flow::create_directory_backup,
            backup_flow::list_directory_backups,
            backup_flow::inspect_legacy_webdav_backup,
            data_sync::inspect_webdav_repository,
            data_sync::read_webdav_text,
            data_sync::write_webdav_text,
            data_sync::upload_webdav_app_data_file,
            data_sync::download_webdav_app_data_file,
            data_sync::activate_sync_cache_file,
            data_sync::inspect_sync_cache,
            data_sync::clear_sync_cache,
            data_sync::execute_sync_transaction
        ])
        .run(tauri::generate_context!())
        .expect("error while running OshiNote");
}
