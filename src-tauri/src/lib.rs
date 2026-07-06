use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::process::Command;
use tauri::Manager;

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

    let app_data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let target_path = app_data_dir.join(Path::new(&normalized_path));
    if let Some(parent) = target_path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    std::fs::write(target_path, bytes).map_err(|error| error.to_string())
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
            open_external_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running OshiNote");
}
