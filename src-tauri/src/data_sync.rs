use reqwest::header::{HeaderMap, HeaderValue, DATE, ETAG, IF_MATCH, IF_NONE_MATCH, LAST_MODIFIED};
use reqwest::{Client, Method, StatusCode, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tauri_plugin_sql::{DbInstances, DbPool};

const SYNC_REF_PATH: &str = "sync/v1/refs/main.json";
const REPOSITORY_PATH: &str = "repository.json";
const MAX_TEXT_OBJECT_BYTES: usize = 32 * 1024 * 1024;
const APP_DATABASE_URL: &str = "sqlite:oshinote.db";
const SYNC_DATABASE_BUSY_TIMEOUT_MS: u64 = 10_000;

#[derive(Debug, Clone, Deserialize)]
pub struct WebDavDataConfig {
    base_url: String,
    username: String,
    password: String,
    remote_path: String,
    allow_invalid_cert: bool,
}

#[derive(Debug, Serialize)]
pub struct WebDavRepositoryInspection {
    connected: bool,
    repository_initialized: bool,
    server_date: Option<String>,
    remote_updated_at: Option<String>,
    remote_head: Option<String>,
    remote_generation: Option<u64>,
    head_etag: Option<String>,
    supports_etag: bool,
    supports_move: bool,
}

#[derive(Debug, Serialize)]
pub struct WebDavTextObject {
    exists: bool,
    text: Option<String>,
    etag: Option<String>,
    last_modified: Option<String>,
    server_date: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WebDavWriteResult {
    bytes: u64,
    etag: Option<String>,
    last_modified: Option<String>,
    server_date: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SyncCacheSummary {
    bytes: u64,
    files: u64,
}

#[derive(Debug, Deserialize)]
pub struct SyncDatabaseStatement {
    query: String,
    values: Vec<JsonValue>,
}

#[tauri::command]
pub async fn execute_sync_transaction(
    db_instances: tauri::State<'_, DbInstances>,
    statements: Vec<SyncDatabaseStatement>,
) -> Result<(), String> {
    if statements.is_empty() {
        return Ok(());
    }

    let instances = db_instances.0.read().await;
    let database = instances
        .get(APP_DATABASE_URL)
        .ok_or_else(|| "The OshiNote database is not loaded.".to_string())?;
    let pool = match database {
        DbPool::Sqlite(pool) => pool,
        #[allow(unreachable_patterns)]
        _ => return Err("The OshiNote database is not SQLite.".to_string()),
    };
    let mut connection = pool
        .acquire()
        .await
        .map_err(|error| format!("Could not acquire the sync database connection: {error}"))?;

    sqlx::query(&format!(
        "PRAGMA busy_timeout = {SYNC_DATABASE_BUSY_TIMEOUT_MS}"
    ))
    .execute(&mut *connection)
    .await
    .map_err(|error| format!("Could not configure the sync database connection: {error}"))?;
    sqlx::query("BEGIN IMMEDIATE")
        .execute(&mut *connection)
        .await
        .map_err(format_sync_database_error)?;

    for statement in statements {
        let mut query = sqlx::query(&statement.query);
        for value in statement.values {
            if value.is_null() {
                query = query.bind(None::<JsonValue>);
            } else if let Some(value) = value.as_str() {
                query = query.bind(value.to_owned());
            } else if let Some(value) = value.as_number() {
                query = query.bind(value.as_f64().unwrap_or_default());
            } else {
                query = query.bind(value);
            }
        }

        if let Err(error) = query.execute(&mut *connection).await {
            let _ = sqlx::query("ROLLBACK").execute(&mut *connection).await;
            return Err(format_sync_database_error(error));
        }
    }

    if let Err(error) = sqlx::query("COMMIT").execute(&mut *connection).await {
        let _ = sqlx::query("ROLLBACK").execute(&mut *connection).await;
        return Err(format_sync_database_error(error));
    }

    Ok(())
}

fn format_sync_database_error(error: sqlx::Error) -> String {
    if let sqlx::Error::Database(database_error) = &error {
        if database_error.code().as_deref() == Some("5") {
            return "The local database stayed busy for 10 seconds. Close any other OshiNote window and try the sync again.".to_string();
        }
    }
    format!("Could not apply incremental sync changes: {error}")
}

#[tauri::command]
pub async fn inspect_webdav_repository(
    config: WebDavDataConfig,
) -> Result<WebDavRepositoryInspection, String> {
    let client = webdav_client(&config)?;
    let root_url = webdav_directory_url(&config)?;
    let response = client
        .request(Method::from_bytes(b"PROPFIND").unwrap(), root_url)
        .basic_auth(&config.username, Some(&config.password))
        .header("Depth", "0")
        .body("")
        .send()
        .await
        .map_err(|error| format_webdav_error(error.to_string()))?;

    if !(response.status().is_success() || response.status().as_u16() == 207) {
        return Err(format!("WebDAV connection failed: {}", response.status()));
    }

    let server_date = header_value(response.headers(), DATE);
    let allow = response
        .headers()
        .get("allow")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_ascii_uppercase();
    let dav = response
        .headers()
        .get("dav")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();

    let repository = read_text_object(&client, &config, REPOSITORY_PATH).await?;
    let reference = read_text_object(&client, &config, SYNC_REF_PATH).await?;
    let (remote_head, remote_generation) = reference
        .text
        .as_deref()
        .and_then(|text| serde_json::from_str::<serde_json::Value>(text).ok())
        .map(|value| {
            let head = value
                .get("head")
                .and_then(|item| item.as_str())
                .map(String::from);
            let generation = value.get("generation").and_then(|item| item.as_u64());
            (head, generation)
        })
        .unwrap_or((None, None));

    Ok(WebDavRepositoryInspection {
        connected: true,
        repository_initialized: repository.exists && reference.exists,
        server_date,
        remote_updated_at: reference.last_modified.clone(),
        remote_head,
        remote_generation,
        head_etag: reference.etag.clone(),
        supports_etag: reference.etag.is_some() || !dav.is_empty(),
        supports_move: allow.contains("MOVE") || !dav.is_empty(),
    })
}

#[tauri::command]
pub async fn read_webdav_text(
    config: WebDavDataConfig,
    relative_path: String,
) -> Result<WebDavTextObject, String> {
    let client = webdav_client(&config)?;
    read_text_object(&client, &config, &relative_path).await
}

#[tauri::command]
pub async fn write_webdav_text(
    config: WebDavDataConfig,
    relative_path: String,
    text: String,
    if_match: Option<String>,
    if_none_match: bool,
) -> Result<WebDavWriteResult, String> {
    if text.len() > MAX_TEXT_OBJECT_BYTES {
        return Err("WebDAV text object is too large.".to_string());
    }
    let client = webdav_client(&config)?;
    ensure_webdav_relative_directories(&client, &config, &relative_path).await?;
    let url = webdav_relative_url(&config, &relative_path)?;
    let mut request = client
        .put(url)
        .basic_auth(&config.username, Some(&config.password))
        .header("Content-Type", "application/json")
        .body(text.clone());
    if let Some(etag) = if_match {
        let value = HeaderValue::from_str(&etag).map_err(|error| error.to_string())?;
        request = request.header(IF_MATCH, value);
    }
    if if_none_match {
        request = request.header(IF_NONE_MATCH, "*");
    }

    let response = request
        .send()
        .await
        .map_err(|error| format_webdav_error(error.to_string()))?;
    if response.status() == StatusCode::PRECONDITION_FAILED {
        return Err("WEBDAV_PRECONDITION_FAILED".to_string());
    }
    if !response.status().is_success() {
        return Err(format!("WebDAV write failed: {}", response.status()));
    }

    let mut result = WebDavWriteResult {
        bytes: text.len() as u64,
        etag: header_value(response.headers(), ETAG),
        last_modified: header_value(response.headers(), LAST_MODIFIED),
        server_date: header_value(response.headers(), DATE),
    };
    if result.etag.is_none() || result.last_modified.is_none() {
        let metadata = read_text_object(&client, &config, &relative_path).await?;
        result.etag = result.etag.or(metadata.etag);
        result.last_modified = result.last_modified.or(metadata.last_modified);
        result.server_date = result.server_date.or(metadata.server_date);
    }
    Ok(result)
}

#[tauri::command]
pub async fn upload_webdav_app_data_file(
    app: tauri::AppHandle,
    config: WebDavDataConfig,
    local_relative_path: String,
    remote_relative_path: String,
    if_none_match: bool,
) -> Result<WebDavWriteResult, String> {
    let local_path = resolve_managed_app_data_path(&app, &local_relative_path)?;
    let bytes = fs::read(&local_path)
        .map_err(|error| format!("Could not read {}: {error}", local_path.display()))?;
    let client = webdav_client(&config)?;
    ensure_webdav_relative_directories(&client, &config, &remote_relative_path).await?;
    let mut request = client
        .put(webdav_relative_url(&config, &remote_relative_path)?)
        .basic_auth(&config.username, Some(&config.password))
        .header("Content-Type", "application/octet-stream")
        .body(bytes.clone());
    if if_none_match {
        request = request.header(IF_NONE_MATCH, "*");
    }
    let response = request
        .send()
        .await
        .map_err(|error| format_webdav_error(error.to_string()))?;
    if response.status() == StatusCode::PRECONDITION_FAILED && if_none_match {
        return Ok(WebDavWriteResult {
            bytes: 0,
            etag: header_value(response.headers(), ETAG),
            last_modified: header_value(response.headers(), LAST_MODIFIED),
            server_date: header_value(response.headers(), DATE),
        });
    }
    if !response.status().is_success() {
        return Err(format!("WebDAV upload failed: {}", response.status()));
    }
    Ok(WebDavWriteResult {
        bytes: bytes.len() as u64,
        etag: header_value(response.headers(), ETAG),
        last_modified: header_value(response.headers(), LAST_MODIFIED),
        server_date: header_value(response.headers(), DATE),
    })
}

#[tauri::command]
pub async fn download_webdav_app_data_file(
    app: tauri::AppHandle,
    config: WebDavDataConfig,
    remote_relative_path: String,
    local_relative_path: String,
) -> Result<String, String> {
    if !local_relative_path
        .replace('\\', "/")
        .starts_with("sync-cache/")
    {
        return Err("WebDAV downloads must be staged in sync-cache.".to_string());
    }
    let local_path = resolve_managed_app_data_path(&app, &local_relative_path)?;
    let client = webdav_client(&config)?;
    let response = client
        .get(webdav_relative_url(&config, &remote_relative_path)?)
        .basic_auth(&config.username, Some(&config.password))
        .send()
        .await
        .map_err(|error| format_webdav_error(error.to_string()))?;
    if !response.status().is_success() {
        return Err(format!("WebDAV download failed: {}", response.status()));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format_webdav_error(error.to_string()))?;
    if let Some(parent) = local_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let incoming = local_path.with_extension(format!("incoming-{}", timestamp_id()));
    fs::write(&incoming, bytes).map_err(|error| error.to_string())?;
    let previous = local_path.with_extension(format!("before-sync-{}", timestamp_id()));
    if local_path.exists() {
        fs::rename(&local_path, &previous).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&incoming, &local_path) {
        if previous.exists() && !local_path.exists() {
            let _ = fs::rename(&previous, &local_path);
        }
        return Err(format!("Could not activate downloaded file: {error}"));
    }
    if previous.exists() {
        let _ = fs::remove_file(previous);
    }
    Ok(local_relative_path)
}

#[tauri::command]
pub fn activate_sync_cache_file(
    app: tauri::AppHandle,
    cache_relative_path: String,
    media_relative_path: String,
) -> Result<String, String> {
    let normalized_cache = cache_relative_path.replace('\\', "/");
    let normalized_media = media_relative_path.replace('\\', "/");
    if !normalized_cache.starts_with("sync-cache/") || !normalized_media.starts_with("media/") {
        return Err("Invalid sync cache activation paths.".to_string());
    }
    let source = resolve_managed_app_data_path(&app, &normalized_cache)?;
    let destination = resolve_managed_app_data_path(&app, &normalized_media)?;
    if !source.is_file() {
        return Err("Verified sync cache file is missing.".to_string());
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let incoming = destination.with_extension(format!("incoming-{}", timestamp_id()));
    fs::copy(&source, &incoming).map_err(|error| error.to_string())?;
    let previous = destination.with_extension(format!("before-sync-{}", timestamp_id()));
    if destination.exists() {
        fs::rename(&destination, &previous).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&incoming, &destination) {
        if previous.exists() && !destination.exists() {
            let _ = fs::rename(&previous, &destination);
        }
        return Err(format!("Could not activate verified sync media: {error}"));
    }
    if previous.exists() {
        let orphan = app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?
            .join("sync-cache")
            .join("orphans")
            .join(timestamp_id().to_string())
            .join(Path::new(&normalized_media));
        if let Some(parent) = orphan.parent() {
            if fs::create_dir_all(parent).is_ok() {
                let _ = fs::rename(&previous, orphan);
            }
        }
    }
    Ok(media_relative_path)
}

#[tauri::command]
pub fn inspect_sync_cache(app: tauri::AppHandle) -> Result<SyncCacheSummary, String> {
    let cache = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("sync-cache");
    directory_summary(&cache)
}

#[tauri::command]
pub fn clear_sync_cache(app: tauri::AppHandle) -> Result<SyncCacheSummary, String> {
    let cache = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("sync-cache");
    let summary = directory_summary(&cache)?;
    if cache.exists() {
        fs::remove_dir_all(&cache).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&cache).map_err(|error| error.to_string())?;
    Ok(summary)
}

async fn read_text_object(
    client: &Client,
    config: &WebDavDataConfig,
    relative_path: &str,
) -> Result<WebDavTextObject, String> {
    let response = client
        .get(webdav_relative_url(config, relative_path)?)
        .basic_auth(&config.username, Some(&config.password))
        .send()
        .await
        .map_err(|error| format_webdav_error(error.to_string()))?;
    if response.status() == StatusCode::NOT_FOUND {
        return Ok(WebDavTextObject {
            exists: false,
            text: None,
            etag: None,
            last_modified: None,
            server_date: header_value(response.headers(), DATE),
        });
    }
    if !response.status().is_success() {
        return Err(format!("WebDAV read failed: {}", response.status()));
    }
    let etag = header_value(response.headers(), ETAG);
    let last_modified = header_value(response.headers(), LAST_MODIFIED);
    let server_date = header_value(response.headers(), DATE);
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format_webdav_error(error.to_string()))?;
    if bytes.len() > MAX_TEXT_OBJECT_BYTES {
        return Err("WebDAV text object is too large.".to_string());
    }
    let text = String::from_utf8(bytes.to_vec())
        .map_err(|_| "WebDAV object is not valid UTF-8.".to_string())?;
    Ok(WebDavTextObject {
        exists: true,
        text: Some(text),
        etag,
        last_modified,
        server_date,
    })
}

fn webdav_client(config: &WebDavDataConfig) -> Result<Client, String> {
    Client::builder()
        .danger_accept_invalid_certs(config.allow_invalid_cert)
        .build()
        .map_err(|error| error.to_string())
}

fn webdav_directory_url(config: &WebDavDataConfig) -> Result<Url, String> {
    let mut url = Url::parse(config.base_url.trim_end_matches('/'))
        .map_err(|error| format!("Invalid WebDAV URL: {error}"))?;
    append_webdav_path(&mut url, &config.remote_path)?;
    Ok(url)
}

fn webdav_relative_url(config: &WebDavDataConfig, relative_path: &str) -> Result<Url, String> {
    validate_relative_path(relative_path)?;
    let mut url = webdav_directory_url(config)?;
    append_webdav_path(&mut url, relative_path)?;
    Ok(url)
}

fn append_webdav_path(url: &mut Url, path: &str) -> Result<(), String> {
    let mut segments = url
        .path_segments_mut()
        .map_err(|_| "Invalid WebDAV URL path.".to_string())?;
    for segment in path.split('/').filter(|segment| !segment.is_empty()) {
        segments.push(segment);
    }
    Ok(())
}

async fn ensure_webdav_relative_directories(
    client: &Client,
    config: &WebDavDataConfig,
    relative_path: &str,
) -> Result<(), String> {
    validate_relative_path(relative_path)?;
    let mut current =
        Url::parse(config.base_url.trim_end_matches('/')).map_err(|error| error.to_string())?;
    let mut directories: Vec<&str> = config
        .remote_path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    let mut relative: Vec<&str> = relative_path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    if !relative.is_empty() {
        relative.pop();
    }
    directories.extend(relative);
    for segment in directories {
        append_webdav_path(&mut current, segment)?;
        let response = client
            .request(Method::from_bytes(b"MKCOL").unwrap(), current.clone())
            .basic_auth(&config.username, Some(&config.password))
            .send()
            .await
            .map_err(|error| format_webdav_error(error.to_string()))?;
        if !(response.status().is_success()
            || response.status().as_u16() == 405
            || response.status().as_u16() == 301)
        {
            return Err(format!(
                "Could not create WebDAV directory: {}",
                response.status()
            ));
        }
    }
    Ok(())
}

fn resolve_managed_app_data_path(
    app: &tauri::AppHandle,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let relative = validate_relative_path(relative_path)?;
    let normalized = relative.to_string_lossy().replace('\\', "/");
    if !(normalized.starts_with("media/") || normalized.starts_with("sync-cache/")) {
        return Err("Only managed media or sync-cache paths are allowed.".to_string());
    }
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    Ok(app_data.join(relative))
}

fn validate_relative_path(value: &str) -> Result<PathBuf, String> {
    let normalized = value.replace('\\', "/");
    let path = Path::new(&normalized);
    if normalized.is_empty()
        || path.is_absolute()
        || normalized.contains(':')
        || path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("Invalid relative path.".to_string());
    }
    Ok(path.to_path_buf())
}

fn directory_summary(path: &Path) -> Result<SyncCacheSummary, String> {
    if !path.exists() {
        return Ok(SyncCacheSummary { bytes: 0, files: 0 });
    }
    let mut bytes = 0u64;
    let mut files = 0u64;
    summarize_tree(path, &mut bytes, &mut files)?;
    Ok(SyncCacheSummary { bytes, files })
}

fn summarize_tree(path: &Path, bytes: &mut u64, files: &mut u64) -> Result<(), String> {
    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        if metadata.is_dir() {
            summarize_tree(&entry.path(), bytes, files)?;
        } else if metadata.is_file() {
            *bytes += metadata.len();
            *files += 1;
        }
    }
    Ok(())
}

fn header_value(headers: &HeaderMap, name: reqwest::header::HeaderName) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(String::from)
}

fn timestamp_id() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn format_webdav_error(error: String) -> String {
    if error.to_ascii_lowercase().contains("certificate")
        || error.to_ascii_lowercase().contains("tls")
    {
        return format!("WebDAV TLS error: {error}");
    }
    error
}

#[cfg(test)]
mod tests {
    use super::validate_relative_path;

    #[test]
    fn accepts_managed_relative_paths() {
        assert!(validate_relative_path("sync/v1/refs/main.json").is_ok());
        assert!(validate_relative_path("media/illustrations/originals/file.png").is_ok());
    }

    #[test]
    fn rejects_paths_that_can_escape_the_managed_root() {
        assert!(validate_relative_path("../outside").is_err());
        assert!(validate_relative_path("sync/../../outside").is_err());
        assert!(validate_relative_path("C:/outside").is_err());
        assert!(validate_relative_path("").is_err());
    }
}
