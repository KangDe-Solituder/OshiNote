fn main() {
    println!("cargo:rerun-if-env-changed=TAURI_CONFIG");
    let config = std::env::var("TAURI_CONFIG").unwrap_or_default();
    if config.contains("com.oshinote.resource-test") {
        println!("cargo:rustc-env=OSHINOTE_RESOURCE_TEST=1");
    } else {
        println!("cargo:rustc-env=OSHINOTE_RESOURCE_TEST=0");
    }
    println!("cargo:rerun-if-changed=icons/icon.ico");
    tauri_build::build()
}
