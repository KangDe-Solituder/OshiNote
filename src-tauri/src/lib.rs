use reqwest::{Client, Method, Url};
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const BACKUP_FORMAT: &str = "oshinote-backup";
const BACKUP_VERSION: u32 = 1;
const WEBDAV_BACKUP_NAME: &str = "oshinote-latest-full.oshi.zip";
const RESTORE_LOG_FILE: &str = "restore.log";

#[derive(Debug, Serialize, Deserialize)]
struct BackupManifest {
    format: String,
    version: u32,
    mode: String,
    created_at: String,
    database: String,
    included_paths: Vec<String>,
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

#[derive(Debug, Serialize)]
struct WebDavSummary {
    remote_path: String,
    file_name: String,
    bytes: u64,
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

    let response = reqwest::get(trimmed_url)
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Font download failed: {}", response.status()));
    }
    let bytes = response.bytes().await.map_err(|error| error.to_string())?;

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

#[tauri::command]
fn create_backup(
    app: tauri::AppHandle,
    destination: String,
    include_media: bool,
) -> Result<BackupSummary, String> {
    let path = PathBuf::from(destination);
    create_backup_archive(&app, &path, include_media)
}

#[tauri::command]
fn restore_backup(app: tauri::AppHandle, archive_path: String) -> Result<BackupSummary, String> {
    restore_backup_with_log(&app, &PathBuf::from(archive_path))
}

#[tauri::command]
fn restore_downloaded_webdav_backup(app: tauri::AppHandle) -> Result<BackupSummary, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let archive_path = app_data_dir
        .join("backups")
        .join("webdav-download.oshi.zip");
    restore_backup_with_log(&app, &archive_path)
}

fn restore_backup_with_log(
    app: &tauri::AppHandle,
    archive_path: &Path,
) -> Result<BackupSummary, String> {
    let log_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    append_restore_log(
        &log_dir,
        &format!(
            "restore requested archive={} exists={}",
            archive_path.display(),
            archive_path.is_file()
        ),
    );
    let result = restore_backup_archive(app, archive_path);
    if result.is_ok() {
        append_restore_log(&log_dir, "restore completed");
    } else if let Err(error) = &result {
        append_restore_log(&log_dir, &format!("restore failed: {error}"));
    }
    result
}

fn restore_backup_archive(
    app: &tauri::AppHandle,
    archive_path: &Path,
) -> Result<BackupSummary, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let app_config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    let archive_file =
        File::open(archive_path).map_err(|error| format!("Could not open backup: {error}"))?;
    let mut archive = ZipArchive::new(archive_file)
        .map_err(|error| format!("Invalid backup archive: {error}"))?;
    let manifest = read_manifest(&mut archive)?;
    let staging = app_data_dir.join(format!(".restore-staging-{}", timestamp_id()));
    fs::create_dir_all(&staging).map_err(|error| error.to_string())?;

    let restore_result = (|| {
        extract_backup_file(
            &mut archive,
            "database/oshinote.db",
            &staging.join("oshinote.db"),
        )?;
        if manifest.mode == "complete" {
            for path in &manifest.included_paths {
                if path == "media" || path == "fonts" {
                    extract_backup_tree(
                        &mut archive,
                        &format!("appdata/{path}/"),
                        &staging.join(path),
                    )?;
                }
            }
        }

        let database_path = app_config_dir.join("oshinote.db");
        let previous_database_path = app_config_dir.join("oshinote.db.before-restore");
        let replacement_path = app_config_dir.join("oshinote.db.restore-new");
        fs::create_dir_all(&app_config_dir).map_err(|error| error.to_string())?;
        fs::copy(staging.join("oshinote.db"), &replacement_path)
            .map_err(|error| format!("Could not prepare restored database: {error}"))?;
        for suffix in ["-wal", "-shm"] {
            let sidecar = app_config_dir.join(format!("oshinote.db{suffix}"));
            if sidecar.exists() {
                fs::remove_file(sidecar)
                    .map_err(|error| format!("Could not clear SQLite sidecar: {error}"))?;
            }
        }
        if database_path.exists() {
            if previous_database_path.exists() {
                fs::remove_file(&previous_database_path)
                    .map_err(|error| format!("Could not clear previous restore backup: {error}"))?;
            }
            fs::rename(&database_path, &previous_database_path).map_err(|error| {
                format!("Could not release current database for restore: {error}")
            })?;
        }
        if let Err(error) = fs::rename(&replacement_path, &database_path) {
            if previous_database_path.exists() && !database_path.exists() {
                let _ = fs::rename(&previous_database_path, &database_path);
            }
            return Err(format!("Could not activate restored database: {error}"));
        }

        if manifest.mode == "complete" {
            for path in &manifest.included_paths {
                if path != "media" && path != "fonts" {
                    continue;
                }
                copy_tree(&staging.join(path), &app_data_dir.join(path))?;
            }
        }
        Ok::<(), String>(())
    })();

    let _ = fs::remove_dir_all(&staging);
    restore_result?;
    Ok(BackupSummary {
        mode: manifest.mode,
        path: archive_path.display().to_string(),
        included_paths: manifest.included_paths,
    })
}

#[tauri::command]
async fn test_webdav_connection(config: WebDavConfig) -> Result<(), String> {
    let client = webdav_client(&config)?;
    let url = webdav_directory_url(&config)?;
    let response = client
        .request(Method::from_bytes(b"PROPFIND").unwrap(), url)
        .basic_auth(&config.username, Some(&config.password))
        .header("Depth", "0")
        .body("")
        .send()
        .await
        .map_err(|error| format_webdav_error(error.to_string()))?;
    if response.status().is_success() || response.status().as_u16() == 207 {
        Ok(())
    } else {
        Err(format!("WebDAV connection failed: {}", response.status()))
    }
}

#[tauri::command]
async fn upload_webdav_backup(
    app: tauri::AppHandle,
    config: WebDavConfig,
) -> Result<WebDavSummary, String> {
    let client = webdav_client(&config)?;
    ensure_webdav_directories(&client, &config).await?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let backup_dir = app_data_dir.join("backups");
    fs::create_dir_all(&backup_dir).map_err(|error| error.to_string())?;
    let local_backup = backup_dir.join(WEBDAV_BACKUP_NAME);
    create_backup_archive(&app, &local_backup, true)?;
    let bytes = fs::read(&local_backup).map_err(|error| error.to_string())?;
    let size = bytes.len() as u64;
    let response = client
        .put(webdav_file_url(&config, WEBDAV_BACKUP_NAME)?)
        .basic_auth(&config.username, Some(&config.password))
        .header("Content-Type", "application/zip")
        .body(bytes)
        .send()
        .await
        .map_err(|error| format_webdav_error(error.to_string()))?;
    if !response.status().is_success() {
        return Err(format!("WebDAV upload failed: {}", response.status()));
    }
    Ok(WebDavSummary {
        remote_path: config.remote_path,
        file_name: WEBDAV_BACKUP_NAME.to_string(),
        bytes: size,
    })
}

#[tauri::command]
async fn download_webdav_backup(
    app: tauri::AppHandle,
    config: WebDavConfig,
) -> Result<String, String> {
    let client = webdav_client(&config)?;
    let response = client
        .get(webdav_file_url(&config, WEBDAV_BACKUP_NAME)?)
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
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let backup_dir = app_data_dir.join("backups");
    fs::create_dir_all(&backup_dir).map_err(|error| error.to_string())?;
    let local_path = backup_dir.join("webdav-download.oshi.zip");
    fs::write(&local_path, bytes).map_err(|error| error.to_string())?;
    Ok(local_path.display().to_string())
}

fn create_backup_archive(
    app: &tauri::AppHandle,
    destination: &Path,
    include_media: bool,
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
    add_file_to_archive(&mut writer, &database_path, "database/oshinote.db", options)?;

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
    let mut file = archive
        .by_name("manifest.json")
        .map_err(|_| "Backup manifest is missing.".to_string())?;
    let mut json = String::new();
    file.read_to_string(&mut json)
        .map_err(|error| error.to_string())?;
    let manifest: BackupManifest =
        serde_json::from_str(&json).map_err(|error| format!("Invalid backup manifest: {error}"))?;
    if manifest.format != BACKUP_FORMAT || manifest.version != BACKUP_VERSION {
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
    std::io::copy(&mut file, &mut output).map_err(|error| error.to_string())?;
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
        std::io::copy(&mut file, &mut output).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn safe_relative_path(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if path.is_absolute()
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

fn copy_tree(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }
    fs::create_dir_all(destination).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        if source_path.is_dir() {
            copy_tree(&source_path, &destination_path)?;
        } else {
            fs::copy(source_path, destination_path).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn append_restore_log(app_data_dir: &Path, message: &str) {
    let log_path = app_data_dir.join(RESTORE_LOG_FILE);
    if let Ok(mut log) = OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(
            log,
            "{} pid={} {message}",
            format_timestamp(),
            std::process::id()
        );
    }
}

fn webdav_client(config: &WebDavConfig) -> Result<Client, String> {
    Client::builder()
        .danger_accept_invalid_certs(config.allow_invalid_cert)
        .build()
        .map_err(|error| error.to_string())
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

async fn ensure_webdav_directories(client: &Client, config: &WebDavConfig) -> Result<(), String> {
    let mut current =
        Url::parse(config.base_url.trim_end_matches('/')).map_err(|error| error.to_string())?;
    for segment in config
        .remote_path
        .split('/')
        .filter(|segment| !segment.is_empty())
    {
        append_webdav_path(&mut current, segment, None)?;
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

fn format_webdav_error(error: String) -> String {
    if error.to_ascii_lowercase().contains("certificate")
        || error.to_ascii_lowercase().contains("tls")
    {
        return format!("WebDAV TLS error: {error}. If this is a trusted local server, enable the explicit invalid-certificate option.");
    }
    error
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

#[tauri::command]
fn post_local_ai_chat(
    url: String,
    api_key: String,
    body: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let endpoint = parse_http_endpoint(&url)?;
    let payload = serde_json::to_string(&body).map_err(|error| error.to_string())?;
    let mut stream = TcpStream::connect((&endpoint.host[..], endpoint.port))
        .map_err(|error| error.to_string())?;

    let mut request = format!(
        "POST {} HTTP/1.1\r\nHost: {}:{}\r\nContent-Type: application/json\r\nAccept: application/json\r\nContent-Length: {}\r\nConnection: close\r\n",
        endpoint.path,
        endpoint.host,
        endpoint.port,
        payload.as_bytes().len()
    );
    if !api_key.trim().is_empty() {
        request.push_str(&format!("Authorization: Bearer {}\r\n", api_key.trim()));
    }
    request.push_str("\r\n");
    request.push_str(&payload);

    stream
        .write_all(request.as_bytes())
        .map_err(|error| error.to_string())?;

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|error| error.to_string())?;
    let (headers, response_body) = response
        .split_once("\r\n\r\n")
        .ok_or_else(|| "Invalid Local API response".to_string())?;

    let status_code = headers
        .lines()
        .next()
        .and_then(|status_line| status_line.split_whitespace().nth(1))
        .and_then(|code| code.parse::<u16>().ok())
        .ok_or_else(|| "Invalid Local API status line".to_string())?;

    let decoded_body = if headers
        .to_ascii_lowercase()
        .contains("transfer-encoding: chunked")
    {
        decode_chunked_body(response_body)?
    } else {
        response_body.to_string()
    };

    if !(200..300).contains(&status_code) {
        return Err(format!("Local API error {}: {}", status_code, decoded_body));
    }

    serde_json::from_str(&decoded_body)
        .map_err(|error| format!("Invalid Local API response: {error}; body: {decoded_body}"))
}

struct HttpEndpoint {
    host: String,
    port: u16,
    path: String,
}

fn parse_http_endpoint(url: &str) -> Result<HttpEndpoint, String> {
    let rest = url
        .strip_prefix("http://")
        .ok_or_else(|| "Local API currently supports http:// URLs only.".to_string())?;
    let (authority, path) = match rest.split_once('/') {
        Some((authority, path)) => (authority, format!("/{}", path)),
        None => (rest, "/".to_string()),
    };
    let (host, port) = match authority.rsplit_once(':') {
        Some((host, port)) => {
            let parsed_port = port
                .parse::<u16>()
                .map_err(|_| "Invalid Local API port".to_string())?;
            (host.to_string(), parsed_port)
        }
        None => (authority.to_string(), 80),
    };
    if host.is_empty() {
        return Err("Invalid Local API host".to_string());
    }
    Ok(HttpEndpoint { host, port, path })
}

fn decode_chunked_body(body: &str) -> Result<String, String> {
    let mut rest = body;
    let mut decoded = String::new();

    loop {
        let (size_line, after_size) = rest
            .split_once("\r\n")
            .ok_or_else(|| "Invalid chunked response".to_string())?;
        let size = usize::from_str_radix(size_line.trim(), 16)
            .map_err(|_| "Invalid chunk size".to_string())?;
        if size == 0 {
            break;
        }
        if after_size.len() < size + 2 {
            return Err("Invalid chunk payload".to_string());
        }
        decoded.push_str(&after_size[..size]);
        rest = &after_size[size + 2..];
    }

    Ok(decoded)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let _window = app.get_webview_window("main").unwrap();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            post_local_ai_chat,
            download_stamp_font,
            open_external_url,
            create_backup,
            restore_backup,
            restore_downloaded_webdav_backup,
            test_webdav_connection,
            upload_webdav_backup,
            download_webdav_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running OshiNote");
}
